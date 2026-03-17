"use client"

import { useNotesStore, useTasksStore } from "@annota/core";
import * as LucideIcons from "lucide-react";
import { Activity, CheckCircle2, FileText } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Label, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";

import {
    Card,
    CardContent,
} from "@/components/ui/card";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";
import { Ionicons } from "@/components/ui/ionicons";

export function ActivityInsights() {
    const { notes, folders } = useNotesStore();
    const { tasks } = useTasksStore();

    // Utility to get Date 30 days ago
    const thirtyDaysAgo = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    // 1. CHART: Total Activity Line Chart (Last 30 Days)
    // Formula: Unique count of (Notes Created/Updated + Tasks Created/Completed) per day
    const activityChartData = useMemo(() => {
        const data = [];
        const now = new Date();

        for (let i = 29; i >= 0; i--) {
            const day = new Date(now);
            day.setDate(day.getDate() - i);
            const dayStr = day.toISOString().split('T')[0];

            const dayStart = new Date(day);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(day);
            dayEnd.setHours(23, 59, 59, 999);

            const dayActivitySet = new Set<string>();

            // Notes activity
            notes.forEach(n => {
                if (n.isDeleted) return;
                const created = new Date(n.createdAt);
                const updated = new Date(n.updatedAt);
                if (created >= dayStart && created <= dayEnd) dayActivitySet.add(`note-${n.id}`);
                if (updated >= dayStart && updated <= dayEnd) dayActivitySet.add(`note-${n.id}`);
            });

            // Tasks activity
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
            });
        }
        return data;
    }, [notes, tasks]);

    // 2. CHART: Task Performance (Last 4 Weeks)
    const taskWeeksData = useMemo(() => {
        const data = [];
        const now = new Date();

        for (let i = 3; i >= 0; i--) {
            const weekEnd = new Date(now);
            weekEnd.setDate(weekEnd.getDate() - (i * 7));
            weekEnd.setHours(23, 59, 59, 999);

            const weekStart = new Date(weekEnd);
            weekStart.setDate(weekStart.getDate() - 6);
            weekStart.setHours(0, 0, 0, 0);

            const completedInWeek = tasks.filter(t => {
                if (!t.completed || !t.completedAt) return false;
                const compDate = new Date(t.completedAt);
                return compDate >= weekStart && compDate <= weekEnd;
            });

            const onTime = completedInWeek.filter(t => {
                const deadline = new Date(t.deadline);
                const compDate = new Date(t.completedAt!);
                return compDate <= deadline;
            }).length;

            const late = completedInWeek.length - onTime;

            data.push({
                week: i === 0 ? "This Week" : `${i}w ago`,
                onTime,
                late,
            });
        }
        return data;
    }, [tasks]);

    // 3. CHART: Notes Pie Chart (Last 30 Days)
    const folderDistribution = useMemo(() => {
        const notesLastMonth = notes.filter(n => !n.isDeleted && new Date(n.createdAt) >= thirtyDaysAgo);
        const folderCounts: Record<string, { count: number, icon: string }> = {};

        notesLastMonth.forEach(n => {
            const fId = n.folderId || "root";
            if (!folderCounts[fId]) {
                const folder = folders.find(f => f.id === fId);
                folderCounts[fId] = {
                    count: 0,
                    icon: folder?.icon || (fId === "root" ? "hash" : "folder")
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
    }, [notes, folders, thirtyDaysAgo]);

    const totalNotes = useMemo(() => folderDistribution.reduce((acc, curr) => acc + curr.value, 0), [folderDistribution]);

    // 4. CHART: Hourly Productivity (Deep Work Windows)
    const hourlyData = useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));

        notes.forEach(n => {
            if (n.isDeleted || new Date(n.updatedAt) < thirtyDaysAgo) return;
            const h = new Date(n.updatedAt).getHours();
            hours[h].count++;
        });

        tasks.forEach(t => {
            if (!t.completed || !t.completedAt || new Date(t.completedAt) < thirtyDaysAgo) return;
            const h = new Date(t.completedAt).getHours();
            hours[h].count++;
        });

        return hours;
    }, [notes, tasks, thirtyDaysAgo]);

    const chartConfig: ChartConfig = {
        activity: { label: "Activity", color: "var(--chart-1)" },
        onTime: { label: "On Time", color: "var(--chart-1)" },
        late: { label: "Late", color: "var(--chart-2)" },
        focus: { label: "Focus", color: "var(--accent-full)" },
        count: { label: "Interactions" },
        ...Object.fromEntries(folderDistribution.map(f => [f.name, { label: f.name, color: f.fill }]))
    };

    return (
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-3 h-full">
            {/* Left Column: Combined Activity (2/3 width) */}
            <div className="lg:col-span-2 flex flex-col gap-3">
                {/* Chart 4: Hourly Focus (New!) */}
                <Card className="py-0 gap-0 border-border/40 bg-card/50 shadow-none flex flex-col overflow-hidden">
                    <div className="px-3 pt-3 pb-0 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <LucideIcons.Zap size={14} className="text-amber-500 fill-amber-500/20" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">Peak Hours</span>
                        </div>
                    </div>
                    <CardContent className="flex-1 p-2 pt-0 gap-0">
                        <ChartContainer config={chartConfig} className="h-[80px] w-full aspect-auto">
                            <BarChart data={hourlyData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                                <XAxis
                                    dataKey="hour"
                                    hide
                                />
                                <Bar
                                    dataKey="count"
                                    fill="var(--accent-full)"
                                    radius={[2, 2, 0, 0]}
                                    opacity={0.8}
                                />
                                <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => `${String(v).padStart(2, '0')}:00`} />} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Chart 3: Total Activity */}
                <Card className="py-0 gap-0 border-border/40 bg-card/50 shadow-none flex flex-col overflow-hidden flex-1">
                    <div className="px-3 pt-3 pb-0 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity size={14} className="text-primary" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">Total Activity Trend</span>
                        </div>
                    </div>
                    <CardContent className="flex-1 p-2 pt-0 gap-0">
                        <ChartContainer config={chartConfig} className="h-full min-h-[140px] w-full aspect-auto">
                            <LineChart data={activityChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" opacity={0.15} />
                                <XAxis
                                    dataKey="date"
                                    hide={true}
                                />
                                <YAxis
                                    fontSize={9}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => v === 0 ? "" : v}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="activity"
                                    stroke="var(--accent-full)"
                                    strokeWidth={2.5}
                                    dot={false}
                                    activeDot={{ r: 3, strokeWidth: 0 }}
                                />
                                <ChartTooltip content={<ChartTooltipContent />} />
                            </LineChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Right Column: Tasks and Notes (1/3 width) */}
            <div className="flex flex-col gap-3">
                {/* Chart 1: Tasks */}
                <Card className="border-border/40 py-0 gap-0 bg-card/50 shadow-none flex flex-col overflow-hidden">
                    <div className="px-3 pt-2 pb-0 flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-green-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Tasks On-Time</span>
                    </div>
                    <CardContent className="p-2 pt-0">
                        <ChartContainer config={chartConfig} className="h-[80px] w-full aspect-auto">
                            <BarChart data={taskWeeksData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                                <XAxis
                                    dataKey="week"
                                    fontSize={8}
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={2}
                                />
                                <Bar dataKey="onTime" stackId="t" fill="palegreen" radius={[0, 0, 2, 2]} />
                                <Bar dataKey="late" stackId="t" fill="#4479FE" radius={[2, 2, 0, 0]} />
                                <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Chart 2: Notes Pie */}
                <Card className="border-border/40 py-0 gap-0 bg-card/50 shadow-none flex flex-col flex-1 overflow-hidden">
                    <div className="px-3 pt-2 pb-0 flex items-center gap-2">
                        <FileText size={12} className="text-blue-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Topics (30 Days)</span>
                    </div>
                    <CardContent className="flex-1 p-2 pt-0 flex flex-col items-center justify-center">
                        <ChartContainer config={chartConfig} className="aspect-auto h-full min-h-36 w-full">
                            <PieChart>
                                <Pie
                                    data={folderDistribution}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={40}
                                    outerRadius={65}
                                    strokeWidth={2}
                                    stroke="var(--card)"
                                >
                                    <Label
                                        content={({ viewBox }) => {
                                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                                return (
                                                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-lg font-black">{totalNotes}</tspan>
                                                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 12} className="fill-muted-foreground text-[10px] font-bold uppercase">Notes</tspan>
                                                    </text>
                                                )
                                            }
                                        }}
                                    />
                                </Pie>
                                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            </PieChart>
                        </ChartContainer>
                        <div className="w-full mt-1 space-y-0.5">
                            {folderDistribution.slice(0, 3).map((f) => {
                                return (
                                    <div key={f.id} className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tighter">
                                        <div className="flex items-center gap-1 min-w-0">
                                            <Ionicons color={f.fill} name={f.icon} size={8} className="text-muted-foreground shrink-0" />
                                            <span className="truncate text-foreground/70">{f.name}</span>
                                        </div>
                                        <span className="text-muted-foreground">{Math.round((f.value / totalNotes) * 100)}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


