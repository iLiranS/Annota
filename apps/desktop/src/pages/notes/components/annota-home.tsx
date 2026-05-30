import { ImageGallery } from "@/components/notes/image-gallery";
import { NoteListItem } from "@/components/notes/note-list-item";
import { Button } from "@/components/ui/button";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Ionicons } from "@/components/ui/ionicons";
import { useCreateNote } from "@/hooks/use-create-note";
import { useSmartNavigate } from "@/hooks/use-smart-navigate";
import { copyImageToClipboard, writeText } from "@/lib/clipboard";
import {
    DAILY_NOTES_FOLDER_ID,
    getPaginatedMedia,
    getPlatformAdapters,
    resolveLocalUri,
    useNotesStore,
    useUserStore,
    type MediaItem
} from "@annota/core";
import { format } from "date-fns";
import { BookOpen, Calendar, Copy, FileText, History, Home, Layers, Loader2, Plus, Tags } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";


export function AnnotaHome() {
    const navigate = useSmartNavigate();
    const { createAndNavigate } = useCreateNote();
    const { notes, folders, tags, createNote } = useNotesStore();
    const displayName = useUserStore((s) => s.displayName);

    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [mediaLoading, setMediaLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<{ src: string; title: string } | null>(null);

    // Fetch recent media
    useEffect(() => {
        let cancelled = false;
        getPaginatedMedia(1, 6, "")
            .then((res) => {
                if (!cancelled) {
                    setMediaItems(res.items);
                    setMediaLoading(false);
                }
            })
            .catch((err) => {
                console.error("[Home] Failed to load media:", err);
                if (!cancelled) setMediaLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Time-based Greeting
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    }, []);

    // Statistics Calculation
    const stats = useMemo(() => {
        const activeNotes = notes.filter((n) => !n.isDeleted);
        const activeFolders = folders.filter((f) => !f.isDeleted);
        return {
            notesCount: activeNotes.length,
            foldersCount: activeFolders.length,
            tagsCount: tags.length,
        };
    }, [notes, folders, tags]);

    // Recent Notes (up to 4 most recently updated active notes)
    const recentNotes = useMemo(() => {
        return [...notes]
            .filter((n) => !n.isDeleted)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 4);
    }, [notes]);

    // Create a new note in root folder
    const handleNewNote = () => {
        createAndNavigate("");
    };

    // Navigate or create today's daily note
    const handleDailyNote = async () => {
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const existing = notes.find(
            (n) =>
                n.folderId === DAILY_NOTES_FOLDER_ID &&
                !n.isDeleted &&
                format(new Date(n.createdAt), "yyyy-MM-dd") === todayStr
        );

        if (existing) {
            navigate(`/notes/${existing.id}`);
        } else {
            const { data: newNote, error } = await createNote({ folderId: DAILY_NOTES_FOLDER_ID });
            if (error) {
                toast.error(error);
                return;
            }
            if (newNote) {
                navigate(`/notes/${newNote.id}`);
            }
        }
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-note-bg select-none">
            {/* Elegant Header */}
            <div className="sticky top-0 z-10 px-8 py-4 border-b border-border bg-background/50 backdrop-blur-md">
                <div className="w-full flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-accent-full/10 text-accent-full">
                            <Home className="h-4.5 w-4.5" style={{ color: "var(--accent-full)" }} />
                        </div>
                        <h1 className="text-lg font-bold tracking-tight">Annota Workspace</h1>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60 font-medium">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{format(new Date(), "EEEE, MMMM d")}</span>
                    </div>
                </div>
            </div>

            {/* Dashboard Scrollable Workspace */}
            <div className="flex-1 overflow-y-auto premium-scrollbar">
                <div className="max-w-5xl mx-auto w-full p-8 space-y-8">
                    {/* Welcome Banner Card */}
                    <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-linear-to-r from-violet-600/10 via-indigo-600/10 to-pink-600/10 p-6 md:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">

                        <div className="relative z-10 space-y-1">
                            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-transparent flex items-center gap-2.5">
                                {greeting}{displayName ? `, ${displayName}` : ""}
                            </h2>
                            <p className="text-sm text-muted-foreground/90 max-w-lg font-medium">
                                Keep track of your learnings, capture fleeting inspirations, and build your digital knowledge base with ease.
                            </p>
                        </div>

                        <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
                            <Button
                                onClick={handleNewNote}
                                className="h-9 px-4 font-bold shadow-md shadow-primary/10 transition-all hover:shadow-lg hover:shadow-primary/15 bg-primary text-primary-foreground hover:bg-primary/95 flex items-center gap-2 group/btn"
                            >
                                <Plus className="h-4.5 w-4.5 group-hover/btn:scale-110 transition-transform" />
                                New Note
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleDailyNote}
                                className="h-9 px-4 font-semibold hover:bg-secondary hover:text-primary  flex items-center gap-2"
                            >
                                <Calendar className="h-4 w-4" />
                                Daily Note
                            </Button>
                        </div>
                    </div>

                    {/* Stats Summary Panel */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="group/stat bg-card/40 hover:bg-card/75 border border-border/30 rounded-xl p-4 transition-all duration-300 hover:shadow-xs flex items-center gap-4">
                            <div className="p-2.5 rounded-lg bg-[#6366F1]/10 text-[#6366F1] group-hover/stat:scale-105 transition-transform">
                                <BookOpen className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Total Notes</p>
                                <p className="text-2xl font-bold tracking-tight mt-0.5 tabular-nums text-foreground">{stats.notesCount}</p>
                            </div>
                        </div>

                        <div className="group/stat bg-card/40 hover:bg-card/75 border border-border/30 rounded-xl p-4 transition-all duration-300 hover:shadow-xs flex items-center gap-4">
                            <div className="p-2.5 rounded-lg bg-[#10B981]/10 text-[#10B981] group-hover/stat:scale-105 transition-transform">
                                <Layers className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Folders</p>
                                <p className="text-2xl font-bold tracking-tight mt-0.5 tabular-nums text-foreground">{stats.foldersCount}</p>
                            </div>
                        </div>

                        <div className="group/stat bg-card/40 hover:bg-card/75 border border-border/30 rounded-xl p-4 transition-all duration-300 hover:shadow-xs flex items-center gap-4">
                            <div className="p-2.5 rounded-lg bg-[#EC4899]/10 text-[#EC4899] group-hover/stat:scale-105 transition-transform">
                                <Tags className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Tags</p>
                                <p className="text-2xl font-bold tracking-tight mt-0.5 tabular-nums text-foreground">{stats.tagsCount}</p>
                            </div>
                        </div>
                    </div>

                    {/* Content Section Split: Recent Notes and Recent Files */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* 2/3 Column: Recent Notes */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <History className="h-4 w-4 text-muted-foreground/80" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Recently Updated Notes</h3>
                            </div>

                            {recentNotes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border/40 rounded-xl bg-card/10 opacity-60 text-center">
                                    <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                    <p className="text-sm font-medium text-muted-foreground">No notes found</p>
                                    <p className="text-xs text-muted-foreground/50 mt-0.5">Click "New Note" above to get started!</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 bg-card/15 border border-border/20 rounded-xl p-4">
                                    {recentNotes.map((note) => (
                                        <NoteListItem
                                            key={note.id}
                                            note={note}
                                            onClick={() => navigate(`/notes/${note.id}`)}
                                            className="border border-border/50 bg-card/35 hover:bg-primary/5"
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 1/3 Column: Recent Files / Media */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <Ionicons name="images-outline" size={16} className="text-muted-foreground/80" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Recent Media & Files</h3>
                            </div>

                            <div className="bg-card/15 border border-border/20 rounded-xl p-4  flex flex-col justify-start">
                                {mediaLoading ? (
                                    <div className="flex-1 flex flex-col items-center justify-center gap-2 opacity-60">
                                        <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
                                        <span className="text-xs font-medium text-muted-foreground/50">Loading files...</span>
                                    </div>
                                ) : mediaItems.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center opacity-65 text-center px-4">
                                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-2 text-muted-foreground/30">
                                            <Ionicons name="document-attach-outline" size={20} />
                                        </div>
                                        <p className="text-xs font-bold text-muted-foreground">No media assets</p>
                                        <p className="text-[10px] text-muted-foreground/50 mt-0.5 max-w-[170px]">
                                            Images and files attached to notes will appear here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-2 overflow-y-auto compact-scrollbar max-h-full pr-0.5">
                                        {mediaItems.map((item) => (
                                            <RecentMediaCard
                                                key={item.id}
                                                item={item}
                                                onSelectImage={(src, title) => setSelectedImage({ src, title })}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Image Preview Overlay */}
            <ImageGallery
                images={selectedImage ? [{
                    src: selectedImage.src,
                    width: 0,
                    position: 0
                } as any] : []}
                initialIndex={0}
                visible={!!selectedImage}
                onClose={() => setSelectedImage(null)}
                onNavigate={() => { }}
            />
        </div>
    );
}

function RecentMediaCard({
    item,
    onSelectImage,
}: {
    item: MediaItem;
    onSelectImage: (src: string, title: string) => void;
}) {
    const [imgUrl, setImgUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (item.fileType === "image") {
            resolveLocalUri(item.localPath).then((absPath) => {
                if (cancelled) return;
                getPlatformAdapters()
                    .fileSystem.toImageUrl(absPath)
                    .then((url) => {
                        if (!cancelled) setImgUrl(url);
                    });
            });
        }
        return () => {
            cancelled = true;
        };
    }, [item.localPath, item.fileType]);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (item.fileType === "image") {
            if (imgUrl) {
                await copyImageToClipboard(imgUrl, item.id);
            } else {
                const adapters = getPlatformAdapters();
                const absPath = await resolveLocalUri(item.localPath);
                const url = await adapters.fileSystem.toImageUrl(absPath);
                await copyImageToClipboard(url, item.id);
            }
        } else {
            const absPath = await resolveLocalUri(item.localPath);
            await writeText(absPath);
        }
    };

    const handleCardClick = async () => {
        const adapters = getPlatformAdapters();
        const absPath = await resolveLocalUri(item.localPath);
        if (item.fileType === "pdf") {
            adapters.fileSystem.openFile(absPath);
        } else if (item.fileType === "image" && imgUrl) {
            onSelectImage(imgUrl, item.localPath);
        }
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    onClick={handleCardClick}
                    className="group relative aspect-square bg-background/60 rounded-lg overflow-hidden border border-border/40 hover:border-primary/30 transition-all cursor-pointer w-full flex items-center justify-center"
                    title={item.localPath}
                >
                    {item.fileType === "image" ? (
                        imgUrl ? (
                            <img
                                src={imgUrl}
                                alt={item.localPath}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-108"
                                loading="lazy"
                            />
                        ) : (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/20" />
                        )
                    ) : (
                        <div className="flex flex-col items-center gap-0.5">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                                <FileText size={16} />
                            </div>
                        </div>
                    )}

                    {/* Hover overlay for basic info */}
                    <div className="absolute inset-0 bg-black/90 transition-opacity duration-300 opacity-0 group-hover:opacity-100 flex flex-col justify-end p-1.5 pb-2 text-white">
                        <span className="text-[7px] font-bold text-white/55 uppercase tracking-wide">
                            {item.fileType}
                        </span>
                        <span className="text-[8px] font-bold truncate w-full">
                            {item.localPath.split(/[/\\]/).pop()}
                        </span>
                    </div>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-40">
                <ContextMenuItem onClick={handleCopy}>
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    <span>Copy</span>
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}
