import { formatRelativeDate } from "@/lib/date-formatter";
import {
    sortFolders,
    sortNotes,
    useNotesStore,
    type Folder,
    type NoteMetadata
} from "@annota/core";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Ionicons } from "@/components/ui/ionicons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { NotesCollapsibleGroup } from "./components/notes-collapsible-group";

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
    } = useNotesStore();

    const currentFolder = currentFolderId
        ? getFolderById(currentFolderId)
        : null;
    const currentSortType = getSortType(currentFolderId ?? null);

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
                        <Ionicons name="search" size={16} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleCreateNote}
                    >
                        <Ionicons name="add" size={18} />
                    </Button>
                </div>
            </div>

            <Separator />

            {/* Content */}
            <ScrollArea className="flex-1 px-2 py-2">
                {/* Folders section */}
                {browseFolders.length > 0 && (
                    <NotesCollapsibleGroup
                        title="Folders"
                        icon="folder"
                        count={browseFolders.length}
                    >
                        {browseFolders.map((folder) => (
                            <button
                                key={folder.id}
                                type="button"
                                onClick={() => handleFolderPress(folder.id)}
                                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent group/folder"
                            >
                                <div className="flex h-5 w-5 items-center justify-center rounded transition-colors group-hover/folder:bg-accent">
                                    <Ionicons
                                        name={(folder.icon as any) || "folder"}
                                        size={16}
                                        style={{ color: folder.color || undefined }}
                                    />
                                </div>
                                <span className="truncate font-medium">{folder.name}</span>
                            </button>
                        ))}
                    </NotesCollapsibleGroup>
                )}

                {/* Pinned section */}
                {pinnedNotes.length > 0 && (
                    <NotesCollapsibleGroup
                        title="Pinned"
                        icon="pin"
                        count={pinnedNotes.length}
                    >
                        {pinnedNotes.map((note) => (
                            <NoteItem
                                key={note.id}
                                note={note}
                                onClick={() => handleNotePress(note)}
                                onDelete={() => deleteNote(note.id)}
                            />
                        ))}
                    </NotesCollapsibleGroup>
                )}

                {/* Notes section */}
                {unpinnedNotes.length > 0 && (
                    <NotesCollapsibleGroup
                        title="Notes"
                        icon="document-text"
                        count={unpinnedNotes.length}
                    >
                        {unpinnedNotes.map((note) => (
                            <NoteItem
                                key={note.id}
                                note={note}
                                onClick={() => handleNotePress(note)}
                                onDelete={() => deleteNote(note.id)}
                            />
                        ))}
                    </NotesCollapsibleGroup>
                )}

                {/* Empty state */}
                {browseFolders.length === 0 && browseNotes.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                        <Ionicons name="folder-open" size={40} className="text-border" />
                        <p className="text-sm font-medium">This folder is empty</p>
                        <p className="text-xs">Create a note or folder to get started</p>
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}

/* ── Shared sub-components ────────────────────────────────────── */

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
                    <Ionicons name="document-text" size={16} className="text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <p className="truncate font-medium">
                                {note.title || "Untitled Note"}
                            </p>
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
                        <Ionicons name="star" size={16} />
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
                        <Ionicons name="pin" size={16} />
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
                        <Ionicons name="trash-outline" size={16} />
                        <span>Delete Note</span>
                    </ContextMenuItem>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
}
