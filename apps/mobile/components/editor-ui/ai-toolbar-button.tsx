import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@react-navigation/native';
import { useAiConfiguration } from '@annota/core';
import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { 
    useAnimatedStyle, 
    useSharedValue, 
    withTiming 
} from 'react-native-reanimated';

export interface AIToolbarButtonProps {
    onPress: () => void;
    isVisible?: boolean;
    isLoading?: boolean;
}

export function AIToolbarButton({
    onPress,
    isVisible = true,
    isLoading = false,
}: AIToolbarButtonProps) {
    const { isAiAvailable } = useAiConfiguration();
    const { colors } = useTheme();
    const effectiveVisibility = isVisible && isAiAvailable;
    const opacity = useSharedValue(effectiveVisibility ? 1 : 0);

    useEffect(() => {
        if (effectiveVisibility) {
            opacity.value = withTiming(1, { duration: 300 });
        } else {
            opacity.value = withTiming(0, { duration: 200 });
        }
    }, [effectiveVisibility]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        display: opacity.value === 0 ? 'none' : 'flex',
    }));

    if (!effectiveVisibility && opacity.value === 0) return null;

    return (
        <Animated.View style={animatedStyle}>
            <Pressable
                onPress={onPress}
                disabled={isLoading}
                style={({ pressed }) => [
                    styles.button,
                    {
                        backgroundColor: colors.primary,
                    },
                    (pressed || isLoading) && { opacity: 0.8 },
                ]}
            >
                <View style={styles.iconContainer}>
                    {isLoading ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <MaterialIcons name="auto-awesome" size={20} color="white" />
                    )}
                </View>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    button: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 4,
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
