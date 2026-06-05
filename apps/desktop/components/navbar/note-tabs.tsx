import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Ionicons } from "@/components/ui/ionicons";
import { cn } from "@/lib/utils";
import { DAILY_NOTES_FOLDER_ID, Folder, NoteMetadata, TRASH_FOLDER_ID, useNavigationStore, useNotesStore, useSettingsStore } from "@annota/core";
import { Pin, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useNoteTabsStore } from "../../hooks/use-note-tabs";
import { NoteContextMenuContent, useNoteModals } from "../notes/note-context-menu";


export function NoteTabs() {
    const { noteId: routeNoteId } = useParams();

    const location = useLocation();
    const navigate = useNavigate();
    const { general } = useSettingsStore();


    const tabs = useNoteTabsStore(s => s.tabs);
    const addTab = useNoteTabsStore(s => s.addTab);
    const removeTab = useNoteTabsStore(s => s.removeTab);
    const setTabs = useNoteTabsStore(s => s.setTabs);
    const reorderTabs = useNoteTabsStore(s => s.reorderTabs);
    const togglePinTab = useNoteTabsStore(s => s.togglePinTab);

    const notes = useNotesStore(s => s.notes);
    const deleteNote = useNotesStore(s => s.deleteNote);

    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // Track the currently right-clicked note for modal rendering
    const [selectedNote, setSelectedNote] = useState<NoteMetadata | null>(null);
    const { openLocationPicker, renderModals } = useNoteModals(selectedNote);

    const folders = useNotesStore(s => s.folders);
    const setSidebarTab = useNavigationStore(s => s.setSidebarTab);
    const setSelectedFolderId = useNavigationStore(s => s.setSelectedFolderId);

    const getFolderForNote = useCallback((note: NoteMetadata): Folder => {
        if (note.isDeleted) {
            return {
                id: TRASH_FOLDER_ID,
                name: "Trash",
                icon: "trash",
                color: "#EF4444",
            } as Folder;
        }
        const folderId = note.folderId;
        if (folderId === DAILY_NOTES_FOLDER_ID) {
            return {
                id: DAILY_NOTES_FOLDER_ID,
                name: "Daily Notes",
                icon: "calendar",
                color: "#8B5CF6",
            } as Folder;
        }
        if (!folderId || folderId === "root") {
            return {
                id: "root",
                name: "Annota",
                icon: "documents",
                color: "#6366F1",
            } as Folder;
        }
        const customFolder = folders.find(f => f.id === folderId);
        if (customFolder) {
            return customFolder;
        }
        return {
            id: "root",
            name: "Annota",
            icon: "documents",
            color: "#6366F1",
        } as Folder;
    }, [folders]);

    const handleShowFolder = useCallback((e: React.MouseEvent, note: NoteMetadata) => {
        e.stopPropagation();
        e.preventDefault();
        const folder = getFolderForNote(note);
        setSidebarTab("notes");
        setSelectedFolderId(folder.id);
    }, [getFolderForNote, setSidebarTab, setSelectedFolderId]);

    const selectedFolderId = useNavigationStore(s => s.selectedFolderId);
    const activeNote = routeNoteId ? notes.find(n => n.id === routeNoteId) : null;
    const isSpecialView = (!routeNoteId && (selectedFolderId === DAILY_NOTES_FOLDER_ID || selectedFolderId === TRASH_FOLDER_ID)) || (activeNote?.isDeleted === true);
    const lastViewedNoteId = useNavigationStore(s => s.lastViewedNoteId);

    const activeNoteId = useMemo(() => {
        if (isSpecialView) return null;
        if (routeNoteId) return routeNoteId;
        if (lastViewedNoteId) return lastViewedNoteId;
        return null;
    }, [isSpecialView, routeNoteId, lastViewedNoteId]);

    const lastRouteNoteIdRef = useRef(activeNoteId);

    // 1. Sync current route to tabs
    useEffect(() => {
        if (activeNoteId && location.pathname.startsWith('/notes') && routeNoteId) {
            const currentTabs = useNoteTabsStore.getState().tabs;
            const existingTab = currentTabs.find(t => t.noteId === activeNoteId);

            if (!existingTab) {
                const note = notes.find(n => n.id === activeNoteId);
                const folderId = note?.folderId || 'root';

                if (general.openNoteInNewTab === false) {
                    // Replace the previously active tab with the new one, unless it is pinned
                    const lastId = lastRouteNoteIdRef.current;
                    const newTabs = [...currentTabs];
                    const indexToReplace = newTabs.findIndex(t => t.noteId === lastId);

                    const tabToReplace = indexToReplace !== -1 ? newTabs[indexToReplace] : null;
                    const isPinned = tabToReplace?.isPinned === true;

                    if (indexToReplace !== -1 && !isPinned) {
                        newTabs[indexToReplace] = { noteId: activeNoteId, folderId };
                        setTabs(newTabs);
                    } else if (newTabs.length > 0 && !isPinned && !newTabs[0].isPinned) {
                        // Fallback: replace the first tab if it is not pinned
                        newTabs[0] = { noteId: activeNoteId, folderId };
                        setTabs(newTabs);
                    } else {
                        addTab({ noteId: activeNoteId, folderId });
                    }
                } else {
                    addTab({ noteId: activeNoteId, folderId });
                }
            }
        }
        lastRouteNoteIdRef.current = activeNoteId;
    }, [activeNoteId, routeNoteId, location.pathname, addTab, general.openNoteInNewTab, setTabs, notes]);

    useEffect(() => {
        const handleNavigate = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail && customEvent.detail.noteId) {
                navigate(`/notes/${customEvent.detail.noteId}`);
            }
        };
        window.addEventListener('navigate-note-tab', handleNavigate);
        return () => window.removeEventListener('navigate-note-tab', handleNavigate);
    }, [navigate]);

    useEffect(() => {
        const handleCloseCurrentTab = () => {
            if (activeNoteId) {
                const tabIndex = tabs.findIndex(t => t.noteId === activeNoteId);
                if (tabIndex === -1) return;

                if (tabs.length > 1) {
                    const nextTab = tabs[tabIndex === tabs.length - 1 ? tabIndex - 1 : tabIndex + 1];
                    navigate(`/notes/${nextTab.noteId}`);
                } else {
                    navigate('/notes');
                }

                removeTab(activeNoteId);
            }
        };
        window.addEventListener('close-current-note-tab', handleCloseCurrentTab);
        return () => window.removeEventListener('close-current-note-tab', handleCloseCurrentTab);
    }, [activeNoteId, tabs, navigate, removeTab]);

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
                navigate(`/notes/${nextTab.noteId}`);
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
            navigate(`/notes/${firstTab.noteId}`);
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

        navigate(`/notes/${noteId}`);
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
            dir={general.appDirection === 'rtl' ? 'rtl' : 'ltr'}
            className="flex-1 flex flex-row items-center h-full overflow-x-auto overflow-y-hidden min-w-0 note-tabs-scrollbar-hide"
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
                .note-tabs-scrollbar-hide::-webkit-scrollbar,
                .note-tabs-container::-webkit-scrollbar {
                    display: none;
                }
                .inactive-folder-icon {
                    opacity: 0.6;
                }
                .group:hover .inactive-folder-icon {
                    opacity: 1;
                }
                .folder-tab-icon:hover {
                    background-color: var(--folder-color-hover) !important;
                }
            `}</style>
            <div
                data-tauri-drag-region
                className="note-tabs-container flex flex-row min-w-full w-max h-full items-center gap-1.5 "
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
                        <ContextMenu key={tab.noteId} onOpenChange={(open) => open && setSelectedNote(note)}>
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
                                        navigate(`/notes/${tab.noteId}`);
                                    }}
                                    className={cn(
                                        "group relative flex h-9/12 cursor-pointer items-center justify-start gap-1.5 rounded border text-xs select-none flex-row px-1",
                                        isActive
                                            ? "bg-note-bg dark:bg-primary/10 border-border text-primary  z-10 shrink min-w-[120px] max-w-[220px] w-auto font-medium"
                                            : "bg-transparent border-transparent text-muted-foreground/60 hover:bg-primary/5 hover:text-muted-foreground/80 hover:border-border/30 z-0 shrink min-w-[120px] max-w-[220px] w-auto",
                                        draggedIndex === index && "opacity-50",
                                        dragOverIndex === index && "bg-sidebar-accent"
                                    )}
                                >
                                    {tab.isPinned ? (
                                        <Pin size={12} className={cn(
                                            "shrink-0  rotate-45 fill-current",
                                            isActive ? "text-accent-full" : "text-muted-foreground/40 group-hover:text-muted-foreground/70"
                                        )} />
                                    ) : (
                                        <div
                                            onClick={(e) => handleShowFolder(e, note)}
                                            className={cn(
                                                "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] shadow-sm border border-black/5 dark:border-white/5 cursor-pointer folder-tab-icon hover:scale-105",
                                                isActive ? "bg-background/80" : "bg-primary/5 hover:bg-primary/10 inactive-folder-icon"
                                            )}
                                            style={{
                                                backgroundColor: getFolderForNote(note).color ? `${getFolderForNote(note).color}20` : undefined,
                                                "--folder-color-hover": getFolderForNote(note).color ? `${getFolderForNote(note).color}40` : undefined,
                                            } as React.CSSProperties}
                                            title={`Show in Sidebar (Folder: ${getFolderForNote(note).name})`}
                                        >
                                            <Ionicons
                                                name={(getFolderForNote(note).icon as any) || "folder"}
                                                size={10}
                                                style={{ color: getFolderForNote(note).color || 'var(--accent-full)' }}
                                            />
                                        </div>
                                    )}

                                    <span style={{ direction: general.appDirection === 'rtl' ? 'rtl' : 'ltr' }} className={cn(
                                        "truncate flex-1 text-[11px] select-none",
                                        isActive ? "font-semibold" : "font-medium"
                                    )}>
                                        {note.title || "Untitled"}
                                    </span>

                                    <div
                                        className={cn(
                                            "flex p-0.5 shrink-0 items-center justify-center rounded ",
                                            isActive
                                                ? "opacity-85 text-primary/75 hover:text-primary hover:bg-foreground/10"
                                                : "opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-primary hover:bg-foreground/10"
                                        )}
                                        onClick={(e) => handleClose(e, tab.noteId)}
                                    >
                                        <X size={14} strokeWidth={2.5} />
                                    </div>
                                </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-52">

                                <ContextMenuItem onClick={() => togglePinTab(tab.noteId)} className="gap-2">
                                    <Pin size={15} className={cn("text-muted-foreground", tab.isPinned && "rotate-45 fill-current")} />
                                    <span>{tab.isPinned ? "Unpin Tab" : "Pin Tab"}</span>
                                </ContextMenuItem>
                                <ContextMenuItem onClick={() => handleCloseOtherTabs(tab.noteId)} className="gap-2">
                                    <XCircle size={15} className="text-muted-foreground" />
                                    <span>Close Other Tabs</span>
                                </ContextMenuItem>
                                <ContextMenuItem onClick={(e) => handleClose(e as any, tab.noteId)} className="gap-2">
                                    <X size={15} className="text-muted-foreground" />
                                    <span>Close Tab</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator />

                                <NoteContextMenuContent
                                    note={note}
                                    onMoveNote={openLocationPicker}
                                    onDelete={async () => {
                                        const tabId = tab.noteId;
                                        const tabIndex = tabs.findIndex(t => t.noteId === tabId);
                                        if (tabIndex !== -1) {
                                            if (tabId === activeNoteId) {
                                                if (tabs.length > 1) {
                                                    const nextTab = tabs[tabIndex === tabs.length - 1 ? tabIndex - 1 : tabIndex + 1];
                                                    navigate(`/notes/${nextTab.noteId}`);
                                                } else {
                                                    navigate('/notes');
                                                }
                                            }
                                        }
                                        removeTab(tabId);
                                        await deleteNote(tabId);
                                        toast.success("Note moved to Trash");
                                    }}
                                    disabledActions={["openInNewTab", "preview"]}
                                />


                            </ContextMenuContent>
                        </ContextMenu>
                    );
                })}
            </div>
            {renderModals()}
        </div>
    );
}
