import { useSettingsStore } from '@annota/core';
import Slider from '@react-native-community/slider';
import { useTheme } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface SettingsSliderProps {
    value: number;
    minValue?: number;
    maxValue?: number;
    step?: number;
    onValueChange: (value: number) => void;
    minLabel?: string;
    units?: string;
    maxLabel?: string;
    label?: string;
    displayValue?: string | number;
}

export default function SettingsSlider({
    value,
    minValue = 0,
    maxValue = 100,
    step = 1,
    units = "px",
    onValueChange,
    minLabel,
    maxLabel,
    label,
    displayValue
}: SettingsSliderProps) {
    const { colors, dark } = useTheme();
    const { accentColor, general } = useSettingsStore();

    const formattedValue = displayValue !== undefined
        ? displayValue
        : `${Math.round(((value - minValue) / (maxValue - minValue)) * 100)}${units}`;

    return (
        <View style={[styles.container, { backgroundColor: colors.card }]}>
            {label && (
                <View style={styles.header}>
                    <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
                    <Text style={[styles.value, { color: colors.text + '80' }]}>
                        {formattedValue}
                    </Text>
                </View>
            )}

            <View style={styles.sliderContainer}>
                <Slider
                    style={{ flex: 1, height: 32 }}
                    minimumValue={minValue}
                    maximumValue={maxValue}
                    step={step}
                    value={value}
                    onValueChange={(val) => {
                        onValueChange(val);
                        if (general.hapticFeedback) Haptics.selectionAsync();
                    }}
                    minimumTrackTintColor={accentColor}
                    maximumTrackTintColor={dark ? '#3A3A3C' : '#E5E5EA'}
                    thumbTintColor={accentColor}
                />
            </View>

            {(minLabel || maxLabel) && (
                <View style={styles.labelsRow}>
                    <Text style={[styles.limitLabel, { color: colors.text + '60' }]}>{minLabel}</Text>
                    <Text style={[styles.limitLabel, { color: colors.text + '60' }]}>{maxLabel}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
    },
    value: {
        fontSize: 14,
        fontWeight: '600',
    },
    sliderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    labelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    limitLabel: {
        fontSize: 12,
    },
});
