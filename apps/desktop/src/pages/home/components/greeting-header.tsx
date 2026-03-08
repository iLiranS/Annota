import { useAppTheme } from "@/hooks/use-app-theme";
import { useSettingsStore, useUserStore } from "@annota/core";
import { useMemo } from "react";

export function GreetingHeader() {
    const { colors } = useAppTheme();
    const { editor } = useSettingsStore();

    // User Data
    const session = useUserStore((state) => state.session);
    const globalDisplayName = useUserStore((state) => state.displayName);
    const fallbackName = session?.user?.user_metadata?.display_name || session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || "Guest";
    const displayName = globalDisplayName || fallbackName;

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'Good Morning';
        if (hour >= 12 && hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    }, []);

    return (
        <div className="flex flex-col justify-center py-2 px-1 ">
            <h1
                className="text-2xl font-light tracking-tight text-foreground/80 leading-tight"
                style={{ fontFamily: editor.fontFamily }}
            >
                {greeting}, <span style={{ color: colors.primary }} className="font-semibold">{displayName}</span>
            </h1>
        </div>
    );
}
