import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NoteMetadata, useSettingsStore } from "@annota/core";
import { ChevronLeft, Maximize2, Minimize2, Search, SidebarClose } from "lucide-react";
import { useState } from "react";
import { NoteActionsMenu } from "./note-actions-menu";

interface NoteFloatingActionsProps {
    onToggleSearch: () => void;
    isNoteSidebarOpen: boolean;
    toggleNoteSidebar: () => void;
    toggleFullScreen: () => void;
    note: NoteMetadata;
    onRevert: (content: string) => void;
}

export function NoteFloatingActions({
    onToggleSearch,
    isNoteSidebarOpen,
    toggleNoteSidebar,
    toggleFullScreen,
    note,
    onRevert,
}: NoteFloatingActionsProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
    const { editor: { direction } } = useSettingsStore()

    const isMac = typeof window !== 'undefined' && (/Mac|iPod|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent));
    const MOD = isMac ? '⌘' : 'Ctrl';

    const SHIFT = isMac ? '⇧' : 'Shift';

    return (
        <div className={cn(
            "group",
            "absolute top-4 ",
            "flex items-center",
            "p-1",
            "rounded-2xl",
            "z-50",
            "overflow-hidden",
            "cursor-default",
            "transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)",
            "bg-linear-to-r from-white/15 via-white/5 to-white/15",
            "backdrop-blur-2xl",
            "border border-white/20",
            "ring-1 ring-white/10",
            "shadow-[0_7px_10px_rgba(15,23,42,0.35)]",
            "dark:bg-linear-to-r dark:from-stone-900/70 dark:via-stone-900/40 dark:to-stone-900/70",
            "dark:border-white/10",
            "dark:ring-white/5",
            "dark:shadow-[0_7px_10px_rgba(0,0,0,0.6)]",
            isMenuOpen ? "w-[210px]" : "w-11 hover:w-[210px]",
            direction === "rtl" ? "left-6" : "right-6"
        )}>
            <div className="flex items-center gap-1 w-full flex-nowrap">
                <div className="flex items-center justify-center min-w-[34px] h-[34px] shrink-0">
                    <ChevronLeft className={cn(
                        "h-4 w-4 transition-transform duration-500 text-muted-foreground/70 group-hover:text-primary",
                        isMenuOpen ? "rotate-180" : "group-hover:rotate-180",
                    )} />
                </div>

                <div className={cn(
                    "flex items-center gap-0.5 transition-all duration-300 delay-100",
                    isMenuOpen ? "opacity-100 translate-x-0" : "opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0"
                )}>
                    <TooltipProvider delayDuration={0}>
                        <Tooltip
                            open={activeTooltip === 'search'}
                            onOpenChange={(o) => setActiveTooltip(o ? 'search' : null)}
                        >
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8.5 w-8.5 rounded-xl hover:bg-white/10 dark:hover:bg-white/5 shrink-0"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleSearch();
                                    }}
                                >
                                    <Search className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={12} className="text-[10px] font-medium">
                                Search
                                <span className="ml-2 text-[10px] opacity-60 bg-white/10 px-1 rounded-sm border border-white/10"> {MOD + ' + ' + SHIFT + ' + F'}</span>
                            </TooltipContent>
                        </Tooltip>



                        <Tooltip
                            open={activeTooltip === 'sidebar'}
                            onOpenChange={(o) => setActiveTooltip(o ? 'sidebar' : null)}
                        >
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8.5 w-8.5 rounded-xl hover:bg-white/10 dark:hover:bg-white/5 shrink-0"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleNoteSidebar();
                                    }}
                                >
                                    <SidebarClose className={cn("h-4 w-4 transition-colors", isNoteSidebarOpen ? "text-primary" : "text-muted-foreground")} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={12} className="text-[10px] font-medium">Toggle Notes Sidebar</TooltipContent>
                        </Tooltip>

                        <Tooltip
                            open={activeTooltip === 'fullscreen'}
                            onOpenChange={(o) => setActiveTooltip(o ? 'fullscreen' : null)}
                        >
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8.5 w-8.5 rounded-xl hover:bg-white/10 dark:hover:bg-white/5 shrink-0"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleFullScreen();
                                    }}
                                >
                                    {isNoteSidebarOpen ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={12} className="text-[10px] font-medium">
                                {isNoteSidebarOpen ? "Focus Mode" : "Exit Focus Mode"}
                                <span className="ml-2 text-[10px] opacity-60 bg-white/10 px-1 rounded-sm border border-white/10">{MOD + ' + ' + SHIFT + ' + D'}</span>
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
                            <TooltipContent side="top" sideOffset={12} className="text-[10px] font-medium">More Actions</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </div>
    );
}

