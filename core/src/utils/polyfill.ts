import { Buffer } from 'buffer';

const runtime = globalThis as typeof globalThis & { Buffer?: typeof Buffer };

if (typeof runtime.Buffer === 'undefined') {
    runtime.Buffer = Buffer;
}
