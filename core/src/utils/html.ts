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
