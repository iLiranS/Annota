import { useNotesStore, type Folder, type NoteMetadata } from '@annota/core';
import { convertToMarkdown } from '@annota/editor-core';
import { open } from '@tauri-apps/plugin-dialog';
import { mkdir, stat, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { useState } from 'react';
import { toast } from 'sonner';

export function useExportFolder() {
    const [isExporting, setIsExporting] = useState(false);
    const { folders, notes, getNoteContent } = useNotesStore();

    const handleExport = async (startFolderId: string | null, startFolderName: string) => {
        try {
            setIsExporting(true);

            // 1. Select destination folder
            const selectedPath = await open({
                directory: true,
                multiple: false,
            });

            if (!selectedPath || typeof selectedPath !== 'string') {
                return;
            }

            toast.info('Analyzing folder contents...');

            // Normalize folder and note IDs helper
            const getNormalizedFolderId = (fid: string | null | undefined): string | null => {
                return (fid === 'root' || fid === '' || !fid) ? null : fid;
            };

            // 2. Build local maps of active (non-deleted) folders and notes
            const activeFolders = folders.filter(f => !f.isDeleted);
            
            // Map folders by parentId
            const foldersMap = new Map<string, Folder>();
            for (const f of activeFolders) {
                foldersMap.set(f.id, f);
            }

            // Map active notes by normalized folderId
            const notesByFolderId = new Map<string | null, NoteMetadata[]>();
            const activeNotes = notes.filter(n => !n.isDeleted && !n.isPermDeleted);
            for (const n of activeNotes) {
                const fid = getNormalizedFolderId(n.folderId);
                if (!notesByFolderId.has(fid)) {
                    notesByFolderId.set(fid, []);
                }
                notesByFolderId.get(fid)!.push(n);
            }

            // Helper to sanitize filenames/directory names safely (removes special characters invalid in most filesystems)
            const sanitizeFilename = (name: string): string => {
                return (name || 'Untitled').replace(/[\\/:*?"<>|]/g, '_').trim();
            };

            // 3. Recursive folder tree collector
            const collectNotes = (
                folderId: string | null,
                currentRelativePath: string
            ): { relativeDirs: string[]; files: { noteId: string; noteTitle: string; relativePath: string }[] } => {
                const relativeDirs: string[] = [];
                const files: { noteId: string; noteTitle: string; relativePath: string }[] = [];

                // A. Notes in this folder
                const notesInThisFolder = notesByFolderId.get(folderId) || [];
                const usedFilenames = new Set<string>();

                for (const note of notesInThisFolder) {
                    const safeTitle = sanitizeFilename(note.title);
                    let filename = `${safeTitle}.md`;
                    let counter = 1;
                    while (usedFilenames.has(filename.toLowerCase())) {
                        filename = `${safeTitle} (${counter}).md`;
                        counter++;
                    }
                    usedFilenames.add(filename.toLowerCase());

                    files.push({
                        noteId: note.id,
                        noteTitle: note.title,
                        relativePath: currentRelativePath ? `${currentRelativePath}/${filename}` : filename,
                    });
                }

                // B. Subfolders in this folder
                const subfolders = activeFolders.filter(f => {
                    const parentId = getNormalizedFolderId(f.parentId);
                    return parentId === folderId;
                });

                for (const sub of subfolders) {
                    const safeFolderName = sanitizeFilename(sub.name);
                    const nextRelPath = currentRelativePath ? `${currentRelativePath}/${safeFolderName}` : safeFolderName;
                    relativeDirs.push(nextRelPath);

                    const subTree = collectNotes(sub.id, nextRelPath);
                    relativeDirs.push(...subTree.relativeDirs);
                    files.push(...subTree.files);
                }

                return { relativeDirs, files };
            };

            const exists = async (path: string): Promise<boolean> => {
                try {
                    await stat(path);
                    return true;
                } catch {
                    return false;
                }
            };

            // 4. Gather all folders and notes to export
            const normalizedStartFolderId = getNormalizedFolderId(startFolderId);
            const rawBaseDirName = sanitizeFilename(startFolderName || 'Annota Export');

            // Find a unique base directory name if it already exists
            let baseDirName = rawBaseDirName;
            let counter = 1;
            let baseDirPath = await join(selectedPath, baseDirName);
            while (await exists(baseDirPath)) {
                baseDirName = `${rawBaseDirName} (${counter})`;
                baseDirPath = await join(selectedPath, baseDirName);
                counter++;
            }

            const { relativeDirs, files } = collectNotes(normalizedStartFolderId, baseDirName);

            // We must also create the base directory
            const allDirsToCreate = [baseDirName, ...relativeDirs];

            if (files.length === 0) {
                toast.warning('No notes found to export in this folder.');
                return;
            }

            toast.info(`Exporting ${files.length} notes...`);

            // 5. Create directories
            for (const relDir of allDirsToCreate) {
                const absDir = await join(selectedPath, relDir);
                await mkdir(absDir, { recursive: true });
            }

            // 6. Write files in chunks to avoid memory and performance bottlenecks
            const batchSize = 10;
            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < files.length; i += batchSize) {
                const chunk = files.slice(i, i + batchSize);
                
                await Promise.all(
                    chunk.map(async (item) => {
                        try {
                            // A. Fetch note content
                            const htmlContent = await getNoteContent(item.noteId);
                            // B. Convert to Markdown
                            const markdown = await convertToMarkdown(htmlContent);
                            // C. Resolve absolute path
                            const absFilePath = await join(selectedPath, item.relativePath);
                            // D. Write file
                            await writeTextFile(absFilePath, markdown);
                            successCount++;
                        } catch (err) {
                            console.error(`Failed to export note "${item.noteTitle}" (${item.noteId}):`, err);
                            errorCount++;
                        }
                    })
                );
            }

            if (errorCount === 0) {
                toast.success(`Successfully exported ${successCount} notes to "${baseDirName}"`);
            } else {
                toast.warning(`Export complete. ${successCount} notes exported successfully, ${errorCount} failed.`);
            }

        } catch (error: any) {
            console.error('Export folder error:', error);
            toast.error(error?.message || 'Failed to export folder');
        } finally {
            setIsExporting(false);
        }
    };

    return {
        handleExport,
        isExporting,
    };
}
