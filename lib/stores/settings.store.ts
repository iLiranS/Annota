import { EditorFontId } from '@/constants/editor-fonts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Types
export type ThemeMode = 'light' | 'dark' | 'system';
export type StartOfWeek = 'sunday' | 'monday';
export type AutoClearTasksDays = 7 | 30 | 90 | 180;

export interface EditorSettings {
    direction: 'ltr' | 'rtl' | 'auto';
    fontSize: number;
    lineSpacing: number; // multiplier (e.g. 1.0, 1.5)
    paragraphSpacing: number; // pixels (e.g. 10, 20)
    fontFamily: EditorFontId | string;
    floatingNoteHeader: boolean;
}

export interface GeneralSettings {
    startOfWeek: StartOfWeek;
    compactMode: boolean;
    hapticFeedback: boolean;
    tasksShowDone: boolean;
    taskListShowDone: boolean;
    autoClearTasksDays: AutoClearTasksDays;
}

export interface SettingsState {
    // Theme
    themeMode: ThemeMode;
    accentColor: string;

    // Editor
    editor: EditorSettings;

    // General
    general: GeneralSettings;

    // Actions
    setThemeMode: (mode: ThemeMode) => void;
    setAccentColor: (color: string) => void;

    updateEditorSettings: (settings: Partial<EditorSettings>) => void;
    updateGeneralSettings: (settings: Partial<GeneralSettings>) => void;

    resetSettings: () => void;
}

const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
    direction: 'auto',
    fontSize: 16,
    lineSpacing: 1.5,
    paragraphSpacing: 16,
    fontFamily: 'system',
    floatingNoteHeader: true,
};

const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
    startOfWeek: 'sunday',
    compactMode: true,
    hapticFeedback: true,
    tasksShowDone: true,
    taskListShowDone: true,
    autoClearTasksDays: 30,
};

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            // Defaults
            themeMode: 'system',
            accentColor: '#6366F1', // Default Indigo

            editor: DEFAULT_EDITOR_SETTINGS,
            general: DEFAULT_GENERAL_SETTINGS,

            // Actions
            setThemeMode: (mode) => set({ themeMode: mode }),
            setAccentColor: (color) => set({ accentColor: color }),

            updateEditorSettings: (settings) => set((state) => ({
                editor: { ...state.editor, ...settings }
            })),

            updateGeneralSettings: (settings) => set((state) => ({
                general: { ...state.general, ...settings }
            })),

            resetSettings: () => set({
                themeMode: 'system',
                accentColor: '#6366F1',
                editor: DEFAULT_EDITOR_SETTINGS,
                general: DEFAULT_GENERAL_SETTINGS,
            }),
        }),
        {
            name: 'settings-store',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
