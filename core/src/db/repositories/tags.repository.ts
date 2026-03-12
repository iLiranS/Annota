import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../../stores/db.store';
import { generateId } from '../../utils/id';
import type { Tag, TagInsert } from '../schema';
import * as schema from '../schema';
import type { DbOrTx } from '../types';
import { safeGet, safeGetAll } from '../utils';

export type TagCreateInput = Omit<TagInsert, 'id' | 'createdAt' | 'updatedAt' | 'isDirty'> & {
    id?: string;
    createdAt?: Date;
    updatedAt?: Date;
    isDirty?: boolean;
};

// ============ SYNC OPERATIONS ============

export async function getDirtyTags(): Promise<Tag[]> {
    const result = await getDb()
        .select()
        .from(schema.tags)
        .where(eq(schema.tags.isDirty, true))
        .all();
    return safeGetAll<Tag>(result);
}

export async function clearDirtyTags(tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;
    await getDb().update(schema.tags)
        .set({ isDirty: false })
        .where(inArray(schema.tags.id, tagIds))
        .run();
}

export async function upsertSyncedTag(tagData: Tag, tx: DbOrTx = getDb()): Promise<void> {
    await tx.insert(schema.tags)
        .values(tagData)
        .onConflictDoUpdate({ target: schema.tags.id, set: tagData })
        .run();
}

// ============ TAG OPERATIONS ============

export async function getTags(tx: DbOrTx = getDb()): Promise<Tag[]> {
    const result = await tx.select()
        .from(schema.tags)
        .where(and(eq(schema.tags.isDeleted, false), eq(schema.tags.isPermDeleted, false)))
        .all();
    return safeGetAll<Tag>(result);
}

export async function getTagById(tagId: string, tx: DbOrTx = getDb()): Promise<Tag | null> {
    const result = await tx.select()
        .from(schema.tags)
        .where(eq(schema.tags.id, tagId))
        .get();
    return safeGet<Tag>(result);
}

export async function getTagByName(name: string, tx: DbOrTx = getDb()): Promise<Tag | null> {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return null;
    const result = await tx.select()
        .from(schema.tags)
        .where(and(
            eq(schema.tags.isDeleted, false),
            eq(schema.tags.isPermDeleted, false),
            sql`lower(${schema.tags.name}) = ${normalized}`
        ))
        .get();
    return safeGet<Tag>(result);
}

export async function createTag(data: TagCreateInput, tx: DbOrTx = getDb()): Promise<Tag> {
    const now = new Date();
    const tagData = {
        ...data,
        id: data.id ?? generateId(),
        createdAt: data.createdAt || now,
        updatedAt: data.updatedAt || now,
        isDirty: data.isDirty ?? true,
    };
    const inserted = await tx.insert(schema.tags).values(tagData).returning().get();
    return safeGet<Tag>(inserted)!;
}

export async function updateTag(
    tagId: string,
    updates: Partial<Omit<Tag, 'id' | 'createdAt'>>,
    tx: DbOrTx = getDb()
): Promise<Tag> {
    const updated = await tx.update(schema.tags)
        .set({
            ...updates,
            updatedAt: new Date(),
            isDirty: true
        })
        .where(eq(schema.tags.id, tagId))
        .returning()
        .get();
    return safeGet<Tag>(updated)!;
}

export async function deleteTag(tagId: string, tx: DbOrTx = getDb()): Promise<void> {
    await tx.update(schema.tags)
        .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
        .where(eq(schema.tags.id, tagId))
        .run();
}
