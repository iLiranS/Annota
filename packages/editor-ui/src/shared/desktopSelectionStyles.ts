export const DESKTOP_SELECTION_STYLES = `
    .editor-dom-container .code-block-wrapper ::selection,
    .editor-dom-container .code-block-wrapper::-moz-selection {
        background-color: var(--code-selection-bg, rgba(120, 160, 255, 0.35)) !important;
        color: inherit !important;
    }

    /* ProseMirror NodeSelection styling */
    /* Aggressive inset shadow only for known block-level containers */
    .ProseMirror-selectednode.tableWrapper,
    .ProseMirror-selectednode.flashcard-block,
    .ProseMirror-selectednode.mermaid-block,
    .ProseMirror-selectednode.code-block-wrapper {
        outline: 2px solid var(--accent-color, rgba(0, 122, 255, 0.6));
        outline-offset: -2px;
        box-shadow: inset 0 0 0 9999px var(--block-selection-bg, rgba(0, 122, 255, 0.12));
    }

    /* Standard background for everything else (especially inline nodes like Math) to prevent bleeding */
    .ProseMirror-selectednode:not(.tableWrapper):not(.flashcard-block):not(.mermaid-block):not(.code-block-wrapper) {
        outline: 2px solid var(--accent-color, rgba(0, 122, 255, 0.6));
        outline-offset: -2px;
        background-color: var(--block-selection-bg, rgba(0, 122, 255, 0.12)) !important;
        box-shadow: none !important;
    }

    .tableWrapper.ProseMirror-selectednode table {
        box-shadow: inset 0 0 0 9999px var(--block-selection-bg, rgba(0, 122, 255, 0.12));
    }

    .ProseMirror-hideselection ::selection,
    .ProseMirror-hideselection *::selection {
        background-color: transparent !important;
        // color: transparent !important;
    }

    .ProseMirror-hideselection::-moz-selection,
    .ProseMirror-hideselection *::-moz-selection {
        background-color: transparent !important;
        // color: transparent !important;
    }
`;
