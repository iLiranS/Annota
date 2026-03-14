import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useNotesStore } from "@annota/core";
import TipTapEditor from "@annota/tiptap-editor";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { NoteMetadata } from "@annota/core";
import { useNavigate } from "react-router-dom";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ImageGallery } from "./image-gallery";
import { Button } from "../ui/button";
import { Ionicons } from "../ui/ionicons";

interface NotePreviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    note: NoteMetadata;
    onExpand?: (note: NoteMetadata) => void;
}

export function NotePreviewModal({
    open,
    onOpenChange,
    note,
    onExpand,
}: NotePreviewModalProps) {
    const [content, setContent] = useState<string | null>(null);
    const navigate = useNavigate();
    const getNoteContent = useNotesStore((s) => s.getNoteContent);
    const { isDark, colors } = useAppTheme();

    const handleExpand = () => {
        if (onExpand) {
            onExpand(note);
        } else {
            const folderId = note.folderId || "root";
            navigate(`/notes/${folderId}/${note.id}`);
            onOpenChange(false);
        }
    };

    useEffect(() => {
        if (open && note.id) {
            setContent(null);
            getNoteContent(note.id)
                .then((c) => setContent(c || ""))
                .catch((err) => {
                    console.error("Failed to load note content for preview", err);
                    setContent("");
                });
        }
    }, [open, note.id, getNoteContent]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden bg-background">
                <DialogHeader className="px-6 py-3 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
                    <DialogTitle className="truncate pr-8 text-lg font-bold">
                        {note.title || "Untitled Note"}
                    </DialogTitle>
                    <div className="flex items-center gap-2 pr-6">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full hover:bg-accent hover:text-primary transition-colors"
                            onClick={handleExpand}
                            title="Open in full editor"
                        >
                            <Ionicons name="expand-outline" size={18} />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto relative min-h-0 custom-scrollbar overscroll-none">
                    {content !== null ? (
                        <div className="p-4 pt-16">
                            <TipTapEditor
                                initialContent={content}
                                editable={false}
                                noteId={note.id}
                                isDark={isDark}
                                colors={{
                                    primary: colors.primary,
                                    background: colors.background,
                                    text: colors.text
                                }}
                                renderImageGallery={(props) => <ImageGallery {...props} />}
                            />
                        </div>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
