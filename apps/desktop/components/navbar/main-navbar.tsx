import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useNavigationStore, useSettingsStore, useSyncStore, useUserStore, type SidebarTab } from "@annota/core"
import { Layers2, PanelLeft, PanelRight } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useAlwaysOnTop } from "../../hooks/use-always-on-top"
import { useAppTheme } from "../../hooks/use-app-theme"
import { SidebarTabs } from "../layout/sidebar/sidebar-tabs"
import { Ionicons } from "../ui/ionicons"
import { NoteTabs } from "./note-tabs"


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
    const { open, setOpen } = useSidebar();
    const setSettingsOpen = useNavigationStore(s => s.setSettingsOpen);
    const activeTab = useNavigationStore(s => s.sidebarTab);
    const setActiveTab = useNavigationStore(s => s.setSidebarTab);
    const { colors } = useAppTheme();

    const handleTabChange = (tab: SidebarTab) => {
        setActiveTab(tab);
        if (!open) {
            setOpen(true);
        }
    };

    const { isAlwaysOnTop, toggleAlwaysOnTop } = useAlwaysOnTop();

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
    const needsWindowControlsPadding = isMac;
    const windowControlsPaddingClass = needsWindowControlsPadding
        ? (windowControlsSide === "left" ? "pl-20" : "pr-20")
        : undefined;



    const [canSync, setCanSync] = useState(true);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
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



    const [primaryWidth, setPrimaryWidth] = useState(() => {
        const saved = localStorage.getItem("sidebar_width");
        return saved ? parseInt(saved, 10) : 260;
    });

    const [secondaryWidth, setSecondaryWidth] = useState(() => {
        const saved = localStorage.getItem("ai-sidebar-width");
        return saved ? parseInt(saved, 10) : 380;
    });

    useEffect(() => {
        const handleResize = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail.side === 'left') setPrimaryWidth(detail.width);
            if (detail.side === 'right') setSecondaryWidth(detail.width);
        };
        window.addEventListener('sidebar-resize', handleResize);
        return () => window.removeEventListener('sidebar-resize', handleResize);
    }, []);

    const isPaddingOnLeft = needsWindowControlsPadding && windowControlsSide === 'left';
    const isPaddingOnRight = needsWindowControlsPadding && windowControlsSide === 'right';

    const isRtl = general.appDirection === 'rtl';

    let leftSectionPadding = 12;
    let rightSectionPadding = 12;

    if (isRtl) {
        if (isPaddingOnRight) leftSectionPadding = 80;
        if (isPaddingOnLeft) rightSectionPadding = 80;
    } else {
        if (isPaddingOnLeft) leftSectionPadding = 80;
        if (isPaddingOnRight) rightSectionPadding = 80;
    }

    return (
        <header
            data-tauri-drag-region
            dir="LTR"
            className={cn(
                "flex h-9 w-full shrink-0 rotate-0 items-center justify-between border-sidebar-border bg-sidebar px-3",
                "select-none transition-[width,height,transform,opacity,border-color] duration-200 ease-in-out",
                windowControlsPaddingClass,
                isRtl ? 'flex-row-reverse' : 'flex-row'
            )}

        >
            {/* Left Section: Sidebar Toggle */}
            <div
                data-tauri-drag-region
                className={cn("flex items-center shrink-0 transition-all duration-300", isRtl && "flex-row-reverse")}
                style={{
                    width: open ? Math.max(132, primaryWidth + 16 - leftSectionPadding) : 'auto',
                    minWidth: open ? Math.max(132, primaryWidth + 16 - leftSectionPadding) : 'auto'
                }}
            >
                <div className="flex items-center shrink-0">
                    <SidebarTabs
                        activeTab={activeTab}
                        setActiveTab={handleTabChange}
                        colors={colors}
                    />
                </div>
            </div>

            {/* Middle Section: Navigation & Note Tabs */}
            <div
                data-tauri-drag-region
                className={cn(
                    "flex-1 flex items-center min-w-0 h-full gap-2 px-2",
                    isRtl ? "flex-row-reverse" : "flex-row",

                )}
            >
                {/* Navigation Arrows */}
                <div className={cn("flex items-center shrink-0")}>
                    <div className={cn("flex items-center gap-0.5 rounded-md border border-sidebar-border/40 bg-sidebar-accent/20 p-0.5")}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={isRtl ? !canGoForward : !canGoBack}
                                    className={cn(
                                        "h-6 w-6 rounded-[4px] text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-foreground",
                                        (isRtl ? !canGoForward : !canGoBack) && "opacity-30 cursor-not-allowed"
                                    )}
                                    onClick={() => navigate(isRtl ? 1 : -1)}
                                >
                                    <Ionicons name="chevron-back" size={15} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px]">
                                {isRtl ? "Forward" : "Back"}
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={isRtl ? !canGoBack : !canGoForward}
                                    className={cn(
                                        "h-6 w-6 rounded-[4px] text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-foreground",
                                        (isRtl ? !canGoBack : !canGoForward) && "opacity-30 cursor-not-allowed"
                                    )}
                                    onClick={() => navigate(isRtl ? -1 : 1)}
                                >
                                    <Ionicons name="chevron-forward" size={15} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px]">
                                {isRtl ? "Back" : "Forward"}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                {/* Note Tabs */}
                {general.enableNoteTabs !== false ? (
                    <NoteTabs />
                ) : (
                    <div data-tauri-drag-region className="flex-1 h-full" />
                )}
            </div>

            {/* Right Section: Actions */}
            <div
                data-tauri-drag-region
                className={cn("flex items-center gap-1.5 shrink-0 transition-all duration-300", isRtl ? "flex-row-reverse justify-end" : "justify-end")}
                style={{
                    width: general.isSecondarySidebarOpen && general.secondarySidebarMode === 'pinned' ? Math.max(0, secondaryWidth - rightSectionPadding) : 'auto',
                    minWidth: general.isSecondarySidebarOpen && general.secondarySidebarMode === 'pinned' ? Math.max(0, secondaryWidth - rightSectionPadding) : 'auto'
                }}
            >


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
                            {isSyncing ? "Syncing..." : "Force Sync"}
                        </TooltipContent>
                    </Tooltip>

                </div>}

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-7 w-7 rounded-full transition-all active:scale-95",
                                isAlwaysOnTop ? "text-accent-full hover:text-accent-full bg-sidebar-accent/50 hover:bg-sidebar-accent" : "text-muted-foreground/60 hover:bg-sidebar-accent hover:text-foreground"
                            )}
                            onClick={toggleAlwaysOnTop}
                        >
                            <Layers2 size={18} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px]">
                        Always on Top <span className="opacity-50 ml-1">{isMac ? "⌘+⇧+T" : "Ctrl+Shift+T"}</span>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full text-muted-foreground/60 transition-all active:scale-95 hover:bg-sidebar-accent hover:text-foreground"
                            onClick={() => setSettingsOpen(true)}
                        >
                            <Ionicons name="settings-outline" size={15} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px]">
                        Settings <span className="opacity-50 ml-1">{isMac ? "⌘+," : "Ctrl+,"}</span>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-7 w-7 rounded-full transition-all active:scale-95 text-muted-foreground/60 hover:bg-sidebar-accent hover:text-foreground ai-sidebar-toggle", general.isSecondarySidebarOpen && "text-accent-full")}
                            onClick={() => updateGeneralSettings({ isSecondarySidebarOpen: !general.isSecondarySidebarOpen })}
                        >
                            {general.appDirection === 'rtl' ? <PanelLeft size={16} /> : <PanelRight size={16} />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px]">
                        Secondary Sidebar <span className="opacity-50 ml-1">{isMac ? "⌘E" : "Ctrl+E"}</span>
                    </TooltipContent>
                </Tooltip>

            </div>
        </header>
    );
}
