import { useTheme } from '@react-navigation/native';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

export default function ThemedPressable({ style, ...props }: PressableProps) {
    const { colors } = useTheme();

    return (
        <Pressable
            {...props}
            style={(state) => {
                const baseStyle: StyleProp<ViewStyle> = { backgroundColor: colors.card, borderColor: colors.border };
                const resolvedStyle = typeof style === 'function' ? style(state) : style;
                return [baseStyle, resolvedStyle];
            }}
        />
    );
}
