import { useNotesStore, type Tag } from "@annota/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

export function useNoteWindowSync() {
    const updateNoteContent = useNotesStore((s) => s.updateNoteContent);
    const updateNoteMetadata = useNotesStore((s) => s.updateNoteMetadata);

    useEffect(() => {
        // Only listen for child-window edits on the main window
        if (getCurrentWindow().label !== 'main') return;

        const unlisteners: (() => void)[] = [];

        const setupListeners = async () => {
            // 1. Content edits from child windows
            const unContent = await listen<{ noteId: string; content: string; title: string }>(
                "note-edited-in-child",
                (event) => {
                    const { noteId, content, title } = event.payload;
                    updateNoteContent(noteId, content);
                    if (title) {
                        updateNoteMetadata(noteId, { title });
                    }
                }
            );
            unlisteners.push(unContent);

            // 2. Tag mutations from child windows
            const unTags = await listen<{ noteId: string; noteTags: string; tags: Tag[] }>(
                "note-tags-changed-in-child",
                (event) => {
                    const { noteId, noteTags, tags } = event.payload;

                    useNotesStore.setState((state) => ({
                        // Update the note's tags field
                        notes: state.notes.map(n =>
                            n.id === noteId ? { ...n, tags: noteTags } : n
                        ),
                        // Merge any new tags from the child (e.g. newly created tags)
                        tags: mergeTagLists(state.tags, tags),
                    }));
                }
            );
            unlisteners.push(unTags);
        };

        setupListeners();

        return () => {
            unlisteners.forEach(fn => fn());
        };
    }, [updateNoteContent, updateNoteMetadata]);
}

/** Merge child tag list into main, adding new tags without duplicating existing ones. */
function mergeTagLists(existing: Tag[], incoming: Tag[]): Tag[] {
    const existingIds = new Set(existing.map(t => t.id));
    const newTags = incoming.filter(t => !existingIds.has(t.id));
    return newTags.length > 0 ? [...existing, ...newTags] : existing;
}
