import { useTheme } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface MathInputProps {
    currentLatex: string | null;
    onSubmit: (latex: string) => void;
    onClose: () => void;
}

export function MathInput({ currentLatex, onSubmit, onClose }: MathInputProps) {
    const { colors, dark } = useTheme();
    const [latex, setLatex] = useState(currentLatex || '');
    const [previewLoading, setPreviewLoading] = useState(true);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        // Focus input when opened
        setTimeout(() => inputRef.current?.focus(), 200);
    }, []);

    const handleSubmit = () => {
        const trimmedLatex = latex.trim();
        if (trimmedLatex) {
            onSubmit(trimmedLatex);
        }
    };

    const isValid = latex.trim().length > 0;

    // Minimal HTML for KaTeX preview - Left aligned and Scrollable
    const previewHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
            <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
            <style>
                body {
                    display: block;
                    margin: 0;
                    padding: 20px 10px;
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
                /* Ensure KaTeX itself doesn't force center */
                .katex {
                    text-align: left !important;
                    white-space: nowrap;
                }
            </style>
        </head>
        <body>
            <div id="math"></div>
            <script>
                function render(tex) {
                    const el = document.getElementById('math');
                    if (!tex) {
                        el.innerHTML = '';
                        return;
                    }
                    try {
                        katex.render(tex, el, {
                            throwOnError: false,
                            displayMode: true,
                            leqno: false,
                            fleqn: true
                        });
                    } catch (err) {
                        el.innerHTML = '<span style="color: #FF453A; font-size: 12px;">' + err.message + '</span>';
                    }
                }
                render(${JSON.stringify(latex)});
                window.addEventListener('message', (event) => {
                    render(event.data);
                });
            </script>
        </body>
        </html>
    `;

    // Inject JS into WebView to update preview without reload
    const webViewRef = useRef<WebView>(null);
    useEffect(() => {
        if (webViewRef.current && !previewLoading) {
            webViewRef.current.postMessage(latex);
        }
    }, [latex, previewLoading]);

    return (
        <View style={styles.container}>
            <Text style={[styles.title, { color: colors.text }]}>
                {currentLatex ? 'Edit Formula' : 'Insert Formula'}
            </Text>

            <View style={styles.section}>
                <Text style={[styles.label, { color: colors.text, opacity: 0.6 }]}>LATEX INPUT</Text>
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
            </View>

            <View style={styles.section}>
                <Text style={[styles.label, { color: colors.text, opacity: 0.6 }]}>PREVIEW</Text>
                <View style={[styles.previewContainer, {
                    backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderColor: colors.border
                }]}>
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
                </View>
            </View>

            <View style={styles.footer}>
                <Pressable
                    style={[styles.button, styles.cancelButton]}
                    onPress={onClose}
                >
                    <Text style={[styles.buttonText, { color: colors.text, opacity: 0.7 }]}>Cancel</Text>
                </Pressable>
                <Pressable
                    style={[
                        styles.button,
                        styles.submitButton,
                        { backgroundColor: isValid ? colors.primary : colors.border }
                    ]}
                    onPress={handleSubmit}
                    disabled={!isValid}
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
    container: {
        width: '100%',
        gap: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
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
        height: 120,
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
    footer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
    button: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: 'transparent',
    },
    submitButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
