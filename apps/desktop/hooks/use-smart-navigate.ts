import { useCallback } from 'react';
import { NavigateOptions, To, useNavigate } from 'react-router-dom';

export function useSmartNavigate() {
    const navigate = useNavigate();

    const navigateSmart = useCallback((to: To | number, options?: NavigateOptions) => {
        if (typeof to === 'number') {
            return navigate(to);
        }

        navigate(to, options);
    }, [navigate]);

    return navigateSmart;
}
