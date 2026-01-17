import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

interface FolderNameModalProps {
    visible: boolean;
    onClose: () => void;
    onCreate: (name: string) => void;
}

export default function FolderNameModal({
    visible,
    onClose,
    onCreate,
}: FolderNameModalProps) {
    const { colors, dark } = useTheme();
    const [folderName, setFolderName] = useState('');

    const handleCreate = () => {
        const trimmedName = folderName.trim();
        if (trimmedName) {
            onCreate(trimmedName);
            setFolderName('');
            onClose();
        }
    };

    const handleClose = () => {
        setFolderName('');
        onClose();
    };

    const isValid = folderName.trim().length > 0;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

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
                        <Ionicons name="folder-open" size={28} color="#F59E0B" />
                        <Text style={[styles.title, { color: colors.text }]}>New Folder</Text>
                    </View>

                    {/* Input */}
                    <View
                        style={[
                            styles.inputContainer,
                            {
                                backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                                borderColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                            },
                        ]}
                    >
                        <TextInput
                            style={[styles.input, { color: colors.text }]}
                            placeholder="Folder name"
                            placeholderTextColor={colors.text + '50'}
                            value={folderName}
                            onChangeText={setFolderName}
                            autoFocus
                            autoCapitalize="words"
                            returnKeyType="done"
                            onSubmitEditing={handleCreate}
                        />
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
                            onPress={handleClose}
                        >
                            <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [
                                styles.button,
                                styles.createButton,
                                {
                                    backgroundColor: isValid ? '#6366F1' : '#6366F1' + '60',
                                },
                                pressed && isValid && styles.buttonPressed,
                            ]}
                            onPress={handleCreate}
                            disabled={!isValid}
                        >
                            <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Create</Text>
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
        borderRadius: 16,
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
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
    },
    inputContainer: {
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 20,
    },
    input: {
        fontSize: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {},
    createButton: {},
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    buttonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }],
    },
});
