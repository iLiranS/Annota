import { useTasksStore } from "@annota/core";
import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useSmartNavigate } from "./use-smart-navigate";
import { toast } from "sonner";

export function useCreateTask() {
    const navigate = useSmartNavigate();
    const location = useLocation();
    const createTaskStore = useTasksStore((s) => s.createTask);

    const createAndNavigate = useCallback(async (options?: { deadline?: Date; folderId?: string }) => {
        try {
            const { data: task, error } = await createTaskStore({
                title: "Untitled Task",
                description: "",
                deadline: options?.deadline || new Date(new Date().getTime() + 60 * 60 * 1000), // 1 hour from now
                folderId: options?.folderId,
                completed: false,
                isWholeDay: false,
                links: "[]",
            });

            if (error) {
                toast.error(error);
                return null;
            }

            if (task?.id) {
                navigate(`/task/${task.id}`, { state: { background: location } });
            }

            return { data: task, error: null };
        } catch (error: any) {
            const errorMsg = error.message || "An unexpected error occurred";
            console.error("Failed to create task:", error);
            return { data: null, error: errorMsg };
        }
    }, [createTaskStore, navigate, location]);

    return { createAndNavigate };
}

