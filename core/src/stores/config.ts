export interface StorageEngine {
    getItem: (name: string) => string | null | Promise<string | null>;
    setItem: (name: string, value: string) => void | Promise<void>;
    removeItem: (name: string) => void | Promise<void>;
    clear?: () => void | Promise<void>;
}

const memoryStorageData = new Map<string, string>();

const memoryStorage: StorageEngine = {
    getItem: (name) => memoryStorageData.get(name) ?? null,
    setItem: (name, value) => {
        memoryStorageData.set(name, value);
    },
    removeItem: (name) => {
        memoryStorageData.delete(name);
    },
    clear: () => {
        memoryStorageData.clear();
    },
};

export const storeEnv: { storage: StorageEngine | null } = {
    storage: null,
};

export const setStorageEngine = (engine: StorageEngine | null): void => {
    storeEnv.storage = engine;
};

export const getStorageEngine = (): StorageEngine => {
    return storeEnv.storage ?? memoryStorage;
};

export const createStorageAdapter = (): StorageEngine => ({
    getItem: (name) => getStorageEngine().getItem(name),
    setItem: (name, value) => getStorageEngine().setItem(name, value),
    removeItem: (name) => getStorageEngine().removeItem(name),
    clear: () => getStorageEngine().clear?.(),
});
