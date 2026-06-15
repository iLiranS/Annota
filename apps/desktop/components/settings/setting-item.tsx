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
                "group flex items-center justify-between px-4 py-3.5 transition-all duration-200 select-none",
                onClick && !active && !loading ? "cursor-pointer hover:bg-muted/50 dark:hover:bg-muted/15" : "",
                active ? "bg-primary/10 text-primary" : "",
                loading ? "opacity-60" : ""
            )}
        >
            <div className="flex items-center gap-3.5">
                <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm transition-transform duration-200",
                    !loading && "group-hover:scale-105 group-hover:rotate-1",
                    iconBg
                )}>
                    {loading ? (
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : icon}
                </div>
                <div className="flex flex-col text-left">
                    <span className={cn(
                        "text-sm font-medium tracking-tight",
                        danger ? "text-destructive" : "text-foreground/95"
                    )}>
                        {label}
                    </span>
                    {description && <span className="text-xs text-muted-foreground/90 mt-0.5">{description}</span>}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {value !== undefined && <div className="text-sm font-medium text-muted-foreground/80 mr-1.5">{value}</div>}
                {action}
            </div>
        </div>
    );
}
