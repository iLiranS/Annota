import ThemedText from '@/components/themed-text';
import { DUMMY_NOTES } from '@/dev-data/data';
import { useTasksStore } from '@/stores/tasks-store';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@react-navigation/native';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TaskEditScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { colors, dark } = useTheme();
    const insets = useSafeAreaInsets();

    // Get task from store
    const { getTaskById, updateTask } = useTasksStore();
    const task = getTaskById(id);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [deadline, setDeadline] = useState(new Date());
    const [completed, setCompleted] = useState(false);
    const [linkedNoteId, setLinkedNoteId] = useState<string | null>(null);

    // Date picker state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showNotePicker, setShowNotePicker] = useState(false);

    // Initialize form when task is found
    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setDescription(task.description);
            setDeadline(new Date(task.deadline));
            setCompleted(task.completed);
            setLinkedNoteId(task.linkedNoteId);
        }
    }, [task]);

    const linkedNote = useMemo(
        () => (linkedNoteId ? DUMMY_NOTES.find((n) => n.id === linkedNoteId) : null),
        [linkedNoteId]
    );

    const handleSave = () => {
        if (!task) return;

        updateTask(task.id, {
            title: title.trim() || 'Untitled Task',
            description: description.trim(),
            deadline,
            completed,
            linkedNoteId,
        });

        router.back();
    };

    const handleClose = () => {
        router.back();
    };

    const handleDateChange = (event: unknown, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }

        if (selectedDate) {
            const newDeadline = new Date(deadline);
            newDeadline.setFullYear(selectedDate.getFullYear());
            newDeadline.setMonth(selectedDate.getMonth());
            newDeadline.setDate(selectedDate.getDate());
            setDeadline(newDeadline);
        }
    };

    const handleTimeChange = (event: unknown, selectedTime?: Date) => {
        if (Platform.OS === 'android') {
            setShowTimePicker(false);
        }

        if (selectedTime) {
            const newDeadline = new Date(deadline);
            newDeadline.setHours(selectedTime.getHours());
            newDeadline.setMinutes(selectedTime.getMinutes());
            setDeadline(newDeadline);
        }
    };

    const toggleDatePicker = () => {
        if (showDatePicker) {
            setShowDatePicker(false);
        } else {
            setShowTimePicker(false);
            setShowDatePicker(true);
        }
    };

    const toggleTimePicker = () => {
        if (showTimePicker) {
            setShowTimePicker(false);
        } else {
            setShowDatePicker(false);
            setShowTimePicker(true);
        }
    };

    const formatDate = (date: Date): string => {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatTime = (date: Date): string => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const inputBgColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    const inputBorderColor = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

    // Show not found state if task doesn't exist
    if (!task) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <Stack.Screen
                    options={{
                        headerShown: true,
                        title: 'Task Not Found',
                        headerLeft: () => (
                            <Pressable onPress={handleClose} style={styles.headerButton} hitSlop={8}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </Pressable>
                        ),
                    }}
                />
                <View style={styles.notFoundContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color={colors.text + '40'} />
                    <ThemedText style={[styles.notFoundText, { color: colors.text + '60' }]}>
                        Task not found
                    </ThemedText>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Edit Task',
                    headerLeft: () => (
                        <Pressable onPress={handleClose} style={styles.headerButton} hitSlop={8}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </Pressable>
                    ),
                    headerRight: () => (
                        <Pressable onPress={handleSave} style={styles.saveButton} hitSlop={8}>
                            <ThemedText style={styles.saveButtonText}>Save</ThemedText>
                        </Pressable>
                    ),
                }}
            />

            <KeyboardAvoidingView
                style={styles.keyboardContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Title */}
                    <View style={styles.field}>
                        <ThemedText style={[styles.label, { color: colors.text + '80' }]}>Title</ThemedText>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: inputBgColor,
                                    borderColor: inputBorderColor,
                                    color: colors.text,
                                },
                            ]}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Task title"
                            placeholderTextColor={colors.text + '40'}
                        />
                    </View>

                    {/* Description */}
                    <View style={styles.field}>
                        <ThemedText style={[styles.label, { color: colors.text + '80' }]}>
                            Description
                        </ThemedText>
                        <TextInput
                            style={[
                                styles.input,
                                styles.textArea,
                                {
                                    backgroundColor: inputBgColor,
                                    borderColor: inputBorderColor,
                                    color: colors.text,
                                },
                            ]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Add a description..."
                            placeholderTextColor={colors.text + '40'}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Deadline */}
                    <View style={styles.field}>
                        <ThemedText style={[styles.label, { color: colors.text + '80' }]}>Deadline</ThemedText>
                        <View style={styles.dateTimeRow}>
                            <Pressable
                                style={[
                                    styles.dateTimeButton,
                                    {
                                        backgroundColor: showDatePicker ? colors.primary + '15' : inputBgColor,
                                        borderColor: showDatePicker ? colors.primary : inputBorderColor,
                                    },
                                ]}
                                onPress={toggleDatePicker}
                            >
                                <Ionicons
                                    name="calendar-outline"
                                    size={18}
                                    color={showDatePicker ? colors.primary : colors.primary}
                                />
                                <ThemedText
                                    style={[styles.dateTimeText, showDatePicker && { color: colors.primary }]}
                                >
                                    {formatDate(deadline)}
                                </ThemedText>
                            </Pressable>

                            <Pressable
                                style={[
                                    styles.dateTimeButton,
                                    {
                                        backgroundColor: showTimePicker ? colors.primary + '15' : inputBgColor,
                                        borderColor: showTimePicker ? colors.primary : inputBorderColor,
                                    },
                                ]}
                                onPress={toggleTimePicker}
                            >
                                <Ionicons
                                    name="time-outline"
                                    size={18}
                                    color={showTimePicker ? colors.primary : colors.primary}
                                />
                                <ThemedText
                                    style={[styles.dateTimeText, showTimePicker && { color: colors.primary }]}
                                >
                                    {formatTime(deadline)}
                                </ThemedText>
                            </Pressable>
                        </View>

                        {/* Date/Time Pickers (Inline) */}
                        {showDatePicker && (
                            <View style={styles.pickerContainer}>
                                <DateTimePicker
                                    value={deadline}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={handleDateChange}
                                    textColor={colors.text}
                                    themeVariant={dark ? 'dark' : 'light'}
                                />
                            </View>
                        )}

                        {showTimePicker && (
                            <View style={styles.pickerContainer}>
                                <DateTimePicker
                                    value={deadline}
                                    mode="time"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={handleTimeChange}
                                    textColor={colors.text}
                                    themeVariant={dark ? 'dark' : 'light'}
                                />
                            </View>
                        )}
                    </View>

                    {/* Completed Toggle */}
                    <Pressable
                        style={[
                            styles.toggleRow,
                            {
                                backgroundColor: inputBgColor,
                                borderColor: inputBorderColor,
                            },
                        ]}
                        onPress={() => setCompleted(!completed)}
                    >
                        <View style={styles.toggleLabel}>
                            <Ionicons
                                name={completed ? 'checkmark-circle' : 'ellipse-outline'}
                                size={22}
                                color={completed ? '#10B981' : colors.text + '60'}
                            />
                            <ThemedText style={styles.toggleText}>Mark as completed</ThemedText>
                        </View>
                        <View
                            style={[
                                styles.toggleSwitch,
                                { backgroundColor: completed ? '#10B981' : colors.text + '20' },
                            ]}
                        >
                            <View
                                style={[
                                    styles.toggleKnob,
                                    { transform: [{ translateX: completed ? 18 : 2 }] },
                                ]}
                            />
                        </View>
                    </Pressable>

                    {/* Linked Note */}
                    <View style={styles.field}>
                        <ThemedText style={[styles.label, { color: colors.text + '80' }]}>
                            Linked Note (Optional)
                        </ThemedText>
                        <Pressable
                            style={[
                                styles.noteSelector,
                                {
                                    backgroundColor: inputBgColor,
                                    borderColor: linkedNoteId ? colors.primary : inputBorderColor,
                                },
                            ]}
                            onPress={() => setShowNotePicker(!showNotePicker)}
                        >
                            {linkedNote ? (
                                <View style={styles.selectedNote}>
                                    <Link push href={`/Notes/${linkedNote.id}`}>
                                        <Ionicons name="document-text" size={18} color={colors.primary} />
                                        <ThemedText style={styles.selectedNoteText} numberOfLines={1}>
                                            {linkedNote.title}
                                        </ThemedText>
                                    </Link>
                                    <Pressable
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            setLinkedNoteId(null);
                                        }}
                                        hitSlop={8}
                                    >
                                        <Ionicons name="close-circle" size={18} color={colors.text + '60'} />
                                    </Pressable>
                                </View>
                            ) : (
                                <View style={styles.notePlaceholder}>
                                    <Ionicons name="add-circle-outline" size={18} color={colors.text + '50'} />
                                    <ThemedText style={[styles.notePlaceholderText, { color: colors.text + '50' }]}>
                                        Link a note
                                    </ThemedText>
                                </View>
                            )}
                            <Ionicons
                                name={showNotePicker ? 'chevron-up' : 'chevron-down'}
                                size={18}
                                color={colors.text + '50'}
                            />
                        </Pressable>

                        {/* Note Picker Dropdown */}
                        {showNotePicker && (
                            <View
                                style={[
                                    styles.notePickerDropdown,
                                    {
                                        backgroundColor: dark ? colors.card : '#FFFFFF',
                                        borderColor: inputBorderColor,
                                    },
                                ]}
                            >
                                {DUMMY_NOTES.map((note) => (
                                    <Pressable
                                        key={note.id}
                                        style={[
                                            styles.notePickerItem,
                                            linkedNoteId === note.id && {
                                                backgroundColor: colors.primary + '15',
                                            },
                                        ]}
                                        onPress={() => {
                                            setLinkedNoteId(note.id);
                                            setShowNotePicker(false);
                                        }}
                                    >
                                        <Ionicons
                                            name="document-text"
                                            size={16}
                                            color={linkedNoteId === note.id ? colors.primary : colors.text + '60'}
                                        />
                                        <View style={styles.notePickerItemContent}>
                                            <ThemedText
                                                style={[
                                                    styles.notePickerItemTitle,
                                                    linkedNoteId === note.id && { color: colors.primary },
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {note.title}
                                            </ThemedText>
                                            <ThemedText
                                                style={[styles.notePickerItemPreview, { color: colors.text + '50' }]}
                                                numberOfLines={1}
                                            >
                                                {note.preview}
                                            </ThemedText>
                                        </View>
                                        {linkedNoteId === note.id && (
                                            <Ionicons name="checkmark" size={18} color={colors.primary} />
                                        )}
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Bottom Spacing */}
                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardContainer: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    headerButton: {
        padding: 4,
    },
    saveButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    saveButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    notFoundContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    notFoundText: {
        fontSize: 18,
        fontWeight: '600',
    },
    field: {
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    input: {
        fontSize: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    textArea: {
        minHeight: 80,
        paddingTop: 12,
    },
    dateTimeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    dateTimeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    dateTimeText: {
        fontSize: 14,
        fontWeight: '500',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 20,
    },
    toggleLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    toggleText: {
        fontSize: 15,
        fontWeight: '500',
    },
    toggleSwitch: {
        width: 44,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
    },
    toggleKnob: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    noteSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    selectedNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    selectedNoteText: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    notePlaceholder: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    notePlaceholderText: {
        fontSize: 14,
    },
    notePickerDropdown: {
        marginTop: 8,
        borderRadius: 10,
        borderWidth: 1,
        maxHeight: 200,
        overflow: 'hidden',
    },
    notePickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 10,
    },
    notePickerItemContent: {
        flex: 1,
    },
    notePickerItemTitle: {
        fontSize: 14,
        fontWeight: '500',
    },
    notePickerItemPreview: {
        fontSize: 12,
        marginTop: 2,
    },
    pickerContainer: {
        marginTop: 12,
        alignItems: 'center',
    },
});
