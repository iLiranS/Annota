import { cn } from "@/lib/utils";
import { calculateNoteStats, useNotesStore } from "@annota/core";
import { format } from "date-fns";
import { BarChart3, Calendar, ChevronDown, ChevronRight, Clock, FileText, HardDrive, Hash, ListTree, Network } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NoteConnectionsGraph } from "../notes/note-connections-graph";

interface TocItem {
    id: string;
    text: string;
    level: number;
}

export function NoteInfo({ noteId }: { noteId: string }) {
    const note = useNotesStore(s => s.notes.find(n => n.id === noteId));
    const getNoteContent = useNotesStore(s => s.getNoteContent);
    const getForwardLinks = useNotesStore(s => s.getForwardLinks);
    const getBacklinks = useNotesStore(s => s.getBacklinks);

    const [content, setContent] = useState<string>("");
    const [forwardLinks, setForwardLinks] = useState<any[]>([]);
    const [backlinks, setBacklinks] = useState<any[]>([]);
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
    const [tocExpanded, setTocExpanded] = useState<boolean>(true);
    const [connectionsExpanded, setConnectionsExpanded] = useState<boolean>(true);
    const [statsExpanded, setStatsExpanded] = useState<boolean>(true);
    const updateTimeoutRef = useRef<any>(null);
    const lastFetchedContentRef = useRef<string>("");

    useEffect(() => {
        let cancelled = false;
        if (noteId) {
            setContent("");
            setForwardLinks([]);
            setBacklinks([]);
            getNoteContent(noteId).then(c => {
                if (!cancelled) {
                    const newContent = c || "";
                    setContent(newContent);
                    lastFetchedContentRef.current = newContent;
                }
            });
            getForwardLinks(noteId).then(links => { if (!cancelled) setForwardLinks(links); });
            getBacklinks(noteId).then(links => { if (!cancelled) setBacklinks(links); });
        }
        return () => { cancelled = true; };
    }, [noteId, getNoteContent, getForwardLinks, getBacklinks]);



    // Re-fetch content/links when note is updated (e.g. after debounced content save)
    const noteUpdatedAt = note?.updatedAt;
    useEffect(() => {
        if (!noteId || !noteUpdatedAt) return;
        // Debounce re-fetch to avoid thrashing during rapid saves
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = setTimeout(() => {
            getNoteContent(noteId).then(c => {
                const newContent = c || "";
                if (newContent !== lastFetchedContentRef.current) {
                    setContent(newContent);
                    lastFetchedContentRef.current = newContent;
                    getForwardLinks(noteId).then(setForwardLinks);
                    getBacklinks(noteId).then(setBacklinks);
                }
            });
        }, 1000); // 1s debounce for stats calculation on desktop
        return () => {
            if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        };
    }, [noteId, noteUpdatedAt, getNoteContent, getForwardLinks, getBacklinks]);

    const stats = useMemo(() => {
        return calculateNoteStats(content);
    }, [content]);

    const hasForward = forwardLinks.length > 0;
    const hasBack = backlinks.length > 0;

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        return `${(bytes / 1024).toFixed(1)} KB`;
    };

    const toc = useMemo(() => {
        if (!content) return [];
        const items: TocItem[] = [];
        const headerRegex = /<h([1-6])(?:\s+[^>]*)?data-id="([^"]+)"[^>]*>(.*?)<\/h\1>/gi;
        let match;
        while ((match = headerRegex.exec(content)) !== null) {
            const level = parseInt(match[1]);
            const id = match[2];
            const text = match[3].replace(/<[^>]*>/g, '').trim();
            if (text) {
                items.push({ id, text, level });
            }
        }
        return items;
    }, [content]);

    const toggleCollapse = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCollapsedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const isVisible = (index: number) => {
        let currentLevel = toc[index].level;
        for (let i = index - 1; i >= 0; i--) {
            const prevItem = toc[i];
            if (prevItem.level < currentLevel) {
                if (collapsedIds.has(prevItem.id)) {
                    return false;
                }
                currentLevel = prevItem.level;
            }
        }
        return true;
    };

    const hasChildren = (index: number) => {
        const currentLevel = toc[index].level;
        return index + 1 < toc.length && toc[index + 1].level > currentLevel;
    };

    const scrollToHeader = (id: string) => {
        if (!id) return;
        window.dispatchEvent(new CustomEvent('annota-scroll-to-element', {
            detail: { elementId: id }
        }));
    };

    if (!note) return null;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div data-tauri-drag-region className="flex-1 overflow-y-auto pr-2 premium-scrollbar space-y-6 pb-4">
                {/* Section 1: Stats & Metadata */}
                <div className="space-y-2">
                    <button
                        onClick={() => setStatsExpanded(!statsExpanded)}
                        className="w-full flex items-center justify-between py-1.5 px-1 hover:bg-muted/10 rounded-lg transition-colors group text-left"
                    >
                        <div className="flex items-center gap-1.5">
                            <BarChart3 size={12} className="opacity-70 text-accent-full" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                Stats & Metadata
                            </span>
                        </div>
                        {statsExpanded ? (
                            <ChevronDown size={12} className="text-muted-foreground/40 group-hover:text-muted-foreground/75" />
                        ) : (
                            <ChevronRight size={12} className="text-muted-foreground/40 group-hover:text-muted-foreground/75" />
                        )}
                    </button>

                    {statsExpanded && (
                        <div className="space-y-3 px-1">
                            {/* Words */}
                            <div className="flex items-center justify-between text-xs text-muted-foreground/80 px-1">
                                <div className="flex items-center gap-2.5">
                                    <FileText size={14} className="text-accent-full/60" />
                                    <span className="font-medium text-muted-foreground/60 uppercase text-[9px] tracking-wider">Words</span>
                                </div>
                                <span className="font-semibold text-muted-foreground/70 tabular-nums">{stats.words}</span>
                            </div>

                            {/* Characters */}
                            <div className="flex items-center justify-between text-xs text-muted-foreground/80 px-1">
                                <div className="flex items-center gap-2.5">
                                    <Hash size={14} className="text-accent-full/60" />
                                    <span className="font-medium text-muted-foreground/60 uppercase text-[9px] tracking-wider">Characters</span>
                                </div>
                                <span className="font-semibold text-muted-foreground/70 tabular-nums">{stats.chars}</span>
                            </div>

                            {/* Size */}
                            <div className="flex items-center justify-between text-xs text-muted-foreground/80 px-1">
                                <div className="flex items-center gap-2.5">
                                    <HardDrive size={14} className="text-accent-full/60" />
                                    <span className="font-medium text-muted-foreground/60 uppercase text-[9px] tracking-wider">Size</span>
                                </div>
                                <span className="font-semibold text-muted-foreground/70 tabular-nums whitespace-nowrap">{formatSize(stats.size)}</span>
                            </div>

                            {/* Created */}
                            <div className="flex items-center justify-between text-xs text-muted-foreground/80 px-1">
                                <div className="flex items-center gap-2.5">
                                    <Calendar size={14} className="text-accent-full/60" />
                                    <span className="font-medium text-muted-foreground/60 uppercase text-[9px] tracking-wider">Created</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground/40 tabular-nums font-medium text-[10px]">
                                        {format(new Date(note.createdAt), "HH:mm")}
                                    </span>
                                    <span className="font-semibold text-muted-foreground/70">
                                        {format(new Date(note.createdAt), "MMM d, yyyy")}
                                    </span>
                                </div>
                            </div>

                            {/* Updated */}
                            <div className="flex items-center justify-between text-xs text-muted-foreground/80 px-1">
                                <div className="flex items-center gap-2.5">
                                    <Clock size={14} className="text-accent-full/60" />
                                    <span className="font-medium text-muted-foreground/60 uppercase text-[9px] tracking-wider">Updated</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground/40 tabular-nums font-medium text-[10px]">
                                        {format(new Date(note.updatedAt), "HH:mm")}
                                    </span>
                                    <span className="font-semibold text-muted-foreground/70">
                                        {format(new Date(note.updatedAt), "MMM d, yyyy")}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Section 2: Connections Map */}
                {(hasForward || hasBack) && (
                    <div className="space-y-2">
                        <button
                            onClick={() => setConnectionsExpanded(!connectionsExpanded)}
                            className="w-full flex items-center justify-between py-1.5 px-1 hover:bg-muted/10 rounded-lg transition-colors group text-left"
                        >
                            <div className="flex items-center gap-1.5">
                                <Network size={12} className="opacity-70 text-accent-full" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                    Connections Map
                                </span>
                            </div>
                            {connectionsExpanded ? (
                                <ChevronDown size={12} className="text-muted-foreground/40 group-hover:text-muted-foreground/75" />
                            ) : (
                                <ChevronRight size={12} className="text-muted-foreground/40 group-hover:text-muted-foreground/75" />
                            )}
                        </button>

                        {connectionsExpanded && (
                            <div className="px-1">
                                <NoteConnectionsGraph
                                    noteId={noteId}
                                    backlinks={backlinks}
                                    forwardLinks={forwardLinks}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Section 3: Table of Contents */}
                <div className="space-y-2">
                    <button
                        onClick={() => setTocExpanded(!tocExpanded)}
                        className="w-full flex items-center justify-between py-1.5 px-1 hover:bg-muted/10 rounded-lg transition-colors group text-left"
                    >
                        <div className="flex items-center gap-1.5">
                            <ListTree size={12} className="opacity-70 text-accent-full" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                Table of Contents
                            </span>
                        </div>
                        {tocExpanded ? (
                            <ChevronDown size={12} className="text-muted-foreground/40 group-hover:text-muted-foreground/75" />
                        ) : (
                            <ChevronRight size={12} className="text-muted-foreground/40 group-hover:text-muted-foreground/75" />
                        )}
                    </button>

                    {tocExpanded && (
                        toc.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/20 rounded-xl border border-dashed border-border/40">
                                <p className="text-[11px] text-muted-foreground/40 italic">
                                    No headers found in this note
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-0.5 pr-2">
                                {toc.map((item, idx) => {
                                    if (!isVisible(idx)) return null;
                                    const itemHasChildren = hasChildren(idx);
                                    const isCollapsed = collapsedIds.has(item.id);

                                    return (
                                        <div
                                            key={`${item.id}-${idx}`}
                                            className={cn(
                                                "group flex items-center gap-2 rounded-lg transition-all hover:bg-primary/5 pr-1 min-w-0",
                                                item.level === 2 && "pl-3",
                                                item.level === 3 && "pl-6",
                                                item.level >= 4 && "pl-8"
                                            )}
                                        >
                                            <button
                                                onClick={() => scrollToHeader(item.id)}
                                                title={item.text}
                                                className={cn(
                                                    "flex-1 py-1.5 text-left truncate transition-colors min-w-0",
                                                    "text-muted-foreground hover:text-primary",
                                                    item.level === 1 && "text-[13px] font-bold text-foreground/90",
                                                    item.level === 2 && "text-xs font-semibold text-foreground/80",
                                                    item.level === 3 && "text-[11px] font-medium text-foreground/70",
                                                    item.level >= 4 && "text-[11px] text-muted-foreground/80",
                                                )}
                                            >
                                                {item.text}
                                            </button>

                                            <button
                                                onClick={(e) => toggleCollapse(item.id, e)}
                                                className={cn(
                                                    "p-1 rounded-md hover:bg-primary/10 text-accent  transition-all shrink-0",
                                                    !itemHasChildren && "opacity-0 pointer-events-none"
                                                )}
                                            >
                                                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
