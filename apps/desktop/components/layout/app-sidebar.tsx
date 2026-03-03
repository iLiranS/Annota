import {
    DAILY_NOTES_FOLDER_ID,
    useNotesStore,
    useSyncStore,
    useUserStore,
    type Folder,
} from "@annota/core";
import { SyncScheduler } from "@annota/core/platform";
import {
    Calendar,
    ChevronRight,
    CloudOff,
    FileText,
    FolderIcon,
    Home,
    ListChecks,
    Settings,
    Star,
    Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarRail,
    SidebarSeparator,
} from "@/components/ui/sidebar";

export function AppSidebar() {
    const navigate = useNavigate();
    const location = useLocation();

    const { folders, notes } = useNotesStore();
    const isOnline = useSyncStore((s) => s.isOnline);
    const isGuest = useUserStore((s) => s.isGuest);
    const showOfflineBanner = !isOnline && !isGuest;

    const [retryCooldown, setRetryCooldown] = useState(false);

    const handleRetry = useCallback(() => {
        if (retryCooldown) return;
        setRetryCooldown(true);
        SyncScheduler.instance?.requestImmediateSync();
        setTimeout(() => setRetryCooldown(false), 10_000);
    }, [retryCooldown]);

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
        <Sidebar collapsible="icon" className="border-r border-sidebar-border">
            {/* ── Header ───────────────────────────────────── */}
            <SidebarHeader className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <img
                        src="/annota-icon.png"
                        alt="Annota"
                        className="h-8 w-8 rounded-lg"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                        }}
                    />
                    <span className="text-lg font-bold tracking-tight group-data-[collapsible=icon]:hidden">
                        Annota
                    </span>
                </div>
            </SidebarHeader>

            {/* ── Content ──────────────────────────────────── */}
            <SidebarContent>
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
                                    <Home className="text-indigo-500" />
                                    <span>Home</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    isActive={isActive("/tasks")}
                                    onClick={() => navigate("/tasks")}
                                    tooltip="Tasks"
                                >
                                    <ListChecks className="text-emerald-500" />
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
                                    <Calendar className="text-violet-500" />
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
                                <Star className="h-4 w-4 text-amber-400" />
                                <span className="flex-1 text-left">Quick Access</span>
                                <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/quick-access:rotate-90" />
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
                                                    <FileText className="h-4 w-4 text-primary" />
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
                                    <FileText className="text-primary" />
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
                        <CloudOff className="h-4 w-4 text-amber-500" />
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
                            <Trash2 />
                            <span>Trash</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={() => navigate("/settings")}
                            tooltip="Settings"
                        >
                            <Settings />
                            <span>Settings</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}

/* ── Recursive folder tree item ───────────────────────────────── */

interface FolderTreeItemProps {
    folder: Folder;
    allFolders: Folder[];
    onNavigate: (folderId: string) => void;
}

function FolderTreeItem({ folder, allFolders, onNavigate }: FolderTreeItemProps) {
    const children = allFolders.filter(
        (f) => f.parentId === folder.id && !f.isSystem,
    );
    const hasChildren = children.length > 0;

    if (!hasChildren) {
        return (
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => onNavigate(folder.id)}>
                    <FolderIcon
                        className="h-4 w-4"
                        style={{ color: folder.color || undefined }}
                    />
                    <span className="truncate">{folder.name}</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    }

    return (
        <Collapsible className="group/folder">
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => onNavigate(folder.id)}>
                    <FolderIcon
                        className="h-4 w-4"
                        style={{ color: folder.color || undefined }}
                    />
                    <span className="truncate">{folder.name}</span>
                </SidebarMenuButton>
                <CollapsibleTrigger asChild>
                    <button
                        type="button"
                        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1 hover:bg-sidebar-accent"
                    >
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]/folder:rotate-90" />
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
                                />
                            );
                        }
                        return (
                            <SidebarMenuSubItem key={child.id}>
                                <SidebarMenuSubButton onClick={() => onNavigate(child.id)}>
                                    <FolderIcon
                                        className="h-3.5 w-3.5"
                                        style={{ color: child.color || undefined }}
                                    />
                                    <span className="truncate">{child.name}</span>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        );
                    })}
                </SidebarMenuSub>
            </CollapsibleContent>
        </Collapsible>
    );
}
