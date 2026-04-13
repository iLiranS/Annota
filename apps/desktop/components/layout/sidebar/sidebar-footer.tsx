import { Settings, Trash2 } from "lucide-react";
import { SidebarFooter, SidebarMenuButton } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Ionicons } from "../../ui/ionicons";
import { cn } from "@/lib/utils";

interface SidebarFooterSectionProps {
    showOfflineBanner: boolean;
    retryCooldown: boolean;
    onRetry: () => void;
    onSettingsClick: () => void;
    onTrashClick: () => void;
    sidebarXPadding: string;
}

export function SidebarFooterSection({
    showOfflineBanner,
    retryCooldown,
    onRetry,
    onSettingsClick,
    onTrashClick,
    sidebarXPadding
}: SidebarFooterSectionProps) {
    return (
        <SidebarFooter className={cn("py-3 gap-1", sidebarXPadding)}>
            {showOfflineBanner && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 border border-amber-500/20">
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
            <div className="flex items-center justify-between">
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
