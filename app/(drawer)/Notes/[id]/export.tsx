import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useNotesStore } from '@/stores/notes-store';
import { exportToMarkdown } from '@/utils/export/markdown-export';
import { exportToPDF } from '@/utils/export/pdf-export';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ExportScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { colors } = useTheme();
    const { getNoteVersion, getNoteVersions } = useNotesStore();

    const [isLoading, setIsLoading] = useState(true);
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [isExportingMD, setIsExportingMD] = useState(false);
    const [noteContent, setNoteContent] = useState<string | null>(null);
    const [noteTitle, setNoteTitle] = useState<string>('Exported Note');

    useEffect(() => {
        async function loadLatestContent() {
            if (!id) return;
            try {
                // Fetch the latest versions for the ID
                const versions = await getNoteVersions(id);
                if (versions.length > 0) {
                    const latestVersion = await getNoteVersion(versions[0].id);
                    if (latestVersion) {
                        setNoteContent(latestVersion.content);
                        // Let's grab the title from the store if possible, otherwise we do a best effort or default
                        // In a real scenario you might get it from a separate notes table via `getNoteById(id)`
                        setNoteTitle(`Note_${id.substring(0, 6)}`);
                    }
                }
            } catch (error) {
                console.error('Error loading note content:', error);
                Alert.alert('Error', 'Failed to load note content for export.');
            } finally {
                setIsLoading(false);
            }
        }
        loadLatestContent();
    }, [id, getNoteVersion, getNoteVersions]);

    const handleExportPDF = async () => {
        if (!noteContent) return;
        setIsExportingPDF(true);
        try {
            await exportToPDF(noteContent, noteTitle);
        } catch (error) {
            Alert.alert('Export Failed', 'Could not generate or share PDF.');
        } finally {
            setIsExportingPDF(false);
        }
    };

    const handleExportMD = async () => {
        if (!noteContent) return;
        setIsExportingMD(true);
        try {
            await exportToMarkdown(noteContent, noteTitle);
        } catch (error) {
            Alert.alert('Export Failed', 'Could not generate or share Markdown.');
        } finally {
            setIsExportingMD(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: 'Export Note',
                    headerLeft: () => (
                        <HapticPressable
                            onPress={() => router.back()}
                            style={[
                                styles.headerCircularButton,
                                { marginLeft: Platform.OS === 'ios' ? -4 : 0 }
                            ]}
                        >
                            <Ionicons name="close" size={26} color={colors.primary} />
                        </HapticPressable>
                    ),
                }}
            />

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : !noteContent ? (
                <View style={styles.center}>
                    <Text style={{ color: colors.text }}>No content available to export.</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.content}>
                        <Text style={[styles.description, { color: colors.text }]}>
                            Choose how you would like to export your note.
                        </Text>

                        {/* PDF Export Card */}
                        <HapticPressable
                            onPress={handleExportPDF}
                            disabled={isExportingPDF || isExportingMD}
                            style={[
                                styles.exportCard,
                                { backgroundColor: colors.card, borderColor: colors.border }
                            ]}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                                <Ionicons name="document-text" size={32} color={colors.primary} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>Export as PDF</Text>
                                <Text style={[styles.cardSubtitle, { color: colors.text + '80' }]}>
                                    Generates a printable PDF document with standard formatting.
                                </Text>
                            </View>
                            {isExportingPDF ? (
                                <ActivityIndicator color={colors.primary} />
                            ) : (
                                <Ionicons name="chevron-forward" size={24} color={colors.text + '50'} />
                            )}
                        </HapticPressable>

                        {/* Markdown Export Card */}
                        <HapticPressable
                            onPress={handleExportMD}
                            disabled={isExportingPDF || isExportingMD}
                            style={[
                                styles.exportCard,
                                { backgroundColor: colors.card, borderColor: colors.border }
                            ]}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                                <Ionicons name="logo-markdown" size={32} color={colors.primary} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>Export as Markdown</Text>
                                <Text style={[styles.cardSubtitle, { color: colors.text + '80' }]}>
                                    Converts content into plain text Markdown (.md) format.
                                </Text>
                            </View>
                            {isExportingMD ? (
                                <ActivityIndicator color={colors.primary} />
                            ) : (
                                <Ionicons name="chevron-forward" size={24} color={colors.text + '50'} />
                            )}
                        </HapticPressable>
                    </View>
                </ScrollView>
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
    },
    scrollContent: {
        paddingBottom: 40,
    },
    content: {
        padding: 20,
        gap: 20,
    },
    description: {
        fontSize: 16,
        marginBottom: 8,
        opacity: 0.8,
    },
    exportCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        gap: 16,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTextContainer: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 14,
        lineHeight: 20,
    },
});
