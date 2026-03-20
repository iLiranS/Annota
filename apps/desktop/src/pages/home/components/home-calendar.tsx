import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useCreateTask } from "@/hooks/use-create-task";
import { useSettingsStore, useTasksStore } from "@annota/core";
import { Plus } from "lucide-react";
import { useMemo } from "react";



export type StartOfWeek = 'sunday' | 'monday';

const MONDAY_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const SUNDAY_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getWeeklyDays(selectedDate: Date, startOfWeek: StartOfWeek = 'monday') {
    const date = new Date(selectedDate);
    const day = date.getDay();
    const diff = date.getDate() - day + (startOfWeek === 'monday' ? (day === 0 ? -6 : 1) : 0);
    const start = new Date(date.setDate(diff));

    const arr = [];
    for (let i = 0; i < 7; i++) {
        arr.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return arr;
}

export function HomeCalendar({
    selectedDate,
    onDateSelect,
}: {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
}) {
    const { tasks } = useTasksStore();
    const { startOfWeek } = useSettingsStore((s) => s.general);
    const { createAndNavigate } = useCreateTask();

    // Get only the days for the current week
    const dates = getWeeklyDays(selectedDate, startOfWeek);

    // Select the correct header array
    const displayDays = startOfWeek === 'sunday' ? SUNDAY_DAYS : MONDAY_DAYS;

    // Get today's date string for exact comparison
    const todayString = new Date().toDateString();

    const taskDatesSet = useMemo(() => {
        const set = new Set<string>();
        tasks.filter(t => !t.completed).forEach((task) => {
            const date = new Date(task.deadline);
            set.add(date.toDateString());
        });
        return set;
    }, [tasks]);

    return (
        <div className="flex flex-col gap-4">

            <div className="rounded-2xl border border-border/40 bg-card/30 p-2 text-center backdrop-blur-md">
                {/* weekdays */}
                <div className="grid grid-cols-7 text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-tighter">
                    {displayDays.map((d) => (
                        <div key={d} className="text-center">{d}</div>
                    ))}
                </div>

                {/* days */}
                <div className="grid grid-cols-7 gap-1">
                    {dates.map((date, i) => {
                        const isSelected = date.toDateString() === selectedDate.toDateString();
                        const isToday = date.toDateString() === todayString;

                        return (
                            <ContextMenu key={i}>
                                <ContextMenuTrigger asChild>
                                    <button
                                        onClick={() => onDateSelect(date)}
                                        className={`h-8 w-full rounded-lg text-xs transition relative flex flex-col items-center justify-center
                                            ${isSelected
                                                ? "bg-accent text-accent-foreground"
                                                : "hover:bg-accent/50"}
                                            ${!isSelected && isToday ? "border border-accent" : ""}
                                        `}
                                    >
                                        <span className="font-medium">{date.getDate()}</span>
                                        {!isSelected && taskDatesSet.has(date.toDateString()) && (
                                            <div className="absolute bottom-1 w-1 h-1 rounded-full bg-accent-foreground/40" />
                                        )}
                                    </button>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                    <ContextMenuItem onClick={() => createAndNavigate({ deadline: date })}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        <span>Create Task</span>
                                    </ContextMenuItem>
                                </ContextMenuContent>
                            </ContextMenu>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}