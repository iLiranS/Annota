import { formatRelativeDate } from "@/lib/date-formatter";
import {
    sortFolders,
    sortNotes,
    useNotesStore,
    type Folder,
    type NoteMetadata
} from "@annota/core";
import {
    ChevronRight,
    FileText,
    Folder as FolderIcon,
    FolderOpen,
    Pin,
    Plus,
    Search,
    Star,
    Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface NotesSidebarProps {
    currentFolderId?: string;
}

export function NotesSidebar({ currentFolderId }: NotesSidebarProps) {
    const navigate = useNavigate();
    const [, setSearchParams] = useSearchParams();

    const {
        notes,
        folders,
        createNote,
        getNotesInFolder,
        getFoldersInFolder,
        getFolderById,
        getSortType,
        deleteNote,
        toggleQuickAccess,
        togglePin,
    } = useNotesStore();

    const currentFolder = currentFolderId
        ? getFolderById(currentFolderId)
        : null;
    const currentSortType = getSortType(currentFolderId ?? null);

    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
        new Set(),
    );

    const toggleSection = useCallback((title: string) => {
        setCollapsedSections((prev) => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
        });
    }, []);

    // Browsing data
    const browseFolders = useMemo(() => {
        const list = getFoldersInFolder(currentFolderId ?? null);
        return sortFolders(
            list.filter((f) => !f.isSystem),
            currentSortType,
        ) as Folder[];
    }, [folders, currentFolderId, currentSortType]);

    const browseNotes = useMemo(() => {
        const list = getNotesInFolder(currentFolderId ?? null);
        return sortNotes(list, currentSortType);
    }, [notes, currentFolderId, currentSortType]);

    const { pinnedNotes, unpinnedNotes } = useMemo(() => {
        return {
            pinnedNotes: browseNotes.filter((n) => n.isPinned),
            unpinnedNotes: browseNotes.filter((n) => !n.isPinned),
        };
    }, [browseNotes]);

    const handleFolderPress = (folderId: string) => {
        setSearchParams({ folderId });
    };

    const handleNotePress = (note: NoteMetadata) => {
        const folderId = note.folderId || "root";
        navigate(`/notes/${folderId}/${note.id}`);
    };

    const handleCreateNote = async () => {
        const newNote = await createNote({ folderId: currentFolderId ?? "" });
        navigate(`/notes/${currentFolderId || "root"}/${newNote.id}`);
    };

    const headerTitle = currentFolder ? currentFolder.name : "Notes";

    return (
        <div className="flex h-full w-[280px] min-w-[280px] flex-col border-r border-border bg-card/50">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
                <h2 className="text-lg font-bold tracking-tight">{headerTitle}</h2>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Search className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleCreateNote}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Separator />

            {/* Content */}
            <ScrollArea className="flex-1 px-2 py-2">
                {/* Folders section */}
                {browseFolders.length > 0 && (
                    <SectionBlock
                        title="Folders"
                        icon={<FolderIcon className="h-3.5 w-3.5" />}
                        isCollapsed={collapsedSections.has("Folders")}
                        onToggle={() => toggleSection("Folders")}
                    >
                        {browseFolders.map((folder) => (
                            <button
                                key={folder.id}
                                type="button"
                                onClick={() => handleFolderPress(folder.id)}
                                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                            >
                                <FolderOpen
                                    className="h-4 w-4 shrink-0"
                                    style={{ color: folder.color || undefined }}
                                />
                                <span className="truncate font-medium">{folder.name}</span>
                            </button>
                        ))}
                    </SectionBlock>
                )}

                {/* Pinned section */}
                {pinnedNotes.length > 0 && (
                    <SectionBlock
                        title="Pinned"
                        icon={<Pin className="h-3.5 w-3.5" />}
                        isCollapsed={collapsedSections.has("Pinned")}
                        onToggle={() => toggleSection("Pinned")}
                    >
                        {pinnedNotes.map((note) => (
                            <NoteItem
                                key={note.id}
                                note={note}
                                onClick={() => handleNotePress(note)}
                                onDelete={() => deleteNote(note.id)}
                                onToggleQuickAccess={() => toggleQuickAccess(note.id)}
                                onTogglePin={() => togglePin(note.id)}
                            />
                        ))}
                    </SectionBlock>
                )}

                {/* Notes section */}
                {unpinnedNotes.length > 0 && (
                    <SectionBlock
                        title="Notes"
                        icon={<FileText className="h-3.5 w-3.5" />}
                        isCollapsed={collapsedSections.has("Notes")}
                        onToggle={() => toggleSection("Notes")}
                    >
                        {unpinnedNotes.map((note) => (
                            <NoteItem
                                key={note.id}
                                note={note}
                                onClick={() => handleNotePress(note)}
                                onDelete={() => deleteNote(note.id)}
                                onToggleQuickAccess={() => toggleQuickAccess(note.id)}
                                onTogglePin={() => togglePin(note.id)}
                            />
                        ))}
                    </SectionBlock>
                )}

                {/* Empty state */}
                {browseFolders.length === 0 && browseNotes.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                        <FolderOpen className="h-10 w-10 text-border" />
                        <p className="text-sm font-medium">This folder is empty</p>
                        <p className="text-xs">Create a note or folder to get started</p>
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}

/* ── Shared sub-components ────────────────────────────────────── */

interface SectionBlockProps {
    title: string;
    icon: React.ReactNode;
    isCollapsed: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

function SectionBlock({
    title,
    icon,
    isCollapsed,
    onToggle,
    children,
}: SectionBlockProps) {
    return (
        <Collapsible open={!isCollapsed} className="mb-1">
            <CollapsibleTrigger
                onClick={onToggle}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
                {icon}
                <span className="flex-1 text-left">{title}</span>
                <ChevronRight
                    className={`h-3.5 w-3.5 transition-transform ${!isCollapsed ? "rotate-90" : ""}`}
                />
            </CollapsibleTrigger>
            <CollapsibleContent>{children}</CollapsibleContent>
        </Collapsible>
    );
}

interface NoteItemProps {
    note: NoteMetadata;
    onClick: () => void;
    onDelete?: () => void;
    onToggleQuickAccess?: () => void;
    onTogglePin?: () => void;
}

function NoteItem({
    note,
    onClick,
    onDelete,
    onToggleQuickAccess,
    onTogglePin,
}: NoteItemProps) {
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <button
                    type="button"
                    onClick={onClick}
                    className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <p className="truncate font-medium">
                                {note.title || "Untitled Note"}
                            </p>
                            {note.isPinned && (
                                <Pin className="h-3 w-3 shrink-0 text-primary" />
                            )}
                            {note.isQuickAccess && (
                                <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                            )}
                        </div>
                        {note.updatedAt && (
                            <p className="truncate text-xs text-muted-foreground">
                                {formatRelativeDate(note.updatedAt)}
                            </p>
                        )}
                    </div>
                </button>
            </ContextMenuTrigger>

            <ContextMenuContent className="w-48">
                {onToggleQuickAccess && (
                    <ContextMenuItem
                        onClick={onToggleQuickAccess}
                        className="gap-2 focus:bg-amber-500/10 focus:text-amber-600"
                    >
                        <Star className="h-4 w-4" />
                        <span>
                            {note.isQuickAccess ? "Remove from Starred" : "Star Note"}
                        </span>
                    </ContextMenuItem>
                )}
                {onTogglePin && (
                    <ContextMenuItem
                        onClick={onTogglePin}
                        className="gap-2 focus:bg-primary/10 focus:text-primary"
                    >
                        <Pin className="h-4 w-4" />
                        <span>{note.isPinned ? "Unpin Note" : "Pin Note"}</span>
                    </ContextMenuItem>
                )}
                {(onToggleQuickAccess || onTogglePin) && onDelete && (
                    <ContextMenuSeparator />
                )}
                {onDelete && (
                    <ContextMenuItem
                        onClick={onDelete}
                        className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete Note</span>
                    </ContextMenuItem>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
}
