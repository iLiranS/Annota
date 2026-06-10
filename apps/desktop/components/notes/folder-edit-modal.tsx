import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Ionicons } from "@/components/ui/ionicons";
import { Label } from "@/components/ui/label";
import { useAppTheme } from "@/hooks/use-app-theme";
import { cn } from "@/lib/utils";
import { Folder, useNotesStore } from "@annota/core";
import { COLOR_PALETTE } from "@annota/core/constants/colors";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import React from "react";
import { toast } from "sonner";
import { LocationPickerModal } from "../location-picker-modal";

const IconPickerGrid = React.lazy(() => import("../custom-ui/IconPickerGrid"));

interface FolderEditModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    folder: Folder | null; // null = create mode
    defaultParentId?: string | null;
    onSuccess?: (folderId: string) => void;
}

export function FolderEditModal({
    open,
    onOpenChange,
    folder,
    defaultParentId = null,
    onSuccess,
}: FolderEditModalProps) {
    const { colors } = useAppTheme();
    const { createFolder, updateFolder, getFolderById } = useNotesStore();

    const isCreateMode = folder === null;

    const [name, setName] = useState('');
    const [icon, setIcon] = useState('folder');
    const [color, setColor] = useState(COLOR_PALETTE[0].value);
    const [parentId, setParentId] = useState<string | null>(null);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [iconSearch, setIconSearch] = useState('');
    const [subFolderCreationId, setSubFolderCreationId] = useState<{ open: boolean; parentId: string | null }>({
        open: false,
        parentId: null
    });

    useEffect(() => {
        if (open) {
            setIconSearch('');
            if (folder) {
                setName(folder.name);
                setIcon(folder.icon || 'folder');
                setColor(folder.color || COLOR_PALETTE[0].value);
                setParentId(folder.parentId);
            } else {
                setName('');
                setIcon('folder');
                setColor(COLOR_PALETTE[0].value);
                setParentId(defaultParentId);
            }
        }
    }, [folder, open, defaultParentId]);

    const parentFolder = useMemo(() => {
        if (!parentId) return null;
        return getFolderById(parentId);
    }, [parentId, getFolderById]);

    const getParentName = useCallback((id: string | null) => {
        if (!id || id === 'root') return 'Annota';
        return parentFolder?.name ?? 'Unknown';
    }, [parentFolder]);

    const handleSave = async () => {
        if (!name.trim()) return;

        const normalizedParentId = (parentId === 'root' || !parentId) ? null : parentId;

        if (isCreateMode) {
            const { data, error } = await createFolder({ parentId: normalizedParentId, name: name.trim(), icon, color });
            if (error) {
                toast.error(error);
                return;
            }
            if (data?.id) {
                onSuccess?.(data.id);
            }
        } else {
            await updateFolder(folder!.id, {
                name: name.trim(),
                icon,
                color,
                parentId: normalizedParentId,
            });
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col max-h-[85vh]">
                <DialogDescription className="sr-only">Folder Edit</DialogDescription>
                <DialogHeader className="px-6 py-3 border-b">
                    <DialogTitle className="text-base font-bold">
                        {isCreateMode ? 'New Folder' : 'Edit Folder'}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 px-6 py-4 overflow-y-auto premium-scrollbar">
                    <div className="space-y-3.5">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="folder-name" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                    Name
                                </Label>
                                <span className={cn(
                                    "text-[10px] font-medium transition-colors",
                                    name.length >= 50 ? "text-destructive font-bold" : "text-muted-foreground/40"
                                )}>
                                    {name.length}/50
                                </span>
                            </div>
                            <div className="flex items-center pl-3 border  rounded-md ">
                                <div
                                    className="flex  items-center justify-center rounded-md w-7 h-7 transition-colors"
                                    style={{ backgroundColor: `${color}15` }}
                                >
                                    <Ionicons
                                        name={icon as any}
                                        size={18}
                                        style={{ color: color }}
                                    />
                                </div>
                                <Input
                                    id="folder-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value.slice(0, 50))}
                                    placeholder="Folder name"
                                    className="h-10 shadow-none bg-transparent dark:bg-transparent border-none  focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                                />
                            </div>
                        </div>

                        {/* Location */}
                        <div className="space-y-1.5 ">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                Location
                            </Label>
                            <Button
                                variant="outline"
                                onClick={() => setShowLocationPicker(true)}
                                className="w-full h-10 justify-between px-3 bg-transparent dark:bg-transparent hover:bg-accent/50 transition-colors"
                            >
                                <div className="flex items-center gap-2.5">
                                    <div
                                        className="flex items-center justify-center rounded-md w-7 h-7 shrink-0 transition-colors"
                                        style={{ backgroundColor: `${parentFolder?.color || colors.primary}15` }}
                                    >
                                        <Ionicons
                                            name={(parentFolder?.icon || 'folder') as any}
                                            size={14}
                                            style={{ color: parentFolder?.color || colors.primary }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium">{getParentName(parentId)}</span>
                                </div>
                                <Ionicons name="chevron-forward" size={14} className="text-muted-foreground/40" />
                            </Button>
                        </div>

                        {/* Icon Picker */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                Icon
                            </Label>
                            <div className="space-y-2">
                                <Input autoCapitalize="off" autoCorrect="off" autoComplete="off"
                                    placeholder="Search icons..."
                                    value={iconSearch}
                                    onChange={(e) => setIconSearch(e.target.value)}
                                    className="h-8 placeholder:text-muted-foreground/60 text-xs bg-transparent dark:bg-transparent  border-border/30  focus-visible:ring-0 focus-visible:ring-offset-0"
                                />
                                <div className="flex-1 overflow-y-auto pr-1">
                                    <Suspense fallback={<div className="h-32 flex items-center justify-center text-sm text-muted-foreground">Loading icons...</div>}>
                                        <IconPickerGrid
                                            iconSearch={iconSearch}
                                            onSelect={(name) => setIcon(name)}
                                            color={color}
                                        />
                                    </Suspense>
                                </div>
                            </div>
                        </div>

                        {/* Color Picker */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                Color
                            </Label>
                            <div className="flex flex-wrap gap-2 p-2.5 rounded-xl border border-border/50 bg-accent/10">
                                {COLOR_PALETTE.map((colorOption) => (
                                    <button
                                        key={colorOption.value}
                                        type="button"
                                        onClick={() => setColor(colorOption.value)}
                                        className={cn(
                                            "h-7 w-7 rounded-full transition-all flex items-center justify-center ring-offset-background",
                                            color === colorOption.value ? "ring-2 ring-primary ring-offset-2 scale-110" : "hover:scale-105"
                                        )}
                                        style={{ backgroundColor: colorOption.value }}
                                    >
                                        {color === colorOption.value && (
                                            <Ionicons name="checkmark" size={14} className="text-white" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 border-t bg-accent/5">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="font-semibold h-9"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!name.trim()}
                        className="font-bold px-8 h-9 shadow-md"
                        style={{ backgroundColor: colors.primary }}
                    >
                        {isCreateMode ? 'Create' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>

            {showLocationPicker && (
                <LocationPickerModal
                    open={showLocationPicker}
                    onOpenChange={setShowLocationPicker}
                    onClose={() => setShowLocationPicker(false)}
                    currentFolderId={folder?.id}
                    selectedParentId={parentId}
                    onSelect={setParentId}
                    showCreateButton={false}
                    onCreateFolder={(id) => {
                        setSubFolderCreationId({ open: true, parentId: id });
                    }}
                />
            )}

            {subFolderCreationId.open && (
                <FolderEditModal
                    open={subFolderCreationId.open}
                    onOpenChange={(open) => setSubFolderCreationId(prev => ({ ...prev, open }))}
                    folder={null}
                    defaultParentId={subFolderCreationId.parentId}
                    onSuccess={onSuccess}
                />
            )}
        </Dialog>
    );
}
