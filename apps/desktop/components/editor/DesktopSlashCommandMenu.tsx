import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getFilteredCommands, SharedSlashCommand } from '@annota/tiptap-editor';
import {
    Baseline,
    Bold,
    CheckSquare,
    ChevronLeft,
    ChevronRight,
    Code,
    FilePlus as FileInput,
    Image,
    Italic,
    Link,
    List,
    ListOrdered,
    Layout as MessageSquare,
    Plus,
    Quote,
    Sigma,
    Terminal as SquareCode,
    Strikethrough,
    Table,
    Type,
    Underline,
    Youtube
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const DesktopIconMap: Record<string, any> = {
    'heading': Type,
    'h1': Type,
    'h2': Type,
    'h3': Type,
    'format': Baseline,
    'bold': Bold,
    'italic': Italic,
    'underline': Underline,
    'strike': Strikethrough,
    'list': List,
    'bulletList': List,
    'orderedList': ListOrdered,
    'taskList': CheckSquare,
    'blocks': MessageSquare,
    'quote': Quote,
    'codeblock': SquareCode,
    'code': Code,
    'details': FileInput,
    'plus': Plus,
    'math': Sigma,
    'image': Image,
    'link': Link,
    'youtube': Youtube,
    'table': Table,
};

interface DesktopSlashCommandMenuProps {
    query: string;
    range: { from: number; to: number };
    clientRect: any;
    sendCommand: (cmd: string, params?: Record<string, unknown>) => void;
    onClose: () => void;
}

export function DesktopSlashCommandMenu({
    query,
    range,
    clientRect,
    sendCommand,
    onClose
}: DesktopSlashCommandMenuProps) {
    const [activeFolder, setActiveFolder] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);


    const displayItems = useMemo(() => {
        return getFilteredCommands(query, activeFolder);
    }, [query, activeFolder]);

    // Reset selection when items change
    useEffect(() => {
        setSelectedIndex(0);
    }, [displayItems.length]);

    const handleSelect = (item: SharedSlashCommand) => {
        if (item.children) {
            setActiveFolder(item.id);
            setSelectedIndex(0);
        } else if (item.action) {
            sendCommand('deleteSelection', { from: range.from, to: range.to });
            sendCommand(item.action, item.params);
            onClose();
        }
    };

    // Handle Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const minIndex = activeFolder ? -1 : 0;
            const maxIndex = displayItems.length - 1;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1 > maxIndex ? minIndex : prev + 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 < minIndex ? maxIndex : prev - 1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex === -1) {
                    setActiveFolder(null);
                    setSelectedIndex(0);
                } else if (displayItems[selectedIndex]) {
                    handleSelect(displayItems[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            } else if (e.key === 'ArrowLeft' && activeFolder) {
                e.preventDefault();
                setActiveFolder(null);
                setSelectedIndex(0);
            } else if (e.key === 'ArrowRight') {
                const item = displayItems[selectedIndex];
                if (item?.children) {
                    e.preventDefault();
                    setActiveFolder(item.id);
                    setSelectedIndex(0);
                }
            } else if (e.key === 'Backspace' && query === '' && activeFolder) {
                setActiveFolder(null);
                setSelectedIndex(0);
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [displayItems, selectedIndex, activeFolder, query, onClose, handleSelect]);


    if (!clientRect) return null;

    return (
        <Popover open={true}>
            <PopoverAnchor
                style={{
                    position: 'fixed',
                    top: clientRect.top,
                    left: clientRect.left,
                    width: clientRect.width,
                    height: clientRect.height,
                    pointerEvents: 'none',
                }}
            />
            <PopoverContent
                side="bottom"
                align="start"
                sideOffset={8}
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
                className="z-100 overflow-hidden w-56 p-0 border rounded-xl shadow-md"
            >
                <div ref={containerRef} className="flex flex-col bg-popover text-popover-foreground">
                    <ScrollArea className="h-full max-h-[300px] p-1">
                        <div className="flex flex-col gap-1">
                            {activeFolder && (
                                <button
                                    type="button"
                                    className={cn(
                                        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                                        selectedIndex === -1 ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                                    )}
                                    onClick={() => {
                                        setActiveFolder(null);
                                        setSelectedIndex(0);
                                    }}
                                    onMouseEnter={() => setSelectedIndex(-1)}
                                >
                                    <ChevronLeft className="w-5 h-5 mr-2" />
                                    <span>Back</span>
                                </button>
                            )}

                            {displayItems.length === 0 && (
                                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                    No results found
                                </div>
                            )}

                            {displayItems.map((item, index) => {
                                const isSelected = index === selectedIndex;
                                const Icon = DesktopIconMap[item.iconKey] || Type;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={cn(
                                            "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1 text-sm outline-none transition-colors",
                                            isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                                        )}
                                        onClick={() => handleSelect(item)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        <Icon className="w-5 h-5 mr-2 shrink-0" />
                                        <span className="flex-1 text-left line-clamp-1">{item.title}</span>
                                        {item.children && (
                                            <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-50" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>
            </PopoverContent>
        </Popover>
    );
}
