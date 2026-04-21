import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: () => ReturnType,
    outdent: () => ReturnType,
  }
}

export const Indentation = Extension.create({
  name: 'indentation',

  priority: 1100, // Higher priority to ensure it catches Tab before other extensions or browser defaults

  addCommands() {
    return {
      indent: () => ({ dispatch, editor }: { dispatch: any, editor: any }) => {
        if (editor.isActive('table')) {
          return false;
        }

        // Try sinking list item first (standard list then task list)
        if (editor.can().sinkListItem('listItem')) {
          return dispatch ? editor.commands.sinkListItem('listItem') : true;
        }
        if (editor.can().sinkListItem('taskItem')) {
          return dispatch ? editor.commands.sinkListItem('taskItem') : true;
        }

        if (dispatch) {
          return editor.commands.insertContent('  ');
        }

        return true;
      },

      outdent: () => ({ state, dispatch, editor }: { state: any, dispatch: any, editor: any }) => {
        if (editor.isActive('table')) {
          return false;
        }

        // Try lifting list item first
        if (editor.can().liftListItem('listItem')) {
          return dispatch ? editor.commands.liftListItem('listItem') : true;
        }

        if (editor.can().liftListItem('taskItem')) {
          return dispatch ? editor.commands.liftListItem('taskItem') : true;
        }

        // Handle outdenting CodeBlocks or normal text
        const { selection } = state;
        const { $from, empty } = selection;

        if (empty) {
          // Find the text before the cursor
          const textBefore = $from.parent.textBetween(0, $from.parentOffset);

          // If the text before cursor ends with spaces, remove up to 2 of them
          if (textBefore.endsWith('  ')) {
            if (dispatch) {
              return editor.commands.deleteRange({ from: selection.from - 2, to: selection.from });
            }
            return true;
          } else if (textBefore.endsWith(' ')) {
            if (dispatch) {
              return editor.commands.deleteRange({ from: selection.from - 1, to: selection.from });
            }
            return true;
          }
        }

        return false;
      },
    } as any;
  },

  addKeyboardShortcuts() {
    return {
      'Tab': () => (this.editor.commands as any).indent(),
      'Shift-Tab': () => (this.editor.commands as any).outdent(),
    };
  },
});
