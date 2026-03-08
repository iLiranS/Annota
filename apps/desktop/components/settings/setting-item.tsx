import { cn } from "@/lib/utils";
import React from "react";

export interface SettingItemProps {
    label: string;
    description?: string;
    icon: React.ReactNode;
    iconBg: string;
    action?: React.ReactNode;
    onClick?: () => void;
    value?: React.ReactNode;
    active?: boolean;
    danger?: boolean;
    loading?: boolean;
}

export function SettingItem({
    label,
    description,
    icon,
    iconBg,
    action,
    onClick,
    value,
    active,
    danger,
    loading
}: SettingItemProps) {
    return (
        <div
            onClick={loading ? undefined : onClick}
            className={cn(
                "group flex items-center justify-between p-3 rounded-xl transition-all duration-200",
                // Apply the "round border" cancellation of first and last only if the setting item is not the only child
                "not-last:rounded-b-none rounded-t-none",
                onClick && !loading ? "cursor-pointer hover:bg-accent/50" : "",
                active ? "bg-accent/30" : "",
                loading ? "opacity-60" : ""
            )}
        >
            <div className="flex items-center gap-3">
                <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm transition-transform",
                    !loading && "group-hover:scale-105",
                    iconBg
                )}>
                    {loading ? (
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : icon}
                </div>
                <div className="flex flex-col text-left">
                    <span className={cn(
                        "text-sm font-medium",
                        danger ? "text-destructive" : "text-foreground"
                    )}>
                        {label}
                    </span>
                    {description && <span className="text-xs text-muted-foreground">{description}</span>}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {value !== undefined && <div className="text-sm text-muted-foreground mr-1">{value}</div>}
                {action}
            </div>
        </div>
    );
}
