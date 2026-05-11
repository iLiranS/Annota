import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAiConfiguration } from "@annota/core";
import { MessageSquare, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface AISelectionPopoverProps {
    anchorRect: DOMRect | null;
    isVisible: boolean;
    isLoading?: boolean;
    onAction?: (action: string, instructions?: string) => void;
    onStop?: () => void;
    direction?: 'ltr' | 'rtl' | 'auto';
}

export function AISelectionPopover({ anchorRect, isVisible, isLoading, onAction, onStop, direction = 'ltr' }: AISelectionPopoverProps) {
    const { isAiAvailable } = useAiConfiguration();
    const [open, setOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [instructions, setInstructions] = useState("");

    useEffect(() => {
        setOpen(isVisible && isAiAvailable);
        if (!isVisible || !isAiAvailable) {
            setIsExpanded(false);
            setInstructions("");
        }
    }, [isVisible, isAiAvailable]);

    if (!anchorRect || !isAiAvailable) return null;

    const isRtl = direction === 'rtl';
    const rawX = isRtl ? anchorRect.left : anchorRect.right;
    const rawY = anchorRect.top;

    const x = Math.max(20, Math.min(window.innerWidth - 20, rawX));
    const y = Math.max(20, Math.min(window.innerHeight - 20, rawY));

    return (
        <Popover open={open} onOpenChange={(val) => {
            if (isLoading) return; // Prevent closing while AI is working
            setOpen(val);
            if (!val) setIsExpanded(false);
        }}>
            <PopoverAnchor asChild>
                <div
                    style={{
                        position: 'fixed',
                        left: x,
                        top: y,
                        width: 1,
                        height: 1,
                        pointerEvents: 'none',
                        zIndex: 100,
                    }}
                />
            </PopoverAnchor>
            <PopoverContent
                side="top"
                align={isRtl ? "start" : "end"}
                sideOffset={10}
                className={cn(
                    "p-1 bg-background/95 backdrop-blur-sm border-primary/20 shadow-xl flex flex-col overflow-hidden transition-all duration-500 ease-in-out",
                    isLoading ? "w-48 rounded-2xl" : isExpanded ? "w-64 p-2 gap-2 rounded-2xl" : "w-auto rounded-3xl"
                )}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                {isLoading ? (
                    <div className="flex items-center gap-3 px-3 py-2 animate-in fade-in zoom-in-95 duration-300">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-primary hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                onStop?.();
                            }}
                        >
                            <div className="h-3 w-3 bg-current rounded-[2px]" />
                        </Button>
                        <span className="text-sm font-medium text-primary  pr-2">AI is working...</span>
                    </div>
                ) : !isExpanded ? (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-9 rounded-full px-4 gap-2 transition-all duration-300",
                                "hover:bg-accent group",
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(true);
                            }}
                        >
                            <Sparkles className="h-4 w-4" />
                            <span className="text-sm font-semibold tracking-tight">Rewrite</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-9 rounded-full px-4 gap-2 transition-all duration-300",
                                "hover:bg-accent group",
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction?.('send-to-chat');
                            }}
                        >
                            <MessageSquare className="h-4 w-4" />
                            <span className="text-sm font-semibold tracking-tight">Chat</span>
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-2 px-1">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">AI Assistant</span>
                        </div>

                        <div className="relative group/input">
                            <Input
                                placeholder="(e.g. rewrite as table)..."
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        onAction?.('rewrite', instructions);
                                    }
                                }}
                                className="h-9 pr-9 text-xs focus-visible:ring-primary/30 rounded-xl"
                                autoFocus
                                maxLength={2000}
                            />
                            <Button
                                size="icon"
                                variant="ghost"
                                className={cn(
                                    "absolute right-0 top-0 h-9 w-9 hover:bg-transparent transition-all duration-300",
                                    instructions.trim() ? "text-primary opacity-100 scale-100" : "text-muted-foreground opacity-50 scale-90"
                                )}
                                onClick={() => onAction?.('rewrite', instructions)}
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

