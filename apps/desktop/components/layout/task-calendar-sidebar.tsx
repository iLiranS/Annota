import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@/components/ui/collapsible";
import { Ionicons } from "@/components/ui/ionicons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCreateTask } from "@/hooks/use-create-task";
import { cn } from "@/lib/utils";
import { TaskItem } from "@/src/pages/tasks/components/task-item";
import { useNotesStore, useSettingsStore, useTasksStore, type Task } from "@annota/core";
import {
    ChevronDown,
    Eye,
    EyeOff,
    Layers,
    Plus
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const NewTaskButton = ({ onClick, className }: { onClick: () => void; className?: string }) => (
    <button
        onClick={onClick}
        className={cn(
            "group flex w-full items-center gap-1.5 rounded-xl text-left transition-all duration-200 hover:bg-sidebar-accent/50 px-1 py-1 text-muted-foreground/40 hover:text-primary mb-0.5",
            className
        )}
    >
        <div className="flex shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 h-5 w-5 group-hover:border-primary/50 group-hover:bg-primary/5 transition-colors">
            <Plus size={12} />
        </div>
        <span className="text-[11px] font-medium select-none">Add task</span>
    </button>
);

export function TaskCalendarSidebar() {
    const { general, updateGeneralSettings } = useSettingsStore();
    const { tasks, deleteTask } = useTasksStore();
    const { getFolderById } = useNotesStore();
    const { colors } = useAppTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const { createAndNavigate } = useCreateTask();

    const [groupBy, setGroupBy] = useState<'date' | 'folder'>('date');

    const showCompleted = general.tasksShowDone;

    // Grouping logic for "All Tasks" view
    const groupedTasks = useMemo(() => {
        const sortedTasks = [...tasks].sort(
            (a, b) => a.deadline.getTime() - b.deadline.getTime(),
        );
        const pendingTasks = sortedTasks.filter((t) => !t.completed);
        const completedTasks = sortedTasks.filter((t) => t.completed);

        const groups: Map<string, { title: string; color?: string; icon?: string; tasks: Task[] }> = new Map();

        if (groupBy === "folder") {
            const processTask = (task: Task) => {
                const groupId = task.folderId || "__no_folder__";
                if (!groups.has(groupId)) {
                    const folder = task.folderId ? getFolderById(task.folderId) : null;
                    groups.set(groupId, {
                        title: folder ? folder.name : "Inbox",
                        color: folder?.color || "#1f1f1f",
                        icon: folder?.icon || "folder-outline",
                        tasks: [],
                    });
                }
                groups.get(groupId)!.tasks.push(task);
            };
            pendingTasks.forEach(processTask);
            if (showCompleted) completedTasks.forEach(processTask);
        } else {
            // Group by Date simplified for sidebar
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrowStart = new Date(todayStart);
            tomorrowStart.setDate(tomorrowStart.getDate() + 1);
            const dayAfterTomorrowStart = new Date(tomorrowStart);
            dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 1);

            // Pre-initialize groups for date to maintain order
            groups.set("past", { title: "Passed", icon: "alert-circle-outline", color: "#ef4444", tasks: [] });
            groups.set("today", { title: "Today", icon: "today-outline", color: "#3b82f6", tasks: [] });
            groups.set("tomorrow", { title: "Tomorrow", icon: "calendar-outline", color: "#8b5cf6", tasks: [] });
            groups.set("upcoming", { title: "Upcoming", icon: "calendar-number-outline", color: "#10b981", tasks: [] });

            pendingTasks.forEach((task) => {
                let groupId: string;
                if (task.deadline < todayStart) {
                    groupId = "past";
                } else if (task.deadline < tomorrowStart) {
                    groupId = "today";
                } else if (task.deadline < dayAfterTomorrowStart) {
                    groupId = "tomorrow";
                } else {
                    groupId = "upcoming";
                }

                if (groups.has(groupId)) {
                    groups.get(groupId)!.tasks.push(task);
                }
            });

            if (showCompleted && completedTasks.length > 0) {
                groups.set("completed", {
                    title: "Completed",
                    icon: "checkmark-done-circle-outline",
                    color: "#94a3b8",
                    tasks: completedTasks
                });
            }
        }

        const result = Array.from(groups.entries())
            .map(([id, data]) => ({ id, ...data }))
            .filter(g => g.tasks.length > 0 || g.id === "today" || g.id === "tomorrow");

        if (groupBy === 'folder') {
            return result.sort((a, b) => {
                if (a.id === "__no_folder__") return -1;
                if (b.id === "__no_folder__") return 1;
                return a.title.localeCompare(b.title);
            });
        }

        return result;
    }, [tasks, groupBy, showCompleted, getFolderById, colors.primary]);




    const handleTaskClick = (id: string) => {
        navigate(`/task/${id}`, { state: { background: location } });
    };

    const side = general.appDirection === 'rtl' ? 'left' : 'right';

    return (
        <aside
            dir="ltr"
            className={cn(
                "flex h-full w-72 shrink-0 flex-col overflow-hidden border-sidebar-border bg-sidebar select-none",
                side === 'right' ? "border-l" : "border-r"
            )}
        >
            <div className="flex flex-1 flex-col gap-4 pt-4 overflow-hidden">
                {/* View/Group Toggle (Tab style) */}
                <div className="px-4">
                    <div className="relative flex items-center p-1 bg-muted-foreground/5 rounded-xl overflow-hidden min-h-[36px]">
                        {/* Animated background chip */}
                        <div
                            className={cn(
                                "absolute inset-y-1 w-[calc(50%-4px)] transition-all duration-300 ease-in-out rounded-lg z-0",
                                groupBy === 'date' ? "left-1" : "left-[calc(50%+2px)]"
                            )}
                            style={{ backgroundColor: colors.primary + "40" }}
                        />
                        <button
                            className={cn(
                                "flex-1 relative flex items-center justify-center h-7 gap-1.5 text-[9px] font-bold transition-colors z-10 select-none uppercase tracking-wider",
                                groupBy === 'date' ? "text-foreground" : "text-muted-foreground/50 hover:text-foreground"
                            )}
                            onClick={() => setGroupBy('date')}
                        >
                            <Layers size={12} className={cn("transition-colors", groupBy === 'date' ? "text-primary" : "text-muted-foreground/40")} />
                            Date
                        </button>
                        <button
                            className={cn(
                                "flex-1 relative flex items-center justify-center h-7 gap-1.5 text-[9px] font-bold transition-colors z-10 select-none uppercase tracking-wider",
                                groupBy === 'folder' ? "text-foreground" : "text-muted-foreground/50 hover:text-foreground"
                            )}
                            onClick={() => setGroupBy('folder')}
                        >
                            <Ionicons name="folder-outline" size={12} className={cn("transition-colors", groupBy === 'folder' ? "text-primary" : "text-muted-foreground/40")} />
                            Folder
                        </button>
                    </div>
                </div>

                <ScrollArea className="flex-1 w-full min-w-0 overflow-hidden">
                    <div className="flex flex-col gap-4 px-4 pb-4 w-full min-w-0 overflow-x-hidden">
                        {/* Tasks Content - Using Grid to force strict width */}
                        <div className="grid grid-cols-1 w-full min-w-0 gap-4 overflow-hidden">
                            {groupedTasks.map((group) => (
                                <Collapsible
                                    key={group.id}
                                    defaultOpen
                                    className={cn(
                                        "space-y-1 transition-all duration-300 min-w-0",
                                        groupBy === 'folder' && "rounded-2xl p-1.5"
                                    )}
                                    style={(groupBy === 'folder' && group.id !== "__no_folder__") ? {
                                        backgroundColor: `${group.color}15`,
                                        border: `1px solid ${group.color}15`
                                    } : {}}
                                >
                                    <CollapsibleTrigger
                                        style={{ '--folder-color': group.color } as React.CSSProperties}
                                        className={cn(
                                            "flex w-full items-center justify-between rounded-lg py-1 px-1 hover:bg-(--folder-color)/10 group min-w-0 transition-colors",
                                        )}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div
                                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                                                style={{ backgroundColor: group.color ? `${group.color}15` : 'transparent' }}
                                            >
                                                <Ionicons
                                                    name={(group.icon as any) || "layers-outline"}
                                                    size={13}
                                                    style={{ color: group.color || 'var(--primary)' }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 truncate min-w-0 flex-1">
                                                {group.title}
                                            </span>
                                        </div>
                                        <ChevronDown size={12} className="text-muted-foreground/30 transition-transform group-data-[state=closed]:-rotate-90" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className={cn(
                                        "space-y-0.5 min-w-0 overflow-hidden w-full",
                                    )}>
                                        {((groupBy === 'date' && (group.id === 'today' || group.id === 'tomorrow')) || groupBy === 'folder') && (
                                            <NewTaskButton
                                                onClick={() => {
                                                    const deadline = new Date();
                                                    if (group.id === 'tomorrow') {
                                                        deadline.setDate(deadline.getDate() + 1);
                                                    }
                                                    createAndNavigate({
                                                        folderId: groupBy === 'folder' && group.id !== "__no_folder__" ? group.id : undefined,
                                                        deadline: groupBy === 'date' ? deadline : undefined
                                                    });
                                                }}
                                            />
                                        )}
                                        {group.tasks.map((task) => (
                                            <TaskItem
                                                key={task.id}
                                                task={task}
                                                isCompact
                                                hideFolder={groupBy === 'folder'}
                                                onClick={() => handleTaskClick(task.id)}
                                                onDelete={() => deleteTask(task.id)}
                                            />
                                        ))}
                                    </CollapsibleContent>
                                </Collapsible>
                            ))}
                            {tasks.length === 0 && (
                                <div className="text-center py-10">
                                    <p className="text-xs text-muted-foreground">No tasks found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                {/* Footer Section with Done Toggle */}
                <div className="flex items-center justify-center pb-4 pt-2 px-4 bg-sidebar border-t border-sidebar-border/20">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-7 gap-2 px-4",
                            "flex shrink-0 items-center rounded-full text-[9px] font-bold uppercase tracking-widest transition-all",
                            showCompleted
                                ? "text-primary bg-primary/10 hover:bg-primary/20"
                                : "text-muted-foreground/60 hover:text-foreground hover:bg-muted-foreground/5"
                        )}
                        onClick={() => updateGeneralSettings({ tasksShowDone: !showCompleted })}
                    >
                        {showCompleted ? <Eye size={12} /> : <EyeOff size={12} />}
                        Show Done
                    </Button>
                </div>
            </div>
        </aside>
    );
}
