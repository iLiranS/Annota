import 'highlight.js/styles/atom-one-dark.css'; // Better looking theme
import 'katex/dist/katex.min.css';
import './styles.css';

import { loadingEl, sendMessage } from './bridge';
import { setupCommands } from './commands';
import { editorEl, setupEditor } from './editor-core';
import { setupImageResolver, setupImageUpdater } from './extensions/image';
import './types';

// Initialize Helpers
setupCommands();
setupImageUpdater();
setupImageResolver();

let lastLinkDispatch: { href: string; ts: number } | null = null;
let suppressFocusUntil = 0;

function dispatchOpenLink(href: string) {
    const now = Date.now();
    if (lastLinkDispatch && lastLinkDispatch.href === href && now - lastLinkDispatch.ts < 500) {
        return;
    }
    lastLinkDispatch = { href, ts: now };
    sendMessage({ type: 'openLink', href });
}

function blurEditorForLinkInteraction() {
    const editor = (window as any).editor;
    if (!editor) return;

    try {
        editor.commands.blur();
        if (editor.view?.dom instanceof HTMLElement) {
            editor.view.dom.blur();
        }
    } catch {
        // Ignore transient blur failures.
    }
}

function handleLinkInteractionStart(e: Event) {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const link = target.closest('a') as HTMLAnchorElement | null;
    if (!link?.href) return;

    if ('button' in e && typeof (e as PointerEvent).button === 'number' && (e as PointerEvent).button !== 0) {
        return;
    }

    // Prevent ProseMirror handlers from selecting/focusing while still allowing natural scrolling.
    e.stopPropagation();
    suppressFocusUntil = Date.now() + 800;
    blurEditorForLinkInteraction();
}

editorEl.addEventListener('pointerdown', handleLinkInteractionStart, true);
editorEl.addEventListener('touchstart', handleLinkInteractionStart, { capture: true, passive: false });
editorEl.addEventListener('mousedown', handleLinkInteractionStart, true);
editorEl.addEventListener('focusin', function (e) {
    if (Date.now() <= suppressFocusUntil) {
        e.stopPropagation();
        blurEditorForLinkInteraction();
    }
}, true);

editorEl.addEventListener('click', function (e) {
    const target = e.target as HTMLElement;

    // Handle link clicks
    const link = target.closest('a') as HTMLAnchorElement | null;
    if (link?.href) {
        e.preventDefault();
        e.stopPropagation();
        dispatchOpenLink(link.href);
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

// Height reporting for React Native ScrollView integration
const resizeObserver = new ResizeObserver(() => {
    // Measure actual DOM content without relying on scrollHeight
    // because container has min-height: 100vh which creates an infinite loop
    // when the WebView resizes
    const pm = document.querySelector('.ProseMirror');
    let contentBottom = 0;

    if (pm) {
        // Get the bottom-most point of the last child element
        const lastChild = pm.lastElementChild;
        if (lastChild) {
            const rect = lastChild.getBoundingClientRect();
            // rect.bottom is relative to viewport top (which is 0 since we overflow:hidden in body)
            contentBottom = rect.bottom;
        } else {
            const rect = pm.getBoundingClientRect();
            contentBottom = rect.bottom;
        }
    }

    // Add padding-bottom matching editor-container (80px)
    const totalHeight = contentBottom + 80;

    sendMessage({ type: 'heightChange', height: totalHeight });
});

resizeObserver.observe(document.body);
const container = document.getElementById('editor-container');
if (container) resizeObserver.observe(container);
const content = document.getElementById('editor-content');
if (content) resizeObserver.observe(content);

// Notify Ready
sendMessage({ type: 'ready' });

// Auto-init for debugging in browser (no bridge and not in iframe)
const inIframe = window !== window.parent;
if (!window.ReactNativeWebView && !inIframe) {
    loadingEl.textContent = 'No Bridge detected. Auto-init...';
    console.log('No WebView bridge found, auto-initializing defaults...');
    setTimeout(() => {
        setupEditor({
            content: '<p>Debug Mode (No Bridge)</p><p>Math: <span data-type="math" data-latex="E=mc^2"></span></p>',
            autofocus: true
        });
    }, 1000);
}
