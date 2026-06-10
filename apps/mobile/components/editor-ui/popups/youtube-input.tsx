import { useTheme } from '@react-navigation/native';
import { PlatformPressable } from '@react-navigation/elements';
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface YouTubeInputProps {
    onSubmit: (url: string) => void;
    onClose: () => void;
}

export function YouTubeInput({ onSubmit, onClose }: YouTubeInputProps) {
    const { colors, dark } = useTheme();
    const inputRef = useRef<TextInput>(null);

    const [url, setUrl] = useState('');
    const [error, setError] = useState<string | null>(null);

    const validate = useCallback((val: string) => {
        const trimmed = val.trim();
        if (trimmed.length === 0) {
            setError(null);
            return false;
        }
        const withProtocol = trimmed.match(/^https?:\/\//) ? trimmed : 'https://' + trimmed;
        try {
            new URL(withProtocol);
        } catch (_) {
            setError('Please enter a valid YouTube URL');
            return false;
        }
        if (!withProtocol.includes('youtube.com') && !withProtocol.includes('youtu.be')) {
            setError('Please enter a valid YouTube URL');
            return false;
        }
        setError(null);
        return true;
    }, []);

    const handleChangeUrl = useCallback((val: string) => {
        setUrl(val);
        validate(val);
    }, [validate]);

    const isValid = url.trim().length > 0 && !error;

    const onSubmitForm = useCallback(() => {
        const trimmedUrl = url.trim();
        if (!validate(trimmedUrl)) return;
        const finalUrl = trimmedUrl.match(/^https?:\/\//) ? trimmedUrl : 'https://' + trimmedUrl;
        onSubmit(finalUrl);
        setUrl('');
        setError(null);
    }, [url, onSubmit, validate]);


    useEffect(() => {
        // Focus input when opened
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
                <PlatformPressable onPress={onClose} style={styles.headerButton}>
                    <Text style={[styles.headerCancelText, { color: colors.primary }]}>Cancel</Text>
                </PlatformPressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    YouTube Video
                </Text>
                <PlatformPressable
                    onPress={onSubmitForm}
                    style={styles.headerButton}
                    disabled={!isValid}
                >
                    <Ionicons
                        name="checkmark"
                        size={24}
                        color={isValid ? colors.primary : colors.text + '30'}
                    />
                </PlatformPressable>
            </View>

            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
                <TextInput
                    ref={inputRef}
                    style={[
                        styles.urlInput,
                        {
                            backgroundColor: dark ? '#1C1C1E' : '#F2F2F7',
                            color: colors.text,
                            borderColor: error ? '#FF3B30' : (dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'),
                        },
                    ]}
                    placeholder="Paste YouTube URL..."
                    placeholderTextColor={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                    value={url}
                    onChangeText={handleChangeUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    onSubmitEditing={onSubmitForm}
                />
                {error && <Text style={styles.errorText}>{error}</Text>}
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
    urlInput: {
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        fontSize: 16,
    },
    errorText: {
        color: '#FF3B30',
        fontSize: 12,
        marginTop: -8,
        marginLeft: 4,
    },
});
