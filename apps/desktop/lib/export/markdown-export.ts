// apps/desktop/src/lib/markdown-export.ts
import { ExportService } from '@annota/editor-core';
import { DesktopExportAdapter } from './DesktopExportAdapter';

const exportService = new ExportService(new DesktopExportAdapter());

export async function exportToMarkdown(
    htmlContent: string,
    title: string = 'Note',
): Promise<void> {
    try {
        await exportService.triggerMarkdownExport(title, htmlContent);
    } catch (error) {
        console.error('Failed to export to Markdown:', error);
        throw error;
    }
}
