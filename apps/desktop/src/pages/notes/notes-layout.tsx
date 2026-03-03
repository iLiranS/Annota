import { Outlet, useSearchParams } from "react-router-dom";
import { NotesSidebar } from "./notes-sidebar";

export default function NotesLayout() {
    const [searchParams] = useSearchParams();
    const folderId = searchParams.get("folderId") ?? undefined;

    return (
        <div className="flex h-screen w-full">
            <NotesSidebar currentFolderId={folderId} />
            <div className="flex-1 overflow-auto">
                <Outlet />
            </div>
        </div>
    );
}
