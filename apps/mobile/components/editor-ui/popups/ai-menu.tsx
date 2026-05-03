import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, Keyboard } from 'react-native';

interface AIMenuProps {
    onAction: (action: string, instructions: string) => void;
    onClose: () => void;
    isLoading?: boolean;
}

export function AIMenu({ onAction, onClose, isLoading }: AIMenuProps) {
    const { colors } = useTheme();
    const [instructions, setInstructions] = useState('');

    const actions = [
        { id: 'flashcard', label: 'Generate Flashcards', icon: 'layers' },
    ];

    return (
        <Pressable onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
                    <Text style={[styles.headerTitle, { color: colors.text }]}>AI ASSISTANT</Text>
                </View>

                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={[styles.loadingText, { color: colors.text }]}>Thinking...</Text>
                    </View>
                ) : (
                    <>
                        <View style={[styles.inputContainer, { backgroundColor: colors.border + '20', borderColor: colors.border }]}>
                            <TextInput
                                placeholder="Optional instructions..."
                                placeholderTextColor={colors.text + '60'}
                                value={instructions}
                                onChangeText={setInstructions}
                                style={[styles.input, { color: colors.text }]}
                                multiline
                                maxLength={2000}
                            />
                            <Pressable 
                                onPress={() => onAction('rewrite', instructions)}
                                style={({ pressed }) => [
                                    styles.sendButton, 
                                    { 
                                        backgroundColor: instructions.trim() ? colors.primary : colors.text + '20',
                                        opacity: pressed ? 0.7 : 1
                                    }
                                ]}
                            >
                                <MaterialIcons name="arrow-upward" size={20} color={instructions.trim() ? "#FFF" : colors.text + '40'} />
                            </Pressable>
                        </View>

                        <View style={styles.actions}>
                            {actions.map((action) => (
                                <Pressable
                                    key={action.id}
                                    onPress={() => {
                                        onAction(action.id, instructions);
                                    }}
                                    style={({ pressed }) => [
                                        styles.actionButton,
                                        { 
                                            backgroundColor: pressed ? colors.border + '50' : colors.border + '15',
                                        }
                                    ]}
                                >
                                    <MaterialIcons name={action.icon as any} size={22} color={colors.primary} />
                                    <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </>
                )}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 8,
    },
    headerTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 1.5,
        opacity: 0.5,
    },
    loadingContainer: {
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 15,
        fontWeight: '600',
        opacity: 0.7,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 6,
        marginBottom: 20,
        gap: 8,
    },
    input: {
        flex: 1,
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 10,
        fontSize: 16,
        minHeight: 44,
        maxHeight: 120,
    },
    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    actions: {
        gap: 10,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        gap: 14,
    },
    actionLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
});
