import React, { forwardRef } from 'react';
import EditorNative from './Editor.native';
import { TipTapEditorProps, TipTapEditorRef } from './shared/types';

const TipTapEditor = React.memo(forwardRef<TipTapEditorRef, TipTapEditorProps>((props, ref) => {
    return <EditorNative {...props} ref={ref} />;
}));

TipTapEditor.displayName = 'TipTapEditor';

export default TipTapEditor;
export { TipTapEditor };
export * from './shared/types';
export * from './shared/slash-commands-config';
