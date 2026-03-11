import { BlockMenu } from "@/components/editor/BlockMenu";
import { DesktopSlashCommandMenu } from "@/components/editor/DesktopSlashCommandMenu";
import { DesktopTagCommandMenu } from "@/components/editor/DesktopTagCommandMenu";
import { DesktopToolbar } from "@/components/editor/DesktopToolbar";
import { ImageGallery } from "@/components/notes/image-gallery";
import { useSidebar } from "@/components/ui/sidebar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { copyImageToClipboard, writeText } from "@/lib/clipboard";
import { generateTitle, TRASH_FOLDER_ID, useNotesStore } from "@annota/core";
import TipTapEditor, { TipTapEditorRef } from "@annota/tiptap-editor";
import { FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { NoteFloatingActions } from "./components/note-floating-actions";
import { NoteSearch } from "./components/note-search";
import { NoteTags } from "./components/note-tags";

export default function NoteEditor() {
    const navigate = useNavigate();
    const { folderId: routeFolderId, noteId } = useParams<{ folderId: string; noteId: string }>();
    const notes = useNotesStore((s) => s.notes);
    const folders = useNotesStore((s) => s.folders);
    const getNoteContent = useNotesStore((s) => s.getNoteContent);
    const { updateNoteContent, updateNoteMetadata } = useNotesStore();
    const note = notes.find((n) => n.id === noteId);
    const { isDark, colors } = useAppTheme();

    const editorRef = useRef<TipTapEditorRef>(null);
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

    // Block Menu state
    const [activeBlockMenu, setActiveBlockMenu] = useState<{
        type: "image" | "details" | "codeBlock" | "table";
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

    const handleOpenImageMenu = useCallback((e: MouseEvent, resolve: () => any) => {
        const result = resolve();
        if (!result) return;

        setActiveBlockMenu({
            type: "image",
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
                } else if (type === "codeBlock") {
                    editorRef.current.onCommand("copyToClipboard", { pos: data.pos });
                    toast.success("Code copied to clipboard", { duration: 1000 });
                } else if (type === "details") {
                    editorRef.current.onCommand("copyDetailsContent", { pos: data.pos });
                    toast.success("Details content copied to clipboard", { duration: 1000 });
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
                toast.success("Block deleted", { duration: 1000 });
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
                    toast.success("Block link copied to clipboard", { duration: 1000 });
                } else {
                    toast.error("Block link not available", { duration: 1000 });
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
                        toast.success("Saved to downloads", { duration: 1000 });
                    } catch (err) {
                        console.error("Download failed:", err);
                        toast.error("Failed to download image", { duration: 1000 });
                    }
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
        if (!noteId) return;
        setInitialContent(null);
        getNoteContent(noteId)
            .then((content) => setInitialContent(content || ""))
            .catch((err) => {
                console.error("Failed to load note content", err);
                setInitialContent("");
            });
    }, [noteId, getNoteContent]);
    const handleContentChange = useCallback((html: string) => {
        if (!noteId) return;

        const title = generateTitle(html);
        updateNoteContent(noteId, html);
        updateNoteMetadata(noteId, { title });

    }, [noteId, updateNoteContent, updateNoteMetadata]);

    if (!note) {
        return (
            <div className="flex h-full bg-background dark:bg-card/50 flex-col items-center justify-center gap-4 p-8">
                <FileText className="h-16 w-16 text-border" />
                <h2 className="text-xl font-bold tracking-tight">Note not found</h2>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-background dark:bg-card/50 flex-col w-full min-h-0 relative">
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
                        editable={true}
                        noteId={noteId}
                        contentPaddingTop={60}
                        placeholder="Start typing..."
                        renderHeader={() => (
                            <NoteTags
                                noteId={noteId ?? ''}
                                className="absolute top-4 left-0 right-0 z-10 flex flex-wrap gap-1.5 max-w-full"
                            />
                        )}
                        renderToolbar={(props) => <DesktopToolbar {...props} />}
                        renderImageGallery={(props) => <ImageGallery {...props} />}
                        onOpenBlockMenu={handleOpenBlockMenu}
                        onOpenImageMenu={handleOpenImageMenu}
                        onOpenTableMenu={handleOpenTableMenu}
                        onCodeBlockSelected={handleCodeBlockSelected}
                        onSlashCommand={setSlashCommandState}
                        onTagCommand={setTagCommandState}
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

            </div>
        </div>
    );
}
