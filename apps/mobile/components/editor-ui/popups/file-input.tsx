import { imageInputSchema, type ImageInputData } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '@react-navigation/native';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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

    const {
        control,
        handleSubmit,
        formState: { errors, isValid },
        reset
    } = useForm<ImageInputData>({
        resolver: zodResolver(imageInputSchema as any),
        defaultValues: {
            url: ''
        },
        mode: 'onChange'
    });

    const onValidSubmit = (data: ImageInputData) => {
        onSubmit(data.url);
        reset();
    };

    return (
        <View style={styles.container}>
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
                                style={[styles.sourceButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                                onPress={onPickDocument}
                            >
                                <Ionicons name="document-outline" size={22} color={colors.primary} />
                                <Text style={[styles.sourceLabel, { color: colors.text }]}>Files</Text>
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
                <Text style={[styles.dividerText, { color: colors.border }]}>or paste URL</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* URL input */}
            <View>
                <Controller
                    control={control}
                    name="url"
                    render={({ field: { onChange, value, onBlur } }) => (
                        <TextInput
                            style={[styles.input, {
                                color: colors.text,
                                backgroundColor: dark ? '#1C1C1E' : '#F2F2F7',
                                borderColor: errors.url ? '#FF453A' : (dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'),
                                opacity: isLoading ? 0.5 : 1,
                            }]}
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            placeholder="https://example.com/file.png"
                            placeholderTextColor={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            returnKeyType="done"
                            editable={!isLoading}
                            onSubmitEditing={handleSubmit(onValidSubmit)}
                        />
                    )}
                />
                {errors.url && (
                    <Text style={styles.errorText}>{errors.url.message}</Text>
                )}
            </View>

            {/* Action buttons */}
            <View style={styles.buttonRow}>
                <Pressable
                    style={[styles.button, { backgroundColor: dark ? '#3A3A3C' : '#E5E5EA', opacity: isLoading ? 0.5 : 1 }]}
                    onPress={onClose}
                    disabled={isLoading}
                >
                    <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                    style={[styles.button, {
                        backgroundColor: (isValid && !isLoading) ? colors.primary : (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                    }]}
                    onPress={handleSubmit(onValidSubmit)}
                    disabled={!isValid || isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text style={[styles.buttonText, { color: isValid ? '#FFFFFF' : (dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)') }]}>Insert</Text>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 12,
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

