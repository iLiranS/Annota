function toHex(bytes: Uint8Array): string {
    let result = '';
    for (const b of bytes) {
        result += b.toString(16).padStart(2, '0');
    }
    return result;
}

function fallbackRandomBytes(size: number): Uint8Array {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
}

export function generateId(byteSize = 16): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    if (typeof globalThis.crypto?.getRandomValues === 'function') {
        const bytes = new Uint8Array(byteSize);
        globalThis.crypto.getRandomValues(bytes);
        return toHex(bytes);
    }

    return toHex(fallbackRandomBytes(byteSize));
}

