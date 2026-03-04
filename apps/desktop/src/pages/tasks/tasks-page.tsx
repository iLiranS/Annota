import { useNotesStore, useSettingsStore, useTasksStore, type Task } from "@annota/core";
import {
    CircleCheck,
    Plus,
    Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ConfirmDialog } from "@/components/custom-ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Ionicons } from "@/components/ui/ionicons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCreateTask } from "@/hooks/use-create-task";
import { cn } from "@/lib/utils";
import { CollapsibleGroup } from "./components/collapsible-group";
import { TaskItem } from "./components/task-item";

type GroupByOption = "none" | "folder" | "date";

export default function TasksPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { colors } = useAppTheme();
    const { createAndNavigate } = useCreateTask();

    // Stores
    const tasks = useTasksStore((s) => s.tasks);
    const loadTasks = useTasksStore((s) => s.loadTasks);
    const clearCompletedTasks = useTasksStore((s) => s.clearCompletedTasks);

    const { general, updateGeneralSettings } = useSettingsStore();
    const { getFolderById } = useNotesStore();

    const showCompleted = general.tasksShowDone;

    // Local state
    const [groupBy, setGroupBy] = useState<GroupByOption>("none");

    // Load tasks on mount
    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    const handleTaskClick = useCallback(
        (task: Task) => {
            navigate(`/task/${task.id}`, { state: { background: location } });
        },
        [navigate, location],
    );


    const cycleGroupBy = useCallback(() => {
        setGroupBy((prev) => {
            if (prev === "none") return "folder";
            if (prev === "folder") return "date";
            return "none";
        });
    }, []);

    const groupedTasks = useMemo(() => {
        const sortedTasks = [...tasks].sort(
            (a, b) => a.deadline.getTime() - b.deadline.getTime(),
        );
        const pendingTasks = sortedTasks.filter((t) => !t.completed);
        const completedTasks = sortedTasks.filter((t) => t.completed);

        if (groupBy === "none") return null;

        const groups: Map<
            string,
            {
                title: string;
                color?: string;
                icon?: string;
                tasks: Task[];
                isFolder?: boolean;
            }
        > = new Map();

        if (groupBy === "folder") {
            const processTask = (task: Task) => {
                const groupId = task.folderId || "__no_folder__";
                if (!groups.has(groupId)) {
                    const folder = task.folderId ? getFolderById(task.folderId) : null;
                    groups.set(groupId, {
                        title: folder ? folder.name : "No Folder",
                        color: folder?.color,
                        icon: folder?.icon || "folder-outline",
                        tasks: [],
                        isFolder: !!task.folderId,
                    });
                }
                groups.get(groupId)!.tasks.push(task);
            };

            pendingTasks.forEach(processTask);
            if (showCompleted) {
                completedTasks.forEach(processTask);
            }
        } else if (groupBy === "date") {
            const now = new Date();
            const todayStart = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
            );
            const tomorrowStart = new Date(todayStart);
            tomorrowStart.setDate(tomorrowStart.getDate() + 1);
            const dayAfterTomorrowStart = new Date(tomorrowStart);
            dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 1);

            pendingTasks.forEach((task) => {
                let groupId: string;
                let groupTitle: string;
                let groupColor: string | undefined;
                let groupIcon: string = "calendar-outline";

                if (task.deadline < now) {
                    groupId = "past";
                    groupTitle = "Passed";
                    groupColor = "#EF4444";
                    groupIcon = "alert-circle-outline";
                } else if (task.deadline < tomorrowStart) {
                    groupId = "today";
                    groupTitle = "Today";
                    groupColor = "#F59E0B";
                    groupIcon = "today-outline";
                } else if (task.deadline < dayAfterTomorrowStart) {
                    groupId = "tomorrow";
                    groupTitle = "Tomorrow";
                    groupIcon = "calendar-outline";
                } else {
                    groupId = "upcoming";
                    groupTitle = "Upcoming";
                    groupIcon = "calendar-number-outline";
                }

                if (!groups.has(groupId)) {
                    groups.set(groupId, {
                        title: groupTitle,
                        color: groupColor,
                        icon: groupIcon,
                        tasks: [],
                    });
                }
                groups.get(groupId)!.tasks.push(task);
            });
        }

        let result = Array.from(groups.entries()).map(([id, data]) => ({
            id,
            ...data,
        }));

        if (groupBy === "folder") {
            const noFolderGroup = result.find((g) => g.id === "__no_folder__");
            if (noFolderGroup) {
                result = result.filter((g) => g.id !== "__no_folder__");
                result.push(noFolderGroup);
            }
        }

        return result;
    }, [tasks, groupBy, showCompleted, getFolderById]);

    const pendingCount = tasks.filter((t) => !t.completed).length;
    const completedCount = tasks.filter((t) => t.completed).length;

    const handleClearCompleted = async () => {
        await clearCompletedTasks();
    };

    const getGroupByLabel = () => {
        if (groupBy === "none") return "Group";
        if (groupBy === "folder") return "Folder";
        return "Date";
    };

    return (
        <div className="flex h-full flex-col bg-background/50">
            {/* Header */}
            <header className="flex flex-col gap-4 border-b bg-background/50 px-6 py-6 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-foreground">
                            Tasks
                        </h1>
                        <p className="text-xs font-medium text-muted-foreground/60">
                            {pendingCount} pending · {completedCount} completed
                        </p>
                    </div>
                    <Button
                        size="sm"
                        className={`h-9 gap-2 rounded-full px-4 font-bold shadow-sm 
                            shadow-primary/20 transition-all hover:shadow-primary/30 hover:shadow-md active:scale-95 text-xs uppercase tracking-wider `}
                        style={{ backgroundColor: colors.primary }}
                        onClick={createAndNavigate}
                    >
                        <Plus className="h-4 w-4 stroke-3" />
                        New Task
                    </Button>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        className={cn(
                            "h-8 gap-2 rounded-lg border px-3 text-[11px] font-bold uppercase tracking-wider transition-all",
                            groupBy !== "none"
                                ? "bg-primary/10 border-primary/20 text-primary hover:bg-primary/15"
                                : "bg-muted/50 border-transparent text-muted-foreground",
                        )}
                        onClick={cycleGroupBy}
                    >
                        <Ionicons
                            name="layers-outline"
                            size={16}
                            style={{
                                color: groupBy !== "none" ? "var(--primary)" : "currentColor",
                            }}
                        />
                        {getGroupByLabel()}
                    </Button>

                    <Button
                        variant="secondary"
                        size="sm"
                        className={cn(
                            "h-8 gap-2 rounded-lg border px-3 text-[11px] font-bold uppercase tracking-wider transition-all",
                            showCompleted
                                ? "bg-primary/10 border-primary/20 text-primary hover:bg-primary/15"
                                : "bg-muted/50 border-transparent text-muted-foreground",
                        )}
                        onClick={() => updateGeneralSettings({ tasksShowDone: !showCompleted })}
                    >
                        <Ionicons
                            name={showCompleted ? "eye" : "eye-off"}
                            size={16}
                            style={{
                                color: showCompleted ? "var(--primary)" : "currentColor",
                            }}
                        />
                        Done
                    </Button>
                </div>
            </header>

            <ScrollArea className="flex-1">
                <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
                    {tasks.length === 0 && (
                        <div className="flex flex-col items-center gap-4 py-20 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                                <Ionicons
                                    name="list-checks-outline"
                                    size={24}
                                    className="h-8 w-8 text-muted-foreground/40"
                                />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-foreground">No tasks yet</h3>
                                <p className="text-sm text-muted-foreground">
                                    Add your first task to get started.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Grouped or Flat Tasks */}
                    {groupBy === "none" ? (
                        <div className="space-y-0.5">
                            {tasks
                                .filter((t) => !t.completed)
                                .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
                                .map((task) => (
                                    <TaskItem
                                        key={task.id}
                                        task={task}
                                        onClick={() => handleTaskClick(task)}
                                        showDate={true}
                                    />
                                ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {groupedTasks?.map((group) => (
                                <CollapsibleGroup
                                    key={group.id}
                                    title={group.title}
                                    color={group.color}
                                    icon={group.icon}
                                    tasks={group.tasks}
                                    hideFolder={groupBy === "folder"}
                                    onTaskClick={handleTaskClick}
                                />
                            ))}
                        </div>
                    )}

                    {/* Flat Completed Section */}
                    {showCompleted && groupBy !== "folder" && tasks.some((t) => t.completed) && (
                        <div className="space-y-3 pt-4">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-2 text-muted-foreground/60">
                                    <CircleCheck className="h-4 w-4" />
                                    <h2 className="text-[11px] font-bold uppercase tracking-widest">
                                        Completed
                                    </h2>
                                </div>
                                <ConfirmDialog
                                    title="Clear Completed?"
                                    description="Are you sure you want to permanently delete all completed tasks? This action cannot be undone."
                                    confirmText="Clear All"
                                    onConfirm={handleClearCompleted}
                                    trigger={
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 gap-1.5 rounded-md px-2 text-[10px] font-bold uppercase tracking-wider text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                            Clear
                                        </Button>
                                    }
                                />
                            </div>
                            <div className="space-y-0.5">
                                {tasks
                                    .filter((t) => t.completed)
                                    .sort((a, b) => {
                                        const aTime = a.completedAt?.getTime() ?? 0;
                                        const bTime = b.completedAt?.getTime() ?? 0;
                                        return bTime - aTime;
                                    })
                                    .map((task) => (
                                        <TaskItem
                                            key={task.id}
                                            task={task}
                                            onClick={() => handleTaskClick(task)}
                                            showDate={true}
                                        />
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
