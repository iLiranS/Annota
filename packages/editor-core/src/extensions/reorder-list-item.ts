import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    reorderListItem: {
      /**
       * Move the current list item up.
       */
      moveListItemUp: () => ReturnType;
      /**
       * Move the current list item down.
       */
      moveListItemDown: () => ReturnType;
    };
  }
}

export const ListItemReorder = Extension.create({
  name: 'listItemReorder',

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-ArrowUp': () => this.editor.commands.moveListItemUp(),
      'Mod-Alt-ArrowDown': () => this.editor.commands.moveListItemDown(),
    };
  },

  addCommands() {
    return {
      moveListItemUp:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          const { $from } = selection;

          let listItemPos = -1;
          let listItemNode: any = null;
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
              listItemPos = $from.before(d);
              listItemNode = node;
              break;
            }
          }

          if (listItemPos === -1 || !listItemNode) return false;

          const $pos = state.doc.resolve(listItemPos);
          const index = $pos.index();
          if (index === 0) return false;

          const parent = $pos.parent;
          const prevNode = parent.child(index - 1);
          if (prevNode.type.name !== listItemNode.type.name) return false;

          if (dispatch) {
            const relativeOffset = selection.from - listItemPos;
            const relativeEndOffset = selection.to - listItemPos;
            const prevNodeSize = prevNode.nodeSize;
            const newPos = listItemPos - prevNodeSize;

            tr.delete(listItemPos, listItemPos + listItemNode.nodeSize);
            tr.insert(newPos, listItemNode);

            // Re-set selection relative to the new position
            const targetFrom = newPos + relativeOffset;
            const targetTo = newPos + relativeEndOffset;

            // Use appropriate selection type
            if (selection instanceof state.selection.constructor) {
              try {
                // @ts-ignore
                const newSelection = state.selection.constructor.create(tr.doc, targetFrom, targetTo);
                tr.setSelection(newSelection);
              } catch (e) {
                // Fallback to simple selection if create fails
                tr.setSelection(state.selection.map(tr.doc, tr.mapping));
              }
            }
            
            tr.scrollIntoView();
          }

          return true;
        },

      moveListItemDown:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          const { $from } = selection;

          let listItemPos = -1;
          let listItemNode: any = null;
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
              listItemPos = $from.before(d);
              listItemNode = node;
              break;
            }
          }

          if (listItemPos === -1 || !listItemNode) return false;

          const $pos = state.doc.resolve(listItemPos);
          const index = $pos.index();
          const parent = $pos.parent;

          if (index >= parent.childCount - 1) return false;

          const nextNode = parent.child(index + 1);
          if (nextNode.type.name !== listItemNode.type.name) return false;

          if (dispatch) {
            const relativeOffset = selection.from - listItemPos;
            const relativeEndOffset = selection.to - listItemPos;
            const nextNodeSize = nextNode.nodeSize;
            const moveSize = listItemNode.nodeSize;
            
            // In a delete then insert down:
            // 1. Delete original item
            tr.delete(listItemPos, listItemPos + moveSize);
            // 2. The next node has now shifted back to listItemPos
            // 3. Insert after where the next node ends now
            const newPos = listItemPos + nextNodeSize;
            tr.insert(newPos, listItemNode);

            // Re-set selection relative to the new position
            const targetFrom = newPos + relativeOffset;
            const targetTo = newPos + relativeEndOffset;

            if (selection instanceof state.selection.constructor) {
              try {
                // @ts-ignore
                const newSelection = state.selection.constructor.create(tr.doc, targetFrom, targetTo);
                tr.setSelection(newSelection);
              } catch (e) {
                tr.setSelection(state.selection.map(tr.doc, tr.mapping));
              }
            }
            
            tr.scrollIntoView();
          }

          return true;
        },
    };
  },
});
