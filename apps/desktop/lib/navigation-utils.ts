/**
 * Identifies if a given path is considered "Content" (Notes or Folder navigation).
 * Used by the smart navigation system to determine history tracking.
 */
export function isContentPath(path: string): boolean {
    const cleanPath = path.split('?')[0];
    return cleanPath.startsWith('/notes') && !cleanPath.startsWith('/notes/trash');
}
