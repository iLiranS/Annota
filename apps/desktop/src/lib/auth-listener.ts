import { authApi } from "@annota/core";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { listen } from "@tauri-apps/api/event";

export async function initDeepLinkListener(
    onNavigate?: (url: string) => void,
    onSuccess?: () => void,
    onError?: (err: Error) => void
) {
    try {
        const unlisten = await onOpenUrl(async (urls) => {
            for (const url of urls) {
                // Handle Auth Callback
                if (url.startsWith("annota://login-callback")) {
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

        // Fallback for Windows where deep-link plugin may not automatically forward the URL
        const unlistenWindows = await listen<string[]>("deep-link-windows", (event) => {
            const urls = event.payload.filter(arg => arg.startsWith("annota://"));
            if (urls.length > 0) {
                // Manually trigger the same logic as onOpenUrl
                for (const url of urls) {
                    // Handle Auth Callback
                    if (url.startsWith("annota://login-callback")) {
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
                                void authApi.exchangeCodeForSession(code).then(({ error }) => {
                                    if (error) throw error;
                                    onSuccess?.();
                                }).catch(err => {
                                    onError?.(err instanceof Error ? err : new Error(String(err)));
                                });
                            } else if (access_token && refresh_token) {
                                void authApi.setSession(access_token, refresh_token).then(({ error }) => {
                                    if (error) throw error;
                                    onSuccess?.();
                                }).catch(err => {
                                    onError?.(err instanceof Error ? err : new Error(String(err)));
                                });
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
            }
        });

        return () => {
            unlisten();
            unlistenWindows();
        };
    } catch (err) {
        console.warn("Deep link plugin not fully initialized or supported in this environment.", err);
        return () => { };
    }
}
