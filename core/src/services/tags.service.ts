import { removeTagFromAllNotes } from '../db/repositories/notes.repository';
import type { TagCreateInput } from '../db/repositories/tags.repository';
import * as tagsRepo from '../db/repositories/tags.repository';
import type { Tag } from '../db/schema';
import type { UserRole } from '../stores/user.store';
import { isPremiumUser } from '../utils/subscription';



export const TagService = {
    getAllTags: async (): Promise<Tag[]> => {
        return await tagsRepo.getTags();
    },

    getTagById: async (tagId: string): Promise<Tag | null> => {
        return await tagsRepo.getTagById(tagId);
    },

    getTagByName: async (name: string): Promise<Tag | null> => {
        return await tagsRepo.getTagByName(name);
    },

    create: async (data: TagCreateInput, userRole: UserRole, subExpDate: string | null): Promise<Tag> => {
        const isPremium = isPremiumUser(userRole, subExpDate);
        const limit = isPremium ? 2500 : 100;
        const currentCount = await tagsRepo.getTagsCount();

        if (currentCount >= limit) {
            throw new Error(`Limit of ${limit} tags reached.`);
        }

        return await tagsRepo.createTag(data);
    },

    update: async (tagId: string, updates: Partial<Omit<Tag, 'id'>>): Promise<Tag> => {
        return await tagsRepo.updateTag(tagId, updates);
    },

    /**
     * Soft-delete the tag (marks as deleted + dirty for sync push).
     * Also cascades: removes the tag ID from every note's tags array.
     */
    delete: async (tagId: string): Promise<void> => {
        await removeTagFromAllNotes(tagId);
        await tagsRepo.deleteTag(tagId);
    }

}