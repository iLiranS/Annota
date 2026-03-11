import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import React, { useState } from 'react';

interface LinkPopoverProps {
    title: string;
    icon: React.ComponentType<any>;
    placeholder: string;
    initialValue?: string;
    saveLabel: string;
    onSave: (href: string, title?: string) => void;
    onRemove?: () => void;
    isActive?: boolean;
    activeColor?: string;
    description?: string;
    onOpenChange?: (open: boolean) => void;
    isMenu?: boolean;
    visible?: boolean;
    onClose?: () => void;
    selectedText?: string;
    hideTitle?: boolean;
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
    isMenu,
    visible,
    onClose,
    selectedText,
    hideTitle
}: LinkPopoverProps) {
    const [urlValue, setUrlValue] = useState(initialValue || '');
    const [titleValue, setTitleValue] = useState(selectedText || '');
    const [open, setOpen] = useState(false);

    const isControlled = visible !== undefined;
    const isVisible = isControlled ? visible : open;

    const handleOpenChange = (val: boolean) => {
        if (isControlled) {
            if (!val) onClose?.();
            onOpenChange?.(val);
        } else {
            setOpen(val);
            onOpenChange?.(val);
        }

        if (val) {
            setUrlValue(initialValue || '');
            setTitleValue(selectedText || '');
        }
    };

    const handleAction = () => {
        if (!urlValue) return;
        onSave(urlValue, titleValue || undefined);
        handleOpenChange(false);
    };

    const formContent = (
        <div className="flex flex-col gap-3">
            {!hideTitle && (
                <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Title (Optional)</label>
                    <Input
                        className="h-8 text-xs"
                        placeholder="Link title"
                        value={titleValue}
                        onChange={(e) => setTitleValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAction();
                        }}
                    />
                </div>
            )}
            <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">URL</label>
                <div className="flex gap-2">
                    <Input
                        className="h-8 text-xs"
                        placeholder={placeholder}
                        value={urlValue}
                        onChange={(e) => setUrlValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAction();
                        }}
                        autoFocus
                    />
                    <Button size="sm" className="h-8 px-3 text-xs" onClick={handleAction}>
                        {saveLabel}
                    </Button>
                </div>
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

    // Controlled mode (opened via slash command): render as a centered Dialog
    if (isControlled) {
        return (
            <Dialog open={isVisible} onOpenChange={handleOpenChange}>
                <DialogContent aria-describedby={undefined} className="sm:max-w-[380px] p-0 overflow-hidden border-none bg-background shadow-2xl">
                    <DialogHeader className="p-4 pb-2 border-b border-border/50">
                        <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                            <Icon sx={{ fontSize: 18 }} className="text-primary" />
                            {title}
                        </DialogTitle>
                        {description && <p className="text-xs text-muted-foreground px-1">{description}</p>}
                    </DialogHeader>
                    <div className="p-4">
                        {formContent}
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // Dropdown menu sub-item mode
    if (isMenu) {
        return (
            <DropdownMenuSub open={isVisible} onOpenChange={handleOpenChange}>
                <DropdownMenuSubTrigger className="gap-2">
                    <Icon sx={{ fontSize: 16 }} style={{ color: isActive ? activeColor : undefined }} />
                    <span>{title}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent className="w-80 p-3 mr-2">
                        <div className="flex flex-col gap-3 p-1">
                            <div className="space-y-1 px-1">
                                <h4 className="text-sm font-medium leading-none">{title}</h4>
                                {description && <p className="text-xs text-muted-foreground">{description}</p>}
                            </div>
                            {formContent}
                        </div>
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
        );
    }

    // Default toolbar icon mode: render as a Popover
    return (
        <Popover open={isVisible} onOpenChange={handleOpenChange}>
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
                    <Icon sx={{ fontSize: 18 }} />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
                <div className="flex flex-col gap-3 p-1">
                    <div className="space-y-1 px-1">
                        <h4 className="text-sm font-medium leading-none">{title}</h4>
                        {description && <p className="text-xs text-muted-foreground">{description}</p>}
                    </div>
                    {formContent}
                </div>
            </PopoverContent>
        </Popover>
    );
}
