import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ExternalLink, Eye } from "lucide-react";
import { useMemo } from "react";

export interface LinkContextMenuProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    anchorRect: DOMRect | null;
    url: string;
    onPreview: (noteId: string) => void;
    onOpenInNewWindow: (noteId: string) => void;
}

export function LinkContextMenu({
    open,
    onOpenChange,
    anchorRect,
    url,
    onPreview,
    onOpenInNewWindow,
}: LinkContextMenuProps) {

    const noteId = useMemo(() => {
        if (!url) return null;
        const match = url.match(/annota:\/\/note\/([^?#\s]+)/);
        return match ? match[1] : null;
    }, [url]);

    if (!anchorRect || !noteId) return null;

    const handleAction = (action: 'preview' | 'open') => {
        if (action === 'preview') {
            onPreview(noteId);
        } else {
            onOpenInNewWindow(noteId);
        }
        onOpenChange(false);
    };

    return (
        <DropdownMenu open={open} onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>
                <div
                    style={{
                        position: "fixed",
                        top: anchorRect.top,
                        left: anchorRect.left,
                        width: anchorRect.width,
                        height: anchorRect.height,
                        pointerEvents: "none",
                        zIndex: 100,
                    }}
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => handleAction('preview')}>
                    <Eye className="mr-2 h-4 w-4" />
                    <span>Preview Note</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAction('open')}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    <span>Open in New Window</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
