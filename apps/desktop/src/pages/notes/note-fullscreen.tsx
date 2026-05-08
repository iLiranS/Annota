import { SidebarProvider } from "@/components/ui/sidebar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useNotesStore } from "@annota/core";
import { emit, once } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import NoteEditor from "./note-editor";

/**
 * Standalone fullscreen note editor for child windows.
 *
 * This component is intentionally "stupid" — it receives all the data it needs
 * (content, tags, notes) from the main window via a Tauri event and never
 * queries the DB or services directly. Content changes are emitted back to the
 * main window which persists them.
 */
export default function NoteFullscreen() {
    const { noteId } = useParams<{ noteId: string }>();
    const { isDark } = useAppTheme();

    const [initialContent, setInitialContent] = useState<string | null>(null);

    // ── Sync window theme ──
    useEffect(() => {
        const syncTheme = async () => {
            try {
                const win = getCurrentWindow();
                await (win as any).setTheme(isDark ? 'dark' : 'light');
            } catch (e) {
                console.error("Failed to set window theme:", e);
            }
        };
        syncTheme();
    }, [isDark]);

    // ── Receive init data from the main window ──
    useEffect(() => {
        if (!noteId) return;

        const unlistenPromise = once<{ content: string; tags: any[]; notes: any[] }>(
            'note-window-init',
            (event) => {
                const { content, tags, notes } = event.payload;
                useNotesStore.setState({ tags, notes, isInitialized: true });
                setInitialContent(content);
            }
        );

        unlistenPromise.then(() => {
            emit('note-window-ready', { noteId });
        });
    }, [noteId]);

    // ── Content change handler: emit to main window ──
    const handleContentChange = useCallback(async (id: string, html: string, title: string) => {
        emit("note-edited-in-child", { noteId: id, content: html, title });
    }, []);

    // ── Sync tag mutations back to the main window ──
    const noteTags = useNotesStore((s) => s.notes.find(n => n.id === noteId)?.tags);
    const allTags = useNotesStore((s) => s.tags);
    const hasSeeded = useRef(false);

    useEffect(() => {
        if (!noteId || initialContent === null) return;

        if (!hasSeeded.current) {
            hasSeeded.current = true;
            return;
        }

        emit("note-tags-changed-in-child", {
            noteId,
            noteTags: noteTags ?? '[]',
            tags: allTags,
        });
    }, [noteId, noteTags, allTags, initialContent]);

    // ── Redirect navigation to the main window ──
    const handleTagClick = useCallback((tagId: string) => {
        emit("request-main-window-navigation", { path: `/notes?tagId=${tagId}` });
    }, []);

    if (!noteId) return null;

    if (initialContent === null) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-note-bg">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <SidebarProvider>
            <div className="h-screen w-screen bg-note-bg overflow-hidden">
                <NoteEditor
                    noteId={noteId}
                    initialContent={initialContent}
                    onNoteSync={handleContentChange}
                    onTagClick={handleTagClick}
                    isStandalone={true}
                />
            </div>
        </SidebarProvider>
    );
}
