import { eq } from 'drizzle-orm';
import { useCallback, useEffect } from 'react';
import { APP_RELEASE_VERSION } from '../../constants/config';
import { getDb } from '../db/runtime';
import { appSettings } from '../db/schema';
import { useChangelogStore } from '../stores/changelog.store';
import { isNewerVersion } from '../utils/compareVersions';
import { getPlatformAdapters } from '../adapters';

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
    const latestVersion = useChangelogStore(s => s.latestVersion);
    const setLatestVersion = useChangelogStore(s => s.setLatestVersion);
    const dismissedUpdateVersion = useChangelogStore(s => s.dismissedUpdateVersion);
    const dismissUpdate = useChangelogStore(s => s.dismissUpdate);

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

                // If not an upgrade, check if we checked recently (last 24 hours)
                const adapters = getPlatformAdapters();
                const LAST_CHANGELOG_CHECK_KEY = 'annota_last_changelog_check';

                if (!isUpgrade) {
                    try {
                        const lastCheckStr = await adapters.secureStore.getItem(LAST_CHANGELOG_CHECK_KEY);
                        if (lastCheckStr) {
                            const lastCheck = parseInt(lastCheckStr, 10);
                            const now = Date.now();
                            const oneDayMs = 24 * 60 * 60 * 1000;
                            if (now - lastCheck < oneDayMs) {
                                console.log('[Changelog] Skipping fetch: already checked within the last 24 hours');
                                return;
                            }
                        }
                    } catch (err) {
                        console.warn('[Changelog] Failed to check last check timestamp:', err);
                    }
                }

                // 1. Fetch latest version info for the update indicator
                const entry = await fetchLatestChangelog();
                if (entry) {
                    // Update the last checked timestamp in secure storage
                    try {
                        await adapters.secureStore.setItem(LAST_CHANGELOG_CHECK_KEY, String(Date.now()));
                    } catch (err) {
                        console.warn('[Changelog] Failed to save last check timestamp:', err);
                    }

                    // The API returns either the latest entry directly or a map of entries.
                    // If it has a 'version' field, use it. Otherwise, if it's a map, find the latest key.
                    let latest = entry.version;
                    if (!latest) {
                        const versions = Object.keys(entry).filter(v => /^\d+\.\d+\.\d+/.test(v));
                        if (versions.length > 0) {
                            latest = versions.sort((a, b) => isNewerVersion(b, a) ? 1 : -1)[0];
                        }
                    }
                    if (latest) setLatestVersion(latest);
                }

                // 2. Check if we should show the "What's New" dialog
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

    const updateAvailable = latestVersion 
        ? isNewerVersion(latestVersion, APP_RELEASE_VERSION) && latestVersion !== dismissedUpdateVersion 
        : false;

    return {
        isOpen,
        isLoading,
        changelogData,
        markAsSeen,
        setIsOpen,
        openManual,
        latestVersion,
        updateAvailable,
        dismissUpdate,
        currentVersion: APP_RELEASE_VERSION
    };
};
