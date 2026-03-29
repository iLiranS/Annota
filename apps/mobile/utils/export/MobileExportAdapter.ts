import { ExportAdapter } from '@annota/editor-core';
import { NoteFileService } from '@annota/core/platform';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export class MobileExportAdapter implements ExportAdapter {

    // ─── Markdown ─────────────────────────────────────────────────────────────

    async exportMarkdown(filename: string, markdownContent: string): Promise<void> {
        try {
            const file = new ExpoFile(Paths.cache, filename);
            await file.write(markdownContent);

            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(file.uri, {
                    mimeType: 'text/markdown',
                    dialogTitle: 'Export as Markdown',
                });
            }
        } catch (error) {
            console.error('MobileExportAdapter: Markdown export failed', error);
            throw error;
        }
    }

    // ─── PDF ──────────────────────────────────────────────────────────────────
    //
    // expo-print renders the HTML in a native WebKit/Blink view.
    // Colours survive because ExportService sets `print-color-adjust: exact`
    // globally in the HTML shell, and Mermaid is pre-rendered to inline SVG
    // before this adapter is called — nothing JS-dependent remains in the HTML.

    async exportPdf(filename: string, styledHtmlContent: string): Promise<void> {
        try {
            const { uri } = await Print.printToFileAsync({
                html: styledHtmlContent,
                // A4 at 96 dpi — keeps layout stable regardless of device width
                width: 794,
                height: 1123,
            });

            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(uri, {
                    UTI: 'com.adobe.pdf',
                    mimeType: 'application/pdf',
                    dialogTitle: 'Export as PDF',
                });
            }
        } catch (error) {
            console.error('MobileExportAdapter: PDF export failed', error);
            throw error;
        }
    }

    // ─── Platform Resolvers ──────────────────────────────────────────────────

    async resolveImage(id: string): Promise<string | null> {
        try {
            const imageMap = await NoteFileService.resolveFileSources([id]);
            return imageMap[id] || null;
        } catch (error) {
            console.error(`MobileExportAdapter: Failed to resolve image ${id}`, error);
            return null;
        }
    }
}
