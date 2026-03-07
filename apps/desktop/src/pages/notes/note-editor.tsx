import { DesktopToolbar } from "@/components/editor/DesktopToolbar";
import { ImageGallery } from "@/components/notes/image-gallery";
import { useSidebar } from "@/components/ui/sidebar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { generateTitle, TRASH_FOLDER_ID, useNotesStore } from "@annota/core";
import TipTapEditor, { TipTapEditorRef } from "@annota/tiptap-editor";
import { FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { NoteFloatingActions } from "./components/note-floating-actions";
import { NoteSearch } from "./components/note-search";

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
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                handleOpenSearch();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleOpenSearch]);

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

    const handleContentChange = (html: string) => {
        if (!noteId) return;
        const title = generateTitle(html);
        updateNoteContent(noteId, html);
        updateNoteMetadata(noteId, { title });
    };

    if (!note) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
                <FileText className="h-16 w-16 text-border" />
                <h2 className="text-xl font-bold tracking-tight">Note not found</h2>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col w-full min-h-0 relative">
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
                        placeholder="Start typing..."
                        renderToolbar={(props) => <DesktopToolbar {...props} />}
                        renderImageGallery={(props) => <ImageGallery {...props} />}
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
            </div>
        </div>
    );
}
