import { Buffer } from 'buffer';
import { userApi } from '../api/user.api';
import { getPlatformAdapters } from '../adapters';
import { resetSyncPointer } from '../sync/sync-service';
import { decodeSaltHex, decryptPayload, deriveKeysFromMnemonic, generateMasterKey, storeMasterKey, validateMasterKey } from '../utils/crypto';

async function ensureSaltHex(userId: string): Promise<string> {
    const profile = await userApi.getUserProfile(userId);
    if (profile?.salt) return profile.salt as string;

    const saltBytes = getPlatformAdapters().crypto.randomBytes(16);
    const saltHex = Buffer.from(saltBytes).toString('hex');
    await userApi.updateSalt(userId, saltHex);
    return saltHex;
}

export const userService = {
    /**
     * Handle the lost key flow:
     * - Discard remote encrypted data
     * - Generate a new key
     * - Store the new key securely on the device
     * Returns the newly generated master key mnemonic.
     */
    getUserProfile: async (userId: string) => {
        return await userApi.getUserProfile(userId);
    },

    handleLostKey: async (userId: string): Promise<string> => {
        const newMnemonic = await generateMasterKey();

        // Wipe cloud encrypted data
        await userApi.wipeEncryptedData();

        // Ensure salt exists (fresh start)
        await ensureSaltHex(userId);

        // Store new key
        await storeMasterKey(userId, newMnemonic);

        // Reset the sync pointer to pull any old missing data
        await resetSyncPointer(userId);

        return newMnemonic;
    },

    /**
     * Check if the user has a registered cloud payload.
     */
    hasMasterKey: async (userId: string): Promise<boolean> => {
        return await userApi.hasEncryptedData(userId);
    },

    /**
     * Process a newly generated or imported master key setup.
     */
    setupMasterKey: async (userId: string, mnemonic: string, wipeExisting: boolean): Promise<void> => {
        if (wipeExisting) {
            await userApi.wipeEncryptedData();
        }
        await ensureSaltHex(userId);
        await storeMasterKey(userId, mnemonic);
        await resetSyncPointer(userId);
    },

    /**
     * Import an existing master key by decrypting a sample payload.
     * Throws an error if the key is structurally invalid or the decrypt fails.
     */
    importMasterKey: async (userId: string, targetMnemonic: string): Promise<void> => {
        const isValid = validateMasterKey(targetMnemonic);
        if (!isValid) {
            throw new Error('INVALID_FORMAT');
        }

        const profile = await userApi.getUserProfile(userId);
        const saltHex = profile?.salt as string | null;
        if (!saltHex) {
            throw new Error('MISSING_SALT');
        }

        const saltBytes = decodeSaltHex(saltHex);
        const { notesKey } = await deriveKeysFromMnemonic(targetMnemonic, saltBytes);

        const sample = await userApi.getEncryptedSample(userId);
        if (sample) {
            try {
                await decryptPayload(sample.encrypted_data, sample.nonce, notesKey, { strict: true });
            } catch {
                throw new Error('INVALID_KEY');
            }
        }

        await storeMasterKey(userId, targetMnemonic);
        await resetSyncPointer(userId);
    },

    updateDisplayName: async (userId: string, displayName: string) => {
        await userApi.updateDisplayName(userId, displayName);
    },
    getDisplayName: async (userId: string) => {
        return await userApi.getDisplayName(userId);
    },
    getUserRole: async (userId: string) => {
        return await userApi.getUserRole(userId);
    },
    getSubscriptionExpiryDate: async (userId: string) => {
        return await userApi.getSubscriptionExpiryDate(userId);
    },
    deleteAccount: async () => {
        await userApi.deleteUserAccount();
    }
};
