import { copyImageToClipboard, writeText } from "@/lib/clipboard";
import { TipTapEditorRef } from "@annota/editor-ui";
import { useCallback, useState } from "react";

interface UseBlockMenuHandlerProps {
    editorRef: React.RefObject<TipTapEditorRef | null>;
    noteId: string | undefined;
}

export function useBlockMenuHandler({ editorRef, noteId }: UseBlockMenuHandlerProps) {
    const [activeBlockMenu, setActiveBlockMenu] = useState<{
        type: "image" | "file" | "details" | "codeBlock" | "table" | "mermaid" | "quote";
        data: any;
        anchorRect: DOMRect;
        onResolve: () => any;
    } | null>(null);

    const handleOpenBlockMenu = useCallback((e: MouseEvent, resolve: () => any) => {
        const result = resolve();
        if (!result) return;

        const targetEl = e.target as HTMLElement;
        const anchorEl = targetEl.closest('button') || targetEl;


        setActiveBlockMenu({
            type: result.message.blockType || "details",
            data: result.message,
            anchorRect: anchorEl.getBoundingClientRect(),
            onResolve: resolve,
        });
    }, []);

    const handleCodeBlockSelected = useCallback((e: MouseEvent, resolve: () => any) => {
        const result = resolve();
        if (!result) return;

        const targetEl = e.target as HTMLElement;
        const anchorEl = targetEl.closest('button') || targetEl;

        setActiveBlockMenu({
            type: "codeBlock",
            data: result.message,
            anchorRect: anchorEl.getBoundingClientRect(),
            onResolve: resolve,
        });
    }, []);

    const handleOpenFileMenu = useCallback((e: MouseEvent, resolve: () => any) => {
        const result = resolve();
        if (!result) return;

        const targetEl = e.target as HTMLElement;
        const anchorEl = targetEl.closest('button') || targetEl;

        setActiveBlockMenu({
            type: result.message.type === 'openOpenFileMenu' && (result.message as any).fileId ? "file" : "image",
            data: result.message,
            anchorRect: anchorEl.getBoundingClientRect(),
            onResolve: resolve,
        });
    }, []);

    const handleOpenTableMenu = useCallback((e: MouseEvent, resolve: () => any) => {
        const result = resolve();
        if (!result) return;

        const targetEl = e.target as HTMLElement;
        const anchorEl = targetEl.closest('button') || targetEl;

        setActiveBlockMenu({
            type: "table",
            data: result.message,
            anchorRect: anchorEl.getBoundingClientRect(),
            onResolve: resolve,
        });
    }, []);

    const handleBlockAction = useCallback(async (action: string, params?: any) => {
        if (!activeBlockMenu || !editorRef.current) return;

        const { data, type } = activeBlockMenu;

        switch (action) {
            case "resize":
                editorRef.current.onCommand("updateImage", { pos: data.position, width: params.width });
                break;
            case "copy":
                if (type === "image") {
                    const src = data.src || "";
                    copyImageToClipboard(src, data.imageId);
                } else if (type === "file") {
                    if (data.localPath) {
                        const { resolveLocalUri } = await import("@annota/core");
                        const absPath = await resolveLocalUri(data.localPath);
                        await writeText(absPath);
                    }
                } else {
                    editorRef.current.onCommand("copyToClipboard", { pos: data.pos });
                }
                break;
            case "cut":
                if (type === "image") {
                    const src = data.src || "";
                    copyImageToClipboard(src, data.imageId);
                    editorRef.current.onCommand("deleteImage", { pos: data.position });
                } else if (["codeBlock", "details", "mermaid", "quote", "flashcard"].includes(type)) {
                    editorRef.current.onCommand("copyToClipboard", { pos: data.pos });
                    editorRef.current.onCommand("deleteSelection", { pos: data.pos });
                }
                break;
            case "delete":
                if (type === "image") {
                    editorRef.current.onCommand("deleteImage", { pos: data.position });
                } else if (type === "table") {
                    editorRef.current.onCommand("deleteTable", {});
                } else {
                    editorRef.current.onCommand("deleteSelection", { pos: data.pos });
                }
                break;
            case "background":
                if (type === "details") {
                    editorRef.current.onCommand("setDetailsBackground", { pos: data.pos, color: params.color });
                } else if (type === "quote") {
                    editorRef.current.onCommand("setQuoteBackground", { pos: data.pos, color: params.color });
                } else if (type === "table") {
                    if (params.color) {
                        editorRef.current.onCommand("setCellBackground", { color: params.color });
                    } else {
                        editorRef.current.onCommand("unsetCellBackground", {});
                    }
                }
                break;
            case "addRowBefore":
                editorRef.current.onCommand("addRowBefore", {});
                break;
            case "addRowAfter":
                editorRef.current.onCommand("addRowAfter", {});
                break;
            case "addColumnBefore":
                editorRef.current.onCommand("addColumnBefore", {});
                break;
            case "addColumnAfter":
                editorRef.current.onCommand("addColumnAfter", {});
                break;
            case "deleteRow":
                editorRef.current.onCommand("deleteRow", {});
                break;
            case "deleteColumn":
                editorRef.current.onCommand("deleteColumn", {});
                break;
            case "mergeCells":
                editorRef.current.onCommand("mergeCells", {});
                break;
            case "splitCell":
                editorRef.current.onCommand("splitCell", {});
                break;
            case "copyLink":
                const id = data.id || (data.attrs && data.attrs.id);
                if (id) {
                    const link = `annota://note/${noteId}?blockId=${id}`;
                    await writeText(link);
                }
                break;
            case "language":
                editorRef.current.onCommand("setCodeBlockLanguage", { pos: data.pos, language: params.language });
                break;
            case "download":
                if (type === "image" && data.src) {
                    try {
                        const response = await fetch(data.src);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = data.imageId ? `${data.imageId}.webp` : 'image_download';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                    } catch (err) {
                        console.error("Download failed:", err);
                    }
                }
                break;
            case "open":
                if (type === "file" && data.localPath) {
                    editorRef.current.onCommand("openFile", { localPath: data.localPath, mimeType: data.mimeType });
                }
                break;
        }
    }, [activeBlockMenu, editorRef, noteId]);

    return {
        activeBlockMenu,
        setActiveBlockMenu,
        handleOpenBlockMenu,
        handleCodeBlockSelected,
        handleOpenFileMenu,
        handleOpenTableMenu,
        handleBlockAction,
    };
}
