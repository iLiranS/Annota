import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useAppTheme } from '@/hooks/use-app-theme';
import { StorageService, useUserStore as useAuthStore } from '@annota/core';
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
        totalFiles: number;
        totalLinks: number;
        orphans: number;
        totalFilesSize: number;
        totalNotes: number;
        totalTasks: number;
        totalFolders: number;
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
            "This will delete all files that are not referenced by any note version. This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Unused Files",
                    style: "destructive",
                    onPress: () => {
                        setIsLoading(true);
                        setTimeout(async () => {
                            try {
                                const count = await StorageService.runGarbageCollection(true); // Force clean
                                Alert.alert("Cleanup Complete", `Deleted ${count} unused Files.`);
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
                            const { resetMasterKey } = require('@annota/core');
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
            const { useSyncStore } = require('@annota/core');
            await useSyncStore.getState().forceSync();

            Alert.alert("Sync Complete", "Successfully synchronized your data with the cloud.");
            await loadStats();
        } catch (error: any) {
            console.error("Manual Sync Error:", error);
            Alert.alert("Sync Failed", error?.message || "An unknown error occurred during sync.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetDatabase = async () => {
        Alert.alert(
            "Reset Local Database?",
            "This will completely erase all local notes, tasks, and files from your device. If you haven't synced, they will be lost forever.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset All",
                    style: "destructive",
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            const { resetAll } = require('@annota/core');
                            await resetAll();

                        } catch (e) {
                            console.error(e);
                            Alert.alert("Error", "Failed to reset database.");
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    }

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
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Storage Usage</Text>
                    <HapticPressable onPress={() => loadStats()} disabled={isLoading}>
                        <Ionicons name="refresh" size={18} color={colors.primary} style={isLoading ? { opacity: 0.5 } : {}} />
                    </HapticPressable>
                </View>
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <SettingItem
                        label="Files Size"
                        description="Physical files on device"
                        icon="file-tray-full"
                        iconBg="#3b82f6"
                        value={stats ? formatBytes(stats.totalFilesSize) : '...'}
                        colors={colors}
                    />
                    <Divider colors={colors} />
                    <SettingItem
                        label="Notes & Data Size"
                        description="Database file size (optimized)"
                        icon="document-text"
                        iconBg="#f59e0b"
                        value={stats ? formatBytes(stats.notesSize) : '...'}
                        colors={colors}
                    />
                    <Divider colors={colors} />
                    <SettingItem
                        label="Total Size"
                        description="Combined app data usage"
                        icon="pie-chart"
                        iconBg="#4f46e5"
                        value={stats ? formatBytes(stats.totalSize) : '...'}
                        colors={colors}
                        highlight
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Items Count</Text>
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <SettingItem
                        label="Total Notes"
                        icon="journal"
                        iconBg="#8b5cf6"
                        value={stats?.totalNotes ?? '...'}
                        colors={colors}
                    />
                    <Divider colors={colors} />
                    <SettingItem
                        label="Total Tasks"
                        icon="checkbox"
                        iconBg="#14b8a6"
                        value={stats?.totalTasks ?? '...'}
                        colors={colors}
                    />
                    <Divider colors={colors} />
                    <SettingItem
                        label="Total Folders"
                        icon="folder"
                        iconBg="#0ea5e9"
                        value={stats?.totalFolders ?? '...'}
                        colors={colors}
                    />
                    <Divider colors={colors} />
                    <SettingItem
                        label="Total Files"
                        icon="file-tray-full"
                        iconBg="#10b981"
                        value={stats?.totalFiles ?? '...'}
                        colors={colors}
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Database Actions</Text>
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {user && (
                        <>
                            <SettingItem
                                label="Sync with Cloud DB"
                                description="Force a full recursive sync"
                                icon="cloud-upload"
                                iconBg={colors.primary}
                                onPress={handleManualSync}
                                action={<Ionicons name="chevron-forward" size={16} color={colors.text + '60'} />}
                                colors={colors}
                            />
                            <Divider colors={colors} />
                            <SettingItem
                                label="Remove Master Key"
                                description="Clear encryption key from this device"
                                icon="key-outline"
                                iconBg="#f97316"
                                onPress={handleRemoveMasterKey}
                                action={<Ionicons name="chevron-forward" size={16} color={colors.text + '60'} />}
                                colors={colors}
                            />
                            <Divider colors={colors} />
                        </>
                    )}
                    <SettingItem
                        label="Shrink Database"
                        description="Remove unused files (GC)"
                        icon="trash-bin-outline"
                        iconBg={colors.primary}
                        onPress={handleGC}
                        action={<Ionicons name="chevron-forward" size={16} color={colors.text + '60'} />}
                        colors={colors}
                    />
                    <Divider colors={colors} />
                    <SettingItem
                        label="Reset Local Database"
                        description="Permanently delete ALL local data"
                        icon="warning-outline"
                        iconBg="#e11d48"
                        danger
                        onPress={handleResetDatabase}
                        action={<Ionicons name="chevron-forward" size={16} color={colors.text + '60'} />}
                        colors={colors}
                    />
                </View>
            </View>

            <View style={{ height: 100 }} />

            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            )}
        </ScrollView>
    );
}

function Divider({ colors }: { colors: any }) {
    return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 12 }} />;
}

function SettingItem({
    label,
    description,
    icon,
    iconBg,
    action,
    onPress,
    value,
    danger,
    colors,
    highlight
}: {
    label: string,
    description?: string,
    icon: keyof typeof Ionicons.glyphMap,
    iconBg: string,
    action?: React.ReactNode,
    onPress?: () => void,
    value?: React.ReactNode,
    danger?: boolean,
    colors: any,
    highlight?: boolean
}) {
    const Content = (
        <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
                    <Ionicons name={icon} size={20} color="#fff" />
                </View>
                <View style={styles.settingItemText}>
                    <Text style={[styles.settingItemLabel, { color: danger ? colors.error : colors.text }]}>
                        {label}
                    </Text>
                    {description && (
                        <Text style={[styles.settingItemDescription, { color: colors.text + '90' }]}>
                            {description}
                        </Text>
                    )}
                </View>
            </View>
            <View style={styles.settingItemRight}>
                {value !== undefined && (
                    <Text style={[styles.settingItemValue, { color: highlight ? colors.primary : colors.text, fontWeight: highlight ? 'bold' : '500' }]}>
                        {value}
                    </Text>
                )}
                {action}
            </View>
        </View>
    );

    if (onPress) {
        return (
            <HapticPressable onPress={onPress}>
                {Content}
            </HapticPressable>
        );
    }

    return Content;
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        opacity: 0.6,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginLeft: 4,
    },
    card: {
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
    },
    settingItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    settingItemText: {
        flexDirection: 'column',
        flex: 1,
    },
    settingItemLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    settingItemDescription: {
        fontSize: 12,
    },
    settingItemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    settingItemValue: {
        fontSize: 16,
        fontVariant: ['tabular-nums'],
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
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
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});
