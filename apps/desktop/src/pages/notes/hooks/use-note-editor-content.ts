import { useCallback, useEffect, useRef, useState } from "react";
import { generateTitle, normalizeStoredContent, useNotesStore } from "@annota/core";
import { NoteFileService } from "@annota/core/platform";
import { TipTapEditorRef } from "@annota/editor-ui";

interface UseNoteEditorContentProps {
    noteId: string | undefined;
    editorRef: React.RefObject<TipTapEditorRef | null>;
    onNoteSync?: (noteId: string, content: string, title: string) => void;
    blockId?: string | null;
    initialContent?: string;
}

export function useNoteEditorContent({ noteId, editorRef, onNoteSync, blockId, initialContent: propInitialContent }: UseNoteEditorContentProps) {
    const getNoteContent = useNotesStore((s) => s.getNoteContent);
    const { updateNoteContent, updateNoteMetadata } = useNotesStore();
    const notes = useNotesStore((s) => s.notes);
    const note = notes.find((n) => n.id === noteId);

    const [initialContent, setInitialContent] = useState<string | null>(null);
    const isApplyingRemoteRef = useRef(false);
    const pendingRemoteContentRef = useRef<string | null>(null);
    const lastSeenUpdatedAtRef = useRef<number | null>(null);
    const hasScrolledRef = useRef(false);

    const extractImageIds = useCallback((html: string): string[] => {
        const regex = /data-image-id\s*=\s*(["'])(.*?)\1/gi;
        const ids = new Set<string>();
        let match;
        while ((match = regex.exec(html)) !== null) {
            const id = match[2];
            if (!id.startsWith('temp-')) {
                ids.add(id);
            }
        }
        return Array.from(ids);
    }, []);

    const hydrateImageSrcs = useCallback(async (html: string): Promise<string> => {
        const ids = extractImageIds(html);
        if (ids.length === 0) return html;

        const imageMap = await NoteFileService.resolveFileSources(ids);
        if (!imageMap || Object.keys(imageMap).length === 0) return html;

        if (typeof DOMParser !== "undefined") {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const imgs = doc.querySelectorAll("img[data-image-id]");
            imgs.forEach((img) => {
                const id = img.getAttribute("data-image-id");
                if (id && imageMap[id]) {
                    img.setAttribute("src", imageMap[id]);
                }
            });
            return doc.body.innerHTML;
        }

        const escapeAttr = (value: string) => value.replace(/"/g, "&quot;");
        return html.replace(/<img\b[^>]*>/gi, (tag) => {
            const idMatch = tag.match(/data-image-id\s*=\s*["']([^"']+)["']/i);
            const id = idMatch?.[1];
            if (!id || !imageMap[id]) return tag;
            const src = escapeAttr(imageMap[id]);
            if (/src\s*=\s*["'][^"']*["']/i.test(tag)) {
                return tag.replace(/src\s*=\s*["'][^"']*["']/i, `src="${src}"`);
            }
            return tag.replace(/\s*\/?>$/, (end) => ` src="${src}"${end}`);
        });
    }, [extractImageIds]);

    const resolveImagesForContent = useCallback(async (html: string) => {
        if (!editorRef.current) return;
        const ids = extractImageIds(html);
        if (ids.length === 0) return;

        const resolveWithIds = async (imageIds: string[], attempt: number) => {
            if (!editorRef.current || imageIds.length === 0) return;
            try {
                const imageMap = await NoteFileService.resolveFileSources(imageIds);
                if (Object.keys(imageMap).length > 0) {
                    editorRef.current.onCommand("resolveImages", { imageMap });
                }

                const unresolved = imageIds.filter((id) => !imageMap[id]);
                if (unresolved.length > 0 && attempt < 2) {
                    setTimeout(() => {
                        resolveWithIds(unresolved, attempt + 1);
                    }, 1200);
                }
            } catch (err) {
                console.error("Failed to resolve image sources", err);
            }
        };

        void resolveWithIds(ids, 0);
    }, [editorRef, extractImageIds]);

    const fetchNoteContent = useCallback(async (targetNoteId: string): Promise<string | null> => {
        try {
            return await getNoteContent(targetNoteId);
        } catch (err) {
            console.error("Failed to load note content", err);
            return null;
        }
    }, [getNoteContent]);

    // Initial load
    useEffect(() => {
        if (!noteId) return;
        setInitialContent(null);
        let cancelled = false;

        (async () => {
            if (propInitialContent !== undefined) {
                setInitialContent(propInitialContent);
                lastSeenUpdatedAtRef.current = note?.updatedAt ? new Date(note.updatedAt).getTime() : null;
                return;
            }

            const content = await fetchNoteContent(noteId);
            if (cancelled) return;
            if (content === null) {
                setInitialContent("");
                return;
            }
            const html = content || "";
            const hydrated = await hydrateImageSrcs(html);
            if (cancelled) return;
            setInitialContent(hydrated);
            lastSeenUpdatedAtRef.current = note?.updatedAt ? new Date(note.updatedAt).getTime() : null;
        })();

        return () => {
            cancelled = true;
        };
    }, [noteId, fetchNoteContent, hydrateImageSrcs, propInitialContent]);

    // Remote updates
    useEffect(() => {
        if (!noteId || !note?.updatedAt) return;
        if (initialContent === null) return;

        const updatedAtMs = new Date(note.updatedAt).getTime();
        if (lastSeenUpdatedAtRef.current === updatedAtMs) return;

        if (note.isDirty) {
            lastSeenUpdatedAtRef.current = updatedAtMs;
            return;
        }

        let cancelled = false;
        let resetTimer: ReturnType<typeof setTimeout> | null = null;

        (async () => {
            const latest = await fetchNoteContent(noteId);
            if (cancelled || latest === null) return;

            const normalizedLatest = normalizeStoredContent(latest);
            const currentHtml = editorRef.current ? await editorRef.current.getContent() : (initialContent ?? '');
            if (cancelled) return;

            const normalizedCurrent = normalizeStoredContent(currentHtml || '');
            if (normalizedLatest === normalizedCurrent) {
                lastSeenUpdatedAtRef.current = updatedAtMs;
                return;
            }

            const hydrated = await hydrateImageSrcs(latest);
            if (cancelled) return;

            setInitialContent(hydrated);

            if (editorRef.current) {
                pendingRemoteContentRef.current = normalizeStoredContent(latest);
                isApplyingRemoteRef.current = true;
                editorRef.current.setContent(hydrated);
            }

            await resolveImagesForContent(latest);
            if (cancelled) return;

            resetTimer = setTimeout(() => {
                if (isApplyingRemoteRef.current) {
                    isApplyingRemoteRef.current = false;
                    pendingRemoteContentRef.current = null;
                }
            }, 3000);

            lastSeenUpdatedAtRef.current = updatedAtMs;
        })();

        return () => {
            cancelled = true;
            if (resetTimer) clearTimeout(resetTimer);
        };
    }, [noteId, note?.updatedAt, note?.isDirty, initialContent, fetchNoteContent, hydrateImageSrcs, resolveImagesForContent, editorRef]);

    // Content change handler
    const handleContentChange = useCallback(async (html: string) => {
        if (!noteId) return;
        
        const isEmptyContent = (html: string) => {
            const normalized = html
                .replace(/&nbsp;/gi, '')
                .replace(/\s/g, '')
                .toLowerCase();
            return normalized === '' || normalized === '<p></p>' || normalized === '<p><br></p>';
        };

        if (isApplyingRemoteRef.current) {
            const normalized = normalizeStoredContent(html || '');
            if (pendingRemoteContentRef.current) {
                const matches =
                    normalized === pendingRemoteContentRef.current ||
                    (isEmptyContent(normalized) && isEmptyContent(pendingRemoteContentRef.current));
                if (matches) {
                    isApplyingRemoteRef.current = false;
                    pendingRemoteContentRef.current = null;
                }
            }
            return;
        }
        const title = generateTitle(html);

        if (onNoteSync) {
            onNoteSync(noteId, html, title);
            return;
        }

        const { error } = await updateNoteContent(noteId, html);
        if (!error) {
            updateNoteMetadata(noteId, { title });
        }
    }, [noteId, updateNoteContent, updateNoteMetadata, onNoteSync]);

    // Reset refs on note change
    useEffect(() => {
        lastSeenUpdatedAtRef.current = null;
        pendingRemoteContentRef.current = null;
        isApplyingRemoteRef.current = false;
        hasScrolledRef.current = false;
    }, [noteId]);

    // Deep linking
    useEffect(() => {
        if (!blockId || !editorRef.current || !initialContent) return;
        if (hasScrolledRef.current) return;

        const timer = setTimeout(() => {
            editorRef.current?.scrollToElement(blockId);
            hasScrolledRef.current = true;
        }, 150);

        return () => clearTimeout(timer);
    }, [blockId, initialContent, editorRef]);

    return {
        initialContent,
        setInitialContent,
        handleContentChange,
    };
}
