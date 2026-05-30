import { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID, useNavigationStore, useNotesStore } from "@annota/core";
import { useParams } from "react-router-dom";
import { DailyNotesCalendar } from "./components/daily-notes-calendar";
import { TrashContent } from "./components/trash-content";
import { AnnotaHome } from "./components/annota-home";
import NoteEditor from "./note-editor";
import NotesEmpty from "./notes-empty";

/**
 * NotesViewManager handles the logic of what to display in the notes content area.
 * It decouples the sidebar navigation (URL) from the actual content being viewed.
 */
export default function NotesViewManager() {
    const { noteId: routeNoteId } = useParams<{ noteId: string }>();
    const notes = useNotesStore(s => s.notes);
    const selectedFolderId = useNavigationStore(s => s.selectedFolderId);

    const isTrashView = selectedFolderId === TRASH_FOLDER_ID;

    // 1. Priority: Explicit Note in URL
    if (routeNoteId) {
        const note = notes.find(n => n.id === routeNoteId);
        if (note?.isDeleted && !isTrashView) {
            return <NotesEmpty />;
        }
        return <NoteEditor key={routeNoteId} noteId={routeNoteId} />;
    }

    // 2. Priority: Daily Notes Calendar
    if (selectedFolderId === DAILY_NOTES_FOLDER_ID) {
        return <DailyNotesCalendar />;
    }

    // 3. Priority: Trash Content
    if (selectedFolderId === TRASH_FOLDER_ID) {
        return <TrashContent />;
    }

    // 3.5 Priority: Root (Annota) Home Page
    if (selectedFolderId === 'root' || !selectedFolderId) {
        return <AnnotaHome />;
    }

    // 4. Priority: Fallback: Empty State
    return <NotesEmpty />;
}
