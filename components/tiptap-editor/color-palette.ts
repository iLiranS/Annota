/**
 * Color palette for text and highlight colors.
 * These colors work well in both light and dark modes.
 */

export interface ColorOption {
    name: string;
    value: string;
}

export const COLOR_PALETTE: ColorOption[] = [
    { name: 'Orange', value: '#FFA94D' },
    { name: 'Red', value: '#FF6B6B' },
    { name: 'Yellow', value: '#FFE066' },
    { name: 'Green', value: '#69DB7C' },
    { name: 'Teal', value: '#38D9A9' },
    { name: 'Blue', value: '#74C0FC' },
    { name: 'Purple', value: '#B197FC' },
    { name: 'Pink', value: '#F783AC' },
];

/**
 * Heading levels for the heading selector popup.
 */
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];
