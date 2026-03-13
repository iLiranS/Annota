import icon from "@/src/assets/icon.png";
import {
    DAILY_NOTES_FOLDER_ID,
    GeneralSettings,
    useNotesStore,
    useSettingsStore,
    useSyncStore,
    useUserStore,
    type Folder,
    type Tag,
} from "@annota/core";
import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { FolderListItem, FolderListItemContent } from "@/components/notes/folder-list-item";
import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from "@/components/ui/context-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarRail, SidebarSeparator, useSidebar } from "@/components/ui/sidebar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCreateNote } from "@/hooks/use-create-note";
import { useCreateTask } from "@/hooks/use-create-task";
import { useEffect } from "react";
import { ConfirmDialog } from "../custom-ui/confirm-dialog";
import { FolderEditModal } from "../notes/folder-edit-modal";
import { TagEditModal } from "../tags/tag-edit-modal";
import { Ionicons } from "../ui/ionicons";

export function AppSidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { colors } = useAppTheme();
    const { toggleSidebar, setOpen } = useSidebar();
    const { general } = useSettingsStore();

    const { folders, notes, tags, deleteFolder, deleteTag } = useNotesStore();
    const isOnline = useSyncStore((s) => s.isOnline);
    const isGuest = useUserStore((s) => s.isGuest);
    const showOfflineBanner = !isOnline && !isGuest;
    const { createAndNavigate: createTask } = useCreateTask();
    const { createAndNavigate: createNote } = useCreateNote();

    const [retryCooldown, setRetryCooldown] = useState(false);
    const [isQuickAccessOpen, setIsQuickAccessOpen] = useState(() => {
        const saved = localStorage.getItem("sidebar_quick_access_open");
        return saved !== null ? saved === "true" : true;
    });
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);
    const [isTagEditModalOpen, setIsTagEditModalOpen] = useState(false);
    const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

    const handleRetry = useCallback(() => {
        if (retryCooldown) return;
        setRetryCooldown(true);
        useSyncStore.getState().forceSync().catch(console.error);
        setTimeout(() => setRetryCooldown(false), 10_000);
    }, [retryCooldown]);

    useEffect(() => {
        localStorage.setItem("sidebar_quick_access_open", String(isQuickAccessOpen));
    }, [isQuickAccessOpen]);

    useEffect(() => {
        const handleToggle = (e: any) => {
            if (e.detail?.open !== undefined) {
                setOpen(e.detail.open);
            } else {
                toggleSidebar();
            }
        };
        window.addEventListener('annota-toggle-main-sidebar', handleToggle);
        return () => window.removeEventListener('annota-toggle-main-sidebar', handleToggle);
    }, [toggleSidebar, setOpen]);

    const handleEditFolder = useCallback((folder: Folder) => {
        setEditingFolder(folder);
        setNewFolderParentId(null);
        setIsEditModalOpen(true);
    }, []);

    const handleCreateSubFolder = useCallback((parentFolder: Folder) => {
        setEditingFolder(null); // Create mode
        setNewFolderParentId(parentFolder.id); // Parent folder is the one clicked
        setIsEditModalOpen(true);
    }, []);

    const handleDeleteFolder = useCallback(async () => {
        if (!folderToDelete) return;
        await deleteFolder(folderToDelete.id);
        setFolderToDelete(null);
    }, [deleteFolder, folderToDelete]);

    const handleCreateTask = useCallback((folder: Folder) => {
        createTask({ folderId: folder.id });
    }, [createTask]);
    const handleCreateNote = useCallback((folder: Folder) => {
        createNote(folder.id);
    }, [createNote]);
    const handleCreateTopLevelFolder = useCallback(() => {
        setEditingFolder(null);
        setNewFolderParentId(null);
        setIsEditModalOpen(true);
    }, []);

    // Non-system top-level folders
    const topLevelFolders = useMemo(() => {
        return folders.filter((f) => f.parentId === null && !f.isSystem);
    }, [folders]);

    // Quick access notes
    const quickAccessNotes = useMemo(() => {
        return notes.filter((n) => n.isQuickAccess && !n.isDeleted);
    }, [notes]);

    // Daily notes folder
    const dailyFolder = useMemo(
        () => folders.find((f) => f.id === DAILY_NOTES_FOLDER_ID),
        [folders],
    );


    // Active path helper
    const isActive = (path: string) => location.pathname.startsWith(path);

    const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const queryFolderId = queryParams.get("folderId");
    const queryTagId = queryParams.get("tagId");

    return (
        <Sidebar
            collapsible="offcanvas"
            className="border-sidebar-border select-none"
            side={general.appDirection === 'rtl' ? 'right' : 'left'}
            dir={general.appDirection}
        >
            {/* ── Header ───────────────────────────────────── */}
            <SidebarHeader
                data-tauri-drag-region
                className="flex h-8 shrink-0 flex-row items-center gap-2 px-2 py-0"
            >
                <div style={{ display: general.appDirection === 'rtl' ? 'none' : 'flex' }} className="flex items-center pt-2 px-1 gap-1  h-full">

                    <img
                        src={icon}
                        data-tauri-drag-region
                        className="w-6 aspect-square select-none"
                        alt="Annota"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                        }}
                    />
                    <span data-tauri-drag-region className="text-sm  font-bold tracking-tight group-data-[collapsible=icon]:hidden">
                        Annota
                    </span>
                </div>
            </SidebarHeader>

            {/* ── Content ──────────────────────────────────── */}
            <SidebarContent className="min-w-0 overflow-x-hidden pt-2 ">
                {/* Navigation group */}
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    isActive={isActive("/home") || location.pathname === "/"}
                                    onClick={() => navigate("/home")}
                                    tooltip="Home"
                                >
                                    <Ionicons name="home" size={18} className="text-indigo-500" />
                                    <span>Home</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    isActive={isActive("/tasks")}
                                    onClick={() => navigate("/tasks")}
                                    tooltip="Tasks"
                                >
                                    <Ionicons name="checkmark-circle" size={18} className="text-emerald-500" />
                                    <span>Tasks</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    isActive={
                                        (isActive("/notes") &&
                                            location.pathname.includes(DAILY_NOTES_FOLDER_ID)) ||
                                        queryFolderId === DAILY_NOTES_FOLDER_ID
                                    }
                                    onClick={() =>
                                        navigate(`/notes?folderId=${DAILY_NOTES_FOLDER_ID}`)
                                    }
                                    tooltip="Daily Notes"
                                >
                                    <Ionicons
                                        name={(dailyFolder?.icon as any) || "calendar"}
                                        size={18}
                                        className="text-violet-500"
                                        color={dailyFolder?.color}
                                    />
                                    <span>{dailyFolder?.name ?? "Daily Notes"}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Quick Access */}
                <Collapsible
                    className="group/quick-access"
                    open={isQuickAccessOpen}
                    onOpenChange={setIsQuickAccessOpen}
                >
                    <SidebarGroup>
                        <SidebarGroupLabel asChild>
                            <CollapsibleTrigger className="flex w-full items-center gap-2">
                                <Ionicons name="star" size={16} className="text-amber-400" />
                                <span className="flex-1 text-start">Quick Access</span>
                                <Ionicons name="chevron-forward" size={14} className="transition-transform group-data-[state=open]/quick-access:rotate-90" />
                            </CollapsibleTrigger>
                        </SidebarGroupLabel>
                        <CollapsibleContent>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {quickAccessNotes.length === 0 ? (
                                        <p className="px-3 py-2 text-xs italic text-muted-foreground">
                                            No starred notes
                                        </p>
                                    ) : (
                                        quickAccessNotes.map((note) => (
                                            <SidebarMenuItem className="pl-2" key={note.id}>
                                                <SidebarMenuButton
                                                    onClick={() => {
                                                        const folderId = note.folderId || "root";
                                                        navigate(`/notes/${folderId}/${note.id}`);
                                                    }}
                                                    className="text-sm"
                                                >
                                                    <Ionicons color={colors.primary} name="star-outline" size={16} className="text-primary" />
                                                    <span className="truncate">
                                                        {note.title || "Untitled Note"}
                                                    </span>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        ))
                                    )}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </CollapsibleContent>
                    </SidebarGroup>
                </Collapsible>

                <SidebarSeparator />



                {/* Notes & Folders */}
                <SidebarGroup>
                    <SidebarGroupLabel>Notes</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem key="all-notes">
                                <ContextMenu>
                                    <ContextMenuTrigger asChild>
                                        <SidebarMenuButton
                                            isActive={
                                                location.pathname === "/notes" &&
                                                !queryFolderId &&
                                                !queryTagId
                                            }
                                            onClick={() => navigate("/notes")}
                                            tooltip="All Notes"
                                        >
                                            <Ionicons name="documents" color={colors.primary} size={18} className="text-primary" />
                                            <span>All Notes</span>
                                        </SidebarMenuButton>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent className="w-48">
                                        <ContextMenuItem className="gap-2" onClick={() => createNote()}>
                                            <Ionicons name="document-outline" size={16} />
                                            <span>New Note</span>
                                        </ContextMenuItem>
                                        <ContextMenuItem className="gap-2" onClick={handleCreateTopLevelFolder}>
                                            <Ionicons name="folder-outline" size={16} />
                                            <span>New Folder</span>
                                        </ContextMenuItem>
                                        <ContextMenuItem className="gap-2" onClick={() => createTask()}>
                                            <Ionicons name="checkmark-circle-outline" size={16} />
                                            <span>New Task</span>
                                        </ContextMenuItem>
                                    </ContextMenuContent>
                                </ContextMenu>
                            </SidebarMenuItem>

                            {/* Folder tree */}
                            {topLevelFolders.map((folder) => (
                                <FolderTreeItem
                                    key={folder.id}
                                    folder={folder}
                                    general={general}
                                    allFolders={folders}
                                    onNavigate={(folderId) =>
                                        navigate(`/notes?folderId=${folderId}`)
                                    }
                                    onEdit={handleEditFolder}
                                    onDelete={setFolderToDelete}
                                    onCreateSubFolder={handleCreateSubFolder}
                                    onCreateTask={handleCreateTask}
                                    onCreateNote={handleCreateNote}
                                />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>


                {/* Tags */}
                <Collapsible
                    className="group/tags"
                    defaultOpen={true}
                >
                    <SidebarGroup>
                        <SidebarGroupLabel asChild>
                            <CollapsibleTrigger className="flex w-full items-center gap-2">
                                <Ionicons name="pricetag" size={16} className="text-pink-500" />
                                <span className="flex-1 text-start">Tags</span>
                                <Ionicons name="chevron-forward" size={14} className={`transition-transform group-data-[state=open]/tags:rotate-90 ${general.appDirection === 'rtl' ? 'rotate-180' : ''}`} />
                            </CollapsibleTrigger>
                        </SidebarGroupLabel>
                        <CollapsibleContent>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {tags.length === 0 ? (
                                        <SidebarMenuItem key="no-tags">
                                            <p className="px-3 py-2 text-xs italic text-muted-foreground">
                                                No tags yet
                                            </p>
                                        </SidebarMenuItem>
                                    ) : (
                                        tags.map((tag) => (
                                            <SidebarMenuItem key={tag.id}>
                                                <ContextMenu>
                                                    <ContextMenuTrigger asChild>
                                                        <SidebarMenuButton
                                                            onClick={() => navigate(`/notes?tagId=${tag.id}`)}
                                                            isActive={isActive("/notes") && location.search.includes(`tagId=${tag.id}`)}
                                                            className="text-sm"
                                                        >
                                                            <Ionicons className="ml-1" color={tag.color} name="ellipse" size={16} />
                                                            <span className="truncate">{tag.name}</span>
                                                        </SidebarMenuButton>
                                                    </ContextMenuTrigger>
                                                    <ContextMenuContent className="w-48">
                                                        <ContextMenuItem
                                                            className="gap-2"
                                                            onClick={() => {
                                                                setEditingTag(tag);
                                                                setIsTagEditModalOpen(true);
                                                            }}
                                                        >
                                                            <Ionicons name="pencil-outline" size={16} />
                                                            <span>Update Tag</span>
                                                        </ContextMenuItem>
                                                        <ContextMenuItem
                                                            className="gap-2 text-destructive focus:text-destructive"
                                                            onClick={() => deleteTag(tag.id)}
                                                        >
                                                            <Ionicons name="trash-outline" size={16} />
                                                            <span>Delete Tag</span>
                                                        </ContextMenuItem>
                                                    </ContextMenuContent>
                                                </ContextMenu>
                                            </SidebarMenuItem>
                                        ))
                                    )}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </CollapsibleContent>
                    </SidebarGroup>
                </Collapsible>
            </SidebarContent>


            {/* ── Footer ───────────────────────────────────── */}
            <SidebarFooter className="gap-2 px-3 pb-3">
                {showOfflineBanner && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5">
                        <Ionicons name="cloud-offline" size={16} className="text-amber-500" />
                        <span className="flex-1 text-xs font-medium">Offline</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-indigo-500"
                            disabled={retryCooldown}
                            onClick={handleRetry}
                        >
                            {retryCooldown ? "Wait…" : "Retry"}
                        </Button>
                    </div>
                )}

                <SidebarMenu>
                    <SidebarMenuItem key="trash">
                        <SidebarMenuButton
                            onClick={() => navigate("/notes/trash")}
                            tooltip="Trash"
                        >
                            <Ionicons name="trash-outline" size={18} />
                            <span>Trash</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem key="settings">
                        <SidebarMenuButton
                            onClick={() => navigate("/settings", { state: { background: location } })}
                            tooltip="Settings"
                        >
                            <Ionicons name="settings-outline" size={18} />
                            <span>Settings</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />

            {/* Modals */}
            <FolderEditModal
                open={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                folder={editingFolder}
                defaultParentId={newFolderParentId}
            />

            <TagEditModal
                open={isTagEditModalOpen}
                onOpenChange={setIsTagEditModalOpen}
                tag={editingTag}
            />

            <ConfirmDialog
                open={!!folderToDelete}
                onOpenChange={(open) => !open && setFolderToDelete(null)}
                title="Delete Folder?"
                description={`This will permanently delete "${folderToDelete?.name}" and all its contents.`}
                confirmText="Delete Folder"
                onConfirm={handleDeleteFolder}
                variant="destructive"
            />
        </Sidebar>
    );
}

interface FolderTreeItemProps {
    folder: Folder;
    allFolders: Folder[];
    onNavigate: (folderId: string) => void;
    onEdit: (folder: Folder) => void;
    onDelete: (folder: Folder) => void;
    onCreateSubFolder: (parentFolder: Folder) => void;
    onCreateTask: (folder: Folder) => void;
    onCreateNote: (folder: Folder) => void;
    general: GeneralSettings;
}

function FolderTreeItem({ folder, allFolders, onNavigate, onEdit, onDelete, onCreateSubFolder, onCreateTask, onCreateNote, general }: FolderTreeItemProps) {
    const children = allFolders.filter(
        (f) => f.parentId === folder.id && !f.isSystem,
    );
    const hasChildren = children.length > 0;

    if (!hasChildren) {
        return (
            <SidebarMenuItem>
                <FolderListItem
                    asChild
                    folder={folder}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onCreateSubFolder={onCreateSubFolder}
                    onCreateTask={onCreateTask}
                    onCreateNote={onCreateNote}
                    className="group/item"
                >
                    <SidebarMenuButton onClick={() => onNavigate(folder.id)}>
                        <FolderListItemContent folder={folder} />
                    </SidebarMenuButton>
                </FolderListItem>
            </SidebarMenuItem>
        );
    }

    return (
        <Collapsible className="group/folder">
            <SidebarMenuItem>
                <FolderListItem
                    asChild
                    folder={folder}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onCreateSubFolder={onCreateSubFolder}
                    onCreateTask={onCreateTask}
                    onCreateNote={onCreateNote}
                    className="group/item"
                >
                    <SidebarMenuButton onClick={() => onNavigate(folder.id)}>
                        <FolderListItemContent folder={folder} />
                    </SidebarMenuButton>
                </FolderListItem>
                <CollapsibleTrigger asChild>
                    <button
                        type="button"
                        className={`absolute top-1/2 -translate-y-1/2 rounded-md p-1 hover:bg-sidebar-accent ${general.appDirection === 'rtl' ? 'left-1' : 'right-1'}`}
                    >
                        <Ionicons name="chevron-forward" size={12} className={`transition-transform group-data-[state=open]/folder:rotate-90 ${general.appDirection === 'rtl' ? 'rotate-180' : ''}`} />
                    </button>
                </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
                <SidebarMenuSub>
                    {children.map((child) => {
                        const nested = allFolders.filter(
                            (f) => f.parentId === child.id && !f.isSystem,
                        );
                        if (nested.length > 0) {
                            return (
                                <FolderTreeItem
                                    key={child.id}
                                    folder={child}
                                    allFolders={allFolders}
                                    general={general}
                                    onNavigate={onNavigate}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onCreateSubFolder={onCreateSubFolder}
                                    onCreateTask={onCreateTask}
                                    onCreateNote={onCreateNote}
                                />
                            );
                        }
                        return (
                            <SidebarMenuSubItem key={child.id}>
                                <FolderListItem
                                    asChild
                                    folder={child}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onCreateSubFolder={onCreateSubFolder}
                                    onCreateTask={onCreateTask}
                                    onCreateNote={onCreateNote}
                                    className="group/item "
                                >
                                    <SidebarMenuSubButton onClick={() => onNavigate(child.id)}>
                                        <FolderListItemContent folder={child} />
                                    </SidebarMenuSubButton>
                                </FolderListItem>
                            </SidebarMenuSubItem>
                        );
                    })}
                </SidebarMenuSub>
            </CollapsibleContent>
        </Collapsible>
    );
}
