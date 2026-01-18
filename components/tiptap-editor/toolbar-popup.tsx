import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@react-navigation/native';
import React, { ComponentProps, useEffect, useRef } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from 'react-native';

import { COLOR_PALETTE, HEADING_LEVELS, HeadingLevel } from './color-palette';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

// ============================================================================
// Types
// ============================================================================

export type PopupType = 'headings' | 'highlight' | 'textColor' | 'youtube' | 'link' | 'image' | null;

interface BasePopupProps {
    visible: boolean;
    onClose: () => void;
}

interface HeadingPopupProps extends BasePopupProps {
    type: 'headings';
    currentLevel: HeadingLevel | null;
    onSelect: (level: HeadingLevel) => void;
}

interface ColorPopupProps extends BasePopupProps {
    type: 'highlight' | 'textColor';
    currentColor: string | null;
    onSelect: (color: string) => void;
    onClear: () => void;
}

interface YouTubePopupProps extends BasePopupProps {
    type: 'youtube';
    onSubmit: (url: string) => void;
}

interface LinkPopupProps extends BasePopupProps {
    type: 'link';
    currentUrl: string | null;
    onSubmit: (url: string) => void;
    onRemove: () => void;
}

interface ImagePopupProps extends BasePopupProps {
    type: 'image';
    onSubmit: (url: string) => void;
}

export type ToolbarPopupProps = HeadingPopupProps | ColorPopupProps | YouTubePopupProps | LinkPopupProps | ImagePopupProps;

// ============================================================================
// Heading Selector
// ============================================================================

function HeadingSelector({
    currentLevel,
    onSelect,
}: {
    currentLevel: HeadingLevel | null;
    onSelect: (level: HeadingLevel) => void;
}) {
    const { colors, dark } = useTheme();

    return (
        <View style={styles.popupContent}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>Heading</Text>
            <View style={styles.headingGrid}>
                {HEADING_LEVELS.map((level) => (
                    <Pressable
                        key={level}
                        style={[
                            styles.headingItem,
                            { backgroundColor: dark ? '#3A3A3C' : '#E5E5EA' },
                            currentLevel === level && { backgroundColor: colors.primary },
                        ]}
                        onPress={() => onSelect(level)}
                    >
                        <Text
                            style={[
                                styles.headingText,
                                { color: currentLevel === level ? '#FFFFFF' : colors.text },
                                { fontSize: 22 - level * 2 },
                            ]}
                        >
                            H{level}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

// ============================================================================
// Color Selector
// ============================================================================

function ColorSelector({
    title,
    currentColor,
    onSelect,
    onClear,
}: {
    title: string;
    currentColor: string | null;
    onSelect: (color: string) => void;
    onClear: () => void;
}) {
    const { colors, dark } = useTheme();

    return (
        <View style={styles.popupContent}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>{title}</Text>
            <View style={styles.colorGrid}>
                {COLOR_PALETTE.map((colorOption) => (
                    <Pressable
                        key={colorOption.value}
                        style={[
                            styles.colorItem,
                            { backgroundColor: colorOption.value },
                            currentColor === colorOption.value && styles.colorItemSelected,
                        ]}
                        onPress={() => onSelect(colorOption.value)}
                    />
                ))}
            </View>
            {currentColor && (
                <Pressable
                    style={[styles.clearButton, { backgroundColor: dark ? '#3A3A3C' : '#E5E5EA' }]}
                    onPress={onClear}
                >
                    <Text style={[styles.clearButtonText, { color: colors.text }]}>Remove</Text>
                </Pressable>
            )}
        </View>
    );
}

// ============================================================================
// YouTube Input
// ============================================================================

function YouTubeInput({
    onSubmit,
    onClose,
}: {
    onSubmit: (url: string) => void;
    onClose: () => void;
}) {
    const { colors, dark } = useTheme();
    const [url, setUrl] = React.useState('');
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        // Focus input when opened
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const handleSubmit = () => {
        if (url.trim()) {
            onSubmit(url.trim());
            setUrl('');
        }
    };

    return (
        <View style={styles.popupContent}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>Embed YouTube Video</Text>
            <TextInput
                ref={inputRef}
                style={[
                    styles.urlInput,
                    {
                        backgroundColor: dark ? '#1C1C1E' : '#F2F2F7',
                        color: colors.text,
                        borderColor: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                    },
                ]}
                placeholder="Paste YouTube URL..."
                placeholderTextColor={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                onSubmitEditing={handleSubmit}
            />
            <View style={styles.buttonRow}>
                <Pressable
                    style={[styles.button, { backgroundColor: dark ? '#3A3A3C' : '#E5E5EA' }]}
                    onPress={onClose}
                >
                    <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                    style={[styles.button, { backgroundColor: colors.primary }]}
                    onPress={handleSubmit}
                >
                    <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Embed</Text>
                </Pressable>
            </View>
        </View>
    );
}

// ============================================================================
// Link Input
// ============================================================================

function LinkInput({
    currentUrl,
    onSubmit,
    onRemove,
    onClose,
}: {
    currentUrl: string | null;
    onSubmit: (url: string) => void;
    onRemove: () => void;
    onClose: () => void;
}) {
    const { colors, dark } = useTheme();
    const [url, setUrl] = React.useState(currentUrl || '');
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        // Focus input when opened
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const handleSubmit = () => {
        const trimmedUrl = url.trim();
        if (trimmedUrl) {
            // Auto-add https:// if missing
            const finalUrl = trimmedUrl.match(/^https?:\/\//) ? trimmedUrl : 'https://' + trimmedUrl;
            onSubmit(finalUrl);
        }
    };

    return (
        <View style={styles.popupContent}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>Add Link</Text>
            <TextInput
                ref={inputRef}
                style={[
                    styles.urlInput,
                    {
                        backgroundColor: dark ? '#1C1C1E' : '#F2F2F7',
                        color: colors.text,
                        borderColor: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                    },
                ]}
                placeholder="Enter URL..."
                placeholderTextColor={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                onSubmitEditing={handleSubmit}
            />
            <View style={styles.buttonRow}>
                <Pressable
                    style={[styles.button, { backgroundColor: dark ? '#3A3A3C' : '#E5E5EA' }]}
                    onPress={onClose}
                >
                    <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                {currentUrl && (
                    <Pressable
                        style={[styles.button, { backgroundColor: '#FF3B30' }]}
                        onPress={onRemove}
                    >
                        <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Remove</Text>
                    </Pressable>
                )}
                <Pressable
                    style={[styles.button, { backgroundColor: colors.primary }]}
                    onPress={handleSubmit}
                >
                    <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                        {currentUrl ? 'Update' : 'Add'}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

// ============================================================================
// Image Input
// ============================================================================

function ImageInput({
    onSubmit,
    onClose,
}: {
    onSubmit: (url: string) => void;
    onClose: () => void;
}) {
    const { colors, dark } = useTheme();
    const [url, setUrl] = React.useState('');
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        // Focus input when opened
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const handleSubmit = () => {
        if (url.trim()) {
            onSubmit(url.trim());
            setUrl('');
        }
    };

    return (
        <View style={styles.popupContent}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>Insert Image</Text>
            <TextInput
                ref={inputRef}
                style={[
                    styles.urlInput,
                    {
                        backgroundColor: dark ? '#1C1C1E' : '#F2F2F7',
                        color: colors.text,
                        borderColor: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                    },
                ]}
                placeholder="Paste image URL..."
                placeholderTextColor={dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                onSubmitEditing={handleSubmit}
            />
            <View style={styles.buttonRow}>
                <Pressable
                    style={[styles.button, { backgroundColor: dark ? '#3A3A3C' : '#E5E5EA' }]}
                    onPress={onClose}
                >
                    <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                    style={[styles.button, { backgroundColor: colors.primary }]}
                    onPress={handleSubmit}
                >
                    <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Insert</Text>
                </Pressable>
            </View>
        </View>
    );
}

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
    popupContent: {
        gap: 12,
    },
    popupTitle: {
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 4,
    },
    headingGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
    },
    headingItem: {
        width: 48,
        height: 48,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headingText: {
        fontWeight: '600',
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
    },
    colorItem: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    colorItemSelected: {
        borderWidth: 3,
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    clearButton: {
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 4,
    },
    clearButtonText: {
        fontSize: 15,
        fontWeight: '500',
    },
    urlInput: {
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        fontSize: 16,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    button: {
        flex: 1,
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '500',
    },
});
