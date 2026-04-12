const isBrowser = typeof document !== 'undefined';

export const loadingEl = isBrowser ? document.getElementById('loading') : null;

export function sendMessage(data: any) {
    const payload = JSON.stringify(data);
    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
        (window as any).ReactNativeWebView.postMessage(payload);
    } else if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        // Talks to the Desktop App (Iframe)
        window.parent.postMessage(data, '*');
    } else {
        // No bridge available to send message. This is expected when running 
        // as a direct component (e.g. in the Desktop app) rather than embedded.
    }
}

export function showError(msg: string) {
    if (loadingEl) {
        loadingEl.textContent = 'Error: ' + msg;
        (loadingEl as any).style.color = 'red';
    }
    sendMessage({ type: 'error', message: msg });
}
