import {
    ContextMenuItem,
    ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Ionicons } from "@/components/ui/ionicons";
import { useSmartNavigate } from "@/hooks/use-smart-navigate";
import { NoteMetadata, useNavigationStore, useNotesStore, useSettingsStore } from "@annota/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { FolderOpen, PictureInPicture2, Pin, Star } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useNoteTabsStore } from "../../hooks/use-note-tabs";
import { useOpenNoteInNewWindow } from "../../hooks/use-open-note-in-new-window";
import { LocationPickerModal } from "../location-picker-modal";
import { FolderEditModal } from "./folder-edit-modal";
import { NotePreviewModal } from "./note-preview-modal";

export interface NoteContextMenuContentProps {
    note: NoteMetadata;
    onDelete?: () => void;
    onShowFolder?: () => void;
    onPreview?: () => void;
    onMoveNote?: () => void;
    disabledActions?: (
        | "preview"
        | "openInNewWindow"
        | "openInNewTab"
        | "quickAccess"
        | "pinNote"
        | "copyLink"
        | "moveNote"
        | "deleteNote"
        | "showFolder"
    )[];
}

export function NoteContextMenuContent({
    note,
    onDelete,
    onShowFolder,
    onPreview,
    onMoveNote,
    disabledActions = [],
}: NoteContextMenuContentProps) {
    const { updateNoteMetadata, restoreNote, permanentlyDeleteNote } = useNotesStore();
    const { general } = useSettingsStore();
    const setSidebarTab = useNavigationStore((s) => s.setSidebarTab);
    const navigateSmart = useSmartNavigate();
    const navigate = useNavigate();
    const openNoteInNewWindow = useOpenNoteInNewWindow();

    const handleRestoreNote = useCallback(async () => {
        await restoreNote(note.id);
        toast.success("Note restored");
    }, [note.id, restoreNote]);

    const handlePermanentlyDelete = useCallback(async () => {
        await permanentlyDeleteNote(note.id);
        toast.success("Note permanently deleted");
    }, [note.id, permanentlyDeleteNote]);

    const handleTogglePin = useCallback(async () => {
        await updateNoteMetadata(note.id, { isPinned: !note.isPinned });
    }, [note.id, note.isPinned, updateNoteMetadata]);

    const handleToggleQuickAccess = useCallback(async () => {
        await updateNoteMetadata(note.id, { isQuickAccess: !note.isQuickAccess });
    }, [note.id, note.isQuickAccess, updateNoteMetadata]);

    const handleCopyLink = useCallback(async () => {
        const link = `annota://note/${note.id}`;
        try {
            await writeText(link);
            toast.success("Link copied to clipboard", {
                description: "You can now paste it anywhere to link to this note.",
            });
        } catch (err) {
            console.error("Failed to copy link:", err);
            toast.error("Failed to copy link to clipboard");
        }
    }, [note.id]);

    const handleOpenInNewWindow = useCallback(async () => {
        await openNoteInNewWindow(note.id);
    }, [note.id, openNoteInNewWindow]);

    const handleOpenInNewTab = useCallback(() => {
        useNoteTabsStore.getState().addTab({ noteId: note.id, folderId: note.folderId || "root" });
        navigateSmart(`/notes/${note.folderId || "root"}/${note.id}`);
    }, [note.id, note.folderId, navigateSmart]);

    const handleShowFolder = useCallback(() => {
        const folderId = note.folderId || "root";
        setSidebarTab("notes");
        navigate(`/notes?folderId=${folderId}`);
        onShowFolder?.();
    }, [note.folderId, navigate, setSidebarTab, onShowFolder]);

    const isWindows = typeof window !== "undefined" && /windows/i.test(navigator.userAgent);

    if (note.isDeleted) {
        return (
            <>
                <ContextMenuItem
                    onSelect={handleRestoreNote}
                    className="gap-2 focus:text-emerald-600 focus:bg-emerald-500/10"
                >
                    <Ionicons name="arrow-undo-outline" size={16} />
                    <span>Restore Note</span>
                </ContextMenuItem>
                <ContextMenuItem
                    onSelect={handlePermanentlyDelete}
                    className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                    <Ionicons name="trash-outline" size={16} />
                    <span>Delete Permanently</span>
                </ContextMenuItem>
            </>
        );
    }

    return (
        <>
            {!disabledActions.includes("preview") && onPreview && (
                <ContextMenuItem
                    onSelect={onPreview}
                    onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                    className="gap-2"
                >
                    <Ionicons name="eye-outline" size={16} />
                    <span>Preview Note</span>
                </ContextMenuItem>
            )}

            {!isWindows && !disabledActions.includes("openInNewWindow") && (
                <ContextMenuItem
                    onSelect={handleOpenInNewWindow}
                    onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                    className="gap-2"
                >
                    <PictureInPicture2 size={16} />
                    <span>Open in New Window</span>
                </ContextMenuItem>
            )}

            {general.enableNoteTabs !== false && !disabledActions.includes("openInNewTab") && (
                <ContextMenuItem
                    onSelect={handleOpenInNewTab}
                    onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                    className="gap-2"
                >
                    <Ionicons name="albums-outline" size={16} />
                    <span>Open in New Tab</span>
                </ContextMenuItem>
            )}

            {!disabledActions.includes("quickAccess") && (
                <ContextMenuItem
                    onSelect={handleToggleQuickAccess}
                    onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                    className="gap-2"
                >
                    <Star className={note.isQuickAccess ? "fill-accent-full text-accent-full" : ""} size={16} />
                    <span>{note.isQuickAccess ? "Remove Quick Access" : "Quick Access"}</span>
                </ContextMenuItem>
            )}

            {!disabledActions.includes("pinNote") && (
                <ContextMenuItem
                    onSelect={handleTogglePin}
                    onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                    className="gap-2"
                >
                    <Pin className={note.isPinned ? "fill-accent-full text-accent-full" : ""} size={16} />
                    <span>{note.isPinned ? "Unpin Note" : "Pin Note"}</span>
                </ContextMenuItem>
            )}

            {!disabledActions.includes("copyLink") && (
                <ContextMenuItem
                    onSelect={handleCopyLink}
                    onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                    className="gap-2"
                >
                    <Ionicons name="link-outline" size={16} />
                    <span>Copy Link</span>
                </ContextMenuItem>
            )}

            {!disabledActions.includes("showFolder") && (
                <ContextMenuItem
                    onSelect={handleShowFolder}
                    onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                    className="gap-2"
                >
                    <FolderOpen size={16} />
                    <span>Show in Sidebar</span>
                </ContextMenuItem>
            )}

            {!disabledActions.includes("moveNote") && onMoveNote && (
                <>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                        onSelect={onMoveNote}
                        onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                        className="gap-2"
                    >
                        <Ionicons name="folder-outline" size={16} />
                        <span>Move Note</span>
                    </ContextMenuItem>
                </>
            )}

            {onDelete && !disabledActions.includes("deleteNote") && (
                <ContextMenuItem
                    onSelect={onDelete}
                    onPointerUp={(e) => e.button === 2 && e.preventDefault()}
                    className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                    <Ionicons name="trash-outline" size={16} />
                    <span>Delete Note</span>
                </ContextMenuItem>
            )}
        </>
    );
}

export function useNoteModals(note: NoteMetadata | null) {
    const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
    const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

    const { updateNoteMetadata } = useNotesStore();

    const handleMoveNote = useCallback(async (targetFolderId: string | null) => {
        if (!note) return;
        await updateNoteMetadata(note.id, { folderId: targetFolderId });
        toast.success("Note moved successfully");
    }, [note, updateNoteMetadata]);

    const renderModals = useCallback(() => {
        if (!note) return null;
        return (
            <>
                {isLocationPickerOpen && (
                    <LocationPickerModal
                        open={isLocationPickerOpen}
                        onOpenChange={setIsLocationPickerOpen}
                        onClose={() => setIsLocationPickerOpen(false)}
                        selectedParentId={note.folderId}
                        onSelect={handleMoveNote}
                        onCreateFolder={(id) => {
                            setNewFolderParentId(id);
                            setIsNewFolderModalOpen(true);
                        }}
                    />
                )}

                {isNewFolderModalOpen && (
                    <FolderEditModal
                        open={isNewFolderModalOpen}
                        onOpenChange={setIsNewFolderModalOpen}
                        folder={null}
                        defaultParentId={newFolderParentId}
                    />
                )}

                {isPreviewOpen && (
                    <NotePreviewModal
                        open={isPreviewOpen}
                        onOpenChange={setIsPreviewOpen}
                        note={note}
                    />
                )}
            </>
        );
    }, [note, isLocationPickerOpen, isNewFolderModalOpen, isPreviewOpen, newFolderParentId, handleMoveNote]);

    return {
        openPreview: useCallback(() => {
            setTimeout(() => setIsPreviewOpen(true), 100);
        }, []),
        openLocationPicker: useCallback(() => {
            setTimeout(() => setIsLocationPickerOpen(true), 100);
        }, []),
        renderModals,
    };
}
