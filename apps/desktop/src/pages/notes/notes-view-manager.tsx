import { DAILY_NOTES_FOLDER_ID, useNotesStore, useSettingsStore } from "@annota/core";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
    const navigate = useNavigate();
    const location = useLocation();

    const { lastViewedNoteId, lastViewedFolderId } = useSettingsStore();
    const notes = useNotesStore((s) => s.notes);

    const searchFolderId = searchParams.get("folderId");

    // 1. Priority: Explicit Note in URL
    if (routeNoteId) {
        return <NoteEditor key={routeNoteId} noteId={routeNoteId} folderId={routeFolderId} />;
    }

    // 2. Priority: Daily Notes Calendar
    if (searchFolderId === DAILY_NOTES_FOLDER_ID) {
        return <DailyNotesCalendar />;
    }

    // 3. Priority: Memorized Note (with auto-navigation)
    // Only auto-navigate on the primary root "/notes" without search params or tag selection
    if (lastViewedNoteId && location.pathname === "/notes" && !routeNoteId && !searchParams.get("folderId") && !searchParams.get("tagId")) {
        const memorizedNote = notes.find(n => n.id === lastViewedNoteId && !n.isDeleted);
        if (memorizedNote) {
            // Use replace: true to avoid cluttering history on startup
            const folderId = memorizedNote.folderId || 'root';
            window.setTimeout(() => navigate(`/notes/${folderId}/${lastViewedNoteId}`, { replace: true }), 0);
            return <NoteEditor key={lastViewedNoteId} noteId={lastViewedNoteId} folderId={folderId} />;
        }
    }

    // 4. Fallback: Empty State
    return <NotesEmpty />;
}
