import { useCallback } from 'react';
import { NavigateOptions, To, useLocation, useNavigate } from 'react-router-dom';
import { isContentPath } from '../lib/navigation-utils';

/**
 * A custom hook that provides a smart navigate function.
 * 
 * Rules for tracking behavior:
 * 1. Content -> Content: PUSH (Adds to history so you can go back and forth between notes)
 * 2. Content -> Non-Content: PUSH (Adds the non-content page tip to history)
 * 3. Non-Content -> Non-Content: REPLACE (Ensures only one non-content page is at the history tip)
 * 4. Non-Content -> Content: REPLACE (Removes the non-content tip so it's skipped when going back from content)
 * 
 * This effectively ensures that clicking 'Back' from any note/folder will return directly 
 * to the previous note/folder, even if you visited Settings, Home, or Trash in between.
 */
export function useSmartNavigate() {
    const navigate = useNavigate();
    const location = useLocation();

    const navigateSmart = useCallback((to: To | number, options?: NavigateOptions) => {
        if (typeof to === 'number') {
            return navigate(to);
        }

        const currentPath = location.pathname;

        const isCurrentContent = isContentPath(currentPath);

        // If we are currently NOT on content, any navigation away from it should be a REPLACE
        // unless explicitly requested to push.
        // CRITICAL: We MUST NOT replace if we are passing a background state (modal route),
        // otherwise we won't be able to go back to the current page when closing the modal.
        const isModalNav = !!(options?.state as any)?.background;
        const shouldReplace = options?.replace ?? (!isCurrentContent && !isModalNav);

        navigate(to, { ...options, replace: shouldReplace });
    }, [location, navigate]);

    return navigateSmart;
}
