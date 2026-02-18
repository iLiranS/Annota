import 'highlight.js/styles/atom-one-dark.css'; // Better looking theme
import 'katex/dist/katex.min.css';
import './styles.css';

import { loadingEl, sendMessage } from './bridge';
import { setupCommands } from './commands';
import { editorEl, setupEditor } from './editor-core';
import { setupImageUpdater } from './extensions/image';
import './types';

// Initialize Helpers
setupCommands();
setupImageUpdater();

editorEl.addEventListener('click', function (e) {
    const target = e.target as HTMLElement;

    // Handle link clicks
    const link = target.closest('a');
    if (link && (link as HTMLAnchorElement).href) {
        e.preventDefault();
        e.stopPropagation();
        sendMessage({ type: 'openLink', href: (link as HTMLAnchorElement).href });
        return;
    }
});

// Details toggle handler - properly syncs DOM and Tiptap model
let lastToggleTime = 0;
const TOGGLE_DEBOUNCE_MS = 300;
const ARROW_CLICK_ZONE_WIDTH = 40; // px from the left edge of summary where arrow is

function toggleDetailsSection(detailsEl: Element) {
    const editor = (window as any).editor;
    if (!editor) return;

    // Debounce to prevent double toggles
    const now = Date.now();
    if (now - lastToggleTime < TOGGLE_DEBOUNCE_MS) {
        return;
    }
    lastToggleTime = now;

    try {
        // Find the position of this details element in the document
        let targetPos: number | null = null;
        let targetNode: any = null;

        editor.state.doc.descendants((node: any, pos: number) => {
            if (node.type.name === 'details' && targetPos === null) {
                try {
                    const domNode = editor.view.nodeDOM(pos);
                    if (domNode === detailsEl || (domNode && domNode.contains(detailsEl)) || detailsEl.contains(domNode as Node)) {
                        targetPos = pos;
                        targetNode = node;
                        return false;
                    }
                } catch (e) {
                    // Continue searching
                }
            }
            return true;
        });

        if (targetPos !== null && targetNode) {
            const isCurrentlyOpen = targetNode.attrs.open;
            const newOpenState = !isCurrentlyOpen;

            editor.chain()
                .command(({ tr }: any) => {
                    tr.setNodeMarkup(targetPos, undefined, { ...targetNode.attrs, open: newOpenState });
                    return true;
                })
                .run();
        } else {
            // Fallback: Just toggle DOM
            const isCurrentlyOpen = detailsEl.getAttribute('data-open') === 'true';
            const newOpenState = !isCurrentlyOpen;
            detailsEl.setAttribute('data-open', newOpenState ? 'true' : 'false');
            if (newOpenState) {
                detailsEl.setAttribute('open', '');
            } else {
                detailsEl.removeAttribute('open');
            }
        }
    } catch (err) {
        console.warn('Failed to toggle details:', err);
        // Fallback: Just toggle DOM
        const isCurrentlyOpen = detailsEl.getAttribute('data-open') === 'true';
        const newOpenState = !isCurrentlyOpen;
        detailsEl.setAttribute('data-open', newOpenState ? 'true' : 'false');
        if (newOpenState) {
            detailsEl.setAttribute('open', '');
        } else {
            detailsEl.removeAttribute('open');
        }
    }
}

// Check if click is in the arrow zone (left side in LTR, right side in RTL)
function isClickInArrowZone(e: MouseEvent, summary: Element): boolean {
    const rect = summary.getBoundingClientRect();
    // Check if the document or the summary's parent is in RTL direction
    const direction = window.getComputedStyle(summary).direction;
    if (direction === 'rtl') {
        // In RTL, the arrow ::before is on the right side
        const clickFromRight = rect.right - e.clientX;
        return clickFromRight <= ARROW_CLICK_ZONE_WIDTH;
    }
    const clickX = e.clientX - rect.left;
    return clickX <= ARROW_CLICK_ZONE_WIDTH;
}

// Handle click on summary - only toggle if clicking on arrow zone
function handleSummaryClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Skip if clicking on the menu button or its children
    if (target.closest('.details-menu-btn')) return;

    const summary = target.closest('[data-type="detailsSummary"]') || target.closest('.details-summary');
    if (!summary) return;

    // Only toggle if clicking in the arrow zone (left side in LTR, right side in RTL)
    if (!isClickInArrowZone(e, summary)) return;

    const details = summary.closest('[data-type="details"]') || summary.closest('.details-wrapper');
    if (!details) return;

    e.preventDefault();
    e.stopPropagation();

    // Clear any selection that might have started
    window.getSelection()?.removeAllRanges();

    toggleDetailsSection(details);
}

// Prevent text selection when mousedown on arrow zone
function handleSummaryMousedown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Skip if clicking on the menu button or its children
    if (target.closest('.details-menu-btn')) return;

    const summary = target.closest('[data-type="detailsSummary"]') || target.closest('.details-summary');
    if (!summary) return;

    // Only prevent default in arrow zone
    if (isClickInArrowZone(e, summary)) {
        e.preventDefault();
    }
}

// Event listeners
document.addEventListener('click', handleSummaryClick, true);
document.addEventListener('mousedown', handleSummaryMousedown, true);

// Notify Ready
sendMessage({ type: 'ready' });

// Auto-init for debugging in browser (no bridge)
if (!window.ReactNativeWebView) {
    loadingEl.textContent = 'No Bridge detected. Auto-init...';
    console.log('No WebView bridge found, auto-initializing defaults...');
    setTimeout(() => {
        setupEditor({
            content: '<p>Debug Mode (No Bridge)</p><p>Math: <span data-type="math" data-latex="E=mc^2"></span></p>',
            autofocus: true
        });
    }, 1000);
}
