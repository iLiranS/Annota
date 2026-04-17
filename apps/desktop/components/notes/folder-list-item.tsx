import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Ionicons } from "@/components/ui/ionicons";
import { cn } from "@/lib/utils";
import { Folder, useNotesStore } from "@annota/core";
import { Slot } from "@radix-ui/react-slot";
import { useCallback } from "react";

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

export function FolderListItemContent({ folder, isActive, searchQuery }: { folder: Folder, isActive?: boolean, searchQuery?: string }) {
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
        <>
            <FolderIcon
                folder={folder}
                isActive={isActive}
                className="group-hover/folder:bg-background/50"
            />
            <span className="truncate font-medium">
                <Highlight text={folder.name} query={searchQuery} />
            </span>
        </>
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

    ...props
}: FolderListItemProps) {
    const { restoreFolder, permanentlyDeleteFolder } = useNotesStore();

    const handleRestoreFolder = useCallback(async () => {
        await restoreFolder(folder.id);
    }, [folder.id, restoreFolder]);

    const handlePermanentlyDelete = useCallback(async () => {
        await permanentlyDeleteFolder(folder.id);
    }, [folder.id, permanentlyDeleteFolder]);

    const Comp = asChild ? Slot : "button";

    if (folder.isSystem) {
        return (
            <Comp
                type="button"
                onClick={onClick}
                className={cn(
                    !asChild && "flex w-full group/item items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10",
                    "active:bg-primary/10",
                    className
                )}
                {...(props as any)}
            >
                {asChild ? children : <FolderListItemContent folder={folder} isActive={isActive} searchQuery={searchQuery} />}

            </Comp>
        );
    }

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <Comp
                    type="button"
                    onClick={onClick}
                    className={cn(
                        !asChild && "flex w-full group/item items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10",
                        "active:bg-primary/10",
                        className
                    )}
                    {...(props as any)}
                >
                    {asChild ? children : <FolderListItemContent folder={folder} isActive={isActive} searchQuery={searchQuery} />}

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
                        {onCreateNote && (
                            <ContextMenuItem onSelect={() => onCreateNote(folder)} className="gap-2">
                                <Ionicons name="document-outline" size={16} />
                                <span>New Note</span>
                            </ContextMenuItem>
                        )}

                        {onCreateTask && (
                            <ContextMenuItem onSelect={() => onCreateTask(folder)} className="gap-2">
                                <Ionicons name="checkmark-circle-outline" size={16} />
                                <span>New Task</span>
                            </ContextMenuItem>
                        )}

                        {onCreateSubFolder && (
                            <ContextMenuItem onSelect={() => onCreateSubFolder(folder)} className="gap-2">
                                <Ionicons name="folder-outline" size={16} />
                                <span>New Sub Folder</span>
                            </ContextMenuItem>
                        )}

                        <ContextMenuSeparator />

                        <ContextMenuItem onSelect={() => onEdit(folder)} className="gap-2">
                            <Ionicons name="create-outline" size={16} />
                            <span>Edit Folder</span>
                        </ContextMenuItem>

                        {onDelete && (
                            <ContextMenuItem
                                onSelect={() => onDelete(folder)}
                                className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                                <Ionicons name="trash-outline" size={16} />
                                <span>Delete Folder</span>
                            </ContextMenuItem>
                        )}
                    </>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
}
