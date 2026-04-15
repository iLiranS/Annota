import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useAppTheme } from "@/hooks/use-app-theme";
import { cn } from "@/lib/utils";
import { NoteMetadata, useNotesStore } from "@annota/core";
import TipTapEditor from "@annota/editor-ui";
import { format } from "date-fns";
import { AlertCircle, Clock, History, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface VersionHistoryDialogProps {
    note: NoteMetadata;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRevert?: (content: string) => void;
}

interface Version {
    id: string;
    createdAt: Date;
    content?: string;
}

export function VersionHistoryDialog({ note, open, onOpenChange, onRevert }: VersionHistoryDialogProps) {
    const { getNoteVersions, getNoteVersion, revertNote, deleteNoteVersion, deleteAllVersionsExceptLatest } = useNotesStore();
    const { isDark, colors } = useAppTheme();

    const [versions, setVersions] = useState<Version[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);

    const loadVersions = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getNoteVersions(note.id);
            setVersions(data);
            if (data.length > 0) {
                setSelectedVersionId(data[0].id);
            }
        } catch (error) {
            console.error("Failed to load versions:", error);
        } finally {
            setIsLoading(false);
        }
    }, [note.id, getNoteVersions]);

    useEffect(() => {
        if (open) {
            setSelectedVersionId(null);
            setSelectedVersion(null);
            loadVersions();
        }
    }, [open, note.id, loadVersions]);

    useEffect(() => {
        if (selectedVersionId) {
            getNoteVersion(selectedVersionId).then((data) => {
                setSelectedVersion(data as Version);
            });
        }
    }, [selectedVersionId, getNoteVersion]);

    const handleRevert = async () => {
        if (!selectedVersionId || !selectedVersion) return;
        setIsActionLoading(true);
        try {
            await revertNote(note.id, selectedVersionId);
            onRevert?.(selectedVersion.content || "");
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to revert note:", error);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDeleteVersion = async (versionId: string) => {
        setIsActionLoading(true);
        try {
            await deleteNoteVersion(note.id, versionId);
            const updatedVersions = versions.filter(v => v.id !== versionId);
            setVersions(updatedVersions);
            if (selectedVersionId === versionId) {
                setSelectedVersionId(updatedVersions.length > 0 ? updatedVersions[0].id : null);
            }
        } catch (error) {
            console.error("Failed to delete version:", error);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleClearHistory = async () => {
        setIsActionLoading(true);
        try {
            await deleteAllVersionsExceptLatest(note.id);
            const data = await getNoteVersions(note.id);
            setVersions(data);
            if (data.length > 0) {
                setSelectedVersionId(data[0].id);
            }
        } catch (error) {
            console.error("Failed to clear history:", error);
        } finally {
            setIsActionLoading(false);
        }
    };

    const isLatest = versions.length > 0 && selectedVersionId === versions[0].id;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-5xl h-[80vh] min-h-[600px] w-[95vw] gap-0 overflow-hidden p-0 shadow-2xl flex flex-col"
            >
                <DialogHeader className="px-6 py-4 shrink-0 flex flex-row items-center justify-between border-b bg-background/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10">
                            <History className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg">Version History</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                {versions.length} versions available for this note
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex flex-1 min-h-0 bg-background">
                    {/* Left Sidebar - Version List */}
                    <div className="w-[300px] flex flex-col border-r border-border bg-muted/20">
                        <div className="p-3 border-b flex items-center justify-between bg-muted/30">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Timeline</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] gap-1.5 px-2 hover:bg-destructive/10 hover:text-destructive"
                                onClick={handleClearHistory}
                                disabled={versions.length <= 1 || isActionLoading}
                            >
                                <Trash2 className="h-3 w-3" />
                                Clear History
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto premium-scrollbar">
                            <div className="p-2 space-y-1">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-50">
                                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
                                        <span className="text-xs">Loading versions...</span>
                                    </div>
                                ) : versions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-50">
                                        <AlertCircle className="h-8 w-8 text-muted-foreground" />
                                        <span className="text-xs">No version history found</span>
                                    </div>
                                ) : (
                                    versions.map((v, index) => (
                                        <div
                                            key={v.id}
                                            className={cn(
                                                "group relative flex flex-col items-start gap-1 rounded-xl px-4 py-3 text-left transition-all cursor-pointer border border-transparent mb-1",
                                                selectedVersionId === v.id
                                                    ? "bg-accent shadow-sm border-border"
                                                    : "hover:bg-accent/40"
                                            )}
                                            onClick={() => setSelectedVersionId(v.id)}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-2">
                                                    <Clock className={cn("h-3.5 w-3.5", selectedVersionId === v.id ? "text-primary" : "text-muted-foreground")} />
                                                    <span className={cn("text-xs font-semibold", selectedVersionId === v.id ? "text-foreground" : "text-muted-foreground")}>
                                                        {format(new Date(v.createdAt), "MMM d, yyyy")}
                                                    </span>
                                                </div>
                                                {index === 0 && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase">Current</span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between w-full mt-1">
                                                <span className="text-[11px] text-muted-foreground/80 font-medium tabular-nums">
                                                    {format(new Date(v.createdAt), "h:mm:ss a")}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                        "h-6 w-6 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all",
                                                        index === 0 && "hidden" // Cannot delete current version
                                                    )}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteVersion(v.id);
                                                    }}
                                                    disabled={isActionLoading}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Content - Version Preview */}
                    <div className="flex-1 flex flex-col relative bg-background min-h-0 overflow-hidden">
                        {selectedVersion ? (
                            <>
                                <div className="absolute top-4 right-6 z-20">
                                    <Button
                                        onClick={handleRevert}
                                        disabled={isLatest || isActionLoading}
                                        variant="secondary"
                                        className="h-8 gap-2 rounded-lg text-xs font-semibold shadow-md bg-background/80 backdrop-blur-md border border-border/50 hover:bg-background"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Revert to this version
                                    </Button>
                                </div>

                                <TipTapEditor
                                    key={selectedVersion.id}
                                    initialContent={selectedVersion.content || ""}
                                    editable={false}
                                    isDark={isDark}
                                    placeholder=""
                                    contentPaddingTop={60} // Add space for the floating button
                                    noteId={note.id}
                                    colors={{
                                        primary: colors.primary,
                                        background: colors.background,
                                        text: colors.text
                                    }}
                                />
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center opacity-30 select-none">
                                <History className="h-16 w-16 mb-4" />
                                <h3 className="text-lg font-semibold tracking-tight">Select a version to preview</h3>
                                <p className="text-sm">Browse the timeline on the left to see past states.</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
