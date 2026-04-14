import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCreateNote } from "@/hooks/use-create-note";
import { useSmartNavigate } from "@/hooks/use-smart-navigate";
import { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID, getSortTypeLabel, sortNotes, useNotesStore, useSettingsStore, useSyncStore, useUserStore, type Folder, type SortType } from "@annota/core";

// Modular Components
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../custom-ui/confirm-dialog";
import { FolderEditModal } from "../notes/folder-edit-modal";
import { BreadcrumbsSection } from "./sidebar/breadcrumbs";
import { FoldersTree } from "./sidebar/folders-tree";
import { NotesList } from "./sidebar/notes-list";

import { QuickAccessSection } from "./sidebar/quick-access";
import { SidebarFooterSection } from "./sidebar/sidebar-footer";
import { SidebarHeaderSection } from "./sidebar/sidebar-header";
import { TagsList } from "./sidebar/tags-list";

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
    const [searchParams] = useSearchParams();
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

    const tagId = searchParams.get("tagId");

    const currentFolderId = useMemo(() => {
        if (tagId) return undefined;
        const searchFolderId = searchParams.get("folderId");
        if (searchFolderId && !['root', 'null', 'undefined'].includes(searchFolderId)) return searchFolderId;
        if (routeFolderId && !['root', 'null', 'undefined'].includes(routeFolderId)) return routeFolderId;
        return undefined;
    }, [routeFolderId, searchParams, tagId]);

    const currentFolder = currentFolderId ? getFolderById(currentFolderId) : null;
    const parentFolder = currentFolder?.parentId ? getFolderById(currentFolder.parentId) : null;
    const currentSortType = getSortType(currentFolderId ?? null);

    const [retryCooldown, setRetryCooldown] = useState(false);
    const [isFoldersOpen, setIsFoldersOpen] = useState(() => {
        const saved = localStorage.getItem("sidebar_folders_open");
        return saved !== null ? saved === "true" : true;
    });
    const [isTagsOpen, setIsTagsOpen] = useState(() => {
        const saved = localStorage.getItem("sidebar_tags_open");
        return saved !== null ? saved === "true" : true;
    });

    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
    const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

    const handleRetry = useCallback(() => {
        if (retryCooldown) return;
        setRetryCooldown(true);
        useSyncStore.getState().forceSync().catch(console.error);
        setTimeout(() => setRetryCooldown(false), 10_000);
    }, [retryCooldown]);

    useEffect(() => {
        localStorage.setItem("sidebar_folders_open", String(isFoldersOpen));
    }, [isFoldersOpen]);

    useEffect(() => {
        localStorage.setItem("sidebar_tags_open", String(isTagsOpen));
    }, [isTagsOpen]);

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
    const isTrash = currentFolderId === TRASH_FOLDER_ID;
    const isDaily = currentFolderId === DAILY_NOTES_FOLDER_ID;

    const breadcrumbs = useMemo(() => {
        if (!currentFolderId && !tagId && !isTrash && !isDaily) return null;
        const crumbs: { name: string; id: string | null; icon?: string; color?: string }[] = [];
        crumbs.push({ name: "All Notes", id: null, icon: "documents" });

        if (tagId || isTrash || isDaily) return crumbs;

        if (currentFolderId && parentFolder) {
            if (parentFolder.parentId) {
                crumbs.push({ name: "...", id: null });
            }
            crumbs.push({
                name: parentFolder.name,
                id: parentFolder.id,
                icon: parentFolder.icon || "folder",
                color: parentFolder.color
            });
        }
        return crumbs;
    }, [currentFolderId, tagId, isTrash, isDaily, parentFolder]);

    const handleNavigate = useCallback((id: string | null) => {
        if (id) {
            navigateSmart(`/notes?folderId=${id}`);
        } else {
            navigateSmart("/notes");
        }
    }, [navigateSmart]);

    const headerTitle = useMemo(() => {
        if (tagId) return currentTag?.name ?? "Tag";
        if (isTrash) return "Trash";
        if (isDaily) return "Daily Notes";
        return currentFolder ? currentFolder.name : "Annota";
    }, [tagId, currentTag, isTrash, isDaily, currentFolder]);

    const headerIcon = useMemo(() => {
        if (tagId && currentTag) return "ellipse";
        if (isTrash) return "trash";
        if (isDaily) return "calendar-clear-outline";
        return currentFolder ? currentFolder.icon : "documents";
    }, [tagId, currentTag, isTrash, isDaily, currentFolder]);

    const headerColor = useMemo(() => {
        if (tagId && currentTag) return currentTag.color;
        if (isTrash) return "#EF4444";
        if (isDaily) return "#8B5CF6";
        return currentFolder?.color || colors.primary;
    }, [tagId, currentTag, isTrash, isDaily, currentFolder, colors.primary]);

    const { open } = useSidebar();
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
                <SidebarHeaderSection
                    title={headerTitle}
                    icon={headerIcon}
                    color={headerColor}
                    isDaily={isDaily}
                    isTrash={isTrash}
                    currentSortType={currentSortType}
                    onSortChange={(type) => setFolderSortType(currentFolderId ?? null, type)}
                    onCreateNote={() => createNote(currentFolderId || "")}
                    onCreateFolder={() => {
                        setEditingFolder(null);
                        setNewFolderParentId(null);
                        setIsEditModalOpen(true);
                    }}
                    sortOptions={SORT_OPTIONS}
                    getSortTypeLabel={getSortTypeLabel}
                />

                <BreadcrumbsSection
                    breadcrumbs={breadcrumbs}
                    onNavigate={handleNavigate}
                />

                <SidebarContent className={cn("min-w-0  flex flex-col overflow-hidden px-1 ")}>
                    <FoldersTree
                        isFoldersOpen={isFoldersOpen}
                        setIsFoldersOpen={setIsFoldersOpen}
                        onNavigate={(id) => navigateSmart(`/notes?folderId=${id}`)}
                        onEdit={handleEditFolder}
                        onDelete={setFolderToDelete}
                        onCreateSubFolder={handleCreateSubFolder}
                        onCreateNote={createNote}
                        getFoldersInFolder={getFoldersInFolder}
                        general={general}
                        currentFolderId={currentFolderId ?? null}
                    />
                    <NotesList
                        notes={browseNotes}
                        activeNoteId={routeNoteId}
                        onNoteClick={(note) => navigateSmart(`/notes/${note.folderId || "root"}/${note.id}`)}
                        onDeleteNote={deleteNote}
                        general={general}
                    />

                </SidebarContent>

                <div className={cn("mt-auto px-1")}>

                    <QuickAccessSection
                        notes={quickAccessNotes}
                        activeNoteId={routeNoteId}
                        onNoteClick={(note) => navigateSmart(`/notes/${note.folderId || "root"}/${note.id}`)}
                        onDeleteNote={deleteNote}
                        general={general}
                    />



                    <TagsList
                        tags={tags}
                        isTagsOpen={isTagsOpen}
                        setIsTagsOpen={setIsTagsOpen}
                        activeTagId={tagId}
                        onTagClick={(id) => navigateSmart(`/notes?tagId=${id}`)}
                        general={general}
                    />

                    <SidebarFooterSection
                        showOfflineBanner={showOfflineBanner}
                        retryCooldown={retryCooldown}
                        onRetry={handleRetry}
                        onSettingsClick={() => navigate("/settings", { state: { background: location } })}
                        onTrashClick={() => navigateSmart("/notes/trash")}
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
