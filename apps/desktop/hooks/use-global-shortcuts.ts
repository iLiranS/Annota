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
            const isMod = e.metaKey || e.ctrlKey;

            // 1. Prevent Backspace from navigating back in history when not in an editable context
            if (e.key === 'Backspace' && !isMod) {
                const target = e.target as HTMLElement;
                const isEditable =
                    target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable ||
                    target.closest('[contenteditable="true"]');

                if (!isEditable) {
                    e.preventDefault();
                }
            }

            // 2. Handle global shortcuts
            if (isMod && !e.altKey) {
                const key = e.key.toLowerCase();
                const code = e.code;

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
                } else if (code === 'KeyT' && e.shiftKey) {
                    e.preventDefault();
                    toggleAlwaysOnTop();
                }

                // App-wide shortcuts (Only in main window)
                if (!isStandalone) {
                    if (code === 'KeyN' && !e.shiftKey) {
                        e.preventDefault();
                        createAndNavigate();
                    } else if (code === 'KeyP' && !e.shiftKey) {
                        e.preventDefault();
                        setIsSearchOpen(true);
                    } else if (code === 'KeyE' && !e.shiftKey) {
                        e.preventDefault();
                        updateGeneralSettings({ isSecondarySidebarOpen: !general.isSecondarySidebarOpen });
                    } else if ((code === 'Comma' || key === ',') && !e.shiftKey) {
                        e.preventDefault();
                        setSettingsOpen(true);
                    }
                }
            }


        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [createAndNavigate, setIsSearchOpen, general.isSecondarySidebarOpen, updateGeneralSettings, editor.fontSize, updateEditorSettings, setSettingsOpen, isStandalone]);
}

