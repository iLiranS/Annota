import { UserRole, useUserStore } from '../stores/user.store';

export function isPremiumUser(role: UserRole, subExpDate: string | null): boolean {
    // Guest (unauthenticated) - Not premium
    if (role === null) {
        return false;
    }

    // Explicitly Free
    if (role === 'FREE') {
        return false;
    }

    // PRO/Other MUST have a valid expiry date in the future
    if (!subExpDate) {
        return false;
    }

    const expiry = new Date(subExpDate);
    const now = new Date();

    return expiry > now;
}

export function useIsPremium(): boolean {
    const role = useUserStore((state) => state.role);
    const subExpDate = useUserStore((state) => state.sub_exp_date);
    return isPremiumUser(role, subExpDate);
}

