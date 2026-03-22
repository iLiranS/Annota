"use client"

import { LATE_SENTENCES, ON_TIME_SENTENCES } from "@/src/pages/home/data/sentences";
import { getStorageEngine, useDbStore, useNotesStore, useTasksStore } from "@annota/core";
import { Activity, FileText, Flame, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Label, Pie, PieChart, XAxis } from "recharts";

import {
    Card,
    CardContent,
} from "@/components/ui/card";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig
} from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function ActivityInsights() {
    const { notes, folders } = useNotesStore();
    const { tasks } = useTasksStore();

    // Calendar Month Boundaries
    const { monthStart, monthEnd, daysInMonth } = useMemo(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        return { monthStart: start, monthEnd: end, daysInMonth: end.getDate() };
    }, []);

    const activityChartData = useMemo(() => {
        const data = [];
        const now = new Date();

        for (let i = 1; i <= daysInMonth; i++) {
            const day = new Date(monthStart.getFullYear(), monthStart.getMonth(), i);
            const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;

            const dayStart = new Date(day);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(day);
            dayEnd.setHours(23, 59, 59, 999);

            const dayActivitySet = new Set<string>();

            // Notes activity in this calendar month
            notes.forEach(n => {
                if (n.isDeleted) return;
                const created = new Date(n.createdAt);
                const updated = new Date(n.updatedAt);
                if (created >= dayStart && created <= dayEnd) dayActivitySet.add(`note-${n.id}`);
                if (updated >= dayStart && updated <= dayEnd) dayActivitySet.add(`note-${n.id}`);
            });

            // Tasks activity in this calendar month
            tasks.forEach(t => {
                const created = new Date(t.createdAt);
                if (created >= dayStart && created <= dayEnd) dayActivitySet.add(`task-${t.id}`);
                if (t.completed && t.completedAt) {
                    const completed = new Date(t.completedAt);
                    if (completed >= dayStart && completed <= dayEnd) dayActivitySet.add(`task-${t.id}`);
                }
            });

            data.push({
                date: dayStr,
                activity: dayActivitySet.size,
                isFuture: day > now
            });
        }
        return data;
    }, [notes, tasks, monthStart, daysInMonth]);



    const folderDistribution = useMemo(() => {
        const notesThisMonth = notes.filter(n => !n.isDeleted && new Date(n.createdAt) >= monthStart && new Date(n.createdAt) <= monthEnd);
        const folderCounts: Record<string, { count: number, icon: string }> = {};

        notesThisMonth.forEach(n => {
            const fId = n.folderId || "root";
            if (!folderCounts[fId]) {
                const folder = folders.find(f => f.id === fId);
                folderCounts[fId] = {
                    count: 0,
                    icon: folder?.icon || (fId === "root" ? "grid-outline" : "folder-outline")
                };
            }
            folderCounts[fId].count++;
        });

        return Object.entries(folderCounts).map(([id, data]) => {
            const folder = folders.find(f => f.id === id);
            return {
                id,
                name: folder ? folder.name : (id === 'system-daily-notes' ? "Daily" : "Other"),
                value: data.count,
                icon: id === 'system-daily-notes' ? "calendar" : data.icon,
                fill: id === 'system-daily-notes' ? "#8B5CF6" : folder?.color || "dimgrey"
            };
        }).sort((a, b) => b.value - a.value);
    }, [notes, folders, monthStart, monthEnd]);



    const totalNotes = useMemo(() => folderDistribution.reduce((acc, curr) => acc + curr.value, 0), [folderDistribution]);


    const completionStats = useMemo(() => {

        // Relevant tasks are those whose DEADLINE falls in the current calendar month
        const relevantTasks = tasks.filter(t => {
            const deadline = new Date(t.deadline);
            return deadline >= monthStart && deadline <= monthEnd;
        });

        const onTimeCount = relevantTasks.filter(t =>
            t.completed && t.completedAt && new Date(t.completedAt) <= new Date(t.deadline)
        ).length;

        const completedCount = relevantTasks.filter(t => t.completed).length;
        const lateCompletedCount = completedCount - onTimeCount;

        const total = relevantTasks.length;
        const onTimeRate = total > 0 ? (onTimeCount / total) * 100 : 0;
        const lateCompletedRate = total > 0 ? (lateCompletedCount / total) * 100 : 0;
        const overdueRate = total > 0 ? ((total - completedCount) / total) * 100 : 0;

        return { onTimeCount, lateCompletedCount, total, onTimeRate, lateCompletedRate, overdueRate };
    }, [tasks, monthStart, monthEnd]);

    const heatmapData = useMemo(() => {
        const max = Math.max(...activityChartData.map(d => d.activity), 1);
        return activityChartData.map(d => ({
            ...d,
            level: d.activity === 0 ? 0 : Math.ceil((d.activity / max) * 4)
        }));
    }, [activityChartData]);

    const heatmapStats = useMemo(() => {
        const todayIndex = new Date().getDate();
        // Only count days from the start of the month up to today to ensure the average is accurate
        const pastAndToday = activityChartData.slice(0, todayIndex);

        const peak = pastAndToday.length > 0 ? Math.max(...pastAndToday.map(d => d.activity)) : 0;
        const totalActivity = pastAndToday.reduce((acc, d) => acc + d.activity, 0);
        const average = pastAndToday.length > 0 ? (totalActivity / pastAndToday.length).toFixed(2) : 0;

        // Current Streak calculation
        let streak = 0;
        const pastOnly = activityChartData.filter(d => !d.isFuture);
        for (let i = pastOnly.length - 1; i >= 0; i--) {
            if (pastOnly[i].activity > 0) streak++;
            else if (i < pastOnly.length - 1) break;
        }

        return { peak, average, streak };
    }, [activityChartData]);

    const taskCompletionChartData = useMemo(() => {
        const data = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const day = new Date(monthStart.getFullYear(), monthStart.getMonth(), i);
            const dStart = new Date(day); dStart.setHours(0, 0, 0, 0);
            const dEnd = new Date(day); dEnd.setHours(23, 59, 59, 999);

            const completedOnDay = tasks.filter(t => {
                if (!t.completed || !t.completedAt) return false;
                const cAt = new Date(t.completedAt);
                return cAt >= dStart && cAt <= dEnd;
            });

            const onTimeCountDaily = completedOnDay.filter(t =>
                !t.deadline || new Date(t.completedAt!) <= new Date(t.deadline)
            ).length;
            const lateCountDaily = completedOnDay.length - onTimeCountDaily;

            data.push({
                date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                onTime: onTimeCountDaily,
                late: lateCountDaily
            });
        }
        return data;
    }, [tasks, monthStart, daysInMonth]);

    const chartConfig: ChartConfig = {
        activity: { label: "Activity", color: "var(--chart-1)" },
        onTime: { label: "On Time", color: "var(--chart-1)" },
        late: { label: "Late", color: "var(--chart-2)" },
        focus: { label: "Focus", color: "var(--accent-full)" },
        count: { label: "Interactions" },
        ...Object.fromEntries(folderDistribution.map(f => [f.name, { label: f.name, color: f.fill }]))
    };

    const [dailySentences, setDailySentences] = useState<{ onTime: string, late: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            const { currentUserId, isGuest } = useDbStore.getState();
            const prefix = isGuest ? 'guest' : `user_${currentUserId}`;
            const storage = getStorageEngine();
            const stored = await storage.getItem(`${prefix}_daily_status_sentences`);

            if (stored) {
                try {
                    setDailySentences(JSON.parse(stored));
                } catch (e) {
                    console.error("[DAILY_SENTENCES] Parse error", e);
                }
            } else {
                const onTimePicked = ON_TIME_SENTENCES[Math.floor(Math.random() * ON_TIME_SENTENCES.length)];
                const latePicked = LATE_SENTENCES[Math.floor(Math.random() * LATE_SENTENCES.length)];
                const both = { onTime: onTimePicked, late: latePicked };
                setDailySentences(both);
                await storage.setItem(`${prefix}_daily_status_sentences`, JSON.stringify(both));
            }
        };
        load();
    }, []);

    const effectiveStatus = useMemo(() => {
        const { onTimeRate, total } = completionStats;
        const isOnTime = onTimeRate >= 50 || total === 0;

        return {
            sentence: isOnTime ? (dailySentences?.onTime ?? "Stay consistent") : (dailySentences?.late ?? "Tighten timing"),
            color: isOnTime ? "text-accent-full" : "text-emerald-500/80",
            bg: isOnTime ? "bg-accent/10" : "bg-emerald-500/10"
        };
    }, [completionStats, dailySentences]);

    return (
        <div className="flex flex-col lg:grid lg:grid-cols-5 gap-3 h-full">
            {/* Left Column: Topics & Performance (3/5) */}
            <div className="lg:col-span-3 flex flex-col gap-3 min-h-0 min-w-0">
                {/* Topics Pie Chart */}
                <Card className="border-border/40 bg-card/30 shadow-none gap-0 p-3 flex flex-col overflow-hidden min-h-0">
                    <div className="pb-0 flex items-center gap-2">
                        <FileText size={12} className="text-blue-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Topics explored</span>
                    </div>

                    <CardContent className="flex-1 min-h-0 p-0 pt-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-6 px-1">
                            <ChartContainer config={chartConfig} className="aspect-square h-24 shrink-0">
                                <PieChart>
                                    <Pie
                                        data={folderDistribution}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={"65%"}
                                        outerRadius={"95%"}
                                        strokeWidth={2}
                                        stroke="var(--card)"
                                    >
                                        <Label
                                            content={({ viewBox }) => {
                                                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                                    return (
                                                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                                            <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-sm font-black">{totalNotes}</tspan>
                                                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 12} className="fill-muted-foreground text-[8px] font-bold uppercase">Total</tspan>
                                                        </text>
                                                    )
                                                }
                                            }}
                                        />
                                    </Pie>
                                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                                </PieChart>
                            </ChartContainer>

                            <div className="flex-1 grid grid-cols-1 gap-y-2 min-w-0 pr-1">
                                {folderDistribution.slice(0, 4).map((f) => {
                                    const percentage = totalNotes > 0 ? Math.round((f.value / totalNotes) * 100) : 0;
                                    return (
                                        <div key={f.id} className="flex flex-col gap-1">
                                            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-tight">
                                                <span className="truncate text-foreground/70">{f.name}</span>
                                                <span className="text-muted-foreground tabular-nums">{percentage}%</span>
                                            </div>
                                            <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-1000"
                                                    style={{ width: `${percentage}%`, backgroundColor: f.fill }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </CardContent>
                </Card>

                {/* Combined Execution Rate & Daily Chart */}
                <Card className="border-border/40 bg-card/30 shadow-none p-3 pb-0 gap-0 flex flex-col relative overflow-hidden group flex-1 min-h-0">
                    <div className="pb-3 flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Execution rate</span>
                            <div className="flex items-center gap-1">
                                <span className="text-xl font-black text-foreground/90">{Math.round(completionStats.onTimeRate)}%</span>
                                <span className={`text-[8px] font-bold uppercase ${effectiveStatus.bg} ${effectiveStatus.color} px-1 rounded-sm`}>
                                    {effectiveStatus.sentence}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                    <div className="w-1 h-1 rounded-full bg-accent-full" />
                                    <span className="text-[8px] font-bold text-foreground/40 uppercase tabular-nums">On Time</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-1 h-1 rounded-full bg-emerald-500/60" />
                                    <span className="text-[8px] font-bold text-foreground/40 uppercase tabular-nums">Late</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="h-1.5 w-full bg-muted/10 rounded-full overflow-hidden flex mb-2">
                        <div
                            className="h-full bg-accent-full transition-all duration-1000 ease-out"
                            style={{ width: `${completionStats.onTimeRate}%` }}
                        />
                        <div
                            className="h-full bg-emerald-500/50 transition-all duration-1000 ease-out"
                            style={{ width: `${completionStats.lateCompletedRate}%` }}
                        />
                        <div
                            className="h-full bg-muted-foreground/10 transition-all duration-1000 ease-out flex-1"
                        />
                    </div>

                    <div className="flex-1 min-h-0 -mx-3 bg-linear-to-t from-accent/20 to-transparent pt-4">
                        <ChartContainer config={chartConfig} className="h-16 w-full aspect-auto!">
                            <BarChart
                                accessibilityLayer
                                data={taskCompletionChartData}
                                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                            >
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                                <XAxis
                                    dataKey="date"
                                    hide
                                />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar
                                    dataKey="onTime"
                                    stackId="a"
                                    fill="var(--color-onTime)"
                                    radius={[0, 0, 0, 0]}
                                />
                                <Bar
                                    dataKey="late"
                                    stackId="a"
                                    fill="var(--color-late)"
                                    radius={[2, 2, 0, 0]}
                                />
                            </BarChart>
                        </ChartContainer>
                    </div>
                </Card>
            </div>

            {/* Right Column: Activity Heatmap (2/5) */}
            <div className="lg:col-span-2 flex flex-col gap-3 min-h-0 min-w-0">
                <Card className="border-border/40 bg-card/30 shadow-none  p-2 pb-0 gap-0 flex flex-col flex-1 overflow-hidden min-h-0 ">
                    <div className=" flex items-center gap-2 text-orange-500">
                        <div className="p-1.5 rounded-md bg-orange-500/10">
                            <Activity size={12} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Recent Activity</span>
                    </div>
                    <CardContent className="flex-1 flex flex-col items-center justify-between p-0 py-2 gap-4">
                        <TooltipProvider delayDuration={0}>
                            <div className="grid my-auto grid-cols-7 gap-1.5 shrink-0">
                                {heatmapData.map((day, i) => (
                                    <Tooltip key={day.date}>
                                        <TooltipTrigger asChild>
                                            <div
                                                className=" w-6 aspect-square rounded-[3px] transition-all duration-500 cursor-pointer hover:ring-1 hover:ring-accent-full/50 animate-pop-in"
                                                style={{
                                                    backgroundColor: 'var(--accent-full)',
                                                    "--day-opacity": day.isFuture ? 0.05 : (day.level === 0 ? 0.15 : 0.25 + (day.level * 0.18)),
                                                    animationDelay: `${i * 30}ms`
                                                } as any}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent className="px-2 py-1 text-[10px] bg-card border-border/40 text-foreground" side={i > 20 ? 'bottom' : 'top'}>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="text-foreground/60">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                                <div className="flex items-center gap-1.5 font-bold">
                                                    <span>{day.activity} interactions</span>
                                                </div>
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                ))}
                            </div>
                        </TooltipProvider>

                        <div className="w-full grid grid-cols-1 gap-2">
                            <div className="w-full flex items-center justify-between px-2 py-2 rounded-lg bg-orange-500/3 border border-orange-500/10 hover:bg-orange-500/5 transition-colors group">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-transform">
                                        <Flame size={12} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9.5px] font-bold uppercase tracking-widest text-foreground/60 leading-none">Peak day</span>
                                    </div>
                                </div>
                                <div className="text-lg font-black tabular-nums text-foreground/90 tracking-tighter">
                                    {heatmapStats.peak}<span className="text-[10px] font-bold text-foreground/30 ml-1 italic">pts</span>
                                </div>
                            </div>

                            <div className="w-full flex items-center justify-between px-2 py-2 rounded-lg bg-blue-500/3 border border-blue-500/10 hover:bg-blue-500/5 transition-colors group">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                                        <TrendingUp size={12} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9.5px] font-bold uppercase tracking-widest text-foreground/60 leading-none">Average</span>
                                    </div>
                                </div>
                                <div className="text-lg font-black tabular-nums text-foreground/90 tracking-tighter">
                                    {heatmapStats.average}<span className="text-[10px] font-bold text-foreground/30 ml-1 italic">pts</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


