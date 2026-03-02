import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useTheme } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
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
    rightActions?: SwipeAction[];
    compact?: boolean;
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
            renderRightActions={(progress, dragX) => renderActions(rightActions, dragX)}
            friction={2}
            enableTrackpadTwoFingerGesture
            dragOffsetFromLeftEdge={30}
            rightThreshold={40}
            onSwipeableWillOpen={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (Platform.OS === 'ios') {
                    navigation.setOptions({ gestureEnabled: false });
                }
            }}
            onSwipeableWillClose={() => {
                if (Platform.OS === 'ios') {
                    navigation.setOptions({ gestureEnabled: true });
                }
            }}
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
