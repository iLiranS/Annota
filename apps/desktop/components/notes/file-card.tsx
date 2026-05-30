import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { copyImageToClipboard, writeText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { getPlatformAdapters, resolveLocalUri } from "@annota/core";
import { Copy, FileText, History, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export interface FileLocation {
    noteId: string;
    folderId: string | null;
    noteTitle: string;
    isLatest: boolean;
}

export interface FileCardProps {
    id: string;
    type: string; // 'image', 'pdf', etc.
    name: string; // e.g. localPath
    size?: number | null; // size in bytes
    locations?: FileLocation[]; // note locations / associations
    onNavigate: (noteId: string, folderId: string | null) => void;
    onSelectImage: (src: string, title: string) => void;
    showLocations?: boolean;
    className?: string;
}

export function FileCard({
    id,
    type,
    name,
    size,
    locations = [],
    onNavigate,
    onSelectImage,
    showLocations = true,
    className,
}: FileCardProps) {
    const [imgUrl, setImgUrl] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        let cancelled = false;
        if (type === "image") {
            resolveLocalUri(name).then((absPath) => {
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
    }, [name, type]);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (type === "image") {
            if (imgUrl) {
                await copyImageToClipboard(imgUrl, id);
            } else {
                const adapters = getPlatformAdapters();
                const absPath = await resolveLocalUri(name);
                const url = await adapters.fileSystem.toImageUrl(absPath);
                await copyImageToClipboard(url, id);
            }
        } else {
            const absPath = await resolveLocalUri(name);
            await writeText(absPath);
        }
    };

    const handleCardClick = async () => {
        const adapters = getPlatformAdapters();
        const absPath = await resolveLocalUri(name);
        if (type === "pdf") {
            adapters.fileSystem.openFile(absPath);
        } else if (type === "image" && imgUrl) {
            onSelectImage(imgUrl, name);
        }
    };

    const formatSize = (bytes?: number | null) => {
        if (!bytes) return "0 B";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const isHistoryOnly = locations.length > 0 && locations.every((loc) => !loc.isLatest);

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    onClick={handleCardClick}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    className={cn(
                        "group relative aspect-square bg-sidebar/50 rounded-lg overflow-hidden border border-border/50 hover:border-primary/35 transition-all duration-300 cursor-pointer w-full flex items-center justify-center",
                        className
                    )}
                    title={name}
                >
                    {type === "image" ? (
                        imgUrl ? (
                            <img
                                src={imgUrl}
                                alt={name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                            />
                        ) : (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/20" />
                        )
                    ) : (
                        <div className="flex flex-col items-center gap-1.5 transition-transform duration-300 group-hover:scale-105">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
                                <FileText size={20} />
                            </div>
                        </div>
                    )}

                    {/* History Icon Overlay */}
                    {isHistoryOnly && (
                        <div className="absolute top-1.5 right-1.5 z-10 bg-sidebar border border-orange-500/30 text-orange-500 p-1.5 rounded-md shadow-xs transition-transform duration-300 hover:scale-105">
                            <History className="w-3.5 h-3.5" />
                        </div>
                    )}

                    {/* Hover Metadata Overlay - Bottom Glass Panel */}
                    <div className={cn(
                        "absolute inset-x-1 bg-neutral-950/75 backdrop-blur-[6px] border border-white/10 rounded-md p-1.5 transition-all duration-300 flex flex-col justify-end z-10 shadow-lg",
                        showLocations && locations.length > 0 ? "bottom-[34px]" : "bottom-1",
                        isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
                    )}>
                        <div className="text-[7.5px] font-bold text-white/55 uppercase tracking-wider mb-0.5">
                            {type} • {formatSize(size)}
                        </div>
                        <div className="text-[9px] font-extrabold text-white truncate w-full">
                            {name.split(/[/\\]/).pop()}
                        </div>
                    </div>

                    {/* Note Associations Overlay */}
                    {showLocations && (
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 z-20 flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                            {locations.length === 0 ? (
                                <div className="flex items-center gap-1 bg-black/90 text-white/70 text-[8px] px-1.5 py-0.5 rounded border border-white/10 italic truncate">
                                    <Trash2 size={8} /> Orphaned
                                </div>
                            ) : (
                                <>
                                    {/* First Note */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onNavigate(locations[0].noteId, locations[0].folderId);
                                        }}
                                        className={cn(
                                            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-semibold transition-all duration-200 truncate min-w-0 shadow-xs border cursor-pointer hover:scale-[1.03] active:scale-95",
                                            "bg-black hover:bg-white hover:text-black border-white/15 hover:border-white text-white"
                                        )}
                                        title={locations[0].noteTitle}
                                    >
                                        {!locations[0].isLatest && <History className="w-2 h-2 text-accent-full shrink-0" />}
                                        <span className="truncate">{locations[0].noteTitle}</span>
                                    </button>

                                    {/* Extra Notes Dropdown */}
                                    {locations.length > 1 && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="shrink-0 flex items-center justify-center px-1.5 py-0.5 rounded bg-black hover:bg-white hover:text-black border border-white/15 hover:border-white text-[8px] font-bold text-white transition-all duration-200 cursor-pointer shadow-xs hover:scale-[1.03] active:scale-95"
                                                >
                                                    +{locations.length - 1}
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                {locations.slice(1).map((note) => (
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
                    )}
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
