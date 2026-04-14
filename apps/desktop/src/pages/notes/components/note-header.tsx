import { NoteMetadata } from "@annota/core";
import { NoteFloatingActions } from "./note-floating-actions";
import { NoteTags } from "./note-tags";

interface NoteHeaderProps {
    noteId: string;
    note: NoteMetadata;
    onToggleSearch: () => void;
    onRevert: (content: string) => void;
}

export function NoteHeader({ noteId, note, onToggleSearch, onRevert }: NoteHeaderProps) {
    return (
        <div className="relative z-40 flex items-center justify-between  py-1.5 bg-note-bg border-b border-sidebar-border/5 overflow-hidden">
            <div className="flex-1 min-w-0">
                <NoteTags noteId={noteId} />
            </div>
            <div className="shrink-0 ml-4">
                <NoteFloatingActions
                    onToggleSearch={onToggleSearch}
                    note={note}
                    onRevert={onRevert}
                />
            </div>
        </div>
    );
} 
