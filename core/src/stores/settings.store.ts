import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { EditorFontId } from '../../constants/editor-fonts';
import { createStorageAdapter } from './config';

// Types
export type ThemeMode = 'light' | 'dark' | 'system';
export type StartOfWeek = 'sunday' | 'monday';
export type AutoClearTasksDays = 30 | 60 | 90 | 180;

export interface EditorSettings {
    direction: 'ltr' | 'rtl' | 'auto';
    fontSize: number;
    lineSpacing: number; // multiplier (e.g. 1.0, 1.5)
    paragraphSpacing: number; // pixels (e.g. 10, 20)
    fontFamily: EditorFontId | string;
    floatingNoteHeader: boolean;
    noteWidth: number; // pixels, 0 for full width
    defaultCodeLanguage: string | null;
}

export interface GeneralSettings {
    startOfWeek: StartOfWeek;
    compactMode: boolean;
    hapticFeedback: boolean;
    tasksShowDone: boolean;
    taskListShowDone: boolean;
    autoClearTasksDays: AutoClearTasksDays;
    appDirection: 'ltr' | 'rtl';
    isTaskCalendarOpen: boolean;
}

export interface SettingsState {
    // Theme
    themeMode: ThemeMode;
    accentColor: string;

    // Editor
    editor: EditorSettings;

    // General
    general: GeneralSettings;

    // Navigation Memorization
    lastViewedNoteId: string | null;
    lastViewedFolderId: string | null;

    // Actions
    setThemeMode: (mode: ThemeMode) => void;
    setAccentColor: (color: string) => void;

    updateEditorSettings: (settings: Partial<EditorSettings>) => void;
    updateGeneralSettings: (settings: Partial<GeneralSettings>) => void;
    setLastViewed: (noteId: string | null, folderId: string | null) => void;

    resetSettings: () => void;
}

const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
    direction: 'auto',
    fontSize: 16,
    lineSpacing: 1.5,
    paragraphSpacing: 8,
    fontFamily: 'system',
    floatingNoteHeader: true,
    noteWidth: 900,

    defaultCodeLanguage: null,
};

const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
    startOfWeek: 'sunday',
    compactMode: false,
    hapticFeedback: true,
    tasksShowDone: true,
    taskListShowDone: true,
    autoClearTasksDays: 60,
    appDirection: 'ltr',
    isTaskCalendarOpen: false,
};

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            // Defaults
            themeMode: 'system',
            accentColor: '#6366F1', // Default Indigo

            editor: DEFAULT_EDITOR_SETTINGS,
            general: DEFAULT_GENERAL_SETTINGS,

            lastViewedNoteId: null,
            lastViewedFolderId: null,

            // Actions
            setThemeMode: (mode) => set({ themeMode: mode }),
            setAccentColor: (color) => set({ accentColor: color }),

            updateEditorSettings: (settings) => set((state) => ({
                editor: { ...state.editor, ...settings }
            })),

            updateGeneralSettings: (settings) => set((state) => ({
                general: { ...state.general, ...settings }
            })),

            setLastViewed: (noteId, folderId) => set({
                lastViewedNoteId: noteId,
                lastViewedFolderId: folderId
            }),

            resetSettings: () => set({
                themeMode: 'system',
                accentColor: '#6366F1',
                editor: DEFAULT_EDITOR_SETTINGS,
                general: DEFAULT_GENERAL_SETTINGS,
                lastViewedNoteId: null,
                lastViewedFolderId: null,
            }),
        }),
        {
            name: 'settings-store',
            storage: createJSONStorage(() => createStorageAdapter()),
            skipHydration: true,
        }
    )
);
