import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '@react-navigation/native';
import React, { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
        resolver: zodResolver(youtubeSchema),
        defaultValues: {
            url: '',
        },
        mode: 'onChange'
    });

    useEffect(() => {
        // Focus input when opened
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const onSubmitForm = (data: YouTubeFormValues) => {
        const trimmedUrl = data.url.trim();
        const finalUrl = trimmedUrl.match(/^https?:\/\//) ? trimmedUrl : 'https://' + trimmedUrl;
        onSubmit(finalUrl);
        reset();
    };

    return (
        <View style={styles.popupContent}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>Embed YouTube Video</Text>
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
            <View style={styles.buttonRow}>
                <Pressable
                    style={[styles.button, { backgroundColor: dark ? '#3A3A3C' : '#E5E5EA' }]}
                    onPress={onClose}
                >
                    <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                    style={[styles.button, {
                        backgroundColor: isValid ? colors.primary : (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
                    }]}
                    onPress={handleSubmit(onSubmitForm)}
                    disabled={!isValid}
                >
                    <Text style={[styles.buttonText, {
                        color: isValid ? '#FFFFFF' : (dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)')
                    }]}>Embed</Text>
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
    errorText: {
        color: '#FF3B30',
        fontSize: 12,
        marginTop: -8,
        marginLeft: 4,
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
