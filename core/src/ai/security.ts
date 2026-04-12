import { load } from '@tauri-apps/plugin-store';
import { hostname } from '@tauri-apps/plugin-os';

export type SecureProviderKey = 'openai' | 'anthropic' | 'google';

// Derive a CryptoKey from the machine hostname using PBKDF2
async function getDerivedKey(): Promise<CryptoKey> {
    const machineName = await hostname().catch(() => 'annota-fallback');
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(`annota-${machineName}`),
        'PBKDF2',
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: enc.encode('annota-salt-v1'),
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encrypt(key: CryptoKey, value: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(value)
    );
    // Store iv + ciphertext as base64
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);
    return btoa(String.fromCharCode(...combined));
}

async function decrypt(key: CryptoKey, encoded: string): Promise<string> {
    const combined = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
    );
    return new TextDecoder().decode(plaintext);
}

export async function saveApiKey(provider: SecureProviderKey, value: string) {
    const key = await getDerivedKey();
    const encrypted = await encrypt(key, value);
    const store = await load('annota_keys.json', { autoSave: true, defaults: {} });
    await store.set(provider, encrypted);
}

export async function getApiKey(provider: SecureProviderKey): Promise<string | null> {
    try {
        const store = await load('annota_keys.json', { autoSave: true, defaults: {} });
        const encrypted = await store.get<string>(provider);
        if (!encrypted) return null;
        const key = await getDerivedKey();
        return await decrypt(key, encrypted);
    } catch {
        return null;
    }
}

export async function removeApiKey(provider: SecureProviderKey) {
    const store = await load('annota_keys.json', { autoSave: true, defaults: {} });
    await store.delete(provider);
}
