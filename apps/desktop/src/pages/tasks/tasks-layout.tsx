import { Outlet, useParams } from "react-router-dom";
import TasksPage from "./tasks-page";

export default function TasksLayout() {
    const { id } = useParams<{ id: string }>();

    return (
        <div className="flex h-screen w-full">
            <div className="flex-1 overflow-auto">
                <TasksPage />
            </div>
            {id && (
                <div className="w-[360px] min-w-[360px] border-l border-border overflow-auto">
                    <Outlet />
                </div>
            )}
        </div>
    );
}
