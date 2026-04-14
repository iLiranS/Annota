import { DAILY_NOTES_FOLDER_ID } from "@annota/core";
import { useParams, useSearchParams } from "react-router-dom";
import { DailyNotesCalendar } from "./components/daily-notes-calendar";
import NoteEditor from "./note-editor";
import NotesEmpty from "./notes-empty";

/**
 * NotesViewManager handles the logic of what to display in the notes content area.
 * It decouples the sidebar navigation (URL) from the actual content being viewed.
 */
export default function NotesViewManager() {
    const { folderId: routeFolderId, noteId: routeNoteId } = useParams<{ folderId: string; noteId: string }>();
    const [searchParams] = useSearchParams();

    const searchFolderId = searchParams.get("folderId");

    // 1. Priority: Explicit Note in URL
    if (routeNoteId) {
        return <NoteEditor key={routeNoteId} noteId={routeNoteId} folderId={routeFolderId} />;
    }

    // 2. Priority: Daily Notes Calendar
    if (searchFolderId === DAILY_NOTES_FOLDER_ID) {
        return <DailyNotesCalendar />;
    }

    // 3. Priority: Fallback: Empty State
    return <NotesEmpty />;
}
