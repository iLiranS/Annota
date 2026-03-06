import { HEADING_LEVELS, HeadingLevel } from '@annota/core/constants/editor';
import { useTheme } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface HeadingSelectorProps {
    currentLevel: HeadingLevel | null;
    onSelect: (level: HeadingLevel) => void;
    onCopyLink?: () => void;
}

export function HeadingSelector({ currentLevel, onSelect, onCopyLink }: HeadingSelectorProps) {
    const { colors, dark } = useTheme();

    return (
        <View style={styles.popupContent}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>Heading</Text>
            <View style={styles.headingGrid}>
                {HEADING_LEVELS.map((level) => (
                    <Pressable
                        key={level}
                        style={[
                            styles.headingItem,
                            { backgroundColor: dark ? '#3A3A3C' : '#E5E5EA' },
                            currentLevel === level && { backgroundColor: colors.primary },
                        ]}
                        onPress={() => onSelect(level)}
                    >
                        <Text
                            style={[
                                styles.headingText,
                                { color: currentLevel === level ? '#FFFFFF' : colors.text },
                                { fontSize: 22 - level * 2 },
                            ]}
                        >
                            H{level}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {onCopyLink && (
                <View style={{ marginTop: 8 }}>
                    <Pressable
                        style={[
                            styles.copyLinkButton,
                            { backgroundColor: dark ? '#3A3A3C' : '#E5E5EA' },
                        ]}
                        onPress={onCopyLink}
                    >
                        <Text style={[styles.copyLinkText, { color: colors.text }]}>
                            Copy Heading Link
                        </Text>
                    </Pressable>
                </View>
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
    headingGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
    },
    headingItem: {
        width: 48,
        height: 48,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headingText: {
        fontWeight: '600',
    },
    copyLinkButton: {
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    copyLinkText: {
        fontSize: 16,
        fontWeight: '500',
    },
});
