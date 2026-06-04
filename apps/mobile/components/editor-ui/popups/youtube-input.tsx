import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '@react-navigation/native';
import { PlatformPressable } from '@react-navigation/elements';
import React, { useEffect, useRef, useCallback } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Platform, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { z } from 'zod';

const youtubeSchema = z.object({
    url: z.string().min(1, 'Video URL is required').refine(val => {
        const trimmed = val.trim();
        const withProtocol = trimmed.match(/^https?:\/\//) ? trimmed : 'https://' + trimmed;
        const isUrl = z.string().url().safeParse(withProtocol).success;
        if (!isUrl) return false;
        return withProtocol.includes('youtube.com') || withProtocol.includes('youtu.be');
    }, { message: 'Please enter a valid YouTube URL' })
});

type YouTubeFormValues = z.infer<typeof youtubeSchema>;

interface YouTubeInputProps {
    onSubmit: (url: string) => void;
    onClose: () => void;
}

export function YouTubeInput({ onSubmit, onClose }: YouTubeInputProps) {
    const { colors, dark } = useTheme();
    const inputRef = useRef<TextInput>(null);

    const {
        control,
        handleSubmit,
        formState: { errors, isValid },
        reset
    } = useForm<YouTubeFormValues>({
        //@ts-expect-error
        resolver: zodResolver(youtubeSchema),
        defaultValues: {
            url: '',
        },
        mode: 'onChange'
    });

    const onSubmitForm = useCallback((data: YouTubeFormValues) => {
        const trimmedUrl = data.url.trim();
        const finalUrl = trimmedUrl.match(/^https?:\/\//) ? trimmedUrl : 'https://' + trimmedUrl;
        onSubmit(finalUrl);
        reset();
    }, [onSubmit, reset]);

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
                    onPress={handleSubmit(onSubmitForm)}
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
                <Controller
                    control={control}
                    name="url"
                    render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                            ref={inputRef}
                            style={[
                                styles.urlInput,
                                {
                                    backgroundColor: dark ? '#1C1C1E' : '#F2F2F7',
                                    color: colors.text,
                                    borderColor: errors.url ? '#FF3B30' : (dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'),
                                },
                            ]}
                            placeholder="Paste YouTube URL..."
                            placeholderTextColor={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            onSubmitEditing={handleSubmit(onSubmitForm)}
                        />
                    )}
                />
                {errors.url && <Text style={styles.errorText}>{errors.url.message as string}</Text>}
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
