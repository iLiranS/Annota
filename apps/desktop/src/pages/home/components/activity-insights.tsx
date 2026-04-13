"use client"

import { Ionicons } from "@/components/ui/ionicons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { getStorageEngine, useDbStore, useNotesStore } from "@annota/core";
import { Activity, FileText, Flame, Target, TrendingUp, Zap } from "lucide-react";
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
import { cn } from "@/lib/utils";

export function ActivityInsights() {
    const { notes, folders } = useNotesStore();
    const { accentColor } = useAppTheme();

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

            data.push({
                date: dayStr,
                activity: dayActivitySet.size,
                isFuture: day > now
            });
        }
        return data;
    }, [notes, monthStart, daysInMonth]);



    const folderDistribution = useMemo(() => {
        const notesThisMonth = notes.filter(n => !n.isDeleted && new Date(n.createdAt) >= monthStart && new Date(n.createdAt) <= monthEnd);
        const folderCounts: Record<string, { count: number, icon: string }> = {};

        notesThisMonth.forEach(n => {
            const fId = n.folderId || "root";
            if (!folderCounts[fId]) {
                const folder = folders.find(f => f.id === fId);
                folderCounts[fId] = {
                    count: 0,
                    icon: folder?.icon || "folder-outline"
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
                icon: id === 'system-daily-notes' ? "calendar-outline" : data.icon,
                fill: id === 'system-daily-notes' ? "#8B5CF6" : folder?.color || "dimgrey"
            };
        }).sort((a, b) => b.value - a.value);
    }, [notes, folders, monthStart, monthEnd]);



    const totalNotes = useMemo(() => folderDistribution.reduce((acc, curr) => acc + curr.value, 0), [folderDistribution]);



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

        return { peak, average, streak, total: totalActivity };
    }, [activityChartData]);


    const chartConfig: ChartConfig = {
        activity: { label: "Activity", color: "var(--chart-1)" },
        focus: { label: "Focus", color: "var(--accent-full)" },
        count: { label: "Interactions" },
        ...Object.fromEntries(folderDistribution.map(f => [f.name, { label: f.name, color: f.fill }]))
    };



    return (
        <div className="flex flex-col lg:grid lg:grid-cols-5 gap-3 h-full">
            {/* Left Column: Topics & Performance (3/5) */}
            <div className="lg:col-span-3 flex flex-col gap-3 min-h-0 min-w-0">
                {/* Topics Pie Chart */}
                <Card className="border-border/40 bg-card/30 shadow-none gap-0 px-3 pt-1.5 pb-3 flex flex-col overflow-hidden min-h-0">
                    <div className="pb-0 flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-blue-500/10">
                            <FileText size={14} className="text-blue-500" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Topics explored</span>
                    </div>

                    <CardContent className="flex-1 min-h-0 p-0 pt-1.5 flex flex-col justify-between">
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
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <Ionicons name={f.icon} size={10} color={f.fill} />
                                                    <span className="truncate text-foreground/70">{f.name}</span>
                                                </div>
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

                <Card className="border-border/40 bg-card/30 shadow-none px-4 py-4 gap-4 flex flex-col flex-1 min-h-0 overflow-hidden group">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-indigo-500">
                             <div className="p-1.5 rounded-md bg-indigo-500/10">
                                <TrendingUp size={14} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Insight</span>
                        </div>
                        <p className="text-sm font-medium text-foreground/80 mt-1">
                            You've recorded <span className="text-indigo-500 font-bold">{heatmapStats.total}</span> interactions this month. 
                            Keep capturing ideas to maintain your <span className="text-purple-500 font-bold">{heatmapStats.streak} day</span> streak.
                        </p>
                    </div>
                </Card>
            </div>

            {/* Right Column: Activity Heatmap (2/5) */}
            <div className="lg:col-span-2 flex flex-col gap-3 min-h-0 min-w-0">
                <Card className="border-border/40 bg-card/30 shadow-none  p-2 pb-0 gap-0 flex flex-col flex-1 overflow-hidden min-h-0 ">
                    <div className=" flex items-center gap-2 text-orange-500">
                        <div className="p-1.5 rounded-md bg-orange-500/10">
                            <Activity size={14} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Monthly Activity</span>
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
                                                    backgroundColor: accentColor,
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

                        <div className="w-full grid grid-cols-2 gap-x-2 gap-y-1.5 px-1 pb-1 mt-auto">
                            <div className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-orange-500/5 border border-orange-500/5 group">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <Flame size={14} className="text-orange-500" />
                                    <span className="text-[8px] font-bold uppercase tracking-widest text-foreground/40 leading-none truncate">Peak</span>
                                </div>
                                <div className="flex items-baseline gap-0.5 shrink-0">
                                    <span className="text-[11px] font-black tabular-nums text-foreground/90 tracking-tight">{heatmapStats.peak}</span>
                                    <span className="text-[8.5px] font-bold text-foreground/50 w-[24px]">pts</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-blue-500/5 border border-blue-500/5 group">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <TrendingUp size={14} className="text-blue-500" />
                                    <span className="text-[8px] font-bold uppercase tracking-widest text-foreground/40 leading-none truncate">Avg</span>
                                </div>
                                <div className="flex items-baseline gap-0.5 shrink-0">
                                    <span className="text-[11px] font-black tabular-nums text-foreground/90 tracking-tight">{heatmapStats.average}</span>
                                    <span className="text-[8.5px] font-bold text-foreground/50 w-[24px]">pts</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-purple-500/5 border border-purple-500/5 group">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <Zap size={14} className="text-purple-500" />
                                    <span className="text-[8px] font-bold uppercase tracking-widest text-foreground/40 leading-none truncate">Streak</span>
                                </div>
                                <div className="flex items-baseline gap-0.5 shrink-0">
                                    <span className="text-[11px] font-black tabular-nums text-foreground/90 tracking-tight">{heatmapStats.streak}</span>
                                    <span className="text-[8.5px] font-bold text-foreground/50 w-[24px]">days</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-emerald-500/5 border border-emerald-500/5 group">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <Target size={14} className="text-emerald-500" />
                                    <span className="text-[8px] font-bold uppercase tracking-widest text-foreground/40 leading-none truncate">Total</span>
                                </div>
                                <div className="flex items-baseline gap-0.5 shrink-0">
                                    <span className="text-[11px] font-black tabular-nums text-foreground/90 tracking-tight">{heatmapStats.total}</span>
                                    <span className="text-[8.5px] font-bold text-foreground/50 w-[24px]">pts</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


