import TipTapEditor from '@/components/tiptap-editor';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useNotesStore } from '@/stores/notes-store';
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
    const { getNoteVersion, revertNote } = useNotesStore();

    const [version, setVersion] = useState<{ id: string; content: string; createdAt: Date } | undefined>();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadVersion() {
            if (versionId) {
                const data = await getNoteVersion(versionId);
                setVersion(data);
                setIsLoading(false);
            }
        }
        loadVersion();
    }, [versionId, getNoteVersion]);

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
                    />
                </View>
            ) : (
                <View style={styles.center}>
                    <Text style={{ color: colors.text }}>Version not found</Text>
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
    }
});
