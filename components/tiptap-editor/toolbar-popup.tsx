import { useTheme } from '@react-navigation/native';
import React from 'react';
import {
    Modal,
    StyleSheet,
    TouchableWithoutFeedback,
    View,
} from 'react-native';

import { CodeLanguageSelector } from './popups/code-language-selector';
import { ColorSelector } from './popups/color-selector';
import { HeadingSelector } from './popups/heading-selector';

import { ImageInput } from './popups/image-input';
import { LinkInput } from './popups/link-input';
import { TableActions } from './popups/table-actions';
import { YouTubeInput } from './popups/youtube-input';
import {
    CodeLanguagePopupProps,
    ColorPopupProps,
    HeadingPopupProps,
    ImagePopupProps,
    LinkPopupProps,
    TablePopupProps,
    ToolbarPopupProps,
    YouTubePopupProps
} from './types';

// ============================================================================
// Main Popup Component
// ============================================================================

export function ToolbarPopup(props: ToolbarPopupProps) {
    const { visible, onClose, type } = props;
    const { dark } = useTheme();

    if (!visible || !type) return null;

    const renderContent = () => {
        switch (type) {
            case 'headings':
                return (
                    <HeadingSelector
                        currentLevel={(props as HeadingPopupProps).currentLevel}
                        onSelect={(props as HeadingPopupProps).onSelect}
                    />
                );
            case 'highlight':
                return (
                    <ColorSelector
                        title="Highlight Color"
                        currentColor={(props as ColorPopupProps).currentColor}
                        onSelect={(props as ColorPopupProps).onSelect}
                        onClear={(props as ColorPopupProps).onClear}
                    />
                );
            case 'textColor':
                return (
                    <ColorSelector
                        title="Text Color"
                        currentColor={(props as ColorPopupProps).currentColor}
                        onSelect={(props as ColorPopupProps).onSelect}
                        onClear={(props as ColorPopupProps).onClear}
                    />
                );
            case 'youtube':
                return (
                    <YouTubeInput
                        onSubmit={(props as YouTubePopupProps).onSubmit}
                        onClose={onClose}
                    />
                );
            case 'link':
                return (
                    <LinkInput
                        currentUrl={(props as LinkPopupProps).currentUrl}
                        onSubmit={(props as LinkPopupProps).onSubmit}
                        onRemove={(props as LinkPopupProps).onRemove}
                        onClose={onClose}
                    />
                );
            case 'image':
                return (
                    <ImageInput
                        onSubmit={(props as ImagePopupProps).onSubmit}
                        onClose={onClose}
                    />
                );
            case 'table':
                return (
                    <TableActions
                        canAddRowBefore={(props as TablePopupProps).canAddRowBefore}
                        canAddRowAfter={(props as TablePopupProps).canAddRowAfter}
                        canAddColumnBefore={(props as TablePopupProps).canAddColumnBefore}
                        canAddColumnAfter={(props as TablePopupProps).canAddColumnAfter}
                        canDeleteRow={(props as TablePopupProps).canDeleteRow}
                        canDeleteColumn={(props as TablePopupProps).canDeleteColumn}
                        canDeleteTable={(props as TablePopupProps).canDeleteTable}
                        onCommand={(props as TablePopupProps).onCommand}
                        onClose={onClose}
                    />
                );
            case 'codeLanguage':
                return (
                    <CodeLanguageSelector
                        currentLanguage={(props as CodeLanguagePopupProps).currentLanguage}
                        onSelect={(props as CodeLanguagePopupProps).onSelect}
                    />
                );

            default:
                return null;
        }
    };



    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View
                            style={[
                                styles.popup,
                                { backgroundColor: dark ? '#2C2C2E' : '#FFFFFF' },
                            ]}
                        >
                            {renderContent()}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    popup: {
        borderRadius: 16,
        padding: 16,
        width: '100%',
        maxWidth: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },

});
