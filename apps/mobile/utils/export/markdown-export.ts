import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
function convertHtmlToMarkdown(html: string): string {
    let md = html;

    // Remove general whitespace formatting
    md = md.replace(/[\n\t\r]+/g, ' ');

    // Headings
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n\n# $1\n\n');
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n\n## $1\n\n');
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\n### $1\n\n');
    md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n\n#### $1\n\n');
    md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n\n##### $1\n\n');
    md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n\n###### $1\n\n');

    // Paragraphs and Blockquotes
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '\n\n$1\n\n');
    md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '\n\n> $1\n\n');

    // Text formatting
    md = md.replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, '**$2**');
    md = md.replace(/<(em|i)[^>]*>(.*?)<\/\1>/gi, '*$2*');
    md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, '_$1_');
    md = md.replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~');
    md = md.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~');
    md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

    // Preformatted Code
    md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n\n```\n$1\n```\n\n');
    md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n\n```\n$1\n```\n\n');

    // Links and Images
    md = md.replace(/<a[^>]*href=["'](.*?)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    md = md.replace(/<img[^>]*src=["'](.*?)["'][^>]*alt=["'](.*?)["'][^>]*\/?>/gi, '![$2]($1)');
    md = md.replace(/<img[^>]*alt=["'](.*?)["'][^>]*src=["'](.*?)["'][^>]*\/?>/gi, '![$1]($2)');
    md = md.replace(/<img[^>]*src=["'](.*?)["'][^>]*\/?>/gi, '![]($1)');

    // Lists
    md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '\n\n$1\n');
    md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '\n\n$1\n');

    // Line breaks
    md = md.replace(/<br\s*\/?>/gi, '\n');

    // Strip remaining tags
    md = md.replace(/<[^>]+>/g, '');

    // Unescape HTML entities
    md = md.replace(/&nbsp;/gi, ' ');
    md = md.replace(/&lt;/gi, '<');
    md = md.replace(/&gt;/gi, '>');
    md = md.replace(/&amp;/gi, '&');
    md = md.replace(/&quot;/gi, '"');
    md = md.replace(/&#39;/gi, "'");

    // Clean up excessive newlines
    md = md.replace(/\n{3,}/g, '\n\n');

    return md.trim();
}

export async function exportToMarkdown(htmlContent: string, title: string = 'Note'): Promise<void> {
    try {
        const markdown = convertHtmlToMarkdown(htmlContent);

        // Create a safe valid filename
        const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${safeTitle || 'note'}.md`;
        const file = new ExpoFile(Paths.cache, filename);

        // Write string to cache directory
        await file.write(markdown);

        // Open share dialog
        const fileUri = file.uri;
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'text/markdown',
                dialogTitle: `Export ${title} as Markdown`
            });
        }
    } catch (error) {
        console.error('Failed to export to Markdown:', error);
        throw error;
    }
}
