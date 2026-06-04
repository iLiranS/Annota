import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { useCreateNote } from "@/hooks/use-create-note";
import { useSmartNavigate } from "@/hooks/use-smart-navigate";
import { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID, useChangelog, useNavigationStore, useNotesStore, useSearchStore, useSettingsStore, useSyncStore, useUserStore, type Folder } from "@annota/core";


// Modular Components
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../custom-ui/confirm-dialog";
import { FolderEditModal } from "../notes/folder-edit-modal";
import { NotesViewContent, NotesViewHeader } from "./sidebar/notes-view";
import { QuickAccessSection } from "./sidebar/quick-access";
import { SearchView } from "./sidebar/search-view";
import { SidebarFooterSection } from "./sidebar/sidebar-footer";
import { TagsList } from "./sidebar/tags-list";






export function AppSidebar() {
    const navigateSmart = useSmartNavigate();
    const { noteId: routeNoteId } = useParams();
    const { general } = useSettingsStore();
    const activeTab = useNavigationStore((s) => s.sidebarTab);
    const setActiveTab = useNavigationStore((s) => s.setSidebarTab);
    const selectedFolderId = useNavigationStore((s) => s.selectedFolderId);
    const setSelectedFolderId = useNavigationStore((s) => s.setSelectedFolderId);
    const selectedTagId = useNavigationStore((s) => s.selectedTagId);
    const setSelectedTagId = useNavigationStore((s) => s.setSelectedTagId);

    const {
        notes,
        tags,
        deleteFolder,
        deleteNote,
    } = useNotesStore();

    const isOnline = useSyncStore((s) => s.isOnline);
    const authRequired = useSyncStore((s) => s.authRequired);
    const isGuest = useUserStore((s) => s.isGuest);
    const signOut = useUserStore((s) => s.signOut);
    const showOfflineBanner = !isOnline && !isGuest;
    const { createAndNavigate: createNote } = useCreateNote();
    const { updateAvailable, latestVersion, currentVersion, dismissUpdate } = useChangelog('desktop');

    const currentFolderId = selectedFolderId || undefined;
    const tagId = selectedTagId;

    useEffect(() => {
        if (!selectedFolderId && !selectedTagId && routeNoteId) {
            const note = useNotesStore.getState().notes.find(n => n.id === routeNoteId);
            if (note && note.folderId) {
                setSelectedFolderId(note.folderId);
            }
        }
    }, [routeNoteId, selectedFolderId, selectedTagId, setSelectedFolderId]);

    const [retryCooldown, setRetryCooldown] = useState(false);


    useEffect(() => {
        const saved = localStorage.getItem("sidebar_active_tab");
        if (saved) {
            setActiveTab((saved === 'notes' || saved === 'tags' || saved === 'search') ? saved : 'notes');
        }

    }, [setActiveTab]);


    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
    const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

    const isTrash = currentFolderId === TRASH_FOLDER_ID;
    const isDaily = currentFolderId === DAILY_NOTES_FOLDER_ID;

    useEffect(() => {
        setSelectionMode(false);
        setSelectedNoteIds([]);
    }, [currentFolderId, tagId, isTrash, isDaily]);

    const handleSetSelectionMode = useCallback((mode: boolean) => {
        setSelectionMode(mode);
        if (!mode) setSelectedNoteIds([]);
        if (mode) setActiveTab('notes');
    }, []);

    const handleToggleSelection = useCallback((noteId: string) => {
        setSelectedNoteIds(prev =>
            prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]
        );
    }, []);

    const handleRetry = useCallback(() => {
        if (retryCooldown) return;
        setRetryCooldown(true);
        setTimeout(() => setRetryCooldown(false), 10_000);
    }, [retryCooldown]);

    const { open, setOpen, toggleSidebar } = useSidebar();

    const { isOpen: isSearchOpen, setIsOpen: setIsSearchOpen } = useSearchStore();

    useEffect(() => {
        if (isSearchOpen) {
            setActiveTab('search');
            setOpen(true);
            setIsSearchOpen(false);
        }
    }, [isSearchOpen, setOpen, setIsSearchOpen]);

    useEffect(() => {
        const handleOpenSidebar = () => {
            setOpen(true);
        };
        const handleToggleSidebar = () => {
            toggleSidebar();
        };
        window.addEventListener("open-sidebar", handleOpenSidebar);
        window.addEventListener("toggle-sidebar", handleToggleSidebar);
        return () => {
            window.removeEventListener("open-sidebar", handleOpenSidebar);
            window.removeEventListener("toggle-sidebar", handleToggleSidebar);
        };
    }, [setOpen, toggleSidebar]);

    useEffect(() => {
        localStorage.setItem("sidebar_active_tab", activeTab);
    }, [activeTab]);

    const handleEditFolder = useCallback((folder: Folder) => {
        setEditingFolder(folder);
        setNewFolderParentId(null);
        setIsEditModalOpen(true);
    }, []);

    const handleCreateSubFolder = useCallback((parentFolder: Folder) => {
        setEditingFolder(null);
        setNewFolderParentId(parentFolder.id);
        setIsEditModalOpen(true);
    }, []);

    const handleDeleteFolder = useCallback(async () => {
        if (!folderToDelete) return;
        await deleteFolder(folderToDelete.id);
        setFolderToDelete(null);
    }, [deleteFolder, folderToDelete]);

    const navigateWithHistory = useCallback((to: string) => {
        navigateSmart(to);
    }, [navigateSmart]);

    const handleFolderSelect = useCallback((folderId: string | null) => {
        const id = folderId || 'root';
        setSelectedFolderId(id);
        setActiveTab('notes');
        if (id === DAILY_NOTES_FOLDER_ID || id === TRASH_FOLDER_ID || id === 'root') {
            navigateWithHistory('/notes');
        }
    }, [setSelectedFolderId, setActiveTab, navigateWithHistory]);

    const quickAccessNotes = useMemo(() => {
        return notes.filter((n) => n.isQuickAccess && !n.isDeleted);
    }, [notes]);

    const handleNoteClick = useCallback((note: any) => {
        navigateWithHistory(`/notes/${note.id}`);
    }, [navigateWithHistory]);

    const handleFolderCreated = useCallback((id: string) => {
        handleFolderSelect(id);
    }, [handleFolderSelect]);

    const [width, setWidth] = useState(() => {
        const saved = localStorage.getItem("sidebar_width");
        return saved ? parseInt(saved, 10) : 230;
    });
    const [isResizing, setIsResizing] = useState(false);

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const isRtl = general.appDirection === "rtl";
            const newWidth = isRtl ? window.innerWidth - e.clientX : e.clientX - 10;
            if (newWidth >= 180 && newWidth <= 450) {
                setWidth(newWidth);
                window.dispatchEvent(new CustomEvent('sidebar-resize', { detail: { width: newWidth, side: 'left' } }));
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            localStorage.setItem("sidebar_width", width.toString());
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isResizing, width, general.appDirection]);


    return (
        <div
            className={cn(
                "relative flex overflow-visible shrink-0 flex-col  transition-all duration-300 ease-in-out  ",
                "rounded-2xl border border-sidebar-border/60 bg-note-bg",
                !open && "w-0! opacity-0 pointer-events-none border-none",
                isResizing && "transition-none",
                open && 'ms-2 mb-2'
            )}
            style={{
                width: open ? `${width}px` : 0,
                ["--sidebar-width" as any]: `${width}px`
            }}
        >
            <Sidebar

                collapsible="none"
                className="border-none select-none bg-transparent w-full overflow-hidden"
                side={general.appDirection === 'rtl' ? 'right' : 'left'}
            >
                <div
                    onMouseDown={startResizing}
                    className={cn(
                        "absolute top-0 bottom-0 w-1 cursor-col-resize z-50 hover:bg-border transition-colors",
                        general.appDirection === "rtl" ? "left-0 " : "right-0"
                    )}
                />

                {activeTab === 'notes' && (
                    <NotesViewHeader
                        currentFolderId={currentFolderId}
                        tagId={tagId}
                        selectionMode={selectionMode}
                        setSelectionMode={handleSetSelectionMode}
                        onEditFolder={handleEditFolder}
                        onCreateFolder={(parentId) => {
                            setEditingFolder(null);
                            setNewFolderParentId(parentId);
                            setIsEditModalOpen(true);
                        }}
                    />
                )}

                <SidebarContent data-tauri-drag-region className={cn("min-w-0  flex flex-col overflow-hidden gap-0")}>
                    {activeTab === 'notes' && (
                        <NotesViewContent
                            currentFolderId={currentFolderId}
                            tagId={tagId}
                            routeNoteId={routeNoteId}
                            selectionMode={selectionMode}
                            selectedNoteIds={selectedNoteIds}
                            onToggleSelection={handleToggleSelection}
                            onClearSelection={() => handleSetSelectionMode(false)}
                            setSelectionMode={handleSetSelectionMode}
                            onNavigate={navigateWithHistory}
                            onEditFolder={handleEditFolder}
                            onDeleteFolder={setFolderToDelete}
                            onCreateSubFolder={handleCreateSubFolder}
                        />
                    )}

                    {activeTab === 'tags' && (
                        <TagsList
                            tags={tags}
                            isTagsOpen={true}
                            setIsTagsOpen={() => { }}
                            activeTagId={tagId}
                            onTagClick={(id) => {
                                setSelectedTagId(id);
                                setActiveTab('notes');
                            }}
                            general={general}
                        />
                    )}

                    {activeTab === 'search' && (
                        <SearchView
                            onNoteClick={(note) => {
                                navigateWithHistory(`/notes/${note.id}`);
                            }}
                            onFolderClick={(folder) => handleFolderSelect(folder.id)}
                            onDeleteNote={deleteNote}
                            onEditFolder={handleEditFolder}
                            onDeleteFolder={setFolderToDelete}
                            onCreateSubFolder={handleCreateSubFolder}
                            onCreateNote={(id) => {
                                setSelectedFolderId(id || 'root');
                                createNote(id);
                                setActiveTab('notes');
                            }}
                        />
                    )}

                    {activeTab !== 'search' && (
                        <QuickAccessSection
                            notes={quickAccessNotes}
                            onNoteClick={handleNoteClick}
                            onDeleteNote={deleteNote}
                            general={general}
                        />
                    )}
                </SidebarContent>

                <div>
                    <SidebarFooterSection
                        showOfflineBanner={showOfflineBanner}
                        retryCooldown={retryCooldown}
                        onRetry={handleRetry}
                        updateAvailable={updateAvailable}
                        latestVersion={latestVersion}
                        currentVersion={currentVersion}
                        dismissUpdate={dismissUpdate}
                        authRequired={authRequired}
                        onReauthenticate={signOut}
                        isGuest={isGuest}
                    />
                </div>


                <FolderEditModal
                    open={isEditModalOpen}
                    onOpenChange={setIsEditModalOpen}
                    folder={editingFolder}
                    defaultParentId={newFolderParentId}
                    onSuccess={handleFolderCreated}
                />
                <ConfirmDialog
                    open={!!folderToDelete}
                    onOpenChange={(v) => !v && setFolderToDelete(null)}
                    title="Delete Folder?"
                    description={`Permanently delete "${folderToDelete?.name}"?`}
                    onConfirm={handleDeleteFolder}
                    variant="destructive"
                />
            </Sidebar>
        </div>
    );
}
