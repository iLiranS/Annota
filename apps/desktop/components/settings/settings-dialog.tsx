import { Bot, Brush, Cog, Database, HelpCircle, Type, User } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AccountSettings } from "./account-settings";
import { AppearanceSettings } from "./appearance-settings";
import { EditorSettings } from "./editor-settings";
import { GeneralSettings } from "./general-settings";
import { HelpSettings } from "./help-settings";
import { AiSettings } from "./ai-settings";
import { APP_RELEASE_VERSION, useChangelog } from "@annota/core";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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
        icon: <Brush className="h-4 w-4 text-white" />,
        iconBg: "bg-blue-500",
    },
    {
        id: "editor",
        label: "Editor",
        icon: <Type className="h-4 w-4 text-white" />,
        iconBg: "bg-violet-500",
    },
    {
        id: "general",
        label: "General",
        icon: <Cog className="h-4 w-4 text-white" />,
        iconBg: "bg-gray-500",
    },
    {
        id: "storage",
        label: "Storage & Debug",
        icon: <Database className="h-4 w-4 text-white" />,
        iconBg: "bg-orange-500",
    },
    {
        id: "account",
        label: "Account",
        icon: <User className="h-4 w-4 text-white" />,
        iconBg: "bg-green-500",
    },
    {
        id: "ai",
        label: "AI Models",
        icon: <Bot className="h-4 w-4 text-white" />,
        iconBg: "bg-blue-600",
    },
    {
        id: "help",
        label: "Help & Support",
        icon: <HelpCircle className="h-4 w-4 text-white" />,
        iconBg: "bg-slate-500",
    },
];

export default function SettingsDialog() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("appearance");
    const { openManual } = useChangelog("desktop");

    const handleClose = () => {
        navigate(-1);
    };

    return (
        <Dialog open onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-4xl h-[75vh] min-h-[500px] w-[90vw] gap-0 overflow-hidden p-0 shadow-2xl flex flex-col">
                <DialogDescription className="sr-only">Settings</DialogDescription>
                <DialogHeader className="px-6 pt-5 pb-0 shrink-0">
                    <DialogTitle className="text-lg">Settings</DialogTitle>
                </DialogHeader>

                <Separator className="mt-4 shrink-0" />

                <div className="flex flex-1 min-h-0">
                    {/* Left nav */}
                    <nav className="w-[200px] flex flex-col border-r border-border p-3 bg-muted/30">
                        <div className="flex-1 space-y-0.5">
                            {tabs
                                .filter((t) => !["account", "help"].includes(t.id))
                                .map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                                            activeTab === tab.id
                                                ? "bg-accent font-medium"
                                                : "hover:bg-accent/50",
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "flex h-6 w-6 items-center justify-center rounded-md",
                                                tab.iconBg,
                                            )}
                                        >
                                            {tab.icon}
                                        </span>
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                        </div>

                        <div className="space-y-0.5">
                            {tabs
                                .filter((t) => ["account", "help"].includes(t.id))
                                .map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                                            activeTab === tab.id
                                                ? "bg-accent font-medium"
                                                : "hover:bg-accent/50",
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "flex h-6 w-6 items-center justify-center rounded-md",
                                                tab.iconBg,
                                            )}
                                        >
                                            {tab.icon}
                                        </span>
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                        </div>
                        <p 
                            onClick={openManual}
                            className="mt-auto pt-4 px-3 text-[10px] font-mono text-center text-muted-foreground/80 uppercase tracking-tighter cursor-pointer hover:text-primary transition-colors"
                        >
                            build {APP_RELEASE_VERSION}
                        </p>

                    </nav>

                    {/* Right content */}
                    <div className="flex-1 overflow-auto p-10">
                        <h3 className="mb-4 text-base font-bold">
                            {tabs.find((t) => t.id === activeTab)?.label}
                        </h3>

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
