import { ConfirmDialog } from "@/components/custom-ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ionicons } from "@/components/ui/ionicons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIsPremium, NoteMetadata, useNotesStore, useSettingsStore } from "@annota/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, MoreVertical, Pin, Search, Star, Globe } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { VersionHistoryDialog } from "./version-history-dialog";

interface NoteFloatingActionsProps {
    onToggleSearch: () => void;
    note: NoteMetadata;
    onRevert: (content: string) => void;
    className?: string;
    direction: 'ltr' | 'rtl';
}

export function NoteFloatingActions({
    onToggleSearch,
    note,
    onRevert,
    className,
    direction,
}: NoteFloatingActionsProps) {
    const { updateNoteMetadata } = useNotesStore();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isTooltipOpen, setIsTooltipOpen] = useState(false);

    const handleMenuOpenChange = useCallback((open: boolean) => {
        setIsMenuOpen(open);
        setIsTooltipOpen(false);
    }, []);

    const isPremium = useIsPremium();

    const hasUnpublishedChanges = !!note.isPublished && (
        !note.publishUpdatedAt || new Date(note.updatedAt).getTime() > new Date(note.publishUpdatedAt).getTime()
    );

    const handlePublish = useCallback(async (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        try {
            await updateNoteMetadata(note.id, {
                isPublished: true,
                publishUpdatedAt: new Date(),
            });
            toast.success(note.isPublished ? "Publish updated successfully" : "Note published successfully");
        } catch (err) {
            console.error("Failed to publish note:", err);
            toast.error("Failed to publish note");
        }
    }, [note.id, note.isPublished, updateNoteMetadata]);

    const handleUnpublish = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await updateNoteMetadata(note.id, {
                isPublished: false,
            });
            toast.success("Note unpublished successfully");
        } catch (err) {
            console.error("Failed to unpublish note:", err);
            toast.error("Failed to unpublish note");
        }
    }, [note.id, updateNoteMetadata]);

    const handleTogglePin = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();
        await updateNoteMetadata(note.id, { isPinned: !note.isPinned });
    }, [note.id, note.isPinned, updateNoteMetadata]);

    const handleToggleQuickAccess = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();
        await updateNoteMetadata(note.id, { isQuickAccess: !note.isQuickAccess });
    }, [note.id, note.isQuickAccess, updateNoteMetadata]);

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

    const isMac = typeof window !== 'undefined' && (/Mac|iPod|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent));
    const MOD = isMac ? '⌘' : 'Ctrl';

    return (
        <div className={cn("flex flex-col items-center gap-2", className)}>
            <TooltipProvider delayDuration={400}>
                <Tooltip open={isMenuOpen ? false : isTooltipOpen} onOpenChange={setIsTooltipOpen}>
                    <DropdownMenu modal={false} onOpenChange={handleMenuOpenChange}>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "h-9 w-9 rounded-xl bg-sidebar/95 backdrop-blur-md border border-border/80 shadow-md text-muted-foreground/90 transition-all duration-300 ease-out z-30",
                                        "hover:scale-105 hover:text-accent-full hover:bg-accent-full/10 hover:border-accent-full/40 hover:shadow-lg hover:shadow-accent-full/5",
                                        isMenuOpen && "bg-accent-full/15 border-accent-full/40 text-accent-full shadow-lg scale-105",
                                    )}
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>

                        <DropdownMenuContent
                            side={direction === 'rtl' ? "right" : "left"}
                            align="start"
                            sideOffset={8}
                            className="w-56 p-1 rounded-xl"
                        >
                            <DropdownMenuItem
                                className="rounded-lg gap-3 py-2 cursor-pointer"
                                onClick={(e) => {
                                    e.preventDefault();
                                    onToggleSearch();
                                    setIsMenuOpen(false);
                                }}
                            >
                                <Search className="text-muted-foreground" size={18} />
                                <span className="flex-1 text-sm font-medium">Search</span>
                                <span className="text-[10px] opacity-60 bg-muted px-1 py-0.5 rounded border border-border">
                                    {MOD}+F
                                </span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="my-1 opacity-50" />

                            <DropdownMenuItem
                                className="rounded-lg gap-3 py-2 cursor-pointer"
                                onClick={handleToggleQuickAccess}
                            >
                                <Star
                                    className={cn("text-muted-foreground", note.isQuickAccess ? "fill-accent-full text-accent-full" : "")}
                                    size={18}
                                />
                                <span className="flex-1 text-sm font-medium">Quick access</span>
                                {note.isQuickAccess && <Check className="h-4 w-4 text-primary" />}
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                className="rounded-lg gap-3 py-2 cursor-pointer"
                                onClick={handleTogglePin}
                            >
                                <Pin
                                    className={cn("text-muted-foreground", note.isPinned ? "fill-accent-full text-accent-full" : "")}
                                    size={18}
                                />
                                <span className="flex-1 text-sm font-medium">Pin note</span>
                                {note.isPinned && <Check className="h-4 w-4 text-primary" />}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="my-1 opacity-50" />

                            <DropdownMenuItem
                                className="rounded-lg gap-3 py-2 cursor-pointer"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsHistoryOpen(true);
                                }}
                            >
                                <Ionicons name="time-outline" size={18} className="text-muted-foreground" />
                                <span className="text-sm font-medium">Version history</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                className="rounded-lg gap-3 py-2 cursor-pointer"
                                onClick={handleCopyLink}
                            >
                                <Ionicons name="link-outline" size={18} className="text-muted-foreground" />
                                <span className="text-sm font-medium">Copy link to note</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="my-1 opacity-50" />

                            <DropdownMenuItem
                                className="rounded-lg gap-3 py-2 cursor-pointer"
                                onClick={async () => {
                                    const content = await useNotesStore.getState().getNoteContent(note.id);
                                    if (!content) return;
                                    const { ExportService } = await import('@annota/editor-core');
                                    const { DesktopExportAdapter } = await import('@/lib/export/DesktopExportAdapter');
                                    const adapter = new DesktopExportAdapter();
                                    const service = new ExportService(adapter);
                                    await service.triggerMarkdownExport(note.title || 'Note', content);
                                    toast.success("Markdown exported successfully");
                                }}
                            >
                                <Ionicons name="logo-markdown" size={18} className="text-muted-foreground" />
                                <span className="text-sm font-medium">Export as Markdown</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                className="rounded-lg gap-3 py-2 cursor-pointer"
                                onClick={async () => {
                                    const content = await useNotesStore.getState().getNoteContent(note.id);
                                    if (!content) return;
                                    const { ExportService } = await import('@annota/editor-core');
                                    const { DesktopExportAdapter } = await import('@/lib/export/DesktopExportAdapter');
                                    const adapter = new DesktopExportAdapter();
                                    const service = new ExportService(adapter);

                                    // Get current editor settings
                                    const settings = useSettingsStore.getState().editor;

                                    await service.triggerPdfExport(note.title || 'Note', content, {
                                        fontSize: settings.fontSize,
                                        lineHeight: settings.lineSpacing,
                                        paragraphSpacing: settings.paragraphSpacing,
                                        accentColor: useSettingsStore.getState().accentColor,
                                        numberedLines: settings.numberedLines
                                    });
                                    toast.success("PDF export triggered");
                                }}
                            >
                                <Ionicons name="document-text-outline" size={18} className="text-muted-foreground" />
                                <span className="text-sm font-medium">Export as PDF</span>
                            </DropdownMenuItem>

                            {isPremium && (
                                <>
                                    <DropdownMenuSeparator className="my-1 opacity-50" />
                                    <ConfirmDialog
                                        title={note.isPublished ? "⚠️ Update publish?" : "⚠️ Publish note?"}
                                        description="Are you sure you want to publish this note? Anyone with the link will be able to view all its data !"
                                        confirmText={note.isPublished ? "Update" : "Publish"}
                                        cancelText="Cancel"
                                        variant="default"
                                        onConfirm={handlePublish}
                                        trigger={
                                            <DropdownMenuItem
                                                className={cn(
                                                    "rounded-lg gap-3 py-2 cursor-pointer",
                                                    note.isPublished && "bg-blue-500/10 text-blue-500 focus:bg-blue-500/15 focus:text-blue-600"
                                                )}
                                                onSelect={(e) => e.preventDefault()}
                                            >
                                                <Ionicons
                                                    name="globe-outline"
                                                    size={18}
                                                    className={cn(
                                                        "text-muted-foreground",
                                                        note.isPublished && "animate-[spin_8s_linear_infinite] text-blue-500"
                                                    )}
                                                />
                                                <span className="flex-1 text-sm font-medium">
                                                    {!note.isPublished
                                                        ? "Publish note"
                                                        : hasUnpublishedChanges
                                                            ? "Update publish"
                                                            : "Published"}
                                                </span>
                                                {note.isPublished && (
                                                    <a
                                                        href={`https://annota.online/notes/${note.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            openUrl(`https://annota.online/notes/${note.id}`).catch(err => {
                                                                console.error("Failed to open external URL:", err);
                                                            });
                                                        }}
                                                        className="text-xs text-accent-full hover:underline ml-2 flex items-center gap-1"
                                                    >
                                                        View
                                                        <Ionicons name="open-outline" size={14} />
                                                    </a>
                                                )}
                                            </DropdownMenuItem>
                                        }
                                    />
                                    {note.isPublished && (
                                        <DropdownMenuItem
                                            className="rounded-lg gap-3 py-2 cursor-pointer text-destructive focus:text-destructive"
                                            onClick={handleUnpublish}
                                        >
                                            <Ionicons name="eye-off-outline" size={18} />
                                            <span className="flex-1 text-sm font-medium">Unpublish note</span>
                                        </DropdownMenuItem>
                                    )}
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <TooltipContent side="bottom" sideOffset={6} className="text-[10px] font-medium">
                        Note actions
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <VersionHistoryDialog
                note={note}
                open={isHistoryOpen}
                onOpenChange={setIsHistoryOpen}
                onRevert={onRevert}
            />

            {note.isPublished && (
                <TooltipProvider delayDuration={400}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <a
                                href={`https://annota.online/notes/${note.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-7 w-7 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 text-blue-500 hover:text-blue-600 flex items-center justify-center shadow-sm transition-all duration-300 hover:scale-105"
                            >
                                <Globe className="h-3.5 w-3.5" />
                            </a>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-[10px] font-medium">
                            Note is published. Click to view online.
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    );
}

