import { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID, useNavigationStore, useNotesStore, useSettingsStore } from "@annota/core";
import { useEffect, useRef } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { DailyNotesCalendar } from "./components/daily-notes-calendar";
import { TrashContent } from "./components/trash-content";
import NoteEditor from "./note-editor";
import NotesEmpty from "./notes-empty";

/**
 * NotesViewManager handles the logic of what to display in the notes content area.
 * It decouples the sidebar navigation (URL) from the actual content being viewed.
 */
export default function NotesViewManager() {
    const location = useLocation();
    const lastLocationKeyRef = useRef(location.key);
    const { folderId: routeFolderId, noteId: routeNoteId } = useParams<{ folderId: string; noteId: string }>();
    const [searchParams] = useSearchParams();
    const notes = useNotesStore(s => s.notes);
    const lastViewedNoteId = useSettingsStore(s => s.lastViewedNoteId);
    const lastViewedFolderId = useSettingsStore(s => s.lastViewedFolderId);
    const quickAccessNoteId = useNavigationStore(s => s.quickAccessNoteId);
    const quickAccessFolderId = useNavigationStore(s => s.quickAccessFolderId);
    const clearQuickAccessView = useNavigationStore(s => s.clearQuickAccessView);

    const searchFolderId = searchParams.get("folderId");
    const isTrashView = routeFolderId === TRASH_FOLDER_ID || searchFolderId === TRASH_FOLDER_ID;
    const shouldUseQuickAccessView = !!quickAccessNoteId && lastLocationKeyRef.current === location.key;

    useEffect(() => {
        if (lastLocationKeyRef.current !== location.key && quickAccessNoteId) {
            clearQuickAccessView();
        }
        lastLocationKeyRef.current = location.key;
    }, [location.key, quickAccessNoteId, clearQuickAccessView]);

    // 1. Priority: Quick Access note override
    if (shouldUseQuickAccessView) {
        const note = notes.find(n => n.id === quickAccessNoteId);
        if (note && !note.isDeleted) {
            return <NoteEditor key={`${quickAccessFolderId}-${quickAccessNoteId}`} noteId={quickAccessNoteId} folderId={quickAccessFolderId || note.folderId || 'root'} />;
        }
    }

    // 2. Priority: Explicit Note in URL
    if (routeNoteId) {
        const note = notes.find(n => n.id === routeNoteId);
        if (note?.isDeleted && !isTrashView) {
            return <NotesEmpty />;
        }
        return <NoteEditor key={`${routeFolderId}-${routeNoteId}`} noteId={routeNoteId} folderId={routeFolderId} />;
    }

    // 3. Priority: Daily Notes Calendar
    if (searchFolderId === DAILY_NOTES_FOLDER_ID) {
        return <DailyNotesCalendar />;
    }

    // 4. Priority: Trash Content
    if (searchFolderId === TRASH_FOLDER_ID) {
        return <TrashContent />;
    }

    // 5. Priority: Fallback: Sticky Note (Last Viewed)
    if (lastViewedNoteId) {
        const note = notes.find(n => n.id === lastViewedNoteId);
        if (note && !note.isDeleted) {
            return <NoteEditor key={`${lastViewedFolderId}-${lastViewedNoteId}`} noteId={lastViewedNoteId} folderId={lastViewedFolderId || 'root'} />;
        }
    }

    // 6. Priority: Fallback: Empty State
    return <NotesEmpty />;
}
