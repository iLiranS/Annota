import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { useAiStore, OPENAI_MODELS, ANTHROPIC_MODELS, GOOGLE_MODELS } from "@annota/core";
import { Bot, ChevronDown, Send, Square, Check, Sparkles } from 'lucide-react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

interface AiChatInputProps {
    onSend: (content: string) => void;
    onSummarize: () => void;
    onStop?: () => void;
    disabled: boolean;
}

export function AiChatInput({ onSend, onSummarize, onStop, disabled }: AiChatInputProps) {
    const {
        activeProvider,
        availableModels,
        selectedModel,
        setSelectedModel,
        selectedModelOpenAi,
        selectedModelAnthropic,
        selectedModelGoogle,
        setSelectedModelOpenAi,
        setSelectedModelAnthropic,
        setSelectedModelGoogle
    } = useAiStore();

    const currentModelName = activeProvider === 'ollama' 
        ? selectedModel 
        : activeProvider === 'openai' 
            ? selectedModelOpenAi 
            : activeProvider === 'anthropic'
                ? selectedModelAnthropic
                : selectedModelGoogle;

    const getProviderModels = () => {
        switch (activeProvider) {
            case 'ollama': return availableModels.map(m => ({ label: m.name, value: m.name }));
            case 'openai': return OPENAI_MODELS;
            case 'anthropic': return ANTHROPIC_MODELS;
            case 'google': return GOOGLE_MODELS;
            default: return [];
        }
    };

    const handleSetModel = (model: string) => {
        if (activeProvider === 'ollama') setSelectedModel(model);
        else if (activeProvider === 'openai') setSelectedModelOpenAi(model);
        else if (activeProvider === 'anthropic') setSelectedModelAnthropic(model);
        else if (activeProvider === 'google') setSelectedModelGoogle(model);
    };

    const [content, setContent] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const MAX_LENGTH = 2500;

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
        onSend(content);
        setContent('');
    }, [content, onSend, disabled]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const isNearLimit = content.length > MAX_LENGTH * 0.8;

    return (
        <div className="flex flex-col gap-2 mb-2">
            <div className="flex items-center justify-between px-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSummarize}
                    disabled={disabled || !currentModelName}
                    className="h-7 px-3 rounded-full gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all border border-border/40 hover:border-primary/20 bg-muted/20"
                >
                    <Sparkles size={11} className="text-primary/60" />
                    Summarize Note
                </Button>

                {isNearLimit && (
                    <span className={cn(
                        "text-[10px] font-medium",
                        content.length >= MAX_LENGTH ? "text-destructive" : "text-muted-foreground/60"
                    )}>
                        {content.length}/{MAX_LENGTH}
                    </span>
                )}
            </div>

            <div className="w-full bg-background border rounded-[24px] shadow-sm focus-within:shadow-md focus-within:border-primary/30 group p-1.5 flex flex-col gap-1">
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value.slice(0, MAX_LENGTH))}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    dir="auto"
                    placeholder={!currentModelName ? "Select a model to start..." : "Ask AI about current note..."}
                    disabled={disabled || !currentModelName}
                    className="w-full bg-transparent border-none outline-none resize-none px-3 pt-2 pb-1 text-[14px] leading-relaxed max-h-[160px] min-h-[44px] overflow-y-auto custom-scrollbar disabled:opacity-50"
                />

                <div className="flex items-center justify-between px-1.5 pb-0.5">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 rounded-full gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 transition-all border border-transparent hover:border-border/50"
                            >
                                <Bot size={12} className={cn("transition-colors", currentModelName ? "text-primary" : "text-muted-foreground")} />
                                <span className="max-w-[120px] truncate">
                                    {currentModelName ? (getProviderModels().find(m => m.value === currentModelName)?.label || currentModelName) : "Select Model"}
                                </span>
                                <ChevronDown size={10} className="opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 rounded-xl border-border/50 shadow-xl bg-popover/95 backdrop-blur-md">
                            {getProviderModels().length === 0 ? (
                                <div className="p-2 text-xs text-muted-foreground text-center font-medium">No models found</div>
                            ) : (
                                getProviderModels().map(m => (
                                    <DropdownMenuItem
                                        key={m.value}
                                        className={cn(
                                            "text-xs rounded-lg cursor-pointer flex items-center gap-2",
                                            currentModelName === m.value && "bg-primary/10 text-primary focus:bg-primary/20 focus:text-primary"
                                        )}
                                        onClick={() => handleSetModel(m.value)}
                                    >
                                        <span className="flex w-3 h-3 items-center justify-center">
                                            {currentModelName === m.value && <Check size={12} strokeWidth={3} />}
                                        </span>
                                        <span className={cn("truncate", currentModelName === m.value && "font-semibold")}>{m.label}</span>
                                    </DropdownMenuItem>
                                ))
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

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
