import { useState, useCallback } from 'react';
import { ImageInfo } from '../shared/types';

export function useSharedEditorUI(onGalleryVisibilityChange?: (visible: boolean) => void) {
    const [isGalleryVisible, setIsGalleryVisible] = useState(false);
    const [galleryImages, setGalleryImages] = useState<ImageInfo[]>([]);
    const [galleryCurrentIndex, setGalleryCurrentIndex] = useState(0);

    const openGallery = useCallback((images: ImageInfo[], startIndex: number) => {
        setGalleryImages(images || []);
        setGalleryCurrentIndex(startIndex || 0);
        setIsGalleryVisible(true);
        onGalleryVisibilityChange?.(true);
    }, [onGalleryVisibilityChange]);

    const closeGallery = useCallback(() => {
        setIsGalleryVisible(false);
        onGalleryVisibilityChange?.(false);
    }, [onGalleryVisibilityChange]);

    const setGalleryIndex = useCallback((index: number) => {
        setGalleryCurrentIndex(index);
    }, []);

    return {
        gallery: {
            isVisible: isGalleryVisible,
            images: galleryImages,
            currentIndex: galleryCurrentIndex,
        },
        openGallery,
        closeGallery,
        setGalleryIndex
    };
}
