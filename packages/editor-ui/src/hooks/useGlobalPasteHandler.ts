import { useEffect } from 'react';
import { NoteFileService } from '@annota/core/platform';

interface UseGlobalPasteHandlerArgs {
    noteId?: string;
    editorRef: React.RefObject<any>;
    handleCommand: (cmd: string, params?: any) => void;
}

export function useGlobalPasteHandler({
    noteId,
    editorRef,
    handleCommand,
}: UseGlobalPasteHandlerArgs) {
    useEffect(() => {
        const handleGlobalPaste = async (e: ClipboardEvent) => {
            if (!noteId || !editorRef.current) return;

            // 0. SKIP IF FOCUS IS IN AN INPUT OR TEXTAREA (like Mermaid editor)
            const target = e.target as HTMLElement;
            if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

            // 1. CHECK FOR INTERNAL HTML FIRST
            const htmlContent = e.clipboardData?.getData('text/html');

            // Check if the HTML contains your custom local URI scheme (e.g., asset:// or a custom data attribute)
            if (htmlContent && (htmlContent.includes('asset://') || htmlContent.includes('data-image-id'))) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlContent, 'text/html');
                const imgElement = doc.querySelector('img');

                if (imgElement && imgElement.src) {
                    console.log("Internal DOM copy detected! Bypassing binary upload.");
                    e.preventDefault();
                    e.stopPropagation();

                    // Extract the ID from either your custom data attribute or parse it from the src URL
                    const imageId = imgElement.getAttribute('data-image-id') ||
                        imgElement.src.split(/[\/\\]/).pop()?.split('.')[0] ||
                        'unknown-id';

                    handleCommand('insertLocalImage', {
                        imageId: imageId,
                        src: imgElement.src
                    });
                    return; // STOP execution. Do not upload the mangled binary!
                }
            }

            // 2. FALLBACK TO BINARY UPLOAD (For external files from the web or OS)
            const items = e.clipboardData?.items;
            if (!items) return;

            // CHECK FOR PDF ATTACHMENT IN CLIPBOARD
            const pdfFile = Array.from(items).find(item => item.type === 'application/pdf');
            if (pdfFile) {
                const file = pdfFile.getAsFile();
                if (file) {
                    e.preventDefault();
                    const processed = await NoteFileService.processAndInsertFile(noteId, URL.createObjectURL(file), 'application/pdf');
                    handleCommand('insertFileAttachment', {
                        fileId: processed.fileId,
                        fileName: processed.fileName,
                        fileSize: processed.fileSize,
                        localPath: processed.localPath,
                        mimeType: processed.mimeType
                    });
                    return;
                }
            }

            let fileToUpload: File | null = null;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.startsWith('image/') || item.type === 'application/pdf') {
                    fileToUpload = item.getAsFile();
                    if (fileToUpload) break;
                }
            }

            if (fileToUpload) {
                console.log("External binary paste detected. Uploading...", fileToUpload.type);
                e.preventDefault();
                e.stopPropagation();

                const reader = new FileReader();
                reader.onload = async (event) => {
                    const base64 = event.target?.result as string;
                    if (base64) {
                        try {
                            const processed = await NoteFileService.saveNoteFile(noteId, base64);
                            if (processed.mimeType === 'application/pdf') {
                                handleCommand('insertFileAttachment', {
                                    fileId: processed.id,
                                    fileName: processed.fileName,
                                    fileSize: processed.fileSize,
                                    localPath: processed.localPath,
                                    mimeType: processed.mimeType
                                });
                            } else {
                                handleCommand('insertLocalImage', { imageId: processed.id, src: processed.url });
                            }
                        } catch (err) {
                            console.error('[EditorDom] Global paste upload failed:', err);
                        }
                    }
                };
                reader.readAsDataURL(fileToUpload);
            }
        };

        document.addEventListener('paste', handleGlobalPaste, { capture: true });

        return () => {
            document.removeEventListener('paste', handleGlobalPaste, { capture: true });
        };
    }, [noteId, handleCommand, editorRef]);
}
