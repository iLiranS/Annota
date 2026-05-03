import { AiMessage } from '../db/schema';
import { stripHtml } from '../utils/html';

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

    // If we're in a browser environment with DOMParser, use it for high-fidelity conversion
    if (typeof DOMParser !== 'undefined') {
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

            // 4. Mermaid Diagrams
            doc.querySelectorAll('div[data-type="mermaid"]').forEach(el => {
                const code = el.getAttribute('code');
                if (code) {
                    const textNode = doc.createTextNode(`\n\`\`\`mermaid\n${code}\n\`\`\`\n`);
                    el.parentNode?.replaceChild(textNode, el);
                }
            });

            // 5. Lists (Preserve structure)
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

            // 6. Flashcards
            doc.querySelectorAll('[data-fc]').forEach(fc => {
                const title = fc.getAttribute('data-t') || 'Flashcards';
                const cardsRaw = fc.getAttribute('data-c');
                let cardsText = `### ${title}\n`;
                if (cardsRaw) {
                    try {
                        const cards = JSON.parse(cardsRaw);
                        cards.forEach((card: any) => {
                            const front = Array.isArray(card) ? card[0] : card.front;
                            const back = Array.isArray(card) ? card[1] : card.back;
                            cardsText += `- Q: ${front}\n  A: ${back}\n`;
                        });
                    } catch (e) {
                        cardsText += fc.textContent || '';
                    }
                } else {
                    cardsText += fc.textContent || '';
                }
                const textNode = doc.createTextNode('\n' + cardsText + '\n');
                fc.parentNode?.replaceChild(textNode, fc);
            });

            // 7. Details (Collapsible blocks)
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
    selectedNotes: any[], // Your NoteMetadata type
    fetchNoteContent: (noteId: string) => Promise<string>,
    findFtsWinners: (query: string, noteIds: string[]) => Promise<string[]>,
    totalBudget = 15000
): Promise<string> {
    const DIRECTORY_BUDGET = 3000;
    const DEEP_DIVE_BUDGET = totalBudget - DIRECTORY_BUDGET;

    const folderNoteIds = selectedNotes.map(n => n.id);

    // 1. Let SQLite FTS5 do the actual scoring against the deep content!
    const winnerIds = await findFtsWinners(query, folderNoteIds);

    // 2. Map the winning IDs back to their metadata
    let deepDiveTargets = winnerIds
        .map(id => selectedNotes.find(n => n.id === id))
        .filter(Boolean);

    console.log('[RAG] FTS Deep Dive Winners:', deepDiveTargets.map(n => n?.title));

    // Fallback: If the user just says "Summarize this folder" and FTS finds no specific keywords, 
    // grab the 3 most recently updated notes.
    if (deepDiveTargets.length === 0) {
        deepDiveTargets = [...selectedNotes]
            .sort((a, b) => {
                const dateA = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt);
                const dateB = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt);
                return dateB.getTime() - dateA.getTime();
            })
            .slice(0, 3);
    }

    // 3. Build the Directory (Lightweight context of EVERYTHING in the folder)
    let directoryText = `[FOLDER DIRECTORY]\n`;
    for (const note of selectedNotes) {
        const entry = `- "${note.title}" (Tags: ${note.tags}) | Preview: ${note.preview?.slice(0, 100)}...\n`;
        if ((directoryText + entry).length > DIRECTORY_BUDGET) {
            directoryText += `- ... and ${selectedNotes.length - directoryText.split('\n').length} more notes.\n`;
            break;
        }
        directoryText += entry;
    }

    // 4. Fetch and Trim Content for the Deep Dive targets
    let deepDiveText = `\n[DEEP DIVE: RELEVANT NOTE CONTENTS]\n`;
    const budgetPerNote = Math.floor(DEEP_DIVE_BUDGET / (deepDiveTargets.length || 1));

    for (const note of deepDiveTargets) {
        if (!note) continue;
        const rawContent = await fetchNoteContent(note.id);
        const processedContent = prepareNoteContext(rawContent, query);

        // Ensure we don't blow the per-note budget
        const finalChunk = processedContent.length > budgetPerNote
            ? structuredSample(processedContent, budgetPerNote)
            : processedContent;

        deepDiveText += `\n--- Note: ${note.title} ---\n${finalChunk}\n`;
    }

    return directoryText + deepDiveText;
}
