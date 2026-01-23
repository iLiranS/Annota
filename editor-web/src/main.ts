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
    const link = target.closest('a');
    if (link && (link as HTMLAnchorElement).href) {
        // Prevent default only if we are not in editable state? 
        // Actually for now let's just allow editing links by click? 
        // Or if we want to follow, we need ctrl+click? 
        // Native behavior: usually long press or bubble menu. 
        // But for this webview, if it's a link, we might want to intercept.
        // Let's keep existing logic to open external links.

        e.preventDefault();
        e.stopPropagation();
        sendMessage({ type: 'openLink', href: (link as HTMLAnchorElement).href });
    }
});

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
