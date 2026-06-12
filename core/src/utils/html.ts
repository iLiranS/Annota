export function stripHtml(html: string): string {
    if (!html) return '';

    // Replace block-level tags with space to avoid word joining
    const blocks = html.replace(/<(address|article|aside|blockquote|canvas|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|header|hr|li|main|nav|noscript|ol|p|pre|section|table|tfoot|ul|video)[^>]*>/gi, ' ');

    // Remove all other tags
    const noTags = blocks.replace(/<[^>]*>?/gm, '');

    // Decode common entities
    const decoded = noTags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');

    // Collapse whitespace
    return decoded.replace(/\s+/g, ' ').trim();
}

export interface ExtractedLink {
    targetId: string;
    blockId: string | null;
    fullUrl: string;
}

export const MAX_NOTE_SIZE = 145000;

export function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

const encoder = new TextEncoder();
export function getByteSize(str: string): number {
    return encoder.encode(str).length;
}

// Module-level cached regular expressions for performance
const LINK_REGEX = /href=["'](annota:\/\/note\/([a-zA-Z0-9-]+)(?:\?blockId=([a-zA-Z0-9-]+))?)["']/gi;
const IMG_TAG_REGEX = /<img\b[^>]*>/gi;
const DATA_IMAGE_ID_TEST_REGEX = /data-image-id\s*=\s*["'][^"']+["']/i;
const SRC_QUOTED_REGEX = /\s+src\s*=\s*(["']).*?\1/gi;
const SRC_UNQUOTED_REGEX = /\s+src\s*=\s*[^\s>]+/gi;
const SRC_TEST_REGEX = /\s+src\s*=/i;
const END_TAG_REGEX = /\s*\/?>$/;
const IMAGE_ID_REGEX = /data-image-id\s*=\s*(["'])(.*?)\1/gi;
const FILE_ID_REGEX = /(?:fileid|file-id)\s*=\s*(["'])(.*?)\1/gi;

export function extractLinks(content: string): ExtractedLink[] {
    if (!content) return [];
    const linksMap = new Map<string, ExtractedLink>();

    for (const match of content.matchAll(LINK_REGEX)) {
        const fullUrl = match[1];
        const targetId = match[2];
        const blockId = match[3] || null;

        if (!linksMap.has(targetId)) {
            linksMap.set(targetId, { targetId, blockId, fullUrl });
        }
    }
    return Array.from(linksMap.values()).sort((a, b) => a.targetId.localeCompare(b.targetId));
}

export function normalizeStoredContent(content: string): string {
    if (!content) return content ?? '';

    // Handle legacy image nodes: Keep data-image-id, strip heavy base64 src
    return content.replace(IMG_TAG_REGEX, (imgTag) => {
        if (!DATA_IMAGE_ID_TEST_REGEX.test(imgTag)) {
            return imgTag;
        }

        let tag = imgTag
            .replace(SRC_QUOTED_REGEX, ' src=""')
            .replace(SRC_UNQUOTED_REGEX, ' src=""');

        if (!SRC_TEST_REGEX.test(tag)) {
            tag = tag.replace(END_TAG_REGEX, (end) => ` src=""${end}`);
        }

        return tag;
    });
}

export function extractFileIdsFromContent(content: string): string[] {
    if (!content) return [];
    const ids = new Set<string>();

    // Legacy image IDs: data-image-id="..."
    for (const match of content.matchAll(IMAGE_ID_REGEX)) {
        ids.add(match[2]);
    }

    // New file attachment IDs: fileId="..." or file-id="..."
    for (const match of content.matchAll(FILE_ID_REGEX)) {
        ids.add(match[2]);
    }

    return Array.from(ids);
}

