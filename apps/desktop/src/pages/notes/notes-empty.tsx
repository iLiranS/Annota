import { FileText } from "lucide-react";

export default function NotesEmpty() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <FileText className="h-12 w-12 text-border" />
            <p className="text-sm font-medium">Select a note to start editing</p>
        </div>
    );
}
