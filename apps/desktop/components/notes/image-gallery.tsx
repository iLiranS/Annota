import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ImageInfo } from '@annota/editor-ui';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
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
            <DialogContent showCloseButton={false}
                onClick={onClose}
                className="max-w-[100vw] w-screen h-screen p-0 border-none bg-black/80 flex flex-col items-center justify-center outline-none animate-in fade-in duration-500"
            >
                <DialogTitle className="sr-only">Image Gallery</DialogTitle>
                <DialogDescription className="sr-only">
                    View images in full screen. Use arrow keys to navigate.
                </DialogDescription>

                {/* Counter Overlay */}
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-8 left-7 z-60 text-white/90 font-medium text-xs tracking-wider uppercase select-none bg-black/25 px-4 py-2.5 rounded-full backdrop-blur-xl border border-white/10 shadow-2xl transition-all hover:bg-white/10"
                >
                    {currentIndex + 1} <span className="opacity-40 mx-1">/</span> {images.length}
                </div>

                {/* Close Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="absolute top-8 right-10.5 z-60 text-white/90 select-none bg-black/25 p-2 rounded-full backdrop-blur-xl border border-white/10 shadow-2xl transition-all hover:bg-white/10 active:scale-95 group"
                    aria-label="Close gallery"
                >
                    <X className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                </button>

                {/* Main Content Area */}
                <div className="relative w-full h-full flex items-center justify-center p-8 md:p-12 lg:p-16 overflow-hidden pointer-events-none">
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative group flex items-center justify-center max-w-full max-h-full pointer-events-auto"
                    >

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
                            className="absolute left-8 top-1/2 -translate-y-1/2 z-60 p-4 rounded-full bg-black/20 hover:bg-black/30 active:bg-black/40 text-white/50 hover:text-white transition-all border border-white/10 backdrop-blur-xl active:scale-90 group shadow-2xl"
                            aria-label="Previous image"
                        >
                            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleNext();
                            }}
                            className="absolute right-8 top-1/2 -translate-y-1/2 z-60 p-4 rounded-full bg-black/20 hover:bg-black/30 active:bg-black/40 text-white/50 hover:text-white transition-all border border-white/10 backdrop-blur-xl active:scale-90 group shadow-2xl"
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
