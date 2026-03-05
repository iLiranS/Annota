import {
    sortFolders,
    sortNotes,
    useNotesStore,
    type Folder,
    type NoteMetadata
} from "@annota/core";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { NoteListItem } from '@/components/notes/note-list-item';
import { Button } from "@/components/ui/button";
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
        <div className="flex h-full w-[220px] min-w-[220px] flex-col border-r border-border bg-card/50">
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
                            <NoteListItem
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
                            <NoteListItem
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
                        <p className="text-sm font-medium text-center">This folder is empty</p>
                        <p className="text-xs text-center">Create a note or folder to get started</p>
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}


