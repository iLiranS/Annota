import { NoteListItem } from '@/components/notes/note-list-item';
import { Button } from '@/components/ui/button';
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCreateNote } from '@/hooks/use-create-note';
import { useSmartNavigate } from '@/hooks/use-smart-navigate';
import { useNotesStore } from "@annota/core";
import { FileText, Plus } from "lucide-react";
import { useMemo } from "react";

export function RecentNotesGrid() {
    const { notes, deleteNote } = useNotesStore();
    const { colors } = useAppTheme();
    const navigateSmart = useSmartNavigate();
    const { createAndNavigate } = useCreateNote();

    const recentNotes = useMemo(() => {
        return [...notes]
            .filter((n) => !n.isDeleted)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, 6);
    }, [notes]);

    const handleNotePress = (id: string, folderId: string | null) => {
        navigateSmart(`/notes/${folderId || 'root'}/${id}`);
    };

    return (
        // Added lg: prefix to overflow-hidden
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-start gap-2 shrink-0">
                <FileText size={18} style={{ color: colors.primary }} />
                <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-widest">
                    Recent Notes
                </h2>
                <Button variant="ghost" size="sm" className='rounded-full' onClick={() => createAndNavigate()}>
                    <Plus />
                </Button>
            </div>

            <div className="min-h-0 ">
                {recentNotes.length > 0 ? (
                    <div
                        className="grid grid-cols-3 gap-3"
                        style={{
                            gridAutoRows: "minmax(45px, 1fr)",
                        }}
                    >
                        {recentNotes.map((note) => (
                            <NoteListItem
                                key={note.id}
                                note={note}
                                onClick={() => handleNotePress(note.id, note.folderId)}
                                onDelete={() => deleteNote(note.id)}
                                showTimestamp
                                showDescription={true}
                                className='border cursor-pointer'
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10">
                        <p className="text-xs text-muted-foreground">No recent notes</p>
                    </div>
                )}
            </div>
        </div>
    );
}