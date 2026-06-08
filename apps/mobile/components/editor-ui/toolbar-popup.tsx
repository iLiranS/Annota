import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import {
    Modal,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import { CodeLanguageSelector } from './popups/code-language-selector';
import { ColorSelector } from './popups/color-selector';
import { HeadingSelector } from './popups/heading-selector';

import {
    BlockMenuPopupProps,
    CodeLanguagePopupProps,
    ColorPopupProps,
    DetailsBackgroundPopupProps,
    FileMenuPopupProps,
    FilePopupProps,
    HeadingPopupProps,
    LinkPopupProps,
    MathPopupProps,
    TablePopupProps,
    ToolbarPopupProps,
    YouTubePopupProps
} from '@annota/editor-ui';
import { AIMenu } from './popups/ai-menu';
import { FileInput } from './popups/file-input';
import { LinkInput } from './popups/link-input';
import { MathInput } from './popups/math-input';
import { TableActions } from './popups/table-actions';
import { TableSelector } from './popups/table-selector';
import { YouTubeInput } from './popups/youtube-input';

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
            actions.splice(0, 0, { id: 'background', label: 'Background', icon: 'palette', action: 'background' });
            actions.splice(0, 0, { id: 'copyLink', label: 'Copy Link', icon: 'link', action: 'copyLink' });
            break;
        case 'flashcard':
            actions.splice(0, 0, { id: 'copyLink', label: 'Copy Link', icon: 'link', action: 'copyLink' });
            break;
        case 'quote':
            actions.splice(0, 0, { id: 'background', label: 'Background', icon: 'palette', action: 'background' });
            break;
        case 'codeBlock':
            actions.splice(0, 0, { id: 'language', label: 'Language', icon: 'code', action: 'language' });
            break;
    }

    return actions;
};

function BlockActionMenu({ blockType, onAction, onClose }: { blockType: string, onAction: (action: string) => void, onClose: () => void }) {
    const { colors } = useTheme();
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
                {blockType === 'codeBlock' ? 'Code Block' : blockType === 'details' ? 'Details' : blockType === 'mermaid' ? 'Diagram' : blockType === 'quote' ? 'Quote' : blockType === 'flashcard' ? 'Flashcard' : 'Block Options'}
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
// File Action Menu
// ============================================================================

const FILE_ACTIONS: BlockAction[] = [
    { id: 'download', label: 'Download', icon: 'file-download', action: 'download' },
    { id: 'copy', label: 'Copy', icon: 'content-copy', action: 'copy' },
    { id: 'cut', label: 'Cut', icon: 'content-cut', action: 'cut' },
    { id: 'delete', label: 'Delete', icon: 'delete-outline', action: 'delete' },
];


function FileActionMenu({ mimeType, onAction, onClose }: { mimeType?: string, onAction: (action: string, data?: any) => void, onClose: () => void }) {
    const { colors } = useTheme();
    const isImage = !mimeType || mimeType.startsWith('image/');

    const filteredActions = isImage ? FILE_ACTIONS : FILE_ACTIONS.filter(a => a.id === 'delete' || a.id === 'copy');


    return (
        <View>
            <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: colors.text,
                marginBottom: 16,
                textAlign: 'center'
            }}>
                File Options
            </Text>

            {/* Action buttons */}
            <View style={{ gap: 8 }}>
                {filteredActions.map((item) => (

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
                            onClose();
                        }}
                    >
                        <MaterialIcons name={item.icon as any} size={20} color={item.id === 'delete' ? '#FF453A' : colors.text} style={{ marginRight: 12 }} />
                        <Text style={{ fontSize: 16, color: item.id === 'delete' ? '#FF453A' : colors.text }}>
                            {item.id === 'copy' && !isImage ? 'Copy File Path' : item.label}
                        </Text>
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
    const { visible, onClose, type, isLoading } = props;
    const { colors } = useTheme();

    if (!visible || !type) return null;

    const renderContent = () => {
        switch (type) {
            case 'ai':
                return (
                    <AIMenu
                        onAction={(props as any).onAction}
                        onClose={onClose}
                        isLoading={isLoading}
                        onStop={(props as any).onStop}
                    />
                );
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
                        onCopyLink={(props as HeadingPopupProps).onCopyLink}
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
                        selectedText={(props as LinkPopupProps).selectedText}
                        onSubmit={(props as LinkPopupProps).onSubmit}
                        onRemove={(props as LinkPopupProps).onRemove}
                        onClose={onClose}
                    />
                );
            case 'file':
                return (
                    <FileInput
                        onSubmit={(props as FilePopupProps).onSubmit}
                        onPickFromLibrary={(props as FilePopupProps).onPickFromLibrary}
                        onPickDocument={(props as FilePopupProps).onPickDocument}
                        onTakePhoto={(props as FilePopupProps).onTakePhoto}
                        onClose={onClose}
                        isLoading={isLoading}
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
            case 'insertTable':
                return (
                    <TableSelector
                        onSelect={(rows, cols) => {
                            (props as any).onCommand?.('insertTable', { rows, cols, withHeaderRow: false });
                            onClose();
                        }}
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
                        isBlock={(props as MathPopupProps).isBlock}
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
            case 'fileMenu':
                return (
                    <FileActionMenu
                        mimeType={(props as FileMenuPopupProps).mimeType}
                        onAction={(props as FileMenuPopupProps).onAction}
                        onClose={onClose}
                    />

                );

            default:
                return null;
        }
    };




    const isModal = type === 'link' || type === 'youtube' || type === 'math' || type === 'file' || type === 'table' || type === 'insertTable';

    if (isModal) {
        return (
            <Modal
                visible={visible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={onClose}
                supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
            >
                <View style={{ flex: 1, backgroundColor: colors.background }}>
                    {renderContent()}
                </View>
            </Modal>
        );
    }

    return renderContent();
}
