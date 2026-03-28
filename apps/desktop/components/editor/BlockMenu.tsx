import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { COLOR_PALETTE } from "@annota/core/constants/colors";
import { CODE_LANGUAGES } from "@annota/core/constants/editor-code-languages";
import {
    Check,
    Columns,
    Copy,
    Download,
    Languages,
    Link,
    Maximize,
    Merge,
    Palette,
    Rows,
    Scissors,
    Split,
    Trash2
} from "lucide-react";

export interface BlockMenuProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    anchorRect: DOMRect | null;
    type: "image" | "file" | "details" | "codeBlock" | "table" | "mermaid";
    data: any;
    onAction: (action: string, params?: any) => void;
}

export function BlockMenu({
    open,
    onOpenChange,
    anchorRect,
    type,
    data,
    onAction,
}: BlockMenuProps) {


    if (!anchorRect) return null;

    const handleAction = (action: string, params?: any) => {
        onAction(action, params);
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
                {type === "image" && (
                    <>
                        <DropdownMenuItem onClick={() => handleAction("resize", { width: "25%" })}>
                            <Maximize className="mr-2 h-4 w-4" />
                            <span>Resize 25%</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction("resize", { width: "50%" })}>
                            <Maximize className="mr-2 h-4 w-4" />
                            <span>Resize 50%</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction("resize", { width: "100%" })}>
                            <Maximize className="mr-2 h-4 w-4" />
                            <span>Full Width</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleAction("copy")}>
                            <Copy className="mr-2 h-4 w-4" />
                            <span>Copy Image</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction("cut")}>
                            <Scissors className="mr-2 h-4 w-4" />
                            <span>Cut Image</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction("download")}>
                            <Download className="mr-2 h-4 w-4" />
                            <span>Download</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => handleAction("delete")}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                        </DropdownMenuItem>
                    </>
                )}
                {type === "file" && (
                    <>
                        <DropdownMenuItem onClick={() => handleAction("open")}>
                            <Link className="mr-2 h-4 w-4" />
                            <span>Open File</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            onClick={() => handleAction("delete")}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                        </DropdownMenuItem>
                    </>
                )}

                {type === "details" && (
                    <>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Palette className="mr-2 h-4 w-4" />
                                <span>Background Color</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="p-2 grid grid-cols-5 gap-1 min-w-[200px]">
                                {COLOR_PALETTE.map((color) => {
                                    const isActive = data.backgroundColor?.toLowerCase().startsWith(color.value.toLowerCase());
                                    return (
                                        <button
                                            key={color.value}
                                            className="h-6 w-6 rounded-full border border-black/10 flex items-center justify-center hover:scale-110 transition-transform"
                                            style={{ backgroundColor: color.value }}
                                            onClick={() => handleAction("background", { color: isActive ? null : color.value })}
                                            title={color.name}
                                        >
                                            {isActive && <Check className="h-3 w-3 text-white shadow-sm" />}
                                        </button>
                                    );
                                })}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem onClick={() => handleAction("copyLink")}>
                            <Link className="mr-2 h-4 w-4" />
                            <span>Copy Link</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction("copy")}>
                            <Copy className="mr-2 h-4 w-4" />
                            <span>Copy</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction("cut")}>
                            <Scissors className="mr-2 h-4 w-4" />
                            <span>Cut</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => handleAction("delete")}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                        </DropdownMenuItem>
                    </>
                )}

                {type === "codeBlock" && (
                    <>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Languages className="mr-2 h-4 w-4" />
                                <span>Change Language</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="max-h-[300px] overflow-y-auto w-48">
                                {CODE_LANGUAGES.map((lang) => (
                                    <DropdownMenuItem
                                        key={lang.value || 'auto'}
                                        onClick={() => handleAction("language", { language: lang.value })}
                                        className={cn("justify-between", data.language === lang.value && "bg-accent")}
                                    >
                                        {lang.label}
                                        {data.language === lang.value && <Check className="h-3 w-3 ml-2" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem onClick={() => handleAction("copy")}>
                            <Copy className="mr-2 h-4 w-4" />
                            <span>Copy Code</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction("cut")}>
                            <Scissors className="mr-2 h-4 w-4" />
                            <span>Cut</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => handleAction("delete")}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                        </DropdownMenuItem>
                    </>
                )}

                {type === "table" && (
                    <>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Palette className="mr-2 h-4 w-4" />
                                <span>Cell Background</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="p-2 grid grid-cols-5 gap-1 min-w-[200px]">
                                {COLOR_PALETTE.map((color) => {
                                    const isActive = data.backgroundColor?.toLowerCase().startsWith(color.value.toLowerCase());
                                    return (
                                        <button
                                            key={color.value}
                                            className="h-6 w-6 rounded-full border border-black/10 flex items-center justify-center hover:scale-110 transition-transform"
                                            style={{ backgroundColor: color.value }}
                                            onClick={() => handleAction("background", { color: isActive ? null : color.value })}
                                            title={color.name}
                                        >
                                            {isActive && <Check className="h-3 w-3 text-white shadow-sm" />}
                                        </button>
                                    );
                                })}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Rows className="mr-2 h-4 w-4" />
                                <span>Row Actions</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={() => handleAction("addRowBefore")}>
                                    <span>Add Row Above</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAction("addRowAfter")}>
                                    <span>Add Row Below</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => handleAction("deleteRow")}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <span>Delete Row</span>
                                </DropdownMenuItem>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Columns className="mr-2 h-4 w-4" />
                                <span>Column Actions</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={() => handleAction("addColumnBefore")}>
                                    <span>Add Column Left</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAction("addColumnAfter")}>
                                    <span>Add Column Right</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => handleAction("deleteColumn")}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <span>Delete Column</span>
                                </DropdownMenuItem>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => handleAction("mergeCells")}
                            disabled={!data.canMergeCells}
                        >
                            <Merge className="mr-2 h-4 w-4" />
                            <span>Merge Cells</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleAction("splitCell")}
                            disabled={!data.canSplitCell}
                        >
                            <Split className="mr-2 h-4 w-4" />
                            <span>Split Cell</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleAction("copy")}>
                            <Copy className="mr-2 h-4 w-4" />
                            <span>Copy Table</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleAction("delete")}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete Table</span>
                        </DropdownMenuItem>
                    </>
                )}

                {type === "mermaid" && (
                    <>
                        <DropdownMenuItem onClick={() => handleAction("copy")}>
                            <Copy className="mr-2 h-4 w-4" />
                            <span>Copy Diagram</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction("cut")}>
                            <Scissors className="mr-2 h-4 w-4" />
                            <span>Cut Diagram</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => handleAction("delete")}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete Diagram</span>
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
