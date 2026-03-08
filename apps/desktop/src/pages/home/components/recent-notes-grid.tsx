import { NoteListItem } from '@/components/notes/note-list-item';
import { useAppTheme } from "@/hooks/use-app-theme";
import { useNotesStore } from "@annota/core";
import { FileText } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

export function RecentNotesGrid() {
    const { notes, deleteNote } = useNotesStore();
    const { colors } = useAppTheme();
    const navigate = useNavigate();

    const recentNotes = useMemo(() => {
        return [...notes]
            .slice(0, 6)
            .filter((n) => !n.isDeleted)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }, [notes]);

    const handleNotePress = (id: string, folderId: string | null) => {
        navigate(`/notes/${folderId || 'root'}/${id}`);
    };

    return (
        // Added lg: prefix to overflow-hidden
        <div className="flex flex-col gap-4 h-full lg:overflow-hidden">
            <div className="flex items-center gap-2 shrink-0">
                <FileText size={18} style={{ color: colors.primary }} />
                <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-widest">
                    Recent Notes
                </h2>
            </div>

            {/* Added lg: prefixes to flex-1 and overflow-y-auto */}
            <div className="lg:flex-1 lg:overflow-y-auto custom-scrollbar pr-2 min-h-0">
                {recentNotes.length > 0 ? (
                    <div
                        className="grid grid-cols-2 gap-3"
                        style={{
                            gridAutoRows: "minmax(80px, 1fr)",
                        }}
                    >
                        {recentNotes.map((note) => (
                            <NoteListItem
                                key={note.id}
                                note={note}
                                onClick={() => handleNotePress(note.id, note.folderId)}
                                onDelete={() => deleteNote(note.id)}
                                showTimestamp
                                showDescription
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