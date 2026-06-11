import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SearchRepository, useNotesStore } from '@annota/core';
import { FileText, Loader2, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const [displayNotes, setDisplayNotes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let active = true;
        const normalizedQuery = query.toLowerCase().trim();

        if (!normalizedQuery) {
            // Fallback to recent notes from memory store
            const notes = useNotesStore.getState().notes;
            const filtered = notes.filter(n => !n.isDeleted && n.id !== noteId);
            const sorted = filtered
                .sort((a, b) => {
                    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                    return dateB - dateA;
                })
                .slice(0, 10);
            setDisplayNotes(sorted);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const timer = setTimeout(async () => {
            try {
                const results = await SearchRepository.searchNotes(query, null, 11);
                if (active) {
                    const filtered = results.filter(r => r.id !== noteId).slice(0, 10);
                    setDisplayNotes(filtered);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('Failed to search notes for linking:', err);
                if (active) {
                    setIsLoading(false);
                }
            }
        }, 300);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [query, noteId]);

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
                className="z-50 overflow-hidden w-64 p-0 border rounded-xl shadow-md"
            >
                <div ref={containerRef} className="flex flex-col bg-popover text-popover-foreground">
                    <div className="px-2 py-1.5 border-b flex items-center gap-2 bg-muted/30">
                        <Search className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Link Note</span>
                    </div>
                    <div className="h-full max-h-[300px] p-1 overflow-y-auto premium-scrollbar">
                        <div className="flex flex-col gap-1">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-6 gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                    <span className="text-[10px] text-muted-foreground/60">Searching...</span>
                                </div>
                            ) : displayNotes.length === 0 ? (
                                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                    No notes found
                                </div>
                            ) : (
                                displayNotes.map((note, index) => {
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
                                })
                            )}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
