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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppTheme } from "@/hooks/use-app-theme";
import { cn } from "@/lib/utils";
import { Folder, useNotesStore } from "@annota/core";
import { COLOR_PALETTE } from "@annota/core/constants/colors";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Io5 from "react-icons/io5";
import { toast } from "sonner";
import { LocationPickerModal } from "../location-picker-modal";

const ALL_IONICON_KEYS = Object.keys(Io5)
    .filter(key => key.startsWith('Io'))
    .map(key => {
        // Convert IoDocumentTextOutline -> document-text-outline
        return key
            .slice(2) // Remove 'Io'
            .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
            .toLowerCase();
    });

const FOLDER_ICONS = [
    'folder', 'briefcase', 'person', 'people',
    'home', 'star', 'heart', 'bookmark', 'flag',
    'calendar', 'time', 'alarm', 'notifications', 'mail',
    'document', 'documents', 'archive', 'file-tray',
    'book', 'library', 'school', 'code', 'terminal',
    'globe', 'earth', 'cloud', 'server', 'git-branch',
    'camera', 'image', 'images', 'film', 'musical-notes',
    'cart', 'card', 'cash', 'wallet', 'gift',
    'airplane', 'car', 'bicycle', 'train', 'boat',
    'fitness', 'medical', 'nutrition', 'restaurant', 'cafe',
    'analytics', 'attach', 'bar-chart', 'basket', 'build',
    'chatbox', 'construct', 'cube', 'diamond', 'flask',
    'game-controller', 'hammer', 'key', 'leaf', 'mic',
    'paw', 'pencil', 'planet', 'rocket',
    'shirt', 'trophy', 'umbrella', 'videocam', 'wine',
    'bulb', 'color-palette', 'compass', 'cut',
    'flash', 'glasses', 'ice-cream', 'magnet', 'map',
    'pint', 'podium', 'ribbon', 'skull', 'speedometer',
    'thermometer', 'thunderstorm', 'watch', 'water', 'ellipse-outline', 'ellipse'
];

interface FolderEditModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    folder: Folder | null; // null = create mode
    defaultParentId?: string | null;
}

export function FolderEditModal({
    open,
    onOpenChange,
    folder,
    defaultParentId = null,
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

    const filteredIcons = useMemo(() => {
        if (!iconSearch || iconSearch.trim().length < 2) return FOLDER_ICONS;

        const searchLower = iconSearch.toLowerCase().trim();
        return ALL_IONICON_KEYS.filter(i =>
            i.includes(searchLower)
        ).slice(0, 100); // Limit results for performance
    }, [iconSearch]);

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
        if (id === null) return 'Notes (Root)';
        return parentFolder?.name ?? 'Unknown';
    }, [parentFolder]);

    const handleSave = async () => {
        if (!name.trim()) return;

        if (isCreateMode) {
            const { error } = await createFolder({ parentId, name: name.trim(), icon, color });
            if (error) {
                toast.error(error);
                return;
            }
        } else {
            await updateFolder(folder!.id, {
                name: name.trim(),
                icon,
                color,
                parentId,
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

                <ScrollArea className="flex-1 px-6 py-4">
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
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                Location
                            </Label>
                            <Button
                                variant="ghost"
                                onClick={() => setShowLocationPicker(true)}
                                className="w-full h-10 justify-between px-3 bg-accent/30 border-border/50 hover:bg-accent/50 transition-colors"
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
                                <Input
                                    placeholder="Search icons..."
                                    value={iconSearch}
                                    onChange={(e) => setIconSearch(e.target.value)}
                                    className="h-8 text-xs bg-accent/20  border-border/30 focus:bg-accent/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                                />
                                <div className="grid grid-cols-8 gap-1 p-2 rounded-xl border border-border/50 bg-accent/10 max-h-[140px] overflow-y-auto">
                                    {filteredIcons.map((iconName) => (
                                        <button
                                            key={iconName}
                                            type="button"
                                            onClick={() => setIcon(iconName)}
                                            className={cn(
                                                "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                                                icon === iconName
                                                    ? "bg-primary text-primary-foreground shadow-sm scale-110"
                                                    : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Ionicons name={iconName as any} size={16} />
                                        </button>
                                    ))}
                                    {filteredIcons.length === 0 && (
                                        <div className="col-span-8 py-4 text-center text-[10px] text-muted-foreground/50 italic">
                                            No icons found for "{iconSearch}"
                                        </div>
                                    )}
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
                </ScrollArea>

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
                />
            )}
        </Dialog>
    );
}
