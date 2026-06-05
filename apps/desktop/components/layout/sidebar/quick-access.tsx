import { NoteListItem } from "@/components/notes/note-list-item";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { NoteMetadata } from "@annota/core";
import { ChevronRight, Star } from "lucide-react";
import { useEffect, useState } from "react";

interface QuickAccessSectionProps {
    notes: NoteMetadata[];
    onNoteClick: (note: NoteMetadata) => void;
    onDeleteNote: (id: string) => void;
    general?: any;
}

export function QuickAccessSection({ notes, onNoteClick, onDeleteNote, general }: QuickAccessSectionProps) {
    const [isOpen, setIsOpen] = useState(() => {
        const saved = localStorage.getItem("sidebar_quick_access_open");
        return saved !== null ? saved === "true" : true;
    });

    useEffect(() => {
        localStorage.setItem("sidebar_quick_access_open", String(isOpen));
    }, [isOpen]);



    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <SidebarGroup className=" border-t border-sidebar-border/60 p-1">
                <SidebarGroupLabel asChild className="text-[10px]  font-bold uppercase tracking-wider text-muted-foreground/70">
                    <CollapsibleTrigger className="flex w-full items-center gap-2 hover:bg-sidebar-accent px-2 py-1 rounded">
                        <Star size={12} strokeWidth={2.5} className="shrink-0" />
                        <span className="flex-1 text-start min-w-[100px]">Quick Access</span>
                        <ChevronRight size={12} className={cn("transition-transform", general?.appDirection === 'rtl' ? (isOpen ? "rotate-90" : "rotate-180") : (isOpen && "rotate-90"))} />
                    </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                    <SidebarMenu className="px-1 mt-0.5 gap-0.5">
                        {notes.map((note, index) => (
                            <SidebarMenuItem key={note.id}>
                                <NoteListItem
                                    note={note}
                                    onDelete={() => onDeleteNote(note.id)}
                                    onClick={() => onNoteClick(note)}
                                    isInList={true}
                                    isInQuickAccess={true}
                                    forceCompact={true}
                                    isLast={index === notes.length - 1}
                                />
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </CollapsibleContent>
            </SidebarGroup>
        </Collapsible>
    );
}
