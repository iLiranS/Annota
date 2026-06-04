import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppTheme } from '@/hooks/use-app-theme';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@annota/core';
import type { ToolbarRenderProps } from '@annota/editor-ui';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Separator } from '../ui/separator';
import { EditorIcons } from './EditorIcons';
import { ColorPicker } from './toolbar/toolbar-color-picker';
import { ToolbarEditModal } from './toolbar/toolbar-edit-modal';
import { ToolbarFileUpload } from './toolbar/toolbar-file-upload';
import { HeadingSelector } from './toolbar/toolbar-heading-selector';
import { LinkPopover } from './toolbar/toolbar-link-popover';
import { MathPopover } from './toolbar/toolbar-math-popover';
import { TableSelector } from './toolbar/toolbar-table-selector';

const DEFAULT_ORDER = [
    'heading', 'bold', 'italic', 'underline', 'strike', 'textColor', 'highlight',
    'bulletList', 'orderedList', 'taskList', 'outdent', 'indent', 'code', 'codeBlock',
    'quote', 'table', 'math', 'link', 'details', 'mermaid', 'flashcard', 'file', 'youtube'
];
const DEFAULT_HIDDEN = ['details', 'mermaid', 'flashcard', 'file', 'youtube'];
const STORAGE_KEY = 'annota-desktop-toolbar-order';
const STORAGE_KEY_HIDDEN = 'annota-desktop-toolbar-hidden';

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
    isBlockMath,
    onActivePopupChange,
}: ToolbarRenderProps) {
    const { colors } = useAppTheme();
    const { general } = useSettingsStore();
    const isRtl = general?.appDirection === 'rtl';
    const containerRef = useRef<HTMLDivElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    const [visibleCount, setVisibleCount] = useState(15);

    // Fix Hydration Mismatch for OS Shortcuts
    const [isMac, setIsMac] = useState(false);
    useEffect(() => {
        setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent));
    }, []);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [toolbarOrder, setToolbarOrder] = useState<string[]>(DEFAULT_ORDER);
    const [hiddenIds, setHiddenIds] = useState<string[]>(DEFAULT_HIDDEN);

    useEffect(() => {
        const savedOrder = localStorage.getItem(STORAGE_KEY);
        if (savedOrder) {
            try {
                const parsed = JSON.parse(savedOrder);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setToolbarOrder(parsed);
                }
            } catch (e) { }
        }

        const savedHidden = localStorage.getItem(STORAGE_KEY_HIDDEN);
        if (savedHidden) {
            try {
                const parsed = JSON.parse(savedHidden);
                if (Array.isArray(parsed)) {
                    setHiddenIds(parsed);
                }
            } catch (e) { }
        }
    }, []);

    const saveOrder = useCallback((newOrder: string[]) => {
        setToolbarOrder(newOrder);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
    }, []);

    const saveHidden = useCallback((newHidden: string[]) => {
        setHiddenIds(newHidden);
        localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify(newHidden));
    }, []);

    const [openMenusCount, setOpenMenusCount] = useState(0);
    const handleOpenChange = useCallback((open: boolean) => {
        setOpenMenusCount(prev => open ? prev + 1 : Math.max(0, prev - 1));
    }, []);
    const isPopupOpen = openMenusCount > 0 || activePopup !== null;

    const activeStyle = useCallback((active: boolean) => ({
        color: active ? colors.primary : undefined,
        opacity: active ? 1 : 0.7,
        backgroundColor: active ? `${colors.primary}20` : undefined,
        borderRadius: '6px',
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
            shortcut: isMac ? '⌘+B' : 'Ctrl+B',
            render: <Button key="bold" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('toggleBold')} style={activeStyle(editorState.isBold)}><EditorIcons.Bold className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="bold-dropdown" onClick={() => sendCommand('toggleBold')} className={cn("gap-2", editorState.isBold && "text-primary")}><EditorIcons.Bold className="w-4 h-4" /> Bold <span className="ml-auto text-[10px] opacity-50">{isMac ? '⌘+B' : 'Ctrl+B'}</span></DropdownMenuItem>
        },
        {
            id: 'italic',
            label: 'Italic',
            shortcut: isMac ? '⌘+I' : 'Ctrl+I',
            render: <Button key="italic" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('toggleItalic')} style={activeStyle(editorState.isItalic)}><EditorIcons.Italic className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="italic-dropdown" onClick={() => sendCommand('toggleItalic')} className={cn("gap-2", editorState.isItalic && "text-primary")}><EditorIcons.Italic className="w-4 h-4" /> Italic <span className="ml-auto text-[10px] opacity-50">{isMac ? '⌘+I' : 'Ctrl+I'}</span></DropdownMenuItem>
        },
        {
            id: 'underline',
            label: 'Underline',
            shortcut: isMac ? '⌘+U' : 'Ctrl+U',
            render: <Button key="underline" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('toggleUnderline')} style={activeStyle(editorState.isUnderline)}><EditorIcons.Underline className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="underline-dropdown" onClick={() => sendCommand('toggleUnderline')} className={cn("gap-2", editorState.isUnderline && "text-primary")}><EditorIcons.Underline className="w-4 h-4" /> Underline <span className="ml-auto text-[10px] opacity-50">{isMac ? '⌘+U' : 'Ctrl+U'}</span></DropdownMenuItem>
        },
        {
            id: 'strike',
            label: 'Strikethrough',
            shortcut: isMac ? '⌘+⇧+X' : 'Ctrl+Shift+X',
            render: <Button key="strike" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('toggleStrike')} style={activeStyle(editorState.isStrike)}><EditorIcons.Strike className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="strike-dropdown" onClick={() => sendCommand('toggleStrike')} className={cn("gap-2", editorState.isStrike && "text-primary")}><EditorIcons.Strike className="w-4 h-4" /> Strikethrough <span className="ml-auto text-[10px] opacity-50">{isMac ? '⌘+⇧+X' : 'Ctrl+Shift+X'}</span></DropdownMenuItem>
        },
        {
            id: 'textColor',
            label: 'Text Color',
            shortcut: isMac ? '⌘+⌥+[0-9]' : 'Ctrl+Alt+[0-9]',
            render: <ColorPicker key="textColor" title="Text Color" label="Color" icon={EditorIcons.Baseline} currentColor={editorState.textColor} onSelect={(color) => sendCommand('setColor', { color })} onClear={() => sendCommand('unsetColor')} onOpenChange={handleOpenChange} activeColor={colors.primary} />,
            dropdownRender: <ColorPicker key="textColor-dropdown" title="Text Color" label="Color" icon={EditorIcons.Baseline} currentColor={editorState.textColor} onSelect={(color) => sendCommand('setColor', { color })} onClear={() => sendCommand('unsetColor')} onOpenChange={handleOpenChange} activeColor={colors.primary} isMenu />
        },
        {
            id: 'highlight',
            label: 'Highlight',
            shortcut: isMac ? '⌥+⌘+⇧+[0-9]' : 'Ctrl+Alt+Shift+[0-9]',
            render: <ColorPicker key="highlight" title="Highlight" label="Highlight" icon={EditorIcons.Highlighter} currentColor={editorState.highlightColor} onSelect={(color) => sendCommand('setHighlight', { color })} onClear={() => sendCommand('unsetHighlight')} onOpenChange={handleOpenChange} activeColor={colors.primary} />,
            dropdownRender: <ColorPicker key="highlight-dropdown" title="Highlight" label="Highlight" icon={EditorIcons.Highlighter} currentColor={editorState.highlightColor} onSelect={(color) => sendCommand('setHighlight', { color })} onClear={() => sendCommand('unsetHighlight')} onOpenChange={handleOpenChange} activeColor={colors.primary} isMenu />
        },
        {
            id: 'bulletList',
            label: 'Bullet List',
            shortcut: isMac ? '⌘+7' : 'Ctrl+7',
            render: <Button key="bulletList" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('toggleBulletList')} style={activeStyle(editorState.isBulletList)}><EditorIcons.BulletList className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="bulletList-dropdown" onClick={() => sendCommand('toggleBulletList')} className={cn("gap-2", editorState.isBulletList && "text-primary")}><EditorIcons.BulletList className="w-4 h-4" /> Bullet List <span className="ml-auto text-[10px] opacity-50">{isMac ? '⌘+7' : 'Ctrl+7'}</span></DropdownMenuItem>
        },
        {
            id: 'orderedList',
            label: 'Numbered List',
            shortcut: isMac ? '⌘+8' : 'Ctrl+8',
            render: <Button key="orderedList" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('toggleOrderedList')} style={activeStyle(editorState.isOrderedList)}><EditorIcons.OrderedList className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="orderedList-dropdown" onClick={() => sendCommand('toggleOrderedList')} className={cn("gap-2", editorState.isOrderedList && "text-primary")}><EditorIcons.OrderedList className="w-4 h-4" /> Numbered List <span className="ml-auto text-[10px] opacity-50">{isMac ? '⌘+8' : 'Ctrl+8'}</span></DropdownMenuItem>
        },
        {
            id: 'taskList',
            label: 'Task List',
            shortcut: isMac ? '⌘+9' : 'Ctrl+9',
            render: <Button key="taskList" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('toggleTaskList')} style={activeStyle(editorState.isTaskList)}><EditorIcons.TaskList className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="taskList-dropdown" onClick={() => sendCommand('toggleTaskList')} className={cn("gap-2", editorState.isTaskList && "text-primary")}><EditorIcons.TaskList className="w-4 h-4" /> Task List <span className="ml-auto text-[10px] opacity-50">{isMac ? '⌘+9' : 'Ctrl+9'}</span></DropdownMenuItem>
        },
        {
            id: 'outdent',
            label: 'Outdent',
            shortcut: 'Shift+Tab',
            render: <Button key="outdent" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('outdent')} style={activeStyle(false)}><EditorIcons.Outdent className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="outdent-dropdown" onClick={() => sendCommand('outdent')} className="gap-2"><EditorIcons.Outdent className="w-4 h-4" /> Outdent <span className="ml-auto text-[10px] opacity-50">Shift+Tab</span></DropdownMenuItem>
        },
        {
            id: 'indent',
            label: 'Indent',
            shortcut: 'Tab',
            render: <Button key="indent" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('indent')} style={activeStyle(false)}><EditorIcons.Indent className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="indent-dropdown" onClick={() => sendCommand('indent')} className="gap-2"><EditorIcons.Indent className="w-4 h-4" /> Indent <span className="ml-auto text-[10px] opacity-50">Tab</span></DropdownMenuItem>
        },
        {
            id: 'code',
            label: 'Inline Code',
            shortcut: isMac ? '⌘+⇧+E' : 'Ctrl+Shift+E',
            render: <Button key="code" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('toggleCode')} style={activeStyle(editorState.isCode)}><EditorIcons.Code className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="code-dropdown" onClick={() => sendCommand('toggleCode')} className={cn("gap-2", editorState.isCode && "text-primary")}><EditorIcons.Code className="w-4 h-4" /> Inline Code <span className="ml-auto text-[10px] opacity-50">{isMac ? '⌘+⇧+E' : 'Ctrl+Shift+E'}</span></DropdownMenuItem>
        },
        {
            id: 'codeBlock',
            label: 'Code Block',
            shortcut: isMac ? '⌘+⌥+C' : 'Ctrl+Alt+C',
            render: <Button key="codeBlock" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('toggleCodeBlock')} style={activeStyle(editorState.isCodeBlock)}><EditorIcons.CodeBlock className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="codeBlock-dropdown" onClick={() => sendCommand('toggleCodeBlock')} className={cn("gap-2", editorState.isCodeBlock && "text-primary")}><EditorIcons.CodeBlock className="w-4 h-4" /> Code Block <span className="ml-auto text-[10px] opacity-50">{isMac ? '⌘+⌥+C' : 'Ctrl+Alt+C'}</span></DropdownMenuItem>
        },
        {
            id: 'quote',
            label: 'Quote',
            shortcut: isMac ? '⌘+⇧+U' : 'Ctrl+Shift+U',
            render: <Button key="quote" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('toggleBlockquote')} style={activeStyle(editorState.isBlockquote)}><EditorIcons.Quote className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="quote-dropdown" onClick={() => sendCommand('toggleBlockquote')} className={cn("gap-2", editorState.isBlockquote && "text-primary")}><EditorIcons.Quote className="w-4 h-4" /> Quote <span className="ml-auto text-[10px] opacity-50">{isMac ? '⌘+⇧+U' : 'Ctrl+Shift+U'}</span></DropdownMenuItem>
        },
        {
            id: 'table',
            label: 'Table',
            render: <TableSelector key="table" editorState={editorState} sendCommand={sendCommand} onOpenChange={handleOpenChange} activeStyle={activeStyle} />,
            dropdownRender: <TableSelector key="table-dropdown" editorState={editorState} sendCommand={sendCommand} onOpenChange={handleOpenChange} activeStyle={activeStyle} isMenu />
        },
        {
            id: 'math',
            label: 'Math Formula',
            shortcut: isMac ? '⌘+⇧+M' : 'Ctrl+Shift+M',
            render: (
                <Button
                    key="math"
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-8 w-8 shrink-0  transition-colors"
                    )}
                    style={activeStyle(activePopup === 'math')}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onActivePopupChange(activePopup === 'math' ? null : 'math');
                    }}
                >
                    <EditorIcons.Sigma className="w-5 h-5" />
                </Button>
            ),
            dropdownRender: (
                <DropdownMenuItem
                    key="math-dropdown"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onActivePopupChange('math'); }}
                    className={cn("gap-2 cursor-pointer", activePopup === 'math' && "text-primary")}
                >
                    <EditorIcons.Sigma className="w-4 h-4" />
                    <span>Math Formula</span>
                </DropdownMenuItem>
            )
        },
        {
            id: 'link',
            label: 'Link',
            shortcut: isMac ? '⌘+K' : 'Ctrl+K',
            render: (
                <LinkPopover
                    key="link"
                    title="Insert Link"
                    shortcut={isMac ? '⌘+K' : 'Ctrl+K'}
                    icon={EditorIcons.Link}
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
                    shortcut={isMac ? '⌘+K' : 'Ctrl+K'}
                    icon={EditorIcons.Link}
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
            id: 'details',
            label: 'Details',
            shortcut: isMac ? '⌘+.' : 'Ctrl+.',
            render: <Button key="details" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('toggleDetails')} style={activeStyle(editorState.isDetails)}><EditorIcons.Details className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="details-dropdown" onClick={() => sendCommand('toggleDetails')} className={cn("gap-2", editorState.isDetails && "text-primary")}><EditorIcons.Details className="w-4 h-4" /> Details <span className="ml-auto text-[10px] opacity-50">{isMac ? '⌘+.' : 'Ctrl+.'}</span></DropdownMenuItem>
        },
        {
            id: 'mermaid',
            label: 'Mermaid Diagram',
            render: <Button key="mermaid" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('insertMermaid')} style={activeStyle(false)}><EditorIcons.Mermaid className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="mermaid-dropdown" onClick={() => sendCommand('insertMermaid')} className="gap-2"><EditorIcons.Mermaid className="w-4 h-4" /> Mermaid Diagram</DropdownMenuItem>
        },
        {
            id: 'flashcard',
            label: 'Flashcards',
            render: <Button key="flashcard" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('insertFlashcardBlock')} style={activeStyle(false)}><EditorIcons.Flashcard className="w-5 h-5" /></Button>,
            dropdownRender: <DropdownMenuItem key="flashcard-dropdown" onClick={() => sendCommand('insertFlashcardBlock')} className="gap-2"><EditorIcons.Flashcard className="w-4 h-4" /> Flashcards</DropdownMenuItem>
        },
        {
            id: 'file',
            label: 'File',
            render: <ToolbarFileUpload key="file" onInsertFile={onInsertFile} onOpenChange={handleOpenChange} />,
            dropdownRender: <ToolbarFileUpload key="file-dropdown" onInsertFile={onInsertFile} onOpenChange={handleOpenChange} isMenu />
        },
        {
            id: 'youtube',
            label: 'YouTube Video',
            render: (
                <LinkPopover
                    key="youtube"
                    title="YouTube Video"
                    description="Enter a YouTube video URL"
                    icon={EditorIcons.Youtube}
                    placeholder="https://youtube.com/watch?v=..."
                    saveLabel="Insert"
                    onSave={(href) => sendCommand('setYoutubeVideo', { src: href })}
                    onOpenChange={handleOpenChange}
                    hideTitle
                />
            ),
            dropdownRender: (
                <LinkPopover
                    key="youtube-dropdown"
                    title="YouTube Video"
                    description="Enter a YouTube video URL"
                    icon={EditorIcons.Youtube}
                    placeholder="https://youtube.com/watch?v=..."
                    saveLabel="Insert"
                    onSave={(href) => sendCommand('setYoutubeVideo', { src: href })}
                    onOpenChange={handleOpenChange}
                    isMenu
                    hideTitle
                />
            )
        },
    ], [editorState, sendCommand, colors.primary, activeStyle, handleOpenChange, onInsertFile, activePopup, onActivePopupChange, isMac]);

    const orderedItems = React.useMemo(() => {
        const itemMap = new Map(items.map(item => [item.id, item]));

        // Ensure all items from 'items' are included
        const currentOrder = [...toolbarOrder];
        items.forEach(item => {
            if (!currentOrder.includes(item.id)) {
                currentOrder.push(item.id);
            }
        });

        return currentOrder
            .map(id => itemMap.get(id))
            .filter((item): item is ToolbarItem => !!item);
    }, [items, toolbarOrder]);

    const activeToolbarItems = React.useMemo(() => {
        return orderedItems.filter(item => !hiddenIds.includes(item.id));
    }, [orderedItems, hiddenIds]);

    const plusButtonToolbarItems = React.useMemo(() => {
        return orderedItems.filter(item => hiddenIds.includes(item.id));
    }, [orderedItems, hiddenIds]);

    const moveItem = useCallback((id: string, direction: 'up' | 'down') => {
        const currentOrder = orderedItems.map(item => item.id);
        const index = currentOrder.indexOf(id);
        if (index === -1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

        const newOrder = [...currentOrder];
        [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
        saveOrder(newOrder);
    }, [orderedItems, saveOrder]);

    const toggleItemVisibility = useCallback((id: string) => {
        if (hiddenIds.includes(id)) {
            saveHidden(hiddenIds.filter(hid => hid !== id));
        } else {
            saveHidden([...hiddenIds, id]);
        }
    }, [hiddenIds, saveHidden]);

    const resetToolbar = useCallback(() => {
        saveOrder(DEFAULT_ORDER);
        saveHidden(DEFAULT_HIDDEN);
    }, [saveOrder, saveHidden]);

    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
    const [resetKey, setResetKey] = useState(0);

    const itemsLength = activeToolbarItems.length;
    const recomputeVisibleCount = useCallback(() => {
        const rowEl = rowRef.current;
        const containerEl = containerRef.current;
        if (!rowEl || !containerEl || !containerEl.parentElement) return;

        const rowStyles = getComputedStyle(rowEl);
        const rowGapRaw = rowStyles.columnGap || rowStyles.gap || '0';
        const rowGap = Number.parseFloat(rowGapRaw) || 0;
        const paddingLeft = Number.parseFloat(rowStyles.paddingLeft || '0') || 0;
        const paddingRight = Number.parseFloat(rowStyles.paddingRight || '0') || 0;

        // Use parent's width instead of rowEl.clientWidth because rowEl is w-max
        const parentWidth = containerEl.parentElement.clientWidth;
        const availableToolbarWidth = Math.min(parentWidth * 0.9, 825);
        const rowContentWidth = availableToolbarWidth - paddingLeft - paddingRight;

        if (rowContentWidth <= 0) return;

        const HEADING_WIDTH = 40; // w-10
        const ITEM_WIDTH = 32; // w-8
        const ITEM_GAP = 4; // gap-1
        const RIGHT_GROUP_WIDTH = 104; // overflow (32) + undo (32) + redo (32) + gaps (8)
        const ROW_GAP_COUNT = 2; // items->spacer, spacer->right group  

        const itemsWidthFor = (count: number) => {
            if (count <= 0) return 0;
            const rest = Math.max(0, count - 1);
            return HEADING_WIDTH + rest * ITEM_WIDTH + rest * ITEM_GAP;
        };

        const availableWidth = rowContentWidth - ROW_GAP_COUNT * rowGap - RIGHT_GROUP_WIDTH;
        if (availableWidth <= HEADING_WIDTH) {
            setVisibleCount(1);
            return;
        }

        let count = 1;
        for (let i = 1; i <= itemsLength; i++) {
            if (itemsWidthFor(i) <= availableWidth) {
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

    const visibleItems = activeToolbarItems.slice(0, visibleCount);
    const overflowItems = activeToolbarItems.slice(visibleCount);

    // The overflow menu is always shown if there are overflow items, hidden items, 
    // or simply for the "Edit" option.

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
                            w-max max-w-[90%] md:max-w-[825px]
                            flex items-center
                            p-1
                            rounded-2xl
                            z-50

                           bg-note-bg/80
                            backdrop-blur-xl saturate-200
                            border border-border/40
                            shadow-[inset_0_1px_0_rgba(255,255,255,1),0_6px_20px_rgba(0,0,0,0.10)]
                            dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_32px_rgba(0,0,0,0.45)]
                            
                            "
            >
                <div ref={rowRef} className={cn("flex items-center gap-1 w-full px-1", isRtl && "flex-row-reverse")}>
                    <div className={cn("flex items-center gap-1", isRtl && "flex-row-reverse")}>
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
                                <TooltipContent
                                    side="top"
                                    sideOffset={12}
                                    className="bg-zinc-950 dark:bg-zinc-900 border border-zinc-800 text-zinc-100 px-2.5 py-1.5 rounded-lg shadow-xl flex items-center gap-2"
                                >
                                    <span className="font-medium text-[11px] tracking-wide">{item.label}</span>
                                    {item.shortcut && (
                                        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-zinc-700 bg-zinc-800 px-2 font-mono text-[10.5px] font-semibold tracking-[0.5px] text-zinc-200 shadow-[0_1px_0_rgba(0,0,0,0.2)]">
                                            {item.shortcut}
                                        </kbd>
                                    )}
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </div>

                    <div className="flex-1" />

                    <div className={cn("flex items-center gap-1", isRtl ? "mr-auto flex-row-reverse" : "ml-auto")}>
                        <DropdownMenu onOpenChange={handleOpenChange} modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 outline-none" style={activeStyle(false)}>
                                    <EditorIcons.More className="w-5 h-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isRtl ? "start" : "end"} className="w-56">
                                {overflowItems.map((item) => (
                                    <React.Fragment key={item.id + '-overflow'}>
                                        {item.dropdownRender}
                                    </React.Fragment>
                                ))}

                                {overflowItems.length > 0 && plusButtonToolbarItems.length > 0 && (
                                    <Separator className="my-1 opacity-50" />
                                )}

                                {plusButtonToolbarItems.map((item) => (
                                    <React.Fragment key={item.id + '-plus'}>
                                        {item.dropdownRender}
                                    </React.Fragment>
                                ))}

                                <Separator className="my-1 opacity-50" />

                                <DropdownMenuItem key="edit-toolbar" onClick={() => setIsEditModalOpen(true)} className="gap-2">
                                    <EditorIcons.Settings className="w-4 h-4" />
                                    Edit Toolbar
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Tooltip
                            open={!isPopupOpen && activeTooltip === 'undo'}
                            onOpenChange={(open) => setActiveTooltip(open ? 'undo' : null)}
                        >
                            <TooltipTrigger asChild>
                                <div className="flex shrink-0">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('undo')} disabled={!editorState.canUndo} style={{ ...activeStyle(false), opacity: editorState.canUndo ? 0.7 : 0.3 }}>
                                        <EditorIcons.Undo className="w-5 h-5" />
                                    </Button>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent
                                side="top"
                                sideOffset={12}
                                className="bg-zinc-950 dark:bg-zinc-900 border border-zinc-800 text-zinc-100 px-2.5 py-1.5 rounded-lg shadow-xl flex items-center gap-2"
                            >
                                <span className="font-medium text-[11px] tracking-wide">Undo</span>
                                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-zinc-700 bg-zinc-800 px-2 font-mono text-[10.5px] font-semibold tracking-[0.5px] text-zinc-200 shadow-[0_1px_0_rgba(0,0,0,0.2)]">
                                    {isMac ? '⌘+Z' : 'Ctrl+Z'}
                                </kbd>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip
                            open={!isPopupOpen && activeTooltip === 'redo'}
                            onOpenChange={(open) => setActiveTooltip(open ? 'redo' : null)}
                        >
                            <TooltipTrigger asChild>
                                <div className="flex shrink-0">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendCommand('redo')} disabled={!editorState.canRedo} style={{ ...activeStyle(false), opacity: editorState.canRedo ? 0.7 : 0.3 }}>
                                        <EditorIcons.Redo className="w-5 h-5" />
                                    </Button>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent
                                side="top"
                                sideOffset={12}
                                className="bg-zinc-950 dark:bg-zinc-900 border border-zinc-800 text-zinc-100 px-2.5 py-1.5 rounded-lg shadow-xl flex items-center gap-2"
                            >
                                <span className="font-medium text-[11px] tracking-wide">Redo</span>
                                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-zinc-700 bg-zinc-800 px-2 font-mono text-[10.5px] font-semibold tracking-[0.5px] text-zinc-200 shadow-[0_1px_0_rgba(0,0,0,0.2)]">
                                    {isMac ? '⌘+⇧+Z' : 'Ctrl+Shift+Z'}
                                </kbd>
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
                isBlockMath={isBlockMath}
            />

            {/* Global Link Popover */}
            <LinkPopover
                title="Insert Link"
                icon={EditorIcons.Link}
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
                icon={EditorIcons.Youtube}
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

            <ToolbarEditModal
                isOpen={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                visibleItems={activeToolbarItems}
                hiddenItems={plusButtonToolbarItems}
                onMoveItem={moveItem}
                onToggleVisibility={toggleItemVisibility}
                onReset={resetToolbar}
            />
        </TooltipProvider>
    );
}
