import React, { forwardRef } from 'react';
import { IframeEditor } from './IframeEditor';
import { NativeEditor } from './NativeEditor';
import { TipTapEditorProps, TipTapEditorRef } from './types';

const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

const TipTapEditor = React.memo(forwardRef<TipTapEditorRef, TipTapEditorProps>((props, ref) => {
    if (isTauri) {
        return <NativeEditor {...props} ref={ref} />;
    }
    return <IframeEditor {...props} ref={ref} />;
}));

TipTapEditor.displayName = 'TipTapEditor';

export default TipTapEditor;
export type { TipTapEditorProps, TipTapEditorRef, ToolbarRenderProps } from './types';
export { TipTapEditor };

