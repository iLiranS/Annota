import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@annota/core';
import { Check, Plus, Tag as TagIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

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
            const { error } = await addTagToNote(noteId, newTag);
            if (error) {
                toast.error(error);
                return;
            }
        } else if (item.type === 'tag' && item.tag) {
            if (item.isApplied) {
                await removeTagFromNote(noteId, item.tag.id);
            } else {
                const { error } = await addTagToNote(noteId, item.tag);
                if (error) {
                    toast.error(error);
                    return;
                }
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
                className="z-50 overflow-hidden w-56 p-0 border rounded-xl shadow-md"
            >
                <div ref={containerRef} className="flex flex-col bg-popover text-popover-foreground">
                    <div className="h-full max-h-[300px] p-1 overflow-y-auto premium-scrollbar">
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
                                        <Icon className="w-5 h-5 mr-2 shrink-0" style={{ color: item.tag?.color }} />
                                        <span className={cn("flex-1 text-left line-clamp-1", item.isApplied && "line-through")}>
                                            {item.title}
                                        </span>
                                        {item.isApplied && (
                                            <Check className="w-3.5 h-3.5 ml-auto opacity-50" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
