import { useAppTheme } from "@/hooks/use-app-theme";
import { useNotesStore, useSettingsStore, useTasksStore } from "@annota/core";
import { CheckCircle2, Compass, FileText, Lightbulb, Target, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";

export default function WeeklyInsights() {
    const { notes } = useNotesStore();
    const { tasks } = useTasksStore();
    const { general } = useSettingsStore();
    const { colors } = useAppTheme();

    const stats = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Zero out time so we strictly compare days

        // 1. Calculate Start of Week based on settings
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        let daysToSubtract = currentDay;

        if (general.startOfWeek === 'monday') {
            // If today is Sunday (0), go back 6 days to Monday. Otherwise, go back day - 1.
            daysToSubtract = currentDay === 0 ? 6 : currentDay - 1;
        }

        const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract);
        const startOfLastWeek = new Date(startOfThisWeek.getTime() - 7 * 24 * 60 * 60 * 1000);

        // 2. --- NOTES STATS ---
        const notesThisWeek = notes.filter(n => !n.isDeleted && new Date(n.createdAt) >= startOfThisWeek).length;
        const notesLastWeek = notes.filter(n =>
            !n.isDeleted &&
            new Date(n.createdAt) >= startOfLastWeek &&
            new Date(n.createdAt) < startOfThisWeek
        ).length;

        // 3. --- TASKS STATS ---
        // Only counting tasks that are completed AND were completed within the week windows
        const completedTasksThisWeek = tasks.filter(t =>
            t.completed &&
            t.completedAt &&
            new Date(t.completedAt) >= startOfThisWeek
        ).length;

        const completedTasksLastWeek = tasks.filter(t =>
            t.completed &&
            t.completedAt &&
            new Date(t.completedAt) >= startOfLastWeek &&
            new Date(t.completedAt) < startOfThisWeek
        ).length;
        // --- TOPICS EXPLORED STATS ---
        // Look at notes *updated* this week, map to folderId, remove nulls/undefined, and count unique ones using Set.
        const notesUpdatedThisWeek = notes.filter(n => !n.isDeleted && new Date(n.updatedAt) >= startOfThisWeek);
        const uniqueFoldersThisWeek = new Set(notesUpdatedThisWeek.map(n => n.folderId).filter(Boolean)).size;

        const notesUpdatedLastWeek = notes.filter(n =>
            !n.isDeleted &&
            new Date(n.updatedAt) >= startOfLastWeek &&
            new Date(n.updatedAt) < startOfThisWeek
        );
        const uniqueFoldersLastWeek = new Set(notesUpdatedLastWeek.map(n => n.folderId).filter(Boolean)).size;

        // --- ON-TIME RATE STATS ---
        // We need the full task arrays from the current/last week to calculate percentages
        const completedTasksThisWeekArray = tasks.filter(t => t.completed && t.completedAt && new Date(t.completedAt) >= startOfThisWeek);
        const onTimeTasksThisWeek = completedTasksThisWeekArray.filter(t => new Date(t.completedAt!).getTime() <= new Date(t.deadline).getTime()).length;

        // Prevent division by zero if they haven't completed any tasks yet
        const onTimeRateThisWeek = completedTasksThisWeekArray.length > 0
            ? Math.round((onTimeTasksThisWeek / completedTasksThisWeekArray.length) * 100)
            : 0;

        const completedTasksLastWeekArray = tasks.filter(t => t.completed && t.completedAt && new Date(t.completedAt) >= startOfLastWeek && new Date(t.completedAt) < startOfThisWeek);
        const onTimeTasksLastWeek = completedTasksLastWeekArray.filter(t => new Date(t.completedAt!).getTime() <= new Date(t.deadline).getTime()).length;

        const onTimeRateLastWeek = completedTasksLastWeekArray.length > 0
            ? Math.round((onTimeTasksLastWeek / completedTasksLastWeekArray.length) * 100)
            : 0;

        // Calculate Trends (Differences)
        return {
            notes: {
                current: notesThisWeek,
                trend: notesThisWeek - notesLastWeek,
            },
            tasks: {
                completed: completedTasksThisWeek,
                trend: completedTasksThisWeek - completedTasksLastWeek,
            },
            topics: {
                current: uniqueFoldersThisWeek,
                trend: uniqueFoldersThisWeek - uniqueFoldersLastWeek,
            },
            punctuality: {
                current: onTimeRateThisWeek,
                trend: onTimeRateThisWeek - onTimeRateLastWeek,
            }
        };
    }, [notes, tasks, general.startOfWeek]); // Added startOfWeek to dependencies

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center gap-2 shrink-0">
                <Lightbulb size={18} color={colors.primary} />
                <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-widest">
                    Weekly Insights
                </h2>
            </div>

            {/* Changed to a 2x2 Grid */}
            <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4">

                {/* 1. Tasks Insight Card */}
                <div className="bg-card rounded-2xl p-5 border border-border/40 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/15 rounded-lg text-green-500">
                            <CheckCircle2 size={20} />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Tasks Done</p>
                    </div>

                    <div className="mt-4">
                        <span className="text-3xl font-bold">{stats.tasks.completed}</span>
                        <TrendIndicator value={stats.tasks.trend} label="vs last week" />
                    </div>
                </div>

                {/* 2. Notes Insight Card */}
                <div className="bg-card rounded-2xl p-5 border border-border/40 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/15 rounded-lg text-blue-500">
                            <FileText size={20} />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Notes Created</p>
                    </div>

                    <div className="mt-4">
                        <span className="text-3xl font-bold">{stats.notes.current}</span>
                        <TrendIndicator value={stats.notes.trend} label="vs last week" />
                    </div>
                </div>

                {/* 3. Topics Explored Insight Card */}
                <div className="bg-card rounded-2xl p-5 border border-border/40 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
                            <Compass size={20} />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Topics Explored</p>
                    </div>

                    <div className="mt-4">
                        <span className="text-3xl font-bold">{stats.topics.current}</span>
                        <TrendIndicator value={stats.topics.trend} label="vs last week" />
                    </div>
                </div>

                {/* 4. Task On-Time Rate Card */}
                <div className="bg-card rounded-2xl p-5 border border-border/40 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                            <Target size={20} />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">On-Time Rate</p>
                    </div>

                    <div className="mt-4">
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold">{stats.punctuality.current}</span>
                            <span className="text-xl font-bold text-muted-foreground">%</span>
                        </div>
                        {/* Custom label so the trend shows "% vs last week" */}
                        <TrendIndicator value={stats.punctuality.trend} label="% vs last week" />
                    </div>
                </div>

            </div>
        </div>
    );
}

// Small helper component for the trend arrows
function TrendIndicator({ value, label }: { value: number; label: string }) {
    if (value === 0) return <p className="text-xs text-muted-foreground mt-2">Same as last week</p>;

    const isPositive = value > 0;
    const colorClass = isPositive ? "text-emerald-500" : "text-rose-500";
    const Icon = isPositive ? TrendingUp : TrendingDown;

    return (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${colorClass}`}>
            <Icon size={14} />
            <span>{Math.abs(value)} {label}</span>
        </div>
    );
}