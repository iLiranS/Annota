import { useAppTheme } from '@/hooks/use-app-theme';
import { NoteImageService } from '@/lib/services/images';
import { useSettingsStore } from '@/stores/settings-store';
import { useKeyboard } from '@react-native-community/hooks';
import * as ExpoClipboard from 'expo-clipboard';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import editorHtml from './assets/editor-html';
import { ImageGallery } from './image-gallery';
import { EditorToolbar } from './toolbar';
import { EditorState, initialEditorState, PopupType, TipTapEditorProps, TipTapEditorRef } from './types';

/** Extract data-image-id values from HTML string */
function extractImageIds(html: string): string[] {
    const regex = /data-image-id="([^"]+)"/g;
    const ids: string[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        ids.push(match[1]);
    }
    return ids;
}

const IMAGE_MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
};

function parsePastedImageData(payload: string): { base64: string; extension: string } | null {
    const trimmed = payload.trim();
    const dataUriMatch = trimmed.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
    if (dataUriMatch) {
        const mimeType = dataUriMatch[1].toLowerCase();
        const extension = IMAGE_MIME_TO_EXT[mimeType] ?? 'jpg';
        const base64 = dataUriMatch[2];
        return base64 ? { base64, extension } : null;
    }

    // Fallback: if payload is already raw base64, default to jpg temp extension.
    return trimmed ? { base64: trimmed, extension: 'jpg' } : null;
}

const TipTapEditor = React.memo(forwardRef<TipTapEditorRef, TipTapEditorProps>(
    ({ initialContent = '', onContentChange, placeholder = 'Start typing...', autofocus = false, onSearchResults, contentPaddingTop = 0, onGalleryVisibilityChange, editable = true, noteId }, ref) => {
        const { colors, dark } = useAppTheme();
        const { editor: editorSettings } = useSettingsStore();
        const webViewRef = useRef<WebView>(null);
        const [isReady, setIsReady] = useState(false);
        const [editorState, setEditorState] = useState<EditorState>(initialEditorState);
        const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
        const [isPopupOpen, setIsPopupOpen] = useState(false);
        const [activePopup, setActivePopup] = useState<PopupType>(null);
        const [galleryImages, setGalleryImages] = useState<any[]>([]);
        const [galleryCurrentIndex, setGalleryCurrentIndex] = useState(0);
        const [isGalleryVisible, setIsGalleryVisible] = useState(false);
        const isGalleryVisibleRef = useRef(false);
        const [toolbarHeight, setToolbarHeight] = useState(50); // it's height is fixed 50
        const [tempBlockData, setTempBlockData] = useState<any>(null); // Data for valid block menu
        const [currentLatex, setCurrentLatex] = useState<string | null>(null);
        const contentResolverRef = useRef<((html: string) => void) | null>(null);
        const { keyboardHeight } = useKeyboard();
        const insets = useSafeAreaInsets();
        const { width, height } = useWindowDimensions();

        // Detect iPhone landscape mode (not tablet, width > height)
        const isIPhoneLandscape = Platform.OS === 'ios' && Platform.isPad === false && width > height;





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
                // Search methods
                search: (term: string) => {
                    sendCommand('search', { term });
                },
                searchNext: () => {
                    sendCommand('searchNext');
                },
                searchPrev: () => {
                    sendCommand('searchPrev');
                },
                clearSearch: () => {
                    sendCommand('clearSearch');
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
                                colors,
                                content: initialContent,
                                placeholder,
                                autofocus,
                                paddingTop: contentPaddingTop,
                                direction: editorSettings.direction,
                                fontFamily: editorSettings.fontFamily,
                                editable,
                            });
                            // Resolve any local images in the initial content
                            const imageIds = extractImageIds(initialContent);
                            if (imageIds.length > 0) {
                                NoteImageService.resolveImageSources(imageIds).then(imageMap => {
                                    if (Object.keys(imageMap).length > 0) {
                                        sendCommand('resolveImages', { imageMap });
                                    }
                                });
                            }
                            break;
                        case 'content': {
                            // Content updated
                            onContentChange?.(data.html);
                            break;

                        }
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
                        case 'imagePasted':
                            if (noteId && data.base64 && data.imageId) {
                                (async () => {
                                    let stage = 'parse';
                                    try {
                                        const parsed = parsePastedImageData(data.base64);
                                        if (!parsed) return;

                                        stage = 'createTempDir';
                                        const tempDir = new Directory(Paths.cache, 'pasted');
                                        tempDir.create({ idempotent: true, intermediates: true });

                                        stage = 'writeTempFile';
                                        const tempFile = new ExpoFile(tempDir, `pasted-${Date.now()}.${parsed.extension}`);
                                        try {
                                            tempFile.create({ overwrite: true, intermediates: true });
                                            tempFile.write(parsed.base64, { encoding: 'base64' });
                                        } catch {
                                            await LegacyFileSystem.writeAsStringAsync(tempFile.uri, parsed.base64, {
                                                encoding: LegacyFileSystem.EncodingType.Base64,
                                            });
                                        }

                                        stage = 'processImage';
                                        const processed = await NoteImageService.processAndInsertImage(noteId, tempFile.uri);
                                        stage = 'replaceImageId';
                                        sendCommand('replaceImageId', { oldId: data.imageId, newId: processed.imageId });

                                        stage = 'resolveImages';
                                        const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                                        sendCommand('resolveImages', { imageMap });
                                    } catch (err) {
                                        console.error(`Failed to process pasted image at stage: ${stage}`, err);
                                    }
                                })();
                            }
                            break;
                        case 'resolveImageIds':
                            if (Array.isArray(data.imageIds) && data.imageIds.length > 0) {
                                (async () => {
                                    try {
                                        const imageMap = await NoteImageService.resolveImageSources(data.imageIds);
                                        if (Object.keys(imageMap).length > 0) {
                                            sendCommand('resolveImages', { imageMap });
                                        }
                                    } catch (err) {
                                        console.error('Failed to resolve pasted image IDs', err);
                                    }
                                })();
                            }
                            break;
                        case 'imageSelected':
                            // Always dismiss keyboard and blur - prevents keyboard from opening
                            // when webview selects/focuses a new image node
                            sendCommand('blur');
                            Keyboard.dismiss();
                            setIsKeyboardVisible(false);
                            setGalleryImages(data.images || []);
                            setGalleryCurrentIndex(data.currentIndex || 0);
                            setIsGalleryVisible(true);
                            isGalleryVisibleRef.current = true;
                            onGalleryVisibilityChange?.(true);
                            break;
                        case 'openImageMenu':
                            sendCommand('blur');
                            Keyboard.dismiss();
                            setIsKeyboardVisible(false);
                            setTempBlockData(data);
                            setActivePopup('imageMenu');
                            setIsPopupOpen(true);
                            break;
                        case 'codeBlockSelected':
                            setActivePopup('codeLanguage');
                            setIsPopupOpen(true);
                            break;
                        case 'mathSelected':
                            setCurrentLatex(data.latex);
                            setActivePopup('math');
                            setIsPopupOpen(true);
                            break;
                        case 'openBlockMenu':
                            setActivePopup('blockMenu');
                            // Store the block data temporarily or in state
                            if (data) {
                                // We can piggyback on a new state or just pass it when rendering
                                // But since activePopup is just a string, we might need a separate state for popup data
                                // For now, let's use selectedImageAttrs as a generic "active item data" or create a new one
                                setTempBlockData(data);
                            }
                            setIsPopupOpen(true);
                            break;
                        case 'searchResults':
                            // Forward search results to parent component
                            onSearchResults?.(data.count, data.currentIndex);
                            break;
                    }
                } catch (e) {
                    console.warn('Failed to parse WebView message:', e);
                }
            },
            [onContentChange, onSearchResults, dark, colors, initialContent, placeholder, autofocus, sendCommand]
        );

        useEffect(() => {
            if (isReady) {
                sendCommand('setOptions', {
                    isDark: dark,
                    colors,
                    paddingTop: contentPaddingTop,
                    direction: editorSettings.direction,
                    fontFamily: editorSettings.fontFamily,
                });
            }
        }, [dark, colors, isReady, sendCommand, contentPaddingTop, editorSettings.direction, editorSettings.fontFamily]);

        useEffect(() => {
            if (isReady) {
                sendCommand('setFontFamily', { fontFamily: editorSettings.fontFamily });
            }
        }, [editorSettings.fontFamily, isReady, sendCommand]);

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

        // Hide toolbar when gallery is open
        const showToolbar = (isKeyboardVisible || isPopupOpen) && !isGalleryVisible;

        // ============ IMAGE INSERTION HANDLER ============
        const handleInsertImage = useCallback(async (source: 'url' | 'library' | 'camera', value?: string) => {
            if (!noteId) {
                console.warn('Cannot insert image: noteId is required');
                return;
            }

            try {
                let imageUri: string | undefined;

                if (source === 'library') {
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== 'granted') {
                        console.warn('Media library permission denied');
                        return;
                    }
                    const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ['images'],
                        quality: 1,
                    });
                    if (result.canceled || !result.assets[0]) return;
                    imageUri = result.assets[0].uri;
                } else if (source === 'camera') {
                    const { status } = await ImagePicker.requestCameraPermissionsAsync();
                    if (status !== 'granted') {
                        console.warn('Camera permission denied');
                        return;
                    }
                    const result = await ImagePicker.launchCameraAsync({
                        mediaTypes: ['images'],
                        quality: 1,
                    });
                    if (result.canceled || !result.assets[0]) return;
                    imageUri = result.assets[0].uri;
                } else if (source === 'url' && value) {
                    // Download and process remote URL
                    const processed = await NoteImageService.processRemoteImage(noteId, value);
                    // Insert into editor and resolve
                    sendCommand('insertLocalImage', { imageId: processed.imageId });
                    const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                    sendCommand('resolveImages', { imageMap });
                    return;
                }

                if (imageUri) {
                    const processed = await NoteImageService.processAndInsertImage(noteId, imageUri);
                    sendCommand('insertLocalImage', { imageId: processed.imageId });
                    const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                    sendCommand('resolveImages', { imageMap });
                }
            } catch (err) {
                console.error('Failed to insert image:', err);
            }
        }, [noteId, sendCommand]);

        const devEditorUrl = process.env.EXPO_PUBLIC_EDITOR_DEV_URL ?? 'http://192.168.7.14:5173';
        const useDevEditor = __DEV__ && process.env.EXPO_PUBLIC_EDITOR_DEV_SERVER === 'true';

        const source = useDevEditor
            ? { uri: devEditorUrl }
            : {
                html: editorHtml,
                baseUrl: 'https://app.local',
            };


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
                    allowFileAccess
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
                            {
                                bottom: keyboardHeight - 2,
                                backgroundColor: colors.background,
                                borderTopColor: colors.border,
                                // On iPhone landscape, add horizontal padding for notch/home indicator
                                paddingLeft: isIPhoneLandscape ? insets.left : 0,
                                paddingRight: isIPhoneLandscape ? insets.right : 0,
                            },
                        ]}
                    >
                        <EditorToolbar
                            editorState={editorState}
                            onDismissKeyboard={handleDismissKeyboard}
                            activePopup={activePopup}
                            onActivePopupChange={(type) => {
                                setActivePopup(type);
                                handlePopupStateChange(!!type);
                            }}
                            onPopupStateChange={handlePopupStateChange}
                            onCommand={sendCommand}
                            blockData={tempBlockData}
                            currentLatex={currentLatex}
                            onInsertMath={() => {
                                setCurrentLatex(null);
                                setActivePopup('math');
                                setIsPopupOpen(true);
                            }}
                            onInsertImage={handleInsertImage}
                        />
                    </View>
                )}


                {/* Full Screen Image Gallery — rendered in a Modal to avoid WebView touch interception */}
                <Modal
                    visible={isGalleryVisible}
                    transparent
                    animationType="none"
                    statusBarTranslucent
                    supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
                    onRequestClose={() => {
                        setIsGalleryVisible(false);
                        isGalleryVisibleRef.current = false;
                        onGalleryVisibilityChange?.(false);
                    }}
                >
                    <ImageGallery
                        visible={isGalleryVisible}
                        images={galleryImages}
                        initialIndex={galleryCurrentIndex}
                        onClose={() => {
                            setIsGalleryVisible(false);
                            isGalleryVisibleRef.current = false;
                            onGalleryVisibilityChange?.(false);
                        }}
                        onNavigate={(index) => {
                            setGalleryCurrentIndex(index);
                        }}
                    />
                </Modal>
            </View >
        );
    }
));

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
        position: 'absolute',
        left: 0,
        right: 0,
        borderTopWidth: 1,
    },

});

export default TipTapEditor;
export type { TipTapEditorProps, TipTapEditorRef } from './types';
export { TipTapEditor };

