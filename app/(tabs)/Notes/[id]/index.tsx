import { getNoteById } from '@/dev-data/data';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';




export default function NoteDetail() {
    const { id } = useLocalSearchParams();
    const { colors } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const currentNote = typeof id === 'string' ? getNoteById(id) : undefined;

    const formatDate = (date: Date): string => {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: () => (
                        <Text
                            style={[styles.headerTitle, { color: colors.text }]}
                            numberOfLines={1}
                        >
                            {currentNote?.title ?? 'Note'}
                        </Text>
                    ),
                    headerLeft: () => (
                        <Pressable
                            onPress={() => router.back()}
                            style={styles.headerButton}
                            hitSlop={8}
                        >
                            <Ionicons
                                name="chevron-back"
                                size={26}
                                color={colors.primary}
                            />
                        </Pressable>
                    ),
                    headerRight: () => (
                        <Pressable
                            onPress={() => setIsSearchVisible(true)}
                            style={styles.headerButton}
                            hitSlop={8}
                        >
                            <Ionicons
                                name="search"
                                size={26}
                                color={colors.primary}
                            />
                        </Pressable>
                    ),
                    headerBackVisible: false,
                }}
            />

            <Text style={[{ color: colors.text }]}>{currentNote?.preview}</Text>
            <Text style={[{ color: colors.text }]}>
                {currentNote?.createdAt ? formatDate(currentNote.createdAt) : ''}
            </Text>

            {/* Dummy Search Modal */}
            <Modal
                visible={isSearchVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setIsSearchVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setIsSearchVisible(false)}
                >
                    <View
                        style={[
                            styles.searchContainer,
                            {
                                backgroundColor: colors.card,
                                marginTop: insets.top + 12,
                            },
                        ]}
                    >
                        <Pressable onPress={(e) => e.stopPropagation()}>
                            <View style={styles.searchInputWrapper}>
                                <Ionicons
                                    name="search"
                                    size={18}
                                    color={colors.text}
                                    style={styles.searchIcon}
                                />
                                <TextInput
                                    style={[styles.searchInput, { color: colors.text }]}
                                    placeholder="Search in note..."
                                    placeholderTextColor={'#888'}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoFocus
                                />
                                {searchQuery.length > 0 && (
                                    <Pressable onPress={() => setSearchQuery('')}>
                                        <Ionicons
                                            name="close-circle"
                                            size={18}
                                            color={colors.text}
                                        />
                                    </Pressable>
                                )}
                            </View>
                        </Pressable>
                        <Text style={[styles.searchHint, { color: colors.border }]}>
                            This is a dummy search interface
                        </Text>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        gap: 16,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    headerButton: {
        padding: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 16,
    },
    searchContainer: {
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    searchIcon: {
        opacity: 0.6,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 8,
    },
    searchHint: {
        marginTop: 8,
        fontSize: 12,
        textAlign: 'center',
    },
});