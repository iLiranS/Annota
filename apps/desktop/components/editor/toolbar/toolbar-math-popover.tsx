import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { ToolbarRenderProps } from '@annota/tiptap-editor';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Functions as Sigma } from '@mui/icons-material';
import React, { useEffect, useRef, useState } from 'react';

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
}

export function MathPopover({ sendCommand, onOpenChange, visible, currentLatex }: MathPopoverProps) {
    const [latex, setLatex] = useState(currentLatex || '');
    const [internalOpen, setInternalOpen] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);

    // Controlled opening if visible prop is provided
    const open = visible !== undefined ? visible : internalOpen;

    useEffect(() => {
        if (!open) {
            setLatex(currentLatex || '');
        }
    }, [currentLatex, open]);

    useEffect(() => {
        if (previewRef.current && latex) {
            try {
                katex.render(latex, previewRef.current, {
                    throwOnError: false,
                    displayMode: true,
                });
            } catch (err) {
                console.error('KaTeX rendering error:', err);
            }
        } else if (previewRef.current) {
            previewRef.current.innerHTML = '';
        }
    }, [latex, open, previewRef.current]);

    const handleOpenChange = (val: boolean) => {
        if (visible === undefined) {
            setInternalOpen(val);
        }
        onOpenChange?.(val);
        if (val && !currentLatex) setLatex('');
    };

    const handleInsert = (value: string) => {
        if (value) {
            sendCommand('setMath', { latex: value });
            setLatex('');
            handleOpenChange(false);
        }
    };

    const content = (
        <div className="flex flex-col h-full">
            <DialogHeader className="px-0 text-left mb-2 shrink-0">
                <DialogTitle className="text-xl font-bold">Math Formula</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto  pr-2 -mr-2">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">LaTeX Input</label>
                    <Textarea
                        className="text-sm font-mono bg-muted/30 border-input focus-visible:ring-0 focus:ring-0 outline-none resize-none scroll-area"
                        placeholder="e = mc^2"
                        value={latex}
                        onChange={(e) => setLatex(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                handleInsert(latex);
                            }
                        }}
                        style={{ resize: "none", height: 160 }}
                        autoFocus
                    />
                </div>

                <div className="space-y-2 ">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">Preview</label>
                    <div
                        className=" h-[140px] overflow-y-auto flex  rounded-xl border bg-muted/10 px-2 transition-all  shadow-inner overflow-hidden"
                        style={{ fontSize: '1rem' }}
                    >
                        <div
                            className={cn(
                                "flex flex-col select-none  gap-2 opacity-40 w-full justify-center items-center animate-in fade-in duration-200",
                                latex ? "hidden" : "flex"
                            )}
                        >
                            <Sigma className="h-10 w-10 stroke-[1.5]" />
                            <span className="text-[11px] font-medium italic">Preview will appear here</span>
                        </div>
                        <div
                            ref={previewRef}
                            className={cn(
                                "w-full overflow-x-auto select-none  custom-scrollbar",
                                !latex && "hidden"
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
                    disabled={!latex}
                >
                    {currentLatex ? 'Update Formula' : 'Insert Formula'}
                </Button>
            </DialogFooter>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-[700px]  p-4 gap-0 shadow-2xl border-primary/10 rounded-2xl flex flex-col overflow-hidden outline-none">
                {content}
            </DialogContent>
        </Dialog>
    );
}
