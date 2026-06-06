import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Ionicons } from "@/components/ui/ionicons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useSmartNavigate } from "@/hooks/use-smart-navigate";
import { DAILY_NOTES_FOLDER_ID, NoteMetadata, useNavigationStore, useNotesStore } from "@annota/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Globe } from "lucide-react";

interface PublishedNotesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    notes: NoteMetadata[];
}

export function PublishedNotesDialog({ open, onOpenChange, notes }: PublishedNotesDialogProps) {
    const navigate = useSmartNavigate();
    const { getFolderById } = useNotesStore();
    const setSelectedFolderId = useNavigationStore((s) => s.setSelectedFolderId);
    const setSidebarTab = useNavigationStore((s) => s.setSidebarTab);
    const { colors } = useAppTheme();

    const FolderBadge = ({ folderId, noteId }: { folderId: string | null; noteId: string }) => {
        let folder = folderId ? getFolderById(folderId) : null;
        if (folderId === DAILY_NOTES_FOLDER_ID) {
            folder = {
                id: DAILY_NOTES_FOLDER_ID,
                name: "Daily Notes",
                icon: "calendar",
                color: "#8B5CF6",
            } as any;
        }
        if (!folder && folderId !== null) return null;
        if (!folderId) return null;

        return (
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    if (folder) {
                        setSelectedFolderId(folder.id);
                        setSidebarTab('notes');
                        navigate(`/notes/${noteId}`);
                    }
                }}
                className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight border shrink-0 cursor-pointer hover:brightness-110 active:scale-95"
                style={{
                    backgroundColor: folder?.color ? `${folder.color}20` : `${colors.primary}15`,
                    color: folder?.color || colors.primary,
                    borderColor: folder?.color ? `${folder.color}40` : `${colors.primary}40`
                }}
            >
                <Ionicons name={folder?.icon ? (folder.icon as any) : "folder"} size={9} />
                <span className="truncate max-w-[60px]">{folder?.name || "Notes"}</span>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent disableBlur className="max-w-xl max-h-[80vh] flex flex-col p-6 overflow-hidden bg-background">
                <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b">
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <Globe className="h-5 w-5 text-blue-500" />
                        Published Notes ({notes.length})
                    </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-2 compact-scrollbar">
                    {notes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center opacity-60">
                            <Globe className="h-10 w-10 text-muted-foreground/30 mb-2" />
                            <p className="text-sm font-semibold text-muted-foreground">No published notes</p>
                            <p className="text-xs text-muted-foreground/50 mt-1">Publish notes using the note action menu to see them here.</p>
                        </div>
                    ) : (
                        notes.map((note) => (
                            <div
                                key={note.id}
                                onClick={() => {
                                    onOpenChange(false);
                                    navigate(`/notes/${note.id}`);
                                }}
                                className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/45 hover:bg-primary/5 cursor-pointer transition-colors duration-200"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm truncate text-foreground">{note.title || "Untitled Note"}</p>
                                    <p className="text-xs text-muted-foreground/60 truncate mt-0.5">
                                        {note.preview || "No content preview"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 ml-4 shrink-0">
                                    <FolderBadge folderId={note.folderId} noteId={note.id} />
                                    <a
                                        href={`https://annota.online/notes/${note.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openUrl(`https://annota.online/notes/${note.id}`).catch(err => {
                                                console.error("Failed to open external URL:", err);
                                            });
                                        }}
                                        className="h-8 w-8 rounded-lg hover:bg-secondary border border-transparent hover:border-border text-muted-foreground hover:text-accent-full flex items-center justify-center transition-all duration-200"
                                        title="View Online"
                                    >
                                        <Ionicons name="open-outline" size={16} />
                                    </a>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
