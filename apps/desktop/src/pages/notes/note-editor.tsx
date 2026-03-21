import { BlockMenu } from "@/components/editor/BlockMenu";
import { DesktopNoteLinkCommandMenu } from "@/components/editor/DesktopNoteLinkCommandMenu";
import { DesktopSlashCommandMenu } from "@/components/editor/DesktopSlashCommandMenu";
import { DesktopTagCommandMenu } from "@/components/editor/DesktopTagCommandMenu";
import { DesktopToolbar } from "@/components/editor/DesktopToolbar";
import { ImageGallery } from "@/components/notes/image-gallery";
import { useSidebar } from "@/components/ui/sidebar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { copyImageToClipboard, writeText } from "@/lib/clipboard";
import { generateTitle, TRASH_FOLDER_ID, useNotesStore, useSettingsStore } from "@annota/core";
import { NoteFileService } from "@annota/core/platform";
import TipTapEditor, { TipTapEditorRef } from "@annota/editor-ui";
import { FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { NoteFloatingActions } from "./components/note-floating-actions";
import { NoteSearch } from "./components/note-search";
import { NoteTags } from "./components/note-tags";

interface NoteEditorProps {
    noteId?: string;
    folderId?: string;
}

export default function NoteEditor({ noteId: propNoteId, folderId: propFolderId }: NoteEditorProps) {
    const navigate = useNavigate();
    const params = useParams<{ folderId: string; noteId: string }>();
    const location = useLocation()
    const queryParams = new URLSearchParams(location.search);
    const elementId = queryParams.get('elementId') || queryParams.get('blockId');

    const noteId = propNoteId || params.noteId;
    const routeFolderId = propFolderId || params.folderId;

    const notes = useNotesStore((s) => s.notes);
    const folders = useNotesStore((s) => s.folders);
    const getNoteContent = useNotesStore((s) => s.getNoteContent);
    const { updateNoteContent, updateNoteMetadata } = useNotesStore();
    const setLastViewed = useSettingsStore((s) => s.setLastViewed);
    const note = notes.find((n) => n.id === noteId);
    const { isDark, colors } = useAppTheme();

    const editorRef = useRef<TipTapEditorRef>(null);
    const hasScrolledRef = useRef(false);
    const [initialContent, setInitialContent] = useState<string | null>(null);

    const { toggleSidebar: toggleNoteSidebar, open: isNoteSidebarOpen, setOpen: setNoteSidebarOpen } = useSidebar();

    // Search state
    const [isSearching, setIsSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResultCount, setSearchResultCount] = useState(0);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);

    // Slash commands state
    const [slashCommandState, setSlashCommandState] = useState<{ active: boolean; query?: string; range?: { from: number; to: number }; clientRect?: any }>({ active: false });
    const [tagCommandState, setTagCommandState] = useState<{ active: boolean; query?: string; range?: { from: number; to: number }; clientRect?: any }>({ active: false });
    const [noteLinkCommandState, setNoteLinkCommandState] = useState<{ active: boolean; query?: string; range?: { from: number; to: number }; clientRect?: any }>({ active: false });

    const isEmptyContent = (html: string) => {
        const normalized = html
            .replace(/&nbsp;/gi, '')
            .replace(/\s/g, '')
            .toLowerCase();
        return normalized === '' || normalized === '<p></p>' || normalized === '<p><br></p>';
    };

    const shouldAutofocus = initialContent !== null && isEmptyContent(initialContent);

    // Block Menu state
    const [activeBlockMenu, setActiveBlockMenu] = useState<{
        type: "image" | "file" | "details" | "codeBlock" | "table";
        data: any;
        anchorRect: DOMRect;
        onResolve: () => any;
    } | null>(null);

    const handleOpenBlockMenu = useCallback((e: MouseEvent, resolve: () => any) => {
        const result = resolve();
        if (!result) return;

        setActiveBlockMenu({
            type: result.message.blockType || "details",
            data: result.message,
            anchorRect: (e.target as HTMLElement).getBoundingClientRect(),
            onResolve: resolve,
        });
    }, []);

    const handleCodeBlockSelected = useCallback((e: MouseEvent, resolve: () => any) => {
        const result = resolve();
        if (!result) return;

        setActiveBlockMenu({
            type: "codeBlock",
            data: result.message,
            anchorRect: (e.target as HTMLElement).getBoundingClientRect(),
            onResolve: resolve,
        });
    }, []);

    const handleOpenFileMenu = useCallback((e: MouseEvent, resolve: () => any) => {
        const result = resolve();
        if (!result) return;

        setActiveBlockMenu({
            type: result.message.type === 'openOpenFileMenu' && (result.message as any).fileId ? "file" : "image",
            data: result.message,
            anchorRect: (e.target as HTMLElement).getBoundingClientRect(),
            onResolve: resolve,
        });
    }, []);

    const handleOpenTableMenu = useCallback((e: MouseEvent, resolve: () => any) => {
        const result = resolve();
        if (!result) return;

        setActiveBlockMenu({
            type: "table",
            data: result.message,
            anchorRect: (e.target as HTMLElement).getBoundingClientRect(),
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
                }
                else {
                    console.log("copying to clipboard")
                    editorRef.current.onCommand("copyToClipboard", { pos: data.pos });
                }
                break;
            case "cut":
                if (type === "image") {
                    const src = data.src || "";
                    copyImageToClipboard(src, data.imageId);
                    editorRef.current.onCommand("deleteImage", { pos: data.position });
                } else if (type === "codeBlock") {
                    editorRef.current.onCommand("copyToClipboard", { pos: data.pos });
                    editorRef.current.onCommand("deleteSelection", { pos: data.pos });
                } else if (type === "details") {
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
                } else {
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
                        // Use imageId as filename if available
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
    }, [activeBlockMenu, noteId]);

    const toggleMainSidebar = useCallback((open?: boolean) => {
        window.dispatchEvent(new CustomEvent('annota-toggle-main-sidebar', {
            detail: { open }
        }));
    }, []);

    const toggleFullScreen = useCallback(() => {
        if (!isNoteSidebarOpen) {
            setNoteSidebarOpen(true);
            toggleMainSidebar(true);
        } else {
            setNoteSidebarOpen(false);
            toggleMainSidebar(false);
        }
    }, [isNoteSidebarOpen, setNoteSidebarOpen, toggleMainSidebar]);

    // Search handlers
    const handleOpenSearch = useCallback(() => {
        setIsSearching(true);
    }, []);

    const handleCloseSearch = useCallback(() => {
        setIsSearching(false);
        setSearchTerm('');
        setSearchResultCount(0);
        setCurrentSearchIndex(-1);
        editorRef.current?.clearSearch();
    }, []);

    const handleSearchTermChange = useCallback((term: string) => {
        setSearchTerm(term);
        if (term.length > 0) {
            editorRef.current?.search(term);
        } else {
            editorRef.current?.clearSearch();
            setSearchResultCount(0);
            setCurrentSearchIndex(-1);
        }
    }, []);

    const handleSearchResults = useCallback((count: number, currentIndex: number) => {
        setSearchResultCount(count);
        setCurrentSearchIndex(currentIndex);
    }, []);

    const handleSearchNext = useCallback(() => {
        editorRef.current?.searchNext();
    }, []);

    const handleSearchPrev = useCallback(() => {
        editorRef.current?.searchPrev();
    }, []);

    // search in note / focus mode shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
                e.preventDefault();
                handleOpenSearch();
            }
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d") {
                e.preventDefault();
                toggleFullScreen();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleOpenSearch, toggleFullScreen]);


    useEffect(() => {
        if (!noteId) return;

        // 1. Note was permanently deleted (removed from store)
        if (!note) {
            navigate('/notes', { replace: true });
            return;
        }

        // 2. Only redirect if we are NOT intentionally in the trash view
        if (routeFolderId !== TRASH_FOLDER_ID) {
            // Note itself was moved to trash
            if (note.isDeleted) {
                const targetFolderId = note.originalFolderId || "root";
                const isTargetStillValid = folders.find(f => f.id === targetFolderId && !f.isDeleted);
                const finalFolder = isTargetStillValid ? targetFolderId : "root";

                const path = finalFolder === "root" ? "/notes" : `/notes?folderId=${finalFolder}`;
                navigate(path, { replace: true });
                return;
            }

            // Parent folder was moved to trash
            if (routeFolderId && routeFolderId !== 'root') {
                const currentFolder = folders.find(f => f.id === routeFolderId);
                if (currentFolder?.isDeleted) {
                    navigate('/notes', { replace: true });
                }
            }
        }
    }, [note, noteId, routeFolderId, folders, navigate]);

    useEffect(() => {
        if (noteId) {
            setLastViewed(noteId, routeFolderId || 'root');
        }
    }, [noteId, routeFolderId, setLastViewed]);

    useEffect(() => {
        if (!noteId) return;
        setInitialContent(null);
        const extractImageIds = (html: string): string[] => {
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
        };

        const hydrateImageSrcs = async (html: string): Promise<string> => {
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
        };

        (async () => {
            try {
                const content = await getNoteContent(noteId);
                const html = content || "";
                const hydrated = await hydrateImageSrcs(html);
                setInitialContent(hydrated);
            } catch (err) {
                console.error("Failed to load note content", err);
                setInitialContent("");
            }
        })();
    }, [noteId, getNoteContent]);
    const handleContentChange = useCallback(async (html: string) => {
        if (!noteId) return;
        const title = generateTitle(html);
        const { error } = await updateNoteContent(noteId, html);
        if (!error) {
            updateNoteMetadata(noteId, { title });
        }
    }, [noteId, updateNoteContent, updateNoteMetadata]);

    useEffect(() => {
        // 1. Wait until we have the ID, the ref, and the content
        if (!elementId || !editorRef.current || !initialContent) return;

        // 2. If we already handled this deep link, do nothing!
        if (hasScrolledRef.current) return;

        const timer = setTimeout(() => {
            editorRef.current?.scrollToElement(elementId);
            hasScrolledRef.current = true; // Mark it as completed so it never fires again
        }, 150);

        return () => clearTimeout(timer);
    }, [elementId, initialContent]);

    if (!note) {
        return (
            <div className="flex h-full bg-note-bg flex-col items-center justify-center gap-4 p-8">
                <FileText className="h-16 w-16 text-border" />
                <h2 className="text-xl font-bold tracking-tight">Note not found</h2>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-note-bg flex-col w-full min-h-0 relative">
            {/* Floating Action Buttons */}
            <NoteFloatingActions
                onToggleSearch={() => setIsSearching(prev => !prev)}
                isNoteSidebarOpen={isNoteSidebarOpen}
                toggleNoteSidebar={() => toggleNoteSidebar()}
                toggleFullScreen={toggleFullScreen}
                note={note}
                onRevert={(content) => {
                    setInitialContent(content);
                    editorRef.current?.setContent(content);
                }}
            />

            <div className="flex-1 overflow-hidden relative w-full h-full min-h-0 overscroll-none">
                <NoteSearch
                    visible={isSearching}
                    searchTerm={searchTerm}
                    onSearchTermChange={handleSearchTermChange}
                    onClose={handleCloseSearch}
                    resultCount={searchResultCount}
                    currentResultIndex={currentSearchIndex}
                    onNext={handleSearchNext}
                    onPrev={handleSearchPrev}
                />

                {initialContent !== null ? (
                    <TipTapEditor
                        ref={editorRef}
                        initialContent={initialContent}
                        onContentChange={handleContentChange}
                        onSearchResults={handleSearchResults}
                        autofocus={shouldAutofocus}
                        editable={true}
                        noteId={noteId}
                        contentPaddingTop={JSON.parse(note.tags || '[]').length > 0 ? 20 : 40}
                        placeholder="Start typing..."
                        renderHeader={() => (
                            <NoteTags
                                noteId={noteId ?? ''}
                            />
                        )}
                        renderToolbar={(props) => <DesktopToolbar {...props} />}
                        renderImageGallery={(props) => <ImageGallery {...props} />}
                        onOpenBlockMenu={handleOpenBlockMenu}
                        onOpenFileMenu={handleOpenFileMenu}
                        onOpenTableMenu={handleOpenTableMenu}
                        onCodeBlockSelected={handleCodeBlockSelected}
                        onSlashCommand={setSlashCommandState}
                        onTagCommand={setTagCommandState}
                        onNoteLinkCommand={setNoteLinkCommandState}
                        isDark={isDark}
                        colors={{
                            primary: colors.primary,
                            background: colors.background,
                            text: colors.text
                        }}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                )}
                {activeBlockMenu && (
                    <BlockMenu
                        open={!!activeBlockMenu}
                        onOpenChange={(open) => !open && setActiveBlockMenu(null)}
                        anchorRect={activeBlockMenu.anchorRect}
                        type={activeBlockMenu.type}
                        data={activeBlockMenu.data}
                        onAction={handleBlockAction}
                    />
                )}

                {slashCommandState.active && slashCommandState.range && slashCommandState.clientRect && (
                    <DesktopSlashCommandMenu
                        query={slashCommandState.query || ''}
                        range={slashCommandState.range}
                        clientRect={slashCommandState.clientRect}
                        sendCommand={(cmd, params) => editorRef.current?.onCommand(cmd, params)}
                        onClose={() => setSlashCommandState({ active: false })}
                    />
                )}

                {noteId && tagCommandState.active && tagCommandState.range && tagCommandState.clientRect && (
                    <DesktopTagCommandMenu
                        noteId={noteId}
                        query={tagCommandState.query || ''}
                        range={tagCommandState.range}
                        clientRect={tagCommandState.clientRect}
                        sendCommand={(cmd, params) => editorRef.current?.onCommand(cmd, params)}
                        onClose={() => setTagCommandState({ active: false })}
                    />
                )}

                {noteLinkCommandState.active && noteLinkCommandState.range && noteLinkCommandState.clientRect && (
                    <DesktopNoteLinkCommandMenu
                        noteId={noteId ?? ''}
                        query={noteLinkCommandState.query || ''}
                        range={noteLinkCommandState.range}
                        clientRect={noteLinkCommandState.clientRect}
                        sendCommand={(cmd, params) => editorRef.current?.onCommand(cmd, params)}
                        onClose={() => setNoteLinkCommandState({ active: false })}
                    />
                )}

            </div>
        </div>
    );
}
