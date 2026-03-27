import { SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@annota/core";
import { Outlet } from "react-router-dom";
import { MainNavbar } from "../navbar/main-navbar";
import { AppSidebar } from "./app-sidebar";
import { TaskCalendarSidebar } from "./task-calendar-sidebar";

/**
 * Main app shell: shadcn SidebarProvider wrapping the primary sidebar + routed content.
 */
export default function AppShell() {
    const { general } = useSettingsStore();

    return (
        <SidebarProvider
            className="h-svh"
            dir={general.appDirection}
        >
            <AppSidebar />
            <div className="flex flex-1 flex-col overflow-hidden bg-sidebar">
                <MainNavbar />
                <div className="flex flex-1 overflow-hidden">
                    <main
                        className={cn(
                            "flex-1 overflow-hidden bg-note-bg transition-[width,transform,opacity,border-color] duration-300 ease-in-out",
                            "m-2 mt-0 rounded-2xl ",
                            "border border-sidebar-border/60"
                        )}

                        dir="ltr" // Editor/Content is always LTR unless specific note direction is set
                    >
                        <Outlet />
                    </main>
                    <div className={cn(
                        "transition-[width,transform,opacity] duration-300 ease-in-out overflow-hidden flex shrink-0 bg-sidebar",
                        general.isTaskCalendarOpen ? "w-64" : "w-0"
                    )}>

                        <TaskCalendarSidebar />
                    </div>
                </div>
            </div>
        </SidebarProvider>
    );
}
