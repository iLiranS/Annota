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
            { id: 'table', title: 'Table', iconKey: 'table', action: 'insertTable' },
        ]
    },
];

export function getFilteredCommands(query: string, activeFolder: string | null): SharedSlashCommand[] {
    if (query.length > 0) {
        const allItems = SHARED_SLASH_COMMANDS.flatMap(item => item.children ? item.children : [item]);
        return allItems.filter(item => item.title.toLowerCase().includes(query.toLowerCase()));
    }
    if (activeFolder) {
        return SHARED_SLASH_COMMANDS.find(c => c.id === activeFolder)?.children || [];
    }
    return SHARED_SLASH_COMMANDS;
}
