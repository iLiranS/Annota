/// <reference path="./turndown-plugin-gfm.d.ts" />
import type TurndownService from 'turndown';
import { SHORT_TO_HEX } from '../extensions/marks';
import { ensureDOMPolyfill } from './domPolyfill';

const SHORT_TO_RGBA: Record<string, string> = {
    yw: 'rgba(255, 224, 102, 0.3)',
    or: 'rgba(255, 169, 77, 0.3)',
    re: 'rgba(255, 107, 107, 0.3)',
    pi: 'rgba(247, 131, 172, 0.3)',
    in: 'rgba(129, 140, 248, 0.3)',
    bl: 'rgba(116, 192, 252, 0.3)',
    te: 'rgba(32, 201, 151, 0.3)',
    gr: 'rgba(81, 207, 102, 0.3)',
    gy: 'rgba(114, 114, 114, 0.3)',
    br: 'rgba(160, 120, 85, 0.3)',
};

let turndownServiceInstance: TurndownService | null = null;
let initPromise: Promise<void> | null = null;

async function ensureTurndown(): Promise<TurndownService | null> {
    if (turndownServiceInstance) return turndownServiceInstance;
    if (initPromise) {
        await initPromise;
        return turndownServiceInstance;
    }

    initPromise = (async () => {
        await ensureDOMPolyfill();

        const activeDoc = typeof document !== 'undefined';
        if (!activeDoc) return;

        try {
            // Lazy load turndown and its plugins to save startup cost and support environment isolation
            const TurndownCtor = (await import('turndown')).default;
            const { gfm } = await import('turndown-plugin-gfm');

            turndownServiceInstance = new TurndownCtor({
                headingStyle: 'atx',
                codeBlockStyle: 'fenced',
                emDelimiter: '_',
                strongDelimiter: '**',
            });
            turndownServiceInstance.use(gfm);
            setupCustomRules(turndownServiceInstance);
        } catch (err) {
            console.error('ExportService: Failed to initialize TurndownService', err);
        }
    })();

    await initPromise;
    return turndownServiceInstance;
}

export async function convertToMarkdown(rawHtml: string): Promise<string> {
    const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
    if (isReactNative) {
        return regexHtmlToMarkdown(rawHtml);
    }
    const td = await ensureTurndown();
    if (!td) {
        return regexHtmlToMarkdown(rawHtml);
    }

    // Inject placeholder content inside empty math/mermaid divs and spans so Turndown doesn't consider them blank
    let processedHtml = rawHtml;
    processedHtml = processedHtml.replace(/(<div[^>]*data-type="(?:block-math|blockMath|mathBlock|mermaid)"[^>]*>)\s*(<\/div>)/gis, '$1_math_placeholder_$2');
    processedHtml = processedHtml.replace(/(<div[^>]*data-(?:latex|formula)="[^"]*"[^>]*>)\s*(<\/div>)/gis, '$1_math_placeholder_$2');
    
    processedHtml = processedHtml.replace(/(<span[^>]*data-type="(?:inline-math|inlineMath)"[^>]*>)\s*(<\/span>)/gis, '$1_math_placeholder_$2');
    processedHtml = processedHtml.replace(/(<span[^>]*data-(?:latex|formula)="[^"]*"[^>]*>)\s*(<\/span>)/gis, '$1_math_placeholder_$2');

    return td.turndown(processedHtml);
}

// ─── Pure JS Fallback for Mobile ──────────────────────────────────────────
export function regexHtmlToMarkdown(html: string): string {
    let md = html;

    // 1. Custom Annota Extensions
    md = md.replace(/<div[^>]*data-type="mermaid"[^>]*code="([^"]*)"[^>]*>.*?<\/div>/gis, '\n\n```mermaid\n$1\n```\n\n');

    // Math Blocks & Inline Math
    md = md.replace(/<(div|span)[^>]*data-(?:latex|formula)="([^"]*)"[^>]*>.*?<\/\1>/gis, (match, tag, latex) => {
        const isBlock = tag.toLowerCase() === 'div' || match.includes('block-math') || match.includes('blockMath') || match.includes('mathBlock') || match.includes('data-display="true"');
        const decoded = latex.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        if (isBlock) {
            return `\n\n$$\n${decoded.trim()}\n$$\n\n`;
        } else {
            return `$${decoded.trim()}$`;
        }
    });
    md = md.replace(/<div[^>]*data-type="details"[^>]*>(.*?)<\/div>/gis, '\n<details>\n$1\n</details>\n');
    md = md.replace(/<div[^>]*data-type="detailsSummary"[^>]*>(.*?)<\/div>/gis, '<summary>$1</summary>\n');
    md = md.replace(/<div[^>]*data-type="detailsContent"[^>]*>(.*?)<\/div>/gis, '$1\n');
    md = md.replace(/<li[^>]*data-checked="true"[^>]*>(.*?)<\/li>/gis, '- [x] $1\n');
    md = md.replace(/<li[^>]*data-checked="false"[^>]*>(.*?)<\/li>/gis, '- [ ] $1\n');
    md = md.replace(/<mark[^>]*>(.*?)<\/mark>/gis, '==$1==');

    // 1b. Flashcard block conversion
    md = md.replace(/<div[^>]*data-type="flashcardBlock"[^>]*data-title="([^"]*)"[^>]*data-c="([^"]*)"[^>]*>.*?<\/div>/gis, (_, title, cardsJsonEscaped) => {
        const titleDecoded = title.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        let cardsJson = cardsJsonEscaped;
        // Unescape JSON HTML attribute characters
        cardsJson = cardsJson.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        try {
            const cards = JSON.parse(cardsJson);
            let tableMd = `\n\n### ${titleDecoded}\n\n| Questions | Answers |\n| --- | --- |\n`;
            cards.forEach(([front, back]: [any, any]) => {
                const q = String(front).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
                const a = String(back).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
                tableMd += `| ${q} | ${a} |\n`;
            });
            return tableMd + '\n';
        } catch (e) {
            return `\n\n### ${titleDecoded}\n\n`;
        }
    });

    // 1c. Table conversion (editor tables have no <thead>/<th>, just <tbody> with <td>)
    md = md.replace(/<table[^>]*>\s*<tbody>(.*?)<\/tbody>\s*<\/table>/gis, (_, tbodyContent) => {
        const rowMatches = [...tbodyContent.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis)];
        if (rowMatches.length === 0) return '';

        const parseRow = (rowHtml: string): string[] => {
            const cells = [...rowHtml.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis)];
            return cells.map(m => {
                // Strip inner tags (like <p>) and clean up whitespace
                let text = m[1].replace(/<[^>]+>/g, '').trim();
                text = text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
                return text;
            });
        };

        const rows = rowMatches.map(m => parseRow(m[1]));
        const colCount = Math.max(...rows.map(r => r.length));

        // Pad rows to have equal columns
        const padded = rows.map(r => {
            while (r.length < colCount) r.push('');
            return r;
        });

        // First row as header
        const header = padded[0];
        const separator = header.map(() => '---');
        const dataRows = padded.slice(1);

        let table = '\n\n';
        table += '| ' + header.join(' | ') + ' |\n';
        table += '| ' + separator.join(' | ') + ' |\n';
        for (const row of dataRows) {
            table += '| ' + row.join(' | ') + ' |\n';
        }
        return table + '\n';
    });

    // 2. Standard HTML Tags
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gis, '# $1\n\n');
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gis, '## $1\n\n');
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gis, '### $1\n\n');
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n');
    md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gis, '**$1**');
    md = md.replace(/<em[^>]*>(.*?)<\/em>/gis, '_$1_');
    md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '\n\n```\n$1\n```\n\n');
    md = md.replace(/<code[^>]*>(.*?)<\/code>/gis, '`$1`');
    md = md.replace(/<br\s*\/?>/gis, '\n');

    // 3. Cleanup
    md = md.replace(/<[^>]+>/g, ''); // Strip remaining tags
    md = md.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');

    return md.trim();
}

function setupCustomRules(td: TurndownService) {
    td.addRule('blockMath', {
        filter: (node) => {
            const dataType = node.getAttribute('data-type');
            const isBlockType = dataType === 'block-math' || dataType === 'blockMath' || dataType === 'mathBlock';
            const hasLatex = node.hasAttribute('data-latex') || node.hasAttribute('data-formula');
            const isDivWithLatex = node.nodeName.toUpperCase() === 'DIV' && hasLatex;
            const isDisplayTrue = node.getAttribute('data-display') === 'true';
            return isBlockType || isDivWithLatex || (hasLatex && isDisplayTrue);
        },
        replacement: (_, node) => {
            const latex =
                (node as HTMLElement).getAttribute('data-latex') ||
                (node as HTMLElement).getAttribute('data-formula') ||
                node.textContent ||
                '';
            return `\n\n$$\n${latex.trim()}\n$$\n\n`;
        },
    });

    td.addRule('inlineMath', {
        filter: (node) => {
            const dataType = node.getAttribute('data-type');
            const isInlineType = dataType === 'inline-math' || dataType === 'inlineMath';
            const hasLatex = node.hasAttribute('data-latex') || node.hasAttribute('data-formula');
            const isSpanWithLatex = node.nodeName.toUpperCase() === 'SPAN' && hasLatex;
            const isDisplayTrue = node.getAttribute('data-display') === 'true';
            const isBlockType = dataType === 'block-math' || dataType === 'blockMath' || dataType === 'mathBlock';
            if (isBlockType || isDisplayTrue) return false;
            
            return isInlineType || isSpanWithLatex || hasLatex;
        },
        replacement: (_, node) => {
            const latex =
                (node as HTMLElement).getAttribute('data-latex') ||
                (node as HTMLElement).getAttribute('data-formula') ||
                node.textContent ||
                '';
            return `$${latex.trim()}$`;
        },
    });

    td.addRule('mermaid', {
        filter: (node) =>
            node.nodeName === 'DIV' &&
            (node.getAttribute('data-type') === 'mermaid' ||
                node.classList.contains('mermaid-block')),
        replacement: (_, node) => {
            const code =
                (node as HTMLElement).getAttribute('code') ??
                (node as HTMLElement).querySelector('.mermaid-textarea')?.textContent ??
                '';
            return `\n\n\`\`\`mermaid\n${code}\n\`\`\`\n\n`;
        },
    });

    td.addRule('flashcardBlock', {
        filter: (node) =>
            node.nodeName === 'DIV' && node.getAttribute('data-type') === 'flashcardBlock',
        replacement: (_, node) => {
            const title = node.getAttribute('data-title') || 'Flashcards';
            const cardsData = node.getAttribute('data-c');
            try {
                const cards = JSON.parse(cardsData || '[]');
                let tableMd = `\n\n### ${title}\n\n| Questions | Answers |\n| --- | --- |\n`;
                cards.forEach(([front, back]: [any, any]) => {
                    const q = String(front).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
                    const a = String(back).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
                    tableMd += `| ${q} | ${a} |\n`;
                });
                return tableMd + '\n';
            } catch {
                return `\n\n### ${title}\n\n`;
            }
        },
    });

    td.addRule('details', {
        filter: (node) =>
            node.nodeName === 'DIV' && node.getAttribute('data-type') === 'details',
        replacement: (content) => `\n\n<details>\n${content}\n</details>\n\n`,
    });

    td.addRule('detailsSummary', {
        filter: (node) =>
            node.nodeName === 'DIV' && node.getAttribute('data-type') === 'detailsSummary',
        replacement: (content) => `<summary>${content.trim()}</summary>\n`,
    });

    td.addRule('detailsContent', {
        filter: (node) =>
            node.nodeName === 'DIV' && node.getAttribute('data-type') === 'detailsContent',
        replacement: (content) => `\n${content}\n`,
    });

    td.addRule('taskItem', {
        filter: (node) =>
            node.nodeName === 'LI' &&
            (node.hasAttribute('data-checked') || node.classList.contains('task-list-item')),
        replacement: (content, node) => {
            const checked =
                (node as HTMLElement).getAttribute('data-checked') === 'true' ||
                !!(node as HTMLElement).querySelector('input[type="checkbox"][checked]');
            return `- ${checked ? '[x]' : '[ ]'} ${content.trim()}\n`;
        },
    });

    td.addRule('highlight', {
        filter: (node) =>
            node.nodeName === 'MARK' ||
            (node.nodeName === 'SPAN' && (
                Array.from((node as HTMLElement).classList || []).some(c => c.startsWith('hl-')) ||
                !!(node as HTMLElement).style?.backgroundColor
            )),
        replacement: (content, node) => {
            const el = node as HTMLElement;
            
            let hlClass = '';
            if (el.classList) {
                for (const cls of Array.from(el.classList)) {
                    if (cls.startsWith('hl-')) {
                        hlClass = cls;
                        break;
                    }
                }
            }
            
            if (hlClass) {
                const short = hlClass.slice(3);
                const rgba = SHORT_TO_RGBA[short];
                if (rgba) {
                    return `<mark style="background-color: ${rgba}">${content}</mark>`;
                }
            }
            
            if (el.style?.backgroundColor) {
                return `<mark style="background-color: ${el.style.backgroundColor}">${content}</mark>`;
            }
            
            if (el.nodeName === 'SPAN') {
                return content;
            }
            
            return `==${content}==`;
        },
    });

    td.addRule('textColor', {
        filter: (node) =>
            node.nodeName === 'SPAN' && (
                Array.from((node as HTMLElement).classList || []).some(c => c.startsWith('tc-')) ||
                !!(node as HTMLElement).style?.color
            ),
        replacement: (content, node) => {
            const el = node as HTMLElement;
            
            let tcClass = '';
            if (el.classList) {
                for (const cls of Array.from(el.classList)) {
                    if (cls.startsWith('tc-')) {
                        tcClass = cls;
                        break;
                    }
                }
            }
            
            if (tcClass) {
                const short = tcClass.slice(3);
                const hex = SHORT_TO_HEX[short];
                if (hex) {
                    return `<span style="color: ${hex}">${content}</span>`;
                }
            }
            
            if (el.style?.color) {
                return `<span style="color: ${el.style.color}">${content}</span>`;
            }
            
            return content;
        },
    });

    // Convert editor tables (no <thead>/<th>) to proper markdown tables.
    // The first row is treated as the header row.
    td.addRule('editorTable', {
        filter: (node) => {
            // Match <table> elements that are NOT flashcard export tables
            // (flashcards are handled by their own rule above)
            if (node.nodeName !== 'TABLE') return false;
            const cls = node.getAttribute('class') || '';
            return !cls.includes('flashcard-export-table');
        },
        replacement: (_content, node) => {
            const el = node as HTMLElement;
            const trs = Array.from(el.querySelectorAll('tr'));
            if (trs.length === 0) return '';

            const parseRow = (tr: HTMLElement): string[] => {
                const cells = Array.from(tr.querySelectorAll('td, th'));
                return cells.map(cell => {
                    let text = (cell.textContent || '').trim();
                    text = text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
                    return text;
                });
            };

            const rows = trs.map(tr => parseRow(tr as HTMLElement));
            const colCount = Math.max(...rows.map(r => r.length));

            // Pad rows to have equal columns
            const padded = rows.map(r => {
                while (r.length < colCount) r.push('');
                return r;
            });

            // First row as header
            const header = padded[0];
            const separator = header.map(() => '---');
            const dataRows = padded.slice(1);

            let table = '\n\n';
            table += '| ' + header.join(' | ') + ' |\n';
            table += '| ' + separator.join(' | ') + ' |\n';
            for (const row of dataRows) {
                table += '| ' + row.join(' | ') + ' |\n';
            }
            return table + '\n';
        }
    });
}
