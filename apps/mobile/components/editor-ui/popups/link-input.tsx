import { useTheme } from '@react-navigation/native';
import { PlatformPressable } from '@react-navigation/elements';
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// Allow any valid HTTP/HTTPS URL, including annota.online with deep link paths
const urlRegex = /^(https?:\/\/)?[-a-zA-Z0-9@:%._\+~#=]{1,256}(\.[a-zA-Z0-9()]{2,6})?\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

interface LinkInputProps {
    currentUrl: string | null;
    selectedText?: string;
    onSubmit: (url: string, title?: string) => void;
    onRemove: () => void;
    onClose: () => void;
}

export function LinkInput({ currentUrl, selectedText, onSubmit, onRemove, onClose }: LinkInputProps) {
    const { colors, dark } = useTheme();
    const inputRef = useRef<TextInput>(null);

    const hasSelection = Boolean(selectedText && selectedText.trim().length > 0);

    const [url, setUrl] = useState(currentUrl || '');
    const [title, setTitle] = useState('');
    const [error, setError] = useState<string | null>(null);

    const validate = useCallback((val: string) => {
        const trimmed = val.trim();
        if (trimmed.length === 0) {
            setError(null);
            return false;
        }
        if (!urlRegex.test(trimmed)) {
            setError('Please enter a valid URL');
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

        if (hasSelection) {
            onSubmit(finalUrl); // Modifies the existing selection
        } else {
            onSubmit(finalUrl, title.trim() || finalUrl); // Creates a new link text node
        }
    }, [url, title, hasSelection, onSubmit, validate]);


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
                    {currentUrl ? 'Edit Link' : 'Add Link'}
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
                {!hasSelection && (
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: dark ? '#1C1C1E' : '#F2F2F7',
                                color: colors.text,
                                borderColor: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                            },
                        ]}
                        placeholder="Link Title (optional)"
                        placeholderTextColor={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                        value={title}
                        onChangeText={setTitle}
                        autoCapitalize="sentences"
                    />
                )}

                <TextInput
                    ref={inputRef}
                    style={[
                        styles.input,
                        {
                            backgroundColor: dark ? '#1C1C1E' : '#F2F2F7',
                            color: colors.text,
                            borderColor: error ? '#FF3B30' : (dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'),
                        },
                    ]}
                    placeholder="Enter URL..."
                    placeholderTextColor={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                    value={url}
                    onChangeText={handleChangeUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    onSubmitEditing={onSubmitForm}
                />
                {error && <Text style={styles.errorText}>{error}</Text>}

                {currentUrl && (
                    <Pressable
                        style={styles.removeButton}
                        onPress={onRemove}
                    >
                        <Text style={styles.removeButtonText}>Remove Link</Text>
                    </Pressable>
                )}
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
    input: {
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
    removeButton: {
        backgroundColor: '#FF3B30',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    removeButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
