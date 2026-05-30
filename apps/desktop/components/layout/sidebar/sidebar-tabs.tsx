import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useSettingsStore, type SidebarTab } from "@annota/core";
import { NotebookTabs } from "lucide-react";
import * as React from "react";
import { Ionicons } from "../../ui/ionicons";

interface SidebarTabsProps {
    activeTab: SidebarTab;
    setActiveTab: (tab: SidebarTab) => void;
    colors: {
        primary: string;
    };
}

const TABS: { id: SidebarTab; icon: React.ReactNode; label: string }[] = [
    { id: 'folders', icon: <Ionicons name="folder-outline" size={17} />, label: 'Folders' },
    { id: 'notes', icon: <NotebookTabs size={17} />, label: 'Notes' },
    { id: 'tags', icon: <Ionicons name="pricetag-outline" size={17} />, label: 'Tags' },
    { id: 'search', icon: <Ionicons name="search-outline" size={17} />, label: 'Search' },
];

export function SidebarTabs({ activeTab, setActiveTab, colors }: SidebarTabsProps) {
    const { open, setOpen, toggleSidebar } = useSidebar();
    const { general } = useSettingsStore()

    const handleTabClick = (tabId: SidebarTab) => {
        if (activeTab === tabId) {
            toggleSidebar();
        } else {
            setActiveTab(tabId);
            if (!open) {
                setOpen(true);
            }
        }
    };

    const isRtl = general.appDirection === 'rtl';

    return (
        <div
            className={cn(
                "flex items-center gap-0.5 rounded-md border border-sidebar-border/40 bg-sidebar-accent/20 p-0.5",
                isRtl && 'flex-row-reverse'
            )}
        >
            {TABS.map((tab) => (
                <TabButton
                    key={tab.id}
                    active={activeTab === tab.id && open}
                    onClick={() => handleTabClick(tab.id)}
                    icon={tab.icon}
                    label={tab.label}
                    color={colors.primary}
                />
            ))}
        </div>
    );
}

const TabButton = React.forwardRef<
    HTMLButtonElement,
    {
        active: boolean;
        onClick: () => void;
        icon: React.ReactNode;
        label: string;
        color: string;
    }
>((({ active, onClick, icon, color, ...props }, ref) => {
    return (
        <button
            ref={ref}
            onClick={onClick}
            className={cn(
                "relative flex flex-none items-center justify-center w-[26px] h-[26px] rounded-[4px] transition-all duration-200 focus:outline-none focus-visible:ring-0 active:scale-95",
                active
                    ? "text-primary bg-sidebar shadow-sm border border-sidebar-border/40"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-sidebar-accent/30"
            )}
            style={active ? { color: color } : {}}
            {...props}
        >
            <span className="flex items-center justify-center pointer-events-none">
                {icon}
            </span>
        </button>
    );
}));
TabButton.displayName = "TabButton";





