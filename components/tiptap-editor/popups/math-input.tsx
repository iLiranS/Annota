import { useTheme } from '@react-navigation/native';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface MathInputProps {
    currentLatex: string | null;
    onSubmit: (latex: string) => void;
    onClose: () => void;
}

export function MathInput({ currentLatex, onSubmit, onClose }: MathInputProps) {
    const { colors, dark } = useTheme();
    const [latex, setLatex] = React.useState(currentLatex || '');
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        // Focus input when opened
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const handleSubmit = () => {
        const trimmedLatex = latex.trim();
        if (trimmedLatex) {
            onSubmit(trimmedLatex);
        }
    };

    return (
        <View style={styles.popupContent}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>
                {currentLatex ? 'Edit Equation' : 'Insert Equation'}
            </Text>
            <TextInput
                ref={inputRef}
                style={[
                    styles.latexInput,
                    {
                        backgroundColor: dark ? '#1C1C1E' : '#F2F2F7',
                        color: colors.text,
                        borderColor: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                    },
                ]}
                placeholder="E = mc^2"
                placeholderTextColor={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                value={latex}
                onChangeText={setLatex}
                autoCapitalize="none"
                autoCorrect={false}
                multiline={true}
                numberOfLines={3}
            />
            <View style={styles.buttonRow}>
                <Pressable
                    style={[styles.button, { backgroundColor: dark ? '#3A3A3C' : '#E5E5EA' }]}
                    onPress={onClose}
                >
                    <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                    style={[styles.button, { backgroundColor: colors.primary }]}
                    onPress={handleSubmit}
                >
                    <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                        {currentLatex ? 'Update' : 'Insert'}
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
    latexInput: {
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        fontSize: 16,
        minHeight: 80,
        textAlignVertical: 'top',
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
