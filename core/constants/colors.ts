/**
 * Color palette for text and highlight colors.
 * These colors work well in both light and dark modes.
 */

export interface ColorOption {
    name: string;
    value: string;
}

export const COLOR_PALETTE: ColorOption[] = [
    { name: 'Yellow', value: '#FFE066' },
    { name: 'Orange', value: '#FFA94D' },
    { name: 'Red', value: '#FF6B6B' },
    { name: 'Pink', value: '#F783AC' },
    { name: 'Indigo', value: '#818CF8' },
    { name: 'Blue', value: '#74C0FC' },
    { name: 'Teal', value: '#20C997' },
    { name: 'Green', value: '#51CF66' },
    { name: 'Gray', value: '#727272' },
    { name: 'Brown', value: '#A07855' }
];
