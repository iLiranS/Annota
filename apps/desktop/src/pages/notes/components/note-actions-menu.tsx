import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ionicons } from "@/components/ui/ionicons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { NoteMetadata, useNotesStore } from "@annota/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Check, MoreVertical } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { VersionHistoryDialog } from "./version-history-dialog";

interface NoteActionsMenuProps {
    note: NoteMetadata;
    onRevert?: (content: string) => void;
    onOpenChange?: (open: boolean) => void;
}

export function NoteActionsMenu({ note, onRevert, onOpenChange }: NoteActionsMenuProps) {
    const { updateNoteMetadata } = useNotesStore();
    const { colors } = useAppTheme();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

    return (
        <>
            <DropdownMenu modal={false} onOpenChange={onOpenChange}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-accent/50"
                    >
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1 rounded-xl">
                    <DropdownMenuItem
                        className="rounded-lg gap-3 py-2 cursor-pointer"
                        onClick={handleToggleQuickAccess}
                    >
                        <Ionicons
                            name={note.isQuickAccess ? "star" : "star-outline"}
                            size={18}
                            color="#FBBF24"
                        />
                        <span className="flex-1 text-sm font-medium">Quick access</span>
                        {note.isQuickAccess && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        className="rounded-lg gap-3 py-2 cursor-pointer"
                        onClick={handleTogglePin}
                    >
                        <Ionicons
                            name={note.isPinned ? "pin" : "pin-outline"}
                            size={18}
                            color={note.isPinned ? colors.primary : undefined}
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
                        <Ionicons name="time-outline" size={18} />
                        <span className="text-sm font-medium">Version history</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        className="rounded-lg gap-3 py-2 cursor-pointer"
                        onClick={handleCopyLink}
                    >
                        <Ionicons name="link-outline" size={18} />
                        <span className="text-sm font-medium">Copy link to note</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem className="rounded-lg gap-3 py-2 cursor-default opacity-50">
                        <Ionicons name="share-outline" size={18} />
                        <span className="text-sm font-medium">Export</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <VersionHistoryDialog
                note={note}
                open={isHistoryOpen}
                onOpenChange={setIsHistoryOpen}
                onRevert={onRevert}
            />
        </>
    );
}
