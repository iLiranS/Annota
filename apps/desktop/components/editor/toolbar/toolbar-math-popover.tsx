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
import type { ToolbarRenderProps } from '@annota/tiptap-editor';
import { Sigma } from 'lucide-react';
import React, { useState } from 'react';

interface MathPopoverProps {
    sendCommand: ToolbarRenderProps['sendCommand'];
    activeColor?: string;
    onOpenChange?: (open: boolean) => void;
    isMenu?: boolean;
    visible?: boolean;
    currentLatex?: string | null;
}

export function MathPopover({ sendCommand, onOpenChange, isMenu, visible, currentLatex }: MathPopoverProps) {
    const [latex, setLatex] = useState(currentLatex || '');
    const [open, setOpen] = useState(visible || false);

    React.useEffect(() => {
        if (visible !== undefined) setOpen(visible);
    }, [visible]);

    React.useEffect(() => {
        setLatex(currentLatex || '');
    }, [currentLatex]);

    const handleOpenChange = (val: boolean) => {
        setOpen(val);
        onOpenChange?.(val);
        // If opening and no currentLatex, we're likely adding a new formula, so ensure it's empty
        if (val && !currentLatex) setLatex('');
    };

    const handleInsert = (value: string) => {
        if (value) {
            sendCommand('setMath', { latex: value });
            setLatex('');
            handleOpenChange(false);
        }
    };

    const content = (
        <div className="flex flex-col gap-3 p-1">
            <div className="space-y-1 px-1">
                <h4 className="text-sm font-medium leading-none">Math Formula</h4>
                <p className="text-xs text-muted-foreground">Enter LaTeX</p>
            </div>
            <div className="flex gap-2">
                <Input
                    className="h-8 text-xs font-mono"
                    placeholder="e = mc^2"
                    value={latex}
                    onChange={(e) => setLatex(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleInsert(latex);
                    }}
                    autoFocus
                />
                <Button size="sm" className="h-8 px-3 text-xs" onClick={() => handleInsert(latex)}>
                    Insert
                </Button>
            </div>
        </div>
    );

    if (isMenu) {
        return (
            <DropdownMenuSub open={open} onOpenChange={handleOpenChange}>
                <DropdownMenuSubTrigger className="gap-2">
                    <Sigma className="h-4 w-4" />
                    <span>Math Formula</span>
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
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                    <Sigma className="h-5 w-5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
                {content}
            </PopoverContent>
        </Popover>
    );
}
