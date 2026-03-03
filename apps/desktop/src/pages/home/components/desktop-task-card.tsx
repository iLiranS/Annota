import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Task, useNotesStore } from "@annota/core";
import { Check, Edit2, FolderIcon, Trash2 } from "lucide-react";

interface DesktopTaskCardProps {
    task: Task;
    onToggle: () => void;
    onPress: () => void;
    onDelete?: () => void;
    hideFolder?: boolean;
}

export default function DesktopTaskCard({
    task,
    onToggle,
    onPress,
    onDelete,
    hideFolder,
}: DesktopTaskCardProps) {
    const { getFolderById } = useNotesStore();
    const linkedFolder = task.folderId ? getFolderById(task.folderId) : null;

    const now = new Date();
    const isToday =
        task.deadline.getDate() === now.getDate() &&
        task.deadline.getMonth() === now.getMonth() &&
        task.deadline.getFullYear() === now.getFullYear();

    const isTaskInPast = task.deadline < now && !task.completed;

    let deadlineColor = "text-muted-foreground/80";
    if (isTaskInPast) deadlineColor = "text-destructive font-medium";
    else if (isToday) deadlineColor = "text-amber-500 font-medium";

    const formatDeadline = (date: Date | string | number): string => {
        const d = new Date(date);
        const isTodayDate =
            d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear();

        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const isTomorrow =
            d.getDate() === tomorrow.getDate() &&
            d.getMonth() === tomorrow.getMonth() &&
            d.getFullYear() === tomorrow.getFullYear();

        if (isTodayDate && !task.isWholeDay) {
            return d.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            }).toLowerCase();
        }
        if (isTomorrow) return 'Tomorrow';
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    onClick={onPress}
                    className={`
                        group flex cursor-pointer items-center gap-3 rounded-xl border border-border/40 p-3 transition-all hover:bg-accent/40
                        ${task.completed ? "opacity-60 bg-muted/30" : "bg-card"}
                    `}
                >
                    {/* Checkbox */}
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle();
                        }}
                        className={`
                            flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors hover:bg-accent cursor-pointer
                            ${task.completed ? "border-emerald-500 bg-emerald-500 hover:bg-emerald-600" : "border-muted-foreground/40"}
                        `}
                    >
                        {task.completed && <Check className="h-3.5 w-3.5 text-white" />}
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 items-center gap-3 overflow-hidden">
                        <span className={`truncate text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {task.title}
                        </span>

                        {linkedFolder && !hideFolder && (
                            <div
                                className="flex shrink-0 items-center gap-1.5 rounded bg-muted/50 px-2 py-0.5"
                            >
                                <FolderIcon className="h-3 w-3" style={{ color: linkedFolder.color || undefined }} />
                                <span className="text-[10px] font-medium" style={{ color: linkedFolder.color || undefined }}>
                                    {linkedFolder.name}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Timestamp */}
                    <span className={`shrink-0 text-xs ${deadlineColor}`}>
                        {formatDeadline(task.deadline)}
                    </span>
                </div>
            </ContextMenuTrigger>

            {onDelete && (
                <ContextMenuContent className="w-40">
                    <ContextMenuItem onClick={onPress} className="gap-2">
                        <Edit2 className="h-4 w-4" />
                        <span>Edit Task</span>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={onDelete} className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        <span>Delete Task</span>
                    </ContextMenuItem>
                </ContextMenuContent>
            )}
        </ContextMenu>
    );
}
