export const DESKTOP_SELECTION_STYLES = `
    .editor-dom-container.annota-pretty-selection .annota-selection-covered ::selection,
    .editor-dom-container.annota-pretty-selection .annota-selection-covered::selection {
        background-color: transparent !important;
    }
    .editor-dom-container.annota-pretty-selection .annota-selection-covered ::-moz-selection,
    .editor-dom-container.annota-pretty-selection .annota-selection-covered::-moz-selection {
        background-color: transparent !important;
    }
    .editor-dom-container .annota-selection-covered {
        outline: 2px solid var(--accent-color, var(--block-selection-border, rgba(0, 122, 255, 0.6)));
        outline-offset: -2px;
        transition: outline-color 0.12s ease;
    }
    .editor-dom-container .code-block-wrapper.annota-selection-covered,
    .editor-dom-container .mermaid-block.annota-selection-covered,
    .editor-dom-container .flashcard-block.annota-selection-covered,
    .editor-dom-container [data-type="details"].annota-selection-covered,
    .editor-dom-container [data-type="blockMath"].annota-selection-covered,
    .editor-dom-container [data-type="block-math"].annota-selection-covered,
    .editor-dom-container .tiptap-mathematics-render[data-type="block-math"].annota-selection-covered,
    .editor-dom-container .image-node-wrapper.annota-selection-covered,
    .editor-dom-container .quote-wrapper.annota-selection-covered,
    .editor-dom-container blockquote.annota-selection-covered {
        box-shadow: inset 0 0 0 9999px var(--block-selection-bg, rgba(0, 122, 255, 0.12));
    }
    .editor-dom-container .tableWrapper.annota-selection-covered table {
        box-shadow: inset 0 0 0 9999px var(--block-selection-bg, rgba(0, 122, 255, 0.12));
    }
`;
