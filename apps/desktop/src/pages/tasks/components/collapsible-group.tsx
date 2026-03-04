import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@/components/ui/collapsible";
import { Ionicons } from "@/components/ui/ionicons";
import { cn } from "@/lib/utils";
import { Task } from "@annota/core";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { TaskItem } from "./task-item";

interface CollapsibleGroupProps {
    title: string;
    tasks: Task[];
    color?: string;
    icon?: string;
    isFolder?: boolean;
    hideFolder?: boolean;
    onTaskClick: (task: Task) => void;
}

export function CollapsibleGroup({
    title,
    tasks,
    color,
    icon = "layers-outline",
    hideFolder = false,
    onTaskClick
}: CollapsibleGroupProps) {
    const [isOpen, setIsOpen] = useState(true);

    if (tasks.length === 0) return null;

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="w-full space-y-1"
        >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent/40 group">
                <div className="flex items-center gap-2.5">
                    <div
                        className="flex h-6 w-6 items-center justify-center rounded-md"
                        style={{ backgroundColor: color ? `${color}15` : 'transparent' }}
                    >
                        <Ionicons
                            name={icon}
                            size={14}
                            style={{ color: color || 'currentColor' }}
                            className={cn(!color && "text-muted-foreground")}
                        />
                    </div>
                    <span
                        className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground/80"
                    >
                        {title}
                        <span className="ml-2 text-[10px] lowercase font-medium text-muted-foreground/40">
                            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                        </span>
                    </span>
                </div>
                <ChevronDown
                    className={cn(
                        "h-4 w-4 text-muted-foreground/30 transition-transform duration-200",
                        !isOpen && "-rotate-90"
                    )}
                />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 px-1 py-1 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                {tasks.map((task) => (
                    <TaskItem
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick(task)}
                        hideFolder={hideFolder}
                    />
                ))}
            </CollapsibleContent>
        </Collapsible>
    );
}
