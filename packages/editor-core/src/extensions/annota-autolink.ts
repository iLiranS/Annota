import { Mark, markPasteRule } from '@tiptap/core';

export const AnnotaAutolink = Mark.create({
    name: 'annotaAutolink',

    addPasteRules() {
        return [
            markPasteRule({
                find: /(?:^|\s)(annota:\/\/note\/[a-zA-Z0-9-?&=._%]+)/gi,
                type: this.editor.schema.marks.link,
                getAttributes: (match) => ({
                    href: match[1],
                }),
            }),
        ];
    },
});
