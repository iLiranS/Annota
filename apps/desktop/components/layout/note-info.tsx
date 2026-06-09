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

    // For each item, compute the tree prefix string (e.g. "│   ├── ")
    // by walking ancestors and checking if each is the last of its siblings.
    const tocPrefixes = useMemo(() => {
        return toc.map((item, idx) => {
            if (item.level === 1) return "";

            // For each ancestor level, is that ancestor the last of its siblings?
            const isLastAtLevel: Record<number, boolean> = {};
            for (let lvl = 1; lvl < item.level; lvl++) {
                let ancestorIdx = -1;
                for (let i = idx - 1; i >= 0; i--) {
                    if (toc[i].level === lvl) { ancestorIdx = i; break; }
                }
                if (ancestorIdx === -1) continue;
                let isLast = true;
                for (let i = ancestorIdx + 1; i < toc.length; i++) {
                    if (toc[i].level < lvl) break;
                    if (toc[i].level === lvl) { isLast = false; break; }
                }
                isLastAtLevel[lvl] = isLast;
            }

            // Is this item the last among its siblings?
            let selfIsLast = true;
            for (let i = idx + 1; i < toc.length; i++) {
                if (toc[i].level < item.level) break;
                if (toc[i].level === item.level) { selfIsLast = false; break; }
            }

            // Build prefix: ancestor columns, then the connector for this item
            let prefix = "";
            for (let lvl = 1; lvl <= item.level - 2; lvl++) {
                prefix += isLastAtLevel[lvl] ? "    " : "│   ";
            }
            prefix += selfIsLast ? "└── " : "├── ";
            return prefix;
        });
    }, [toc]);

    const scrollToHeader = (id: string) => {
        if (!id) return;
        window.dispatchEvent(new CustomEvent('annota-scroll-to-element', {
            detail: { elementId: id }
        }));
    };

    if (!note) return null;

    return (
        <div className="flex flex-col h-full justify-between overflow-hidden ">
            <div data-tauri-drag-region className="flex-1 overflow-y-auto pr-2 premium-scrollbar space-y-2 pb-4">
                {/* Section 3: Table of Contents */}
                <div className="space-y-2 ">
                    <button
                        onClick={() => setTocExpanded(!tocExpanded)}
                        className="w-full flex items-center justify-between py-1.5 px-1 hover:bg-primary/5 rounded-lg transition-colors group text-left"
                    >
                        <div className="flex items-center gap-1.5">
                            <ListTree size={15} className="text-accent-full" />
                            <span className="text-xs font-bold uppercase tracking-wider">
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
                            <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/20 rounded-lg border border-dashed border-border/40">
                                <p className="text-[11px] text-muted-foreground/40 italic">
                                    No headers found in this note
                                </p>
                            </div>
                        ) : (
                            <div className="font-mono">
                                {toc.map((item, idx) => {
                                    const prefix = tocPrefixes[idx];
                                    return (
                                        <button
                                            key={`${item.id}-${idx}`}
                                            onClick={() => scrollToHeader(item.id)}
                                            title={item.text}
                                            className="w-full text-left flex items-baseline py-0.5 px-1 rounded-lg hover:bg-primary/5 transition-colors group min-w-0"
                                        >
                                            {prefix && (
                                                <span className="shrink-0 text-[11px] text-muted-foreground/25 select-none whitespace-pre">
                                                    {prefix}
                                                </span>
                                            )}
                                            <span className={cn(
                                                "truncate transition-colors group-hover:text-primary min-w-0",
                                                item.level === 1 && "text-[13px] font-semibold text-muted-foreground",
                                                item.level === 2 && "text-xs text-muted-foreground/90",
                                                item.level === 3 && "text-[11px] text-muted-foreground/80",
                                                item.level >= 4 && "text-[11px] text-muted-foreground/70",
                                            )}>
                                                {item.text}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>

                {/* Section 2: Connections Map */}
                {(hasForward || hasBack) && (
                    <div className="space-y-2">
                        <button
                            onClick={() => setConnectionsExpanded(!connectionsExpanded)}
                            className="w-full flex items-center justify-between py-1.5 px-1 hover:bg-primary/5 rounded-lg transition-colors group text-left"
                        >
                            <div className="flex items-center gap-1.5">
                                <Network size={15} className=" text-accent-full" />
                                <span className="text-xs font-bold uppercase tracking-wider ">
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


            </div>
            {/* Section Stats & Metadata */}
            <div className="space-y-2">
                <button
                    onClick={() => setStatsExpanded(!statsExpanded)}
                    className="w-full flex items-center justify-between py-1.5 px-1 hover:bg-primary/5 rounded-lg transition-colors group text-left"
                >
                    <div className="flex items-center gap-1.5">
                        <BarChart3 size={15} className="text-accent-full" />
                        <span className="text-xs font-bold uppercase tracking-wider ">
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
                                <FileText size={14} className="text-muted-foreground/50" />
                                <span className="font-medium text-muted-foreground/60 uppercase text-[9px] tracking-wider">Words</span>
                            </div>
                            <span className="font-semibold text-muted-foreground/70 tabular-nums">{stats.words}</span>
                        </div>

                        {/* Characters */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground/80 px-1">
                            <div className="flex items-center gap-2.5">
                                <Hash size={14} className="text-muted-foreground/50" />
                                <span className="font-medium text-muted-foreground/60 uppercase text-[9px] tracking-wider">Characters</span>
                            </div>
                            <span className="font-semibold text-muted-foreground/70 tabular-nums">{stats.chars}</span>
                        </div>

                        {/* Size */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground/80 px-1">
                            <div className="flex items-center gap-2.5">
                                <HardDrive size={14} className="text-muted-foreground/50" />
                                <span className="font-medium text-muted-foreground/60 uppercase text-[9px] tracking-wider">Size</span>
                            </div>
                            <span className="font-semibold text-muted-foreground/70 tabular-nums whitespace-nowrap">{formatSize(stats.size)}</span>
                        </div>

                        {/* Created */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground/80 px-1">
                            <div className="flex items-center gap-2.5">
                                <Calendar size={14} className="text-muted-foreground/50" />
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
                                <Clock size={14} className="text-muted-foreground/50" />
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
        </div>
    );
}