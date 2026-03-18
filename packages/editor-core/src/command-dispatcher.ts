import { Editor } from "@tiptap/core";
import { DOMSerializer } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";


function getDefaultCodeLanguage(editor: any): string {
    try {
        const ext = editor?.extensionManager?.extensions?.find((e: any) => e.name === 'codeBlock');
        return ext?.options?.defaultLanguage ?? 'plaintext';
    } catch {
        return 'plaintext';
    }
}

async function copyToClipboard(text: string, html?: string) {
    try {
        if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
            const data = [new ClipboardItem({
                'text/plain': new Blob([text], { type: 'text/plain' }),
                'text/html': new Blob([html], { type: 'text/html' })
            })];
            await navigator.clipboard.write(data);
            console.log('Rich content copied to clipboard');
        } else {
            await navigator.clipboard.writeText(text);
            console.log('Text copied to clipboard');
        }
    } catch (err) {
        console.error('Failed to copy content: ', err);
        // Fallback to basic text copy
        try { await navigator.clipboard.writeText(text); } catch (e) { }
    }
}


function hasParams(params: any): boolean {
    if (params === undefined || params === null) return false;
    if (Array.isArray(params)) return params.length > 0;
    if (typeof params !== 'object') return true;
    return Object.keys(params).length > 0;
}

export function dispatchEditorCommand(editor: Editor, command: string, params: Record<string, any> = {}): boolean {
    if (!editor) return false;

    const chain = editor.chain() as any;
    let finalParams: any = { ...params };

    // Centralized transformations and fixes.
    switch (command) {
        case 'setHeading':
            command = 'toggleHeading';
            finalParams = { level: params?.level ?? 1 };
            break;
        case 'toggleHeading':
            finalParams = { level: params?.level ?? 1 };
            break;
        case 'toggleCodeBlock':
            finalParams = hasParams(params) ? params : { language: getDefaultCodeLanguage(editor) };
            break;
        case 'insertTable':
            finalParams = {
                rows: params?.rows ?? 3,
                cols: params?.cols ?? 3,
                withHeaderRow: params?.withHeaderRow !== false,
            };
            break;
        case 'insertImage':
            command = 'setImage';
            break;
        case 'setImage':
            if (!params?.src) return true;
            break;
        case 'setYoutubeVideo':
            if (!params?.src) return true;
            break;
        case 'setHighlight': {
            const color = params?.color as string | undefined;
            if (!color) return true;
            let adjusted = color;
            if (adjusted.startsWith('#') && adjusted.length === 7) adjusted += '40';
            finalParams = { ...params, color: adjusted };
            break;
        }
        case 'setColor':
            if (!params?.color) return true;
            finalParams = params.color;
            break;
        case 'setCellBackground': {
            const color = params?.color as string | null;
            if (!color) return true;
            let adjusted = color;
            if (adjusted.startsWith('#') && adjusted.length === 7) adjusted += '40';
            command = 'setCellAttribute';
            finalParams = ['backgroundColor', adjusted];
            break;
        }
        case 'unsetCellBackground':
            command = 'setCellAttribute';
            finalParams = ['backgroundColor', null];
            break;
        case 'updateAttributes':
            if (!params?.type) return true;
            finalParams = [params.type, params.attrs];
            break;
        case 'unsetColor': {
            const { state, view } = editor;
            const { selection } = state;
            if (!selection.empty) {
                chain.unsetMark('textStyle').run();
            } else {
                // for some reason this fixed all issues...
                chain.unsetMark('textStyle').run();

            }
            view?.focus?.();
            return true;
        }
        case 'setMath': {
            if (!params?.latex) return true;
            const { selection } = editor.state;
            const isMathNode = 'node' in selection && selection.node &&
                //@ts-ignore
                ['inlineMath', 'blockMath'].includes(selection.node.type.name);

            if (isMathNode && selection.node) {
                //@ts-ignore
                chain.updateAttributes(selection.node.type.name, { latex: params.latex }).focus().run();
            } else {
                chain
                    .insertContent([
                        { type: 'inlineMath', attrs: { latex: params.latex } },
                        { type: 'text', text: ' ' },
                    ])
                    .focus()
                    .run();
            }
            return true;
        }
        case 'toggleDetails':
            if (editor.isActive('details')) {
                chain.unsetDetails().focus().run();
            } else {
                chain.setDetails().focus().run();
            }
            return true;
        case 'setDetailsBackground': {
            let bgColor = params?.color as string | undefined;

            // Standardize the alpha channel (0.15 opacity is roughly '26' in hex)
            if (bgColor && bgColor.startsWith('#') && bgColor.length === 7) {
                bgColor += '26';
            }

            // Grab the exact position from params, or fallback to the mobile global hack if your UI still uses it
            const targetPos = params?.pos ?? (typeof window !== 'undefined' ? (window as any)._lastBlockMenuPos : undefined);

            if (typeof targetPos === 'number') {
                const node = editor.state.doc.nodeAt(targetPos);
                if (node && node.type.name === 'details') {
                    editor.view.dispatch(editor.state.tr.setNodeMarkup(targetPos, undefined, {
                        ...node.attrs,
                        backgroundColor: bgColor
                    }));
                    return true;
                }
            }

            // Fallback: Use the native command you wrote in details.ts
            chain.setDetailsBackground(bgColor).focus().run();
            return true;
        }

        case 'unsetDetailsBackground': {
            const targetPos = params?.pos ?? (typeof window !== 'undefined' ? (window as any)._lastBlockMenuPos : undefined);

            if (typeof targetPos === 'number') {
                const node = editor.state.doc.nodeAt(targetPos);
                if (node && node.type.name === 'details') {
                    editor.view.dispatch(editor.state.tr.setNodeMarkup(targetPos, undefined, {
                        ...node.attrs,
                        backgroundColor: null
                    }));
                    return true;
                }
            }

            // Fallback: Use the native command you wrote in details.ts
            chain.unsetDetailsBackground().focus().run();
            return true;
        }
        case 'setCodeBlockLanguage':
            if (!params?.language) return true;
            if (params?.pos !== undefined) {
                chain
                    .setNodeSelection(params.pos)
                    .updateAttributes('codeBlock', { language: params.language })
                    .focus()
                    .run();
            } else {
                chain.updateAttributes('codeBlock', { language: params.language }).focus().run();
            }
            return true;
        case 'setLink':
            if (!params?.href) return true;
            if (params.title && editor.state.selection.empty) {
                chain.insertContent({
                    type: 'text',
                    text: params.title,
                    marks: [{ type: 'link', attrs: { href: params.href } }]
                }).focus().run();
            } else {
                chain.setLink({ href: params.href }).focus().run();
            }
            return true;
        case 'setNodeSelection':
            if (params?.pos !== undefined) {
                chain.setNodeSelection(params.pos).focus().run();
            }
            return true;
        case 'insertContentAt': {
            const pos = params?.pos;
            const content = params?.content;
            if (pos === undefined || content === undefined) return true;
            const options = params?.options;
            chain.insertContentAt(pos, content, options).focus().run();
            return true;
        }
        case 'copyToClipboard': {
            if (typeof params?.pos === 'number') {
                editor.chain().focus().setNodeSelection(params.pos).run();
            } else {
                editor.chain().focus().run();
            }

            const slice = editor.state.selection.content();
            let fragment = slice.content;

            // Normalize: If we're not explicitly copying a block node (NodeSelection), 
            // and the fragment is wrapped in a 'greedy' container like 'details' or 'codeBlock', unwrap it.
            // This ensures copying text inside a block doesn't carry the block wrapper inappropriately.
            const isNodeSelection = editor.state.selection instanceof NodeSelection;
            if (!isNodeSelection) {
                while (fragment.childCount === 1) {
                    const child = fragment.firstChild!;
                    if (['details', 'detailsContent', 'codeBlock'].includes(child.type.name)) {
                        fragment = child.content;
                    } else {
                        break;
                    }
                }
            }
            
            const text = fragment.textBetween(0, fragment.size, ' ');

            // Generate HTML for the selected block/content
            let html = '';
            try {
                const div = document.createElement('div');
                const serializer = DOMSerializer.fromSchema(editor.schema);
                div.appendChild(serializer.serializeFragment(fragment));
                html = div.innerHTML;
            } catch (e) {
                console.error('Failed to serialize content to HTML', e);
            }

            copyToClipboard(text, html);
            return true;
        }

        case 'deleteSelection': {
            console.log(params)
            if (typeof params?.from === 'number' && typeof params?.to === 'number') {
                // Range-based deletion (used by slash commands to remove "/query" text)
                editor.chain().focus().deleteRange({ from: params.from, to: params.to }).run();
            } else if (typeof params?.pos === 'number') {
                chain.setNodeSelection(params.pos).deleteSelection().focus().run();
            } else {
                chain.deleteSelection().focus().run();
            }
            return true;
        }
        case 'deleteImage': {
            if (typeof params?.pos === 'number') {
                chain.setNodeSelection(params.pos).deleteSelection().focus().run();
                return true;
            }
            if (editor.isActive('image')) {
                chain.deleteSelection().focus().run();
                return true;
            }
            return true;
        }
        case 'updateImage': {
            if (params?.pos !== undefined) {
                const { pos, ...attrs } = params;
                const node = editor.state.doc.nodeAt(pos);
                if (node) {
                    editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }));
                }
                return true;
            }
            if (typeof (window as any)?.updateImage === 'function') {
                (window as any).updateImage?.(params);
                return true;
            }
            chain.updateAttributes('image', params).focus().run();
            return true;
        }
    }

    const fn = (chain as any)[command];
    if (typeof fn === 'function') {
        if (Array.isArray(finalParams)) {
            fn.apply(chain, finalParams);
        } else if (hasParams(finalParams)) {
            fn.call(chain, finalParams);
        } else {
            fn.call(chain);
        }
        chain.focus().run();
        return true;
    }

    return false;
}
