import { useNotesStore } from "@annota/core";
import { useMemo } from "react";

interface NoteConnectionsGraphProps {
    noteId: string;
    backlinks: any[];
    forwardLinks: any[];
}

export function NoteConnectionsGraph({ noteId, backlinks, forwardLinks }: NoteConnectionsGraphProps) {
    const note = useNotesStore(s => s.notes.find(n => n.id === noteId));
    const folders = useNotesStore(s => s.folders);

    // Capped at 10 nodes per direction for a clean, compact view
    const displayBacklinks = useMemo(() => backlinks.slice(0, 10), [backlinks]);
    const displayForwardLinks = useMemo(() => forwardLinks.slice(0, 10), [forwardLinks]);

    // Resolve color based on parent folder
    const getNoteFolderColor = (targetNoteId: string, isCurrent: boolean = false) => {
        const targetNote = isCurrent ? note : useNotesStore.getState().notes.find(n => n.id === targetNoteId);
        if (!targetNote || !targetNote.folderId) return "#71717a"; // Zinc default
        const folder = folders.find(f => f.id === targetNote.folderId);
        return folder?.color || "#71717a";
    };

    if (!note) return null;

    return (
        <div className="relative flex items-stretch justify-between w-full min-h-[90px] py-1 select-none overflow-hidden">
            {/* Left Column: Backlinks */}
            <div className="w-1/2 flex flex-col justify-center gap-2.5 min-w-0">
                {displayBacklinks.length > 0 ? (
                    displayBacklinks.map(link => {
                        const folderColor = getNoteFolderColor(link.id);
                        return (
                            <div key={link.id} className="flex items-center justify-end min-w-0 group relative pr-[10px]">
                                <a
                                    href={link.blockId ? `annota://note/${link.id}?blockId=${link.blockId}` : `annota://note/${link.id}`}
                                    className="inline-flex items-center text-[10px] font-semibold border rounded-full px-2.5 py-0.5 truncate transition-all duration-200 hover:brightness-110 active:scale-95 shrink-0 max-w-[120px]"
                                    style={{
                                        borderColor: `${folderColor}40`,
                                        backgroundColor: `${folderColor}10`,
                                        color: folderColor
                                    }}
                                    title={link.title || 'Untitled Note'}
                                >
                                    <span className="truncate">{link.title || 'Untitled Note'}</span>
                                </a>
                                {/* Horizontal Connection Line - extending exactly to column right boundary */}
                                <div
                                    className="absolute right-0 top-1/2 -translate-y-1/2 h-px transition-colors duration-200 group-hover:bg-primary/40"
                                    style={{ width: "10px", backgroundColor: `${folderColor}30` }}
                                />
                                {/* Connection Junction Dot - mathematically centered on the center axis spine line */}
                                <div
                                    className="absolute -right-[4px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-10 border border-background transition-transform duration-200 group-hover:scale-125"
                                    style={{ backgroundColor: folderColor }}
                                />
                            </div>
                        );
                    })
                ) : (
                    <div className="flex items-center justify-end min-w-0 opacity-40 relative pr-[10px] group">
                        <span className="text-[9px] text-muted-foreground/30 italic border border-dashed border-border/30 rounded-full px-2 py-0.5">
                            No backlinks
                        </span>
                        <div
                            className="absolute right-0 top-1/2 -translate-y-1/2 h-px"
                            style={{ width: "10px", backgroundColor: "var(--border)" }}
                        />
                        <div
                            className="absolute -right-[3px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border border-background z-10"
                            style={{ backgroundColor: "var(--border)" }}
                        />
                    </div>
                )}
            </div>

            {/* Center Spine Column */}
            <div className="w-0 relative flex justify-center shrink-0">
                {/* Vertical Center Spine Line (Axis boundary) */}
                <div className="absolute top-0 bottom-0 w-[1.5px] bg-border/40" />
            </div>

            {/* Right Column: Forward Links */}
            <div className="w-1/2 flex flex-col justify-center gap-2.5  min-w-0">
                {displayForwardLinks.length > 0 ? (
                    displayForwardLinks.map(link => {
                        const folderColor = getNoteFolderColor(link.id);
                        return (
                            <div key={link.id} className="flex items-center justify-start min-w-0 group relative pl-[10px]">
                                {/* Connection Junction Dot - mathematically centered on the center axis spine line */}
                                <div
                                    className="absolute -left-[4px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-10 border border-background transition-transform duration-200 group-hover:scale-125"
                                    style={{ backgroundColor: folderColor }}
                                />
                                {/* Horizontal Connection Line - extending exactly to column left boundary */}
                                <div
                                    className="absolute left-0 top-1/2 -translate-y-1/2 h-px transition-colors duration-200 group-hover:bg-primary/40"
                                    style={{ width: "10px", backgroundColor: `${folderColor}30` }}
                                />
                                <a
                                    href={link.blockId ? `annota://note/${link.id}?blockId=${link.blockId}` : `annota://note/${link.id}`}
                                    className="inline-flex items-center text-[10px] font-semibold border rounded-full px-2.5 py-0.5 truncate transition-all duration-200 hover:brightness-110 active:scale-95 shrink-0 max-w-[120px]"
                                    style={{
                                        borderColor: `${folderColor}40`,
                                        backgroundColor: `${folderColor}10`,
                                        color: folderColor
                                    }}
                                    title={link.title || 'Untitled Note'}
                                >
                                    <span className="truncate">{link.title || 'Untitled Note'}</span>
                                </a>
                            </div>
                        );
                    })
                ) : (
                    <div className="flex items-center justify-start min-w-0 opacity-40 relative pl-[10px] group">
                        <div
                            className="absolute -left-[3px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border border-background z-10"
                            style={{ backgroundColor: "var(--border)" }}
                        />
                        <div
                            className="absolute left-0 top-1/2 -translate-y-1/2 h-px"
                            style={{ width: "10px", backgroundColor: "var(--border)" }}
                        />
                        <span className="text-[9px] text-muted-foreground/30 italic border border-dashed border-border/30 rounded-full px-2 py-0.5">
                            No links
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
