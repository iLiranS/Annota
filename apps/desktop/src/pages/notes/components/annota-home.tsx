import { FileCard } from "@/components/notes/file-card";
import { ImageGallery } from "@/components/notes/image-gallery";
import { NoteListItem } from "@/components/notes/note-list-item";
import { Button } from "@/components/ui/button";
import { Ionicons } from "@/components/ui/ionicons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCreateNote } from "@/hooks/use-create-note";
import { useSmartNavigate } from "@/hooks/use-smart-navigate";
import {
    DAILY_NOTES_FOLDER_ID,
    getPaginatedMedia,
    useNavigationStore,
    useNotesStore,
    useUserStore,
    useIsPremium,
    type MediaItem
} from "@annota/core";
import { format } from "date-fns";
import { Calendar, FileText, Folder, History, Loader2, Notebook, Plus, Tag, Globe } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PublishedNotesDialog } from "@/components/notes/published-notes-dialog";


export function AnnotaHome() {
    const navigate = useSmartNavigate();
    const { createAndNavigate } = useCreateNote();
    const { notes, folders, tags, createNote, getFolderById } = useNotesStore();
    const { session, displayName } = useUserStore();
    const { colors } = useAppTheme();
    const setSelectedFolderId = useNavigationStore((s) => s.setSelectedFolderId);
    const setSidebarTab = useNavigationStore((s) => s.setSidebarTab);

    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [mediaLoading, setMediaLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<{ src: string; title: string } | null>(null);
    const isPremium = useIsPremium();
    const [isPublishedModalOpen, setIsPublishedModalOpen] = useState(false);

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
                className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight border shrink-0 cursor-pointer hover:brightness-110 active:scale-95 "
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
        const publishedNotes = notes.filter((n) => n.isPublished && !n.isDeleted);
        return {
            notesCount: activeNotes.length,
            foldersCount: activeFolders.length,
            tagsCount: tags.length,
            publishedCount: publishedNotes.length,
        };
    }, [notes, folders, tags]);

    const publishedNotesList = useMemo(() => {
        return notes.filter((n) => n.isPublished && !n.isDeleted);
    }, [notes]);

    // Recent Notes (up to 4 most recently updated active notes)
    const recentNotes = useMemo(() => {
        return [...notes]
            .filter((n) => !n.isDeleted)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 4);
    }, [notes]);

    // Writing Streak & Monthly Activity Calculation
    const streakData = useMemo(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = new Date(year, month, 1).getDay();

        // Count unique notes active per day in this month
        const dayNotesMap = new Map<number, Set<string>>();
        notes.forEach(note => {
            if (note.isDeleted) return;
            const cDate = new Date(note.createdAt);
            const uDate = new Date(note.updatedAt);

            const addActivity = (dayNum: number, noteId: string) => {
                if (!dayNotesMap.has(dayNum)) {
                    dayNotesMap.set(dayNum, new Set());
                }
                dayNotesMap.get(dayNum)!.add(noteId);
            };

            if (cDate.getFullYear() === year && cDate.getMonth() === month) {
                addActivity(cDate.getDate(), note.id);
            }
            if (uDate.getFullYear() === year && uDate.getMonth() === month) {
                addActivity(uDate.getDate(), note.id);
            }
        });

        const days = Array.from({ length: daysInMonth }, (_, i) => {
            const dayNum = i + 1;
            const count = dayNotesMap.get(dayNum)?.size || 0;
            return {
                day: dayNum,
                count,
                isActive: count > 0,
                date: new Date(year, month, dayNum),
            };
        });

        const noteDates = new Set<string>();
        notes.forEach(n => {
            if (n.isDeleted) return;
            noteDates.add(format(new Date(n.createdAt), "yyyy-MM-dd"));
            noteDates.add(format(new Date(n.updatedAt), "yyyy-MM-dd"));
        });

        const todayStr = format(new Date(), "yyyy-MM-dd");
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = format(yesterday, "yyyy-MM-dd");

        const hasActivityToday = noteDates.has(todayStr);
        const hasActivityYesterday = noteDates.has(yesterdayStr);

        let streak = 0;
        if (hasActivityToday || hasActivityYesterday) {
            let curr = hasActivityToday ? new Date() : yesterday;
            while (true) {
                const dateStr = format(curr, "yyyy-MM-dd");
                if (noteDates.has(dateStr)) {
                    streak++;
                    curr.setDate(curr.getDate() - 1);
                } else {
                    break;
                }
            }
        }

        return {
            days,
            firstDayOfWeek,
            streak,
            totalActiveDays: dayNotesMap.size,
        };
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
            {/* Dashboard Scrollable Workspace */}
            <div className="flex-1 overflow-y-auto premium-scrollbar">
                <div className="max-w-5xl mx-auto w-full p-8 space-y-8">
                    {/* Welcome Banner Card */}
                    <div
                        style={{
                            backgroundColor: `${colors.primary}12`,
                            borderColor: `${colors.primary}30`,
                        }}
                        className="relative overflow-hidden rounded-2xl border p-6 md:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                    >

                        <div className="relative z-10 space-y-1">
                            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-transparent flex items-center gap-2.5">
                                {greeting}{session ? displayName ? `, ${displayName}` : "" : ", " + `${localStorage.getItem('guest_display_name') ?? "Guest"}`}
                            </h2>
                            <p className="text-sm text-muted-foreground/60 max-w-lg font-medium">
                                Capture your next great idea, one note at a time.
                            </p>
                        </div>

                        <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
                            <Button
                                onClick={handleNewNote}
                                style={{
                                    backgroundColor: colors.primary,
                                    color: '#ffffff',
                                }}
                                className="h-9 px-4 font-bold shadow-md transition-all hover:opacity-90 flex items-center gap-2 group/btn border-none"
                            >
                                <Plus className="h-4.5 w-4.5 group-hover/btn:scale-110 transition-transform" />
                                New Note
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleDailyNote}
                                style={{
                                    borderColor: `${colors.primary}40`,
                                    color: colors.primary,
                                }}
                                className="h-9 px-4 font-semibold hover:bg-secondary flex items-center gap-2"
                            >
                                <Calendar className="h-4 w-4" style={{ color: colors.primary }} />
                                <span style={{ color: colors.primary }}>Daily Note</span>
                            </Button>
                        </div>
                    </div>

                    {/* Stats Summary Panel */}
                    <div className={`grid gap-4 ${isPremium ? "grid-cols-4" : "grid-cols-3"}`}>
                        <div className="group/stat bg-card/40 hover:bg-card/75 border border-border/30 rounded-xl p-4 transition-all duration-300 hover:shadow-xs flex items-center gap-4">
                            <div className="p-2.5 rounded-lg bg-[#6366F1]/10 text-[#6366F1] group-hover/stat:scale-105 transition-transform">
                                <Notebook className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Total Notes</p>
                                <p className="text-2xl font-bold tracking-tight mt-0.5 tabular-nums text-foreground">{stats.notesCount}</p>
                            </div>
                        </div>

                        <div className="group/stat bg-card/40 hover:bg-card/75 border border-border/30 rounded-xl p-4 transition-all duration-300 hover:shadow-xs flex items-center gap-4">
                            <div className="p-2.5 rounded-lg bg-[#10B981]/10 text-[#10B981] group-hover/stat:scale-105 transition-transform">
                                <Folder className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Folders</p>
                                <p className="text-2xl font-bold tracking-tight mt-0.5 tabular-nums text-foreground">{stats.foldersCount}</p>
                            </div>
                        </div>

                        <div className="group/stat bg-card/40 hover:bg-card/75 border border-border/30 rounded-xl p-4 transition-all duration-300 hover:shadow-xs flex items-center gap-4">
                            <div className="p-2.5 rounded-lg bg-[#EC4899]/10 text-[#EC4899] group-hover/stat:scale-105 transition-transform">
                                <Tag className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Tags</p>
                                <p className="text-2xl font-bold tracking-tight mt-0.5 tabular-nums text-foreground">{stats.tagsCount}</p>
                            </div>
                        </div>

                        {isPremium && (
                            <div
                                onClick={() => setIsPublishedModalOpen(true)}
                                className="group/stat bg-card/40 hover:bg-card/75 border border-border/30 rounded-xl p-4 transition-all duration-300 hover:shadow-xs flex items-center gap-4 cursor-pointer hover:border-blue-500/30"
                            >
                                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500 group-hover/stat:scale-105 transition-transform">
                                    <Globe className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Published</p>
                                    <p className="text-2xl font-bold tracking-tight mt-0.5 tabular-nums text-foreground">{stats.publishedCount}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Content Section Split: Left (Notes + Activity) and Right (Media) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                        {/* Left Column: Recent Notes + Writing Activity */}
                        <div className="lg:col-span-2 flex flex-col gap-6">
                            {/* Recently Updated Notes */}
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-2 px-1">
                                    <History className="h-4 w-4 text-muted-foreground/80" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Recently Updated</h3>
                                </div>

                                {recentNotes.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border/40 rounded-xl bg-card/10 opacity-60 text-center">
                                        <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                        <p className="text-sm font-medium text-muted-foreground">No notes found</p>
                                        <p className="text-xs text-muted-foreground/50 mt-0.5">Click "New Note" above to get started!</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2 bg-card/15 border border-border/20 rounded-xl p-4">
                                        {recentNotes.map((note, index) => (
                                            <NoteListItem
                                                key={note.id}
                                                note={note}
                                                onClick={() => navigate(`/notes/${note.id}`)}
                                                isInList={true}
                                                suffix={<FolderBadge folderId={note.folderId} noteId={note.id} />}
                                                className="border border-border/50 bg-card/35 hover:bg-primary/5"
                                                isLast={index === recentNotes.length - 1}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Writing Activity */}
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <Ionicons name="flame-outline" size={16} className="text-muted-foreground/80" />
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Writing Activity</h3>
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/40">
                                        {["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][new Date().getMonth()]}
                                    </span>
                                </div>

                                <div className="bg-card/15 border border-border/20 rounded-xl p-5 flex flex-col justify-center items-center">
                                    <div className="w-full max-w-[560px] flex items-end justify-between px-1">
                                        {streakData.days.map((day) => {
                                            const count = day.count || 0;
                                            const activeDots = Math.min(count, 4);
                                            let opacity = 0.15;

                                            if (activeDots === 1) {
                                                opacity = 0.45;
                                            } else if (activeDots === 2) {
                                                opacity = 0.7;
                                            } else if (activeDots === 3) {
                                                opacity = 0.85;
                                            } else if (activeDots === 4) {
                                                opacity = 1.0;
                                            }

                                            return (
                                                <div
                                                    key={day.day}
                                                    className="flex flex-col items-center gap-2 group relative cursor-pointer hover:scale-110 transition-transform duration-200 ease-out"
                                                    title={`${format(day.date, "MMMM d")}: ${count} note${count === 1 ? "" : "s"} active`}
                                                >
                                                    {/* Vertical stack of dots (stretching up) */}
                                                    <div className="flex flex-col-reverse gap-0.5 items-center justify-start h-12">
                                                        {Array.from({ length: 4 }).map((_, idx) => {
                                                            const isActiveDot = idx < activeDots;
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    className="w-2.5 h-2.5 rounded-full transition-all duration-300 group-hover:brightness-110"
                                                                    style={{
                                                                        backgroundColor: isActiveDot ? colors.primary : "var(--border)",
                                                                        opacity: isActiveDot ? opacity : 0.22
                                                                    }}
                                                                />
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Day number */}
                                                    <span className="text-[8px] font-bold tracking-tight text-muted-foreground/35 group-hover:text-primary transition-colors select-none">
                                                        {day.day}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Recent Media & Files */}
                        <div className="lg:col-span-1 flex flex-col gap-4">
                            <div className="flex items-center gap-2 px-1">
                                <Ionicons name="images-outline" size={16} className="text-muted-foreground/80" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Recent Media & Files</h3>
                            </div>

                            <div className="flex-1 bg-card/15 border border-border/20 rounded-xl p-4 flex flex-col justify-start min-h-0">
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
                                    <div className="grid grid-cols-2 gap-2 overflow-y-auto compact-scrollbar flex-1 min-h-0 pr-0.5">
                                        {mediaItems.map((item) => (
                                            <FileCard
                                                key={item.id}
                                                id={item.id}
                                                type={item.fileType}
                                                name={item.localPath}
                                                size={item.sizeBytes}
                                                locations={item.notes}
                                                onNavigate={(noteId) => navigate(`/notes/${noteId}`)}
                                                onSelectImage={(src, title) => setSelectedImage({ src, title })}
                                                showLocations={true}
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

            {/* Published Notes Modal */}
            <PublishedNotesDialog
                open={isPublishedModalOpen}
                onOpenChange={setIsPublishedModalOpen}
                notes={publishedNotesList}
            />
        </div>
    );
}

// RecentMediaCard was replaced by the reusable FileCard component
