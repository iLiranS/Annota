import { Button } from "@/components/ui/button";
import { cn, isRtl } from "@/lib/utils";
import { AiMessage } from "@annota/core";
import { BrainCircuit, ChevronDown, ChevronLeft, ChevronRight, CopyPlus, RotateCcw, Wrench, X } from "lucide-react";
import React from "react";
import { AiMarkdown } from "./ai-markdown";

interface AiChatMessageProps {
    message: AiMessage;
    isStreaming?: boolean;
    onInsertToNote?: (content: string) => void;
}

export function AiChatMessage({ message, isStreaming, onInsertToNote }: AiChatMessageProps) {
    const isUser = message.role === 'user';
    const _isRtl = isRtl(message.content);

    // Extremely lenient detection for flashcard content
    const hasFlashcards = !isUser && (
        /data-fc=["']?true["']?/.test(message.content) ||
        /class=["']flashcard-card-container["']/.test(message.content)
    );

    return (
        <div
            className={cn(
                "flex flex-col gap-1",
                isUser ? "items-end" : "items-start"
            )}
        >
            <div
                dir={_isRtl ? "rtl" : "ltr"}
                className={cn(
                    "text-[13px] leading-relaxed rounded-2xl wrap-break-word px-3.5 py-2.5",
                    _isRtl ? "text-right" : "text-left",
                    isUser
                        ? "max-w-[85%] bg-muted/60 text-foreground rounded-br-sm self-end shadow-sm"
                        : "w-full bg-transparent text-foreground border-none shadow-none px-0"
                )}
            >
                {isUser ? (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                ) : (
                    <div className="flex flex-col gap-2">
                        <AiProcessBlock
                            reasoningContent={message.reasoningContent}
                            toolCalls={message.toolCalls}
                            isStreaming={isStreaming}
                            hasContent={Boolean(message.content)}
                        />

                        {hasFlashcards ? (
                            <FlashcardRenderer content={message.content} isStreaming={isStreaming} onInsertToNote={onInsertToNote} />
                        ) : (
                            <AiMarkdown content={message.content} />
                        )}

                        {/* Typing indicator */}
                        {!message.content && isStreaming && (
                            <span className="flex items-center gap-1 py-0.5">
                                <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce" />
                            </span>
                        )}

                        {!hasFlashcards && !isStreaming && message.content && onInsertToNote && (
                            <div className="flex justify-start pt-0.5  transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1.5 px-2 text-[11px]  rounded-lg opacity-60 hover:opacity-100"
                                    onClick={() => onInsertToNote(message.content)}
                                >
                                    <CopyPlus size={12} />
                                    Insert into note
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function AiProcessBlock({
    reasoningContent,
    toolCalls,
    isStreaming,
    hasContent,
}: {
    reasoningContent?: string | null;
    toolCalls?: string[] | null;
    isStreaming?: boolean;
    hasContent?: boolean;
}) {
    const hasReasoning = Boolean(reasoningContent?.trim());
    const hasTools = Boolean(toolCalls?.length);
    const [isOpen, setIsOpen] = React.useState(Boolean(isStreaming && !hasContent));
    const autoClosedRef = React.useRef(false);

    React.useEffect(() => {
        if (!isStreaming) {
            autoClosedRef.current = false;
        }
    }, [isStreaming]);

    React.useEffect(() => {
        if (isStreaming) {
            if (!hasContent) {
                setIsOpen(true);
            } else if (!autoClosedRef.current) {
                setIsOpen(false);
                autoClosedRef.current = true;
            }
        }
    }, [isStreaming, hasContent]);

    if (!hasReasoning && !hasTools) return null;

    return (
        <div className="mb-1 rounded-lg border border-border/50 bg-muted/25 overflow-hidden">
            <button
                type="button"
                onClick={() => setIsOpen(open => !open)}
                className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/35 transition-colors"
            >
                <span className="flex min-w-0 items-center gap-1.5 font-medium">
                    <BrainCircuit size={12} className="shrink-0" />
                    <span className="truncate">{isStreaming ? 'Thinking' : 'Thought process'}</span>
                </span>
                <ChevronDown
                    size={13}
                    className={cn("shrink-0 transition-transform", isOpen && "rotate-180")}
                />
            </button>

            {isOpen && (
                <div className="border-t border-border/40 px-2.5 py-2">
                    {hasTools && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                            {toolCalls?.map(tool => (
                                <span
                                    key={tool}
                                    className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                                >
                                    <Wrench size={10} />
                                    {tool}
                                </span>
                            ))}
                        </div>
                    )}

                    {hasReasoning && (
                        <div className="max-h-52 overflow-y-auto premium-scrollbar whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground/90">
                            {reasoningContent}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function InteractiveFlashcardBlock({ cards }: { cards: { front: string; back: string }[] }) {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [isFlipped, setIsFlipped] = React.useState(false);

    const card = cards[currentIndex];
    if (!card) return null;

    return (
        <div className="flex flex-col border border-primary/20 rounded-xl overflow-hidden bg-primary/5 shadow-sm my-2">
            <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10 bg-background/50">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Flashcards ({currentIndex + 1} of {cards.length})
                </span>
                <div className="flex gap-1">
                    <button
                        onClick={() => { setCurrentIndex(c => Math.max(0, c - 1)); setIsFlipped(false); }}
                        disabled={currentIndex === 0}
                        className="p-1 rounded hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <button
                        onClick={() => { setCurrentIndex(c => Math.min(cards.length - 1, c + 1)); setIsFlipped(false); }}
                        disabled={currentIndex === cards.length - 1}
                        className="p-1 rounded hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            <div
                className="p-4 bg-background/40 min-h-[120px] flex flex-col justify-center cursor-pointer transition-colors hover:bg-background/60"
                onClick={() => setIsFlipped(!isFlipped)}
            >
                <div className="text-[10px] font-bold text-primary/60 uppercase tracking-wider mb-2 text-center">
                    {isFlipped ? 'Answer' : 'Question'}
                </div>
                <div className="text-sm font-medium text-center leading-relaxed">
                    {isFlipped ? card.back : card.front}
                </div>
            </div>
            <div className="px-3 py-1.5 bg-primary/5 border-t border-primary/10 text-[9px] text-center text-muted-foreground/70 uppercase tracking-wider font-semibold">
                Click card to flip
            </div>
        </div>
    );
}

function FlashcardRenderer({ content, isStreaming, onInsertToNote }: { content: string, isStreaming?: boolean, onInsertToNote?: (content: string) => void }) {
    // 1. Extract all fronts and backs globally from the entire content
    // Use highly lenient regexes to tolerate extra spaces or additional classes
    const fronts = Array.from(content.matchAll(/class=[^>]*flashcard-card-front[^>]*>([\s\S]*?)(?:<\/div>|(?=<div[^>]*class=[^>]*flashcard-card-back))/gi));
    const backs = Array.from(content.matchAll(/class=[^>]*flashcard-card-back[^>]*>([\s\S]*?)(?:<\/div>|(?=<div[^>]*class=[^>]*flashcard-card-(?:container|front)|$))/gi));

    const cardsCount = Math.max(fronts.length, backs.length);
    const cards: { front: string; back: string }[] = [];
    for (let j = 0; j < cardsCount; j++) {
        const f = fronts[j] ? fronts[j][1].replace(/<[^>]*>?/gm, '').trim() : '';
        const b = backs[j] ? backs[j][1].replace(/<[^>]*>?/gm, '').trim() : '';
        if (f || b) cards.push({ front: f, back: b });
    }

    // 2. Extract markdown text before the flashcards begin
    // This safely hides all the raw HTML from the Markdown renderer
    const firstFlashcardIndex = content.search(/<div[^>]*class=[^>]*flashcard-(?:block|card-container)/i);
    const markdownContent = firstFlashcardIndex !== -1
        ? content.slice(0, firstFlashcardIndex).trim()
        : (cards.length === 0 ? content.trim() : '');

    // Reconstruct perfect HTML for insertion
    const handleInsert = () => {
        if (!onInsertToNote) return;

        let finalHtml = markdownContent ? markdownContent + '\n\n' : '';

        if (cards.length > 0) {
            finalHtml += '<div class="flashcard-block" data-fc="true">\n';
            cards.forEach(c => {
                finalHtml += `  <div class="flashcard-card-container">\n    <div class="flashcard-card-front">${c.front}</div>\n    <div class="flashcard-card-back">${c.back}</div>\n  </div>\n`;
            });
            finalHtml += '</div>';
        }

        onInsertToNote(finalHtml);
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-4">
                {markdownContent ? <AiMarkdown content={markdownContent} /> : null}
                {cards.length > 0 && <InteractiveFlashcardBlock cards={cards} />}
            </div>

            {/* Custom insert button for sanitized content */}
            {!isStreaming && cards.length > 0 && onInsertToNote && (
                <div className="flex justify-start pt-0.5 transition-opacity">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-[11px] rounded-lg opacity-60 hover:opacity-100"
                        onClick={handleInsert}
                    >
                        <CopyPlus size={12} />
                        Insert into note
                    </Button>
                </div>
            )}
        </div>
    );
}

export function AiChatError({ error, onRetry }: { error: string, onRetry?: () => void }) {
    return (
        <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-[11px] flex flex-col gap-2 border border-destructive/20">
            <div className="flex items-center gap-2">
                <X size={13} />
                {error}
            </div>
            {onRetry && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="h-7 w-fit gap-1.5 text-[10px] bg-destructive/5 border-destructive/20 hover:bg-destructive/10 text-destructive"
                >
                    <RotateCcw size={12} />
                    Retry
                </Button>
            )}
        </div>
    );
}
