import { Ionicons } from "@/components/ui/ionicons";
import { cn } from "@/lib/utils";
import { useNotesStore, useTasksStore, type Task } from "@annota/core";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";

interface TaskItemProps {
    task: Task;
    onClick: () => void;
    showDate?: boolean;
    hideFolder?: boolean;
    isCompact?: boolean;
    className?: string;
}

export function TaskItem({ task, onClick, showDate = false, hideFolder = false, isCompact = false, className }: TaskItemProps) {
    const { toggleComplete } = useTasksStore();
    const { getFolderById } = useNotesStore();

    const linkedFolder = useMemo(() =>
        task.folderId ? getFolderById(task.folderId) : null
        , [task.folderId, getFolderById]);

    const formatTime = (date: Date): string => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const formatDate = (date: Date): string => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const isToday =
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();

        const isTomorrow =
            date.getDate() === tomorrow.getDate() &&
            date.getMonth() === tomorrow.getMonth() &&
            date.getFullYear() === tomorrow.getFullYear();

        const timeStr = formatTime(date);

        if (task.isWholeDay) {
            if (isToday) return 'Today';
            if (isTomorrow) return 'Tomorrow';
            return date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
            });
        }

        if (isToday) return `Today, ${timeStr}`;
        if (isTomorrow) return `Tomorrow, ${timeStr}`;

        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    };

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleComplete(task.id);
    };

    return (
        <button
            onClick={onClick}
            className={cn(
                "group flex w-full items-center gap-2 rounded-xl text-left transition-all duration-200 hover:bg-accent/50",
                isCompact ? "px-2 py-1" : "px-3 py-3",
                task.completed && "opacity-60",
                className
            )}
        >
            {/* Completion indicator */}
            <div
                onClick={handleToggle}
                className={cn(
                    "flex shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
                    isCompact ? "h-4 w-4" : "h-5 w-5",
                    task.completed
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30 hover:border-primary"
                )}
            >
                {task.completed && <Ionicons name="checkmark" size={isCompact ? 10 : 14} className="text-primary-foreground" />}
            </div>

            <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            "truncate font-semibold transition-all duration-200",
                            isCompact ? "text-xs" : "text-sm",
                            task.completed && "line-through text-muted-foreground"
                        )}
                    >
                        {task.title}
                    </span>

                    {linkedFolder && !hideFolder && (
                        <div
                            className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                            style={{
                                backgroundColor: `${linkedFolder.color || 'var(--primary)'}15`,
                                color: linkedFolder.color || 'var(--primary)'
                            }}
                        >
                            <Ionicons
                                name={linkedFolder.icon || "folder"}
                                size={10}
                                style={{ color: linkedFolder.color || 'var(--primary)' }}
                            />
                            <span className="truncate max-w-[80px]">{linkedFolder.name}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                {task.deadline && (
                    <div
                        className={cn(
                            "flex items-center gap-1.5 font-medium",
                            isCompact ? "text-[10px]" : "text-xs",
                            (() => {
                                if (task.completed) return "text-muted-foreground/40";
                                const now = new Date();

                                if (task.isWholeDay) {
                                    const deadlineDate = new Date(task.deadline.getFullYear(), task.deadline.getMonth(), task.deadline.getDate());
                                    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                    if (deadlineDate < todayDate) return "text-destructive";
                                    return "text-muted-foreground/60";
                                }

                                const diff = task.deadline.getTime() - now.getTime();
                                if (diff < 0) return "text-destructive";
                                if (diff < 3600000) return "text-orange-500";
                                return "text-muted-foreground/60";
                            })()
                        )}
                    >
                        {task.isWholeDay ? formatDate(task.deadline) : (showDate ? formatDate(task.deadline) : formatTime(task.deadline))}
                    </div>
                )}
                {!isCompact && <ChevronRight className="h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />}
            </div>
        </button>
    );
}
