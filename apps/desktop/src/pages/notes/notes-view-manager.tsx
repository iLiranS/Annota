import { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID, useSettingsStore } from "@annota/core";
import { useParams, useSearchParams } from "react-router-dom";
import { DailyNotesCalendar } from "./components/daily-notes-calendar";
import { TrashContent } from "./components/trash-content";
import NoteEditor from "./note-editor";
import NotesEmpty from "./notes-empty";

/**
 * NotesViewManager handles the logic of what to display in the notes content area.
 * It decouples the sidebar navigation (URL) from the actual content being viewed.
 */
export default function NotesViewManager() {
    const { folderId: routeFolderId, noteId: routeNoteId } = useParams<{ folderId: string; noteId: string }>();
    const [searchParams] = useSearchParams();
    const lastViewedNoteId = useSettingsStore(s => s.lastViewedNoteId);
    const lastViewedFolderId = useSettingsStore(s => s.lastViewedFolderId);

    const searchFolderId = searchParams.get("folderId");

    // 1. Priority: Explicit Note in URL
    if (routeNoteId) {
        return <NoteEditor key={`${routeFolderId}-${routeNoteId}`} noteId={routeNoteId} folderId={routeFolderId} />;
    }

    // 2. Priority: Daily Notes Calendar
    if (searchFolderId === DAILY_NOTES_FOLDER_ID) {
        return <DailyNotesCalendar />;
    }

    // 3. Priority: Trash Content
    if (searchFolderId === TRASH_FOLDER_ID) {
        return <TrashContent />;
    }

    // 4. Priority: Fallback: Sticky Note (Last Viewed)
    if (lastViewedNoteId) {
        return <NoteEditor key={`${lastViewedFolderId}-${lastViewedNoteId}`} noteId={lastViewedNoteId} folderId={lastViewedFolderId || 'root'} />;
    }

    // 5. Priority: Fallback: Empty State
    return <NotesEmpty />;
}
