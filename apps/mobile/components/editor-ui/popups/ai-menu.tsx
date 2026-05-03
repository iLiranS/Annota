import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import React, { useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface AIMenuProps {
    onAction: (action: string, instructions: string) => void;
    onClose: () => void;
    isLoading?: boolean;
    onStop?: () => void;
}

export function AIMenu({ onAction, onClose, isLoading, onStop }: AIMenuProps) {
    const { colors } = useTheme();
    const [instructions, setInstructions] = useState('');

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
                        <Pressable 
                            onPress={onStop}
                            style={({ pressed }) => [
                                styles.stopButton,
                                {
                                    backgroundColor: colors.border + '20',
                                    borderColor: colors.border,
                                    opacity: pressed ? 0.7 : 1
                                }
                            ]}
                        >
                            <MaterialIcons name="stop" size={20} color={colors.text} />
                            <Text style={{color: colors.text, fontWeight: '600'}}>Cancel</Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        <View style={[styles.inputContainer, { backgroundColor: colors.border + '20', borderColor: colors.border }]}>
                            <TextInput
                                placeholder="(e.g. summarize this)"
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
                    </>
                )}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 12,
        paddingBottom: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
        paddingHorizontal: 4,
    },
    headerTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1.2,
        opacity: 0.5,
    },
    loadingContainer: {
        height: 120,
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
        alignItems: 'center',
        borderRadius: 24,
        borderWidth: 1.5,
        paddingHorizontal: 4,
        paddingVertical: 4,
        gap: 4,
    },
    input: {
        flex: 1,
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 12,
        fontSize: 17,
        lineHeight: 22,
        minHeight: 48,
        maxHeight: 180,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
    },
});

