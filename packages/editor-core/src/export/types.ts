/**
 * Interface that platforms must implement to handle the final save/share action.
 */
export interface ExportAdapter {
    /**
     * Handles saving/sharing a raw Markdown string.
     * @param filename Preferred filename (e.g. "my-note.md")
     * @param markdownContent The transformed markdown string
     */
    exportMarkdown(filename: string, markdownContent: string): Promise<void>;

    /**
     * Handles generating and saving/sharing a PDF from a styled HTML string.
     * @param filename Preferred filename (without extension usually, like "my-note")
     * @param styledHtmlContent The fully styled, self-contained HTML string
     */
    exportPdf(filename: string, styledHtmlContent: string): Promise<void>;

    /**
     * Optional resolver to handle platform-specific image IDs (e.g. data-image-id)
     * during the export process.
     */
    resolveImage?(id: string): Promise<string | null>;
}
