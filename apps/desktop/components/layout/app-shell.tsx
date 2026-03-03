import { SidebarProvider } from "@/components/ui/sidebar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./app-sidebar";

/**
 * Main app shell: shadcn SidebarProvider wrapping the primary sidebar + routed content.
 */
export default function AppShell() {
    // Activate the theme hook so it toggles .dark class on <html>
    useAppTheme();

    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="flex flex-1 overflow-hidden">
                <Outlet />
            </main>
        </SidebarProvider>
    );
}
