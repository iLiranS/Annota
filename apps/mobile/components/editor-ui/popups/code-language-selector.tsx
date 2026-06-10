
import { CODE_LANGUAGES } from '@annota/core/constants/editor-code-languages';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@react-navigation/native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';



interface CodeLanguageSelectorProps {
    currentLanguage: string | null;
    onSelect: (language: string) => void;
}

export function CodeLanguageSelector({ currentLanguage, onSelect }: CodeLanguageSelectorProps) {
    const { colors, dark } = useTheme();

    return (
        <View style={styles.container}>
            <Text style={[styles.title, { color: colors.text }]}>Code Language</Text>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.languageGrid}>
                    {CODE_LANGUAGES.map((lang) => {
                        const isSelected = currentLanguage === lang.value;
                        return (
                            <Pressable
                                key={lang.value}
                                style={[
                                    styles.languageItem,
                                    {
                                        backgroundColor: isSelected
                                            ? colors.primary
                                            : dark
                                                ? 'rgba(255,255,255,0.08)'
                                                : 'rgba(0,0,0,0.05)',
                                    },
                                ]}
                                onPress={() => onSelect(lang.value)}
                            >
                                <Text
                                    style={[
                                        styles.languageLabel,
                                        {
                                            color: isSelected ? '#FFFFFF' : colors.text,
                                        },
                                    ]}
                                >
                                    {lang.label}
                                </Text>
                                {isSelected && (
                                    <MaterialIcons name="check" size={16} color="#FFFFFF" />
                                )}
                            </Pressable>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 12,
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 4,
    },
    scrollView: {
        maxHeight: 280,
    },
    languageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    languageItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    languageLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
});
