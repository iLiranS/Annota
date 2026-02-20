import { useAppTheme } from '@/hooks/use-app-theme';
import { generateMasterKey, storeMasterKey } from '@/lib/utils/crypto';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function MasterKeyScreen() {
    const [mnemonic, setMnemonic] = useState('');
    const theme = useAppTheme();

    const generateNewKey = async () => {
        const key = await generateMasterKey();
        setMnemonic(key);
    };

    useEffect(() => {
        generateNewKey();
    }, []);

    const copyToClipboard = async () => {
        await Clipboard.setStringAsync(mnemonic);
        Alert.alert('Copied!', 'Your master key has been copied to the clipboard.');
    };

    const handleConfirm = async () => {
        Alert.alert(
            'Are you sure?',
            'Have you written down your master key? If you lose it, you will permanently lose access to your synced data.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Yes, I saved it',
                    style: 'destructive',
                    onPress: async () => {
                        await storeMasterKey(mnemonic);
                        router.replace('/(drawer)'); // Navigate back to main app
                    },
                },
            ]
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Your Master Key</Text>

            <View style={[styles.warningContainer, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.warningText, { color: theme.colors.text }]}>
                    Write down these 12 words in order. This is the ONLY way to recover your data if you lose your device.
                    We do not store this key, and we cannot recover it for you.
                </Text>
            </View>

            <View style={[styles.phraseContainer, { borderColor: theme.colors.border }]}>
                {mnemonic ? mnemonic.split(' ').map((word, index) => (
                    <View key={index} style={styles.wordBadge}>
                        <Text style={[styles.wordIndex, { color: theme.colors.border }]}>{index + 1}</Text>
                        <Text style={[styles.wordText, { color: theme.colors.text }]}>{word}</Text>
                    </View>
                )) : null}
            </View>

            <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: theme.colors.border }]} onPress={generateNewKey}>
                    <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Randomize</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.secondaryButton, { borderColor: theme.colors.border }]} onPress={copyToClipboard}>
                    <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Copy</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.colors.primary }]}
                onPress={handleConfirm}
            >
                <Text style={styles.buttonText}>I Have Saved It</Text>
            </TouchableOpacity>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    warningContainer: {
        padding: 15,
        borderRadius: 8,
        marginBottom: 30,
    },
    warningText: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    phraseContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: 8,
        padding: 15,
        marginBottom: 20,
    },
    wordBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: 5,
        paddingVertical: 5,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 5,
    },
    wordIndex: {
        marginRight: 5,
        fontSize: 12,
    },
    wordText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    secondaryButton: {
        flex: 1,
        alignItems: 'center',
        padding: 12,
        marginHorizontal: 5,
        borderWidth: 1,
        borderRadius: 8,
    },
    secondaryButtonText: {
        fontWeight: '600',
    },
    button: {
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
