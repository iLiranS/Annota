import { SidebarProvider } from "@/components/ui/sidebar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Outlet } from "react-router-dom";
import { MainNavbar } from "../navbar/main-navbar";
import { AppSidebar } from "./app-sidebar";

/**
 * Main app shell: shadcn SidebarProvider wrapping the primary sidebar + routed content.
 */
export default function AppShell() {
    // Activate the theme hook so it toggles .dark class on <html>
    useAppTheme();

    return (
        <SidebarProvider className="h-svh">
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
