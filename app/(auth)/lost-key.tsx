import { useAppTheme } from '@/hooks/use-app-theme';
import { supabase } from '@/lib/supabase';
import { generateMasterKey, hashMasterKey, storeMasterKey } from '@/lib/utils/crypto';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function LostKeyScreen() {
    const theme = useAppTheme();
    const [confirmText, setConfirmText] = useState('');
    const [processing, setProcessing] = useState(false);
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);

    const isDeleteConfirmed = confirmText.trim().toUpperCase() === 'DELETE';

    const getCurrentUserId = async (): Promise<string | null> => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.user?.id ?? null;
    };

    const handleProceed = async () => {
        if (!isDeleteConfirmed) return;

        // Device authentication
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware || !isEnrolled) {
            Alert.alert(
                'Authentication Unavailable',
                'Your device does not support biometric authentication. Please set up Face ID, Touch ID, or a passcode first.'
            );
            return;
        }

        const authResult = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Authenticate to create a new master key',
            cancelLabel: 'Cancel',
            disableDeviceFallback: false,
        });

        if (!authResult.success) return;

        const userId = await getCurrentUserId();
        if (!userId) {
            Alert.alert('Session Error', 'Please sign in again.');
            router.replace('/(auth)');
            return;
        }

        setProcessing(true);
        try {
            // Generate new key
            const newMnemonic = await generateMasterKey();

            // Wipe cloud data
            await supabase.from('encrypted_notes').delete().eq('user_id', userId);
            await supabase.from('encrypted_tasks').delete().eq('user_id', userId);
            await supabase.from('encrypted_folders').delete().eq('user_id', userId);

            // Store new key and update validator
            await storeMasterKey(userId, newMnemonic);
            const hash = await hashMasterKey(newMnemonic);
            await supabase
                .from('profiles')
                .update({ key_validator: hash })
                .eq('id', userId);

            setGeneratedKey(newMnemonic);
        } catch (err) {
            console.error('Lost key flow error:', err);
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const copyToClipboard = async () => {
        if (!generatedKey) return;
        await Clipboard.setStringAsync(generatedKey);
        Alert.alert('Copied!', 'Your new master key has been copied to the clipboard.');
    };

    const handleDone = () => {
        router.replace('/(drawer)');
    };

    // ── Show the new key after successful generation ────────────
    if (generatedKey) {
        return (
            <ScrollView
                contentContainerStyle={[styles.scrollContainer, { backgroundColor: theme.colors.background }]}
            >
                <Ionicons
                    name="checkmark-circle"
                    size={56}
                    color="#34C759"
                    style={{ alignSelf: 'center', marginBottom: 16 }}
                />

                <Text style={[styles.title, { color: theme.colors.text }]}>New Master Key</Text>

                <View style={[styles.infoContainer, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.infoText, { color: theme.colors.text }]}>
                        Your old data has been erased. Write down these 12 words — this is the ONLY way to recover your data.
                    </Text>
                </View>

                <View style={[styles.phraseContainer, { borderColor: theme.colors.border }]}>
                    {generatedKey.split(' ').map((word, index) => (
                        <View key={index} style={[styles.wordBadge, { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                            <Text style={[styles.wordIndex, { color: theme.colors.primary }]}>{index + 1}</Text>
                            <Text style={[styles.wordText, { color: theme.colors.text }]}>{word}</Text>
                        </View>
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.secondaryButton, { borderColor: theme.colors.border, marginBottom: 16 }]}
                    onPress={copyToClipboard}
                >
                    <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Copy to Clipboard</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: theme.colors.primary }]}
                    onPress={handleDone}
                >
                    <Text style={styles.buttonText}>I Have Saved It</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    }

    // ── Confirmation flow ───────────────────────────────────────
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: theme.colors.background }}
        >
            <ScrollView
                contentContainerStyle={[styles.scrollContainer, { backgroundColor: theme.colors.background }]}
                keyboardShouldPersistTaps="handled"
            >
                <Ionicons
                    name="warning"
                    size={56}
                    color={theme.colors.error ?? '#FF3B30'}
                    style={{ alignSelf: 'center', marginBottom: 16 }}
                />

                <Text style={[styles.title, { color: theme.colors.text }]}>Create New Key</Text>

                <View style={[styles.dangerContainer, { backgroundColor: (theme.colors.error ?? '#FF3B30') + '15' }]}>
                    <Text style={[styles.dangerText, { color: theme.colors.error ?? '#FF3B30' }]}>
                        This action is irreversible. Creating a new master key will permanently erase all your encrypted cloud data — notes, tasks, and folders.
                    </Text>
                </View>

                <View style={[styles.infoContainer, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.infoText, { color: theme.colors.text }]}>
                        Only do this if you've truly lost your 12-word phrase and have no other way to recover your data. You will start completely fresh.
                    </Text>
                </View>

                <Text style={[styles.label, { color: theme.colors.text }]}>
                    Type <Text style={{ fontWeight: 'bold' }}>DELETE</Text> to confirm
                </Text>

                <TextInput
                    style={[styles.confirmInput, {
                        color: theme.colors.text,
                        borderColor: isDeleteConfirmed ? '#34C759' : theme.colors.border,
                        backgroundColor: theme.colors.card,
                    }]}
                    value={confirmText}
                    onChangeText={setConfirmText}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    placeholder="DELETE"
                    placeholderTextColor={theme.colors.border}
                />

                <TouchableOpacity
                    style={[
                        styles.button,
                        {
                            backgroundColor: isDeleteConfirmed
                                ? (theme.colors.error ?? '#FF3B30')
                                : theme.colors.border,
                            marginTop: 24,
                        },
                    ]}
                    onPress={handleProceed}
                    disabled={!isDeleteConfirmed || processing}
                >
                    {processing ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Erase Data & Create New Key</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.backLink}
                    onPress={() => router.back()}
                >
                    <Text style={[styles.backLinkText, { color: theme.colors.text + '60' }]}>
                        Go back
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    scrollContainer: {
        padding: 24,
        paddingTop: 80,
        flexGrow: 1,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    dangerContainer: {
        padding: 16,
        borderRadius: 10,
        marginBottom: 16,
    },
    dangerText: {
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 22,
    },
    infoContainer: {
        padding: 16,
        borderRadius: 10,
        marginBottom: 24,
    },
    infoText: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    label: {
        fontSize: 16,
        marginBottom: 10,
        textAlign: 'center',
    },
    confirmInput: {
        borderWidth: 1.5,
        borderRadius: 10,
        padding: 14,
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 4,
    },
    button: {
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    phraseContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: 10,
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
    secondaryButton: {
        alignItems: 'center',
        padding: 14,
        borderWidth: 1,
        borderRadius: 10,
    },
    secondaryButtonText: {
        fontWeight: '600',
        fontSize: 15,
    },
    backLink: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 40,
        paddingVertical: 8,
    },
    backLinkText: {
        fontSize: 15,
    },
});
