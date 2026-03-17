import { getFilteredCommands, SharedSlashCommand } from '@annota/editor-ui';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const MobileIconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
    'heading': 'format-size',
    'h1': 'format-size',
    'h2': 'format-size',
    'h3': 'format-size',
    'h4': 'format-size',
    'h5': 'format-size',
    'h6': 'format-size',
    'format': 'format-color-text',
    'bold': 'format-bold',
    'italic': 'format-italic',
    'underline': 'format-underlined',
    'strike': 'strikethrough-s',
    'list': 'format-list-bulleted',
    'bulletList': 'format-list-bulleted',
    'orderedList': 'format-list-numbered',
    'taskList': 'check-box',
    'blocks': 'widgets',
    'quote': 'format-quote',
    'codeblock': 'terminal',
    'code': 'code',
    'details': 'post-add',
    'plus': 'add',
    'math': 'functions',
    'image': 'image',
    'link': 'link',
    'youtube': 'smart-display',
    'table': 'table-chart',
};

interface SlashCommandMenuProps {
    query: string;
    range: { from: number; to: number };
    sendCommand: (cmd: string, params?: Record<string, unknown>) => void;
    onClose: () => void;
}

export function SlashCommandMenu({ query, range, sendCommand, onClose }: SlashCommandMenuProps) {
    const { colors } = useTheme();
    const [activeFolder, setActiveFolder] = useState<string | null>(null);

    const displayItems = useMemo(() => {
        return getFilteredCommands(query, activeFolder);
    }, [query, activeFolder]);

    const handleSelect = (item: SharedSlashCommand) => {
        if (item.children) {
            setActiveFolder(item.id);
        } else if (item.action) {
            // 1. Delete the exact text range of the slash command ("/query")
            sendCommand('deleteSelection', { from: range.from, to: range.to });

            // 2. Execute the selected action
            sendCommand(item.action, item.params);

            // 3. Close the menu
            onClose();
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {activeFolder && (
                    <TouchableOpacity
                        style={[styles.item, { backgroundColor: colors.card }]}
                        onPress={() => setActiveFolder(null)}
                    >
                        <MaterialIcons name="arrow-back" size={18} color={colors.text} style={styles.icon} />
                        <Text style={[styles.itemText, { color: colors.text }]}>Back</Text>
                    </TouchableOpacity>
                )}

                {displayItems.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => handleSelect(item)}
                    >
                        <MaterialIcons name={MobileIconMap[item.iconKey] || 'widgets'} size={18} color={colors.text} style={styles.icon} />
                        <Text style={[styles.itemText, { color: colors.text }]}>{item.title}</Text>
                        {item.children && (
                            <MaterialIcons name="chevron-right" size={14} color={colors.text} style={{ marginLeft: 4, opacity: 0.5 }} />
                        )}
                    </TouchableOpacity>
                ))}

                {displayItems.length === 0 && (
                    <Text style={[styles.noResultText, { color: colors.border }]}>No commands found</Text>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 50,
        borderTopWidth: StyleSheet.hairlineWidth,
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginRight: 8,
        borderWidth: StyleSheet.hairlineWidth,
    },
    icon: {
        marginRight: 6,
    },
    itemText: {
        fontSize: 14,
        fontWeight: '500',
    },
    noResultText: {
        fontSize: 14,
        paddingHorizontal: 16,
    }
});
