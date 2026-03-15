import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import { sendMessage } from '../bridge';

export interface NoteLinkCommandOptions {
    /** Direct callback for environments without a bridge (e.g. Tauri NativeEditor). */
    onNoteLinkCommand?: (data: any) => void;
}

export const NoteLinkCommandExtension = Extension.create<NoteLinkCommandOptions>({
    name: 'noteLinkCommand',

    addOptions() {
        return {
            onNoteLinkCommand: undefined,
        };
    },

    addProseMirrorPlugins() {
        const emit = this.options.onNoteLinkCommand ?? sendMessage;

        return [
            Suggestion({
                pluginKey: new PluginKey('noteLinkCommand'),
                editor: this.editor,
                char: '[[',
                command: () => {
                    // Executed natively, no web-side logic needed
                },
                //@ts-ignore
                items: ({ query }) => {
                    return ['note-link-command-active'];
                },
                render: () => {
                    return {
                        onStart: (props) => {
                            const rect = props.clientRect?.();
                            emit({
                                type: 'noteLinkCommand',
                                active: true,
                                query: props.query,
                                range: props.range,
                                clientRect: rect ? {
                                    top: rect.top,
                                    left: rect.left,
                                    bottom: rect.bottom,
                                    right: rect.right,
                                    width: rect.width,
                                    height: rect.height,
                                } : null,
                            });
                        },
                        onUpdate: (props) => {
                            const rect = props.clientRect?.();
                            emit({
                                type: 'noteLinkCommand',
                                active: true,
                                query: props.query,
                                range: props.range,
                                clientRect: rect ? {
                                    top: rect.top,
                                    left: rect.left,
                                    bottom: rect.bottom,
                                    right: rect.right,
                                    width: rect.width,
                                    height: rect.height,
                                } : null,
                            });
                        },
                        onExit: () => {
                            emit({
                                type: 'noteLinkCommand',
                                active: false,
                            });
                        },
                        onKeyDown: (props) => {
                            if (props.event.key === 'Escape') {
                                emit({
                                    type: 'noteLinkCommand',
                                    active: false,
                                });
                                return true;
                            }
                            return false;
                        }
                    };
                }
            }),
        ];
    },
});
