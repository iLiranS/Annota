import TasksPage from "./tasks-page";

export default function TasksLayout() {
    return (
        <div className="flex h-full w-full overflow-hidden">
            <div className="flex-1 overflow-auto">
                <TasksPage />
            </div>
        </div>
    );
}


