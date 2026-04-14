import { Button } from "@/components/ui/button";
import { SidebarFooter, SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Settings, Trash2 } from "lucide-react";
import { Ionicons } from "../../ui/ionicons";

interface SidebarFooterSectionProps {
    showOfflineBanner: boolean;
    retryCooldown: boolean;
    onRetry: () => void;
    onSettingsClick: () => void;
    onTrashClick: () => void;
}

export function SidebarFooterSection({
    showOfflineBanner,
    retryCooldown,
    onRetry,
    onSettingsClick,
    onTrashClick,

}: SidebarFooterSectionProps) {
    return (
        <SidebarFooter className={cn("py-3 px-0")}>
            {showOfflineBanner && (
                <div className="mb-2 px-2 flex items-center gap-2 rounded-lg bg-amber-500/10  py-1.5 border border-amber-500/20">
                    <Ionicons name="cloud-offline" size={12} className="text-amber-500" />
                    <span className="flex-1 text-[9px] font-bold uppercase tracking-tight">Offline</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[9px] font-bold text-primary"
                        disabled={retryCooldown}
                        onClick={onRetry}
                    >
                        {retryCooldown ? "Wait…" : "Retry"}
                    </Button>
                </div>
            )}
            <div className="flex items-center justify-between text-muted-foreground/70">
                <SidebarMenuButton
                    className="w-9 h-9 hover:bg-sidebar-accent rounded-xl justify-center"
                    onClick={onSettingsClick}
                    tooltip="Settings"
                >
                    <Settings size={18} />
                </SidebarMenuButton>

                <SidebarMenuButton
                    className="w-9 h-9 hover:bg-destructive/10 hover:text-destructive rounded-xl justify-center"
                    onClick={onTrashClick}
                    tooltip="Trash"
                >
                    <Trash2 size={18} />
                </SidebarMenuButton>
            </div>
        </SidebarFooter>
    );
}
