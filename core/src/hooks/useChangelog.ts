import { eq } from 'drizzle-orm';
import { useCallback, useEffect } from 'react';
import { APP_RELEASE_VERSION } from '../../constants/config';
import { getDb } from '../db/runtime';
import { appSettings } from '../db/schema';
import { useChangelogStore } from '../stores/changelog.store';
import { isNewerVersion } from '../utils/compareVersions';

let latestChangelogPromise: Promise<any> | null = null;
let hasCheckedChangelog = false;

const fetchLatestChangelog = (): Promise<any> => {
    if (!latestChangelogPromise) {
        latestChangelogPromise = (async () => {
            try {
                const response = await fetch('https://annota.online/api/changelog/latest');
                if (!response.ok) {
                    latestChangelogPromise = null; // Reset on failure so it can be retried
                    return null;
                }
                return await response.json();
            } catch (e) {
                latestChangelogPromise = null; // Reset on failure
                console.error("[Changelog] Fetch failed", e);
                return null;
            }
        })();
    }
    return latestChangelogPromise;
};

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
            const entry = await fetchLatestChangelog();

            if (entry) {
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
        } finally {
            setIsLoading(false);
        }
        return null;
    }, [platform]);

    // Automatic check on mount
    useEffect(() => {
        if (hasCheckedChangelog) return;
        hasCheckedChangelog = true;

        const checkChangelog = async () => {
            try {
                const db = getDb();
                let settings = await db.select().from(appSettings).where(eq(appSettings.id, 1));

                let isUpgrade = false;
                let lastSeen = '0.0.0';

                if (settings.length === 0) {
                    try {
                        await db.insert(appSettings)
                            .values({ id: 1, lastSeenChangelogVersion: APP_RELEASE_VERSION })
                            .onConflictDoNothing()
                            .run();
                    } catch (e) {
                        console.warn("[Changelog] Settings init skipped:", e);
                    }
                } else {
                    lastSeen = settings[0].lastSeenChangelogVersion || '0.0.0';
                    if (isNewerVersion(APP_RELEASE_VERSION, lastSeen)) {
                        isUpgrade = true;
                    }
                }



                if (isUpgrade) {
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
        setIsOpen(true);
        if (changelogData) return;
        const data = await fetchChangelog(APP_RELEASE_VERSION);
        if (data) {
            setChangelogData(data);
        }
    };

    return {
        isOpen,
        isLoading,
        changelogData,
        markAsSeen,
        setIsOpen,
        openManual,
        currentVersion: APP_RELEASE_VERSION
    };
};
