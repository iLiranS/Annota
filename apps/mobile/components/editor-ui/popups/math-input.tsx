import { useTheme } from '@react-navigation/native';
import { PlatformPressable } from '@react-navigation/elements';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { WebView } from 'react-native-webview';

interface MathInputProps {
    currentLatex: string | null;
    isBlock?: boolean;
    onSubmit: (latex: string, isBlock?: boolean) => void;
    onClose: () => void;
}

export function MathInput({ currentLatex, isBlock = false, onSubmit, onClose }: MathInputProps) {
    const { colors, dark } = useTheme();
    const [latex, setLatex] = useState(currentLatex || '');
    const [debouncedLatex, setDebouncedLatex] = useState(currentLatex || '');
    const [previewLoading, setPreviewLoading] = useState(true);
    const [isBlockInput, setIsBlockInput] = useState(isBlock);
    const inputRef = useRef<TextInput>(null);
    const webViewRef = useRef<WebView>(null);

    useEffect(() => {
        setIsBlockInput(isBlock);
    }, [isBlock]);

    useEffect(() => {
        if (currentLatex) return;
        setTimeout(() => inputRef.current?.focus(), 200);
    }, []);

    // Debounce latex → debouncedLatex by 600ms
    useEffect(() => {
        const id = setTimeout(() => setDebouncedLatex(latex), 600);
        return () => clearTimeout(id);
    }, [latex]);

    useEffect(() => {
        if (webViewRef.current && !previewLoading) {
            webViewRef.current.postMessage(JSON.stringify({
                tex: debouncedLatex,
                displayMode: isBlockInput
            }));
        }
    }, [debouncedLatex, isBlockInput, previewLoading]);

    const handleSubmit = useCallback(() => {
        const trimmedLatex = latex.trim();
        if (trimmedLatex) {
            onSubmit(trimmedLatex, isBlockInput);
        }
    }, [latex, onSubmit, isBlockInput]);

    const isValid = latex.trim().length > 0;

    const previewHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
            <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
            <style>
                * { box-sizing: border-box; }
                body {
                    display: flex;
                    align-items: center;
                    margin: 0;
                    padding: 0 12px;
                    min-height: 100vh;
                    background-color: transparent;
                    color: ${colors.text};
                    font-size: 1rem;
                    overflow-y: hidden;
                    overflow-x: auto;
                }
                #math {
                    display: inline-block;
                    min-width: 100%;
                }
                .katex-display {
                    margin: 0;
                    text-align: left;
                }
                .katex {
                    text-align: left !important;
                    white-space: nowrap;
                }
                .error {
                    color: #FF453A;
                    font-size: 12px;
                    font-family: monospace;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    opacity: 0.9;
                    line-height: 1.4;
                }
            </style>
        </head>
        <body>
            <div id="math"></div>
            <script>
                let currentDisplayMode = ${isBlockInput ? 'true' : 'false'};
                function render(tex, displayMode) {
                    const el = document.getElementById('math');
                    if (!tex) {
                        el.innerHTML = '';
                        return;
                    }
                    if (displayMode !== undefined) {
                        currentDisplayMode = displayMode;
                    }
                    try {
                        katex.render(tex, el, {
                            throwOnError: true,
                            displayMode: currentDisplayMode,
                            leqno: false,
                            fleqn: true
                        });
                    } catch (err) {
                        const msg = err.message.replace(/^KaTeX parse error:\\\\s*/i, '');
                        el.innerHTML = '<span class="error">⚠ ' + msg + '</span>';
                    }
                }
                render(${JSON.stringify(debouncedLatex)}, currentDisplayMode);
                window.addEventListener('message', (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        render(data.tex, data.displayMode);
                    } catch (e) {
                        render(event.data);
                    }
                });
            </script>
        </body>
        </html>
    `;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
                <PlatformPressable onPress={onClose} style={styles.headerButton}>
                    <Text style={[styles.headerCancelText, { color: colors.primary }]}>Cancel</Text>
                </PlatformPressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    {currentLatex ? 'Edit Formula' : 'Insert Formula'}
                </Text>
                <PlatformPressable
                    onPress={handleSubmit}
                    style={styles.headerButton}
                    disabled={!isValid}
                >
                    <Ionicons
                        name="checkmark"
                        size={24}
                        color={isValid ? colors.primary : colors.text + '30'}
                    />
                </PlatformPressable>
            </View>

            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
                <View style={styles.section}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={[styles.label, { color: colors.text, opacity: 0.6 }]}>LATEX INPUT</Text>
                        <View style={[styles.toggleContainer, { backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderColor: colors.border }]}>
                            <Pressable
                                style={[
                                    styles.toggleButton,
                                    !isBlockInput && [styles.toggleActiveButton, { backgroundColor: colors.card }],
                                ]}
                                onPress={() => setIsBlockInput(false)}
                            >
                                <Text style={[
                                    styles.toggleButtonText,
                                    {
                                        color: !isBlockInput ? colors.text : colors.text + '60',
                                        fontWeight: !isBlockInput ? '600' : '400',
                                    }
                                ]}>Inline</Text>
                            </Pressable>
                            <Pressable
                                style={[
                                    styles.toggleButton,
                                    isBlockInput && [styles.toggleActiveButton, { backgroundColor: colors.card }],
                                ]}
                                onPress={() => setIsBlockInput(true)}
                            >
                                <Text style={[
                                    styles.toggleButtonText,
                                    {
                                        color: isBlockInput ? colors.text : colors.text + '60',
                                        fontWeight: isBlockInput ? '600' : '400',
                                    }
                                ]}>Block</Text>
                            </Pressable>
                        </View>
                    </View>
                    <Pressable onPress={(e) => e.stopPropagation()}>
                        <TextInput
                            ref={inputRef}
                            style={[
                                styles.latexInput,
                                {
                                    backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                    color: colors.text,
                                    borderColor: colors.border,
                                },
                            ]}
                            placeholder="e = mc^2"
                            placeholderTextColor={dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                            value={latex}
                            onChangeText={setLatex}
                            autoCapitalize="none"
                            autoCorrect={false}
                            multiline={true}
                            numberOfLines={4}
                            blurOnSubmit={false}
                        />
                    </Pressable>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.text, opacity: 0.6 }]}>PREVIEW</Text>
                    <Pressable
                        onPress={Keyboard.dismiss}
                        style={[styles.previewContainer, {
                            backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                            borderColor: colors.border,
                            height: 120,
                        }]}
                    >
                        {latex ? (
                            <WebView
                                ref={webViewRef}
                                originWhitelist={['*']}
                                source={{ html: previewHtml }}
                                style={{ backgroundColor: 'transparent' }}
                                scrollEnabled={true}
                                showsHorizontalScrollIndicator={true}
                                onLoadEnd={() => setPreviewLoading(false)}
                                onMessage={() => { }}
                            />
                        ) : (
                            <View style={styles.placeholderContainer}>
                                <Text style={[styles.placeholderText, { color: colors.text }]}>
                                    Preview will appear here
                                </Text>
                            </View>
                        )}
                        {latex && previewLoading && (
                            <View style={StyleSheet.absoluteFill}>
                                <ActivityIndicator size="small" color={colors.primary} style={{ flex: 1 }} />
                            </View>
                        )}
                    </Pressable>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    headerButton: {
        minWidth: 60,
        paddingVertical: 8,
        justifyContent: 'center',
    },
    headerCancelText: {
        fontSize: Platform.OS === 'ios' ? 17 : 14,
        fontWeight: '400',
    },
    headerTitle: {
        fontSize: Platform.OS === 'ios' ? 17 : 20,
        fontWeight: Platform.OS === 'ios' ? '600' : '500',
    },
    formContent: {
        padding: 16,
        gap: 16,
    },
    section: {
        gap: 6,
    },
    label: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    latexInput: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 15,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        minHeight: 100,
        textAlignVertical: 'top',
    },
    previewContainer: {
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        overflow: 'hidden',
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        fontSize: 13,
        fontStyle: 'italic',
        opacity: 0.4,
    },
    toggleContainer: {
        flexDirection: 'row',
        borderRadius: 8,
        borderWidth: 1,
        padding: 2,
        alignItems: 'center',
    },
    toggleButton: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        minWidth: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleActiveButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 1.5,
        elevation: 1,
    },
    toggleButtonText: {
        fontSize: 12,
    },
});