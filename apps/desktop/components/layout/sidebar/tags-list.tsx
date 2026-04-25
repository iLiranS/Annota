import { TagEditModal } from "@/components/tags/tag-edit-modal";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { Tag as TagType } from "@annota/core";
import { useNotesStore } from "@annota/core";
import { Edit2, Trash2 } from "lucide-react";
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
    activeTagId,
    onTagClick,
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
            <SidebarGroup className="py-2 px-0">
                <SidebarMenu className="px-1 overflow-y-auto compact-scrollbar">
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
                                        className="h-8 text-xs hover:bg-(--tag-color)/5 active:bg-(--tag-color)/10 "
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
            </SidebarGroup>
        </>
    );
}
