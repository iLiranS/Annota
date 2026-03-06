import { DesktopToolbar } from "@/components/editor/DesktopToolbar";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppTheme } from "@/hooks/use-app-theme";
import { cn } from "@/lib/utils";
import { generateTitle, useNotesStore } from "@annota/core";
import TipTapEditor, { TipTapEditorRef } from "@annota/tiptap-editor";
import { FileText, Loader2, Maximize2, Minimize2, Search, SidebarClose } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { NoteActionsMenu } from "./components/note-actions-menu";
import { NoteSearch } from "./components/note-search";

export default function NoteEditor() {
    const { noteId } = useParams<{ folderId: string; noteId: string }>();
    const notes = useNotesStore((s) => s.notes);
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
        if (isNoteSidebarOpen) {
            setNoteSidebarOpen(false);
            toggleMainSidebar(false);
        } else {
            setNoteSidebarOpen(true);
            toggleMainSidebar(true);
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
            <div className="absolute top-4 right-6 z-40 flex items-center gap-2 group/actions">
                <TooltipProvider delayDuration={0}>
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-background/50 backdrop-blur-md border border-border/50 shadow-sm  transition-opacity duration-300">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg hover:bg-accent/50"
                                    onClick={handleOpenSearch}
                                >
                                    <Search className="h-4 w-4 " />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px] font-medium">Search in note</TooltipContent>
                        </Tooltip>

                        <div className="w-px h-4 bg-border/50 mx-0.5" />

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg hover:bg-accent/50"
                                    onClick={() => toggleNoteSidebar()}
                                >
                                    <SidebarClose className={cn("h-4 w-4 transition-colors", isNoteSidebarOpen ? "text-primary" : "text-muted-foreground")} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px] font-medium">Toggle Notes Sidebar</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg hover:bg-accent/50"
                                    onClick={toggleFullScreen}
                                >
                                    {isNoteSidebarOpen ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px] font-medium">
                                {isNoteSidebarOpen ? "Focus Mode" : "Exit Focus Mode"}
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div>
                                    <NoteActionsMenu
                                        note={note}
                                        onRevert={(content) => {
                                            setInitialContent(content);
                                            editorRef.current?.setContent(content);
                                        }}
                                    />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px] font-medium">More Actions</TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            </div>

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
