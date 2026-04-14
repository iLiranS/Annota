import { Button } from "@/components/ui/button";
import { Ionicons } from "@/components/ui/ionicons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useSmartNavigate } from "@/hooks/use-smart-navigate";
import { useNotesStore } from "@annota/core";
import { useCallback } from "react";

export function NoteRestoreButton({ noteId }: { noteId: string }) {
    const { restoreNote, getNoteById } = useNotesStore();
    const navigateSmart = useSmartNavigate();
    const { colors } = useAppTheme();

    const handleRestore = useCallback(async () => {
        await restoreNote(noteId);
        const restoredNote = getNoteById(noteId);
        if (restoredNote) {
            // Redirect to the note in its restored folder context using path params
            const folderId = restoredNote.folderId && restoredNote.folderId !== 'system-trash' ? restoredNote.folderId : 'root';
            navigateSmart(`/notes/${folderId}/${noteId}`, { replace: true });
        }
    }, [noteId, restoreNote, getNoteById, navigateSmart]);

    return (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in fade-in zoom-in-95 duration-300 pointer-events-auto">
            <div className="flex items-center gap-4 px-4 py-2.5 rounded-2xl bg-background/80 backdrop-blur-xl border border-border/50 shadow-2xl ring-1 ring-black/5 dark:ring-white/5">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-red-500/10 text-red-500 dark:bg-red-500/20">
                        <Ionicons name="trash-outline" size={20} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold tracking-tight">Note in Trash</span>
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest opacity-70">
                            Read-only Mode
                        </p>
                    </div>
                </div>
                
                <div className="w-px h-8 bg-border/60 mx-1" />
                
                <Button 
                    onClick={handleRestore}
                    className="h-10 px-5 rounded-xl font-bold text-xs gap-2 shadow-md transition-all hover:shadow-lg hover:scale-[1.02] active:scale-98 bg-primary text-primary-foreground"
                    style={{ backgroundColor: colors.primary }}
                >
                    <Ionicons name="arrow-undo-outline" size={16} />
                    Restore Note
                </Button>
            </div>
        </div>
    );
}
