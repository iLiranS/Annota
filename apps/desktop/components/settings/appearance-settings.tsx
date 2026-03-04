import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { COLOR_PALETTE, ThemeMode, useSettingsStore } from "@annota/core";
import { Ionicons } from "../ui/ionicons";

interface SettingItemProps {
    label: string;
    description?: string;
    icon: React.ReactNode;
    iconBg: string;
    action?: React.ReactNode;
    onClick?: () => void;
    value?: React.ReactNode;
    active?: boolean;
}

function SettingItem({ label, description, icon, iconBg, action, onClick, value, active }: SettingItemProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "group flex items-center justify-between p-3 rounded-xl transition-all duration-200",
                onClick ? "cursor-pointer hover:bg-accent/50" : "",
                active ? "bg-accent/30" : ""
            )}
        >
            <div className="flex items-center gap-3">
                <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm transition-transform group-hover:scale-105",
                    iconBg
                )}>
                    {icon}
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    {description && <span className="text-xs text-muted-foreground">{description}</span>}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {value && <div className="text-sm text-muted-foreground mr-1">{value}</div>}
                {action}
            </div>
        </div>
    );
}

export function AppearanceSettings() {
    const { themeMode, setThemeMode, accentColor, setAccentColor } = useSettingsStore();

    const themes: { label: string; mode: ThemeMode; icon: React.ReactNode; bg: string }[] = [
        { label: 'Light', mode: 'light', icon: <Ionicons name="sunny" size={20} />, bg: "bg-orange-500" },
        { label: 'Dark', mode: 'dark', icon: <Ionicons name="moon" size={20} />, bg: "bg-slate-800" },
        { label: 'System', mode: 'system', icon: <Ionicons name="desktop" size={20} />, bg: "bg-blue-600" },
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Theme Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    App Theme
                </h4>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                    {themes.map((theme, idx) => (
                        <div key={theme.mode}>
                            <SettingItem
                                label={theme.label}
                                icon={theme.icon}
                                iconBg={theme.bg}
                                active={themeMode === theme.mode}
                                onClick={() => setThemeMode(theme.mode)}
                                action={themeMode === theme.mode && <Ionicons name="checkmark" size={16} className="text-primary" />}
                            />
                            {idx < themes.length - 1 && <Separator />}
                        </div>
                    ))}
                </div>
            </section>

            {/* Accent Color Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    Accent Color
                </h4>
                <div className="bg-card border rounded-2xl p-4 shadow-sm">
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                        {COLOR_PALETTE.map((color) => (
                            <button
                                key={color.value}
                                onClick={() => setAccentColor(color.value)}
                                className={cn(
                                    "relative h-10 w-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 shadow-sm",
                                    accentColor === color.value ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                                )}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                            >
                                {accentColor === color.value && (
                                    <Ionicons name="checkmark" size={20} className="text-white drop-shadow-sm" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
