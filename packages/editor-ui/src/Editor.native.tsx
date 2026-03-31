import { useSettingsStore } from '@annota/core';
import { NoteFileService } from '@annota/core/platform';
import editorHtml from '@annota/editor-core/dist/editor-html';

import { useTheme } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, Linking, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useEditorBridgeHandlers } from './hooks/useEditorBridgeHandlers';
import { useSharedEditorUI } from './hooks/useSharedEditorUI';
import { useWebViewBridge } from './hooks/useWebViewBridge';
import { PopupType, TipTapEditorProps, TipTapEditorRef } from './shared/types';

function extractImageIds(html: string): string[] {
    const regex = /data-image-id\s*=\s*(["'])(.*?)\1/gi;
    const ids: string[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        const id = match[2];
        if (!id.startsWith('temp-')) {
            ids.push(id);
        }
    }
    return ids;
}

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
            editable = true,
        } = props;
        const theme = useTheme();
        const colors = propColors || theme.colors;
        const dark = propIsDark ?? theme.dark;
        const { editor: editorSettings } = useSettingsStore();
        const webViewRef = useRef<WebView>(null);
        const scrollViewRef = useRef<ScrollView>(null);
        const scrollOffsetY = useRef(0);
        const scrollHeight = useRef(0);
        const [editorHeight, setEditorHeight] = useState<number>(100);
        const [isPopupOpen, setIsPopupOpen] = useState(false);
        const [activePopup, setActivePopup] = useState<PopupType>(null);
        const [toolbarHeight, setToolbarHeight] = useState(50);
        const [currentLatex, setCurrentLatex] = useState<string | null>(null);
        const { gallery, openGallery, closeGallery, setGalleryIndex } = useSharedEditorUI(props.onGalleryVisibilityChange);
        const contentResolverRef = useRef<((html: string) => void) | null>(null);
        const [blockData, setBlockData] = useState<any>(null);
        const { width, height } = useWindowDimensions();
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
                    case 'openMathModal': setCurrentLatex(null); setActivePopup('math'); setIsPopupOpen(true); return;
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
                case 'mathSelected':
                    setCurrentLatex(data.latex);
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
                    if (!isKeyboardVisible) return;

                    // --- THE RTL BUG SHIELD ---
                    // WebKit's RTL bug causes trailing spaces to report their position as `top: 0`.
                    // If the WebView tells us the cursor is at the very top of the document, 
                    // but the user's screen is scrolled down further than 150px, it's a phantom coordinate.
                    // We simply block the scroll so the screen doesn't violently jump up.
                    if (data.top < 10 && scrollOffsetY.current > 150) {
                        return;
                    }
                    // --------------------------

                    // Accurately calculate what is blocking the bottom of the screen
                    const bottomObstruction = isKeyboardVisible ? (keyboardHeight + toolbarHeight) : 0;
                    const visibleSpace = height - bottomObstruction;

                    // Massive safe margins so the cursor rests comfortably in the middle-lower screen
                    const bottomBuffer = 140;
                    const topBuffer = 80;

                    // If cursor is dipping too close to the toolbar, push it up
                    if (data.bottom > scrollOffsetY.current + visibleSpace - bottomBuffer) {
                        scrollViewRef.current?.scrollTo({
                            y: data.bottom - visibleSpace + bottomBuffer,
                            animated: true
                        });
                    }
                    // If cursor is hiding under the top header, pull it down
                    else if (data.top < scrollOffsetY.current + topBuffer) {
                        scrollViewRef.current?.scrollTo({
                            y: Math.max(0, data.top - topBuffer),
                            animated: true
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

        // Sync settings when they change
        useEffect(() => {
            if (isReady) {
                sendMessage('setOptions', {
                    isDark: dark,
                    colors,
                    fontSize: editorSettings.fontSize,
                    lineSpacing: editorSettings.lineSpacing,
                    paragraphSpacing: editorSettings.paragraphSpacing,
                    fontFamily: editorSettings.fontFamily,
                    noteWidth: editorSettings.noteWidth,
                    direction: editorSettings.direction,
                    defaultCodeLanguage: editorSettings.defaultCodeLanguage,
                });
            }
        }, [isReady, dark, colors, editorSettings, sendMessage]);


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
        }), [dispatchCommand]);

        const handleInsertFile = useCallback(async (source: 'url' | 'library' | 'camera' | 'document', value?: string) => {
            if (!noteId) return false;
            try {
                let fileUri: string | undefined;
                if (source === 'library') {
                    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
                    if (!result.canceled) fileUri = result.assets[0].uri;
                } else if (source === 'camera') {
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

                    const processed = await NoteFileService.processRemoteFile(noteId, value);
                    const fileMap = await NoteFileService.resolveFileSources([processed.fileId]);
                    if (processed.mimeType === 'application/pdf') {
                        dispatchCommand('insertFileAttachment', {
                            fileId: processed.fileId,
                            fileName: processed.fileName,
                            fileSize: processed.fileSize,
                            localPath: processed.localPath,
                            mimeType: processed.mimeType
                        });
                    } else {
                        dispatchCommand('insertLocalImage', { imageId: processed.fileId, src: fileMap[processed.fileId] });
                    }
                    return true;
                }

                if (fileUri) {
                    const processed = await NoteFileService.processAndInsertFile(noteId, fileUri);
                    const fileMap = await NoteFileService.resolveFileSources([processed.fileId]);
                    if (processed.mimeType === 'application/pdf') {
                        dispatchCommand('insertFileAttachment', {
                            fileId: processed.fileId,
                            fileName: processed.fileName,
                            fileSize: processed.fileSize,
                            localPath: processed.localPath,
                            mimeType: processed.mimeType
                        });
                    } else {
                        dispatchCommand('insertLocalImage', { imageId: processed.fileId, src: fileMap[processed.fileId] });
                    }
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
                <ScrollView
                    ref={scrollViewRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 350 }}
                    scrollEventThrottle={16}
                    onScroll={(e) => { scrollOffsetY.current = e.nativeEvent.contentOffset.y; }}
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
                        source={{ html: editorHtml, baseUrl: 'https://app.local' }}
                        onMessage={(event) => {
                            try {
                                const data = JSON.parse(event.nativeEvent.data);
                                handleBridgeMessage(data);
                            } catch (e) { }
                        }}
                        style={[styles.webView, { height: Math.max(editorHeight, 100) }]}
                        scrollEnabled={false}
                        keyboardDisplayRequiresUserAction={false}
                    />
                </ScrollView>
                {renderToolbar && (
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
                            onActivePopupChange: (type) => { setActivePopup(type); setIsPopupOpen(!!type); },
                            onPopupStateChange: (isOpen) => { if (!isOpen) setIsPopupOpen(false); },
                            onInsertFile: handleInsertFile,
                            currentLatex,
                            blockData,
                            onInsertMath: () => { setActivePopup('math'); setIsPopupOpen(true); }
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
