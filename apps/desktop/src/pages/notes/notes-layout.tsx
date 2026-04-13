import { SidebarInset } from "@/components/ui/sidebar";
import { Outlet } from "react-router-dom";

export default function NotesLayout() {
    return (
        <SidebarInset className="flex-1 overflow-hidden min-h-0 bg-transparent border-none" dir="ltr">
            <Outlet />
        </SidebarInset>
    );
}
