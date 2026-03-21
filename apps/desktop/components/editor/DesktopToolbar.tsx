import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppTheme } from '@/hooks/use-app-theme';
import { cn } from '@/lib/utils';
import type { ToolbarRenderProps } from '@annota/editor-ui';
import {
    Baseline,
    Bold,
    CheckSquare,
    Code,
    FilePlusCorner as FileInput,
    Highlighter,
    Indent,
    Italic,
    Link as LinkIcon,
    List,
    ListOrdered,
    MoreHorizontal,
    Outdent,
    MessageSquareQuote as Quote,
    Redo2 as Redo,
    Sigma,
    SquareTerminal as SquareCode,
    Strikethrough,
    Table as TableIcon,
    Underline,
    Undo2 as Undo,
    Youtube
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ColorPicker } from './toolbar/toolbar-color-picker';
import { ToolbarFileUpload } from './toolbar/toolbar-file-upload';
import { HeadingSelector } from './toolbar/toolbar-heading-selector';
import { LinkPopover } from './toolbar/toolbar-link-popover';
import { MathPopover } from './toolbar/toolbar-math-popover';

type ToolbarItem = {
    id: string;
    label: string;
    shortcut?: string;
    render: React.ReactNode;
    dropdownRender: React.ReactNode;
}

export function DesktopToolbar({
    editorState,
    sendCommand,
    onInsertFile: onInsertFile,
    activePopup,
    currentLatex,
    onActivePopupChange,
}: ToolbarRenderProps) {
    const { colors } = useAppTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    const [visibleCount, setVisibleCount] = useState(15);

    // Fix Hydration Mismatch for OS Shortcuts
    const [isMac, setIsMac] = useState(false);
    useEffect(() => {
        setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent));
    }, []);

    const MOD = isMac ? '⌘' : 'Ctrl';
    const ALT = isMac ? '⌥' : 'Alt';
    const SHIFT = isMac ? '⇧' : 'Shift';

    const [openMenusCount, setOpenMenusCount] = useState(0);
    const handleOpenChange = useCallback((open: boolean) => {
        setOpenMenusCount(prev => open ? prev + 1 : Math.max(0, prev - 1));
    }, []);
    const isPopupOpen = openMenusCount > 0 || activePopup !== null;

    const activeStyle = useCallback((active: boolean) => ({
        color: active ? colors.primary : undefined,
        opacity: active ? 1 : 0.7,
        backgroundColor: active ? `${colors.primary}15` : undefined,
        borderRadius: '8px',
        transition: 'opacity 0.2s ease, background-color 0.2s ease'
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
            shortcut: `${MOD}B`,
            render: <Button key="bold" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleBold')} style={activeStyle(editorState.isBold)}><Bold className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="bold-dropdown" onClick={() => sendCommand('toggleBold')} className={cn("gap-2", editorState.isBold && "text-primary")}><Bold className="w-4 h-4" /> Bold <span className="ml-auto text-[10px] opacity-50">{MOD}B</span></DropdownMenuItem>
        },
        {
            id: 'italic',
            label: 'Italic',
            shortcut: `${MOD}I`,
            render: <Button key="italic" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleItalic')} style={activeStyle(editorState.isItalic)}><Italic className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="italic-dropdown" onClick={() => sendCommand('toggleItalic')} className={cn("gap-2", editorState.isItalic && "text-primary")}><Italic className="w-4 h-4" /> Italic <span className="ml-auto text-[10px] opacity-50">{MOD}I</span></DropdownMenuItem>
        },
        {
            id: 'underline',
            label: 'Underline',
            shortcut: `${MOD}U`,
            render: <Button key="underline" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleUnderline')} style={activeStyle(editorState.isUnderline)}><Underline className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="underline-dropdown" onClick={() => sendCommand('toggleUnderline')} className={cn("gap-2", editorState.isUnderline && "text-primary")}><Underline className="w-4 h-4" /> Underline <span className="ml-auto text-[10px] opacity-50">{MOD}U</span></DropdownMenuItem>
        },
        {
            id: 'strike',
            label: 'Strikethrough',
            shortcut: `${MOD}${SHIFT}X`,
            render: <Button key="strike" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleStrike')} style={activeStyle(editorState.isStrike)}><Strikethrough className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="strike-dropdown" onClick={() => sendCommand('toggleStrike')} className={cn("gap-2", editorState.isStrike && "text-primary")}><Strikethrough className="w-4 h-4" /> Strikethrough <span className="ml-auto text-[10px] opacity-50">{MOD}${SHIFT}X</span></DropdownMenuItem>
        },
        {
            id: 'textColor',
            label: 'Text Color',
            shortcut: `${MOD}${ALT}[0-9]`,
            render: <ColorPicker key="textColor" title="Text Color" label="Color" icon={Baseline} currentColor={editorState.textColor} onSelect={(color) => sendCommand('setColor', { color })} onClear={() => sendCommand('unsetColor')} onOpenChange={handleOpenChange} activeColor={colors.primary} />,
            dropdownRender: <ColorPicker key="textColor-dropdown" title="Text Color" label="Color" icon={Baseline} currentColor={editorState.textColor} onSelect={(color) => sendCommand('setColor', { color })} onClear={() => sendCommand('unsetColor')} onOpenChange={handleOpenChange} activeColor={colors.primary} isMenu />
        },
        {
            id: 'highlight',
            label: 'Highlight',
            shortcut: `${ALT}${MOD}${SHIFT}[0-9]`,
            render: <ColorPicker key="highlight" title="Highlight" label="Highlight" icon={Highlighter} currentColor={editorState.highlightColor} onSelect={(color) => sendCommand('setHighlight', { color })} onClear={() => sendCommand('unsetHighlight')} onOpenChange={handleOpenChange} activeColor={colors.primary} />,
            dropdownRender: <ColorPicker key="highlight-dropdown" title="Highlight" label="Highlight" icon={Highlighter} currentColor={editorState.highlightColor} onSelect={(color) => sendCommand('setHighlight', { color })} onClear={() => sendCommand('unsetHighlight')} onOpenChange={handleOpenChange} activeColor={colors.primary} isMenu />
        },
        {
            id: 'bulletList',
            label: 'Bullet List',
            shortcut: `${MOD}7`,
            render: <Button key="bulletList" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleBulletList')} style={activeStyle(editorState.isBulletList)}><List className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="bulletList-dropdown" onClick={() => sendCommand('toggleBulletList')} className={cn("gap-2", editorState.isBulletList && "text-primary")}><List className="w-4 h-4" /> Bullet List <span className="ml-auto text-[10px] opacity-50">{MOD}7</span></DropdownMenuItem>
        },
        {
            id: 'orderedList',
            label: 'Numbered List',
            shortcut: `${MOD}8`,
            render: <Button key="orderedList" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleOrderedList')} style={activeStyle(editorState.isOrderedList)}><ListOrdered className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="orderedList-dropdown" onClick={() => sendCommand('toggleOrderedList')} className={cn("gap-2", editorState.isOrderedList && "text-primary")}><ListOrdered className="w-4 h-4" /> Numbered List <span className="ml-auto text-[10px] opacity-50">{MOD}8</span></DropdownMenuItem>
        },
        {
            id: 'taskList',
            label: 'Task List',
            shortcut: `${MOD}9`,
            render: <Button key="taskList" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleTaskList')} style={activeStyle(editorState.isTaskList)}><CheckSquare className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="taskList-dropdown" onClick={() => sendCommand('toggleTaskList')} className={cn("gap-2", editorState.isTaskList && "text-primary")}><CheckSquare className="w-4 h-4" /> Task List <span className="ml-auto text-[10px] opacity-50">{MOD}9</span></DropdownMenuItem>
        },
        {
            id: 'outdent',
            label: 'Outdent',
            render: <Button key="outdent" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('liftListItem')} disabled={!editorState.canLiftListItem}><Outdent className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="outdent-dropdown" onClick={() => sendCommand('liftListItem')} disabled={!editorState.canLiftListItem} className="gap-2"><Outdent className="w-4 h-4" /> Outdent</DropdownMenuItem>
        },
        {
            id: 'indent',
            label: 'Indent',
            render: <Button key="indent" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('sinkListItem')} disabled={!editorState.canSinkListItem}><Indent className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="indent-dropdown" onClick={() => sendCommand('sinkListItem')} disabled={!editorState.canSinkListItem} className="gap-2"><Indent className="w-4 h-4" /> Indent</DropdownMenuItem>
        },
        {
            id: 'code',
            label: 'Inline Code',
            shortcut: `${MOD}${SHIFT}E`,
            render: <Button key="code" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleCode')} style={activeStyle(editorState.isCode)}><Code className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="code-dropdown" onClick={() => sendCommand('toggleCode')} className={cn("gap-2", editorState.isCode && "text-primary")}><Code className="w-4 h-4" /> Inline Code <span className="ml-auto text-[10px] opacity-50">{MOD}${SHIFT}E</span></DropdownMenuItem>
        },
        {
            id: 'codeBlock',
            label: 'Code Block',
            shortcut: `${MOD}${ALT}C`,
            render: <Button key="codeBlock" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleCodeBlock')} style={activeStyle(editorState.isCodeBlock)}><SquareCode className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="codeBlock-dropdown" onClick={() => sendCommand('toggleCodeBlock')} className={cn("gap-2", editorState.isCodeBlock && "text-primary")}><SquareCode className="w-4 h-4" /> Code Block <span className="ml-auto text-[10px] opacity-50">{MOD}${ALT}C</span></DropdownMenuItem>
        },
        {
            id: 'quote',
            label: 'Quote',
            shortcut: `${MOD}${SHIFT}B`,
            render: <Button key="quote" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleBlockquote')} style={activeStyle(editorState.isBlockquote)}><Quote className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="quote-dropdown" onClick={() => sendCommand('toggleBlockquote')} className={cn("gap-2", editorState.isBlockquote && "text-primary")}><Quote className="w-4 h-4" /> Quote <span className="ml-auto text-[10px] opacity-50">{MOD}${SHIFT}B</span></DropdownMenuItem>
        },
        {
            id: 'details',
            label: 'Collapsible',
            shortcut: `${MOD}.`,
            render: <Button key="details" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('toggleDetails')} style={activeStyle(editorState.isDetails)}><FileInput className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="details-dropdown" onClick={() => sendCommand('toggleDetails')} className={cn("gap-2", editorState.isDetails && "text-primary")}><FileInput className="w-4 h-4" /> Details <span className="ml-auto text-[10px] opacity-50">{MOD}.</span></DropdownMenuItem>
        },
        {
            id: 'math',
            label: 'Math Formula',
            shortcut: `${MOD}${SHIFT}M`,
            render: (
                <Button
                    key="math"
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-9 w-9 shrink-0 hover:bg-accent/50 transition-colors"
                    )}
                    style={activeStyle(activePopup === 'math')}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onActivePopupChange(activePopup === 'math' ? null : 'math');
                    }}
                >
                    <Sigma className="w-5 h-5" />
                </Button>
            ),
            dropdownRender: (
                <DropdownMenuItem
                    key="math-dropdown"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onActivePopupChange('math'); }}
                    className={cn("gap-2 cursor-pointer", activePopup === 'math' && "text-primary")}
                >
                    <Sigma className="w-4 h-4" />
                    <span>Math Formula</span>
                </DropdownMenuItem>
            )
        },
        {
            id: 'link',
            label: 'Link',
            shortcut: `${MOD}K`,
            render: (
                <LinkPopover
                    key="link"
                    title="Insert Link"
                    shortcut={`${MOD}K`}
                    icon={LinkIcon}
                    placeholder="https://example.com"
                    isActive={editorState.isLink}
                    initialValue={editorState.linkHref || ''}
                    selectedText={editorState.selectedText}
                    saveLabel="Save"
                    activeColor={colors.primary}
                    onSave={(href, title) => sendCommand('setLink', { href, title })}
                    onRemove={() => sendCommand('unsetLink')}
                    onOpenChange={handleOpenChange}
                />
            ),
            dropdownRender: (
                <LinkPopover
                    key="link-dropdown"
                    title="Insert Link"
                    shortcut={`${MOD}K`}
                    icon={LinkIcon}
                    placeholder="https://example.com"
                    isActive={editorState.isLink}
                    initialValue={editorState.linkHref || ''}
                    selectedText={editorState.selectedText}
                    saveLabel="Save"
                    activeColor={colors.primary}
                    onSave={(href, title) => sendCommand('setLink', { href, title })}
                    onRemove={() => sendCommand('unsetLink')}
                    onOpenChange={handleOpenChange}
                    isMenu
                />
            )
        },
        {
            id: 'youtube',
            label: 'YouTube',
            render: <LinkPopover key="youtube" title="YouTube Video" description="Enter a YouTube video URL" icon={Youtube} placeholder="https://youtube.com/watch?v=..." saveLabel="Insert" onSave={(href) => sendCommand('setYoutubeVideo', { src: href })} onOpenChange={handleOpenChange} hideTitle />,
            dropdownRender: <LinkPopover key="youtube-dropdown" title="YouTube Video" description="Enter a YouTube video URL" icon={Youtube} placeholder="https://youtube.com/watch?v=..." saveLabel="Insert" onSave={(href) => sendCommand('setYoutubeVideo', { src: href })} onOpenChange={handleOpenChange} isMenu hideTitle />
        },
        {
            id: 'table',
            label: 'Table',
            render: <Button key="table" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => { if (!editorState.isInTable) sendCommand('insertTable', { rows: 3, cols: 3, withHeaderRow: false }); }} style={activeStyle(editorState.isInTable)}><TableIcon className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="table-dropdown" onClick={() => { if (!editorState.isInTable) sendCommand('insertTable', { rows: 3, cols: 3, withHeaderRow: false }); }} className={cn("gap-2", editorState.isInTable && "text-primary")}><TableIcon className="w-4 h-4" /> Table</DropdownMenuItem>
        },
        {
            id: 'file',
            label: 'Insert File',
            render: <ToolbarFileUpload key="file" onInsertFile={onInsertFile} onOpenChange={handleOpenChange} />,
            dropdownRender: <ToolbarFileUpload key="file-dropdown" onInsertFile={onInsertFile} onOpenChange={handleOpenChange} isMenu />
        }
    ], [editorState, sendCommand, colors.primary, activeStyle, handleOpenChange, onInsertFile, activePopup, onActivePopupChange, MOD, ALT, SHIFT]);

    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
    const [resetKey, setResetKey] = useState(0);

    const itemsLength = items.length;
    const recomputeVisibleCount = useCallback(() => {
        const rowEl = rowRef.current;
        if (!rowEl) return;

        const rowStyles = getComputedStyle(rowEl);
        const rowGapRaw = rowStyles.columnGap || rowStyles.gap || '0';
        const rowGap = Number.parseFloat(rowGapRaw) || 0;
        const paddingLeft = Number.parseFloat(rowStyles.paddingLeft || '0') || 0;
        const paddingRight = Number.parseFloat(rowStyles.paddingRight || '0') || 0;
        const rowContentWidth = rowEl.clientWidth - paddingLeft - paddingRight;
        if (rowContentWidth <= 0) return;

        const HEADING_WIDTH = 48; // w-12
        const ITEM_WIDTH = 36; // w-9
        const ITEM_GAP = 2; // gap-0.5
        const RIGHT_GROUP_WIDTH = 74; // undo + redo + gap
        const RIGHT_GROUP_WITH_OVERFLOW = 112; // overflow + undo + redo + gaps
        const ROW_GAP_COUNT = 2; // items->spacer, spacer->right group  

        const itemsWidthFor = (count: number) => {
            if (count <= 0) return 0;
            const rest = Math.max(0, count - 1);
            return HEADING_WIDTH + rest * ITEM_WIDTH + rest * ITEM_GAP;
        };

        const availableNoOverflow = rowContentWidth - ROW_GAP_COUNT * rowGap - RIGHT_GROUP_WIDTH;
        if (itemsWidthFor(itemsLength) <= availableNoOverflow) {
            setVisibleCount(itemsLength);
            return;
        }

        const availableWithOverflow = rowContentWidth - ROW_GAP_COUNT * rowGap - RIGHT_GROUP_WITH_OVERFLOW;
        if (availableWithOverflow <= HEADING_WIDTH) {
            setVisibleCount(1);
            return;
        }

        let count = 1;
        for (let i = 1; i <= itemsLength; i++) {
            if (itemsWidthFor(i) <= availableWithOverflow) {
                count = i;
            } else {
                break;
            }
        }

        setVisibleCount(Math.max(1, Math.min(itemsLength, count)));
    }, [itemsLength]);

    useEffect(() => {
        const rowEl = rowRef.current;
        if (!rowEl) return;

        const observer = new ResizeObserver(() => {
            // Use requestAnimationFrame to ensure DOM styles have settled
            requestAnimationFrame(recomputeVisibleCount);
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
            // Also observe parent to catch layout shifts (like sidebars opening)
            // even if the toolbar's own width didn't change due to max-width
            if (containerRef.current.parentElement) {
                observer.observe(containerRef.current.parentElement);
            }
        }

        const handleLayoutChange = () => {
            requestAnimationFrame(recomputeVisibleCount);
            // Sidebars often have transitions, so we check again after they likely finish
            setTimeout(() => requestAnimationFrame(recomputeVisibleCount), 300);
        };

        window.addEventListener('resize', handleLayoutChange);
        window.addEventListener('focus', handleLayoutChange);
        window.addEventListener('annota-toggle-main-sidebar', handleLayoutChange as EventListener);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', handleLayoutChange);
            window.removeEventListener('focus', handleLayoutChange);
            window.removeEventListener('annota-toggle-main-sidebar', handleLayoutChange as EventListener);
        };
    }, [recomputeVisibleCount]);

    const visibleItems = items.slice(0, visibleCount);
    const overflowItems = items.slice(visibleCount);

    return (
        <TooltipProvider key={resetKey}>
            <div
                ref={containerRef}
                dir='ltr'
                onMouseLeave={() => {
                    setActiveTooltip(null);
                    if (!isPopupOpen) setResetKey(prev => prev + 1);
                }}
                className="
                            absolute bottom-6 left-1/2 -translate-x-1/2
                            w-[90%] max-w-[920px]
                            flex items-center
                            p-0.5
                            rounded-2xl
                            z-50

                            bg-linear-to-r from-background/25 via-background/15 to-background/25
                            backdrop-blur-2xl
                            border border-background/20
                            ring-1 ring-background/10
                            shadow-[0_14px_30px_rgba(15,23,42,0.35)]

                            dark:bg-linear-to-r dark:from-stone-900/70 dark:via-stone-900/40 dark:to-stone-900/70
                            dark:border-background/20
                            dark:ring-background/10
                            dark:shadow-[0_18px_40px_rgba(0,0,0,0.6)]
                            "
            >
                <div ref={rowRef} className="flex items-center gap-0.5 w-full px-1">
                    <div className="flex items-center gap-0.5">
                        {visibleItems.map((item) => (
                            <Tooltip
                                key={item.id}
                                open={!isPopupOpen && activeTooltip === item.id}
                                onOpenChange={(open) => setActiveTooltip(open ? item.id : null)}
                            >
                                <TooltipTrigger asChild>
                                    <div className="flex shrink-0">
                                        {item.render}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" sideOffset={12}>
                                    {item.label}
                                    {item.shortcut && (
                                        <span className="ml-2 text-[10px] opacity-60 bg-white/10 px-1 rounded-sm border border-white/10">{item.shortcut}</span>
                                    )}
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </div>

                    <div className="flex-1" />

                    <div className="flex items-center gap-0.5 ml-auto">
                        {overflowItems.length > 0 && (
                            <DropdownMenu onOpenChange={handleOpenChange} modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                                        <MoreHorizontal className="w-5 h-5" />
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

                        <Tooltip
                            open={!isPopupOpen && activeTooltip === 'undo'}
                            onOpenChange={(open) => setActiveTooltip(open ? 'undo' : null)}
                        >
                            <TooltipTrigger asChild>
                                <div className="flex shrink-0">
                                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('undo')} disabled={!editorState.canUndo} style={activeStyle(false)}>
                                        <Undo className="w-5 h-5" />
                                    </Button>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={12}>
                                Undo
                                <span className="ml-2 text-[10px] opacity-60 bg-white/10 px-1 rounded-sm border border-white/10">{MOD}Z</span>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip
                            open={!isPopupOpen && activeTooltip === 'redo'}
                            onOpenChange={(open) => setActiveTooltip(open ? 'redo' : null)}
                        >
                            <TooltipTrigger asChild>
                                <div className="flex shrink-0">
                                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => sendCommand('redo')} disabled={!editorState.canRedo} style={activeStyle(false)}>
                                        <Redo className="w-5 h-5" />
                                    </Button>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={12}>
                                Redo
                                <span className="ml-2 text-[10px] opacity-60 bg-white/10 px-1 rounded-sm border border-white/10">{MOD}${SHIFT}Z</span>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </div>

            {/* Global Math Dialog */}
            <MathPopover
                sendCommand={sendCommand}
                activeColor={colors.primary}
                onOpenChange={(open) => {
                    handleOpenChange(open);
                    if (!open && activePopup === 'math') onActivePopupChange(null);
                }}
                visible={activePopup === 'math'}
                currentLatex={currentLatex}
            />

            {/* Global Link Popover */}
            <LinkPopover
                title="Insert Link"
                icon={LinkIcon}
                placeholder="https://example.com"
                isActive={editorState.isLink}
                initialValue={editorState.linkHref || ''}
                selectedText={editorState.selectedText}
                saveLabel="Save"
                activeColor={colors.primary}
                onSave={(href, title) => {
                    sendCommand('setLink', { href, title });
                    onActivePopupChange(null);
                }}
                onRemove={() => {
                    sendCommand('unsetLink');
                    onActivePopupChange(null);
                }}
                visible={activePopup === 'link'}
                onClose={() => onActivePopupChange(null)}
            />

            {/* Global YouTube Popover */}
            <LinkPopover
                title="YouTube Video"
                description="Enter a YouTube video URL"
                icon={Youtube}
                placeholder="https://youtube.com/watch?v=..."
                saveLabel="Insert"
                onSave={(href) => {
                    sendCommand('setYoutubeVideo', { src: href });
                    onActivePopupChange(null);
                }}
                visible={activePopup === 'youtube'}
                onClose={() => onActivePopupChange(null)}
                hideTitle
            />

            {/* Global File Modal */}
            <ToolbarFileUpload
                onInsertFile={onInsertFile}
                visible={activePopup === 'file'}
                onClose={() => onActivePopupChange(null)}
            />
        </TooltipProvider>
    );
}
