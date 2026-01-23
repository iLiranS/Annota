import { Editor } from '@tiptap/core';
import hljs from 'highlight.js';

declare global {
    interface Window {
        ReactNativeWebView?: {
            postMessage: (message: string) => void;
        };
        editor?: Editor;
        hljs?: typeof hljs;
        renderMathInElement?: any; // katex auto-render
        updateImage?: (attrs: any) => void;
        handleCommand?: (command: string, params?: any) => void;
        setupEditor?: (options: any) => void;
    }
}
