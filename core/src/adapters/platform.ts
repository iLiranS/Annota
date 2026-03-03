export type Unsubscribe = () => void;

export interface PlatformAdapters {
    network: {
        subscribe: (onChange: (isOnline: boolean) => void) => Unsubscribe;
    };
    appState: {
        subscribe: (onChange: (isActive: boolean) => void) => Unsubscribe;
    };
    toast: {
        show: (opts: { type: 'success' | 'error' | 'info'; title: string; message?: string }) => void;
    };

    secureStore: {
        setItem: (key: string, value: string) => Promise<void>;
        getItem: (key: string) => Promise<string | null>;
        removeItem: (key: string) => Promise<void>;
    };

    crypto: {
        randomBytes: (size: number) => Uint8Array;
        sha256HexUtf8: (data: string) => Promise<string>;
        /**
         * Note for future desktop implementation: Web Crypto API appends the 16-byte authTag 
         * to the end of the ciphertext as a single ArrayBuffer. Remember to slice the last 
         * 16 bytes off the array when writing the desktop adapter.
         */
        aes256GcmEncrypt: (params: { key: Uint8Array; nonce: Uint8Array; plaintext: Uint8Array }) => Promise<{ ciphertext: Uint8Array; authTag: Uint8Array }>;
        aes256GcmDecrypt: (params: { key: Uint8Array; nonce: Uint8Array; ciphertext: Uint8Array; authTag: Uint8Array }) => Promise<Uint8Array>;
    };

    fileSystem: {
        ensureDir: (scope: 'images' | 'cache') => Promise<string>;
        copyFile: (from: string, to: string) => Promise<void>;
        deleteFile: (path: string) => Promise<void>;
        readBase64: (path: string) => Promise<string>;
        readBytes: (path: string) => Promise<Uint8Array>;
        writeBytes: (path: string, bytes: Uint8Array) => Promise<void>;
        getSize: (path: string) => Promise<number>;
        downloadToTemp: (url: string) => Promise<{ path: string; cleanup: () => Promise<void> }>;
    };

    image: {
        resizeAndCompress: (sourcePath: string, opts: { maxDimension: number; quality: number; format: 'webp' }) => Promise<{ path: string; width: number; height: number }>;
        saveToGallery: (path: string) => Promise<boolean>; // save as in Tauri later
        requestGalleryPermission: () => Promise<boolean>;
    };
}
