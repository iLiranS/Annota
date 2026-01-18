import { useTheme } from '@react-navigation/native';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Linking, Platform, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { getEditorHtml } from './editor-html';
import { EditorToolbar } from './toolbar';
import { EditorState, initialEditorState, TipTapEditorProps, TipTapEditorRef } from './types';

/**
 * TipTap-based rich text editor component for React Native.
 * 
 * Features:
 * - Dual mode: Edit mode (raw text) and Display mode (rendered LaTeX)
 * - Rich text formatting with colors and highlights
 * - Headings H1-H6
 * - Lists (bullet, ordered)
 * - Code (inline and blocks with syntax highlighting)
 * - Blockquotes
 * - Links (clickable, opens in browser)
 * - LaTeX/Math support (rendered in display mode using KaTeX)
 * - YouTube embeds
 * - Auto-save with debouncing
 * - Native toolbar that appears with keyboard
 */
const TipTapEditor = forwardRef<TipTapEditorRef, TipTapEditorProps>(
    ({ initialContent = '', onContentChange, placeholder = 'Start typing...', autofocus = false }, ref) => {
        const { colors, dark } = useTheme();
        const webViewRef = useRef<WebView>(null);
        const [isReady, setIsReady] = useState(false);
        const [editorState, setEditorState] = useState<EditorState>(initialEditorState);
        const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
        const [isPopupOpen, setIsPopupOpen] = useState(false);
        const contentResolverRef = useRef<((html: string) => void) | null>(null);

        const sendCommand = useCallback(
            (command: string, params: Record<string, unknown> = {}) => {
                if (!webViewRef.current || !isReady) return;
                const paramsStr = JSON.stringify(params).replace(/'/g, "\\'");
                const js = `window.handleCommand && window.handleCommand('${command}', ${paramsStr}); true;`;
                webViewRef.current.injectJavaScript(js);
            },
            [isReady]
        );

        useImperativeHandle(
            ref,
            () => ({
                getContent: () => {
                    return new Promise((resolve) => {
                        contentResolverRef.current = resolve;
                        sendCommand('getContent');
                        setTimeout(() => {
                            if (contentResolverRef.current) {
                                contentResolverRef.current('');
                                contentResolverRef.current = null;
                            }
                        }, 1000);
                    });
                },
                setContent: (content: string) => {
                    sendCommand('setContent', { content });
                },
                focus: () => {
                    sendCommand('focus');
                },
                blur: () => {
                    sendCommand('blur');
                },
            }),
            [sendCommand]
        );

        const handleMessage = useCallback(
            (event: WebViewMessageEvent) => {
                try {
                    const data = JSON.parse(event.nativeEvent.data);

                    switch (data.type) {
                        case 'ready':
                            setIsReady(true);
                            break;
                        case 'content':
                            onContentChange?.(data.html);
                            break;
                        case 'contentResponse':
                            if (contentResolverRef.current) {
                                contentResolverRef.current(data.html);
                                contentResolverRef.current = null;
                            }
                            break;
                        case 'state':
                            setEditorState(data.state);
                            break;
                        case 'error':
                            console.warn('TipTap Editor error:', data.message);
                            break;
                        case 'focus':
                            // Focus handled via keyboard listeners
                            break;
                        case 'blur':
                            // Blur handled via keyboard listeners
                            break;
                        case 'openLink':
                            if (data.href) {
                                Linking.openURL(data.href).catch((err) => {
                                    console.warn('Failed to open link:', err);
                                });
                            }
                            break;
                    }
                } catch (e) {
                    console.warn('Failed to parse WebView message:', e);
                }
            },
            [onContentChange]
        );

        useEffect(() => {
            const showSubscription = Keyboard.addListener(
                Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
                () => setIsKeyboardVisible(true)
            );
            const hideSubscription = Keyboard.addListener(
                Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
                () => {
                    // Don't hide toolbar if popup is open
                    if (!isPopupOpen) {
                        setIsKeyboardVisible(false);
                    }
                }
            );

            return () => {
                showSubscription.remove();
                hideSubscription.remove();
            };
        }, [isPopupOpen]);

        const handleDismissKeyboard = useCallback(() => {
            sendCommand('blur');
            Keyboard.dismiss();
        }, [sendCommand]);

        const handlePopupStateChange = useCallback((isOpen: boolean) => {
            setIsPopupOpen(isOpen);
            // When popup closes and keyboard is not visible, hide toolbar
            if (!isOpen) {
                // Small delay to allow keyboard to potentially reappear
                setTimeout(() => {
                    // Check keyboard state again
                    // If keyboard is not visible within this time, the toolbar will hide naturally
                }, 100);
            }
        }, []);

        const htmlContent = getEditorHtml({
            isDark: dark,
            primaryColor: colors.primary,
            initialContent,
            placeholder,
            autofocus,
        });

        // Show toolbar if keyboard is visible OR if popup is open
        const showToolbar = isKeyboardVisible || isPopupOpen;

        return (
            <View style={styles.container}>
                <WebView
                    ref={webViewRef}
                    source={{ html: htmlContent, baseUrl: 'https://localhost' }}
                    onMessage={handleMessage}
                    scrollEnabled={true}
                    keyboardDisplayRequiresUserAction={false}
                    hideKeyboardAccessoryView={true}
                    style={[styles.webView, { backgroundColor: colors.background }]}
                    originWhitelist={['*']}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    allowsInlineMediaPlayback={true}
                    mixedContentMode="always"
                    onError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        console.warn('WebView error: ', nativeEvent);
                    }}
                />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardAvoidingView}
                    pointerEvents="box-none"
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
                >
                    {showToolbar && (
                        <View
                            style={[
                                styles.toolbarContainer,
                                {
                                    backgroundColor: dark ? '#1C1C1E' : '#F2F2F7',
                                },
                            ]}
                        >
                            <EditorToolbar
                                editorState={editorState}
                                onCommand={sendCommand}
                                onDismissKeyboard={handleDismissKeyboard}
                                onPopupStateChange={handlePopupStateChange}
                            />
                        </View>
                    )}
                </KeyboardAvoidingView>
            </View>
        );
    }
);

TipTapEditor.displayName = 'TipTapEditor';

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    webView: {
        flex: 1,
    },
    toolbarContainer: {
        width: '95%',
        alignSelf: 'center',
        borderRadius: 12,
        overflow: 'hidden',
    },
    keyboardAvoidingView: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
});

export default TipTapEditor;
export type { TipTapEditorProps, TipTapEditorRef } from './types';
export { TipTapEditor };

