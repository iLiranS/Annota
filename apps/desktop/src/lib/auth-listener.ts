import { authApi } from "@annota/core";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";

export async function initDeepLinkListener(
    onNavigate?: (url: string) => void,
    onSuccess?: () => void,
    onError?: (err: Error) => void
) {
    try {
        const unlisten = await onOpenUrl(async (urls) => {
            for (const url of urls) {
                // Handle Auth Callback
                if (url.startsWith("annota://login-callback") || url.startsWith("annota-desktop://login-callback")) {
                    try {
                        const urlObj = new URL(url);
                        const params = new URLSearchParams(urlObj.search || urlObj.hash.replace(/^#/, ''));

                        const code = params.get("code");
                        const access_token = params.get("access_token");
                        const refresh_token = params.get("refresh_token");
                        const errorDesc = params.get("error_description") || params.get("error");

                        if (errorDesc) {
                            throw new Error(errorDesc);
                        }

                        if (code) {
                            const { error } = await authApi.exchangeCodeForSession(code);
                            if (error) throw error;
                            onSuccess?.();
                        } else if (access_token && refresh_token) {
                            const { error } = await authApi.setSession(access_token, refresh_token);
                            if (error) throw error;
                            onSuccess?.();
                        }
                    } catch (err) {
                        console.error("Failed to handle auth callback:", err);
                        onError?.(err instanceof Error ? err : new Error(String(err)));
                    }
                }
                // Handle App Direct Links
                else if (url.startsWith("annota://")) {
                    onNavigate?.(url);
                }
            }
        });
        return unlisten;
    } catch (err) {
        console.warn("Deep link plugin not fully initialized or supported in this environment.", err);
        return () => { };
    }
}
