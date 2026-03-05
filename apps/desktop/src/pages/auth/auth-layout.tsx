import { useUserStore } from "@annota/core";
import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

export default function AuthLayout() {
    const session = useUserStore((s) => s.session);
    const hasMasterKey = useUserStore((s) => s.hasMasterKey);
    const isGuest = useUserStore((s) => s.isGuest);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // If the user arrives at or is currently on an auth page, but their session
        // is populated (e.g., from a deep-link callback), route them to the correct place.
        if (session || isGuest) {
            const isAtMasterKeySetup = location.pathname.includes("master-key") || location.pathname.includes("lost-key");

            if (isGuest) {
                navigate("/", { replace: true });
            } else if (hasMasterKey === false && !isAtMasterKeySetup) {
                navigate("/auth/master-key", { replace: true });
            } else if (hasMasterKey === true && !isAtMasterKeySetup) {
                navigate("/", { replace: true });
            }
        }
    }, [session, isGuest, hasMasterKey, location.pathname, navigate]);

    return (
        <div className="relative flex min-h-screen flex-col bg-background">
            {/* Tauri Drag Region */}
            <div
                data-tauri-drag-region
                className="absolute top-0 left-0 right-0 h-10 z-50 cursor-default"
            />

            <div className="flex flex-1 items-center justify-center p-6">
                <div className="w-full max-w-md">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
