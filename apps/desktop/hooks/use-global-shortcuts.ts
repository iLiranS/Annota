import { useSearchStore, useSettingsStore } from "@annota/core";
import { useEffect } from "react";
import { useCreateNote } from "./use-create-note";

export function useGlobalShortcuts() {
    const { createAndNavigate } = useCreateNote();
    const { setIsOpen: setIsSearchOpen } = useSearchStore();
    const { general, updateGeneralSettings } = useSettingsStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // mod+n (Cmd+N on Mac, Ctrl+N on Windows)
            const isMod = e.metaKey || e.ctrlKey;

            if (isMod && !e.shiftKey && !e.altKey) {
                const key = e.key.toLowerCase();

                if (key === 'n') {
                    e.preventDefault();
                    createAndNavigate();
                } else if (key === 'f') {
                    e.preventDefault();
                    setIsSearchOpen(true);
                } else if (key === 'e') {
                    e.preventDefault();
                    updateGeneralSettings({ isTaskCalendarOpen: !general.isTaskCalendarOpen });
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [createAndNavigate, setIsSearchOpen, general.isTaskCalendarOpen, updateGeneralSettings]);
}
