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
import { NoteMetadata, useNotesStore, useSettingsStore } from "@annota/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Check, MoreVertical, Pin, Search, Star } from "lucide-react";
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
        <>
            <TooltipProvider delayDuration={400}>
                <Tooltip open={isMenuOpen ? false : undefined}>
                    <DropdownMenu modal={false} onOpenChange={setIsMenuOpen}>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "h-9 w-9 rounded-xl bg-sidebar/95 backdrop-blur-md border border-border/80 shadow-md text-muted-foreground/90 transition-all duration-300 ease-out z-30",
                                        "hover:scale-105  hover:text-accent-full hover:bg-accent-full/10 hover:border-accent-full/40 hover:shadow-lg hover:shadow-accent-full/5",
                                        isMenuOpen && "bg-accent-full/15 border-accent-full/40 text-accent-full shadow-lg scale-105",
                                        className
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
        </>
    );
}

