export const hasDOM = typeof document !== 'undefined';
export const isDesktop = hasDOM && typeof window !== 'undefined' && !(window as any).ReactNativeWebView;

// Shared flag: suppress PM's automatic scroll-into-view after a drag-drop
// (the drop transaction always carries scrollIntoView which causes random jumps)
if (isDesktop && typeof globalThis !== 'undefined' && !(globalThis as any).__annotaDragBlock) {
    let _isDraggingBlock = false;
    (globalThis as any).__annotaDragBlock = {
        setDragging(v: boolean) {
            _isDraggingBlock = v;
        },
        isDragging() {
            return _isDraggingBlock;
        },
    };
}
