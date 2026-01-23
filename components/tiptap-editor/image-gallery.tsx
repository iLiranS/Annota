import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { ImageInfo } from './types';

interface ImageGalleryProps {
    visible: boolean;
    images: ImageInfo[];
    initialIndex: number;
    onClose: () => void;
    onNavigate: (index: number) => void;
    onResize: (width: string) => void;
    onDownload: () => void;
    onDelete: () => void;
    onCut: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.9;
const DISMISS_THRESHOLD = 100;

export function ImageGallery({
    visible,
    images,
    initialIndex = 0,
    onClose,
    onNavigate,
    onResize,
    onDownload,
    onCut,
    onDelete
}: ImageGalleryProps) {
    const { colors, dark } = useTheme();
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const [controlsVisible, setControlsVisible] = useState(true);

    // Zoom & Pan shared values
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    // Swipe shared values
    const swipeX = useSharedValue(0);

    // Dismiss shared value (vertical drag to close)
    const dismissY = useSharedValue(0);

    // Sync state when props change
    useEffect(() => {
        if (visible) {
            setActiveIndex(initialIndex);
            setControlsVisible(true);
            resetZoom();
            dismissY.value = 0;
        }
    }, [visible, initialIndex]);

    const resetZoom = () => {
        scale.value = 1;
        savedScale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
    };

    const currentImage = images[activeIndex];
    const canGoPrev = activeIndex > 0;
    const canGoNext = activeIndex < images.length - 1;

    const handlePrev = () => {
        if (canGoPrev) {
            // If triggered by button, animate out first
            swipeX.value = withTiming(SCREEN_WIDTH, { duration: 200 }, () => {
                runOnJS(navigatePrev)();
            });
        }
    };

    const navigatePrev = () => {
        const newIndex = activeIndex - 1;
        setActiveIndex(newIndex);
        onNavigate(newIndex);
        resetZoom();
        // Start from left side and slide in
        swipeX.value = -SCREEN_WIDTH;
        swipeX.value = withTiming(0, { duration: 250 });
    };

    const handleNext = () => {
        if (canGoNext) {
            // If triggered by button, animate out first
            swipeX.value = withTiming(-SCREEN_WIDTH, { duration: 200 }, () => {
                runOnJS(navigateNext)();
            });
        }
    };

    const navigateNext = () => {
        const newIndex = activeIndex + 1;
        setActiveIndex(newIndex);
        onNavigate(newIndex);
        resetZoom();
        // Start from right side and slide in
        swipeX.value = SCREEN_WIDTH;
        swipeX.value = withTiming(0, { duration: 250 });
    };

    const toggleControls = () => {
        setControlsVisible(!controlsVisible);
    };

    // --- Gestures ---

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = savedScale.value * e.scale;
        })
        .onEnd(() => {
            if (scale.value < 1) {
                scale.value = withSpring(1);
                savedScale.value = 1;
            } else {
                savedScale.value = scale.value;
            }
        });

    const panGesture = Gesture.Pan()
        .averageTouches(true)
        .onUpdate((e) => {
            if (scale.value > 1) {
                // Pan around zoomed image
                translateX.value = savedTranslateX.value + e.translationX;
                translateY.value = savedTranslateY.value + e.translationY;
            } else {
                // Determine if primarily horizontal or vertical swipe
                const isHorizontal = Math.abs(e.translationX) > Math.abs(e.translationY);

                if (isHorizontal) {
                    // Swipe to navigate (only X axis)
                    swipeX.value = e.translationX;
                    dismissY.value = 0;
                } else if (e.translationY > 0) {
                    // Only allow downward drag for dismiss
                    dismissY.value = e.translationY;
                    swipeX.value = 0;
                }
            }
        })
        .onEnd((e) => {
            if (scale.value > 1) {
                savedTranslateX.value = translateX.value;
                savedTranslateY.value = translateY.value;
            } else {
                // Check for vertical dismiss first
                if (dismissY.value > DISMISS_THRESHOLD || e.velocityY > 800) {
                    dismissY.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, () => {
                        runOnJS(onClose)();
                    });
                    return;
                } else if (dismissY.value > 0) {
                    dismissY.value = withTiming(0, { duration: 150 });
                }

                // Handle swipe navigation - lower threshold + velocity for easier swiping
                const swipeThreshold = SCREEN_WIDTH * 0.1; // 10% of screen width
                const velocityThreshold = 500; // Flick velocity threshold

                const shouldGoNext = e.translationX < -swipeThreshold || e.velocityX < -velocityThreshold;
                const shouldGoPrev = e.translationX > swipeThreshold || e.velocityX > velocityThreshold;

                if (shouldGoPrev && canGoPrev) {
                    swipeX.value = withTiming(SCREEN_WIDTH, { duration: 150 }, () => {
                        runOnJS(navigatePrev)();
                    });
                } else if (shouldGoNext && canGoNext) {
                    swipeX.value = withTiming(-SCREEN_WIDTH, { duration: 150 }, () => {
                        runOnJS(navigateNext)();
                    });
                } else {
                    swipeX.value = withTiming(0, { duration: 150 });
                }
            }
        });

    const tapGesture = Gesture.Tap()
        .numberOfTaps(1)
        .onStart(() => {
            runOnJS(toggleControls)();
        });

    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .onStart(() => {
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
    const tapsGesture = Gesture.Exclusive(doubleTapGesture, tapGesture);

    const animatedImageStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: swipeX.value },
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    const animatedContainerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: dismissY.value }],
        opacity: 1 - (dismissY.value / SCREEN_HEIGHT) * 0.5,
    }));

    const resizeOptions = [
        { label: 'XS', value: '25%' },
        { label: 'S', value: '50%' },
        { label: 'M', value: '75%' },
        { label: 'L', value: '100%' },
    ];

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.modalBackdrop}>
                <Pressable style={styles.backdropPressable} onPress={onClose} />
                <Animated.View style={[styles.modalContent, animatedContainerStyle]}>
                    <GestureHandlerRootView style={styles.container}>
                        {/* Drag Handle */}
                        <View style={styles.dragHandle}>
                            <View style={styles.dragIndicator} />
                        </View>

                        {/* Main Image View with Gestures */}
                        <GestureDetector gesture={Gesture.Race(tapsGesture, composedGesture)}>
                            <View style={styles.imageContainer}>
                                {currentImage ? (
                                    <Animated.View style={[styles.imageWrapper, animatedImageStyle]}>
                                        <Image
                                            source={{ uri: currentImage.src }}
                                            style={styles.image}
                                            contentFit="contain"
                                            cachePolicy="memory-disk"
                                        />
                                    </Animated.View>
                                ) : (
                                    <Text style={styles.errorText}>Image not found</Text>
                                )}
                            </View>
                        </GestureDetector>

                        {/* Overlays / Controls */}
                        {controlsVisible && (
                            <>
                                {/* Header with Close Button */}
                                <View style={styles.header}>
                                    <View style={styles.counterContainer}>
                                        <Text style={styles.counterText}>
                                            {activeIndex + 1} / {images.length}
                                        </Text>
                                    </View>

                                    <Pressable
                                        style={({ pressed }) => [styles.closeButton, pressed && styles.buttonPressed]}
                                        onPress={onClose}
                                    >
                                        <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
                                    </Pressable>
                                </View>

                                {/* Navigation Arrows */}
                                {images.length > 1 && (
                                    <>
                                        <Pressable
                                            style={[
                                                styles.navButton,
                                                styles.navButtonLeft,
                                                !canGoPrev && styles.navButtonDisabled
                                            ]}
                                            onPress={handlePrev}
                                            disabled={!canGoPrev}
                                        >
                                            <MaterialCommunityIcons
                                                name="chevron-left"
                                                size={32}
                                                color={canGoPrev ? '#FFFFFF' : 'rgba(255,255,255,0.3)'}
                                            />
                                        </Pressable>

                                        <Pressable
                                            style={[
                                                styles.navButton,
                                                styles.navButtonRight,
                                                !canGoNext && styles.navButtonDisabled
                                            ]}
                                            onPress={handleNext}
                                            disabled={!canGoNext}
                                        >
                                            <MaterialCommunityIcons
                                                name="chevron-right"
                                                size={32}
                                                color={canGoNext ? '#FFFFFF' : 'rgba(255,255,255,0.3)'}
                                            />
                                        </Pressable>
                                    </>
                                )}

                                {/* Bottom Actions Bar - Transparent Background */}
                                <View style={styles.bottomBar}>
                                    {/* Resize Options */}
                                    <View style={styles.resizeGroup}>
                                        {resizeOptions.map((opt) => (
                                            <Pressable
                                                key={opt.value}
                                                style={({ pressed }) => [
                                                    styles.resizeBtn,
                                                    { backgroundColor: dark ? 'rgba(58, 58, 60, 0.8)' : 'rgba(229, 229, 234, 0.8)' },
                                                    pressed && { opacity: 0.7 }
                                                ]}
                                                onPress={() => {
                                                    onResize(opt.value);
                                                    onClose();
                                                }}
                                            >
                                                <Text style={[styles.resizeText, { color: colors.text }]}>{opt.label}</Text>
                                            </Pressable>
                                        ))}
                                    </View>

                                    {/* Action Icons */}
                                    <View style={styles.iconGroup}>
                                        <Pressable
                                            style={({ pressed }) => [
                                                styles.iconBtn,
                                                { backgroundColor: dark ? 'rgba(58, 58, 60, 0.8)' : 'rgba(229, 229, 234, 0.8)' },
                                                pressed && { opacity: 0.7 }
                                            ]}
                                            onPress={() => {
                                                onDownload();
                                                onClose();
                                            }}
                                        >
                                            <MaterialCommunityIcons name="download" size={24} color={colors.text} />
                                        </Pressable>

                                        <Pressable
                                            style={({ pressed }) => [
                                                styles.iconBtn,
                                                { backgroundColor: dark ? 'rgba(58, 58, 60, 0.8)' : 'rgba(229, 229, 234, 0.8)' },
                                                pressed && { opacity: 0.7 }
                                            ]}
                                            onPress={() => {
                                                onCut();
                                                onClose();
                                            }}
                                        >
                                            <MaterialCommunityIcons name="content-cut" size={24} color={colors.text} />
                                        </Pressable>

                                        <Pressable
                                            style={({ pressed }) => [
                                                styles.iconBtn,
                                                { backgroundColor: dark ? 'rgba(255, 69, 58, 0.3)' : 'rgba(255, 59, 48, 0.25)' },
                                                pressed && { opacity: 0.7 }
                                            ]}
                                            onPress={() => {
                                                onDelete();
                                                onClose();
                                            }}
                                        >
                                            <MaterialCommunityIcons name="delete" size={24} color="#FF453A" />
                                        </Pressable>
                                    </View>
                                </View>
                            </>
                        )}
                    </GestureHandlerRootView>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    backdropPressable: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    modalContent: {
        height: MODAL_HEIGHT,
        backgroundColor: '#000000',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    container: {
        flex: 1,
    },
    dragHandle: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    dragIndicator: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        borderRadius: 2,
    },
    imageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    imageWrapper: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    errorText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    header: {
        position: 'absolute',
        top: 20, // Below drag handle
        left: 20,
        right: 20,
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
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    counterText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    navButton: {
        position: 'absolute',
        top: '50%',
        marginTop: -25,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
    },
    navButtonLeft: {
        left: 5,
    },
    navButtonRight: {
        right: 5,
    },
    navButtonDisabled: {
        opacity: 0,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 40, // Safe area
        paddingTop: 20,
        paddingHorizontal: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        // Transparent gradient handled byrgba backgrounds on buttons or just mostly clear
        // We removed the solid bg
    },
    resizeGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    resizeBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    resizeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    iconGroup: {
        flexDirection: 'row',
        gap: 6,
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
