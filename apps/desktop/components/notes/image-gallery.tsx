import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ImageInfo } from '@annota/editor-ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ImageGalleryProps {
    images: ImageInfo[];
    initialIndex: number;
    visible: boolean;
    onClose: () => void;
    onNavigate: (index: number) => void;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
    images,
    initialIndex,
    visible,
    onClose,
    onNavigate
}) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isZoomed, setIsZoomed] = useState(false);
    const [zoomPoint, setZoomPoint] = useState({ x: 50, y: 50 });
    const zoomPointRef = useRef({ x: 50, y: 50 });
    const [isDragging, setIsDragging] = useState(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const hasMoved = useRef(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        setIsZoomed(false);
        setIsDragging(false);
        zoomPointRef.current = { x: 50, y: 50 };
        setZoomPoint({ x: 50, y: 50 });
    }, [currentIndex, visible]);

    useEffect(() => {
        const handleGlobalMouseUp = () => setIsDragging(false);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    useEffect(() => {
        if (visible) {
            setCurrentIndex(initialIndex);
        }
    }, [visible, initialIndex]);

    const handlePrevious = useCallback(() => {
        if (images.length === 0) return;
        setIsZoomed(false);
        setIsDragging(false);
        hasMoved.current = false;
        zoomPointRef.current = { x: 50, y: 50 };
        setZoomPoint({ x: 50, y: 50 });
        const newIndex = (currentIndex - 1 + images.length) % images.length;
        setCurrentIndex(newIndex);
        if (onNavigate) onNavigate(newIndex);
    }, [currentIndex, images.length, onNavigate]);

    const handleNext = useCallback(() => {
        if (images.length === 0) return;
        setIsZoomed(false);
        setIsDragging(false);
        hasMoved.current = false;
        zoomPointRef.current = { x: 50, y: 50 };
        setZoomPoint({ x: 50, y: 50 });
        const newIndex = (currentIndex + 1) % images.length;
        setCurrentIndex(newIndex);
        if (onNavigate) onNavigate(newIndex);
    }, [currentIndex, images.length, onNavigate]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!visible) return;
            if (e.key === 'ArrowLeft') {
                handlePrevious();
            } else if (e.key === 'ArrowRight') {
                handleNext();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visible, handlePrevious, handleNext, onClose]);

    if (!visible || images.length === 0) return null;

    const currentImage = images[currentIndex];

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isZoomed || !imgRef.current) return;
        setIsDragging(true);
        lastPos.current = { x: e.clientX, y: e.clientY };
        hasMoved.current = false;
        e.preventDefault();
        e.stopPropagation();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !imgRef.current) return;
        
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;

        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            hasMoved.current = true;
        }

        const rect = imgRef.current.getBoundingClientRect();
        const scale = 2.5;
        // Increased sensitivity for a more "impactful" move feeling
        const sensitivity = 1.2 / (scale - 1);

        // Update ref immediately for performance (bypass React re-render)
        zoomPointRef.current = {
            x: Math.max(0, Math.min(100, zoomPointRef.current.x - (dx / rect.width * 100) * sensitivity)),
            y: Math.max(0, Math.min(100, zoomPointRef.current.y - (dy / rect.height * 100) * sensitivity)),
        };

        // Direct DOM update for silky smooth panning
        imgRef.current.style.transformOrigin = `${zoomPointRef.current.x}% ${zoomPointRef.current.y}%`;

        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);
            // Sync React state back on release so it's consistent
            setZoomPoint({ ...zoomPointRef.current });
        }
    };

    const handleImageClick = (e: React.MouseEvent) => {
        if (hasMoved.current) return;

        if (isZoomed) {
            setIsZoomed(false);
            return;
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        zoomPointRef.current = { x, y };
        setZoomPoint({ x, y });
        setIsZoomed(true);
    };

    return (
        <Dialog open={visible} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                onClick={onClose}
                className="max-w-[100vw] w-screen h-screen p-0 border-none bg-black/95 flex flex-col items-center justify-center outline-none animate-in fade-in duration-500
                *:data-[slot=dialog-close]:text-white/70 *:data-[slot=dialog-close]:hover:text-white *:data-[slot=dialog-close]:bg-white/5 *:data-[slot=dialog-close]:hover:bg-white/10 *:data-[slot=dialog-close]:p-2.5 *:data-[slot=dialog-close]:rounded-full *:data-[slot=dialog-close]:top-6 *:data-[slot=dialog-close]:right-6 *:data-[slot=dialog-close]:backdrop-blur-xl *:data-[slot=dialog-close]:border *:data-[slot=dialog-close]:border-white/10 *:data-[slot=dialog-close]:transition-all *:data-[slot=dialog-close]:z-70"
            >
                <DialogTitle className="sr-only">Image Gallery</DialogTitle>
                <DialogDescription className="sr-only">
                    View images in full screen. Use arrow keys to navigate.
                </DialogDescription>

                {/* Counter Overlay */}
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-6 left-6 z-60 text-white/90 font-medium text-xs tracking-wider uppercase select-none bg-white/5 px-4 py-2.5 rounded-full backdrop-blur-xl border border-white/10 shadow-2xl transition-all hover:bg-white/10"
                >
                    {currentIndex + 1} <span className="opacity-40 mx-1">/</span> {images.length}
                </div>

                {/* Main Content Area */}
                <div className="relative w-full h-full flex items-center justify-center p-8 md:p-12 lg:p-16 overflow-hidden pointer-events-none">
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative group flex items-center justify-center max-w-full max-h-full pointer-events-auto"
                    >
                        {/* Subtle Glow behind image */}
                        <div className="absolute inset-0 bg-primary/10 blur-[120px] rounded-full opacity-30 pointer-events-none" />

                        <img
                            ref={imgRef}
                            key={currentImage.src}
                            src={currentImage.src}
                            alt={`Image ${currentIndex + 1}`}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onClick={handleImageClick}
                            draggable={false}
                            className={`max-w-full max-h-[85vh] md:max-h-[80vh] object-contain select-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] rounded-sm animate-in zoom-in-95 duration-500 pointer-events-auto will-change-transform
                                ${isDragging ? 'transition-none' : 'transition-transform duration-300'}`}
                            style={{
                                transformOrigin: `${zoomPoint.x}% ${zoomPoint.y}%`,
                                transform: isZoomed ? 'scale(2.5)' : 'scale(1)',
                                cursor: isZoomed ? (isDragging ? 'grabbing' : 'zoom-out') : 'zoom-in',
                            }}
                        />
                    </div>
                </div>

                {/* Navigation Arrows */}
                {images.length > 1 && (
                    <>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handlePrevious();
                            }}
                            className="absolute left-8 top-1/2 -translate-y-1/2 z-60 p-4 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20 text-white/50 hover:text-white transition-all border border-white/10 backdrop-blur-xl active:scale-90 group shadow-2xl"
                            aria-label="Previous image"
                        >
                            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleNext();
                            }}
                            className="absolute right-8 top-1/2 -translate-y-1/2 z-60 p-4 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20 text-white/50 hover:text-white transition-all border border-white/10 backdrop-blur-xl active:scale-90 group shadow-2xl"
                            aria-label="Next image"
                        >
                            <ChevronRight className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        </button>
                    </>
                )}

            </DialogContent>
        </Dialog>
    );
};
