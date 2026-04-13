import { SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@annota/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { MainNavbar } from "../navbar/main-navbar";
import { AiSidebar } from "./ai-sidebar";
import { AppSidebar } from "./app-sidebar";

/**
 * Main app shell: shadcn SidebarProvider wrapping the primary sidebar + routed content.
 * The AI sidebar floats — it doesn't shrink the main content area.
 */
export default function AppShell() {
    const { general } = useSettingsStore();

    // Committed width — only updated on drag end, drives React render
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('ai-sidebar-width');
        return saved ? parseInt(saved, 10) : 380;
    });

    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Refs so mousemove handler never closes over stale values
    const isResizingRef = useRef(false);
    const directionRef = useRef(general.appDirection);
    directionRef.current = general.appDirection;

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizingRef.current = true;
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        if (!isResizingRef.current) return;
        isResizingRef.current = false;
        setIsResizing(false);

        // Commit the DOM width to React state + localStorage only once, on release
        const el = sidebarRef.current;
        if (el) {
            const finalWidth = el.offsetWidth;
            setSidebarWidth(finalWidth);
            localStorage.setItem('ai-sidebar-width', finalWidth.toString());
        }
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (!isResizingRef.current) return;

        const newWidth = directionRef.current === "rtl"
            ? e.clientX
            : window.innerWidth - e.clientX;

        if (newWidth >= 300 && newWidth <= 800) {
            // Write directly to the DOM — zero React re-renders during drag
            if (sidebarRef.current) {
                sidebarRef.current.style.width = `${newWidth}px`;
            }
        }
    }, []);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    // Handle auto-close on click outside (only for non-sticky floating mode)
    useEffect(() => {
        if (!general.isAiSidebarOpen || general.aiSidebarMode === 'pinned' || general.isAiSidebarSticky) {
            return;
        }

        const handleClickOutside = (e: MouseEvent) => {
            if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
                const target = e.target as HTMLElement;
                if (target.closest('[data-radix-portal]') || target.closest('.ai-sidebar-toggle')) {
                    return;
                }

                useSettingsStore.getState().updateGeneralSettings({ isAiSidebarOpen: false });
            }
        };

        document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [general.isAiSidebarOpen, general.aiSidebarMode, general.isAiSidebarSticky]);

    return (
        <SidebarProvider
            className="h-svh"
            dir={general.appDirection}
        >
            <div className="flex flex-1 flex-col overflow-hidden bg-sidebar">
                <MainNavbar />

                {/* Main page content container */}
                <div className="flex-1 overflow-hidden flex min-w-0">

                    {/* Primary Note Card (Rounded, Bordered) */}
                    <div className={cn(
                        "flex-1 overflow-hidden flex min-w-0 transition-all duration-300",
                        "m-2 mt-0 rounded-2xl border border-sidebar-border/60 bg-note-bg"
                    )}>
                        <AppSidebar />

                        <div
                            className={cn(
                                "flex-1 overflow-hidden flex flex-col min-h-0"
                            )}
                            dir="ltr"
                        >
                            <Outlet />
                        </div>
                    </div>

                    {/* AI Sidebar Container (Outside the main note card) */}
                    <div
                        ref={sidebarRef}
                        className={cn(
                            general.aiSidebarMode === 'pinned'
                                ? "relative h-full"
                                : cn(
                                    "absolute z-50",
                                    "top-10 bottom-4",
                                    general.appDirection === "rtl" ? "left-6" : "right-6"
                                ),
                            "flex shrink-0 overflow-hidden",
                            // Only animate on open/close, not during drag
                            !isResizing && "transition-[width,opacity] duration-300 ease-in-out",
                            general.isAiSidebarOpen
                                ? "opacity-100 pointer-events-auto"
                                : "opacity-0 pointer-events-none w-0!"
                        )}
                        style={{
                            width: general.isAiSidebarOpen ? `${sidebarWidth}px` : '0px',
                        }}
                    >
                        {/* Resize handle */}
                        {general.isAiSidebarOpen && (
                            <div
                                onMouseDown={startResizing}
                                className={cn(
                                    "absolute top-0 bottom-0 w-3 cursor-col-resize z-50 flex items-center justify-center group",
                                    general.appDirection === "rtl" ? "-right-1.5" : "-left-1.5"
                                )}
                            >
                                <div className="w-px h-full bg-transparent group-hover:bg-primary/40 group-hover:w-0.5 transition-all" />
                            </div>
                        )}

                        <AiSidebar width={sidebarWidth} />
                    </div>
                </div>
            </div>
        </SidebarProvider>
    );
}