import { useNavigationStore } from "@annota/core";
import { useMemo } from "react";
import { useParams } from "react-router-dom";

export function useActiveNoteId() {
    const { noteId: routeNoteId } = useParams<{ noteId: string }>();
    const lastViewedNoteId = useNavigationStore(s => s.lastViewedNoteId);

    const activeNoteId = useMemo(() => {
        // 1. URL Note
        if (routeNoteId) {
            return routeNoteId;
        }

        // 2. Last Viewed Fallback
        if (lastViewedNoteId) {
            return lastViewedNoteId;
        }

        return null;
    }, [routeNoteId, lastViewedNoteId]);

    return activeNoteId;
}
