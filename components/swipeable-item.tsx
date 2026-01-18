import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

interface SwipeableItemProps {
    children: React.ReactNode;
    onDelete?: () => void;
    onRestore?: () => void;
    isInTrash?: boolean; // If true, shows restore icon instead of delete
}

/**
 * Native iOS-like swipeable wrapper component for notes and folders
 * Uses react-native-gesture-handler's Swipeable for smooth, native behavior
 */
export default function SwipeableItem({
    children,
    onDelete,
    onRestore,
    isInTrash = false,
}: SwipeableItemProps) {
    const swipeableRef = React.useRef<Swipeable>(null);

    const renderRightActions = (
        progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
    ) => {
        const translateX = dragX.interpolate({
            inputRange: [-100, 0],
            outputRange: [0, 100],
            extrapolate: 'clamp',
        });

        return (
            <Animated.View
                style={[
                    styles.rightAction,
                    {
                        transform: [{ translateX }],
                    },
                ]}
            >
                <View style={styles.actionContent}>
                    <Ionicons name="trash" size={24} color="#FFFFFF" />
                </View>
            </Animated.View>
        );
    };

    const renderLeftActions = (
        progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
    ) => {
        const translateX = dragX.interpolate({
            inputRange: [0, 100],
            outputRange: [-100, 0],
            extrapolate: 'clamp',
        });

        return (
            <Animated.View
                style={[
                    styles.leftAction,
                    {
                        transform: [{ translateX }],
                    },
                ]}
            >
                <View style={styles.actionContent}>
                    <Ionicons name="arrow-undo" size={24} color="#FFFFFF" />
                </View>
            </Animated.View>
        );
    };

    const handleSwipeOpen = (direction: 'left' | 'right') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Small delay to allow the swipe animation to be perceived,
        // preventing the action from feeling "too fast" / jarring.
        setTimeout(() => {
            if (direction === 'right' && onDelete) {
                onDelete();
            } else if (direction === 'left' && onRestore) {
                onRestore();
            }
            swipeableRef.current?.close();
        }, 200);
    };

    if (isInTrash) {
        return (
            <Swipeable
                ref={swipeableRef}
                renderLeftActions={renderLeftActions}
                overshootLeft={false}
                onSwipeableWillOpen={() => handleSwipeOpen('left')}
                containerStyle={styles.container}
            >
                {children}
            </Swipeable>
        );
    }

    return (
        <Swipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            overshootRight={false}
            onSwipeableWillOpen={() => handleSwipeOpen('right')}
            containerStyle={styles.container}
        >
            {children}
        </Swipeable>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 8,
    },
    rightAction: {
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'flex-end',
        borderRadius: 12,
    },
    leftAction: {
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'flex-start',
        borderRadius: 12,
    },
    actionContent: {
        width: 80,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
