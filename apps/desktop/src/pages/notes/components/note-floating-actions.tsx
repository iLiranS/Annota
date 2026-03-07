import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NoteMetadata } from "@annota/core";
import { ChevronLeft, Maximize2, Minimize2, Search, SidebarClose } from "lucide-react";
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
    return (
        <div className="
            group
            absolute top-4 right-6
            flex items-center
            p-1
            rounded-2xl
            z-50
            overflow-hidden
            cursor-default

            w-11 hover:w-[210px]
            transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)

            bg-linear-to-r from-white/15 via-white/5 to-white/15
            backdrop-blur-2xl
            border border-white/20
            ring-1 ring-white/10
            shadow-[0_14px_30px_rgba(15,23,42,0.35)]

            dark:bg-linear-to-r dark:from-stone-900/70 dark:via-stone-900/40 dark:to-stone-900/70
            dark:border-white/10
            dark:ring-white/5
            dark:shadow-[0_18px_40px_rgba(0,0,0,0.6)]
        ">
            <div className="flex items-center gap-1 w-full flex-nowrap">
                <div className="flex items-center justify-center min-w-[34px] h-[34px] shrink-0">
                    <ChevronLeft className="h-4 w-4 transition-transform duration-500 group-hover:rotate-180 text-muted-foreground/70 group-hover:text-primary" />
                </div>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-300 delay-100 translate-x-4 group-hover:translate-x-0">
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
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
                            <TooltipContent side="top" sideOffset={12} className="text-[10px] font-medium">Search in note</TooltipContent>
                        </Tooltip>

                        <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />

                        <Tooltip>
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
                            <TooltipContent side="top" sideOffset={12} className="text-[10px] font-medium">Toggle Notes Sidebar</TooltipContent>
                        </Tooltip>

                        <Tooltip>
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
                            <TooltipContent side="top" sideOffset={12} className="text-[10px] font-medium">
                                {isNoteSidebarOpen ? "Focus Mode" : "Exit Focus Mode"}
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="shrink-0">
                                    <NoteActionsMenu
                                        note={note}
                                        onRevert={onRevert}
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

