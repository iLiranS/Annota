import { convertMarkdownToAnnotaHTML } from '@annota/editor-web';
import { useNotesStore } from '@annota/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { useState } from 'react';
import { toast } from 'sonner';

const MAX_IMPORT_LIMIT = 20;

export function useImportNotes() {
    const [isImporting, setIsImporting] = useState(false);
    const { createNotesBulk } = useNotesStore();

    const handleImportMarkdown = async () => {
        try {
            setIsImporting(true);

            // 1. Open file dialog allowing multiple selection
            const selectedFiles = await open({
                multiple: true,
                filters: [{ name: 'Markdown', extensions: ['md'] }]
            });

            if (!selectedFiles || (Array.isArray(selectedFiles) && selectedFiles.length === 0)) {
                return;
            }

            const files = Array.isArray(selectedFiles) ? selectedFiles : [selectedFiles];

            // 2. Enforce limits
            if (files.length > MAX_IMPORT_LIMIT) {
                toast.error(`Please select up to ${MAX_IMPORT_LIMIT} files.`);
                return;
            }

            toast.info(`Importing ${files.length} notes...`);

            const notesToSave: { title: string, content: string }[] = [];

            // 3. Process sequentially
            for (const filePath of files) {
                try {
                    const path = typeof filePath === 'string' ? filePath : (filePath as any).path;
                    
                    // A. Read Markdown
                    const mdContent = await readTextFile(path);
                    
                    // B. Convert to Annota HTML (for storage)
                    const contentStr = await convertMarkdownToAnnotaHTML(mdContent);
                    
                    // C. Extract title from filename
                    const fileNameMatches = path.match(/([^\\\/]+)\.md$/);
                    const title = fileNameMatches ? fileNameMatches[1] : 'Untitled Note';

                    notesToSave.push({
                        title: title,
                        content: contentStr
                    });
                } catch (error: any) {
                    console.error(`Failed to process file ${filePath}:`, error);
                    toast.error(`Skipping file: ${typeof filePath === 'string' ? filePath : 'Unknown file'}`);
                }
            }

            if (notesToSave.length > 0) {
                // 4. Batch creation in DB and Store
                const result = await createNotesBulk(notesToSave);
                
                if (result.error) {
                    toast.error(result.error);
                } else if (result.data.length > 0) {
                    toast.success(`Successfully imported ${result.data.length} notes into "${result.folder?.name}"`);
                } else {
                    toast.warning("No notes were imported. Check if files are too large.");
                }
            }

        } catch (error: any) {
            console.error('Import error:', error);
            toast.error(error?.message || 'Failed to import files');
        } finally {
            setIsImporting(false);
        }
    };

    return {
        handleImportMarkdown,
        isImporting
    };
}
