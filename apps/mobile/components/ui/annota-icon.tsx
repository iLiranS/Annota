import React from 'react';
import { Image } from 'expo-image';
import { ANNOTA_ICON_PATHS } from '@annota/core';

interface AnnotaIconProps {
  size?: number;
  color?: string;
}

export function AnnotaIcon({ size = 22, color = '#8B5CF6' }: AnnotaIconProps) {
    const svgString = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(0, 1024) scale(0.1, -0.1)" fill="${color}">
    ${ANNOTA_ICON_PATHS.map(p => `<path d="${p}" />`).join('')}
  </g>
</svg>
    `.trim();

    return (
        <Image
            source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}` }}
            style={{ width: size, height: size }}
            contentFit="contain"
        />
    );
}
