import { HeadingLevel } from '@annota/core/constants/editor';
import React from 'react';

export interface ToolbarRenderProps {
    editorState: EditorState;
    sendCommand: (cmd: string, params?: Record<string, any>) => void;
    onCommand: (cmd: string, params?: Record<string, any>) => void;
    toolbarHeight: number;
    onDismissKeyboard: () => void;
    activePopup: PopupType;
    onActivePopupChange: (type: PopupType) => void;
    onPopupStateChange: (isOpen: boolean) => void;
    onInsertFile: (source: 'url' | 'library' | 'camera' | 'document', value?: string) => Promise<boolean>;
    currentLatex: string | null;
    blockData: any;
    onInsertMath: () => void;
}

export interface TipTapEditorRef {
    getContent: () => Promise<string>;
    setContent: (content: string) => void;
    focus: () => void;
    blur: () => void;
    onCommand: (cmd: string, params?: Record<string, any>) => void;
    // Search methods
    search: (term: string) => void;
    searchNext: () => void;
    searchPrev: () => void;
    clearSearch: () => void;
    scrollToElement: (id: string) => void;
}

export interface TipTapEditorProps {
    /** Note ID — required for local image storage association */
    noteId?: string;
    onOpenLink?: (url: string) => void;
    initialContent?: string;
    onContentChange?: (html: string) => void;
    placeholder?: string;
    autofocus?: boolean;
    /** Callback for search results from the editor */
    onSearchResults?: (count: number, currentIndex: number) => void;
    /** Extra padding at the top of the content (useful for transparent headers) */
    contentPaddingTop?: number;
    /** Called when the full-screen image gallery opens or closes */
    onGalleryVisibilityChange?: (visible: boolean) => void;
    /** Called when an image is selected (opens gallery) */
    onImageSelected?: (data: { images: ImageInfo[], currentIndex: number }) => void;
    /** Whether the editor is editable. Defaults to true. */
    editable?: boolean;
    /** Callback for when a block link is copied */
    onCopyBlockLink?: (blockId: string) => void;
    /** Callback for opening a block-specific menu (e.g. details, code block, table) */
    onOpenBlockMenu?: (e: MouseEvent, resolve: () => { pos: number; message: Record<string, unknown> } | null) => void;
    /** Callback for opening a table-specific menu */
    onOpenTableMenu?: (e: MouseEvent, resolve: () => { pos: number; message: Record<string, unknown> } | null) => void;
    /** Callback for opening an image/file-specific menu */
    onOpenFileMenu?: (e: MouseEvent, resolve: () => { pos: number; message: Record<string, unknown> } | null) => void;
    /** Callback for slash command state changes */
    onSlashCommand?: (data: { active: boolean; query?: string; range?: { from: number; to: number }; clientRect?: any }) => void;
    /** Callback for tag command state changes */
    onTagCommand?: (data: { active: boolean; query?: string; range?: { from: number; to: number }; clientRect?: any }) => void;
    /** Callback for note link command state (triggered by [[) */
    onNoteLinkCommand?: (data: { active: boolean; query?: string; range?: { from: number; to: number }; clientRect?: any }) => void;
    /** Render prop for customizing the slash command menu */
    renderSlashCommandMenu?: () => React.ReactNode;
    /** Callback for when the code block language selector is clicked */
    onCodeBlockSelected?: (e: MouseEvent, resolve: () => { pos: number; message: Record<string, unknown> } | null) => void;
    /** Render prop for customizing the toolbar and its popup menus */
    renderToolbar?: (props: ToolbarRenderProps) => React.ReactNode;
    /** Render prop for content to appear above the editor within the scroll container */
    renderHeader?: () => React.ReactNode;
    /** Render prop for full-screen image gallery and zoom */
    renderImageGallery?: (props: {
        images: ImageInfo[];
        initialIndex: number;
        visible: boolean;
        onClose: () => void;
        onNavigate: (index: number) => void;
    }) => React.ReactNode;
    /** Theme adaptation */
    isDark?: boolean;
    colors?: {
        primary: string;
        background: string;
        text: string;
    };
}

export interface EditorState {
    isFocused: boolean;
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
    currentHeadingId: string | null;

    // Links
    isLink: boolean;
    linkHref: string | null;
    selectedText: string;

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

    // Details
    isDetails: boolean;
    detailsBackgroundColor: string | null;
}

export const initialEditorState: EditorState = {
    isFocused: false,
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
    currentHeadingId: null,
    isLink: false,
    linkHref: null,
    selectedText: '',
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
    // Details
    isDetails: false,
    detailsBackgroundColor: null,
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
    | 'setCodeBlockLanguage'
    // Details commands
    | 'toggleDetails'
    | 'setDetailsBackground'
    | 'unsetDetailsBackground'
    | 'scrollToElement'
    // Modal commands
    | 'openMathModal'
    | 'openFileModal'
    | 'openLinkModal'
    | 'openYoutubeModal'

// ============================================================================
// Popup Types
// ============================================================================

export type PopupType = 'headings' | 'highlight' | 'textColor' | 'youtube' | 'link' | 'file' | 'table' | 'codeLanguage' | 'math' | 'detailsBackground' | 'blockMenu' | 'fileMenu' | null;

export interface BasePopupProps {
    visible: boolean;
    onClose: () => void;
    isLoading?: boolean;
}

export interface BlockMenuPopupProps extends BasePopupProps {
    type: 'blockMenu';
    blockType: 'codeBlock' | 'details' | string;
    onAction: (action: string, data?: any) => void;
    // Data passed from web view
    data: {
        content?: string;
        language?: string;
        currentColor?: string;
        [key: string]: any;
    };
}

export interface HeadingPopupProps extends BasePopupProps {
    type: 'headings';
    currentLevel: HeadingLevel | null;
    onSelect: (level: HeadingLevel) => void;
    onCopyLink?: () => void;
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
    selectedText: string;
    onSubmit: (url: string, title?: string) => void;
    onRemove: () => void;
}

export interface FilePopupProps extends BasePopupProps {
    type: 'file';
    onSubmit: (url: string) => void;
    onPickFromLibrary?: () => void;
    onPickDocument?: () => void;
    onTakePhoto?: () => void;
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

export interface MathPopupProps extends BasePopupProps {
    type: 'math';
    currentLatex: string | null;
    onSubmit: (latex: string) => void;
}

export interface DetailsBackgroundPopupProps extends BasePopupProps {
    type: 'detailsBackground';
    currentColor: string | null;
    onSelect: (color: string) => void;
    onClear: () => void;
}

export interface FileMenuPopupProps extends BasePopupProps {
    type: 'fileMenu';
    src: string;
    width: string;
    position: number;
    onAction: (action: string, data?: any) => void;
    mimeType?: string;
}


export type ToolbarPopupProps = HeadingPopupProps | ColorPopupProps | YouTubePopupProps | LinkPopupProps | FilePopupProps | TablePopupProps | CodeLanguagePopupProps | MathPopupProps | DetailsBackgroundPopupProps | BlockMenuPopupProps | FileMenuPopupProps;


