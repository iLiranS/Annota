import { useNotesStore, useSettingsStore, useTasksStore, useUserStore } from "@annota/core";
import { CheckCircle2, FileText } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DesktopNoteCard from "./components/desktop-note-card";
import DesktopTaskCard from "./components/desktop-task-card";

export default function HomePage() {
    const navigate = useNavigate();

    // User Data
    const session = useUserStore((state) => state.session);
    const globalDisplayName = useUserStore((state) => state.displayName);
    const fallbackName = session?.user?.user_metadata?.display_name || session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || "Guest";
    const displayName = globalDisplayName || fallbackName;

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'Good Morning';
        if (hour >= 12 && hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    }, []);

    // Stores
    const { editor } = useSettingsStore();
    const { tasks } = useTasksStore();
    const { notes, createNote, deleteNote, togglePin, toggleQuickAccess } = useNotesStore();

    // Notes Data
    const recentNotes = useMemo(() => {
        return [...notes]
            .filter((n) => !n.isDeleted)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, 10); // Show top 10 recent
    }, [notes]);

    // Tasks Data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayTasks = useMemo(() => {
        return tasks.filter((task) => {
            const taskDate = new Date(task.deadline);
            return (
                taskDate.getDate() === today.getDate() &&
                taskDate.getMonth() === today.getMonth() &&
                taskDate.getFullYear() === today.getFullYear()
            );
        }).sort((a, b) => {
            // Uncompleted first
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return a.deadline.getTime() - b.deadline.getTime();
        });
    }, [tasks, today]);

    // Handlers
    const handleNotePress = (id: string, folderId: string | null) => {
        navigate(`/notes/${folderId || 'root'}/${id}`);
    };

    const handleTaskPress = (id: string) => {
        navigate(`/tasks/${id}`);
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

    return (
        <div className="flex h-full flex-col overflow-y-auto bg-background p-8">
            {/* Header Greeting */}
            <header className="mb-10">
                <h1 className="text-3xl font-light tracking-tight text-foreground" style={{ fontFamily: editor.fontFamily }}>
                    {greeting}, <span className="font-semibold text-primary">{displayName}</span>
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
            </header>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Left Column: Notes (Takes up more space) */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-5 w-5 text-indigo-500" />
                        <h2 className="text-lg font-semibold text-foreground/90">Recent Notes</h2>
                    </div>
                    {recentNotes.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {recentNotes.map((note) => (
                                <DesktopNoteCard
                                    key={note.id}
                                    note={note}
                                    onPress={() => handleNotePress(note.id, note.folderId)}
                                    onDelete={() => deleteNote(note.id)}
                                    onTogglePin={() => togglePin(note.id)}
                                    onToggleQuickAccess={() => toggleQuickAccess(note.id)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20">
                            <p className="text-sm text-muted-foreground">No recent notes</p>
                        </div>
                    )}
                </div>

                {/* Right Column: Tasks Focus */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        <h2 className="text-lg font-semibold text-foreground/90">Today's Tasks</h2>
                    </div>
                    {todayTasks.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {todayTasks.map((task) => (
                                <DesktopTaskCard
                                    key={task.id}
                                    task={task}
                                    onPress={() => handleTaskPress(task.id)}
                                    onToggle={() => handleTaskToggle(task.id)}
                                    onDelete={() => handleTaskDelete(task.id)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20">
                            <p className="text-sm text-muted-foreground">No tasks for today</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
