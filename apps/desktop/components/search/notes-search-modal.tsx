import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppTheme } from "@/hooks/use-app-theme";
import { cn } from "@/lib/utils";
import { Folder, NoteMetadata, useNotesStore } from "@annota/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FolderListItem } from "../notes/folder-list-item";
import { NoteListItem } from "../notes/note-list-item";
import { Ionicons } from "../ui/ionicons";

interface NotesSearchModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function NotesSearchModal({ open, onOpenChange }: NotesSearchModalProps) {
    const { colors } = useAppTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { folders, notes, getFolderById } = useNotesStore();

    const [searchQuery, setSearchQuery] = useState("");
    const [searchScope, setSearchScope] = useState<"current" | "all">("all");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Current folder detection
    const folderIdFromParam = searchParams.get("folderId");
    const folderIdFromPath = useMemo(() => {
        const parts = location.pathname.split("/");
        if (parts[1] === "notes" && parts[2] && parts[2] !== "trash") {
            return parts[2];
        }
        return null;
    }, [location.pathname]);

    const currentFolderId = folderIdFromParam || folderIdFromPath;
    const isFolderContext = !!currentFolderId;

    const currentFolder = useMemo(() => {
        return folders.find(f => f.id === currentFolderId);
    }, [folders, currentFolderId]);

    const filteredFolders = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        let source = folders.filter(f => !f.isDeleted && !f.isSystem);

        if (searchScope === "current" && currentFolderId) {
            source = source.filter(f => f.parentId === currentFolderId);
        }

        return source.filter(f => f.name.toLowerCase().includes(query));
    }, [folders, searchQuery, searchScope, currentFolderId]);

    const filteredNotes = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        let source = notes.filter(n => !n.isDeleted);

        if (searchScope === "current" && currentFolderId) {
            source = source.filter(n => n.folderId === currentFolderId);
        }

        return source.filter(n =>
            n.title.toLowerCase().includes(query) ||
            n.preview?.toLowerCase().includes(query)
        );
    }, [notes, searchQuery, searchScope, currentFolderId]);

    const results = useMemo(() => [
        ...filteredNotes.map(n => ({ type: "note" as const, data: n })),
        ...filteredFolders.map(f => ({ type: "folder" as const, data: f }))
    ], [filteredNotes, filteredFolders]);

    // Reset search when opening
    useEffect(() => {
        if (open) {
            setSearchQuery("");
            setSearchScope("all");
            setSelectedIndex(0);
            itemRefs.current = [];
        }
    }, [open]);

    // Reset selection when search changes
    useEffect(() => {
        setSelectedIndex(0);
        itemRefs.current = [];
    }, [searchQuery, searchScope]);

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
                else onFolderClick(item.data);
            } else if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                if (isFolderContext) {
                    setSearchScope(prev => prev === "all" ? "current" : "all");
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, results, selectedIndex, isFolderContext]);

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
                    <Ionicons name="search" size={20} className="text-muted-foreground/30" />
                    <Input
                        autoFocus
                        placeholder={"Search in " + (searchScope === "current" && currentFolder ? currentFolder.name : "all folders") + "..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1  border-none bg-transparent shadow-none focus-visible:ring-0 text-lg h-auto px-2 placeholder:text-muted-foreground/30 font-semibold"
                    />
                    {isFolderContext && (
                        <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50 shadow-sm shrink-0 items-center">
                            <button
                                onClick={() => setSearchScope("current")}
                                className={cn(
                                    "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2",
                                    searchScope === "current"
                                        ? "bg-background shadow-md text-foreground ring-1 ring-border/20 scale-[1.02]"
                                        : "text-muted-foreground/40 hover:text-foreground/70 hover:bg-muted/20"
                                )}
                            >
                                <Ionicons
                                    name={currentFolder?.icon || "folder"}
                                    size={12}
                                    style={{ color: searchScope === "current" ? (currentFolder?.color || colors.primary) : undefined }}
                                />
                                <span className="max-w-[100px] truncate">{currentFolder?.name || "Folder"}</span>
                            </button>
                            <button
                                onClick={() => setSearchScope("all")}
                                className={cn(
                                    "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2 ml-1",
                                    searchScope === "all"
                                        ? "bg-background shadow-md text-foreground ring-1 ring-border/20 scale-[1.02]"
                                        : "text-muted-foreground/40 hover:text-foreground/70 hover:bg-muted/20"
                                )}
                            >
                                <Ionicons
                                    name="copy"
                                    size={12}
                                    style={{ color: searchScope === "all" ? colors.primary : undefined }}
                                />
                                All
                            </button>
                        </div>
                    )}
                </div>

                {/* Results Area */}
                <ScrollArea className="flex-1 min-h-0 bg-muted/40">
                    <div className="p-4 space-y-4">
                        {results.length > 0 && (
                            <div className="space-y-4">
                                {filteredNotes.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] opacity-40 flex items-center gap-2">
                                            <Ionicons name="document-text" size={10} />
                                            <span>Notes</span>
                                        </div>
                                        <div className="grid gap-1">
                                            {filteredNotes.map((note, i) => {
                                                const isSelected = selectedIndex === i;
                                                return (
                                                    <div
                                                        key={note.id}
                                                        ref={el => { itemRefs.current[i] = el; }}
                                                        className="relative group/result"
                                                        onMouseEnter={() => setSelectedIndex(i)}
                                                    >
                                                        <NoteListItem
                                                            note={note}
                                                            onClick={() => onNoteClick(note)}
                                                            isActive={isSelected}
                                                            showTimestamp
                                                            suffix={(searchScope === "all" || !isFolderContext) && (
                                                                <FolderBadge folderId={note.folderId} />
                                                            )}
                                                            className="border border-transparent"
                                                            style={isSelected ? {
                                                                backgroundColor: `${colors.primary}25`,
                                                                borderColor: `${colors.primary}40`,
                                                                boxShadow: `inset 0 0 20px -10px ${colors.primary}40`
                                                            } : undefined}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {filteredFolders.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] opacity-40 flex items-center gap-2">
                                            <Ionicons name="folder" size={10} />
                                            <span>Folders</span>
                                        </div>
                                        <div className="grid gap-1">
                                            {filteredFolders.map((folder, i) => {
                                                const globalIndex = filteredNotes.length + i;
                                                const isSelected = selectedIndex === globalIndex;
                                                return (
                                                    <div
                                                        key={folder.id}
                                                        ref={el => { itemRefs.current[globalIndex] = el; }}
                                                        className="relative group/result"
                                                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                                                    >
                                                        <FolderListItem
                                                            folder={folder}
                                                            onClick={() => onFolderClick(folder)}
                                                            onEdit={() => { }}
                                                            isActive={isSelected}
                                                            className="border border-transparent"
                                                            style={isSelected ? {
                                                                backgroundColor: `${colors.primary}25`,
                                                                borderColor: `${colors.primary}40`,
                                                                boxShadow: `inset 0 0 20px -10px ${colors.primary}40`
                                                            } : undefined}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {searchQuery && filteredNotes.length === 0 && filteredFolders.length === 0 && (
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
                    </div>
                    {isFolderContext && (
                        <div className="flex items-center gap-1.5 group">
                            <span className="px-1 py-0.5 rounded border border-border bg-background shadow-xs text-foreground group-hover:border-primary/30">⌘ K</span>
                            <span className="opacity-60">to toggle scope</span>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
