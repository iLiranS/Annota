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
    const buttonColor = isActive ? colors.primary : dark ? '#FFFFFF' : '#333333';

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.toolbarButton,
                isActive && { backgroundColor: colors.primary + '25' },
                pressed && { opacity: 0.6 },
                disabled && { opacity: 0.3 },
            ]}
        >
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
                    <MaterialIcons name={icon} size={20} color={buttonColor} />
                    {colorIndicator && (
                        <View
                            style={[styles.colorIndicator, { backgroundColor: colorIndicator }]}
                        />
                    )}
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
    toolbarButtonActive: {
        backgroundColor: 'rgba(0, 122, 255, 0.15)',
    },
    toolbarButtonText: {
        fontSize: 17,
        fontWeight: '500',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    colorIndicator: {
        position: 'absolute',
        bottom: -4,
        left: 2,
        right: 2,
        height: 3,
        borderRadius: 1.5,
    },
});
