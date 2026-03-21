import type { PlatformAdapters } from '@annota/core/platform';
import { invoke } from '@tauri-apps/api/core';
import { appCacheDir, appDataDir, join } from '@tauri-apps/api/path';
import { copyFile, mkdir, readFile, remove, stat, writeFile } from '@tauri-apps/plugin-fs';
import { fetch } from '@tauri-apps/plugin-http';
import { openPath } from '@tauri-apps/plugin-opener';
import { Store } from '@tauri-apps/plugin-store';
import { encode as encodeArrayBuffer } from 'base64-arraybuffer';

type Scope = 'images' | 'cache' | 'files';

const dirCache = new Map<Scope, string>();

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function toStrictUint8Array(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(toArrayBuffer(bytes));
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

function makeTempFilename(ext: string): string {
  const id =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${id}.${ext}`;
}

async function ensureScopedDir(scope: Scope): Promise<string> {
  const cached = dirCache.get(scope);
  if (cached) return cached;

  const baseDir = (scope === 'images' || scope === 'files') ? await appDataDir() : await appCacheDir();
  const dir = await join(baseDir, `annota-${scope}`);
  await mkdir(dir, { recursive: true });
  dirCache.set(scope, dir);
  return dir;
}

async function readFileBytes(path: string): Promise<Uint8Array> {
  const data = await readFile(path);
  return new Uint8Array(data);
}

async function writeFileBytes(path: string, bytes: Uint8Array): Promise<void> {
  await writeFile(path, toStrictUint8Array(bytes));
}



export function createDesktopAdapters(): PlatformAdapters {
  return {
    network: {
      subscribe: (onChange) => {
        const online = () => onChange(true);
        const offline = () => onChange(false);
        window.addEventListener('online', online);
        window.addEventListener('offline', offline);
        return () => {
          window.removeEventListener('online', online);
          window.removeEventListener('offline', offline);
        };
      },
    },
    appState: {
      subscribe: (onChange) => {
        // Emit a boolean, and only check if the window is truly hidden
        const emitState = () => onChange(!document.hidden);

        const visibility = () => emitState();

        document.addEventListener('visibilitychange', visibility);

        // Fire immediately to set the initial state!
        emitState();

        return () => {
          document.removeEventListener('visibilitychange', visibility);
        };
      },
    },
    toast: {
      show: ({ type, title, message }) => {
        const detail = { type, title, message };
        window.dispatchEvent(new CustomEvent('annota:toast', { detail }));
        console.log(`[Toast:${type}] ${title}${message ? ` - ${message}` : ''}`);
      },
    },
    secureStore: {
      setItem: async (key, value) => {
        const store = await Store.load('annota.secure.store.json', { defaults: {}, autoSave: false });
        await store.set(key, value);
        await store.save();
      },
      getItem: async (key) => {
        const store = await Store.load('annota.secure.store.json', { defaults: {}, autoSave: false });
        const value = await store.get(key);
        return typeof value === 'string' ? value : null;
      },
      removeItem: async (key) => {
        const store = await Store.load('annota.secure.store.json', { defaults: {}, autoSave: false });
        await store.delete(key);
        await store.save();
      },
    },
    crypto: {
      randomBytes: (size) => {
        const bytes = new Uint8Array(size);
        globalThis.crypto.getRandomValues(bytes);
        return bytes;
      },
      sha256HexUtf8: async (data) => {
        const bytes = new TextEncoder().encode(data);
        const digest = await globalThis.crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
        return bytesToHex(new Uint8Array(digest));
      },
      aes256GcmEncrypt: async ({ key, nonce, plaintext }) => {
        const keyBytes = toStrictUint8Array(key);
        const nonceBytes = toStrictUint8Array(nonce);
        const plaintextBytes = toStrictUint8Array(plaintext);

        const cryptoKey = await globalThis.crypto.subtle.importKey(
          'raw',
          toArrayBuffer(keyBytes),
          { name: 'AES-GCM' },
          false,
          ['encrypt'],
        );

        const encrypted = await globalThis.crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: toArrayBuffer(nonceBytes), tagLength: 128 },
          cryptoKey,
          toArrayBuffer(plaintextBytes),
        );
        const encryptedBytes = new Uint8Array(encrypted);
        const ciphertext = encryptedBytes.subarray(0, encryptedBytes.length - 16);
        const authTag = encryptedBytes.subarray(encryptedBytes.length - 16);
        return {
          ciphertext: new Uint8Array(ciphertext),
          authTag: new Uint8Array(authTag),
        };
      },
      aes256GcmDecrypt: async ({ key, nonce, ciphertext, authTag }) => {
        const keyBytes = toStrictUint8Array(key);
        const nonceBytes = toStrictUint8Array(nonce);
        const ciphertextBytes = toStrictUint8Array(ciphertext);
        const authTagBytes = toStrictUint8Array(authTag);

        const cryptoKey = await globalThis.crypto.subtle.importKey(
          'raw',
          toArrayBuffer(keyBytes),
          { name: 'AES-GCM' },
          false,
          ['decrypt'],
        );
        const joined = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
        joined.set(ciphertextBytes, 0);
        joined.set(authTagBytes, ciphertextBytes.length);
        const decrypted = await globalThis.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: toArrayBuffer(nonceBytes), tagLength: 128 },
          cryptoKey,
          toArrayBuffer(joined),
        );
        return new Uint8Array(decrypted);
      },
    },
    fileSystem: {
      ensureDir: async (scope) => {
        return await ensureScopedDir(scope);
      },
      copyFile: async (from, to) => {
        await copyFile(from, to);
      },
      deleteFile: async (path) => {
        await remove(path);
      },
      readBase64: async (path) => {
        const bytes = await readFileBytes(path);
        return encodeArrayBuffer(toArrayBuffer(bytes));
      },
      readBytes: async (path) => {
        return await readFileBytes(path);
      },
      writeBytes: async (path, bytes) => {
        await writeFileBytes(path, bytes);
      },
      getSize: async (path) => {
        const info = await stat(path);
        return typeof info.size === 'number' ? info.size : 0;
      },
      downloadToTemp: async (url) => {
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB limit
        const tempDir = await ensureScopedDir('cache');
        const path = await join(tempDir, makeTempFilename('bin'));

        const cleanup = async () => {
          try { await remove(path); } catch { }
        };

        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to download file: ${response.status}`);
          }

          const contentLength = response.headers.get("content-length");
          if (contentLength && Number(contentLength) > MAX_SIZE) {
            throw new Error("Image too large");
          }

          const contentType = response.headers.get("content-type");
          if (!contentType?.startsWith("image/") && contentType !== "application/pdf") {
            throw new Error("URL does not point to a supported file type (image or pdf)");
          }

          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.length > MAX_SIZE) {
            throw new Error("Image too large");
          }

          await writeFileBytes(path, bytes);
          return {
            path,
            cleanup
          };
        } catch (error) {
          await cleanup();
          throw error;
        }
      },
      toImageUrl: async (path: string) => {
        try {
          // 1. Read the raw bytes. If Tauri blocks the absolute path, this will throw.
          const fileBytes = await readFile(path);

          // 2. Map the correct mime type
          const mime = path.endsWith('.webp') ? 'image/webp' :
            path.endsWith('.png') ? 'image/png' : 'image/jpeg';

          // 3. Use the native browser engine to handle the base64 conversion.
          // This is lightning fast and handles massive files without crashing.
          const base64Uri = await new Promise<string>((resolve, reject) => {
            const blob = new Blob([fileBytes], { type: mime });
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob); // Directly outputs "data:image/jpeg;base64,..."
          });

          return base64Uri;
        } catch (error) {
          // If you see this in your terminal/console, Tauri is blocking the path.
          console.error("Desktop Adapter: Failed to load image at path:", path, error);
          return ""; // Return empty to prevent malformed src injection
        }
      },
      openFile: async (path: string) => {
        try {
          await openPath(path);
        } catch (error) {
          console.error("Desktop Adapter: Failed to open file:", path, error);
        }
      }
    },
    image: {
      resizeAndCompress: async (sourcePath: string, opts: any) => {
        try {
          const cacheDir = await ensureScopedDir('cache');

          const outPath = await join(cacheDir, makeTempFilename('webp'));

          // Tauri expects a u8 integer for quality (1-100).
          const normalizedQuality = opts.quality <= 1 ? Math.round(opts.quality * 100) : opts.quality;

          // Call the Rust backend!
          const [width, height] = await invoke<[number, number]>('compress_image_native', {
            sourcePath,
            outputPath: outPath,
            maxDimension: opts.maxDimension,
            quality: normalizedQuality,
          });

          return { path: outPath, width, height };
        } catch (error) {
          console.error("Native compression failed:", error);
          throw error;
        }
      },
      requestGalleryPermission: async () => {
        return true;
      },
      saveToGallery: async (path) => {
        const info = await stat(path);
        return Boolean(info);
      },
    },
  };
}
