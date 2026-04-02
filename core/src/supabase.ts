import { createClient, processLock } from '@supabase/supabase-js';
import { createStorageAdapter } from './stores/config';

let supabaseUrl: string | undefined;
let supabaseKey: string | undefined;


try {
    supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;
} catch (e) {
    // Ignore ReferenceError for process in Vite without process polyfill
}
if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        `Missing Supabase env vars. URL: ${supabaseUrl ?? 'undefined'}, KEY: ${supabaseKey ? '[present]' : 'undefined'}`
    );
}


export const supabase = createClient(
    supabaseUrl!,
    supabaseKey!,
    {
        auth: {
            storage: createStorageAdapter(),
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
            lock: processLock,
        },
    })
