export const DEFAULT_SYSTEM_PROMPT = `You are a highly efficient AI assistant integrated into the Annota note-taking app. 
Your primary directive is brevity. Always answer directly, concisely, and cleanly. 
Do not use conversational filler.

CRITICAL FORMATTING RULES:
1. ALWAYS use raw Markdown for formatting (headers, bold, lists, and tables).
2. NEVER wrap your entire response inside a \`\`\`markdown code block. Just output the raw markdown directly.
3. For mathematical equations, ALWAYS use standard LaTeX delimiters: $ for inline math (e.g., $E=mc^2$) and $$ for block math. Do not use \\( or \\[.`;

export const ANTHROPIC_MODELS = [
    { label: 'Claude Opus 4.7 (Most Capable)', value: 'claude-opus-4-7' },
    { label: 'Claude Sonnet 4.6 (Balanced)', value: 'claude-sonnet-4-6' },
    { label: 'Claude Haiku 4.5 (Fastest & Cheapest)', value: 'claude-haiku-4-5-20251001' },
];

// OpenAI — GPT-4.1 family replaced GPT-4o for API use; GPT-3.5 is long retired
export const OPENAI_MODELS = [
    { label: 'GPT-5.4', value: 'gpt-5.4' },
    { label: 'GPT-5.4 mini (Fast & Cheap)', value: 'gpt-5.4-mini' },
    { label: 'GPT-5.4 nano (Fastest)', value: 'gpt-5.4-nano' },
];

// Google — 2.5 family is stable GA; 2.0 shuts down June 1 2026
export const GOOGLE_MODELS = [
    { label: 'Gemini 3.1 Pro', value: 'gemini-3.1-pro-preview' },
    { label: 'Gemini 3 Flash', value: 'gemini-3-flash-preview' },
    { label: 'Gemini 2.5 Flash (Balanced)', value: 'gemini-2.5-flash' },
    { label: 'Gemini 2.5 Flash-Lite (Fastest & Cheapest)', value: 'gemini-2.5-flash-lite' },
];