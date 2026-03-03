import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from 'bip39';
import { Buffer } from 'buffer';
import { getPlatformAdapters } from '../adapters';
import { useSyncStore } from '../stores/sync.store';
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



/**
 * Hash the derived encryption key from a mnemonic for server-side validation.
 * Returns a hex-encoded SHA-256 digest of the 32-byte AES key.
 */
export async function hashMasterKey(mnemonic: string): Promise<string> {
    const seed = mnemonicToSeedSync(mnemonic);
    const keyBytes = seed.subarray(0, 32);
    const hexData = Buffer.from(keyBytes).toString('hex');
    return await getPlatformAdapters().crypto.sha256HexUtf8(hexData);
}

/**
 * Derive a 256-bit AES key from the 12-word mnemonic, caching it in the sync store.
 */
function getAesKeyFromMnemonic(mnemonic: string): Buffer {
    const { aesKey, activeMnemonic, setAesKey } = useSyncStore.getState();

    if (aesKey && activeMnemonic === mnemonic) {
        return aesKey;
    }

    const seed = mnemonicToSeedSync(mnemonic);
    const newAesKey = Buffer.from(seed.subarray(0, 32));

    setAesKey(mnemonic, newAesKey);
    return newAesKey;
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
export async function encryptPayload(jsonPayload: string, mnemonic: string): Promise<EncryptedPayload> {
    const key = getAesKeyFromMnemonic(mnemonic);
    const keyBytes = new Uint8Array(key);
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
export async function decryptPayload(encryptedHexWithTag: string, nonceHex: string, mnemonic: string): Promise<string> {
    const key = getAesKeyFromMnemonic(mnemonic);

    try {
        const encryptedHex = encryptedHexWithTag.slice(0, -32);
        const authTagHex = encryptedHexWithTag.slice(-32);

        const keyBytes = new Uint8Array(key);
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
        return '{}';
    } catch (e: any) {
        return '{}'; // Return empty object string to avoid JSON parse crashes
    }
}

/**
 * Encrypts raw image bytes using AES-256-GCM.
 */
export async function encryptImageBytes(rawBytes: Uint8Array, mnemonic: string): Promise<EncryptedBinaryPayload> {
    const key = getAesKeyFromMnemonic(mnemonic);
    const keyBytes = new Uint8Array(key);

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
 * Decrypts raw encrypted image bytes using AES-256-GCM.
 */
export async function decryptImageBytes(encryptedBytesWithTag: Uint8Array, nonceHex: string, mnemonic: string): Promise<Uint8Array> {
    const key = getAesKeyFromMnemonic(mnemonic);
    const keyBytes = new Uint8Array(key);
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
        return new Uint8Array(0); // Return empty buffer on legacy payload crash
    }
}
