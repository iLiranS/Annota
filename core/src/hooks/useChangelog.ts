import { useEffect, useCallback } from 'react';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/runtime';
import { appSettings } from '../db/schema';
import { APP_RELEASE_VERSION } from '../../constants/config';
import { isNewerVersion } from '../utils/compareVersions';
import { useChangelogStore } from '../stores/changelog.store';

export const useChangelog = (platform: 'mobile' | 'desktop') => {
    const isOpen = useChangelogStore(s => s.isOpen);
    const setIsOpen = useChangelogStore(s => s.setOpen);
    const changelogData = useChangelogStore(s => s.changelogData);
    const setChangelogData = useChangelogStore(s => s.setData);

    const fetchChangelog = useCallback(async (version: string) => {
        try {
            const response = await fetch('https://annota.online/changelog.json');
            if (!response.ok) return null;
            
            const fullChangelog = await response.json();
            const entry = fullChangelog[version];

            if (entry) {
                const features = [
                    ...(entry.common?.features || []),
                    ...(entry[platform]?.features || [])
                ];
                const fixes = [
                    ...(entry.common?.fixes || []),
                    ...(entry[platform]?.fixes || [])
                ];

                return {
                    title: entry.title,
                    date: entry.date,
                    features,
                    fixes
                };
            }
        } catch (e) {
            console.error("[Changelog] Fetch failed", e);
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
        if (changelogData) {
            console.log("[Changelog] Data already present, opening...");
            setIsOpen(true);
            return;
        }
        console.log("[Changelog] Fetching current version:", APP_RELEASE_VERSION);
        const data = await fetchChangelog(APP_RELEASE_VERSION);
        if (data) {
           console.log("[Changelog] Fetch success, opening...");
           setChangelogData(data);
           setIsOpen(true);
        } else {
           console.warn("[Changelog] Fetch returned no data for version:", APP_RELEASE_VERSION);
        }
    };

    return { isOpen, changelogData, markAsSeen, setIsOpen, openManual };
};
