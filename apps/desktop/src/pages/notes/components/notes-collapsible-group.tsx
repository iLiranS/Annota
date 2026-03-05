import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@/components/ui/collapsible";
import { Ionicons } from "@/components/ui/ionicons";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import React, { useState } from "react";

interface NotesCollapsibleGroupProps {
    title: string;
    icon: string;
    children: React.ReactNode;
    count?: number;
    color?: string;
    defaultOpen?: boolean;
}

export function NotesCollapsibleGroup({
    title,
    icon,
    children,
    count,
    color,
    defaultOpen = true,
}: NotesCollapsibleGroupProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="w-full space-y-1 mb-2"
        >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-all hover:bg-accent/40 group focus:outline-none focus:ring-1 focus:ring-primary/20">
                <div className="flex items-center gap-2 text-muted-foreground/70">
                    <div
                        className="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
                        style={{ backgroundColor: color ? `${color}15` : 'transparent' }}
                    >
                        <Ionicons
                            name={icon}
                            size={14}
                            color={color || 'currentColor'}
                            className={cn(!color && "text-muted-foreground/70 group-hover:text-foreground transition-colors")}
                        />
                    </div>
                    <span
                        className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 group-hover:text-foreground/90 transition-colors"
                    >
                        {title}
                        {count !== undefined && count > 0 && (
                            <span className="ml-2 text-[10px] lowercase font-medium text-muted-foreground/30">
                                {count}
                            </span>
                        )}
                    </span>
                </div>
                <ChevronDown
                    className={cn(
                        "h-3.5 w-3.5 text-muted-foreground/70 transition-transform duration-300 ease-in-out group-hover:text-muted-foreground/50",
                        !isOpen && "-rotate-90"
                    )}
                />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 px-0.5 py-0.5 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
                {children}
            </CollapsibleContent>
        </Collapsible>
    );
}
