import { removeApiKey, saveApiKey, useAiStore } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AiSettings() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const {
        activeProvider,
        setActiveProvider,
        hasOpenAiKey,
        setHasOpenAiKey,
        hasAnthropicKey,
        setHasAnthropicKey,
        hasGoogleKey,
        setHasGoogleKey,
    } = useAiStore();

    const [localKeys, setLocalKeys] = useState({
        openai: '',
        anthropic: '',
        google: ''
    });

    const [saving, setSaving] = useState({
        openai: false,
        anthropic: false,
        google: false
    });

    const handleSaveKey = async (provider: 'openai' | 'anthropic' | 'google') => {
        const key = localKeys[provider].trim();
        const hasKey = provider === 'openai' ? hasOpenAiKey : provider === 'anthropic' ? hasAnthropicKey : hasGoogleKey;
        const setHasKey = provider === 'openai' ? setHasOpenAiKey : provider === 'anthropic' ? setHasAnthropicKey : setHasGoogleKey;

        setSaving(prev => ({ ...prev, [provider]: true }));
        try {
            if (key) {
                await saveApiKey(provider, key);
                setHasKey(true);
                setLocalKeys(prev => ({ ...prev, [provider]: '' }));
            } else if (!hasKey) {
                await removeApiKey(provider);
                setHasKey(false);
            }
        } catch (error) {
            console.error(`Failed to save ${provider} key:`, error);
        } finally {
            setSaving(prev => ({ ...prev, [provider]: false }));
        }
    };

    const handleRemoveKey = async (provider: 'openai' | 'anthropic' | 'google') => {
        const setHasKey = provider === 'openai' ? setHasOpenAiKey : provider === 'anthropic' ? setHasAnthropicKey : setHasGoogleKey;

        setSaving(prev => ({ ...prev, [provider]: true }));
        try {
            await removeApiKey(provider);
            setHasKey(false);
            setLocalKeys(prev => ({ ...prev, [provider]: '' }));
        } catch (error) {
            console.error(`Failed to remove ${provider} key:`, error);
        } finally {
            setSaving(prev => ({ ...prev, [provider]: false }));
        }
    };

    const providers = [
        { id: 'openai', label: 'OpenAI', icon: 'logo-github', color: '#10a37f' }, // Using github icon as placeholder for openai if no dedicated
        { id: 'anthropic', label: 'Anthropic', icon: 'sparkles', color: '#d97757' },
        { id: 'google', label: 'Google (Gemini)', icon: 'logo-google', color: '#4285F4' },
    ];

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <ScrollView
                style={[styles.container, { backgroundColor: colors.background }]}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.infoCard}>
                    <View style={[styles.infoIcon, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name="sparkles" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.infoContent}>
                        <Text style={[styles.infoTitle, { color: colors.text }]}>Smart Context</Text>
                        <Text style={[styles.infoText, { color: colors.text + '90' }]}>
                            Context is trimmed intelligently. Cloud providers charge for tokens; models with caching will reduce repeat costs.
                        </Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>ACTIVE PROVIDER</Text>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        {providers.map((p, index) => (
                            <Pressable
                                key={p.id}
                                style={({ pressed }) => [
                                    styles.providerOption,
                                    { borderBottomWidth: index < providers.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border + '20' },
                                    pressed && { backgroundColor: colors.border + '10' }
                                ]}
                                onPress={() => setActiveProvider(p.id as any)}
                            >
                                <View style={styles.providerInfo}>
                                    <View style={[styles.providerIcon, { backgroundColor: p.color + '20' }]}>
                                        <Ionicons name={p.icon as any} size={18} color={p.color} />
                                    </View>
                                    <Text style={[styles.providerLabel, { color: colors.text }]}>{p.label}</Text>
                                </View>
                                {activeProvider === p.id && (
                                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                                )}
                            </Pressable>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>PROVIDER SETTINGS</Text>
                    
                    {activeProvider === 'openai' && (
                        <View style={[styles.card, { backgroundColor: colors.card, padding: 16 }]}>
                            <View style={styles.settingHeader}>
                                <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
                                <Text style={[styles.settingTitle, { color: colors.text }]}>OpenAI Settings</Text>
                            </View>
                            <Text style={[styles.label, { color: colors.text + '70' }]}>API Key</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={[styles.input, { color: colors.text, borderColor: colors.border + '40', backgroundColor: colors.background + '50' }]}
                                    value={localKeys.openai}
                                    onChangeText={(text) => setLocalKeys(prev => ({ ...prev, openai: text }))}
                                    placeholder={hasOpenAiKey ? "sk-•••••••••••• (Configured)" : "sk-..."}
                                    placeholderTextColor={colors.text + '40'}
                                    secureTextEntry
                                />
                                {hasOpenAiKey && !localKeys.openai.trim() ? (
                                    <TouchableOpacity 
                                        style={[styles.saveButton, { backgroundColor: '#ef4444' }]}
                                        onPress={() => handleRemoveKey('openai')}
                                        disabled={saving.openai}
                                    >
                                        {saving.openai ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveButtonText}>Remove</Text>}
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity 
                                        style={[styles.saveButton, { backgroundColor: colors.primary }]}
                                        onPress={() => handleSaveKey('openai')}
                                        disabled={saving.openai || (!localKeys.openai.trim() && hasOpenAiKey)}
                                    >
                                        {saving.openai ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveButtonText}>Save</Text>}
                                    </TouchableOpacity>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => Linking.openURL('https://platform.openai.com/api-keys')}>
                                <Text style={[styles.link, { color: colors.primary }]}>Get API Key from OpenAI</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {activeProvider === 'anthropic' && (
                        <View style={[styles.card, { backgroundColor: colors.card, padding: 16 }]}>
                            <View style={styles.settingHeader}>
                                <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
                                <Text style={[styles.settingTitle, { color: colors.text }]}>Anthropic Settings</Text>
                            </View>
                            <Text style={[styles.label, { color: colors.text + '70' }]}>API Key</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={[styles.input, { color: colors.text, borderColor: colors.border + '40', backgroundColor: colors.background + '50' }]}
                                    value={localKeys.anthropic}
                                    onChangeText={(text) => setLocalKeys(prev => ({ ...prev, anthropic: text }))}
                                    placeholder={hasAnthropicKey ? "sk-ant-••••••••• (Configured)" : "sk-ant-..."}
                                    placeholderTextColor={colors.text + '40'}
                                    secureTextEntry
                                />
                                {hasAnthropicKey && !localKeys.anthropic.trim() ? (
                                    <TouchableOpacity 
                                        style={[styles.saveButton, { backgroundColor: '#ef4444' }]}
                                        onPress={() => handleRemoveKey('anthropic')}
                                        disabled={saving.anthropic}
                                    >
                                        {saving.anthropic ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveButtonText}>Remove</Text>}
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity 
                                        style={[styles.saveButton, { backgroundColor: colors.primary }]}
                                        onPress={() => handleSaveKey('anthropic')}
                                        disabled={saving.anthropic || (!localKeys.anthropic.trim() && hasAnthropicKey)}
                                    >
                                        {saving.anthropic ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveButtonText}>Save</Text>}
                                    </TouchableOpacity>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')}>
                                <Text style={[styles.link, { color: colors.primary }]}>Get API Key from Anthropic</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {activeProvider === 'google' && (
                        <View style={[styles.card, { backgroundColor: colors.card, padding: 16 }]}>
                            <View style={styles.settingHeader}>
                                <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
                                <Text style={[styles.settingTitle, { color: colors.text }]}>Google (Gemini) Settings</Text>
                            </View>
                            <Text style={[styles.label, { color: colors.text + '70' }]}>API Key</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={[styles.input, { color: colors.text, borderColor: colors.border + '40', backgroundColor: colors.background + '50' }]}
                                    value={localKeys.google}
                                    onChangeText={(text) => setLocalKeys(prev => ({ ...prev, google: text }))}
                                    placeholder={hasGoogleKey ? "•••••••••••• (Configured)" : "Paste key here..."}
                                    placeholderTextColor={colors.text + '40'}
                                    secureTextEntry
                                />
                                {hasGoogleKey && !localKeys.google.trim() ? (
                                    <TouchableOpacity 
                                        style={[styles.saveButton, { backgroundColor: '#ef4444' }]}
                                        onPress={() => handleRemoveKey('google')}
                                        disabled={saving.google}
                                    >
                                        {saving.google ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveButtonText}>Remove</Text>}
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity 
                                        style={[styles.saveButton, { backgroundColor: colors.primary }]}
                                        onPress={() => handleSaveKey('google')}
                                        disabled={saving.google || (!localKeys.google.trim() && hasGoogleKey)}
                                    >
                                        {saving.google ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveButtonText}>Save</Text>}
                                    </TouchableOpacity>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')}>
                                <Text style={[styles.link, { color: colors.primary }]}>Get API Key from Google AI Studio</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.securityNote}>
                        <Ionicons name="lock-closed-outline" size={12} color={colors.text + '40'} />
                        <Text style={[styles.securityText, { color: colors.text + '40' }]}>
                            Keys are stored encrypted in your device's secure vault.
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    infoCard: {
        flexDirection: 'row',
        margin: 16,
        padding: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        gap: 12,
    },
    infoIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoContent: {
        flex: 1,
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    infoText: {
        fontSize: 12,
        lineHeight: 18,
    },
    section: {
        marginTop: 12,
        paddingHorizontal: 16,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 8,
        marginLeft: 12,
        letterSpacing: 1,
    },
    card: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    providerOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    providerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    providerIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    providerLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    settingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    settingTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    input: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 12,
        fontSize: 14,
        fontFamily: 'System',
    },
    saveButton: {
        height: 44,
        borderRadius: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 70,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    link: {
        fontSize: 12,
        fontWeight: '500',
        textDecorationLine: 'underline',
    },
    securityNote: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        gap: 4,
    },
    securityText: {
        fontSize: 11,
    }
});
