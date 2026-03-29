import { ExportService } from '@annota/editor-core';
import { MobileExportAdapter } from './MobileExportAdapter';

const adapter = new MobileExportAdapter();
const exportService = new ExportService(adapter);

export async function exportToMarkdown(htmlContent: string, title: string = 'Note'): Promise<void> {
    try {
        await exportService.triggerMarkdownExport(title, htmlContent);
    } catch (error) {
        console.error('Failed to export to Markdown:', error);
        throw error;
    }
}
