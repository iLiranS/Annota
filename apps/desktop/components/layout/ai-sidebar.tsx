import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AiChat, aiChats, aiMessages, generateId, getDb, useAiStore, useNavigationStore, useNotesStore } from "@annota/core";
import { desc, eq } from "drizzle-orm";
import {
    AlignLeft,
    Bot,
    MessageSquare,
    Settings2,
    Trash2
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { matchPath, useLocation } from "react-router-dom";

import { useAiChat } from "@annota/core";
import { AiChatInput } from "../ai/ai-chat-input";
import { AiChatListItem } from "../ai/ai-chat-list-item";
import { AiChatError, AiChatMessage } from "../ai/ai-chat-message";

export function AiSidebar({ width, isResizing, isFloating }: { width?: number, isResizing?: boolean, isFloating?: boolean }) {
    const {
        activeProvider,
        isOllamaRunning,
        ollamaBaseUrl,
        checkConnection,
        fetchModels,
        hasOpenAiKey,
        hasAnthropicKey,
        hasGoogleKey,
        refreshTicket
    } = useAiStore();
    const { notes, folders } = useNotesStore();
    const { setSettingsOpen } = useNavigationStore();
    const location = useLocation();
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [chats, setChats] = useState<AiChat[]>([]);
    const [selectedFolderNotes, setSelectedFolderNotes] = useState<any[]>([]);

    const prevChatIdRef = useRef<string | null>(activeChatId);
    const prevNoteIdRef = useRef<string | null>(null);

    // Reset context selection when switching chats or returning to list
    // But NOT when assigning the first ID to a new chat
    useEffect(() => {
        const prevId = prevChatIdRef.current;
        const currentId = activeChatId;

        const match = matchPath({ path: "/notes/:folderId/:noteId" }, location.pathname)
            || matchPath({ path: "/notes/:noteId" }, location.pathname);
        const noteId = match?.params?.noteId || null;

        // If we switched from one chat to another, or went back to the list
        if (prevId !== currentId && (currentId === null || (prevId !== null && currentId !== null))) {
            setSelectedFolderNotes([]);
        }

        // Auto-select current note if it's a new chat OR an existing chat with only the default note selected
        // If the note changed while viewing the chat, update selection
        if (noteId !== prevNoteIdRef.current) {
            if (currentId === null || selectedFolderNotes.length <= 1) {
                if (noteId) {
                    const currentNote = notes.find(n => n.id === noteId);
                    if (currentNote) {
                        setSelectedFolderNotes([currentNote]);
                    }
                } else {
                    setSelectedFolderNotes([]);
                }
            }
        }

        prevChatIdRef.current = currentId;
        prevNoteIdRef.current = noteId;
    }, [activeChatId, location.pathname, notes]);

    const activeChat = activeChatId ? chats.find(c => c.id === activeChatId) : null;
    const scrollEndRef = useRef<HTMLDivElement>(null);

    const { messages, sendMessage: originalSendMessage, isStreaming, error, stop } = useAiChat(activeChatId);
    const visibleMessages = messages.filter(m => m.role !== 'system');
    const streamingMessageId = isStreaming
        ? [...visibleMessages].reverse().find(m => m.role === 'assistant')?.id
        : null;

    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
    const lastScrollTopRef = useRef(0);

    // Reset auto-scroll when a new generation starts
    useEffect(() => {
        if (isStreaming) {
            setShouldAutoScroll(true);
        }
    }, [isStreaming]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (shouldAutoScroll) {
            scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isStreaming, shouldAutoScroll, error]);

    const handleChatScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const { scrollTop, scrollHeight, clientHeight } = target;

        // Detect if user is scrolling UP during streaming
        if (isStreaming && scrollTop < lastScrollTopRef.current - 1) {
            setShouldAutoScroll(false);
        }

        // Re-enable if user manually scrolls back to bottom
        const isAtBottom = Math.ceil(scrollHeight - scrollTop) <= clientHeight + 10;
        if (isAtBottom && !shouldAutoScroll) {
            setShouldAutoScroll(true);
        }

        lastScrollTopRef.current = scrollTop;
    }, [isStreaming, shouldAutoScroll]);

    // Auto-inject context of current note
    const handleSendMessage = useCallback(async (content: string, mode: 'auto' | 'summary' = 'auto', isRetry = false) => {
        let currentId = activeChatId;

        if (!currentId) {
            const db = getDb();
            currentId = generateId();
            const now = new Date();
            const newChat: AiChat = {
                id: currentId,
                title: mode === 'summary' ? "Note Summary" : "New Chat",
                isPinned: false,
                createdAt: now,
                updatedAt: now,
            };
            await db.insert(aiChats).values(newChat).run();
            setChats(prev => [newChat, ...prev]);
            setActiveChatId(currentId);
        }

        originalSendMessage(content, {
            overrideChatId: currentId,
            selectedFolderNotes: selectedFolderNotes.length > 0 ? selectedFolderNotes : undefined,
            mode,
            isRetry,
        });
        setShouldAutoScroll(true);
    }, [location.pathname, originalSendMessage, activeChatId, selectedFolderNotes]);

    const handleSummarize = useCallback(() => {
        const prompt = "Please summarize this context. Cover all major sections and key points.";
        handleSendMessage(prompt, 'summary');
    }, [handleSendMessage]);

    const handleRetry = useCallback(() => {
        const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
        if (lastUserMessage) {
            handleSendMessage(lastUserMessage.content, 'auto', true);
        }
    }, [messages, handleSendMessage]);

    const handleToggleNote = useCallback((note: any) => {
        setSelectedFolderNotes(prev => {
            const exists = prev.find(n => n.id === note.id);
            if (exists) return prev.filter(n => n.id !== note.id);
            return [...prev, note];
        });
    }, []);

    const handleToggleFolder = useCallback((folderId: string) => {
        const folderNotes = notes.filter(n => n.folderId === folderId);
        setSelectedFolderNotes(prev => {
            const allInPrev = folderNotes.length > 0 && folderNotes.every(fn => prev.find(pn => pn.id === fn.id));
            if (allInPrev) {
                const folderNoteIds = new Set(folderNotes.map(n => n.id));
                return prev.filter(n => !folderNoteIds.has(n.id));
            } else {
                const existingIds = new Set(prev.map(n => n.id));
                const toAdd = folderNotes.filter(n => !existingIds.has(n.id));
                return [...prev, ...toAdd];
            }
        });
    }, [notes]);

    // Initial connection check & models fetch (Only for Ollama)
    useEffect(() => {
        if (activeProvider === 'ollama') {
            checkConnection();
            fetchModels();
        }
    }, [checkConnection, fetchModels, activeProvider]);

    // Load available chats
    const loadChats = useCallback(async () => {
        const db = getDb();
        const results = await db.select()
            .from(aiChats)
            .orderBy(desc(aiChats.updatedAt))
            .all();
        setChats(results);
    }, []);

    useEffect(() => {
        loadChats();
    }, [loadChats, refreshTicket]);



    const handleClearAllChats = useCallback(async () => {
        const db = getDb();
        await db.delete(aiMessages).run();
        await db.delete(aiChats).run();
        setChats([]);
        setActiveChatId(null);
    }, []);

    const handleDeleteChat = useCallback(async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const db = getDb();
        await db.delete(aiMessages).where(eq(aiMessages.chatId, id)).run();
        await db.delete(aiChats).where(eq(aiChats.id, id)).run();
        setChats(prev => prev.filter(c => c.id !== id));
        if (activeChatId === id) setActiveChatId(null);
    }, [activeChatId]);

    const handleTogglePinChat = useCallback(async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const chat = chats.find(c => c.id === id);
        if (!chat) return;

        const db = getDb();
        const newPinned = !chat.isPinned;
        await db.update(aiChats).set({ isPinned: newPinned }).where(eq(aiChats.id, id)).run();
        setChats(prev => prev.map(c => c.id === id ? { ...c, isPinned: newPinned } : c));
    }, [chats]);

    const handleInsertToNote = useCallback((content: string) => {
        window.dispatchEvent(new CustomEvent('annota-insert-ai-content', {
            detail: { content }
        }));
    }, []);



    const isConfigured = activeProvider === 'ollama'
        ? isOllamaRunning
        : activeProvider === 'openai'
            ? hasOpenAiKey
            : activeProvider === 'anthropic'
                ? hasAnthropicKey
                : hasGoogleKey;

    if (!isConfigured && !activeChatId) {
        return (
            <div className="flex flex-col h-full w-full overflow-hidden" style={{ minWidth: isResizing ? undefined : width }}>
                <div className={cn(
                    "flex flex-col h-full w-full items-center justify-center text-center gap-4 p-6 overflow-hidden transition-all duration-300",

                )}>
                    <div className="p-4 rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                        <Bot size={36} />
                    </div>
                    <div className="space-y-1.5 px-4">
                        <h3 className="text-sm font-semibold capitalize">
                            {activeProvider} {activeProvider === 'ollama' ? 'Required' : 'Configuration'}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {activeProvider === 'ollama'
                                ? "Annota uses local AI. Please ensure Ollama is running on your machine."
                                : `Please configure your ${activeProvider} API key in the AI Models settings.`
                            }
                        </p>
                    </div>
                    {activeProvider === 'ollama' ? (
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 rounded-xl gap-2 h-9 px-6 bg-primary/5 border-primary/20 hover:bg-primary/10 transition-all font-medium"
                            onClick={() => { checkConnection(); fetchModels(); }}
                        >
                            <Settings2 size={14} />
                            Retry Connection
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 rounded-xl gap-2 h-9 px-6 bg-primary/5 border-primary/20 hover:bg-primary/10 transition-all font-medium"
                            onClick={() => setSettingsOpen(true)}
                        >
                            <Settings2 size={14} />
                            Open Settings
                        </Button>
                    )}
                    {activeProvider === 'ollama' && (
                        <p className="text-[10px] text-muted-foreground/40 absolute bottom-6">
                            {ollamaBaseUrl}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <header className={cn(
                "relative flex gap-2 items-center justify-between shrink-0 h-11  px-2  rounded-lg ",
                isFloating && "mx-2",
                activeChat ? ' bg-accent/20 shadow border border-accent/40' : ''
            )}>
                <div className="flex items-center gap-2 min-w-0 z-10">
                    {activeChatId ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg text-accent-full hover:text-accent-full hover:bg-accent/50 transition-all shrink-0"
                            onClick={() => setActiveChatId(null)}
                            title="Back to all chats"
                        >
                            <AlignLeft size={16} strokeWidth={2.5} />
                        </Button>
                    ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                            All Chats
                        </span>
                    )}
                </div>

                {activeChatId && activeChat ? (
                    <span dir="auto" className="text-[11px]  w-full font-bold truncate text-foreground/90 ">
                        {activeChat.title}
                    </span>
                )
                    :

                    <div className="flex items-center gap-1 shrink-0 z-10">
                        {!activeChatId && chats.length > 0 && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg gap-1.5 transition-all"
                                    >
                                        <Trash2 size={11} />
                                        Clear
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-2xl">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Clear all conversations?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete all your AI chat history. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleClearAllChats}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                                        >
                                            Clear All
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                }
            </header>

            {!isConfigured && activeChatId && (
                <div className="bg-destructive/10 text-destructive text-[10px] font-medium px-3 py-1.5 flex items-center justify-between gap-2 border-b border-destructive/20 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                        <span>Connection lost to {activeProvider}</span>
                    </div>
                    {activeProvider === 'ollama' && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[9px] hover:bg-destructive/10 text-destructive border border-destructive/20 rounded-md"
                            onClick={() => { checkConnection(); fetchModels(); }}
                        >
                            Reconnect
                        </Button>
                    )}
                </div>
            )}

            {!activeChatId ? (
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 min-h-0  pt-2 overflow-y-auto premium-scrollbar">
                        <div className="space-y-0.5 pb-2">
                            {chats.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                                    <div className="p-3 rounded-xl bg-muted/40 text-muted-foreground/40">
                                        <MessageSquare size={20} />
                                    </div>
                                    <p className="text-[11px] text-muted-foreground/40 italic">
                                        No conversations yet
                                    </p>
                                </div>
                            ) : (
                                [...chats].sort((a, b) => {
                                    if (a.isPinned && !b.isPinned) return -1;
                                    if (!a.isPinned && b.isPinned) return 1;
                                    return (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0);
                                }).map(chat => (
                                    <AiChatListItem
                                        key={chat.id}
                                        chat={chat}
                                        isActive={chat.id === activeChatId}
                                        onClick={() => setActiveChatId(chat.id)}
                                        onTogglePin={(e) => handleTogglePinChat(chat.id, e)}
                                        onDelete={(e) => handleDeleteChat(chat.id, e)}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    <div className="shrink-0">
                        <AiChatInput
                            onSend={handleSendMessage}
                            onSummarize={handleSummarize}
                            notes={notes}
                            folders={folders}
                            selectedNotes={selectedFolderNotes}
                            onToggleNote={handleToggleNote}
                            onToggleFolder={handleToggleFolder}
                            onClearAll={() => setSelectedFolderNotes([])}
                            onStop={stop}
                            disabled={isStreaming}
                            isFloating={isFloating}
                        />
                    </div>
                </div>
            ) : (
                <>
                    <div
                        className="flex-1 min-h-0 overflow-y-auto premium-scrollbar"
                        onScroll={handleChatScroll}
                    >
                        <div className="flex flex-col gap-4  py-4">
                            {visibleMessages.map((m, idx) => (
                                <AiChatMessage
                                    key={m.id || idx}
                                    message={m}
                                    isStreaming={m.id === streamingMessageId}
                                    onInsertToNote={handleInsertToNote}
                                />
                            ))}
                            {error && <AiChatError error={error} onRetry={handleRetry} />}
                            <div ref={scrollEndRef} />
                        </div>
                    </div>

                    <div className=" pt-1 shrink-0">
                        <AiChatInput
                            onSend={handleSendMessage}
                            onSummarize={handleSummarize}
                            notes={notes}
                            folders={folders}
                            selectedNotes={selectedFolderNotes}
                            onToggleNote={handleToggleNote}
                            onToggleFolder={handleToggleFolder}
                            onClearAll={() => setSelectedFolderNotes([])}
                            onStop={stop}
                            disabled={isStreaming}
                            isFloating={isFloating}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
