import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export async function exportToPDF(htmlContent: string, title: string = 'Note'): Promise<void> {
    try {
        // Wrap the note content in a simple HTML template for styling
        const printableHtml = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <title>${title}</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 24px;
                        }
                        h1, h2, h3, h4, h5, h6 {
                            color: #111;
                            margin-top: 24px;
                            margin-bottom: 16px;
                            font-weight: 600;
                        }
                        p {
                            margin-top: 0;
                            margin-bottom: 16px;
                        }
                        a {
                            color: #0366d6;
                            text-decoration: none;
                        }
                        pre, code {
                            font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
                            background-color: #f6f8fa;
                            border-radius: 4px;
                        }
                        pre {
                            padding: 16px;
                            overflow: auto;
                        }
                        code {
                            padding: 3px 6px;
                            font-size: 85%;
                        }
                        blockquote {
                            margin: 0;
                            padding: 0 16px;
                            color: #6a737d;
                            border-left: 4px solid #dfe2e5;
                        }
                        table {
                            border-spacing: 0;
                            border-collapse: collapse;
                            margin-bottom: 16px;
                            width: 100%;
                        }
                        table th, table td {
                            padding: 6px 13px;
                            border: 1px solid #dfe2e5;
                        }
                        table tr:nth-child(2n) {
                            background-color: #f6f8fa;
                        }
                        img {
                            max-width: 100%;
                            height: auto;
                            border-radius: 8px;
                            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        }
                        .page-breaker {
                            page-break-after: always;
                        }
                        hr {
                            border-bottom: 1px solid #eee;
                            border-top: 0;
                            margin: 20px 0;
                        }
                    </style>
                </head>
                <body>
                    ${htmlContent}
                </body>
            </html>
        `;

        // Generate the PDF
        const { uri } = await Print.printToFileAsync({
            html: printableHtml,
        });

        // Share the generated PDF
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
            await Sharing.shareAsync(uri, {
                UTI: 'com.adobe.pdf',
                mimeType: 'application/pdf',
                dialogTitle: `Export ${title} as PDF`
            });
        }
    } catch (error) {
        console.error('Failed to export to PDF:', error);
        throw error;
    }
}
