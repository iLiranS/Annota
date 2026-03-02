import { COLOR_PALETTE } from '@annota/core/constants/colors';
import { useTheme } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ColorSelectorProps {
    title: string;
    currentColor: string | null;
    onSelect: (color: string) => void;
    onClear: () => void;
}

export function ColorSelector({ title, currentColor, onSelect, onClear }: ColorSelectorProps) {
    const { colors, dark } = useTheme();

    return (
        <View style={styles.popupContent}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>{title}</Text>
            <View style={styles.colorGrid}>
                {COLOR_PALETTE.map((colorOption) => {
                    const colorValue = colorOption.value;
                    return (
                        <Pressable
                            key={colorValue}
                            style={[
                                styles.colorItem,
                                { backgroundColor: colorValue },
                                currentColor === colorValue && styles.colorItemSelected,
                            ]}
                            onPress={() => onSelect(colorValue)}
                        />
                    );
                })}
            </View>
            {currentColor && (
                <Pressable
                    style={[styles.clearButton, { backgroundColor: dark ? '#3A3A3C' : '#E5E5EA' }]}
                    onPress={onClear}
                >
                    <Text style={[styles.clearButtonText, { color: colors.text }]}>Remove</Text>
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    popupContent: {
        gap: 12,
    },
    popupTitle: {
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 4,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
    },
    colorItem: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    colorItemSelected: {
        borderWidth: 3,
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    clearButton: {
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 4,
    },
    clearButtonText: {
        fontSize: 15,
        fontWeight: '500',
    },
});
