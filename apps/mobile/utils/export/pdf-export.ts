import { ExportService } from '@annota/editor-core';
import { MobileExportAdapter } from './MobileExportAdapter';

const adapter = new MobileExportAdapter();
const exportService = new ExportService(adapter);

export async function exportToPDF(htmlContent: string, title: string = 'Note'): Promise<void> {
    try {
        await exportService.triggerPdfExport(title, htmlContent);
    } catch (error) {
        console.error('Failed to export to PDF:', error);
        throw error;
    }
}
