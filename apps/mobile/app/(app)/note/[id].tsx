import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Deep link redirect route.
 * 
 * When `annota://note/{id}` is opened externally, Expo Router resolves
 * it to this file (`app/note/[id].tsx`). We immediately redirect to the
 * real note screen at `Notes/[id]` using `<Redirect>`, which replaces
 * this entry in the navigation stack so pressing back won't land here.
 */
export default function NoteDeepLinkRedirect() {
    const { id, elementId, blockId } = useLocalSearchParams<{ id: string; elementId?: string; blockId?: string }>();
    const targetElementId = elementId || blockId;

    return (
        <Redirect
            href={{
                pathname: '/Notes/[id]',
                params: {
                    id: id,
                    source: 'link',
                    ...(targetElementId ? { scrollToElementId: targetElementId } : {}),
                },
            }}
        />
    );
}
