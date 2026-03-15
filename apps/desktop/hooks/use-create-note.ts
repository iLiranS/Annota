import { useNotesStore } from "@annota/core";
import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function useCreateNote() {
    const navigate = useNavigate();
    const location = useLocation();
    const createNote = useNotesStore((s) => s.createNote);

    const createAndNavigate = useCallback(async (folderId: string = "", tagId?: string) => {
        try {
            const { data: note, error } = await createNote({ 
                folderId,
                tags: tagId ? JSON.stringify([tagId]) : undefined
            });

            if (error) {
                toast.error(error);
                return { data: null, error };
            }

            if (note?.id) {
                const targetFolderId = folderId || "root";
                const search = tagId ? `?tagId=${tagId}` : "";
                const targetPath = `/notes/${targetFolderId}/${note.id}${search}`;

                const currentPath = location.pathname + location.search;
                if (currentPath === targetPath) return { data: note, error: null };

                const isTargetContent = targetPath.startsWith('/notes') && !targetPath.startsWith('/notes/trash');
                const isCurrentContent = location.pathname.startsWith('/notes') && !location.pathname.startsWith('/notes/trash');

                navigate(targetPath, { replace: !isTargetContent && !isCurrentContent });
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
