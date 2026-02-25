import aesjs from 'aes-js';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from 'bip39';
import { Buffer } from 'buffer';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import './polyfill';

const MASTER_KEY_PREFIX = 'annota_master_key_';
const LEGACY_MASTER_KEY_ALIAS = 'annota_master_key';

function getMasterKeyAlias(userId: string): string {
    return `${MASTER_KEY_PREFIX}${userId}`;
}

/**
 * Custom RNG utilizing expo-crypto for secure entropy.
 */
const customRng = (size: number) => {
    return Buffer.from(Crypto.getRandomBytes(size));
};

/**
 * Generate a new 12-word mnemonic phrase.
 */
export async function generateMasterKey(): Promise<string> {
    // Generate a 128-bit entropy mnemonic (12 words)
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
    return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Buffer.from(keyBytes).toString('hex')
    );
}

/**
 * Derive a 256-bit AES key from the 12-word mnemonic.
 */
function getAesKeyFromMnemonic(mnemonic: string): Buffer {
    const seed = mnemonicToSeedSync(mnemonic);
    // AES-256 requires a 32-byte key
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
 * Encrypts a JSON payload using AES-256-CTR (Pure JS for Expo Go compatibility).
 * Returns the encrypted data and the random nonce.
 */
export function encryptPayload(jsonPayload: string, mnemonic: string): EncryptedPayload {
    const key = getAesKeyFromMnemonic(mnemonic); // length 32

    // Generate a 16-byte nonce for CTR mode using Expo Crypto
    const nonceBytes = Crypto.getRandomBytes(16);
    // aes-js CTR mode needs an initial counter (an integer or a 16 byte array)
    // We treat the nonce as our initial counter vector.

    const aesCtr = new aesjs.ModeOfOperation.ctr(key as any, new aesjs.Counter(nonceBytes));

    // Convert text to bytes
    const textBytes = aesjs.utils.utf8.toBytes(jsonPayload);

    // Encrypt
    const encryptedBytes = aesCtr.encrypt(textBytes);

    // Convert to hex
    const encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
    const nonceHex = aesjs.utils.hex.fromBytes(nonceBytes);

    return {
        encryptedData: encryptedHex,
        nonce: nonceHex
    };
}

/**
 * Decrypts an encrypted payload using AES-256-CTR.
 */
export function decryptPayload(encryptedHex: string, nonceHex: string, mnemonic: string): string {
    const key = getAesKeyFromMnemonic(mnemonic);

    const encryptedBytes = aesjs.utils.hex.toBytes(encryptedHex);
    const nonceBytes = aesjs.utils.hex.toBytes(nonceHex);

    // aes-js requires 16 bytes exactly for the counter
    const aesCtr = new aesjs.ModeOfOperation.ctr(key as any, new aesjs.Counter(nonceBytes));

    const decryptedBytes = aesCtr.decrypt(encryptedBytes);

    // Convert back to text
    const decryptedText = aesjs.utils.utf8.fromBytes(decryptedBytes);

    return decryptedText;
}

/**
 * Encrypts raw image bytes using AES-256-CTR.
 * Operates directly on binary data — no base64 intermediate.
 */
export function encryptImageBytes(rawBytes: Uint8Array, mnemonic: string): EncryptedBinaryPayload {
    const key = getAesKeyFromMnemonic(mnemonic);

    const nonceBytes = Crypto.getRandomBytes(16);
    const aesCtr = new aesjs.ModeOfOperation.ctr(key as any, new aesjs.Counter(nonceBytes));

    const encryptedBytes = aesCtr.encrypt(rawBytes);
    const nonceHex = aesjs.utils.hex.fromBytes(nonceBytes);

    return {
        encryptedBytes: new Uint8Array(encryptedBytes),
        nonce: nonceHex,
    };
}

/**
 * Decrypts raw encrypted image bytes using AES-256-CTR.
 * Returns the original raw binary data as Uint8Array.
 */
export function decryptImageBytes(encryptedBytes: Uint8Array, nonceHex: string, mnemonic: string): Uint8Array {
    const key = getAesKeyFromMnemonic(mnemonic);

    const nonceBytes = aesjs.utils.hex.toBytes(nonceHex);
    const aesCtr = new aesjs.ModeOfOperation.ctr(key as any, new aesjs.Counter(nonceBytes));

    const decryptedBytes = aesCtr.decrypt(encryptedBytes);
    return new Uint8Array(decryptedBytes);
}

/**
 * Temporary function to log the hashed master key
 */
export async function logHashedMasterKey(userId: string) {
    const mnemonic = await getMasterKey(userId);
    if (mnemonic) {
        const hashed = await hashMasterKey(mnemonic);
        console.log("=== TEMPORARY HASHED MASTER KEY ===");
        console.log(hashed);
        console.log("===================================");
    } else {
        console.log("No master key found for user:", userId);
    }
}
