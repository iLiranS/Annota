import { useTheme } from '@react-navigation/native';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface LinkInputProps {
    currentUrl: string | null;
    onSubmit: (url: string) => void;
    onRemove: () => void;
    onClose: () => void;
}

export function LinkInput({ currentUrl, onSubmit, onRemove, onClose }: LinkInputProps) {
    const { colors, dark } = useTheme();
    const [url, setUrl] = React.useState(currentUrl || '');
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        // Focus input when opened
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const handleSubmit = () => {
        const trimmedUrl = url.trim();
        if (trimmedUrl) {
            // Auto-add https:// if missing
            const finalUrl = trimmedUrl.match(/^https?:\/\//) ? trimmedUrl : 'https://' + trimmedUrl;
            onSubmit(finalUrl);
        }
    };

    return (
        <View style={styles.popupContent}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>Add Link</Text>
            <TextInput
                ref={inputRef}
                style={[
                    styles.urlInput,
                    {
                        backgroundColor: dark ? '#1C1C1E' : '#F2F2F7',
                        color: colors.text,
                        borderColor: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                    },
                ]}
                placeholder="Enter URL..."
                placeholderTextColor={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                onSubmitEditing={handleSubmit}
            />
            <View style={styles.buttonRow}>
                <Pressable
                    style={[styles.button, { backgroundColor: dark ? '#3A3A3C' : '#E5E5EA' }]}
                    onPress={onClose}
                >
                    <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                {currentUrl && (
                    <Pressable
                        style={[styles.button, { backgroundColor: '#FF3B30' }]}
                        onPress={onRemove}
                    >
                        <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Remove</Text>
                    </Pressable>
                )}
                <Pressable
                    style={[styles.button, { backgroundColor: colors.primary }]}
                    onPress={handleSubmit}
                >
                    <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                        {currentUrl ? 'Update' : 'Add'}
                    </Text>
                </Pressable>
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
        marginBottom: 4,
    },
    urlInput: {
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        fontSize: 16,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    button: {
        flex: 1,
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '500',
    },
});
