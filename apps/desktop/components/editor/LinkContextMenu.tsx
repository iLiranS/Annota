import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, Eye, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";

export interface LinkContextMenuProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    anchorRect: DOMRect | null;
    url: string;
    onPreview: (noteId: string) => void;
    onOpenInNewWindow: (noteId: string) => void;
    onEdit: () => void;
    onDelete: () => void;
}

export function LinkContextMenu({
    open,
    onOpenChange,
    anchorRect,
    url,
    onPreview,
    onOpenInNewWindow,
    onEdit,
    onDelete,
}: LinkContextMenuProps) {

    const noteId = useMemo(() => {
        if (!url) return null;
        const match = url.match(/annota:\/\/note\/([^?#\s]+)/);
        return match ? match[1] : null;
    }, [url]);

    if (!anchorRect) return null;

    const handleAction = async (action: 'preview' | 'open' | 'edit' | 'delete' | 'external') => {
        if (action === 'preview' && noteId) {
            onPreview(noteId);
        } else if (action === 'open' && noteId) {
            onOpenInNewWindow(noteId);
        } else if (action === 'external') {
            try {
                await openUrl(url);
            } catch (err) {
                console.error("Failed to open URL:", err);
                window.open(url, '_blank'); // Fallback
            }
        } else if (action === 'edit') {
            onEdit();
        } else if (action === 'delete') {
            onDelete();
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
                {noteId ? (
                    <>
                        <DropdownMenuItem onClick={() => handleAction('preview')}>
                            <Eye className="mr-2 h-4 w-4" />
                            <span>Preview Note</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction('open')}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            <span>Open in New Window</span>
                        </DropdownMenuItem>
                    </>
                ) : (
                    <DropdownMenuItem onClick={() => handleAction('external')}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        <span>Open Link</span>
                    </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => handleAction('edit')}>
                    <Pencil className="mr-2 h-4 w-4" />
                    <span>Edit Link</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem 
                    onClick={() => handleAction('delete')}
                    className="text-destructive focus:text-destructive"
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete Link</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
