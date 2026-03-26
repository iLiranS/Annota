import React from 'react';
import { Text, View } from 'react-native';

interface DailyNoteIconProps {
  size?: number;
  color?: string;
}

export function DailyNoteIcon({ size = 22, color = '#8B5CF6' }: DailyNoteIconProps) {
  const today = new Date().getDate();

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {/* Calendar Frame */}
      <View
        style={{
          position: 'absolute',
          top: size * (4 / 24),
          left: size * (3 / 24),
          width: size * (18 / 24),
          height: size * (18 / 24),
          borderWidth: size * (2 / 24),
          borderColor: color,
          borderRadius: size * (2.5 / 24),
        }}
      />
      {/* Calendar Rings/Prongs */}
      <View
        style={{
          position: 'absolute',
          top: size * (1 / 24),
          left: size * (7 / 24),
          width: size * (2 / 24),
          height: size * (4 / 24),
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * (1 / 24),
          left: size * (15 / 24),
          width: size * (2 / 24),
          height: size * (4 / 24),
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
      {/* Header Line */}
      <View
        style={{
          position: 'absolute',
          top: size * (10 / 24),
          left: size * (3 / 24),
          width: size * (18 / 24),
          height: size * (2 / 24),
          backgroundColor: color,
        }}
      />
      {/* The Date Number */}
      <View
        style={{
          position: 'absolute',
          top: size * (10 / 24),
          left: size * (3 / 24),
          width: size * (18 / 24),
          height: size * (12 / 24),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontSize: size * 0.4,
            color: color,
            fontWeight: '700',
            textAlign: 'center',
            includeFontPadding: false,
          }}
        >
          {today}
        </Text>
      </View>
    </View>
  );
}
