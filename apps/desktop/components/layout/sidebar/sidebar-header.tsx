import { ConfirmDialog } from "@/components/custom-ui/confirm-dialog";
import {
    Breadcrumb,
    BreadcrumbEllipsis,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarHeader } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useExportFolder } from "@/hooks/use-export-folder";
import { cn } from "@/lib/utils";
import { SortType } from "@annota/core";
import { CheckSquare, FolderDown, FolderPen, MoreVertical, SquarePen } from "lucide-react";
import { useState } from "react";
import { AnnotaIcon } from "../../custom-ui/annota-icon";
import { Ionicons } from "../../ui/ionicons";
import { type BreadcrumbData } from "./breadcrumbs";

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
    currentFolderId?: string | null;
    selectionMode?: boolean;
    setSelectionMode?: (mode: boolean) => void;
    dir: "ltr" | "rtl";
    breadcrumbs?: BreadcrumbData[] | null;
    onNavigateBreadcrumb?: (id: string | null) => void;
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
    currentFolderId,
    selectionMode,
    setSelectionMode,
    dir,
    breadcrumbs,
    onNavigateBreadcrumb,
}: SidebarHeaderSectionProps) {

    const [showExportConfirm, setShowExportConfirm] = useState(false);
    const { handleExport, isExporting } = useExportFolder();

    return (
        <>
            <SidebarHeader
                dir={dir}
                style={{
                    "--note-color": color,
                } as React.CSSProperties}
                className={cn(
                    "py-1 px-1 mx-1 gap-0.5 justify-center rounded-md border transition-all duration-300",
                    "sidebar-header-tinted",
                    dir === "rtl" && "animate-content-from-right",
                    dir === "ltr" && "animate-content-from-left"
                )}
            >
                {/* Main Row: Icon, Title & Action Buttons */}
                <div className="flex items-center justify-between gap-1.5 w-full">
                    <div data-tauri-drag-region
                        className="flex items-center gap-1.5 overflow-hidden flex-1 transition-opacity min-w-0"
                    >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors">
                            {isRoot ? (
                                <AnnotaIcon color={color} size={20} />
                            ) : isDaily ? (
                                <Ionicons name="calendar" color={color} size={15} />
                            ) : (
                                <Ionicons name={icon} color={color} size={15} />
                            )}
                        </div>
                        <h2 style={{ color: color }} className="text-sm font-semibold tracking-tight truncate">
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
                                            className="h-7 w-7 rounded-md hover:bg-(--hover-bg) active:scale-95 transition-all duration-200"
                                            onClick={onCreateNote}
                                            style={{
                                                color: color,
                                                '--hover-bg': `${color}18`
                                            } as React.CSSProperties}
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
                                            className="h-7 w-7 rounded-md text-muted-foreground/60 hover:bg-(--hover-bg) active:scale-95 transition-all duration-200"
                                            style={{
                                                color: color,
                                                '--hover-bg': `${color}18`
                                            } as React.CSSProperties}
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="center" className="w-52">
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

                                        {!isRoot && (
                                            <DropdownMenuItem onClick={() => setShowExportConfirm(true)} className="gap-2 cursor-pointer">
                                                <FolderDown size={16} />
                                                <span>Export to MD</span>
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

            {/* Breadcrumbs Row */}
            {!isRoot && breadcrumbs && breadcrumbs.length > 0 && (
                <div className={cn(
                    "px-2 py-1.5 border-b border-sidebar-border/60 shrink-0 select-none max-w-full bg-transparent",
                    dir === "rtl" && "animate-content-from-right",
                    dir === "ltr" && "animate-content-from-left"
                )}>
                    <Breadcrumb className=" pb-0 pt-0 bg-transparent shrink-0 select-none max-w-full ">
                        <BreadcrumbList className="flex-nowrap gap-0!">
                            {breadcrumbs.map((crumb, i) => (
                                <div key={i} className="flex items-center min-w-0">
                                    {i > 0 && (
                                        <BreadcrumbSeparator className="opacity-30 shrink-0 mx-0.5 flex items-center justify-center">
                                            <Ionicons className="rtl:rotate-180" name="chevron-forward" size={7} />
                                        </BreadcrumbSeparator>
                                    )}
                                    <BreadcrumbItem className="min-w-0">
                                        {crumb.name === "..." ? (
                                            <BreadcrumbEllipsis className="h-3 w-3 p-0 flex items-center justify-center text-muted-foreground/40" />
                                        ) : (
                                            <BreadcrumbLink
                                                asChild
                                                className="cursor-pointer active:scale-95 transition-all duration-150 text-[11px] font-semibold flex items-center gap-0.5 min-w-0 bg-transparent border-none p-0 outline-none text-(--crumb-color) hover:text-(--crumb-color-hover)"
                                                style={{
                                                    '--crumb-color': crumb.color ? `${crumb.color}bb` : "var(--muted-foreground)",
                                                    '--crumb-color-hover': crumb.color || "var(--foreground)",
                                                } as React.CSSProperties}
                                            >
                                                <button type="button" onClick={() => onNavigateBreadcrumb?.(crumb.id)}>
                                                    {crumb.icon === "annota" ? (
                                                        <AnnotaIcon
                                                            size={14}
                                                            className={cn("shrink-0")}
                                                            color={crumb.color}
                                                        />
                                                    ) : crumb.icon && (
                                                        <Ionicons
                                                            name={crumb.icon}
                                                            size={12}
                                                            className={cn("shrink-0", !crumb.color && "text-muted-foreground/40")}
                                                            color={crumb.color}
                                                        />
                                                    )}
                                                    <span className="truncate max-w-[120px] leading-none">
                                                        {crumb.name === "All Notes" ? "Annota" : crumb.name}
                                                    </span>
                                                </button>
                                            </BreadcrumbLink>
                                        )}
                                    </BreadcrumbItem>
                                </div>
                            ))}
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            )}
            {/* Confirm export dialog */}
            <ConfirmDialog
                open={showExportConfirm}
                onOpenChange={setShowExportConfirm}
                title="Export Folder to Markdown"
                description={`Are you sure you want to export all notes and subfolders in "${title}" to Markdown?`}
                confirmText={isExporting ? "Exporting..." : "Export"}
                cancelText="Cancel"
                onConfirm={async () => {
                    setShowExportConfirm(false);
                    await handleExport(currentFolderId ?? null, title);
                }}
                variant="default"
            />
        </>
    );
}
