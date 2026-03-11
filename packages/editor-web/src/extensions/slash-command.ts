import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { sendMessage } from '../bridge';

export interface SlashCommandOptions {
    /** Direct callback for environments without a bridge (e.g. Tauri NativeEditor). */
    onSlashCommand?: (data: any) => void;
}

export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
    name: 'slashCommand',

    addOptions() {
        return {
            onSlashCommand: undefined,
        };
    },

    addProseMirrorPlugins() {
        const emit = this.options.onSlashCommand ?? sendMessage;

        return [
            Suggestion({
                editor: this.editor,
                char: '/',
                command: () => {
                    // Executed natively, no web-side logic needed
                },
                items: ({ query }) => {
                    // Tiptap Suggestion cancels the process if items is empty.
                    // We must return a dummy item so it proceeds and triggers our render hooks.
                    return ['slash-command-active'];
                },
                render: () => {
                    return {
                        onStart: (props) => {
                            const rect = props.clientRect?.();
                            emit({
                                type: 'slashCommand',
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
                                type: 'slashCommand',
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
                                type: 'slashCommand',
                                active: false,
                            });
                        },
                        onKeyDown: (props) => {
                            if (props.event.key === 'Escape') {
                                emit({
                                    type: 'slashCommand',
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
