import { Extension } from '@tiptap/core';
import { COLOR_PALETTE } from '../../../../core/constants/colors';
import { dispatchEditorCommand } from '../command-dispatcher';

export const ShortcutManager = Extension.create({
    name: 'shortcutManager',

    priority: 1000,

    addKeyboardShortcuts() {
        const shortcuts: Record<string, () => boolean> = {
            // --- Formatting ---
            'Mod-b': () => this.editor.commands.toggleBold(),
            'Mod-i': () => this.editor.commands.toggleItalic(),
            'Mod-u': () => this.editor.commands.toggleUnderline(),
            'Mod-Shift-x': () => this.editor.commands.toggleStrike(),
            'Mod-e': () => this.editor.commands.toggleCode(),
            'Mod-Alt-c': () => this.editor.commands.toggleCodeBlock(),

            // --- Headings ---
            'Mod-1': () => this.editor.commands.toggleHeading({ level: 1 }),
            'Mod-2': () => this.editor.commands.toggleHeading({ level: 2 }),
            'Mod-3': () => this.editor.commands.toggleHeading({ level: 3 }),
            'Mod-4': () => this.editor.commands.toggleHeading({ level: 4 }),
            'Mod-5': () => this.editor.commands.toggleHeading({ level: 5 }),
            'Mod-6': () => this.editor.commands.toggleHeading({ level: 6 }),

            // --- Lists ---
            'Mod-7': () => this.editor.commands.toggleBulletList(),
            'Mod-8': () => this.editor.commands.toggleOrderedList(),
            'Mod-9': () => this.editor.commands.toggleTaskList(),

            // --- Custom Commands ---
            'Mod-Shift-b': () => this.editor.commands.toggleBlockquote(),
            'Mod-.': () => (this.editor.commands as any).toggleDetails(),
            // Mod-k (Link) and Mod-Shift-m (Math) are handled by the desktop/mobile host to trigger dialogs
            'Mod-k': () => false,
            'Mod-Shift-m': () => false,


            // --- Reset Color ---
            'Mod-Shift-n': () => this.editor.commands.unsetColor(),
        };

        // --- Colors (Alt-[1-0]) ---
        // Mapping: 1=Orange, 2=Red, 3=Yellow, 4=Green, 5=Teal, 6=Blue, 7=Purple, 8=Gray, 9=Pink, 0=Brown
        COLOR_PALETTE.forEach((color, index) => {
            const key = (index + 1) % 10; // 0-9 keys
            const colorKey = `Mod-Alt-${key}`;
            shortcuts[colorKey] = () => {
                if (this.editor.isActive('textStyle', { color: color.value })) {
                    return dispatchEditorCommand(this.editor, 'unsetColor');
                }
                return dispatchEditorCommand(this.editor, 'setColor', { color: color.value });
            };

            // --- Highlights (Mod-Alt-[1-0]) ---
            const highlightKey = `Mod-Alt-Shift-${key}`;
            shortcuts[highlightKey] = () => {
                let highlightColor = color.value;
                if (highlightColor.startsWith('#') && highlightColor.length === 7) {
                    highlightColor += '4D'; // ~30% alpha as used in commands.ts
                }
                if (this.editor.isActive('highlight', { color: highlightColor })) {
                    return this.editor.commands.unsetHighlight();
                }
                return this.editor.commands.setHighlight({ color: highlightColor });
            };
        });

        return shortcuts;
    },
});
