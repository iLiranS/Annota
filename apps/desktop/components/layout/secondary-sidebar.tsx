import { cn } from "@/lib/utils";
import { useSettingsStore } from "@annota/core";
import { CheckSquare, ScrollText, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useActiveNoteId } from "../../hooks/use-active-note-id";
import { AiSidebar } from "./ai-sidebar";
import { NoteInfo } from "./note-info";
import { TasksSidebar } from "./tasks-sidebar";

export function SecondarySidebar({ width, isResizing }: { width?: number, isResizing?: boolean }) {
    const { general, updateGeneralSettings } = useSettingsStore();
    const activeTab = general.secondarySidebarTab;
    const setActiveTab = (tab: 'ai' | 'info' | 'tasks') => updateGeneralSettings({ secondarySidebarTab: tab });
    const activeNoteId = useActiveNoteId();

    // Force info tab if AI is disabled or if the active tab is a legacy value
    useEffect(() => {
        if (!general.isAiEnabled && activeTab === 'ai') {
            setActiveTab('info');
        } else if ((activeTab as any) === 'media') {
            setActiveTab('info');
        }
    }, [general.isAiEnabled, activeTab]);

    const TABS = [
        ...(general.isAiEnabled ? [{ id: 'ai' as const, label: 'AI Chat', icon: Sparkles }] : []),
        { id: 'tasks' as const, label: 'Tasks', icon: CheckSquare },
        { id: 'info' as const, label: 'Note', icon: ScrollText },
    ];

    const activeIndex = TABS.findIndex(t => t.id === activeTab);

    return (
        <div
            className="flex flex-col h-full w-full overflow-hidden"
            style={{ minWidth: isResizing ? undefined : width }}
        >
            <div className="flex flex-col h-full w-full overflow-hidden transition-all duration-300">
                <header dir="ltr" className="relative flex items-center justify-center shrink-0 h-12 px-3 bg-sidebar/60 ">
                    <div className="relative overflow-hidden flex items-center w-full max-w-[260px] h-9 p-1 rounded-xl bg-sidebar-accent/50 dark:bg-sidebar-accent/70 border border-sidebar-border/40 shadow-sm outline-none isolate">
                        {/* Sliding Active Indicator */}
                        <div
                            className="absolute top-1 bottom-1 rounded-lg bg-background shadow-sm border border-border/40 transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform-gpu"
                            style={{
                                width: `calc((100% - 8px - ${(TABS.length - 1) * 4}px) / ${TABS.length})`,
                                transform: `translateX(calc(${activeIndex} * (100% + 4px)))`,
                                left: '4px',
                                willChange: 'transform',
                            }}
                        />

                        {TABS.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className={cn(
                                    "relative z-10 flex flex-1 items-center justify-center gap-1.5 h-7 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 whitespace-nowrap focus:outline-none focus-visible:ring-0 active:transform-none",
                                    activeTab === id
                                        ? "text-primary"
                                        : "text-muted-foreground/50 hover:text-muted-foreground/80"
                                )}
                            >
                                <Icon size={12} className={cn("transition-colors duration-300", activeTab === id ? "text-accent-full" : "text-muted-foreground/40")} />
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>
                </header>

                <div dir="ltr" className="flex-1 overflow-hidden">
                    {activeTab === 'ai' ? (
                        <AiSidebar />
                    ) : activeTab === 'tasks' ? (
                        <TasksSidebar />
                    ) : (
                        activeNoteId && <NoteInfo noteId={activeNoteId} />
                    )}
                </div>
            </div>
        </div>
    );
}
