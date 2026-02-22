import { useAppTheme } from '@/hooks/use-app-theme';
import { supabase } from '@/lib/supabase';
import { generateMasterKey, storeMasterKey, validateMasterKey } from '@/lib/utils/crypto';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function MasterKeyScreen() {
    const [mode, setMode] = useState<'generate' | 'import'>('generate');
    const [checkingUser, setCheckingUser] = useState(true);
    const [hasCloudData, setHasCloudData] = useState(false);
    const [mnemonic, setMnemonic] = useState('');
    const [importWords, setImportWords] = useState<string[]>(Array(12).fill(''));
    const theme = useAppTheme();

    const generateNewKey = async () => {
        const key = await generateMasterKey();
        setMnemonic(key);
    };

    useEffect(() => {
        const checkExistingData = async () => {
            try {
                setCheckingUser(true);
                // Check if they have any encrypted notes in the cloud
                const { count } = await supabase
                    .from('encrypted_notes')
                    .select('*', { count: 'exact', head: true });

                if (count && count > 0) {
                    setHasCloudData(true);
                    setMode('import');
                } else {
                    await generateNewKey();
                }
            } catch (err) {
                console.error("Checking cloud data error:", err);
                await generateNewKey();
            } finally {
                setCheckingUser(false);
            }
        };

        checkExistingData();
    }, []);

    const copyToClipboard = async () => {
        await Clipboard.setStringAsync(mnemonic);
        Alert.alert('Copied!', 'Your master key has been copied to the clipboard.');
    };

    const handleConfirm = async () => {
        if (mode === 'import') {
            const joinedWords = importWords.join(' ').trim().toLowerCase();
            const isValid = validateMasterKey(joinedWords);
            if (!isValid) {
                Alert.alert('Invalid Key', 'The 12-word phrase you entered is invalid. Please check your spelling and try again.');
                return;
            }

            await storeMasterKey(joinedWords);
            router.replace('/(drawer)');
            return;
        }

        Alert.alert(
            'Are you sure?',
            hasCloudData
                ? 'You already have encrypted data in the cloud! Generating a NEW key will permanently delete your old cloud data so you can start fresh. Continue?'
                : 'Have you written down your master key? If you lose it, you will permanently lose access to your synced data.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: hasCloudData ? 'Yes, Delete Cloud Data' : 'Yes, I saved it',
                    style: 'destructive',
                    onPress: async () => {
                        if (hasCloudData) {
                            const { data: { session } } = await supabase.auth.getSession();
                            if (session?.user) {
                                // Wipe cloud data to prevent un-decryptable garbage
                                await supabase.from('encrypted_notes').delete().eq('user_id', session.user.id);
                                await supabase.from('encrypted_tasks').delete().eq('user_id', session.user.id);
                                await supabase.from('encrypted_folders').delete().eq('user_id', session.user.id);
                            }
                        }
                        await storeMasterKey(mnemonic);
                        router.replace('/(drawer)'); // Navigate back to main app
                    },
                },
            ]
        );
    };

    const handleWordChange = (text: string, index: number) => {
        // Quick paste handler for entire phrase
        const clipboardWords = text.trim().split(/\s+/);
        if (clipboardWords.length === 12) {
            setImportWords(clipboardWords.map(w => w.toLowerCase()));
            return;
        }

        const newWords = [...importWords];
        newWords[index] = text.toLowerCase().trim();
        setImportWords(newWords);
    };

    if (checkingUser) {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background, alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ color: theme.colors.text, marginTop: 15 }}>Checking cloud data...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: theme.colors.background }}
        >
            <ScrollView
                contentContainerStyle={[styles.scrollContainer, { backgroundColor: theme.colors.background }]}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={[styles.title, { color: theme.colors.text }]}>
                    {mode === 'generate' ? 'Your Master Key' : 'Recover Account'}
                </Text>

                <View style={[styles.toggleContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <TouchableOpacity
                        style={[styles.toggleButton, mode === 'generate' && { backgroundColor: theme.colors.primary }]}
                        onPress={() => setMode('generate')}
                    >
                        <Text style={[
                            styles.toggleText,
                            { color: mode === 'generate' ? '#fff' : theme.colors.text },
                            mode === 'generate' && { fontWeight: 'bold' }
                        ]}>Create New</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleButton, mode === 'import' && { backgroundColor: theme.colors.primary }]}
                        onPress={() => setMode('import')}
                    >
                        <Text style={[
                            styles.toggleText,
                            { color: mode === 'import' ? '#fff' : theme.colors.text },
                            mode === 'import' && { fontWeight: 'bold' }
                        ]}>Import Existing</Text>
                    </TouchableOpacity>
                </View>

                {mode === 'generate' ? (
                    <>
                        {hasCloudData && (
                            <View style={[styles.warningContainer, { backgroundColor: theme.colors.error + '20' }]}>
                                <Text style={[styles.warningText, { color: theme.colors.error, fontWeight: 'bold' }]}>
                                    Warning: You have existing cloud data. If you generate a new key and proceed, your previous data will be permanently deleted!
                                </Text>
                            </View>
                        )}

                        <View style={[styles.warningContainer, { backgroundColor: theme.colors.card }]}>
                            <Text style={[styles.warningText, { color: theme.colors.text }]}>
                                Write down these 12 words in order. This is the ONLY way to recover your data if you lose your device.
                                We do not store this key, and we cannot recover it for you.
                            </Text>
                        </View>

                        <View style={[styles.phraseContainer, { borderColor: theme.colors.border }]}>
                            {mnemonic ? mnemonic.split(' ').map((word, index) => (
                                <View key={index} style={[styles.wordBadge, { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
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
                    </>
                ) : (
                    <>
                        <View style={[styles.warningContainer, { backgroundColor: theme.colors.card }]}>
                            <Text style={[styles.warningText, { color: theme.colors.text }]}>
                                Enter your existing 12-word master key to regain access to your synced data. You can also paste the entire phrase into the first box.
                            </Text>
                        </View>

                        <View style={[styles.inputGrid]}>
                            {importWords.map((word, index) => (
                                <View key={index} style={[styles.inputWrapper, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                                    <Text style={[styles.inputIndex, { color: theme.colors.border }]}>{index + 1}</Text>
                                    <TextInput
                                        style={[styles.inputField, { color: theme.colors.text }]}
                                        value={word}
                                        onChangeText={(text) => handleWordChange(text, index)}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        placeholder={`word`}
                                        placeholderTextColor={theme.colors.border}
                                    />
                                </View>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: theme.colors.primary, marginTop: 20, marginBottom: 40 }]}
                            onPress={handleConfirm}
                        >
                            <Text style={styles.buttonText}>Recover Account</Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    scrollContainer: {
        padding: 20,
        paddingTop: 60,
        flexGrow: 1,
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    toggleContainer: {
        flexDirection: 'row',
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 20,
        overflow: 'hidden',
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    toggleText: {
        fontSize: 16,
    },
    warningContainer: {
        padding: 15,
        borderRadius: 8,
        marginBottom: 20,
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
    inputGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    inputWrapper: {
        width: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 10,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    inputIndex: {
        marginRight: 8,
        fontSize: 12,
        width: 15,
    },
    inputField: {
        flex: 1,
        fontSize: 16,
        height: 35,
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

