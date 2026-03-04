import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Ionicons } from "@/components/ui/ionicons";
import { formatRelativeDate } from "@/lib/date-formatter";
import { NoteMetadata, useNotesStore, useSettingsStore } from "@annota/core";
import { useCallback } from "react";

interface DesktopNoteCardProps {
    note: NoteMetadata;
    onPress: () => void;
    onDelete?: () => void;
    onToggleQuickAccess?: () => void;
    onTogglePin?: () => void;
    showDescription?: boolean;
    showTimestamp?: boolean;
}

export default function DesktopNoteCard({
    note,
    onPress,
    onDelete,
    showDescription = true,
    showTimestamp,
}: DesktopNoteCardProps) {
    const { general } = useSettingsStore();
    const { updateNoteMetadata } = useNotesStore();
    const isCompact = general.compactMode;
    const shouldShowTimestamp = showTimestamp ?? !isCompact;

    const handleTogglePin = useCallback(async (note: NoteMetadata) => {
        await updateNoteMetadata(note.id, { isPinned: !note.isPinned });
    }, [updateNoteMetadata]);

    const handleToggleQuickAccess = useCallback(async (note: NoteMetadata) => {
        console.log("toggle quick access", note);
        return
    }, [updateNoteMetadata]);

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    onClick={onPress}
                    className={`
                        group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:bg-accent/50 hover:shadow-sm
                        ${isCompact ? "p-3" : "p-4"}
                    `}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Ionicons name="document-text" size={16} className="shrink-0 text-muted-foreground" />
                            <h3 className="truncate font-semibold text-foreground/90 group-hover:text-primary transition-colors">
                                {note.title || "Untitled Note"}
                            </h3>
                            {note.isPinned && (
                                <Ionicons name="pin" size={12} className="shrink-0 text-primary" />
                            )}
                            {note.isQuickAccess && (
                                <Ionicons name="star" size={12} className="shrink-0 text-amber-400" />
                            )}
                        </div>
                        {shouldShowTimestamp && (
                            <span className="shrink-0 text-xs text-muted-foreground/80">
                                {formatRelativeDate(note.updatedAt)}
                            </span>
                        )}
                    </div>

                    {!isCompact && note.preview && showDescription && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground/70 leading-relaxed">
                            {note.preview}
                        </p>
                    )}
                </div>
            </ContextMenuTrigger>

            <ContextMenuContent className="w-48">
                <ContextMenuItem onClick={() => handleToggleQuickAccess(note)} className="gap-2 focus:bg-amber-500/10 focus:text-amber-600">
                    <Ionicons name="star" size={16} />
                    <span>{note.isQuickAccess ? "Remove from Starred" : "Star Note"}</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleTogglePin(note)} className="gap-2 focus:bg-primary/10 focus:text-primary">
                    <Ionicons name="pin" size={16} />
                    <span>{note.isPinned ? "Unpin Note" : "Pin Note"}</span>
                </ContextMenuItem>
                {onDelete && (
                    <ContextMenuSeparator />
                )}
                {onDelete && (
                    <ContextMenuItem onClick={onDelete} className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive">
                        <Ionicons name="trash-outline" size={16} />
                        <span>Delete Note</span>
                    </ContextMenuItem>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
}
