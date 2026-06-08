import { BlockMath, InlineMath, Mathematics } from '@tiptap/extension-mathematics';

export function getPlainTextFromFragment(fragmentOrSlice: any): string {
    if (!fragmentOrSlice) return '';
    const fragment = fragmentOrSlice.content && typeof fragmentOrSlice.content.textBetween === 'function'
        ? fragmentOrSlice.content
        : fragmentOrSlice;

    if (typeof fragment.textBetween !== 'function') {
        return '';
    }
    return fragment.textBetween(0, fragment.size, ' ', (node: any) => {
        if (node.type.name === 'inlineMath') {
            return `$${node.attrs.latex || ''}$`;
        }
        if (node.type.name === 'blockMath') {
            return `$$${node.attrs.latex || ''}$$`;
        }
        return '';
    });
}

const CustomInlineMath = InlineMath.extend({
    renderText({ node }) {
        return node.attrs.latex;
    }
});

const CustomBlockMath = BlockMath.extend({
    renderText({ node }) {
        return `\n${node.attrs.latex}\n`;
    }
});

export const CustomMathematics = Mathematics.extend({
    addExtensions() {
        return [
            CustomBlockMath.configure({
                ...this.options.blockOptions,
                katexOptions: {
                    ...this.options.katexOptions,
                    displayMode: true
                }
            }),
            CustomInlineMath.configure({
                ...this.options.inlineOptions,
                katexOptions: {
                    ...this.options.katexOptions,
                    displayMode: false
                }
            })
        ];
    }
});
