import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarHeader } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SortType } from "@annota/core";
import { MoreVertical, SquarePen } from "lucide-react";
import { DailyNoteIcon } from "../../custom-ui/daily-note-icon";
import { Ionicons } from "../../ui/ionicons";

interface SidebarHeaderSectionProps {
    title: string;
    icon: string;
    color: string;
    isDaily: boolean;
    isTrash: boolean;
    currentSortType: SortType | string;
    onSortChange: (type: SortType) => void;
    onCreateNote: () => void;
    onCreateFolder: () => void;
    sortOptions: SortType[];
    getSortTypeLabel: (type: SortType) => string;
}

export function SidebarHeaderSection({
    title,
    icon,
    color,
    isDaily,
    isTrash,
    currentSortType,
    onSortChange,
    onCreateNote,
    onCreateFolder,
    sortOptions,
    getSortTypeLabel,
}: SidebarHeaderSectionProps) {
    return (
        <SidebarHeader
            style={{ backgroundColor: color + "20" }}
            className="h-14 px-4 py-0 justify-center border-b border-border/10"
        >
            <div className="flex items-center justify-between gap-2 w-full">
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                        {isDaily ? (
                            <DailyNoteIcon color={color} size={16} />
                        ) : (
                            <Ionicons name={icon} color={color} size={16} />
                        )}
                    </div>
                    <h2 style={{ color: color }} className="text-sm font-bold tracking-tight truncate">
                        {title}
                    </h2>
                </div>
                <div className="flex items-center gap-1">
                    <TooltipProvider>
                        {!isTrash && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 hover:bg-primary/10 transition-colors"
                                        onClick={onCreateNote}
                                        style={{ color: color }}
                                    >
                                        <SquarePen className="h-4.5 w-4.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px] font-bold">New Note</TooltipContent>
                            </Tooltip>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground/60 hover:bg-primary/10 transition-colors"
                                    style={{ color: color }}
                                >
                                    <MoreVertical className="h-4.5 w-4.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem onClick={onCreateFolder} className="gap-2 cursor-pointer">
                                    <Ionicons name="folder-outline" size={16} />
                                    <span>New Folder</span>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                                        <Ionicons name="funnel-outline" size={16} />
                                        <span>Sort by</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-52">
                                        {sortOptions.map((option) => (
                                            <DropdownMenuItem
                                                key={option}
                                                className={cn(
                                                    "flex items-center justify-between cursor-pointer",
                                                    currentSortType === option && "bg-primary/10 text-primary font-medium"
                                                )}
                                                onClick={() => onSortChange(option)}
                                            >
                                                <span>{getSortTypeLabel(option)}</span>
                                                {currentSortType === option && (
                                                    <Ionicons name="checkmark" size={14} />
                                                )}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TooltipProvider>
                </div>
            </div>
        </SidebarHeader>
    );
}
