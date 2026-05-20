import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NoteMetadata, useSettingsStore } from "@annota/core";
import { ScrollText, Search } from "lucide-react";
import { useState } from "react";
import { NoteActionsMenu } from "./note-actions-menu";

interface NoteFloatingActionsProps {
    onToggleSearch: () => void;
    note: NoteMetadata;
    onRevert: (content: string) => void;
    className?: string;
    direction: 'ltr' | 'rtl';
}

export function NoteFloatingActions({
    onToggleSearch,
    note,
    onRevert,
    className,
    direction
}: NoteFloatingActionsProps) {
    const [_, setIsMenuOpen] = useState(false);
    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

    const isMac = typeof window !== 'undefined' && (/Mac|iPod|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent));
    const MOD = isMac ? '⌘' : 'Ctrl';

    const { general, updateGeneralSettings } = useSettingsStore();

    const toggleNoteInfo = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!general.isSecondarySidebarOpen || general.secondarySidebarTab !== 'info') {
            updateGeneralSettings({
                isSecondarySidebarOpen: true,
                secondarySidebarTab: 'info'
            });
        } else {
            updateGeneralSettings({
                isSecondarySidebarOpen: false
            });
        }
    };

    return (
        <div className={cn(
            "flex items-center",
            "p-1",
            "rounded-2xl",
            "z-30",
            "will-change-transform",
            "bg-linear-to-r from-background/25 via-background/15 to-background/25",
            "backdrop-blur-2xl",
            "border border-background/20",
            "ring-1 ring-background/10",
            "shadow-[0_14px_30px_rgba(15,23,42,0.35)]",
            "dark:bg-linear-to-r dark:from-stone-900/70 dark:via-stone-900/40 dark:to-stone-900/70",
            "dark:border-background/20",
            "dark:ring-background/10",
            "dark:shadow-[0_18px_40px_rgba(0,0,0,0.6)]",
            className
        )}
        >
            <div className="flex items-center gap-1 flex-nowrap">
                <TooltipProvider delayDuration={0}>
                    <Tooltip
                        open={activeTooltip === 'search'}
                        onOpenChange={(o) => setActiveTooltip(o ? 'search' : null)}
                    >
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl hover:bg-white/10 dark:hover:bg-white/5 shrink-0 text-muted-foreground/60 hover:text-foreground"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSearch();
                                }}
                            >
                                <Search className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={12} className="text-[10px] font-medium">
                            Search
                            <span className="ml-2 text-[10px] opacity-60 bg-white/10 px-1 rounded-sm border border-white/10"> {MOD + ' + ' + 'F'}</span>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip
                        open={activeTooltip === 'info'}
                        onOpenChange={(o) => setActiveTooltip(o ? 'info' : null)}
                    >
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-8 w-8 rounded-xl hover:bg-white/10 dark:hover:bg-white/5 shrink-0 transition-all",
                                    general.isSecondarySidebarOpen && general.secondarySidebarTab === 'info'
                                        ? "text-primary bg-primary/10"
                                        : "text-muted-foreground/60 hover:text-foreground"
                                )}
                                onClick={toggleNoteInfo}
                            >
                                <ScrollText className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={12} className="text-[10px] font-medium">
                            Note Info
                        </TooltipContent>
                    </Tooltip>

                    <div className="shrink-0">
                        <NoteActionsMenu
                            note={note}
                            onRevert={onRevert}
                            onOpenChange={setIsMenuOpen}
                            direction={direction}
                        />
                    </div>
                </TooltipProvider>
            </div>
        </div>
    );
}
