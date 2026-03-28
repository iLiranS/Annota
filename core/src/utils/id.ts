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

    let bytes: Uint8Array;
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
        bytes = new Uint8Array(byteSize);
        globalThis.crypto.getRandomValues(bytes as any);
    } else {
        bytes = fallbackRandomBytes(byteSize);
    }

    // Set version to 4 (0100xxxx)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant to 10xx (RFC 4122)
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = toHex(bytes);
    
    // Format as 8-4-4-4-12 UUID
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32)
    ].join('-');
}

