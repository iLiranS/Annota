import { cn } from "@/lib/utils";
import { useSettingsStore, type SidebarTab } from "@annota/core";
import { NotebookTabs } from "lucide-react";
import { Ionicons } from "../../ui/ionicons";



interface SidebarTabsProps {
    activeTab: SidebarTab;
    setActiveTab: (tab: SidebarTab) => void;
    colors: {
        primary: string;
    };
}

const TABS: { id: SidebarTab; icon: React.ReactNode; label: string }[] = [
    { id: 'folders', icon: <Ionicons name="folder-outline" size={16} />, label: 'Folders' },
    { id: 'notes', icon: <NotebookTabs size={16} />, label: 'Notes' },
    { id: 'tags', icon: <Ionicons name="pricetag-outline" size={16} />, label: 'Tags' },
    { id: 'search', icon: <Ionicons name="search-outline" size={16} />, label: 'Search' },
];

export function SidebarTabs({ activeTab, setActiveTab, colors }: SidebarTabsProps) {
    const { general } = useSettingsStore();
    const isRtl = general.appDirection === 'rtl';


    const activeIndex = TABS.findIndex(t => t.id === activeTab);
    const displayIndex = isRtl ? TABS.length - 1 - activeIndex : activeIndex;

    return (
        <div
            className="relative overflow-hidden flex items-center w-[148px] h-10 gap-1 p-1 rounded-xl bg-sidebar-accent/50 dark:bg-sidebar-accent/70 border border-sidebar-border/40 shadow-sm outline-none  isolate "        >
            {/* Sliding Active Indicator */}
            <div
                className="absolute left-1 top-1 h-8 w-8 rounded-lg bg-background shadow-sm border border-border/40 transition-transform duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform-gpu"
                style={{
                    transform: `translateX(${displayIndex * (32 + 4)}px)`,
                    willChange: 'transform',
                }}
            />

            {TABS.map((tab) => (
                <TabButton
                    key={tab.id}
                    active={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    icon={tab.icon}
                    label={tab.label}
                    color={colors.primary}
                />
            ))}
        </div>
    );
}

function TabButton({
    active,
    onClick,
    icon,
    color
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    color: string
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "relative z-10 flex flex-none items-center active:transform-none justify-center w-8 h-8 rounded-lg transition-colors duration-300 focus:outline-none focus-visible:ring-0 ",
                active
                    ? "text-primary"
                    : "text-muted-foreground/40 hover:text-muted-foreground/80 hover:bg-sidebar-accent/30"
            )}
            style={{ ...active ? { color: color } : {}, willChange: 'transform' }}
        >
            <span className="flex items-center justify-center w-4 h-4 pointer-events-none">
                {icon}
            </span>
        </button>
    );
}



