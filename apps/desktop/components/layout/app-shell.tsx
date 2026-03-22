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
            <div className="flex flex-1 flex-col overflow-hidden">
                <MainNavbar />
                <div className="flex flex-1 overflow-hidden bg-background">
                    <main
                        className="flex-1 overflow-hidden"
                        dir="ltr" // Editor/Content is always LTR unless specific note direction is set
                    >
                        <Outlet />
                    </main>
                    <div className={cn(
                        "transition-all duration-300 ease-in-out overflow-hidden flex shrink-0",
                        general.isTaskCalendarOpen ? "w-72" : "w-0"
                    )}>
                        <TaskCalendarSidebar />
                    </div>
                </div>
            </div>
        </SidebarProvider>
    );
}
