import { useNavigationStore } from "@annota/core";
import { useMemo } from "react";
import { useParams } from "react-router-dom";

export function useActiveNoteId() {
    const { noteId: routeNoteId } = useParams<{ noteId: string }>();
    const lastViewedNoteId = useNavigationStore(s => s.lastViewedNoteId);
    const selectedFolderId = useNavigationStore(s => s.selectedFolderId);

    const activeNoteId = useMemo(() => {
        // 1. URL Note
        if (routeNoteId) {
            return routeNoteId;
        }

        // If we are at the home view, no note should be active
        if (!routeNoteId && (selectedFolderId === 'root' || !selectedFolderId)) {
            return null;
        }

        // 2. Last Viewed Fallback
        if (lastViewedNoteId) {
            return lastViewedNoteId;
        }

        return null;
    }, [routeNoteId, lastViewedNoteId, selectedFolderId]);

    return activeNoteId;
}
