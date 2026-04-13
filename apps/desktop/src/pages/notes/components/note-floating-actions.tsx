import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NoteMetadata } from "@annota/core";
import { Search } from "lucide-react";
import { useState } from "react";
import { NoteActionsMenu } from "./note-actions-menu";

interface NoteFloatingActionsProps {
    onToggleSearch: () => void;
    note: NoteMetadata;
    onRevert: (content: string) => void;
    className?: string;
}

export function NoteFloatingActions({
    onToggleSearch,
    note,
    onRevert,
    className,
}: NoteFloatingActionsProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

    const isMac = typeof window !== 'undefined' && (/Mac|iPod|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent));
    const MOD = isMac ? '⌘' : 'Ctrl';
    const SHIFT = isMac ? '⇧' : 'Shift';

    return (
        <div className={cn(
            "flex items-center",
            "p-1",
            "rounded-2xl",
            "z-30",
            "backdrop-blur-xl",
            "border border-white/10 dark:border-white/5",
            "shadow-sm",
            className
        )}>
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
                                className="h-8 w-8 rounded-xl hover:bg-white/10 dark:hover:bg-white/5 shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
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
                            <span className="ml-2 text-[10px] opacity-60 bg-white/10 px-1 rounded-sm border border-white/10"> {MOD + ' + ' + SHIFT + ' + F'}</span>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip
                        open={activeTooltip === 'more' && !isMenuOpen}
                        onOpenChange={(o) => setActiveTooltip(o ? 'more' : null)}
                    >
                        <TooltipTrigger asChild>
                            <div className="shrink-0">
                                <NoteActionsMenu
                                    note={note}
                                    onRevert={onRevert}
                                    onOpenChange={setIsMenuOpen}
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={12} className="text-[10px] font-medium">More Actions</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    );
}
