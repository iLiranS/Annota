import { useAppTheme } from '@/hooks/use-app-theme';
import { authApi, useUserStore as useAuthStore, userService } from '@annota/core';
import { generateMasterKey } from '@annota/core/platform';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

export default function MasterKeyScreen() {
    const [mode, setMode] = useState<'generate' | 'import'>('import');
    const [checkingUser, setCheckingUser] = useState(true);
    const [hasCloudData, setHasCloudData] = useState(false);
    const [mnemonic, setMnemonic] = useState('');
    const [importWords, setImportWords] = useState<string[]>(Array(12).fill(''));
    const [importing, setImporting] = useState(false);
    const theme = useAppTheme();

    const getCurrentUserId = async (): Promise<string | null> => {
        const { data: { session } } = await authApi.getSession();
        return session?.user?.id ?? null;
    };

    const generateNewKey = async () => {
        const key = await generateMasterKey();
        setMnemonic(key);
    };

    useEffect(() => {
        const checkExistingData = async () => {
            try {
                setCheckingUser(true);
                const userId = await getCurrentUserId();
                if (!userId) {
                    router.replace('/(auth)');
                    return;
                }
                // Check if this user already has encrypted notes in the cloud.
                const hasData = await userService.hasMasterKey(userId);

                if (hasData) {
                    setHasCloudData(true);
                    setMode('import');
                } else {
                    setMode('generate');
                    await generateNewKey();
                }
            } catch (err) {
                console.error("Checking cloud data error:", err);
                setMode('generate');
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



    const handleConfirmGenerate = async () => {
        const userId = await getCurrentUserId();
        if (!userId) {
            Alert.alert('Session Error', 'Please sign in again.');
            router.replace('/(auth)');
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
                        await userService.setupMasterKey(userId, mnemonic, hasCloudData);
                        useAuthStore.getState().setHasMasterKey(true);
                        router.replace('/(app)');
                    },
                },
            ]
        );
    };

    const handleConfirmImport = async () => {
        const userId = await getCurrentUserId();
        if (!userId) {
            Alert.alert('Session Error', 'Please sign in again.');
            router.replace('/(auth)');
            return;
        }

        const joinedWords = importWords.join(' ').trim().toLowerCase();

        setImporting(true);
        try {
            await userService.importMasterKey(userId, joinedWords);
            useAuthStore.getState().setHasMasterKey(true);

            router.replace('/(app)');
        } catch (err: any) {
            console.error('Import key validation error:', err);
            if (err.message === 'INVALID_FORMAT') {
                Toast.show({
                    type: 'error',
                    text1: 'Invalid Key',
                    text2: 'The 12-word phrase you entered is invalid. Please check your spelling.',
                });
            } else if (err.message === 'INVALID_KEY') {
                Toast.show({
                    type: 'error',
                    text1: 'Key Mismatch',
                    text2: 'The 12-word phrase does not match your registered key. Please try again.',
                });
            } else if (err.message === 'MISSING_SALT') {
                Toast.show({
                    type: 'error',
                    text1: 'Reset Required',
                    text2: 'Your account needs a new key. Please use the lost key flow to reset.',
                });
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Validation failed',
                    text2: 'Could not verify your key. Please try again.',
                });
            }
        } finally {
            setImporting(false);
        }
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
                                    <Text style={[styles.wordIndex, { color: theme.colors.primary }]}>{index + 1}</Text>
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
                            onPress={handleConfirmGenerate}
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
                            style={[styles.button, { backgroundColor: theme.colors.primary, marginTop: 20 }]}
                            onPress={handleConfirmImport}
                            disabled={importing}
                        >
                            {importing ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Recover Account</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.lostKeyLink}
                            onPress={() => router.push('/(auth)/lost-key')}
                        >
                            <Text style={[styles.lostKeyText, { color: theme.colors.text + '60' }]}>
                                Lost your key? Create a new one
                            </Text>
                        </TouchableOpacity>
                    </>
                )}

                <TouchableOpacity
                    style={styles.logoutLink}
                    onPress={async () => {
                        await useAuthStore.getState().signOut();
                        router.replace('/(auth)');
                    }}
                >
                    <Text style={[styles.logoutText, { color: theme.colors.error || '#FF3B30' }]}>
                        Sign out of this account
                    </Text>
                </TouchableOpacity>
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
    lostKeyLink: {
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 40,
        paddingVertical: 8,
    },
    lostKeyText: {
        fontSize: 14,
        textDecorationLine: 'underline',
    },
    logoutLink: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 20,
        paddingVertical: 8,
    },
    logoutText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
