import { useTasksStore } from "@annota/core";
import {
    Calendar,
    CheckCircle2,
    Circle,
    ListChecks,
    Plus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default function TasksPage() {
    const navigate = useNavigate();
    const tasks = useTasksStore((s) => s.tasks);
    const toggleDone = useTasksStore((s) => s.toggleComplete);

    const pendingTasks = tasks.filter((t) => !t.completed);
    const doneTasks = tasks.filter((t) => t.completed);

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4">
                <h1 className="text-xl font-bold tracking-tight">Tasks</h1>
                <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate("/tasks/new")}
                >
                    <Plus className="h-4 w-4" />
                    New Task
                </Button>
            </div>

            <Separator />

            <ScrollArea className="flex-1 px-4 py-3">
                {pendingTasks.length === 0 && doneTasks.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                        <ListChecks className="h-12 w-12 text-border" />
                        <p className="text-sm font-medium">No tasks yet</p>
                        <p className="text-xs">Create a task to get started</p>
                    </div>
                )}

                {/* Pending tasks */}
                {pendingTasks.map((task) => (
                    <button
                        key={task.id}
                        type="button"
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
                    >
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleDone?.(task.id);
                            }}
                            className="mt-0.5 shrink-0"
                        >
                            <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{task.title}</p>
                            {task.deadline && (
                                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(task.deadline).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    </button>
                ))}

                {/* Completed tasks */}
                {doneTasks.length > 0 && (
                    <>
                        <p className="mt-4 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Completed
                        </p>
                        {doneTasks.map((task) => (
                            <button
                                key={task.id}
                                type="button"
                                onClick={() => navigate(`/tasks/${task.id}`)}
                                className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left opacity-60 transition-colors hover:bg-accent"
                            >
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleDone?.(task.id);
                                    }}
                                    className="mt-0.5 shrink-0"
                                >
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                </button>
                                <p className="truncate text-sm line-through">{task.title}</p>
                            </button>
                        ))}
                    </>
                )}
            </ScrollArea>
        </div>
    );
}
