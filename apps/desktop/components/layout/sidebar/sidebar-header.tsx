import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarHeader } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SortType } from "@annota/core";
import { CheckSquare, FolderPen, MoreVertical, SquarePen } from "lucide-react";
import { AnnotaIcon } from "../../custom-ui/annota-icon";
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
    onEditFolder?: () => void;
    tagId?: string;
    isRoot?: boolean;
    selectionMode?: boolean;
    setSelectionMode?: (mode: boolean) => void;
    dir: "ltr" | "rtl"
}

function getSortTypeIcon(sortType: SortType): string {
    switch (sortType) {
        case 'UPDATED_LAST':
            return 'time';
        case 'UPDATED_FIRST':
            return 'time-outline';
        case 'CREATED_LAST':
            return 'calendar';
        case 'CREATED_FIRST':
            return 'calendar-outline';
        case 'NAME_ASC':
            return 'text-outline';
        case 'NAME_DESC':
            return 'text';
        default:
            return 'funnel-outline';
    }
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
    onEditFolder,
    sortOptions,
    getSortTypeLabel,
    tagId,
    isRoot,
    selectionMode,
    setSelectionMode,
    dir,
}: SidebarHeaderSectionProps) {


    return (
        <SidebarHeader
            style={{
                backgroundColor: `${color}25`,      // subtle tinted background
                borderColor: `${color}30`,          // soft border
                boxShadow: `0 4px 10px ${color}15`,
            }}
            className={cn(
                "py-2 justify-center rounded-xl border",
                "transition-all duration-300",
                "dark:shadow-none",
                dir === "rtl" && "animate-content-from-right",
                dir === "ltr" && "animate-content-from-left"
            )}
        >
            <div className="flex items-center justify-between gap-1 w-full">
                <div data-tauri-drag-region
                    className="flex items-center gap-1 overflow-hidden flex-1  transition-opacity"
                >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                        {isRoot ? (
                            <AnnotaIcon color={color} size={20} />
                        ) : isDaily ? (
                            <Ionicons name="calendar" color={color} size={16} />
                        ) : (
                            <Ionicons name={icon} color={color} size={16} />
                        )}
                    </div>
                    <h2 style={{ color: color }} className="text-sm font-bold tracking-tight truncate">
                        {title}
                    </h2>
                </div>
                <div className="flex items-center gap-0.5">
                    <TooltipProvider>

                        {!isTrash && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 hover:bg-primary/10 transition-colors"
                                        onClick={onCreateNote}
                                        style={{ color: color }}
                                    >
                                        <SquarePen className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px] font-bold">New Note</TooltipContent>
                            </Tooltip>
                        )}
                        {!isTrash && !isDaily && !tagId && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground/60 hover:bg-primary/10 transition-colors"
                                        style={{ color: color }}
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                    <DropdownMenuItem onClick={onCreateFolder} className="gap-2 cursor-pointer">
                                        <Ionicons name="folder-outline" size={16} />
                                        <span>New Folder</span>
                                    </DropdownMenuItem>

                                    {!isRoot && onEditFolder && (
                                        <DropdownMenuItem onClick={onEditFolder} className="gap-2 cursor-pointer">
                                            <FolderPen size={16} />
                                            <span>Edit Folder</span>
                                        </DropdownMenuItem>
                                    )}

                                    {setSelectionMode && (
                                        <DropdownMenuItem onClick={() => setSelectionMode(!selectionMode)} className="gap-2 cursor-pointer">
                                            <CheckSquare size={16} />
                                            <span>{selectionMode ? "Cancel Selection" : "Select Notes"}</span>
                                        </DropdownMenuItem>
                                    )}

                                    <DropdownMenuSeparator />

                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                                            <Ionicons name="funnel-outline" size={16} />
                                            <span>Sort by</span>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="w-52">
                                            {sortOptions.map((option) => {
                                                const active = currentSortType === option;
                                                return (
                                                    <DropdownMenuItem
                                                        key={option}
                                                        className={cn(
                                                            "flex items-center justify-between cursor-pointer",
                                                            active && "bg-primary/10 text-primary font-medium"
                                                        )}
                                                        onClick={() => onSortChange(option)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Ionicons
                                                                name={getSortTypeIcon(option)}
                                                                size={14}
                                                                className={cn(
                                                                    active
                                                                        ? "text-primary"
                                                                        : "text-muted-foreground/60"
                                                                )}
                                                            />
                                                            <span>{getSortTypeLabel(option)}</span>
                                                        </div>
                                                        {active && (
                                                            <Ionicons name="checkmark" size={14} className="text-primary" />
                                                        )}
                                                    </DropdownMenuItem>
                                                );
                                            })}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </TooltipProvider>
                </div>
            </div>
        </SidebarHeader>
    );
}
