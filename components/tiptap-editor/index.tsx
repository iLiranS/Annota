import { useKeyboard } from '@react-native-community/hooks';
import { useTheme } from '@react-navigation/native';
import * as ExpoClipboard from 'expo-clipboard';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { ImageGallery } from './image-gallery';
import { EditorToolbar } from './toolbar';
import { EditorState, initialEditorState, PopupType, TipTapEditorProps, TipTapEditorRef } from './types';

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
        const [activePopup, setActivePopup] = useState<PopupType>(null);
        const [selectedImageAttrs, setSelectedImageAttrs] = useState<any>(null);
        const [galleryImages, setGalleryImages] = useState<any[]>([]);
        const [galleryCurrentIndex, setGalleryCurrentIndex] = useState(0);
        const [toolbarHeight, setToolbarHeight] = useState(50); // it's height is fixed 50
        const contentResolverRef = useRef<((html: string) => void) | null>(null);
        const { keyboardHeight } = useKeyboard();

        const sendCommand = useCallback(
            (command: string, params: Record<string, unknown> = {}) => {
                if (!webViewRef.current) return;
                const paramsStr = JSON.stringify(params).replace(/'/g, "\\'");
                const js = `window.handleCommand && window.handleCommand('${command}', ${paramsStr}); true;`;
                webViewRef.current.injectJavaScript(js);
            },
            []
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
                            sendCommand('setOptions', {
                                isDark: dark,
                                primaryColor: colors.primary,
                                content: initialContent,
                                placeholder,
                                autofocus,
                            });
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
                        case 'copyToClipboard':
                            if (data.content) {
                                ExpoClipboard.setStringAsync(data.content);
                            }
                            break;
                        case 'focus':
                            // Focus handled via keyboard listeners
                            break;
                        case 'blur':
                            // Blur handled via keyboard listeners
                            break;
                        case 'imageSelected':
                            // console.log('Image selected:', data);
                            setSelectedImageAttrs(data);
                            setGalleryImages(data.images || []);
                            setGalleryCurrentIndex(data.currentIndex || 0);
                            setActivePopup('imageActions');
                            setIsPopupOpen(true);
                            break;
                        case 'codeBlockSelected':
                            setActivePopup('codeLanguage');
                            setIsPopupOpen(true);
                            break;
                    }
                } catch (e) {
                    console.warn('Failed to parse WebView message:', e);
                }
            },
            [onContentChange, dark, colors.primary, initialContent, placeholder, autofocus, sendCommand]
        );

        useEffect(() => {
            if (isReady) {
                sendCommand('setOptions', {
                    isDark: dark,
                    primaryColor: colors.primary,
                });
            }
        }, [dark, colors.primary, isReady, sendCommand]);

        useEffect(() => {
            const handleKeyboardShow = (height: number) => {
                setIsKeyboardVisible(true);
                // Send total obscured height (keyboard + toolbar) to webview
                // Use height from event + current toolbar height
                sendCommand('setKeyboardHeight', { height: height + toolbarHeight });
            };

            const showSubscription = Keyboard.addListener(
                Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
                (e) => {
                    handleKeyboardShow(e.endCoordinates.height);
                }
            );

            // Robustness: Re-scroll after keyboard animation fully finishes (iOS mainly)
            let didShowSubscription: any = null;
            if (Platform.OS === 'ios') {
                didShowSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
                    handleKeyboardShow(e.endCoordinates.height);
                });
            }

            const hideSubscription = Keyboard.addListener(
                Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
                () => {
                    if (!isPopupOpen) {
                        setIsKeyboardVisible(false);
                    }
                    // Reset keyboard height when hidden
                    sendCommand('setKeyboardHeight', { height: 0 });
                }
            );

            return () => {
                showSubscription.remove();
                didShowSubscription?.remove();
                hideSubscription.remove();
            };
        }, [isPopupOpen, sendCommand, toolbarHeight]);

        const handleDismissKeyboard = useCallback(() => {
            sendCommand('blur');
            Keyboard.dismiss();
        }, [sendCommand]);

        const handlePopupStateChange = useCallback((isOpen: boolean) => {
            setIsPopupOpen(isOpen);
        }, []);

        const showToolbar = isKeyboardVisible || isPopupOpen;

        const source = __DEV__
            ? { uri: 'http://192.168.7.9:5173' }
            : require('./assets/editor.html');

        const themeInjectionScript = `
            (function() {
                var root = document.documentElement;
                var bg = '${dark ? '#000000' : '#FFFFFF'}';
                var fg = '${dark ? '#FFFFFF' : '#000000'}';
                root.style.setProperty('--bg-color', bg);
                root.style.setProperty('--text-color', fg);
                root.style.setProperty('--accent-color', '${colors.primary}');
                // Set root background immediately to prevent flash
                root.style.backgroundColor = bg;
            })();
            true;
        `;

        return (
            <View style={styles.container}>
                <WebView
                    ref={webViewRef}
                    source={source}
                    onMessage={handleMessage}
                    injectedJavaScriptBeforeContentLoaded={themeInjectionScript}
                    scrollEnabled={true}
                    keyboardDisplayRequiresUserAction={false}
                    hideKeyboardAccessoryView={true}
                    style={[styles.webView, { backgroundColor: colors.background }]}
                    originWhitelist={['*']}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    allowsInlineMediaPlayback={true}
                    mixedContentMode="always"
                    contentInsetAdjustmentBehavior="never"
                    onError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        console.warn('WebView error: ', nativeEvent);
                    }}
                />

                {showToolbar && (
                    <View
                        style={[
                            styles.toolbarContainer,
                            { marginBottom: keyboardHeight },
                            {
                                backgroundColor: dark ? '#1C1C1E' : '#F2F2F7',
                                borderTopColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            },
                        ]}
                    >
                        <EditorToolbar
                            editorState={editorState}
                            onDismissKeyboard={handleDismissKeyboard}
                            activePopup={activePopup === 'imageActions' ? null : activePopup}
                            onActivePopupChange={(type) => {
                                setActivePopup(type);
                                handlePopupStateChange(!!type);
                            }}
                            onPopupStateChange={(isOpen) => {
                                if (activePopup !== 'imageActions') {
                                    handlePopupStateChange(isOpen);
                                }
                            }}
                            onCommand={sendCommand}
                        />
                    </View>
                )}


                {/* Full Screen Image Gallery */}
                <ImageGallery
                    visible={isPopupOpen && activePopup === 'imageActions'}
                    images={galleryImages}
                    initialIndex={galleryCurrentIndex}
                    onClose={() => {
                        setActivePopup(null);
                        setIsPopupOpen(false);
                    }}
                    onNavigate={(index) => {
                        setGalleryCurrentIndex(index);
                        if (galleryImages[index]) {
                            sendCommand('selectImageAtPosition', { position: galleryImages[index].position });
                        }
                    }}
                    onResize={(width) => {
                        sendCommand('updateImage', { width });
                        setActivePopup(null);
                        setIsPopupOpen(false);
                    }}
                    onDownload={() => {
                        console.log('Download image (dummy)');
                        setActivePopup(null);
                        setIsPopupOpen(false);
                    }}
                    onCut={() => {
                        sendCommand('cutImage');
                        setActivePopup(null);
                        setIsPopupOpen(false);
                    }}
                    onDelete={() => {
                        sendCommand('deleteImage');
                        setActivePopup(null);
                        setIsPopupOpen(false);
                    }}
                />
            </View >
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
        // transparent background to let container color show through if needed
        backgroundColor: 'transparent',
    },
    toolbarContainer: {
        width: '100%',
        alignSelf: 'center',
        overflow: 'hidden',
        borderTopWidth: 1,
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

