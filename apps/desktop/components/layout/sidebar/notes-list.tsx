import { ConfirmDialog } from "@/components/custom-ui/confirm-dialog";
import { LocationPickerModal } from "@/components/location-picker-modal";
import { NoteListItem } from "@/components/notes/note-list-item";
import { SidebarGroup, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { useCreateNote } from "@/hooks/use-create-note";
import { DAILY_NOTES_FOLDER_ID, NoteMetadata, sortFolders, TRASH_FOLDER_ID, useNavigationStore, useNotesStore, useSettingsStore, type Folder } from "@annota/core";
import { FileText, FolderEdit, Pin, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DAILY_NOTES_FOLDER, FoldersTree, TRASH_FOLDER } from "./folders-tree";

interface NotesListProps {
    notes: NoteMetadata[];
    onNoteClick: (note: NoteMetadata) => void;
    onDeleteNote: (id: string) => void;
    selectionMode?: boolean;
    selectedNoteIds?: string[];
    onToggleSelection?: (noteId: string) => void;
    onClearSelection?: () => void;
    currentFolderId?: string | null;

    isTrash: boolean;
    setSelectionMode?: (mode: boolean) => void;
    onEditFolder?: (folder: Folder) => void;
    onDeleteFolder?: (folder: Folder) => void;
    onCreateSubFolder?: (parentFolder: Folder) => void;
}



export function NotesList({
    notes,
    onNoteClick,
    onDeleteNote,
    selectionMode = false,
    selectedNoteIds = [],
    onToggleSelection,
    onClearSelection,
    currentFolderId,
    isTrash,
    onEditFolder,
    onDeleteFolder,
    onCreateSubFolder,
}: NotesListProps) {
    const navigate = useNavigate();
    const bulkDeleteNotes = useNotesStore(state => state.bulkDeleteNotes);
    const bulkMoveNotes = useNotesStore(state => state.bulkMoveNotes);
    const getFoldersInFolder = useNotesStore(state => state.getFoldersInFolder);
    const getSortType = useNotesStore(state => state.getSortType);
    const setSelectedFolderId = useNavigationStore(state => state.setSelectedFolderId);
    const { createAndNavigate: createNote } = useCreateNote();
    const { general } = useSettingsStore();
    const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Fetch and sort direct child folders
    const currentSortType = getSortType(currentFolderId ?? null);
    const parentId = (currentFolderId === 'root' || !currentFolderId) ? null : currentFolderId;

    const tagId = useNavigationStore(state => state.selectedTagId);
    const isDaily = currentFolderId === DAILY_NOTES_FOLDER_ID;

    const childFolders = useMemo(() => {
        if (isTrash || isDaily || tagId) return [];
        const folderList = getFoldersInFolder(parentId);
        const filtered = sortFolders(folderList, currentSortType).filter(f => !f.isSystem && !f.isDeleted);
        if (parentId === null) {
            // Inject system folders (Daily Notes and Trash) when viewing root
            return [DAILY_NOTES_FOLDER, TRASH_FOLDER, ...filtered];
        }
        return filtered;
    }, [currentFolderId, getFoldersInFolder, parentId, isTrash, isDaily, tagId, currentSortType]);

    // Separate pinned and regular notes
    const pinnedNotes = notes.filter(n => n.isPinned);
    const regularNotes = notes.filter(n => !n.isPinned);



    const handleBulkDelete = async () => {
        try {
            await bulkDeleteNotes(selectedNoteIds);
            toast.success(`Deleted ${selectedNoteIds.length} notes`);
            setIsDeleteModalOpen(false);
            onClearSelection?.();
        } catch (err) {
            toast.error("Failed to delete notes");
        }
    };

    const handleBulkMove = async (folderId: string | null) => {
        if (folderId === currentFolderId) {
            setIsLocationPickerOpen(false);
            onClearSelection?.();
            return;
        }
        try {
            await bulkMoveNotes(selectedNoteIds, folderId);
            toast.success(`Moved ${selectedNoteIds.length} notes`);
            setIsLocationPickerOpen(false);
            onClearSelection?.();
        } catch (err) {
            toast.error("Failed to move notes");
        }
    };


    return (
        <div className="flex-1 flex flex-col min-h-0">
            <SidebarGroup className=" flex flex-col flex-1 min-h-0">

                {selectionMode && (
                    <div className="flex items-center justify-between px-2 py-1 bg-accent/50 rounded-md mx-2 mb-1 border border-border/50">
                        <span className="text-[10px] font-medium font-mono text-muted-foreground whitespace-nowrap">
                            <span className="text-foreground">{selectedNoteIds.length}</span> selected
                        </span>
                        <div className="flex items-center gap-1.5">
                            <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setIsLocationPickerOpen(true); }}
                                            className="hover:bg-primary/20 text-foreground hover:text-primary p-1.5 rounded transition-colors disabled:opacity-50"
                                            disabled={selectedNoteIds.length === 0}
                                        >
                                            <FolderEdit size={12} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px]">Move selected</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setIsDeleteModalOpen(true); }}
                                            className="hover:bg-destructive/10 text-destructive/80 hover:text-destructive p-1.5 rounded transition-colors disabled:opacity-50"
                                            disabled={selectedNoteIds.length === 0}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px]">Delete selected</TooltipContent>
                                </Tooltip>
                                <div className="w-px h-3 bg-border mx-0.5" />
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onClearSelection?.(); }}
                                            className="hover:bg-accent/80 text-muted-foreground hover:text-foreground p-1.5 rounded transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px]">Cancel</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto premium-scrollbar ">
                    {notes.length === 0 && childFolders.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                            <p className="text-xs text-muted-foreground italic">No notes or folders here</p>
                        </div>
                    ) : (childFolders.length > 0 || (!isTrash && pinnedNotes.length > 0)) ? (
                        <div data-tauri-drag-region className="flex flex-col min-h-full pb-4">
                            {/* Folders Section */}
                            <FoldersTree
                                childFolders={childFolders}
                                onNavigate={(id) => {
                                    setSelectedFolderId(id);
                                    if (id === DAILY_NOTES_FOLDER_ID || id === TRASH_FOLDER_ID) {
                                        navigate('/notes');
                                    }
                                }}
                                onEdit={onEditFolder || (() => { })}
                                onDelete={onDeleteFolder}
                                onCreateSubFolder={onCreateSubFolder}
                                onCreateNote={(noteFolderId) => createNote(noteFolderId)}
                                general={general}
                                getFoldersInFolder={getFoldersInFolder}
                                currentFolderId={currentFolderId ?? null}
                            />

                            {/* Pinned Section */}
                            {!isTrash && pinnedNotes.length > 0 && (
                                <div >
                                    {regularNotes.length > 0 && (
                                        <div className="flex items-center gap-1 border-t border-b border-sidebar-border/60  px-2 bg-sidebar  text-[10px] font-semibold text-muted-foreground/60">
                                            <Pin size={10} className="shrink-0 text-muted-foreground/50" />
                                            <span>Pinned</span>
                                        </div>
                                    )}
                                    <SidebarMenu className="gap-0.5 mt-0.5 p-1">
                                        {pinnedNotes.map((note, index) => (
                                            <SidebarMenuItem key={note.id}>
                                                <NoteListItem
                                                    note={note}
                                                    onDelete={() => onDeleteNote(note.id)}
                                                    onClick={() => onNoteClick(note)}
                                                    isInList={true}
                                                    selectionMode={selectionMode}
                                                    isSelected={selectedNoteIds.includes(note.id)}
                                                    onToggleSelection={onToggleSelection}
                                                    hidePinIcon={true}
                                                    isLast={index === pinnedNotes.length - 1}
                                                />
                                            </SidebarMenuItem>
                                        ))}
                                    </SidebarMenu>
                                </div>
                            )}

                            {/* Regular Notes Section */}
                            {regularNotes.length > 0 && (
                                <div >
                                    {!isTrash && pinnedNotes.length > 0 && (
                                        <div className="flex items-center gap-1 bg-sidebar border-t border-b border-sidebar-border/60 px-2  text-[10px] font-semibold text-muted-foreground/60">
                                            <FileText size={10} className="shrink-0 text-muted-foreground/50" />
                                            <span>Notes</span>
                                        </div>
                                    )}
                                    <SidebarMenu data-tauri-drag-region className="gap-0.5 mt-0.5 p-1">
                                        {regularNotes.map((note, index) => (
                                            <SidebarMenuItem key={note.id}>
                                                <NoteListItem
                                                    note={note}
                                                    onDelete={() => onDeleteNote(note.id)}
                                                    onClick={() => onNoteClick(note)}
                                                    isInList={true}
                                                    selectionMode={selectionMode}
                                                    isSelected={selectedNoteIds.includes(note.id)}
                                                    onToggleSelection={onToggleSelection}
                                                    hidePinIcon={true}
                                                    isLast={index === regularNotes.length - 1}
                                                />
                                            </SidebarMenuItem>
                                        ))}
                                    </SidebarMenu>
                                </div>
                            )}
                        </div>
                    ) : (
                        // If no pinned notes exist, render a clean, unified list with no section headers
                        <SidebarMenu data-tauri-drag-region className="gap-0.5 min-h-full p-1">
                            {notes.map((note, index) => (
                                <SidebarMenuItem key={note.id}>
                                    <NoteListItem
                                        note={note}
                                        onDelete={() => onDeleteNote(note.id)}
                                        onClick={() => onNoteClick(note)}
                                        isInList={true}
                                        selectionMode={selectionMode}
                                        isSelected={selectedNoteIds.includes(note.id)}
                                        onToggleSelection={onToggleSelection}
                                        hidePinIcon={true}
                                        isLast={index === notes.length - 1}
                                    />
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    )}
                </div>
            </SidebarGroup>

            {isLocationPickerOpen && (
                <LocationPickerModal
                    open={isLocationPickerOpen}
                    onOpenChange={setIsLocationPickerOpen}
                    onClose={() => setIsLocationPickerOpen(false)}
                    selectedParentId={currentFolderId ?? null}
                    onSelect={handleBulkMove}
                />
            )}

            <ConfirmDialog
                open={isDeleteModalOpen}
                onOpenChange={setIsDeleteModalOpen}
                title="Delete Selected Notes?"
                description={`Are you sure you want to delete ${selectedNoteIds.length} selected notes? They will be moved to the Trash.`}
                onConfirm={handleBulkDelete}
                variant="destructive"
            />
        </div>
    );
}

