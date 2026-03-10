import { useAppTheme } from "@/hooks/use-app-theme";
import { useCreateTask } from "@/hooks/use-create-task";
import { useTasksStore } from "@annota/core";
import { CheckCircle2, Plus } from "lucide-react";


import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DesktopTaskCard from "./desktop-task-card";

interface TasksOnboardingProps {
    selectedDate: Date;
}

export function TasksOnboarding({ selectedDate }: TasksOnboardingProps) {
    const { tasks } = useTasksStore();
    const { colors } = useAppTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const { createAndNavigate } = useCreateTask();


    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            const taskDate = new Date(task.deadline);
            return (
                taskDate.getDate() === selectedDate.getDate() &&
                taskDate.getMonth() === selectedDate.getMonth() &&
                taskDate.getFullYear() === selectedDate.getFullYear()
            );
        }).sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return a.deadline.getTime() - b.deadline.getTime();
        });
    }, [tasks, selectedDate]);

    const handleTaskPress = (id: string) => {
        navigate(`/task/${id}`, { state: { background: location } });
    };

    const handleTaskToggle = (id: string) => {
        const task = tasks.find(t => t.id === id);
        if (task) {
            useTasksStore.getState().updateTask(id, { completed: !task.completed });
        }
    };

    const handleTaskDelete = (id: string) => {
        useTasksStore.getState().deleteTask(id);
    };

    const dateLabel = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selected = new Date(selectedDate);
        selected.setHours(0, 0, 0, 0);

        if (today.getTime() === selected.getTime()) return "Today's Tasks";
        return `Tasks for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }, [selectedDate]);

    return (
        <div className="flex flex-col gap-4 lg:h-full">
            <div className="flex items-center justify-between px-1 shrink-0">
                <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} style={{ color: colors.primary }} />
                    <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-widest">{dateLabel}</h2>
                </div>
                <button
                    onClick={() => createAndNavigate({ deadline: selectedDate })}
                    className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent transition text-muted-foreground hover:text-foreground"
                    title="Create new task"
                >
                    <Plus size={16} />
                </button>
            </div>

            <div className="lg:flex-1 flex flex-col gap-2 lg:overflow-y-auto pr-1 custom-scrollbar lg:min-h-0 pb-4">
                {filteredTasks.length > 0 ? (
                    filteredTasks.map((task) => (
                        <DesktopTaskCard
                            key={task.id}
                            task={task}
                            onPress={() => handleTaskPress(task.id)}
                            onToggle={() => handleTaskToggle(task.id)}
                            onDelete={() => handleTaskDelete(task.id)}
                        />
                    ))
                ) : (
                    <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/5 p-4 text-center shrink-0">
                        <p className="text-xs text-muted-foreground italic">No tasks scheduled for this day</p>
                    </div>
                )}
            </div>
        </div>
    );
}

