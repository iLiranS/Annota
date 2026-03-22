import {
    DAILY_NOTES_FOLDER_ID,
    getSortTypeLabel,
    sortFolders,
    sortNotes,
    TRASH_FOLDER_ID,
    useNotesStore,
    useSettingsStore,
    useTasksStore,
    type Folder,
    type NoteMetadata,
    type SortType
} from "@annota/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/custom-ui/confirm-dialog";
import { FolderEditModal } from "@/components/notes/folder-edit-modal";
import { FolderListItem } from '@/components/notes/folder-list-item';
import { NoteListItem } from '@/components/notes/note-list-item';
import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Ionicons } from "@/components/ui/ionicons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCreateTask } from "@/hooks/use-create-task";
import { TaskItem } from "../tasks/components/task-item";

import {
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    useSidebar
} from "@/components/ui/sidebar";
import { useCreateNote } from "@/hooks/use-create-note";
import { cn } from "@/lib/utils";
import { ChevronRight, MoreVertical, SquarePen } from "lucide-react";
import { useParams } from "react-router-dom";

interface NotesSidebarProps {
    className?: string;
}

const SORT_OPTIONS: SortType[] = [
    'UPDATED_LAST',
    'UPDATED_FIRST',
    'CREATED_LAST',
    'CREATED_FIRST',
    'NAME_ASC',
    'NAME_DESC',
];

export function NotesSidebar({ className }: NotesSidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { folderId: routeFolderId, noteId: routeNoteId } = useParams();
    const [searchParams] = useSearchParams();
    const { colors } = useAppTheme();
    const { general } = useSettingsStore();

    const {
        notes,
        folders,
        tags,
        getNotesInFolder,
        getFoldersInFolder,
        getFolderById,
        getSortType,
        deleteNote,
        deleteFolder,
        setFolderSortType,
    } = useNotesStore();
    const tasks = useTasksStore((s) => s.tasks);

    const { createAndNavigate: createAndNavigateTask } = useCreateTask();
    const { createAndNavigate: createAndNavigateNote } = useCreateNote();

    const tagId = searchParams.get("tagId");

    // Location awareness: prioritize folderId from search params (browsing context) over route path (note context)
    const currentFolderId = useMemo(() => {
        if (tagId) return undefined;
        const searchFolderId = searchParams.get("folderId");
        if (searchFolderId) return searchFolderId;
        if (routeFolderId && !['root', 'null', 'undefined'].includes(routeFolderId)) return routeFolderId;
        return undefined;
    }, [routeFolderId, searchParams, tagId]);

    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
    const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

    const currentFolder = currentFolderId
        ? getFolderById(currentFolderId)
        : null;
    const currentSortType = getSortType(currentFolderId ?? null);

    // Resizable width
    const [width, setWidth] = useState(() => {
        const saved = localStorage.getItem("notes-sidebar-width");
        return saved ? parseInt(saved, 10) : 220;
    });
    const [isResizing, setIsResizing] = useState(false);
    const startXRef = useRef<number>(0);
    const startWidthRef = useRef<number>(0);

    const startResizing = useCallback((e: React.MouseEvent) => {
        setIsResizing(true);
        startXRef.current = e.clientX;
        startWidthRef.current = width;
    }, [width]);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
        localStorage.setItem("notes-sidebar-width", width.toString());
    }, [width]);

    const resize = useCallback(
        (e: MouseEvent) => {
            if (isResizing) {
                const deltaX = e.clientX - startXRef.current;
                let newWidth;

                if (general.appDirection === 'rtl') {
                    newWidth = startWidthRef.current - deltaX;
                } else {
                    newWidth = startWidthRef.current + deltaX;
                }

                if (newWidth > 180 && newWidth < 450) {
                    setWidth(newWidth);
                }
            }
        },
        [isResizing, general.appDirection]
    );

    const navigateSmart = useCallback((path: string) => {
        if (location.pathname + location.search === path) return;

        const isTargetContent = path.startsWith('/notes') && !path.startsWith('/notes/trash');
        const isCurrentContent = location.pathname.startsWith('/notes') && !location.pathname.startsWith('/notes/trash');

        navigate(path, { replace: !isTargetContent && !isCurrentContent });
    }, [location, navigate]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener("mousemove", resize);
            window.addEventListener("mouseup", stopResizing);
        } else {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        }
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    // Browsing data
    const browseFolders = useMemo(() => {
        if (tagId) return [];
        const list = getFoldersInFolder(currentFolderId ?? null);
        return sortFolders(
            list.filter((f) => !f.isSystem),
            currentSortType,
        ) as Folder[];
    }, [folders, currentFolderId, currentSortType, tagId]);

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

    const { pinnedNotes, unpinnedNotes } = useMemo(() => {
        return {
            pinnedNotes: browseNotes.filter((n) => n.isPinned),
            unpinnedNotes: browseNotes.filter((n) => !n.isPinned),
        };
    }, [browseNotes]);

    const folderTasks = useMemo(() => {
        if (!currentFolderId) return [];
        return tasks.filter(t => t.folderId === currentFolderId && !t.completed);
    }, [tasks, currentFolderId]);

    const handleFolderPress = (folderId: string) => {
        const targetPath = `/notes?folderId=${folderId}`;
        navigateSmart(targetPath);
    };

    const handleNotePress = (note: NoteMetadata) => {
        const folderId = note.folderId || "root";
        const targetPath = `/notes/${folderId}/${note.id}`;
        navigateSmart(targetPath);
    };

    const handleCreateNote = async () => {
        await createAndNavigateNote(currentFolderId ?? "", tagId ?? undefined);
    };

    const handleEditFolder = useCallback((folder: Folder) => {
        setEditingFolder(folder);
        setNewFolderParentId(null);
        setIsEditModalOpen(true);
    }, []);

    const handleCreateFolder = useCallback(() => {
        setEditingFolder(null); // Create mode
        setNewFolderParentId(null); // Use current directory as default
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
        createAndNavigateTask({ folderId: folder.id });
    }, [createAndNavigateTask]);

    const handleCreateTaskForCurrentFolder = useCallback(() => {
        createAndNavigateTask({ folderId: currentFolderId || undefined });
    }, [createAndNavigateTask, currentFolderId]);

    const handleDeleteTask = useCallback((taskId: string) => {
        useTasksStore.getState().deleteTask(taskId);
    }, []);

    const currentTag = useMemo(() => tags.find(t => t.id === tagId), [tags, tagId]);

    const isTrash = currentFolderId === TRASH_FOLDER_ID;
    const isDaily = currentFolderId === DAILY_NOTES_FOLDER_ID;

    const headerTitle = useMemo(() => {
        if (tagId) return currentTag?.name ?? "Tag";
        if (isTrash) return "Trash";
        if (isDaily) return "Daily Notes";
        return currentFolder ? currentFolder.name : "Notes";
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

    const { open } = useSidebar();

    return (
        <aside
            data-state={open ? "expanded" : "collapsed"}
            dir={general.appDirection}
            className={cn(
                "group/sidebar relative flex h-full flex-col bg-sidebar overflow-hidden shrink-0",
                general.appDirection === 'rtl' ? "border-l" : "border-r",
                "border-border select-none",
                !isResizing && "transition-all duration-300 ease-in-out",
                className
            )}
            style={{ width: open ? `${width}px` : 0 }}
        >
            <div className="flex h-full flex-col shrink-0" style={{ width: `${width}px` }}>
                {/* Resize Handle */}
                {open && (
                    <div
                        onMouseDown={startResizing}
                        className={cn(
                            "absolute top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 transition-colors z-50",
                            general.appDirection === 'rtl' ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
                        )}
                    />
                )}
                {/* Header */}
                <SidebarHeader className="h-12 border-b border-border/50 px-2 py-0 justify-center overflow-hidden">
                    <TooltipProvider>
                        <div className="flex items-center justify-between gap-1 w-full">
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                {tagId && currentTag ? (
                                    <Ionicons name={headerIcon} color={headerColor} size={16} />

                                ) : (
                                    <div style={{ backgroundColor: headerColor + "30" }} className="flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors shadow-sm">
                                        <Ionicons name={headerIcon} color={headerColor} size={16} />
                                    </div>
                                )}
                                <h2 className="text-sm font-bold tracking-tight truncate">{headerTitle}</h2>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                                {!isTrash && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0 text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors"
                                                onClick={handleCreateNote}
                                            >
                                                <SquarePen className="h-5 w-5" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-[10px] font-bold">New Note</TooltipContent>
                                    </Tooltip>
                                )}
                                {!isDaily && !isTrash && !tagId && (
                                    <DropdownMenu>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 shrink-0 text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors"
                                                    >
                                                        <MoreVertical className="h-5 w-5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="text-[10px] font-bold">Actions</TooltipContent>
                                        </Tooltip>
                                        <DropdownMenuContent align="end" className="w-52">
                                            <DropdownMenuItem onClick={handleCreateFolder} className="gap-2 cursor-pointer">
                                                <Ionicons name="folder-outline" size={16} />
                                                <span>New Folder</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={handleCreateTaskForCurrentFolder} className="gap-2 cursor-pointer">
                                                <Ionicons name="checkmark-circle-outline" size={16} />
                                                <span>New Task</span>
                                            </DropdownMenuItem>

                                            <DropdownMenuSeparator />

                                            <DropdownMenuSub>
                                                <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                                                    <Ionicons name="funnel-outline" size={16} />
                                                    <span>Sort by</span>
                                                </DropdownMenuSubTrigger>
                                                <DropdownMenuSubContent className="w-52">
                                                    {SORT_OPTIONS.map((option) => (
                                                        <DropdownMenuItem
                                                            key={option}
                                                            className={cn(
                                                                "flex items-center justify-between cursor-pointer",
                                                                currentSortType === option && "bg-primary/10 text-primary font-medium"
                                                            )}
                                                            onClick={() => setFolderSortType(currentFolderId ?? null, option)}
                                                        >
                                                            <span>{getSortTypeLabel(option)}</span>
                                                            {currentSortType === option && (
                                                                <Ionicons name="checkmark" size={14} />
                                                            )}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}

                            </div>
                        </div>
                    </TooltipProvider>
                </SidebarHeader>

                {/* Content */}
                <SidebarContent className="px-0 gap-0 compact-scrollbar">
                    {/* Folders section */}
                    {browseFolders.length > 0 && (
                        <SidebarGroup className="px-2 py-1.5">
                            <SidebarGroupContent>
                                <SidebarMenu className="gap-1">
                                    {browseFolders.map((folder) => (
                                        <SidebarMenuItem key={folder.id}>
                                            <FolderListItem
                                                folder={folder}
                                                onEdit={handleEditFolder}
                                                onDelete={setFolderToDelete}
                                                onCreateSubFolder={handleCreateSubFolder}
                                                onCreateTask={handleCreateTask}
                                                onClick={() => handleFolderPress(folder.id)}
                                                isActive={currentFolderId === folder.id}
                                            />
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    )}

                    {pinnedNotes.length > 0 && (
                        <div className="flex items-center text-[10px] text-muted-foreground/80 uppercase tracking-wider justify-start gap-0.5 px-2 py-1 ">
                            <Ionicons name='pin-outline' size={12} />
                            <p>Pinned </p>
                        </div>
                    )}

                    {/* Pinned section */}
                    {pinnedNotes.length > 0 && (
                        <SidebarGroup className="px-2 py-1.5">
                            <SidebarGroupContent>
                                <SidebarMenu className="gap-1">
                                    {pinnedNotes.map((note) => (
                                        <SidebarMenuItem key={note.id}>
                                            <NoteListItem
                                                note={note}
                                                onDelete={() => deleteNote(note.id)}
                                                onClick={() => handleNotePress(note)}
                                                isActive={routeNoteId === note.id}
                                                isInList={true}
                                            />
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    )}

                    {unpinnedNotes.length > 0 && (
                        <div className="flex items-center text-[10px] text-muted-foreground/80 uppercase tracking-wider justify-start gap-0.5 px-2 py-1 ">
                            <Ionicons name='document-text-outline' size={12} />
                            <p>Notes</p>
                        </div>
                    )}

                    {/* Notes section */}
                    {unpinnedNotes.length > 0 && (
                        <SidebarGroup className="px-2 py-1.5">
                            <SidebarGroupContent>
                                <SidebarMenu className="gap-1">
                                    {unpinnedNotes.map((note) => (
                                        <SidebarMenuItem key={note.id}>
                                            <NoteListItem
                                                note={note}
                                                onDelete={() => deleteNote(note.id)}
                                                onClick={() => handleNotePress(note)}
                                                isActive={routeNoteId === note.id}
                                                isInList={true}
                                            />
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    )}

                    {/* Empty state */}
                    {browseFolders.length === 0 && browseNotes.length === 0 && folderTasks.length === 0 && (
                        <div className="flex  flex-col items-center gap-2 py-12 text-muted-foreground">
                            <Ionicons name="folder-open" size={40} className="text-border" />
                            <p className="text-sm font-medium text-center">This folder is empty</p>
                            <p className="text-xs text-center">Create a note or folder to get started</p>
                        </div>
                    )}
                </SidebarContent>

                {/* Tasks section - Fixed at bottom */}
                {folderTasks.length > 0 && (
                    <div className="px-0 pb-2 border-t max-h-50 overflow-y-auto compact-scrollbar">
                        <Collapsible defaultOpen className="group/collapsible">
                            <SidebarGroup className="px-2 py-1.5">
                                <SidebarGroupLabel asChild className="h-7 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 w-full px-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-sm cursor-pointer transition-colors">
                                    <CollapsibleTrigger>
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <Ionicons name="checkmark-circle-outline" size={17} />
                                                <span>Active Tasks</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium lowercase text-muted-foreground/40">{folderTasks.length}</span>
                                                <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                                            </div>
                                        </div>
                                    </CollapsibleTrigger>
                                </SidebarGroupLabel>
                                <CollapsibleContent>
                                    <SidebarGroupContent>
                                        <SidebarMenu className="gap-1">
                                            {folderTasks.map((task) => (
                                                <SidebarMenuItem key={task.id}>
                                                    <TaskItem
                                                        task={task}
                                                        onClick={() => navigate(`/task/${task.id}`, { state: { background: location } })}
                                                        onDelete={() => handleDeleteTask(task.id)}
                                                        hideFolder={true}
                                                        isCompact={true}
                                                    />
                                                </SidebarMenuItem>
                                            ))}
                                        </SidebarMenu>
                                    </SidebarGroupContent>
                                </CollapsibleContent>
                            </SidebarGroup>
                        </Collapsible>
                    </div>
                )}
            </div>


            {/* Modals */}
            <FolderEditModal
                open={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                folder={editingFolder}
                defaultParentId={newFolderParentId || currentFolderId}
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
        </aside>
    );
}


