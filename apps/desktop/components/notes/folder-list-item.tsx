import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Ionicons } from "@/components/ui/ionicons";
import { cn } from "@/lib/utils";
import { Folder } from "@annota/core";
import { Slot } from "@radix-ui/react-slot";
import { useCallback } from "react";

interface FolderListItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    folder: Folder;
    onEdit: (folder: Folder) => void;
    onDelete?: (folder: Folder) => void;
    asChild?: boolean;
    isActive?: boolean;
}

export function FolderIcon({ folder, className, isActive }: { folder: Folder, className?: string, isActive?: boolean }) {
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

export function FolderListItemContent({ folder, isActive }: { folder: Folder, isActive?: boolean }) {
    return (
        <>
            <FolderIcon
                folder={folder}
                isActive={isActive}
                className="group-hover/folder:bg-background/50"
            />
            <span className="truncate font-medium">{folder.name}</span>
        </>
    );
}

export function FolderListItem({
    folder,
    onClick,
    onEdit,
    onDelete,
    className,
    asChild = false,
    isActive,
    children,
    ...props
}: FolderListItemProps) {
    const handleDelete = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) onDelete(folder);
    }, [folder, onDelete]);

    const Comp = asChild ? Slot : "button";

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <Comp
                    type="button"
                    onClick={onClick}
                    className={cn(
                        !asChild && "flex w-full group/item items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                        isActive && "bg-accent",
                        className
                    )}
                    {...(props as any)}
                >
                    {asChild ? children : <FolderListItemContent folder={folder} isActive={isActive} />}
                </Comp>
            </ContextMenuTrigger>

            <ContextMenuContent className="w-48">
                <ContextMenuItem onClick={() => onEdit(folder)} className="gap-2">
                    <Ionicons name="create-outline" size={16} />
                    <span>Edit Folder</span>
                </ContextMenuItem>

                {onDelete && (
                    <>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                            onClick={handleDelete}
                            className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                            <Ionicons name="trash-outline" size={16} />
                            <span>Delete Folder</span>
                        </ContextMenuItem>
                    </>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
}
