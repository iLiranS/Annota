import { BlockMenu } from "@/components/editor/BlockMenu";
import { DesktopNoteLinkCommandMenu } from "@/components/editor/DesktopNoteLinkCommandMenu";
import { DesktopSlashCommandMenu } from "@/components/editor/DesktopSlashCommandMenu";
import { DesktopTagCommandMenu } from "@/components/editor/DesktopTagCommandMenu";
import { DesktopToolbar } from "@/components/editor/DesktopToolbar";
import { LinkContextMenu } from "@/components/editor/LinkContextMenu";
import { ImageGallery } from "@/components/notes/image-gallery";
import { NotePreviewModal } from "@/components/notes/note-preview-modal";
import { useSidebar } from "@/components/ui/sidebar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useOpenNoteInNewWindow } from "@/hooks/use-open-note-in-new-window";
import { cn, isRtl } from "@/lib/utils";
import { NoteMetadata, TRASH_FOLDER_ID, useNavigationStore, useNotesStore, useSettingsStore } from "@annota/core";
import TipTapEditor, { TipTapEditorRef } from "@annota/editor-ui";
import { FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";
import { AISelectionPopover } from "./components/ai-selection-popover";
import { NoteFloatingActions } from "./components/note-floating-actions";
import { NoteRestoreButton } from "./components/note-restore-button";
import { NoteSearch } from "./components/note-search";
import { NoteTags } from "./components/note-tags";
import { useBlockMenuHandler } from "./hooks/use-block-menu-handler";
import { useNoteEditorAI } from "./hooks/use-note-editor-ai";
import { useNoteEditorCommands } from "./hooks/use-note-editor-commands";
import { useNoteEditorContent } from "./hooks/use-note-editor-content";
import { useNoteEditorSearch } from "./hooks/use-note-editor-search";

export interface NoteEditorProps {
    noteId?: string;
    folderId?: string;
    onNoteSync?: (noteId: string, content: string, title: string) => void;
    onTagClick?: (tagId: string) => void;
    isStandalone?: boolean;
    initialContent?: string;
}

export default function NoteEditor({ noteId: propNoteId, folderId: propFolderId, onNoteSync, onTagClick, isStandalone, initialContent: propInitialContent }: NoteEditorProps) {
    const navigate = useNavigate();
    const params = useParams<{ noteId: string }>();
    const location = useLocation()
    const queryParams = new URLSearchParams(location.search);
    const blockId = queryParams.get('blockId');

    const noteId = propNoteId || params.noteId;

    const notes = useNotesStore((s) => s.notes);
    const folders = useNotesStore((s) => s.folders);
    const setLastViewed = useNavigationStore((s) => s.setLastViewed);
    const direction = useSettingsStore((s) => s.editor.direction);
    const note = notes.find((n) => n.id === noteId);
    const routeFolderId = propFolderId || (note?.isDeleted ? TRASH_FOLDER_ID : (note?.folderId || 'root'));
    const resolvedDirection = direction === 'auto'
        ? (note?.title && isRtl(note.title) ? 'rtl' : 'ltr')
        : direction;
    const { isDark, colors } = useAppTheme();

    const editorRef = useRef<TipTapEditorRef>(null);
    const { open: isNoteSidebarOpen, setOpen: setNoteSidebarOpen } = useSidebar();

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

    // Hooks
    const { initialContent, setInitialContent, handleContentChange } = useNoteEditorContent({
        noteId,
        editorRef,
        onNoteSync,
        blockId,
        initialContent: propInitialContent
    });

    const {
        isSearching,
        setIsSearching,
        searchTerm,
        searchResultCount,
        currentSearchIndex,
        handleCloseSearch,
        handleSearchTermChange,
        handleSearchResults,
        handleSearchNext,
        handleSearchPrev,
    } = useNoteEditorSearch({ editorRef, toggleFullScreen });

    const {
        activeBlockMenu,
        setActiveBlockMenu,
        handleOpenBlockMenu,
        handleCodeBlockSelected,
        handleOpenFileMenu,
        handleOpenTableMenu,
        handleBlockAction,
    } = useBlockMenuHandler({ editorRef, noteId });

    const {
        aiSelection,
        isAiStreaming,
        handleAIAction,
        handleSelectionChange,
        handleScroll,
        stopAiChat,
        hideAISelection,
    } = useNoteEditorAI({ editorRef });

    const {
        slashCommandState,
        setSlashCommandState,
        tagCommandState,
        setTagCommandState,
        noteLinkCommandState,
        setNoteLinkCommandState,
    } = useNoteEditorCommands();

    // Link & Preview state
    const [linkMenuState, setLinkMenuState] = useState<{
        open: boolean;
        url: string;
        anchorRect: DOMRect;
    } | null>(null);

    const [previewNote, setPreviewNote] = useState<NoteMetadata | null>(null);

    const handleOpenLinkMenu = useCallback((e: MouseEvent, url: string) => {
        const linkEl = e.composedPath().find((el: any) => el?.tagName === 'A') as HTMLAnchorElement | undefined;
        const anchorEl = linkEl ?? (e.target as HTMLElement);
        setLinkMenuState({
            open: true,
            url,
            anchorRect: anchorEl.getBoundingClientRect(),
        });
    }, []);

    const handlePreviewNote = useCallback((noteId: string) => {
        const targetNote = notes.find(n => n.id === noteId);
        if (targetNote) {
            setPreviewNote(targetNote);
        }
    }, [notes]);

    const handleOpenInNewWindow = useOpenNoteInNewWindow();

    const handleCopyBlockLink = useCallback(async (blockId: string) => {
        if (!noteId) return;
        const link = `annota://note/${noteId}?blockId=${blockId}`;
        try {
            await writeText(link);
            toast.success("Link copied to clipboard", {
                description: "You can now paste it anywhere to link to this heading.",
            });
        } catch (err) {
            console.error("Failed to copy heading link:", err);
            toast.error("Failed to copy link to clipboard");
        }
    }, [noteId]);

    const isEmptyContent = (html: string) => {
        const normalized = html
            .replace(/&nbsp;/gi, '')
            .replace(/\s/g, '')
            .toLowerCase();
        return normalized === '' || normalized === '<p></p>' || normalized === '<p><br></p>';
    };

    const shouldAutofocus = initialContent !== null && isEmptyContent(initialContent);

    // AI Insert Effect
    useEffect(() => {
        const handleInsertAiContent = async (e: CustomEvent<{ content: string }>) => {
            if (!editorRef.current || note?.isDeleted) return;
            try {
                const { convertMarkdownToAnnotaHTML } = await import("@annota/editor-core");
                const html = await convertMarkdownToAnnotaHTML(e.detail.content);
                editorRef.current.onCommand('insertContent', { content: html });
            } catch (err) {
                console.error('[AI Insert] Conversion failed:', err);
            }
        };

        window.addEventListener('annota-insert-ai-content' as any, handleInsertAiContent);
        return () => window.removeEventListener('annota-insert-ai-content' as any, handleInsertAiContent);
    }, [note?.isDeleted]);

    // TOC Scroll Effect
    useEffect(() => {
        const handleScrollToElement = (e: CustomEvent<{ elementId: string }>) => {
            if (!editorRef.current) return;
            editorRef.current.scrollToElement(e.detail.elementId);
        };

        window.addEventListener('annota-scroll-to-element' as any, handleScrollToElement);
        return () => window.removeEventListener('annota-scroll-to-element' as any, handleScrollToElement);
    }, []);

    // Navigation logic
    useEffect(() => {
        if (!noteId) return;
        if (!note) {
            navigate('/notes', { replace: true });
            return;
        }

        if (routeFolderId !== TRASH_FOLDER_ID) {
            if (note.isDeleted) {
                navigate('/notes', { replace: true });
                return;
            }

            if (note.folderId) {
                const currentFolder = folders.find(f => f.id === note.folderId);
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

    const isInitialized = useNotesStore((s) => s.isInitialized);

    if (!isInitialized) {
        return (
            <div className="flex bg-note-bg h-full w-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!note) {
        return (
            <div className="flex h-full bg-note-bg flex-col items-center justify-center gap-4 p-8">
                <FileText className="h-16 w-16 text-border" />
                <h2 className="text-xl font-bold tracking-tight">Note not found</h2>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-note-bg flex-col w-full min-h-0 relative ">
            <div className="flex-1 overflow-hidden relative w-full h-full min-h-0 overscroll-none flex flex-col">
                <div className="flex-1 relative overflow-hidden flex flex-col min-h-0">
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
                            editable={!note.isDeleted}
                            noteId={noteId}
                            isStandalone={isStandalone}
                            direction={direction}
                            contentPaddingTop={0}
                            placeholder="Start typing..."
                            renderStaticHeader={() => (
                                <div
                                    dir={resolvedDirection}
                                    className={cn("py-2 px-1", resolvedDirection === 'rtl' ? "pl-20" : "pr-20")}
                                >
                                    <NoteTags noteId={noteId ?? ''} onTagClick={onTagClick} />
                                </div>
                            )}
                            renderHeader={() => (
                                <NoteFloatingActions
                                    note={note}
                                    direction={resolvedDirection}
                                    onToggleSearch={() => setIsSearching(prev => !prev)}
                                    onRevert={(content) => {
                                        setInitialContent(content);
                                        editorRef.current?.setContent(content);
                                    }}
                                    className={cn(
                                        "absolute pointer-events-auto",
                                        resolvedDirection === 'rtl' ? "left-4 top-2" : "right-4 top-2"
                                    )}
                                />
                            )}
                            renderToolbar={(props) => note.isDeleted ? (
                                <NoteRestoreButton noteId={noteId ?? ''} />
                            ) : (
                                <DesktopToolbar {...props} />
                            )}
                            renderImageGallery={(props) => <ImageGallery {...props} />}
                            onOpenBlockMenu={handleOpenBlockMenu}
                            onOpenFileMenu={handleOpenFileMenu}
                            onOpenTableMenu={handleOpenTableMenu}
                            onCodeBlockSelected={handleCodeBlockSelected}
                            onSlashCommand={setSlashCommandState}
                            onTagCommand={setTagCommandState}
                            onNoteLinkCommand={setNoteLinkCommandState}
                            onOpenLinkMenu={handleOpenLinkMenu}
                            onCopyBlockLink={handleCopyBlockLink}
                            onSelectionChange={handleSelectionChange}
                            onScroll={handleScroll}
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

                    {linkMenuState && (
                        <LinkContextMenu
                            open={linkMenuState.open}
                            onOpenChange={(open) => setLinkMenuState(prev => prev ? { ...prev, open } : null)}
                            anchorRect={linkMenuState.anchorRect}
                            url={linkMenuState.url}
                            onPreview={handlePreviewNote}
                            onOpenInNewWindow={handleOpenInNewWindow}
                            onEdit={() => editorRef.current?.onCommand('openLinkModal')}
                            onDelete={() => editorRef.current?.onCommand('unsetLink')}
                        />
                    )}

                    {previewNote && (
                        <NotePreviewModal
                            open={!!previewNote}
                            onOpenChange={(open) => !open && setPreviewNote(null)}
                            note={previewNote}
                        />
                    )}

                    <AISelectionPopover
                        isVisible={aiSelection.isVisible || isAiStreaming}
                        isLoading={isAiStreaming}
                        anchorRect={aiSelection.anchorRect}
                        cursorPosition={aiSelection.cursorPosition}
                        direction={resolvedDirection}
                        onAction={handleAIAction}
                        onClose={hideAISelection}
                        onStop={stopAiChat}
                    />
                </div>
            </div>
        </div>
    );
}


