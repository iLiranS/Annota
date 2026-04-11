import { useSearchStore, useSettingsStore } from "@annota/core";
import { useEffect } from "react";
import { useCreateNote } from "./use-create-note";

export function useGlobalShortcuts() {
    const { createAndNavigate } = useCreateNote();
    const { setIsOpen: setIsSearchOpen } = useSearchStore();
    const { general, updateGeneralSettings, editor, updateEditorSettings } = useSettingsStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // mod+n (Cmd+N on Mac, Ctrl+N on Windows)
            const isMod = e.metaKey || e.ctrlKey;

            if (isMod && !e.altKey) {
                const key = e.key.toLowerCase();

                if (key === 'n' && !e.shiftKey) {
                    e.preventDefault();
                    createAndNavigate();
                } else if (key === 'f' && !e.shiftKey) {
                    e.preventDefault();
                    setIsSearchOpen(true);
                } else if (key === 'e' && !e.shiftKey) {
                    e.preventDefault();
                    updateGeneralSettings({ isTaskCalendarOpen: !general.isTaskCalendarOpen });
                } else if (key === '=' || key === '+') {
                    e.preventDefault();
                    updateEditorSettings({ fontSize: Math.min(24, editor.fontSize + 1) });
                } else if (key === '-' && !e.shiftKey) {
                    e.preventDefault();
                    updateEditorSettings({ fontSize: Math.max(12, editor.fontSize - 1) });
                } else if (key === '0') {
                    e.preventDefault();
                    updateEditorSettings({ fontSize: 16 });
                }
            }


        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [createAndNavigate, setIsSearchOpen, general.isTaskCalendarOpen, updateGeneralSettings, editor.fontSize, updateEditorSettings]);
}

