import { useEffect } from 'react';
import { PopupType } from '../shared/types';

interface UseEditorKeyboardShortcutsArgs {
    editor: any;
    setCurrentLatex: (latex: string | null) => void;
    setIsBlockMath: (isBlock: boolean) => void;
    setActivePopup: (popup: PopupType) => void;
}

export function useEditorKeyboardShortcuts({
    editor,
    setCurrentLatex,
    setIsBlockMath,
    setActivePopup,
}: UseEditorKeyboardShortcutsArgs) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMod = e.metaKey || e.ctrlKey;
            const isShift = e.shiftKey;
            const key = e.key.toLowerCase();

            if (key === 'tab') {
                if (editor && editor.isFocused) {
                    // Always prevent browser focus jumping when in the editor.
                    // TipTap's internal keyboard shortcuts (Indentation and Table) 
                    // will handle the actual logic.
                    e.preventDefault();
                    return;
                }
            }

            if (isMod && isShift && key === 'm') {
                if (!editor) return;
                e.preventDefault();

                const { selection } = editor.state;
                let latex = '';
                let isBlock = false;

                if ((selection as any).node?.type.name === 'inlineMath') {
                    latex = (selection as any).node.attrs.latex;
                    isBlock = false;
                } else if ((selection as any).node?.type.name === 'blockMath') {
                    latex = (selection as any).node.attrs.latex;
                    isBlock = true;
                } else {
                    latex = editor.state.doc.textBetween(selection.from, selection.to, ' ');
                }

                setCurrentLatex(latex || null);
                setIsBlockMath(isBlock);
                requestAnimationFrame(() => {
                    setActivePopup('math');
                });
            } else if (isMod && key === 'k') {
                if (!editor) return;
                e.preventDefault();
                requestAnimationFrame(() => {
                    setActivePopup('link');
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editor, setCurrentLatex, setIsBlockMath, setActivePopup]);
}
