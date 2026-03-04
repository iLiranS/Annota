import { useNotesStore } from "@annota/core";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

export function useCreateNote() {
    const navigate = useNavigate();
    const createNote = useNotesStore((s) => s.createNote);

    const createAndNavigate = useCallback(async (folderId: string = "") => {
        try {
            const note = await createNote({ folderId });

            if (note?.id) {
                const targetFolderId = folderId || "root";
                navigate(`/notes/${targetFolderId}/${note.id}`);
            }
            return note;
        } catch (error) {
            console.error("Failed to create note:", error);
        }
    }, [createNote, navigate]);

    return { createAndNavigate };
}
