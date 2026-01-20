import { HeadingLevel } from './color-palette';

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
    canSinkListItem: boolean;
    canLiftListItem: boolean;

    // Blocks
    isBlockquote: boolean;
    isCodeBlock: boolean;

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
}

export const initialEditorState: EditorState = {
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrike: false,
    isCode: false,
    isBulletList: false,
    isOrderedList: false,
    canSinkListItem: false,
    canLiftListItem: false,
    isBlockquote: false,
    isCodeBlock: false,
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
};

export type EditorCommand =
    | 'toggleBold'
    | 'toggleItalic'
    | 'toggleUnderline'
    | 'toggleStrike'
    | 'toggleCode'
    | 'toggleBulletList'
    | 'toggleOrderedList'
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
    | 'setImage';
