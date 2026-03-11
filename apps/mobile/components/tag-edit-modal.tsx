import { useAppTheme } from '@/hooks/use-app-theme';
import { useNotesStore } from '@annota/core';
import type { Tag } from '@annota/core';
import { COLOR_PALETTE } from '@annota/core/constants/colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PlatformPressable } from '@react-navigation/elements';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TagEditModalProps {
    visible: boolean;
    tag: Tag | null;
    onClose: () => void;
}

export default function TagEditModal({
    visible,
    tag,
    onClose,
}: TagEditModalProps) {
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { updateTag, deleteTag } = useNotesStore();

    const [name, setName] = useState('');
    const [color, setColor] = useState(COLOR_PALETTE[0].value);

    // Reset state when tag changes or modal opens
    useEffect(() => {
        if (visible && tag) {
            setName(tag.name);
            setColor(tag.color || COLOR_PALETTE[0].value);
        }
    }, [tag, visible]);

    const handleSave = () => {
        if (!name.trim() || !tag) return;

        updateTag(tag.id, {
            name: name.trim(),
            color,
        });
        onClose();
    };

    const handleDelete = () => {
        if (!tag) return;

        Alert.alert(
            'Delete Tag',
            `Are you sure you want to delete the tag "${tag.name}"? This will remove it from all notes.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await deleteTag(tag.id);
                        onClose();
                    },
                },
            ]
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
                    <PlatformPressable onPress={onClose} style={[styles.headerButton]}>
                        <Text style={[styles.headerButtonCancelText, { color: colors.primary }]}>Cancel</Text>
                    </PlatformPressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        Edit Tag
                    </Text>
                    <PlatformPressable
                        onPress={handleSave}
                        style={styles.headerButton}
                        disabled={!name.trim()}
                    >
                        <Text style={[
                            styles.headerButtonSaveText,
                            { color: !name.trim() ? colors.border : colors.primary }
                        ]}>Save</Text>
                    </PlatformPressable>
                </View>

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                >
                    {/* Tag Name */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Name</Text>
                        <View style={[
                            styles.inputWrapper,
                            {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            }
                        ]}>
                            <View
                                style={[
                                    styles.iconContainer,
                                    { backgroundColor: color + '15' }
                                ]}
                            >
                                <Ionicons
                                    name="pricetag"
                                    size={18}
                                    color={color}
                                />
                            </View>
                            <TextInput
                                style={[
                                    styles.flexInput,
                                    {
                                        color: colors.text,
                                    }
                                ]}
                                value={name}
                                onChangeText={(text) => { setName(text.slice(0, 30)); }}
                                placeholder="Tag name"
                                placeholderTextColor={colors.text + '50'}
                                autoFocus
                            />
                        </View>
                    </View>

                    {/* Tag Color */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Color</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={[styles.colorScroll, { backgroundColor: colors.card, borderColor: colors.border }]}
                            contentContainerStyle={styles.colorScrollContent}
                        >
                            {COLOR_PALETTE.map((colorOption) => {
                                const colorValue = colorOption.value;
                                return (
                                    <Pressable
                                        key={colorValue}
                                        onPress={() => setColor(colorValue)}
                                        style={[
                                            styles.colorButton,
                                            { backgroundColor: colorValue },
                                            color === colorValue && {
                                                borderWidth: 3,
                                                borderColor: colors.primary,
                                            }
                                        ]}
                                    >
                                        {color === colorValue && (
                                            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                                        )}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Delete Option */}
                    <View style={[styles.section, { marginTop: 12 }]}>
                        <Pressable
                            onPress={handleDelete}
                            style={({ pressed }) => [
                                styles.deleteButton,
                                { borderColor: colors.error },
                                pressed && { backgroundColor: colors.error + '10' }
                            ]}
                        >
                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                            <Text style={[styles.deleteButtonText, { color: colors.error }]}>Delete Tag</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    headerButton: {
        minWidth: 60,
        paddingVertical: 8,
        justifyContent: 'center',
    },
    headerButtonCancelText: {
        fontSize: Platform.OS === 'ios' ? 17 : 14,
        fontWeight: '400',
    },
    headerButtonSaveText: {
        fontSize: Platform.OS === 'ios' ? 17 : 14,
        fontWeight: Platform.OS === 'ios' ? '600' : '700',
        textTransform: Platform.OS === 'android' ? 'uppercase' : 'none',
    },
    headerTitle: {
        fontSize: Platform.OS === 'ios' ? 17 : 20,
        fontWeight: Platform.OS === 'ios' ? '600' : '500',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        opacity: 0.7,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        height: 52,
        gap: 12,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    flexInput: {
        flex: 1,
        fontSize: 16,
        height: '100%',
        paddingVertical: 0,
    },
    colorScroll: {
        borderRadius: 12,
        borderWidth: 1,
    },
    colorScrollContent: {
        padding: 12,
        gap: 12,
        flexDirection: 'row',
    },
    colorButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    deleteButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
