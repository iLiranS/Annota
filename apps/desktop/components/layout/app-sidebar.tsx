import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCreateNote } from "@/hooks/use-create-note";
import { useSmartNavigate } from "@/hooks/use-smart-navigate";
import { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID, getSortTypeLabel, sortNotes, useNotesStore, useSearchStore, useSettingsStore, useSyncStore, useUserStore, type Folder, type SortType } from "@annota/core";

// Modular Components
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../custom-ui/confirm-dialog";
import { FolderEditModal } from "../notes/folder-edit-modal";
import { FoldersTree } from "./sidebar/folders-tree";
import { NotesList } from "./sidebar/notes-list";


import { QuickAccessSection } from "./sidebar/quick-access";
import { SearchView } from "./sidebar/search-view";
import { SidebarFooterSection } from "./sidebar/sidebar-footer";
import { SidebarTabs } from "./sidebar/sidebar-tabs";
import { TagsList } from "./sidebar/tags-list";

type SidebarTab = 'folders' | 'notes' | 'tags' | 'search';

const SORT_OPTIONS: SortType[] = [
    'UPDATED_LAST',
    'UPDATED_FIRST',
    'CREATED_LAST',
    'CREATED_FIRST',
    'NAME_ASC',
    'NAME_DESC',
];

export function AppSidebar() {
    const navigate = useNavigate();
    const navigateSmart = useSmartNavigate();
    const location = useLocation();
    const { folderId: routeFolderId, noteId: routeNoteId } = useParams();
    const { colors } = useAppTheme();
    const { general } = useSettingsStore();
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
    const isGuest = useUserStore((s) => s.isGuest);
    const showOfflineBanner = !isOnline && !isGuest;
    const { createAndNavigate: createNote } = useCreateNote();

    const [pendingFolderId, setPendingFolderId] = useState<string | undefined | null>(null);

    const { tagId, searchFolderId } = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return {
            tagId: params.get("tagId"),
            searchFolderId: params.get("folderId")
        };
    }, [location.search]);

    const currentFolderId = useMemo(() => {
        // Optimistic update for tab switching
        if (pendingFolderId !== null) return pendingFolderId === 'root' ? undefined : (pendingFolderId as string);

        if (tagId) return undefined;
        if (searchFolderId && !['root', 'null', 'undefined'].includes(searchFolderId)) return searchFolderId;
        if (routeFolderId && !['root', 'null', 'undefined'].includes(routeFolderId)) return routeFolderId;
        return undefined;
    }, [routeFolderId, searchFolderId, tagId, pendingFolderId]);

    // Clear pending ID once URL catches up
    useEffect(() => {
        const normalizedActual = searchFolderId || routeFolderId || 'root';
        const normalizedPending = pendingFolderId === null ? null : (pendingFolderId || 'root');

        if (normalizedPending && normalizedActual === normalizedPending) {
            setPendingFolderId(null);
        }
    }, [searchFolderId, routeFolderId, pendingFolderId]);

    const currentFolder = currentFolderId ? getFolderById(currentFolderId) : null;
    // const parentFolder = currentFolder?.parentId ? getFolderById(currentFolder.parentId) : null;
    const currentSortType = getSortType(currentFolderId ?? null);

    const [retryCooldown, setRetryCooldown] = useState(false);
    const [activeTab, setActiveTab] = useState<SidebarTab>(() => {
        const saved = localStorage.getItem("sidebar_active_tab");
        return (saved as SidebarTab) || "notes";
    });

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
        return sortNotes(list, currentSortType);
    }, [notes, currentFolderId, currentSortType, tagId]);



    const quickAccessNotes = useMemo(() => {
        return notes.filter((n) => n.isQuickAccess && !n.isDeleted);
    }, [notes]);

    const currentTag = useMemo(() => tags.find(t => t.id === tagId), [tags, tagId]);

    // const breadcrumbs = useMemo(() => {
    //     if (!currentFolderId && !tagId && !isTrash && !isDaily) return null;
    //     const crumbs: { name: string; id: string | null; icon?: string; color?: string }[] = [];
    //     crumbs.push({ name: "All Notes", id: null, icon: "annota", color: colors.primary });

    //     if (tagId || isTrash || isDaily) return crumbs;

    //     if (currentFolderId && parentFolder) {
    //         if (parentFolder.parentId) {
    //             crumbs.push({ name: "...", id: null });
    //         }
    //         crumbs.push({
    //             name: parentFolder.name,
    //             id: parentFolder.id,
    //             icon: parentFolder.icon || "folder",
    //             color: parentFolder.color
    //         });
    //     }
    //     return crumbs;
    // }, [currentFolderId, tagId, isTrash, isDaily, parentFolder, colors.primary]);

    // const handleNavigate = useCallback((id: string | null) => {
    //     if (id) {
    //         navigateSmart(`/notes?folderId=${id}`);
    //     } else {
    //         navigateSmart("/notes");
    //     }
    // }, [navigateSmart]);

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
                "relative flex shrink-0 flex-col bg-transparent transition-all duration-300 ease-in-out border-e border-sidebar-border/60 overflow-hidden",
                !open && "w-0! opacity-0 pointer-events-none border-none",
                isResizing && "transition-none"
            )}
            style={{
                width: open ? `${width}px` : 0,
                ["--sidebar-width" as any]: `${width}px`
            }}
        >
            <Sidebar

                collapsible="none"
                className="border-none select-none bg-transparent w-full "
                side={general.appDirection === 'rtl' ? 'right' : 'left'}
            >
                <div
                    onMouseDown={startResizing}
                    className={cn(
                        "absolute top-0 bottom-0 w-1 cursor-col-resize z-50 hover:bg-primary/30 transition-colors",
                        general.appDirection === "rtl" ? "left-0" : "right-0"
                    )}
                />

                <SidebarTabs
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    colors={colors}
                />

                <SidebarContent data-tauri-drag-region className={cn("min-w-0 flex flex-col overflow-hidden px-1")}>
                    {activeTab === 'folders' && (
                        <FoldersTree
                            isFoldersOpen={true}
                            setIsFoldersOpen={() => { }}
                            onNavigate={(id) => {
                                setPendingFolderId(id || 'root');
                                setActiveTab('notes');
                                navigateSmart(`/notes?folderId=${id}`);
                            }}
                            onEdit={handleEditFolder}
                            onDelete={setFolderToDelete}
                            onCreateSubFolder={handleCreateSubFolder}
                            onCreateNote={createNote}
                            getFoldersInFolder={getFoldersInFolder}
                            general={general}
                            currentFolderId={currentFolderId ?? null}
                        />
                    )}

                    {activeTab === 'notes' && (
                        <>
                            {/* <BreadcrumbsSection
                                breadcrumbs={breadcrumbs}
                                onNavigate={handleNavigate}
                            /> */}

                            <div className="flex-1 overflow-hidden flex flex-col">
                                <NotesList
                                    key={currentFolderId ?? tagId ?? 'root'}
                                    notes={browseNotes}
                                    activeNoteId={routeNoteId}
                                    onNoteClick={(note) => navigateSmart(`/notes/${note.folderId || "root"}/${note.id}`)}
                                    onDeleteNote={deleteNote}
                                    general={general}
                                    selectionMode={selectionMode}
                                    selectedNoteIds={selectedNoteIds}
                                    onToggleSelection={handleToggleSelection}
                                    onClearSelection={() => {
                                        handleSetSelectionMode(false);
                                    }}
                                    currentFolderId={currentFolderId ?? null}
                                    // New Header Props
                                    title={headerTitle}
                                    icon={headerIcon}
                                    color={headerColor}
                                    isDaily={isDaily}
                                    isTrash={isTrash}
                                    isRoot={isRoot}
                                    tagId={tagId || undefined}
                                    currentSortType={currentSortType}
                                    onSortChange={(type) => setFolderSortType(currentFolderId ?? null, type)}
                                    onCreateNote={() => createNote(currentFolderId || "", tagId || undefined)}
                                    onCreateFolder={() => {
                                        setEditingFolder(null);
                                        setNewFolderParentId(currentFolderId ?? null);
                                        setIsEditModalOpen(true);
                                    }}
                                    sortOptions={SORT_OPTIONS}
                                    getSortTypeLabel={getSortTypeLabel}
                                    setSelectionMode={handleSetSelectionMode}
                                />
                            </div>
                            <QuickAccessSection
                                notes={quickAccessNotes}
                                activeNoteId={routeNoteId}
                                onNoteClick={(note) => navigateSmart(`/notes/${note.folderId || "root"}/${note.id}`)}
                                onDeleteNote={deleteNote}
                                general={general}
                            />
                        </>
                    )}

                    {activeTab === 'tags' && (
                        <TagsList
                            tags={tags}
                            isTagsOpen={true}
                            setIsTagsOpen={() => { }}
                            activeTagId={tagId}
                            onTagClick={(id) => {
                                navigateSmart(`/notes?tagId=${id}`);
                                setActiveTab('notes');
                            }}
                            general={general}
                        />
                    )}

                    {activeTab === 'search' && (
                        <SearchView
                            onNoteClick={(note) => {
                                navigateSmart(`/notes/${note.folderId || "root"}/${note.id}`);
                            }}
                            onFolderClick={(folder) => {
                                navigateSmart(`/notes?folderId=${folder.id}`);
                                setActiveTab('notes');
                            }}
                        />
                    )}
                </SidebarContent>

                <div className={cn("mt-auto px-1 border-t border-border/40 ")}>
                    <SidebarFooterSection
                        showOfflineBanner={showOfflineBanner}
                        retryCooldown={retryCooldown}
                        onRetry={handleRetry}
                        onSettingsClick={() => navigate("/settings", { state: { background: location } })}
                        onTrashClick={() => {
                            navigateSmart(`/notes?folderId=${TRASH_FOLDER_ID}`);
                            setActiveTab('notes');
                        }}
                    />
                </div>

                <FolderEditModal
                    open={isEditModalOpen}
                    onOpenChange={setIsEditModalOpen}
                    folder={editingFolder}
                    defaultParentId={newFolderParentId}
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
