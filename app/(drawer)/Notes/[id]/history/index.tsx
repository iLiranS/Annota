import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useNotesStore } from '@/stores/notes-store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import { format } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, View } from 'react-native';

export default function NoteHistory() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { colors } = useTheme();
    const { getNoteVersions } = useNotesStore();

    const [versions, setVersions] = useState<{ id: string; createdAt: Date }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useFocusEffect(
        React.useCallback(() => {
            let isActive = true;

            const loadVersions = async () => {
                if (id) {
                    const data = await getNoteVersions(id);
                    if (isActive) {
                        setVersions(data);
                        setIsLoading(false);
                    }
                }
            };

            // Set loading state if needed, or just let it update
            // setIsLoading(true); // Optional: show spinner on every focus? Maybe strictly not needed if fast.
            loadVersions();

            return () => {
                isActive = false;
            };
        }, [id, getNoteVersions])
    );


    const handleVersionPress = (versionId: string) => {
        router.push({
            pathname: '/Notes/[id]/history/[versionId]',
            params: { id, versionId }
        });
    };

    const renderItem = ({ item }: { item: { id: string; createdAt: Date } }) => (
        <HapticPressable
            onPress={() => handleVersionPress(item.id)}
            style={({ pressed }) => [
                styles.itemContainer,
                { borderBottomColor: colors.border },
                pressed && { backgroundColor: colors.border + '30' }
            ]}
        >
            <View style={styles.iconContainer}>
                <Ionicons name="time-outline" size={24} color={colors.text} />
            </View>
            <View style={styles.textContainer}>
                <Text style={[styles.dateText, { color: colors.text }]}>
                    {format(new Date(item.createdAt), 'MMM d, yyyy')}
                </Text>
                <Text style={[styles.timeText, { color: colors.text + '80' }]}>
                    {format(new Date(item.createdAt), 'h:mm:ss a')}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text + '40'} />
        </HapticPressable>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: 'Version History',
                    headerBackTitle: 'Note',
                    headerLeft: () => (
                        <HapticPressable
                            onPress={() => router.back()}
                            style={[
                                styles.headerCircularButton,
                                { marginLeft: Platform.OS === 'ios' ? -4 : 0 }
                            ]}
                        >
                            <Ionicons name="chevron-back" size={28} color={colors.primary} />
                        </HapticPressable>
                    ),
                }}
            />

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={versions}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text style={[styles.emptyText, { color: colors.text + '80' }]}>
                                No history available
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerCircularButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    listContent: {
        paddingVertical: 8,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    iconContainer: {
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
    },
    dateText: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    timeText: {
        fontSize: 14,
    },
    emptyText: {
        fontSize: 16,
    }
});
