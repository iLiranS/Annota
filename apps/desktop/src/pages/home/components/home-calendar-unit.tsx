import { useAppTheme } from "@/hooks/use-app-theme";
import { useTasksStore } from "@annota/core";
import { Newspaper, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DesktopTaskCard from "./desktop-task-card";
import { HomeCalendar } from "./home-calendar";

interface HomeCalendarUnitProps {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
}

export function HomeCalendarUnit({ selectedDate, onDateSelect }: HomeCalendarUnitProps) {
    const { tasks } = useTasksStore();
    const { colors } = useAppTheme();
    const navigate = useNavigate();
    const location = useLocation();


    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            const taskDate = new Date(task.deadline);
            return (
                taskDate.getDate() === selectedDate.getDate() &&
                taskDate.getMonth() === selectedDate.getMonth() &&
                taskDate.getFullYear() === selectedDate.getFullYear()
            );
        }).sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return a.deadline.getTime() - b.deadline.getTime();
        });
    }, [tasks, selectedDate]);

    const upcomingTasks = useMemo(() => {
        const now = new Date();
        const todayStr = now.toDateString();
        const selectedStr = selectedDate.toDateString();

        if (todayStr !== selectedStr) return [];

        const threeDaysFromNow = new Date(now);
        threeDaysFromNow.setDate(now.getDate() + 3);
        threeDaysFromNow.setHours(23, 59, 59, 999);

        return tasks.filter((task) => {
            if (task.completed || task.isWholeDay) return false;
            const d = new Date(task.deadline);
            if (d.toDateString() === todayStr) return false; // Already in filteredTasks
            return d > now && d <= threeDaysFromNow;
        }).sort((a, b) => a.deadline.getTime() - b.deadline.getTime()).slice(0, 3);
    }, [tasks, selectedDate]);

    const handleTaskPress = (id: string) => {
        navigate(`/task/${id}`, { state: { background: location } });
    };

    const handleTaskToggle = (id: string) => {
        const task = tasks.find(t => t.id === id);
        if (task) {
            useTasksStore.getState().updateTask(id, { completed: !task.completed });
        }
    };

    const handleTaskDelete = (id: string) => {
        useTasksStore.getState().deleteTask(id);
    };

    const isToday = useMemo(() => {
        return new Date().toDateString() === selectedDate.toDateString();
    }, [selectedDate]);


    return (
        <div className="flex flex-col gap-6 h-full p-2 rounded-3xl border border-border/40 bg-card/10 backdrop-blur-xl">
            {/* Calendar Section */}
            <div className="flex flex-col gap-4 px-2">
                <div className="flex items-center gap-2 shrink-0 pt-2">
                    <Newspaper size={16} style={{ color: colors.primary }} />
                    <h2 className="text-xs font-bold text-foreground/70 uppercase tracking-widest">
                        Weekly Schedule
                    </h2>
                </div>
                <HomeCalendar selectedDate={selectedDate} onDateSelect={onDateSelect} />
            </div>

            {/* Divider */}
            <div className="h-px bg-border/20 mx-2" />

            {/* Tasks Section */}
            <div className="flex-1 min-h-0 flex flex-col gap-4 px-2">
                <div className="flex-1 lg:overflow-y-auto custom-scrollbar flex flex-col gap-2 min-h-0 pb-2">
                    {filteredTasks.length > 0 ? (
                        filteredTasks.map((task) => (
                            <DesktopTaskCard
                                key={task.id}
                                task={task}
                                onPress={() => handleTaskPress(task.id)}
                                onToggle={() => handleTaskToggle(task.id)}
                                onDelete={() => handleTaskDelete(task.id)}
                            />
                        ))
                    ) : (
                        <div className="flex h-20 flex-col items-center justify-center rounded-xl border border-dashed border-border/40 bg-muted/5 p-4 text-center shrink-0">
                            <p className="text-[10px] text-muted-foreground italic">No tasks scheduled</p>
                        </div>
                    )}

                    {/* Upcoming Tasks Section */}
                    {isToday && upcomingTasks.length > 0 && (
                        <div className="mt-4 flex flex-col gap-3">
                            <div className="flex items-center gap-2 px-1">
                                <TrendingUp size={12} className="text-amber-500" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Upcoming Tasks</span>
                            </div>
                            {upcomingTasks.map((task) => (
                                <DesktopTaskCard
                                    key={task.id}
                                    task={task}
                                    onPress={() => handleTaskPress(task.id)}
                                    onToggle={() => handleTaskToggle(task.id)}
                                    onDelete={() => handleTaskDelete(task.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
