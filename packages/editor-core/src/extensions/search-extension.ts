import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { sendMessage } from '../bridge';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        search: {
            search: (term: string) => ReturnType;
            searchNext: () => ReturnType;
            searchPrev: () => ReturnType;
            clearSearch: () => ReturnType;
        };
    }
}

export interface SearchPluginState {
    searchTerm: string;
    results: { from: number; to: number }[];
    currentIndex: number;
    decorations: DecorationSet;
}

export const searchPluginKey = new PluginKey<SearchPluginState>('search');

/**
 * Find all occurrences of a search term in the document
 */
function findMatches(doc: any, searchTerm: string): { from: number; to: number }[] {
    if (!searchTerm || searchTerm.length === 0) {
        return [];
    }

    const results: { from: number; to: number }[] = [];
    const searchLower = searchTerm.toLowerCase();

    doc.descendants((node: any, pos: number) => {
        if (node.isText && node.text) {
            const text = node.text.toLowerCase();
            let index = 0;

            while (true) {
                const foundIndex = text.indexOf(searchLower, index);
                if (foundIndex === -1) break;

                results.push({
                    from: pos + foundIndex,
                    to: pos + foundIndex + searchTerm.length,
                });

                index = foundIndex + 1;
            }
        }
    });

    return results;
}

/**
 * Create decorations for search results
 */
function createDecorations(
    doc: any,
    results: { from: number; to: number }[],
    currentIndex: number
): DecorationSet {
    const decorations: Decoration[] = results.map((result, index) => {
        const isActive = index === currentIndex;
        return Decoration.inline(result.from, result.to, {
            class: isActive ? 'search-match search-match-active' : 'search-match',
        });
    });

    return DecorationSet.create(doc, decorations);
}

/**
 * Scroll the active match into view
 */
function scrollToMatch(view: any, match: { from: number; to: number }) {
    if (!match) return;

    try {
        const coords = view.coordsAtPos(match.from);
        if (coords) {
            const element = view.domAtPos(match.from);
            if (element && element.node) {
                const targetNode = element.node.nodeType === Node.TEXT_NODE
                    ? element.node.parentElement
                    : element.node;

                if (targetNode instanceof HTMLElement) {
                    targetNode.scrollIntoView({
                        block: 'center',
                        behavior: 'smooth',
                    });
                }
            }
        }
    } catch (e) {
        console.warn('Failed to scroll to search match:', e);
    }
}

/**
 * Send search results to React Native
 */
function notifySearchResults(results: { from: number; to: number }[], currentIndex: number) {
    sendMessage({
        type: 'searchResults',
        count: results.length,
        currentIndex: results.length > 0 ? currentIndex : -1,
    });
}

export const SearchExtension = Extension.create({
    name: 'search',

    addOptions() {
        return {
            //@ts-ignore
            onResults: (results: { count: number; currentIndex: number }) => { },
        };
    },

    addCommands() {
        return {
            search:
                (term: string) =>
                    ({ editor, tr, dispatch }) => {
                        const results = findMatches(editor.state.doc, term);
                        const currentIndex = results.length > 0 ? 0 : -1;
                        const decorations = createDecorations(editor.state.doc, results, currentIndex);

                        if (dispatch) {
                            tr.setMeta(searchPluginKey, {
                                searchTerm: term,
                                results,
                                currentIndex,
                                decorations,
                            });
                            dispatch(tr);
                        }

                        // Notify
                        this.options.onResults({
                            count: results.length,
                            currentIndex: results.length > 0 ? currentIndex : -1,
                        });
                        notifySearchResults(results, currentIndex);

                        // Scroll to first match
                        if (results.length > 0) {
                            setTimeout(() => scrollToMatch(editor.view, results[0]), 50);
                        }

                        return true;
                    },

            searchNext:
                () =>
                    ({ editor, tr, dispatch }) => {
                        const pluginState = searchPluginKey.getState(editor.state);
                        if (!pluginState || pluginState.results.length === 0) return false;

                        const { results, currentIndex, searchTerm } = pluginState;
                        const newIndex = (currentIndex + 1) % results.length;
                        const decorations = createDecorations(editor.state.doc, results, newIndex);

                        if (dispatch) {
                            tr.setMeta(searchPluginKey, {
                                searchTerm,
                                results,
                                currentIndex: newIndex,
                                decorations,
                            });
                            dispatch(tr);
                        }

                        // Notify
                        this.options.onResults({
                            count: results.length,
                            currentIndex: results.length > 0 ? newIndex : -1,
                        });
                        notifySearchResults(results, newIndex);

                        // Scroll to match
                        setTimeout(() => scrollToMatch(editor.view, results[newIndex]), 50);

                        return true;
                    },

            searchPrev:
                () =>
                    ({ editor, tr, dispatch }) => {
                        const pluginState = searchPluginKey.getState(editor.state);
                        if (!pluginState || pluginState.results.length === 0) return false;

                        const { results, currentIndex, searchTerm } = pluginState;
                        const newIndex = (currentIndex - 1 + results.length) % results.length;
                        const decorations = createDecorations(editor.state.doc, results, newIndex);

                        if (dispatch) {
                            tr.setMeta(searchPluginKey, {
                                searchTerm,
                                results,
                                currentIndex: newIndex,
                                decorations,
                            });
                            dispatch(tr);
                        }

                        // Notify
                        this.options.onResults({
                            count: results.length,
                            currentIndex: results.length > 0 ? newIndex : -1,
                        });
                        notifySearchResults(results, newIndex);

                        // Scroll to match
                        setTimeout(() => scrollToMatch(editor.view, results[newIndex]), 50);

                        return true;
                    },

            clearSearch:
                () =>
                    ({ tr, dispatch }) => {
                        if (dispatch) {
                            tr.setMeta(searchPluginKey, {
                                searchTerm: '',
                                results: [],
                                currentIndex: -1,
                                decorations: DecorationSet.empty,
                            });
                            dispatch(tr);
                        }

                        // Notify
                        this.options.onResults({ count: 0, currentIndex: -1 });
                        notifySearchResults([], -1);

                        return true;
                    },
        };
    },

    addProseMirrorPlugins() {
        const extension = this;
        return [
            new Plugin({
                key: searchPluginKey,

                state: {
                    init(): SearchPluginState {
                        return {
                            searchTerm: '',
                            results: [],
                            currentIndex: -1,
                            decorations: DecorationSet.empty,
                        };
                    },
                    apply(tr, value, newState): SearchPluginState {
                        const meta = tr.getMeta(searchPluginKey);
                        if (meta) {
                            return meta;
                        }

                        // If document changed, re-run search
                        if (tr.docChanged && value.searchTerm) {
                            const results = findMatches(newState.doc, value.searchTerm);
                            // Try to keep current index valid
                            let newIndex = value.currentIndex;
                            if (newIndex >= results.length) {
                                newIndex = results.length - 1;
                            }
                            if (newIndex < 0 && results.length > 0) {
                                newIndex = 0;
                            }

                            const decorations = createDecorations(newState.doc, results, newIndex);

                            // Notify RN of updated results
                            extension.options.onResults({
                                count: results.length,
                                currentIndex: results.length > 0 ? newIndex : -1,
                            });
                            notifySearchResults(results, newIndex);

                            return {
                                searchTerm: value.searchTerm,
                                results,
                                currentIndex: newIndex,
                                decorations,
                            };
                        }

                        // Map decorations through document changes
                        return {
                            ...value,
                            decorations: value.decorations.map(tr.mapping, tr.doc),
                        };
                    },
                },

                props: {
                    decorations(state) {
                        const pluginState = this.getState(state);
                        return pluginState?.decorations || DecorationSet.empty;
                    },
                },
            }),
        ];
    },
});
