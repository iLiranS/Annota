import { useAppTheme } from '@/hooks/use-app-theme';
import { useUserStore } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect } from 'react';
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

    const [displayName, setDisplayName] = useState(initialValue);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset form when initialValue changes or modal closes
    useEffect(() => {
        if (visible) {
            setDisplayName(initialValue);
            setError(null);
        }
    }, [visible, initialValue]);

    const validate = (val: string) => {
        const trimmed = val.trim();
        if (trimmed.length < 3) {
            setError('Name must be at least 3 characters');
            return false;
        }
        if (trimmed.length > 20) {
            setError('Name must be at most 20 characters');
            return false;
        }
        setError(null);
        return true;
    };

    const handleChangeText = (text: string) => {
        setDisplayName(text);
        if (error) {
            validate(text);
        }
    };

    const onSubmit = async () => {
        const trimmed = displayName.trim();
        if (!validate(displayName)) return;

        setIsSubmitting(true);
        try {
            if (session) {
                await updateDisplayName(trimmed);
            } else {
                await AsyncStorage.setItem(GUEST_DISPLAY_NAME_KEY, trimmed);
            }

            onSaved?.(trimmed);
            onClose();
        } catch (error) {
            console.error('Error updating display name:', error);
        } finally {
            setIsSubmitting(false);
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
                    <View>
                        <View
                            style={[
                                styles.inputContainer,
                                {
                                    backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                                    borderColor: error ? colors.error : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                                },
                            ]}
                        >
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                placeholder="Display name"
                                placeholderTextColor={colors.text + '50'}
                                onChangeText={handleChangeText}
                                value={displayName}
                                autoFocus
                                returnKeyType="done"
                                onSubmitEditing={onSubmit}
                                maxLength={20}
                            />
                        </View>
                        {error && (
                            <Text style={[styles.errorText, { color: colors.error }]}>
                                {error}
                            </Text>
                        )}
                    </View>

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
                            onPress={onSubmit}
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
