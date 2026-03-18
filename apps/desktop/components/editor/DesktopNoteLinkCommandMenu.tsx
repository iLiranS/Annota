import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@annota/core';
import { FileText, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface DesktopNoteLinkCommandMenuProps {
    query: string;
    range: { from: number; to: number };
    clientRect: any;
    sendCommand: (cmd: string, params?: Record<string, unknown>) => void;
    onClose: () => void;
    noteId: string;
}

export function DesktopNoteLinkCommandMenu({
    query,
    range,
    clientRect,
    sendCommand,
    onClose,
    noteId
}: DesktopNoteLinkCommandMenuProps) {
    const { notes } = useNotesStore();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const normalizedQuery = query.toLowerCase().trim();

    const displayNotes = useMemo(() => {
        const filtered = notes.filter(n => !n.isDeleted && n.id !== noteId && (n.title || 'Untitled').toLowerCase().includes(normalizedQuery));
        return filtered
            .sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            })
            .slice(0, 7);
    }, [notes, normalizedQuery]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [displayNotes.length]);

    const handleSelect = (note: any) => {
        // 1. Delete the "[[query" text
        sendCommand('deleteSelection', { from: range.from, to: range.to });

        // 2. Insert the link
        sendCommand('setLink', {
            href: `annota://note/${note.id}`,
            title: note.title || 'Untitled Note'
        });

        onClose();
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const minIndex = 0;
            const maxIndex = displayNotes.length - 1;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1 > maxIndex ? minIndex : prev + 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 < minIndex ? maxIndex : prev - 1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (displayNotes[selectedIndex]) {
                    handleSelect(displayNotes[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [displayNotes, selectedIndex, onClose, handleSelect]);

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
                className="z-100 overflow-hidden w-64 p-0 border rounded-xl shadow-md"
            >
                <div ref={containerRef} className="flex flex-col bg-popover text-popover-foreground">
                    <div className="px-2 py-1.5 border-b flex items-center gap-2 bg-muted/30">
                        <Search className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Link Note</span>
                    </div>
                    <ScrollArea className="h-full max-h-[300px] p-1">
                        <div className="flex flex-col gap-1">
                            {displayNotes.length === 0 && (
                                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                    No notes found
                                </div>
                            )}

                            {displayNotes.map((note, index) => {
                                const isSelected = index === selectedIndex;
                                return (
                                    <button
                                        key={note.id}
                                        type="button"
                                        className={cn(
                                            "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                                            isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                                        )}
                                        onClick={() => handleSelect(note)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        <FileText className="w-4 h-4 mr-2 shrink-0 opacity-70" />
                                        <span className="flex-1 text-left line-clamp-1">
                                            {note.title || 'Untitled Note'}
                                        </span>
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
