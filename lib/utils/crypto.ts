import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from 'bip39';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import crypto from 'react-native-quick-crypto';
import './polyfill';

const MASTER_KEY_PREFIX = 'annota_master_key_';
const LEGACY_MASTER_KEY_ALIAS = 'annota_master_key';

function getMasterKeyAlias(userId: string): string {
    return `${MASTER_KEY_PREFIX}${userId}`;
}

/**
 * Custom RNG utilizing react-native-quick-crypto for secure entropy.
 */
const customRng = (size: number) => {
    return Buffer.from(crypto.randomBytes(size));
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
    await SecureStore.setItemAsync(getMasterKeyAlias(userId), mnemonic, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
}

/**
 * Retrieve the master key from the device's keychain.
 */
export async function getMasterKey(userId: string): Promise<string | null> {
    return await SecureStore.getItemAsync(getMasterKeyAlias(userId));
}

/**
 * Remove the master key from the device's keychain.
 */
export async function removeMasterKey(userId: string) {
    await SecureStore.deleteItemAsync(getMasterKeyAlias(userId));
}

/**
 * Removes the old global alias used before per-user key storage.
 */
export async function removeLegacyMasterKey() {
    await SecureStore.deleteItemAsync(LEGACY_MASTER_KEY_ALIAS);
}

/**
 * Hash the derived encryption key from a mnemonic for server-side validation.
 * Returns a hex-encoded SHA-256 digest of the 32-byte AES key.
 */
export async function hashMasterKey(mnemonic: string): Promise<string> {
    const seed = mnemonicToSeedSync(mnemonic);
    const keyBytes = seed.subarray(0, 32);
    const hash = crypto.createHash('sha256');
    hash.update(Buffer.from(keyBytes).toString('hex'), 'utf8');
    return hash.digest('hex') as unknown as string;
}

/**
 * Derive a 256-bit AES key from the 12-word mnemonic.
 */
function getAesKeyFromMnemonic(mnemonic: string): Buffer {
    const seed = mnemonicToSeedSync(mnemonic);
    return Buffer.from(seed.subarray(0, 32));
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
export function encryptPayload(jsonPayload: string, mnemonic: string): EncryptedPayload {
    const key = getAesKeyFromMnemonic(mnemonic);

    const nonceBytes = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key as any, nonceBytes as any);

    let encrypted = cipher.update(jsonPayload, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    const nonceHex = nonceBytes.toString('hex');

    return {
        encryptedData: encrypted + authTag,
        nonce: nonceHex
    };
}

/**
 * Decrypts an encrypted payload using AES-256-GCM.
 */
export function decryptPayload(encryptedHexWithTag: string, nonceHex: string, mnemonic: string): string {
    const key = getAesKeyFromMnemonic(mnemonic);
    const nonceBytes = Buffer.from(nonceHex, 'hex');

    try {
        const encryptedHex = encryptedHexWithTag.slice(0, -32);
        const authTagHex = encryptedHexWithTag.slice(-32);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key as any, nonceBytes as any);
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex') as any);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

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
export function encryptImageBytes(rawBytes: Uint8Array, mnemonic: string): EncryptedBinaryPayload {
    const key = getAesKeyFromMnemonic(mnemonic);

    const nonceBytes = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key as any, nonceBytes as any);

    const encryptedContent = cipher.update(Buffer.from(rawBytes) as any);
    const encryptedFinal = cipher.final();
    const authTag = cipher.getAuthTag();

    const encryptedBytes = Buffer.concat([encryptedContent as any, encryptedFinal as any, authTag as any]);
    const nonceHex = nonceBytes.toString('hex');

    return {
        encryptedBytes: new Uint8Array(encryptedBytes),
        nonce: nonceHex,
    };
}

/**
 * Decrypts raw encrypted image bytes using AES-256-GCM.
 */
export function decryptImageBytes(encryptedBytesWithTag: Uint8Array, nonceHex: string, mnemonic: string): Uint8Array {
    const key = getAesKeyFromMnemonic(mnemonic);
    const nonceBytes = Buffer.from(nonceHex, 'hex');

    const buffer = Buffer.from(encryptedBytesWithTag);

    try {
        const encryptedBytes = buffer.subarray(0, buffer.length - 16);
        const authTag = buffer.subarray(buffer.length - 16);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key as any, nonceBytes as any);
        decipher.setAuthTag(authTag as any);

        const decryptedContent = decipher.update(encryptedBytes as any);
        const decryptedFinal = decipher.final();

        return new Uint8Array(Buffer.concat([decryptedContent as any, decryptedFinal as any]));
    } catch (e: any) {
        return new Uint8Array(0); // Return empty buffer on legacy payload crash
    }
}

