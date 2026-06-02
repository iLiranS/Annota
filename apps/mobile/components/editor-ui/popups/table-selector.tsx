import { useTheme } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface TableSelectorProps {
    onSelect: (rows: number, cols: number) => void;
}

export function TableSelector({ onSelect }: TableSelectorProps) {
    const { colors, dark } = useTheme();

    const options = [
        { label: '2 x 2', rows: 2, cols: 2 },
        { label: '3 x 3', rows: 3, cols: 3 },
        { label: '4 x 4', rows: 4, cols: 4 },
        { label: '5 x 5', rows: 5, cols: 5 },
        { label: '6 x 6', rows: 6, cols: 6 },
        { label: '7 x 7', rows: 7, cols: 7 },
        { label: '8 x 8', rows: 8, cols: 8 },
        { label: '9 x 9', rows: 9, cols: 9 },
    ];

    return (
        <View style={styles.popupContent}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>Insert Table Size</Text>
            <View style={styles.grid}>
                {options.map((opt) => (
                    <Pressable
                        key={opt.label}
                        style={({ pressed }) => [
                            styles.gridItem,
                            { backgroundColor: dark ? '#2C2C2E' : '#F2F2F7' },
                            pressed && { opacity: 0.7 }
                        ]}
                        onPress={() => onSelect(opt.rows, opt.cols)}
                    >
                        <Text style={[styles.gridText, { color: colors.text }]}>
                            {opt.label}
                        </Text>
                    </Pressable>
                ))}
            </View>
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
        marginBottom: 8,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
    },
    gridItem: {
        width: '45%',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridText: {
        fontSize: 16,
        fontWeight: '500',
    },
});
