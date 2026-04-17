import ThemedText from '@/components/themed-text';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface SectionHeaderProps {
    title: string;
    iconName: keyof typeof Ionicons.glyphMap;
    isCollapsed: boolean;
    onToggle: () => void;
    colors: any;
}

export const SectionHeader = ({ title, iconName, isCollapsed, onToggle, colors }: SectionHeaderProps) => {
    const chevronStyle = useAnimatedStyle(() => ({
        transform: [{
            rotate: withTiming(!isCollapsed ? '90deg' : '0deg', {
                duration: 300,
                easing: Easing.bezier(0.4, 0, 0.2, 1)
            })
        }]
    }));

    return (
        <HapticPressable
            onPress={onToggle}
            style={styles.sectionHeaderRow}
        >
            <Ionicons name={iconName} size={14} color={colors.text + '50'} />
            <ThemedText style={[
                styles.sectionHeaderText,
                { color: colors.text + '50', flex: 1 }
            ]}>
                {title}
            </ThemedText>
            <Animated.View style={chevronStyle}>
                <Ionicons name="chevron-forward" size={16} color={colors.text + '50'} />
            </Animated.View>
        </HapticPressable>
    );
};

const styles = StyleSheet.create({
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginVertical: 8,
        gap: 6,
    },
    sectionHeaderText: {
        fontSize: 14,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
});
