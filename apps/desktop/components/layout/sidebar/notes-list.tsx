import { ConfirmDialog } from "@/components/custom-ui/confirm-dialog";
import { LocationPickerModal } from "@/components/location-picker-modal";
import { NoteListItem } from "@/components/notes/note-list-item";
import { SidebarGroup, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NoteMetadata, useNotesStore } from "@annota/core";
import { FolderEdit, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface NotesListProps {
    notes: NoteMetadata[];
    activeNoteId?: string;
    onNoteClick: (note: NoteMetadata) => void;
    onDeleteNote: (id: string) => void;
    general?: any;
    selectionMode?: boolean;
    selectedNoteIds?: string[];
    onToggleSelection?: (noteId: string) => void;
    onClearSelection?: () => void;
    currentFolderId?: string | null;

    isTrash: boolean;
    setSelectionMode?: (mode: boolean) => void;
}

export function NotesList({
    notes,
    activeNoteId,
    onNoteClick,
    onDeleteNote,
    selectionMode = false,
    selectedNoteIds = [],
    onToggleSelection,
    onClearSelection,
    currentFolderId,
}: NotesListProps) {
    const bulkDeleteNotes = useNotesStore(state => state.bulkDeleteNotes);
    const bulkMoveNotes = useNotesStore(state => state.bulkMoveNotes);
    const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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
            <SidebarGroup className="py-1 flex flex-col flex-1 min-h-0">

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

                <div className="flex-1 overflow-y-auto premium-scrollbar  mt-0.5 ">
                    <SidebarMenu data-tauri-drag-region className="gap-0.5 min-h-full">
                        {notes.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <p className="text-xs text-muted-foreground italic">No notes here</p>
                            </div>
                        ) : (
                            <>
                                {notes.filter(n => n.isPinned).map((note) => (
                                    <SidebarMenuItem key={note.id}>
                                        <NoteListItem
                                            note={note}
                                            onDelete={() => onDeleteNote(note.id)}
                                            onClick={() => onNoteClick(note)}
                                            isActive={activeNoteId === note.id}
                                            isInList={true}
                                            selectionMode={selectionMode}
                                            isSelected={selectedNoteIds.includes(note.id)}
                                            onToggleSelection={onToggleSelection}
                                        />
                                    </SidebarMenuItem>
                                ))}

                                {notes.filter(n => !n.isPinned).map((note) => (
                                    <SidebarMenuItem key={note.id}>
                                        <NoteListItem
                                            note={note}
                                            onDelete={() => onDeleteNote(note.id)}
                                            onClick={() => onNoteClick(note)}
                                            isActive={activeNoteId === note.id}
                                            isInList={true}
                                            selectionMode={selectionMode}
                                            isSelected={selectedNoteIds.includes(note.id)}
                                            onToggleSelection={onToggleSelection}
                                        />
                                    </SidebarMenuItem>
                                ))}
                            </>
                        )}
                    </SidebarMenu>
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

