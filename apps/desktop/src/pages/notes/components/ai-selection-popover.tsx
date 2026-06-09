import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAiConfiguration } from "@annota/core";
import { BotMessageSquare, Pencil, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface AISelectionPopoverProps {
    anchorRect: DOMRect | null;
    isVisible: boolean;
    isLoading?: boolean;
    onAction?: (action: string, instructions?: string) => void;
    onClose?: () => void;
    onStop?: () => void;
    direction?: 'ltr' | 'rtl' | 'auto';
    cursorPosition?: { x: number; y: number } | null;
}

export function AISelectionPopover({ anchorRect, isVisible, isLoading, onAction, onClose, onStop, direction = 'ltr', cursorPosition }: AISelectionPopoverProps) {
    const { isAiAvailable } = useAiConfiguration();
    const [open, setOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [instructions, setInstructions] = useState("");

    // Pill hover state: tracks position/size relative to container
    const [pill, setPill] = useState<{ left: number; width: number; visible: boolean }>({
        left: 0,
        width: 0,
        visible: false,
    });
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
        const container = containerRef.current;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();
        const btnRect = e.currentTarget.getBoundingClientRect();
        setPill({
            left: btnRect.left - containerRect.left,
            width: btnRect.width,
            visible: true,
        });
    };

    const handleMouseLeave = () => {
        setPill(p => ({ ...p, visible: false }));
    };

    useEffect(() => {
        setOpen(isVisible && isAiAvailable);
        if (!isVisible || !isAiAvailable) {
            setIsExpanded(false);
            setInstructions("");
            setPill(p => ({ ...p, visible: false }));
        }
    }, [isVisible, isAiAvailable]);

    if (!anchorRect || !isAiAvailable) return null;

    const isRtl = direction === 'rtl';
    const rawX = cursorPosition ? cursorPosition.x : (isRtl ? anchorRect.left : anchorRect.right);
    const rawY = cursorPosition ? cursorPosition.y : anchorRect.top;

    const x = Math.max(20, Math.min(window.innerWidth - 20, rawX));
    const y = Math.max(20, Math.min(window.innerHeight - 20, rawY));

    return (
        <Popover open={open} onOpenChange={(val) => {
            if (isLoading) return;
            setOpen(val);
            if (!val) {
                setIsExpanded(false);
                onClose?.();
            }
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
                    "p-0 bg-note-bg/70 backdrop-blur-md border border-primary/15",
                    "shadow-[0_8px_32px_rgba(0,0,0,0.15),0_1px_4px_rgba(0,0,0,0.1)]",
                    "flex flex-col overflow-hidden",
                    "transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] animate-bloom",
                    isLoading
                        ? "w-48 rounded-2xl p-1"
                        : isExpanded
                            ? "w-64 p-1 gap-1 rounded-xl"
                            : "w-auto rounded-[24px] p-[3px]"

                )}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <style>
                    {`
                    .animate-bloom {
                        animation: bloom-top 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                        transform-origin: bottom center;
                    }
                    .animate-bloom[data-side="bottom"] {
                        animation-name: bloom-bottom;
                        transform-origin: top center;
                    }
                    @keyframes bloom-top {
                        0% { 
                            transform: scale(0.6) translateY(20px); 
                            opacity: 0; 
                            filter: blur(10px);
                            clip-path: circle(0% at 50% 100%);
                        }
                        100% { 
                            transform: scale(1) translateY(0); 
                            opacity: 1; 
                            filter: blur(0);
                            clip-path: circle(150% at 50% 100%);
                        }
                    }
                    @keyframes bloom-bottom {
                        0% { 
                            transform: scale(0.6) translateY(-20px); 
                            opacity: 0; 
                            filter: blur(10px);
                            clip-path: circle(0% at 50% 0%);
                        }
                        100% { 
                            transform: scale(1) translateY(0); 
                            opacity: 1; 
                            filter: blur(0);
                            clip-path: circle(150% at 50% 0%);
                        }
                    }
                    @keyframes light-sweep {
                        0% { left: -100%; opacity: 0; }
                        20% { opacity: 0.6; }
                        100% { left: 100%; opacity: 0; }
                    }
                    .light-streak {
                        position: absolute;
                        top: 0;
                        width: 40%;
                        height: 100%;
                        background: linear-gradient(90deg, transparent, hsla(var(--primary), 0.2), transparent);
                        transform: skewX(-20deg);
                        animation: light-sweep 1.2s ease-in-out forwards;
                        pointer-events: none;
                        z-index: 20;
                    }
                    .no-scrollbar::-webkit-scrollbar { display: none; }
                    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                    `}
                </style>
                <div className="light-streak" />
                {isLoading ? (
                    // ── Loading state ────────────────────────────────────────
                    <div className="flex items-center gap-3 px-3 py-1 animate-in fade-in zoom-in-95 duration-300">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-primary hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={(e) => { e.stopPropagation(); onStop?.(); }}
                        >
                            <div className="h-3 w-3 bg-current rounded-[2px]" />
                        </Button>
                        <span className="text-sm font-medium text-primary pr-2 animate-pulse">AI is working…</span>
                    </div>

                ) : !isExpanded ? (
                    // ── Collapsed pill ───────────────────────────────────────
                    <div
                        ref={containerRef}
                        className="relative flex items-center"
                        onMouseLeave={handleMouseLeave}
                    >
                        {/*
                         * Moving highlight pill — rendered BEHIND buttons via z-index.
                         * Key fix: measure button rect relative to container via getBoundingClientRect
                         * so padding/gap offsets are handled correctly.
                         */}
                        <span
                            aria-hidden
                            className="pointer-events-none absolute top-0 bottom-0 rounded-full"
                            style={{
                                left: pill.left,
                                width: pill.width,
                                opacity: pill.visible ? 1 : 0,
                                // Smooth spring-like slide
                                transition: pill.visible
                                    ? 'left 260ms cubic-bezier(0.23,1,0.32,1), width 260ms cubic-bezier(0.23,1,0.32,1), opacity 180ms ease'
                                    : 'opacity 200ms ease',
                                background: 'linear-gradient(135deg, var(--accent), var(--accent))',
                                boxShadow: '0 0 0 1px var(--accent-full), 0 2px 8px var(--accent-full)',
                            }}
                        />

                        <Button
                            variant="ghost"
                            size="sm"
                            className="relative z-10 h-8 rounded-full px-3 gap-1.5 hover:bg-transparent group"
                            onMouseEnter={handleMouseEnter}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
                        >
                            <Pencil className="h-3.5 w-3.5 text-primary transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
                            <span className="text-xs font-semibold tracking-tight">Rewrite</span>
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="relative z-10 h-8 rounded-full px-3 gap-1.5 hover:bg-transparent group"
                            onMouseEnter={handleMouseEnter}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => { e.stopPropagation(); onAction?.('send-to-chat'); }}
                        >
                            <BotMessageSquare className="h-3.5 w-3.5 text-primary transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12" />
                            <span className="text-xs font-semibold tracking-tight">Ask</span>
                        </Button>
                    </div>

                ) : (
                    // ── Expanded rewrite panel ───────────────────────────────
                    <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* <div className="flex items-center gap-2 px-1">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">AI Rewrite</span>
                        </div> */}

                        <div className="relative">
                            <Textarea
                                placeholder="(e.g. rewrite as table)…"
                                value={instructions}
                                onChange={(e) => {
                                    setInstructions(e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${Math.max(36, Math.min(e.target.scrollHeight, 120))}px`;
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        onAction?.('rewrite', instructions);
                                    }
                                }}
                                className="min-h-[36px] w-full py-1.5 pr-9 text-xs focus-visible:ring-0 ring-0 rounded-xl resize-none overflow-y-auto no-scrollbar"
                                autoFocus
                                maxLength={2000}
                                rows={1}
                            />
                            <Button
                                size="icon"
                                variant="ghost"
                                className={cn(
                                    "absolute right-0 bottom-0 h-9 w-9 hover:bg-transparent transition-all duration-300",
                                    instructions.trim()
                                        ? "text-primary opacity-100 scale-100"
                                        : "text-muted-foreground opacity-40 scale-90"
                                )}
                                onClick={() => onAction?.('rewrite', instructions)}
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>

                        {!instructions.trim() && (
                            <div className="flex items-center gap-1 mt-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flex-1 h-6 px-1.5 rounded-full border border-primary/10 hover:border-primary/25 hover:bg-primary/5 text-[10px] font-semibold tracking-tight transition-all duration-200"
                                    onClick={() => onAction?.('rewrite', "Rewrite the following text to be more understandable, clear, and readable. Keep the length approximately the same as the original text, avoiding making it longer. Maintain formatting if applicable.")}
                                >
                                    Rewrite
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flex-1 h-6 px-1.5 rounded-full border border-primary/10 hover:border-primary/25 hover:bg-primary/5 text-[10px] font-semibold tracking-tight transition-all duration-200"
                                    onClick={() => onAction?.('rewrite', "Elaborate and expand on the following text. Add relevant details, clarify concepts, and continue the thought naturally to make it more comprehensive and detailed while keeping a professional and natural tone.")}
                                >
                                    Expand
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flex-1 h-6 px-1.5 rounded-full border border-primary/10 hover:border-primary/25 hover:bg-primary/5 text-[10px] font-semibold tracking-tight transition-all duration-200"
                                    onClick={() => onAction?.('rewrite', "Shorten the following text. Summarize the key points, remove any fluff, wordiness, or unnecessary details, and make it concise while retaining all important information.")}
                                >
                                    Shorten
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}