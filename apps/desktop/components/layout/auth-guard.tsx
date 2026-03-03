import { useUserStore } from "@annota/core";
import { Navigate, Outlet } from "react-router-dom";

/**
 * Protects app routes: redirects to login if unauthenticated,
 * or to master-key setup if missing encryption key.
 */
export default function AuthGuard() {
    const session = useUserStore((s) => s.session);
    const user = useUserStore((s) => s.user);
    const isGuest = useUserStore((s) => s.isGuest);
    const hasMasterKey = useUserStore((s) => s.hasMasterKey);

    const isAuthenticated = !!session?.user || !!user || isGuest;

    if (!isAuthenticated) {
        return <Navigate to="/auth/login" replace />;
    }

    // Guests skip master-key check
    if (!isGuest && !hasMasterKey) {
        return <Navigate to="/auth/master-key" replace />;
    }

    return <Outlet />;
}
