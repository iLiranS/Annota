import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { useAiStore } from "@annota/core";
import { Bot, ChevronDown, Send, Square } from 'lucide-react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

interface AiChatInputProps {
    onSend: (content: string, contextNotes: Array<{ title: string, content: string }>) => void;
    onStop?: () => void;
    disabled: boolean;
}

export function AiChatInput({ onSend, onStop, disabled }: AiChatInputProps) {
    const {
        activeProvider,
        availableModels,
        selectedModel,
        setSelectedModel,
        selectedModelOpenAi,
        selectedModelAnthropic,
        selectedModelGoogle
    } = useAiStore();

    const currentModelName = activeProvider === 'ollama' 
        ? selectedModel 
        : activeProvider === 'openai' 
            ? selectedModelOpenAi 
            : activeProvider === 'anthropic'
                ? selectedModelAnthropic
                : selectedModelGoogle;

    const [content, setContent] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const adjustHeight = () => {
            if (!content) {
                textarea.style.height = '';
                return;
            }
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        };

        adjustHeight();
        
        // Catch the end of potential sidebar transitions
        const timer = setTimeout(adjustHeight, 400);
        return () => clearTimeout(timer);
    }, [content, currentModelName]);

    const handleSend = useCallback(async () => {
        if (!content.trim() || disabled) return;
        onSend(content, []); // Context now managed by Sidebar
        setContent('');
    }, [content, onSend, disabled]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col gap-2 mb-2">
            <div className="w-full bg-background border rounded-[24px] shadow-sm focus-within:shadow-md focus-within:border-primary/30 group p-1.5 flex flex-col gap-1">
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder={!currentModelName ? "Select a model to start..." : "Ask AI about current note..."}
                    disabled={disabled || !currentModelName}
                    className="w-full bg-transparent border-none outline-none resize-none px-3 pt-2 pb-1 text-[14px] leading-relaxed max-h-[160px] min-h-[44px] overflow-y-auto custom-scrollbar disabled:opacity-50"
                />

                <div className="flex items-center justify-between px-1.5 pb-0.5">
                    {activeProvider === 'ollama' ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 rounded-full gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 transition-all border border-transparent hover:border-border/50"
                                >
                                    <Bot size={12} className={cn("transition-colors", currentModelName ? "text-primary" : "text-muted-foreground")} />
                                    <span className="max-w-[80px] truncate">{currentModelName || "Select Model"}</span>
                                    <ChevronDown size={10} className="opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 rounded-xl border-border/50 shadow-xl bg-popover/95 backdrop-blur-md">
                                {availableModels.length === 0 ? (
                                    <div className="p-2 text-xs text-muted-foreground text-center font-medium">No models found</div>
                                ) : (
                                    availableModels.map(m => (
                                        <DropdownMenuItem
                                            key={m.name}
                                            className={cn("text-xs rounded-lg cursor-pointer", currentModelName === m.name && "bg-primary/10 text-primary")}
                                            onClick={() => setSelectedModel(m.name)}
                                        >
                                            {m.name}
                                        </DropdownMenuItem>
                                    ))
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 rounded-full gap-1.5 text-[10px] font-bold text-muted-foreground cursor-default hover:text-muted-foreground bg-muted/30 transition-all border border-transparent"
                        >
                            <Bot size={12} className="text-primary" />
                            <span className="max-w-[120px] truncate">{currentModelName}</span>
                        </Button>
                    )}

                    <Button
                        onClick={() => disabled ? onStop?.() : handleSend()}
                        disabled={(!disabled && !content.trim()) || (!disabled && !currentModelName)}
                        size="icon"
                        className={cn(
                            "h-7 w-7 rounded-full transition-all shrink-0 shadow-sm",
                            disabled ? "bg-foreground text-background hover:bg-foreground/90" :
                                (content.trim() && currentModelName) ? "bg-primary text-primary-foreground shadow-md hover:scale-105 active:scale-95" : "bg-muted text-muted-foreground/30"
                        )}
                    >
                        {disabled ? (
                            <Square size={10} fill="currentColor" />
                        ) : (
                            <Send size={10} className="-ml-0.5 mt-0.5" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
