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
        <div className="flex flex-col lg:flex-1 gap-4 lg:h-full">
            <div className="flex items-center gap-2 shrink-0">
                <Lightbulb size={18} color={colors.primary} />
                <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-widest">
                    Weekly Insights
                </h2>
            </div>

            {/* Changed to a 2x2 grid to fit in the new column layout */}
            <div className="lg:flex-1 grid grid-cols-2 gap-3">

                {/* 1. Tasks Insight Card */}
                <div className="group bg-card hover:bg-card/80 transition-all duration-300 rounded-2xl p-4 border border-border/40 flex items-center justify-between gap-2 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-green-500/10 transition-colors" />

                    <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 bg-green-500/15 rounded-lg text-green-500 shrink-0 shadow-inner">
                            <CheckCircle2 size={16} />
                        </div>
                        <p className="text-[10px] font-bold text-foreground/70 uppercase tracking-widest whitespace-nowrap">Tasks Done</p>
                    </div>

                    <div className="text-right z-10">
                        <span className="text-2xl font-black tracking-tighter text-foreground/90">{stats.tasks.completed}</span>
                    </div>

                    <div className="absolute bottom-1.5 right-3">
                        <TrendIndicator value={stats.tasks.trend} label="vs last week" />
                    </div>
                </div>

                {/* 2. Notes Insight Card */}
                <div className="group bg-card hover:bg-card/80 transition-all duration-300 rounded-2xl p-4 border border-border/40 flex items-center justify-between gap-2 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-blue-500/10 transition-colors" />

                    <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 bg-blue-500/15 rounded-lg text-blue-500 shrink-0 shadow-inner">
                            <FileText size={16} />
                        </div>
                        <p className="text-[10px] font-bold text-foreground/70 uppercase tracking-widest whitespace-nowrap">New Notes</p>
                    </div>

                    <div className="text-right z-10">
                        <span className="text-2xl font-black tracking-tighter text-foreground/90">{stats.notes.current}</span>
                    </div>

                    <div className="absolute bottom-1.5 right-3">
                        <TrendIndicator value={stats.notes.trend} label="vs last week" />
                    </div>
                </div>

                {/* 3. Topics Explored Insight Card */}
                <div className="group bg-card hover:bg-card/80 transition-all duration-300 rounded-2xl p-4 border border-border/40 flex items-center justify-between gap-2 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-purple-500/10 transition-colors" />

                    <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-500 shrink-0 shadow-inner">
                            <Compass size={16} />
                        </div>
                        <p className="text-[10px] font-bold text-foreground/70 uppercase tracking-widest whitespace-nowrap">Topics Explored</p>
                    </div>

                    <div className="text-right z-10">
                        <span className="text-2xl font-black tracking-tighter text-foreground/90">{stats.topics.current}</span>
                    </div>

                    <div className="absolute bottom-1.5 right-3">
                        <TrendIndicator value={stats.topics.trend} label="vs last week" />
                    </div>
                </div>

                {/* 4. Task On-Time Rate Card */}
                <div className="group bg-card hover:bg-card/80 transition-all duration-300 rounded-2xl p-4 border border-border/40 flex items-center justify-between gap-2 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-amber-500/10 transition-colors" />

                    <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-500 shrink-0 shadow-inner">
                            <Target size={16} />
                        </div>
                        <p className="text-[10px] font-bold text-foreground/70 uppercase tracking-widest whitespace-nowrap">Tasks On Time</p>
                    </div>

                    <div className="text-right z-10">
                        <div className="flex items-baseline justify-end gap-0.5 ">
                            <span className="text-2xl font-black tracking-tighter text-foreground/90">{stats.punctuality.current}</span>
                            <span className="text-xs font-black text-muted-foreground/70">%</span>
                        </div>
                    </div>

                    <div className="absolute bottom-1.5 right-3">
                        <TrendIndicator value={stats.punctuality.trend} label="% vs week" />
                    </div>
                </div>

            </div>
        </div>
    );
}

// Small helper component for the trend arrows
function TrendIndicator({ value, label }: { value: number; label: string }) {
    if (value === 0) return null; // Removed "Same as last week" to save even more space

    const isPositive = value > 0;
    const colorClass = isPositive ? "text-emerald-500" : "text-rose-500";
    const Icon = isPositive ? TrendingUp : TrendingDown;

    return (
        <div className={`flex items-center justify-end gap-0.5 text-[9px] font-medium ${colorClass}`}>
            <Icon size={10} />
            <span className="whitespace-nowrap">{Math.abs(value)} {label}</span>
        </div>
    );
}