import { Input } from "@/components/ui/input";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { cn } from "@/lib/utils";
import { useNotesStore, useSearchStore, useSettingsStore } from "@annota/core";
import { useMemo } from "react";
import { FolderListItem } from "../../notes/folder-list-item";
import { NoteListItem } from "../../notes/note-list-item";
import { Ionicons } from "../../ui/ionicons";

interface SearchViewProps {
    onNoteClick: (note: any) => void;
    onFolderClick: (folder: any) => void;
    onDeleteNote: (id: string) => void;
    onEditFolder: (folder: any) => void;
    onDeleteFolder: (folder: any) => void;
    onCreateSubFolder: (parent: any) => void;
    onCreateNote: (folderId: string) => void;
}

export function SearchView({
    onNoteClick,
    onFolderClick,
    onDeleteNote,
    onEditFolder,
    onDeleteFolder,
    onCreateSubFolder,
    onCreateNote
}: SearchViewProps) {
    const { colors } = useAppTheme();
    const { getFolderById } = useNotesStore();
    const { general } = useSettingsStore();
    const {
        searchQuery,
        isSearching,
        dbResults,
        setSearchQuery,
    } = useSearchStore();

    const folderResults = useMemo(() => dbResults.filter(r => r.type === 'folder'), [dbResults]);
    const noteResults = useMemo(() => dbResults.filter(r => r.type === 'note'), [dbResults]);

    const FolderBadge = ({ folderId }: { folderId: string | null }) => {
        const folder = folderId ? getFolderById(folderId) : null;
        if (!folder && folderId !== null) return null;
        if (!folderId) return null;

        return (
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    if (folder) onFolderClick(folder);
                }}
                className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight border shrink-0 cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                style={{
                    backgroundColor: folder?.color ? `${folder.color}20` : `${colors.primary}15`,
                    color: folder?.color || colors.primary,
                    borderColor: folder?.color ? `${folder.color}40` : `${colors.primary}40`
                }}
            >
                <Ionicons name={folder?.icon ? (folder.icon as any) : "folder"} size={9} />
                <span className="truncate max-w-[60px]">{folder?.name || "Notes"}</span>
            </div>
        );
    };

    return (
        <div className={cn(
            "flex flex-col flex-1 min-h-0",
            general.appDirection === 'rtl' ? "animate-content-from-right" : "animate-content-from-left"
        )}>
            <div className="px-3 py-2 sticky top-0  z-10">
                <div className="relative group">
                    <Ionicons
                        name={isSearching ? "sync" : "search-outline"}
                        size={14}
                        className={cn(
                            "absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 transition-colors group-focus-within:text-primary z-10",
                            isSearching && "animate-spin text-primary"
                        )}
                    />
                    <Input
                        autoFocus
                        placeholder="Search Your Notes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value, null)}
                        className="flex h-9 w-full rounded-md border border-input/40 bg-transparent pl-7 pr-7 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/60 placeholder:text-[12px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50" />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("", null)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-muted-foreground/60 p-1"
                        >
                            <Ionicons name="close-circle" size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div data-tauri-drag-region className="flex-1 overflow-y-auto premium-scrollbar px-1">


                {searchQuery && !isSearching && dbResults.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <p className="text-xs font-bold text-muted-foreground/60">No results found</p>
                    </div>
                )}

                {(folderResults.length > 0 || noteResults.length > 0) && (
                    <SidebarMenu className="gap-4 pb-4">
                        {folderResults.length > 0 && (
                            <div className="space-y-1">
                                <div className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 flex items-center gap-2">
                                    <Ionicons name="folder-outline" size={10} />
                                    <span>Folders</span>
                                </div>
                                <div className="space-y-0.5">
                                    {folderResults.map((result) => (
                                        <SidebarMenuItem key={result.id}>
                                            <FolderListItem
                                                folder={result.data}
                                                onClick={() => onFolderClick(result.data)}
                                                onEdit={onEditFolder}
                                                onDelete={onDeleteFolder}
                                                onCreateSubFolder={onCreateSubFolder}
                                                onCreateNote={(f) => onCreateNote(f.id)}
                                                searchQuery={searchQuery}
                                                isSearchResult
                                                className="hover:bg-primary/5 border-none"
                                            />
                                        </SidebarMenuItem>
                                    ))}
                                </div>
                            </div>
                        )}

                        {noteResults.length > 0 && (
                            <div className="space-y-1">
                                <div className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 flex items-center gap-2">
                                    <Ionicons name="document-text-outline" size={10} />
                                    <span>Notes</span>
                                </div>
                                <div className="space-y-0.5">
                                    {noteResults.map((result) => (
                                        <SidebarMenuItem key={result.id}>
                                            <NoteListItem
                                                note={result.data}
                                                onClick={() => onNoteClick(result.data)}
                                                onDelete={() => onDeleteNote(result.data.id)}
                                                isActive={false}
                                                searchQuery={searchQuery}
                                                isInList={true}
                                                suffix={<FolderBadge folderId={result.data.folderId} />}
                                                className="hover:bg-primary/5 border-none"
                                            />
                                        </SidebarMenuItem>
                                    ))}
                                </div>
                            </div>
                        )}
                    </SidebarMenu>
                )}
            </div>
        </div>
    );
}
