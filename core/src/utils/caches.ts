export class LRUCache<K, V> {
    private cache = new Map<K, V>();
    private limit: number;

    constructor(limit: number) {
        this.limit = limit;
    }

    get(key: K): V | undefined {
        if (!this.cache.has(key)) return undefined;
        const val = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, val);
        return val;
    }

    set(key: K, value: V): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.limit) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }

    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }
}

export const noteContentCache = new LRUCache<string, string>(25);
export const latestVersionCache = new LRUCache<string, { id: string; createdAt: Date }>(25);
export const noteLinksCache = new LRUCache<string, string[]>(25);
export const noteFilesCache = new LRUCache<string, string[]>(25);
