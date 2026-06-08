export const WEB_FONT_FAMILIES: Record<string, string> = {
    system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "'FiraCode', SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    monospace: "'FiraCode', SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    poppins: 'Poppins',
    firacode: 'FiraCode',
    'fira code': 'FiraCode',
    'system (default)': "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

export function resolveFontFamily(value?: string) {
    if (!value) return WEB_FONT_FAMILIES.system;
    const key = value.toLowerCase();
    const resolved = WEB_FONT_FAMILIES[key];
    if (resolved) return resolved;

    // If it's a custom font name with spaces, wrap in quotes for CSS safety
    if (value.includes(' ') && !value.startsWith("'") && !value.startsWith('"')) {
        return `'${value}'`;
    }
    return value;
}
