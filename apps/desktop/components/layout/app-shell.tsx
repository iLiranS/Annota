import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@annota/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { MainNavbar } from "../navbar/main-navbar";
import { AppSidebar } from "./app-sidebar";
import { SecondarySidebar } from "./secondary-sidebar";

function AppShellContent() {
    const { open } = useSidebar();
    const { general } = useSettingsStore();

    // Committed width of Left Sidebar
    const [leftWidth, setLeftWidth] = useState(() => {
        const saved = localStorage.getItem("sidebar_width");
        return saved ? parseInt(saved, 10) : 230;
    });

    // Committed width of Secondary Sidebar — only updated on drag end, drives React render
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
            window.dispatchEvent(new CustomEvent('sidebar-resize', { detail: { width: newWidth, side: 'right' } }));
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

    // Listen to real-time resizing of the left/right sidebars to update margins
    useEffect(() => {
        const handleResize = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail.side === 'left') {
                setLeftWidth(detail.width);
            }
            if (detail.side === 'right') {
                setSidebarWidth(detail.width);
            }
        };
        window.addEventListener('sidebar-resize', handleResize);
        return () => window.removeEventListener('sidebar-resize', handleResize);
    }, []);

    const isRtl = general.appDirection === 'rtl';
    const leftOpen = open;
    const rightOpen = general.isSecondarySidebarOpen;

    const GAP = 8; // Tailwind spacing 2 (8px)

    // Note Card Margin Calculations
    const leftMarginValue = isRtl
        ? (rightOpen ? `${sidebarWidth + GAP * 2}px` : `${GAP}px`)
        : (leftOpen ? `${leftWidth}px` : `${GAP}px`);

    const rightMarginValue = isRtl
        ? (leftOpen ? `${leftWidth}px` : `${GAP}px`)
        : (rightOpen ? `${sidebarWidth + GAP * 2}px` : `${GAP}px`);

    // Note Card Transition Delay Calculations (delay is only applied when closing sidebars)
    const leftMarginDelay = isRtl
        ? (rightOpen ? '0ms' : '300ms')
        : (leftOpen ? '0ms' : '300ms');

    const rightMarginDelay = isRtl
        ? (leftOpen ? '0ms' : '300ms')
        : (rightOpen ? '0ms' : '300ms');

    return (
        <div className="flex flex-1 flex-col overflow-hidden bg-sidebar">
            <MainNavbar />

            {/* Main page content container */}
            <div className="flex-1 overflow-hidden flex min-w-0 relative">
                <AppSidebar />

                {/* Primary Note Card (Rounded, Bordered) */}
                <div
                    className={cn(
                        "flex-1 overflow-hidden flex min-w-0 relative z-10",
                        "mb-2 rounded-2xl border border-sidebar-border/60 bg-note-bg",
                        "ltr:shadow-[3px_1px_2px_0_rgb(0_0_0/0.02),4px_2px_8px_-1px_rgb(0_0_0/0.05),8px_6px_20px_-4px_rgb(0_0_0/0.07)]",
                        "rtl:shadow-[-3px_1px_2px_0_rgb(0_0_0/0.02),-4px_2px_8px_-1px_rgb(0_0_0/0.05),-8px_6px_20px_-4px_rgb(0_0_0/0.07)]",
                        "dark:ltr:shadow-[3px_1px_2px_0_rgb(0_0_0/0.1),4px_2px_8px_-1px_rgb(0_0_0/0.16),8px_6px_20px_-4px_rgb(0_0_0/0.2)]",
                        "dark:rtl:shadow-[-3px_1px_2px_0_rgb(0_0_0/0.1),-4px_2px_8px_-1px_rgb(0_0_0/0.16),-8px_6px_20px_-4px_rgb(0_0_0/0.2)]"
                    )}
                    style={{
                        marginLeft: leftMarginValue,
                        marginRight: rightMarginValue,
                        transitionProperty: 'margin-left, margin-right',
                        transitionDuration: '0s',
                        transitionDelay: `${leftMarginDelay}, ${rightMarginDelay}`,
                    }}
                >
                    <div
                        className={cn(
                            "flex-1 overflow-hidden flex flex-col min-h-0"
                        )}
                        dir="ltr"
                    >
                        <Outlet />
                    </div>
                </div>

                {/* Secondary Sidebar Container (Outside the main note card) */}
                <div
                    ref={sidebarRef}
                    className={cn(
                        "absolute top-0 bottom-2 z-20 flex shrink-0 flex-col",
                        isRtl ? "left-2" : "right-2",
                        !general.isSecondarySidebarOpen && "opacity-0 pointer-events-none",
                        !isResizing && "transition-[transform,opacity] duration-300 ease-in-out"
                    )}
                    style={{
                        width: `${sidebarWidth}px`,
                        transform: general.isSecondarySidebarOpen
                            ? "none"
                            : `translateX(${isRtl ? "-100%" : "100%"})`,
                    }}
                >
                    {/* Resize handle */}
                    {general.isSecondarySidebarOpen && (
                        <div
                            onMouseDown={startResizing}
                            className={cn(
                                "absolute top-0 bottom-0 w-1 hover:bg-border cursor-col-resize z-50 flex items-center justify-center group",
                                isRtl ? "right-0 translate-x-1/2" : "left-0 -translate-x-1/2"
                            )}
                        />
                    )}

                    <SecondarySidebar width={sidebarWidth} isResizing={isResizing} />
                </div>
            </div>
        </div>
    );
}

export default function AppShell() {
    const { general } = useSettingsStore();

    return (
        <SidebarProvider
            className="h-svh"
            dir={general.appDirection}
        >
            <AppShellContent />
        </SidebarProvider>
    );
}