import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

export function useAlwaysOnTop() {
    const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

    useEffect(() => {
        const win = getCurrentWindow();
        
        const init = async () => {
            try {
                const onTop = await win.isAlwaysOnTop();
                setIsAlwaysOnTop(onTop);
            } catch (e) {
                console.error("Failed to check always on top status:", e);
            }
        };
        init();

        const unlisten = listen("always-on-top-changed", (event: any) => {
            if (event.payload.label === win.label) {
                setIsAlwaysOnTop(event.payload.isAlwaysOnTop);
            }
        });

        return () => {
            unlisten.then(f => f());
        };
    }, []);

    const toggleAlwaysOnTop = async () => {
        try {
            const win = getCurrentWindow();
            const current = await win.isAlwaysOnTop();
            const next = !current;
            await win.setAlwaysOnTop(next);
            setIsAlwaysOnTop(next);
            
            // Notify other instances in this window (and others, but we check label)
            emit("always-on-top-changed", { label: win.label, isAlwaysOnTop: next });
            
            return next;
        } catch (e) {
            console.error("Failed to toggle always on top:", e);
            return isAlwaysOnTop;
        }
    };

    return { isAlwaysOnTop, toggleAlwaysOnTop, setIsAlwaysOnTop };
}
