import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useSettingsStore } from "@annota/core";
import { Outlet } from "react-router-dom";
import { NotesSidebar } from "./notes-sidebar";

export default function NotesLayout() {
    const { general } = useSettingsStore();

    return (
        <SidebarProvider
            className="flex h-full w-full"
            dir={general.appDirection}
        >
            <NotesSidebar />
            <SidebarInset className="flex-1 overflow-auto bg-transparent" dir="ltr">
                <Outlet />
            </SidebarInset>
        </SidebarProvider>
    );
}
