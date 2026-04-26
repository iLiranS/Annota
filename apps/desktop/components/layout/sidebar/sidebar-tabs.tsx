import { cn } from "@/lib/utils";
import { NotebookTabs } from "lucide-react";
import { Ionicons } from "../../ui/ionicons";

type SidebarTab = 'folders' | 'notes' | 'tags' | 'search';

interface SidebarTabsProps {
    activeTab: SidebarTab;
    setActiveTab: (tab: SidebarTab) => void;
    colors: {
        primary: string;
    };
}

export function SidebarTabs({ activeTab, setActiveTab, colors }: SidebarTabsProps) {
    const tabs: { id: SidebarTab; icon: React.ReactNode; label: string }[] = [
        { id: 'notes', icon: <NotebookTabs size={16} />, label: 'Notes' },
        { id: 'folders', icon: <Ionicons name="folder-outline" size={16} />, label: 'Folders' },
        { id: 'tags', icon: <Ionicons name="pricetag-outline" size={16} />, label: 'Tags' },
        { id: 'search', icon: <Ionicons name="search-outline" size={16} />, label: 'Search' },
    ];

    const activeIndex = tabs.findIndex(t => t.id === activeTab);

    return (
        <div
            data-tauri-drag-region
            className="relative flex items-center justify-center gap-1 p-1 rounded-xl bg-sidebar-accent/20 dark:bg-sidebar-accent/40 border border-sidebar-border/40 shadow-sm"
        >
            {/* Sliding Active Indicator */}
            <div
                className="absolute left-1 top-1 h-8 w-8 rounded-lg bg-background shadow-sm border border-border/40 transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                style={{
                    transform: `translateX(${activeIndex * (32 + 4)}px)`,
                }}
            />

            {tabs.map((tab) => (
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
    label,
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
            title={label}
            className={cn(
                "relative z-10 flex items-center justify-center h-8 w-8 aspect-square rounded-lg transition-colors duration-300",
                active
                    ? "text-primary"
                    : "text-muted-foreground/40 hover:text-muted-foreground/80 hover:bg-sidebar-accent/30"
            )}
            style={active ? { color: color } : {}}
        >
            {icon}
        </button>
    );
}
