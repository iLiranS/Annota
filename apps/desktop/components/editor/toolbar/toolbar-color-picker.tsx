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
import React, { useState } from 'react';

// Helper to normalize a color to 6-digit hex + apply alpha
function withAlpha(color: string, alphaHex: string): string {
    if (!color) return color;

    // If it's an RGB/RGBA string, convert it to RGBA with the desired alpha
    if (color.startsWith('rgb')) {
        const match = color.match(/\d+(\.\d+)?/g);
        if (match && (match.length === 3 || match.length === 4)) {
            const [r, g, b] = match;
            const alpha = parseInt(alphaHex, 16) / 255;
            return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
        }
        return color;
    }

    if (!color.startsWith('#')) return color;

    let base = color;
    // Strip any existing alpha suffix (8-digit hex is length 9 with #)
    if (color.length === 9) {
        base = color.slice(0, 7);
    }
    // Expand 3-digit hex (#RGB) to 6 digits (#RRGGBB)
    else if (color.length === 4) {
        base = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }

    // Only append alpha if we have a valid 7-character base hex
    return base.length === 7 ? `${base}${alphaHex}` : base;
}

interface ColorPickerProps {
    title: string;
    icon: React.ComponentType<any>;
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
                    <Icon className="w-4 h-4" style={{ color: currentColor ? withAlpha(currentColor, 'FF') : undefined }} />
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
                        color: currentColor ? withAlpha(currentColor, 'FF') : undefined,
                        opacity: currentColor ? 1 : 0.7,
                        backgroundColor: currentColor ? withAlpha(currentColor, '30') : undefined,
                        borderRadius: currentColor ? '8px' : undefined,
                        transition: 'opacity 0.2s ease, background-color 0.2s ease'
                    }}
                >
                    <Icon className="w-5 h-5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
                {content}
            </PopoverContent>
        </Popover>
    );
}
