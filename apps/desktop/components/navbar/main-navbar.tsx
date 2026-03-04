import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAppTheme } from "@/hooks/use-app-theme"
import { cn } from "@/lib/utils"
import { useNavigate } from "react-router-dom"
import { Ionicons } from "../ui/ionicons"

/**
 * MainNavbar: A custom title-bar / top navbar for the desktop app.
 * Designed to work with Tauri's transparent/overlay titlebar style.
 * Height: 32px.
 */
export function MainNavbar() {
    const { colors } = useAppTheme();
    const navigate = useNavigate();

    return (
        <header
            data-tauri-drag-region
            className={cn(
                "flex h-8 w-full shrink-0 rotate-0 items-center justify-between border-b border-sidebar-border bg-sidebar/70 px-3 backdrop-blur-xl",
                "select-none transition-all duration-200 ease-in-out pr-20"
            )}
        >
            {/* Left Section: Sidebar Toggle & Search */}
            <div className="flex items-center gap-3">
                <div className="flex items-center">
                    <SidebarTrigger className="h-6 w-6 transition-transform active:scale-95 hover:bg-sidebar-accent" />
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
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-foreground"
                    title="Reload & Sync"
                >
                    <Ionicons name="refresh-outline" size={15} />
                </Button>

                <div className="mx-1 h-3 w-px bg-sidebar-border/60" />

                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1.5 rounded-full px-3 text-[11px] font-semibold transition-all active:scale-95"
                    style={{
                        color: colors.primary,
                        backgroundColor: `${colors.primary}15`
                    }}
                >
                    <Ionicons name="add" size={14} />
                    <span>New Note</span>
                </Button>

                <Button
                    onClick={() => { navigate("/settings") }}
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
