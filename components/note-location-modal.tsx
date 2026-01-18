import { Note } from '@/dev-data/data';
import { useNotesStore } from '@/stores/notes-store';
import React, { useEffect, useState } from 'react';
import LocationPickerModal from './location-picker-modal';

interface NoteLocationModalProps {
    visible: boolean;
    note: Note | null;
    onClose: () => void;
}

/**
 * Wrapper for moving notes using the navigable LocationPickerModal
 */
export default function NoteLocationModal({
    visible,
    note,
    onClose,
}: NoteLocationModalProps) {
    const { updateNote } = useNotesStore();
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

    // Reset state when note changes
    useEffect(() => {
        if (note) {
            setSelectedFolderId(note.folderId);
        }
    }, [note]);

    const handleSelect = (folderId: string | null) => {
        if (!note) return;

        updateNote(note.id, {
            folderId,
        });
        onClose();
    };

    if (!note) return null;

    return (
        <LocationPickerModal
            visible={visible}
            selectedParentId={selectedFolderId}
            onSelect={handleSelect}
            onClose={onClose}
        />
    );
}
