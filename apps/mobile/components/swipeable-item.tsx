import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useTheme } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import ReanimatedSwipeable, {
    SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
    Extrapolation,
    interpolate,
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
    useAnimatedReaction,
    withDelay,
} from 'react-native-reanimated';

export interface SwipeAction {
    icon: keyof typeof Ionicons.glyphMap;
    backgroundColor: string;
    onPress: () => void;
}

interface SwipeableItemProps {
    children: React.ReactNode;
    rightActions?: SwipeAction[];
    compact?: boolean;
}

interface SwipeActionButtonProps {
    action: SwipeAction;
    index: number;
    buttonWidth: number;
    isOpen: SharedValue<boolean>;
    onPress: () => void;
}

function SwipeActionButton({
    action,
    index,
    buttonWidth,
    isOpen,
    onPress,
}: SwipeActionButtonProps) {
    const animProgress = useSharedValue(0);

    useAnimatedReaction(
        () => isOpen.value,
        (open) => {
            if (open) {
                // Apply a slight stagger delay based on index (60ms per item)
                animProgress.value = withDelay(
                    index * 60,
                    withSequence(
                        withTiming(1, { duration: 150 }),
                        withTiming(0, { duration: 150 })
                    )
                );
            } else {
                animProgress.value = 0;
            }
        }
    );

    const animatedIconStyle = useAnimatedStyle(() => {
        // Start from where it is -> jump and scale a little -> go back to original
        const translateY = interpolate(animProgress.value, [0, 1], [0, -12]);
        const scale = interpolate(animProgress.value, [0, 1], [1, 1.25]);

        return {
            transform: [
                { translateY },
                { scale }
            ]
        };
    });

    return (
        <View
            style={[
                styles.actionButton,
                { backgroundColor: action.backgroundColor, width: buttonWidth },
            ]}
        >
            <Pressable
                onPress={onPress}
                style={({ pressed }) => [
                    styles.actionPressable,
                    pressed && styles.actionPressed,
                ]}
            >
                <Reanimated.View style={animatedIconStyle}>
                    <Ionicons name={action.icon} size={24} color="#FFFFFF" />
                </Reanimated.View>
            </Pressable>
        </View>
    );
}

/**
 * Native iOS-like swipeable wrapper component for notes and folders
 * Uses react-native-gesture-handler's ReanimatedSwipeable for smooth, modern behavior
 */
export default function SwipeableItem({
    children,
    rightActions = [],
    compact = false,
}: SwipeableItemProps) {
    const swipeableRef = React.useRef<SwipeableMethods>(null);
    const { colors } = useTheme();
    const navigation = useNavigation();
    const isOpen = useSharedValue(false);

    const buttonWidth = compact ? 55 : 80;
    const margin = 12;

    const renderActions = (
        actions: SwipeAction[],
        dragX: SharedValue<number>
    ) => {
        if (actions.length === 0) return null;

        const totalWidth = (actions.length * buttonWidth) + margin;

        const animatedStyle = useAnimatedStyle(() => {
            return {
                transform: [{
                    translateX: interpolate(dragX.value, [-totalWidth, 0], [0, totalWidth], Extrapolation.CLAMP)
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
                        paddingLeft: margin,
                    },
                    animatedStyle,
                ]}
            >
                {actions.map((action, index) => (
                    <SwipeActionButton
                        key={index}
                        action={action}
                        index={index}
                        buttonWidth={buttonWidth}
                        isOpen={isOpen}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            action.onPress();
                            swipeableRef.current?.close();
                        }}
                    />
                ))}
            </Reanimated.View>
        );
    };

    return (
        <ReanimatedSwipeable
            ref={swipeableRef}
            renderRightActions={(progress, dragX) => renderActions(rightActions, dragX)}
            friction={1}
            enableTrackpadTwoFingerGesture
            rightThreshold={40}
            onSwipeableWillOpen={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (Platform.OS === 'ios') {
                    navigation.setOptions({ gestureEnabled: false });
                }
                isOpen.value = true;
            }}
            onSwipeableWillClose={() => {
                if (Platform.OS === 'ios') {
                    navigation.setOptions({ gestureEnabled: true });
                }
                isOpen.value = false;
            }}
            hitSlop={{ left: -50 }}
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
