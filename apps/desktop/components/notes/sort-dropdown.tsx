import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ionicons } from "@/components/ui/ionicons";
import { cn } from "@/lib/utils";
import { SortType, getSortTypeLabel } from "@annota/core";
import { useMemo } from "react";

interface SortDropdownProps {
    currentSortType: SortType;
    onSortChange: (sortType: SortType) => void;
    className?: string;
}

const SORT_OPTIONS: SortType[] = [
    'UPDATED_LAST',
    'UPDATED_FIRST',
    'CREATED_LAST',
    'CREATED_FIRST',
    'NAME_ASC',
    'NAME_DESC',
];

export function SortDropdown({ currentSortType, onSortChange, className }: SortDropdownProps) {
    const { label, isAsc } = useMemo(() => {
        const fullLabel = getSortTypeLabel(currentSortType);
        const name = fullLabel.split('(')[0].trim();
        const asc = currentSortType.includes('ASC') || currentSortType.includes('FIRST');
        return { label: name, isAsc: asc };
    }, [currentSortType]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-7 px-2 gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all",
                        className
                    )}
                >
                    Sort by: {label}
                    <Ionicons
                        name={isAsc ? "arrow-up" : "arrow-down"}
                        size={12}
                        className="ml-0.5 text-primary/60"
                    />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-52 p-1 border-border/50 shadow-2xl bg-popover/95 backdrop-blur-md">
                <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    Sort Options
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/30" />
                <div className="py-1">
                    {SORT_OPTIONS.map((option) => {
                        const active = currentSortType === option;
                        return (
                            <DropdownMenuItem
                                key={option}
                                className={cn(
                                    "flex items-center justify-between px-2 py-2 cursor-pointer rounded-md transition-all group",
                                    active
                                        ? "bg-primary/10 text-primary font-bold"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                                )}
                                onClick={() => onSortChange(option)}
                            >
                                <span className="text-xs">{getSortTypeLabel(option)}</span>
                                {active && (
                                    <Ionicons name="checkmark" size={14} className="text-primary" />
                                )}
                            </DropdownMenuItem>
                        );
                    })}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
