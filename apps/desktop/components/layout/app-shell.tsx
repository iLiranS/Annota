import { SidebarProvider } from "@/components/ui/sidebar";
import { useSettingsStore } from "@annota/core";
import { Outlet } from "react-router-dom";
import { MainNavbar } from "../navbar/main-navbar";
import { AppSidebar } from "./app-sidebar";

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
                <main className="flex-1 overflow-hidden">
                    <Outlet />
                </main>
            </div>
        </SidebarProvider>
    );
}
