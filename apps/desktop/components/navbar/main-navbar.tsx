import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useSettingsStore, useSyncStore, useUserStore } from "@annota/core"
import { PanelLeft, PanelRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { NotesSearchModal } from "../search/notes-search-modal"
import { Ionicons } from "../ui/ionicons"


/**
 * MainNavbar: A custom title-bar / top navbar for the desktop app.
 * Designed to work with Tauri's transparent/overlay titlebar style.
 * Height: 32px.
 */
export function MainNavbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isSyncing } = useSyncStore()
    const { session } = useUserStore();
    const { general, updateGeneralSettings } = useSettingsStore();
    const { open, toggleSidebar } = useSidebar();



    const [canSync, setCanSync] = useState(true);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const maxIdxRef = useRef(0);

    useEffect(() => {
        const hState = window.history.state;
        if (hState && typeof hState.idx === 'number') {
            setCanGoBack(hState.idx > 0);
            if (hState.idx > maxIdxRef.current) {
                maxIdxRef.current = hState.idx;
            }
            setCanGoForward(hState.idx < maxIdxRef.current);
        }
    }, [location]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "f") {
                e.preventDefault();
                setIsSearchOpen(true);
            }
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "e") {
                e.preventDefault();
                updateGeneralSettings({ isTaskCalendarOpen: !general.isTaskCalendarOpen });
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [general.isTaskCalendarOpen, updateGeneralSettings]);

    useEffect(() => {
        if (isSyncing) {
            setCanSync(false);
            setTimeout(() => {
                setCanSync(true);
            }, 5000);
        }
    }, [isSyncing])

    const handleManualSync = async () => {
        if (!session?.user?.id) {
            return;
        }

        try {
            await useSyncStore.getState().forceSync();
        } catch (error: any) {
            console.error("Manual Sync Error:", error);
        }
    };


    return (
        <header
            data-tauri-drag-region
            dir={general.appDirection}
            className={cn(
                "flex h-9 w-full shrink-0 rotate-0 items-center justify-between border-sidebar-border bg-sidebar px-3",
                "select-none transition-[width,height,transform,opacity,border-color] duration-200 ease-in-out",
                general.appDirection === 'ltr' && 'pr-20',
                general.appDirection === 'rtl' && !open && 'pr-20',
            )}

        >
            {/* Left Section: Sidebar Toggle & Search */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 transition-transform active:scale-95 hover:bg-sidebar-accent text-foreground/50"
                        onClick={toggleSidebar}
                        title="Toggle Sidebar"
                    >
                        {general.appDirection === 'rtl' ? <PanelRight size={16} /> : <PanelLeft size={16} />}
                    </Button>

                    <div className={`flex items-center gap-0 ${general.appDirection === 'ltr' ? 'flex-row' : 'flex-row-reverse'}`}>
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled={!canGoBack}
                            className={cn(
                                "h-6 w-6 text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-foreground",
                                !canGoBack && "opacity-30 cursor-not-allowed"
                            )}
                            onClick={() => navigate(-1)}
                            title="Back"
                        >
                            <Ionicons name="chevron-back" size={15} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled={!canGoForward}
                            className={cn(
                                "h-6 w-6 text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-foreground",
                                !canGoForward && "opacity-30 cursor-not-allowed"
                            )}
                            onClick={() => navigate(1)}
                            title="Forward"
                        >
                            <Ionicons name="chevron-forward" size={15} />
                        </Button>
                    </div>
                </div>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full bg-transparent dark:bg-transparent text-muted-foreground/60 transition-all hover:bg-background/80 hover:text-primary active:scale-95"
                            onClick={() => setIsSearchOpen(true)}
                        >
                            <Ionicons name="search" size={15} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px]">
                        Search <span className="opacity-50 ml-1">⌘F</span>
                    </TooltipContent>
                </Tooltip>
            </div>

            {/* Right Section: Actions */}
            <div className="flex items-center gap-1.5">
                {session?.user?.id && <div className={cn(
                    "flex items-center gap-1 transition-opacity duration-300",
                    isSyncing || !canSync ? "text-muted-foreground/30" : "text-muted-foreground/60"
                )}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                disabled={isSyncing || !canSync}
                                onClick={handleManualSync}
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-6 w-6 text-muted-foreground/60 transition-colors",
                                    !isSyncing && "hover:bg-sidebar-accent"
                                )}
                                title="Reload & Sync"
                            >
                                <Ionicons
                                    name="sync-outline"
                                    size={15}
                                    className={cn(
                                        "transition-transform",
                                        isSyncing && "animate-spin"
                                    )}
                                />
                            </Button>
                        </TooltipTrigger>

                        <TooltipContent>
                            {isSyncing ? "Syncing..." : "In Sync"}
                        </TooltipContent>
                    </Tooltip>

                </div>}



                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-7 w-7 rounded-full transition-all active:scale-95 text-muted-foreground/60 hover:bg-sidebar-accent hover:text-foreground", general.isTaskCalendarOpen && "text-accent-full")}
                            onClick={() => updateGeneralSettings({ isTaskCalendarOpen: !general.isTaskCalendarOpen })}
                        >
                            {general.appDirection === 'rtl' ? <PanelLeft size={16} /> : <PanelRight size={16} />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px]">
                        Task Calendar <span className="opacity-50 ml-1">⌘E</span>
                    </TooltipContent>
                </Tooltip>

            </div>
            <NotesSearchModal
                open={isSearchOpen}
                onOpenChange={setIsSearchOpen}
            />
        </header>
    );
}
