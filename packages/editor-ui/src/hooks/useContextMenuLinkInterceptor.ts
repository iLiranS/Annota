import { useEffect, type RefObject } from 'react';
import { TextSelection } from '@tiptap/pm/state';

interface UseContextMenuLinkInterceptorArgs {
    containerRef: RefObject<HTMLDivElement | null>;
    editorRef: RefObject<any>;
    onOpenLinkMenuRef: RefObject<((event: any, url: string) => void) | undefined>;
}

export function useContextMenuLinkInterceptor({
    containerRef,
    editorRef,
    onOpenLinkMenuRef,
}: UseContextMenuLinkInterceptorArgs) {
    useEffect(() => {
        const handler = (event: MouseEvent) => {
            // Only handle right-clicks inside our editor container
            const container = containerRef.current;
            if (!container || !container.contains(event.target as Node)) return;

            // Find an <a> element in the event path (safe for text nodes)
            const link = event.composedPath().find((el: any) => el?.tagName === 'A') as HTMLAnchorElement | undefined;
            if (!link || !link.href) return;

            // Only intercept if our callback is ready
            if (!onOpenLinkMenuRef.current) return;

            event.preventDefault();
            event.stopPropagation();

            // Try to select the full link range in the editor
            try {
                const editor = editorRef.current;
                if (editor?.isDestroyed === false && editor?.view) {
                    const view = editor.view;
                    const { state, dispatch } = view;
                    const coords = { left: event.clientX, top: event.clientY };
                    const posResult = view.posAtCoords(coords);
                    if (posResult) {
                        const { doc, schema } = state;
                        const markType = schema.marks.link;
                        if (markType) {
                            const $pos = doc.resolve(posResult.pos);
                            const range = $pos.markAround(markType);
                            if (range) {
                                dispatch(state.tr.setSelection(TextSelection.create(doc, range.from, range.to)));
                            }
                        }
                    }
                }
            } catch {
                // Editor not ready — skip selection update, still open the menu
            }

            const capturedHref = link.href;
            setTimeout(() => {
                onOpenLinkMenuRef.current?.(event as any, capturedHref);
            }, 50);
        };

        document.addEventListener('contextmenu', handler, true);
        return () => document.removeEventListener('contextmenu', handler, true);
    }, [containerRef, editorRef, onOpenLinkMenuRef]);
}
