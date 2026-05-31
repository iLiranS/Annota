import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { format } from 'date-fns';
import Toast from 'react-native-toast-message';
import { useAppTheme } from '@/hooks/use-app-theme';

interface DayActivity {
    day: number;
    count: number;
    isActive: boolean;
    date: Date;
}

interface WritingActivityHeatmapProps {
    days: DayActivity[];
}

export function WritingActivityHeatmap({ days }: WritingActivityHeatmapProps) {
    const { colors } = useAppTheme();

    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderContainer}>
                <Ionicons name="flame-outline" size={16} color={colors.text + '80'} />
                <Text style={[styles.sectionTitle, { color: colors.text + '99' }]}>WRITING ACTIVITY</Text>
            </View>

            <View style={[styles.heatmapCard, { backgroundColor: colors.card + '25', borderColor: colors.border }]}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.heatmapScroll}
                >
                    {days.map((day) => {
                        const count = day.count || 0;
                        const activeDots = Math.min(count, 4);
                        let opacity = 0.15;

                        if (activeDots === 1) {
                            opacity = 0.45;
                        } else if (activeDots === 2) {
                            opacity = 0.7;
                        } else if (activeDots === 3) {
                            opacity = 0.85;
                        } else if (activeDots === 4) {
                            opacity = 1.0;
                        }

                        return (
                            <Pressable
                                key={day.day}
                                onPress={() => {
                                    Toast.show({
                                        type: 'info',
                                        text1: `${format(day.date, "MMMM d")}`,
                                        text2: `${count} note${count === 1 ? "" : "s"} active`,
                                        position: 'bottom',
                                        visibilityTime: 1800,
                                    });
                                }}
                                style={styles.heatmapDayColumn}
                            >
                                <View style={styles.dotsContainer}>
                                    {Array.from({ length: 4 }).map((_, idx) => {
                                        const isActiveDot = idx < activeDots;
                                        return (
                                            <View
                                                key={idx}
                                                style={[
                                                    styles.heatmapDot,
                                                    {
                                                        backgroundColor: isActiveDot ? colors.primary : colors.border,
                                                        opacity: isActiveDot ? opacity : 0.22,
                                                    }
                                                ]}
                                            />
                                        );
                                    })}
                                </View>
                                <Text style={[styles.dayNumber, { color: colors.text + '40' }]}>
                                    {day.day}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    sectionContainer: {
        marginBottom: 24,
    },
    sectionHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        paddingLeft: 4,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.2,
    },
    heatmapCard: {
        borderRadius: 16,
        borderWidth: 1,
        paddingVertical: 16,
        paddingHorizontal: 4,
        alignItems: 'center',
    },
    heatmapScroll: {
        paddingHorizontal: 12,
        alignItems: 'flex-end',
        gap: 12,
    },
    heatmapDayColumn: {
        alignItems: 'center',
        gap: 6,
    },
    dotsContainer: {
        flexDirection: 'column-reverse',
        gap: 2.5,
        height: 40,
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    heatmapDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dayNumber: {
        fontSize: 8,
        fontWeight: '700',
    },
});
