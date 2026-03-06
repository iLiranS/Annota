import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { EditorState, ToolbarRenderProps } from '@annota/tiptap-editor';
import { ChevronDown } from 'lucide-react';

interface HeadingSelectorProps {
    editorState: EditorState;
    sendCommand: ToolbarRenderProps['sendCommand'];
    onOpenChange?: (open: boolean) => void;
    isMenu?: boolean;
}

export function HeadingSelector({ editorState, sendCommand, onOpenChange, isMenu }: HeadingSelectorProps) {
    const currentHeadingLabel = editorState.isHeading1 ? 'H1' :
        editorState.isHeading2 ? 'H2' :
            editorState.isHeading3 ? 'H3' :
                editorState.isHeading4 ? 'H4' :
                    editorState.isHeading5 ? 'H5' :
                        editorState.isHeading6 ? 'H6' : 'T';

    const items = (
        <>
            <DropdownMenuItem onClick={() => sendCommand('setParagraph')}>
                Paragraph
            </DropdownMenuItem>
            {[1, 2, 3, 4, 5, 6].map((level) => (
                <DropdownMenuItem key={level} onClick={() => sendCommand('toggleHeading', { level })}>
                    Heading {level}
                </DropdownMenuItem>
            ))}
        </>
    );

    if (isMenu) {
        return (
            <DropdownMenuSub onOpenChange={onOpenChange}>
                <DropdownMenuSubTrigger className="gap-2">
                    <span className="flex-1">Text Type</span>
                    <span className="text-xs font-bold opacity-50">{currentHeadingLabel}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                        <DropdownMenuLabel className="text-xs font-semibold opacity-50 px-2 py-1">HEADING</DropdownMenuLabel>
                        {items}
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
        );
    }

    return (
        <DropdownMenu onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-13 justify-between gap-1 px-3 font-bold text-foreground">
                    {currentHeadingLabel}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
                <DropdownMenuContent align="start">
                    <DropdownMenuLabel className="text-xs font-semibold opacity-50 px-2 py-1">HEADING</DropdownMenuLabel>
                    {items}
                </DropdownMenuContent>
            </DropdownMenuPortal>
        </DropdownMenu>
    );
}
