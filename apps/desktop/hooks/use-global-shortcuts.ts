import { TRASH_FOLDER_ID, useNavigationStore, useSearchStore, useSettingsStore } from "@annota/core";
import { useEffect } from "react";
import { useAlwaysOnTop } from "./use-always-on-top";
import { useCreateNote } from "./use-create-note";
import { useNoteTabsStore } from "./use-note-tabs";

export function useGlobalShortcuts(options: { isStandalone?: boolean } = {}) {
    const { isStandalone = false } = options;
    const { createAndNavigate } = useCreateNote();
    const { setIsOpen: setIsSearchOpen } = useSearchStore();
    const { general, updateGeneralSettings, editor, updateEditorSettings } = useSettingsStore();
    const setSettingsOpen = useNavigationStore(s => s.setSettingsOpen);
    const { toggleAlwaysOnTop } = useAlwaysOnTop();

    useEffect(() => {
        const rotateSidebarTab = (direction: 'next' | 'prev') => {
            const tabs: ('notes' | 'tags' | 'search')[] = ['notes', 'tags', 'search'];
            const currentTab = useNavigationStore.getState().sidebarTab;
            const currentIndex = tabs.indexOf(currentTab);
            if (currentIndex === -1) return;

            const isRtl = useSettingsStore.getState().general.appDirection === 'rtl';
            const effectiveDirection = isRtl
                ? (direction === 'next' ? 'prev' : 'next')
                : direction;

            let nextIndex = effectiveDirection === 'next' ? currentIndex + 1 : currentIndex - 1;
            if (nextIndex >= tabs.length) nextIndex = 0;
            if (nextIndex < 0) nextIndex = tabs.length - 1;

            useNavigationStore.getState().setSidebarTab(tabs[nextIndex]);
            window.dispatchEvent(new CustomEvent("open-sidebar"));
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const isMod = e.metaKey || e.ctrlKey;

            const rotateNoteTab = (direction: 'next' | 'prev') => {
                const tabs = useNoteTabsStore.getState().tabs;
                if (tabs.length <= 1) return;

                const currentNoteId = useNavigationStore.getState().lastViewedNoteId;
                const locationPath = window.location.pathname;

                // If we are currently on a note route, figure out which tab it is
                let currentIndex = -1;
                const match = locationPath.match(/\/notes\/[^\/]+\/([^\/]+)/);
                if (match) {
                    currentIndex = tabs.findIndex(t => t.noteId === match[1]);
                } else if (currentNoteId) {
                    currentIndex = tabs.findIndex(t => t.noteId === currentNoteId);
                }

                if (currentIndex === -1) currentIndex = 0;

                let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
                if (nextIndex >= tabs.length) nextIndex = 0;
                if (nextIndex < 0) nextIndex = tabs.length - 1;

                const nextTab = tabs[nextIndex];

                // Since this is a global shortcut outside router context, we emit a custom event 
                // for the navbar to handle navigation, OR we can navigate if we can access navigate.
                // Wait, use-global-shortcuts.ts is in App.tsx inside React Router but outside Routes.
                // Let's dispatch a custom event that NoteTabs listens to.
                window.dispatchEvent(new CustomEvent('navigate-note-tab', { detail: nextTab }));
            };

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

            // 2. App-wide sidebar navigation / rotation shortcuts (Only in main window)
            if (!isStandalone) {
                // Ctrl+Tab (rotate forward) and Ctrl+Shift+Tab (rotate backward) for Note Tabs
                if (e.key === 'Tab' && e.ctrlKey) {
                    e.preventDefault();
                    const direction = e.shiftKey ? 'prev' : 'next';
                    rotateNoteTab(direction);
                    return;
                }

                // Cmd+Option+Right / Cmd+Option+] / Ctrl+Alt+Right / Ctrl+Alt+] (Rotate next sidebar tab)
                if (isMod && e.altKey && (e.key === 'ArrowRight' || e.key === ']')) {
                    e.preventDefault();
                    rotateSidebarTab('next');
                    return;
                }

                // Cmd+Option+Left / Cmd+Option+[ / Ctrl+Alt+Left / Ctrl+Alt+[ (Rotate prev)
                if (isMod && e.altKey && (e.key === 'ArrowLeft' || e.key === '[')) {
                    e.preventDefault();
                    rotateSidebarTab('prev');
                    return;
                }
            }

            // 3. Handle global shortcuts
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
                        const { selectedFolderId, selectedTagId } = useNavigationStore.getState();
                        const folderId = (selectedFolderId && selectedFolderId !== 'root' && selectedFolderId !== TRASH_FOLDER_ID) ? selectedFolderId : undefined;
                        const tagId = selectedTagId || undefined;
                        createAndNavigate(folderId, tagId);
                    } else if (code === 'KeyP' && !e.shiftKey) {
                        e.preventDefault();
                        setIsSearchOpen(true);
                    } else if (code === 'KeyS' && !e.shiftKey) {
                        e.preventDefault();
                        window.dispatchEvent(new CustomEvent('toggle-sidebar'));
                    } else if (code === 'KeyE' && !e.shiftKey) {
                        e.preventDefault();
                        updateGeneralSettings({ isSecondarySidebarOpen: !general.isSecondarySidebarOpen });
                    } else if ((code === 'Comma' || key === ',') && !e.shiftKey) {
                        e.preventDefault();
                        setSettingsOpen(true);
                    } else if (code === 'KeyW' && !e.shiftKey) {
                        e.preventDefault();
                        window.dispatchEvent(new CustomEvent('close-current-note-tab'));
                    }
                }
            }


        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [createAndNavigate, setIsSearchOpen, general.isSecondarySidebarOpen, updateGeneralSettings, editor.fontSize, updateEditorSettings, setSettingsOpen, isStandalone]);
}

