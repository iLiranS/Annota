import { useAppTheme } from '@/hooks/use-app-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { HapticPressable } from './ui/haptic-pressable';

interface FloatingActionButtonProps {
    onPress: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
    size?: number;
    isFloating?: boolean;
    style?: any;
}

export default function FloatingActionButton({
    onPress,
    icon = 'add',
    size = 56,
    isFloating = true,
    style,
}: FloatingActionButtonProps) {
    const theme = useAppTheme();

    return (
        <View style={[
            isFloating && styles.floatingContainer,
            isFloating && { bottom: 16 },
            style
        ]}>
            <HapticPressable
                onPress={onPress}
                style={({ pressed }) => [
                    styles.button,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: theme.colors.primary,
                        shadowColor: theme.colors.primary,
                        shadowOffset: { width: 0, height: isFloating ? 8 : 4 },
                        shadowOpacity: isFloating ? 0.6 : 0.4,
                        shadowRadius: isFloating ? 12 : 8,
                        elevation: isFloating ? 12 : 6,
                        borderWidth: 1.5,
                        borderColor: theme.colors.card + '30',
                    },
                    pressed && styles.pressed,
                ]}
            >
                <Ionicons name={icon} size={Math.floor(size * 0.5)} color="#FFFFFF" />
            </HapticPressable>
        </View>
    );
}

const styles = StyleSheet.create({
    floatingContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 100,
    },
    button: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: {
        opacity: 0.85,
        transform: [{ scale: 0.95 }],
    },
});
