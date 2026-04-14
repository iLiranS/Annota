import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useSearchStore, useSettingsStore, useSyncStore, useUserStore } from "@annota/core"
import { PanelLeft, PanelRight } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { NotesSearchModal } from "../search/notes-search-modal"
import { Ionicons } from "../ui/ionicons"


/**
 * MainNavbar: A custom title-bar / top navbar for the desktop app.
 * Designed to work with Tauri's transparent/overlay titlebar style.
 * Height: 32px.
 */
const RTL_LANGS = new Set([
    "ar",
    "fa",
    "he",
    "ur",
    "ps",
    "dv",
    "ku",
    "yi",
]);

export function MainNavbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isSyncing } = useSyncStore()
    const { session } = useUserStore();
    const { general, updateGeneralSettings } = useSettingsStore();
    const { toggleSidebar } = useSidebar();

    const isMac = useMemo(() => {
        if (typeof navigator === "undefined") {
            return false;
        }
        return /Mac|iPod|iPhone|iPad/i.test(navigator.platform || "") || /Mac/i.test(navigator.userAgent || "");
    }, []);

    const localeDir = useMemo(() => {
        if (typeof navigator === "undefined") {
            return "ltr";
        }
        const lang = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
        const base = lang.split("-")[0]?.toLowerCase() ?? "en";
        return RTL_LANGS.has(base) ? "rtl" : "ltr";
    }, []);

    // const sidebarSide = general.appDirection === "rtl" ? "right" : "left";
    const windowControlsSide = isMac ? (localeDir === "rtl" ? "right" : "left") : "right";
    const needsWindowControlsPadding = true;
    const windowControlsPaddingClass = needsWindowControlsPadding
        ? (windowControlsSide === "left" ? "pl-20" : "pr-20")
        : undefined;



    const [canSync, setCanSync] = useState(true);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const { isOpen: isSearchOpen, setIsOpen: setIsSearchOpen } = useSearchStore();
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
            dir="LTR"
            className={cn(
                "flex h-9 w-full shrink-0 rotate-0 items-center justify-between border-sidebar-border bg-sidebar px-3",
                "select-none transition-[width,height,transform,opacity,border-color] duration-200 ease-in-out",
                windowControlsPaddingClass,
                general.appDirection === 'rtl' ? 'flex-row-reverse' : 'flex-row'
            )}

        >
            {/* Left Section: Sidebar Toggle & Search */}
            <div className={cn("flex items-center gap-3", general.appDirection === 'rtl' && "flex-row-reverse")}>
                <div className={cn("flex items-center gap-1", general.appDirection === 'rtl' && "flex-row-reverse")}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 transition-transform hover:bg-sidebar-accent hover:text-foreground active:scale-95 text-foreground/50"
                                onClick={toggleSidebar}
                            >
                                {general.appDirection === 'rtl' ? <PanelRight size={16} /> : <PanelLeft size={16} />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-[10px]">
                            Toggle Sidebar ⌘+⇧+D
                        </TooltipContent>
                    </Tooltip>

                    <div className={cn("flex items-center gap-0")}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={general.appDirection === 'rtl' ? !canGoForward : !canGoBack}
                                    className={cn(
                                        "h-6 w-6 text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-foreground",
                                        (general.appDirection === 'rtl' ? !canGoForward : !canGoBack) && "opacity-30 cursor-not-allowed"
                                    )}
                                    onClick={() => navigate(general.appDirection === 'rtl' ? 1 : -1)}
                                >
                                    <Ionicons name="chevron-back" size={15} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px]">
                                {general.appDirection === 'rtl' ? "Forward" : "Back"}
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={general.appDirection === 'rtl' ? !canGoBack : !canGoForward}
                                    className={cn(
                                        "h-6 w-6 text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-foreground",
                                        (general.appDirection === 'rtl' ? !canGoBack : !canGoForward) && "opacity-30 cursor-not-allowed"
                                    )}
                                    onClick={() => navigate(general.appDirection === 'rtl' ? -1 : 1)}
                                >
                                    <Ionicons name="chevron-forward" size={15} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px]">
                                {general.appDirection === 'rtl' ? "Back" : "Forward"}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full text-muted-foreground/60 transition-all hover:bg-sidebar-accent hover:text-foreground active:scale-95"
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
            <div className={cn("flex items-center gap-1.5", general.appDirection === 'rtl' && "flex-row-reverse")}>


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
                            className="h-7 w-7 rounded-full text-muted-foreground/60 transition-all active:scale-95 hover:bg-sidebar-accent hover:text-foreground"
                            onClick={() => navigate("/settings", { state: { background: location } })}
                        >
                            <Ionicons name="settings-outline" size={15} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px]">
                        Settings
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-7 w-7 rounded-full transition-all active:scale-95 text-muted-foreground/60 hover:bg-sidebar-accent hover:text-foreground ai-sidebar-toggle", general.isAiSidebarOpen && "text-accent-full")}
                            onClick={() => updateGeneralSettings({ isAiSidebarOpen: !general.isAiSidebarOpen })}
                        >
                            {general.appDirection === 'rtl' ? <PanelLeft size={16} /> : <PanelRight size={16} />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px]">
                        AI Sidebar <span className="opacity-50 ml-1">⌘E</span>
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
