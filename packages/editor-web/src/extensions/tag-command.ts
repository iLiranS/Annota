import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import { sendMessage } from '../bridge';

export interface TagCommandOptions {
    /** Direct callback for environments without a bridge (e.g. Tauri NativeEditor). */
    onTagCommand?: (data: any) => void;
}

export const TagCommandExtension = Extension.create<TagCommandOptions>({
    name: 'tagCommand',

    addOptions() {
        return {
            onTagCommand: undefined,
        };
    },

    addProseMirrorPlugins() {
        const emit = this.options.onTagCommand ?? sendMessage;

        return [
            Suggestion({
                pluginKey: new PluginKey('tagCommand'),
                editor: this.editor,
                char: '#',
                command: () => {
                    // Executed natively, no web-side logic needed
                },
                //@ts-ignore
                items: ({ query }) => {
                    return ['tag-command-active'];
                },
                render: () => {
                    return {
                        onStart: (props) => {
                            const rect = props.clientRect?.();
                            emit({
                                type: 'tagCommand',
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
                                type: 'tagCommand',
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
                                type: 'tagCommand',
                                active: false,
                            });
                        },
                        onKeyDown: (props) => {
                            if (props.event.key === 'Escape') {
                                emit({
                                    type: 'tagCommand',
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
