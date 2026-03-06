import { DesktopToolbar } from "@/components/editor/DesktopToolbar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useNotesStore } from "@annota/core";
import TipTapEditor, { TipTapEditorRef } from "@annota/tiptap-editor";
import { FileText, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

export default function NoteEditor() {
    const { noteId } = useParams<{ folderId: string; noteId: string }>();
    const notes = useNotesStore((s) => s.notes);
    const getNoteContent = useNotesStore((s) => s.getNoteContent);
    const updateNoteContent = useNotesStore((s) => s.updateNoteContent);
    const note = notes.find((n) => n.id === noteId);
    const { isDark, colors } = useAppTheme();

    const editorRef = useRef<TipTapEditorRef>(null);
    const [initialContent, setInitialContent] = useState<string | null>(null);

    useEffect(() => {
        if (!noteId) return;
        setInitialContent(null);
        getNoteContent(noteId)
            .then((content) => setInitialContent(content || ""))
            .catch((err) => {
                console.error("Failed to load note content", err);
                setInitialContent("");
            });
    }, [noteId, getNoteContent]);

    const handleContentChange = (html: string) => {
        if (!noteId) return;
        // updateNoteContent(noteId, html);
    };

    if (!note) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
                <FileText className="h-16 w-16 text-border" />
                <h2 className="text-xl font-bold tracking-tight">Note not found</h2>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col  w-full min-h-0">
            <div className="flex-1 overflow-hidden relative w-full h-full min-h-0">
                {initialContent !== null ? (
                    <TipTapEditor
                        ref={editorRef}
                        initialContent={initialContent}
                        onContentChange={handleContentChange}
                        editable={true}
                        noteId={noteId}
                        placeholder="Start typing..."
                        renderToolbar={(props) => <DesktopToolbar {...props} />}
                        isDark={isDark}
                        colors={{
                            primary: colors.primary,
                            background: colors.background,
                            text: colors.text
                        }}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>
        </div>
    );
}
