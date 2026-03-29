import { ExportAdapter } from '@annota/editor-core';
import { NoteFileService } from '@annota/core/platform';
import { appCacheDir, join } from '@tauri-apps/api/path';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { openPath } from '@tauri-apps/plugin-opener';

export class DesktopExportAdapter implements ExportAdapter {

    // ─── Markdown ─────────────────────────────────────────────────────────────

    async exportMarkdown(filename: string, markdownContent: string): Promise<void> {
        try {
            const savePath = await save({
                defaultPath: filename,
                filters: [{ name: 'Markdown', extensions: ['md'] }],
            });

            if (savePath) {
                await writeTextFile(savePath, markdownContent);
            }
        } catch (error) {
            console.error('DesktopExportAdapter: Markdown export failed', error);
            throw error;
        }
    }

    // ─── PDF ──────────────────────────────────────────────────────────────────

    async exportPdf(_filename: string, styledHtmlContent: string): Promise<void> {
        try {
            // 1. Get the cache directory
            const cacheDir = await appCacheDir();

            // 2. Create a temporary HTML file
            const tempFileName = `annota_export_${Date.now()}.html`;
            const tempFilePath = await join(cacheDir, tempFileName);

            // 3. Inject a script to automatically open the print dialog when the browser loads it
            const autoPrintHtml = styledHtmlContent.replace(
                '</body>',
                '<script>window.onload = () => window.print();</script></body>'
            );

            // 4. Save the file to the allowed cache directory
            await writeTextFile(tempFilePath, autoPrintHtml);

            // 5. Open the file natively. The OS will automatically launch the default 
            // browser (Chrome/Safari/Edge), parse your modern CSS perfectly, 
            // and the injected script will pop the Print/Save as PDF dialog.
            await openPath(tempFilePath);

        } catch (error) {
            console.error('DesktopExportAdapter: PDF export failed', error);
            throw error;
        }
    }

    // ─── Platform Resolvers ──────────────────────────────────────────────────

    async resolveImage(id: string): Promise<string | null> {
        try {
            const imageMap = await NoteFileService.resolveFileSources([id]);
            return imageMap[id] || null;
        } catch (error) {
            console.error(`DesktopExportAdapter: Failed to resolve image ${id}`, error);
            return null;
        }
    }
}