import { useCallback, useEffect, useRef, useState } from "react";
import { TipTapEditorRef } from "@annota/editor-ui";
import { ContextMode, useAiChat, useAiStore, useSettingsStore } from "@annota/core";
import { convertMarkdownToAnnotaHTML } from "@annota/editor-core";

interface UseNoteEditorAIProps {
    editorRef: React.RefObject<TipTapEditorRef | null>;
}

export function useNoteEditorAI({ editorRef }: UseNoteEditorAIProps) {
    const { sendMessage: sendAiMessage, isStreaming: isAiStreaming, stop: stopAiChat } = useAiChat('inline-assistant');
    
    const [aiSelection, setAiSelection] = useState<{ 
        isVisible: boolean; 
        anchorRect: DOMRect | null;
        cursorPosition?: { x: number; y: number } | null;
    }>({
        isVisible: false,
        anchorRect: null,
        cursorPosition: null
    });
    const isMouseDownRef = useRef(false);
    const isRightClickRef = useRef(false);
    const pendingSelectionRef = useRef<DOMRect | null>(null);
    const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rightClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hideAISelection = useCallback(() => {
        setAiSelection(prev => (prev.isVisible ? { ...prev, isVisible: false } : prev));
    }, []);

    useEffect(() => {
        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) {
                isRightClickRef.current = true;
                
                // Hide popover on any mousedown outside the popover itself
                // Radix handles its own internal clicks, but we want to sync our state
                const target = e.target as HTMLElement;
                if (!target.closest('[data-radix-popper-content-wrapper]')) {
                    hideAISelection();
                }
                return;
            }
            isRightClickRef.current = false;
            isMouseDownRef.current = true;
            
            // Hide popover on any mousedown outside the popover itself
            // Radix handles its own internal clicks, but we want to sync our state
            const target = e.target as HTMLElement;
            if (!target.closest('[data-radix-popper-content-wrapper]')) {
                hideAISelection();
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            if (e.button !== 0) {
                if (rightClickTimeoutRef.current) clearTimeout(rightClickTimeoutRef.current);
                rightClickTimeoutRef.current = setTimeout(() => {
                    isRightClickRef.current = false;
                }, 100);
                return;
            }
            isMouseDownRef.current = false;
            if (pendingSelectionRef.current) {
                const rect = pendingSelectionRef.current;
                pendingSelectionRef.current = null;
                
                const cursorPosition = { x: e.clientX, y: e.clientY };
                
                // Small delay to allow 'click' events to pass before showing.
                // This prevents Radix Popover from immediately closing due to 
                // the click event being perceived as "outside" right after it opens.
                setTimeout(() => {
                    setAiSelection({ 
                        isVisible: true, 
                        anchorRect: rect,
                        cursorPosition 
                    });
                }, 10);
            }
        };

        window.addEventListener('mousedown', onMouseDown, true);
        window.addEventListener('mouseup', onMouseUp, true);
        return () => {
            window.removeEventListener('mousedown', onMouseDown, true);
            window.removeEventListener('mouseup', onMouseUp, true);
            if (rightClickTimeoutRef.current) clearTimeout(rightClickTimeoutRef.current);
        };
    }, [hideAISelection]);

    const handleAIAction = useCallback(async (action: string, instructions?: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        const mode = action as ContextMode;
        const selection = (editor as any).getSelection?.() || { text: '', html: '', range: { from: 0, to: 0 } };
        const selectedText = selection.text;
        const selectedHtml = selection.html;

        if (!selectedText && !selectedHtml) {
            hideAISelection();
            return;
        }

        if (action === 'send-to-chat') {
            useAiStore.getState().setChatContext({ text: selectedText, html: selectedHtml || selectedText });
            hideAISelection();
            useSettingsStore.getState().updateGeneralSettings({ 
                isSecondarySidebarOpen: true,
                secondarySidebarTab: 'ai'
            });
            return;
        }

        await sendAiMessage(instructions || selectedHtml || selectedText, {
            mode: mode,
            manualContext: selectedHtml || selectedText,
            onFinish: async (text: string) => {
                if (mode === 'rewrite') {
                    const html = await convertMarkdownToAnnotaHTML(text);
                    editor.onCommand('insertContent', { content: html });
                }
                hideAISelection();
            }
        });
    }, [sendAiMessage, editorRef, hideAISelection]);

    const handleSelectionChange = useCallback(({ empty, clientRect, nodeName }: { empty: boolean; clientRect: DOMRect | null; nodeName?: string }) => {
        if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
        pendingSelectionRef.current = null;

        if (isRightClickRef.current) {
            return;
        }

        if (empty || !clientRect || nodeName) {
            hideAISelection();
            return;
        }

        if (isMouseDownRef.current) {
            pendingSelectionRef.current = clientRect;
            return;
        }

        aiTimeoutRef.current = setTimeout(() => {
            setAiSelection({ isVisible: true, anchorRect: clientRect });
        }, 150);
    }, [hideAISelection]);

    const handleScroll = useCallback(() => {
        if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
        hideAISelection();
    }, [hideAISelection]);

    return {
        aiSelection,
        isAiStreaming,
        handleAIAction,
        handleSelectionChange,
        handleScroll,
        stopAiChat,
        hideAISelection,
    };
}
