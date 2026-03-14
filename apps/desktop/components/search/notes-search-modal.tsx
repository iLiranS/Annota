import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCreateNote } from "@/hooks/use-create-note";
import { useCreateTask } from "@/hooks/use-create-task";
import { cn } from "@/lib/utils";
import { Folder, NoteMetadata, Task, useNotesStore, useSearchStore } from "@annota/core";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderListItem } from "../notes/folder-list-item";
import { NoteListItem } from "../notes/note-list-item";
import { NotePreviewModal } from "../notes/note-preview-modal";
import { Button } from "../ui/button";
import { Ionicons } from "../ui/ionicons";

interface NotesSearchModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function NotesSearchModal({ open, onOpenChange }: NotesSearchModalProps) {
    const { colors } = useAppTheme();
    const navigate = useNavigate();
    const { getFolderById } = useNotesStore();
    const {
        searchQuery,
        isSearching,
        dbResults,
        setSearchQuery,
        resetSearch
    } = useSearchStore();

    const { createAndNavigate: createNoteAndNavigate } = useCreateNote();
    const { createAndNavigate: createTaskAndNavigate } = useCreateTask();

    const [selectedIndex, setSelectedIndex] = useState(0);
    const [previewNote, setPreviewNote] = useState<NoteMetadata | null>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    const results = dbResults;

    // Reset search when opening
    useEffect(() => {
        if (open) {
            resetSearch();
            setSelectedIndex(0);
            itemRefs.current = [];
        }
    }, [open, resetSearch]);

    // Reset selection when search result changes
    useEffect(() => {
        setSelectedIndex(0);
        itemRefs.current = [];
    }, [results]);

    // Scroll selected item into view
    useEffect(() => {
        const item = itemRefs.current[selectedIndex];
        if (item) {
            item.scrollIntoView({
                block: "nearest",
                behavior: "auto"
            });
        }
    }, [selectedIndex]);

    const handleClose = () => onOpenChange(false);

    const onNoteClick = (note: NoteMetadata) => {
        const folderId = note.folderId || "root";
        navigate(`/notes/${folderId}/${note.id}`);
        handleClose();
    };

    const onFolderClick = (folder: Folder) => {
        navigate(`/notes?folderId=${folder.id}`);
        handleClose();
    };

    const onTaskClick = (task: Task) => {
        navigate(`/task/${task.id}`);
        handleClose();
    };

    const onActionClick = (actionType: 'create_note' | 'create_task', folderId?: string) => {
        if (actionType === 'create_note') {
            createNoteAndNavigate(folderId);
        } else if (actionType === 'create_task') {
            createTaskAndNavigate({ folderId });
        }
        handleClose();
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % (results.length || 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + (results.length || 1)) % (results.length || 1));
            } else if (e.key === "Enter" && results[selectedIndex]) {
                const item = results[selectedIndex];
                if (item.type === "note") onNoteClick(item.data);
                else if (item.type === "task") onTaskClick(item.data);
                else if (item.type === "folder") onFolderClick(item.data);
            } else if (e.key === " " && results[selectedIndex]?.type === "note") {
                e.preventDefault();
                setPreviewNote(results[selectedIndex].data as NoteMetadata);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, results, selectedIndex]);

    const FolderBadge = ({ folderId }: { folderId: string | null }) => {
        const folder = folderId ? getFolderById(folderId) : null;
        if (!folder && folderId !== null) return null;
        if (!folderId) return null;

        return (
            <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border shrink-0"
                style={{
                    backgroundColor: folder?.color ? `${folder.color}20` : `${colors.primary}15`,
                    color: folder?.color || colors.primary,
                    borderColor: folder?.color ? `${folder.color}40` : `${colors.primary}40`
                }}
            >
                <Ionicons name={folder?.icon ? (folder.icon as any) : "folder"} size={10} />
                <span className="truncate max-w-[80px]">{folder?.name || "Notes"}</span>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="max-w-2xl p-0 overflow-hidden flex flex-col h-[500px] max-h-[85vh] top-[10%] translate-y-0 gap-0 border-primary/20 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]"
            >
                {/* Header Section */}
                <div className="flex items-center gap-4 px-5 py-3 bg-background border-b shrink-0 relative z-20">
                    <Ionicons name={isSearching ? "sync" : "search"} size={20} className={cn("text-muted-foreground/30", isSearching && "animate-spin")} />
                    <Input
                        autoFocus
                        placeholder="Search in all folders..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value, null)}
                        className="flex-1  border-none bg-transparent shadow-none focus-visible:ring-0 text-lg h-auto px-2 placeholder:text-muted-foreground/30 font-semibold"
                    />
                </div>

                {/* Results Area */}
                <ScrollArea className="flex-1 min-h-0 bg-muted/40">
                    <div className="p-4 space-y-4">
                        {results.length > 0 && (
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <div className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] opacity-40 flex items-center gap-2">
                                        <Ionicons name="apps" size={10} />
                                        <span>Search Results</span>
                                    </div>
                                    <div className="grid gap-1">
                                        {results.map((result, i) => {
                                            const isSelected = selectedIndex === i;
                                            return (
                                                <div
                                                    key={result.id}
                                                    ref={el => { itemRefs.current[i] = el; }}
                                                    className="relative group/result"
                                                    onMouseEnter={() => setSelectedIndex(i)}
                                                >
                                                    {result.type === 'note' ? (
                                                        <NoteListItem
                                                            note={result.data}
                                                            onClick={() => onNoteClick(result.data)}
                                                            isActive={isSelected}
                                                            showTimestamp
                                                            suffix={(
                                                                <FolderBadge folderId={result.data.folderId} />
                                                            )}
                                                            className="border border-transparent"
                                                            style={isSelected ? {
                                                                backgroundColor: `${colors.primary}25`,
                                                                borderColor: `${colors.primary}40`,
                                                                boxShadow: `inset 0 0 20px -10px ${colors.primary}40`
                                                            } : undefined}
                                                        />
                                                    ) : result.type === 'task' ? (
                                                        <div
                                                            onClick={() => onTaskClick(result.data)}
                                                            className={cn(
                                                                "flex items-center gap-3 px-3 py-2 rounded-xl border border-transparent transition-all cursor-pointer",
                                                                isSelected ? "bg-background shadow-sm border-border/50" : "hover:bg-background/50"
                                                            )}
                                                            style={isSelected ? {
                                                                backgroundColor: `${colors.primary}25`,
                                                                borderColor: `${colors.primary}40`,
                                                                boxShadow: `inset 0 0 20px -10px ${colors.primary}40`
                                                            } : undefined}
                                                        >
                                                            <div className={cn(
                                                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                                                result.data.completed ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-primary"
                                                            )}>
                                                                <Ionicons name={result.data.completed ? "checkmark-circle" : "checkbox-outline"} size={18} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={cn("text-sm font-bold truncate", result.data.completed && "line-through opacity-50")}>
                                                                        {result.title}
                                                                    </span>
                                                                    <span className="text-[10px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">Task</span>
                                                                </div>
                                                                {result.subtitle && (
                                                                    <p className="text-[11px] text-muted-foreground truncate opacity-60 font-medium">
                                                                        {result.subtitle}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <FolderBadge folderId={result.data.folderId} />
                                                        </div>
                                                    ) : result.type === 'folder' ? (
                                                        <div className="flex items-center gap-2 group/folder-row">
                                                            <FolderListItem
                                                                folder={result.data}
                                                                onClick={() => onFolderClick(result.data)}
                                                                onEdit={() => { }}
                                                                isActive={isSelected}
                                                                className="flex-1 border border-transparent"
                                                                style={isSelected ? {
                                                                    backgroundColor: `${colors.primary}25`,
                                                                    borderColor: `${colors.primary}40`,
                                                                    boxShadow: `inset 0 0 20px -10px ${colors.primary}40`
                                                                } : undefined}
                                                            />
                                                            <div className="flex items-center gap-1 pr-2">
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 rounded-full hover:bg-primary/10 text-primary shrink-0"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onActionClick('create_note', result.id);
                                                                    }}
                                                                >
                                                                    <Ionicons name="document-text-outline" size={16} />
                                                                </Button>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 rounded-full hover:bg-primary/10 text-primary shrink-0"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onActionClick('create_task', result.id);
                                                                    }}
                                                                >
                                                                    <Ionicons name="checkbox-outline" size={16} />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {searchQuery && !isSearching && results.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="p-4 rounded-full bg-muted/40 mb-4 ring-1 ring-border/50">
                                    <Ionicons name="search-outline" size={32} className="text-muted-foreground/20" />
                                </div>
                                <p className="text-sm font-bold text-foreground opacity-80">No results found</p>
                                <p className="text-[11px] text-muted-foreground/40 mt-1 italic font-medium">
                                    " {searchQuery} "
                                </p>
                            </div>
                        )}

                        {!searchQuery && (
                            <div className="flex flex-col items-center justify-center py-24 text-center opacity-20 select-none">
                                <Ionicons name="sparkles-outline" size={42} className="mb-4 text-primary" />
                                <p className="text-[10px] font-black uppercase tracking-[0.25em] italic">Search your notes & folders</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="px-4 py-2 border-t bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground font-bold uppercase tracking-wider shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 group">
                            <span className="px-1 py-0.5 rounded border border-border bg-background shadow-xs text-foreground group-hover:border-primary/30">↵</span>
                            <span className="opacity-60">to select</span>
                        </div>
                        <div className="flex items-center gap-1.5 group">
                            <span className="px-1 py-0.5 rounded border border-border bg-background shadow-xs text-foreground group-hover:border-primary/30">↑↓</span>
                            <span className="opacity-60">to navigate</span>
                        </div>
                        <div className="flex items-center gap-1.5 group">
                            <span className="px-1 py-0.5 rounded border border-border bg-background shadow-xs text-foreground group-hover:border-primary/30">Space</span>
                            <span className="opacity-60">to preview</span>
                        </div>
                    </div>
                </div>

                {previewNote && (
                    <NotePreviewModal
                        open={!!previewNote}
                        onOpenChange={(open) => !open && setPreviewNote(null)}
                        note={previewNote}
                        onExpand={(note) => {
                            const folderId = note.folderId || "root";
                            navigate(`/notes/${folderId}/${note.id}`);
                            setPreviewNote(null);
                            onOpenChange(false);
                        }}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
