import { Button } from "@/components/ui/button";
import { SidebarFooter } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Ionicons } from "../../ui/ionicons";

import { type SidebarTab } from "@annota/core";

import { SidebarTabs } from "./sidebar-tabs";

interface SidebarFooterSectionProps {
    showOfflineBanner: boolean;
    retryCooldown: boolean;
    onRetry: () => void;
    activeTab: SidebarTab;
    setActiveTab: (tab: SidebarTab) => void;
    colors: {
        primary: string;
    };
    updateAvailable: boolean;
    latestVersion: string | null;
    currentVersion: string;
    dismissUpdate: (version: string) => void;
    authRequired: boolean;
    onReauthenticate: () => void;
    isGuest: boolean;
}

export function SidebarFooterSection({
    showOfflineBanner,
    retryCooldown,
    onRetry,
    activeTab,
    setActiveTab,
    colors,
    updateAvailable,
    latestVersion,
    currentVersion,
    dismissUpdate,
    authRequired,
    onReauthenticate,
    isGuest
}: SidebarFooterSectionProps) {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.platform || "");
    const isWindows = typeof navigator !== 'undefined' && /Win/i.test(navigator.platform || "");

    return (
        <SidebarFooter className={cn(" px-0 ")}>
            {authRequired && !isGuest && (
                <div className="mb-2 px-2 flex items-center gap-2 rounded-lg bg-red-500/10 py-1.5 border border-red-500/20 animate-in fade-in slide-in-from-bottom-1">
                    <Ionicons name="lock-closed" size={12} className="text-red-500" />
                    <div className="flex-1 flex flex-col">
                        <span className="text-[9px] font-bold uppercase tracking-tight text-red-500 leading-none">Session Expired</span>
                        <span className="text-[7px] text-red-500/70 font-medium leading-none mt-0.5">Sync Paused</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[9px] font-bold text-red-500 hover:bg-red-500/20 hover:text-red-500"
                        onClick={onReauthenticate}
                    >
                        Login
                    </Button>
                </div>
            )}

            {showOfflineBanner && !authRequired && (
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

            {updateAvailable && (
                <div className="mb-2 px-2 flex items-center gap-2 rounded-lg bg-blue-500/10 py-1.5 border border-blue-500/20 animate-in fade-in slide-in-from-bottom-1 group relative">
                    <Ionicons name="download-outline" size={12} className="text-blue-500" />
                    <div className="flex-1 flex flex-col">
                        <span className="text-[9px] font-bold uppercase tracking-tight text-blue-500">Update Available</span>
                        <span className="text-[8px] opacity-70 font-mono">
                            {currentVersion} → {latestVersion}
                        </span>
                    </div>

                    {!isMac && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[9px] font-bold text-blue-500"
                            onClick={() => window.open(isWindows ? 'https://github.com/iLiranS/Annota/releases/latest' : 'https://annota.online/download', '_blank')}
                        >
                            Get
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-1.5 -right-1.5 rounded-full bg-background border border-blue-500/20 text-muted-foreground hover:text-foreground"
                        onClick={() => latestVersion && dismissUpdate(latestVersion)}
                    >
                        <Ionicons name="close" size={10} />
                    </Button>
                </div>
            )}

            <div className="flex items-center justify-center text-muted-foreground/70">
                <SidebarTabs
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    colors={colors}
                />
            </div>
        </SidebarFooter>
    );
}
