import { Node, mergeAttributes, type NodeViewRenderer } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { sendMessage } from '../bridge';
import { createBlockMenuButton } from './block-menu-button';

export const FileAttachment = Node.create({
    name: 'fileAttachment',
    group: 'block',
    atom: true,

    addOptions() {
        return {
            onOpenFile: null as ((data: { localPath: string; mimeType: string }) => void) | null,
            onOpenFileMenu: null as ((e: MouseEvent, resolve: () => { pos: number; message: Record<string, unknown> } | null) => void) | null,
        };
    },

    addAttributes() {
        return {
            fileId: { default: null },
            fileName: { default: 'document.pdf' },
            fileSize: { default: 0 },
            mimeType: { default: 'application/pdf' },
            localPath: { default: null },
        };
    },

    addCommands() {
        return {
            insertFileAttachment: (options: { fileId: string; fileName: string; fileSize: number; localPath: string; mimeType: string }) => ({ chain }: { chain: any }) => {
                return (chain() as any).insertContent({
                    type: this.name,
                    attrs: options
                }).run();
            }
        } as any;
    },

    parseHTML() {
        return [{ tag: 'div[data-type="file-attachment"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'file-attachment' })];
    },

    addNodeView() {
        return (({ node, getPos, editor }) => {
            const { fileName, fileSize, localPath, mimeType } = node.attrs;

            const formatSize = (bytes: number) => {
                if (!bytes) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
            };

            if (typeof document === 'undefined') {
                return { dom: null as any };
            }


            const wrapper = document.createElement('div');
            wrapper.className = 'file-attachment-wrapper';

            const card = document.createElement('div');
            card.className = 'file-attachment-card';

            card.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Guard: ensure editor view is mounted
                if (!editor.view || !editor.view.dom) return;

                if (localPath) {
                    if (this.options.onOpenFile) {
                        this.options.onOpenFile({ localPath, mimeType });
                    } else {
                        sendMessage({ type: 'openFile', localPath, mimeType });
                    }
                }
            };

            const icon = document.createElement('div');
            icon.className = 'file-attachment-icon';
            icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"
     xmlns="http://www.w3.org/2000/svg">
  <path d="M6 2H14L20 8V22C20 22.5523 19.5523 23 19 23H6C5.44772 23 5 22.5523 5 22V3C5 2.44772 5.44772 2 6 2Z"
        stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M14 2V8H20"
        stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;

            const info = document.createElement('div');
            info.className = 'file-attachment-info';

            const nameText = document.createElement('span');
            nameText.className = 'file-attachment-name';
            nameText.textContent = fileName || 'document.pdf';

            const sizeText = document.createElement('span');
            sizeText.className = 'file-attachment-size';
            sizeText.textContent = formatSize(fileSize);

            info.appendChild(nameText);
            info.appendChild(sizeText);

            // Three-dot menu button
            const menuBtn = createBlockMenuButton({
                className: 'file-attachment-menu-btn',
                iconSize: 'small',
                onClick: this.options.onOpenFileMenu || undefined,
                onResolve: () => {
                    // Guard: ensure editor view is mounted
                    if (!editor.view || !editor.view.dom) return null;
                    if (typeof getPos !== 'function') return null;
                    const pos = getPos();
                    if (typeof pos !== 'number') return null;

                    // Select node
                    const nodeSelection = NodeSelection.create(editor.state.doc, pos);
                    editor.view.dispatch(editor.state.tr.setSelection(nodeSelection).setMeta('scrollIntoView', false));

                    return {
                        pos,
                        message: {
                            type: 'openOpenFileMenu',
                            fileId: node.attrs.fileId,
                            fileName: node.attrs.fileName,
                            localPath: node.attrs.localPath,
                            mimeType: node.attrs.mimeType,
                            position: pos,
                        },
                    };
                },
            });

            card.appendChild(icon);
            card.appendChild(info);
            card.appendChild(menuBtn);
            wrapper.appendChild(card);

            return {
                dom: wrapper,
                ignoreMutation: (mutation) => {
                    // Guard: menuBtn may not exist yet
                    if (!menuBtn) return false;
                    return mutation.target === menuBtn ||
                        menuBtn.contains(mutation.target as globalThis.Node);
                },
                update: (updatedNode) => {
                    if (updatedNode.type.name !== this.name) return false;
                    return true;
                },
            };
        }) as NodeViewRenderer;
    },

});
