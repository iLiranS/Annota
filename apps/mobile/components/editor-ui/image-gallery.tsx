import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useState } from 'react';
import {
    BackHandler,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Extrapolation,
    SharedValue,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { ImageInfo } from '@annota/editor-ui';

// ============================================================================
// GallerySlide — a single image positioned by absolute offset
// ============================================================================

interface GallerySlideProps {
    image: ImageInfo;
    index: number;
    totalOffset: SharedValue<number>;
    screenWidthSV: SharedValue<number>;
    zoomScale: SharedValue<number>;
    zoomTranslateX: SharedValue<number>;
    zoomTranslateY: SharedValue<number>;
    isActive: boolean;
}

function GallerySlide({
    image, index, totalOffset, screenWidthSV,
    zoomScale, zoomTranslateX, zoomTranslateY, isActive,
}: GallerySlideProps) {
    const animatedStyle = useAnimatedStyle(() => {
        const baseX = index * screenWidthSV.value - totalOffset.value;
        if (isActive) {
            return {
                transform: [
                    { scale: zoomScale.value },
                    { translateX: baseX + zoomTranslateX.value },
                    { translateY: zoomTranslateY.value },
                ],
            };
        }
        return { transform: [{ translateX: baseX }] };
    });

    return (
        <Animated.View style={[styles.slideContainer, animatedStyle]}>
            <Image
                source={{ uri: image.src }}
                style={styles.image}
                contentFit="contain"
                cachePolicy="memory-disk"
            />
        </Animated.View>
    );
}

// ============================================================================
// ImageGallery — main component
// ============================================================================

interface ImageGalleryProps {
    visible: boolean;
    images: ImageInfo[];
    initialIndex: number;
    onClose?: () => void;
    onNavigate?: (index: number) => void;
}

const DISMISS_THRESHOLD = 100;

export function ImageGallery({
    visible, images, initialIndex = 0, onClose, onNavigate,
}: ImageGalleryProps) {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [activeIndex, setActiveIndex] = useState(initialIndex);

    // Shared values for screen dimensions (fixes landscape)
    const screenWidthSV = useSharedValue(screenWidth);
    const screenHeightSV = useSharedValue(screenHeight);

    // Navigation offset — purely UI-thread driven, no React-state timing issues
    const totalOffset = useSharedValue(initialIndex * screenWidth);
    const savedOffset = useSharedValue(initialIndex * screenWidth);

    // Zoom & Pan
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);
    const pinchStartFocalX = useSharedValue(0);
    const pinchStartFocalY = useSharedValue(0);
    const isPinching = useSharedValue(false);
    const lastPanX = useSharedValue(0);
    const lastPanY = useSharedValue(0);
    const prevPanPointers = useSharedValue(0);

    // Dismiss (vertical drag)
    const dismissY = useSharedValue(0);

    // Enter animation
    const enterProgress = useSharedValue(0);

    const resetZoom = useCallback(() => {
        'worklet';
        scale.value = 1;
        savedScale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
    }, []);

    // Update shared screen dimensions on rotation
    useEffect(() => {
        screenWidthSV.value = screenWidth;
        screenHeightSV.value = screenHeight;
        totalOffset.value = activeIndex * screenWidth;
        savedOffset.value = activeIndex * screenWidth;
    }, [screenWidth, screenHeight]);

    // Handle Android back button
    useEffect(() => {
        if (!visible) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (onClose) scheduleOnRN(onClose);
            return true;
        });
        return () => sub.remove();
    }, [visible, onClose]);

    // Sync when opened
    useEffect(() => {
        if (visible) {
            setActiveIndex(initialIndex);
            totalOffset.value = initialIndex * screenWidth;
            savedOffset.value = initialIndex * screenWidth;
            scale.value = 1;
            savedScale.value = 1;
            translateX.value = 0;
            translateY.value = 0;
            savedTranslateX.value = 0;
            savedTranslateY.value = 0;
            dismissY.value = 0;
            enterProgress.value = withTiming(1, { duration: 200 });
        } else {
            enterProgress.value = 0;
        }
    }, [visible, initialIndex]);

    const handleClose = useCallback(() => {
        enterProgress.value = withTiming(0, { duration: 150 }, () => {
            if (onClose) scheduleOnRN(onClose);
        });
    }, [onClose, enterProgress]);

    // --- Gestures ---

    // Helper: clamp translate so the image never leaves the viewport.
    //
    // IMPORTANT — coordinate space:
    // The transform array is [scale(s), translateX(tx), translateY(ty)].
    // RN applies transforms left-to-right, so translateX/Y are in PRE-SCALE
    // space. A tx of 1 unit shifts the already-scaled image by `s` screen pixels:
    //
    //   screenDisplacement = tx * s
    //
    // The image occupies sw*s × sh*s on screen, centred at tx*s from origin.
    // Left edge = sw/2 + tx*s - sw*s/2. For no overshoot:
    //
    //   |tx * s| <= (sw*s - sw) / 2
    //   |tx|     <= sw*(s-1) / (2*s)
    //
    const clampTranslate = (tx: number, ty: number, s: number) => {
        'worklet';
        const sw = screenWidthSV.value;
        const sh = screenHeightSV.value;
        const maxTx = Math.max(0, sw * (s - 1) / (2 * s));
        const maxTy = Math.max(0, sh * (s - 1) / (2 * s));
        return {
            x: Math.max(-maxTx, Math.min(tx, maxTx)),
            y: Math.max(-maxTy, Math.min(ty, maxTy)),
        };
    };

    const pinchGesture = Gesture.Pinch()
        .onStart((e) => {
            'worklet';
            isPinching.value = true;
            // Defensive: Reset if values are somehow invalid
            if (!Number.isFinite(scale.value)) scale.value = 1;
            if (!Number.isFinite(translateX.value)) translateX.value = 0;
            if (!Number.isFinite(translateY.value)) translateY.value = 0;

            savedScale.value = scale.value;
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
            pinchStartFocalX.value = e.focalX;
            pinchStartFocalY.value = e.focalY;
        })
        .onUpdate((e) => {
            'worklet';
            // PREVENT FOCAL JUMP ON RELEASE:
            // Ignore the dirty update frame where one finger has just lifted.
            if (e.numberOfPointers !== 2) return;

            const sw = screenWidthSV.value;
            const sh = screenHeightSV.value;

            // Allow rubber-banding (don't strictly clamp max to 5 here)
            const nextScale = Math.max(0.5, savedScale.value * e.scale);
            const s0 = Math.max(0.1, savedScale.value);

            const focalScreenX = pinchStartFocalX.value - sw / 2;
            const focalScreenY = pinchStartFocalY.value - sh / 2;

            // Mathematically correct focal zoom translation
            const rawX = savedTranslateX.value
                + focalScreenX * (1 / nextScale - 1 / s0)
                + (e.focalX - pinchStartFocalX.value) / nextScale;
            const rawY = savedTranslateY.value
                + focalScreenY * (1 / nextScale - 1 / s0)
                + (e.focalY - pinchStartFocalY.value) / nextScale;

            if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return;

            const clamped = clampTranslate(rawX, rawY, nextScale);

            scale.value = nextScale;
            translateX.value = clamped.x;
            translateY.value = clamped.y;
        })
        .onEnd(() => {
            'worklet';
            if (scale.value < 1) {
                scale.value = withSpring(1);
                savedScale.value = 1;
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            } else if (scale.value > 5) {
                scale.value = withSpring(5);
                savedScale.value = 5;
                const clamped = clampTranslate(translateX.value, translateY.value, 5);
                translateX.value = withSpring(clamped.x);
                translateY.value = withSpring(clamped.y);
                // Crucial: Save the target clamped value, not the currently over-zoomed one
                savedTranslateX.value = clamped.x;
                savedTranslateY.value = clamped.y;
            } else {
                savedScale.value = scale.value;
                const clamped = clampTranslate(translateX.value, translateY.value, scale.value);
                translateX.value = withSpring(clamped.x);
                translateY.value = withSpring(clamped.y);
                savedTranslateX.value = clamped.x;
                savedTranslateY.value = clamped.y;
            }
        })
        .onFinalize(() => {
            'worklet';
            isPinching.value = false;
        });

    const panGesture = Gesture.Pan()
        .averageTouches(true)
        .onStart((e) => {
            'worklet';
            // Defensive: Reset if values are somehow invalid
            if (!Number.isFinite(scale.value)) scale.value = 1;
            if (!Number.isFinite(translateX.value)) translateX.value = 0;
            if (!Number.isFinite(translateY.value)) translateY.value = 0;

            savedOffset.value = totalOffset.value;
            savedScale.value = scale.value;
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
            lastPanX.value = e.translationX;
            lastPanY.value = e.translationY;

            // Track the initial number of fingers
            prevPanPointers.value = e.numberOfPointers;
        })
        .onUpdate((e) => {
            'worklet';
            // PREVENT CENTROID JUMP: Detect if a finger was added or removed
            const pointersChanged = e.numberOfPointers !== prevPanPointers.value;
            prevPanPointers.value = e.numberOfPointers;

            // Always track the last pan position so deltas are fresh,
            // even if we are currently ignoring them due to pinching.
            const dx = e.translationX - lastPanX.value;
            const dy = e.translationY - lastPanY.value;
            lastPanX.value = e.translationX;
            lastPanY.value = e.translationY;

            // Abort the visual update if we are pinching OR if the finger count just changed
            if (isPinching.value || pointersChanged) return;

            if (scale.value > 1.05) {
                const s = scale.value;
                // Use manual deltas (dx/dy) added to current translate,
                // completely avoiding the baseline jump
                const clamped = clampTranslate(
                    translateX.value + dx / s,
                    translateY.value + dy / s,
                    s
                );
                translateX.value = clamped.x;
                translateY.value = clamped.y;
            } else {
                // Keep absolute e.translationX for standard page swiping/dismissing
                const isHorizontal = Math.abs(e.translationX) > Math.abs(e.translationY);
                if (isHorizontal) {
                    const sw = screenWidthSV.value;
                    const maxOffset = (images.length - 1) * sw;
                    totalOffset.value = Math.max(0, Math.min(
                        savedOffset.value - e.translationX, maxOffset
                    ));
                    dismissY.value = 0;
                } else if (e.translationY > 0) {
                    dismissY.value = e.translationY;
                    totalOffset.value = savedOffset.value;
                }
            }
        })
        .onEnd((e) => {
            'worklet';
            if (scale.value > 1.05) {
                const clamped = clampTranslate(translateX.value, translateY.value, scale.value);
                savedTranslateX.value = clamped.x;
                savedTranslateY.value = clamped.y;
            } else {
                // ... Your existing page snap logic stays exactly the same here
                if (dismissY.value > DISMISS_THRESHOLD || e.velocityY > 800) {
                    dismissY.value = withTiming(screenHeightSV.value, { duration: 200 }, () => {
                        if (onClose) scheduleOnRN(onClose);
                    });
                    return;
                } else if (dismissY.value > 0) {
                    dismissY.value = withTiming(0, { duration: 150 });
                }

                const sw = screenWidthSV.value;
                const currentPage = Math.round(savedOffset.value / sw);
                let targetPage: number;

                if (e.velocityX < -500) {
                    targetPage = Math.ceil(totalOffset.value / sw);
                } else if (e.velocityX > 500) {
                    targetPage = Math.floor(totalOffset.value / sw);
                } else {
                    targetPage = Math.round(totalOffset.value / sw);
                }
                targetPage = Math.max(0, Math.min(targetPage, images.length - 1));

                totalOffset.value = withTiming(targetPage * sw, { duration: 200 }, () => {
                    savedOffset.value = targetPage * sw;
                    if (targetPage !== currentPage) {
                        resetZoom();
                    }
                    scheduleOnRN(setActiveIndex, targetPage);
                    if (onNavigate) scheduleOnRN(onNavigate, targetPage);
                });
            }
        });

    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .onStart((e) => {
            'worklet';
            if (scale.value > 1) {
                // Zoom out — reset to center
                scale.value = withSpring(1);
                savedScale.value = 1;
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            } else {
                // Zoom in toward the tapped point.
                const targetScale = 2.5;
                const sw = screenWidthSV.value;
                const sh = screenHeightSV.value;

                // Tap point in screen-space relative to centre:
                //   tapScreen = e.x - sw/2
                //
                // translateX/Y are in PRE-SCALE space (a tx of 1 moves the image
                // by targetScale screen pixels). Starting from tx=0 (unzoomed),
                // to keep the tap point visually fixed after zooming to targetScale:
                //
                //   tapScreen + newTx * targetScale = tapScreen * 1  (fixed in screen)
                //   newTx * targetScale = tapScreen * (1 - targetScale)
                //   newTx = -(tapScreen) * (targetScale - 1) / targetScale
                //         = (sw/2 - e.x) * (targetScale - 1) / targetScale
                //
                const offsetX = (sw / 2 - e.x) * (targetScale - 1) / targetScale;
                const offsetY = (sh / 2 - e.y) * (targetScale - 1) / targetScale;

                const clamped = clampTranslate(offsetX, offsetY, targetScale);

                scale.value = withSpring(targetScale);
                savedScale.value = targetScale;
                translateX.value = withSpring(clamped.x);
                translateY.value = withSpring(clamped.y);
                savedTranslateX.value = clamped.x;
                savedTranslateY.value = clamped.y;
            }
        });

    const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);
    const combined = Gesture.Race(doubleTapGesture, composedGesture);

    // Container animation (enter + dismiss)
    const containerAnimatedStyle = useAnimatedStyle(() => ({
        opacity: enterProgress.value * interpolate(
            dismissY.value, [0, screenHeightSV.value], [1, 0.3], Extrapolation.CLAMP
        ),
        transform: [
            { translateY: dismissY.value },
            { scale: interpolate(enterProgress.value, [0, 1], [0.95, 1], Extrapolation.CLAMP) },
        ],
    }));

    // Determine which slides to render (activeIndex ± 1)
    const visibleIndices: number[] = [];
    for (let i = activeIndex - 1; i <= activeIndex + 1; i++) {
        if (i >= 0 && i < images.length) visibleIndices.push(i);
    }

    if (!visible) return null;

    return (
        <Animated.View style={[styles.fullScreenContainer, containerAnimatedStyle]}>
            <GestureDetector gesture={combined}>
                <View style={styles.imageContainer}>
                    {visibleIndices.map(i => (
                        <GallerySlide
                            key={i}
                            image={images[i]}
                            index={i}
                            totalOffset={totalOffset}
                            screenWidthSV={screenWidthSV}
                            zoomScale={scale}
                            zoomTranslateX={translateX}
                            zoomTranslateY={translateY}
                            isActive={i === activeIndex}
                        />
                    ))}
                </View>
            </GestureDetector>

            {/* Header overlay */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
                <View style={styles.counterContainer}>
                    <Text style={styles.counterText}>
                        {activeIndex + 1} / {images.length}
                    </Text>
                </View>
                <Pressable
                    style={({ pressed }) => [styles.closeButton, pressed && styles.buttonPressed]}
                    onPress={handleClose}
                >
                    <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
                </Pressable>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    fullScreenContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
    },
    imageContainer: {
        flex: 1,
        overflow: 'hidden',
    },
    slideContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonPressed: {
        opacity: 0.7,
    },
    counterContainer: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
    },
    counterText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});