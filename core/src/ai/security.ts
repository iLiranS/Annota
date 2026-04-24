import { getPlatformAdapters } from '../adapters';

export type SecureProviderKey = 'openai' | 'anthropic' | 'google';

// Simple hex to bytes helper
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

// Derive a 256-bit key using SHA-256 of a fixed context.
// The primary security on mobile comes from the SecureStore itself.
// On desktop, this adds a layer of protection to the JSON store.
async function getDerivedKeyBytes(): Promise<Uint8Array> {
    const context = 'annota-secure-context-v1';
    const { crypto } = getPlatformAdapters();
    const hex = await crypto.sha256HexUtf8(`annota-${context}`);
    return hexToBytes(hex);
}

async function encrypt(value: string): Promise<string> {
    const { crypto } = getPlatformAdapters();
    const key = await getDerivedKeyBytes();
    const nonce = crypto.randomBytes(12);
    const plaintext = new TextEncoder().encode(value);
    
    const { ciphertext, authTag } = await crypto.aes256GcmEncrypt({
        key,
        nonce,
        plaintext
    });

    // Combined format: [nonce (12)] [authTag (16)] [ciphertext (n)]
    const combined = new Uint8Array(nonce.length + authTag.length + ciphertext.length);
    combined.set(nonce, 0);
    combined.set(authTag, nonce.length);
    combined.set(ciphertext, nonce.length + authTag.length);
    
    const { encoding } = getPlatformAdapters();
    return encoding.base64Encode(combined);
}

async function decrypt(encoded: string): Promise<string> {
    const { crypto, encoding } = getPlatformAdapters();
    const combined = encoding.base64Decode(encoded);
    
    const nonce = combined.slice(0, 12);
    const authTag = combined.slice(12, 28);
    const ciphertext = combined.slice(28);
    const key = await getDerivedKeyBytes();

    const plaintext = await crypto.aes256GcmDecrypt({
        key,
        nonce,
        ciphertext,
        authTag
    });

    return new TextDecoder().decode(plaintext);
}

export async function saveApiKey(provider: SecureProviderKey, value: string) {
    const encrypted = await encrypt(value);
    const { secureStore } = getPlatformAdapters();
    await secureStore.setItem(`ai_key_${provider}`, encrypted);
}

export async function getApiKey(provider: SecureProviderKey): Promise<string | null> {
    try {
        const { secureStore } = getPlatformAdapters();
        const encrypted = await secureStore.getItem(`ai_key_${provider}`);
        if (!encrypted) return null;
        return await decrypt(encrypted);
    } catch (e) {
        console.error(`Failed to decrypt key for ${provider}:`, e);
        return null;
    }
}

export async function removeApiKey(provider: SecureProviderKey) {
    const { secureStore } = getPlatformAdapters();
    await secureStore.removeItem(`ai_key_${provider}`);
}
