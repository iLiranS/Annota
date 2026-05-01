export function colorWithAlpha(color: string, alpha: number): string {
    const normalized = color.trim();
    const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');

    if (/^#[0-9a-f]{3}$/i.test(normalized)) {
        const [, r, g, b] = normalized;
        return `#${r}${r}${g}${g}${b}${b}${alphaHex}`;
    }

    if (/^#[0-9a-f]{6}$/i.test(normalized)) {
        return `${normalized}${alphaHex}`;
    }

    if (/^#[0-9a-f]{8}$/i.test(normalized)) {
        return `${normalized.slice(0, 7)}${alphaHex}`;
    }

    const rgbMatch = normalized.match(/^rgba?\((.+)\)$/i);
    if (rgbMatch) {
        const parts = rgbMatch[1].split(',').map(part => part.trim());
        if (parts.length >= 3) {
            return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
        }
    }

    return `color-mix(in srgb, ${normalized} ${Math.round(alpha * 100)}%, transparent)`;
}
