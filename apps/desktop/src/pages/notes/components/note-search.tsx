import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useEffect, useRef } from "react";

interface NoteSearchProps {
    visible: boolean;
    searchTerm: string;
    onSearchTermChange: (term: string) => void;
    onClose: () => void;
    resultCount: number;
    currentResultIndex: number;
    onNext: () => void;
    onPrev: () => void;
}

export function NoteSearch({
    visible,
    searchTerm,
    onSearchTermChange,
    onClose,
    resultCount,
    currentResultIndex,
    onNext,
    onPrev,
}: NoteSearchProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Initial focus and focus preservation
    useEffect(() => {
        if (visible) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 10);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    // Force focus back if it's lost during typing (common with TipTap steals)
    useEffect(() => {
        if (visible && searchTerm) {
            const timer = setTimeout(() => {
                if (document.activeElement !== inputRef.current) {
                    inputRef.current?.focus();
                }
            }, 5);
            return () => clearTimeout(timer);
        }
    }, [searchTerm, visible]);

    if (!visible) return null;

    return (
        <div className="absolute top-[56px] right-6 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-background/80 backdrop-blur-xl border border-border/50 shadow-xl min-w-[220px]">
                <div className="relative flex-1 group">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/30" />
                    <Input
                        ref={inputRef}
                        value={searchTerm}
                        onChange={(e) => onSearchTermChange(e.target.value)}
                        placeholder="Search..."
                        className="h-7 pl-6 pr-12 bg-transparent border-none focus-visible:ring-0 text-[11px] placeholder:text-muted-foreground/40"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (e.shiftKey) onPrev();
                                else onNext();
                                inputRef.current?.focus();
                            } else if (e.key === 'Escape') {
                                onClose();
                            }
                        }}
                    />
                    {searchTerm && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2">
                            <span className="text-[9px] font-medium tabular-nums text-muted-foreground/50 bg-muted/20 px-1 rounded">
                                {resultCount > 0 ? `${currentResultIndex + 1}/${resultCount}` : '0/0'}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center border-l border-border/30 pl-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded hover:bg-accent/40"
                        onClick={() => {
                            onPrev();
                            inputRef.current?.focus();
                        }}
                        disabled={resultCount === 0}
                    >
                        <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded hover:bg-accent/40"
                        onClick={() => {
                            onNext();
                            inputRef.current?.focus();
                        }}
                        disabled={resultCount === 0}
                    >
                        <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded hover:bg-destructive/10 hover:text-destructive"
                        onClick={onClose}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
