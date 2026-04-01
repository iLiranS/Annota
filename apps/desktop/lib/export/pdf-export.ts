import { ExportService, ExportOptions } from '@annota/editor-core';
import { DesktopExportAdapter } from './DesktopExportAdapter';

const exportService = new ExportService(new DesktopExportAdapter());

export async function exportToPDF(
    htmlContent: string,
    title: string = 'Note',
    options?: ExportOptions
): Promise<void> {
    try {
        await exportService.triggerPdfExport(title, htmlContent, options);
    } catch (error) {
        console.error('Failed to export to PDF:', error);
        throw error;
    }
}
