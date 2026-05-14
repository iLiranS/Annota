import { Extension } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';

export const SelectionManager = Extension.create({
  name: 'selectionManager',

  addProseMirrorPlugins() {
    return [
      // 1. Mobile Selection Plugin: Handle scroll-fighting
      new Plugin({
        key: new PluginKey('mobileSelectionManager'),
        props: {
          handleDOMEvents: {
            touchstart: () => {
              // Potential start of a drag
              return false;
            },
            touchmove: (view) => {
              (view as any)._touchDragging = true;
              return false;
            },
            touchend: (view) => {
              (view as any)._touchDragging = false;
              return false;
            },
            touchcancel: (view) => {
              (view as any)._touchDragging = false;
              return false;
            },
          },
        },
        view(editorView) {
          const originalScrollIntoView = (editorView as any).scrollIntoView?.bind(editorView);

          // Override scrollIntoView to respect touch dragging
          if (originalScrollIntoView) {
            (editorView as any).scrollIntoView = () => {
              if ((editorView as any)._touchDragging) {
                return; // suppress during active touch drag
              }
              originalScrollIntoView();
            };
          }

          // iOS selectionchange handling - debounced or suppressed during drag
          const handleSelectionChange = () => {
            if ((editorView as any)._touchDragging) {
              // When dragging selection on iOS, it aggressively tries to scroll.
              // Our scrollIntoView override handles the PM side.
            }
          };

          document.addEventListener('selectionchange', handleSelectionChange);

          return {
            destroy() {
              if (originalScrollIntoView) {
                (editorView as any).scrollIntoView = originalScrollIntoView;
              }
              document.removeEventListener('selectionchange', handleSelectionChange);
            },
          };
        },
      }),

      // 2. Desktop Selection Plugin: Proper node and shift selection
      new Plugin({
        key: new PluginKey('desktopSelectionManager'),
        props: {
          handleClickOn(view, pos, node, nodePos, event, direct) {
            // Shift-click = extend selection natively
            if (event.shiftKey) {
              const { selection } = view.state;
              const newSel = TextSelection.create(view.state.doc, selection.anchor, pos);
              view.dispatch(view.state.tr.setSelection(newSel));
              return true;
            }

            // Click on non-text atom node (like image, mermaid) = NodeSelection
            if (direct && node.isAtom && node.type.name !== 'text') {
              view.dispatch(
                view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos))
              );
              return true;
            }

            return false;
          },

          handleDOMEvents: {
            mousedown(_view, event) {
              const target = event.target as HTMLElement;

              // Prevent default drag-select from conflicting with custom nodes
              const wrapper = target.closest('[data-node-view-wrapper], .tableWrapper, .flashcard-block, .mermaid-block, [data-type="blockMath"], [data-type="block-math"]'); if (wrapper) {
                const isEditable = target.isContentEditable || !!target.closest('[contenteditable="true"]');
                const isInteractive = !!target.closest('button, input, textarea, a');

                if (!isEditable && !isInteractive) {
                  // This is chrome of a rich node. Let handleClickOn handle the selection.
                  event.preventDefault();
                  return true;
                }
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});
