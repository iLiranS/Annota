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
    isStandalone?: boolean;
}

export function NoteFloatingActions({
    onToggleSearch,
    note,
    onRevert,
    className,
    direction,
    isStandalone
}: NoteFloatingActionsProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
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

    const isInfoOpen = !isStandalone && general.isSecondarySidebarOpen && general.secondarySidebarTab === 'info';
    const isActive = isMenuOpen || isInfoOpen;

    return (
        <div className={cn(
            "flex items-center bg-sidebar border border-border rounded-xl top-2 transition-all duration-200",
            "z-30",
            isActive
                ? "border-border/80 shadow-xs"
                : "border-border/60 hover:border-border/80 hover:shadow-xs",
            className
        )}
        >
            <div className="flex flex-col items-center gap-0.5 flex-nowrap">
                <TooltipProvider delayDuration={0}>
                    <Tooltip
                        open={activeTooltip === 'search'}
                        onOpenChange={(o) => setActiveTooltip(o ? 'search' : null)}
                    >
                        <TooltipTrigger asChild>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl hover:bg-transparent shrink-0 text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity duration-200"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSearch();
                                }}
                            >
                                <Search className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side={direction === 'rtl' ? 'right' : 'left'} sideOffset={6} className="text-[10px] font-medium">
                            Search
                            <span className="ml-2 text-[10px] opacity-60 bg-white/10 px-1 rounded-sm border border-white/10"> {MOD + ' + ' + 'F'}</span>
                        </TooltipContent>
                    </Tooltip>

                    {!isStandalone && (
                        <Tooltip
                            open={activeTooltip === 'info'}
                            onOpenChange={(o) => setActiveTooltip(o ? 'info' : null)}
                        >
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "h-8 w-8 rounded hover:bg-transparent shrink-0 text-muted-foreground hover:text-foreground flex items-center justify-center focus-visible:ring-0 focus-visible:ring-offset-0 transition-opacity duration-200",
                                        isInfoOpen
                                            ? "opacity-100"
                                            : "opacity-60 hover:opacity-100"
                                    )}
                                    onClick={toggleNoteInfo}
                                >
                                    <div className={cn(
                                        "p-1.5 rounded transition-all ",
                                        isInfoOpen
                                            ? "text-primary bg-primary/10"
                                            : ""
                                    )}>
                                        <ScrollText className="h-3.5 w-3.5" />
                                    </div>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side={direction === 'rtl' ? 'right' : 'left'} sideOffset={6} className="text-[10px] font-medium">
                                Note Info
                            </TooltipContent>
                        </Tooltip>
                    )}

                    <div className="shrink-0">
                        <NoteActionsMenu
                            note={note}
                            onRevert={onRevert}
                            onOpenChange={setIsMenuOpen}
                            direction={direction}
                            triggerClassName={cn(
                                "transition-opacity duration-200",
                                isMenuOpen
                                    ? "opacity-100"
                                    : "opacity-60 hover:opacity-100"
                            )}
                        />
                    </div>
                </TooltipProvider>
            </div>
        </div>
    );
}
