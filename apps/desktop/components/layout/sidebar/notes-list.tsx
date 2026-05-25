import { ConfirmDialog } from "@/components/custom-ui/confirm-dialog";
import { LocationPickerModal } from "@/components/location-picker-modal";
import { NoteListItem } from "@/components/notes/note-list-item";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NoteMetadata, useNotesStore, useSettingsStore } from "@annota/core";
import { ChevronRight, FileText, FolderEdit, Pin, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
}: NotesListProps) {
    const bulkDeleteNotes = useNotesStore(state => state.bulkDeleteNotes);
    const bulkMoveNotes = useNotesStore(state => state.bulkMoveNotes);
    const { general } = useSettingsStore();
    const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Separate pinned and regular notes
    const pinnedNotes = notes.filter(n => n.isPinned);
    const regularNotes = notes.filter(n => !n.isPinned);

    // Collapsible states with localStorage persistence
    const [isPinnedOpen, setIsPinnedOpen] = useState(() => {
        const saved = localStorage.getItem("sidebar_pinned_notes_open");
        return saved !== null ? saved === "true" : true;
    });

    const [isRegularOpen, setIsRegularOpen] = useState(() => {
        const saved = localStorage.getItem("sidebar_regular_notes_open");
        return saved !== null ? saved === "true" : true;
    });

    useEffect(() => {
        localStorage.setItem("sidebar_pinned_notes_open", String(isPinnedOpen));
    }, [isPinnedOpen]);

    useEffect(() => {
        localStorage.setItem("sidebar_regular_notes_open", String(isRegularOpen));
    }, [isRegularOpen]);

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

                <div data-tauri-drag-region className="flex-1 overflow-y-auto premium-scrollbar mt-0.5">
                    {notes.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                            <p className="text-xs text-muted-foreground italic">No notes here</p>
                        </div>
                    ) : (!isTrash && pinnedNotes.length > 0) ? (
                        <div className="flex flex-col  min-h-full pb-4">
                            {/* Pinned Section */}
                            <Collapsible open={isPinnedOpen} onOpenChange={setIsPinnedOpen}>
                                <div className="px-1">
                                    <SidebarGroupLabel asChild className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                        <CollapsibleTrigger className="flex w-full items-center gap-2 hover:bg-sidebar-accent/50 px-2 py-1 rounded transition-colors group/trigger">
                                            <Pin size={11} className="text-muted-foreground/60 shrink-0" />
                                            <span className="flex-1 text-start">Pinned</span>
                                            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono font-medium leading-none">
                                                {pinnedNotes.length}
                                            </span>
                                            <ChevronRight
                                                size={11}
                                                className={cn(
                                                    "transition-transform text-muted-foreground/50 group-hover/trigger:text-muted-foreground",
                                                    general?.appDirection === 'rtl'
                                                        ? (isPinnedOpen ? "rotate-90" : "rotate-180")
                                                        : (isPinnedOpen && "rotate-90")
                                                )}
                                            />
                                        </CollapsibleTrigger>
                                    </SidebarGroupLabel>
                                    <CollapsibleContent className="mt-1">
                                        <SidebarMenu className="gap-0.5 px-0.5">
                                            {pinnedNotes.map((note) => (
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
                                                    />
                                                </SidebarMenuItem>
                                            ))}
                                        </SidebarMenu>
                                    </CollapsibleContent>
                                </div>
                            </Collapsible>

                            {/* Regular Notes Section */}
                            <Collapsible open={isRegularOpen} onOpenChange={setIsRegularOpen}>
                                <div className="px-1">
                                    <SidebarGroupLabel asChild className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                        <CollapsibleTrigger className="flex w-full items-center gap-2 hover:bg-sidebar-accent/50 px-2 py-1 rounded transition-colors group/trigger">
                                            <FileText size={11} className="text-muted-foreground/60 shrink-0" />
                                            <span className="flex-1 text-start">Notes</span>
                                            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono font-medium leading-none">
                                                {regularNotes.length}
                                            </span>
                                            <ChevronRight
                                                size={11}
                                                className={cn(
                                                    "transition-transform text-muted-foreground/50 group-hover/trigger:text-muted-foreground",
                                                    general?.appDirection === 'rtl'
                                                        ? (isRegularOpen ? "rotate-90" : "rotate-180")
                                                        : (isRegularOpen && "rotate-90")
                                                )}
                                            />
                                        </CollapsibleTrigger>
                                    </SidebarGroupLabel>
                                    <CollapsibleContent className="mt-1">
                                        <SidebarMenu data-tauri-drag-region className="gap-0.5 px-0.5">
                                            {regularNotes.length === 0 ? (
                                                <div className="px-4 py-4 text-center">
                                                    <p className="text-xs text-muted-foreground/70 italic">No other notes</p>
                                                </div>
                                            ) : (
                                                regularNotes.map((note) => (
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
                                                        />
                                                    </SidebarMenuItem>
                                                ))
                                            )}
                                        </SidebarMenu>
                                    </CollapsibleContent>
                                </div>
                            </Collapsible>
                        </div>
                    ) : (
                        // If no pinned notes exist, render a clean, unified list with no section headers
                        <SidebarMenu data-tauri-drag-region className="gap-0.5 min-h-full px-1.5">
                            {notes.map((note) => (
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

