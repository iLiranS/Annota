
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@annota/core";
import {
    ArrowRightLeft,
    Calendar,

    ChevronRight,
    Hash,
    List,
    PanelRight,
} from "lucide-react";

import { SettingItem } from "./setting-item";

const Toggle = ({ enabled }: { enabled: boolean }) => (
    <div className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out outline-none border border-transparent",
        enabled ? "bg-primary" : "bg-muted-foreground/30 dark:bg-muted-foreground/20"
    )}>
        <span className={cn(
            "pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out",
            enabled ? "translate-x-[18px]" : "translate-x-[2px]"
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
            <section className="space-y-2">
                <h4 className="text-[10px] font-semibold text-muted-foreground/80 tracking-wider uppercase px-1.5">
                    Calendar & Date
                </h4>
                <div className="bg-card/40 dark:bg-card/20 border border-border/60 rounded-2xl overflow-hidden shadow-sm">
                    <SettingItem
                        label="Start Week On"
                        description="Choose your preferred calendar start day"
                        icon={<Calendar size={16} />}
                        iconBg="bg-gradient-to-tr from-blue-600 to-sky-400"
                        value={general.startOfWeek === 'sunday' ? 'Sunday' : 'Monday'}
                        onClick={toggleStartOfWeek}
                        action={<ChevronRight size={14} className="text-muted-foreground/75" />}
                    />
                </div>
            </section>


            {/* Display Section */}
            <section className="space-y-2">
                <h4 className="text-[10px] font-semibold text-muted-foreground/80 tracking-wider uppercase px-1.5">
                    Display
                </h4>
                <div className="bg-card/40 dark:bg-card/20 border border-border/60 rounded-2xl overflow-hidden shadow-sm">
                    <SettingItem
                        label="Compact Mode"
                        description="Show more items in folders and lists"
                        icon={<List size={16} />}
                        iconBg="bg-gradient-to-tr from-emerald-600 to-teal-400"
                        onClick={() => updateGeneralSettings({ compactMode: !general.compactMode })}
                        action={<Toggle enabled={general.compactMode} />}
                    />
                    <div className="h-px bg-border/40 mx-4" />
                    <SettingItem
                        label="Open Note in New Tab"
                        description="Automatically create a new tab when opening a note"
                        icon={<PanelRight size={16} />}
                        iconBg="bg-gradient-to-tr from-amber-600 to-yellow-400"
                        onClick={() => updateGeneralSettings({ openNoteInNewTab: !general.openNoteInNewTab })}
                        action={<Toggle enabled={general.openNoteInNewTab !== false} />}
                    />
                    <div className="h-px bg-border/40 mx-4" />
                    <SettingItem
                        label="Folder Note Count"
                        description="Show the number of notes inside each folder"
                        icon={<Hash size={16} />}
                        iconBg="bg-gradient-to-tr from-blue-600 to-cyan-400"
                        onClick={() => updateGeneralSettings({ showNotesCountInFolder: !general.showNotesCountInFolder })}
                        action={<Toggle enabled={general.showNotesCountInFolder} />}
                    />
                    <div className="h-px bg-border/40 mx-4" />
                    <SettingItem
                        label="App Direction"
                        description="Switch between LTR and RTL layout"
                        icon={<ArrowRightLeft size={16} />}
                        iconBg="bg-gradient-to-tr from-purple-600 to-pink-400"
                        value={general.appDirection === 'rtl' ? 'RTL' : 'LTR'}
                        onClick={() => updateGeneralSettings({
                            appDirection: general.appDirection === 'rtl' ? 'ltr' : 'rtl'
                        })}
                        action={<ChevronRight size={14} className="text-muted-foreground/75" />}
                    />
                </div>
            </section>
        </div>
    );
}
