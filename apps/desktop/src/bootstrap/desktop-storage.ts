import type { StorageEngine } from "@annota/core";
import { Store } from "@tauri-apps/plugin-store";

let appStorePromise: Promise<Store> | null = null;

async function getAppStore(): Promise<Store> {
  if (!appStorePromise) {
    appStorePromise = Store.load("annota.app.store.json", { defaults: {}, autoSave: false });
  }
  return appStorePromise;
}

export function createDesktopStorageEngine(): StorageEngine {
  const cache = new Map<string, string | null>();

  return {
    getItem: async (name: string) => {
      if (cache.has(name)) {
        return cache.get(name) ?? null;
      }
      const store = await getAppStore();
      const value = await store.get(name);
      const strValue = typeof value === "string" ? value : null;
      cache.set(name, strValue);
      return strValue;
    },
    setItem: async (name: string, value: string) => {
      if (cache.get(name) === value) {
        return;
      }
      cache.set(name, value);
      const store = await getAppStore();
      await store.set(name, value);
      await store.save();
    },
    removeItem: async (name: string) => {
      cache.delete(name);
      const store = await getAppStore();
      await store.delete(name);
      await store.save();
    },
    clear: async () => {
      cache.clear();
      const store = await getAppStore();
      await store.clear();
      await store.save();
    },
  };
}
