import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Layers2 } from "lucide-react"
import { useMemo } from "react"

import { useAlwaysOnTop } from "../../hooks/use-always-on-top"

const RTL_LANGS = new Set([
    "ar", "fa", "he", "ur", "ps", "dv", "ku", "yi",
]);

export function StandaloneNavbar({ title }: { title: string }) {
    const { isAlwaysOnTop, toggleAlwaysOnTop } = useAlwaysOnTop();

    const isMac = useMemo(() => {
        if (typeof navigator === "undefined") return false;
        return /Mac|iPod|iPhone|iPad/i.test(navigator.platform || "") || /Mac/i.test(navigator.userAgent || "");
    }, []);

    const localeDir = useMemo(() => {
        if (typeof navigator === "undefined") return "ltr";
        const lang = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
        const base = lang.split("-")[0]?.toLowerCase() ?? "en";
        return RTL_LANGS.has(base) ? "rtl" : "ltr";
    }, []);

    const windowControlsPaddingClass = isMac
        ? (localeDir === "rtl" ? "pr-20" : "pl-20")
        : undefined;

    return (
        <header
            data-tauri-drag-region
            className={cn(
                "flex h-9 w-full shrink-0 items-center justify-between border-b border-border/50 bg-sidebar px-3 select-none",
                windowControlsPaddingClass,
                localeDir === "rtl" && "flex-row-reverse"
            )}
        >
            {/* Left Section (pinned to one side) */}
            <div data-tauri-drag-region className="flex items-center min-w-[100px]">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-7 w-7 rounded-full transition-all active:scale-95",
                                isAlwaysOnTop ? "text-accent-full hover:text-accent-full bg-sidebar-accent/50 hover:bg-sidebar-accent" : "text-muted-foreground/60 hover:bg-sidebar-accent hover:text-foreground"
                            )}
                            onClick={toggleAlwaysOnTop}
                        >
                            <Layers2 size={16} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px]">
                        Always on Top <span className="opacity-50 ml-1">{isMac ? "⌘+⇧+T" : "Ctrl+Shift+T"}</span>
                    </TooltipContent>
                </Tooltip>
            </div>

            {/* Center Section: Title */}
            <div data-tauri-drag-region className="flex-1 flex justify-center overflow-hidden">
                <span className="text-xs font-medium text-foreground/70 truncate px-4">
                    {title}
                </span>
            </div>

            {/* Right Section: Spacer to balance the left side */}
            <div data-tauri-drag-region className="min-w-[100px] flex justify-end">
            </div>
        </header>
    );
}
