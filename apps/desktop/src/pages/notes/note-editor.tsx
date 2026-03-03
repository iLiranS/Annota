import { useNotesStore } from "@annota/core";
import { FileText } from "lucide-react";
import { useParams } from "react-router-dom";

export default function NoteEditor() {
    const { noteId } = useParams<{ folderId: string; noteId: string }>();
    const notes = useNotesStore((s) => s.notes);
    const note = notes.find((n) => n.id === noteId);

    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
            <FileText className="h-16 w-16 text-border" />
            <h2 className="text-xl font-bold tracking-tight">
                {note?.title || "Untitled Note"}
            </h2>
            <p className="max-w-sm text-center text-sm text-muted-foreground">
                The tiptap editor will be rendered here once adapted for web. A
                dedicated toolbar will be added in a later phase.
            </p>
        </div>
    );
}
