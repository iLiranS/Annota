import {
    Brush,
    Cog,
    Database,
    Type,
    User,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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
        id: "account",
        label: "Account",
        icon: <User className="h-4 w-4 text-white" />,
        iconBg: "bg-green-500",
    },
    {
        id: "storage",
        label: "Storage & Debug",
        icon: <Database className="h-4 w-4 text-white" />,
        iconBg: "bg-orange-500",
    },
];

export default function SettingsDialog() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("appearance");

    const handleClose = () => {
        navigate(-1);
    };

    return (
        <Dialog open onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-h-[600px] max-w-[640px] gap-0 overflow-hidden p-0">
                <DialogHeader className="px-6 pt-5 pb-0">
                    <DialogTitle className="text-lg">Settings</DialogTitle>
                </DialogHeader>

                <Separator className="mt-4" />

                <div className="flex min-h-[420px]">
                    {/* Left nav */}
                    <nav className="w-[180px] space-y-0.5 border-r border-border p-2">
                        {tabs.map((tab) => (
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
                    </nav>

                    {/* Right content */}
                    <div className="flex-1 overflow-auto p-6">
                        <h3 className="mb-4 text-base font-bold">
                            {tabs.find((t) => t.id === activeTab)?.label}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Settings for {tabs.find((t) => t.id === activeTab)?.label} will
                            be implemented in a later phase.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
