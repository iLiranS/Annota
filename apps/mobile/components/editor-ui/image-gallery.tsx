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
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Extrapolation,
    SharedValue,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImageInfo } from '@annota/tiptap-editor';

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
                    { translateX: baseX + zoomTranslateX.value },
                    { translateY: zoomTranslateY.value },
                    { scale: zoomScale.value },
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
    onClose: () => void;
    onNavigate: (index: number) => void;
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
            onClose();
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
            runOnJS(onClose)();
        });
    }, [onClose, enterProgress]);

    // --- Gestures ---

    // Helper: clamp translate to image boundaries + buffer
    const PAN_BUFFER = 20;
    const clampTranslate = (tx: number, ty: number, s: number) => {
        'worklet';
        const sw = screenWidthSV.value;
        const sh = screenHeightSV.value;
        const maxTx = Math.max(0, (sw * s - sw) / 2) + PAN_BUFFER;
        const maxTy = Math.max(0, (sh * s - sh) / 2) + PAN_BUFFER;
        return {
            x: Math.max(-maxTx, Math.min(tx, maxTx)),
            y: Math.max(-maxTy, Math.min(ty, maxTy)),
        };
    };

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            'worklet';
            scale.value = savedScale.value * e.scale;
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
                // Clamp translate for the capped scale
                const clamped = clampTranslate(translateX.value, translateY.value, 5);
                translateX.value = withSpring(clamped.x);
                translateY.value = withSpring(clamped.y);
                savedTranslateX.value = clamped.x;
                savedTranslateY.value = clamped.y;
            } else {
                savedScale.value = scale.value;
                // Clamp translate for the current scale
                const clamped = clampTranslate(translateX.value, translateY.value, scale.value);
                if (clamped.x !== translateX.value || clamped.y !== translateY.value) {
                    translateX.value = withSpring(clamped.x);
                    translateY.value = withSpring(clamped.y);
                }
                savedTranslateX.value = clamped.x;
                savedTranslateY.value = clamped.y;
            }
        });

    const panGesture = Gesture.Pan()
        .averageTouches(true)
        .onStart(() => {
            'worklet';
            savedOffset.value = totalOffset.value;
        })
        .onUpdate((e) => {
            'worklet';
            if (scale.value > 1.05) {
                // Zoomed — pan around the image, clamped to borders
                const clamped = clampTranslate(
                    savedTranslateX.value + e.translationX,
                    savedTranslateY.value + e.translationY,
                    scale.value
                );
                translateX.value = clamped.x;
                translateY.value = clamped.y;
            } else {
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
                // Save clamped position
                const clamped = clampTranslate(translateX.value, translateY.value, scale.value);
                savedTranslateX.value = clamped.x;
                savedTranslateY.value = clamped.y;
            } else {
                // Dismiss check
                if (dismissY.value > DISMISS_THRESHOLD || e.velocityY > 800) {
                    dismissY.value = withTiming(screenHeightSV.value, { duration: 200 }, () => {
                        runOnJS(onClose)();
                    });
                    return;
                } else if (dismissY.value > 0) {
                    dismissY.value = withTiming(0, { duration: 150 });
                }

                // Snap to nearest page
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
                    runOnJS(setActiveIndex)(targetPage);
                    runOnJS(onNavigate)(targetPage);
                });
            }
        });

    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .onStart(() => {
            'worklet';
            if (scale.value > 1) {
                scale.value = withSpring(1);
                savedScale.value = 1;
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            } else {
                scale.value = withSpring(2.5);
                savedScale.value = 2.5;
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
        <GestureHandlerRootView style={{ flex: 1 }}>
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
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    fullScreenContainer: {
        flex: 1,
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
