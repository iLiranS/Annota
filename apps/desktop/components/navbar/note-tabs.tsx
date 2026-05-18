import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID, useNavigationStore, useNotesStore, useSettingsStore } from "@annota/core";
import { FileText, Pin, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useNoteTabsStore } from "../../hooks/use-note-tabs";

export function NoteTabs() {
    const { folderId: routeFolderId, noteId: routeNoteId } = useParams();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { general } = useSettingsStore();
    const quickAccessNoteId = useNavigationStore(s => s.quickAccessNoteId);
    const setQuickAccessView = useNavigationStore(s => s.setQuickAccessView);

    const tabs = useNoteTabsStore(s => s.tabs);
    const addTab = useNoteTabsStore(s => s.addTab);
    const removeTab = useNoteTabsStore(s => s.removeTab);
    const setTabs = useNoteTabsStore(s => s.setTabs);
    const reorderTabs = useNoteTabsStore(s => s.reorderTabs);
    const togglePinTab = useNoteTabsStore(s => s.togglePinTab);

    const notes = useNotesStore(s => s.notes);

    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const searchFolderId = searchParams.get("folderId");
    const isSpecialView = searchFolderId === DAILY_NOTES_FOLDER_ID || searchFolderId === TRASH_FOLDER_ID || routeFolderId === TRASH_FOLDER_ID;
    const lastViewedNoteId = useSettingsStore(s => s.lastViewedNoteId);

    const activeNoteId = useMemo(() => {
        if (isSpecialView) return null;
        if (quickAccessNoteId) return quickAccessNoteId;
        if (routeNoteId) return routeNoteId;
        if (lastViewedNoteId) return lastViewedNoteId;
        return null;
    }, [isSpecialView, quickAccessNoteId, routeNoteId, lastViewedNoteId]);

    const lastRouteNoteIdRef = useRef(activeNoteId);

    // 1. Sync current route to tabs
    useEffect(() => {
        if (activeNoteId && location.pathname.startsWith('/notes')) {
            const currentTabs = useNoteTabsStore.getState().tabs;
            const existingTab = currentTabs.find(t => t.noteId === activeNoteId);

            if (!existingTab) {
                if (general.openNoteInNewTab === false) {
                    // Replace the previously active tab with the new one, unless it is pinned
                    const lastId = lastRouteNoteIdRef.current;
                    const newTabs = [...currentTabs];
                    const indexToReplace = newTabs.findIndex(t => t.noteId === lastId);

                    const tabToReplace = indexToReplace !== -1 ? newTabs[indexToReplace] : null;
                    const isPinned = tabToReplace?.isPinned === true;

                    if (indexToReplace !== -1 && !isPinned) {
                        newTabs[indexToReplace] = { noteId: activeNoteId, folderId: routeFolderId || 'root' };
                        setTabs(newTabs);
                    } else if (newTabs.length > 0 && !isPinned && !newTabs[0].isPinned) {
                        // Fallback: replace the first tab if it is not pinned
                        newTabs[0] = { noteId: activeNoteId, folderId: routeFolderId || 'root' };
                        setTabs(newTabs);
                    } else {
                        addTab({ noteId: activeNoteId, folderId: routeFolderId || 'root' });
                    }
                } else {
                    addTab({ noteId: activeNoteId, folderId: routeFolderId || 'root' });
                }
            }
        }
        lastRouteNoteIdRef.current = activeNoteId;
    }, [activeNoteId, routeFolderId, location.pathname, addTab, general.openNoteInNewTab, setTabs]);

    useEffect(() => {
        const handleNavigate = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail && customEvent.detail.noteId) {
                const folderId = routeFolderId || "root";
                setQuickAccessView(customEvent.detail.noteId, folderId);
                navigate(`/notes/${folderId}/${customEvent.detail.noteId}`);
            }
        };
        window.addEventListener('navigate-note-tab', handleNavigate);
        return () => window.removeEventListener('navigate-note-tab', handleNavigate);
    }, [navigate, routeFolderId, setQuickAccessView]);

    useEffect(() => {
        const handleCloseCurrentTab = () => {
            if (activeNoteId) {
                const tabIndex = tabs.findIndex(t => t.noteId === activeNoteId);
                if (tabIndex === -1) return;

                if (tabs.length > 1) {
                    const nextTab = tabs[tabIndex === tabs.length - 1 ? tabIndex - 1 : tabIndex + 1];
                    const folderId = routeFolderId || "root";
                    setQuickAccessView(nextTab.noteId, folderId);
                    navigate(`/notes/${folderId}/${nextTab.noteId}`);
                } else {
                    navigate('/notes');
                }

                removeTab(activeNoteId);
            }
        };
        window.addEventListener('close-current-note-tab', handleCloseCurrentTab);
        return () => window.removeEventListener('close-current-note-tab', handleCloseCurrentTab);
    }, [activeNoteId, tabs, routeFolderId, navigate, setQuickAccessView, removeTab]);

    // 2. Validate tabs (remove deleted/missing notes)
    useEffect(() => {
        if (notes.length === 0) return; // Not loaded yet
        let hasChanges = false;
        const validTabs = tabs.filter(tab => {
            const note = notes.find(n => n.id === tab.noteId);
            const isValid = note && !note.isDeleted;
            if (!isValid) hasChanges = true;
            return isValid;
        });
        if (hasChanges) {
            setTabs(validTabs);
        }
    }, [notes, tabs, setTabs]);

    // Handle close tab
    const handleClose = (e: React.MouseEvent, tabId: string) => {
        e.stopPropagation();
        e.preventDefault();

        const tabIndex = tabs.findIndex(t => t.noteId === tabId);
        if (tabIndex === -1) return;

        if (tabId === activeNoteId) {
            if (tabs.length > 1) {
                const nextTab = tabs[tabIndex === tabs.length - 1 ? tabIndex - 1 : tabIndex + 1];
                const folderId = routeFolderId || "root";
                setQuickAccessView(nextTab.noteId, folderId);
                navigate(`/notes/${folderId}/${nextTab.noteId}`);
            } else {
                navigate('/notes');
            }
        }

        removeTab(tabId);
    };

    const handleCloseOtherTabs = (tabId: string) => {
        const keptTabs = tabs.filter(t => t.noteId === tabId || t.isPinned);
        setTabs(keptTabs);

        const stillHasActive = keptTabs.some(t => t.noteId === activeNoteId);
        if (!stillHasActive && keptTabs.length > 0) {
            const firstTab = keptTabs[0];
            const folderId = routeFolderId || "root";
            setQuickAccessView(firstTab.noteId, folderId);
            navigate(`/notes/${folderId}/${firstTab.noteId}`);
        } else if (keptTabs.length === 0) {
            navigate('/notes');
        }
    };

    const handleOpenNote = (noteId: string) => {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        const folderId = note.folderId || 'root';
        const currentTabs = useNoteTabsStore.getState().tabs;
        const existingTab = currentTabs.find(t => t.noteId === noteId);

        if (!existingTab) {
            addTab({ noteId, folderId });
        }

        const currentFolderId = routeFolderId || "root";
        setQuickAccessView(noteId, currentFolderId);
        navigate(`/notes/${currentFolderId}/${noteId}`);
    };

    const containerRef = useRef<HTMLDivElement>(null);

    // Auto scroll to active tab
    useEffect(() => {
        if (activeNoteId && containerRef.current) {
            const activeEl = containerRef.current.querySelector(`[data-tab-id="${activeNoteId}"]`);
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [activeNoteId, tabs]);

    if (tabs.length === 0) {
        return (
            <div
                data-tauri-drag-region
                className="flex-1 h-full"
                style={{ WebkitAppRegion: 'drag' } as any}
                onDragOver={(e) => {
                    if (e.dataTransfer.types.includes("application/annota-note-id")) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                    }
                }}
                onDrop={(e) => {
                    if (e.dataTransfer.types.includes("application/annota-note-id")) {
                        const noteId = e.dataTransfer.getData("application/annota-note-id");
                        if (noteId) {
                            e.preventDefault();
                            handleOpenNote(noteId);
                        }
                    }
                }}
            />
        );
    }

    return (
        <div
            ref={containerRef}
            className={cn(
                "flex-1 flex items-center h-full overflow-x-auto overflow-y-hidden ml-2 mr-2",
                general.appDirection === 'rtl' ? 'flex-row-reverse' : 'flex-row'
            )}
            style={{
                WebkitAppRegion: 'no-drag',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
            } as any}
            onDragOver={(e) => {
                if (e.dataTransfer.types.includes("application/annota-note-id")) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                }
            }}
            onDrop={(e) => {
                if (e.dataTransfer.types.includes("application/annota-note-id")) {
                    const noteId = e.dataTransfer.getData("application/annota-note-id");
                    if (noteId) {
                        e.preventDefault();
                        handleOpenNote(noteId);
                    }
                }
            }}
        >
            <style>{`
                .note-tabs-container::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
            <div
                data-tauri-drag-region
                className={cn(
                    "note-tabs-container flex w-full h-full items-center gap-1.5  px-5",
                    general.appDirection === 'rtl' ? 'flex-row-reverse' : 'flex-row'
                )}
                onDragOver={(e) => {
                    if (e.dataTransfer.types.includes("application/annota-note-id")) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                    }
                }}
                onDrop={(e) => {
                    if (e.dataTransfer.types.includes("application/annota-note-id")) {
                        const noteId = e.dataTransfer.getData("application/annota-note-id");
                        if (noteId) {
                            e.preventDefault();
                            handleOpenNote(noteId);
                        }
                    }
                }}
            >
                {tabs.map((tab, index) => {
                    const note = notes.find(n => n.id === tab.noteId);
                    if (!note) return null;
                    const isActive = tab.noteId === activeNoteId;

                    return (
                        <ContextMenu key={tab.noteId}>
                            <ContextMenuTrigger asChild>
                                <div
                                    data-tab-id={tab.noteId}
                                    draggable
                                    onDragStart={(e) => {
                                        setDraggedIndex(index);
                                        e.dataTransfer.effectAllowed = "move";
                                    }}
                                    onDragOver={(e) => {
                                        if (e.dataTransfer.types.includes("application/annota-note-id")) {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = "copy";
                                            return;
                                        }
                                        e.preventDefault(); // Necessary to allow dropping
                                        if (draggedIndex !== null && draggedIndex !== index) {
                                            setDragOverIndex(index);
                                        }
                                    }}
                                    onDragLeave={() => {
                                        if (dragOverIndex === index) {
                                            setDragOverIndex(null);
                                        }
                                    }}
                                    onDragEnd={() => {
                                        setDraggedIndex(null);
                                        setDragOverIndex(null);
                                    }}
                                    onDrop={(e) => {
                                        if (e.dataTransfer.types.includes("application/annota-note-id")) {
                                            const noteId = e.dataTransfer.getData("application/annota-note-id");
                                            if (noteId) {
                                                e.preventDefault();
                                                handleOpenNote(noteId);
                                            }
                                            return;
                                        }
                                        e.preventDefault();
                                        if (draggedIndex !== null && draggedIndex !== index) {
                                            reorderTabs(draggedIndex, index);
                                        }
                                        setDraggedIndex(null);
                                        setDragOverIndex(null);
                                    }}
                                    onClick={() => {
                                        const folderId = routeFolderId || "root";
                                        setQuickAccessView(tab.noteId, folderId);
                                        navigate(`/notes/${folderId}/${tab.noteId}`);
                                    }}
                                    className={cn(
                                        "group relative flex h-9/12 cursor-pointer items-center justify-between gap-2 rounded border px-1 text-xs select-none",
                                        isActive
                                            ? "bg-note-bg dark:bg-primary/10 border-border text-primary  z-10 shrink min-w-[120px] max-w-[220px] w-auto font-medium"
                                            : "bg-transparent border-transparent text-muted-foreground/60 hover:bg-primary/5 hover:text-muted-foreground/80 hover:border-border/30 z-0 shrink min-w-[120px] max-w-[220px] w-auto",
                                        draggedIndex === index && "opacity-50",
                                        dragOverIndex === index && "bg-sidebar-accent",
                                        general.appDirection === 'rtl' ? 'flex-row-reverse' : 'flex-row'
                                    )}
                                >
                                    {tab.isPinned ? (
                                        <Pin size={11} className={cn(
                                            "shrink-0  rotate-45 fill-current",
                                            isActive ? "text-accent-full" : "text-muted-foreground/40 group-hover:text-muted-foreground/70"
                                        )} />
                                    ) : (
                                        <FileText size={11} className={cn(
                                            "shrink-0 ",
                                            isActive ? "text-accent-full" : "text-muted-foreground/40 group-hover:text-muted-foreground/70"
                                        )} />
                                    )}

                                    <span style={{ direction: general.appDirection === 'rtl' ? 'rtl' : 'ltr' }} className={cn(
                                        "truncate flex-1 text-[11px] select-none",
                                        isActive ? "font-semibold" : "font-medium"
                                    )}>
                                        {note.title || "Untitled"}
                                    </span>

                                    <div
                                        className={cn(
                                            "flex p-0.5 shrink-0 items-center justify-center rounded-full ",
                                            isActive ? "opacity-85 hover:bg-primary/10 hover:text-primary" : "opacity-0 group-hover:opacity-60 hover:bg-sidebar-accent hover:text-foreground"
                                        )}
                                        onClick={(e) => handleClose(e, tab.noteId)}
                                    >
                                        <X size={14} strokeWidth={2.5} />
                                    </div>
                                </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-48">
                                <ContextMenuItem onClick={() => togglePinTab(tab.noteId)} className="gap-2">
                                    <Pin size={15} className={cn("text-muted-foreground", tab.isPinned && "rotate-45 fill-current")} />
                                    <span>{tab.isPinned ? "Unpin Tab" : "Pin Tab"}</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator />

                                <ContextMenuItem onClick={() => handleCloseOtherTabs(tab.noteId)} className="gap-2">
                                    <XCircle size={15} className="text-muted-foreground" />
                                    <span>Close Other Tabs</span>
                                </ContextMenuItem>
                                <ContextMenuItem onClick={(e) => handleClose(e as any, tab.noteId)} className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive">
                                    <X size={15} />
                                    <span>Close Tab</span>
                                </ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                    );
                })}
            </div>
        </div>
    );
}
