import { FolderListItem, FolderListItemContent } from "@/components/notes/folder-list-item";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Folder } from "@annota/core";
import { ChevronRight, Folder as FolderIcon } from "lucide-react";
import { useState } from "react";
import { Ionicons } from "../../ui/ionicons";

interface FoldersTreeProps {
    isFoldersOpen: boolean;
    setIsFoldersOpen: (open: boolean) => void;
    onNavigate: (id: string) => void;
    onEdit: (folder: Folder) => void;
    onDelete: (folder: Folder) => void;
    onCreateSubFolder: (parent: Folder) => void;
    onCreateNote: (folderId: string) => void;
    getFoldersInFolder: (id: string | null) => Folder[];
    general: any;
    currentFolderId: string | null;
}

export function FoldersTree({
    isFoldersOpen,
    setIsFoldersOpen,
    onNavigate,
    onEdit,
    onDelete,
    onCreateSubFolder,
    onCreateNote,
    getFoldersInFolder,
    general,
    currentFolderId
}: FoldersTreeProps) {
    const rootFolders = getFoldersInFolder(currentFolderId).filter(f => !f.isSystem);

    return (
        <Collapsible
            open={isFoldersOpen}
            onOpenChange={setIsFoldersOpen}
        >
            <SidebarGroup className="py-1">
                <SidebarGroupLabel asChild className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    <CollapsibleTrigger className="flex w-full items-center gap-2 hover:bg-sidebar-accent/50 px-2 py-1 rounded">
                        <FolderIcon size={12} className="shrink-0" />
                        <span className="flex-1 text-start">Folders</span>
                        <ChevronRight size={12} className={cn("transition-transform", general?.appDirection === 'rtl' ? (isFoldersOpen ? "rotate-90" : "rotate-180") : (isFoldersOpen && "rotate-90"))} />
                    </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                    <SidebarMenu className="px-1 mt-1 max-h-[160px] overflow-y-auto compact-scrollbar">
                        {rootFolders.map((folder) => (
                            <FolderTreeItem
                                key={folder.id}
                                folder={folder}
                                general={general}
                                onNavigate={onNavigate}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onCreateSubFolder={onCreateSubFolder}
                                onCreateNote={() => onCreateNote(folder.id)}
                                getFoldersInFolder={getFoldersInFolder}
                            />
                        ))}
                    </SidebarMenu>
                </CollapsibleContent>
            </SidebarGroup>
        </Collapsible>
    );
}

function FolderTreeItem({ folder, onNavigate, onEdit, onDelete, onCreateSubFolder, onCreateNote, general, getFoldersInFolder }: any) {
    const children = getFoldersInFolder(folder.id).filter((f: any) => !f.isSystem);
    const hasChildren = children.length > 0;
    const [isOpen, setIsOpen] = useState(() => localStorage.getItem(`sidebar_folder_open_${folder.id}`) === "true");

    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        const next = !isOpen;
        setIsOpen(next);
        localStorage.setItem(`sidebar_folder_open_${folder.id}`, String(next));
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <SidebarMenuItem className="group/folder">
                <FolderListItem
                    asChild
                    folder={folder}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onCreateSubFolder={onCreateSubFolder}
                    onCreateNote={onCreateNote}
                >
                    <SidebarMenuButton onClick={() => onNavigate(folder.id)} className="h-8 pr-12">
                        <FolderListItemContent folder={folder} />
                    </SidebarMenuButton>
                </FolderListItem>
                {hasChildren && (
                    <SidebarMenuAction
                        onClick={toggle}
                        className="opacity-0 group-hover/folder:opacity-100 transition-opacity"
                    >
                        <Ionicons name="chevron-forward" size={12} className={cn("transition-transform", general?.appDirection === 'rtl' ? (isOpen ? "rotate-90" : "rotate-180") : (isOpen && "rotate-90"))} />
                    </SidebarMenuAction>
                )}
                {hasChildren && (
                    <CollapsibleContent>
                        <SidebarMenuSub className="ml-4 border-l border-border/10 pl-2">
                            {children.map((child: any) => (
                                <FolderTreeItem
                                    key={child.id}
                                    folder={child}
                                    general={general}
                                    onNavigate={onNavigate}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onCreateSubFolder={onCreateSubFolder}
                                    onCreateNote={onCreateNote}
                                    getFoldersInFolder={getFoldersInFolder}
                                />
                            ))}
                        </SidebarMenuSub>
                    </CollapsibleContent>
                )}
            </SidebarMenuItem>
        </Collapsible>
    );
}
