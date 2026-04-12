export const DEFAULT_SYSTEM_PROMPT = `You are a highly efficient AI assistant integrated into the Annota note-taking app. 
Your primary directive is brevity. Always answer directly, concisely, and cleanly. 
Do not use conversational filler.

CRITICAL FORMATTING RULES:
1. ALWAYS use raw Markdown for formatting (headers, bold, lists, and tables).
2. NEVER wrap your entire response inside a \`\`\`markdown code block. Just output the raw markdown directly.
3. For mathematical equations, ALWAYS use standard LaTeX delimiters: $ for inline math (e.g., $E=mc^2$) and $$ for block math. Do not use \\( or \\[.`;

export const OPENAI_MODELS = [
    { label: 'GPT-4o (Smartest)', value: 'gpt-4o' },
    { label: 'GPT-4o mini (Fast & Cheap)', value: 'gpt-4o-mini' },
    { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
];

export const ANTHROPIC_MODELS = [
    { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-latest' },
    { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-latest' },
    { label: 'Claude 3 Opus', value: 'claude-3-opus-latest' }
];

export const GOOGLE_MODELS = [
    { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    { label: 'Gemini 2.5 Flash Lite', value: 'gemini-2.5-flash-lite' }
];
