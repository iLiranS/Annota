import { useTheme } from '@react-navigation/native';
import React, { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';

import { copyFileToClipboardMobile } from '@/utils/clipboard';
import { HeadingLevel } from '@annota/core';
import { FileService } from '@annota/core/platform';
import type { PopupType, ToolbarRenderProps } from '@annota/editor-ui';
import { ToolbarButton } from './toolbar-button';
import { ToolbarPopup } from './toolbar-popup';

interface EditorToolbarProps extends ToolbarRenderProps { }

/**
 * Scrollable formatting toolbar for the TipTap editor.
 * Uses MaterialIcons and popup menus for grouped options.
 */
export function EditorToolbar({
    editorState,
    onCommand,
    onDismissKeyboard,
    activePopup,
    onActivePopupChange,
    onPopupStateChange,

    currentLatex,
    blockData,
    onInsertMath,
    onInsertFile,
}: EditorToolbarProps) {
    const { dark, colors } = useTheme();
    const [isLoading, setIsLoading] = useState(false);

    const handleDismiss = () => {
        onDismissKeyboard();
        Keyboard.dismiss();
    };

    const openPopup = (type: PopupType) => {
        onActivePopupChange(type);
        onPopupStateChange?.(true);
    };

    const closePopup = () => {
        if (isLoading) return; // Prevent closing while picking/uploading
        onActivePopupChange(null);
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
                        backgroundColor: colors.background,
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
                            isActive={false}
                            onPress={() => openPopup('textColor')}
                            colorIndicator={editorState.textColor || undefined}
                        />

                        {/* Highlight */}
                        <ToolbarButton
                            icon="border-color"
                            isActive={false}
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
                        <ToolbarButton
                            icon="check-box"
                            isActive={editorState.isTaskList}
                            onPress={() => onCommand('toggleTaskList')}
                        />

                        {/* Tab In/Out for nested lists */}
                        <ToolbarButton
                            icon="format-indent-increase"
                            onPress={() => onCommand('sinkListItem')}
                            disabled={!editorState.canSinkListItem}
                        />
                        <ToolbarButton
                            icon="format-indent-decrease"
                            onPress={() => onCommand('liftListItem')}
                            disabled={!editorState.canLiftListItem}
                        />

                        <View style={styles.separator} />

                        {/* Code & Quote */}
                        <ToolbarButton
                            icon="code"
                            isActive={editorState.isCode}
                            onPress={() => onCommand('toggleCode')}
                        />
                        <ToolbarButton
                            icon='terminal'
                            isActive={editorState.isCodeBlock}
                            onPress={() => onCommand('toggleCodeBlock')}
                        />
                        <ToolbarButton
                            icon="format-quote"
                            isActive={editorState.isBlockquote}
                            onPress={() => onCommand('toggleBlockquote')}
                        />

                        {/* Collapsible Section */}
                        <ToolbarButton
                            icon='post-add'
                            isActive={editorState.isDetails}
                            onPress={() => onCommand('toggleDetails')}
                        />



                        {/* Math Equation */}
                        <ToolbarButton
                            icon="functions"
                            onPress={() => onInsertMath?.()}
                        />

                        <View style={styles.separator} />

                        {/* Links - Now using popup */}
                        <ToolbarButton
                            icon="link"
                            isActive={editorState.isLink}
                            onPress={() => openPopup('link')}
                        />

                        {/* File */}
                        <ToolbarButton
                            icon="attach-file"
                            onPress={() => openPopup('file')}
                        />

                        {/* YouTube */}
                        <ToolbarButton
                            icon="smart-display"
                            onPress={() => openPopup('youtube')}
                        />

                        {/* Table - opens popup when in table, inserts new one when not */}
                        <ToolbarButton
                            icon="table-chart"
                            isActive={editorState.isInTable}
                            onPress={() => {
                                if (editorState.isInTable) {
                                    openPopup('table');
                                } else {
                                    onCommand('insertTable', { rows: 3, cols: 3, withHeaderRow: false });
                                }
                            }}
                        />

                        <ToolbarButton
                            icon="account-tree"
                            onPress={() => onCommand('insertMermaid')}
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
                    onCopyLink={editorState.currentHeadingId ? () => {
                        onCommand('copyBlockLink', { id: editorState.currentHeadingId });
                        closePopup();
                    } : undefined}
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
                    selectedText={editorState.selectedText}
                    onSubmit={(url: string, title?: string) => {
                        onCommand('setLink', { href: url, title });
                        closePopup();
                    }}
                    onRemove={() => {
                        onCommand('unsetLink');
                        closePopup();
                    }}
                    onClose={closePopup}
                />
            )}

            {activePopup === 'file' && (
                <ToolbarPopup
                    visible={true}
                    type="file"
                    isLoading={isLoading}
                    onSubmit={async (url: string) => {
                        setIsLoading(true);
                        try {
                            const success = await onInsertFile?.('url', url);
                            if (success) closePopup();
                        } catch (error) {
                            console.error('File upload failed:', error);
                        } finally {
                            setIsLoading(false);
                        }
                    }}
                    onPickFromLibrary={async () => {
                        setIsLoading(true);
                        try {
                            const success = await onInsertFile?.('library');
                            if (success) closePopup();
                        } catch (error) {
                            console.error('File pick failed:', error);
                        } finally {
                            setIsLoading(false);
                        }
                    }}
                    onPickDocument={async () => {
                        setIsLoading(true);
                        try {
                            const success = await onInsertFile?.('document');
                            if (success) closePopup();
                        } catch (error) {
                            console.error('Document pick failed:', error);
                        } finally {
                            setIsLoading(false);
                        }
                    }}
                    onTakePhoto={async () => {
                        setIsLoading(true);
                        try {
                            const success = await onInsertFile?.('camera');
                            if (success) closePopup();
                        } catch (error) {
                            console.error('Take photo failed:', error);
                        } finally {
                            setIsLoading(false);
                        }
                    }}
                    onClose={closePopup}
                />
            )}



            {activePopup === 'codeLanguage' && (
                <ToolbarPopup
                    visible={true}
                    type="codeLanguage"
                    currentLanguage={editorState.currentCodeLanguage}
                    onSelect={(language: string) => {
                        if (blockData?.pos !== undefined) {
                            onCommand('setNodeSelection', { pos: blockData.pos });
                        }
                        onCommand('setCodeBlockLanguage', { language, pos: blockData?.pos });
                        closePopup();
                    }}
                    onClose={closePopup}
                />
            )}

            {activePopup === 'table' && (
                <ToolbarPopup
                    visible={true}
                    type="table"
                    canAddRowBefore={editorState.canAddRowBefore}
                    canAddRowAfter={editorState.canAddRowAfter}
                    canAddColumnBefore={editorState.canAddColumnBefore}
                    canAddColumnAfter={editorState.canAddColumnAfter}
                    canDeleteRow={editorState.canDeleteRow}
                    canDeleteColumn={editorState.canDeleteColumn}
                    canDeleteTable={editorState.canDeleteTable}
                    onCommand={(command: string, params?: Record<string, unknown>) => {
                        onCommand(command, params);
                    }}
                    onClose={closePopup}
                />
            )}

            {activePopup === 'math' && (
                <ToolbarPopup
                    visible={true}
                    type="math"
                    currentLatex={currentLatex || null}
                    onSubmit={(latex: string) => {
                        onCommand('setMath', { latex });
                        closePopup();
                    }}
                    onClose={closePopup}
                />
            )}

            {activePopup === 'detailsBackground' && (
                <ToolbarPopup
                    visible={true}
                    type="detailsBackground"
                    currentColor={editorState.detailsBackgroundColor}
                    onSelect={(color: string) => {
                        if (blockData?.pos !== undefined) {
                            onCommand('setNodeSelection', { pos: blockData.pos });
                        }
                        onCommand('setDetailsBackground', { color, pos: blockData?.pos });
                        closePopup();
                    }}
                    onClear={() => {
                        if (blockData?.pos !== undefined) {
                            onCommand('setNodeSelection', { pos: blockData.pos });
                        }
                        onCommand('unsetDetailsBackground', { pos: blockData?.pos });
                        closePopup();
                    }}
                    onClose={closePopup}
                />
            )}

            {activePopup === 'blockMenu' && blockData && (
                <ToolbarPopup
                    visible={true}
                    type="blockMenu"
                    blockType={blockData.blockType}
                    data={blockData}
                    onAction={(action: string, data: any) => {
                        switch (action) {
                            case 'copy':
                                onCommand('copyToClipboard', { pos: data.pos });
                                closePopup();
                                break;
                            case 'cut':
                                onCommand('copyToClipboard', { pos: data.pos });
                                onCommand('deleteSelection', { pos: data.pos });
                                closePopup();
                                break;
                            case 'delete':
                                onCommand('deleteSelection', { pos: data.pos });
                                closePopup();
                                break;
                            case 'background':
                                openPopup('detailsBackground');
                                break;
                            case 'language':
                                openPopup('codeLanguage');
                                break;
                            case 'copyLink':
                                onCommand('copyBlockLink', { id: data.id });
                                closePopup();
                                break;
                        }
                    }}
                    onClose={closePopup}
                />
            )}

            {activePopup === 'fileMenu' && blockData && (
                <ToolbarPopup
                    visible={true}
                    type="fileMenu"
                    src={blockData.src}
                    width={blockData.width}
                    position={blockData.position}
                    mimeType={blockData.mimeType}

                    onAction={(action: string, data?: any) => {
                        switch (action) {
                            case 'download':
                                (async () => {
                                    if (blockData.imageId || blockData.src) {
                                        await FileService.saveFile(blockData.imageId, blockData.src);
                                    } else {
                                        console.error('No source found for the file.');
                                    }
                                    closePopup();
                                })();
                                break;
                            case 'copy':
                                copyFileToClipboardMobile(blockData.src, blockData.imageId);
                                onCommand('copyImage', { pos: blockData.position });
                                closePopup();
                                break;
                            case 'cut':
                                copyFileToClipboardMobile(blockData.src, blockData.imageId);
                                if (blockData.imageId) {
                                    onCommand('deleteImage', { pos: blockData.position });
                                } else {
                                    onCommand('cutImage', { pos: blockData.position });
                                }
                                closePopup();
                                break;
                            case 'delete':
                                onCommand('deleteImage', { pos: blockData.position });
                                closePopup();
                                break;
                            case 'resize':
                                onCommand('updateImage', { width: data?.width });
                                closePopup();
                                break;
                        }
                    }}
                    onClose={closePopup}
                />
            )}
        </>
    );
}

const styles = StyleSheet.create({
    toolbar: {
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
