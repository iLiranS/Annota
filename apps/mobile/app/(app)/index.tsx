import { useAppTheme } from '@/hooks/use-app-theme';
import { useNotesStore } from '@annota/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
    const router = useRouter();
    const pathname = usePathname();
    const theme = useAppTheme();
    const isInitialized = useNotesStore(state => state.isInitialized);
    const getNoteById = useNotesStore(state => state.getNoteById);

    useEffect(() => {
        if (!isInitialized) return;

        // If the current route is not the root index, do not redirect
        // (this prevents overriding deep links/share sheet routes on cold boot)
        if (pathname !== '/' && pathname !== '') {
            return;
        }

        const checkLastViewedNote = async () => {
            try {
                const noteId = await AsyncStorage.getItem('@last_viewed_note_id');
                const noteAtStr = await AsyncStorage.getItem('@last_viewed_note_at');

                if (noteId && noteAtStr) {
                    const noteAt = parseInt(noteAtStr, 10);
                    const oneHour = 60 * 60 * 1000;
                    if (Date.now() - noteAt < oneHour) {
                        const note = getNoteById(noteId);
                        if (note && !note.isDeleted && !note.isPermDeleted) {
                            router.replace({ pathname: '/Notes/[id]', params: { id: noteId } });
                            return;
                        }
                    }
                }
            } catch (e) {
                console.error('Error checking last viewed note:', e);
            }

            router.replace('/home');
        };

        checkLastViewedNote();
    }, [isInitialized, pathname]);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
    );
}
