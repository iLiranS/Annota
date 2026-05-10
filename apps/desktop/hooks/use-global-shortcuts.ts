import { useNavigationStore, useSearchStore, useSettingsStore } from "@annota/core";
import { useEffect } from "react";
import { useAlwaysOnTop } from "./use-always-on-top";
import { useCreateNote } from "./use-create-note";

export function useGlobalShortcuts(options: { isStandalone?: boolean } = {}) {
    const { isStandalone = false } = options;
    const { createAndNavigate } = useCreateNote();
    const { setIsOpen: setIsSearchOpen } = useSearchStore();
    const { general, updateGeneralSettings, editor, updateEditorSettings } = useSettingsStore();
    const setSettingsOpen = useNavigationStore(s => s.setSettingsOpen);
    const { toggleAlwaysOnTop } = useAlwaysOnTop();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // mod+n (Cmd+N on Mac, Ctrl+N on Windows)
            const isMod = e.metaKey || e.ctrlKey;

            if (isMod && !e.altKey) {
                const key = e.key.toLowerCase();

                // Shared shortcuts (Work in both main and standalone)
                if (key === '=' || key === '+') {
                    e.preventDefault();
                    updateEditorSettings({ fontSize: Math.min(24, editor.fontSize + 1) });
                } else if (key === '-' && !e.shiftKey) {
                    e.preventDefault();
                    updateEditorSettings({ fontSize: Math.max(12, editor.fontSize - 1) });
                } else if (key === '0') {
                    e.preventDefault();
                    updateEditorSettings({ fontSize: 16 });
                } else if (key === 't' && e.shiftKey) {
                    e.preventDefault();
                    toggleAlwaysOnTop();
                }

                // App-wide shortcuts (Only in main window)
                if (!isStandalone) {
                    if (key === 'n' && !e.shiftKey) {
                        e.preventDefault();
                        createAndNavigate();
                    } else if (key === 'p' && !e.shiftKey) {
                        e.preventDefault();
                        setIsSearchOpen(true);
                    } else if (key === 'e' && !e.shiftKey && general.isAiEnabled) {
                        e.preventDefault();
                        updateGeneralSettings({ isAiSidebarOpen: !general.isAiSidebarOpen });
                    } else if (key === ',' && !e.shiftKey) {
                        e.preventDefault();
                        setSettingsOpen(true);
                    }
                }
            }


        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [createAndNavigate, setIsSearchOpen, general.isAiSidebarOpen, updateGeneralSettings, editor.fontSize, updateEditorSettings, setSettingsOpen, isStandalone]);
}

