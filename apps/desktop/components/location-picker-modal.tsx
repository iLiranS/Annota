import { BreadcrumbData, BreadcrumbsSection } from "@/components/layout/sidebar/breadcrumbs";
import { TRASH_FOLDER_ID, useNotesStore } from "@annota/core";
import { ArrowLeft, ChevronRight, Folder, Home } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Ionicons } from "@/components/ui/ionicons";
import { useAppTheme } from "@/hooks/use-app-theme";

interface LocationPickerModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentFolderId?: string; // The folder being moved (to exclude it and children)
    selectedParentId: string | null;
    onSelect: (parentId: string | null) => void;
    onClose: () => void;
    onCreateFolder?: (parentId: string | null) => void;
    showCreateButton?: boolean;
}

/**
 * Navigable folder picker modal for Desktop
 * Allows browsing folder hierarchy to select a destination
 */
export function LocationPickerModal({
    open,
    onOpenChange,
    currentFolderId,
    selectedParentId,
    onSelect,
    onClose,
    onCreateFolder,
    showCreateButton = true,
}: LocationPickerModalProps) {
    const { colors } = useAppTheme();
    const { folders, getFolderById } = useNotesStore();

    const [browsingFolderId, setBrowsingFolderId] = useState<string | null>(null);

    // Reset browsing position when modal opens
    useEffect(() => {
        if (open) {
            setBrowsingFolderId(selectedParentId);
        }
    }, [open, selectedParentId]);

    // Get all descendant folder IDs (to exclude from selection)
    const getDescendantIds = useCallback((folderId: string): string[] => {
        const children = folders.filter(f => f.parentId === folderId && !f.isDeleted);
        return [folderId, ...children.flatMap(c => getDescendantIds(c.id))];
    }, [folders]);

    // IDs that should be excluded (current folder and its descendants)
    const excludedIds = useMemo(() => {
        if (!currentFolderId) return new Set<string>();
        return new Set(getDescendantIds(currentFolderId));
    }, [currentFolderId, getDescendantIds]);

    // Folders at current browsing level
    const foldersAtLevel = useMemo(() => {
        return folders.filter(f =>
            f.parentId === browsingFolderId &&
            f.id !== TRASH_FOLDER_ID &&
            !f.isDeleted &&
            !f.isSystem &&
            !excludedIds.has(f.id)
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [folders, browsingFolderId, excludedIds]);

    // Current browsing folder object
    const browsingFolder = browsingFolderId ? getFolderById(browsingFolderId) : null;

    // Build breadcrumb path
    const breadcrumbs = useMemo(() => {
        const crumbs: BreadcrumbData[] = [{
            id: null,
            name: "Notes",
            icon: "home",
            color: colors.primary
        }];
        let currentId = browsingFolderId;
        const path: BreadcrumbData[] = [];

        while (currentId) {
            const folder = getFolderById(currentId);
            if (folder) {
                path.unshift({
                    id: folder.id,
                    name: folder.name,
                    icon: folder.icon || "folder",
                    color: folder.color
                });
                currentId = folder.parentId;
            } else {
                break;
            }
        }

        return [...crumbs, ...path];
    }, [browsingFolderId, getFolderById, colors.primary]);

    // Check if current browsing location is selected
    const isCurrentLocationSelected = browsingFolderId === selectedParentId;

    // Handle selecting current location
    const handleSelectHere = () => {
        onSelect(browsingFolderId);
        onOpenChange(false);
    };

    // Handle navigating into a folder
    const handleNavigateInto = (folderId: string) => {
        setBrowsingFolderId(folderId);
    };

    // Handle navigating back
    const handleNavigateBack = () => {
        if (browsingFolder) {
            setBrowsingFolderId(browsingFolder.parentId);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} showCloseButton={false} className="max-w-md p-0 overflow-hidden flex flex-col h-[500px]">
                <DialogHeader className="px-6 pt-5 pb-4 border-b">
                    <DialogTitle className="text-lg font-bold flex items-center justify-between">
                        <span>Select Location</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-8 w-8"
                        >
                            <Ionicons name="close" size={20} />
                        </Button>
                    </DialogTitle>
                </DialogHeader>

                {/* Breadcrumb Navigation */}
                <div className="min-h-9 bg-muted/30 border-b flex items-center">
                    <div className="flex-1 overflow-x-auto no-scrollbar">
                        <BreadcrumbsSection
                            breadcrumbs={breadcrumbs}
                            onNavigate={setBrowsingFolderId}
                            className="border-none bg-transparent"
                        />
                    </div>
                    {showCreateButton && (
                        <button
                            type="button"
                            onClick={() => onCreateFolder?.(browsingFolderId)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all mr-2 whitespace-nowrap"
                        >
                            <Ionicons name="add-outline" size={12} />
                            New Folder
                        </button>
                    )}
                </div>

                {/* Current Location Info & Select Button */}
                <div className="p-4 mx-4 mt-4 rounded-xl border border-border/50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div style={{ backgroundColor: browsingFolder?.color + "20" }} className="p-2 bg-accent-full/10 rounded-lg shadow-sm shrink-0">
                            {browsingFolder ? (
                                <Ionicons
                                    name={browsingFolder.icon || "folder"}
                                    size={18}
                                    color={browsingFolder.color || colors.primary}
                                />
                            ) : (
                                <Home className="h-4.5 w-4.5" style={{ color: colors.primary }} />
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">
                                {browsingFolder?.name ?? "Notes (Root)"}
                            </p>

                        </div>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleSelectHere}
                        className="font-bold shrink-0"
                        style={{ backgroundColor: colors.primary }}
                    >
                        {isCurrentLocationSelected ? "Keep Here" : "Move Here"}
                    </Button>
                </div>

                {/* Folder List */}
                <div className="flex-1 p-4 overflow-y-auto premium-scrollbar">
                    <div className="space-y-1.5">
                        {/* Back button when not at root */}
                        {browsingFolderId !== null && (
                            <Button
                                variant="ghost"
                                onClick={handleNavigateBack}
                                className="w-full h-auto flex items-center gap-3 p-2.5 rounded-lg text-left transition-all hover:bg-muted/50 group justify-start"
                            >
                                <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-muted-foreground/10 group-hover:text-foreground transition-colors">
                                    <ArrowLeft className="h-4.5 w-4.5" />
                                </div>
                                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                                    Back to {browsingFolder?.parentId ? getFolderById(browsingFolder.parentId)?.name : "Notes"}
                                </span>
                            </Button>
                        )}

                        {/* Folders at current level */}
                        {foldersAtLevel.map((folder) => {
                            const hasChildren = folders.some(f =>
                                f.parentId === folder.id &&
                                !f.isDeleted &&
                                !excludedIds.has(f.id)
                            );

                            const folderBgColor = (folder.color || "#F59E0B");

                            return (
                                <Button
                                    key={folder.id}
                                    variant="ghost"
                                    onClick={() => handleNavigateInto(folder.id)}
                                    className="w-full h-auto flex justify-between group items-center gap-3 p-2.5 rounded-xl transition-all border border-transparent hover:border-border/30"
                                    style={{
                                        backgroundColor: folderBgColor + "25",
                                    }}
                                >
                                    <div className="flex h-9 gap-3 items-center">
                                        <div
                                            className="p-2 rounded-lg bg-background/50 shadow-sm group-hover:scale-110 transition-transform"
                                        >
                                            <Ionicons
                                                name={folder.icon || "folder"}
                                                size={18}
                                                color={folder.color || "#F59E0B"}
                                            />
                                        </div>
                                        <span className="text-sm font-semibold text-foreground truncate">
                                            {folder.name}
                                        </span>
                                    </div>
                                    {hasChildren && (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </Button>
                            );
                        })}

                        {/* Empty state */}
                        {foldersAtLevel.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="p-4 rounded-full bg-muted/30 mb-3">
                                    <Folder className="h-8 w-8 text-muted-foreground/20" />
                                </div>
                                <p className="text-sm font-medium text-muted-foreground">No subfolders here</p>
                                <p className="text-xs text-muted-foreground/50 mt-1">You can still select this location</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
