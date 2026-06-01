import { useSmartNavigate } from "@/hooks/use-smart-navigate";
import { cn } from "@/lib/utils";
import {
    useNotesStore,
    type PendingTask,
    type PendingTaskNote,
} from "@annota/core";
import { CheckSquare, ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface TaskNoteGroupProps {
    group: PendingTaskNote;
    onTaskComplete: (noteId: string, taskIndex: number) => Promise<void>;
    onNavigate: (noteId: string, folderId: string | null) => void;
    completingKeys: Set<string>;
}

function TaskNoteGroup({ group, onTaskComplete, onNavigate, completingKeys }: TaskNoteGroupProps) {
    const [collapsed, setCollapsed] = useState(true);

    return (
        <div className="border border-border/30 rounded-xl overflow-hidden bg-sidebar/40">
            {/* Note Header */}
            <div
                role="button"
                tabIndex={0}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left group cursor-pointer select-none outline-none"
                onClick={() => setCollapsed(c => !c)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setCollapsed(c => !c);
                    }
                }}
            >
                <ChevronDown
                    size={12}
                    className={cn(
                        "text-muted-foreground/50 transition-transform duration-200 shrink-0",
                        collapsed && "-rotate-90"
                    )}
                />
                <span className="text-[11px] font-bold text-foreground/80 truncate flex-1">
                    {group.noteTitle}
                </span>
                <span className="text-[11px] font-black uppercase  text-muted-foreground/45 shrink-0 tabular-nums">
                    {group.tasks.length}
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onNavigate(group.noteId, group.folderId);
                    }}
                    className="shrink-0  transition-opacity text-accent-full/80 hover:text-accent-full p-0.5 rounded cursor-pointer"
                    title="Open note"
                >
                    <ExternalLink size={10} />
                </button>
            </div>

            {/* Task Items */}
            {!collapsed && (
                <div className="border-t border-border/20 divide-y divide-border/10">
                    {group.tasks.map((task: PendingTask) => {
                        const key = `${group.noteId}:${task.index}`;
                        const isCompleting = completingKeys.has(key);
                        return (
                            <div
                                key={key}
                                className={cn(
                                    "flex items-start gap-2.5 px-3 py-2 group/task hover:bg-muted/20 transition-colors",
                                    isCompleting && "opacity-50 pointer-events-none"
                                )}
                            >
                                <button
                                    onClick={() => onTaskComplete(group.noteId, task.index)}
                                    disabled={isCompleting}
                                    className={cn(
                                        "mt-0.5 shrink-0 w-3.5 h-3.5 rounded border-[1.5px] border-muted-foreground/30 hover:border-primary hover:bg-primary/10 transition-all cursor-pointer active:scale-90 flex items-center justify-center",
                                        isCompleting && "border-primary bg-primary/20"
                                    )}
                                    title="Mark as complete"
                                >
                                    {isCompleting && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    )}
                                </button>
                                <span className="text-[11px] text-foreground/70 leading-snug flex-1 min-w-0 select-text">
                                    {task.text}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function TasksSidebar() {
    const groups = useNotesStore(state => state.tasks);
    const isInitialized = useNotesStore(state => state.isInitialized);
    const [completingKeys, setCompletingKeys] = useState<Set<string>>(new Set());
    const navigateSmart = useSmartNavigate();
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);



    const handleTaskComplete = useCallback(async (noteId: string, taskIndex: number) => {
        const key = `${noteId}:${taskIndex}`;
        setCompletingKeys(prev => new Set([...prev, key]));

        try {
            await useNotesStore.getState().toggleTask(noteId, taskIndex);
        } catch (err) {
            console.error('[Tasks] Failed to complete task:', err);
        } finally {
            if (mountedRef.current) {
                setCompletingKeys(prev => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                });
            }
        }
    }, []);

    const totalTasks = groups.reduce((acc, g) => acc + g.tasks.length, 0);
    const loading = !isInitialized;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/10 shrink-0">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/40">
                    {loading ? 'Loading...' : `${totalTasks} pending task${totalTasks !== 1 ? 's' : ''}`}
                </span>
            </div>

            {/* Content */}
            <div data-tauri-drag-region className="flex-1 overflow-y-auto premium-scrollbar px-2 py-2 space-y-2">
                {loading && groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <Loader2 size={20} className="animate-spin text-primary/30" />
                        <span className="text-[11px] text-muted-foreground/40 font-medium">Scanning notes...</span>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center opacity-40">
                        <CheckSquare size={28} className="text-muted-foreground/50" />
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground">All done!</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5 max-w-[140px]">
                                No pending tasks found across your notes.
                            </p>
                        </div>
                    </div>
                ) : (
                    groups.map(group => (
                        <TaskNoteGroup
                            key={group.noteId}
                            group={group}
                            onTaskComplete={handleTaskComplete}
                            onNavigate={(id) => navigateSmart(`/notes/${id}`)}
                            completingKeys={completingKeys}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
