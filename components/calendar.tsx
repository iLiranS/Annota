import ThemedText from '@/components/themed-text';
import { useTasksStore } from '@/stores/tasks-store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
}

export default function Calendar({ selectedDate, onDateSelect }: CalendarProps) {
    const { colors, dark } = useTheme();
    const today = useMemo(() => new Date(), []);

    const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

    // Animation values for swipe
    const translateX = useSharedValue(0);
    const SWIPE_THRESHOLD = 50;

    // Get tasks from store
    const { tasks } = useTasksStore();
    const taskDates = useMemo(() => {
        const dates = new Set<number>();
        if (!tasks) return dates;

        tasks.forEach((task) => {
            // Defensive Date parsing
            const deadline = task.deadline;
            const taskDate = deadline instanceof Date ? deadline : new Date(deadline);

            if (isNaN(taskDate.getTime())) return;

            const taskYear = taskDate.getFullYear();
            const taskMonth = taskDate.getMonth();
            const taskDay = taskDate.getDate();

            if (
                taskYear === viewYear &&
                taskMonth === viewMonth &&
                !task.completed // Only show for uncompleted tasks
            ) {
                dates.add(taskDay);
            }
        });
        return dates;
    }, [viewYear, viewMonth, tasks]);

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDayOfMonth = getFirstDayOfMonth(viewYear, viewMonth);

    const handlePrevMonth = useCallback(() => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear((y) => y - 1);
        } else {
            setViewMonth((m) => m - 1);
        }
    }, [viewMonth]);

    const handleNextMonth = useCallback(() => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear((y) => y + 1);
        } else {
            setViewMonth((m) => m + 1);
        }
    }, [viewMonth]);

    // Pan gesture for swiping between months
    const panGesture = Gesture.Pan()
        .activeOffsetX([-20, 20]) // Only activate after moving 20px horizontally
        .failOffsetY([-10, 10]) // Fail if moving too much vertically (for scrolling)
        .onUpdate((event) => {
            // Clamp the translation for a rubberband-like effect
            translateX.value = event.translationX * 0.4;
        })
        .onEnd((event) => {
            if (event.translationX > SWIPE_THRESHOLD) {
                // Swipe right -> go to previous month
                runOnJS(handlePrevMonth)();
            } else if (event.translationX < -SWIPE_THRESHOLD) {
                // Swipe left -> go to next month
                runOnJS(handleNextMonth)();
            }
            // Animate back to center smoothly without jiggle
            translateX.value = withTiming(0, { duration: 300 });
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const isToday = (day: number): boolean => {
        return (
            day === today.getDate() &&
            viewMonth === today.getMonth() &&
            viewYear === today.getFullYear()
        );
    };

    const isSelected = (day: number): boolean => {
        return (
            day === selectedDate.getDate() &&
            viewMonth === selectedDate.getMonth() &&
            viewYear === selectedDate.getFullYear()
        );
    };

    const handleDayPress = (day: number) => {
        const newDate = new Date(viewYear, viewMonth, day);
        onDateSelect(newDate);
    };

    // Build calendar grid
    const calendarDays: (number | null)[] = [];

    // Empty cells before first day
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDays.push(null);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push(day);
    }

    // Fill remaining cells to complete the grid (6 rows max)
    while (calendarDays.length < 42 && calendarDays.length % 7 !== 0) {
        calendarDays.push(null);
    }

    const weeks: (number | null)[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
        weeks.push(calendarDays.slice(i, i + 7));
    }

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
                {/* Header with Month Navigation */}
                <View style={styles.header}>
                    <Pressable onPress={handlePrevMonth} style={styles.navButton} hitSlop={12}>
                        <Ionicons name="chevron-back" size={22} color={colors.text} />
                    </Pressable>

                    <ThemedText style={styles.monthTitle}>
                        {MONTHS[viewMonth]} {viewYear}
                    </ThemedText>

                    <Pressable onPress={handleNextMonth} style={styles.navButton} hitSlop={12}>
                        <Ionicons name="chevron-forward" size={22} color={colors.text} />
                    </Pressable>
                </View>

                {/* Weekday Headers & Calendar Grid with Animation */}
                <Animated.View style={[styles.calendarContent, animatedStyle]}>
                    {/* Weekday Headers */}
                    <View style={styles.weekdayRow}>
                        {WEEKDAYS.map((day) => (
                            <View key={day} style={styles.weekdayCell}>
                                <ThemedText style={[styles.weekdayText, { color: colors.text + '60' }]}>
                                    {day}
                                </ThemedText>
                            </View>
                        ))}
                    </View>

                    {/* Calendar Grid */}
                    {weeks.map((week, weekIndex) => (
                        <View key={weekIndex} style={styles.weekRow}>
                            {week.map((day, dayIndex) => {
                                if (day === null) {
                                    return <View key={`empty-${dayIndex}`} style={styles.dayCell} />;
                                }

                                const selected = isSelected(day);
                                const todayHighlight = isToday(day);
                                const hasTask = taskDates.has(day);

                                return (
                                    <Pressable
                                        key={day}
                                        style={styles.dayCell}
                                        onPress={() => handleDayPress(day)}
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
                                                {day}
                                            </ThemedText>
                                        </View>

                                        {/* Task Indicator Dot */}
                                        {hasTask && (
                                            <View
                                                style={[
                                                    styles.taskDot,
                                                    { backgroundColor: selected ? '#FFFFFF' : colors.primary },
                                                ]}
                                            />
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>
                    ))}
                </Animated.View>
            </View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 16,
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
        marginBottom: 16,
    },
    calendarContent: {
        overflowX: 'hidden',
    },
    navButton: {
        padding: 8,
    },
    monthTitle: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    weekdayRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    weekdayCell: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
    },
    weekdayText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    weekRow: {
        flexDirection: 'row',
    },
    dayCell: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 4,
        minHeight: 44,
    },
    dayInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayText: {
        fontSize: 15,
        fontWeight: '500',
    },
    selectedDay: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    selectedDayText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    todayDay: {
        borderWidth: 2,
    },
    taskDot: {
        position: 'absolute',
        bottom: -4,
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
});
