import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Outlet } from "react-router-dom";
import { NotesSidebar } from "./notes-sidebar";

export default function NotesLayout() {
    return (
        <SidebarProvider className="flex h-full w-full">
            <NotesSidebar />
            <SidebarInset className="flex-1 overflow-auto bg-transparent">
                <Outlet />
            </SidebarInset>
        </SidebarProvider>
    );
}
