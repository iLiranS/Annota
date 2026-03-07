import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ImageInfo } from '@annota/tiptap-editor';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

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

    useEffect(() => {
        if (visible) {
            setCurrentIndex(initialIndex);
        }
    }, [visible, initialIndex]);

    const handlePrevious = useCallback(() => {
        if (images.length === 0) return;
        const newIndex = (currentIndex - 1 + images.length) % images.length;
        setCurrentIndex(newIndex);
        if (onNavigate) onNavigate(newIndex);
    }, [currentIndex, images.length, onNavigate]);

    const handleNext = useCallback(() => {
        if (images.length === 0) return;
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
                <div className="relative w-full h-full flex items-center justify-center p-4 md:p-16 lg:p-24 overflow-hidden pointer-events-none">
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative group max-w-full max-h-full pointer-events-auto"
                    >
                        {/* Subtle Glow behind image */}
                        <div className="absolute inset-0 bg-primary/10 blur-[120px] rounded-full opacity-30 pointer-events-none" />

                        <img
                            key={currentImage.src}
                            src={currentImage.src}
                            alt={`Image ${currentIndex + 1}`}
                            className="relative max-w-full max-h-full object-contain select-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] rounded-sm animate-in zoom-in-95 duration-500 pointer-events-none"
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
