import type { Tag, TagCreateInput } from '../db/repositories/tags.repository';
import * as tagsRepo from '../db/repositories/tags.repository';
import { removeTagFromAllNotes } from '../db/repositories/notes.repository';

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

    create: async (data: TagCreateInput): Promise<Tag> => {
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
};

