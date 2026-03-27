import { useNotesStore } from "@annota/core";
import { NoteFileService } from "@annota/core/platform";
import { emitTo, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useCallback } from "react";

export function useOpenNoteInNewWindow() {
    return useCallback(async (noteId: string) => {
        const { getNoteContent, notes, tags } = useNotesStore.getState();
        const targetNote = notes.find(n => n.id === noteId);
        if (!targetNote) return;

        const label = `note-${targetNote.id}-${Math.random().toString(36).substring(7)}`;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        // @ts-ignore
        const webview = new WebviewWindow(label, {
            url: `/note-fullscreen/${targetNote.id}`,
            title: targetNote.title || "Annota Note",
            width: 1280,
            height: 720,
            decorations: true,
            transparent: false,
            titleBarStyle: "transparent",
        });

        const unlisten = await listen<{ noteId: string }>('note-window-ready', async (event) => {
            if (event.payload.noteId !== targetNote.id) return;
            unlisten();

            try {
                const rawContent = await getNoteContent(targetNote.id);
                const html = rawContent || "";

                const imageIdRegex = /data-image-id\s*=\s*(["'])(.*?)\1/gi;
                const imageIds = new Set<string>();
                let match;
                while ((match = imageIdRegex.exec(html)) !== null) {
                    if (!match[2].startsWith('temp-')) imageIds.add(match[2]);
                }

                let hydratedContent = html;
                if (imageIds.size > 0) {
                    const imageMap = await NoteFileService.resolveFileSources(Array.from(imageIds));
                    if (imageMap && Object.keys(imageMap).length > 0) {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, "text/html");
                        doc.querySelectorAll("img[data-image-id]").forEach((img) => {
                            const id = img.getAttribute("data-image-id");
                            if (id && imageMap[id]) img.setAttribute("src", imageMap[id]);
                        });
                        hydratedContent = doc.body.innerHTML;
                    }
                }

                await emitTo(label, 'note-window-init', {
                    content: hydratedContent,
                    tags: tags,
                    notes: notes.filter(n => !n.isDeleted),
                });
            } catch (err) {
                console.error('[OpenInNewWindow] Failed to send init data:', err);
            }
        });
    }, []);
}
