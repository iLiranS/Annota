import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AiChat } from "@annota/core";
import { Pin, PinOff, Trash2 } from "lucide-react";
import React from "react";

interface AiChatListItemProps {
    chat: AiChat;
    isActive: boolean;
    onClick: () => void;
    onTogglePin: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
}

export function AiChatListItem({
    chat,
    isActive,
    onClick,
    onTogglePin,
    onDelete,
}: AiChatListItemProps) {
    const updatedAt = new Date(chat.updatedAt);
    const now = new Date();
    const isToday = updatedAt.toDateString() === now.toDateString();

    const formattedDate = isToday
        ? updatedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
        : `${updatedAt.getDate()}.${updatedAt.getMonth() + 1}`;

    return (
        <div
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs",
                "transition-all group cursor-pointer border border-transparent relative overflow-hidden",
                "hover:bg-muted/50 hover:border-border/40 text-muted-foreground hover:text-foreground",
                isActive && "bg-muted/50 border-border/40 text-foreground"
            )}
        >
            <div className="flex-1 flex  items-center min-w-0 gap-2 ">
                {chat.isPinned && (
                    <div className="bg-accent/20 rounded shadow-sm p-1 shrink-0">
                        <Pin size={10} className="text-accent-full shrink-0 fill-current" />
                    </div>
                )}

                <span dir="auto" className="truncate font-medium text-[12px] flex-1">
                    {chat.title}
                </span>
                <span className="text-[9px]  text-muted-foreground/40 tracking-tight shrink-0 group-hover:opacity-0 transition-opacity">
                    {formattedDate}
                </span>
            </div>

            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all bg-muted/80 backdrop-blur-sm pl-2 rounded-l-lg">
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-6 w-6 shrink-0 rounded-lg transition-colors",
                        chat.isPinned ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    onClick={onTogglePin}
                    title={chat.isPinned ? "Unpin chat" : "Pin chat"}
                >
                    {chat.isPinned ? <PinOff size={11} /> : <Pin size={11} />}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 hover:text-destructive hover:bg-destructive/10 transition-colors rounded-lg"
                    onClick={onDelete}
                    title="Delete chat"
                >
                    <Trash2 size={11} />
                </Button>
            </div>
        </div>
    );
}
