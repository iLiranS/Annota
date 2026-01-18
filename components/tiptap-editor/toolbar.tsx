import { useTheme } from '@react-navigation/native';
import React, { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';

import { HeadingLevel } from './color-palette';
import { ToolbarButton } from './toolbar-button';
import { PopupType, ToolbarPopup } from './toolbar-popup';
import type { EditorState } from './types';

interface EditorToolbarProps {
    editorState: EditorState;
    onCommand: (command: string, params?: Record<string, unknown>) => void;
    onDismissKeyboard: () => void;
    /** Callback to notify parent when popup opens/closes - helps keep toolbar visible */
    onPopupStateChange?: (isOpen: boolean) => void;
}

/**
 * Scrollable formatting toolbar for the TipTap editor.
 * Uses MaterialIcons and popup menus for grouped options.
 */
export function EditorToolbar({
    editorState,
    onCommand,
    onDismissKeyboard,
    onPopupStateChange
}: EditorToolbarProps) {
    const { dark, colors } = useTheme();
    const [activePopup, setActivePopup] = useState<PopupType>(null);

    const handleDismiss = () => {
        onDismissKeyboard();
        Keyboard.dismiss();
    };

    const openPopup = (type: PopupType) => {
        setActivePopup(type);
        onPopupStateChange?.(true);
    };

    const closePopup = () => {
        setActivePopup(null);
        onPopupStateChange?.(false);
    };

    // Check if any heading is active
    const isAnyHeadingActive =
        editorState.isHeading1 ||
        editorState.isHeading2 ||
        editorState.isHeading3 ||
        editorState.isHeading4 ||
        editorState.isHeading5 ||
        editorState.isHeading6;

    return (
        <>
            <View
                style={[
                    styles.toolbar,
                    {
                        backgroundColor: dark ? '#1C1C1E' : '#F2F2F7',
                        borderTopColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    },
                ]}
            >
                <View style={styles.toolbarContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.toolbarScrollContent}
                        keyboardShouldPersistTaps="always"
                    >
                        {/* Headings - Single button with popup (FIRST) */}
                        <ToolbarButton
                            label="H"
                            isActive={isAnyHeadingActive}
                            onPress={() => openPopup('headings')}
                        />

                        <View style={styles.separator} />

                        {/* Text Formatting (inline styles) */}
                        <ToolbarButton
                            label="B"
                            fontWeight="bold"
                            isActive={editorState.isBold}
                            onPress={() => onCommand('toggleBold')}
                        />
                        <ToolbarButton
                            label="I"
                            fontStyle="italic"
                            isActive={editorState.isItalic}
                            onPress={() => onCommand('toggleItalic')}
                        />
                        <ToolbarButton
                            label="U"
                            textDecoration="underline"
                            isActive={editorState.isUnderline}
                            onPress={() => onCommand('toggleUnderline')}
                        />
                        <ToolbarButton
                            icon="strikethrough-s"
                            isActive={editorState.isStrike}
                            onPress={() => onCommand('toggleStrike')}
                        />

                        <View style={styles.separator} />

                        {/* Text Color */}
                        <ToolbarButton
                            icon="format-color-text"
                            isActive={!!editorState.textColor}
                            onPress={() => openPopup('textColor')}
                            colorIndicator={editorState.textColor || undefined}
                        />

                        {/* Highlight */}
                        <ToolbarButton
                            icon="highlight"
                            isActive={!!editorState.highlightColor}
                            onPress={() => openPopup('highlight')}
                            colorIndicator={editorState.highlightColor || undefined}
                        />

                        <View style={styles.separator} />

                        {/* Lists */}
                        <ToolbarButton
                            icon="format-list-bulleted"
                            isActive={editorState.isBulletList}
                            onPress={() => onCommand('toggleBulletList')}
                        />
                        <ToolbarButton
                            icon="format-list-numbered"
                            isActive={editorState.isOrderedList}
                            onPress={() => onCommand('toggleOrderedList')}
                        />

                        <View style={styles.separator} />

                        {/* Code & Quote */}
                        <ToolbarButton
                            icon="code"
                            isActive={editorState.isCode}
                            onPress={() => onCommand('toggleCode')}
                        />
                        <ToolbarButton
                            icon="data-object"
                            isActive={editorState.isCodeBlock}
                            onPress={() => onCommand('toggleCodeBlock')}
                        />
                        <ToolbarButton
                            icon="format-quote"
                            isActive={editorState.isBlockquote}
                            onPress={() => onCommand('toggleBlockquote')}
                        />

                        <View style={styles.separator} />

                        {/* Links - Now using popup */}
                        <ToolbarButton
                            icon="link"
                            isActive={editorState.isLink}
                            onPress={() => openPopup('link')}
                        />

                        {/* Image */}
                        <ToolbarButton
                            icon="image"
                            onPress={() => openPopup('image')}
                        />

                        {/* YouTube */}
                        <ToolbarButton
                            icon="smart-display"
                            onPress={() => openPopup('youtube')}
                        />

                        <View style={styles.separator} />

                        {/* Undo/Redo */}
                        <ToolbarButton
                            icon="undo"
                            onPress={() => onCommand('undo')}
                            disabled={!editorState.canUndo}
                        />
                        <ToolbarButton
                            icon="redo"
                            onPress={() => onCommand('redo')}
                            disabled={!editorState.canRedo}
                        />
                    </ScrollView>

                    {/* Fixed dismiss button */}
                    <View style={styles.dismissButtonContainer}>
                        <View style={[styles.separator, { marginHorizontal: 4 }]} />
                        <ToolbarButton icon="keyboard-hide" onPress={handleDismiss} />
                    </View>
                </View>
            </View>

            {/* Popup Modals - rendered outside the toolbar layout */}
            {activePopup === 'headings' && (
                <ToolbarPopup
                    visible={true}
                    type="headings"
                    currentLevel={editorState.currentHeadingLevel}
                    onSelect={(level: HeadingLevel) => {
                        onCommand('toggleHeading', { level });
                        closePopup();
                    }}
                    onClose={closePopup}
                />
            )}

            {activePopup === 'highlight' && (
                <ToolbarPopup
                    visible={true}
                    type="highlight"
                    currentColor={editorState.highlightColor}
                    onSelect={(color: string) => {
                        onCommand('setHighlight', { color });
                        closePopup();
                    }}
                    onClear={() => {
                        onCommand('unsetHighlight');
                        closePopup();
                    }}
                    onClose={closePopup}
                />
            )}

            {activePopup === 'textColor' && (
                <ToolbarPopup
                    visible={true}
                    type="textColor"
                    currentColor={editorState.textColor}
                    onSelect={(color: string) => {
                        onCommand('setColor', { color });
                        closePopup();
                    }}
                    onClear={() => {
                        onCommand('unsetColor');
                        closePopup();
                    }}
                    onClose={closePopup}
                />
            )}

            {activePopup === 'youtube' && (
                <ToolbarPopup
                    visible={true}
                    type="youtube"
                    onSubmit={(url: string) => {
                        onCommand('setYoutubeVideo', { src: url });
                        closePopup();
                    }}
                    onClose={closePopup}
                />
            )}

            {activePopup === 'link' && (
                <ToolbarPopup
                    visible={true}
                    type="link"
                    currentUrl={editorState.linkHref}
                    onSubmit={(url: string) => {
                        onCommand('setLink', { href: url });
                        closePopup();
                    }}
                    onRemove={() => {
                        onCommand('unsetLink');
                        closePopup();
                    }}
                    onClose={closePopup}
                />
            )}

            {activePopup === 'image' && (
                <ToolbarPopup
                    visible={true}
                    type="image"
                    onSubmit={(url: string) => {
                        onCommand('setImage', { src: url });
                        closePopup();
                    }}
                    onClose={closePopup}
                />
            )}
        </>
    );
}

const styles = StyleSheet.create({
    toolbar: {
        borderTopWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    toolbarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    toolbarScrollContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingRight: 8,
    },
    dismissButtonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    separator: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(128,128,128,0.3)',
        marginHorizontal: 6,
    },
});
