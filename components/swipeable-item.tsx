import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
    SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
    Extrapolation,
    interpolate,
    SharedValue,
    useAnimatedStyle,
} from 'react-native-reanimated';

export interface SwipeAction {
    icon: keyof typeof Ionicons.glyphMap;
    backgroundColor: string;
    onPress: () => void;
}

interface SwipeableItemProps {
    children: React.ReactNode;
    leftActions?: SwipeAction[];
    rightActions?: SwipeAction[];
    /** @deprecated Use leftActions/rightActions instead */
    onDelete?: () => void;
    /** @deprecated Use leftActions/rightActions instead */
    onRestore?: () => void;
    compact?: boolean;
}

/**
 * Native iOS-like swipeable wrapper component for notes and folders
 * Uses react-native-gesture-handler's ReanimatedSwipeable for smooth, modern behavior
 */
export default function SwipeableItem({
    children,
    leftActions,
    rightActions,
    onDelete,
    onRestore,
    compact = false,
}: SwipeableItemProps) {
    const swipeableRef = React.useRef<SwipeableMethods>(null);
    const { colors } = useTheme();

    const buttonWidth = compact ? 55 : 80;
    const margin = 12;

    const activeRightActions = React.useMemo(() => {
        const actions = rightActions ? [...rightActions] : [];
        if (onDelete) {
            actions.push({
                icon: 'trash-outline',
                backgroundColor: '#EF4444',
                onPress: onDelete,
            });
        }
        return actions;
    }, [rightActions, onDelete]);

    const activeLeftActions = React.useMemo(() => {
        const actions = leftActions ? [...leftActions] : [];
        if (onRestore) {
            actions.push({
                icon: 'arrow-undo',
                backgroundColor: '#10B981',
                onPress: onRestore,
            });
        }
        return actions;
    }, [leftActions, onRestore]);

    const renderActions = (
        actions: SwipeAction[],
        dragX: SharedValue<number>,
        side: 'left' | 'right'
    ) => {
        if (actions.length === 0) return null;

        const isLeft = side === 'left';
        const totalWidth = (actions.length * buttonWidth) + margin;

        const animatedStyle = useAnimatedStyle(() => {
            return {
                transform: [{
                    translateX: isLeft
                        ? interpolate(dragX.value, [0, totalWidth], [-totalWidth, 0], Extrapolation.CLAMP)
                        : interpolate(dragX.value, [-totalWidth, 0], [0, totalWidth], Extrapolation.CLAMP)
                }],
            };
        });

        return (
            <Reanimated.View
                style={[
                    styles.actionsContainer,
                    { backgroundColor: colors.card },
                    {
                        width: totalWidth,
                        [isLeft ? 'paddingRight' : 'paddingLeft']: margin,
                    },
                    animatedStyle,
                ]}
            >
                {actions.map((action, index) => (
                    <View
                        key={index}
                        style={[
                            styles.actionButton,
                            { backgroundColor: action.backgroundColor, width: buttonWidth },
                        ]}
                    >
                        <Pressable
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                action.onPress();
                                swipeableRef.current?.close();
                            }}
                            style={({ pressed }) => [
                                styles.actionPressable,
                                pressed && styles.actionPressed,
                            ]}
                        >
                            <Ionicons name={action.icon} size={24} color="#FFFFFF" />
                        </Pressable>
                    </View>
                ))}
            </Reanimated.View>
        );
    };

    return (
        <ReanimatedSwipeable
            ref={swipeableRef}
            renderLeftActions={(progress, dragX) => renderActions(activeLeftActions, dragX, 'left')}
            renderRightActions={(progress, dragX) => renderActions(activeRightActions, dragX, 'right')}
            friction={2}
            enableTrackpadTwoFingerGesture
            rightThreshold={40}
            leftThreshold={40}
            onSwipeableWillOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            containerStyle={[styles.container]}
        >
            {children}
        </ReanimatedSwipeable>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 0,
    },
    actionsContainer: {
        flexDirection: 'row',
        height: '100%',
    },
    actionButton: {
        height: '100%',
        alignSelf: 'center',
        overflow: 'hidden',
    },
    actionPressable: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionPressed: {
        opacity: 0.7,
        transform: [{ scale: 0.92 }],
    },
});
