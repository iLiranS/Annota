import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

export const CustomTableCell = TableCell.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            backgroundColor: {
                default: null,
                renderHTML: attrs => {
                    if (!attrs.backgroundColor) return {};
                    return { style: `background-color: ${attrs.backgroundColor}` };
                },
                parseHTML: element => element.style.backgroundColor || null,
            },
        };
    },
});

export const CustomTableHeader = TableHeader.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            backgroundColor: {
                default: null,
                renderHTML: attrs => {
                    if (!attrs.backgroundColor) return {};
                    return { style: `background-color: ${attrs.backgroundColor}` };
                },
                parseHTML: element => element.style.backgroundColor || null,
            },
        };
    },
});
