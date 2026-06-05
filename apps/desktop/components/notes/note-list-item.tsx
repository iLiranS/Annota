import { Checkbox } from "@/components/ui/checkbox";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useActiveNoteId } from "@/hooks/use-active-note-id";
import { useSmartNavigate } from "@/hooks/use-smart-navigate";
import { cn } from "@/lib/utils";
import { NoteMetadata, useNavigationStore, useNotesStore, useSettingsStore } from "@annota/core";
import { Slot } from "@radix-ui/react-slot";
import { Star } from "lucide-react";
import { NoteContextMenuContent, useNoteModals } from "./note-context-menu";

interface NoteListItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    note: NoteMetadata;
    onDelete?: () => void;
    showDescription?: boolean;
    className?: string;

    suffix?: React.ReactNode;
    isActive?: boolean;
    asChild?: boolean;
    children?: React.ReactNode;
    isInList?: boolean;
    isInQuickAccess?: boolean;
    forceCompact?: boolean;
    searchQuery?: string;
    customDescription?: string;

    selectionMode?: boolean;
    isSelected?: boolean;
    onToggleSelection?: (noteId: string) => void;
    hidePinIcon?: boolean;
    isLast?: boolean;
}


export function NoteListItem({
    note,
    onClick,
    onDelete,
    showDescription = false,
    className,

    suffix,
    isActive,
    style,
    asChild,
    children,
    isInList,
    forceCompact,
    isInQuickAccess,
    searchQuery,
    customDescription,
    selectionMode = false,
    isSelected = false,
    onToggleSelection,
    hidePinIcon = false,
    isLast,
    ...props
}: NoteListItemProps) {
    const { tags } = useNotesStore();
    const { general } = useSettingsStore();
    const setSidebarTab = useNavigationStore(s => s.setSidebarTab);
    const setSelectedTagId = useNavigationStore(s => s.setSelectedTagId);
    const navigateSmart = useSmartNavigate();
    const activeNoteId = useActiveNoteId();
    const isNoteActive = isActive !== undefined ? isActive : activeNoteId === note.id;

    const isCompact = (general.compactMode || forceCompact);

    const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
        e.dataTransfer.setData("application/annota-note-id", note.id);
        e.dataTransfer.effectAllowed = "move";
    };

    const { openPreview, openLocationPicker, renderModals } = useNoteModals(note);

    const Comp = asChild ? Slot : "button";

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
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <Comp
                        draggable={!selectionMode}
                        onDragStart={!selectionMode ? handleDragStart : undefined}
                        type="button"
                        onClick={selectionMode ? (e) => { e.preventDefault(); onToggleSelection?.(note.id); } : onClick}
                        className={cn(
                            !asChild && "group/note relative flex w-full flex-col transition-all",
                            !isNoteActive && !isSelected && 'hover:bg-primary/5',
                            !asChild && (isCompact && !isInList ? "py-1.5" : "py-2"),
                            !asChild && (isInList ? "rounded-lg px-2 py-2" : "px-3 py-2 rounded-lg"),
                            isNoteActive && !asChild && "bg-primary/10",
                            isSelected && !asChild && "bg-primary/10",
                            "relative",
                            className
                        )}
                        style={style}
                        {...props}
                    >
                        {asChild ? children : (
                            <>
                                <div className="flex w-full items-start justify-between gap-2.5">
                                    {(selectionMode || isSelected) && isInList && (
                                        <div className={cn("shrink-0 mt-0.5", general.appDirection === 'rtl' ? "ml-2" : "mr-2")}>
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => onToggleSelection?.(note.id)}
                                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                            />
                                        </div>
                                    )}
                                    <div className="flex min-w-0 items-center gap-2 flex-1">
                                        {isInQuickAccess && (
                                            <Star size={12} className="shrink-0 text-amber-400 fill-amber-400" />
                                        )}
                                        <p className={cn(
                                            "truncate text-sm font-medium transition-colors",
                                            isNoteActive ? "text-primary" : "text-foreground/90 group-hover/note:text-primary"
                                        )}>
                                            <Highlight text={note.title || "Untitled Note"} query={searchQuery} />
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2  shrink-0 my-auto">

                                        {suffix}
                                    </div>
                                </div>

                                {!isCompact && (customDescription || note.preview) && (
                                    <p className={`line-clamp-1 w-full text-[11px] text-muted-foreground/50 leading-tight ${general.appDirection === 'ltr' ? 'text-left' : 'text-right'}`}>
                                        <Highlight text={customDescription || note.preview} query={searchQuery} />
                                    </p>
                                )}


                                {(() => {
                                    if (!note.tags || note.tags === '[]' || general.compactMode || (forceCompact && isInQuickAccess)) return null;
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
                                                        className="px-1.5 py-0.5 rounded text-[9px] font-medium border truncate min-w-[40px] max-w-fit flex-1 cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                                                        style={{
                                                            backgroundColor: `${t.color}1A`,
                                                            color: t.color,
                                                            borderColor: `${t.color}40`
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedTagId(t.id);
                                                            setSidebarTab('notes');
                                                            navigateSmart(`/notes`);
                                                        }}
                                                    >
                                                        {t.name}
                                                    </span>
                                                ))}
                                            </div>
                                        );
                                    } catch { return null; }
                                })()}
                                {/* Subtle inset separator for list items, positioned in the middle of the gap */}
                                {isInList && !isLast && (
                                    <div className="absolute -bottom-0.5 left-4 right-4 h-px bg-border/30" />
                                )}
                            </>
                        )}
                    </Comp>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-52">
                    <NoteContextMenuContent
                        note={note}
                        onDelete={onDelete}
                        onPreview={openPreview}
                        onMoveNote={openLocationPicker}
                        disabledActions={["showFolder"]}
                    />
                </ContextMenuContent>

            </ContextMenu>
            {renderModals()}

        </>
    );
}
