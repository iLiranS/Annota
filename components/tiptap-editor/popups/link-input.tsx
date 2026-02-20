import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '@react-navigation/native';
import React, { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

// More strict URL regex requiring a proper TLD (e.g., .com, .net, .co.uk)
const urlRegex = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{2,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

const linkSchema = z.object({
    url: z.string().min(1, 'URL is required').refine(val => {
        const trimmed = val.trim();
        return urlRegex.test(trimmed);
    }, { message: 'Please enter a valid URL' }),
    title: z.string().optional()
});

type LinkFormValues = z.infer<typeof linkSchema>;

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

    const {
        control,
        handleSubmit,
        formState: { errors, isValid }
    } = useForm<LinkFormValues>({
        resolver: zodResolver(linkSchema),
        defaultValues: {
            url: currentUrl || '',
            title: '',
        },
        mode: 'onChange'
    });

    useEffect(() => {
        // Focus input when opened
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const onSubmitForm = (data: LinkFormValues) => {
        const trimmedUrl = data.url.trim();
        const finalUrl = trimmedUrl.match(/^https?:\/\//) ? trimmedUrl : 'https://' + trimmedUrl;

        if (hasSelection) {
            onSubmit(finalUrl); // Modifies the existing selection
        } else {
            onSubmit(finalUrl, data.title?.trim() || finalUrl); // Creates a new link text node
        }
    };

    return (
        <View style={styles.popupContent}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>Add Link</Text>

            {!hasSelection && (
                <Controller
                    control={control}
                    name="title"
                    render={({ field: { onChange, onBlur, value } }) => (
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
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            autoCapitalize="sentences"
                        />
                    )}
                />
            )}

            <Controller
                control={control}
                name="url"
                render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                        ref={inputRef}
                        style={[
                            styles.input,
                            {
                                backgroundColor: dark ? '#1C1C1E' : '#F2F2F7',
                                color: colors.text,
                                borderColor: errors.url ? '#FF3B30' : (dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'),
                            },
                        ]}
                        placeholder="Enter URL..."
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
                {currentUrl && (
                    <Pressable
                        style={[styles.button, { backgroundColor: '#FF3B30' }]}
                        onPress={onRemove}
                    >
                        <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Remove</Text>
                    </Pressable>
                )}
                <Pressable
                    style={[styles.button, {
                        backgroundColor: isValid ? colors.primary : (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
                    }]}
                    onPress={handleSubmit(onSubmitForm)}
                    disabled={!isValid}
                >
                    <Text style={[styles.buttonText, {
                        color: isValid ? '#FFFFFF' : (dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)')
                    }]}>
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
