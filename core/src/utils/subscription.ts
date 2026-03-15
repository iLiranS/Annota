import { UserRole } from '../stores/user.store';

export function isPremiumUser(role: UserRole, subExpDate: string | null): boolean {
    // Guest (unauthenticated) - Always granted high limits
    if (role === null) {
        return true;
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
