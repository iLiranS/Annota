import { cn } from "@/lib/utils";
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
    return (
        <div data-tauri-drag-region className="flex items-center justify-center gap-1 p-1 rounded-xl bg-sidebar-accent/20 dark:bg-sidebar-accent/40 border border-sidebar-border/40 shadow-sm">
            <TabButton
                active={activeTab === 'folders'}
                onClick={() => setActiveTab('folders')}
                icon={<Ionicons name="folder-outline" size={16} />}
                label="Folders"
                color={colors.primary}
            />
            <TabButton
                active={activeTab === 'notes'}
                onClick={() => setActiveTab('notes')}
                icon={<Ionicons name="document-text-outline" size={16} />}
                label="Notes"
                color={colors.primary}
            />
            <TabButton
                active={activeTab === 'tags'}
                onClick={() => setActiveTab('tags')}
                icon={<Ionicons name="pricetag-outline" size={16} />}
                label="Tags"
                color={colors.primary}
            />
            <TabButton
                active={activeTab === 'search'}
                onClick={() => setActiveTab('search')}
                icon={<Ionicons name="search-outline" size={16} />}
                label="Search"
                color={colors.primary}
            />
        </div>
    );
}

function TabButton({ active, onClick, icon, label, color }: { active: boolean; onClick: () => void; icon: any; label: string; color: string }) {
    return (
        <button
            onClick={onClick}
            title={label}
            className={cn(
                "flex items-center justify-center h-8 w-8 aspect-square rounded-lg transition duration-150 border border-transparent",
                active
                    ? "bg-background text-primary shadow-sm border-border/40"
                    : "text-muted-foreground/40 hover:text-muted-foreground/80 hover:bg-sidebar-accent/50"
            )}
            style={active ? { color: color } : {}}
        >
            {icon}
        </button>
    );
}
