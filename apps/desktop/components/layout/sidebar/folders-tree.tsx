import { FolderListItem, FolderListItemContent } from "@/components/notes/folder-list-item";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarGroupLabel, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Folder } from "@annota/core";
import { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID } from "@annota/core";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Ionicons } from "@/components/ui/ionicons";

export const DAILY_NOTES_FOLDER: Folder = {
    id: DAILY_NOTES_FOLDER_ID,
    name: "Daily Notes",
    icon: "calendar",
    color: "#8B5CF6",
    sortType: "CREATED_FIRST",
    deletedAt: null,
    originalParentId: null,
    isDirty: false,
    parentId: null,
    isSystem: true,
    isDeleted: false,
    isPermDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
}

export const TRASH_FOLDER: Folder = {
    id: TRASH_FOLDER_ID,
    name: "Trash",
    icon: "trash",
    color: "#EF4444",
    sortType: "CREATED_FIRST",
    deletedAt: null,
    originalParentId: null,
    isDirty: false,
    parentId: null,
    isSystem: true,
    isDeleted: false,
    isPermDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
}

interface FoldersTreeProps {
    childFolders: Folder[];
    onNavigate: (id: string | null) => void;
    onEdit: (folder: Folder) => void;
    onDelete?: (folder: Folder) => void;
    onCreateSubFolder?: (parentFolder: Folder) => void;
    onCreateNote: (folderId: string) => void;
    getFoldersInFolder: (id: string | null) => Folder[];
    general: any;
    currentFolderId: string | null;
    isFoldersOpen: boolean;
    setIsFoldersOpen: (open: boolean) => void;
}

export function FoldersTree({
    childFolders,
    onNavigate,
    onEdit,
    onDelete,
    onCreateSubFolder,
    onCreateNote,
    getFoldersInFolder,
    general,
    currentFolderId,
    isFoldersOpen,
    setIsFoldersOpen,
}: FoldersTreeProps) {
    if (childFolders.length === 0) return null;

    return (
        <Collapsible open={isFoldersOpen} onOpenChange={setIsFoldersOpen}>
            <div className="px-1">
                <SidebarGroupLabel asChild className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    <CollapsibleTrigger className="flex w-full items-center gap-2 hover:bg-sidebar-accent/50 px-2 py-1 rounded transition-colors group/trigger">
                        <Ionicons name="folder-outline" size={11} className="text-muted-foreground/60 shrink-0" />
                        <span className="flex-1 text-start">Folders</span>
                        <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono font-medium leading-none">
                            {childFolders.length}
                        </span>
                        <ChevronRight
                            size={11}
                            className={cn(
                                "transition-transform text-muted-foreground/50 group-hover/trigger:text-muted-foreground",
                                general?.appDirection === 'rtl'
                                    ? (isFoldersOpen ? "rotate-90" : "rotate-180")
                                    : (isFoldersOpen && "rotate-90")
                            )}
                        />
                    </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent className="mt-1">
                    <SidebarMenu className="gap-0.5 px-0.5">
                        {childFolders.map((folder) => (
                            <FolderTreeItem
                                key={folder.id}
                                folder={folder}
                                general={general}
                                onNavigate={onNavigate}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onCreateSubFolder={onCreateSubFolder}
                                onCreateNote={onCreateNote}
                                getFoldersInFolder={getFoldersInFolder}
                                currentFolderId={currentFolderId}
                            />
                        ))}
                    </SidebarMenu>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}

function FolderTreeItem({
    folder,
    onNavigate,
    onEdit,
    onDelete,
    onCreateSubFolder,
    onCreateNote,
    general,
    getFoldersInFolder,
    currentFolderId,
}: {
    folder: Folder;
    onNavigate: (id: string | null) => void;
    onEdit: (folder: Folder) => void;
    onDelete?: (folder: Folder) => void;
    onCreateSubFolder?: (parentFolder: Folder) => void;
    onCreateNote: (folderId: string) => void;
    general: any;
    getFoldersInFolder: (id: string | null) => Folder[];
    currentFolderId: string | null;
}) {
    const isTrash = folder.id === TRASH_FOLDER_ID;
    const isDaily = folder.id === DAILY_NOTES_FOLDER_ID;
    const children = (isTrash || isDaily) ? [] : getFoldersInFolder(folder.id).filter((f: any) => !f.isSystem && !f.isDeleted);
    const hasChildren = children.length > 0;
    const [isOpen, setIsOpen] = useState(() => localStorage.getItem(`sidebar_folder_open_${folder.id}`) === "true");
    const isActive = folder.id === currentFolderId;

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
                    onCreateNote={(f) => onCreateNote(f.id)}
                    isActive={isActive}
                >
                    <SidebarMenuButton
                        onClick={() => onNavigate(folder.id)}
                        className={cn(
                            "h-8 px-2!",
                            "data-[drag-over=true]:transition-none",
                            isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                        )}
                    >
                        <FolderListItemContent folder={folder} isActive={isActive} hideCountOnHover={hasChildren} />
                    </SidebarMenuButton>
                </FolderListItem>
                {hasChildren && (
                    <SidebarMenuAction
                        onClick={toggle}
                        className={cn(
                            "hidden group-hover/folder:flex items-center justify-center p-0 h-6 w-6",
                            "peer-data-[drag-over=true]/menu-button:hidden!",
                            general?.appDirection === 'rtl' ? "right-auto left-0" : "right-0"
                        )}
                    >
                        <ChevronRight size={14} className={cn("text-muted-foreground/70 transition-transform", general?.appDirection === 'rtl' ? (isOpen ? "rotate-90" : "rotate-180") : (isOpen && "rotate-90"))} />
                    </SidebarMenuAction>
                )}
                {hasChildren && (
                    <CollapsibleContent>
                        <SidebarMenuSub className="ms-4 border-s border-border/10 ps-2">
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
                                    currentFolderId={currentFolderId}
                                />
                            ))}
                        </SidebarMenuSub>
                    </CollapsibleContent>
                )}
            </SidebarMenuItem>
        </Collapsible>
    );
}
