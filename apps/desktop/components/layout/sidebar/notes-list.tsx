import { ConfirmDialog } from "@/components/custom-ui/confirm-dialog";
import { LocationPickerModal } from "@/components/location-picker-modal";
import { NoteListItem } from "@/components/notes/note-list-item";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarGroup, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NoteMetadata, SortType, useNotesStore } from "@annota/core";
import { CheckSquare, FolderEdit, MoreVertical, SquarePen, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AnnotaIcon } from "../../custom-ui/annota-icon";
import { Ionicons } from "../../ui/ionicons";

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

    // Header Props
    title: string;
    icon: string;
    color: string;
    isDaily: boolean;
    isTrash: boolean;
    currentSortType: SortType | string;
    onSortChange: (type: SortType) => void;
    onCreateNote: () => void;
    onCreateFolder: () => void;
    sortOptions: SortType[];
    getSortTypeLabel: (type: SortType) => string;
    tagId?: string;
    isRoot?: boolean;
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
    title,
    icon,
    color,
    isDaily,
    isTrash,
    currentSortType,
    onSortChange,
    onCreateNote,
    onCreateFolder,
    sortOptions,
    getSortTypeLabel,
    tagId,
    isRoot,
    setSelectionMode,
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
                <div className="flex items-center justify-between gap-2 w-full px-2 py-1 mb-1 border-b border-border/10">
                    <div className="flex items-center gap-2 overflow-hidden flex-1 cursor-default">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                            {isRoot ? (
                                <AnnotaIcon color={color} size={18} />
                            ) : isDaily ? (
                                <Ionicons name="calendar" color={color} size={14} />
                            ) : (
                                <Ionicons name={icon} color={color} size={14} />
                            )}
                        </div>
                        <h2 style={{ color: color }} className="text-xs font-bold tracking-tight truncate uppercase">
                            {title}
                        </h2>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <TooltipProvider>
                            {!isTrash && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 hover:bg-primary/10 transition-colors"
                                            onClick={onCreateNote}
                                            style={{ color: color }}
                                        >
                                            <SquarePen className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px] font-bold">New Note</TooltipContent>
                                </Tooltip>
                            )}
                            {!isTrash && !isDaily && !tagId && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground/60 hover:bg-primary/10 transition-colors"
                                            style={{ color: color }}
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52">
                                        <DropdownMenuItem onClick={onCreateFolder} className="gap-2 cursor-pointer">
                                            <Ionicons name="folder-outline" size={16} />
                                            <span>New Folder</span>
                                        </DropdownMenuItem>

                                        {setSelectionMode && (
                                            <DropdownMenuItem onClick={() => setSelectionMode(!selectionMode)} className="gap-2 cursor-pointer">
                                                <CheckSquare size={16} />
                                                <span>{selectionMode ? "Cancel Selection" : "Select Notes"}</span>
                                            </DropdownMenuItem>
                                        )}

                                        <DropdownMenuSeparator />

                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                                                <Ionicons name="funnel-outline" size={16} />
                                                <span>Sort by</span>
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent className="w-52">
                                                {sortOptions.map((option) => (
                                                    <DropdownMenuItem
                                                        key={option}
                                                        className={cn(
                                                            "flex items-center justify-between cursor-pointer",
                                                            currentSortType === option && "bg-primary/10 text-primary font-medium"
                                                        )}
                                                        onClick={() => onSortChange(option as any)}
                                                    >
                                                        <span>{getSortTypeLabel(option as any)}</span>
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
                        </TooltipProvider>
                    </div>
                </div>

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

                <div data-tauri-drag-region className="flex-1 overflow-y-auto premium-scrollbar px-1 mt-0.5">
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

