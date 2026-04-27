import { TagEditModal } from "@/components/tags/tag-edit-modal";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Tag as TagType } from "@annota/core";
import { useNotesStore, useSettingsStore } from "@annota/core";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
    const { notes, deleteTag } = useNotesStore();
    const { general } = useSettingsStore();
    const [tagToEdit, setTagToEdit] = useState<TagType | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const tagCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        notes.forEach(note => {
            if (note.isDeleted || note.isPermDeleted) return;
            try {
                const tagIds = JSON.parse(note.tags || '[]') as string[];
                tagIds.forEach(id => {
                    counts[id] = (counts[id] || 0) + 1;
                });
            } catch (e) { }
        });
        return counts;
    }, [notes]);

    const sortedTags = useMemo(() => {
        return [...tags].sort((a, b) => (tagCounts[b.id] || 0) - (tagCounts[a.id] || 0));
    }, [tags, tagCounts]);

    return (
        <>
            <TagEditModal
                open={!!tagToEdit || isCreateModalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setTagToEdit(null);
                        setIsCreateModalOpen(false);
                    }
                }}
                tag={tagToEdit}
            />
            <SidebarGroup className={cn("py-2 px-0", general.appDirection === 'rtl' ? "animate-content-from-right" : "animate-content-from-left")}>
                <SidebarMenu className="px-1 overflow-y-auto compact-scrollbar">
                    <SidebarMenuItem className="">
                        <SidebarMenuButton
                            onClick={() => setIsCreateModalOpen(true)}
                            className="h-8 px-0 text-[11px] font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors justify-start"
                        >
                            <Plus size={14} className="opacity-50" />
                            <span>Create New Tag</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    {sortedTags.length === 0 && (
                        <p className="px-3 py-2 text-[10px] italic text-muted-foreground text-center">No tags yet</p>
                    )}
                    {sortedTags.map((tag) => (
                        <SidebarMenuItem key={tag.id}>
                            <ContextMenu>
                                <ContextMenuTrigger asChild>
                                    <SidebarMenuButton
                                        onClick={() => onTagClick(tag.id)}
                                        isActive={activeTagId === tag.id}
                                        style={{ "--tag-color": tag.color } as React.CSSProperties}
                                        className="h-8 text-xs hover:bg-(--tag-color)/5 active:bg-(--tag-color)/10 flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-2.5 truncate">
                                            <Ionicons name="ellipse" size={10} style={{ color: tag.color }} />
                                            <span style={{ color: tag.color }} className="truncate lowercase font-mono">{tag.name}</span>
                                        </div>
                                        {general.showNotesCountInFolder && (
                                            <span className="text-[9px] font-bold opacity-40 group-hover:opacity-70 transition-opacity float-end tabular-nums">
                                                {tagCounts[tag.id] || 0}
                                            </span>
                                        )}
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
