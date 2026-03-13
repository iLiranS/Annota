import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Ionicons } from "@/components/ui/ionicons";
import { formatRelativeDate } from "@/lib/date-formatter";
import { cn } from "@/lib/utils";
import {
    NoteMetadata,
    useNotesStore,
    useSettingsStore
} from "@annota/core";
import { useCallback, useState } from "react";
import { LocationPickerModal } from "../location-picker-modal";

import { Slot } from "@radix-ui/react-slot";

interface NoteListItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    note: NoteMetadata;
    onDelete?: () => void;
    showDescription?: boolean;
    showTimestamp?: boolean;
    className?: string;
    suffix?: React.ReactNode;
    isActive?: boolean;
    asChild?: boolean;
    children?: React.ReactNode;
    isInList?: boolean;
}

export function NoteListItem({
    note,
    onClick,
    onDelete,
    showDescription = false,
    showTimestamp = false,
    className,
    suffix,
    isActive,
    style,
    asChild,
    children,
    isInList,
    ...props
}: NoteListItemProps) {
    const { updateNoteMetadata, tags } = useNotesStore();
    const { general } = useSettingsStore();
    const isCompact = !showDescription && general.compactMode;

    const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);

    const handleTogglePin = useCallback(async () => {
        await updateNoteMetadata(note.id, { isPinned: !note.isPinned });
    }, [note.id, note.isPinned, updateNoteMetadata]);

    const handleToggleQuickAccess = useCallback(async () => {
        await updateNoteMetadata(note.id, { isQuickAccess: !note.isQuickAccess });
    }, [note.id, note.isQuickAccess, updateNoteMetadata]);

    const handleMoveNote = useCallback(async (targetFolderId: string | null) => {
        await updateNoteMetadata(note.id, { folderId: targetFolderId });
    }, [note.id, updateNoteMetadata]);

    const Comp = asChild ? Slot : "button";

    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <Comp
                        type="button"
                        onClick={onClick}
                        className={cn(
                            !asChild && "group/note flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-accent/50",
                            !asChild && isCompact ? "py-1.5" : "py-2",
                            isActive && "bg-accent",
                            "active:scale-95 relative",
                            className
                        )}
                        style={style}
                        {...props}
                    >
                        {asChild ? (
                            children
                        ) : (
                            <>
                                <div className="flex w-full items-center justify-between gap-2.5">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <p className={cn(
                                            "truncate text-sm font-medium transition-colors",
                                            isActive ? "text-primary" : "text-foreground/90 group-hover/note:text-primary"
                                        )}>
                                            {note.title || "Untitled Note"}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {suffix}
                                        {showTimestamp && note.updatedAt && (
                                            <span className="text-[11px] text-muted-foreground/60">
                                                {formatRelativeDate(note.updatedAt)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {!isCompact && showDescription && note.preview && (
                                    <p className="line-clamp-1 w-full text-[11px] text-muted-foreground/50 leading-tight mt-1">
                                        {note.preview}
                                    </p>
                                )}

                                {(() => {
                                    if (!note.tags || note.tags === '[]') return null;
                                    try {
                                        const tagIds: string[] = JSON.parse(note.tags);
                                        if (tagIds.length === 0) return null;
                                        const noteTags = tagIds.map(id => tags.find(t => t.id === id)).filter(Boolean) as any[];
                                        if (noteTags.length === 0) return null;
                                        return (
                                            <div className="flex gap-1 mt-1 overflow-hidden">
                                                {noteTags.map(t => (
                                                    <span
                                                        key={t.id}
                                                        title={t.name}
                                                        className="px-1.5 py-0.5 rounded text-[9px] font-medium border truncate min-w-[40px] max-w-fit flex-1"
                                                        style={{
                                                            backgroundColor: `${t.color}1A`,
                                                            color: t.color,
                                                            borderColor: `${t.color}40`
                                                        }}
                                                    >
                                                        {t.name}
                                                    </span>
                                                ))}
                                            </div>
                                        );
                                    } catch { return null; }
                                })()}
                            </>
                        )}
                        {isInList && <div className=" h-px absolute bottom-0 w-9/10 mx-auto bg-muted-foreground/15" />}

                    </Comp>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-52">
                    <ContextMenuItem
                        onClick={handleTogglePin}

                    >
                        <Ionicons name={note.isPinned ? "pin" : "pin-outline"} size={16} />
                        <span>{note.isPinned ? "Unpin Note" : "Pin Note"}</span>
                    </ContextMenuItem>

                    <ContextMenuItem
                        onClick={handleToggleQuickAccess}

                    >
                        <Ionicons name={note.isQuickAccess ? "star" : "star-outline"} size={16} />
                        <span>
                            {note.isQuickAccess ? "Remove Quick Access" : "Quick Access"}
                        </span>
                    </ContextMenuItem>

                    <ContextMenuItem
                        onClick={() => setIsLocationPickerOpen(true)}

                    >
                        <Ionicons name="folder-outline" size={16} />
                        <span>Move Note</span>
                    </ContextMenuItem>

                    <ContextMenuSeparator />

                    {onDelete && (
                        <ContextMenuItem
                            onClick={onDelete}
                            className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                            <Ionicons name="trash-outline" size={16} />
                            <span>Delete Note</span>
                        </ContextMenuItem>
                    )}
                </ContextMenuContent>

            </ContextMenu>

            {isLocationPickerOpen && (
                <LocationPickerModal
                    open={isLocationPickerOpen}
                    onOpenChange={setIsLocationPickerOpen}
                    selectedParentId={note.folderId}
                    onSelect={handleMoveNote}
                />
            )}

        </>
    );
}
