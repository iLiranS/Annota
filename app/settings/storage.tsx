import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useAppTheme } from '@/hooks/use-app-theme';
import { StorageService } from '@/lib/services/storage.service';
import { syncPull, syncPush } from '@/lib/sync/sync-service';
import { getMasterKey } from '@/lib/utils/crypto';
import { useAuthStore } from '@/stores/auth-store';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function StorageSettings() {
    const { user } = useAuthStore();
    const { colors } = useAppTheme();
    const [stats, setStats] = useState<{
        totalImages: number;
        totalLinks: number;
        orphans: number;
        totalImagesSize: number;
        notesSize: number;
        totalSize: number;
        dbName: string;
    } | null>(null);
    const [availableDbs, setAvailableDbs] = useState<string[]>([]);
    const [selectedDb, setSelectedDb] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const loadAvailableDbs = async () => {
        const dbs = await StorageService.listDatabases();
        setAvailableDbs(dbs);
    };

    const loadStats = async (dbOverride?: string) => {
        setIsLoading(true);
        try {
            const s = await StorageService.getStats(dbOverride || selectedDb || undefined);
            setStats(s);
            if (!selectedDb) setSelectedDb(s.dbName);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadAvailableDbs();
        loadStats();
    }, []);

    const isActiveDb = stats?.dbName === (user ? `user_${user.id}.db` : 'local_guest.db');

    const handleGC = () => {
        if (!isActiveDb) {
            Alert.alert("Action Not Supported", "Garbage collection can only be run on the active database.");
            return;
        }
        Alert.alert(
            "Run Garbage Collection?",
            "This will delete all images that are not referenced by any note version. This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Unused Images",
                    style: "destructive",
                    onPress: () => {
                        setIsLoading(true);
                        setTimeout(async () => {
                            try {
                                const count = StorageService.runGarbageCollection(true); // Force clean
                                Alert.alert("Cleanup Complete", `Deleted ${count} unused images.`);
                                await loadStats();
                            } catch (e) {
                                Alert.alert("Error", "Failed to clean storage.");
                                console.error(e);
                            } finally {
                                setIsLoading(false);
                            }
                        }, 100);
                    }
                }
            ]
        );
    };

    const handleRemoveMasterKey = () => {
        if (!user?.id) return;

        Alert.alert(
            "Remove Master Key?",
            "This will remove the master key from your device. You will need to re-enter it to sync your data again. Your local data will remain intact.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove Key",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const { resetMasterKey } = require('@/lib/db/client');
                            await resetMasterKey(user.id);
                            Alert.alert("Success", "Master Key has been removed from this device.");
                            const { router } = require('expo-router');
                            router.replace('/(auth)/master-key');
                        } catch (e) {
                            Alert.alert("Error", "Failed to remove Master Key.");
                            console.error(e);

                        }
                    }
                }
            ]
        );
    };

    const handleManualSync = async () => {
        if (!isActiveDb) {
            Alert.alert("Action Not Supported", "Sync can only be run on the active database.");
            return;
        }
        if (!user?.id) {
            Alert.alert("Error", "You need to be signed in to sync with cloud.");
            return;
        }
        setIsLoading(true);
        try {
            const key = await getMasterKey(user.id);
            if (!key) {
                Alert.alert("Error", "Master Key not found. Please set your Master Key.");
                return;
            }

            await syncPull(key);
            await syncPush(key);

            // Reload local stores to reflect pulled changes
            const { useNotesStore } = require('@/stores/notes-store');
            const { useTasksStore } = require('@/stores/tasks-store');
            useNotesStore.getState().initApp();
            useTasksStore.getState().loadTasks();

            Alert.alert("Sync Complete", "Successfully synchronized your data with the cloud.");
        } catch (error: any) {
            console.error("Manual Sync Error:", error);
            Alert.alert("Sync Failed", error?.message || "An unknown error occurred during sync.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ title: 'Storage & Debug' }} />

            {availableDbs.length > 1 && (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Selected Database</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dbSelector}>
                        {availableDbs.map(db => (
                            <HapticPressable
                                key={db}
                                style={[
                                    styles.dbChip,
                                    { backgroundColor: selectedDb === db ? colors.primary : colors.card, borderColor: colors.border }
                                ]}
                                onPress={() => {
                                    setSelectedDb(db);
                                    loadStats(db);
                                }}
                            >
                                <Text numberOfLines={1} style={[styles.dbChipText, { color: selectedDb === db ? '#fff' : colors.text }]}>
                                    {db === 'local_guest.db' ? 'Guest' : db.replace('user_', '').replace('.db', '')}
                                </Text>
                            </HapticPressable>
                        ))}
                    </ScrollView>
                    {!isActiveDb && (
                        <View style={[styles.warningBanner, { backgroundColor: colors.error + '10', borderColor: colors.error }]}>
                            <Ionicons name="information-circle-outline" size={16} color={colors.error} />
                            <Text style={[styles.warningText, { color: colors.error }]}>
                                Viewing non-active database. Some actions are disabled.
                            </Text>
                        </View>
                    )}
                </View>
            )}

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Image Storage Stats</Text>

                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <StatRow label="Images Size" value={stats ? formatBytes(stats.totalImagesSize) : '-'} color={colors.text} />
                    <StatRow label="Total Images" value={stats?.totalImages ?? '-'} color={colors.text} />
                    <StatRow label="Version Links" value={stats?.totalLinks ?? '-'} color={colors.text} />
                    <StatRow label="Orphaned Images" value={stats?.orphans ?? '-'} color={colors.error} highlight />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Database Stats</Text>

                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <StatRow label="Notes & Data Size" value={stats ? formatBytes(stats.notesSize) : '-'} color={colors.text} />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Total App Size</Text>

                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <StatRow label="Total Size" value={stats ? formatBytes(stats.totalSize) : '-'} color={colors.primary} highlight />
                </View>
            </View>

            {isActiveDb && (
                <View style={styles.actions}>
                    <HapticPressable
                        style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => loadStats()}
                    >
                        <Ionicons name="refresh" size={20} color={colors.primary} />
                        <Text style={[styles.buttonText, { color: colors.primary }]}>Refresh Stats</Text>
                    </HapticPressable>

                    {user && (
                        <>
                            <HapticPressable
                                style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border }]}
                                onPress={handleManualSync}
                            >
                                <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                                <Text style={[styles.buttonText, { color: colors.primary }]}>Sync with Cloud DB</Text>
                            </HapticPressable>

                            <HapticPressable
                                style={[styles.button, { backgroundColor: colors.error + '20', borderColor: colors.error }]}
                                onPress={handleRemoveMasterKey}
                            >
                                <Ionicons name="key-outline" size={20} color={colors.error} />
                                <Text style={[styles.buttonText, { color: colors.error }]}>Remove Master Key</Text>
                            </HapticPressable>
                        </>
                    )}

                    <HapticPressable
                        style={[styles.button, { backgroundColor: colors.primary + '20', borderColor: colors.border }]}
                        onPress={handleGC}
                    >
                        <Ionicons name="trash-bin-outline" size={20} color={colors.primary} />
                        <Text style={[styles.buttonText, { color: colors.primary }]}>Shrink Database</Text>
                    </HapticPressable>

                    <HapticPressable
                        style={[styles.button, { backgroundColor: colors.error + '20', borderColor: colors.error }]}
                        onPress={() => {
                            Alert.alert(
                                "Reset Local Database?",
                                "This will completely erase all local notes, tasks, and images from your device. If you haven't synced, they will be lost forever.",
                                [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                        text: "Reset All",
                                        style: "destructive",
                                        onPress: () => {
                                            const { resetAll } = require('@/lib/db/client');
                                            resetAll();
                                            Alert.alert("Reset Complete", "The local database has been wiped.");
                                            loadStats();
                                        }
                                    }
                                ]
                            )
                        }}
                    >
                        <Ionicons name="warning-outline" size={20} color={colors.error} />
                        <Text style={[styles.buttonText, { color: colors.error }]}>Reset Local Database</Text>
                    </HapticPressable>
                </View>
            )}

            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            )}
        </ScrollView>
    );
}

function StatRow({ label, value, color, highlight }: { label: string, value: number | string, color: string, highlight?: boolean }) {
    return (
        <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color }]}>{label}</Text>
            <Text style={[styles.statValue, { color, fontWeight: highlight ? 'bold' : 'normal' }]}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        marginLeft: 4,
    },
    card: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ccc',
    },
    statLabel: {
        fontSize: 16,
    },
    statValue: {
        fontSize: 16,
        fontVariant: ['tabular-nums'],
    },
    dbSelector: {
        paddingVertical: 8,
        paddingHorizontal: 4,
        gap: 8,
    },
    dbChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    dbChipText: {
        fontSize: 14,
        fontWeight: '600',
        maxWidth: 100,
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        marginTop: 8,
        gap: 6,
        marginHorizontal: 4,
    },
    warningText: {
        fontSize: 12,
        fontWeight: '500',
        flex: 1,
    },
    actions: {
        gap: 12,
        paddingBottom: 100,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});
