import { cn } from "@/lib/utils";
import { useNotesStore, useSettingsStore } from "@annota/core";
import { X, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useNoteTabsStore } from "../../hooks/use-note-tabs";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";

export function NoteTabs() {
    const { folderId: routeFolderId, noteId: routeNoteId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { general } = useSettingsStore();

    const tabs = useNoteTabsStore(s => s.tabs);
    const addTab = useNoteTabsStore(s => s.addTab);
    const removeTab = useNoteTabsStore(s => s.removeTab);
    const setTabs = useNoteTabsStore(s => s.setTabs);
    const reorderTabs = useNoteTabsStore(s => s.reorderTabs);

    const notes = useNotesStore(s => s.notes);

    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const lastRouteNoteIdRef = useRef(routeNoteId);

    // 1. Sync current route to tabs
    useEffect(() => {
        if (routeNoteId && location.pathname.startsWith('/notes')) {
            const currentTabs = useNoteTabsStore.getState().tabs;
            const existingTab = currentTabs.find(t => t.noteId === routeNoteId);

            if (!existingTab) {
                if (general.openNoteInNewTab === false) {
                    // Replace the previously active tab with the new one
                    const lastId = lastRouteNoteIdRef.current;
                    const newTabs = [...currentTabs];
                    const indexToReplace = newTabs.findIndex(t => t.noteId === lastId);
                    
                    if (indexToReplace !== -1) {
                        newTabs[indexToReplace] = { noteId: routeNoteId, folderId: routeFolderId || 'root' };
                        setTabs(newTabs);
                    } else if (newTabs.length > 0) {
                        // Fallback: replace the first tab
                        newTabs[0] = { noteId: routeNoteId, folderId: routeFolderId || 'root' };
                        setTabs(newTabs);
                    } else {
                        setTabs([{ noteId: routeNoteId, folderId: routeFolderId || 'root' }]);
                    }
                } else {
                    addTab({ noteId: routeNoteId, folderId: routeFolderId || 'root' });
                }
            }
        }
        lastRouteNoteIdRef.current = routeNoteId;
    }, [routeNoteId, routeFolderId, location.pathname, addTab, general.openNoteInNewTab, setTabs]);

    useEffect(() => {
        const handleNavigate = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail && customEvent.detail.noteId) {
                navigate(`/notes/${customEvent.detail.folderId}/${customEvent.detail.noteId}`);
            }
        };
        window.addEventListener('navigate-note-tab', handleNavigate);
        return () => window.removeEventListener('navigate-note-tab', handleNavigate);
    }, [navigate]);

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

        if (tabId === routeNoteId) {
            if (tabs.length > 1) {
                const nextTab = tabs[tabIndex === tabs.length - 1 ? tabIndex - 1 : tabIndex + 1];
                navigate(`/notes/${nextTab.folderId}/${nextTab.noteId}`);
            } else {
                navigate('/notes');
            }
        }

        removeTab(tabId);
    };

    const handleCloseOtherTabs = (tabId: string) => {
        const tabToKeep = tabs.find(t => t.noteId === tabId);
        if (tabToKeep) {
            setTabs([tabToKeep]);
            navigate(`/notes/${tabToKeep.folderId}/${tabToKeep.noteId}`);
        }
    };

    const containerRef = useRef<HTMLDivElement>(null);

    // Auto scroll to active tab
    useEffect(() => {
        if (routeNoteId && containerRef.current) {
            const activeEl = containerRef.current.querySelector(`[data-tab-id="${routeNoteId}"]`);
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [routeNoteId, tabs]);

    if (tabs.length === 0) return <div className="flex-1" style={{ WebkitAppRegion: 'drag' } as any} />;

    return (
        <div

            ref={containerRef}
            className={cn(
                "flex-1 flex items-end h-full overflow-x-auto overflow-y-hidden ml-2 mr-2",
                general.appDirection === 'rtl' ? 'flex-row-reverse' : 'flex-row'
            )}
            style={{
                WebkitAppRegion: 'no-drag',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
            } as any}
        >
            <style>{`
                .note-tabs-container::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
            <div data-tauri-drag-region className={cn(
                "note-tabs-container flex w-full h-full items-end gap-0.5 transition-all duration-300 px-5",
                general.appDirection === 'rtl' ? 'flex-row-reverse' : 'flex-row'
            )}>
                {tabs.map((tab, index) => {
                    const note = notes.find(n => n.id === tab.noteId);
                    if (!note) return null;
                    const isActive = tab.noteId === routeNoteId;

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
                                        e.preventDefault();
                                        if (draggedIndex !== null && draggedIndex !== index) {
                                            reorderTabs(draggedIndex, index);
                                        }
                                        setDraggedIndex(null);
                                        setDragOverIndex(null);
                                    }}
                                    onClick={() => navigate(`/notes/${tab.folderId}/${tab.noteId}`)}
                                    className={cn(
                                        "group relative flex h-[28px] cursor-pointer items-center justify-between gap-2 rounded-t-md border-x border-t px-3 text-xs transition-all duration-300 ease-in-out",
                                        isActive
                                            ? "bg-accent/30 border-border text-foreground z-10 before:absolute before:-bottom-px before:left-0 before:right-0 before:h-px before:bg-background shrink-0 min-w-[120px] max-w-[220px] w-auto"
                                            : "bg-sidebar border-transparent text-muted-foreground hover:bg-sidebar-accent hover:text-foreground z-0 shrink min-w-[45px] max-w-[220px] w-auto",
                                        draggedIndex === index && "opacity-50",
                                        dragOverIndex === index && "bg-sidebar-accent",
                                        general.appDirection === 'rtl' ? 'flex-row-reverse' : 'flex-row'
                                    )}
                                >
                                    <span className="truncate flex-1 text-[11px] font-medium select-none">
                                        {note.title || "Untitled"}
                                    </span>

                                    <div
                                        className={cn(
                                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm transition-colors",
                                            isActive ? "opacity-100 hover:bg-accent hover:text-foreground" : "opacity-0 group-hover:opacity-100 hover:bg-background/80 hover:text-foreground"
                                        )}
                                        onClick={(e) => handleClose(e, tab.noteId)}
                                    >
                                        <X size={12} strokeWidth={2.5} />
                                    </div>

                                    {/* Visual separator for inactive tabs */}
                                    {!isActive && (
                                        <div className={cn(
                                            "absolute top-1/4 bottom-1/4 w-px bg-border/40 transition-opacity group-hover:opacity-0",
                                            general.appDirection === 'rtl' ? 'left-px' : 'right-px'
                                        )} />
                                    )}
                                </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-48">
                                <ContextMenuItem onClick={() => handleCloseOtherTabs(tab.noteId)} className="gap-2">
                                    <XCircle size={15} className="text-muted-foreground" />
                                    <span>Close Other Tabs</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator />
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
