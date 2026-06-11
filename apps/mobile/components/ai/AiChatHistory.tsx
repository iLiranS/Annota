import SwipeableItem, { SwipeAction } from '@/components/swipeable-item';
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
    onTogglePin: (id: string) => void;
    onNewChat: () => void;
}

export function AiChatHistory({ chats, onSelectChat, onDeleteChat, onTogglePin, onNewChat }: AiChatHistoryProps) {
    const { colors } = useTheme();

    const renderItem = ({ item }: { item: AiChat }) => {
        const rightActions: SwipeAction[] = [
            {
                icon: item.isPinned ? 'pin' : 'pin-outline',
                backgroundColor: '#3B82F6',
                onPress: () => onTogglePin(item.id),
            },
            {
                icon: 'trash-outline',
                backgroundColor: '#EF4444',
                onPress: () => onDeleteChat(item.id),
            },
        ];

        return (
            <SwipeableItem
                key={item.id}
                rightActions={rightActions}
            >
                <TouchableOpacity
                    style={[styles.historyItem, {
                        backgroundColor: colors.card,
                        borderBottomColor: colors.border + "60"
                    }]}
                    onPress={() => onSelectChat(item.id)}
                >
                    <View style={styles.historyItemContent}>
                        <View style={[styles.chatIcon, { backgroundColor: item.isPinned ? colors.primary + '15' : colors.text + '05' }]}>
                            <Ionicons
                                name={item.isPinned ? "pin" : "chatbubble-outline"}
                                size={16}
                                color={item.isPinned ? colors.primary : colors.text + '40'}
                            />
                        </View>
                        <View style={styles.historyTextContainer}>
                            <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>
                                {item.title}
                            </Text>
                            <Text style={[styles.historyDate, { color: colors.text + '40' }]}>
                                {new Date(item.updatedAt).toLocaleDateString()}
                            </Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.text + '20'} />
                </TouchableOpacity>
            </SwipeableItem>
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                data={chats}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.historyList}
                renderItem={renderItem}
                ListEmptyComponent={
                    <View style={styles.placeholderContainer}>
                        <Ionicons name="chatbubbles-outline" size={48} color={colors.text + '10'} />
                        <Text style={[styles.placeholderText, { color: colors.text + '40' }]}>No conversations yet</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    historyList: {
        // paddingVertical: 8,
        paddingBottom: 20,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    historyItemContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    chatIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
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
