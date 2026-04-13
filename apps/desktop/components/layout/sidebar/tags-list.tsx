import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Tag as TagType } from "@annota/core";
import { ChevronRight, Tag } from "lucide-react";
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
    return (
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
                                <SidebarMenuButton
                                    onClick={() => onTagClick(tag.id)}
                                    isActive={activeTagId === tag.id}
                                    style={{ "--tag-color": tag.color } as React.CSSProperties}
                                    className="h-7 text-xs hover:bg-(--tag-color)/5 active:bg-(--tag-color)/10 active:scale-95"
                                >
                                    <Ionicons name="ellipse" size={10} style={{ color: tag.color }} />
                                    <span style={{ color: tag.color }} className="truncate lowercase font-mono">{tag.name}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </CollapsibleContent>
            </SidebarGroup>
        </Collapsible>
    );
}
