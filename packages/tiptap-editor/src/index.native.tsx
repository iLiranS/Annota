import { useSettingsStore } from '@annota/core';
import { NoteImageService } from '@annota/core/platform';
import editorHtml from '@annota/editor-web/dist/editor-html';
import { useKeyboard } from '@react-native-community/hooks';
import { useTheme } from '@react-navigation/native';
import * as ExpoClipboard from 'expo-clipboard';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, Linking, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { EditorState, initialEditorState, PopupType, TipTapEditorProps, TipTapEditorRef } from './types';

const getByteSize = (str: string) => new Blob([str]).size;

/**
 * Strip heavy inline src payloads (base64 data URIs) from images that carry
 * a data-image-id attribute before checking byte size.
 * These src values are ephemeral (only used for WebView rendering) and are
 * stripped by normalizeStoredContent before persisting to SQLite.
 */
const getStorableByteSize = (html: string): number => {
    const stripped = html.replace(/<img\b[^>]*>/gi, (imgTag) => {
        if (!/data-image-id\s*=\s*["'][^"']+["']/i.test(imgTag)) return imgTag;
        return imgTag
            .replace(/\s+src\s*=\s*(["']).*?\1/gi, ' src=""')
            .replace(/\s+src\s*=\s*[^\s>]+/gi, ' src=""');
    });
    return getByteSize(stripped);
};

/** Extract data-image-id values from HTML string */
function extractImageIds(html: string): string[] {
    const regex = /data-image-id\s*=\s*(["'])(.*?)\1/gi;
    const ids: string[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        ids.push(match[2]);
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
    ({
        initialContent = '',
        onContentChange,
        placeholder = 'Start typing...',
        autofocus = false,
        onSearchResults,
        contentPaddingTop = 0,
        onGalleryVisibilityChange,
        editable = true,
        noteId,
        onCopyBlockLink,
        renderToolbar,
        renderImageGallery
    }, ref) => {
        const { colors, dark } = useTheme();
        const { editor: editorSettings } = useSettingsStore();
        const webViewRef = useRef<WebView>(null);
        const scrollViewRef = useRef<ScrollView>(null);
        const scrollOffsetY = useRef(0);
        const scrollHeight = useRef(0);
        const [isReady, setIsReady] = useState(false);
        const [editorState, setEditorState] = useState<EditorState>(initialEditorState);
        const [editorHeight, setEditorHeight] = useState<number>(100);
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
        const isReadyRef = useRef(false);
        const queuedCommandsRef = useRef<Array<{ command: string; params: Record<string, unknown> }>>([]);
        const lastInternalLinkRef = useRef<{ href: string; ts: number } | null>(null);
        const { keyboardHeight } = useKeyboard();
        const keyboardHeightRef = useRef(keyboardHeight);
        keyboardHeightRef.current = keyboardHeight;
        const insets = useSafeAreaInsets();
        const { width, height } = useWindowDimensions();
        const lastValidContentRef = useRef<string>(initialContent);

        // Detect iPhone landscape mode (not tablet, width > height)
        const isIPhoneLandscape = Platform.OS === 'ios' && Platform.isPad === false && width > height;

        // Stable scroll-to-cursor handler using refs so it always has fresh values
        const scrollToCursor = useCallback((cursorTop: number, cursorBottom: number) => {
            const y = scrollOffsetY.current;
            const viewportHeight = scrollHeight.current;
            // The keyboard + toolbar obscures the bottom portion
            const obscuredBottom = keyboardHeightRef.current + toolbarHeight;
            const visibleHeight = viewportHeight - obscuredBottom;
            const padding = 40;

            if (visibleHeight <= 0) return; // safety

            // Cursor is below the visible area
            if (cursorBottom > y + visibleHeight - padding) {
                scrollViewRef.current?.scrollTo({
                    y: Math.max(0, cursorBottom - visibleHeight + padding),
                    animated: true,
                });
                // Cursor is above the visible area
            } else if (cursorTop < y + padding) {
                scrollViewRef.current?.scrollTo({
                    y: Math.max(0, cursorTop - padding),
                    animated: true,
                });
            }
        }, [toolbarHeight]);





        const injectCommand = useCallback(
            (command: string, params: Record<string, unknown> = {}) => {
                if (!webViewRef.current) return;
                const paramsStr = JSON.stringify(params).replace(/'/g, "\\'");
                const js = `window.handleCommand && window.handleCommand('${command}', ${paramsStr}); true;`;
                webViewRef.current.injectJavaScript(js);
            },
            []
        );

        const flushQueuedCommands = useCallback(() => {
            if (!isReadyRef.current || queuedCommandsRef.current.length === 0) return;
            const pending = queuedCommandsRef.current;
            queuedCommandsRef.current = [];
            pending.forEach(({ command, params }) => {
                injectCommand(command, params);
            });
        }, [injectCommand]);

        const sendCommand = useCallback(
            (command: string, params: Record<string, unknown> = {}) => {
                if (!webViewRef.current) return;

                if (!isReadyRef.current && command !== 'setOptions') {
                    queuedCommandsRef.current.push({ command, params });
                    return;
                }

                injectCommand(command, params);
            },
            [injectCommand]
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
                scrollToElement: (id: string) => {
                    sendCommand('scrollToElement', { id });
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
                            isReadyRef.current = true;
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
                                fontSize: editorSettings.fontSize,
                                lineSpacing: editorSettings.lineSpacing,
                                editable,
                            });
                            // Resolve any local images in the initial content
                            const imageIds = extractImageIds(initialContent);
                            if (imageIds.length > 0) {
                                NoteImageService.resolveImageSources(imageIds).then((imageMap: any) => {
                                    if (Object.keys(imageMap).length > 0) {
                                        sendCommand('resolveImages', { imageMap });
                                    }
                                });
                            }
                            flushQueuedCommands();
                            break;
                        case 'content': {
                            // Content updated — measure storable size (excludes ephemeral base64 src)
                            const currentSize = getStorableByteSize(data.html);
                            const previousSize = getStorableByteSize(lastValidContentRef.current);

                            if (currentSize >= 145000 && currentSize > previousSize) {
                                Toast.show({
                                    type: 'error',
                                    text1: 'Note Limit Reached',
                                    text2: 'Note size is too large. Please shorten it.',
                                });
                                // Revert to last valid content
                                sendCommand('setContent', { content: lastValidContentRef.current });
                                break;
                            }

                            lastValidContentRef.current = data.html;
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
                        case 'heightChange':
                            if (typeof data.height === 'number') {
                                setEditorHeight(data.height);
                            }
                            break;
                        case 'cursorPosition':
                            if (typeof data.top === 'number' && typeof data.bottom === 'number') {
                                scrollToCursor(data.top, data.bottom);
                            }
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
                        case 'copyBlockLink':
                            if (data.id && onCopyBlockLink) {
                                onCopyBlockLink(data.id);
                            }
                            break;
                        case 'openLink':
                            if (data.href) {
                                // Link taps should never leave the editor focused / keyboard open.
                                sendCommand('blur');
                                Keyboard.dismiss();
                                setIsKeyboardVisible(false);

                                if (data.href.startsWith('annota://note/')) {
                                    try {
                                        const now = Date.now();
                                        const lastLink = lastInternalLinkRef.current;
                                        if (lastLink && lastLink.href === data.href && now - lastLink.ts < 350) {
                                            break;
                                        }
                                        lastInternalLinkRef.current = { href: data.href, ts: now };

                                        const parsedUrl = new URL(data.href);
                                        const targetNoteId = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
                                        const elementId = parsedUrl.searchParams.get('elementId');

                                        if (noteId && targetNoteId === noteId) {
                                            sendCommand('blur');
                                            Keyboard.dismiss();
                                            if (elementId) {
                                                sendCommand('scrollToElement', { id: elementId });
                                            }
                                            break;
                                        }

                                        router.push({
                                            pathname: '/Notes/[id]',
                                            params: {
                                                id: targetNoteId,
                                                source: 'link',
                                                ...(elementId ? { scrollToElementId: elementId } : {})
                                            }
                                        });
                                    } catch (err) {
                                        console.warn('Failed to parse internal deep link:', err);
                                    }
                                } else {
                                    // Make sure it's a valid external URL
                                    let url = data.href;
                                    if (!url.startsWith('http')) {
                                        url = 'https://' + url;
                                    }
                                    Linking.openURL(url);
                                }
                            }
                            break;
                    }
                } catch (e) {
                    console.warn('Failed to parse WebView message:', e);
                }
            },
            [
                onContentChange,
                onSearchResults,
                dark,
                colors,
                initialContent,
                placeholder,
                autofocus,
                contentPaddingTop,
                editorSettings.direction,
                editorSettings.fontFamily,
                editorSettings.fontSize,
                editorSettings.lineSpacing,
                editable,
                noteId,
                onGalleryVisibilityChange,
                onCopyBlockLink,
                sendCommand,
                flushQueuedCommands,
                scrollToCursor,
            ]
        );

        useEffect(() => {
            if (isReady) {
                sendCommand('setOptions', {
                    isDark: dark,
                    colors,
                    paddingTop: contentPaddingTop,
                    direction: editorSettings.direction,
                    fontFamily: editorSettings.fontFamily,
                    fontSize: editorSettings.fontSize,
                    lineSpacing: editorSettings.lineSpacing,
                });
            }
        }, [dark, colors, isReady, sendCommand, contentPaddingTop, editorSettings.direction, editorSettings.fontFamily, editorSettings.fontSize, editorSettings.lineSpacing]);

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
        const handleInsertImage = useCallback(async (source: 'url' | 'library' | 'camera', value?: string): Promise<boolean> => {
            if (!noteId) {
                console.warn('Cannot insert image: noteId is required');
                return false;
            }

            try {
                let imageUri: string | undefined;

                if (source === 'library') {
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== 'granted') {
                        console.warn('Media library permission denied');
                        return false;
                    }
                    const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ['images'],
                        quality: 1,
                    });
                    if (result.canceled || !result.assets[0]) return false;
                    imageUri = result.assets[0].uri;
                } else if (source === 'camera') {
                    const { status } = await ImagePicker.requestCameraPermissionsAsync();
                    if (status !== 'granted') {
                        console.warn('Camera permission denied');
                        return false;
                    }
                    const result = await ImagePicker.launchCameraAsync({
                        mediaTypes: ['images'],
                        quality: 1,
                    });
                    if (result.canceled || !result.assets[0]) return false;
                    imageUri = result.assets[0].uri;
                } else if (source === 'url' && value) {
                    // Download and process remote URL
                    const processed = await NoteImageService.processRemoteImage(noteId, value);
                    // Insert into editor and resolve
                    sendCommand('insertLocalImage', { imageId: processed.imageId });
                    const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                    sendCommand('resolveImages', { imageMap });
                    return true;
                }

                if (imageUri) {
                    const processed = await NoteImageService.processAndInsertImage(noteId, imageUri);
                    sendCommand('insertLocalImage', { imageId: processed.imageId });
                    const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                    sendCommand('resolveImages', { imageMap });
                    return true;
                }
                return false;
            } catch (err) {
                console.error('Failed to insert image:', err);
                return false;
            }
        }, [noteId, sendCommand]);

        const devEditorUrl = process.env.EXPO_PUBLIC_EDITOR_DEV_URL ?? 'http://192.168.7.15:5173';
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
                <ScrollView
                    ref={scrollViewRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 350 }}
                    keyboardShouldPersistTaps="handled"
                    onScroll={(e) => {
                        scrollOffsetY.current = e.nativeEvent.contentOffset.y;
                    }}
                    scrollEventThrottle={16}
                    onLayout={(e) => {
                        scrollHeight.current = e.nativeEvent.layout.height;
                    }}
                >
                    <WebView
                        allowFileAccess
                        ref={webViewRef}
                        source={source}
                        onMessage={handleMessage}
                        injectedJavaScriptBeforeContentLoaded={themeInjectionScript}
                        scrollEnabled={false}
                        keyboardDisplayRequiresUserAction={false}
                        hideKeyboardAccessoryView={true}
                        style={[styles.webView, { backgroundColor: colors.background, height: Math.max(editorHeight, 100), flex: 0 }]}
                        originWhitelist={['*']}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        allowsInlineMediaPlayback={true}
                        mixedContentMode="always"
                        contentInsetAdjustmentBehavior="never"
                        onShouldStartLoadWithRequest={(request) => {
                            const { url } = request;
                            // Never allow WebView to handle app deep links or external links.
                            // We route these through the React Native bridge.
                            if (url.startsWith('annota://')) {
                                return false;
                            }

                            if (url.startsWith('about:blank')) {
                                return true;
                            }

                            try {
                                const requestOrigin = new URL(url).origin;
                                const appOrigin = 'https://app.local';
                                const devOrigin = useDevEditor ? new URL(devEditorUrl).origin : null;

                                if (requestOrigin === appOrigin || (devOrigin && requestOrigin === devOrigin)) {
                                    return true;
                                }

                                // Allow YouTube iframe embeds
                                if (
                                    requestOrigin === 'https://www.youtube.com' ||
                                    requestOrigin === 'https://www.youtube-nocookie.com'
                                ) {
                                    return true;
                                }
                            } catch {
                                // Block malformed or unsupported URLs by default.
                            }

                            return false;
                        }}
                        onError={(syntheticEvent) => {
                            const { nativeEvent } = syntheticEvent;
                            console.warn('WebView error: ', nativeEvent);
                        }}
                    />
                </ScrollView>

                {showToolbar && renderToolbar && (
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
                        {renderToolbar({
                            editorState,
                            sendCommand,
                            onCommand: sendCommand,
                            toolbarHeight,
                            onDismissKeyboard: handleDismissKeyboard,
                            activePopup,
                            onActivePopupChange: (type) => {
                                setActivePopup(type);
                                handlePopupStateChange(!!type);
                            },
                            onPopupStateChange: handlePopupStateChange,
                            onInsertImage: handleInsertImage,
                            currentLatex,
                            blockData: tempBlockData,
                            onInsertMath: () => {
                                setCurrentLatex(null);
                                setActivePopup('math');
                                setIsPopupOpen(true);
                            }
                        })}
                    </View>
                )}


                {/* Full Screen Image Gallery — conditionally rendered by the host app via render props */}
                {renderImageGallery?.({
                    images: galleryImages,
                    initialIndex: galleryCurrentIndex,
                    visible: isGalleryVisible,
                    onClose: () => {
                        setIsGalleryVisible(false);
                        isGalleryVisibleRef.current = false;
                        onGalleryVisibilityChange?.(false);
                    }
                })}
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

