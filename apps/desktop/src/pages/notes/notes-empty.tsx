import { DAILY_NOTES_FOLDER_ID } from "@annota/core";
import { FileText } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { DailyNotesCalendar } from "./components/daily-notes-calendar";

export default function NotesEmpty() {
    const [searchParams] = useSearchParams();
    const folderId = searchParams.get("folderId");

    if (folderId === DAILY_NOTES_FOLDER_ID) {
        return <DailyNotesCalendar />;
    }

    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground animate-in fade-in duration-500">
            <FileText className="h-10 w-10 text-primary/10" />
            <p className="text-sm font-medium">Open a note or create a new one to get started</p>
        </div>
    );
}
