import { useIsPremium, useUserStore } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { PlatformPressable } from '@react-navigation/elements';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';

interface FileInputProps {
    onSubmit: (url: string) => void;
    onPickFromLibrary?: () => void;
    onPickDocument?: () => void;
    onTakePhoto?: () => void;
    onClose: () => void;
    isLoading?: boolean;
}

export function FileInput({ onSubmit, onPickFromLibrary, onPickDocument, onTakePhoto, onClose, isLoading }: FileInputProps) {
    const { colors, dark } = useTheme();
    const isGuest = useUserStore((state) => state.isGuest);
    const isPremium = useIsPremium();
    const canUploadPdf = isGuest || isPremium;

    const [url, setUrl] = useState('');
    const [error, setError] = useState<string | null>(null);

    const validate = useCallback((value: string) => {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            setError(null);
            return false;
        }
        const imageExtensions = /\.(webp|png|jpe?g|gif|svg|bmp|tiff)$/i;
        try {
            new URL(trimmed);
        } catch (_) {
            setError('Invalid URL format');
            return false;
        }
        if (!imageExtensions.test(trimmed)) {
            setError('URL must point to a valid image (webp, png, jpeg, gif, svg, etc.)');
            return false;
        }
        setError(null);
        return true;
    }, []);

    const handleChangeText = useCallback((text: string) => {
        setUrl(text);
        validate(text);
    }, [validate]);

    const isValid = url.trim().length > 0 && !error;

    const handleFormSubmit = useCallback(() => {
        const trimmed = url.trim();
        if (!validate(trimmed)) return;
        onSubmit(trimmed);
        setUrl('');
        setError(null);
    }, [url, validate, onSubmit]);


    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
                <PlatformPressable
                    onPress={onClose}
                    style={styles.headerButton}
                    disabled={isLoading}
                >
                    <Text style={[styles.headerCancelText, { color: colors.primary, opacity: isLoading ? 0.5 : 1 }]}>Cancel</Text>
                </PlatformPressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    Insert File
                </Text>
                <PlatformPressable
                    onPress={handleFormSubmit}
                    disabled={!isValid || isLoading}
                    style={styles.headerButton}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <Ionicons
                            name="checkmark"
                            size={24}
                            color={isValid ? colors.primary : colors.text + '30'}
                        />
                    )}
                </PlatformPressable>
            </View>

            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
                {/* Source buttons */}
                <View style={styles.sourceRow}>
                    {isLoading ? (
                        <View style={[styles.loadingContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={[styles.sourceLabel, { color: colors.text, marginLeft: 8 }]}>Processing file...</Text>
                        </View>
                    ) : (
                        <>
                            {onPickFromLibrary && (
                                <Pressable
                                    style={[styles.sourceButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                                    onPress={onPickFromLibrary}
                                >
                                    <Ionicons name="images-outline" size={22} color={colors.primary} />
                                    <Text style={[styles.sourceLabel, { color: colors.text }]}>Library</Text>
                                </Pressable>
                            )}
                            {onPickDocument && (
                                <Pressable
                                    style={[
                                        styles.sourceButton,
                                        { backgroundColor: colors.card, borderColor: colors.border },
                                        !canUploadPdf && { opacity: 0.5 }
                                    ]}
                                    onPress={onPickDocument}
                                    disabled={!canUploadPdf}
                                >
                                    <Ionicons name="document-outline" size={22} color={canUploadPdf ? colors.primary : colors.text + '30'} />
                                    <Text style={[styles.sourceLabel, { color: canUploadPdf ? colors.text : colors.text + '30' }]}>
                                        Files
                                    </Text>
                                </Pressable>
                            )}
                            {onTakePhoto && (
                                <Pressable
                                    style={[styles.sourceButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                                    onPress={onTakePhoto}
                                >
                                    <Ionicons name="camera-outline" size={22} color={colors.primary} />
                                    <Text style={[styles.sourceLabel, { color: colors.text }]}>Camera</Text>
                                </Pressable>
                            )}
                        </>
                    )}
                </View>

                {/* Divider */}
                <View style={styles.dividerRow}>
                    <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                    <Text style={[styles.dividerText, { color: colors.border }]}>or paste Image URL</Text>
                    <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                </View>

                {/* URL input */}
                <View>
                    <TextInput
                        style={[styles.input, {
                            color: colors.text,
                            backgroundColor: dark ? '#1C1C1E' : '#F2F2F7',
                            borderColor: error ? '#FF453A' : (dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'),
                            opacity: isLoading ? 0.5 : 1,
                        }]}
                        value={url}
                        onChangeText={handleChangeText}
                        placeholder="https://example.com/image.png"
                        placeholderTextColor={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        returnKeyType="done"
                        editable={!isLoading}
                        onSubmitEditing={handleFormSubmit}
                    />
                    {error && (
                        <Text style={styles.errorText}>{error}</Text>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    headerButton: {
        minWidth: 60,
        paddingVertical: 8,
        justifyContent: 'center',
    },
    headerCancelText: {
        fontSize: Platform.OS === 'ios' ? 17 : 14,
        fontWeight: '400',
    },
    headerTitle: {
        fontSize: Platform.OS === 'ios' ? 17 : 20,
        fontWeight: Platform.OS === 'ios' ? '600' : '500',
    },
    formContent: {
        padding: 16,
        gap: 16,
    },
    sourceRow: {
        flexDirection: 'row',
        gap: 10,
    },
    loadingContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    sourceButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    sourceLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dividerLine: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
    },
    dividerText: {
        fontSize: 12,
    },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
    },
    errorText: {
        color: '#FF453A',
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
    },
});
