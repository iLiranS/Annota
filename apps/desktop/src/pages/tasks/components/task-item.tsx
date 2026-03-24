import { Ionicons } from "@/components/ui/ionicons";
import { cn } from "@/lib/utils";
import { useNotesStore, useTasksStore, type Task } from "@annota/core";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface TaskItemProps {
    task: Task;
    onClick: () => void;
    onDelete?: () => void;
    showDate?: boolean;
    hideFolder?: boolean;
    isCompact?: boolean;
    className?: string;
}

export function TaskItem({ task, onClick, onDelete, showDate = false, hideFolder = false, isCompact = false, className }: TaskItemProps) {
    const { toggleComplete } = useTasksStore();
    const { getFolderById } = useNotesStore();

    const linkedFolder = useMemo(() =>
        task.folderId ? getFolderById(task.folderId) : null
        , [task.folderId, getFolderById]);

    const isBeforeToday = useMemo(() => {
        if (!task.deadline) return false;
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return task.deadline < todayStart;
    }, [task.deadline]);

    const formatTime = (date: Date): string => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const formatDate = (date: Date): string => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        const isToday = d.getTime() === today.getTime();
        const isTomorrow = d.getTime() === tomorrow.getTime();
        const isYesterday = d.getTime() === yesterday.getTime();

        const timeStr = formatTime(date);

        if (isToday) return task.isWholeDay ? 'Today' : `Today, ${timeStr}`;
        if (isTomorrow) return task.isWholeDay ? 'Tomorrow' : `Tomorrow, ${timeStr}`;
        if (isYesterday) return 'Yesterday';

        if (d < yesterday) {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
            });
        }

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
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <button
                    onClick={onClick}
                    className={cn(
                        "group flex w-full max-w-full overflow-hidden items-center gap-1.5 rounded-xl text-left transition-all duration-200 hover:bg-sidebar-accent/50",
                        isCompact ? "px-1 py-1" : "px-3 py-3",
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
                                ? "border-(--folder-color) bg-(--folder-color)"
                                : "border-muted-foreground/30 hover:border-(--folder-color)"
                        )}
                        style={{
                            '--folder-color': linkedFolder?.color || 'var(--primary)'
                        } as React.CSSProperties}
                    >
                        {task.completed && <Ionicons name="checkmark" size={isCompact ? 10 : 14} className="text-primary-foreground" />}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                        <div className={cn("flex items-center min-w-0", isCompact ? "gap-1" : "gap-2")}>
                            <span
                                className={cn(
                                    "truncate flex-1 min-w-0 font-semibold transition-all duration-200",
                                    isCompact ? "text-xs" : "text-sm",
                                    task.completed && "line-through text-muted-foreground"
                                )}
                            >
                                {task.title}
                            </span>

                            {linkedFolder && !hideFolder && (
                                <div
                                    className={cn(
                                        "flex shrink-0 items-center rounded-full text-[10px] font-bold uppercase tracking-wider",
                                        isCompact ? "gap-1 px-1.5 py-0.5" : "gap-1.5 px-2 py-0.5"
                                    )}
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
                                    <span className={cn("truncate", isCompact ? "max-w-[50px]" : "max-w-[80px]")}>{linkedFolder.name}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={cn("flex shrink-0 items-center", isCompact ? "gap-1" : "gap-2")}>
                        {task.deadline && (
                            <div
                                className={cn(
                                    "flex items-center gap-1 font-medium",
                                    isCompact ? "text-[9px]" : "text-xs",
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
                                {task.isWholeDay || showDate || isBeforeToday ? formatDate(task.deadline) : formatTime(task.deadline)}
                            </div>
                        )}
                        {!isCompact && <ChevronRight className="h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />}
                    </div>
                </button>
            </ContextMenuTrigger>

            {onDelete && (
                <ContextMenuContent className="w-40">
                    <ContextMenuItem onClick={onClick} className="gap-2">
                        <Pencil size={14} />
                        <span>Edit Task</span>
                    </ContextMenuItem>
                    <ContextMenuItem 
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }} 
                        className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                        <Trash2 size={14} />
                        <span>Delete Task</span>
                    </ContextMenuItem>
                </ContextMenuContent>
            )}
        </ContextMenu>
    );
}
