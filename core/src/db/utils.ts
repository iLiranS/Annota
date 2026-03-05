/**
 * Helper utilities to mitigate Tauri SQLite driver quirks where single objects
 * may be wrapped in arrays, or full result sets contain nested arrays.
 */

export function safeGet<T>(row: unknown): T | null {
    if (!row) return null;
    const record = Array.isArray(row) ? row[0] : row;
    if (record && typeof record === 'object') {
        return record as T;
    }
    return null;
}

export function safeGetAll<T>(rows: unknown): T[] {
    if (!rows) return [];
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
        const record = Array.isArray(row) ? row[0] : row;
        return record as T;
    });
}
