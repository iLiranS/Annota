import { FolderListItem, FolderListItemContent } from "@/components/notes/folder-list-item";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { SidebarGroup, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Folder } from "@annota/core";
import { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID } from "@annota/core";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

const DAILY_NOTES_FOLDER: Folder = {
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

const TRASH_FOLDER: Folder = {
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

const ALL_NOTES_FOLDER: Folder = {
    id: "root",
    name: "Annota",
    icon: "documents",
    color: "#6366F1",
    sortType: "UPDATED_LAST",
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
    isFoldersOpen: boolean;
    setIsFoldersOpen: (open: boolean) => void;
    onNavigate: (id: string | null) => void;
    onEdit: (folder: Folder) => void;
    onDelete: (folder: Folder) => void;
    onCreateSubFolder: (parent: Folder) => void;
    onCreateNote: (folderId: string) => void;
    getFoldersInFolder: (id: string | null) => Folder[];
    general: any;
    currentFolderId: string | null;
}

export function FoldersTree({
    onNavigate,
    onEdit,
    onDelete,
    onCreateSubFolder,
    onCreateNote,
    getFoldersInFolder,
    general,
    currentFolderId,
}: FoldersTreeProps) {
    // Always get root folders for global view
    const rootFolders = getFoldersInFolder(null);

    // Add System Folders to the root
    if (!rootFolders.find(f => f.id === TRASH_FOLDER_ID)) {
        rootFolders.unshift(TRASH_FOLDER);
    }
    if (!rootFolders.find(f => f.id === DAILY_NOTES_FOLDER_ID)) {
        rootFolders.unshift(DAILY_NOTES_FOLDER);
    }
    if (!rootFolders.find(f => f.id === "root")) {
        rootFolders.unshift(ALL_NOTES_FOLDER);
    }

    const systemFolders = rootFolders.filter(f => f.isSystem);
    const regularFolders = rootFolders.filter(f => !f.isSystem);

    if (rootFolders.length === 0) return null;

    return (
        <SidebarGroup className={cn("py-2 px-0", general?.appDirection === 'rtl' ? "animate-content-from-right" : "animate-content-from-left")}>
            <SidebarMenu className="px-1 overflow-y-auto compact-scrollbar">
                {systemFolders.map((folder) => (
                    <FolderTreeItem
                        key={folder.id}
                        folder={folder}
                        general={general}
                        onNavigate={onNavigate}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onCreateSubFolder={onCreateSubFolder}
                        onCreateNote={() => onCreateNote(folder.id === 'root' ? '' : folder.id)}
                        getFoldersInFolder={getFoldersInFolder}
                        currentFolderId={currentFolderId}
                    />
                ))}

                {regularFolders.length > 0 && (
                    <div className="h-px bg-border/80 mx-2 my-1 shrink-0 relative">
                    </div>
                )}

                {regularFolders.map((folder) => (
                    <FolderTreeItem
                        key={folder.id}
                        folder={folder}
                        general={general}
                        onNavigate={onNavigate}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onCreateSubFolder={onCreateSubFolder}
                        onCreateNote={() => onCreateNote(folder.id === 'root' ? '' : folder.id)}
                        getFoldersInFolder={getFoldersInFolder}
                        currentFolderId={currentFolderId}
                    />
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}

function FolderTreeItem({ folder, onNavigate, onEdit, onDelete, onCreateSubFolder, onCreateNote, general, getFoldersInFolder, currentFolderId }: any) {
    const children = getFoldersInFolder(folder.id).filter((f: any) => !f.isSystem);
    const hasChildren = children.length > 0;
    const [isOpen, setIsOpen] = useState(() => localStorage.getItem(`sidebar_folder_open_${folder.id}`) === "true");
    const isActive = folder.id === currentFolderId || (folder.id === 'root' && !currentFolderId);

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
