import { useSettingsStore } from '@annota/core';
import { NoteFileService } from '@annota/core/platform';
import { ensureEditorHtmlCache, editorCacheFile, getIsEditorHtmlCached, webViewSourceFallback } from './shared/editor-cache.native';

import { useTheme } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Keyboard, Linking, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useEditorBridgeHandlers } from './hooks/useEditorBridgeHandlers';
import { useSharedEditorUI } from './hooks/useSharedEditorUI';
import { useWebViewBridge } from './hooks/useWebViewBridge';
import { PopupType, TipTapEditorProps, TipTapEditorRef } from './shared/types';
import { extractImageIds } from './shared/image-utils';
import { insertProcessedFile, insertRemoteFile } from './shared/file-insert-utils';


export const EditorNative = React.memo(forwardRef<TipTapEditorRef, TipTapEditorProps>(
    (props, ref) => {
        const {
            initialContent = '',
            onContentChange,
            placeholder = 'Start typing...',
            autofocus = false,
            contentPaddingTop = 0,
            noteId,
            renderHeader,
            renderToolbar,
            isDark: propIsDark,
            colors: propColors,
            editable: editable = true,
            scrollY,
            onEditorReady,
        } = props;
        const theme = useTheme();
        const colors = propColors || theme.colors;
        const dark = propIsDark ?? theme.dark;
        const { editor: editorSettings } = useSettingsStore();
        const webViewRef = useRef<WebView>(null);
        const scrollViewRef = useRef<ScrollView>(null);
        const scrollOffsetY = useRef(0);
        const scrollHeight = useRef(0);
        const webViewY = useRef(0);
        const [editorHeight, setEditorHeight] = useState<number>(100);
        const [isPopupOpen, setIsPopupOpen] = useState(false);
        const [activePopup, setActivePopup] = useState<PopupType>(null);
        const [toolbarHeight, setToolbarHeight] = useState(50);
        const [currentLatex, setCurrentLatex] = useState<string | null>(null);
        const [isBlockMath, setIsBlockMath] = useState<boolean>(false);
        const { gallery, openGallery, closeGallery, setGalleryIndex } = useSharedEditorUI(props.onGalleryVisibilityChange);
        const contentResolverRef = useRef<((html: string) => void) | null>(null);
        const [blockData, setBlockData] = useState<any>(null);
        const { width, height } = useWindowDimensions();

        useEffect(() => {
            if (!getIsEditorHtmlCached()) {
                ensureEditorHtmlCache();
            }
        }, []);

        const webViewSource = useMemo(() => {
            if (getIsEditorHtmlCached()) {
                return { uri: editorCacheFile.uri };
            }
            return webViewSourceFallback;
        }, []);

        const [keyboardParams, setKeyboardParams] = useState({ isVisible: false, height: 0 });
        const { isVisible: isKeyboardVisible, height: keyboardHeight } = keyboardParams;

        useEffect(() => {
            // iOS has 'Will' events that fire before animations. Android only has 'Did'.
            const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
            const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

            const showSub = Keyboard.addListener(showEvent, (e) => {
                const kh = e.endCoordinates?.height || 0;
                setKeyboardParams({ isVisible: true, height: kh });
            });
            const hideSub = Keyboard.addListener(hideEvent, () => {
                // Don't reset height to 0 immediately, just toggle visibility. 
                // This stops the toolbar from crashing down instantly before the animation finishes.
                setKeyboardParams((prev) => ({ ...prev, isVisible: false }));
            });

            return () => {
                showSub.remove();
                hideSub.remove();
            };
        }, []);

        const sendMessage = useCallback((command: string, params: Record<string, any>) => {
            if (['openMathModal', 'openFileModal', 'openLinkModal', 'openYoutubeModal'].includes(command)) {
                switch (command) {
                    case 'openMathModal': setCurrentLatex(null); setIsBlockMath(false); setActivePopup('math'); setIsPopupOpen(true); return;
                    case 'openFileModal': setActivePopup('file'); setIsPopupOpen(true); return;
                    case 'openLinkModal': setActivePopup('link'); setIsPopupOpen(true); return;
                    case 'openYoutubeModal': setActivePopup('youtube'); setIsPopupOpen(true); return;
                }
            }
            const paramsStr = JSON.stringify(params).replace(/'/g, "\\'");
            const js = `try { window.handleCommand && window.handleCommand('${command}', ${paramsStr}); } catch(e) {}; true;`;
            webViewRef.current?.injectJavaScript(js);
        }, []);



        const { handleBridgeMessage: handleCommonMessage } = useEditorBridgeHandlers({
            ...props,
            sendMessage,
            isDark: dark,
            colors,
            editorSettings,
            contentResolver: contentResolverRef,
            onOpenLink: props.onOpenLink || ((href) => Linking.openURL(href)),
            onHeightChange: (h) => setEditorHeight(h),
        });



        const onBridgeMessage = useCallback((type: string, data: any) => {
            switch (type) {
                case 'openImageMenu':
                case 'openOpenFileMenu':
                case 'openBlockMenu':
                    setBlockData(data);
                    setActivePopup(type === 'openBlockMenu' ? 'blockMenu' : 'fileMenu');
                    setIsPopupOpen(true);
                    break;
                case 'scrollToNative':
                    if (scrollViewRef.current && typeof data.y === 'number') {
                        scrollViewRef.current.scrollTo({ y: data.y, animated: true });
                    }
                    break;
                case 'filePasted':
                    (async () => {
                        if (!noteId) return;
                        try {
                            const processed = await NoteFileService.processAndInsertFile(noteId, data.localPath, 'application/pdf');
                            sendMessage('insertFileAttachment', {
                                fileId: processed.fileId,
                                fileName: processed.fileName,
                                fileSize: processed.fileSize,
                                localPath: processed.localPath,
                                mimeType: processed.mimeType
                            });
                        } catch (err) {
                            console.error("[EditorNative] Failed to process pasted PDF:", err);
                        }
                    })();
                    break;
                case 'mathSelected':
                    setCurrentLatex(data.latex);
                    setIsBlockMath(!!data.isBlock);
                    setActivePopup('math');
                    setIsPopupOpen(true);
                    break;
                case 'imageSelected':
                    // 1. Tell the WebView to drop focus
                    sendMessage('blur', {});
                    // 2. Tell React Native to force the keyboard down
                    Keyboard.dismiss();

                    openGallery(data.images, data.currentIndex);
                    if (props.onImageSelected) {
                        props.onImageSelected(data);
                    }
                    break;
                case 'openFile':
                    (async () => {
                        try {
                            const { FileService, getPlatformAdapters } = require('@annota/core/platform');
                            const absoluteUri = await FileService.resolveLocalUri(data.localPath);
                            const adapters = getPlatformAdapters();
                            await adapters.fileSystem.openFile(absoluteUri, data.mimeType);
                        } catch (err) {
                            console.error("[EditorNative] Failed to open file:", err);
                        }
                    })();
                    break;
                case 'slashCommand':
                    if (props.onSlashCommand) {
                        props.onSlashCommand({
                            ...data,
                            // Restore the function API for the parent component
                            clientRect: data.clientRect ? () => data.clientRect : undefined
                        });
                    }
                    break;
                case 'tagCommand':
                    if (props.onTagCommand) {
                        props.onTagCommand({
                            ...data,
                            clientRect: data.clientRect ? () => data.clientRect : undefined
                        });
                    }
                    break;
                case 'noteLinkCommand':
                    if (props.onNoteLinkCommand) {
                        props.onNoteLinkCommand({
                            ...data,
                            clientRect: data.clientRect ? () => data.clientRect : undefined
                        });
                    }
                    break;
                case 'cursorPosition':
                    // --------------------------
                    // If the cursor is at the very top of the document (index < 10), it's NOT a phantom coordinate.
                    // The RTL bug typically happens for trailing spaces at the end of lines, often deep in the doc.
                    if (data.top < 10 && scrollOffsetY.current > 150 && (data.headIndex || 0) > 10) {
                        return;
                    }
                    // --------------------------

                    // Account for the WebView's vertical offset within the ScrollView
                    const absoluteTop = data.top + webViewY.current;
                    const absoluteBottom = data.bottom + webViewY.current;

                    const isTopHandle = data.isTopHandle ?? true;
                    const isBottomHandle = data.isBottomHandle ?? true;

                    // Accurately calculate what is blocking the bottom of the screen
                    const bottomObstruction = isKeyboardVisible ? (keyboardHeight + toolbarHeight) : 0;
                    const visibleSpace = height - bottomObstruction;

                    // Slimmer buffers for auto-scroll to avoid "fighting" the user's manual scroll
                    const bottomBuffer = 80;
                    const topBuffer = 60;

                    // If actively dragging the BOTTOM handle, only push up if it dips below the screen
                    if (isBottomHandle && absoluteBottom > scrollOffsetY.current + visibleSpace - bottomBuffer) {
                        scrollViewRef.current?.scrollTo({
                            y: absoluteBottom - visibleSpace + bottomBuffer,
                            animated: false
                        });
                    }
                    // If actively dragging the TOP handle, only pull down if it goes above the screen
                    else if (isTopHandle && absoluteTop < scrollOffsetY.current + topBuffer) {
                        scrollViewRef.current?.scrollTo({
                            y: Math.max(0, absoluteTop - topBuffer),
                            animated: false
                        });
                    }
                    break;
            }
            handleCommonMessage(type, data);
        }, [handleCommonMessage, props, openGallery, isKeyboardVisible, keyboardHeight, toolbarHeight, height]);

        const { isReady, isEditorReady, editorState, dispatchCommand, handleBridgeMessage } = useWebViewBridge({
            sendMessage,
            onMessage: onBridgeMessage
        });

        useEffect(() => {
            if (isEditorReady && onEditorReady) {
                onEditorReady();
            }
        }, [isEditorReady, onEditorReady]);

        // Sync settings when they change
        useEffect(() => {
            if (isReady) {
                sendMessage('setOptions', {
                    isDark: dark,
                    colors,
                    editable,
                    fontSize: editorSettings.fontSize,
                    lineSpacing: editorSettings.lineSpacing,
                    paragraphSpacing: editorSettings.paragraphSpacing,
                    fontFamily: editorSettings.fontFamily,
                    noteWidth: editorSettings.noteWidth,
                    direction: editorSettings.direction,
                    defaultCodeLanguage: editorSettings.defaultCodeLanguage,
                    spellcheck: editorSettings.spellcheck,
                    autocorrect: editorSettings.autocorrect,
                    autocapitalize: editorSettings.autocapitalize,
                    autocomplete: editorSettings.autocomplete,
                    numberedLines: editorSettings.numberedLines !== undefined ? editorSettings.numberedLines : true,
                    placeholder,
                    autofocus,
                });
            }
        }, [isReady, dark, colors, editable, editorSettings, sendMessage, placeholder, autofocus]);


        useImperativeHandle(ref, () => ({
            getContent: () => new Promise((resolve) => {
                contentResolverRef.current = resolve;
                dispatchCommand('getContent');
            }),
            setContent: (content) => dispatchCommand('setContent', { content }),
            focus: () => dispatchCommand('focus'),
            blur: () => dispatchCommand('blur'),
            onCommand: dispatchCommand,
            search: (term) => dispatchCommand('search', { term }),
            searchNext: () => dispatchCommand('searchNext'),
            searchPrev: () => dispatchCommand('searchPrev'),
            clearSearch: () => dispatchCommand('clearSearch'),
            scrollToElement: (id) => dispatchCommand('scrollToElement', { id }),
            scrollToPosition: (position) => {},
            getSelection: () => ({
                text: editorState.selectedText,
                html: editorState.selectedHtml,
                range: editorState.selectionRange
            }),
        }), [dispatchCommand, editorState.selectedText, editorState.selectedHtml, editorState.selectionRange]);

        const handleInsertFile = useCallback(async (source: 'url' | 'library' | 'camera' | 'document', value?: string) => {
            if (!noteId) return false;
            try {
                let fileUri: string | undefined;
                if (source === 'library') {
                    const permission = await ImagePicker.getMediaLibraryPermissionsAsync();
                    let granted = permission.granted;
                    let canAskAgain = permission.canAskAgain;

                    if (!granted && canAskAgain) {
                        const requestResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        granted = requestResult.granted;
                        canAskAgain = requestResult.canAskAgain;
                    }

                    if (!granted) {
                        Alert.alert(
                            "Permission Required",
                            "Please enable photos/library access in your system settings to insert images from your gallery.",
                            [
                                { text: "Cancel", style: "cancel" },
                                { text: "Open Settings", onPress: () => Linking.openSettings() }
                            ]
                        );
                        return false;
                    }

                    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
                    if (!result.canceled) fileUri = result.assets[0].uri;
                } else if (source === 'camera') {
                    const permission = await ImagePicker.getCameraPermissionsAsync();
                    let granted = permission.granted;
                    let canAskAgain = permission.canAskAgain;

                    if (!granted && canAskAgain) {
                        const requestResult = await ImagePicker.requestCameraPermissionsAsync();
                        granted = requestResult.granted;
                        canAskAgain = requestResult.canAskAgain;
                    }

                    if (!granted) {
                        Alert.alert(
                            "Permission Required",
                            "Please enable camera access in your system settings to take photos.",
                            [
                                { text: "Cancel", style: "cancel" },
                                { text: "Open Settings", onPress: () => Linking.openSettings() }
                            ]
                        );
                        return false;
                    }

                    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
                    if (!result.canceled) fileUri = result.assets[0].uri;
                } else if (source === 'document') {
                    const result = await DocumentPicker.getDocumentAsync({
                        type: ['application/pdf', 'image/*'],
                        copyToCacheDirectory: true
                    });
                    if (!result.canceled) {
                        fileUri = result.assets[0].uri;
                    }
                } else if (source === 'url' && value) {
                    const insertImage = ({ imageId, src }: { imageId: string; src: string }) => {
                        dispatchCommand('insertLocalImage', { imageId, src });
                    };
                    const insertAttachment = (params: any) => {
                        dispatchCommand('insertFileAttachment', params);
                    };
                    await insertRemoteFile(noteId, value, { insertImage, insertAttachment });
                    return true;
                }

                if (fileUri) {
                    const insertImage = ({ imageId, src }: { imageId: string; src: string }) => {
                        dispatchCommand('insertLocalImage', { imageId, src });
                    };
                    const insertAttachment = (params: any) => {
                        dispatchCommand('insertFileAttachment', params);
                    };
                    await insertProcessedFile(noteId, fileUri, { insertImage, insertAttachment });
                    return true;
                }
                return false;
            } catch (err) {
                console.error("[EditorNative] File insert failed:", err);
                return false;
            }
        }, [noteId, dispatchCommand]);


        useEffect(() => {
            // Only attempt to resolve once the editor is fully initialized
            if (isEditorReady && initialContent) {
                const imageIds = extractImageIds(initialContent);
                if (imageIds.length > 0) {
                    NoteFileService.resolveFileSources(imageIds).then((fileMap: any) => {
                        if (Object.keys(fileMap).length > 0) {
                            dispatchCommand('resolveImages', { imageMap: fileMap });
                        }
                    });
                }
            }
        }, [initialContent, isEditorReady, dispatchCommand]);

        return (
            <View style={styles.container}>
                <Animated.ScrollView
                    ref={scrollViewRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 350 }}
                    scrollEventThrottle={16}
                    onScroll={Animated.event(
                        [{ nativeEvent: { contentOffset: { y: scrollY || new Animated.Value(0) } } }],
                        {
                            useNativeDriver: true,
                            listener: (e: any) => {
                                scrollOffsetY.current = e.nativeEvent.contentOffset.y;
                                props.onScrollNative?.(e);
                            }
                        }
                    )}
                    onLayout={(e) => { scrollHeight.current = e.nativeEvent.layout.height; }}
                >
                    {renderHeader?.()}
                    <WebView
                        ref={webViewRef}
                        originWhitelist={['*']}
                        hideKeyboardAccessoryView={true}
                        allowFileAccessFromFileURLs={true}
                        allowUniversalAccessFromFileURLs={true}
                        mixedContentMode="always"
                        source={webViewSource}
                        onMessage={(event) => {
                            try {
                                const data = JSON.parse(event.nativeEvent.data);
                                handleBridgeMessage(data);
                            } catch (e) { }
                        }}
                        onLayout={(e) => {
                            webViewY.current = e.nativeEvent.layout.y;
                        }}
                        style={[styles.webView, { height: Math.max(editorHeight, 100) }]}
                        scrollEnabled={false}
                        keyboardDisplayRequiresUserAction={false}
                        pointerEvents={editable ? 'auto' : 'none'}
                    />
                    {editable && (
                        <Pressable
                            style={{ flex: 1, minHeight: 250 }}
                            onPress={() => dispatchCommand('focus')}
                        />
                    )}
                </Animated.ScrollView>
                {renderToolbar && editable && (
                    <View
                        style={[
                            styles.toolbar,
                            {
                                // Only push it up on iOS. Android resizes natively.
                                bottom: Platform.OS === 'ios' ? keyboardHeight : 0,
                                // Hide it visually and disable touches when keyboard/popup is closed
                                opacity: (isKeyboardVisible || isPopupOpen) ? 1 : 0,
                                pointerEvents: (isKeyboardVisible || isPopupOpen) ? 'auto' : 'none'
                            }
                        ]}
                    >
                        {renderToolbar({
                            editorState,
                            sendCommand: dispatchCommand,
                            onCommand: (cmd, params) => {
                                if (cmd === 'copyBlockLink' && props.onCopyBlockLink) {
                                    props.onCopyBlockLink(params?.id);
                                } else {
                                    dispatchCommand(cmd, params);
                                }
                            }, toolbarHeight,
                            onDismissKeyboard: () => { dispatchCommand('blur'); Keyboard.dismiss(); },
                            activePopup,
                            onActivePopupChange: (type) => {
                                setActivePopup(type);
                                setIsPopupOpen(!!type);
                                if (!type) {
                                    setCurrentLatex(null);
                                    setIsBlockMath(false);
                                }
                            },
                            onPopupStateChange: (isOpen) => {
                                if (!isOpen) {
                                    setIsPopupOpen(false);
                                    setCurrentLatex(null);
                                    setIsBlockMath(false);
                                }
                            },
                            onInsertFile: handleInsertFile,
                            currentLatex,
                            isBlockMath,
                            blockData,
                            onInsertMath: () => {
                                Keyboard.dismiss();
                                setCurrentLatex(null);
                                setIsBlockMath(false);
                                setActivePopup('math');
                                setIsPopupOpen(true);
                            },
                            isKeyboardVisible
                        })}
                    </View>
                )}
                {gallery.isVisible && props.renderImageGallery?.({
                    images: gallery.images,
                    initialIndex: gallery.currentIndex,
                    visible: true,
                    onClose: closeGallery,
                    onNavigate: setGalleryIndex
                })}
                {props.renderSlashCommandMenu && (
                    <View
                        style={[
                            styles.slashMenuContainer,
                            {
                                bottom: Platform.OS === 'ios' ? (keyboardHeight + toolbarHeight) : toolbarHeight,
                                opacity: isKeyboardVisible ? 1 : 0,
                                pointerEvents: isKeyboardVisible ? 'auto' : 'none'
                            }
                        ]}
                    >
                        {props.renderSlashCommandMenu()}
                    </View>
                )}
            </View>
        );
    }
));

const styles = StyleSheet.create({
    container: { flex: 1 },
    webView: { flex: 0, backgroundColor: 'transparent' },
    toolbar: { position: 'absolute', left: 0, right: 0 },
    slashMenuContainer: { position: 'absolute', left: 0, right: 0, zIndex: 100 }
});

EditorNative.displayName = 'EditorNative';
export default EditorNative;
