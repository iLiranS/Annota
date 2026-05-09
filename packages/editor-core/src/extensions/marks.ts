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
    '#727272': 'gy',
    '#A07855': 'br'
};

export const SHORT_TO_HEX: Record<string, string> = Object.entries(COLOR_MAP).reduce((acc, [hex, short]) => {
    acc[short] = hex;
    return acc;
}, {} as Record<string, string>);

export const CustomColor = Color.extend({

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    color: {
                        default: null,
                        parseHTML: element => {
                            const className = element.getAttribute('class');
                            if (className) {
                                const match = className.match(/tc-([a-z]{2})/);
                                if (match && match[1] && SHORT_TO_HEX[match[1]]) {
                                    return SHORT_TO_HEX[match[1]];
                                }
                            }
                            return element.style.color?.replace(/['"]+/g, '');
                        },
                        renderHTML: attributes => {
                            if (!attributes.color) {
                                return {};
                            }

                            const hex = attributes.color.toUpperCase();
                            const shortCode = COLOR_MAP[hex];

                            if (shortCode) {
                                return { class: `tc-${shortCode}` };
                            }

                            return { style: `color: ${attributes.color}` };
                        },
                    },
                },
            },
        ];
    },
});

export const CustomHighlight = Highlight.extend({
    addAttributes() {
        if (!this.options.multicolor) {
            return {};
        }

        return {
            color: {
                default: null,
                parseHTML: element => {
                    const className = element.getAttribute('class');
                    if (className) {
                        const match = className.match(/hl-([a-z]{2})/);
                        if (match && match[1] && SHORT_TO_HEX[match[1]]) {
                            return SHORT_TO_HEX[match[1]];
                        }
                    }
                    return element.getAttribute('data-color') || element.style.backgroundColor;
                },
                renderHTML: attributes => {
                    if (!attributes.color) {
                        return {};
                    }

                    const hex = attributes.color.toUpperCase();
                    const shortCode = COLOR_MAP[hex];

                    if (shortCode) {
                        return { class: `hl-${shortCode}` };
                    }

                    return {
                        'data-color': attributes.color,
                        style: `background-color: ${attributes.color}; color: inherit`,
                    };
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
                    
                    if (!hasStyles && !hasColorClass) {
                        return false;
                    }
                    
                    return {};
                },
            },
        ];
    },
});
