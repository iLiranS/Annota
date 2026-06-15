import { Button } from "@/components/ui/button";
import { SidebarFooter } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Ionicons } from "../../ui/ionicons";


interface SidebarFooterSectionProps {
    showOfflineBanner: boolean;
    retryCooldown: boolean;
    onRetry: () => void;
    authRequired: boolean;
    onReauthenticate: () => void;
    isGuest: boolean;
}

export function SidebarFooterSection({
    showOfflineBanner,
    retryCooldown,
    onRetry,
    authRequired,
    onReauthenticate,
    isGuest
}: SidebarFooterSectionProps) {


    return (
        <SidebarFooter className={cn(" p-0 mt-auto ")}>
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




        </SidebarFooter>
    );
}
