import { useNavigationStore, useNotesStore, useSettingsStore } from "@annota/core";
import { useLocation, useParams } from "react-router-dom";
import { useMemo } from "react";

export function useActiveNoteId() {
    const location = useLocation();
    const { noteId: routeNoteId } = useParams<{ noteId: string }>();
    const quickAccessNoteId = useNavigationStore(s => s.quickAccessNoteId);
    const lastViewedNoteId = useSettingsStore(s => s.lastViewedNoteId);
    const notes = useNotesStore(s => s.notes);

    const activeNoteId = useMemo(() => {
        // 1. Quick Access (if applicable - though location.key check is tricky here without a ref)
        // For simplicity in the sidebar, if quickAccessNoteId is set, it's usually what's being viewed
        if (quickAccessNoteId) {
            return quickAccessNoteId;
        }

        // 2. URL Note
        if (routeNoteId) {
            return routeNoteId;
        }

        // 3. Last Viewed Fallback
        if (lastViewedNoteId) {
            return lastViewedNoteId;
        }

        return null;
    }, [quickAccessNoteId, routeNoteId, lastViewedNoteId]);

    return activeNoteId;
}
