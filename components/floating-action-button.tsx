import { useAppTheme } from '@/hooks/use-app-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

interface FloatingActionButtonProps {
    onPress: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
    size?: number;
}

export default function FloatingActionButton({
    onPress,
    icon = 'add',
    size = 60,
}: FloatingActionButtonProps) {
    const theme = useAppTheme();

    return (
        <View style={[styles.container, { bottom: 16 }]}>
            <Pressable
                onPress={onPress}
                style={({ pressed }) => [
                    styles.button,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: theme.colors.primary,
                        shadowColor: theme.colors.primary,
                    },
                    pressed && styles.pressed,
                ]}
            >
                <Ionicons name={icon} size={28} color="#FFFFFF" />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 100,
    },
    button: {
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 8,
    },
    pressed: {
        opacity: 0.85,
        transform: [{ scale: 0.95 }],
    },
});
