import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { ToolbarRenderProps } from '@annota/editor-ui';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { AlertCircle, Sigma } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

// Simple styled textarea to match UI input
const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
    ({ className, ...props }, ref) => (
        <textarea
            ref={ref}
            className={cn(
                "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            {...props}
        />
    )
);
Textarea.displayName = "Textarea";

interface MathPopoverProps {
    sendCommand: ToolbarRenderProps['sendCommand'];
    activeColor?: string;
    onOpenChange?: (open: boolean) => void;
    isMenu?: boolean;
    visible?: boolean;
    currentLatex?: string | null;
    isBlockMath?: boolean;
}

export function MathPopover({ sendCommand, onOpenChange, visible, currentLatex, isBlockMath = false }: MathPopoverProps) {
    const [latex, setLatex] = useState(currentLatex || '');
    const [internalOpen, setInternalOpen] = useState(false);
    // debouncedLatex is what actually gets rendered / validated
    const [debouncedLatex, setDebouncedLatex] = useState(currentLatex || '');
    const [katexError, setKatexError] = useState<string | null>(null);
    const [previewEl, setPreviewEl] = useState<HTMLDivElement | null>(null);
    const [isBlockInput, setIsBlockInput] = useState(isBlockMath);

    const open = visible !== undefined ? visible : internalOpen;

    // Debounce latex → debouncedLatex by 600 ms
    useEffect(() => {
        if (latex === debouncedLatex) return;
        const id = setTimeout(() => setDebouncedLatex(latex), 600);
        return () => clearTimeout(id);
    }, [latex, debouncedLatex]);

    // Keep state in sync with currentLatex when dialog opens/closes
    useEffect(() => {
        setLatex(currentLatex || '');
        setDebouncedLatex(currentLatex || '');
        setKatexError(null);
        setIsBlockInput(isBlockMath);
    }, [currentLatex, open, isBlockMath]);

    // Render / validate only on the debounced value
    useEffect(() => {
        if (!previewEl) return;

        if (!debouncedLatex) {
            previewEl.innerHTML = '';
            setKatexError(null);
            return;
        }

        try {
            katex.render(debouncedLatex, previewEl, {
                throwOnError: true,
                displayMode: isBlockInput,
            });
            setKatexError(null);
        } catch (err: unknown) {
            previewEl.innerHTML = '';
            if (err instanceof Error) {
                const msg = err.message.replace(/^KaTeX parse error:\s*/i, '');
                setKatexError(msg);
            } else {
                setKatexError('Invalid LaTeX expression');
            }
        }
    }, [debouncedLatex, previewEl, isBlockInput]);

    const handleOpenChange = (val: boolean) => {
        if (visible === undefined) setInternalOpen(val);
        onOpenChange?.(val);
        if (val && !currentLatex) setLatex('');
    };

    const handleInsert = (value: string) => {
        if (value && !katexError) {
            sendCommand('setMath', { latex: value, isBlock: isBlockInput });
            setLatex('');
            setKatexError(null);
            handleOpenChange(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const isMacOrCtrl = e.metaKey || e.ctrlKey;
        if (isMacOrCtrl && (e.key === 'Enter' || e.key === 's')) {
            e.preventDefault();
            handleInsert(latex);
        }
    };

    const content = (
        <div className="flex flex-col h-full">
            <DialogHeader className="px-0 text-left mb-2 shrink-0">
                <DialogTitle className="text-xl font-bold">Math Formula</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">LaTeX Input</label>
                    <Textarea
                        className="text-sm font-mono bg-muted/30 border-input focus-visible:ring-0 focus:ring-0 outline-none resize-none scroll-area"
                        placeholder="e = mc^2"
                        value={latex}
                        onChange={(e) => setLatex(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{ resize: "none", height: 160 }}
                        autoFocus
                    />
                </div>

                <div className="flex items-center justify-between py-2 my-2 border-b border-border/40 animate-in fade-in duration-200">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">Display Mode</span>
                    <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/40 select-none">
                        <button
                            type="button"
                            onClick={() => setIsBlockInput(false)}
                            className={cn(
                                "px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200",
                                !isBlockInput 
                                    ? "bg-background text-foreground shadow-sm scale-100" 
                                    : "text-muted-foreground hover:text-foreground opacity-80 hover:opacity-100"
                            )}
                        >
                            Inline
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsBlockInput(true)}
                            className={cn(
                                "px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200",
                                isBlockInput 
                                    ? "bg-background text-foreground shadow-sm scale-100" 
                                    : "text-muted-foreground hover:text-foreground opacity-80 hover:opacity-100"
                            )}
                        >
                            Block
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">Preview</label>
                    <div
                        className="h-[140px] overflow-y-auto custom-scrollbar rounded-xl border bg-muted/10 px-2 transition-all shadow-inner"
                        style={{ fontSize: '1rem' }}
                    >
                        {/* Empty state */}
                        <div
                            className={cn(
                                "flex flex-col select-none gap-2 opacity-40 w-full h-full justify-center items-center animate-in fade-in duration-200",
                                latex ? "hidden" : "flex"
                            )}
                        >
                            <Sigma className="h-10 w-10 stroke-[1.5]" />
                            <span className="text-[11px] font-medium italic">Preview will appear here</span>
                        </div>

                        {/* Error state — shown inside the preview box */}
                        {katexError && latex && (
                            <div className="flex flex-col items-center justify-center gap-2 w-full h-full text-destructive animate-in fade-in duration-200">
                                <AlertCircle className="h-5 w-5 shrink-0 opacity-80" />
                                <p className="text-[11px] font-mono text-center leading-snug px-2 opacity-90">{katexError}</p>
                            </div>
                        )}

                        {/* Rendered KaTeX output */}
                        <div
                            ref={setPreviewEl}
                            className={cn(
                                "w-fit self-start",
                                (!latex || katexError) && "hidden"
                            )}
                        />
                    </div>
                </div>
            </div>

            <DialogFooter className="mt-6 pt-4 border-t shrink-0 flex items-center sm:justify-between">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenChange(false)}
                    className="text-xs hover:bg-destructive/10 hover:text-destructive transition-colors rounded-full"
                >
                    Cancel
                </Button>
                <Button
                    size="sm"
                    className="px-8 h-10 rounded-full shadow-lg shadow-primary/20 font-semibold"
                    onClick={() => handleInsert(latex)}
                    disabled={!latex || !!katexError}
                >
                    {currentLatex ? 'Update Formula' : 'Insert Formula'}
                </Button>
            </DialogFooter>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-[700px] p-4 gap-0 shadow-2xl border-primary/10 rounded-2xl flex flex-col overflow-hidden outline-none">
                {content}
            </DialogContent>
        </Dialog>
    );
}