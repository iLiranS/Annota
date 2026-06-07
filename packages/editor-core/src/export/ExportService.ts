import { ExportAdapter, ExportOptions } from './types';
import { convertToMarkdown } from './markdownExport';
import { preprocessHtmlForPrint, generatePrintableHtml } from './pdfExport';

export class ExportService {
    constructor(private adapter: ExportAdapter) { }

    async convertToMarkdown(rawHtml: string): Promise<string> {
        return convertToMarkdown(rawHtml);
    }

    async triggerMarkdownExport(title: string, rawHtml: string): Promise<void> {
        const markdown = await this.convertToMarkdown(rawHtml);
        const safeTitle = this.sanitizeFilename(title);
        await this.adapter.exportMarkdown(`${safeTitle}.md`, markdown);
    }

    async triggerPdfExport(
        title: string,
        rawHtml: string,
        options?: ExportOptions
    ): Promise<void> {
        const processedHtml = await preprocessHtmlForPrint(rawHtml, this.adapter, options);
        const printReadyHtml = generatePrintableHtml(title, processedHtml, options);
        const safeTitle = this.sanitizeFilename(title);
        await this.adapter.exportPdf(safeTitle, printReadyHtml);
    }

    async getPrintableHtml(
        title: string,
        rawHtml: string,
        options?: ExportOptions
    ): Promise<string> {
        const processedHtml = await preprocessHtmlForPrint(rawHtml, this.adapter, options);
        return generatePrintableHtml(title, processedHtml, options);
    }

    private sanitizeFilename(title: string): string {
        return (title || 'note').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }
}
