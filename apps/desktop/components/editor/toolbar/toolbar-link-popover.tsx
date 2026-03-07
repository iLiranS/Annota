import { Button } from '@/components/ui/button';
import {
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { LucideIcon } from 'lucide-react';
import { useState } from 'react';

interface LinkPopoverProps {
    title: string;
    icon: LucideIcon;
    placeholder: string;
    initialValue?: string;
    saveLabel: string;
    onSave: (val: string) => void;
    onRemove?: () => void;
    isActive?: boolean;
    activeColor?: string;
    description?: string;
    onOpenChange?: (open: boolean) => void;
    isMenu?: boolean;
}

export function LinkPopover({
    title,
    icon: Icon,
    placeholder,
    initialValue,
    saveLabel,
    onSave,
    onRemove,
    isActive,
    activeColor,
    description,
    onOpenChange,
    isMenu
}: LinkPopoverProps) {
    const [inputValue, setInputValue] = useState(initialValue || '');
    const [open, setOpen] = useState(false);

    const handleOpenChange = (val: boolean) => {
        setOpen(val);
        onOpenChange?.(val);
        if (val) setInputValue(initialValue || '');
    };

    const handleAction = (val: string) => {
        onSave(val);
        handleOpenChange(false);
    };

    const content = (
        <div className="flex flex-col gap-3 p-1">
            <div className="space-y-1 px-1">
                <h4 className="text-sm font-medium leading-none">{title}</h4>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
            <div className="flex gap-2">
                <Input
                    className="h-8 text-xs"
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAction(inputValue);
                    }}
                    autoFocus
                />
                <Button size="sm" className="h-8 px-3 text-xs" onClick={() => handleAction(inputValue)}>
                    {saveLabel}
                </Button>
            </div>
            {onRemove && isActive && (
                <Button variant="ghost" size="sm" className="h-8 w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => {
                    onRemove();
                    handleOpenChange(false);
                }}>
                    Remove Link
                </Button>
            )}
        </div>
    );

    if (isMenu) {
        return (
            <DropdownMenuSub open={open} onOpenChange={handleOpenChange}>
                <DropdownMenuSubTrigger className="gap-2">
                    <Icon className="h-4 w-4" style={{ color: isActive ? activeColor : undefined }} />
                    <span>{title}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent className="w-80 p-3 mr-2">
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
                    className="h-9 w-9 shrink-0"
                    style={{
                        color: isActive ? activeColor : undefined,
                        backgroundColor: isActive && activeColor ? `${activeColor}15` : undefined,
                        borderRadius: isActive ? '8px' : undefined
                    }}
                >
                    <Icon className="h-5 w-5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
                {content}
            </PopoverContent>
        </Popover>
    );
}
