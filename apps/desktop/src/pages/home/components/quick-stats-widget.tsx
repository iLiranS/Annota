import { useAppTheme } from "@/hooks/use-app-theme";
import { useTasksStore } from "@annota/core";
import { CheckCircle2, Clock } from "lucide-react";
import { useMemo } from "react";

export function QuickStatsWidget() {
    const { colors } = useAppTheme();
    const { tasks } = useTasksStore();

    const stats = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayTasks = tasks.filter(task => {
            const taskDate = new Date(task.deadline);
            return (
                taskDate.getDate() === today.getDate() &&
                taskDate.getMonth() === today.getMonth() &&
                taskDate.getFullYear() === today.getFullYear()
            );
        });

        const completedToday = todayTasks.filter(t => t.completed).length;
        const totalToday = todayTasks.length;
        const totalActive = tasks.filter(t => !t.completed).length;

        return {
            tasksDoneToday: completedToday,
            tasksTotalToday: totalToday,
            totalActive: totalActive
        };
    }, [tasks]);

    return (
        <div className="flex items-center gap-6 px-4 py-2 bg-card/30 rounded-2xl border border-border/40 backdrop-blur-sm">
            <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-accent/40">
                    <CheckCircle2 size={16} style={{ color: colors.primary }} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Today</span>
                    <span className="text-sm font-bold tracking-widest">{stats.tasksDoneToday}/{stats.tasksTotalToday}</span>
                </div>
            </div>

            <div className="h-8 w-px bg-border/40" />

            <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/20">
                    <Clock size={16} className="text-amber-500" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</span>
                    <span className="text-sm font-bold">{stats.totalActive}</span>
                </div>
            </div>
        </div>
    );
}

