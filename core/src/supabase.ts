import { createClient, processLock } from '@supabase/supabase-js';
import { createStorageAdapter } from './stores/config';

let supabaseUrl: string | undefined;
let supabaseKey: string | undefined;
export let isCloudEnabled = true;

try {
    const explicitDisable = process.env.VITE_ENABLE_CLOUD === 'false' || process.env.EXPO_PUBLIC_ENABLE_CLOUD === 'false';
    const explicitEnable = process.env.VITE_ENABLE_CLOUD === 'true' || process.env.EXPO_PUBLIC_ENABLE_CLOUD === 'true';

    supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

    if (explicitDisable) {
        isCloudEnabled = false;
    } else if (explicitEnable) {
        isCloudEnabled = true;
    } else {
        // Auto-detect based on presence of credentials
        isCloudEnabled = !!(supabaseUrl && supabaseKey);
    }
} catch (e) {
    // Ignore ReferenceError for process in Vite without process polyfill
}

if (isCloudEnabled && (!supabaseUrl || !supabaseKey)) {
    console.warn(
        `Missing Supabase env vars. URL: ${supabaseUrl ?? 'undefined'}, KEY: ${supabaseKey ? '[present]' : 'undefined'}`
    );
}

export const supabase = createClient(
    supabaseUrl || 'http://localhost:54321', // Fallback to prevent crash
    supabaseKey || 'dummy_key', // Fallback to prevent crash
    {
        auth: {
            storage: createStorageAdapter(),
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
            lock: processLock,
        },
    })
