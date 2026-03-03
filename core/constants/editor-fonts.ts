export type EditorFontId = 'system' | 'serif' | 'mono' | 'poppins' | 'varela';

export interface EditorFontOption {
    id: EditorFontId;
    label: string;
    fontFamily: string;
}

const systemFamily = 'System';
const serifFamily = 'serif';
const monoFamily = 'monospace';

export const EDITOR_FONTS: EditorFontOption[] = [
    { id: 'system', label: 'System (Default)', fontFamily: systemFamily },
    { id: 'poppins', label: 'Poppins', fontFamily: 'Poppins' },
    { id: 'varela', label: 'Varela Round', fontFamily: 'VarelaRound' },
    { id: 'serif', label: 'Serif', fontFamily: serifFamily },
    { id: 'mono', label: 'Monospace', fontFamily: monoFamily },
];

export const getEditorFontOption = (value: string) =>
    EDITOR_FONTS.find((option) => option.id === value || option.label === value);

export const getEditorFontLabel = (value: string) =>
    getEditorFontOption(value)?.label ?? value;

export const getEditorFontFamily = (value: string) =>
    getEditorFontOption(value)?.fontFamily ?? systemFamily;
