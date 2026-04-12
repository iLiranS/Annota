import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AiChat, aiChats, aiMessages, generateId, getDb, useAiStore, useNotesStore, useSettingsStore } from "@annota/core";
import { desc, eq } from "drizzle-orm";
import {
    Bot,
    ChevronLeft,
    MessageSquare,
    Pin,
    Plus,
    Settings2,
    Sparkles,
    Trash2
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";

import { AiChatInput } from "../ai/ai-chat-input";
import { AiChatError, AiChatMessage } from "../ai/ai-chat-message";
import { useAiChat } from "@/hooks/use-ai-chat";

export function AiSidebar() {
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

    const { notes, getNoteContent } = useNotesStore();
    const location = useLocation();
    const navigate = useNavigate();
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [chats, setChats] = useState<AiChat[]>([]);
    const activeChat = activeChatId ? chats.find(c => c.id === activeChatId) : null;
    const scrollEndRef = useRef<HTMLDivElement>(null);

    const { messages, sendMessage: originalSendMessage, isStreaming, error, stop } = useAiChat(activeChatId);

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
    }, [messages, isStreaming, shouldAutoScroll]);

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
    const handleSendMessage = useCallback(async (content: string) => {
        let currentId = activeChatId;
        const contextNotes: Array<{ title: string, content: string }> = [];

        // ALWAYS extract the live note state, regardless of whether it's a new chat
        const match = matchPath({ path: "/notes/:folderId/:noteId" }, location.pathname)
            || matchPath({ path: "/notes/:noteId" }, location.pathname);

        const noteId = match?.params?.noteId;
        if (noteId) {
            const currentNote = notes.find(n => n.id === noteId);
            if (currentNote) {
                const rawHtml = await getNoteContent(noteId);
                let cleanContent = '';

                if (rawHtml) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(rawHtml, 'text/html');

                        doc.querySelectorAll('[data-latex]').forEach(el => {
                            const latex = el.getAttribute('data-latex');
                            if (latex) {
                                const isBlock = el.getAttribute('data-type') === 'blockMath';
                                el.textContent = isBlock ? `\n$$\n${latex}\n$$\n` : ` $${latex}$ `;
                            }
                        });

                        doc.querySelectorAll('pre code').forEach(el => {
                            const lang = el.className.replace('language-', '') || 'text';
                            el.textContent = `\n\`\`\`${lang}\n${el.textContent}\n\`\`\`\n`;
                        });

                        cleanContent = doc.body.textContent || '';
                    } catch (e) {
                        cleanContent = rawHtml.replace(/<[^>]*>/g, '');
                    }
                }

                contextNotes.push({
                    title: currentNote.title || 'Current Note',
                    content: cleanContent.slice(0, 15000)
                });
            }
        }

        // ONLY create the database record if it's a new chat
        if (!currentId) {
            const db = getDb();
            currentId = generateId();
            const now = new Date();
            const newChat: AiChat = {
                id: currentId,
                title: "New Chat",
                createdAt: now,
                updatedAt: now,
                currentContextId: noteId || null,
            };
            await db.insert(aiChats).values(newChat).run();
            setChats(prev => [newChat, ...prev]);
            setActiveChatId(currentId);
        }

        originalSendMessage(content, contextNotes, currentId, noteId);
        setShouldAutoScroll(true);
    }, [location.pathname, notes, getNoteContent, originalSendMessage, activeChatId]);

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

    const handleNewChat = useCallback(() => {
        setActiveChatId(null);
    }, []);

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

    const handleInsertToNote = useCallback((content: string) => {
        window.dispatchEvent(new CustomEvent('annota-insert-ai-content', {
            detail: { content }
        }));
    }, []);

    const { general, updateGeneralSettings } = useSettingsStore();
    const isFloating = general.aiSidebarMode === 'floating';

    // ─── Connectivity State Checks ──────────────────────────────────────────

    const isConfigured = activeProvider === 'ollama' 
        ? isOllamaRunning 
        : activeProvider === 'openai' 
            ? hasOpenAiKey
            : activeProvider === 'anthropic'
                ? hasAnthropicKey
                : hasGoogleKey;

    if (!isConfigured) {
        return (
            <div className="flex flex-col h-full w-full overflow-hidden">
                <div className={cn(
                    "flex flex-col h-full w-full items-center justify-center text-center gap-4 p-6 overflow-hidden transition-all duration-300",
                    isFloating
                        ? "rounded-2xl border border-border/40 bg-sidebar/95 backdrop-blur-xl shadow-2xl"
                        : "bg-sidebar/50"
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
                            onClick={() => navigate("/settings", { state: { background: location } })}
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

    // ─── Main panel ─────────────────────────────────────────────────────────────

    return (
        <div dir="ltr" className="flex flex-col h-full w-full overflow-hidden">
            <div className={cn(
                "flex flex-col h-full w-full overflow-hidden shadow-sm transition-all duration-300",
                isFloating
                    ? "rounded-2xl border border-border/40 bg-sidebar/95 backdrop-blur-xl shadow-2xl"
                    : "bg-sidebar/50" // Subtle background when pinned
            )}>

                {/* ── Header ── */}
                <header className="flex items-center justify-between shrink-0 h-12 px-3 border-b border-border/30 bg-sidebar/60">
                    {/* Left: back button or logo */}
                    <div className="flex items-center gap-2 min-w-0">
                        {activeChatId ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all shrink-0"
                                onClick={() => setActiveChatId(null)}
                            >
                                <ChevronLeft size={15} />
                            </Button>
                        ) : (
                            <div className="flex items-center gap-1.5 text-primary/80">
                                <Sparkles size={14} />
                            </div>
                        )}

                        {/* Title */}
                        {activeChatId && activeChat ? (
                            <span dir="auto" className="text-[12px] font-semibold truncate text-foreground/80">
                                {activeChat.title}
                            </span>
                        ) : (
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                AI Assistant
                            </span>
                        )}
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                        {isFloating && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-7 w-7 rounded-lg transition-all",
                                    general.isAiSidebarSticky
                                        ? "text-primary bg-primary/10"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                )}
                                onClick={() => updateGeneralSettings({ isAiSidebarSticky: !general.isAiSidebarSticky })}
                                title={general.isAiSidebarSticky ? "Unpin (Auto-hide)" : "Pin (Keep open)"}
                            >
                                {general.isAiSidebarSticky ? <Pin size={14} className="fill-current" /> : <Pin size={14} />}
                            </Button>
                        )}
                        {!activeChatId ? (
                            chats.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[10px] text-muted-foreground hover:text-destructive hover:bg-primary/10  rounded-lg gap-1.5 transition-all"
                                    onClick={handleClearAllChats}
                                >
                                    <Trash2 size={11} />
                                    Clear all
                                </Button>
                            )
                        ) : (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
                                onClick={handleNewChat}
                                title="New chat"
                            >
                                <Plus size={15} />
                            </Button>
                        )}
                    </div>
                </header>

                {/* ── Body ── */}
                {!activeChatId ? (
                    // ── Chat list view ──────────────────────────────────────────
                    <div className="flex-1 flex flex-col min-h-0">
                        <ScrollArea className="flex-1 min-h-0 px-2 pt-2">
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
                                    chats.map(chat => (
                                        <div
                                            key={chat.id}
                                            onClick={() => setActiveChatId(chat.id)}
                                            className={cn(
                                                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs",
                                                "transition-all group cursor-pointer border border-transparent",
                                                "hover:bg-muted/50 hover:border-border/40 text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <div className="flex-1 flex flex-col min-w-0 pr-2 gap-0.5">
                                                <span dir="auto" className="truncate font-medium text-[12px]">{chat.title}</span>
                                                <span className="text-[9px] opacity-40 tracking-wide">
                                                    {new Date(chat.updatedAt).toLocaleString(undefined, {
                                                        month: 'numeric',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: false
                                                    })}
                                                </span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all rounded-lg"
                                                onClick={(e) => handleDeleteChat(chat.id, e)}
                                            >
                                                <Trash2 size={11} />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>

                        <div className="p-2 pt-1 shrink-0">
                            <AiChatInput
                                onSend={handleSendMessage}
                                onStop={stop}
                                disabled={isStreaming}
                            />
                        </div>
                    </div>
                ) : (
                    // ── Active chat view ────────────────────────────────────────
                    <>
                        <ScrollArea 
                            className="flex-1 min-h-0"
                            onScroll={handleChatScroll}
                        >
                            <div className="flex flex-col gap-4 px-3 py-4">
                                {messages.filter(m => m.role !== 'system').map((m, idx) => (
                                    <AiChatMessage
                                        key={m.id || idx}
                                        message={m}
                                        isStreaming={isStreaming}
                                        onInsertToNote={handleInsertToNote}
                                    />
                                ))}

                                {error && <AiChatError error={error} />}

                                {/* Scroll anchor */}
                                <div ref={scrollEndRef} />
                            </div>
                        </ScrollArea>

                        <div className="p-2 pt-1 shrink-0">
                            <AiChatInput
                                onSend={handleSendMessage}
                                onStop={stop}
                                disabled={isStreaming}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}