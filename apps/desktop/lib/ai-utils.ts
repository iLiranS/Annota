import { AiMessage } from '@annota/core';

/**
 * Builds a sliding window for chat history based on a token budget.
 * Always keeps system markers (context shifts) regardless of the window.
 */
export function buildHistoryWindow(messages: AiMessage[], tokenBudget = 3000): AiMessage[] {
    const conversational = messages.filter(m => m.role !== 'system');

    // Walk backwards, accumulate until budget exhausted
    const window: AiMessage[] = [];
    let tokens = 0;

    for (let i = conversational.length - 1; i >= 0; i--) {
        const estimated = Math.ceil(conversational[i].content.length / 2); // safer estimate for multilingual support
        if (tokens + estimated > tokenBudget) break;
        window.unshift(conversational[i]);
        tokens += estimated;
    }

    // Get the earliest message in our window, include system markers from that point on
    const windowStart = window[0]?.createdAt ?? new Date(0);
    const relevantSystem = messages.filter(
        m => m.role === 'system' && m.createdAt >= windowStart
    );

    // Merge and re-sort by timestamp to preserve true ordering
    return [...relevantSystem, ...window].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
}

/**
 * Extracts relevant chunks from a note based on keyword overlap with the query.
 * Best for specific questions.
 */
export function extractRelevantChunks(noteContent: string, query: string, budget = 8000): string {
    const CHUNK_SIZE = 500;
    const chunks: { text: string; index: number }[] = [];
    
    for (let i = 0; i < noteContent.length; i += CHUNK_SIZE) {
        chunks.push({ text: noteContent.slice(i, i + CHUNK_SIZE), index: i / CHUNK_SIZE });
    }

    const queryWords = new Set(query.toLowerCase().split(/\W+/).filter(w => w.length > 3));

    const scored = chunks.map(c => ({
        ...c,
        score: [...queryWords].filter(w => c.text.toLowerCase().includes(w)).length
    }));

    const hasMatches = scored.some(c => c.score > 0);
    if (!hasMatches) {
        return structuredSample(noteContent, budget);
    }

    // Take top chunks + their neighbors for coherence
    const topIndices = new Set(
        [...scored]
            .sort((a, b) => b.score - a.score)
            .slice(0, 6)
            .flatMap(c => [c.index - 1, c.index, c.index + 1])
            .filter(i => i >= 0 && i < chunks.length)
    );

    const selected = chunks
        .filter(c => topIndices.has(c.index))
        .sort((a, b) => a.index - b.index);

    // Re-join, respecting budget
    let result = '';
    for (const chunk of selected) {
        if ((result + chunk.text).length > budget) break;
        result += (result ? '\n\n' : '') + chunk.text;
    }
    return result;
}

/**
 * Proportionally samples from beginning, middle, and end of a document.
 * Best for summaries/overviews.
 */
export function structuredSample(noteContent: string, budget = 10000): string {
    if (noteContent.length <= budget) return noteContent;

    const third = Math.floor(budget / 3);
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
export function prepareNoteContext(noteContent: string, query: string): string {
    // If small enough, send all
    if (noteContent.length < 15000) return noteContent;

    if (SUMMARY_TRIGGERS.test(query)) {
        return structuredSample(noteContent, 12000);
    }

    return extractRelevantChunks(noteContent, query, 8000);
}

/**
 * Purifies note HTML for AI consumption.
 * Trims boilerplate, converts complex nodes (math, code, tables, lists) to 
 * clear text/markdown representations.
 */
export function purifyNoteHtml(html: string): string {
    if (!html) return '';
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 1. Math
        doc.querySelectorAll('[data-latex]').forEach(el => {
            const latex = el.getAttribute('data-latex');
            if (latex) {
                const isBlock = el.getAttribute('data-type') === 'blockMath';
                el.textContent = isBlock ? `\n$$\n${latex}\n$$\n` : ` $${latex}$ `;
            }
        });

        // 2. Code
        doc.querySelectorAll('pre code').forEach(el => {
            const lang = el.className.replace('language-', '') || 'text';
            el.textContent = `\n\`\`\`${lang}\n${el.textContent}\n\`\`\`\n`;
        });

        // 3. Tables - Convert to Markdown representation
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

        // 4. Lists (Preserve structure)
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

        return doc.body.textContent || '';
    } catch (e) {
        console.error('[purifyNoteHtml] Error:', e);
        return html.replace(/<[^>]*>/g, '');
    }
}
