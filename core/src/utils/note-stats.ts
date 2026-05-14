import { stripHtml } from './html';

export interface NoteStats {
    words: number;
    chars: number;
    size: number;
}

function decodeEntities(text: string): string {
    return text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
}

/**
 * Calculates statistics for a note's content.
 * Includes text, LaTeX, and Mermaid code in the character/word count.
 */
export function calculateNoteStats(content: string): NoteStats {
    if (!content) {
        return { words: 0, chars: 0, size: 0 };
    }

    // 1. Extract content from attributes that aren't rendered as text nodes
    const extraContent: string[] = [];
    
    // LaTeX (data-latex)
    const latexRegex = /data-latex="([^"]*)"/gi;
    let match;
    while ((match = latexRegex.exec(content)) !== null) {
        extraContent.push(decodeEntities(match[1]));
    }

    // Mermaid (code or data-code)
    const mermaidRegex = /(?:data-)?code="([^"]*)"/gi;
    while ((match = mermaidRegex.exec(content)) !== null) {
        // We only want to count this if it's inside a mermaid block
        // but for simplicity and performance, we count all code/data-code attributes 
        // that aren't obviously something else.
        if (content.includes('data-type="mermaid"') || content.includes('mermaid-block')) {
            extraContent.push(decodeEntities(match[1]));
        }
    }

    // File names (fileName)
    const fileNameRegex = /fileName="([^"]*)"/gi;
    while ((match = fileNameRegex.exec(content)) !== null) {
        extraContent.push(decodeEntities(match[1]));
    }

    // 2. Strip HTML from the main content (this decodes entities and handles block boundaries)
    const plainText = stripHtml(content);

    // 3. Combine everything
    const totalText = (plainText + ' ' + extraContent.join(' ')).trim();

    // 4. Calculate stats
    return {
        words: totalText ? totalText.split(/\s+/).length : 0,
        chars: totalText.length,
        size: new TextEncoder().encode(content).length
    };
}
