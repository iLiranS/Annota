import { useAppTheme } from '@/hooks/use-app-theme';
import { useUserStore } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { z } from 'zod';

const schema = z.object({
    displayName: z
        .string()
        .min(3, 'Name must be at least 3 characters')
        .max(20, 'Name must be at most 20 characters')
        .trim(),
});

type FormData = z.infer<typeof schema>;
const GUEST_DISPLAY_NAME_KEY = 'guest_display_name';

interface UpdateDisplayNameFormProps {
    visible: boolean;
    onClose: () => void;
    initialValue?: string;
    onSaved?: (displayName: string) => void;
}

export default function UpdateDisplayNameForm({
    visible,
    onClose,
    initialValue = '',
    onSaved,
}: UpdateDisplayNameFormProps) {
    const { colors, dark } = useAppTheme();
    const { session, updateDisplayName } = useUserStore();

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            displayName: initialValue,
        },
    });

    // Reset form when initialValue changes or modal closes
    React.useEffect(() => {
        if (visible) {
            reset({ displayName: initialValue });
        }
    }, [visible, initialValue, reset]);

    const onSubmit = async (data: FormData) => {
        try {
            if (session) {
                await updateDisplayName(data.displayName);
            } else {
                await AsyncStorage.setItem(GUEST_DISPLAY_NAME_KEY, data.displayName);
            }

            onSaved?.(data.displayName);
            onClose();
        } catch (error) {
            console.error('Error updating display name:', error);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

                <View
                    style={[
                        styles.container,
                        {
                            backgroundColor: colors.card,
                        },
                    ]}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                            <Ionicons name="person-outline" size={24} color={colors.primary} />
                        </View>
                        <Text style={[styles.title, { color: colors.text }]}>Display Name</Text>
                    </View>

                    <Text style={[styles.description, { color: colors.text + '80' }]}>
                        {session ? 'Enter a new name for your profile.' : 'Set a local name for this device.'}
                    </Text>

                    {/* Input */}
                    <Controller
                        control={control}
                        name="displayName"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <View>
                                <View
                                    style={[
                                        styles.inputContainer,
                                        {
                                            backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                                            borderColor: errors.displayName ? colors.error : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                                        },
                                    ]}
                                >
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        placeholder="Display name"
                                        placeholderTextColor={colors.text + '50'}
                                        onBlur={onBlur}
                                        onChangeText={onChange}
                                        value={value}
                                        autoFocus
                                        returnKeyType="done"
                                        onSubmitEditing={handleSubmit(onSubmit)}
                                        maxLength={20}
                                    />
                                </View>
                                {errors.displayName && (
                                    <Text style={[styles.errorText, { color: colors.error }]}>
                                        {errors.displayName.message}
                                    </Text>
                                )}
                            </View>
                        )}
                    />

                    {/* Buttons */}
                    <View style={styles.buttonRow}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.button,
                                styles.cancelButton,
                                {
                                    backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                },
                                pressed && styles.buttonPressed,
                            ]}
                            onPress={onClose}
                            disabled={isSubmitting}
                        >
                            <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [
                                styles.button,
                                styles.submitButton,
                                {
                                    backgroundColor: colors.primary,
                                },
                                (pressed || isSubmitting) && styles.buttonPressed,
                            ]}
                            onPress={handleSubmit(onSubmit)}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{session ? 'Update' : 'Save'}</Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    container: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 20,
    },
    inputContainer: {
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 8,
    },
    input: {
        fontSize: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    errorText: {
        fontSize: 12,
        marginBottom: 16,
        marginLeft: 4,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {},
    submitButton: {},
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    buttonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }],
    },
});
