import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Ionicons } from "@/components/ui/ionicons";
import { cn } from "@/lib/utils";
import { Folder, TRASH_FOLDER_ID, useNotesStore, useSettingsStore } from "@annota/core";
import { Slot } from "@radix-ui/react-slot";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

interface FolderListItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    folder: Folder;
    onEdit: (folder: Folder) => void;
    onDelete?: (folder: Folder) => void;
    onCreateSubFolder?: (parentFolder: Folder) => void;
    onCreateTask?: (folder: Folder) => void;
    onCreateNote?: (folder: Folder) => void;
    asChild?: boolean;
    isActive?: boolean;
    searchQuery?: string;
    isSearchResult?: boolean;
}


export function FolderIcon({ folder, className, isActive, }: { folder: Folder, className?: string, isActive?: boolean }) {
    return (
        <div
            className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors shadow-sm",
                className,
                isActive && "bg-background/50"
            )}
            style={{
                backgroundColor: folder.color ? `${folder.color}20` : undefined,
            }}
        >
            <Ionicons
                name={(folder.icon as any) || "folder"}
                size={16}
                style={{ color: folder.color || undefined }}
                className={cn(
                    "transition-transform duration-300 group-hover/item:animate-folder-jump",
                    isActive && "animate-folder-jump"
                )}
            />
        </div>
    );
}

export function FolderListItemContent({ folder, isActive, searchQuery, hideCountOnHover, isSearchResult }: { folder: Folder, isActive?: boolean, searchQuery?: string, hideCountOnHover?: boolean, isSearchResult?: boolean }) {
    const { general } = useSettingsStore();
    const notesCount = useNotesStore(state => {
        if (folder.id === TRASH_FOLDER_ID) {
            return state.notes.filter(n => n.isDeleted).length;
        }
        if (folder.id === 'root') {
            return state.notes.filter(n => !n.folderId && !n.isDeleted).length;
        }
        return state.notes.filter(n => n.folderId === folder.id && !n.isDeleted).length;
    });

    const Highlight = ({ text, query }: { text: string; query?: string }) => {
        if (!query || !text) return <>{text}</>;

        const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
        return (
            <>
                {parts.map((part, i) =>
                    part.toLowerCase() === query.toLowerCase() ? (
                        <span key={i} className="bg-primary/20 text-primary px-0.5 rounded-sm">
                            {part}
                        </span>
                    ) : (
                        part
                    )
                )}
            </>
        );
    };

    return (
        <div className="flex items-center justify-between w-full min-w-0 gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <FolderIcon
                    folder={folder}
                    isActive={isActive}
                    className="group-hover/folder:bg-background/50 group-data-[drag-over=true]/item:bg-emerald-500/20 group-data-[drag-over=true]/item:text-emerald-600"
                />
                <span className="truncate font-medium">
                    <Highlight text={folder.name} query={searchQuery} />
                </span>
            </div>
            {general.showNotesCountInFolder && !isSearchResult && (
                <span className={cn(
                    "text-[10px] tabular-nums font-medium text-muted-foreground/40 transition-opacity duration-200 shrink-0",
                    "group-data-[drag-over=true]/item:hidden",
                    hideCountOnHover && "group-hover/folder:opacity-0 group-hover:pointer-events-none"
                )}>
                    {notesCount}
                </span>
            )}
            <span className={cn(
                "hidden group-data-[drag-over=true]/item:flex",
                "items-center justify-center bg-emerald-500/20 text-emerald-600 rounded drop-shadow-sm h-5 w-5 me-1"
            )}>
                <Ionicons name="add" size={14} className="text-emerald-600" />
            </span>
        </div>
    );
}

export function FolderListItem({
    folder,
    onClick,
    onEdit,
    onDelete,
    onCreateSubFolder,
    onCreateTask,
    onCreateNote,
    className,
    asChild = false,
    isActive,
    searchQuery,
    children,
    isSearchResult = false,

    ...props
}: FolderListItemProps) {
    const { restoreFolder, permanentlyDeleteFolder } = useNotesStore();

    const handleRestoreFolder = useCallback(async () => {
        await restoreFolder(folder.id);
    }, [folder.id, restoreFolder]);

    const handlePermanentlyDelete = useCallback(async () => {
        await permanentlyDeleteFolder(folder.id);
    }, [folder.id, permanentlyDeleteFolder]);

    const [isDragOver, setIsDragOver] = useState(false);
    const dragTimer = useRef<NodeJS.Timeout | null>(null);
    const canDrop = !folder.isSystem && !folder.isDeleted;

    const handleDragOver = (e: React.DragEvent) => {
        if (!canDrop) return;
        if (e.dataTransfer.types.includes("application/annota-note-id")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (!isDragOver) setIsDragOver(true);
            if (dragTimer.current) clearTimeout(dragTimer.current);
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        if (!canDrop) return;
        if (e.dataTransfer.types.includes("application/annota-note-id")) {
            e.preventDefault();
            if (!isDragOver) setIsDragOver(true);
            if (dragTimer.current) clearTimeout(dragTimer.current);
        }
    };

    const handleDragLeave = () => {
        if (!canDrop) return;
        if (dragTimer.current) clearTimeout(dragTimer.current);
        dragTimer.current = setTimeout(() => {
            setIsDragOver(false);
        }, 50);
    };

    const handleDrop = async (e: React.DragEvent) => {
        if (!canDrop) return;
        const noteId = e.dataTransfer.getData("application/annota-note-id");
        if (noteId) {
            e.preventDefault();
            setIsDragOver(false);
            if (dragTimer.current) clearTimeout(dragTimer.current);

            const store = useNotesStore.getState();
            const note = store.notes.find(n => n.id === noteId);
            if (note && note.folderId !== folder.id) {
                await store.updateNoteMetadata(noteId, { folderId: folder.id });
                toast.success(`Moved to ${folder.name}`);
            }
        }
    };

    const Comp = asChild ? Slot : "button";

    const isRoot = folder.id === 'root';
    const isTrash = folder.id === TRASH_FOLDER_ID;

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <Comp
                    type="button"
                    onClick={onClick}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    data-drag-over={isDragOver ? "true" : undefined}
                    className={cn(
                        "group/item transition-all duration-200",
                        !asChild && "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm hover:bg-primary/10",
                        "active:bg-primary/10",
                        isDragOver && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/40 z-10",
                        className
                    )}
                    {...(props as any)}
                >
                    {asChild ? children : <FolderListItemContent folder={folder} isActive={isActive} searchQuery={searchQuery} isSearchResult={isSearchResult} />}
                </Comp>
            </ContextMenuTrigger>

            <ContextMenuContent className="w-48">
                {folder.isDeleted ? (
                    <>
                        <ContextMenuItem
                            onSelect={handleRestoreFolder}
                            className="gap-2 focus:text-emerald-600 focus:bg-emerald-500/10"
                        >
                            <Ionicons name="arrow-undo-outline" size={16} />
                            <span>Restore Folder</span>
                        </ContextMenuItem>
                        <ContextMenuItem
                            onSelect={handlePermanentlyDelete}
                            className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                            <Ionicons name="trash-outline" size={16} />
                            <span>Delete Permanently</span>
                        </ContextMenuItem>
                    </>
                ) : (
                    <>
                        {onCreateNote && !isTrash && (
                            <ContextMenuItem onSelect={() => onCreateNote(isRoot ? { ...folder, id: '' } : folder)} className="gap-2">
                                <Ionicons name="document-outline" size={16} />
                                <span>New Note</span>
                            </ContextMenuItem>
                        )}

                        {onCreateTask && !folder.isSystem && (
                            <ContextMenuItem onSelect={() => onCreateTask(isRoot ? { ...folder, id: '' } : folder)} className="gap-2">
                                <Ionicons name="checkmark-circle-outline" size={16} />
                                <span>New Task</span>
                            </ContextMenuItem>
                        )}

                        {onCreateSubFolder && (!folder.isSystem || isRoot) && (
                            <ContextMenuItem onSelect={() => onCreateSubFolder(isRoot ? { ...folder, id: '' } : folder)} className="gap-2">
                                <Ionicons name="folder-outline" size={16} />
                                <span>New Folder</span>
                            </ContextMenuItem>
                        )}

                        {!folder.isSystem && <ContextMenuSeparator />}

                        {!folder.isSystem && (
                            <ContextMenuItem onSelect={() => onEdit(folder)} className="gap-2">
                                <Ionicons name="create-outline" size={16} />
                                <span>Edit Folder</span>
                            </ContextMenuItem>
                        )}

                        {onDelete && !folder.isSystem && (
                            <ContextMenuItem
                                onSelect={() => onDelete(folder)}
                                className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                                <Ionicons name="trash-outline" size={16} />
                                <span>Delete Folder</span>
                            </ContextMenuItem>
                        )}
                        
                        {isTrash && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground italic text-center">
                                Trash folder
                            </div>
                        )}
                    </>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
}
