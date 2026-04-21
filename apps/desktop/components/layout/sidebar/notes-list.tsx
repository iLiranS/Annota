import { ConfirmDialog } from "@/components/custom-ui/confirm-dialog";
import { LocationPickerModal } from "@/components/location-picker-modal";
import { NoteListItem } from "@/components/notes/note-list-item";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NoteMetadata, useNotesStore } from "@annota/core";
import { ChevronRight, Files, FolderEdit, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
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
}

export function NotesList({
    notes,
    activeNoteId,
    onNoteClick,
    onDeleteNote,
    general,
    selectionMode = false,
    selectedNoteIds = [],
    onToggleSelection,
    onClearSelection,
    currentFolderId
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

    const [isOpen, setIsOpen] = useState(() => {
        const saved = localStorage.getItem("sidebar_notes_open");
        return saved !== null ? saved === "true" : true;
    });

    useEffect(() => {
        localStorage.setItem("sidebar_notes_open", String(isOpen));
    }, [isOpen]);

    return (
        <Collapsible
            className={cn("min-h-0", isOpen && "flex-1 flex flex-col")}
            open={isOpen}
            onOpenChange={setIsOpen}
        >
            <SidebarGroup className={cn("py-1 flex flex-col min-h-0", isOpen && "flex-1")}>
                <SidebarGroupLabel asChild className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    <CollapsibleTrigger className="flex w-full items-center gap-2 hover:bg-sidebar-accent/50 px-2 py-1 rounded">
                        <Files size={12} className="shrink-0" />
                        <span className="flex-1 text-start">Notes</span>
                        <ChevronRight size={12} className={cn("transition-transform", general?.appDirection === 'rtl' ? (isOpen ? "rotate-90" : "rotate-180") : (isOpen && "rotate-90"))} />
                    </CollapsibleTrigger>
                </SidebarGroupLabel>

                {selectionMode && isOpen && (
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

                <CollapsibleContent className="min-h-0 data-[state=open]:flex-1 data-[state=open]:flex data-[state=open]:flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto premium-scrollbar px-1 mt-0.5">
                        <SidebarMenu className="gap-0.5">
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
                </CollapsibleContent>
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
        </Collapsible>
    );
}

