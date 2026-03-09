import {
    sortFolders,
    sortNotes,
    useNotesStore,
    type Folder,
    type NoteMetadata
} from "@annota/core";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/custom-ui/confirm-dialog";
import { FolderEditModal } from "@/components/notes/folder-edit-modal";
import { FolderListItem } from '@/components/notes/folder-list-item';
import { NoteListItem } from '@/components/notes/note-list-item';
import { SortDropdown } from "@/components/notes/sort-dropdown";
import { Button } from "@/components/ui/button";
import { Ionicons } from "@/components/ui/ionicons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCreateTask } from "@/hooks/use-create-task";

import {
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarRail,
    useSidebar
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { FolderPlus, SquarePen } from "lucide-react";
import { useParams } from "react-router-dom";

interface NotesSidebarProps {
    className?: string;
}

export function NotesSidebar({ className }: NotesSidebarProps) {
    const navigate = useNavigate();
    const { folderId: routeFolderId, noteId: routeNoteId } = useParams();
    const [searchParams] = useSearchParams();
    const { colors } = useAppTheme();

    const {
        notes,
        folders,
        createNote,
        getNotesInFolder,
        getFoldersInFolder,
        getFolderById,
        getSortType,
        deleteNote,
        deleteFolder,
        setFolderSortType,
    } = useNotesStore();

    const { createAndNavigate: createTask } = useCreateTask();

    // Location awareness: prioritize folderId from route path over search params
    const currentFolderId = useMemo(() => {
        if (routeFolderId && routeFolderId !== "root") return routeFolderId;
        return searchParams.get("folderId") || undefined;
    }, [routeFolderId, searchParams]);

    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
    const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

    const currentFolder = currentFolderId
        ? getFolderById(currentFolderId)
        : null;
    const currentSortType = getSortType(currentFolderId ?? null);

    // Browsing data
    const browseFolders = useMemo(() => {
        const list = getFoldersInFolder(currentFolderId ?? null);
        return sortFolders(
            list.filter((f) => !f.isSystem),
            currentSortType,
        ) as Folder[];
    }, [folders, currentFolderId, currentSortType]);

    const browseNotes = useMemo(() => {
        const list = getNotesInFolder(currentFolderId ?? null);
        return sortNotes(list, currentSortType);
    }, [notes, currentFolderId, currentSortType]);

    const { pinnedNotes, unpinnedNotes } = useMemo(() => {
        return {
            pinnedNotes: browseNotes.filter((n) => n.isPinned),
            unpinnedNotes: browseNotes.filter((n) => !n.isPinned),
        };
    }, [browseNotes]);

    const handleFolderPress = (folderId: string) => {
        navigate(`/notes?folderId=${folderId}`);
    };

    const handleNotePress = (note: NoteMetadata) => {
        const folderId = note.folderId || "root";
        navigate(`/notes/${folderId}/${note.id}`);
    };

    const handleCreateNote = async () => {
        const newNote = await createNote({ folderId: currentFolderId ?? "" });
        navigate(`/notes/${currentFolderId || "root"}/${newNote.id}`);
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
        createTask({ folderId: folder.id });
    }, [createTask]);

    const headerTitle = currentFolder ? currentFolder.name : "Notes";
    const { open } = useSidebar();

    return (
        <aside
            data-state={open ? "expanded" : "collapsed"}
            className={cn(
                "group/sidebar relative flex h-full flex-col border-r border-border bg-card/50 transition-[width,opacity] duration-300 ease-in-out",
                !open ? "w-0 border-none opacity-0 invisible" : "w-(--sidebar-width) opacity-100 visible",
                className
            )}
        >
            {/* Header */}
            <SidebarHeader className="h-12 border-b border-border/50 px-2 py-0 justify-center overflow-hidden">
                <TooltipProvider>
                    <div className="flex items-center justify-between gap-1 w-full">
                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                            <div style={{ backgroundColor: (currentFolder?.color || colors.primary) + "30" }} className="flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors shadow-sm">
                                <Ionicons name={currentFolder ? currentFolder.icon : "documents"} color={currentFolder?.color || colors.primary} size={16} />
                            </div>
                            <h2 className="text-sm font-bold tracking-tight truncate">{headerTitle}</h2>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors"
                                        onClick={handleCreateFolder}
                                    >
                                        <FolderPlus className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px] font-bold">New Folder</TooltipContent>
                            </Tooltip>

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
                        </div>
                    </div>
                </TooltipProvider>
            </SidebarHeader>

            {/* Content */}
            <SidebarContent className="px-2 py-2 gap-0">
                {/* Folders section */}
                {browseFolders.length > 0 && (
                    <SidebarGroup className="px-0">
                        <SidebarGroupLabel className="px-2 h-7 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            <div className="flex items-center gap-2">
                                <Ionicons name="folder-outline" size={17} />
                                <p>Folders</p>
                            </div>
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
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

                {/* Pinned section */}
                {pinnedNotes.length > 0 && (
                    <SidebarGroup className="px-0">
                        <SidebarGroupLabel className="px-2 h-7 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            <div className="flex items-center gap-2">
                                <Ionicons name="pin" size={17} />
                                <p>Pinned</p>
                            </div>
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {pinnedNotes.map((note) => (
                                    <SidebarMenuItem key={note.id}>
                                        <NoteListItem
                                            note={note}
                                            onDelete={() => deleteNote(note.id)}
                                            onClick={() => handleNotePress(note)}
                                            isActive={routeNoteId === note.id}
                                        />
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {/* Notes section */}
                {unpinnedNotes.length > 0 && (
                    <SidebarGroup className="px-0">
                        <SidebarGroupLabel className="px-2 h-7 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            <div className="flex items-center gap-2">
                                <Ionicons name="document-text-outline" size={17} />
                                <p>Notes</p>
                            </div>
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {unpinnedNotes.map((note) => (
                                    <SidebarMenuItem key={note.id}>
                                        <NoteListItem
                                            note={note}
                                            onDelete={() => deleteNote(note.id)}
                                            onClick={() => handleNotePress(note)}
                                            isActive={routeNoteId === note.id}
                                        />
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {/* Empty state */}
                {browseFolders.length === 0 && browseNotes.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                        <Ionicons name="folder-open" size={40} className="text-border" />
                        <p className="text-sm font-medium text-center">This folder is empty</p>
                        <p className="text-xs text-center">Create a note or folder to get started</p>
                    </div>
                )}
            </SidebarContent>

            {/* Sort Controls */}
            <div className="mt-auto px-4 py-2 border-t border-border/10 flex items-center justify-center bg-accent/5">
                <SortDropdown
                    currentSortType={currentSortType}
                    onSortChange={(type) => setFolderSortType(currentFolderId ?? null, type)}
                />
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
            <SidebarRail />
        </aside>
    );
}


