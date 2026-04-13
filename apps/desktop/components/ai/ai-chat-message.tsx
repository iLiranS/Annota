import { Button } from "@/components/ui/button";
import { cn, isRtl } from "@/lib/utils";
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
    const _isRtl = isRtl(message.content);

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
                        <AiMarkdown content={message.content} />

                        {/* Typing indicator */}
                        {!message.content && isStreaming && (
                            <span className="flex items-center gap-1 py-0.5">
                                <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce" />
                            </span>
                        )}

                        {!isStreaming && message.content && onInsertToNote && (
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

export function AiChatError({ error }: { error: string }) {
    return (
        <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-[11px] flex items-center gap-2 border border-destructive/20">
            <X size={13} />
            {error}
        </div>
    );
}