import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { HapticPressable } from '../ui/haptic-pressable';

interface SettingItemProps {
    label: string;
    icon?: keyof typeof Ionicons.glyphMap;
    type?: 'link' | 'toggle' | 'value';
    value?: string | boolean;
    onPress?: () => void;
    onToggle?: (value: boolean) => void;
    description?: string;
    textColor?: string;
    iconColor?: string;
    iconBackgroundColor?: string;
}

export default function SettingItem({
    label,
    icon,
    type = 'link',
    value,
    onPress,
    onToggle,
    description,
    textColor,
    iconColor,
    iconBackgroundColor,
}: SettingItemProps) {
    const { colors, dark } = useTheme();

    return (
        <HapticPressable
            onPress={type === 'toggle' ? () => onToggle?.(!value) : onPress}
            style={({ pressed }) => [
                styles.container,
                { backgroundColor: colors.card },
                pressed && type !== 'toggle' && { backgroundColor: dark ? '#2C2C2E' : '#F2F2F7' }
            ]}
        >
            <View style={styles.content}>
                {icon && (
                    <View style={[
                        styles.iconContainer,
                        { backgroundColor: iconBackgroundColor || (dark ? '#3A3A3C' : '#E5E5EA') }
                    ]}>
                        <Ionicons name={icon} size={20} color={iconColor || colors.text} />
                    </View>
                )}
                <View style={[styles.textContainer, !icon && { marginLeft: 0 }]}>
                    <Text style={[styles.label, { color: textColor || colors.text }]}>{label}</Text>
                    {description && (
                        <Text style={[styles.description, { color: colors.text + '80' }]}>
                            {description}
                        </Text>
                    )}
                </View>
            </View>

            <View style={styles.rightContent}>
                {type === 'link' && (
                    <>
                        {value && (
                            <Text style={[styles.valueText, { color: colors.text + '60' }]}>
                                {value}
                            </Text>
                        )}
                        <Ionicons name="chevron-forward" size={20} color={colors.text + '40'} />
                    </>
                )}

                {type === 'toggle' && (
                    <Switch
                        value={value as boolean}
                        onValueChange={onToggle}
                        trackColor={{ true: colors.primary, false: dark ? '#3A3A3C' : '#E5E5EA' }}
                    />
                )}

                {type === 'value' && (
                    <Text style={[styles.valueText, { color: colors.text + '60' }]}>
                        {value}
                    </Text>
                )}
            </View>
        </HapticPressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 56,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(150, 150, 150, 0.1)',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
    },
    description: {
        fontSize: 13,
        marginTop: 2,
    },
    rightContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    valueText: {
        fontSize: 15,
    },
});
