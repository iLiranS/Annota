import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AiMessage } from "@annota/core";
import { CopyPlus, X } from "lucide-react";
import { AiMarkdown } from "./ai-markdown";

interface AiChatMessageProps {
    message: AiMessage;
    isStreaming?: boolean;
    onInsertToNote?: (content: string) => void;
}

export function AiChatMessage({ message, isStreaming, onInsertToNote }: AiChatMessageProps) {
    const isUser = message.role === 'user';

    return (
        <div
            className={cn(
                "flex flex-col gap-1",
                isUser ? "items-end" : "items-start"
            )}
        >
            <div className={cn(
                "text-[13px] leading-relaxed rounded-2xl wrap-break-word px-3.5 py-2.5",
                isUser
                    ? "max-w-[85%] bg-muted/60 text-foreground rounded-br-sm self-end shadow-sm"
                    : "w-full bg-transparent text-foreground border-none shadow-none px-0"
            )}>
                {isUser ? (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                ) : (
                    <div className="relative group/content">
                        <AiMarkdown content={message.content} />

                        {!isStreaming && message.content && onInsertToNote && (
                            <div className="absolute -right-1 -top-1 opacity-0 group-hover/content:opacity-100 transition-opacity">
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-6 w-6 rounded-full shadow-md border border-border/50 hover:scale-105 active:scale-95 transition-all"
                                    onClick={() => onInsertToNote(message.content)}
                                    title="Insert to note"
                                >
                                    <CopyPlus size={10} />
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Typing indicator */}
                {message.role === 'assistant' && !message.content && isStreaming && (
                    <span className="flex items-center gap-1 py-0.5">
                        <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce" />
                    </span>
                )}
            </div>

        </div>
    );
}

export function AiChatError({ error }: { error: string }) {
    return (
        <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-[11px] flex items-center gap-2 border border-destructive/20">
            <X size={13} />
            {error}
        </div>
    );
}
