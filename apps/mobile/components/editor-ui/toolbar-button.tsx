import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@react-navigation/native';
import React, { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

export interface ToolbarButtonProps {
    icon?: MaterialIconName;
    label?: string;
    isActive?: boolean;
    onPress: () => void;
    disabled?: boolean;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textDecoration?: 'none' | 'underline';
    /** Optional color indicator bar below the icon */
    colorIndicator?: string;
}

export function ToolbarButton({
    icon,
    label,
    isActive,
    onPress,
    disabled,
    fontWeight,
    fontStyle,
    textDecoration,
    colorIndicator,
}: ToolbarButtonProps) {
    const { colors, dark } = useTheme();
    const hasColor = !!colorIndicator;
    const baseColor = colorIndicator || colors.primary;
    const buttonColor = colorIndicator || (isActive ? colors.primary : colors.text + '99');

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.toolbarButton,
                pressed && { opacity: 0.6 },
                disabled && { opacity: 0.3 },
            ]}
        >
            {(isActive || hasColor) && (
                <View
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            backgroundColor: baseColor,
                            opacity: 0.15,
                            borderRadius: 8,
                        },
                    ]}
                />
            )}
            {label ? (
                <Text
                    style={[
                        styles.toolbarButtonText,
                        { color: buttonColor },
                        fontWeight === 'bold' && { fontWeight: 'bold' },
                        fontStyle === 'italic' && { fontStyle: 'italic' },
                        textDecoration === 'underline' && { textDecorationLine: 'underline' },
                    ]}
                >
                    {label}
                </Text>
            ) : icon ? (
                <View style={styles.iconContainer}>
                    <MaterialIcons name={icon} size={22} color={buttonColor} />
                </View>
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    toolbarButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toolbarButtonText: {
        fontSize: 20,
        fontWeight: '500',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
