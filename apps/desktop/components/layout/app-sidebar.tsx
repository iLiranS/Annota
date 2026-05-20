import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCreateNote } from "@/hooks/use-create-note";
import { useSmartNavigate } from "@/hooks/use-smart-navigate";
import { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID, useChangelog, useNavigationStore, useNotesStore, useSearchStore, useSettingsStore, useSyncStore, useUserStore, type Folder, type SidebarTab } from "@annota/core";


// Modular Components
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../custom-ui/confirm-dialog";
import { FolderEditModal } from "../notes/folder-edit-modal";
import { FoldersTree } from "./sidebar/folders-tree";
import { NotesViewContent, NotesViewHeader } from "./sidebar/notes-view";
import { SearchView } from "./sidebar/search-view";
import { SidebarFooterSection } from "./sidebar/sidebar-footer";
import { TagsList } from "./sidebar/tags-list";

// type SidebarTab = 'folders' | 'notes' | 'tags' | 'search';




export function AppSidebar() {
    const navigateSmart = useSmartNavigate();
    const location = useLocation();
    const { folderId: routeFolderId, noteId: routeNoteId } = useParams();
    const { colors } = useAppTheme();
    const { general } = useSettingsStore();
    const clearQuickAccessView = useNavigationStore((s) => s.clearQuickAccessView);
    const activeTab = useNavigationStore((s) => s.sidebarTab);
    const setActiveTab = useNavigationStore((s) => s.setSidebarTab);

    const {
        tags,
        deleteFolder,
        deleteNote,
        getFoldersInFolder,
    } = useNotesStore();

    const isOnline = useSyncStore((s) => s.isOnline);
    const authRequired = useSyncStore((s) => s.authRequired);
    const isGuest = useUserStore((s) => s.isGuest);
    const signOut = useUserStore((s) => s.signOut);
    const showOfflineBanner = !isOnline && !isGuest;
    const { createAndNavigate: createNote } = useCreateNote();
    const { updateAvailable, latestVersion, currentVersion, dismissUpdate } = useChangelog('desktop');

    const [pendingFolderId, setPendingFolderId] = useState<string | undefined | null>(null);

    const { tagId, searchFolderId } = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return {
            tagId: params.get("tagId"),
            searchFolderId: params.get("folderId")
        };
    }, [location.search]);

    const currentFolderId = useMemo(() => {
        // 1. Priority: Optimistic update for tab switching/navigation
        if (pendingFolderId !== null) return pendingFolderId === 'root' ? undefined : (pendingFolderId as string);

        // 2. Tags view takes precedence (no folder)
        if (tagId) return undefined;

        // 3. Search folder ID (query param) - handles /notes?folderId=...
        // We prioritize this over path params as it's the primary way we navigate folders in the sidebar
        if (searchFolderId !== null) {
            if (['root', 'null', 'undefined', ''].includes(searchFolderId)) return undefined;
            return searchFolderId;
        }

        // 4. Route folder ID (path param) - handles /notes/:folderId/:noteId
        if (routeFolderId && !['root', 'null', 'undefined'].includes(routeFolderId)) return routeFolderId;

        return undefined;
    }, [routeFolderId, searchFolderId, tagId, pendingFolderId]);

    // Clear pending ID once URL catches up
    useEffect(() => {
        if (pendingFolderId === null) return;

        const normalizedActual = searchFolderId || routeFolderId || 'root';
        const normalizedPending = pendingFolderId || 'root';

        if (normalizedActual === normalizedPending) {
            setPendingFolderId(null);
        }
    }, [searchFolderId, routeFolderId, pendingFolderId]);

    const [retryCooldown, setRetryCooldown] = useState(false);


    useEffect(() => {
        const saved = localStorage.getItem("sidebar_active_tab");
        if (saved) {
            setActiveTab(saved as SidebarTab);
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
        // If we're navigating to the same URL, we need to clear quick access manually
        // because the location key might not change, and we want to "close" the quick access view.
        if (location.pathname + location.search === to) {
            clearQuickAccessView();
        }
        navigateSmart(to);
    }, [navigateSmart, location.pathname, location.search, clearQuickAccessView]);

    const handleFolderCreated = useCallback((id: string) => {
        setPendingFolderId(id);
        setActiveTab('notes');
        navigateWithHistory(`/notes?folderId=${id}`);
    }, [navigateWithHistory, setActiveTab]);

    const [width, setWidth] = useState(() => {
        const saved = localStorage.getItem("sidebar_width");
        return saved ? parseInt(saved, 10) : 260;
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
                "relative flex overflow-visible shrink-0 flex-col bg-transparent transition-all duration-300 ease-in-out  ",
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
                        general.appDirection === "rtl" ? "left-0 -translate-x-2" : "right-0 translate-x-2"
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

                <SidebarContent data-tauri-drag-region className={cn("min-w-0 flex flex-col overflow-hidden ")}>
                    {activeTab === 'folders' && (
                        <FoldersTree
                            isFoldersOpen={true}
                            setIsFoldersOpen={() => { }}
                            onNavigate={(id) => {
                                setPendingFolderId(id || 'root');
                                setActiveTab('notes');
                                navigateWithHistory(`/notes?folderId=${id}`);
                            }}
                            onEdit={handleEditFolder}
                            onDelete={setFolderToDelete}
                            onCreateSubFolder={handleCreateSubFolder}
                            onCreateNote={(id) => {
                                setPendingFolderId(id || 'root');
                                createNote(id);
                                setActiveTab('notes');
                            }}
                            getFoldersInFolder={getFoldersInFolder}
                            general={general}
                            currentFolderId={currentFolderId ?? null}
                        />
                    )}

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
                        />
                    )}

                    {activeTab === 'tags' && (
                        <TagsList
                            tags={tags}
                            isTagsOpen={true}
                            setIsTagsOpen={() => { }}
                            activeTagId={tagId}
                            onTagClick={(id) => {
                                setPendingFolderId(null);
                                navigateWithHistory(`/notes?tagId=${id}`);
                                setActiveTab('notes');
                            }}
                            general={general}
                        />
                    )}

                    {activeTab === 'search' && (
                        <SearchView
                            onNoteClick={(note) => {
                                navigateWithHistory(`/notes/${note.folderId || "root"}/${note.id}`);
                            }}
                            onFolderClick={(folder) => {
                                setPendingFolderId(folder.id || 'root');
                                navigateWithHistory(`/notes?folderId=${folder.id}`);
                                setActiveTab('notes');
                            }}
                            onDeleteNote={deleteNote}
                            onEditFolder={handleEditFolder}
                            onDeleteFolder={setFolderToDelete}
                            onCreateSubFolder={handleCreateSubFolder}
                            onCreateNote={(id) => {
                                setPendingFolderId(id || 'root');
                                createNote(id);
                                setActiveTab('notes');
                            }}
                        />
                    )}
                </SidebarContent>

                <div className={cn("mt-auto  ")}>
                    <SidebarFooterSection
                        showOfflineBanner={showOfflineBanner}
                        retryCooldown={retryCooldown}
                        onRetry={handleRetry}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        colors={colors}
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
