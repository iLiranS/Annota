import { ConfirmDialog } from "@/components/custom-ui/confirm-dialog";
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
import { formatDate } from "@/lib/date-formatter";
import {
    sortFolders,
    sortNotes,
    TRASH_FOLDER_ID,
    useNotesStore,
    type Folder,
    type NoteMetadata,
} from "@annota/core";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function TrashPage() {
    const navigate = useNavigate();
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(
        TRASH_FOLDER_ID,
    );

    const {
        notes,
        folders,
        restoreNote,
        restoreFolder,
        permanentlyDeleteNote,
        permanentlyDeleteFolder,
        emptyTrash,
        getNotesInFolder,
        getFoldersInFolder,
        getFolderById,
    } = useNotesStore();

    const currentFolder = currentFolderId ? getFolderById(currentFolderId) : null;

    // Get deleted folders and notes in current folder
    const deletedFolders = useMemo(() => {
        const folderList = getFoldersInFolder(currentFolderId, true);
        return sortFolders(
            folderList.filter((f) => f.isDeleted),
            "UPDATED_LAST",
        ) as Folder[];
    }, [folders, currentFolderId]);
    console.log("deletedFolders", deletedFolders);

    const deletedNotes = useMemo(() => {
        const noteList = getNotesInFolder(currentFolderId, true);
        return sortNotes(
            noteList.filter((n) => n.isDeleted),
            "UPDATED_LAST",
        );
    }, [notes, currentFolderId]);


    const isEmpty = deletedFolders.length === 0 && deletedNotes.length === 0;

    const headerTitle =
        currentFolder && currentFolderId !== TRASH_FOLDER_ID
            ? currentFolder.name
            : "Trash";

    return (
        <div className="flex h-full w-full flex-col bg-background overflow-y-auto ">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
                <div className="flex items-center gap-4">
                    {currentFolderId !== TRASH_FOLDER_ID && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCurrentFolderId(TRASH_FOLDER_ID)}
                        >
                            <Ionicons name="chevron-back" size={20} />
                        </Button>
                    )}
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded bg-red-500/10">
                            <Ionicons color='red' name="trash" size={20} />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            {headerTitle}
                        </h1>
                    </div>
                </div>

                {!isEmpty && (
                    <ConfirmDialog
                        title="Empty Trash?"
                        description="Are you sure you want to permanently delete all items in the trash? This action cannot be undone."
                        confirmText="Empty Trash"
                        onConfirm={emptyTrash}
                        trigger={
                            <Button variant="destructive" size="sm" className="gap-2">
                                <Ionicons name="trash-outline" size={16} />
                                Empty Trash
                            </Button>
                        }
                    />
                )}
            </div>

            {/* List */}
            <ScrollArea className="flex-1">
                <div className="mx-auto max-w-4xl p-6">
                    {isEmpty ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                                <Ionicons
                                    name="trash-outline"
                                    size={40}
                                    className="text-muted-foreground"
                                />
                            </div>
                            <h2 className="text-xl font-semibold">Trash is empty</h2>
                            <p className="text-muted-foreground">
                                Items you delete will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-8 ">
                            {/* Folders Section */}
                            {deletedFolders.length > 0 && (
                                <section>
                                    <div className="mb-3 flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        <Ionicons name="folder" size={14} />
                                        <span>Folders</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {deletedFolders.map((folder) => (
                                            <FolderRow
                                                key={folder.id}
                                                folder={folder}
                                                onPress={() => setCurrentFolderId(folder.id)}
                                                onRestore={() => restoreFolder(folder.id)}
                                                onDelete={() => permanentlyDeleteFolder(folder.id)}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Notes Section */}
                            {deletedNotes.length > 0 && (
                                <section>
                                    <div className="mb-3 flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        <Ionicons name="document-text" size={14} />
                                        <span>Notes</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {deletedNotes.map((note) => (
                                            <NoteRow
                                                key={note.id}
                                                note={note}
                                                onPress={() =>
                                                    navigate(`/notes/${note.folderId || "root"}/${note.id}`)
                                                }
                                                onRestore={() => restoreNote(note.id)}
                                                onDelete={() => permanentlyDeleteNote(note.id)}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

function OriginalFolderBadge({ folderId }: { folderId: string | null }) {
    const folders = useNotesStore((state) => state.folders);
    const folder = folderId ? folders.find((f) => f.id === folderId) : null;

    if (folderId === TRASH_FOLDER_ID) return null;

    // If the parent folder is also deleted, show "Notes" (root)
    const isParentDeleted = folder?.isDeleted ?? false;
    const displayFolder = !isParentDeleted ? folder : null;

    return (
        <div
            className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold"
            style={{
                backgroundColor: displayFolder ? `${displayFolder.color}15` : "var(--muted)",
                color: displayFolder ? displayFolder.color : "var(--muted-foreground)",
            }}
        >
            <Ionicons
                name={(displayFolder?.icon as any) || "home"}
                size={12}
                style={{ color: displayFolder?.color }}
            />
            <span>{displayFolder ? displayFolder.name : "Notes"}</span>
        </div>
    );
}

//@ts-ignore
interface RowProps<T> {
    onPress: () => void;
    onRestore: () => void;
    onDelete: () => void;
}

function FolderRow({
    folder,
    onPress,
    onRestore,
    onDelete,
}: RowProps<Folder> & { folder: Folder }) {
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <button
                    onClick={onPress}
                    className="group flex w-full items-center gap-4 rounded-xl border border-transparent bg-card p-4 text-left transition-all hover:border-border hover:shadow-sm"
                >
                    <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${folder.color}20` }}
                    >
                        <Ionicons
                            name={(folder.icon as any) || "folder"}
                            size={20}
                            style={{ color: folder.color }}
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold">{folder.name}</h3>
                        <div className="mt-1 flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                                Deleted {formatDate(folder.deletedAt)}
                            </span>
                            <OriginalFolderBadge folderId={folder.originalParentId} />
                        </div>
                    </div>
                    <Ionicons
                        name="chevron-forward"
                        size={16}
                        className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                </button>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48">
                <ContextMenuItem onClick={onRestore} className="gap-2 focus:text-emerald-600 focus:bg-emerald-500/10">
                    <Ionicons name="arrow-undo" size={16} />
                    <span>Restore Folder</span>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ConfirmDialog
                    title="Permanently Delete Folder?"
                    description={`Are you sure you want to permanently delete "${folder.name}" and all its contents? This action cannot be undone.`}
                    confirmText="Delete"
                    onConfirm={onDelete}
                    trigger={
                        <ContextMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                            <Ionicons name="trash-outline" size={16} />
                            <span>Delete Permanently</span>
                        </ContextMenuItem>
                    }
                />
            </ContextMenuContent>
        </ContextMenu>
    );
}

function NoteRow({
    note,
    onPress,
    onRestore,
    onDelete,
}: RowProps<NoteMetadata> & { note: NoteMetadata }) {
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <button
                    onClick={onPress}
                    className="group flex w-full items-center gap-4 rounded-xl border border-transparent bg-card p-4 text-left transition-all hover:border-border hover:shadow-sm"
                >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                        <Ionicons name="document-text" size={20} className="text-red-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold">
                            {note.title || "Untitled Note"}
                        </h3>
                        <div className="mt-1 flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                                Deleted {formatDate(note.deletedAt)}
                            </span>
                            <OriginalFolderBadge folderId={note.originalFolderId} />
                        </div>
                    </div>
                </button>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48">
                <ContextMenuItem onClick={onRestore} className="gap-2 focus:text-emerald-600 focus:bg-emerald-500/10">
                    <Ionicons name="arrow-undo" size={16} />
                    <span>Restore Note</span>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ConfirmDialog
                    title="Permanently Delete Note?"
                    description={`Are you sure you want to permanently delete "${note.title || "Untitled Note"}"? This action cannot be undone.`}
                    confirmText="Delete"
                    onConfirm={onDelete}
                    trigger={
                        <ContextMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                            <Ionicons name="trash-outline" size={16} />
                            <span>Delete Permanently</span>
                        </ContextMenuItem>
                    }
                />
            </ContextMenuContent>
        </ContextMenu>
    );
}
