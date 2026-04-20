import { Extension } from '@tiptap/core';

export const Indentation = Extension.create({
  name: 'indentation',

  priority: 1100, // Higher priority to ensure it catches Tab before other extensions or browser defaults

  addKeyboardShortcuts() {
    return {
      'Tab': () => {
        const { editor } = this;

        if (editor.isActive('table')) {
          return false;
        }

        // Try sinking list item first (standard list then task list)
        return editor.commands.sinkListItem('listItem')
          || editor.commands.sinkListItem('taskItem')
          || editor.commands.insertContent('  ');
      },

      'Shift-Tab': () => {
        const { editor } = this;

        if (editor.isActive('table')) {
          return false;
        }

        // Try lifting list item first
        if (editor.can().liftListItem('listItem')) {
          return editor.commands.liftListItem('listItem');
        }

        if (editor.can().liftListItem('taskItem')) {
          return editor.commands.liftListItem('taskItem');
        }

        // Handle outdenting CodeBlocks or normal text
        const { state } = editor.view;
        const { selection } = state;
        const { $from, empty } = selection;

        if (empty) {
          // Find the text before the cursor
          const textBefore = $from.parent.textBetween(0, $from.parentOffset);

          // If the text before cursor ends with spaces, remove up to 2 of them
          if (textBefore.endsWith('  ')) {
            editor.commands.deleteRange({ from: selection.from - 2, to: selection.from });
            return true;
          } else if (textBefore.endsWith(' ')) {
            editor.commands.deleteRange({ from: selection.from - 1, to: selection.from });
            return true;
          }
        }

        return true; // Prevent focus jump
      },
    };
  },
});
