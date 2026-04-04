import { eq } from 'drizzle-orm';
import { useCallback, useEffect } from 'react';
import { APP_RELEASE_VERSION } from '../../constants/config';
import { getDb } from '../db/runtime';
import { appSettings } from '../db/schema';
import { useChangelogStore } from '../stores/changelog.store';
import { isNewerVersion } from '../utils/compareVersions';

export const useChangelog = (platform: 'mobile' | 'desktop') => {
    const isOpen = useChangelogStore(s => s.isOpen);
    const isLoading = useChangelogStore(s => s.isLoading);
    const setIsOpen = useChangelogStore(s => s.setOpen);
    const setIsLoading = useChangelogStore(s => s.setLoading);
    const changelogData = useChangelogStore(s => s.changelogData);
    const setChangelogData = useChangelogStore(s => s.setData);

    const fetchChangelog = useCallback(async (version: string) => {
        setIsLoading(true);
        try {
            const response = await fetch('https://annota.online/api/changelog/latest');
            if (!response.ok) return null;

            const entry = await response.json();

            if (entry) {
                // If it's thekeyed object from before, try to find the version.
                // But from the user's description, it now returns the entry directly.
                const targetEntry = entry[version] || entry;

                const features = [
                    ...(targetEntry.common?.features || []),
                    ...(targetEntry[platform]?.features || [])
                ];
                const fixes = [
                    ...(targetEntry.common?.fixes || []),
                    ...(targetEntry[platform]?.fixes || [])
                ];

                return {
                    title: targetEntry.title,
                    date: targetEntry.date,
                    features,
                    fixes
                };
            }
        } catch (e: any) {
            console.error("[Changelog] Fetch failed", e);
            alert(`FETCH ERROR: ${e.message || JSON.stringify(e)}`);
        } finally {
            setIsLoading(false);
        }
        return null;
    }, [platform]);

    // Automatic check on mount
    useEffect(() => {
        const checkChangelog = async () => {
            try {
                const db = getDb();
                let settings = await db.select().from(appSettings).where(eq(appSettings.id, 1));

                if (settings.length === 0) {
                    try {
                        await db.insert(appSettings)
                            .values({ id: 1, lastSeenChangelogVersion: APP_RELEASE_VERSION })
                            .onConflictDoNothing()
                            .run();
                    } catch (e) {
                        console.warn("[Changelog] Settings init skipped:", e);
                    }
                    return;
                }

                const lastSeen = settings[0].lastSeenChangelogVersion || '0.0.0';

                if (isNewerVersion(APP_RELEASE_VERSION, lastSeen)) {
                    const data = await fetchChangelog(APP_RELEASE_VERSION);
                    if (data) {
                        setChangelogData(data);
                        setIsOpen(true);
                    } else {
                        await markAsSeen();
                    }
                }
            } catch (error) {
                console.error("Changelog check failed:", error);
            }
        };

        checkChangelog();
    }, [platform]);

    const markAsSeen = async () => {
        try {
            const db = getDb();
            await db.update(appSettings)
                .set({ lastSeenChangelogVersion: APP_RELEASE_VERSION })
                .where(eq(appSettings.id, 1));

            setIsOpen(false);
        } catch (error) {
            console.error("Failed to update SQLite:", error);
        }
    };

    const openManual = async () => {
        console.log("[Changelog] Manual open triggered");
        setIsOpen(true);
        if (changelogData) {
            console.log("[Changelog] Data already present");
            return;
        }
        console.log("[Changelog] Fetching current version:", APP_RELEASE_VERSION);
        const data = await fetchChangelog(APP_RELEASE_VERSION);
        if (data) {
            console.log("[Changelog] Fetch success");
            setChangelogData(data);
        } else {
            console.warn("[Changelog] Fetch returned no data for version:", APP_RELEASE_VERSION);
            // Optionally close if failed, or let it show the "no data" state
        }
    };

    return { isOpen, isLoading, changelogData, markAsSeen, setIsOpen, openManual };
};
