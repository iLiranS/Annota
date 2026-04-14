import { NoteListItem } from "@/components/notes/note-list-item";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { NoteMetadata } from "@annota/core";
import { ChevronRight, Star } from "lucide-react";
import { useEffect, useState } from "react";

interface QuickAccessSectionProps {
    notes: NoteMetadata[];
    activeNoteId?: string;
    onNoteClick: (note: NoteMetadata) => void;
    onDeleteNote: (id: string) => void;
    general?: any;
}

export function QuickAccessSection({ notes, activeNoteId, onNoteClick, onDeleteNote, general }: QuickAccessSectionProps) {
    const [isOpen, setIsOpen] = useState(() => {
        const saved = localStorage.getItem("sidebar_quick_access_open");
        return saved !== null ? saved === "true" : true;
    });

    useEffect(() => {
        localStorage.setItem("sidebar_quick_access_open", String(isOpen));
    }, [isOpen]);

    if (notes.length === 0) return null;

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <SidebarGroup className="py-1">
                <SidebarGroupLabel asChild className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    <CollapsibleTrigger className="flex w-full items-center gap-1.5 hover:bg-sidebar-accent/50 px-2 py-1 rounded">
                        <Star size={12} fill="currentColor" strokeWidth={2.5} className="shrink-0" />
                        <span className="flex-1 text-start">Quick Access</span>
                        <ChevronRight size={10} className={cn("transition-transform text-muted-foreground/50", general?.appDirection === 'rtl' ? (isOpen ? "rotate-90" : "rotate-180") : (isOpen && "rotate-90"))} />
                    </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                    <SidebarMenu className="px-1 mt-0.5 gap-0.5">
                        {notes.map((note) => (
                            <SidebarMenuItem key={note.id}>
                                <NoteListItem
                                    note={note}
                                    onDelete={() => onDeleteNote(note.id)}
                                    onClick={() => onNoteClick(note)}
                                    isActive={activeNoteId === note.id}
                                    isInList={true}
                                    isInQuickAccess={true}
                                    forceCompact={true}
                                />
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </CollapsibleContent>
            </SidebarGroup>
        </Collapsible>
    );
}
