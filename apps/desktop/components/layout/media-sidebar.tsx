import { FileCard } from "@/components/notes/file-card";
import { ImageGallery } from "@/components/notes/image-gallery";
import { useSmartNavigate } from "@/hooks/use-smart-navigate";
import { getPaginatedMedia, useSearchStore, type MediaItem } from "@annota/core";
import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";


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
    const prevQueryRef = useRef<string | null>(null);
    const activeFetchRef = useRef<{ search: string; pageNum: number } | null>(null);

    const fetchMedia = useCallback(async (pageNum: number, search: string, append: boolean = true) => {
        if (append && loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);

        const currentRequest = { search, pageNum };
        activeFetchRef.current = currentRequest;

        try {
            const result = await getPaginatedMedia(pageNum, 20, search);
            
            if (activeFetchRef.current !== currentRequest) return;

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
            if (activeFetchRef.current === currentRequest) {
                loadingRef.current = false;
                setLoading(false);
            }
        }
    }, []);

    // Initial fetch and search debouncing
    useEffect(() => {
        if (prevQueryRef.current === null) {
            prevQueryRef.current = searchQuery;
            pageRef.current = 1;
            setHasMore(true);
            fetchMedia(1, searchQuery, false);
            return;
        }

        if (prevQueryRef.current === searchQuery) {
            return;
        }

        prevQueryRef.current = searchQuery;

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        const triggerFetch = () => {
            pageRef.current = 1;
            setHasMore(true);
            fetchMedia(1, searchQuery, false);
        };

        setLoading(true);
        searchTimeoutRef.current = setTimeout(triggerFetch, 300);

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
                            <FileCard
                                key={item.id}
                                id={item.id}
                                type={item.fileType}
                                name={item.localPath}
                                size={item.sizeBytes}
                                locations={item.notes}
                                onNavigate={(id) => navigateSmart(`/notes/${id}`)}
                                onSelectImage={(src, title) => setSelectedImage({ src, title })}
                                showLocations={true}
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
                                {pageRef.current === 1 ? "Loading media..." : "Loading more..."}
                            </span>
                        </div>
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

// MediaItemCard was replaced by the reusable FileCard component
