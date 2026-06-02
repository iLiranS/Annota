import React from 'react';
import { ScrollView, StyleSheet, Text, View, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
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
    const scrollViewRef = React.useRef<ScrollView>(null);

    React.useEffect(() => {
        const today = new Date().getDate();
        const todayIndex = days.findIndex((d) => d.day === today);
        if (todayIndex !== -1 && scrollViewRef.current) {
            const columnWidth = 8 + 6; // dot width (8) + gap (6)
            const xOffset = 12 + todayIndex * columnWidth;
            const screenWidth = Dimensions.get('window').width;
            const scrollToX = Math.max(0, xOffset - screenWidth / 2 + 10);
            
            const timer = setTimeout(() => {
                scrollViewRef.current?.scrollTo({
                    x: scrollToX,
                    animated: true,
                });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [days]);

    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderContainer}>
                <Ionicons name="flame-outline" size={16} color={colors.text + '80'} />
                <Text style={[styles.sectionTitle, { color: colors.text + '99' }]}>WRITING ACTIVITY</Text>
            </View>

            <View style={[styles.heatmapCard, { backgroundColor: colors.card + '25', borderColor: colors.border }]}>
                <ScrollView
                    ref={scrollViewRef}
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
                            <View
                                key={day.day}
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
                            </View>
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
        gap: 6,
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
