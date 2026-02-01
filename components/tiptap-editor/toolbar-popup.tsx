import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';

import { CodeLanguageSelector } from './popups/code-language-selector';
import { ColorSelector } from './popups/color-selector';
import { HeadingSelector } from './popups/heading-selector';

import { useAppTheme } from '@/hooks/use-app-theme';
import { ImageInput } from './popups/image-input';
import { LinkInput } from './popups/link-input';
import { MathInput } from './popups/math-input';
import { TableActions } from './popups/table-actions';
import { YouTubeInput } from './popups/youtube-input';
import {
    BlockMenuPopupProps,
    CodeLanguagePopupProps,
    ColorPopupProps,
    DetailsBackgroundPopupProps,
    HeadingPopupProps,
    ImagePopupProps,
    LinkPopupProps,
    MathPopupProps,
    TablePopupProps,
    ToolbarPopupProps,
    YouTubePopupProps
} from './types';

// ============================================================================
// Block Action Menu (Modular)
// ============================================================================

interface BlockAction {
    id: string;
    label: string;
    icon: string;
    action: string;
}

const COMMON_ACTIONS: BlockAction[] = [
    { id: 'copy', label: 'Copy', icon: 'content-copy', action: 'copy' },
    { id: 'cut', label: 'Cut', icon: 'content-cut', action: 'cut' },
    { id: 'delete', label: 'Delete', icon: 'delete-outline', action: 'delete' },
];

const getBlockActions = (blockType: string): BlockAction[] => {
    const actions = [...COMMON_ACTIONS];

    switch (blockType) {
        case 'details':
            // Add background option for details
            actions.splice(0, 0, { id: 'background', label: 'Background', icon: 'palette', action: 'background' });
            break;
        case 'codeBlock':
            actions.splice(0, 0, { id: 'language', label: 'Language', icon: 'code', action: 'language' });
            break;
    }

    return actions;
};

function BlockActionMenu({ blockType, onAction, onClose }: { blockType: string, onAction: (action: string) => void, onClose: () => void }) {
    const { colors } = useAppTheme();
    const actions = getBlockActions(blockType);

    return (
        <View>
            <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: colors.text,
                marginBottom: 16,
                textAlign: 'center'
            }}>
                {blockType === 'codeBlock' ? 'Code Block' : blockType === 'details' ? 'Section' : 'Block Options'}
            </Text>

            <View style={{ gap: 8 }}>
                {actions.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 12,
                            borderRadius: 8,
                            backgroundColor: colors.card,
                        }}
                        onPress={() => {
                            onAction(item.action);
                            if (item.action !== 'background' && item.action !== 'language') {
                                onClose();
                            }
                        }}
                    >
                        <MaterialIcons name={item.icon as any} size={20} color={colors.text} style={{ marginRight: 12 }} />
                        <Text style={{ fontSize: 16, color: colors.text }}>{item.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

// ============================================================================
// Main Popup Component
// ============================================================================

export function ToolbarPopup(props: ToolbarPopupProps) {
    const { visible, onClose, type } = props;
    const { colors } = useAppTheme();

    if (!visible || !type) return null;

    const renderContent = () => {
        switch (type) {
            case 'blockMenu':
                return (
                    <BlockActionMenu
                        blockType={(props as BlockMenuPopupProps).blockType}
                        onAction={(action) => (props as BlockMenuPopupProps).onAction(action, (props as BlockMenuPopupProps).data)}
                        onClose={onClose}
                    />
                );
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
            case 'math':
                return (
                    <MathInput
                        currentLatex={(props as MathPopupProps).currentLatex}
                        onSubmit={(props as MathPopupProps).onSubmit}
                        onClose={onClose}
                    />
                );
            case 'detailsBackground':
                return (
                    <ColorSelector
                        title="Section Background"
                        currentColor={(props as DetailsBackgroundPopupProps).currentColor}
                        onSelect={(props as DetailsBackgroundPopupProps).onSelect}
                        onClear={(props as DetailsBackgroundPopupProps).onClear}
                    />
                );

            default:
                return null;
        }
    };



    return (
        <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View
                            style={[
                                styles.popup,
                                { backgroundColor: colors.background, borderColor: colors.border },
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
        borderWidth: 1,
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
