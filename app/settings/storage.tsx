import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useAppTheme } from '@/hooks/use-app-theme';
import { StorageService } from '@/lib/services/storage.service';
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
    const { colors } = useAppTheme();
    const [stats, setStats] = useState<{
        totalImages: number;
        totalLinks: number;
        orphans: number;
        totalImagesSize: number;
        notesSize: number;
        totalSize: number;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const loadStats = async () => {
        setIsLoading(true);
        try {
            const s = await StorageService.getStats();
            setStats(s);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    const handleGC = () => {
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

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ title: 'Storage & Debug' }} />

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

            <View style={styles.actions}>
                <HapticPressable
                    style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={loadStats}
                >
                    <Ionicons name="refresh" size={20} color={colors.primary} />
                    <Text style={[styles.buttonText, { color: colors.primary }]}>Refresh Stats</Text>
                </HapticPressable>

                <HapticPressable
                    style={[styles.button, { backgroundColor: colors.errorBackground || '#fee2e2', borderColor: colors.error }]}
                    onPress={handleGC}
                >
                    <Ionicons name="trash-bin-outline" size={20} color={colors.error} />
                    <Text style={[styles.buttonText, { color: colors.error }]}>Shrink Database</Text>
                </HapticPressable>
            </View>

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
    actions: {
        gap: 12,
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
