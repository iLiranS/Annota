import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNotesStore, useTasksStore } from "@annota/core";
import { Flame, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function PersonalMomentum() {
    const { notes } = useNotesStore();
    const { tasks } = useTasksStore();

    // 1. Daily Focus (Persisted in LocalStorage)
    const [focus, setFocus] = useState(() => localStorage.getItem("annota_daily_focus") || "");
    const today = useMemo(() => new Date().toLocaleString('en-US', { month: 'long', day: 'numeric' }), []);

    useEffect(() => {
        localStorage.setItem("annota_daily_focus", focus);
    }, [focus]);

    // 2. Activity Data (Last 7 days) - Optimized for large note/task volumes
    const activityData = useMemo(() => {
        const data = Array(7).fill(0);
        const now = new Date();
        now.setHours(23, 59, 59, 999);
        const nowMs = now.getTime();
        const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
        const dayMs = 24 * 60 * 60 * 1000;

        // Count notes created per day - using raw timestamps where possible
        for (let i = 0; i < notes.length; i++) {
            const note = notes[i];
            if (note.isDeleted) continue;

            const time = typeof note.createdAt === 'object' ? (note.createdAt as Date).getTime() : new Date(note.createdAt).getTime();
            if (time > weekAgoMs && time <= nowMs) {
                const diff = Math.floor((nowMs - time) / dayMs);
                if (diff >= 0 && diff < 7) {
                    data[6 - diff]++;
                }
            }
        }

        // Count tasks completed per day
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            if (task.completed && task.completedAt) {
                const time = typeof task.completedAt === 'object' ? (task.completedAt as Date).getTime() : new Date(task.completedAt).getTime();
                if (time > weekAgoMs && time <= nowMs) {
                    const diff = Math.floor((nowMs - time) / dayMs);
                    if (diff >= 0 && diff < 7) {
                        data[6 - diff]++;
                    }
                }
            }
        }

        return data;
    }, [notes, tasks]);

    const maxActivity = Math.max(...activityData, 1);


    return (

        <div className="lg:flex-1 bg-card rounded-2xl p-4 border border-border/40 shadow-sm relative overflow-hidden group flex flex-col gap-3 transition-colors duration-500">


            {/* Section 1: Daily Focus */}
            <div className="relative z-10 space-y-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-primary/60">
                        <Target size={12} />
                        <span className="text-[9px] font-bold uppercase tracking-widest">Daily Focus</span>
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-widest">{today}</p>
                </div>
                <input
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    placeholder="Daily goal?"
                    className="bg-transparent border-none text-sm font-bold placeholder:text-muted-foreground/20 focus:outline-none w-full tracking-tight"
                />
            </div>

            {/* Section 2: Activity Visualizer */}


            <div className="flex items-end justify-between h-8 gap-1 px-1">
                {activityData.map((count, i) => (
                    <Tooltip key={i}>
                        <TooltipTrigger asChild>
                            <div
                                className="flex-1 bg-primary/10 rounded-t-[2px] transition-all relative cursor-default hover:bg-primary/20"
                                style={{ height: `${(count / maxActivity) * 100}%`, minHeight: '3px' }}
                            />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="text-[10px] font-medium">{count} actions</p>
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>

            <div className="flex self-end items-center gap-0.5  text-orange-500">
                <Flame size={10} fill="currentColor" />
                <span className="text-[9px] font-black italic">Activity</span>
            </div>
        </div>

    );
}
