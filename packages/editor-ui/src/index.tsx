import React, { forwardRef } from 'react';
import EditorDom from './Editor.dom';
import { TipTapEditorProps, TipTapEditorRef } from './shared/types';

const TipTapEditor = React.memo(forwardRef<TipTapEditorRef, TipTapEditorProps>((props, ref) => {
    return <EditorDom {...props} ref={ref} />;
}));

TipTapEditor.displayName = 'TipTapEditor';

export const ensureEditorHtmlCache = async (): Promise<string> => {
    return '';
};

export default TipTapEditor;
export { TipTapEditor };
export * from './shared/types';
export * from './shared/slash-commands-config';

