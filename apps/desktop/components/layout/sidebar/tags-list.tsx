import { TagEditModal } from "@/components/tags/tag-edit-modal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Tag as TagType } from "@annota/core";
import { useNotesStore } from "@annota/core";
import { ChevronRight, Edit2, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import { Ionicons } from "../../ui/ionicons";

interface TagsListProps {
    tags: TagType[];
    isTagsOpen: boolean;
    setIsTagsOpen: (open: boolean) => void;
    activeTagId: string | null;
    onTagClick: (id: string) => void;
    general?: any;
}

export function TagsList({
    tags,
    isTagsOpen,
    setIsTagsOpen,
    activeTagId,
    onTagClick,
    general
}: TagsListProps) {
    const { deleteTag } = useNotesStore();
    const [tagToEdit, setTagToEdit] = useState<TagType | null>(null);

    return (
        <>
            <TagEditModal
                open={!!tagToEdit}
                onOpenChange={(open) => !open && setTagToEdit(null)}
                tag={tagToEdit}
            />
            <Collapsible
                open={isTagsOpen}
                onOpenChange={setIsTagsOpen}
            >
                <SidebarGroup className="py-1">
                    <SidebarGroupLabel asChild className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                        <CollapsibleTrigger className="flex w-full items-center gap-2 hover:bg-sidebar-accent/50 px-2 py-1 rounded">
                            <Tag size={12} className="shrink-0" />
                            <span className="flex-1 text-start">Tags</span>
                            <ChevronRight size={12} className={cn("transition-transform", general?.appDirection === 'rtl' ? (isTagsOpen ? "rotate-90" : "rotate-180") : (isTagsOpen && "rotate-90"))} />
                        </CollapsibleTrigger>
                    </SidebarGroupLabel>
                    <CollapsibleContent>
                        <SidebarMenu className="px-1 mt-1 max-h-[160px] overflow-y-auto compact-scrollbar">
                            {tags.length === 0 && (
                                <p className="px-3 py-2 text-[10px] italic text-muted-foreground">No tags</p>
                            )}
                            {tags.map((tag) => (
                                <SidebarMenuItem key={tag.id}>
                                    <ContextMenu>
                                        <ContextMenuTrigger asChild>
                                            <SidebarMenuButton
                                                onClick={() => onTagClick(tag.id)}
                                                isActive={activeTagId === tag.id}
                                                style={{ "--tag-color": tag.color } as React.CSSProperties}
                                                className="h-7 text-xs hover:bg-(--tag-color)/5 active:bg-(--tag-color)/10 "
                                            >
                                                <Ionicons name="ellipse" size={10} style={{ color: tag.color }} />
                                                <span style={{ color: tag.color }} className="truncate lowercase font-mono">{tag.name}</span>
                                            </SidebarMenuButton>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent className="w-40">
                                            <ContextMenuItem onClick={() => setTagToEdit(tag)}>
                                                <Edit2 className="mr-2 h-3.5 w-3.5" />
                                                <span>Update Tag</span>
                                            </ContextMenuItem>
                                            <ContextMenuItem
                                                onClick={() => deleteTag(tag.id)}
                                                className="text-destructive focus:text-destructive"
                                            >
                                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                <span>Delete Tag</span>
                                            </ContextMenuItem>
                                        </ContextMenuContent>
                                    </ContextMenu>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </CollapsibleContent>
                </SidebarGroup>
            </Collapsible>
        </>
    );
}
