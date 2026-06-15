import { APP_RELEASE_VERSION, useChangelog, useNavigationStore } from "@annota/core";
import { Bot, Brush, Cog, Database, HelpCircle, Keyboard, Type, User } from "lucide-react";
import { useState } from "react";
import { AccountSettings } from "./account-settings";
import { AiSettings } from "./ai-settings";
import { AppearanceSettings } from "./appearance-settings";
import { EditorSettings } from "./editor-settings";
import { GeneralSettings } from "./general-settings";
import { HelpSettings } from "./help-settings";
import { ShortcutsSettings } from "./shortcuts-settings";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { StorageSettings } from "./storage-settings";

interface SettingsTab {
    id: string;
    label: string;
    icon: React.ReactNode;
    iconBg: string;
}

const tabs: SettingsTab[] = [
    {
        id: "appearance",
        label: "Appearance",
        icon: <Brush className="h-3.5 w-3.5 text-white" />,
        iconBg: "bg-gradient-to-tr from-blue-600 to-sky-400",
    },
    {
        id: "editor",
        label: "Editor",
        icon: <Type className="h-3.5 w-3.5 text-white" />,
        iconBg: "bg-gradient-to-tr from-violet-600 to-fuchsia-400",
    },
    {
        id: "general",
        label: "General",
        icon: <Cog className="h-3.5 w-3.5 text-white" />,
        iconBg: "bg-gradient-to-tr from-slate-600 to-slate-400",
    },
    {
        id: "storage",
        label: "Storage & Debug",
        icon: <Database className="h-3.5 w-3.5 text-white" />,
        iconBg: "bg-gradient-to-tr from-orange-600 to-amber-400",
    },
    {
        id: "ai",
        label: "AI",
        icon: <Bot className="h-3.5 w-3.5 text-white" />,
        iconBg: "bg-gradient-to-tr from-blue-700 to-indigo-500",
    },
    {
        id: "account",
        label: "Account",
        icon: <User className="h-3.5 w-3.5 text-white" />,
        iconBg: "bg-gradient-to-tr from-emerald-600 to-teal-400",
    },
    {
        id: "shortcuts",
        label: "Shortcuts",
        icon: <Keyboard className="h-3.5 w-3.5 text-white" />,
        iconBg: "bg-gradient-to-tr from-amber-600 to-yellow-400",
    },
    {
        id: "help",
        label: "Help & Support",
        icon: <HelpCircle className="h-3.5 w-3.5 text-white" />,
        iconBg: "bg-gradient-to-tr from-slate-700 to-slate-500",
    },
];

export default function SettingsDialog() {
    const [activeTab, setActiveTab] = useState("appearance");
    const { openManual } = useChangelog("desktop");
    const { isSettingsOpen, setSettingsOpen } = useNavigationStore();

    const handleClose = () => {
        setSettingsOpen(false);
    };

    return (
        <Dialog open={isSettingsOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-4xl h-[75vh] min-h-[500px] w-[90vw] gap-0 overflow-hidden p-0 shadow-2xl flex flex-row border-muted/30 bg-note-bg/90 backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-200">
                <DialogDescription className="sr-only">Settings</DialogDescription>

                {/* Left nav */}
                <nav className="w-[220px] flex flex-col border-r border-border/30 p-4 bg-muted/10 dark:bg-muted/5 select-none shrink-0 justify-between">
                    <div className="space-y-4">
                        <div className="px-3 py-1.5 shrink-0">
                            <DialogTitle className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Settings</DialogTitle>
                        </div>

                        <div className="space-y-1 flex flex-col gap-0.5">
                            {tabs
                                .filter((t) => !["account", "help", "shortcuts"].includes(t.id))
                                .map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative",
                                            activeTab === tab.id
                                                ? "bg-primary/10 text-primary hover:bg-primary/15"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "flex h-6 w-6 items-center justify-center rounded-md shadow-sm transition-transform duration-200",
                                                tab.iconBg
                                            )}
                                        >
                                            {tab.icon}
                                        </span>
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                        </div>

                        <div className="h-px bg-border/40 my-2" />

                        <div className="space-y-1 flex flex-col gap-0.5">
                            {tabs
                                .filter((t) => ["account", "help", "shortcuts"].includes(t.id))
                                .map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative",
                                            activeTab === tab.id
                                                ? "bg-primary/10 text-primary hover:bg-primary/15"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "flex h-6 w-6 items-center justify-center rounded-md shadow-sm transition-transform duration-200",
                                                tab.iconBg
                                            )}
                                        >
                                            {tab.icon}
                                        </span>
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                        </div>
                    </div>

                    <p
                        onClick={openManual}
                        className="pt-4 px-3 text-[10px] font-mono text-center text-muted-foreground/60 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
                    >
                        build {APP_RELEASE_VERSION}
                    </p>
                </nav>

                {/* Right content */}
                <div className="flex-1 overflow-auto px-8 py-6 flex flex-col min-h-0 bg-background/50">
                    <div className="mb-6 shrink-0">
                        <h3 className="text-xl font-bold tracking-tight text-foreground">
                            {tabs.find((t) => t.id === activeTab)?.label}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {activeTab === "appearance" && "Customize the themes, layouts, and colors of your workspace."}
                            {activeTab === "editor" && "Configure writing options, fonts, and general editing behaviors."}
                            {activeTab === "general" && "Manage calendar options, localization settings, and layout directions."}
                            {activeTab === "storage" && "Monitor local databases, clear caches, and configure storage limits."}
                            {activeTab === "ai" && "Manage model providers, default models, temperature, and API keys."}
                            {activeTab === "account" && "Update profile settings, handle subscription models, and cloud accounts."}
                            {activeTab === "shortcuts" && "Configure customized hotkeys and shortcut lists."}
                            {activeTab === "help" && "Read user guides, report issues, and view detailed app information."}
                        </p>
                    </div>

                    <div className="flex-1 min-h-0">
                        {activeTab === "account" ? (
                            <AccountSettings />
                        ) : activeTab === "appearance" ? (
                            <AppearanceSettings />
                        ) : activeTab === "editor" ? (
                            <EditorSettings />
                        ) : activeTab === "general" ? (
                            <GeneralSettings />
                        ) : activeTab === "storage" ? (
                            <StorageSettings />
                        ) : activeTab === "ai" ? (
                            <AiSettings />
                        ) : activeTab === "shortcuts" ? (
                            <ShortcutsSettings />
                        ) : activeTab === "help" ? (
                            <HelpSettings />
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Settings for {tabs.find((t) => t.id === activeTab)?.label} will
                                be implemented in a later phase.
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
