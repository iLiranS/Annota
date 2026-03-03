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
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
            <div className="w-full max-w-md">
                <Outlet />
            </div>
        </div>
    );
}
