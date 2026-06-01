import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { ANTHROPIC_MODELS, GOOGLE_MODELS, OPENAI_MODELS, purifyNoteHtml, useAiStore } from "@annota/core";
import { Bot, BrainCircuit, Check, ChevronDown, Globe, MessageSquare, Send, Settings2, Square, X } from 'lucide-react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ContextSelector } from './context-selector';

interface AiChatInputProps {
    onSend: (content: string) => void;
    onSummarize: () => void;
    notes: any[];
    folders: any[];
    selectedNotes: any[];
    onToggleNote: (note: any) => void;
    onToggleFolder: (folderId: string) => void;
    onClearAll: () => void;
    onStop?: () => void;
    disabled: boolean;
    isFloating?: boolean;
}

export function AiChatInput({
    onSend,
    notes,
    folders,
    selectedNotes,
    onToggleNote,
    onToggleFolder,
    onClearAll,
    isFloating,
    onStop,
    disabled
}: AiChatInputProps) {
    const {
        activeProvider,
        setActiveProvider,
        availableModels,
        selectedModel,
        setSelectedModel,
        selectedModelOpenAi,
        selectedModelAnthropic,
        selectedModelGoogle,
        setSelectedModelOpenAi,
        setSelectedModelAnthropic,
        setSelectedModelGoogle,
        chatContext,
        setChatContext,
        webSearchEnabled,
        setWebSearchEnabled,
        reasoningEnabled,
        setReasoningEnabled,
    } = useAiStore();

    // Ollama is the only provider without web search support
    const supportsWebSearch = activeProvider === 'openai' || activeProvider === 'google' || activeProvider === 'anthropic';

    const currentModelName = activeProvider === 'ollama'
        ? selectedModel
        : activeProvider === 'openai'
            ? selectedModelOpenAi
            : activeProvider === 'anthropic'
                ? selectedModelAnthropic
                : selectedModelGoogle;

    const getModelLabel = (provider: string, value: string) => {
        if (provider === 'ollama') return value;
        const models = provider === 'openai' ? OPENAI_MODELS :
                       provider === 'anthropic' ? ANTHROPIC_MODELS :
                       GOOGLE_MODELS;
        return models.find(m => m.value === value)?.label || value;
    };

    const handleSetModel = (model: string) => {
        if (OPENAI_MODELS.some(m => m.value === model)) {
            setActiveProvider('openai');
            setSelectedModelOpenAi(model);
        } else if (ANTHROPIC_MODELS.some(m => m.value === model)) {
            setActiveProvider('anthropic');
            setSelectedModelAnthropic(model);
        } else if (GOOGLE_MODELS.some(m => m.value === model)) {
            setActiveProvider('google');
            setSelectedModelGoogle(model);
        } else {
            setActiveProvider('ollama');
            setSelectedModel(model);
        }
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
        <div className={cn("flex flex-col gap-2 ", isFloating ? "m-1 " : " ")}>
            <div className="w-full bg-background border rounded-3xl  focus-within:shadow-md focus-within:border-primary/30 group p-1.5 flex flex-col gap-1 transition-all duration-300">
                {chatContext && (
                    <div className="mx-1 mt-1 px-3 py-2.5 bg-primary/5 border border-primary/10 rounded-2xl relative group/context animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="text-[10px] font-bold text-primary/70 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <MessageSquare size={10} />
                            Selected Context
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed wrap-break-word italic border-l-2 border-primary/20 pl-2 ml-1 whitespace-pre-wrap">
                            "{purifyNoteHtml(chatContext.html).trim() || chatContext.text || 'Selected item'}"
                        </p>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setChatContext(null)}
                            className="absolute top-1.5 right-1.5 h-6 w-6 rounded-lg opacity-0 group-hover/context:opacity-100 transition-opacity text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                            <X size={12} />
                        </Button>
                    </div>
                )}
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value.slice(0, MAX_LENGTH))}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    dir="auto"
                    placeholder={!currentModelName ? "Select a model to start..." : (selectedNotes.length > 0 ? `Ask about ${selectedNotes.length} notes...` : "Ask AI about current note...")}
                    disabled={disabled || !currentModelName}
                    className="w-full bg-transparent border-none outline-none resize-none px-3 pt-2 pb-1 text-[14px] leading-relaxed max-h-[160px] min-h-[44px] overflow-y-auto custom-scrollbar disabled:opacity-50"
                />

                <div className="flex items-center justify-between px-1.5 pb-0.5 gap-2">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                        <ContextSelector
                            notes={notes}
                            folders={folders}
                            selectedNotes={selectedNotes}
                            onToggleNote={onToggleNote}
                            onToggleFolder={onToggleFolder}
                            onClearAll={onClearAll}
                        />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-7 px-2 rounded-full gap-1 text-[10px] font-bold transition-all border shrink-0",
                                        (webSearchEnabled || reasoningEnabled)
                                            ? "bg-primary/10 text-primary border-primary/25 hover:bg-primary/20"
                                            : "text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 border-transparent hover:border-border/50",
                                    )}
                                >
                                    <Settings2
                                        size={12}
                                        className={cn(
                                            "transition-colors",
                                            (webSearchEnabled || reasoningEnabled) ? "text-primary" : "text-muted-foreground"
                                        )}
                                    />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 rounded-xl border-border/50 shadow-xl bg-popover/95 backdrop-blur-md p-1.5">
                                <DropdownMenuItem
                                    className="text-xs rounded-lg cursor-pointer flex items-center justify-between"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (supportsWebSearch) setWebSearchEnabled(!webSearchEnabled);
                                    }}
                                    disabled={!supportsWebSearch}
                                >
                                    <div className="flex items-center gap-2">
                                        <Globe size={14} className={webSearchEnabled ? "text-primary" : "text-muted-foreground/70"} />
                                        <span className={cn(webSearchEnabled && "font-medium")}>Web Search</span>
                                    </div>
                                    {webSearchEnabled && <Check size={12} className="text-primary" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-xs rounded-lg cursor-pointer flex items-center justify-between"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setReasoningEnabled(!reasoningEnabled);
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <BrainCircuit size={14} className={reasoningEnabled ? "text-primary" : "text-muted-foreground/70"} />
                                        <span className={cn(reasoningEnabled && "font-medium")}>Reasoning Mode</span>
                                    </div>
                                    {reasoningEnabled && <Check size={12} className="text-primary" />}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 rounded-full gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 transition-all border border-transparent hover:border-border/50 min-w-0 shrink flex"
                                >
                                    <Bot size={12} className={cn("transition-colors shrink-0", currentModelName ? "text-primary" : "text-muted-foreground")} />
                                    <span className="truncate min-w-0">
                                        {currentModelName ? getModelLabel(activeProvider, currentModelName) : "Select Model"}
                                    </span>
                                    <ChevronDown size={10} className="opacity-50 shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-64 max-h-[350px] overflow-y-auto rounded-xl border-border/50 shadow-xl bg-popover/95 backdrop-blur-md p-1.5 custom-scrollbar">
                                {availableModels.length > 0 && (
                                    <>
                                        <DropdownMenuLabel className="text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase px-2 py-1">
                                            Ollama
                                        </DropdownMenuLabel>
                                        {availableModels.map(m => {
                                            const isSelected = activeProvider === 'ollama' && selectedModel === m.name;
                                            return (
                                                <DropdownMenuItem
                                                    key={`ollama-${m.name}`}
                                                    className={cn(
                                                        "text-xs rounded-lg cursor-pointer flex items-center gap-2 px-2 py-1.5",
                                                        isSelected && "bg-primary/10 text-primary focus:bg-primary/20 focus:text-primary"
                                                    )}
                                                    onClick={() => handleSetModel(m.name)}
                                                >
                                                    <span className="flex w-3.5 h-3.5 items-center justify-center shrink-0">
                                                        {isSelected && <Check size={12} strokeWidth={3} />}
                                                    </span>
                                                    <span className={cn("truncate", isSelected && "font-semibold")}>{m.name}</span>
                                                </DropdownMenuItem>
                                            );
                                        })}
                                        <DropdownMenuSeparator className="my-1" />
                                    </>
                                )}

                                <DropdownMenuLabel className="text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase px-2 py-1">
                                    OpenAI
                                </DropdownMenuLabel>
                                {OPENAI_MODELS.map(m => {
                                    const isSelected = activeProvider === 'openai' && selectedModelOpenAi === m.value;
                                    return (
                                        <DropdownMenuItem
                                            key={`openai-${m.value}`}
                                            className={cn(
                                                "text-xs rounded-lg cursor-pointer flex items-center gap-2 px-2 py-1.5",
                                                isSelected && "bg-primary/10 text-primary focus:bg-primary/20 focus:text-primary"
                                            )}
                                            onClick={() => handleSetModel(m.value)}
                                        >
                                            <span className="flex w-3.5 h-3.5 items-center justify-center shrink-0">
                                                {isSelected && <Check size={12} strokeWidth={3} />}
                                            </span>
                                            <span className={cn("truncate", isSelected && "font-semibold")}>{m.label}</span>
                                        </DropdownMenuItem>
                                    );
                                })}
                                <DropdownMenuSeparator className="my-1" />

                                <DropdownMenuLabel className="text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase px-2 py-1">
                                    Anthropic
                                </DropdownMenuLabel>
                                {ANTHROPIC_MODELS.map(m => {
                                    const isSelected = activeProvider === 'anthropic' && selectedModelAnthropic === m.value;
                                    return (
                                        <DropdownMenuItem
                                            key={`anthropic-${m.value}`}
                                            className={cn(
                                                "text-xs rounded-lg cursor-pointer flex items-center gap-2 px-2 py-1.5",
                                                isSelected && "bg-primary/10 text-primary focus:bg-primary/20 focus:text-primary"
                                            )}
                                            onClick={() => handleSetModel(m.value)}
                                        >
                                            <span className="flex w-3.5 h-3.5 items-center justify-center shrink-0">
                                                {isSelected && <Check size={12} strokeWidth={3} />}
                                            </span>
                                            <span className={cn("truncate", isSelected && "font-semibold")}>{m.label}</span>
                                        </DropdownMenuItem>
                                    );
                                })}
                                <DropdownMenuSeparator className="my-1" />

                                <DropdownMenuLabel className="text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase px-2 py-1">
                                    Google
                                </DropdownMenuLabel>
                                {GOOGLE_MODELS.map(m => {
                                    const isSelected = activeProvider === 'google' && selectedModelGoogle === m.value;
                                    return (
                                        <DropdownMenuItem
                                            key={`google-${m.value}`}
                                            className={cn(
                                                "text-xs rounded-lg cursor-pointer flex items-center gap-2 px-2 py-1.5",
                                                isSelected && "bg-primary/10 text-primary focus:bg-primary/20 focus:text-primary"
                                            )}
                                            onClick={() => handleSetModel(m.value)}
                                        >
                                            <span className="flex w-3.5 h-3.5 items-center justify-center shrink-0">
                                                {isSelected && <Check size={12} strokeWidth={3} />}
                                            </span>
                                            <span className={cn("truncate", isSelected && "font-semibold")}>{m.label}</span>
                                        </DropdownMenuItem>
                                    );
                                })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {isNearLimit && (
                            <span className={cn(
                                "text-[10px] font-medium",
                                content.length >= MAX_LENGTH ? "text-destructive" : "text-muted-foreground/60"
                            )}>
                                {content.length}/{MAX_LENGTH}
                            </span>
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
        </div>
    );
}
