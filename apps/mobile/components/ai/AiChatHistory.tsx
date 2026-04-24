import { AiChat } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import React from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface AiChatHistoryProps {
    chats: AiChat[];
    onSelectChat: (id: string) => void;
    onDeleteChat: (id: string) => void;
}

export function AiChatHistory({ chats, onSelectChat, onDeleteChat }: AiChatHistoryProps) {
    const { colors } = useTheme();

    return (
        <FlatList
            data={chats}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.historyList}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={[styles.historyItem, {
                        borderBottomColor: colors.border
                    }]}
                    onPress={() => onSelectChat(item.id)}
                >
                    <View style={styles.historyItemContent}>
                        <Ionicons name="chatbubble-outline" size={18} color={colors.text + '40'} />
                        <View style={styles.historyTextContainer}>
                            <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>
                                {item.title}
                            </Text>
                            <Text style={[styles.historyDate, { color: colors.text + '40' }]}>
                                {new Date(item.updatedAt).toLocaleDateString()}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => onDeleteChat(item.id)} style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                </TouchableOpacity>
            )}
            ListEmptyComponent={
                <View style={styles.placeholderContainer}>
                    <Ionicons name="chatbubbles-outline" size={48} color={colors.text + '10'} />
                    <Text style={[styles.placeholderText, { color: colors.text + '40' }]}>No conversations yet</Text>
                </View>
            }
        />
    );
}

const styles = StyleSheet.create({
    historyList: {
        padding: 16,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    historyItemContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    historyTextContainer: {
        flex: 1,
        gap: 2,
    },
    historyTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    historyDate: {
        fontSize: 12,
    },
    deleteButton: {
        padding: 8,
    },
    placeholderContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginTop: 140,
    },
    placeholderText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        maxWidth: '80%',
    },
});
