import LocationPickerModal from '@/components/location-picker-modal';
import FolderEditModal from '../folder-edit-modal';
import ThemedText from '@/components/themed-text';
import { useNotesStore } from '@annota/core';
import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
    Image,
    KeyboardAvoidingView,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { insertTaskSchema } from '@annota/core';

// Define schema using drizzle-zod with custom validations
const taskFormSchema = insertTaskSchema;

export type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
    initialValues?: Partial<TaskFormValues>;
    onSubmit: (values: TaskFormValues) => void;
    onDelete?: () => void;
    initialDate?: Date;
    submitLabel?: string;
}

export default function TaskForm({
    initialValues,
    onSubmit,
    onDelete,
    initialDate = new Date(),
    submitLabel = 'Save',
}: TaskFormProps) {
    const { colors, dark } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { notes, folders, getNoteById } = useNotesStore();

    // Setup React Hook Form
    const {
        control,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<TaskFormValues>({
        // @ts-ignore - Resolver type mismatch with complex transform schemas
        resolver: zodResolver(taskFormSchema),
        defaultValues: {
            title: initialValues?.title || '',
            description: initialValues?.description || '',
            deadline: initialValues?.deadline ? new Date(initialValues.deadline) : new Date(initialDate.setHours(new Date().getHours() + 1)),
            isWholeDay: initialValues?.isWholeDay || false,
            completed: initialValues?.completed || false,
            folderId: initialValues?.folderId || null,
            links: initialValues?.links || '[]',
        },
    });


    const [localLinks, setLocalLinks] = useState<string[]>(() => {
        try {
            return JSON.parse(initialValues?.links || '[]');
        } catch {
            return [];
        }
    });
    const [newLink, setNewLink] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [isNewFolderModalVisible, setIsNewFolderModalVisible] = useState(false);
    const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

    const folderId = watch('folderId');
    const deadline = watch('deadline');
    const isWholeDay = watch('isWholeDay');
    const completed = watch('completed');

    const linkedFolder = folderId ? folders.find((f) => f.id === folderId) : null;

    // Reset time when Whole Day is toggled on (optional UX choice)
    useEffect(() => {
        if (isWholeDay) {
            // Set to end of day as per requirements
            const newDate = new Date(deadline);
            newDate.setHours(23, 59, 59, 999);
            setValue('deadline', newDate);
        }
    }, [isWholeDay]);



    const handleDateChange = (event: unknown, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (selectedDate) {
            const newDeadline = new Date(deadline);
            newDeadline.setFullYear(selectedDate.getFullYear());
            newDeadline.setMonth(selectedDate.getMonth());
            newDeadline.setDate(selectedDate.getDate());
            setValue('deadline', newDeadline);
        }
    };

    const handleTimeChange = (event: unknown, selectedTime?: Date) => {
        if (Platform.OS === 'android') setShowTimePicker(false);
        if (selectedTime) {
            const newDeadline = new Date(deadline);
            newDeadline.setHours(selectedTime.getHours());
            newDeadline.setMinutes(selectedTime.getMinutes());
            setValue('deadline', newDeadline);
        }
    };

    const toggleDatePicker = () => {
        if (showDatePicker) {
            setShowDatePicker(false);
        } else if (showTimePicker) {
            // Close time picker first, then open date picker after a brief delay
            setShowTimePicker(false);
            setTimeout(() => setShowDatePicker(true), 150);
        } else {
            setShowDatePicker(true);
        }
    };

    const toggleTimePicker = () => {
        if (showTimePicker) {
            setShowTimePicker(false);
        } else if (showDatePicker) {
            // Close date picker first, then open time picker after a brief delay
            setShowDatePicker(false);
            setTimeout(() => setShowTimePicker(true), 150);
        } else {
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

    return (
        <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} // Extra padding for buttons
                showsVerticalScrollIndicator={false}
            >
                {/* Title */}
                <View style={styles.field}>
                    <ThemedText style={[styles.label, { color: colors.text + '80' }]}>Title</ThemedText>
                    <Controller
                        control={control}
                        name="title"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: inputBgColor,
                                        borderColor: errors.title ? '#EF4444' : inputBorderColor,
                                        color: colors.text,
                                    },
                                ]}
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                placeholder="Task title"
                                placeholderTextColor={colors.text + '40'}
                            />
                        )}
                    />
                    {errors.title && (
                        <ThemedText style={styles.errorText}>{errors.title.message}</ThemedText>
                    )}
                </View>

                {/* Links */}
                <View style={styles.field}>
                    <View style={styles.labelRow}>
                        <ThemedText style={[styles.label, { color: colors.text + '80', marginBottom: 0 }]}>
                            Links
                        </ThemedText>
                        {localLinks.length < 5 ? (
                            <Pressable
                                style={styles.compactCheckbox}
                                onPress={() => setShowLinkInput(!showLinkInput)}
                                hitSlop={8}
                            >
                                <Ionicons
                                    name={showLinkInput ? 'close' : 'add'}
                                    size={18}
                                    color={colors.primary}
                                />
                                <ThemedText style={[styles.compactCheckboxLabel, { color: colors.primary }]}>
                                    {showLinkInput ? 'Cancel' : 'Add Link'}
                                </ThemedText>
                            </Pressable>
                        ) : (
                            <ThemedText style={[styles.compactCheckboxLabel, { color: colors.text + '40' }]}>
                                Max 5 links reached
                            </ThemedText>
                        )}
                    </View>

                    {showLinkInput && (
                        <View style={styles.linkInputContainer}>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: inputBgColor,
                                        borderColor: inputBorderColor,
                                        color: colors.text,
                                        flex: 1,
                                    },
                                ]}
                                value={newLink}
                                onChangeText={setNewLink}
                                placeholder="https://..."
                                placeholderTextColor={colors.text + '40'}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="url"
                                onSubmitEditing={() => {
                                    if (newLink.trim() && localLinks.length < 5) {
                                        const updated = [...localLinks, newLink.trim()];
                                        setLocalLinks(updated);
                                        setValue('links', JSON.stringify(updated));
                                        setNewLink('');
                                        setShowLinkInput(false);
                                    }
                                }}
                            />
                            <Pressable
                                style={[styles.addLinkButton, { backgroundColor: colors.primary }]}
                                onPress={() => {
                                    if (newLink.trim() && localLinks.length < 5) {
                                        const updated = [...localLinks, newLink.trim()];
                                        setLocalLinks(updated);
                                        setValue('links', JSON.stringify(updated));
                                        setNewLink('');
                                        setShowLinkInput(false);
                                    }
                                }}
                            >
                                <Ionicons name="checkmark" size={20} color="#fff" />
                            </Pressable>
                        </View>
                    )}

                    {localLinks.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.linksContainer}
                        >
                            {localLinks.map((link, index) => {
                                let text = link;
                                let isAnnota = false;

                                if (link.startsWith('annota://note/')) {
                                    const match = link.match(/^annota:\/\/note\/([a-f0-9\-]+)/i);
                                    if (match) {
                                        const noteId = match[1];
                                        const note = getNoteById(noteId);
                                        text = note ? note.title : 'Unknown Note';
                                        isAnnota = true;
                                    }
                                } else {
                                    const domainMatch = link.match(/^(?:https?:\/\/)?(?:www\.)?([^\/?#]+)/i);
                                    if (domainMatch) {
                                        const domain = domainMatch[1];
                                        // Strip the TLD (everything after the last dot)
                                        text = domain.includes('.') ? domain.split('.').slice(0, -1).join('.') : domain;
                                    }
                                }

                                return (
                                    <View key={index} style={[styles.linkChip, { backgroundColor: inputBgColor, borderColor: inputBorderColor }]}>
                                        <Pressable
                                            onPress={() => {
                                                if (isAnnota) {
                                                    const match = link.match(/^annota:\/\/note\/([a-f0-9\-]+)/i);
                                                    if (match) {
                                                        const noteId = match[1];
                                                        router.replace({ pathname: '/Notes/[id]', params: { id: noteId } });
                                                    }
                                                } else {
                                                    Linking.openURL(link).catch(err => console.error("Couldn't load page", err));
                                                }
                                            }}
                                            style={({ pressed }) => [
                                                styles.linkMainPressable,
                                                pressed && { opacity: 0.7 }
                                            ]}
                                        >
                                            {isAnnota ? (
                                                <Image
                                                    source={require('@/assets/images/icon.png')}
                                                    style={{ width: 14, height: 14 }}
                                                    resizeMode="contain"
                                                />
                                            ) : (
                                                <Ionicons name="link" size={14} color={colors.text + '80'} />
                                            )}
                                            <ThemedText style={styles.linkText} numberOfLines={1}>
                                                {text}
                                            </ThemedText>
                                        </Pressable>

                                        <Pressable
                                            onPress={() => {
                                                const updated = localLinks.filter((_, i) => i !== index);
                                                setLocalLinks(updated);
                                                setValue('links', JSON.stringify(updated));
                                            }}
                                            hitSlop={12}
                                            style={({ pressed }) => [
                                                styles.removeLinkBtn,
                                                pressed && { opacity: 0.5 }
                                            ]}
                                        >
                                            <Ionicons name="close" size={16} color={colors.text + '60'} />
                                        </Pressable>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>

                {/* Description */}
                <View style={styles.field}>
                    <ThemedText style={[styles.label, { color: colors.text + '80' }]}>
                        Description
                    </ThemedText>
                    <Controller
                        control={control}
                        name="description"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                                style={[
                                    styles.input,
                                    styles.textArea,
                                    {
                                        backgroundColor: inputBgColor,
                                        borderColor: errors.description ? '#EF4444' : inputBorderColor,
                                        color: colors.text,
                                    },
                                ]}
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                placeholder="Add a description..."
                                placeholderTextColor={colors.text + '40'}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                                blurOnSubmit={true}
                                returnKeyType="done"
                            />
                        )}
                    />
                    {errors.description && (
                        <ThemedText style={styles.errorText}>{errors.description.message}</ThemedText>
                    )}
                </View>



                {/* Deadline */}
                <View style={styles.field}>
                    <View style={styles.labelRow}>
                        <ThemedText style={[styles.label, { color: colors.text + '80', marginBottom: 0 }]}>
                            Deadline
                        </ThemedText>
                        <Pressable
                            style={styles.compactCheckbox}
                            onPress={() => setValue('isWholeDay', !isWholeDay)}
                            hitSlop={8}
                        >
                            <Ionicons
                                name={isWholeDay ? 'checkbox' : 'square-outline'}
                                size={18}
                                color={isWholeDay ? colors.primary : colors.text + '40'}
                            />
                            <ThemedText style={[styles.compactCheckboxLabel, { color: colors.text + '60' }]}>
                                Whole Day
                            </ThemedText>
                        </Pressable>
                    </View>
                    <View style={styles.dateTimeRow}>
                        {/* DATE PICKER (Always visible) */}
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

                        {/* TIME PICKER (Hidden if Whole Day) */}
                        {!isWholeDay && (
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
                        )}
                    </View>

                    {/* Pickers Inline */}
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

                    {!isWholeDay && showTimePicker && (
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

                {/* Completed Toggle - Only show for existing tasks */}
                {onDelete && (
                    <Pressable
                        style={[
                            styles.toggleRow,
                            {
                                backgroundColor: inputBgColor,
                                borderColor: inputBorderColor,
                                marginBottom: 20,
                            },
                        ]}
                        onPress={() => setValue('completed', !completed)}
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
                )}

                {/* Linked Folder */}
                <View style={[styles.field, { marginTop: 20 }]}>
                    <ThemedText style={[styles.label, { color: colors.text + '80' }]}>
                        Linked Folder (Optional)
                    </ThemedText>
                    <Pressable
                        style={[
                            styles.noteSelector,
                            {
                                backgroundColor: inputBgColor,
                                borderColor: folderId ? colors.primary : inputBorderColor,
                            },
                        ]}
                        onPress={() => setShowFolderPicker(true)}
                    >
                        {linkedFolder ? (
                            <View style={styles.selectedNote}>
                                <Ionicons name={linkedFolder.icon as any} size={18} color={linkedFolder.color || colors.primary} />
                                <ThemedText style={styles.selectedNoteText} numberOfLines={1}>
                                    {linkedFolder.name}
                                </ThemedText>
                                <Pressable
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        setValue('folderId', null);
                                    }}
                                    hitSlop={8}
                                >
                                    <Ionicons name="close-circle" size={18} color={colors.text + '60'} />
                                </Pressable>
                            </View>
                        ) : (
                            <View style={styles.notePlaceholder}>
                                <Ionicons name="folder-outline" size={18} color={colors.text + '50'} />
                                <ThemedText style={[styles.notePlaceholderText, { color: colors.text + '50' }]}>
                                    Link a folder
                                </ThemedText>
                            </View>
                        )}
                        <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={colors.text + '50'}
                        />
                    </Pressable>
                </View>

                {/* Location Picker Modal */}
                <LocationPickerModal
                    visible={showFolderPicker}
                    selectedParentId={folderId ?? null}
                    onSelect={(parentId) => {
                        setValue('folderId', parentId);
                        setShowFolderPicker(false);
                    }}
                    onClose={() => setShowFolderPicker(false)}
                />

                {/* Actions */}
                <View style={{ marginTop: 30, gap: 12 }}>
                    <Pressable
                        style={[styles.saveButton, { backgroundColor: colors.primary }]}
                        onPress={handleSubmit(onSubmit as any)}
                    >
                        <ThemedText style={styles.saveButtonText}>{submitLabel}</ThemedText>
                    </Pressable>

                    {onDelete && (
                        <Pressable
                            style={[styles.deleteButton, { backgroundColor: '#EF4444' + '15' }]}
                            onPress={onDelete}
                        >
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                            <ThemedText style={[styles.deleteButtonText, { color: '#EF4444' }]}>
                                Delete Task
                            </ThemedText>
                        </Pressable>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    keyboardContainer: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 20,
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
    errorText: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 4,
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
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    compactCheckbox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    compactCheckboxLabel: {
        fontSize: 12,
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
    saveButton: {
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 10,
    },
    deleteButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    linkInputContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    addLinkButton: {
        width: 48,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    linksContainer: {
        gap: 8,
        paddingVertical: 4,
    },
    linkChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        maxWidth: 240,
        marginRight: 8,
        overflow: 'hidden',
    },
    linkMainPressable: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 12,
        paddingRight: 8,
        paddingVertical: 10,
        flexShrink: 1,
    },
    linkText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#3B82F6',
    },
    removeLinkBtn: {
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderLeftColor: 'rgba(0,0,0,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
