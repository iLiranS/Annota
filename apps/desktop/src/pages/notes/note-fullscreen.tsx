import { BlockMenu } from "@/components/editor/BlockMenu";
import { DesktopNoteLinkCommandMenu } from "@/components/editor/DesktopNoteLinkCommandMenu";
import { DesktopSlashCommandMenu } from "@/components/editor/DesktopSlashCommandMenu";
import { DesktopTagCommandMenu } from "@/components/editor/DesktopTagCommandMenu";
import { DesktopToolbar } from "@/components/editor/DesktopToolbar";
import { ImageGallery } from "@/components/notes/image-gallery";
import { useAppTheme } from "@/hooks/use-app-theme";
import { copyImageToClipboard, writeText } from "@/lib/clipboard";
import { generateTitle, useNotesStore } from "@annota/core";
import TipTapEditor, { TipTapEditorRef } from "@annota/editor-ui";
import { emit, once } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { NoteSearch } from "./components/note-search";
import { NoteTags } from "./components/note-tags";
import { LinkContextMenu } from "@/components/editor/LinkContextMenu";
import { NotePreviewModal } from "@/components/notes/note-preview-modal";
import { useOpenNoteInNewWindow } from "@/hooks/use-open-note-in-new-window";
import { NoteMetadata } from "@annota/core";

/**
 * Standalone fullscreen note editor for child windows.
 *
 * This component is intentionally "stupid" — it receives all the data it needs
 * (content, tags, notes) from the main window via a Tauri event and never
 * queries the DB or services directly. Content changes are emitted back to the
 * main window which persists them.
 */
export default function NoteFullscreen() {
    const { noteId } = useParams<{ noteId: string }>();
    const { isDark, colors } = useAppTheme();

    const editorRef = useRef<TipTapEditorRef>(null);
    const [initialContent, setInitialContent] = useState<string | null>(null);

    const note = useNotesStore((s) => s.notes.find(n => n.id === noteId));
    const hasTags = (() => {
        try { return JSON.parse(note?.tags || '[]').length > 0; }
        catch { return false; }
    })();

    // Search state
    const [isSearching, setIsSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResultCount, setSearchResultCount] = useState(0);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);

    // Slash commands state
    const [slashCommandState, setSlashCommandState] = useState<{ active: boolean; query?: string; range?: { from: number; to: number }; clientRect?: any }>({ active: false });
    const [tagCommandState, setTagCommandState] = useState<{ active: boolean; query?: string; range?: { from: number; to: number }; clientRect?: any }>({ active: false });
    const [noteLinkCommandState, setNoteLinkCommandState] = useState<{ active: boolean; query?: string; range?: { from: number; to: number }; clientRect?: any }>({ active: false });

    // Block menu state
    const [activeBlockMenu, setActiveBlockMenu] = useState<{
        type: "image" | "file" | "details" | "codeBlock" | "table";
        data: any;
        anchorRect: DOMRect;
        onResolve: () => any;
    } | null>(null);
    
    // Link Context Menu state
    const [linkMenuState, setLinkMenuState] = useState<{
        open: boolean;
        url: string;
        anchorRect: DOMRect;
    } | null>(null);

    const [previewNote, setPreviewNote] = useState<NoteMetadata | null>(null);

    const handleOpenLinkMenu = useCallback((e: MouseEvent, url: string) => {
        setLinkMenuState({
            open: true,
            url,
            anchorRect: (e.target as HTMLElement).getBoundingClientRect(),
        });
    }, []);

    const handlePreviewNote = useCallback((noteId: string) => {
        const targetNote = useNotesStore.getState().notes.find(n => n.id === noteId);
        if (targetNote) {
            setPreviewNote(targetNote);
        }
    }, []);

    const handleOpenInNewWindow = useOpenNoteInNewWindow();

    // ── Sync window theme ──
    useEffect(() => {
        const syncTheme = async () => {
            try {
                const win = getCurrentWindow();
                await (win as any).setTheme(isDark ? 'dark' : 'light');
            } catch (e) {
                console.error("Failed to set window theme:", e);
            }
        };
        syncTheme();
    }, [isDark]);

    // ── Receive init data from the main window ──
    // The child signals it's ready, and the main window responds with the data.
    // This avoids race conditions where the React component isn't mounted yet.
    useEffect(() => {
        if (!noteId) return;

        // 1. Set up the listener FIRST
        const unlistenPromise = once<{ content: string; tags: any[]; notes: any[] }>(
            'note-window-init',
            (event) => {
                const { content, tags, notes } = event.payload;

                // Seed the Zustand store so DesktopTagCommandMenu & DesktopNoteLinkCommandMenu
                // can read tags/notes for autocomplete without any DB access.
                useNotesStore.setState({ tags, notes, isInitialized: true });

                setInitialContent(content);
            }
        );

        // 2. THEN tell the main window we're ready
        unlistenPromise.then(() => {
            emit('note-window-ready', { noteId });
        });
    }, [noteId]);

    // ── Content change handler: emit to main window ──
    const handleContentChange = useCallback(async (html: string) => {
        if (!noteId) return;
        const title = generateTitle(html);
        emit("note-edited-in-child", { noteId, content: html, title });
    }, [noteId]);

    // ── Sync tag mutations back to the main window ──
    // Watch note's tags and global tags list reactively. When they change (after
    // the initial store seeding), emit the update to keep the main window in sync.
    const noteTags = useNotesStore((s) => s.notes.find(n => n.id === noteId)?.tags);
    const allTags = useNotesStore((s) => s.tags);
    const hasSeeded = useRef(false);

    useEffect(() => {
        if (!noteId || initialContent === null) return;

        // Skip the first emission — that's the initial seed from the main window
        if (!hasSeeded.current) {
            hasSeeded.current = true;
            return;
        }

        emit("note-tags-changed-in-child", {
            noteId,
            noteTags: noteTags ?? '[]',
            tags: allTags,
        });
    }, [noteId, noteTags, allTags, initialContent]);

    // ── Redirect navigation to the main window ──
    const handleTagClick = useCallback((tagId: string) => {
        emit("request-main-window-navigation", { path: `/notes?tagId=${tagId}` });
    }, []);

    // ── Search handlers ──
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

    // ── Keyboard shortcuts ──
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
                e.preventDefault();
                setIsSearching(true);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // ── Block menu handlers ──
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
                    copyImageToClipboard(data.src || "", data.imageId);
                } else {
                    editorRef.current.onCommand("copyToClipboard", { pos: data.pos });
                }
                break;
            case "cut":
                if (type === "image") {
                    copyImageToClipboard(data.src || "", data.imageId);
                    editorRef.current.onCommand("deleteImage", { pos: data.position });
                } else if (type === "codeBlock" || type === "details") {
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
                {
                    const id = data.id || (data.attrs && data.attrs.id);
                    if (id) {
                        const link = `annota://note/${noteId}?blockId=${id}`;
                        await writeText(link);
                    }
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
    }, [activeBlockMenu, noteId]);

    if (!noteId) return null;

    return (
        <div className="h-screen w-screen bg-note-bg flex flex-col overflow-hidden">
            {/* Drag region for the transparent title bar */}
            <div data-tauri-drag-region className="h-11 shrink-0" />

            {/* Editor area */}
            <div className="flex-1 min-h-0 relative">
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
                        autofocus={false}
                        editable={true}
                        noteId={noteId}
                        isStandalone={true}
                        contentPaddingTop={hasTags ? 10 : 30}
                        placeholder="Start typing..."
                        renderHeader={() => (
                            <NoteTags noteId={noteId} onTagClick={handleTagClick} />
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
                        onOpenLinkMenu={handleOpenLinkMenu}
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
                        noteId={noteId}
                        query={noteLinkCommandState.query || ''}
                        range={noteLinkCommandState.range}
                        clientRect={noteLinkCommandState.clientRect}
                        sendCommand={(cmd, params) => editorRef.current?.onCommand(cmd, params)}
                        onClose={() => setNoteLinkCommandState({ active: false })}
                    />
                )}

                {linkMenuState && (
                    <LinkContextMenu
                        open={linkMenuState.open}
                        onOpenChange={(open) => setLinkMenuState(prev => prev ? { ...prev, open } : null)}
                        anchorRect={linkMenuState.anchorRect}
                        url={linkMenuState.url}
                        onPreview={handlePreviewNote}
                        onOpenInNewWindow={handleOpenInNewWindow}
                    />
                )}

                {previewNote && (
                    <NotePreviewModal
                        open={!!previewNote}
                        onOpenChange={(open) => !open && setPreviewNote(null)}
                        note={previewNote}
                    />
                )}
            </div>
        </div>
    );
}
