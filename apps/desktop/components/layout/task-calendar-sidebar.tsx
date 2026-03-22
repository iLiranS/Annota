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
import DesktopTaskCard from "@/src/pages/home/components/desktop-task-card";
import { HomeCalendar } from "@/src/pages/home/components/home-calendar";
import { TaskItem } from "@/src/pages/tasks/components/task-item";
import { useNotesStore, useSettingsStore, useTasksStore, type Task } from "@annota/core";
import {
    Calendar as CalendarIcon,
    ChevronDown,
    Eye,
    EyeOff,
    Layers,
    List,
    Plus,
    TrendingUp
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const NewTaskButton = ({ onClick, className }: { onClick: () => void; className?: string }) => (
    <button
        onClick={onClick}
        className={cn(
            "flex w-full items-center justify-between px-2 py-1 hover:text-primary hover:bg-primary/10 rounded-lg text-muted-foreground  transition-all hover:opacity-100 mb-1",
            className
        )}
    >
        <span className="text-[10px] font-bold uppercase tracking-wider">New Task</span>
        <Plus size={14} className="" />
    </button>
);

export function TaskCalendarSidebar() {
    const { general, updateGeneralSettings } = useSettingsStore();
    const { tasks, toggleComplete, deleteTask } = useTasksStore();
    const { getFolderById } = useNotesStore();
    const { colors } = useAppTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const { createAndNavigate } = useCreateTask();

    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [viewMode, setViewMode] = useState<'day' | 'all'>('day');
    const [groupBy, setGroupBy] = useState<'date' | 'folder'>('date');

    const showCompleted = general.tasksShowDone;

    // Filter tasks for the selected day
    const dayTasks = useMemo(() => {
        if (!selectedDate) return [];
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

    // Upcoming tasks (only if today is selected)
    const upcomingTasks = useMemo(() => {
        const now = new Date();
        const todayStr = now.toDateString();
        const selectedStr = selectedDate?.toDateString();

        if (todayStr !== selectedStr) return [];

        const threeDaysFromNow = new Date(now);
        threeDaysFromNow.setDate(now.getDate() + 3);
        threeDaysFromNow.setHours(23, 59, 59, 999);

        return tasks.filter((task) => {
            if (task.completed || task.isWholeDay) return false;
            const d = new Date(task.deadline);
            if (d.toDateString() === todayStr) return false;
            return d > now && d <= threeDaysFromNow;
        }).sort((a, b) => a.deadline.getTime() - b.deadline.getTime()).slice(0, 3);
    }, [tasks, selectedDate]);

    // Grouping logic for "All Tasks" view
    const groupedTasks = useMemo(() => {
        if (viewMode !== 'all') return [];

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
                        title: folder ? folder.name : "Uncategorized",
                        color: folder?.color || "#eeeeee",
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

            // Pre-initialize groups for date to maintain order and ensure "Today" exists
            groups.set("past", { title: "Passed", icon: "alert-circle-outline", color: "#ef4444", tasks: [] });
            groups.set("today", { title: "Today", icon: "today-outline", color: "#3b82f6", tasks: [] });
            groups.set("upcoming", { title: "Upcoming", icon: "calendar-number-outline", color: "#10b981", tasks: [] });

            pendingTasks.forEach((task) => {
                let groupId: string;
                let groupTitle: string;
                let groupIcon: string;
                let groupColor: string;

                if (task.deadline < todayStart) {
                    groupId = "past";
                    groupTitle = "Passed";
                    groupIcon = "alert-circle-outline";
                    groupColor = "#ef4444";
                } else if (task.deadline < tomorrowStart) {
                    groupId = "today";
                    groupTitle = "Today";
                    groupIcon = "today-outline";
                    groupColor = "#3b82f6";
                } else {
                    groupId = "upcoming";
                    groupTitle = "Upcoming";
                    groupIcon = "calendar-number-outline";
                    groupColor = "#10b981";
                }

                if (!groups.has(groupId)) {
                    groups.set(groupId, {
                        title: groupTitle,
                        icon: groupIcon,
                        color: groupColor,
                        tasks: []
                    });
                }
                groups.get(groupId)!.tasks.push(task);
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
            .filter(g => g.tasks.length > 0 || g.id === "today");

        if (groupBy === 'folder') {
            return result.sort((a, b) => {
                if (a.id === "__no_folder__") return -1;
                if (b.id === "__no_folder__") return 1;
                return a.title.localeCompare(b.title);
            });
        }

        return result;
    }, [tasks, viewMode, groupBy, showCompleted, getFolderById, colors.primary]);



    const isToday = selectedDate?.toDateString() === new Date().toDateString();

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
            <div className="flex flex-1 flex-col gap-4 p-4 overflow-hidden">
                {/* View Switcher is now the top element */}
                <div className="relative flex items-center p-1 bg-muted-foreground/5 rounded-xl overflow-hidden min-h-[40px]">
                    {/* Animated background chip */}
                    <div
                        className={cn(
                            "absolute inset-y-1 w-[calc(50%-4px)]  transition-all duration-300 ease-in-out rounded-lg z-0",
                            viewMode === 'day' ? "left-1" : "left-[calc(50%+2px)]"
                        )}
                        style={{ backgroundColor: colors.primary + "80" }}
                    />
                    <button
                        className={cn(
                            "flex-1 relative flex items-center justify-center h-8 gap-2 text-[11px] font-bold transition-colors z-10 select-none",
                            viewMode === 'day' ? "text-white" : "text-muted-foreground/60 hover:text-foreground"
                        )}
                        onClick={() => setViewMode('day')}
                    >
                        <CalendarIcon size={14} className={cn("transition-colors", viewMode === 'day' ? "text-white" : "text-muted-foreground/60")} />
                        CALENDAR
                    </button>
                    <button
                        className={cn(
                            "flex-1 relative flex items-center justify-center h-8 gap-2 text-[11px] font-bold transition-colors z-10 select-none",
                            viewMode === 'all' ? "text-white" : "text-muted-foreground/60 hover:text-foreground"
                        )}
                        onClick={() => setViewMode('all')}
                    >
                        <List size={14} className={cn("transition-colors", viewMode === 'all' ? "text-white" : "text-muted-foreground/60")} />
                        TASKS
                    </button>
                </div>

                {/* Calendar Section (only visible in Day mode) */}
                {viewMode === 'day' && (
                    <HomeCalendar
                        selectedDate={selectedDate || new Date()}
                        onDateSelect={(date) => {
                            setSelectedDate(date);
                            setViewMode('day');
                        }}
                    />
                )}

                {/* Controls (Sorting/Toggling) - Only show in 'All' view */}
                {viewMode === 'all' && (
                    <div className="flex items-center gap-2 px-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 flex-1 gap-2 rounded-lg border-sidebar-border/50 bg-background/40 text-[10px] font-bold uppercase tracking-wider"
                            onClick={() => setGroupBy(prev => prev === 'date' ? 'folder' : 'date')}
                        >
                            <Layers size={12} />
                            {groupBy === 'folder' ? 'Folder' : 'Date'}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                "h-8 flex-1 gap-2 rounded-lg border-sidebar-border/50 bg-background/40 text-[10px] font-bold uppercase tracking-wider transition-all",
                                showCompleted
                                    ? "text-primary border-primary/20 bg-primary/5"
                                    : "text-muted-foreground opacity-40 hover:opacity-40"
                            )}
                            onClick={() => updateGeneralSettings({ tasksShowDone: !showCompleted })}
                        >
                            {showCompleted ? <Eye size={12} /> : <EyeOff size={12} />}
                            Done
                        </Button>
                    </div>
                )}

                <ScrollArea className="flex-1 -mx-4">
                    <div className="flex flex-col gap-4 px-4 pb-4">
                        {/* Tasks Content */}
                        <div className="space-y-4">
                            {viewMode === 'day' ? (
                                <div className="space-y-3 ">
                                    {/* New Task button for Day view */}
                                    <NewTaskButton
                                        onClick={() => createAndNavigate({ deadline: selectedDate || new Date() })}
                                    />

                                    {dayTasks.length > 0 ? (
                                        dayTasks.map((task) => (
                                            <DesktopTaskCard
                                                key={task.id}
                                                task={task}
                                                hideFolder
                                                onPress={() => handleTaskClick(task.id)}
                                                onToggle={() => toggleComplete(task.id)}
                                                onDelete={() => deleteTask(task.id)}
                                            />
                                        ))
                                    ) : (
                                        <div className="flex h-24 flex-col items-center justify-center rounded-2xl border border-dashed border-sidebar-border/50 bg-muted/5 p-4 text-center">
                                            <p className="text-[11px] text-muted-foreground italic">No tasks for this day</p>
                                        </div>
                                    )}

                                    {isToday && upcomingTasks.length > 0 && (
                                        <div className="pt-2 space-y-2">
                                            <div className="flex items-center gap-2 px-1">
                                                <TrendingUp size={12} className="text-amber-500" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Upcoming</span>
                                            </div>
                                            {upcomingTasks.map((task) => (
                                                <DesktopTaskCard
                                                    key={task.id}
                                                    task={task}
                                                    hideFolder
                                                    onPress={() => handleTaskClick(task.id)}
                                                    onToggle={() => toggleComplete(task.id)}
                                                    onDelete={() => deleteTask(task.id)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {groupedTasks.map((group) => (
                                        <Collapsible
                                            key={group.id}
                                            defaultOpen
                                            className={cn(
                                                "space-y-1 transition-all duration-300",
                                                groupBy === 'folder' && "rounded-2xl p-1.5"
                                            )}
                                            style={(groupBy === 'folder') ? {
                                                backgroundColor: `${group.color}15`,
                                                border: `1px solid ${group.color}15`
                                            } : {}}
                                        >
                                            <CollapsibleTrigger style={{ '--folder-color': group.color } as React.CSSProperties} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-(--folder-color)/10 group">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="flex h-5 w-5 items-center justify-center rounded-md"
                                                        style={{ backgroundColor: group.color ? `${group.color}15` : 'transparent' }}
                                                    >
                                                        <Ionicons
                                                            name={(group.icon as any) || "layers-outline"}
                                                            size={12}
                                                            style={{ color: group.color || 'var(--primary)' }}
                                                        />
                                                    </div>
                                                    <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                                                        {group.title}
                                                    </span>
                                                </div>
                                                <ChevronDown size={14} className="text-muted-foreground/40 transition-transform group-data-[state=closed]:-rotate-90" />
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className={cn(
                                                "space-y-0.5",
                                                groupBy === 'folder' && group.id !== "__no_folder__" && ""
                                            )}>
                                                {((groupBy === 'date' && group.id === 'today') || groupBy === 'folder') && (
                                                    <NewTaskButton
                                                        onClick={() => createAndNavigate({
                                                            folderId: groupBy === 'folder' && group.id !== "__no_folder__" ? group.id : undefined,
                                                            deadline: groupBy === 'date' ? new Date() : undefined
                                                        })}
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
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </div>
        </aside>
    );
}
