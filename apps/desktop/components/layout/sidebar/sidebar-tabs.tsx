import { cn } from "@/lib/utils";
import { type SidebarTab } from "@annota/core";
import { NotebookTabs } from "lucide-react";
import { Ionicons } from "../../ui/ionicons";
import { useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import * as React from "react";

interface SidebarTabsProps {
    activeTab: SidebarTab;
    setActiveTab: (tab: SidebarTab) => void;
    colors: {
        primary: string;
    };
}

const TABS: { id: SidebarTab; icon: React.ReactNode; label: string }[] = [
    { id: 'folders', icon: <Ionicons name="folder-outline" size={15} />, label: 'Folders' },
    { id: 'notes', icon: <NotebookTabs size={15} />, label: 'Notes' },
    { id: 'tags', icon: <Ionicons name="pricetag-outline" size={15} />, label: 'Tags' },
    { id: 'search', icon: <Ionicons name="search-outline" size={15} />, label: 'Search' },
];

export function SidebarTabs({ activeTab, setActiveTab, colors }: SidebarTabsProps) {
    const { open, setOpen, toggleSidebar } = useSidebar();

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

    return (
        <div className="flex items-center gap-0.5">
            {TABS.map((tab) => (
                <Tooltip key={tab.id}>
                    <TooltipTrigger asChild>
                        <TabButton
                            active={activeTab === tab.id && open}
                            onClick={() => handleTabClick(tab.id)}
                            icon={tab.icon}
                            label={tab.label}
                            color={colors.primary}
                        />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px]">
                        {tab.label}
                    </TooltipContent>
                </Tooltip>
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
>(({ active, onClick, icon, color, ...props }, ref) => {
    return (
        <button
            ref={ref}
            onClick={onClick}
            className={cn(
                "relative flex flex-none items-center justify-center w-7 h-7 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-0 active:scale-95",
                active
                    ? "bg-sidebar-accent/50 text-primary"
                    : "text-muted-foreground/60 hover:bg-sidebar-accent hover:text-foreground"
            )}
            style={active ? { color: color } : {}}
            {...props}
        >
            <span className="flex items-center justify-center w-4 h-4 pointer-events-none">
                {icon}
            </span>
        </button>
    );
});
TabButton.displayName = "TabButton";



