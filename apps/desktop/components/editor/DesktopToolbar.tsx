import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppTheme } from '@/hooks/use-app-theme';
import { cn } from '@/lib/utils';
import type { ToolbarRenderProps } from '@annota/tiptap-editor';
import {
    Baseline,
    Bold,
    CheckSquare,
    Code,
    FileInput,
    Highlighter,
    Indent,
    Italic,
    Link as LinkIcon,
    List,
    ListOrdered,
    MoreHorizontal,
    Outdent,
    Quote,
    Redo,
    SquareCode,
    Strikethrough,
    Table as TableIcon,
    Underline,
    Undo,
    Youtube
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ColorPicker } from './toolbar/toolbar-color-picker';
import { HeadingSelector } from './toolbar/toolbar-heading-selector';
import { LinkPopover } from './toolbar/toolbar-link-popover';
import { MathPopover } from './toolbar/toolbar-math-popover';

type ToolbarItem = {
    id: string;
    label: string;
    render: React.ReactNode;
    dropdownRender: React.ReactNode;
}

export function DesktopToolbar({
    editorState,
    sendCommand,
}: ToolbarRenderProps) {
    const { colors } = useAppTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const [visibleCount, setVisibleCount] = useState(15);

    const [openMenusCount, setOpenMenusCount] = useState(0);
    const handleOpenChange = useCallback((open: boolean) => {
        setOpenMenusCount(prev => open ? prev + 1 : Math.max(0, prev - 1));
    }, []);

    const activeStyle = useCallback((active: boolean) => ({
        color: active ? colors.primary : undefined,
        backgroundColor: active ? `${colors.primary}15` : undefined,
        borderRadius: '8px'
    }), [colors.primary]);

    const items: ToolbarItem[] = React.useMemo(() => [
        {
            id: 'heading',
            label: 'Text Type',
            render: <HeadingSelector key="heading" editorState={editorState} sendCommand={sendCommand} onOpenChange={handleOpenChange} activeColor={colors.primary} />,
            dropdownRender: <HeadingSelector key="heading-dropdown" editorState={editorState} sendCommand={sendCommand} onOpenChange={handleOpenChange} activeColor={colors.primary} isMenu />
        },
        {
            id: 'bold',
            label: 'Bold',
            render: <Button key="bold" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleBold')} style={activeStyle(editorState.isBold)}><Bold className="h-5 w-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="bold-dropdown" onClick={() => sendCommand('toggleBold')} className={cn("gap-2", editorState.isBold && "text-primary")}><Bold className="h-4 w-4" /> Bold</DropdownMenuItem>
        },
        {
            id: 'italic',
            label: 'Italic',
            render: <Button key="italic" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleItalic')} style={activeStyle(editorState.isItalic)}><Italic className="h-5 w-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="italic-dropdown" onClick={() => sendCommand('toggleItalic')} className={cn("gap-2", editorState.isItalic && "text-primary")}><Italic className="h-4 w-4" /> Italic</DropdownMenuItem>
        },
        {
            id: 'underline',
            label: 'Underline',
            render: <Button key="underline" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleUnderline')} style={activeStyle(editorState.isUnderline)}><Underline className="h-5 w-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="underline-dropdown" onClick={() => sendCommand('toggleUnderline')} className={cn("gap-2", editorState.isUnderline && "text-primary")}><Underline className="h-4 w-4" /> Underline</DropdownMenuItem>
        },
        {
            id: 'strike',
            label: 'Strikethrough',
            render: <Button key="strike" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleStrike')} style={activeStyle(editorState.isStrike)}><Strikethrough className="h-5 w-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="strike-dropdown" onClick={() => sendCommand('toggleStrike')} className={cn("gap-2", editorState.isStrike && "text-primary")}><Strikethrough className="h-4 w-4" /> Strike</DropdownMenuItem>
        },
        {
            id: 'textColor',
            label: 'Text Color',
            render: <ColorPicker key="textColor" title="Text Color" label="Color" icon={Baseline} currentColor={editorState.textColor} onSelect={(color) => sendCommand('setColor', { color })} onClear={() => sendCommand('unsetColor')} onOpenChange={handleOpenChange} activeColor={colors.primary} />,
            dropdownRender: <ColorPicker key="textColor-dropdown" title="Text Color" label="Color" icon={Baseline} currentColor={editorState.textColor} onSelect={(color) => sendCommand('setColor', { color })} onClear={() => sendCommand('unsetColor')} onOpenChange={handleOpenChange} activeColor={colors.primary} isMenu />
        },
        {
            id: 'highlight',
            label: 'Highlight',
            render: <ColorPicker key="highlight" title="Highlight" label="Highlight" icon={Highlighter} currentColor={editorState.highlightColor} onSelect={(color) => sendCommand('setHighlight', { color })} onClear={() => sendCommand('unsetHighlight')} onOpenChange={handleOpenChange} activeColor={colors.primary} />,
            dropdownRender: <ColorPicker key="highlight-dropdown" title="Highlight" label="Highlight" icon={Highlighter} currentColor={editorState.highlightColor} onSelect={(color) => sendCommand('setHighlight', { color })} onClear={() => sendCommand('unsetHighlight')} onOpenChange={handleOpenChange} activeColor={colors.primary} isMenu />
        },
        {
            id: 'bulletList',
            label: 'Bullet List',
            render: <Button key="bulletList" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleBulletList')} style={activeStyle(editorState.isBulletList)}><List className="h-5 w-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="bulletList-dropdown" onClick={() => sendCommand('toggleBulletList')} className={cn("gap-2", editorState.isBulletList && "text-primary")}><List className="h-4 w-4" /> Bullet List</DropdownMenuItem>
        },
        {
            id: 'orderedList',
            label: 'Numbered List',
            render: <Button key="orderedList" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleOrderedList')} style={activeStyle(editorState.isOrderedList)}><ListOrdered className="h-5 w-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="orderedList-dropdown" onClick={() => sendCommand('toggleOrderedList')} className={cn("gap-2", editorState.isOrderedList && "text-primary")}><ListOrdered className="h-4 w-4" /> Numbered List</DropdownMenuItem>
        },
        {
            id: 'taskList',
            label: 'Task List',
            render: <Button key="taskList" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleTaskList')} style={activeStyle(editorState.isTaskList)}><CheckSquare className="h-5 w-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="taskList-dropdown" onClick={() => sendCommand('toggleTaskList')} className={cn("gap-2", editorState.isTaskList && "text-primary")}><CheckSquare className="h-4 w-4" /> Task List</DropdownMenuItem>
        },
        {
            id: 'outdent',
            label: 'Outdent',
            render: <Button key="outdent" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('liftListItem')} disabled={!editorState.canLiftListItem}><Outdent className="h-5 w-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="outdent-dropdown" onClick={() => sendCommand('liftListItem')} disabled={!editorState.canLiftListItem} className="gap-2"><Outdent className="h-4 w-4" /> Outdent</DropdownMenuItem>
        },
        {
            id: 'indent',
            label: 'Indent',
            render: <Button key="indent" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('sinkListItem')} disabled={!editorState.canSinkListItem}><Indent className="h-5 w-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="indent-dropdown" onClick={() => sendCommand('sinkListItem')} disabled={!editorState.canSinkListItem} className="gap-2"><Indent className="h-4 w-4" /> Indent</DropdownMenuItem>
        },
        {
            id: 'code',
            label: 'Inline Code',
            render: <Button key="code" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleCode')} style={activeStyle(editorState.isCode)}><Code className="h-5 w-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="code-dropdown" onClick={() => sendCommand('toggleCode')} className={cn("gap-2", editorState.isCode && "text-primary")}><Code className="h-4 w-4" /> Inline Code</DropdownMenuItem>
        },
        {
            id: 'codeBlock',
            label: 'Code Block',
            render: <Button key="codeBlock" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleCodeBlock')} style={activeStyle(editorState.isCodeBlock)}><SquareCode className="h-5 w-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="codeBlock-dropdown" onClick={() => sendCommand('toggleCodeBlock')} className={cn("gap-2", editorState.isCodeBlock && "text-primary")}><SquareCode className="h-4 w-4" /> Code Block</DropdownMenuItem>
        },
        {
            id: 'quote',
            label: 'Quote',
            render: <Button key="quote" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleBlockquote')} style={activeStyle(editorState.isBlockquote)}><Quote className="h-5 w-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="quote-dropdown" onClick={() => sendCommand('toggleBlockquote')} className={cn("gap-2", editorState.isBlockquote && "text-primary")}><Quote className="h-4 w-4" /> Quote</DropdownMenuItem>
        },
        {
            id: 'details',
            label: 'Collapsible',
            render: <Button key="details" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleDetails')} style={activeStyle(editorState.isDetails)}><FileInput className="h-5 w-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="details-dropdown" onClick={() => sendCommand('toggleDetails')} className={cn("gap-2", editorState.isDetails && "text-primary")}><FileInput className="h-4 w-4" /> Details</DropdownMenuItem>
        },
        {
            id: 'math',
            label: 'Math Formula',
            render: <MathPopover key="math" sendCommand={sendCommand} activeColor={colors.primary} onOpenChange={handleOpenChange} />,
            dropdownRender: <MathPopover key="math-dropdown" sendCommand={sendCommand} activeColor={colors.primary} onOpenChange={handleOpenChange} isMenu />
        },
        {
            id: 'link',
            label: 'Link',
            render: <LinkPopover key="link" title="Insert Link" icon={LinkIcon} placeholder="https://example.com" isActive={editorState.isLink} initialValue={editorState.linkHref ?? ''} saveLabel="Save" activeColor={colors.primary} onSave={(href) => sendCommand('setLink', { href })} onRemove={() => sendCommand('unsetLink')} onOpenChange={handleOpenChange} />,
            dropdownRender: <LinkPopover key="link-dropdown" title="Insert Link" icon={LinkIcon} placeholder="https://example.com" isActive={editorState.isLink} initialValue={editorState.linkHref ?? ''} saveLabel="Save" activeColor={colors.primary} onSave={(href) => sendCommand('setLink', { href })} onRemove={() => sendCommand('unsetLink')} onOpenChange={handleOpenChange} isMenu />
        },
        {
            id: 'youtube',
            label: 'YouTube',
            render: <LinkPopover key="youtube" title="YouTube Video" description="Enter a YouTube video URL" icon={Youtube} placeholder="https://youtube.com/watch?v=..." saveLabel="Insert" onSave={(src) => sendCommand('setYoutubeVideo', { src })} onOpenChange={handleOpenChange} />,
            dropdownRender: <LinkPopover key="youtube-dropdown" title="YouTube Video" description="Enter a YouTube video URL" icon={Youtube} placeholder="https://youtube.com/watch?v=..." saveLabel="Insert" onSave={(src) => sendCommand('setYoutubeVideo', { src })} onOpenChange={handleOpenChange} isMenu />
        },
        {
            id: 'table',
            label: 'Table',
            render: <Button key="table" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => { if (!editorState.isInTable) sendCommand('insertTable', { rows: 3, cols: 3, withHeaderRow: true }); }} style={activeStyle(editorState.isInTable)}><TableIcon className="h-5 w-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="table-dropdown" onClick={() => { if (!editorState.isInTable) sendCommand('insertTable', { rows: 3, cols: 3, withHeaderRow: true }); }} className={cn("gap-2", editorState.isInTable && "text-primary")}><TableIcon className="h-4 w-4" /> Table</DropdownMenuItem>
        }
    ], [editorState, sendCommand, colors.primary, activeStyle, handleOpenChange]);

    const [resetKey, setResetKey] = useState(0);

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            const width = entries[0].contentRect.width;
            if (width < 200) return;

            const HEADING_WIDTH = 52;
            const ITEM_WIDTH = 36;
            const GAP = 2; // gap-0.5 is 2px
            const PADDING = 12; // horizontal padding + safe area
            const RIGHT_FIXED_WIDTH = 74; // Undo (36) + Redo (36) + Gap (2)
            const OVERFLOW_WIDTH = 38; // More button (36) + Gap (2)

            // Check if all items fit without overflow button
            let totalAllWidth = 0;
            for (let i = 0; i < items.length; i++) {
                const w = items[i].id === 'heading' ? HEADING_WIDTH : ITEM_WIDTH;
                totalAllWidth += (i === 0 ? w : w + GAP);
            }

            if (totalAllWidth + RIGHT_FIXED_WIDTH + PADDING <= width) {
                setVisibleCount(items.length);
            } else {
                // Not all fit, need overflow button
                let currentWidth = 0;
                let count = 0;
                const availableForItems = width - PADDING - RIGHT_FIXED_WIDTH - OVERFLOW_WIDTH;

                for (let i = 0; i < items.length; i++) {
                    const w = items[i].id === 'heading' ? HEADING_WIDTH : ITEM_WIDTH;
                    const needed = (i === 0 ? w : w + GAP);
                    if (currentWidth + needed > availableForItems) break;
                    currentWidth += needed;
                    count++;
                }
                setVisibleCount(Math.max(1, count));
            }
        });

        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [items, containerRef]);

    const visibleItems = items.slice(0, visibleCount);
    const overflowItems = items.slice(visibleCount);

    return (
        <TooltipProvider key={resetKey}>
            <div
                ref={containerRef}
                onMouseLeave={() => {
                    if (openMenusCount === 0) setResetKey(prev => prev + 1);
                }}
                className="
                            absolute bottom-6 left-1/2 -translate-x-1/2
                            w-[90%] max-w-[900px]
                            flex items-center
                            p-0.5
                            rounded-2xl
                            z-50

                            bg-linear-to-r from-white/15 via-white/5 to-white/15
                            backdrop-blur-2xl
                            border border-white/20
                            ring-1 ring-white/10
                            shadow-[0_14px_30px_rgba(15,23,42,0.35)]

                            dark:bg-linear-to-r dark:from-stone-900/70 dark:via-stone-900/40 dark:to-stone-900/70
                            dark:border-white/10
                            dark:ring-white/5
                            dark:shadow-[0_18px_40px_rgba(0,0,0,0.6)]
                            "
            >
                <div className="flex items-center gap-0.5 w-full px-1">
                    {visibleItems.map((item) => (
                        <Tooltip key={item.id} open={openMenusCount > 0 ? false : undefined}>
                            <TooltipTrigger asChild>
                                <div className="flex shrink-0">
                                    {item.render}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={12}>
                                {item.label}
                            </TooltipContent>
                        </Tooltip>
                    ))}

                    <div className="flex-1" />

                    <div className="flex items-center gap-0.5 ml-auto">
                        {overflowItems.length > 0 && (
                            <DropdownMenu onOpenChange={handleOpenChange} modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                                        <MoreHorizontal className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    {overflowItems.map((item) => (
                                        <React.Fragment key={item.id + '-overflow'}>
                                            {item.dropdownRender}
                                        </React.Fragment>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        <Tooltip open={openMenusCount > 0 ? false : undefined}>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('undo')} disabled={!editorState.canUndo}>
                                    <Undo className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={12}>Undo</TooltipContent>
                        </Tooltip>

                        <Tooltip open={openMenusCount > 0 ? false : undefined}>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('redo')} disabled={!editorState.canRedo}>
                                    <Redo className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={12}>Redo</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
