import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from 'bip39';
import { Buffer } from 'buffer';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { getPlatformAdapters } from '../adapters';
import './polyfill';

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
    const mnemonic = generateMnemonic(128, customRng);
    return mnemonic;
}

/**
 * Validate an existing 12-word mnemonic phrase.
 */
export function validateMasterKey(mnemonic: string): boolean {
    return validateMnemonic(mnemonic);
}

/**
 * Store the master key securely in the device's keychain.
 */
export async function storeMasterKey(userId: string, mnemonic: string) {
    await getPlatformAdapters().secureStore.setItem(getMasterKeyAlias(userId), mnemonic);
}

/**
 * Retrieve the master key from the device's keychain.
 */
export async function getMasterKey(userId: string): Promise<string | null> {
    return await getPlatformAdapters().secureStore.getItem(getMasterKeyAlias(userId));
}

/**
 * Remove the master key from the device's keychain.
 */
export async function removeMasterKey(userId: string) {
    await getPlatformAdapters().secureStore.removeItem(getMasterKeyAlias(userId));
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

    const encryptedHex = Buffer.from(ciphertext).toString('hex');
    const authTagHex = Buffer.from(authTag).toString('hex');
    const nonceHex = Buffer.from(nonceBytes).toString('hex');

    return {
        encryptedData: encryptedHex + authTagHex,
        nonce: nonceHex
    };
}

/**
 * Decrypts an encrypted payload using AES-256-GCM.
 */
export async function decryptPayload(
    encryptedHexWithTag: string,
    nonceHex: string,
    keyOrMnemonic: string | Uint8Array,
    options?: { strict?: boolean; salt?: Uint8Array }
): Promise<string> {
    const strict = options?.strict === true;
    const keyBytes = await ensureKey(keyOrMnemonic, options?.salt);

    try {
        const encryptedHex = encryptedHexWithTag.slice(0, -32);
        const authTagHex = encryptedHexWithTag.slice(-32);

        const nonceBytes = new Uint8Array(Buffer.from(nonceHex, 'hex'));
        const ciphertextBytes = new Uint8Array(Buffer.from(encryptedHex, 'hex'));
        const authTagBytes = new Uint8Array(Buffer.from(authTagHex, 'hex'));

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
