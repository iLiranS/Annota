import { Button } from '@/components/ui/button';
import {
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { COLOR_PALETTE } from '@annota/core/constants/colors';
import { LucideIcon } from 'lucide-react';
import { useState } from 'react';

interface ColorPickerProps {
    title: string;
    icon: LucideIcon;
    currentColor: string | null;
    onSelect: (color: string) => void;
    onClear: () => void;
    label: string;
    onOpenChange?: (open: boolean) => void;
    isMenu?: boolean;
    activeColor?: string;
}

export function ColorPicker({
    title,
    icon: Icon,
    currentColor,
    onSelect,
    onClear,
    label,
    onOpenChange,
    isMenu,
    activeColor
}: ColorPickerProps) {
    const [open, setOpen] = useState(false);

    const handleOpenChange = (val: boolean) => {
        setOpen(val);
        onOpenChange?.(val);
    };

    const content = (
        <div className="flex flex-col gap-3 p-1">
            <h4 className="text-sm font-medium px-1">{title}</h4>
            <div className="grid grid-cols-5 gap-2">
                {COLOR_PALETTE.map((color) => (
                    <button
                        key={color.value}
                        className={cn(
                            "h-6 w-6 rounded-full border border-border/50 transition-transform hover:scale-110 cursor-pointer",
                            currentColor === color.value && "ring-2 ring-primary ring-offset-2"
                        )}
                        style={{ backgroundColor: color.value }}
                        onClick={() => {
                            onSelect(color.value);
                            handleOpenChange(false);
                        }}
                        title={color.name}
                    />
                ))}
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-full text-xs" onClick={() => {
                onClear();
                handleOpenChange(false);
            }}>
                Clear {label}
            </Button>
        </div>
    );

    if (isMenu) {
        return (
            <DropdownMenuSub open={open} onOpenChange={handleOpenChange}>
                <DropdownMenuSubTrigger className="gap-2">
                    <Icon className="h-4 w-4" style={{ color: currentColor || undefined }} />
                    <span>{title}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent className="w-48 p-2 mr-2">
                        {content}
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
        );
    }

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    title={title}
                    style={{
                        color: currentColor || undefined,
                        backgroundColor: currentColor && activeColor ? `${activeColor}15` : undefined,
                        borderRadius: currentColor ? '8px' : undefined
                    }}
                >
                    <Icon className="h-5 w-5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
                {content}
            </PopoverContent>
        </Popover>
    );
}
