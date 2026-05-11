import { useCallback, useRef, useState } from "react";
import { TipTapEditorRef } from "@annota/editor-ui";
import { ContextMode, useAiChat, useAiStore, useSettingsStore } from "@annota/core";
import { convertMarkdownToAnnotaHTML } from "@annota/editor-core";

interface UseNoteEditorAIProps {
    editorRef: React.RefObject<TipTapEditorRef | null>;
}

export function useNoteEditorAI({ editorRef }: UseNoteEditorAIProps) {
    const { sendMessage: sendAiMessage, isStreaming: isAiStreaming, stop: stopAiChat } = useAiChat('inline-assistant');
    
    const [aiSelection, setAiSelection] = useState<{ isVisible: boolean; anchorRect: DOMRect | null }>({
        isVisible: false,
        anchorRect: null
    });
    const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleAIAction = useCallback(async (action: string, instructions?: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        const mode = action as ContextMode;
        const selection = (editor as any).getSelection?.() || { text: '', html: '', range: { from: 0, to: 0 } };
        const selectedText = selection.text;
        const selectedHtml = selection.html;

        if (!selectedText && !selectedHtml) {
            setAiSelection(prev => ({ ...prev, isVisible: false }));
            return;
        }

        if (action === 'send-to-chat') {
            useAiStore.getState().setChatContext({ text: selectedText, html: selectedHtml || selectedText });
            setAiSelection(prev => ({ ...prev, isVisible: false }));
            useSettingsStore.getState().updateGeneralSettings({ isAiSidebarOpen: true });
            return;
        }

        await sendAiMessage(instructions || selectedHtml || selectedText, {
            mode: mode,
            manualContext: selectedHtml || selectedText,
            onFinish: async (text: string) => {
                if (mode === 'rewrite') {
                    const html = await convertMarkdownToAnnotaHTML(text);
                    editor.onCommand('insertContent', { content: html });
                } else if (mode === 'flashcard') {
                    const insertPos = selection?.range?.to;
                    if (typeof insertPos === 'number') {
                        editor.onCommand('setTextSelection', { from: insertPos, to: insertPos });
                    }
                    const html = await convertMarkdownToAnnotaHTML(text);
                    editor.onCommand('insertContent', { content: html });
                }
                setAiSelection(prev => ({ ...prev, isVisible: false }));
            }
        });
    }, [sendAiMessage, editorRef]);

    const handleSelectionChange = useCallback(({ empty, clientRect, nodeName }: { empty: boolean; clientRect: DOMRect | null; nodeName?: string }) => {
        if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);

        if (empty || !clientRect || nodeName) {
            setAiSelection(prev => ({ ...prev, isVisible: false }));
            return;
        }

        aiTimeoutRef.current = setTimeout(() => {
            setAiSelection({ isVisible: true, anchorRect: clientRect });
        }, 300);
    }, []);

    const handleScroll = useCallback(() => {
        if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
        setAiSelection(prev => prev.isVisible ? { ...prev, isVisible: false } : prev);
    }, []);

    return {
        aiSelection,
        isAiStreaming,
        handleAIAction,
        handleSelectionChange,
        handleScroll,
        stopAiChat,
    };
}
