import { sendMessage } from '../bridge';

/** SVG icons for the menu button — vertical three dots */
const THREE_DOTS_SVG_24 = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;
const THREE_DOTS_SVG_18 = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;

export interface BlockMenuButtonOptions {
    /** CSS class for the button (e.g. 'details-menu-btn', 'image-menu-btn') */
    className: string;
    /** Icon size: 'small' (18px) or 'normal' (24px). Defaults to 'normal'. */
    iconSize?: 'small' | 'normal';
    /**
     * Called when the button is clicked.
     * Should return the message object to send to the bridge,
     * along with the resolved block node position.
     * Return `null` to skip sending a message.
     */
    onResolve: () => { pos: number; message: Record<string, unknown> } | null;
    /**
     * Optional direct click handler. If provided, the standard bridge message logic is skipped
     * and this callback is responsible for handling the menu.
     */
    onClick?: (e: MouseEvent, resolve: () => { pos: number; message: Record<string, unknown> } | null) => void;
}

/**
 * Creates a reusable three-dot menu button element for block-level extensions.
 *
 * Handles:
 * - Creating the styled `<button>` DOM element
 * - Preventing event propagation (no unintended toggles / selections)
 * - Storing the block position in `window._lastBlockMenuPos`
 * - Sending the bridge message to React Native
 */
export function createBlockMenuButton(options: BlockMenuButtonOptions): HTMLButtonElement {
    const { className, iconSize = 'normal', onResolve, onClick } = options;

    const btn = document.createElement('button');
    btn.className = className;
    btn.innerHTML = iconSize === 'small' ? THREE_DOTS_SVG_18 : THREE_DOTS_SVG_24;
    btn.contentEditable = 'false';

    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (onClick) {
            onClick(e, onResolve);
            return;
        }

        const result = onResolve();
        if (!result) return;

        // Store position so subsequent commands (background, resize, etc.) can find this node
        window._lastBlockMenuPos = result.pos;

        sendMessage(result.message);
    };

    return btn;
}
