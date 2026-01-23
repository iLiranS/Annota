export const loadingEl = document.getElementById('loading')!;

export function sendMessage(data: any) {
    if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
}

export function showError(msg: string) {
    loadingEl.textContent = 'Error: ' + msg;
    loadingEl.style.color = 'red';
    sendMessage({ type: 'error', message: msg });
}
