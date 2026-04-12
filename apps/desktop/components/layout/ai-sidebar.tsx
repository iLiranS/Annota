import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOllamaChat } from "@/hooks/use-ollama-chat";
import { cn } from "@/lib/utils";
import { AiChat, aiChats, aiMessages, generateId, getDb, useAiStore, useNotesStore, useSettingsStore } from "@annota/core";
import { hljs } from "@annota/editor-core";
import { desc, eq } from "drizzle-orm";
import 'katex/dist/katex.min.css';
import {
    Bot,
    ChevronLeft,
    Copy,
    CopyPlus,
    MessageSquare,
    Pin,
    Plus,
    Settings2,
    Sparkles,
    Trash2,
    X
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from 'react-markdown';
import { matchPath, useLocation } from "react-router-dom";
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

// Import styles to match the editor
import '@annota/editor-core/styles.css';
import 'highlight.js/styles/atom-one-dark.css';
import { AiChatInput } from "../ai/ai-chat-input";

export function AiSidebar() {
    const {
        isOllamaRunning,
        ollamaBaseUrl,
        checkConnection,
        fetchModels,
        refreshTicket
    } = useAiStore();

    const { notes, getNoteContent } = useNotesStore();
    const location = useLocation();
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [chats, setChats] = useState<AiChat[]>([]);
    const activeChat = activeChatId ? chats.find(c => c.id === activeChatId) : null;
    const scrollEndRef = useRef<HTMLDivElement>(null);

    const { messages, sendMessage: originalSendMessage, isStreaming, error, stop } = useOllamaChat(activeChatId);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isStreaming]);

    // Auto-inject context of current note
    const handleSendMessage = useCallback(async (content: string) => {
        let currentId = activeChatId;

        if (!currentId) {
            const db = getDb();
            currentId = generateId();
            const now = new Date();
            const newChat: AiChat = {
                id: currentId,
                title: "New Chat",
                createdAt: now,
                updatedAt: now,
            };
            await db.insert(aiChats).values(newChat).run();
            setChats(prev => [newChat, ...prev]);
            setActiveChatId(currentId);
        }

        const contextNotes: Array<{ title: string, content: string }> = [];

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

        originalSendMessage(content, contextNotes, currentId);
    }, [location.pathname, notes, getNoteContent, originalSendMessage, activeChatId]);

    // Initial connection check & models fetch
    useEffect(() => {
        checkConnection();
        fetchModels();
    }, [checkConnection, fetchModels]);

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

    // ─── Offline / not connected state ──────────────────────────────────────────

    if (!isOllamaRunning) {
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
                    <div className="space-y-1.5">
                        <h3 className="text-sm font-semibold">Ollama Required</h3>
                        <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                            Annota uses local AI. Please ensure Ollama is running on your machine.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 rounded-xl gap-2 h-9 px-6 bg-primary/5 border-primary/20 hover:bg-primary/10 transition-all font-medium"
                        onClick={() => { checkConnection(); fetchModels(); }}
                    >
                        <Settings2 size={14} />
                        Retry Connection
                    </Button>
                    <p className="text-[10px] text-muted-foreground/40 absolute bottom-6">
                        {ollamaBaseUrl}
                    </p>
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
                            <span className="text-[12px] font-semibold truncate text-foreground/80">
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
                                                <span className="truncate font-medium text-[12px]">{chat.title}</span>
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

                        <div className="p-2 pt-1 shrink-0 border-t border-border/20">
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
                        <ScrollArea className="flex-1 min-h-0">
                            <div className="flex flex-col gap-4 px-3 py-4">
                                {messages.map((m, idx) => (
                                    <div
                                        key={m.id || idx}
                                        className={cn(
                                            "flex flex-col gap-1",
                                            m.role === 'user' ? "items-end" : "items-start"
                                        )}
                                    >
                                        <div className={cn(
                                            "text-[13px] leading-relaxed rounded-2xl wrap-break-word px-3.5 py-2.5",
                                            m.role === 'user'
                                                ? "max-w-[85%] bg-muted/60 text-foreground rounded-br-sm self-end shadow-sm"
                                                : "w-full bg-transparent text-foreground border-none shadow-none px-0"
                                        )}>
                                            {m.role === 'user' ? (
                                                <span className="whitespace-pre-wrap">{m.content}</span>
                                            ) : (
                                                <div className="relative group/content">
                                                    <div className="prose prose-sm dark:prose-invert max-w-none
                                                        prose-p:leading-relaxed prose-p:my-1.5
                                                        prose-table:block prose-table:overflow-x-auto
                                                        prose-th:border prose-th:border-border/30 prose-th:p-2 prose-th:bg-muted/50
                                                        prose-td:border prose-td:border-border/20 prose-td:p-2
                                                        prose-headings:font-semibold prose-headings:my-2
                                                        prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5">
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm, remarkMath]}
                                                            rehypePlugins={[rehypeKatex]}
                                                            components={{
                                                                pre({ children }) {
                                                                    return <>{children}</>;
                                                                },
                                                                code({ node, inline, className, children, ...props }: any) {
                                                                    const match = /language-(\w+)/.exec(className || '');
                                                                    const lang = match ? match[1] : '';
                                                                    const code = String(children).replace(/\n$/, '');

                                                                    if (!inline && lang) {
                                                                        let highlighted = code;
                                                                        try {
                                                                            highlighted = hljs.getLanguage(lang)
                                                                                ? hljs.highlight(code, { language: lang }).value
                                                                                : hljs.highlightAuto(code).value;
                                                                        } catch (e) {
                                                                            console.warn("AI Highlighting failed:", e);
                                                                        }

                                                                        return (
                                                                            <div className="code-block-wrapper my-4 border border-border/10 bg-black/3! dark:bg-white/3! overflow-hidden">
                                                                                <div className="code-block-header py-0! px-3! min-h-0! h-7! pointer-events-auto! border-b! border-border/5! flex! items-center!">
                                                                                    <div className="p-0! bg-transparent! text-[10px]! opacity-70! uppercase! tracking-wider! font-bold!">
                                                                                        {lang}
                                                                                    </div>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            navigator.clipboard.writeText(code);
                                                                                        }}
                                                                                        className="code-menu-btn h-5! w-5! p-0! flex items-center justify-center hover:bg-white/10 rounded-md transition-colors"
                                                                                        title="Copy Code"
                                                                                    >
                                                                                        <Copy size={11} className="opacity-70" />
                                                                                    </button>
                                                                                </div>
                                                                                <pre className="m-0! p-3! bg-transparent! border-none!">
                                                                                    <code
                                                                                        className={`hljs language-${lang} bg-transparent! p-0!`}
                                                                                        dangerouslySetInnerHTML={{ __html: highlighted }}
                                                                                    />
                                                                                </pre>
                                                                            </div>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <code
                                                                            className={cn(
                                                                                "px-1.5 py-0.5 rounded text-[12px] font-mono",
                                                                                "bg-black/5 dark:bg-white/10 text-foreground/80",
                                                                                className
                                                                            )}
                                                                            {...props}
                                                                        >
                                                                            {children}
                                                                        </code>
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            {m.content}
                                                        </ReactMarkdown>
                                                    </div>

                                                    {!isStreaming && m.content && (
                                                        <div className="absolute -right-1 -top-1 opacity-0 group-hover/content:opacity-100 transition-opacity">
                                                            <Button
                                                                variant="secondary"
                                                                size="icon"
                                                                className="h-6 w-6 rounded-full shadow-md border border-border/50 hover:scale-105 active:scale-95 transition-all"
                                                                onClick={() => handleInsertToNote(m.content)}
                                                                title="Insert to note"
                                                            >
                                                                <CopyPlus size={10} />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Typing indicator */}
                                            {m.role === 'assistant' && !m.content && isStreaming && (
                                                <span className="flex items-center gap-1 py-0.5">
                                                    <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                    <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                    <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce" />
                                                </span>
                                            )}
                                        </div>

                                        {/* Role label */}
                                        <span className="text-[9px] text-muted-foreground/35 px-1 uppercase tracking-widest font-bold">
                                            {m.role === 'assistant' ? (m.model || 'assistant') : 'You'}
                                        </span>
                                    </div>
                                ))}

                                {error && (
                                    <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-[11px] flex items-center gap-2 border border-destructive/20">
                                        <X size={13} />
                                        {error}
                                    </div>
                                )}

                                {/* Scroll anchor */}
                                <div ref={scrollEndRef} />
                            </div>
                        </ScrollArea>

                        <div className="p-2 pt-1 shrink-0 border-t border-border/20">
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