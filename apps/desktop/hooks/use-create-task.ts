import { useTasksStore } from "@annota/core";
import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function useCreateTask() {
    const navigate = useNavigate();
    const location = useLocation();
    const createTaskStore = useTasksStore((s) => s.createTask);

    const createAndNavigate = useCallback(async () => {
        try {
            const task = await createTaskStore({
                title: "Untitled Task",
                description: "",
                deadline: new Date(new Date().getTime() + 60 * 60 * 1000), // 1 hour from now
                completed: false,
                isWholeDay: false,
                links: "[]",
            });

            if (task?.id) {
                navigate(`/task/${task.id}`, { state: { background: location } });
            }

            return task;
        } catch (error) {
            console.error("Failed to create task:", error);
        }
    }, [createTaskStore, navigate, location]);

    return { createAndNavigate };
}

