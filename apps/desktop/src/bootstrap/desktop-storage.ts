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
  return {
    getItem: async (name: string) => {
      const store = await getAppStore();
      const value = await store.get(name);
      return typeof value === "string" ? value : null;
    },
    setItem: async (name: string, value: string) => {
      const store = await getAppStore();
      await store.set(name, value);
      await store.save();
    },
    removeItem: async (name: string) => {
      const store = await getAppStore();
      await store.delete(name);
      await store.save();
    },
    clear: async () => {
      const store = await getAppStore();
      await store.clear();
      await store.save();
    },
  };
}
