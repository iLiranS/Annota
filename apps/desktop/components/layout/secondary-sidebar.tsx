import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@annota/core";
import { Info, Pin, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useActiveNoteId } from "../../hooks/use-active-note-id";
import { AiSidebar } from "./ai-sidebar";
import { NoteInfo } from "./note-info";

export function SecondarySidebar({ width, isResizing }: { width?: number, isResizing?: boolean }) {
    const { general, updateGeneralSettings } = useSettingsStore();
    const activeTab = general.secondarySidebarTab;
    const setActiveTab = (tab: 'ai' | 'info') => updateGeneralSettings({ secondarySidebarTab: tab });
    const activeNoteId = useActiveNoteId();

    // Force info tab if AI is disabled
    useEffect(() => {
        if (!general.isAiEnabled && activeTab === 'ai') {
            setActiveTab('info');
        }
    }, [general.isAiEnabled, activeTab]);

    const isFloating = general.secondarySidebarMode === 'floating';

    return (
        <div
            className="flex flex-col h-full w-full overflow-hidden"
            style={{ minWidth: isResizing ? undefined : width }}
        >
            <div className={cn(
                "flex flex-col h-full w-full overflow-hidden transition-all duration-300",
                isFloating && "bg-sidebar  rounded-2xl border border-sidebar-border"
            )}>
                <header className="flex items-center justify-center shrink-0 h-12 px-3  bg-sidebar/60">
                    <div className="flex items-center gap-2 min-w-0">
                        {general.isAiEnabled ? (
                            <div className="flex bg-muted/40 p-0.5 rounded-xl border border-border/20">
                                <button
                                    onClick={() => setActiveTab('ai')}
                                    className={cn(
                                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                        activeTab === 'ai'
                                            ? "bg-background text-primary shadow-sm"
                                            : "text-muted-foreground/60 hover:text-muted-foreground"
                                    )}
                                >
                                    <Sparkles size={11} className={cn(activeTab === 'ai' ? "text-primary" : "text-muted-foreground/40")} />
                                    AI Chat
                                </button>
                                <button
                                    onClick={() => setActiveTab('info')}
                                    className={cn(
                                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                        activeTab === 'info'
                                            ? "bg-background text-primary shadow-sm"
                                            : "text-muted-foreground/60 hover:text-muted-foreground"
                                    )}
                                >
                                    <Info size={11} className={cn(activeTab === 'info' ? "text-primary" : "text-muted-foreground/40")} />
                                    Note Info
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-1 text-primary/80">
                                <Info size={14} />
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                    Note Info
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                        {isFloating && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-7 w-7 rounded-lg transition-all active:scale-95",
                                    general.isSecondarySidebarSticky
                                        ? "text-primary bg-primary/10 hover:bg-primary/10"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                )}
                                onClick={() => updateGeneralSettings({ isSecondarySidebarSticky: !general.isSecondarySidebarSticky })}
                                title={general.isSecondarySidebarSticky ? "Unpin (Auto-hide)" : "Pin (Keep open)"}
                            >
                                <Pin size={14} className={cn("fill-current transition-transform", general.isSecondarySidebarSticky && "rotate-45 text-accent-full")} />
                            </Button>
                        )}
                    </div>
                </header>

                <div className="flex-1 overflow-hidden">
                    {activeTab === 'ai' ? (
                        <AiSidebar isFloating={isFloating} />
                    ) : (
                        activeNoteId && <NoteInfo noteId={activeNoteId} />
                    )}
                </div>
            </div>
        </div>
    );
}
