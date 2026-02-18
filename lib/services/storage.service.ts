import * as ImagesRepo from '@/lib/db/repositories/images.repository';
import { deleteImageFile } from './images/image.service';

export const StorageService = {
    getStats: () => {
        return ImagesRepo.getStorageStats();
    },

    runGarbageCollection: (force = false) => {
        // Clean up invalid links first (so their referenced images might become orphans)
        ImagesRepo.deleteOrphanLinks();

        const deletedPaths = ImagesRepo.deleteUnreferencedImages(undefined, force);
        let deletedCount = 0;
        for (const path of deletedPaths) {
            deleteImageFile(path);
            deletedCount++;
        }
        return deletedCount;
    }
};
