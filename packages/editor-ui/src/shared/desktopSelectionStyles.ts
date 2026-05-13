export const DESKTOP_SELECTION_STYLES = `
    .editor-dom-container .code-block-wrapper ::selection,
    .editor-dom-container .code-block-wrapper::-moz-selection {
        background-color: var(--code-selection-bg, rgba(120, 160, 255, 0.35)) !important;
        color: inherit !important;
    }

    /* ProseMirror NodeSelection styling */
    .ProseMirror-selectednode {
        outline: 2px solid var(--accent-color, rgba(0, 122, 255, 0.6));
        outline-offset: -2px;
        box-shadow: inset 0 0 0 9999px var(--block-selection-bg, rgba(0, 122, 255, 0.12));
    }

    .tableWrapper.ProseMirror-selectednode table {
        box-shadow: inset 0 0 0 9999px var(--block-selection-bg, rgba(0, 122, 255, 0.12));
    }
`;
