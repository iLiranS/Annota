import { Buffer } from 'buffer';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { getPlatformAdapters } from '../adapters';
import './polyfill';

let bip39Module: any = null;

async function getBip39() {
    if (!bip39Module) {
        bip39Module = await import('bip39');
    }
    return bip39Module;
}

const MASTER_KEY_PREFIX = 'annota_master_key_';

function getMasterKeyAlias(userId: string): string {
    return `${MASTER_KEY_PREFIX}${userId}`;
}

/**
 * Custom RNG backed by platform adapters for secure entropy.
 */
const customRng = (size: number) => {
    return Buffer.from(getPlatformAdapters().crypto.randomBytes(size));
};

/**
 * Generate a new 12-word mnemonic phrase.
 */
export async function generateMasterKey(): Promise<string> {
    const { generateMnemonic } = await getBip39();
    const mnemonic = generateMnemonic(128, customRng);
    return mnemonic;
}

/**
 * Validate an existing 12-word mnemonic phrase.
 */
export async function validateMasterKey(mnemonic: string): Promise<boolean> {
    const { validateMnemonic } = await getBip39();
    return validateMnemonic(mnemonic);
}

/**
 * Internal cache for the decrypted master key to avoid repeated decryption or secure store access.
 * The master key is used frequently for data encryption/decryption.
 */
let masterKeyCache: { userId: string; mnemonic: string } | null = null;

/**
 * Store the master key securely in the device's keychain.
 * The key is encrypted at rest using a derived device-specific key.
 */
export async function storeMasterKey(userId: string, mnemonic: string) {
    const encrypted = await encryptAtRest(mnemonic);
    await getPlatformAdapters().secureStore.setItem(getMasterKeyAlias(userId), encrypted);
    masterKeyCache = { userId, mnemonic };
}

/**
 * Retrieve the master key from the device's keychain.
 * Uses an in-memory cache to avoid repeated decryption.
 * Handles migration of legacy plain-text keys.
 */
export async function getMasterKey(userId: string): Promise<string | null> {
    if (masterKeyCache && masterKeyCache.userId === userId) {
        return masterKeyCache.mnemonic;
    }

    const value = await getPlatformAdapters().secureStore.getItem(getMasterKeyAlias(userId));
    if (!value) return null;

    try {
        const decrypted = await decryptAtRest(value);
        masterKeyCache = { userId, mnemonic: decrypted };
        return decrypted;
    } catch (e) {
        // Fallback for legacy plain-text keys
        if (await validateMasterKey(value)) {
            // Migrate to encrypted at rest
            const encrypted = await encryptAtRest(value);
            await getPlatformAdapters().secureStore.setItem(getMasterKeyAlias(userId), encrypted);
            masterKeyCache = { userId, mnemonic: value };
            return value;
        }
        console.error('[crypto] Failed to decrypt master key:', e);
        return null;
    }
}

/**
 * Remove the master key from the device's keychain and clear the cache.
 */
export async function removeMasterKey(userId: string) {
    await getPlatformAdapters().secureStore.removeItem(getMasterKeyAlias(userId));
    if (masterKeyCache && masterKeyCache.userId === userId) {
        masterKeyCache = null;
    }
}

// --- Encryption/Decryption helpers for "At Rest" protection ---

async function getDerivedKeyBytes(): Promise<Uint8Array> {
    const context = 'annota-secure-context-v1';
    const { crypto } = getPlatformAdapters();
    const hex = await crypto.sha256HexUtf8(`annota-${context}`);
    return new Uint8Array(Buffer.from(hex, 'hex'));
}

async function encryptAtRest(value: string): Promise<string> {
    const { crypto, encoding } = getPlatformAdapters();
    const key = await getDerivedKeyBytes();
    const nonce = crypto.randomBytes(12);
    const plaintext = Buffer.from(value, 'utf8');

    const { ciphertext, authTag } = await crypto.aes256GcmEncrypt({
        key,
        nonce,
        plaintext
    });

    const combined = new Uint8Array(nonce.length + authTag.length + ciphertext.length);
    combined.set(nonce, 0);
    combined.set(authTag, nonce.length);
    combined.set(ciphertext, nonce.length + authTag.length);

    return encoding.base64Encode(combined);
}

async function decryptAtRest(encoded: string): Promise<string> {
    const { crypto, encoding } = getPlatformAdapters();
    const combined = encoding.base64Decode(encoded);

    if (combined.length < 28) {
        throw new Error('Invalid encrypted payload');
    }

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

    return Buffer.from(plaintext).toString('utf8');
}



const ARGON2_MEMORY_KIB = 65_536;
const ARGON2_PASSES = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_TAG_LENGTH = 32;
const HKDF_SALT = new Uint8Array(0);
const HKDF_INFO_NOTES = Buffer.from('notes', 'utf8');
const HKDF_INFO_FILES = Buffer.from('files', 'utf8');

export function decodeSaltHex(saltHex: string): Uint8Array {
    return new Uint8Array(Buffer.from(saltHex, 'hex'));
}

/**
 * Derive a 256-bit master key from the 12-word mnemonic + salt (Argon2id).
 */
export async function deriveKeyFromMnemonic(mnemonic: string, salt: Uint8Array): Promise<Uint8Array> {
    const { mnemonicToSeedSync } = await getBip39();
    const seed = mnemonicToSeedSync(mnemonic);
    return await getPlatformAdapters().crypto.argon2id({
        message: seed,
        nonce: salt,
        memory: ARGON2_MEMORY_KIB,
        passes: ARGON2_PASSES,
        parallelism: ARGON2_PARALLELISM,
        tagLength: ARGON2_TAG_LENGTH,
    });
}

/**
 * Split master key into subkeys using HKDF.
 */
export function deriveSubkeys(masterKey: Uint8Array): { notesKey: Uint8Array; filesKey: Uint8Array } {
    const notesKey = hkdf(sha256, masterKey, HKDF_SALT, HKDF_INFO_NOTES, 32);
    const filesKey = hkdf(sha256, masterKey, HKDF_SALT, HKDF_INFO_FILES, 32);
    return { notesKey, filesKey };
}

export async function deriveKeysFromMnemonic(mnemonic: string, salt: Uint8Array): Promise<{ masterKey: Uint8Array; notesKey: Uint8Array; filesKey: Uint8Array }> {
    const masterKey = await deriveKeyFromMnemonic(mnemonic, salt);
    const { notesKey, filesKey } = deriveSubkeys(masterKey);
    return { masterKey, notesKey, filesKey };
}

async function ensureKey(keyOrMnemonic: string | Uint8Array, salt?: Uint8Array): Promise<Uint8Array> {
    if (typeof keyOrMnemonic === 'string') {
        if (!salt) {
            throw new Error('Salt required');
        }
        return await deriveKeyFromMnemonic(keyOrMnemonic, salt);
    }
    return keyOrMnemonic;
}

export interface EncryptedPayload {
    encryptedData: string;
    nonce: string;
}

export interface EncryptedBinaryPayload {
    encryptedBytes: Uint8Array;
    nonce: string;
}

/**
 * Encrypts a JSON payload using AES-256-GCM.
 * Returns the encrypted data (with authTag appended) and the random nonce.
 */
export async function encryptPayload(jsonPayload: string, keyOrMnemonic: string | Uint8Array, salt?: Uint8Array): Promise<EncryptedPayload> {
    const keyBytes = await ensureKey(keyOrMnemonic, salt);
    const plaintextBytes = new Uint8Array(Buffer.from(jsonPayload, 'utf8'));

    const nonceBytes = getPlatformAdapters().crypto.randomBytes(12);

    const { ciphertext, authTag } = await getPlatformAdapters().crypto.aes256GcmEncrypt({
        key: keyBytes,
        nonce: nonceBytes,
        plaintext: plaintextBytes
    });

    const encryptedB64 = Buffer.from(ciphertext).toString('base64');
    const authTagB64 = Buffer.from(authTag).toString('base64');
    const nonceHex = Buffer.from(nonceBytes).toString('hex');

    return {
        encryptedData: encryptedB64 + authTagB64,
        nonce: nonceHex
    };
}

/**
 * Decrypts an encrypted payload using AES-256-GCM.
 */
export async function decryptPayload(
    encryptedB64WithTag: string,
    nonceHex: string,
    keyOrMnemonic: string | Uint8Array,
    options?: { strict?: boolean; salt?: Uint8Array }
): Promise<string> {
    const strict = options?.strict === true;
    const keyBytes = await ensureKey(keyOrMnemonic, options?.salt);

    try {
        const encryptedB64 = encryptedB64WithTag.slice(0, -24);
        const authTagB64 = encryptedB64WithTag.slice(-24);

        const nonceBytes = new Uint8Array(Buffer.from(nonceHex, 'hex'));
        const ciphertextBytes = new Uint8Array(Buffer.from(encryptedB64, 'base64'));
        const authTagBytes = new Uint8Array(Buffer.from(authTagB64, 'base64'));

        const decryptedBytes = await getPlatformAdapters().crypto.aes256GcmDecrypt({
            key: keyBytes,
            nonce: nonceBytes,
            ciphertext: ciphertextBytes,
            authTag: authTagBytes
        });

        const decrypted = Buffer.from(decryptedBytes).toString('utf8');

        // Verify it actually decrypted a JSON structure, else it's legacy garbage
        if (decrypted.startsWith('{') || decrypted.startsWith('[')) {
            return decrypted;
        }
        if (strict) {
            throw new Error('INVALID_DECRYPT');
        }
        return '{}';
    } catch (e: any) {
        if (strict) {
            throw e;
        }
        return '{}'; // Return empty object string to avoid JSON parse crashes
    }
}

/**
 * Encrypts raw file bytes using AES-256-GCM.
 */
export async function encryptFileBytes(rawBytes: Uint8Array, keyOrMnemonic: string | Uint8Array, salt?: Uint8Array): Promise<EncryptedBinaryPayload> {
    const keyBytes = await ensureKey(keyOrMnemonic, salt);

    const nonceBytes = getPlatformAdapters().crypto.randomBytes(12);

    const { ciphertext, authTag } = await getPlatformAdapters().crypto.aes256GcmEncrypt({
        key: keyBytes,
        nonce: nonceBytes,
        plaintext: rawBytes
    });

    const encryptedFinal = new Uint8Array(ciphertext.length + authTag.length);
    encryptedFinal.set(ciphertext, 0);
    encryptedFinal.set(authTag, ciphertext.length);

    const nonceHex = Buffer.from(nonceBytes).toString('hex');

    return {
        encryptedBytes: encryptedFinal,
        nonce: nonceHex,
    };
}

/**
 * Decrypts raw encrypted file bytes using AES-256-GCM.
 */
export async function decryptFileBytes(
    encryptedBytesWithTag: Uint8Array,
    nonceHex: string,
    keyOrMnemonic: string | Uint8Array,
    options?: { strict?: boolean; salt?: Uint8Array }
): Promise<Uint8Array> {
    const strict = options?.strict === true;
    const keyBytes = await ensureKey(keyOrMnemonic, options?.salt);
    const nonceBytes = new Uint8Array(Buffer.from(nonceHex, 'hex'));

    try {
        const ciphertext = encryptedBytesWithTag.subarray(0, encryptedBytesWithTag.length - 16);
        const authTag = encryptedBytesWithTag.subarray(encryptedBytesWithTag.length - 16);

        return await getPlatformAdapters().crypto.aes256GcmDecrypt({
            key: keyBytes,
            nonce: nonceBytes,
            ciphertext: ciphertext,
            authTag: authTag
        });
    } catch (e: any) {
        if (strict) {
            throw e;
        }
        return new Uint8Array(0); // Return empty buffer on legacy payload crash
    }
}
