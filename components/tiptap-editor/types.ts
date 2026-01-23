import { HeadingLevel } from '@/constants/editor';

export interface TipTapEditorRef {
    getContent: () => Promise<string>;
    setContent: (content: string) => void;
    focus: () => void;
    blur: () => void;
}

export interface TipTapEditorProps {
    initialContent?: string;
    onContentChange?: (html: string) => void;
    placeholder?: string;
    autofocus?: boolean;
}

export interface EditorState {
    // Text formatting
    isBold: boolean;
    isItalic: boolean;
    isUnderline: boolean;
    isStrike: boolean;
    isCode: boolean;

    // Lists
    isBulletList: boolean;
    isOrderedList: boolean;
    isTaskList: boolean;
    canSinkListItem: boolean;
    canLiftListItem: boolean;

    // Blocks
    isBlockquote: boolean;
    isCodeBlock: boolean;
    currentCodeLanguage: string | null;

    // Headings
    isHeading1: boolean;
    isHeading2: boolean;
    isHeading3: boolean;
    isHeading4: boolean;
    isHeading5: boolean;
    isHeading6: boolean;
    currentHeadingLevel: HeadingLevel | null;

    // Links
    isLink: boolean;
    linkHref: string | null;

    // Colors
    highlightColor: string | null;
    textColor: string | null;

    // History
    canUndo: boolean;
    canRedo: boolean;

    // Table
    isInTable: boolean;
    canAddRowBefore: boolean;
    canAddRowAfter: boolean;
    canAddColumnBefore: boolean;
    canAddColumnAfter: boolean;
    canDeleteRow: boolean;
    canDeleteColumn: boolean;
    canDeleteTable: boolean;
    imageAttrs: any | null;
}

export const initialEditorState: EditorState = {
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrike: false,
    isCode: false,
    isBulletList: false,
    isOrderedList: false,
    isTaskList: false,
    canSinkListItem: false,
    canLiftListItem: false,
    isBlockquote: false,
    isCodeBlock: false,
    currentCodeLanguage: null,
    isHeading1: false,
    isHeading2: false,
    isHeading3: false,
    isHeading4: false,
    isHeading5: false,
    isHeading6: false,
    currentHeadingLevel: null,
    isLink: false,
    linkHref: null,
    highlightColor: null,
    textColor: null,
    canUndo: false,
    canRedo: false,
    // Table
    isInTable: false,
    canAddRowBefore: false,
    canAddRowAfter: false,
    canAddColumnBefore: false,
    canAddColumnAfter: false,
    canDeleteRow: false,
    canDeleteColumn: false,
    canDeleteTable: false,
    imageAttrs: null,
};

export type EditorCommand =
    | 'toggleBold'
    | 'toggleItalic'
    | 'toggleUnderline'
    | 'toggleStrike'
    | 'toggleCode'
    | 'toggleBulletList'
    | 'toggleOrderedList'
    | 'toggleTaskList'
    | 'sinkListItem'
    | 'liftListItem'
    | 'toggleBlockquote'
    | 'toggleCodeBlock'
    | 'toggleHeading'
    | 'setContent'
    | 'getContent'
    | 'focus'
    | 'blur'
    | 'undo'
    | 'redo'
    | 'setLink'
    | 'unsetLink'
    | 'showLinkPopover'
    | 'setHighlight'
    | 'unsetHighlight'
    | 'setColor'
    | 'unsetColor'
    | 'setYoutubeVideo'
    | 'setImage'
    // Table commands
    | 'insertTable'
    | 'addRowBefore'
    | 'addRowAfter'
    | 'addColumnBefore'
    | 'addColumnAfter'
    | 'deleteRow'
    | 'deleteColumn'
    | 'deleteTable'
    | 'setCellBackground'
    | 'unsetCellBackground'
    | 'setCodeBlockLanguage';

// ============================================================================
// Popup Types
// ============================================================================

export type PopupType = 'headings' | 'highlight' | 'textColor' | 'youtube' | 'link' | 'image' | 'table' | 'codeLanguage' | 'imageActions' | null;

export interface BasePopupProps {
    visible: boolean;
    onClose: () => void;
}

export interface HeadingPopupProps extends BasePopupProps {
    type: 'headings';
    currentLevel: HeadingLevel | null;
    onSelect: (level: HeadingLevel) => void;
}

export interface ColorPopupProps extends BasePopupProps {
    type: 'highlight' | 'textColor';
    currentColor: string | null;
    onSelect: (color: string) => void;
    onClear: () => void;
}

export interface YouTubePopupProps extends BasePopupProps {
    type: 'youtube';
    onSubmit: (url: string) => void;
}

export interface LinkPopupProps extends BasePopupProps {
    type: 'link';
    currentUrl: string | null;
    onSubmit: (url: string) => void;
    onRemove: () => void;
}

export interface ImagePopupProps extends BasePopupProps {
    type: 'image';
    onSubmit: (url: string) => void;
}

export interface TablePopupProps extends BasePopupProps {
    type: 'table';
    canAddRowBefore: boolean;
    canAddRowAfter: boolean;
    canAddColumnBefore: boolean;
    canAddColumnAfter: boolean;
    canDeleteRow: boolean;
    canDeleteColumn: boolean;
    canDeleteTable: boolean;
    onCommand: (command: string, params?: Record<string, unknown>) => void;
}

export interface CodeLanguagePopupProps extends BasePopupProps {
    type: 'codeLanguage';
    currentLanguage: string | null;
    onSelect: (language: string) => void;
}

export interface ImageInfo {
    src: string;
    width: string;
    position: number;
}



export type ToolbarPopupProps = HeadingPopupProps | ColorPopupProps | YouTubePopupProps | LinkPopupProps | ImagePopupProps | TablePopupProps | CodeLanguagePopupProps;


