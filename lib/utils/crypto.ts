import { generateMnemonic, mnemonicToSeedSync } from 'bip39';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import QuickCrypto from 'react-native-quick-crypto';

const MASTER_KEY_ALIAS = 'annota_master_key';

/**
 * Generate a new 12-word mnemonic phrase.
 */
export async function generateMasterKey(): Promise<string> {
    // Generate a 128-bit entropy mnemonic (12 words)
    const mnemonic = generateMnemonic(128);
    return mnemonic;
}

/**
 * Store the master key securely in the device's keychain.
 */
export async function storeMasterKey(mnemonic: string) {
    await SecureStore.setItemAsync(MASTER_KEY_ALIAS, mnemonic, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
}

/**
 * Retrieve the master key from the device's keychain.
 */
export async function getMasterKey(): Promise<string | null> {
    return await SecureStore.getItemAsync(MASTER_KEY_ALIAS);
}

/**
 * Remove the master key from the device's keychain.
 */
export async function removeMasterKey() {
    await SecureStore.deleteItemAsync(MASTER_KEY_ALIAS);
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

/**
 * Encrypts a JSON payload using AES-256-GCM.
 * Returns the encrypted data (with auth tag appended) and the random nonce.
 */
export function encryptPayload(jsonPayload: string, mnemonic: string): EncryptedPayload {
    const key = getAesKeyFromMnemonic(mnemonic);
    // Generate a 12-byte (96-bit) nonce for GCM
    const nonce = QuickCrypto.randomBytes(12);

    // Create Cipher
    const cipher = QuickCrypto.createCipheriv('aes-256-gcm', key as any, nonce as any);

    // Encrypt
    let encrypted = cipher.update(jsonPayload, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get Auth Tag (16 bytes)
    const authTag = cipher.getAuthTag();

    return {
        encryptedData: encrypted + ":" + authTag.toString('base64'),
        nonce: nonce.toString('base64')
    };
}

/**
 * Decrypts an encrypted payload using AES-256-GCM.
 */
export function decryptPayload(encryptedDataWithTag: string, nonceBase64: string, mnemonic: string): string {
    const key = getAesKeyFromMnemonic(mnemonic);
    const nonce = Buffer.from(nonceBase64, 'base64');

    const parts = encryptedDataWithTag.split(':');
    if (parts.length !== 2) {
        throw new Error("Invalid encrypted payload format");
    }

    const ciphertext = parts[0];
    const authTag = Buffer.from(parts[1], 'base64');

    const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', key as any, nonce as any);
    decipher.setAuthTag(authTag as any);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
