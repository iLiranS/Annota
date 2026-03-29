// apps/desktop/src/lib/pdf-export.ts
import { ExportService } from '@annota/editor-core';
import { DesktopExportAdapter } from './DesktopExportAdapter';

const exportService = new ExportService(new DesktopExportAdapter());

export async function exportToPDF(
    htmlContent: string,
    title: string = 'Note',
): Promise<void> {
    try {
        await exportService.triggerPdfExport(title, htmlContent);
    } catch (error) {
        console.error('Failed to export to PDF:', error);
        throw error;
    }
}
