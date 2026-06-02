import { EditorCommand } from './types';

export type SharedSlashCommand = {
    id: string;
    title: string;
    iconKey: string;
    action?: EditorCommand;
    params?: Record<string, any>;
    children?: SharedSlashCommand[];
};

export const SHARED_SLASH_COMMANDS: SharedSlashCommand[] = [
    {
        id: 'headings',
        title: 'Headings',
        iconKey: 'heading',
        children: [
            { id: 'h1', title: 'Heading 1', iconKey: 'h1', action: 'toggleHeading', params: { level: 1 } },
            { id: 'h2', title: 'Heading 2', iconKey: 'h2', action: 'toggleHeading', params: { level: 2 } },
            { id: 'h3', title: 'Heading 3', iconKey: 'h3', action: 'toggleHeading', params: { level: 3 } },
            { id: 'h4', title: 'Heading 4', iconKey: 'h4', action: 'toggleHeading', params: { level: 4 } },
            { id: 'h5', title: 'Heading 5', iconKey: 'h5', action: 'toggleHeading', params: { level: 5 } },
            { id: 'h6', title: 'Heading 6', iconKey: 'h6', action: 'toggleHeading', params: { level: 6 } },
        ]
    },
    {
        id: 'format',
        title: 'Format',
        iconKey: 'format',
        children: [
            { id: 'bold', title: 'Bold', iconKey: 'bold', action: 'toggleBold' },
            { id: 'italic', title: 'Italic', iconKey: 'italic', action: 'toggleItalic' },
            { id: 'underline', title: 'Underline', iconKey: 'underline', action: 'toggleUnderline' },
            { id: 'strike', title: 'Strikethrough', iconKey: 'strike', action: 'toggleStrike' },
        ]
    },
    {
        id: 'lists',
        title: 'Lists',
        iconKey: 'list',
        children: [
            { id: 'bullet', title: 'Bullet List', iconKey: 'bulletList', action: 'toggleBulletList' },
            { id: 'ordered', title: 'Numbered List', iconKey: 'orderedList', action: 'toggleOrderedList' },
            { id: 'task', title: 'Task List', iconKey: 'taskList', action: 'toggleTaskList' },
        ]
    },
    {
        id: 'blocks',
        title: 'Blocks',
        iconKey: 'blocks',
        children: [
            { id: 'quote', title: 'Blockquote', iconKey: 'quote', action: 'toggleBlockquote' },
            { id: 'codeblock', title: 'Code Block', iconKey: 'codeblock', action: 'toggleCodeBlock' },
            { id: 'code', title: 'Inline Code', iconKey: 'code', action: 'toggleCode' },
            { id: 'details', title: 'Details', iconKey: 'details', action: 'toggleDetails' },
            { id: 'flashcard', title: 'Flashcards', iconKey: 'flashcard', action: 'insertFlashcardBlock' },
        ]
    },
    {
        id: 'insert',
        title: 'Insert',
        iconKey: 'plus',
        children: [
            { id: 'math', title: 'Math Formula', iconKey: 'math', action: 'openMathModal' },
            { id: 'file', title: 'File', iconKey: 'file', action: 'openFileModal' },
            { id: 'link', title: 'Link', iconKey: 'link', action: 'openLinkModal' },
            { id: 'youtube', title: 'YouTube Video', iconKey: 'youtube', action: 'openYoutubeModal' },
            {
                id: 'table',
                title: 'Table',
                iconKey: 'table',
                children: [
                    { id: 'table2x2', title: 'Table 2 x 2', iconKey: 'table', action: 'insertTable', params: { rows: 2, cols: 2, withHeaderRow: false } },
                    { id: 'table3x3', title: 'Table 3 x 3', iconKey: 'table', action: 'insertTable', params: { rows: 3, cols: 3, withHeaderRow: false } },
                    { id: 'table4x4', title: 'Table 4 x 4', iconKey: 'table', action: 'insertTable', params: { rows: 4, cols: 4, withHeaderRow: false } },
                    { id: 'table5x5', title: 'Table 5 x 5', iconKey: 'table', action: 'insertTable', params: { rows: 5, cols: 5, withHeaderRow: false } },
                    { id: 'table6x6', title: 'Table 6 x 6', iconKey: 'table', action: 'insertTable', params: { rows: 6, cols: 6, withHeaderRow: false } },
                    { id: 'table7x7', title: 'Table 7 x 7', iconKey: 'table', action: 'insertTable', params: { rows: 7, cols: 7, withHeaderRow: false } },
                    { id: 'table8x8', title: 'Table 8 x 8', iconKey: 'table', action: 'insertTable', params: { rows: 8, cols: 8, withHeaderRow: false } },
                    { id: 'table9x9', title: 'Table 9 x 9', iconKey: 'table', action: 'insertTable', params: { rows: 9, cols: 9, withHeaderRow: false } },
                ]
            },
            { id: 'mermaid', title: 'Mermaid Diagram', iconKey: 'mermaid', action: 'insertMermaid' },
        ]
    },
];

export function getFilteredCommands(query: string, activeFolder: string | null): SharedSlashCommand[] {
    const findFolderById = (id: string, list: SharedSlashCommand[]): SharedSlashCommand | undefined => {
        for (const item of list) {
            if (item.id === id) return item;
            if (item.children) {
                const found = findFolderById(id, item.children);
                if (found) return found;
            }
        }
        return undefined;
    };

    const getLeafCommands = (list: SharedSlashCommand[]): SharedSlashCommand[] => {
        const leaves: SharedSlashCommand[] = [];
        const traverse = (items: SharedSlashCommand[]) => {
            for (const item of items) {
                if (item.children) {
                    traverse(item.children);
                } else {
                    leaves.push(item);
                }
            }
        };
        traverse(list);
        return leaves;
    };

    if (query.length > 0) {
        const allItems = getLeafCommands(SHARED_SLASH_COMMANDS);
        return allItems.filter(item => item.title.toLowerCase().includes(query.toLowerCase()));
    }
    if (activeFolder) {
        return findFolderById(activeFolder, SHARED_SLASH_COMMANDS)?.children || [];
    }
    return SHARED_SLASH_COMMANDS;
}
