import { ImageGallery } from "@/components/notes/image-gallery";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSmartNavigate } from "@/hooks/use-smart-navigate";
import { cn } from "@/lib/utils";
import { getPaginatedMedia, getPlatformAdapters, resolveLocalUri, useSearchStore, type MediaItem } from "@annota/core";
import { FileText, History, Loader2, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const ADAPTERS = () => getPlatformAdapters();

export function MediaSidebar() {
    const [items, setItems] = useState<MediaItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const { searchQuery } = useSearchStore();
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [selectedImage, setSelectedImage] = useState<{ src: string, title: string } | null>(null);
    const navigateSmart = useSmartNavigate();

    const loaderRef = useRef<HTMLDivElement>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const loadingRef = useRef(false);
    const pageRef = useRef(1);
    const isInitialMount = useRef(true);

    const fetchMedia = useCallback(async (pageNum: number, search: string, append: boolean = true) => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        try {
            const result = await getPaginatedMedia(pageNum, 20, search);
            if (append) {
                setItems(prev => [...prev, ...result.items]);
            } else {
                setItems(result.items);
            }
            setTotalCount(result.totalCount);
            setHasMore(result.hasMore);
        } catch (error) {
            console.error("Failed to fetch media:", error);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, []);

    // Initial fetch and search debouncing
    useEffect(() => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        const triggerFetch = () => {
            pageRef.current = 1;
            setHasMore(true);
            fetchMedia(1, searchQuery, false);
        };

        if (isInitialMount.current) {
            isInitialMount.current = false;
            triggerFetch();
        } else {
            setLoading(true);
            searchTimeoutRef.current = setTimeout(triggerFetch, 300);
        }

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery, fetchMedia]);

    // Infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !loadingRef.current && items.length > 0) {
                pageRef.current += 1;
                fetchMedia(pageRef.current, searchQuery, true);
            }
        }, { threshold: 0.1 });

        if (loaderRef.current) {
            observer.observe(loaderRef.current);
        }

        return () => observer.disconnect();
    }, [hasMore, searchQuery, fetchMedia, items.length]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Media Grid */}
            <div className="flex-1 overflow-y-auto px-2 pb-4 premium-scrollbar">
                {items.length > 0 && (
                    <div className="flex items-center justify-between px-1 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                            {totalCount} {totalCount === 1 ? 'Item' : 'Items'} Found
                        </span>
                    </div>
                )}
                {items.length === 0 && !loading && !hasMore ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                            <Search size={20} className="text-muted-foreground" />
                        </div>
                        <p className="text-[11px] font-medium max-w-[150px]">
                            {searchQuery ? "No media found for this search" : "Your media library is empty"}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(85px,1fr))] gap-2">
                        {items.map((item) => (
                            <MediaItemCard
                                key={item.id}
                                item={item}
                                onNavigate={(id, folderId) => navigateSmart(`/notes/${folderId || 'root'}/${id}`)}
                                onSelectImage={(src, title) => setSelectedImage({ src, title })}
                            />
                        ))}
                    </div>
                )}

                {/* Loading indicator / Intersection trigger */}
                <div ref={loaderRef} className="py-8 flex justify-center w-full min-h-[50px]">
                    {loading && (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin text-primary/40" />
                            <span className="text-[10px] font-medium text-muted-foreground/40">
                                {items.length === 0 ? "Loading media..." : "Loading more..."}
                            </span>
                        </div>
                    )}
                    {!hasMore && items.length > 0 && (
                        <div className="h-px w-full bg-linear-to-r from-transparent via-border/40 to-transparent" />
                    )}
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

function MediaItemCard({ item, onNavigate, onSelectImage }: {
    item: MediaItem,
    onNavigate: (noteId: string, folderId: string | null) => void,
    onSelectImage: (src: string, title: string) => void
}) {
    const [imgUrl, setImgUrl] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const adapters = ADAPTERS();
        if (item.fileType === 'image') {
            resolveLocalUri(item.localPath).then(absPath => {
                if (cancelled) return;
                adapters.fileSystem.toImageUrl(absPath).then(url => {
                    if (!cancelled) setImgUrl(url);
                });
            });
        }
        return () => { cancelled = true; };
    }, [item.localPath, item.fileType]);

    const handleCardClick = async () => {
        const adapters = ADAPTERS();
        const absPath = await resolveLocalUri(item.localPath);

        if (item.fileType === 'pdf') {
            adapters.fileSystem.openFile(absPath);
        } else if (item.fileType === 'image' && imgUrl) {
            onSelectImage(imgUrl, item.localPath);
        }
    };

    const formatSize = (bytes?: number) => {
        if (!bytes) return "0 B";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const isHistoryOnly = item.notes.length > 0 && item.notes.every(n => !n.isLatest);

    return (
        <div
            className="group relative aspect-square bg-sidebar/50 rounded-lg overflow-hidden border border-border/50 hover:border-primary/30 transition-all cursor-pointer w-full flex items-center justify-center"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleCardClick}
        >
            {item.fileType === 'image' ? (
                imgUrl ? (
                    <img
                        src={imgUrl}
                        alt={item.localPath}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                    />
                ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/20" />
                )
            ) : (
                <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <FileText size={20} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-tighter text-primary/60">PDF</span>
                </div>
            )}

            {/* History Badge Overlay */}
            {isHistoryOnly && (
                <div className="absolute top-2 left-2 z-10">
                    <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-[8px] h-4 px-1.5 font-bold backdrop-blur-md">
                        HISTORY ONLY
                    </Badge>
                </div>
            )}

            {/* Hover Metadata Overlay */}
            <div className={cn(
                "absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 flex flex-col justify-end p-2 pb-8 z-10",
                isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
            )}>
                <div className="text-[8px] font-medium text-white/60 mb-0.5">
                    {item.fileType.toUpperCase()} • {formatSize(item.sizeBytes || 0)}
                </div>
                <div className="text-[9px] font-bold text-white truncate w-full">
                    {item.localPath}
                </div>
            </div>

            {/* Note Associations Overlay */}
            <div className="absolute bottom-1.5 left-1.5 right-1.5 z-20 flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                {item.notes.length === 0 ? (
                    <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md text-white/70 text-[8px] px-1.5 py-0.5 rounded border border-white/10 italic truncate">
                        <Trash2 size={8} /> Orphaned
                    </div>
                ) : (
                    <>
                        {/* First Note */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onNavigate(item.notes[0].noteId, item.notes[0].folderId);
                            }}
                            className={cn(
                                "flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-semibold transition-all duration-200 truncate min-w-0 shadow-xs border cursor-pointer hover:scale-[1.03] active:scale-95",
                                item.notes[0].isLatest
                                    ? "bg-black/65 hover:bg-white hover:text-black border-white/15 hover:border-white text-white backdrop-blur-xs"
                                    : "bg-muted/75 hover:bg-white hover:text-black border-border/45 hover:border-white text-muted-foreground"
                            )}
                            title={item.notes[0].noteTitle}
                        >
                            {!item.notes[0].isLatest && <History className="w-2 h-2 text-accent-full shrink-0" />}
                            <span className="truncate">{item.notes[0].noteTitle}</span>
                        </button>

                        {/* Extra Notes Dropdown */}
                        {item.notes.length > 1 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        onClick={(e) => e.stopPropagation()}
                                        className="shrink-0 flex items-center justify-center px-1.5 py-0.5 rounded bg-black/65 hover:bg-white hover:text-black border border-white/15 hover:border-white text-[8px] font-bold text-white backdrop-blur-xs transition-all duration-200 cursor-pointer shadow-xs hover:scale-[1.03] active:scale-95"
                                    >
                                        +{item.notes.length - 1}
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    {item.notes.slice(1).map((note) => (
                                        <DropdownMenuItem
                                            key={note.noteId}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onNavigate(note.noteId, note.folderId);
                                            }}
                                            className="flex items-center gap-2 text-xs"
                                        >
                                            {!note.isLatest && <History className="w-3.5 h-3.5 text-accent-full" />}
                                            <span className={cn("truncate", !note.isLatest && "opacity-60")}>
                                                {note.noteTitle}
                                            </span>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
