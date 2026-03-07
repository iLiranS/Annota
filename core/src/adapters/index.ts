import { PlatformAdapters } from './platform';

let adapters: PlatformAdapters | null = null;

export function initPlatformAdapters(platformAdapters: PlatformAdapters): void {
    adapters = platformAdapters;
}

export function areAdaptersInitialized(): boolean {
    return adapters !== null;
}

export function getPlatformAdapters(): PlatformAdapters {
    if (!adapters) {
        throw new Error('Platform adapters not initialized. Call `initPlatformAdapters(...)` in app bootstrap before using core platform APIs.');
    }
    return adapters;
}

export * from './platform';
