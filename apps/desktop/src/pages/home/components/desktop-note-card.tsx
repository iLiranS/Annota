import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { formatRelativeDate } from "@/lib/date-formatter";
import { NoteMetadata, useSettingsStore } from "@annota/core";
import { FileText, Pin, Star, Trash2 } from "lucide-react";

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
    onToggleQuickAccess,
    onTogglePin,
    showDescription = true,
    showTimestamp,
}: DesktopNoteCardProps) {
    const { general } = useSettingsStore();
    const isCompact = general.compactMode;
    const shouldShowTimestamp = showTimestamp ?? !isCompact;

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
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <h3 className="truncate font-semibold text-foreground/90 group-hover:text-primary transition-colors">
                                {note.title || "Untitled Note"}
                            </h3>
                            {note.isPinned && (
                                <Pin className="h-3 w-3 shrink-0 text-primary" />
                            )}
                            {note.isQuickAccess && (
                                <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
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
                {onToggleQuickAccess && (
                    <ContextMenuItem onClick={onToggleQuickAccess} className="gap-2 focus:bg-amber-500/10 focus:text-amber-600">
                        <Star className="h-4 w-4" />
                        <span>{note.isQuickAccess ? "Remove from Starred" : "Star Note"}</span>
                    </ContextMenuItem>
                )}
                {onTogglePin && (
                    <ContextMenuItem onClick={onTogglePin} className="gap-2 focus:bg-primary/10 focus:text-primary">
                        <Pin className="h-4 w-4" />
                        <span>{note.isPinned ? "Unpin Note" : "Pin Note"}</span>
                    </ContextMenuItem>
                )}
                {(onToggleQuickAccess || onTogglePin) && onDelete && (
                    <ContextMenuSeparator />
                )}
                {onDelete && (
                    <ContextMenuItem onClick={onDelete} className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        <span>Delete Note</span>
                    </ContextMenuItem>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
}
