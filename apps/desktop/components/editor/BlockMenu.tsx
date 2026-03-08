import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppTheme } from "@/hooks/use-app-theme";
import { cn } from "@/lib/utils";
import { COLOR_PALETTE } from "@annota/core/constants/colors";
import {
    CODE_LANGUAGES
} from "@annota/editor-web/extensions";
import {
    Check,
    Copy,
    Download,
    Languages,
    Link,
    Maximize,
    Palette,
    Trash2
} from "lucide-react";

export interface BlockMenuProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    anchorRect: DOMRect | null;
    type: "image" | "details" | "codeBlock";
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
    const { colors } = useAppTheme();

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
                            <span>Copy Image URI</span>
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

                {type === "details" && (
                    <>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Palette className="mr-2 h-4 w-4" />
                                <span>Background Color</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="p-2 grid grid-cols-5 gap-1 min-w-[200px]">
                                <button
                                    className="h-6 w-6 rounded-full border border-border flex items-center justify-center hover:scale-110 transition-transform"
                                    style={{ backgroundColor: 'transparent' }}
                                    onClick={() => handleAction("background", { color: null })}
                                    title="None"
                                >
                                    {!data.backgroundColor && <Check className="h-3 w-3 text-foreground" />}
                                </button>
                                {COLOR_PALETTE.map((color) => (
                                    <button
                                        key={color.value}
                                        className="h-6 w-6 rounded-full border border-black/10 flex items-center justify-center hover:scale-110 transition-transform"
                                        style={{ backgroundColor: color.value }}
                                        onClick={() => handleAction("background", { color: color.value })}
                                        title={color.name}
                                    >
                                        {data.backgroundColor === color.value && <Check className="h-3 w-3 text-white shadow-sm" />}
                                    </button>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem onClick={() => handleAction("copyLink")}>
                            <Link className="mr-2 h-4 w-4" />
                            <span>Copy Link</span>
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
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
