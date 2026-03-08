import { useAppTheme } from "@/hooks/use-app-theme";
import { useSettingsStore, useTasksStore } from "@annota/core";
import { ChevronLeft, ChevronRight, Newspaper } from "lucide-react";
import { useMemo, useState } from "react";

export type StartOfWeek = 'sunday' | 'monday';

const MONDAY_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const SUNDAY_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getDays(month: number, year: number, startOfWeek: StartOfWeek = 'monday') {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);

    // Calculate offset based on whether the week starts on Sunday or Monday
    const startOffset = startOfWeek === 'sunday'
        ? first.getDay()
        : (first.getDay() + 6) % 7;

    const total = last.getDate();

    const arr = [];

    for (let i = 0; i < startOffset; i++) arr.push(null);
    for (let d = 1; d <= total; d++) arr.push(new Date(year, month, d));

    return arr;
}

export function HomeCalendar({
    selectedDate,
    onDateSelect,
}: {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
}) {
    const [current, setCurrent] = useState(
        new Date(selectedDate.getFullYear(), selectedDate.getMonth())
    );

    const { tasks } = useTasksStore();
    const { startOfWeek } = useSettingsStore((s) => s.general);
    const { colors } = useAppTheme();

    const month = current.getMonth();
    const year = current.getFullYear();

    // Pass startOfWeek to getDays to calculate padding correctly
    const dates = getDays(month, year, startOfWeek);

    // Select the correct header array
    const displayDays = startOfWeek === 'sunday' ? SUNDAY_DAYS : MONDAY_DAYS;

    // Get today's date string for exact comparison
    const todayString = new Date().toDateString();

    const taskDatesSet = useMemo(() => {
        const set = new Set<string>();
        tasks.forEach((task) => {
            const date = new Date(task.deadline);
            set.add(date.toDateString());
        });
        return set;
    }, [tasks]);

    const changeMonth = (dir: number) =>
        setCurrent(new Date(year, month + dir, 1));

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center gap-2 shrink-0">
                <Newspaper size={18} color={colors.primary} />
                <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-widest">
                    Monthly Schedule
                </h2>
            </div>
            <div className="rounded-2xl border border-border/40 bg-card/30 p-4 backdrop-blur-md">
                {/* header */}
                <div className="flex items-center justify-between mb-3">
                    <button
                        onClick={() => changeMonth(-1)}
                        className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent"
                    >
                        <ChevronLeft size={16} />
                    </button>

                    <div className="text-sm font-medium">
                        {current.toLocaleString("en-US", { month: "long" })} {year}
                    </div>

                    <button
                        onClick={() => changeMonth(1)}
                        className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>

                {/* weekdays */}
                <div className="grid grid-cols-7 text-xs text-muted-foreground mb-1">
                    {displayDays.map((d) => (
                        <div key={d} className="text-center">{d}</div>
                    ))}
                </div>

                {/* days */}
                <div className="grid grid-cols-7 gap-1">
                    {dates.map((date, i) => {
                        if (!date) return <div key={i} />;

                        const isSelected = date.toDateString() === selectedDate.toDateString();
                        const isToday = date.toDateString() === todayString;

                        return (
                            <button
                                key={i}
                                onClick={() => onDateSelect(date)}
                                className={`h-9 rounded-lg text-xs transition relative flex flex-col items-center justify-center
                                    ${isSelected
                                        ? "bg-accent text-accent-foreground"
                                        : "hover:bg-accent/50"}
                                    ${!isSelected && isToday ? "border border-accent" : ""}
                                `}
                            >
                                <span>{date.getDate()}</span>
                                {!isSelected && taskDatesSet.has(date.toDateString()) && (
                                    <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-accent-foreground/40" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}