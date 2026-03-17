import { useSettingsStore } from '@annota/core';
import { NoteImageService } from '@annota/core/platform';
import editorHtml from '@annota/editor-core/dist/editor-html';
import { useKeyboard } from '@react-native-community/hooks';
import { useTheme } from '@react-navigation/native';
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
        const { keyboardHeight, keyboardShown } = useKeyboard();
        const { width, height } = useWindowDimensions();
        const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

        useEffect(() => {
            // iOS has 'Will' events that fire before animations. Android only has 'Did'.
            const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
            const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

            const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
            const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

            return () => {
                showSub.remove();
                hideSub.remove();
            };
        }, []);

        const sendMessage = useCallback((command: string, params: Record<string, any>) => {
            if (['openMathModal', 'openImageModal', 'openLinkModal', 'openYoutubeModal'].includes(command)) {
                switch (command) {
                    case 'openMathModal': setCurrentLatex(null); setActivePopup('math'); setIsPopupOpen(true); return;
                    case 'openImageModal': setActivePopup('image'); setIsPopupOpen(true); return;
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
                case 'openBlockMenu':
                    setBlockData(data);
                    setActivePopup(type === 'openImageMenu' ? 'imageMenu' : 'blockMenu');
                    setIsPopupOpen(true);
                    break;
                case 'mathSelected':
                    setCurrentLatex(data.latex);
                    setActivePopup('math');
                    setIsPopupOpen(true);
                    break;
                case 'imageSelected':
                    openGallery(data.images, data.currentIndex);
                    if (props.onImageSelected) {
                        props.onImageSelected(data);
                    }
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
            }
            handleCommonMessage(type, data);
        }, [handleCommonMessage, props, openGallery]);

        const { isReady, editorState, dispatchCommand, handleBridgeMessage } = useWebViewBridge({
            sendMessage,
            onMessage: onBridgeMessage
        });

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

        const handleInsertImage = useCallback(async (source: 'url' | 'library' | 'camera', value?: string) => {
            if (!noteId) return false;
            try {
                let imageUri: string | undefined;
                if (source === 'library') {
                    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
                    if (!result.canceled) imageUri = result.assets[0].uri;
                } else if (source === 'camera') {
                    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
                    if (!result.canceled) imageUri = result.assets[0].uri;
                } else if (source === 'url' && value) {
                    const processed = await NoteImageService.processRemoteImage(noteId, value);
                    const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                    dispatchCommand('insertLocalImage', { imageId: processed.imageId, src: imageMap[processed.imageId] });
                    return true;
                }

                if (imageUri) {
                    const processed = await NoteImageService.processAndInsertImage(noteId, imageUri);
                    const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                    dispatchCommand('insertLocalImage', { imageId: processed.imageId, src: imageMap[processed.imageId] });
                    return true;
                }
                return false;
            } catch (err) {
                return false;
            }
        }, [noteId, dispatchCommand]);


        useEffect(() => {
            // Only attempt to resolve once the WebView is fully booted up (isReady)
            if (isReady && initialContent) {
                const imageIds = extractImageIds(initialContent);
                if (imageIds.length > 0) {
                    NoteImageService.resolveImageSources(imageIds).then((imageMap: any) => {
                        if (Object.keys(imageMap).length > 0) {
                            dispatchCommand('resolveImages', { imageMap });
                        }
                    });
                }
            }
        }, [initialContent, isReady, dispatchCommand]);

        return (
            <View style={styles.container}>
                <ScrollView
                    ref={scrollViewRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 350 }}
                    onScroll={(e) => { scrollOffsetY.current = e.nativeEvent.contentOffset.y; }}
                    onLayout={(e) => { scrollHeight.current = e.nativeEvent.layout.height; }}
                >
                    {renderHeader?.()}
                    <WebView
                        ref={webViewRef}
                        originWhitelist={['*']}
                        hideKeyboardAccessoryView={true}
                        keyboardDisplayRequiresUserAction={false}
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
                    />
                </ScrollView>
                {(isKeyboardVisible || isPopupOpen) && renderToolbar &&
                    (<View style={[styles.toolbar, { bottom: keyboardHeight }]}>
                        {renderToolbar({
                            editorState,
                            sendCommand: dispatchCommand,
                            onCommand: dispatchCommand,
                            toolbarHeight,
                            onDismissKeyboard: () => { dispatchCommand('blur'); Keyboard.dismiss(); },
                            activePopup,
                            onActivePopupChange: (type) => { setActivePopup(type); setIsPopupOpen(!!type); },
                            onPopupStateChange: (isOpen) => { if (!isOpen) setIsPopupOpen(false); },
                            onInsertImage: handleInsertImage,
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
                {props.renderSlashCommandMenu && isKeyboardVisible && (
                    <View
                        style={[
                            styles.slashMenuContainer,
                            {
                                // Force height to 0 immediately when hiding
                                bottom: (isKeyboardVisible ? keyboardHeight : 0) +
                                    ((isKeyboardVisible || isPopupOpen) && renderToolbar ? toolbarHeight : 0)
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
