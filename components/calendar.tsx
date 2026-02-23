import ThemedText from '@/components/themed-text';
import { useSettingsStore } from '@/stores/settings-store';
import { useTasksStore } from '@/stores/tasks-store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

interface CalendarProps {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
}

const WEEKDAYS_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getStartOfWeek(date: Date, startOfWeek: 'sunday' | 'monday'): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = startOfWeek === 'sunday'
        ? day
        : (day === 0 ? 6 : day - 1);

    result.setDate(result.getDate() - diff);
    result.setHours(0, 0, 0, 0);
    return result;
}

function getWeekDays(startDate: Date): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return d;
    });
}

function formatDateRange(startDate: Date, endDate: Date): string {
    const startDay = startDate.getDate();
    const startMonth = startDate.getMonth() + 1;
    const endDay = endDate.getDate();
    const endMonth = endDate.getMonth() + 1;

    return `${startDay}.${startMonth} - ${endDay}.${endMonth}`;
}

export default function Calendar({ selectedDate, onDateSelect }: CalendarProps) {
    const { colors, dark } = useTheme();
    const today = useMemo(() => new Date(), []);
    const { general } = useSettingsStore();
    const startOfWeekSetting = general.startOfWeek;

    // Use a reference date to determine the current week view
    const [viewDate, setViewDate] = useState(() => getStartOfWeek(selectedDate, startOfWeekSetting));

    // Update viewDate if selectedDate changes significantly (outside current view)
    useEffect(() => {
        const selectedStart = getStartOfWeek(selectedDate, startOfWeekSetting);
        setViewDate(selectedStart);
    }, [selectedDate, startOfWeekSetting]);

    // Animation values for swipe
    const translateX = useSharedValue(0);
    const SWIPE_THRESHOLD = 50;

    const weekDays = useMemo(() => getWeekDays(viewDate), [viewDate]);
    const weekRange = useMemo(() => {
        const start = weekDays[0];
        const end = weekDays[6];
        return formatDateRange(start, end);
    }, [weekDays]);

    const isViewingCurrentWeek = useMemo(() => {
        const todayStart = getStartOfWeek(today, startOfWeekSetting);
        return viewDate.getTime() === todayStart.getTime();
    }, [viewDate, today, startOfWeekSetting]);

    // Get tasks from store
    const { tasks } = useTasksStore();
    const taskDates = useMemo(() => {
        const dates = new Set<string>();
        if (!tasks) return dates;

        tasks.forEach((task) => {
            const deadline = task.deadline;
            const taskDate = deadline instanceof Date ? deadline : new Date(deadline);

            if (isNaN(taskDate.getTime())) return;
            if (task.completed) return;

            // Store as YYYY-MM-DD string for easy lookup
            const dateStr = `${taskDate.getFullYear()}-${taskDate.getMonth()}-${taskDate.getDate()}`;
            dates.add(dateStr);
        });
        return dates;
    }, [tasks]);

    const handlePrevWeek = useCallback(() => {
        setViewDate(prev => {
            const next = new Date(prev);
            next.setDate(next.getDate() - 7);
            return next;
        });
    }, []);

    const handleNextWeek = useCallback(() => {
        setViewDate(prev => {
            const next = new Date(prev);
            next.setDate(next.getDate() + 7);
            return next;
        });
    }, []);

    const handleToday = useCallback(() => {
        const todayStart = getStartOfWeek(new Date(), startOfWeekSetting);
        setViewDate(todayStart);
        onDateSelect(new Date());
    }, [startOfWeekSetting, onDateSelect]);

    // Pan gesture for swiping between weeks
    const panGesture = Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-10, 10])
        .onUpdate((event) => {
            translateX.value = event.translationX * 0.4;
        })
        .onEnd((event) => {
            if (event.translationX > SWIPE_THRESHOLD) {
                runOnJS(handlePrevWeek)();
            } else if (event.translationX < -SWIPE_THRESHOLD) {
                runOnJS(handleNextWeek)();
            }
            translateX.value = withTiming(0, { duration: 300 });
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const isToday = (date: Date): boolean => {
        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        );
    };

    const isSelected = (date: Date): boolean => {
        return (
            date.getDate() === selectedDate.getDate() &&
            date.getMonth() === selectedDate.getMonth() &&
            date.getFullYear() === selectedDate.getFullYear()
        );
    };

    const weekdays = startOfWeekSetting === 'sunday' ? WEEKDAYS_SUN : WEEKDAYS_MON;

    return (
        <GestureDetector gesture={panGesture}>
            <View
                style={[
                    styles.container,
                    {
                        backgroundColor: dark ? 'rgba(255,255,255,0.03)' : colors.card,
                        borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    },
                ]}
            >
                {/* Header with Week Navigation */}
                <View style={styles.header}>
                    <Pressable onPress={handlePrevWeek} style={styles.navButton} hitSlop={12}>
                        <Ionicons name="chevron-back" size={20} color={colors.text + '80'} />
                    </Pressable>

                    <Pressable onPress={handleToday}>
                        <ThemedText style={[
                            styles.rangeTitle,
                            !isViewingCurrentWeek && { borderBottomWidth: 1, borderBottomColor: colors.text + '30' }
                        ]}>
                            {weekRange}
                        </ThemedText>
                    </Pressable>

                    <Pressable onPress={handleNextWeek} style={styles.navButton} hitSlop={12}>
                        <Ionicons name="chevron-forward" size={20} color={colors.text + '80'} />
                    </Pressable>
                </View>

                {/* Weekday Headers & Calendar Grid with Animation */}
                <Animated.View style={[styles.calendarContent, animatedStyle]}>
                    {/* Weekday Headers */}
                    <View style={styles.weekdayRow}>
                        {weekdays.map((day) => (
                            <View key={day} style={styles.weekdayCell}>
                                <ThemedText style={[styles.weekdayText, { color: colors.text + '40' }]}>
                                    {day}
                                </ThemedText>
                            </View>
                        ))}
                    </View>

                    {/* Week Grid (Only one row) */}
                    <View style={styles.weekRow}>
                        {weekDays.map((date, index) => {
                            const selected = isSelected(date);
                            const todayHighlight = isToday(date);
                            const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                            const hasTask = taskDates.has(dateStr);

                            return (
                                <Pressable
                                    key={index}
                                    style={styles.dayCell}
                                    onPress={() => onDateSelect(date)}
                                >
                                    <View
                                        style={[
                                            styles.dayInner,
                                            selected && styles.selectedDay,
                                            selected && { backgroundColor: colors.primary + '90' },
                                            todayHighlight && !selected && styles.todayDay,
                                            todayHighlight && !selected && { borderColor: colors.primary },
                                        ]}
                                    >
                                        <ThemedText
                                            style={[
                                                styles.dayText,
                                                selected && styles.selectedDayText,
                                                todayHighlight && !selected && { color: colors.primary, fontWeight: '700' },
                                            ]}
                                        >
                                            {date.getDate()}
                                        </ThemedText>
                                    </View>

                                    {/* Task Indicator Dot */}
                                    {hasTask && (
                                        <View
                                            style={[
                                                styles.taskDot,
                                                { backgroundColor: colors.primary },
                                            ]}
                                        />
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>
                </Animated.View>
            </View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 12,
        paddingBottom: 16,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    calendarContent: {
        overflow: 'hidden',
    },
    navButton: {
        padding: 4,
    },
    rangeTitle: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.5,
        paddingHorizontal: 6,
    },
    weekdayRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    weekdayCell: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 4,
    },
    weekdayText: {
        fontSize: 9,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    weekRow: {
        flexDirection: 'row',
    },
    dayCell: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 2,
        minHeight: 36,
    },
    dayInner: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayText: {
        fontSize: 14,
        fontWeight: '500',
    },
    selectedDay: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    selectedDayText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    todayDay: {
        borderWidth: 1.5,
    },
    taskDot: {
        position: 'absolute',
        top: -3,
        width: 3,
        height: 3,
        borderRadius: 1.5,
    },
});
