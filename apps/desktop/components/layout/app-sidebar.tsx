import icon from "@/src/assets/icon.png";
import {
    DAILY_NOTES_FOLDER_ID,
    useNotesStore,
    useSyncStore,
    useUserStore,
    type Folder,
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
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarRail, SidebarSeparator } from "@/components/ui/sidebar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ConfirmDialog } from "../custom-ui/confirm-dialog";
import { FolderEditModal } from "../notes/folder-edit-modal";
import { Ionicons } from "../ui/ionicons";

export function AppSidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { colors } = useAppTheme();

    const { folders, notes, deleteFolder } = useNotesStore();
    const isOnline = useSyncStore((s) => s.isOnline);
    const isGuest = useUserStore((s) => s.isGuest);
    const showOfflineBanner = !isOnline && !isGuest;

    const [retryCooldown, setRetryCooldown] = useState(false);
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);

    const handleRetry = useCallback(() => {
        if (retryCooldown) return;
        setRetryCooldown(true);
        useSyncStore.getState().forceSync().catch(console.error);
        setTimeout(() => setRetryCooldown(false), 10_000);
    }, [retryCooldown]);

    const handleEditFolder = useCallback((folder: Folder) => {
        setEditingFolder(folder);
        setIsEditModalOpen(true);
    }, []);

    const handleDeleteFolder = useCallback(async () => {
        if (!folderToDelete) return;
        await deleteFolder(folderToDelete.id);
        setFolderToDelete(null);
    }, [deleteFolder, folderToDelete]);

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

    return (
        <Sidebar collapsible="offcanvas" className="border-sidebar-border select-none">
            {/* ── Header ───────────────────────────────────── */}
            <SidebarHeader
                data-tauri-drag-region
                className="flex h-8 shrink-0 flex-row items-center gap-2 px-2 py-0"
            >
                <div className="flex items-center pt-2 px-1 gap-1  h-full">

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
            <SidebarContent className="min-w-0 overflow-x-hidden pt-2">
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
                                        isActive("/notes") &&
                                        location.pathname.includes(DAILY_NOTES_FOLDER_ID)
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
                <Collapsible className="group/quick-access">
                    <SidebarGroup>
                        <SidebarGroupLabel asChild>
                            <CollapsibleTrigger className="flex w-full items-center gap-2">
                                <Ionicons name="star" size={16} className="text-amber-400" />
                                <span className="flex-1 text-left">Quick Access</span>
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
                                            <SidebarMenuItem key={note.id}>
                                                <SidebarMenuButton
                                                    onClick={() => {
                                                        const folderId = note.folderId || "root";
                                                        navigate(`/notes/${folderId}/${note.id}`);
                                                    }}
                                                    className="text-sm"
                                                >
                                                    <Ionicons name="document-text" size={16} className="text-primary" />
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
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    isActive={
                                        isActive("/notes") &&
                                        !location.pathname.includes(DAILY_NOTES_FOLDER_ID)
                                    }
                                    onClick={() => navigate("/notes")}
                                    tooltip="All Notes"
                                >
                                    <Ionicons name="documents" color={colors.primary} size={18} className="text-primary" />
                                    <span>All Notes</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            {/* Folder tree */}
                            {topLevelFolders.map((folder) => (
                                <FolderTreeItem
                                    key={folder.id}
                                    folder={folder}
                                    allFolders={folders}
                                    onNavigate={(folderId) =>
                                        navigate(`/notes?folderId=${folderId}`)
                                    }
                                    onEdit={handleEditFolder}
                                    onDelete={setFolderToDelete}
                                />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
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
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={() => navigate("/notes/trash")}
                            tooltip="Trash"
                        >
                            <Ionicons name="trash-outline" size={18} />
                            <span>Trash</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
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
}

function FolderTreeItem({ folder, allFolders, onNavigate, onEdit, onDelete }: FolderTreeItemProps) {
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
                    className="group/item"
                >
                    <SidebarMenuButton onClick={() => onNavigate(folder.id)}>
                        <FolderListItemContent folder={folder} />
                    </SidebarMenuButton>
                </FolderListItem>
                <CollapsibleTrigger asChild>
                    <button
                        type="button"
                        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1 hover:bg-sidebar-accent "
                    >
                        <Ionicons name="chevron-forward" size={12} className="transition-transform group-data-[state=open]/folder:rotate-90" />
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
                                    onNavigate={onNavigate}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
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
