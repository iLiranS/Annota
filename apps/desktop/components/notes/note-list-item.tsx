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
import { NoteMetadata, useNotesStore, useSettingsStore } from "@annota/core";
import { NoteFileService } from "@annota/core/platform";
import { emitTo, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { LocationPickerModal } from "../location-picker-modal";
import { FolderEditModal } from "./folder-edit-modal";
import { NotePreviewModal } from "./note-preview-modal";

import { Slot } from "@radix-ui/react-slot";
import { Pin, Star } from "lucide-react";

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
    isInQuickAccess?: boolean;
    forceCompact?: boolean;
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
    forceCompact,
    isInQuickAccess,
    ...props
}: NoteListItemProps) {
    const { updateNoteMetadata, tags, restoreNote, permanentlyDeleteNote } = useNotesStore();
    const { general } = useSettingsStore();
    const isCompact = (general.compactMode || forceCompact);

    const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
    const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

    const handleRestoreNote = useCallback(async () => {
        await restoreNote(note.id);
    }, [note.id, restoreNote]);

    const handlePermanentlyDelete = useCallback(async () => {
        await permanentlyDeleteNote(note.id);
    }, [note.id, permanentlyDeleteNote]);

    const handleTogglePin = useCallback(async () => {
        await updateNoteMetadata(note.id, { isPinned: !note.isPinned });
    }, [note.id, note.isPinned, updateNoteMetadata]);

    const handleToggleQuickAccess = useCallback(async () => {
        await updateNoteMetadata(note.id, { isQuickAccess: !note.isQuickAccess });
    }, [note.id, note.isQuickAccess, updateNoteMetadata]);

    const handleMoveNote = useCallback(async (targetFolderId: string | null) => {
        await updateNoteMetadata(note.id, { folderId: targetFolderId });
    }, [note.id, updateNoteMetadata]);

    const handleCopyLink = useCallback(async () => {
        const link = `annota://note/${note.id}`;
        try {
            await writeText(link);
            toast.success("Link copied to clipboard", {
                description: "You can now paste it anywhere to link to this note.",
            });
        } catch (err) {
            console.error("Failed to copy link:", err);
            toast.error("Failed to copy link to clipboard");
        }
    }, [note.id]);

    const handleOpenInNewWindow = useCallback(async () => {
        const label = `note-${note.id}-${Math.random().toString(36).substring(7)}`;
        const webview = new WebviewWindow(label, {
            url: `/note-fullscreen/${note.id}`,
            title: note.title || "Annota Note",
            width: 1280,
            height: 720,
            decorations: true,
            transparent: false,
            titleBarStyle: "transparent",
        });

        // Listen for the child's "I'm ready" signal, then send it everything it needs.
        // The child registers its listener first, then emits this event — no race condition.
        const unlisten = await listen<{ noteId: string }>('note-window-ready', async (event) => {
            if (event.payload.noteId !== note.id) return;
            unlisten(); // One-shot

            try {
                const { getNoteContent, notes, tags } = useNotesStore.getState();
                const rawContent = await getNoteContent(note.id);
                const html = rawContent || "";

                // Resolve image sources so the child doesn't need NoteFileService
                const imageIdRegex = /data-image-id\s*=\s*(["'])(.*?)\1/gi;
                const imageIds = new Set<string>();
                let match;
                while ((match = imageIdRegex.exec(html)) !== null) {
                    if (!match[2].startsWith('temp-')) imageIds.add(match[2]);
                }

                let hydratedContent = html;
                if (imageIds.size > 0) {
                    const imageMap = await NoteFileService.resolveFileSources(Array.from(imageIds));
                    if (imageMap && Object.keys(imageMap).length > 0) {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, "text/html");
                        doc.querySelectorAll("img[data-image-id]").forEach((img) => {
                            const id = img.getAttribute("data-image-id");
                            if (id && imageMap[id]) img.setAttribute("src", imageMap[id]);
                        });
                        hydratedContent = doc.body.innerHTML;
                    }
                }

                await emitTo(label, 'note-window-init', {
                    content: hydratedContent,
                    tags,
                    notes: notes.filter(n => !n.isDeleted),
                });
            } catch (err) {
                console.error('[OpenInNewWindow] Failed to send init data:', err);
            }
        });

        webview.once('tauri://error', function (e) {
            unlisten(); // Clean up if window creation fails
            console.error('Error creating window:', e);
            toast.error("Failed to open note in new window");
        });
    }, [note.id, note.title]);

    const Comp = asChild ? Slot : "button";

    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <Comp
                        type="button"
                        onClick={onClick}
                        className={cn(
                            !asChild && "group/note relative flex w-full flex-col transition-all",
                            !isActive && 'hover:bg-primary/10',
                            !asChild && (isCompact && !isInList ? "py-1.5" : "py-2"),
                            !asChild && (isInList ? "rounded-lg px-2 py-2" : "px-3 py-2 rounded-lg"),
                            isActive && !asChild && "bg-accent/70",
                            "relative",
                            className
                        )}
                        style={style}
                        {...props}
                    >
                        {asChild ? children : (
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
                                        {note.isPinned && !isInQuickAccess && (
                                            <Pin size={12} className="text-accent-full" />
                                        )}
                                        {suffix}
                                        {showTimestamp && note.updatedAt && (
                                            <span className="text-[11px] text-muted-foreground/60">
                                                {formatRelativeDate(note.updatedAt)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {!isCompact && note.preview && (
                                    <p className={`line-clamp-1 w-full  text-[11px] text-muted-foreground/50 leading-tight ${general.appDirection === 'ltr' ? 'text-left' : 'text-right'}`}>
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
                                            <div className="flex gap-1  mt-1 overflow-hidden">
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
                                {/* Subtle inset separator for list items, positioned in the middle of the gap */}
                                {isInList && (
                                    <div className="absolute -bottom-0.5 left-4 right-4 h-px bg-border/30" />
                                )}
                            </>
                        )}
                    </Comp>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-52">
                    {note.isDeleted ? (
                        <>
                            <ContextMenuItem
                                onSelect={handleRestoreNote}
                                className="gap-2 focus:text-emerald-600 focus:bg-emerald-500/10"
                            >
                                <Ionicons name="arrow-undo-outline" size={16} />
                                <span>Restore Note</span>
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
                            <ContextMenuItem
                                onSelect={() => setIsPreviewOpen(true)}
                                onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                            >
                                <Ionicons name="eye-outline" size={16} />
                                <span>Preview Note</span>
                            </ContextMenuItem>

                            <ContextMenuItem
                                onSelect={handleOpenInNewWindow}
                                onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                            >
                                <Ionicons name="open-outline" size={16} />
                                <span>Open in New Window</span>
                            </ContextMenuItem>

                            <ContextMenuItem
                                onSelect={handleToggleQuickAccess}
                                onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                            >
                                <Star className={note.isQuickAccess ? "fill-accent-full" : ""} size={16} />
                                <span>
                                    {note.isQuickAccess ? "Remove Quick Access" : "Quick Access"}
                                </span>
                            </ContextMenuItem>

                            <ContextMenuItem
                                onSelect={handleTogglePin}
                                onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                            >
                                <Pin className={note.isPinned ? "fill-accent-full" : ""} size={16} />
                                <span>{note.isPinned ? "Unpin Note" : "Pin Note"}</span>
                            </ContextMenuItem>



                            <ContextMenuItem
                                onSelect={handleCopyLink}
                                onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                            >
                                <Ionicons name="link-outline" size={16} />
                                <span>Copy Link</span>
                            </ContextMenuItem>

                            <ContextMenuSeparator />

                            <ContextMenuItem
                                onSelect={() => setIsLocationPickerOpen(true)}
                                onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                            >
                                <Ionicons name="folder-outline" size={16} />
                                <span>Move Note</span>
                            </ContextMenuItem>

                            {onDelete && (
                                <ContextMenuItem
                                    onSelect={onDelete}
                                    onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                                    className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                                >
                                    <Ionicons name="trash-outline" size={16} />
                                    <span>Delete Note</span>
                                </ContextMenuItem>
                            )}
                        </>
                    )}
                </ContextMenuContent>

            </ContextMenu>

            {isLocationPickerOpen && (
                <LocationPickerModal
                    open={isLocationPickerOpen}
                    onOpenChange={setIsLocationPickerOpen}
                    onClose={() => setIsLocationPickerOpen(false)}
                    selectedParentId={note.folderId}
                    onSelect={handleMoveNote}
                    onCreateFolder={(id) => {
                        setNewFolderParentId(id);
                        setIsNewFolderModalOpen(true);
                    }}
                />
            )}

            {isNewFolderModalOpen && (
                <FolderEditModal
                    open={isNewFolderModalOpen}
                    onOpenChange={setIsNewFolderModalOpen}
                    folder={null}
                    defaultParentId={newFolderParentId}
                />
            )}

            {isPreviewOpen && (
                <NotePreviewModal
                    open={isPreviewOpen}
                    onOpenChange={setIsPreviewOpen}
                    note={note}
                />
            )}

        </>
    );
}
