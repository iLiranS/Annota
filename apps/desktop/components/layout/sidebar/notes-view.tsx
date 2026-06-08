import { useAppTheme } from "@/hooks/use-app-theme";
import { useCreateNote } from "@/hooks/use-create-note";
import { cn } from "@/lib/utils";
import {
    DAILY_NOTES_FOLDER_ID,
    TRASH_FOLDER_ID,
    getSortTypeLabel,
    sortNotes,
    useNavigationStore,
    useNotesStore,
    useSettingsStore,
    type Folder,
    type SortType
} from "@annota/core";
import { useMemo } from "react";
import { type BreadcrumbData } from "./breadcrumbs";
import { NotesList } from "./notes-list";
import { SidebarHeaderSection } from "./sidebar-header";

interface NotesViewBaseProps {
    currentFolderId: string | undefined;
    tagId: string | null;
}

interface NotesViewHeaderProps extends NotesViewBaseProps {
    selectionMode: boolean;
    setSelectionMode: (mode: boolean) => void;
    onEditFolder: (folder: Folder) => void;
    onCreateFolder: (parentId: string | null) => void;
}

interface NotesViewContentProps extends NotesViewBaseProps {
    selectionMode: boolean;
    selectedNoteIds: string[];
    onToggleSelection: (noteId: string) => void;
    onClearSelection: () => void;
    setSelectionMode: (mode: boolean) => void;
    routeNoteId: string | undefined;
    onNavigate: (to: string) => void;
    onEditFolder?: (folder: Folder) => void;
    onDeleteFolder?: (folder: Folder) => void;
    onCreateSubFolder?: (parentFolder: Folder) => void;
}

const SORT_OPTIONS: SortType[] = [
    'UPDATED_LAST',
    'UPDATED_FIRST',
    'CREATED_LAST',
    'CREATED_FIRST',
    'NAME_ASC',
    'NAME_DESC',
];

export function NotesViewHeader({
    currentFolderId,
    tagId,
    selectionMode,
    setSelectionMode,
    onEditFolder,
    onCreateFolder,
}: NotesViewHeaderProps) {
    const { colors } = useAppTheme();
    const { general } = useSettingsStore();
    const { folders, getSortType, setFolderSortType, tags } = useNotesStore();
    const { createAndNavigate: createNote } = useCreateNote();
    const setSelectedFolderId = useNavigationStore(state => state.setSelectedFolderId);

    const currentFolder = useMemo(() => currentFolderId ? folders.find(f => f.id === currentFolderId) : null, [folders, currentFolderId]);
    const currentTag = useMemo(() => tags.find(t => t.id === tagId), [tags, tagId]);
    const currentSortType = useMemo(() => getSortType(currentFolderId ?? null), [folders, currentFolderId, getSortType]);

    const isTrash = currentFolderId === TRASH_FOLDER_ID;
    const isDaily = currentFolderId === DAILY_NOTES_FOLDER_ID;
    const isRoot = (!currentFolderId || currentFolderId === 'root') && !tagId && !isTrash && !isDaily;

    const browsingFolderId = (currentFolderId === 'root' || !currentFolderId) ? null : currentFolderId;

    const breadcrumbs = useMemo(() => {
        const crumbs: BreadcrumbData[] = [{
            id: null,
            name: "Annota",
            icon: "annota",
            color: colors.primary
        }];

        if (tagId || isTrash || isDaily) {
            return crumbs;
        }

        if (browsingFolderId) {
            const path: BreadcrumbData[] = [];
            let currentFolder = folders.find(f => f.id === browsingFolderId);
            let parentId = currentFolder?.parentId ?? null;

            while (parentId) {
                const parentFolder = folders.find(f => f.id === parentId);
                if (parentFolder) {
                    path.unshift({
                        id: parentFolder.id,
                        name: parentFolder.name,
                        icon: parentFolder.icon || "folder",
                        color: parentFolder.color
                    });
                    parentId = parentFolder.parentId;
                } else {
                    break;
                }
            }

            if (path.length <= 1) {
                crumbs.push(...path);
            } else {
                crumbs.push({
                    id: "ellipsis",
                    name: "...",
                });
                crumbs.push(path[path.length - 1]);
            }
        }

        return crumbs;
    }, [browsingFolderId, folders, colors.primary, tagId, isTrash, isDaily]);

    const headerTitle = useMemo(() => {
        if (tagId) return currentTag?.name ?? "Tag";
        if (isTrash) return "Trash";
        if (isDaily) return "Daily Notes";
        return currentFolder ? currentFolder.name : "Annota";
    }, [tagId, currentTag, isTrash, isDaily, currentFolder]);

    const headerIcon = useMemo(() => {
        if (tagId && currentTag) return "ellipse";
        if (isTrash) return "trash";
        if (isDaily) return "calendar";
        return currentFolder ? currentFolder.icon : "documents";
    }, [tagId, currentTag, isTrash, isDaily, currentFolder]);

    const headerColor = useMemo(() => {
        if (tagId && currentTag) return currentTag.color;
        if (isTrash) return "#EF4444";
        if (isDaily) return "#8B5CF6";
        return currentFolder?.color || colors.primary;
    }, [tagId, currentTag, isTrash, isDaily, currentFolder, colors.primary]);

    return (
        <SidebarHeaderSection
            title={headerTitle}
            dir={general.appDirection}
            icon={headerIcon}
            color={headerColor}
            isDaily={isDaily}
            isTrash={isTrash}
            currentSortType={(isDaily || isTrash) ? 'CREATED_LAST' : currentSortType}
            onSortChange={(type) => setFolderSortType(currentFolderId ?? null, type)}
            onCreateNote={() => {
                createNote(currentFolderId ?? "", tagId || undefined);
            }}
            onCreateFolder={() => {
                onCreateFolder(currentFolderId ?? null);
            }}
            onEditFolder={() => currentFolder && onEditFolder(currentFolder)}
            sortOptions={SORT_OPTIONS}
            getSortTypeLabel={getSortTypeLabel}
            tagId={tagId || undefined}
            isRoot={isRoot}
            currentFolderId={currentFolderId ?? null}
            selectionMode={selectionMode}
            setSelectionMode={setSelectionMode}
            breadcrumbs={breadcrumbs}
            onNavigateBreadcrumb={(id) => setSelectedFolderId(id || 'root')}
        />
    );
}

export function NotesViewContent({
    currentFolderId,
    tagId,
    selectionMode,
    selectedNoteIds,
    onToggleSelection,
    onClearSelection,
    setSelectionMode,
    onNavigate,
    onEditFolder,
    onDeleteFolder,
    onCreateSubFolder,
}: NotesViewContentProps) {
    const { general } = useSettingsStore();
    const {
        folders,
        notes,
        deleteNote,
        getNotesInFolder,
        getSortType,
    } = useNotesStore();

    const isTrash = currentFolderId === TRASH_FOLDER_ID;
    const isDaily = currentFolderId === DAILY_NOTES_FOLDER_ID;
    const currentSortType = useMemo(() => getSortType(currentFolderId ?? null), [folders, currentFolderId, getSortType]);

    const browseNotes = useMemo(() => {
        if (tagId) {
            const list = notes.filter(n => {
                if (!n.tags) return false;
                try {
                    const tagIds = JSON.parse(n.tags) as string[];
                    return tagIds.includes(tagId) && !n.isDeleted && !n.isPermDeleted;
                } catch { return false; }
            });
            return sortNotes(list, currentSortType);
        }
        const list = getNotesInFolder(currentFolderId ?? null);
        const sortType = (isDaily || isTrash) ? 'CREATED_LAST' : currentSortType;
        return sortNotes(list, sortType);
    }, [notes, folders, currentFolderId, currentSortType, tagId, isDaily, isTrash, getNotesInFolder]);

    return (
        <div className={cn(
            "flex-1 overflow-hidden flex flex-col",
            general.appDirection === 'rtl' ? "animate-content-from-right" : "animate-content-from-left"
        )}>
            <NotesList
                key={currentFolderId ?? tagId ?? 'root'}
                notes={browseNotes}
                onNoteClick={(note) => {
                    onNavigate(`/notes/${note.id}`);
                }}
                onDeleteNote={deleteNote}
                selectionMode={selectionMode}
                selectedNoteIds={selectedNoteIds}
                onToggleSelection={onToggleSelection}
                onClearSelection={onClearSelection}
                currentFolderId={currentFolderId ?? null}
                isTrash={isTrash}
                setSelectionMode={setSelectionMode}
                onEditFolder={onEditFolder}
                onDeleteFolder={onDeleteFolder}
                onCreateSubFolder={onCreateSubFolder}
            />
        </div>
    );
}
