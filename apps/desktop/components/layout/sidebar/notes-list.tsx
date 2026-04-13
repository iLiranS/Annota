import { NoteListItem } from "@/components/notes/note-list-item";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { NoteMetadata } from "@annota/core";
import { ChevronRight, Files } from "lucide-react";
import { useEffect, useState } from "react";

interface NotesListProps {
    notes: NoteMetadata[];
    activeNoteId?: string;
    onNoteClick: (note: NoteMetadata) => void;
    onDeleteNote: (id: string) => void;
    general?: any;
}

export function NotesList({
    notes,
    activeNoteId,
    onNoteClick,
    onDeleteNote,
    general
}: NotesListProps) {
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
                    <CollapsibleTrigger className="flex w-full items-center gap-1.5 hover:bg-sidebar-accent/50 px-2 py-1 rounded">
                        <Files size={12} className="shrink-0" />
                        <span className="flex-1 text-start">Notes</span>
                        <ChevronRight size={10} className={cn("transition-transform text-muted-foreground/50", general?.appDirection === 'rtl' ? (isOpen ? "rotate-90" : "rotate-180") : (isOpen && "rotate-90"))} />
                    </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent className="min-h-0 data-[state=open]:flex-1 data-[state=open]:flex data-[state=open]:flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto premium-scrollbar px-1 mt-0.5">
                        <SidebarMenu className="gap-0.5">
                            {notes.length === 0 ? (
                                <div className="px-4 py-8 text-center">
                                    <p className="text-xs text-muted-foreground italic">No notes here</p>
                                </div>
                            ) : (
                                notes.map((note) => (
                                    <SidebarMenuItem key={note.id}>
                                        <NoteListItem
                                            note={note}
                                            onDelete={() => onDeleteNote(note.id)}
                                            onClick={() => onNoteClick(note)}
                                            isActive={activeNoteId === note.id}
                                            isInList={true}
                                        />
                                    </SidebarMenuItem>
                                ))
                            )}
                        </SidebarMenu>
                    </div>
                </CollapsibleContent>
            </SidebarGroup>
        </Collapsible>
    );
}

