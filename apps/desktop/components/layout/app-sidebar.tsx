import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCreateNote } from "@/hooks/use-create-note";
import { useSmartNavigate } from "@/hooks/use-smart-navigate";
import { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID, getSortTypeLabel, sortNotes, useChangelog, useNavigationStore, useNotesStore, useSearchStore, useSettingsStore, useSyncStore, useUserStore, type Folder, type SidebarTab, type SortType } from "@annota/core";


// Modular Components
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../custom-ui/confirm-dialog";
import { FolderEditModal } from "../notes/folder-edit-modal";
import { FoldersTree } from "./sidebar/folders-tree";
import { NotesList } from "./sidebar/notes-list";


import { QuickAccessSection } from "./sidebar/quick-access";
import { SearchView } from "./sidebar/search-view";
import { SidebarFooterSection } from "./sidebar/sidebar-footer";
import { SidebarHeaderSection } from "./sidebar/sidebar-header";
import { TagsList } from "./sidebar/tags-list";

// type SidebarTab = 'folders' | 'notes' | 'tags' | 'search';


const SORT_OPTIONS: SortType[] = [
    'UPDATED_LAST',
    'UPDATED_FIRST',
    'CREATED_LAST',
    'CREATED_FIRST',
    'NAME_ASC',
    'NAME_DESC',
];

export function AppSidebar() {
    const navigateSmart = useSmartNavigate();
    const location = useLocation();
    const { folderId: routeFolderId, noteId: routeNoteId } = useParams();
    const { colors } = useAppTheme();
    const { general } = useSettingsStore();
    const quickAccessNoteId = useNavigationStore((s) => s.quickAccessNoteId);
    const setQuickAccessView = useNavigationStore((s) => s.setQuickAccessView);
    const clearQuickAccessView = useNavigationStore((s) => s.clearQuickAccessView);
    const activeTab = useNavigationStore((s) => s.sidebarTab);
    const setActiveTab = useNavigationStore((s) => s.setSidebarTab);

    const {
        notes,
        tags,
        deleteFolder,
        deleteNote,
        getFoldersInFolder,
        getNotesInFolder,
        getFolderById,
        getSortType,
        setFolderSortType,
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

    const currentFolder = currentFolderId ? getFolderById(currentFolderId) : null;
    // const parentFolder = currentFolder?.parentId ? getFolderById(currentFolder.parentId) : null;
    const currentSortType = getSortType(currentFolderId ?? null);

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
    const isRoot = !currentFolderId && !tagId && !isTrash && !isDaily;

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

    const { open, setOpen } = useSidebar();

    const { isOpen: isSearchOpen, setIsOpen: setIsSearchOpen } = useSearchStore();

    useEffect(() => {
        if (isSearchOpen) {
            setActiveTab('search');
            setOpen(true);
            setIsSearchOpen(false);
        }
    }, [isSearchOpen, setOpen, setIsSearchOpen]);

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

    const browseNotes = useMemo(() => {
        if (tagId) {
            const list = notes.filter(n => {
                if (!n.tags) return false;
                try {
                    const tagIds = JSON.parse(n.tags) as string[];
                    return tagIds.includes(tagId) && !n.isDeleted && !n.isPermDeleted;
                } catch { return false; }
            });
            return sortNotes(list, currentSortType);
        }
        const list = getNotesInFolder(currentFolderId ?? null);
        const sortType = (isDaily || isTrash) ? 'CREATED_LAST' : currentSortType;
        return sortNotes(list, sortType);
    }, [notes, currentFolderId, currentSortType, tagId, isDaily, isTrash]);



    const quickAccessNotes = useMemo(() => {
        return notes.filter((n) => n.isQuickAccess && !n.isDeleted);
    }, [notes]);

    const currentTag = useMemo(() => tags.find(t => t.id === tagId), [tags, tagId]);

    const headerTitle = useMemo(() => {
        if (tagId) return currentTag?.name ?? "Tag";
        if (isTrash) return "Trash";
        if (isDaily) return "Daily Notes";
        return currentFolder ? currentFolder.name : "Annota";
    }, [tagId, currentTag, isTrash, isDaily, currentFolder]);

    const headerIcon = useMemo(() => {
        if (tagId && currentTag) return "ellipse";
        if (isTrash) return "trash";
        if (isDaily) return "calendar";
        return currentFolder ? currentFolder.icon : "documents";
    }, [tagId, currentTag, isTrash, isDaily, currentFolder]);

    const headerColor = useMemo(() => {
        if (tagId && currentTag) return currentTag.color;
        if (isTrash) return "#EF4444";
        if (isDaily) return "#8B5CF6";
        return currentFolder?.color || colors.primary;
    }, [tagId, currentTag, isTrash, isDaily, currentFolder, colors.primary]);

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
                "relative 2  flex shrink-0 flex-col bg-transparent transition-all duration-300 ease-in-out  ",
                !open && "w-0! opacity-0 pointer-events-none border-none",
                isResizing && "transition-none",
                open && 'ms-2'
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
                        "absolute top-0 bottom-0 w-1 cursor-col-resize z-50 hover:bg-primary/30 transition-colors",
                        general.appDirection === "rtl" ? "left-0 -translate-x-2" : "right-0 translate-x-2"
                    )}
                />

                {activeTab === 'notes' && (
                    <SidebarHeaderSection
                        title={headerTitle}
                        dir={general.appDirection}
                        icon={headerIcon}
                        color={headerColor}
                        isDaily={isDaily}
                        isTrash={isTrash}
                        currentSortType={(isDaily || isTrash) ? 'CREATED_LAST' : currentSortType}
                        onSortChange={(type) => setFolderSortType(currentFolderId ?? null, type)}
                        onCreateNote={() => {
                            createNote(currentFolderId ?? "", tagId || undefined);
                            setActiveTab('notes');
                        }}
                        onCreateFolder={() => {
                            setEditingFolder(null);
                            setNewFolderParentId(currentFolderId ?? null);
                            setIsEditModalOpen(true);
                        }}
                        onEditFolder={() => currentFolder && handleEditFolder(currentFolder)}
                        sortOptions={SORT_OPTIONS}
                        getSortTypeLabel={getSortTypeLabel}
                        tagId={tagId || undefined}
                        isRoot={isRoot}
                        selectionMode={selectionMode}
                        setSelectionMode={handleSetSelectionMode}
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
                        <>

                            <div className={cn(
                                "flex-1 overflow-hidden flex flex-col",
                                general.appDirection === 'rtl' ? "animate-content-from-right" : "animate-content-from-left"
                            )}>


                                <NotesList
                                    key={currentFolderId ?? tagId ?? 'root'}
                                    notes={browseNotes}
                                    activeNoteId={quickAccessNoteId || routeNoteId}
                                    onNoteClick={(note) => navigateWithHistory(`/notes/${note.folderId || "root"}/${note.id}`)}
                                    onDeleteNote={deleteNote}
                                    general={general}
                                    selectionMode={selectionMode}
                                    selectedNoteIds={selectedNoteIds}
                                    onToggleSelection={handleToggleSelection}
                                    onClearSelection={() => {
                                        handleSetSelectionMode(false);
                                    }}
                                    currentFolderId={currentFolderId ?? null}
                                    isTrash={isTrash}
                                    setSelectionMode={handleSetSelectionMode}
                                />
                                {!isTrash && !tagId && (
                                    <QuickAccessSection
                                        notes={quickAccessNotes}
                                        activeNoteId={quickAccessNoteId || routeNoteId}
                                        onNoteClick={(note) => {
                                            setQuickAccessView(note.id, currentFolderId || "root");
                                            navigateWithHistory(`/notes/${currentFolderId || "root"}/${note.id}`);
                                        }}
                                        onDeleteNote={deleteNote}
                                        general={general}
                                    />
                                )}
                            </div>
                        </>
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
