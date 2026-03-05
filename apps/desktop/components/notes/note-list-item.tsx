import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Ionicons } from "@/components/ui/ionicons";
import { formatRelativeDate } from "@/lib/date-formatter";
import {
    NoteMetadata,
    useNotesStore,
    useSettingsStore
} from "@annota/core";
import { useCallback, useState } from "react";
import { LocationPickerModal } from "../location-picker-modal";

interface NoteListItemProps {
    note: NoteMetadata;
    onClick: () => void;
    onDelete?: () => void;
    showDescription?: boolean;
    showTimestamp?: boolean;
}

export function NoteListItem({
    note,
    onClick,
    onDelete,
    showDescription = true,
    showTimestamp = false,
}: NoteListItemProps) {
    const { updateNoteMetadata } = useNotesStore();
    const { general } = useSettingsStore();
    const isCompact = general.compactMode;

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

    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <button
                        type="button"
                        onClick={onClick}
                        className={`
                            group flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-accent
                            ${isCompact ? "py-1.5" : "py-2"}
                        `}
                    >
                        <div className="flex w-full items-center justify-between gap-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                                <Ionicons
                                    name="document-text"
                                    size={16}
                                    className="text-primary shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                                />
                                <p className="truncate text-sm font-medium text-foreground/90 group-hover:text-primary transition-colors">
                                    {note.title || "Untitled Note"}
                                </p>
                            </div>

                            {showTimestamp && note.updatedAt && (
                                <span className="shrink-0 text-[11px] text-muted-foreground/60">
                                    {formatRelativeDate(note.updatedAt)}
                                </span>
                            )}
                        </div>

                        {!isCompact && showDescription && note.preview && (
                            <p className="line-clamp-1 w-full pl-6 text-[11px] text-muted-foreground/50 leading-tight">
                                {note.preview}
                            </p>
                        )}
                    </button>
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
