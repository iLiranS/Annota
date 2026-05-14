import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAiConfiguration } from "@annota/core";
import { BotMessageSquare, Pencil, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
    const rawX = isRtl ? anchorRect.left : anchorRect.right;
    const rawY = anchorRect.top;

    const x = Math.max(20, Math.min(window.innerWidth - 20, rawX));
    const y = Math.max(20, Math.min(window.innerHeight - 20, rawY));

    return (
        <Popover open={open} onOpenChange={(val) => {
            if (isLoading) return;
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
                    "p-0 bg-background/75 backdrop-blur-2xl border border-primary/15",
                    "shadow-[0_8px_32px_rgba(0,0,0,0.15),0_1px_4px_rgba(0,0,0,0.1)]",
                    "flex flex-col overflow-hidden",
                    "transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] animate-bloom",
                    isLoading
                        ? "w-48 rounded-2xl p-1"
                        : isExpanded
                            ? "w-64 p-2 gap-2 rounded-2xl"
                            : "w-auto rounded-[24px] p-[3px]"
                )}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <style>
                    {`
                    @keyframes bloom {
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
                    @keyframes light-sweep {
                        0% { left: -100%; opacity: 0; }
                        20% { opacity: 0.6; }
                        100% { left: 100%; opacity: 0; }
                    }
                    .animate-bloom {
                        animation: bloom 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                        transform-origin: bottom center;
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
                    <div className="flex items-center gap-3 px-3 py-2 animate-in fade-in zoom-in-95 duration-300">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-primary hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={(e) => { e.stopPropagation(); onStop?.(); }}
                        >
                            <div className="h-3 w-3 bg-current rounded-[2px]" />
                        </Button>
                        <span className="text-sm font-medium text-primary pr-2">AI is working…</span>
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
                            onClick={(e) => { e.stopPropagation(); onAction?.('send-to-chat'); }}
                        >
                            <BotMessageSquare className="h-3.5 w-3.5 text-primary transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12" />
                            <span className="text-xs font-semibold tracking-tight">Ask</span>
                        </Button>
                    </div>

                ) : (
                    // ── Expanded rewrite panel ───────────────────────────────
                    <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-2 px-1">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">AI Rewrite</span>
                        </div>

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
                                className="min-h-[36px] w-full py-2 pr-9 text-xs focus-visible:ring-0 ring-0 rounded-xl resize-none overflow-y-auto no-scrollbar"
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
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}