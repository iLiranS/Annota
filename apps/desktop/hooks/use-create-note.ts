import { useNotesStore, useNavigationStore, TRASH_FOLDER_ID } from "@annota/core";
import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useSmartNavigate } from "./use-smart-navigate";
import { toast } from "sonner";

export function useCreateNote() {
    const navigate = useSmartNavigate();
    const location = useLocation();
    const createNote = useNotesStore((s) => s.createNote);

    const createAndNavigate = useCallback(async (folderId?: string | null, tagId?: string | null) => {
        try {
            let targetFolderId = folderId;
            if (targetFolderId === undefined) {
                const { selectedFolderId } = useNavigationStore.getState();
                targetFolderId = (selectedFolderId && selectedFolderId !== 'root' && selectedFolderId !== TRASH_FOLDER_ID) ? selectedFolderId : undefined;
            } else if (targetFolderId === null || targetFolderId === 'root' || targetFolderId === TRASH_FOLDER_ID) {
                targetFolderId = undefined;
            }

            let targetTagId = tagId;
            if (targetTagId === undefined) {
                const { selectedTagId } = useNavigationStore.getState();
                targetTagId = selectedTagId || undefined;
            } else if (targetTagId === null) {
                targetTagId = undefined;
            }

            const { data: note, error } = await createNote({ 
                folderId: targetFolderId || undefined as any,
                tags: targetTagId ? JSON.stringify([targetTagId]) : undefined
            });

            if (error) {
                toast.error(error);
                return { data: null, error };
            }

            if (note?.id) {
                const targetPath = `/notes/${note.id}`;

                navigate(targetPath);
            }
            return { data: note, error: null };
        } catch (error: any) {
            const errorMsg = error.message || "An unexpected error occurred";
            console.error("Failed to create note:", error);
            return { data: null, error: errorMsg };
        }
    }, [createNote, navigate, location]);

    return { createAndNavigate };
}
