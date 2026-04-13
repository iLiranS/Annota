import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@annota/core";
import {
    ArrowRightLeft,
    Calendar,
    Check,
    ChevronRight,
    List,
    PanelRight,
} from "lucide-react";

import { SettingItem } from "./setting-item";

const Toggle = ({ enabled }: { enabled: boolean }) => (
    <div className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        enabled ? "bg-primary" : "bg-accent"
    )}>
        <span className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ease-in-out",
            enabled ? "translate-x-4" : "translate-x-0"
        )} />
    </div>
);

export function GeneralSettings() {
    const { general, updateGeneralSettings } = useSettingsStore();

    const toggleStartOfWeek = () => {
        updateGeneralSettings({
            startOfWeek: general.startOfWeek === 'sunday' ? 'monday' : 'sunday'
        });
    };


    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Calendar & Date Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    Calendar & Date
                </h4>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                    <SettingItem
                        label="Start Week On"
                        description="Choose your preferred calendar start day"
                        icon={<Calendar size={18} />}
                        iconBg="bg-blue-600"
                        value={general.startOfWeek === 'sunday' ? 'Sunday' : 'Monday'}
                        onClick={toggleStartOfWeek}
                        action={<ChevronRight size={16} className="text-muted-foreground" />}
                    />
                </div>
            </section>


            {/* Display Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    Display
                </h4>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                    <SettingItem
                        label="AI Sidebar Layout"
                        description="Floating overlays content, Pinned shrinks it"
                        icon={<PanelRight size={18} />}
                        iconBg="bg-indigo-500"
                        value={general.aiSidebarMode === 'pinned' ? 'Pinned' : 'Floating'}
                        onClick={() => updateGeneralSettings({
                            aiSidebarMode: general.aiSidebarMode === 'floating' ? 'pinned' : 'floating'
                        })}
                        action={<ChevronRight size={16} className="text-muted-foreground" />}
                    />
                    <div className="h-[2px] bg-border/50 mx-4" />
                    <SettingItem
                        label="Compact Mode"
                        description="Show more items in folders and lists"
                        icon={<List size={18} />}
                        iconBg="bg-emerald-500"
                        onClick={() => updateGeneralSettings({ compactMode: !general.compactMode })}
                        action={<Toggle enabled={general.compactMode} />}
                    />
                    <div className="h-[2px] bg-border/50 mx-4" />
                    <SettingItem
                        label="App Direction"
                        description="Switch between LTR and RTL layout"
                        icon={<ArrowRightLeft size={18} />}
                        iconBg="bg-purple-500"
                        value={general.appDirection === 'rtl' ? 'RTL' : 'LTR'}
                        onClick={() => updateGeneralSettings({
                            appDirection: general.appDirection === 'rtl' ? 'ltr' : 'rtl'
                        })}
                        action={<ChevronRight size={16} className="text-muted-foreground" />}
                    />
                </div>
            </section>
        </div>
    );
}
