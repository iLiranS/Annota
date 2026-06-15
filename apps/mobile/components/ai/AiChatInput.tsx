import { ANTHROPIC_MODELS, GOOGLE_MODELS, OPENAI_MODELS, purifyNoteHtml, useAiStore } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuView } from '@react-native-menu/menu';
import { useTheme } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AiChatInputProps {
    input: string;
    setInput: (text: string) => void;
    onSend: () => void;
    onStop?: () => void;
    isStreaming: boolean;
    isConfigured: boolean;
    supportsWebSearch: boolean;
    initialContext?: { title: string; id: string; content: string };
    selectedContextNotes?: any[];
    onClearAllContext?: () => void;
    onOpenContextSelector: () => void;
}

export function AiChatInput({
    input,
    setInput,
    onSend,
    onStop,
    isStreaming,
    isConfigured,
    supportsWebSearch,
    initialContext,
    selectedContextNotes = [],
    onClearAllContext,
    onOpenContextSelector,
}: AiChatInputProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [isOptionsVisible, setIsOptionsVisible] = useState(false);
    const [isMultilineLayout, setIsMultilineLayout] = useState(false);
    const {
        chatContext,
        setChatContext,
        webSearchEnabled,
        setWebSearchEnabled,
        reasoningEnabled,
        setReasoningEnabled,
        activeProvider,
        availableModels,
        selectedModel,
        setSelectedModel,
        selectedModelOpenAi,
        selectedModelAnthropic,
        selectedModelGoogle,
        setSelectedModelOpenAi,
        setSelectedModelAnthropic,
        setSelectedModelGoogle,
    } = useAiStore();

    const currentModelName = activeProvider === 'ollama'
        ? selectedModel
        : activeProvider === 'openai'
            ? selectedModelOpenAi
            : activeProvider === 'anthropic'
                ? selectedModelAnthropic
                : selectedModelGoogle;

    const displayModelName = currentModelName
        ? (currentModelName.length > (isMultilineLayout ? 32 : 14) ? currentModelName.slice(0, (isMultilineLayout ? 32 : 14)) + '...' : currentModelName)
        : 'Select Model';

    const handleSetModel = (model: string) => {
        if (OPENAI_MODELS.some(m => m.value === model)) {
            useAiStore.getState().setActiveProvider('openai');
            setSelectedModelOpenAi(model);
        } else if (ANTHROPIC_MODELS.some(m => m.value === model)) {
            useAiStore.getState().setActiveProvider('anthropic');
            setSelectedModelAnthropic(model);
        } else if (GOOGLE_MODELS.some(m => m.value === model)) {
            useAiStore.getState().setActiveProvider('google');
            setSelectedModelGoogle(model);
        } else {
            useAiStore.getState().setActiveProvider('ollama');
            setSelectedModel(model);
        }
    };

    const renderButtons = () => (
        <>
            <TouchableOpacity
                style={styles.contextButton}
                onPress={onOpenContextSelector}
            >
                {selectedContextNotes.length > 0 ? (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.badgeText}>{selectedContextNotes.length}</Text>
                    </View>
                ) : (
                    <View style={[styles.badge, { borderWidth: 1.5, borderColor: colors.text + '30', backgroundColor: 'transparent' }]}>
                        <Ionicons name="add" size={14} color={colors.text + '60'} />
                    </View>
                )}
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.webButton,
                    {
                        backgroundColor: webSearchEnabled || reasoningEnabled
                            ? colors.primary + '18'
                            : 'transparent',
                    },
                ]}
                onPress={() => setIsOptionsVisible(!isOptionsVisible)}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
                <Ionicons
                    name="options-outline"
                    size={20}
                    color={webSearchEnabled || reasoningEnabled ? colors.primary : colors.text + '40'}
                />
            </TouchableOpacity>
            <MenuView
                onPressAction={({ nativeEvent }) => handleSetModel(nativeEvent.event)}
                actions={[
                    ...(availableModels.length > 0 ? [
                        { id: 'header-ollama', title: 'Ollama', attributes: { disabled: true } },
                        ...availableModels.map(m => ({ id: m.name, title: m.name, state: (activeProvider === 'ollama' && selectedModel === m.name) ? 'on' as const : 'off' as const })),
                    ] : []),
                    { id: 'header-openai', title: 'OpenAI', attributes: { disabled: true } },
                    ...OPENAI_MODELS.map(m => ({ id: m.value, title: m.label, state: (activeProvider === 'openai' && selectedModelOpenAi === m.value) ? 'on' as const : 'off' as const })),
                    { id: 'header-anthropic', title: 'Anthropic', attributes: { disabled: true } },
                    ...ANTHROPIC_MODELS.map(m => ({ id: m.value, title: m.label, state: (activeProvider === 'anthropic' && selectedModelAnthropic === m.value) ? 'on' as const : 'off' as const })),
                    { id: 'header-google', title: 'Google', attributes: { disabled: true } },
                    ...GOOGLE_MODELS.map(m => ({ id: m.value, title: m.label, state: (activeProvider === 'google' && selectedModelGoogle === m.value) ? 'on' as const : 'off' as const })),
                ]}
            >
                <TouchableOpacity style={[styles.modelPill, { borderColor: colors.border + '60', backgroundColor: colors.border + '10' }]}>
                    <Ionicons name="hardware-chip-outline" size={13} color={colors.text + '60'} />
                    <Text
                        style={[
                            styles.modelPillText,
                            {
                                color: colors.text + '80',
                                maxWidth: isMultilineLayout ? 240 : 100
                            }
                        ]}
                        numberOfLines={1}
                    >
                        {displayModelName}
                    </Text>
                    <Ionicons name="chevron-down" size={11} color={colors.text + '40'} />
                </TouchableOpacity>
            </MenuView>
        </>
    );

    const renderSendButton = () => (
        <TouchableOpacity
            style={[
                styles.sendButton,
                {
                    backgroundColor:
                        (input.trim() && !isStreaming) || isStreaming
                            ? colors.primary
                            : colors.text + '10',
                },
            ]}
            onPress={isStreaming ? onStop : onSend}
            disabled={
                (!input.trim() && !isStreaming) ||
                !isConfigured
            }
        >
            {isStreaming ? (
                <Ionicons name="stop" size={20} color="#FFF" />
            ) : (
                <Ionicons
                    name="arrow-up"
                    size={20}
                    color={
                        input.trim()
                            ? '#FFF'
                            : colors.text + '30'
                    }
                />
            )}
        </TouchableOpacity>
    );

    return (
        <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {isOptionsVisible && (
                <TouchableOpacity
                    activeOpacity={1}
                    style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
                    onPress={() => setIsOptionsVisible(false)}
                />
            )}

            <View style={styles.floatingContainer}>
                {chatContext && (
                    <View style={[styles.activeContextBar, { borderBottomColor: colors.border, backgroundColor: colors.primary + '15', borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
                        <Ionicons name="chatbox-ellipses" size={14} color={colors.primary} />
                        <Text style={[styles.activeContextTitle, { color: colors.primary, flex: 1, marginHorizontal: 8 }]} numberOfLines={2}>
                            {purifyNoteHtml(chatContext.html).trim() || chatContext.text || 'Selected item'}
                        </Text>
                        <TouchableOpacity
                            onPress={() => setChatContext(null)}
                            style={{ padding: 4 }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="close-circle" size={20} color={colors.primary + '80'} />
                        </TouchableOpacity>
                    </View>
                )}
                <View
                    style={[
                        isMultilineLayout ? styles.inputContainerMultiline : styles.inputContainerInline,
                        {
                            backgroundColor: colors.card,
                            borderColor: colors.border + '50',
                            borderTopLeftRadius: chatContext ? 0 : 24,
                            borderTopRightRadius: chatContext ? 0 : 24,
                        },
                    ]}
                >
                    {!isMultilineLayout && renderButtons()}

                    <TextInput
                        style={[
                            isMultilineLayout ? styles.inputMultiline : styles.inputInline,
                            { color: colors.text }
                        ]}
                        placeholder={
                            selectedContextNotes.length > 0
                                ? `Ask about ${selectedContextNotes.length} notes...`
                                : chatContext
                                    ? 'Ask about selected context...'
                                    : 'Ask a general question...(no note context)'
                        }
                        placeholderTextColor={colors.text + '40'}
                        value={input}
                        onChangeText={setInput}
                        multiline
                        autoCorrect={true}
                        autoCapitalize="sentences"
                        editable={!isStreaming}
                        onContentSizeChange={(e) => {
                            const { height } = e.nativeEvent.contentSize;
                            setIsMultilineLayout(height > 32); // Switch layout when input expands beyond single line height
                        }}
                    />

                    {isMultilineLayout ? (
                        <View style={styles.actionRow}>
                            <View style={styles.actionRowLeft}>
                                {renderButtons()}
                            </View>
                            {renderSendButton()}
                        </View>
                    ) : (
                        renderSendButton()
                    )}

                    {isOptionsVisible && (
                        <View style={[
                            styles.optionsMenu,
                            {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                                bottom: isMultilineLayout ? 50 : 56,
                                left: isMultilineLayout ? 45 : 42,
                            }
                        ]}>
                            <TouchableOpacity
                                style={[styles.optionItem, !supportsWebSearch && { opacity: 0.4 }]}
                                onPress={() => {
                                    if (supportsWebSearch) {
                                        setWebSearchEnabled(!webSearchEnabled);
                                        setIsOptionsVisible(false);
                                    }
                                }}
                                disabled={!supportsWebSearch}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="globe-outline" size={16} color={webSearchEnabled ? colors.primary : colors.text + '80'} />
                                    <Text style={[styles.optionText, { color: colors.text }]}>Web Search</Text>
                                </View>
                                {webSearchEnabled && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.optionItem}
                                onPress={() => {
                                    setReasoningEnabled(!reasoningEnabled);
                                    setIsOptionsVisible(false);
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="hardware-chip-outline" size={16} color={reasoningEnabled ? colors.primary : colors.text + '80'} />
                                    <Text style={[styles.optionText, { color: colors.text }]}>Reasoning Mode</Text>
                                </View>
                                {reasoningEnabled && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
        backgroundColor: 'transparent',
    },
    floatingContainer: {
        marginHorizontal: 16,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 18,
        elevation: 10,
    },
    activeContextBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    activeContextTitle: {
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
    },
    inputContainerInline: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 4,
        paddingVertical: 4,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        borderWidth: 1,
        gap: 2,
    },
    inputContainerMultiline: {
        flexDirection: 'column',
        paddingHorizontal: 8,
        paddingTop: 4,
        paddingBottom: 8,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        borderWidth: 1,
    },
    inputInline: {
        flex: 1,
        minHeight: 44,
        maxHeight: 120,
        paddingHorizontal: 8,
        paddingTop: 12,
        paddingBottom: 12,
        fontSize: 15,
        lineHeight: 20,
    },
    inputMultiline: {
        width: '100%',
        minHeight: 44,
        maxHeight: 120,
        paddingHorizontal: 8,
        paddingTop: 10,
        paddingBottom: 10,
        fontSize: 15,
        lineHeight: 20,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    actionRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    contextButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    webButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 4,
    },
    optionsMenu: {
        position: 'absolute',
        borderRadius: 14,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        padding: 6,
        zIndex: 20,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
    },
    optionText: {
        fontSize: 14,
        fontWeight: '600',
    },
    modelPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        gap: 4,
        marginLeft: 4,
    },
    modelPillText: {
        fontSize: 12,
        fontWeight: '600',
    },
});
