import { useTheme } from '@react-navigation/native';
import { Text, TextProps } from 'react-native';

export default function ThemedText({ style, ...props }: TextProps) {
  const { colors } = useTheme();

  return (
    <Text
      {...props}
      style={[{ color: colors.text }, style]}
    />
  );
}
