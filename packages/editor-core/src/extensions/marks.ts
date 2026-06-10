import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import './marks.css';

export const COLOR_MAP: Record<string, string> = {
    '#FFE066': 'yw',
    '#FFA94D': 'or',
    '#FF6B6B': 're',
    '#F783AC': 'pi',
    '#818CF8': 'in',
    '#74C0FC': 'bl',
    '#20C997': 'te',
    '#51CF66': 'gr',
    '#757575': 'gy',
    '#A07855': 'br'
};

export const SHORT_TO_HEX: Record<string, string> = Object.entries(COLOR_MAP).reduce((acc, [hex, short]) => {
    acc[short] = hex;
    return acc;
}, {} as Record<string, string>);

function getRgbValues(colorString: string): [number, number, number] | null {
    const match = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (match) return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];

    if (colorString.startsWith('#')) {
        const hex = colorString.replace('#', '');
        if (hex.length === 3) {
            return [
                parseInt(hex[0] + hex[0], 16),
                parseInt(hex[1] + hex[1], 16),
                parseInt(hex[2] + hex[2], 16),
            ];
        }
        if (hex.length === 6 || hex.length === 8) {
            return [
                parseInt(hex.substring(0, 2), 16),
                parseInt(hex.substring(2, 4), 16),
                parseInt(hex.substring(4, 6), 16),
            ];
        }
    }
    return null;
}

function isThemeNeutralColor(rgb: [number, number, number]): boolean {
    const max = Math.max(...rgb);
    const min = Math.min(...rgb);
    const isNearBlack = max < 70;
    const isNearWhite = min > 220;

    return (isNearBlack || isNearWhite) && max - min < 24;
}

function getClosestPaletteColor(rgb: [number, number, number], palette: Record<string, string>): string {
    let closestHex = Object.keys(palette)[0];
    let minDistance = Infinity;

    for (const hex of Object.keys(palette)) {
        const targetRgb = getRgbValues(hex);
        if (!targetRgb) continue;

        const distance = Math.sqrt(
            Math.pow(rgb[0] - targetRgb[0], 2) +
            Math.pow(rgb[1] - targetRgb[1], 2) +
            Math.pow(rgb[2] - targetRgb[2], 2)
        );

        if (distance < minDistance) {
            minDistance = distance;
            closestHex = hex;
        }
    }
    return closestHex;
}

function normalizePaletteColor(color: string | null | undefined): string | null {
    if (!color) return null;

    const normalized = color.replace(/['"]+/g, '').trim();
    const upper = normalized.toUpperCase();

    if (COLOR_MAP[upper]) return upper;

    if (upper.startsWith('#') && (upper.length === 9 || upper.length === 5)) {
        const withoutAlpha = upper.length === 9
            ? upper.substring(0, 7)
            : `#${upper[1]}${upper[1]}${upper[2]}${upper[2]}${upper[3]}${upper[3]}`;
        if (COLOR_MAP[withoutAlpha]) return withoutAlpha;
    }

    const rgb = getRgbValues(normalized);
    if (!rgb || isThemeNeutralColor(rgb)) return null;

    return getClosestPaletteColor(rgb, COLOR_MAP);
}

function isIgnoredBackgroundColor(color: string | null | undefined): boolean {
    if (!color) return false;
    return /^(transparent|inherit|none)$/i.test(color.trim()) || /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(color);
}

function isBlockElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toUpperCase();
    const blockTags = new Set([
        'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'CANVAS', 'DD', 'DIV', 'DL', 'DT',
        'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4',
        'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'NOSCRIPT', 'OL', 'P',
        'PRE', 'SECTION', 'TABLE', 'TFOOT', 'UL', 'VIDEO', 'TR', 'TD', 'TH', 'TBODY', 'THEAD',
        'DETAILS', 'SUMMARY', 'CAPTION', 'COL', 'COLGROUP'
    ]);
    return blockTags.has(tagName);
}

function getPaletteShort(color: string | null | undefined): string | null {
    const hex = normalizePaletteColor(color);
    return hex ? COLOR_MAP[hex] : null;
}

function getClassShort(element: Element, prefix: 'tc' | 'hl'): string | null {
    for (const className of Array.from(element.classList)) {
        const match = className.match(new RegExp(`^${prefix}-([a-z]{2})$`));
        if (match && SHORT_TO_HEX[match[1]]) return match[1];
    }
    return null;
}

export function prepareMarksHTMLForClipboard(html: string): string {
    if (typeof document === 'undefined' || !html) return html;

    const template = document.createElement('template');
    template.innerHTML = html;

    template.content.querySelectorAll<HTMLElement>('[class*="tc-"], [class*="hl-"]').forEach(element => {
        const highlightShort = getClassShort(element, 'hl');
        let portableElement = element;

        if (highlightShort && element.tagName.toLowerCase() === 'mark') {
            const span = document.createElement('span');
            Array.from(element.attributes).forEach(attribute => {
                span.setAttribute(attribute.name, attribute.value);
            });
            while (element.firstChild) {
                span.appendChild(element.firstChild);
            }
            element.replaceWith(span);
            portableElement = span;
        }

        const textColorShort = getClassShort(portableElement, 'tc');
        if (textColorShort) {
            portableElement.style.color = SHORT_TO_HEX[textColorShort];
        }

        if (highlightShort) {
            const highlightColor = SHORT_TO_HEX[highlightShort];
            portableElement.style.backgroundColor = highlightColor;
            portableElement.style.setProperty('mso-highlight', highlightColor);
        }

        portableElement.classList.forEach(className => {
            if (/^(tc|hl)-[a-z]{2}$/.test(className)) {
                portableElement.classList.remove(className);
            }
        });

        if (!portableElement.getAttribute('class')) {
            portableElement.removeAttribute('class');
        }
    });

    return template.innerHTML;
}

export const CustomColor = Color.extend({
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    color: {
                        default: null,
                        parseHTML: element => {
                            const classShort = getClassShort(element, 'tc');
                            if (classShort) {
                                return SHORT_TO_HEX[classShort];
                            }

                            return normalizePaletteColor(element.style.color);
                        },
                        renderHTML: attributes => {
                            const short = getPaletteShort(attributes.color);
                            if (short) return { class: `tc-${short}` };

                            if (!attributes.color) return {};
                            return { style: `color: ${attributes.color}` };
                        },
                    },
                },
            },
        ];
    },
});

export const CustomHighlight = Highlight.extend({
    parseHTML() {
        return [
            {
                tag: 'mark',
                getAttrs: node => {
                    const element = node as HTMLElement;
                    const classShort = getClassShort(element, 'hl');
                    if (classShort) return { color: SHORT_TO_HEX[classShort] };

                    const rawColor = element.getAttribute('data-color') || element.style.backgroundColor || element.style.background;
                    if (isIgnoredBackgroundColor(rawColor)) return false;

                    const color = normalizePaletteColor(rawColor);
                    if (color) return { color };

                    return rawColor ? false : { color: SHORT_TO_HEX.yw };
                },
            },
            {
                tag: 'span',
                getAttrs: node => {
                    const classShort = getClassShort(node as HTMLElement, 'hl');
                    if (!classShort) return false;
                    return { color: SHORT_TO_HEX[classShort] };
                },
            },
            {
                tag: '[style*="background-color"]',
                getAttrs: node => {
                    const element = node as HTMLElement;
                    if (isBlockElement(element)) return false;

                    const value = element.style.backgroundColor;
                    if (!value || value === 'transparent' || value === 'inherit' || value === 'none') return false;

                    const color = normalizePaletteColor(value);
                    return color ? { color } : false;
                },
            },
            {
                tag: '[style*="background"]',
                getAttrs: node => {
                    const element = node as HTMLElement;
                    if (isBlockElement(element)) return false;

                    const value = element.style.background;
                    if (!value || value === 'transparent' || value === 'inherit' || value === 'none') return false;

                    const color = normalizePaletteColor(value);
                    return color ? { color } : false;
                },
            },
        ];
    },

    addAttributes() {
        if (!this.options.multicolor) return {};

        return {
            color: {
                default: null,
                parseHTML: element => {
                    const classShort = getClassShort(element, 'hl');
                    if (classShort) {
                        return SHORT_TO_HEX[classShort];
                    }

                    const rawColor = (
                        element.getAttribute('data-color') ||
                        element.style.backgroundColor ||
                        element.style.background
                    )?.replace(/['"]+/g, '');

                    const normalizedColor = normalizePaletteColor(rawColor);
                    if (normalizedColor) {
                        return normalizedColor;
                    }

                    if (element.tagName.toLowerCase() === 'mark') return SHORT_TO_HEX.yw;

                    return null;
                },
                renderHTML: attributes => {
                    const short = getPaletteShort(attributes.color);
                    if (short) return { class: `hl-${short}` };

                    if (!attributes.color) return {};
                    return { style: `background-color: ${attributes.color}; color: inherit` };
                },
            },
        };
    },
});

export const CustomTextStyle = TextStyle.extend({
    parseHTML() {
        return [
            {
                tag: 'span',
                getAttrs: element => {
                    const hasStyles = element.hasAttribute('style');
                    const hasColorClass = element.getAttribute('class')?.match(/tc-[a-z]{2}/);
                    const hasHighlightClass = element.getAttribute('class')?.match(/hl-[a-z]{2}/);

                    if (!hasStyles && !hasColorClass && !hasHighlightClass) {
                        return false;
                    }
                    return {};
                },
            },
        ];
    },
});
