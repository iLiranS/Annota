import { NoteMetadataInsert } from '@/lib/db/schema';
import crypto from 'react-native-quick-crypto';

// Constants
export const MAX_TITLE_LENGTH = 50;
export const MAX_PREVIEW_LENGTH = 100;

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
export function generatePreview(htmlContent: string, maxLength = MAX_PREVIEW_LENGTH): string {
    const lines = htmlContent
        .split(/<br\s*\/?>|<\/p>|<\/div>|<\/h[1-6]>|\n/i)
        .map(line => line.replace(/<[^>]*>/g, '').trim())
        .filter(line => line.length > 0);

    const secondLine = lines[1] || '';

    if (secondLine.length <= maxLength) {
        return secondLine;
    }

    return secondLine.substring(0, maxLength).trim() + '...';
}

/**
 * Generates initial metadata for a new note.
 */
export function generateNoteMetadata(data: Partial<NoteMetadataInsert>): NoteMetadataInsert {
    const id = crypto.randomUUID();
    const now = new Date();
    let folderId = null
    if (data && data.folderId && data.folderId.length > 0) folderId = data.folderId
    return {
        id,
        folderId,
        title: data?.title ?? 'Untitled Note',
        preview: data?.preview ?? '',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
        isPinned: false,
        isQuickAccess: false,
        isDirty: true,
        tags: '[]',
        originalFolderId: null,
    };
}
