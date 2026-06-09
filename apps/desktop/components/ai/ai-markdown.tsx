import { cn } from "@/lib/utils";
import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

// Import styles to match the editor
import '@annota/editor-core/styles.css';
import '@annota/editor-core/highlight-theme.css';
import 'katex/dist/katex.min.css';

interface AiMarkdownProps {
    content: string;
}

let hljsInstance: any = null;
let isLoadingHljs = false;
const hljsCallbacks: ((instance: any) => void)[] = [];

async function loadHljs() {
    if (hljsInstance) return hljsInstance;
    if (isLoadingHljs) {
        return new Promise<any>((resolve) => {
            hljsCallbacks.push(resolve);
        });
    }
    isLoadingHljs = true;
    try {
        const m = await import('highlight.js');
        hljsInstance = m.default || m;
        hljsCallbacks.forEach(cb => cb(hljsInstance));
        hljsCallbacks.length = 0;
    } catch (e) {
        console.error("Failed to load hljs:", e);
    } finally {
        isLoadingHljs = false;
    }
    return hljsInstance;
}

export function AiMarkdown({ content }: AiMarkdownProps) {
    const [hljs, setHljs] = useState<any>(hljsInstance);

    useEffect(() => {
        if (!hljs) {
            loadHljs().then(setHljs);
        }
    }, [hljs]);

    return (
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
                            if (hljs) {
                                try {
                                    highlighted = hljs.getLanguage(lang)
                                        ? hljs.highlight(code, { language: lang }).value
                                        : hljs.highlightAuto(code).value;
                                } catch (e) {
                                    console.warn("AI Highlighting failed:", e);
                                }
                            }

                            return (
                                <div dir="ltr" className="code-block-wrapper my-4 border border-border/10 overflow-hidden rounded-lg hljs" style={{ backgroundColor: 'var(--hljs-bg)' }}>
                                    <div className="code-block-header py-0! px-3! min-h-0! h-7! pointer-events-auto! border-b! border-border/5! flex! items-center!">
                                        <div className="p-0! bg-transparent! text-[10px]! opacity-70! uppercase! tracking-wider! font-bold!">
                                            {lang}
                                        </div>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(code);
                                            }}
                                            className="code-menu-btn ml-auto h-5! w-5! p-0! flex items-center justify-center hover:bg-white/10 rounded-md transition-colors"
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
                                dir="ltr"
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
                {content}
            </ReactMarkdown>
        </div>
    );
}
