import { SidebarProvider } from "@/components/ui/sidebar";
import { Outlet } from "react-router-dom";
import { MainNavbar } from "../navbar/main-navbar";
import { AppSidebar } from "./app-sidebar";

/**
 * Main app shell: shadcn SidebarProvider wrapping the primary sidebar + routed content.
 */
export default function AppShell() {
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
