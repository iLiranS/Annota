import { getDb } from "@annota/core/src/stores/db.store";
import { schema } from "@annota/core/src/db/client";

export async function testTrigger() {
    const db = getDb();
    const id = "test-trigger-" + Date.now();
    await db.insert(schema.noteMetadata).values({
        id, title: "Trigger Test", preview: "test", folderId: null, createdAt: new Date(), updatedAt: new Date()
    }).run();
    await db.insert(schema.noteContent).values({ id, content: "test content" }).run();

    const nativeDb = (getDb() as any).nativeDb; // Wait, dbStore has nativeDb
}
