export const loadingEl = document.getElementById('loading')!;

export function sendMessage(data: any) {
    const payload = JSON.stringify(data);
    if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(payload);
    } else if (window.parent && window.parent !== window) {
        // Talks to the Desktop App (Iframe)
        window.parent.postMessage(data, '*');
    } else {
        console.warn("No bridge available to send message:", data);
    }
}

export function showError(msg: string) {
    loadingEl.textContent = 'Error: ' + msg;
    loadingEl.style.color = 'red';
    sendMessage({ type: 'error', message: msg });
}
