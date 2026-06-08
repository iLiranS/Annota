export function extractImageIds(html: string): string[] {
    const regex = /data-image-id\s*=\s*(["'])(.*?)\1/gi;
    const ids: string[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        const id = match[2];
        // SAFETY CHECK: Never extract temporary upload placeholders
        if (!id.startsWith('temp-')) {
            ids.push(id);
        }
    }
    return ids;
}
