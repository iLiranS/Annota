import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getPlatformAdapters } from '@annota/core/platform';
import { join } from '@tauri-apps/api/path';
import {
    Image as ImageIcon,
    Link as LinkIcon,
    Loader2,
    UploadCloud as Upload
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';

interface ToolbarImageUploadProps {
    onInsertImage: (source: 'url' | 'library', value?: string) => Promise<boolean>;
    onOpenChange?: (open: boolean) => void;
    isMenu?: boolean;
    visible?: boolean;
    onClose?: () => void;
}

export function ToolbarImageUpload({ onInsertImage, onOpenChange, isMenu, visible, onClose }: ToolbarImageUploadProps) {
    const [open, setOpen] = useState(false);

    // Sync with visible prop if provided
    const isControlled = visible !== undefined;
    const isVisible = isControlled ? visible : open;
    const [isLoading, setIsLoading] = useState(false);
    const [url, setUrl] = useState('');
    const [tab, setTab] = useState<'upload' | 'url'>('upload');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleOpenChange = (val: boolean) => {
        if (isControlled) {
            if (!val) onClose?.();
            onOpenChange?.(val);
        } else {
            setOpen(val);
            onOpenChange?.(val);
        }

        if (!val) {
            setUrl('');
            setIsLoading(false);
            setTab('upload');
        }
    };

    const handleUrlSubmit = useCallback(async () => {
        if (!url) return;
        setIsLoading(true);
        try {
            const success = await onInsertImage('url', url);
            if (success) {
                handleOpenChange(false);
            }
        } finally {
            setIsLoading(false);
        }
    }, [url, onInsertImage, handleOpenChange]);

    const processFile = useCallback(async (file: File) => {
        setIsLoading(true);
        try {
            const adapters = getPlatformAdapters();
            const bytes = new Uint8Array(await file.arrayBuffer());
            const cacheDir = await adapters.fileSystem.ensureDir('cache');

            const ext = file.name.split('.').pop() || 'png';
            const tempFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const tempPath = await join(cacheDir, tempFilename);

            await adapters.fileSystem.writeBytes(tempPath, bytes);

            const success = await onInsertImage('library', tempPath);
            if (success) {
                handleOpenChange(false);
            }

            // Cleanup temp file (NoteImageService handles persisting to real storage)
            await adapters.fileSystem.deleteFile(tempPath).catch(() => { });
        } catch (error) {
            console.error('[ToolbarImageUpload] Failed to process file:', error);
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [onInsertImage, handleOpenChange]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await processFile(file);
    };

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set to false if we leave the container, not just its children
        if (e.currentTarget === e.target) {
            setIsDragging(false);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "copy"; // Critical for macOS Finder drag
        }
        setIsDragging(true);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        // 1. Try files (local drag and drop) - Use items for better macOS compatibility
        let file: File | null = null;
        if (e.dataTransfer.items?.length) {
            const item = e.dataTransfer.items[0];
            if (item.kind === "file") {
                file = item.getAsFile();
            }
        }

        if (!file && e.dataTransfer.files?.length) {
            file = e.dataTransfer.files[0];
        }

        if (file && file.type.startsWith('image/')) {
            await processFile(file);
            return;
        }

        // 2. Try URL (dragging from browser)
        const droppedUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        if (droppedUrl && (droppedUrl.startsWith('http') || droppedUrl.startsWith('data:image/'))) {
            setTab('url');
            setUrl(droppedUrl);
        }
    }, [processFile]);

    const trigger = isMenu ? (
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setOpen(true)} className="gap-2">
            <ImageIcon className="w-4 h-4" />
            <span>Image</span>
        </DropdownMenuItem>
    ) : (
        <DialogTrigger asChild>
            <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 outline-none"
                style={{
                    borderRadius: '8px'
                }}
            >
                <ImageIcon className="w-5 h-5" />
            </Button>
        </DialogTrigger>
    );

    return (
        <Dialog open={isVisible} onOpenChange={handleOpenChange}>
            {!isControlled && trigger}
            <DialogContent aria-describedby={undefined}
                className="sm:max-w-[400px] p-0 overflow-hidden border-none bg-background shadow-2xl"
                onPointerDownOutside={(e) => {
                    if (isControlled) e.preventDefault();
                }}
            >
                <DialogHeader className="p-4 pb-2 border-b border-border/50">
                    <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-primary" />
                        Insert Image
                    </DialogTitle>
                </DialogHeader>

                <div className="p-4 space-y-4">
                    <div className="flex p-1 bg-muted/30 rounded-lg gap-1">
                        <button
                            onClick={() => setTab('upload')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all",
                                tab === 'upload' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Upload className="h-4 w-4" />
                            Upload
                        </button>
                        <button
                            onClick={() => setTab('url')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all",
                                tab === 'url' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <LinkIcon className="h-4 w-4" />
                            URL
                        </button>
                    </div>

                    {tab === 'upload' ? (
                        <div
                            className={cn(
                                "group relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer",
                                isDragging ? "border-primary bg-primary/10" : "border-muted/50 hover:border-primary/50 hover:bg-primary/5",
                                isLoading && "pointer-events-none opacity-80"
                            )}
                            onClick={() => fileInputRef.current?.click()}
                            onDragEnter={handleDragEnter}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                                disabled={isLoading}
                            />

                            {isLoading ? (
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                    <p className="text-sm font-medium text-muted-foreground">Processing image...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Upload className="h-6 w-6 text-primary" />
                                    </div>
                                    <p className="text-sm font-medium">Click or drag image here</p>
                                    <p className="text-xs text-muted-foreground mt-1 text-center">We'll automatically compress it to WEBP</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Paste Image URL</label>
                                <Input
                                    placeholder="https://example.com/image.png"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    className="h-10 transition-all border-muted focus-visible:ring-primary/20"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleUrlSubmit();
                                    }}
                                    disabled={isLoading}
                                    autoFocus
                                />
                            </div>
                            <Button
                                className="w-full h-10 font-semibold"
                                onClick={handleUrlSubmit}
                                disabled={!url || isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Downloading...
                                    </>
                                ) : (
                                    "Insert from URL"
                                )}
                            </Button>
                        </div>
                    )}
                </div>

                {isDragging && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-primary/10 backdrop-blur-[2px] border-2 border-primary border-dashed rounded-xl m-2 pointer-events-none transition-all">
                        <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 animate-bounce">
                            <Upload className="h-8 w-8 text-primary" />
                        </div>
                        <p className="text-lg font-bold text-primary">Drop to Upload</p>
                        <p className="text-sm text-primary/70">Image files or URLs</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
