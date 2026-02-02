import { useSettingsStore } from '@/stores/settings-store';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, PressableProps } from 'react-native';

interface HapticPressableProps extends PressableProps {
    /**
     * Type of haptic feedback to trigger.
     * @default Haptics.ImpactFeedbackStyle.Light
     */
    feedbackType?: Haptics.ImpactFeedbackStyle;

    /**
     * If true, haptic feedback will be disabled for this specific button
     * regardless of the global setting.
     */
    disableHaptic?: boolean;
}

export function HapticPressable({
    onPress,
    feedbackType = Haptics.ImpactFeedbackStyle.Light,
    disableHaptic = false,
    ...props
}: HapticPressableProps) {
    const { general } = useSettingsStore();

    const handlePress = (event: any) => {
        if (general.hapticFeedback && !disableHaptic) {
            Haptics.impactAsync(feedbackType);
        }
        onPress?.(event);
    };

    return (
        <Pressable
            {...props}
            onPress={handlePress}
        />
    );
}
