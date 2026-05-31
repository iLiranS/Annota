import { AiMessage } from '../db/schema';
import { stripHtml } from '../utils/html';

export type ContextBuildMode = 'auto' | 'summary' | 'full' | 'rewrite';

type ContextModeConfig = {
    globalInputBudgetTokens: number;
    systemReserveTokens: number;
    historyTargetTokens: number;
    historyFloorTokens: number;
    liveContextMaxTokens: number;
    manualContextMaxTokens: number;
    directoryMaxTokens: number;
    singleNoteDirectoryMaxTokens: number;
    skeletonShare: number;
    skeletonMaxTokens: number;
    maxDeepDiveNotes: number;
    autoDiscover: boolean;
};

type ContextBlock = {
    text: string;
    priority: number;
    order: number;
    section: string;
    allowTruncate?: boolean;
};

export type ContextBudgetConfig = ContextModeConfig;

export type ContextBuildMetrics = {
    estimatedTokens: number;
    truncatedSections: string[];
    selectedNoteIds: string[];
    chunkCount: number;
    skeletonCount: number;
    directoryTokens: number;
    deepDiveTokens: number;
};

export type BulkContextResult = {
    text: string;
    metrics: ContextBuildMetrics;
};

type NoteContextMetadata = {
    id: string;
    title?: string | null;
    tags?: string | null;
    preview?: string | null;
    updatedAt?: Date | string | number | null;
};

const GLOBAL_INPUT_BUDGET_TOKENS = 10000;
const SYSTEM_RESERVE_TOKENS = 1000;
const DEFAULT_HISTORY_TARGET_TOKENS = 2500;
const DEFAULT_HISTORY_FLOOR_TOKENS = 1200;
const CHARS_PER_TOKEN_ESTIMATE = 2;
const TRUNCATION_MARKER = '\n\n[... truncated to fit context budget ...]';

const MODE_CONFIGS: Record<ContextBuildMode, Omit<ContextModeConfig, 'directoryMaxTokens' | 'singleNoteDirectoryMaxTokens'>> = {
    auto: {
        globalInputBudgetTokens: GLOBAL_INPUT_BUDGET_TOKENS,
        systemReserveTokens: SYSTEM_RESERVE_TOKENS,
        historyTargetTokens: DEFAULT_HISTORY_TARGET_TOKENS,
        historyFloorTokens: DEFAULT_HISTORY_FLOOR_TOKENS,
        liveContextMaxTokens: 6500,
        manualContextMaxTokens: 1800,
        skeletonShare: 0.15,
        skeletonMaxTokens: 700,
        maxDeepDiveNotes: 3,
        autoDiscover: true,
    },
    summary: {
        globalInputBudgetTokens: GLOBAL_INPUT_BUDGET_TOKENS,
        systemReserveTokens: SYSTEM_RESERVE_TOKENS,
        historyTargetTokens: 2200,
        historyFloorTokens: DEFAULT_HISTORY_FLOOR_TOKENS,
        liveContextMaxTokens: 6800,
        manualContextMaxTokens: 2200,
        skeletonShare: 0.28,
        skeletonMaxTokens: 1000,
        maxDeepDiveNotes: 3,
        autoDiscover: true,
    },
    full: {
        globalInputBudgetTokens: GLOBAL_INPUT_BUDGET_TOKENS,
        systemReserveTokens: SYSTEM_RESERVE_TOKENS,
        historyTargetTokens: 1600,
        historyFloorTokens: 1000,
        liveContextMaxTokens: 8000,
        manualContextMaxTokens: 3500,
        skeletonShare: 0.20,
        skeletonMaxTokens: 900,
        maxDeepDiveNotes: 5,
        autoDiscover: true,
    },
    rewrite: {
        globalInputBudgetTokens: GLOBAL_INPUT_BUDGET_TOKENS,
        systemReserveTokens: SYSTEM_RESERVE_TOKENS,
        historyTargetTokens: DEFAULT_HISTORY_TARGET_TOKENS,
        historyFloorTokens: DEFAULT_HISTORY_FLOOR_TOKENS,
        liveContextMaxTokens: 5000,
        manualContextMaxTokens: 3500,
        skeletonShare: 0.10,
        skeletonMaxTokens: 500,
        maxDeepDiveNotes: 3,
        autoDiscover: false,
    },
};

export function estimateContextTokens(value: string): number {
    return Math.ceil(value.length / 2);
}

function compactWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function normalizeMode(mode: ContextBuildMode = 'auto'): ContextBuildMode {
    return MODE_CONFIGS[mode] ? mode : 'auto';
}

export function getContextBudgetConfig(
    mode: ContextBuildMode = 'auto',
    selectedNoteCount = 0
): ContextBudgetConfig {
    const base = MODE_CONFIGS[normalizeMode(mode)];
    return {
        ...base,
        directoryMaxTokens: selectedNoteCount <= 1 ? 200 : 1200,
        singleNoteDirectoryMaxTokens: 200,
    };
}

export function capTextToTokenBudget(value: string, tokenBudget: number, section = 'context'): { text: string; truncated: boolean } {
    if (!value || tokenBudget <= 0) {
        return { text: '', truncated: Boolean(value) };
    }

    if (estimateContextTokens(value) <= tokenBudget) {
        return { text: value.trim(), truncated: false };
    }

    const maxChars = Math.max(0, tokenBudget * CHARS_PER_TOKEN_ESTIMATE - TRUNCATION_MARKER.length - 3);
    if (maxChars <= 0) {
        return { text: `[${section} omitted to fit context budget]`, truncated: true };
    }

    return {
        text: `${truncateAtWord(value, maxChars)}${TRUNCATION_MARKER}`,
        truncated: true,
    };
}

function truncateAtWord(value: string, maxChars: number): string {
    const clean = compactWhitespace(value);
    if (clean.length <= maxChars) return clean;

    const sliced = clean.slice(0, maxChars);
    const lastSpace = sliced.lastIndexOf(' ');
    const trimmed = sliced.slice(0, lastSpace > maxChars * 0.7 ? lastSpace : maxChars).trim();
    return `${trimmed}...`;
}

function compactReasoningContext(reasoningContent: string, maxChars = 420): string {
    const lines = reasoningContent
        .split('\n')
        .map(line => line.replace(/^[-*\d.)\s]+/, '').trim())
        .filter(Boolean)
        .filter(line => !/^thinking process:?$/i.test(line));

    const signalLines = lines.filter(line =>
        /\b(user|request|scope|context|constraint|decided|selected|used|answer|result|topic|next|summary|note)\b/i.test(line)
    );

    const source = signalLines.length > 0 ? signalLines : lines;
    return truncateAtWord(source.slice(0, 4).join(' '), maxChars);
}

function buildProviderHistoryMessage(message: AiMessage): AiMessage {
    let cleanContent = message.content || '';
    const MAX_MESSAGE_CHARS = 4000; // Cap at 4,000 characters (~2,000 tokens) to prevent single-turn bloat

    if (cleanContent.length > MAX_MESSAGE_CHARS) {
        cleanContent = cleanContent.slice(0, MAX_MESSAGE_CHARS) + '\n\n[... message truncated due to length ...]';
    }

    if (message.role !== 'assistant') {
        return {
            ...message,
            content: cleanContent,
            reasoningContent: null,
            toolCalls: null,
        };
    }

    const processParts: string[] = [];
    const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : [];

    if (toolCalls.length) {
        processParts.push(`Tools used: ${toolCalls.join(', ')}`);
    }

    if (message.reasoningContent?.trim()) {
        const compactReasoning = compactReasoningContext(message.reasoningContent);
        if (compactReasoning) {
            processParts.push(`Process context: ${compactReasoning}`);
        }
    }

    return {
        ...message,
        content: processParts.length > 0
            ? `${cleanContent}\n\n[Previous assistant context: ${processParts.join('; ')}]`
            : cleanContent,
        reasoningContent: null,
        toolCalls: null,
    };
}

/**
 * Builds a sliding window for chat history based on a token budget.
 * Always keeps system markers (context shifts) regardless of the window.
 * Returns provider-ready messages: final answers plus compact process context,
 * without carrying raw reasoning/tool fields into the provider payload.
 */
export function buildHistoryWindow(messages: AiMessage[], tokenBudget = 3000): AiMessage[] {
    const conversational = messages
        .filter(m => m.role !== 'system')
        .map(buildProviderHistoryMessage);

    // Walk backwards, accumulate until budget exhausted
    const window: AiMessage[] = [];
    let tokens = 0;

    for (let i = conversational.length - 1; i >= 0; i--) {
        const estimated = estimateContextTokens(conversational[i].content); // safer estimate for multilingual support
        
        // Always include the latest message so we never send an empty window
        const isLatest = i === conversational.length - 1;
        if (!isLatest && tokens + estimated > tokenBudget) break;

        window.unshift(conversational[i]);
        tokens += estimated;
    }

    // Get the earliest message in our window, include system markers from that point on
    const windowStart = window[0]?.createdAt ?? new Date(0);
    const relevantSystem = messages
        .filter(m => m.role === 'system' && m.createdAt >= windowStart)
        .map(buildProviderHistoryMessage);

    // Merge and re-sort by timestamp to preserve true ordering
    return [...relevantSystem, ...window].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
}

function packContextBlocks(blocks: ContextBlock[], tokenBudget: number): { text: string; truncatedSections: string[]; selectedCount: number } {
    const selected: ContextBlock[] = [];
    const truncatedSections: string[] = [];
    let usedTokens = 0;

    const prioritized = [...blocks]
        .filter(block => block.text.trim().length > 0)
        .sort((a, b) => b.priority - a.priority || a.order - b.order);

    for (const block of prioritized) {
        const estimated = estimateContextTokens(block.text);
        const remaining = tokenBudget - usedTokens;
        if (remaining <= 0) {
            truncatedSections.push(block.section);
            continue;
        }

        if (estimated <= remaining) {
            selected.push(block);
            usedTokens += estimated;
            continue;
        }

        if (block.allowTruncate && remaining > 30) {
            const capped = capTextToTokenBudget(block.text, remaining, block.section);
            if (capped.text) {
                selected.push({ ...block, text: capped.text });
                usedTokens += estimateContextTokens(capped.text);
            }
            truncatedSections.push(block.section);
        } else {
            truncatedSections.push(block.section);
        }
    }

    return {
        text: selected
            .sort((a, b) => a.order - b.order)
            .map(block => block.text.trim())
            .filter(Boolean)
            .join('\n\n'),
        truncatedSections: Array.from(new Set(truncatedSections)),
        selectedCount: selected.length,
    };
}

function getQueryWords(query: string): string[] {
    return Array.from(new Set(
        query
            .toLowerCase()
            .split(/\W+/)
            .map(word => word.trim())
            .filter(word => word.length > 3)
    ));
}

function extractOutlineEntry(line: string): string | null {
    const clean = line.trim();
    if (clean.length < 3 || clean.length > 160) return null;

    const markdownHeading = clean.match(/^#{1,6}\s+(.+)$/);
    if (markdownHeading?.[1]) {
        return truncateAtWord(markdownHeading[1], 120);
    }

    const detailsHeading = clean.match(/^\[DETAILS:\s*(.+?)\]$/i);
    if (detailsHeading?.[1]) {
        return truncateAtWord(detailsHeading[1].replace(/^#{1,6}\s+/, ''), 120);
    }

    return null;
}

function extractHeadingMap(noteContent: string, maxLines = 12): string {
    const seen = new Set<string>();
    const headings: string[] = [];
    const lines = noteContent.split(/\n+/);

    for (const line of lines) {
        const heading = extractOutlineEntry(compactWhitespace(line));
        const key = heading?.toLowerCase();
        if (!heading || !key || seen.has(key)) continue;

        seen.add(key);
        headings.push(`- ${heading}`);
        if (headings.length >= maxLines) break;
    }

    return headings.length > 0 ? `[NOTE OUTLINE]\n${headings.join('\n')}` : '';
}

function buildAnchorSamples(noteContent: string, tokenBudget: number): string {
    if (tokenBudget <= 30 || !noteContent.trim()) return '';
    const maxChars = tokenBudget * CHARS_PER_TOKEN_ESTIMATE;
    const sampleChars = Math.max(120, Math.floor(maxChars / 3));
    const clean = compactWhitespace(noteContent);
    if (clean.length <= maxChars) return `[NOTE ANCHORS]\n${clean}`;

    const middleStart = Math.max(0, Math.floor(clean.length / 2) - Math.floor(sampleChars / 2));
    const samples = [
        `Start: ${truncateAtWord(clean.slice(0, sampleChars), sampleChars)}`,
        `Middle: ${truncateAtWord(clean.slice(middleStart, middleStart + sampleChars), sampleChars)}`,
        `End: ${truncateAtWord(clean.slice(-sampleChars), sampleChars)}`,
    ];

    return `[NOTE ANCHORS]\n${samples.join('\n')}`;
}

function buildHybridSkeleton(noteContent: string, budgetTokens: number): string {
    if (budgetTokens <= 0) return '';

    const headingMap = extractHeadingMap(noteContent);
    const blocks: ContextBlock[] = [];
    let order = 0;

    if (headingMap) {
        blocks.push({
            text: headingMap,
            priority: 62,
            order: order++,
            section: 'note-outline',
            allowTruncate: true,
        });
    }

    const headingCount = headingMap ? headingMap.split('\n').length - 1 : 0;
    if (headingCount < 4) {
        blocks.push({
            text: buildAnchorSamples(noteContent, Math.max(60, Math.floor(budgetTokens * 0.55))),
            priority: headingMap ? 70 : 85,
            order: order++,
            section: 'note-anchors',
            allowTruncate: true,
        });
    }

    return packContextBlocks(blocks, budgetTokens).text;
}

/**
 * Extracts relevant chunks from a note based on keyword overlap with the query.
 * Best for specific questions.
 */
export function extractRelevantChunks(
    noteContent: string,
    query: string,
    budget = 8000,
    mode: ContextBuildMode = 'auto',
    includeSkeleton = true
): string {
    const CHUNK_SIZE = 700;
    const chunks: { text: string; index: number }[] = [];

    for (let i = 0; i < noteContent.length; i += CHUNK_SIZE) {
        chunks.push({ text: noteContent.slice(i, i + CHUNK_SIZE), index: i / CHUNK_SIZE });
    }

    const queryWords = new Set(getQueryWords(query));

    const scored = chunks.map(c => ({
        ...c,
        score: [...queryWords].filter(w => c.text.toLowerCase().includes(w)).length
    }));

    const sortedByScore = [...scored]
        .filter(c => c.score > 0)
        .sort((a, b) => b.score - a.score);

    const selectedIndices = new Set<number>();
    const maxBudgetTokens = budget;
    const blocks: ContextBlock[] = [];
    let order = 0;
    const config = getContextBudgetConfig(mode);
    const skeletonTokens = Math.min(
        config.skeletonMaxTokens,
        Math.floor(maxBudgetTokens * config.skeletonShare)
    );

    const skeleton = includeSkeleton ? buildHybridSkeleton(noteContent, skeletonTokens) : '';
    if (skeleton) {
        blocks.push({
            text: skeleton,
            priority: mode === 'summary' ? 95 : 72,
            order: order++,
            section: 'skeleton',
            allowTruncate: true,
        });
    }

    for (const chunk of sortedByScore) {
        const group = mode === 'summary'
            ? [chunk.index]
            : [chunk.index - 1, chunk.index, chunk.index + 1];

        for (const idx of group.filter(i => i >= 0 && i < chunks.length)) {
            if (selectedIndices.has(idx)) continue;
            selectedIndices.add(idx);
            blocks.push({
                text: chunks[idx].text,
                priority: idx === chunk.index ? 92 + chunk.score : 68 + chunk.score,
                order: order++,
                section: idx === chunk.index ? 'matched-chunk' : 'neighbor-chunk',
                allowTruncate: true,
            });
        }
    }

    if (mode === 'full' && chunks.length > 0) {
        const anchorIndices = [0, Math.floor(chunks.length / 2), chunks.length - 1];
        for (const idx of anchorIndices) {
            if (idx < 0 || selectedIndices.has(idx)) continue;
            selectedIndices.add(idx);
            blocks.push({
                text: chunks[idx].text,
                priority: 55,
                order: order++,
                section: 'full-anchor-chunk',
                allowTruncate: true,
            });
        }
    }

    return packContextBlocks(blocks, maxBudgetTokens).text;
}

/**
 * Proportionally samples from beginning, middle, and end of a document.
 * Best for summaries/overviews.
 */
export function structuredSample(noteContent: string, budget = 10000): string {
    if (estimateContextTokens(noteContent) <= budget) return noteContent;

    const charBudget = budget * CHARS_PER_TOKEN_ESTIMATE;
    const third = Math.floor(charBudget / 3);
    const midStart = Math.floor(noteContent.length / 2) - Math.floor(third / 2);

    return [
        noteContent.slice(0, third),
        '\n\n[...]\n\n',
        noteContent.slice(midStart, midStart + third),
        '\n\n[...]\n\n',
        noteContent.slice(-third),
    ].join('');
}

const SUMMARY_TRIGGERS = /\b(summarize|summary|overview|tldr|what is this|what('s| is) (this|the (note|document))|key points|main points)\b/i;

/**
 * Detects intent and routes to the appropriate trimming strategy.
 */
export function prepareNoteContext(
    noteContent: string,
    query: string,
    budget = 12000,
    mode: ContextBuildMode = 'auto'
): string {
    // If the entire note fits within the budget, return it completely intact
    if (estimateContextTokens(noteContent) <= budget) return noteContent;

    const config = getContextBudgetConfig(mode);
    const skeletonBudget = Math.min(config.skeletonMaxTokens, Math.floor(budget * config.skeletonShare));
    const contentBudget = Math.max(0, budget - skeletonBudget);
    const blocks: ContextBlock[] = [];
    let order = 0;

    const skeleton = buildHybridSkeleton(noteContent, skeletonBudget);
    if (skeleton) {
        blocks.push({
            text: skeleton,
            priority: mode === 'summary' ? 80 : 58,
            order: order++,
            section: 'note-skeleton',
            allowTruncate: true,
        });
    }

    if (SUMMARY_TRIGGERS.test(query)) {
        blocks.push({
            text: structuredSample(noteContent, contentBudget),
            priority: 82,
            order: order++,
            section: 'summary-sample',
            allowTruncate: true,
        });
    } else {
        blocks.push({
            text: extractRelevantChunks(noteContent, query, contentBudget, mode, false),
            priority: 88,
            order: order++,
            section: 'relevant-chunks',
            allowTruncate: true,
        });
    }

    return packContextBlocks(blocks, budget).text;
}

/**
 * Purifies note HTML for AI consumption.
 * Trims boilerplate, converts complex nodes (math, code, tables, lists) to 
 * clear text/markdown representations.
 */
export function purifyNoteHtml(html: string): string {
    if (!html) return '';

    // If we're in a browser environment with DOMParser, use it for high-fidelity conversion
    if (typeof DOMParser !== 'undefined') {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // 1. Headings
            doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
                const level = Number(el.tagName.slice(1)) || 2;
                const headingText = (el.textContent || '').trim();
                if (!headingText) return;

                const textNode = doc.createTextNode(`\n${'#'.repeat(level)} ${headingText}\n`);
                el.parentNode?.replaceChild(textNode, el);
            });

            // 2. Math
            doc.querySelectorAll('[data-latex]').forEach(el => {
                const latex = el.getAttribute('data-latex');
                if (latex) {
                    const isBlock = el.getAttribute('data-type') === 'blockMath';
                    el.textContent = isBlock ? `\n$$\n${latex}\n$$\n` : ` $${latex}$ `;
                }
            });

            // 3. Code
            doc.querySelectorAll('pre code').forEach(el => {
                const lang = el.className.replace('language-', '') || 'text';
                el.textContent = `\n\`\`\`${lang}\n${el.textContent}\n\`\`\`\n`;
            });

            // 4. Tables - Convert to Markdown representation
            doc.querySelectorAll('table').forEach(table => {
                let tableMd = '\n\n';
                const rows = Array.from(table.querySelectorAll('tr'));
                if (rows.length === 0) return;

                rows.forEach((row, i) => {
                    const cells = Array.from(row.querySelectorAll('td, th'));
                    const cellTexts = cells.map(c => (c.textContent || '').trim().replace(/\|/g, '\\|'));
                    tableMd += '| ' + cellTexts.join(' | ') + ' |\n';

                    if (i === 0) {
                        tableMd += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
                    }
                });

                const textNode = doc.createTextNode(tableMd + '\n');
                table.parentNode?.replaceChild(textNode, table);
            });

            // 5. Mermaid Diagrams
            doc.querySelectorAll('div[data-type="mermaid"]').forEach(el => {
                const code = el.getAttribute('code');
                if (code) {
                    const textNode = doc.createTextNode(`\n\`\`\`mermaid\n${code}\n\`\`\`\n`);
                    el.parentNode?.replaceChild(textNode, el);
                }
            });

            // 6. Lists (Preserve structure)
            doc.querySelectorAll('ul').forEach(ul => {
                const items = Array.from(ul.querySelectorAll(':scope > li'));
                const listText = '\n' + items.map(li => `- ${li.textContent?.trim()}`).join('\n') + '\n';
                const textNode = doc.createTextNode(listText);
                ul.parentNode?.replaceChild(textNode, ul);
            });

            doc.querySelectorAll('ol').forEach(ol => {
                const items = Array.from(ol.querySelectorAll(':scope > li'));
                const listText = '\n' + items.map((li, idx) => `${idx + 1}. ${li.textContent?.trim()}`).join('\n') + '\n';
                const textNode = doc.createTextNode(listText);
                ol.parentNode?.replaceChild(textNode, ol);
            });

            // 7. Flashcards
            doc.querySelectorAll('[data-fc]').forEach(fc => {
                const title = fc.getAttribute('data-t') || 'Flashcards';
                const cardsRaw = fc.getAttribute('data-c');
                let cardsText = `### ${title}\n`;
                if (cardsRaw) {
                    try {
                        const cards = JSON.parse(cardsRaw) as Array<{ front?: unknown; back?: unknown } | [unknown, unknown]>;
                        cards.forEach((card) => {
                            const front = Array.isArray(card) ? card[0] : card.front;
                            const back = Array.isArray(card) ? card[1] : card.back;
                            cardsText += `- Q: ${String(front ?? '')}\n  A: ${String(back ?? '')}\n`;
                        });
                    } catch {
                        cardsText += fc.textContent || '';
                    }
                } else {
                    cardsText += fc.textContent || '';
                }
                const textNode = doc.createTextNode('\n' + cardsText + '\n');
                fc.parentNode?.replaceChild(textNode, fc);
            });

            // 8. Details (Collapsible blocks)
            const detailsNodes = Array.from(doc.querySelectorAll('div[data-type="details"], div.details-wrapper, details')).reverse();
            detailsNodes.forEach(details => {
                const summaryEl = details.querySelector('div[data-type="detailsSummary"], div.details-summary, summary');
                const contentEl = details.querySelector('div[data-type="detailsContent"], div.details-content');

                const summaryText = summaryEl?.textContent?.trim() || 'Details';
                const contentText = contentEl?.textContent?.trim() || '';

                const detailsText = `\n[DETAILS: ${summaryText}]\n${contentText}\n[END DETAILS]\n`;
                const textNode = doc.createTextNode(detailsText);
                details.parentNode?.replaceChild(textNode, details);
            });

            return doc.body.textContent || '';
        } catch (e) {
            console.error('[purifyNoteHtml] DOMParser Error:', e);
            // Fallback to regex-based stripping
        }
    }

    // Fallback: Use regex-based stripping for environments without DOMParser (like React Native)
    // We can still do some basic structural preservation with regex if we want, 
    // but stripHtml handles the basics well.
    return stripHtml(html);
}

/**
 * Intelligently builds context for a folder or bulk note selection.
 * Scores metadata against the query, fetches the top content, and trims it.
 */
export async function buildBulkContext(
    query: string,
    selectedNotes: NoteContextMetadata[],
    fetchNoteContent: (noteId: string) => Promise<string>,
    findFtsWinners: (query: string, noteIds: string[]) => Promise<string[]>,
    totalBudget = 6500,
    mode: ContextBuildMode = 'auto'
): Promise<BulkContextResult> {
    const config = getContextBudgetConfig(mode, selectedNotes.length);
    const directoryBudget = selectedNotes.length === 1
        ? config.singleNoteDirectoryMaxTokens
        : Math.min(config.directoryMaxTokens, Math.floor(totalBudget * 0.22));
    const deepDiveBudget = Math.max(0, totalBudget - directoryBudget);
    const truncatedSections: string[] = [];

    const folderNoteIds = selectedNotes.map(n => n.id);

    // 1. Let SQLite FTS5 do the actual scoring against the deep content!
    const winnerIds = await findFtsWinners(query, folderNoteIds);

    // 2. Map the winning IDs back to their metadata
    let deepDiveTargets = winnerIds
        .map(id => selectedNotes.find(n => n.id === id))
        .filter((note): note is NoteContextMetadata => Boolean(note))
        .slice(0, config.maxDeepDiveNotes);

    console.log('[RAG] FTS Deep Dive Winners:', deepDiveTargets.map(n => n.title));

    // Fallback: If the user just says "Summarize this folder" and FTS finds no specific keywords, 
    // grab the 3 most recently updated notes.
    if (deepDiveTargets.length === 0) {
        deepDiveTargets = [...selectedNotes]
            .sort((a, b) => {
                const dateA = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt || 0);
                const dateB = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt || 0);
                return dateB.getTime() - dateA.getTime();
            })
            .slice(0, config.maxDeepDiveNotes);
    } else if (mode === 'full' && deepDiveTargets.length < config.maxDeepDiveNotes) {
        const existingIds = new Set(deepDiveTargets.map(note => note.id));
        const additional = [...selectedNotes]
            .filter(note => !existingIds.has(note.id))
            .sort((a, b) => {
                const dateA = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt || 0);
                const dateB = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt || 0);
                return dateB.getTime() - dateA.getTime();
            })
            .slice(0, config.maxDeepDiveNotes - deepDiveTargets.length);
        deepDiveTargets = [...deepDiveTargets, ...additional];
    }

    // 3. Build the Directory (Lightweight context of EVERYTHING in the folder)
    let directoryText = `[FOLDER DIRECTORY]\n`;
    let includedDirectoryItems = 0;
    for (const note of selectedNotes) {
        const preview = note.preview ? truncateAtWord(note.preview, 120) : 'No preview';
        const tags = note.tags || 'none';
        const entry = `- "${note.title || 'Untitled'}" (Tags: ${tags}) | Preview: ${preview}\n`;
        if (estimateContextTokens(directoryText + entry) > directoryBudget) {
            const remaining = selectedNotes.length - includedDirectoryItems;
            if (remaining > 0) {
                directoryText += `- ... and ${remaining} more notes.\n`;
            }
            truncatedSections.push('directory');
            break;
        }
        directoryText += entry;
        includedDirectoryItems += 1;
    }

    // 4. Fetch and Trim Content for the Deep Dive targets
    let deepDiveText = `\n[DEEP DIVE: RELEVANT NOTE CONTENTS]\n`;

    const weightsMap: Record<number, number[]> = {
        1: [1.0],
        2: [0.7, 0.3],
        3: [0.6, 0.25, 0.15],
        4: [0.45, 0.25, 0.18, 0.12],
        5: [0.4, 0.22, 0.16, 0.12, 0.1],
    };
    const weights = weightsMap[deepDiveTargets.length] || [1.0 / (deepDiveTargets.length || 1)];
    let chunkCount = 0;
    let skeletonCount = 0;

    for (let i = 0; i < deepDiveTargets.length; i++) {
        const note = deepDiveTargets[i];
        if (!note) continue;

        const weight = weights[i] ?? (1.0 / (deepDiveTargets.length || 1));
        const budgetPerNote = Math.floor(deepDiveBudget * weight);

        const rawContent = await fetchNoteContent(note.id);
        const processedContent = prepareNoteContext(rawContent, query, budgetPerNote, mode);
        chunkCount += processedContent.includes('[...]') || processedContent.includes('[NOTE ANCHORS]') ? 1 : 0;
        skeletonCount += processedContent.includes('[NOTE OUTLINE]') || processedContent.includes('[NOTE ANCHORS]') ? 1 : 0;

        deepDiveText += `\n--- Note: ${note.title || 'Untitled'} ---\n${processedContent}\n`;
    }

    const packed = packContextBlocks([
        { text: directoryText, priority: 100, order: 0, section: 'directory', allowTruncate: true },
        { text: deepDiveText, priority: 90, order: 1, section: 'deep-dive', allowTruncate: true },
    ], totalBudget);

    const text = packed.text;
    truncatedSections.push(...packed.truncatedSections);

    return {
        text,
        metrics: {
            estimatedTokens: estimateContextTokens(text),
            truncatedSections: Array.from(new Set(truncatedSections)),
            selectedNoteIds: deepDiveTargets.map(note => note.id),
            chunkCount: Math.max(chunkCount, packed.selectedCount > 0 ? deepDiveTargets.length : 0),
            skeletonCount,
            directoryTokens: estimateContextTokens(directoryText),
            deepDiveTokens: estimateContextTokens(deepDiveText),
        },
    };
}
