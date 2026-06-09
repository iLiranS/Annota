import { NoteMetadataInsert } from '../db/schema';
import { generateId } from './id';

// Constants
export const MAX_TITLE_LENGTH = 50;
export const MAX_PREVIEW_LENGTH = 75;

function formatDateCustom(date: Date) {
    // Get the full month name (e.g., "March")
    // Using 'en-US' locale ensures English month names,
    // aligning with your language preference.
    const month = date.toLocaleString('en-US', { month: 'long' });

    // Get the day of the month (e.g., 3, 13)
    const day = date.getDate();

    // Get the full year (e.g., 2026)
    const year = date.getFullYear();

    // Combine them into the desired string format
    return `${month} ${day} ${year}`;
}

/**
 * Generates a title from HTML content, ensuring it doesn't exceed the max length.
 * Strips HTML tags and takes the first line or a default "Untitled Note".
 */
export function generateTitle(html: string): string {
    const plainText = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();

    const lines = plainText.split('\n').filter(line => line.trim().length > 0);
    const title = lines[0]?.trim() || 'Untitled Note';

    return title.length > 25 ? title.slice(0, 50) : title;
}

/**
 * Generates a preview from HTML content.
 * logic taken from original repository implementation.
 */
export function generatePreview(htmlContent: string, maxLength = 60): string {
    if (!htmlContent) return '';

    // 1. Split by block elements or newlines to find distinct lines
    const lines = htmlContent
        .split(/<br\s*\/?>|<\/p>|<\/div>|<\/h[1-6]>|\n/i)
        .map(line => {
            // Strip HTML tags
            let clean = line.replace(/<[^>]*>/g, '');

            // Decode common HTML entities (fixes the "&amp;" issue)
            clean = clean
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, ' ');

            // Collapse multiple spaces/tabs into a single space
            return clean.replace(/\s+/g, ' ').trim();
        })
        .filter(line => line.length > 0);

    // Grab the second line (or fallback to the first if there is no second)
    const previewTarget = lines[1] || lines[0] || '';

    if (previewTarget.length <= maxLength) {
        return previewTarget;
    }

    // Optional: Try to cut off at a word boundary instead of mid-word
    const truncated = previewTarget.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) { // Only snap to word if it doesn't cut off too much
        return truncated.substring(0, lastSpace).trim() + '...';
    }

    return truncated.trim() + '...';
}

/**
 * Generates initial metadata for a new note.
 */
export function generateNoteMetadata(data: Partial<NoteMetadataInsert>): NoteMetadataInsert {
    const id = generateId();
    const now = new Date();
    let folderId = null
    if (data && data.folderId && data.folderId.length > 0 && data.folderId !== 'root') folderId = data.folderId
    return {
        id,
        folderId,
        title: folderId === 'system-daily-notes' ? formatDateCustom(now) : data?.title ?? 'Untitled Note',
        preview: data?.preview ?? '',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
        isPinned: false,
        isQuickAccess: false,
        isDirty: true,
        tags: data?.tags ?? '[]',
        originalFolderId: null,
    };
}
