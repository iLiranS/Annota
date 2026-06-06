import { HapticPressable } from '@/components/ui/haptic-pressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';

interface PublishedNotesModalProps {
    visible: boolean;
    notes: any[];
    colors: any;
    onClose: () => void;
    onPressNote: (id: string) => void;
}

export function PublishedNotesModal({
    visible,
    notes,
    colors,
    onClose,
    onPressNote
}: PublishedNotesModalProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <HapticPressable
                style={styles.modalOverlay}
                onPress={onClose}
            >
                <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.modalHeader}>
                        <View style={{ gap: 2, flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="globe-outline" size={20} color="#3B82F6" style={{ marginRight: 6 }} />
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Published Notes ({notes.length})</Text>
                        </View>
                        <HapticPressable onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </HapticPressable>
                    </View>

                    <ScrollView style={styles.modalScroll}>
                        {notes.length === 0 ? (
                            <View style={styles.emptyNotes}>
                                <Ionicons name="globe-outline" size={32} color={colors.text + '20'} />
                                <Text style={[styles.emptyNotesText, { color: colors.text + '40' }]}>
                                    No published notes found
                                </Text>
                            </View>
                        ) : (
                            notes.map((note) => (
                                <HapticPressable
                                    key={note.id}
                                    onPress={() => onPressNote(note.id)}
                                    style={({ pressed }) => [
                                        styles.noteItem,
                                        { borderBottomColor: colors.border },
                                        pressed && { transform: [{ scale: 0.98 }] }
                                    ]}
                                >
                                    {({ pressed }) => (
                                        <>
                                            <View style={styles.noteItemLeft}>
                                                <Ionicons
                                                    name="document-text"
                                                    size={20}
                                                    color={colors.primary}
                                                />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[
                                                        styles.noteItemTitle,
                                                        { color: pressed ? colors.text + '60' : colors.text }
                                                    ]} numberOfLines={1}>
                                                        {note.title || "Untitled Note"}
                                                    </Text>
                                                    {note.preview ? (
                                                        <Text style={{ fontSize: 11, color: colors.text + '50', marginTop: 2 }} numberOfLines={1}>
                                                            {note.preview}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color={pressed ? colors.text + '10' : colors.text + '20'} />
                                        </>
                                    )}
                                </HapticPressable>
                            ))
                        )}
                    </ScrollView>
                </View>
            </HapticPressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxHeight: '70%',
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingBottom: 8,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalScroll: {
        padding: 16,
    },
    noteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    noteItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    noteItemTitle: {
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
    },
    emptyNotes: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    emptyNotesText: {
        fontSize: 14,
        textAlign: 'center',
        opacity: 0.6,
        paddingHorizontal: 20,
    },
});
