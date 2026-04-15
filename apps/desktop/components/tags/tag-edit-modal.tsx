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
import type { Tag } from "@annota/core";
import { useNotesStore } from "@annota/core";
import { COLOR_PALETTE } from "@annota/core/constants/colors";
import { useEffect, useState } from "react";

interface TagEditModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tag: Tag | null;
}

export function TagEditModal({
    open,
    onOpenChange,
    tag,
}: TagEditModalProps) {
    const { colors } = useAppTheme();
    const { updateTag } = useNotesStore();

    const [name, setName] = useState('');
    const [color, setColor] = useState(COLOR_PALETTE[0].value);

    useEffect(() => {
        if (open && tag) {
            setName(tag.name);
            setColor(tag.color || COLOR_PALETTE[0].value);
        }
    }, [tag, open]);

    const handleSave = () => {
        if (!name.trim() || !tag) return;

        updateTag(tag.id, {
            name: name.trim(),
            color,
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col max-h-[85vh]">
                <DialogDescription className="sr-only">Tag Edit</DialogDescription>
                <DialogHeader className="px-6 py-3 border-b">
                    <DialogTitle className="text-base font-bold">
                        Edit Tag
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 px-6 py-4 overflow-y-auto premium-scrollbar">
                    <div className="space-y-4">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="tag-name" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                    Name
                                </Label>
                                <span className={cn(
                                    "text-[10px] font-medium transition-colors",
                                    name.length >= 30 ? "text-destructive font-bold" : "text-muted-foreground/40"
                                )}>
                                    {name.length}/30
                                </span>
                            </div>
                            <div className="flex items-center pl-3 border rounded-md">
                                <div
                                    className="flex items-center justify-center rounded-md w-7 h-7 transition-colors"
                                    style={{ backgroundColor: `${color}15` }}
                                >
                                    <Ionicons
                                        name="pricetag"
                                        size={16}
                                        style={{ color: color }}
                                    />
                                </div>
                                <Input
                                    id="tag-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value.slice(0, 30))}
                                    placeholder="Tag name"
                                    className="h-10 shadow-none bg-transparent dark:bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                                    autoFocus
                                />
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
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
