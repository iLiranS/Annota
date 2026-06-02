import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { EditorState, ToolbarRenderProps } from '@annota/editor-ui';
import React from 'react';
import { EditorIcons } from '../EditorIcons';

interface TableSelectorProps {
    editorState: EditorState;
    sendCommand: ToolbarRenderProps['sendCommand'];
    onOpenChange?: (open: boolean) => void;
    isMenu?: boolean;
    activeStyle: (active: boolean) => React.CSSProperties;
}

export function TableSelector({
    editorState,
    sendCommand,
    onOpenChange,
    isMenu,
    activeStyle,
}: TableSelectorProps) {
    const tableOptions = [
        { label: '2 x 2', rows: 2, cols: 2 },
        { label: '3 x 3', rows: 3, cols: 3 },
        { label: '4 x 4', rows: 4, cols: 4 },
        { label: '5 x 5', rows: 5, cols: 5 },
        { label: '6 x 6', rows: 6, cols: 6 },
        { label: '7 x 7', rows: 7, cols: 7 },
        { label: '8 x 8', rows: 8, cols: 8 },
        { label: '9 x 9', rows: 9, cols: 9 },
    ];

    const dropdownItems = tableOptions.map((opt) => (
        <DropdownMenuItem
            key={opt.label}
            onClick={() => sendCommand('insertTable', { rows: opt.rows, cols: opt.cols, withHeaderRow: false })}
            className="cursor-pointer"
        >
            {opt.label}
        </DropdownMenuItem>
    ));

    if (editorState.isInTable) {
        // If already in table, the button behaves as "active" and doesn't open a dropdown or do anything on click
        if (isMenu) {
            return (
                <DropdownMenuItem className="gap-2 text-primary" onClick={(e) => e.preventDefault()}>
                    <EditorIcons.Table className="w-4 h-4" />
                    <span>Table</span>
                </DropdownMenuItem>
            );
        }

        return (
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 cursor-default"
                style={activeStyle(true)}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
            >
                <EditorIcons.Table className="w-5 h-5" />
            </Button>
        );
    }

    if (isMenu) {
        return (
            <DropdownMenuSub onOpenChange={onOpenChange}>
                <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                    <EditorIcons.Table className="w-4 h-4" />
                    <span>Table</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                        <DropdownMenuLabel className="text-xs font-semibold opacity-50 px-2 py-1">INSERT TABLE</DropdownMenuLabel>
                        {dropdownItems}
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
        );
    }

    return (
        <DropdownMenu onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 cursor-pointer"
                    style={activeStyle(false)}
                >
                    <EditorIcons.Table className="w-5 h-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
                <DropdownMenuContent align="start">
                    <DropdownMenuLabel className="text-xs font-semibold opacity-50 px-2 py-1">INSERT TABLE</DropdownMenuLabel>
                    {dropdownItems}
                </DropdownMenuContent>
            </DropdownMenuPortal>
        </DropdownMenu>
    );
}
