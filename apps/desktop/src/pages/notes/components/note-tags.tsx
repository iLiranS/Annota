import { useNotesStore, useSettingsStore, type Tag } from '@annota/core';
import { Badge } from '@/components/ui/badge';
import { X, Tag as TagIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NoteTags({ noteId, className }: { noteId: string, className?: string }) {
    const { tags, notes, removeTagFromNote } = useNotesStore();
    const { editor: { direction } } = useSettingsStore();
    const note = notes.find(n => n.id === noteId);

    if (!note || !note.tags) return null;

    let appliedTagIds: string[] = [];
    try {
        appliedTagIds = JSON.parse(note.tags);
    } catch {
        return null;
    }

    if (appliedTagIds.length === 0) return null;

    const appliedTags = appliedTagIds.map(id => tags.find(t => t.id === id)).filter(Boolean) as Tag[];

    return (
        <div className={cn(
            className ? className : cn(
                "absolute top-4 z-40 flex flex-wrap gap-1.5 px-4 max-w-[70%]",
                direction === "rtl" ? "right-2" : "left-2"
            )
        )}>
            {appliedTags.map(tag => (
                <Badge
                    key={tag.id}
                    variant="outline"
                    className="flex items-center gap-1.5 px-2 py-0.5 bg-opacity-10 dark:bg-opacity-10 backdrop-blur-md border-opacity-50 transition-all hover:bg-opacity-20 cursor-default text-xs font-semibold rounded-md shadow-sm"
                    style={{ 
                        backgroundColor: `${tag.color}1A`, 
                        color: tag.color, 
                        borderColor: `${tag.color}40` 
                    }}
                >
                    <TagIcon className="w-3 h-3 opacity-70" />
                    <span>{tag.name}</span>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            removeTagFromNote(noteId, tag.id);
                        }}
                        className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 ml-0.5 transition-colors cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </Badge>
            ))}
        </div>
    );
}
