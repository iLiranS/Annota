import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAppTheme } from "@/hooks/use-app-theme"
import { useCreateNote } from "@/hooks/use-create-note"
import { useCreateTask } from "@/hooks/use-create-task"
import { cn } from "@/lib/utils"
import { syncPull, syncPush, useSyncStore, useUserStore } from "@annota/core"
import { getMasterKey } from "@annota/core/platform"
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Ionicons } from "../ui/ionicons"

/**
 * MainNavbar: A custom title-bar / top navbar for the desktop app.
 * Designed to work with Tauri's transparent/overlay titlebar style.
 * Height: 32px.
 */
export function MainNavbar() {
    const { colors } = useAppTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const { isSyncing } = useSyncStore()
    const { session } = useUserStore();
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
            const key = await getMasterKey(session.user.id);
            if (!key) {
                return;
            }
            await syncPush(key);
            await syncPull(key);
        } catch (error: any) {
            console.error("Manual Sync Error:", error);
        }
    };


    const { createAndNavigate: createNewTask } = useCreateTask();
    const { createAndNavigate: createNewNote } = useCreateNote();

    return (
        <header
            data-tauri-drag-region
            className={cn(
                "flex h-10 w-full shrink-0 rotate-0 items-center justify-between border-b border-sidebar-border bg-sidebar/70 px-3 backdrop-blur-xl",
                "select-none transition-all duration-200 ease-in-out pr-20"
            )}
        >
            {/* Left Section: Sidebar Toggle & Search */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                    <SidebarTrigger className="h-6 w-6 transition-transform active:scale-95 hover:bg-sidebar-accent" />

                    <div className="flex items-center gap-0">
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

                <div className="relative flex w-64 items-center group">
                    <Ionicons
                        name="search"
                        size={14}
                        className="absolute left-2.5 text-muted-foreground/40 transition-colors group-focus-within:text-primary/70"
                    />
                    <Input
                        type="search"
                        placeholder="Search..."
                        className={cn(
                            "h-6 w-full rounded-full border-none bg-background/30 pl-8 pr-3 text-[11px] leading-none",
                            "placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/20",
                            "transition-all hover:bg-background/50 focus:bg-background/80 focus:w-80"
                        )}
                    />
                </div>
            </div>

            {/* Right Section: Actions */}
            <div className="flex items-center gap-1.5">
                {session?.user?.id && <div className={cn(
                    "flex items-center gap-1 transition-opacity duration-300",
                    isSyncing || !canSync ? "text-muted-foreground/30" : "text-muted-foreground/60"
                )}>
                    <p className="text-xs">{isSyncing ? "Syncing..." : "In sync"}</p>
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
                            name="refresh-outline"
                            size={15}
                            className={cn(
                                "transition-transform",
                                isSyncing && "animate-spin"
                            )}
                        />
                    </Button>
                </div>}

                <div className="mx-1 h-3 w-px bg-sidebar-border/60" />

                <div
                    className="flex items-center rounded-full p-0.5"
                    style={{ backgroundColor: `${colors.primary}10`, color: colors.primary }}
                >
                    <Button
                        onClick={() => createNewNote()}
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1.5 rounded-full px-2.5 text-[11px] font-semibold hover:scale-105 transition-all active:scale-95"
                        style={{ color: colors.primary }}
                    >
                        <Ionicons name="document-text-outline" size={13} />
                        <span>Note</span>
                    </Button>

                    <div className="h-3 w-px opacity-20" style={{ backgroundColor: colors.primary }} />

                    <Button
                        onClick={() => createNewTask()}
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1.5 rounded-full px-2.5 text-[11px] font-semibold hover:scale-105 transition-all active:scale-95"
                        style={{ color: colors.primary }}
                    >
                        <span>Task</span>
                        <Ionicons name="checkbox-outline" size={13} />
                    </Button>
                </div>

                <Button
                    onClick={() => { navigate("/settings", { state: { background: location } }) }}
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-foreground"
                    title="Settings"
                >
                    <Ionicons name="settings-outline" size={15} />
                </Button>
            </div>
        </header>
    );
}
