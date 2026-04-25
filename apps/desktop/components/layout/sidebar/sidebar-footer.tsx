import { Button } from "@/components/ui/button";
import { SidebarFooter } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Ionicons } from "../../ui/ionicons";

import { SidebarTabs } from "./sidebar-tabs";

type SidebarTab = 'folders' | 'notes' | 'tags' | 'search';

interface SidebarFooterSectionProps {
    showOfflineBanner: boolean;
    retryCooldown: boolean;
    onRetry: () => void;
    activeTab: SidebarTab;
    setActiveTab: (tab: SidebarTab) => void;
    colors: {
        primary: string;
    };
}

export function SidebarFooterSection({
    showOfflineBanner,
    retryCooldown,
    onRetry,
    activeTab,
    setActiveTab,
    colors
}: SidebarFooterSectionProps) {
    return (
        <SidebarFooter className={cn(" px-0")}>
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
            <div data-tauri-drag-region className="flex items-center justify-center text-muted-foreground/70">
                <SidebarTabs
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    colors={colors}
                />
            </div>
        </SidebarFooter>
    );
}
