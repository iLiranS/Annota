import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CheckCircle2, FileText, Folder, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Ionicons } from "../ui/ionicons";

interface ContextSelectorProps {
    notes: any[];
    folders: any[];
    selectedNotes: any[];
    onToggleNote: (note: any) => void;
    onToggleFolder: (folderId: string) => void;
    onClearAll: () => void;
}

export function ContextSelector({
    notes,
    folders,
    selectedNotes,
    onToggleNote,
    onToggleFolder,
    onClearAll
}: ContextSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");

    const filteredNotes = useMemo(() => {
        if (!search.trim()) return notes.slice(0, 10);
        return notes.filter(n =>
            n.title.toLowerCase().includes(search.toLowerCase()) ||
            n.preview.toLowerCase().includes(search.toLowerCase())
        ).slice(0, 20);
    }, [notes, search]);

    const filteredFolders = useMemo(() => {
        if (!search.trim()) return folders.slice(0, 5);
        return folders.filter(f =>
            f.name.toLowerCase().includes(search.toLowerCase())
        ).slice(0, 10);
    }, [folders, search]);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-7 w-7 p-0 rounded-full flex items-center justify-center transition-all border border-border/40 bg-muted/20 hover:bg-primary/10 hover:border-primary/20",
                        selectedNotes.length > 0 && "bg-primary/10 border-primary/30 text-primary"
                    )}
                    title="Select notes or folders"
                >
                    <Plus size={14} className={cn(selectedNotes.length > 0 && "rotate-45")} />
                </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-[280px] p-0 rounded-2xl border-border/40 shadow-2xl bg-popover/95 backdrop-blur-md overflow-hidden">
                <div className="p-3 border-b border-border/30 bg-muted/20">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
                        <Input
                            placeholder="Search notes or folders..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-8 pl-8 pr-2 text-xs rounded-lg border-border/40 bg-background/50 focus-visible:ring-primary/20"
                            autoFocus
                        />
                    </div>
                </div>

                <ScrollArea className="h-[300px]">
                    <div className="p-2 space-y-4">
                        {selectedNotes.length > 0 && (
                            <div className="px-2 pt-1 flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">
                                    {selectedNotes.length} Selected
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1.5 text-[9px] hover:bg-destructive/10 text-destructive rounded-md"
                                    onClick={onClearAll}
                                >
                                    Clear all
                                </Button>
                            </div>
                        )}

                        {filteredFolders.length > 0 && (
                            <div className="space-y-1">
                                <h4 className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 flex items-center gap-1.5">
                                    <Folder size={10} /> Folders
                                </h4>
                                {filteredFolders.map(folder => {
                                    const folderNotes = notes.filter(n => n.folderId === folder.id);
                                    const allSelected = folderNotes.length > 0 && folderNotes.every(fn => selectedNotes.find(pn => pn.id === fn.id));
                                    const someSelected = folderNotes.some(fn => selectedNotes.find(pn => pn.id === fn.id));

                                    return (
                                        <button
                                            key={folder.id}
                                            onClick={() => onToggleFolder(folder.id)}
                                            className={cn(
                                                "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[11px] transition-colors group",
                                                allSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Ionicons name={folder.icon || "folder-outline"} size={12} color={folder.color} />
                                            <span className="flex-1 truncate">{folder.name}</span>
                                            {allSelected ? <CheckCircle2 size={12} /> : (someSelected && <div className="h-1.5 w-1.5 rounded-full bg-primary" />)}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="space-y-1">
                            <h4 className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 flex items-center gap-1.5">
                                <FileText size={10} /> Notes
                            </h4>
                            {filteredNotes.length === 0 ? (
                                <p className="px-2 py-4 text-[10px] text-muted-foreground/50 text-center italic">No notes found</p>
                            ) : (
                                filteredNotes.map(note => {
                                    const isSelected = selectedNotes.some(n => n.id === note.id);
                                    return (
                                        <button
                                            key={note.id}
                                            onClick={() => onToggleNote(note)}
                                            className={cn(
                                                "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[11px] transition-colors group",
                                                isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <FileText size={12} className={cn(isSelected ? "text-primary" : "text-muted-foreground/60")} />
                                            <span className="flex-1 truncate">{note.title || "Untitled"}</span>
                                            {isSelected && <CheckCircle2 size={12} />}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </ScrollArea>
                {selectedNotes.length > 0 && (
                    <div className="p-2 border-t border-border/30 bg-muted/20">
                        <Button
                            className="w-full h-8 text-[11px] font-semibold rounded-xl"
                            onClick={() => setIsOpen(false)}
                        >
                            Confirm Selection ({selectedNotes.length})
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
