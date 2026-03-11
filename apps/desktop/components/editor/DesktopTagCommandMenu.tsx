import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@annota/core';
import { Check, Add as Plus, LocalOffer as TagIcon } from '@mui/icons-material';
import { useEffect, useMemo, useRef, useState } from 'react';

interface DesktopTagCommandMenuProps {
    noteId: string;
    query: string;
    range: { from: number; to: number };
    clientRect: any;
    sendCommand: (cmd: string, params?: Record<string, unknown>) => void;
    onClose: () => void;
}

export function DesktopTagCommandMenu({
    noteId,
    query,
    range,
    clientRect,
    sendCommand,
    onClose
}: DesktopTagCommandMenuProps) {
    const { tags, notes, addTagToNote, removeTagFromNote } = useNotesStore();
    const note = notes.find(n => n.id === noteId);

    const appliedTagIds = useMemo(() => {
        if (!note || !note.tags) return [];
        try {
            return JSON.parse(note.tags) as string[];
        } catch {
            return [];
        }
    }, [note]);

    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const scrollerRect = typeof document !== 'undefined'
        ? document.querySelector('.editor-scroller')?.getBoundingClientRect()
        : { top: 0, left: 0 };

    const normalizedQuery = query.toLowerCase().trim();

    const displayTags = useMemo(() => {
        if (!normalizedQuery) return tags;
        return tags.filter(t => t?.name && t.name.toLowerCase().includes(normalizedQuery));
    }, [tags, normalizedQuery]);

    const exactMatch = tags.find(t => t?.name && t.name.toLowerCase() === normalizedQuery);
    const showCreateOption = normalizedQuery.length > 0 && !exactMatch;

    const items = useMemo(() => {
        const result: Array<{ type: 'create' | 'tag', tag?: any, title: string, isApplied?: boolean }> = [];
        if (showCreateOption) {
            result.push({ type: 'create', title: `Create "${query}"` });
        }
        displayTags.forEach(t => {
            result.push({ type: 'tag', tag: t, title: t.name, isApplied: appliedTagIds.includes(t.id) });
        });
        return result;
    }, [showCreateOption, query, displayTags, appliedTagIds]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [items.length]);

    const handleSelect = async (item: typeof items[0]) => {
        sendCommand('deleteSelection', { from: range.from, to: range.to });

        if (item.type === 'create') {
            const newTag = {
                name: query.trim(),
            };
            await addTagToNote(noteId, newTag);
        } else if (item.type === 'tag' && item.tag) {
            if (item.isApplied) {
                await removeTagFromNote(noteId, item.tag.id);
            } else {
                await addTagToNote(noteId, item.tag);
            }
        }
        onClose();
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const minIndex = 0;
            const maxIndex = items.length - 1;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1 > maxIndex ? minIndex : prev + 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 < minIndex ? maxIndex : prev - 1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (items[selectedIndex]) {
                    handleSelect(items[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [items, selectedIndex, onClose, handleSelect]);

    if (!clientRect) return null;

    const top = clientRect.bottom + 8 - (scrollerRect?.top ?? 0);
    const left = clientRect.left - (scrollerRect?.left ?? 0);

    return (
        <div
            ref={containerRef}
            className="absolute z-100 overflow-hidden w-56 rounded-xl border bg-popover text-popover-foreground shadow-md outline-none"
            style={{ top, left }}
        >
            <ScrollArea className="h-full max-h-[300px] p-1">
                <div className="flex flex-col gap-1">
                    {items.length === 0 && (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                            No tags found
                        </div>
                    )}

                    {items.map((item, index) => {
                        const isSelected = index === selectedIndex;
                        const Icon = item.type === 'create' ? Plus : TagIcon;
                        return (
                            <button
                                key={item.type === 'create' ? 'create' : item.tag.id}
                                type="button"
                                className={cn(
                                    "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1 text-sm outline-none transition-colors",
                                    isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                                    item.isApplied && "opacity-60"
                                )}
                                onClick={() => handleSelect(item)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <Icon sx={{ fontSize: 16, mr: 1, flexShrink: 0, color: item.tag ? item.tag.color : undefined }} />
                                <span className={cn("flex-1 text-left line-clamp-1", item.isApplied && "line-through")}>
                                    {item.title}
                                </span>
                                {item.isApplied && (
                                    <Check sx={{ fontSize: 14 }} className="ml-auto opacity-50" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}
