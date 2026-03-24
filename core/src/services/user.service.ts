import { userApi } from '../api/user.api';
import { resetSyncPointer } from '../sync/sync-service';
import { generateMasterKey, hashMasterKey, storeMasterKey, validateMasterKey } from '../utils/crypto';

export const userService = {
    /**
     * Handle the lost key flow:
     * - Discard remote encrypted data
     * - Generate a new key and update the remote validator
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

        // Store new key and update validator
        await storeMasterKey(userId, newMnemonic);
        const hash = await hashMasterKey(newMnemonic);
        await userApi.updateKeyValidator(userId, hash);

        // Reset the sync pointer to pull any old missing data
        await resetSyncPointer(userId);

        return newMnemonic;
    },

    /**
     * Check if the user has a registered cloud payload.
     */
    hasMasterKey: async (userId: string): Promise<boolean> => {
        return await userApi.hasMasterKey(userId);
    },

    /**
     * Process a newly generated or imported master key setup.
     */
    setupMasterKey: async (userId: string, mnemonic: string, wipeExisting: boolean): Promise<void> => {
        if (wipeExisting) {
            await userApi.wipeEncryptedData();
        }
        await storeMasterKey(userId, mnemonic);
        const hash = await hashMasterKey(mnemonic);
        await userApi.updateKeyValidator(userId, hash);
        await resetSyncPointer(userId);
    },

    /**
     * Import an existing master key, validating it against the remote hash if available.
     * Throws an error if the key is structurally invalid or if it doesn't match the remote hash.
     */
    importMasterKey: async (userId: string, targetMnemonic: string, storedValidatorHash: string | null): Promise<void> => {
        const isValid = validateMasterKey(targetMnemonic);
        if (!isValid) {
            throw new Error('INVALID_FORMAT');
        }

        if (storedValidatorHash) {
            const importedHash = await hashMasterKey(targetMnemonic);
            if (importedHash !== storedValidatorHash) {
                throw new Error('HASH_MISMATCH');
            }
        } else {
            // No key_validator yet — store the hash for future validation
            const hash = await hashMasterKey(targetMnemonic);
            await userApi.updateKeyValidator(userId, hash);
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
