import { ImageGallery } from '@/components/editor-ui/image-gallery';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useNotesStore } from '@annota/core';
import TipTapEditor from '@annota/editor-ui';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { format } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from 'react-native';

export default function VersionDetail() {
    const { id, versionId } = useLocalSearchParams<{ id: string; versionId: string }>();
    const router = useRouter();
    const { colors } = useTheme();
    const { getNoteVersion, revertNote, deleteNoteVersion, getNoteVersions } = useNotesStore();

    const [version, setVersion] = useState<{ id: string; content: string; createdAt: Date } | undefined>();
    const [isLoading, setIsLoading] = useState(true);

    const [isLatest, setIsLatest] = useState(false);

    useEffect(() => {
        async function loadVersion() {
            if (versionId && id) {
                const [verData, allVersions] = await Promise.all([
                    getNoteVersion(versionId),
                    getNoteVersions(id)
                ]);

                setVersion(verData);

                // Check if this is the latest version
                // Assuming allVersions is sorted by date desc as per repo default
                if (allVersions.length > 0 && allVersions[0].id === versionId) {
                    setIsLatest(true);
                } else {
                    setIsLatest(false);
                }

                setIsLoading(false);
            }
        }
        loadVersion();
    }, [versionId, id, getNoteVersion, getNoteVersions]);

    const handleDelete = () => {
        Alert.alert(
            "Delete Version",
            "Are you sure you want to permanently delete this version?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        if (id && versionId) {
                            setIsLoading(true);
                            await deleteNoteVersion(id, versionId);
                            router.back();
                        }
                    }
                }
            ]
        );
    };

    const handleRevert = () => {
        Alert.alert(
            "Revert to this version?",
            "This will create a new version with this content. Current content will be saved as history.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Revert",
                    style: "default",
                    onPress: async () => {
                        if (id && versionId) {
                            await revertNote(id, versionId);
                            // Navigate back to the note editor
                            router.dismissAll();
                            router.replace({ pathname: '/Notes/[id]', params: { id } });
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: version ? format(new Date(version.createdAt), 'MMM d, h:mm a') : 'Version',
                    headerBackTitle: 'History',
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
                    headerRight: () => (
                        <HapticPressable
                            onPress={handleRevert}
                            disabled={isLoading || !version}
                            style={({ pressed }) => [
                                styles.headerTextButton,
                                pressed && { opacity: 0.5 }
                            ]}
                        >
                            <Text style={[styles.headerButtonText, { color: colors.primary }]}>
                                Revert
                            </Text>
                        </HapticPressable>
                    ),
                }}
            />

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : version ? (
                <View style={styles.editorContainer}>
                    <TipTapEditor
                        initialContent={version.content}
                        editable={false} // Read-only
                        placeholder=""
                        renderImageGallery={(props: any) => <ImageGallery {...props} />}
                    />
                </View>
            ) : (
                <View style={styles.center}>
                    <Text style={{ color: colors.text }}>Version not found</Text>
                </View>
            )}

            {/* Delete Button (Bottom Center) - Only if NOT latest */}
            {version && !isLoading && (
                <View style={[styles.bottomContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <HapticPressable
                        onPress={handleDelete}
                        style={[styles.deleteButton, isLatest && styles.disabledButton]}
                        disabled={isLatest}
                    >
                        <Text style={styles.deleteButtonText}>
                            {isLatest ? "Current Version" : "Delete Version"}
                        </Text>
                    </HapticPressable>
                </View>
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
    editorContainer: {
        flex: 1,
    },
    headerTextButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    headerButtonText: {
        fontSize: 17,
        fontWeight: '600',
    },
    bottomContainer: {
        padding: 16,
        paddingBottom: 32,
        borderTopWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
    },
    deleteButton: {
        backgroundColor: '#FF3B30', // System Red
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
    },
    deleteButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    disabledButton: {
        backgroundColor: '#CCC', // Disabled gray
        opacity: 0.8
    }
});
