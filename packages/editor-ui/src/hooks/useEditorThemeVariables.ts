import { resolveFontFamily } from '@annota/editor-core';
import { useEffect, type RefObject } from 'react';
import { colorWithAlpha } from '../shared/color';

type EditorColors = {
    primary: string;
    background: string;
    text: string;
};

type EditorSettings = {
    fontFamily: string;
    fontSize: number;
    lineSpacing: number;
    noteWidth: number;
    paragraphSpacing: number;
};

type UseEditorThemeVariablesArgs = {
    colors: EditorColors;
    dark: boolean;
    editorSettings: EditorSettings;
    rootRef: RefObject<HTMLElement | null>;
};

export function useEditorThemeVariables({ colors, dark, editorSettings, rootRef }: UseEditorThemeVariablesArgs) {
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        root.style.setProperty('--bg-color', dark ? 'transparent' : colors.background);
        root.style.setProperty('--text-color', dark ? 'rgba(255, 255, 255, 0.85)' : colors.text);
        root.style.setProperty('--accent-color', colors.primary);
        root.style.setProperty('--accent', colors.primary + "65");
        root.style.setProperty('--accent-full', colors.primary);
        root.style.setProperty('--editor-font-size', `${editorSettings.fontSize}px`);
        root.style.setProperty('--editor-font-family', resolveFontFamily(editorSettings.fontFamily));
        root.style.setProperty('--editor-line-height', `${editorSettings.lineSpacing}`);
        root.style.setProperty('--editor-paragraph-spacing', `${editorSettings.paragraphSpacing}px`);
        root.style.setProperty('--editor-max-width', editorSettings.noteWidth > 0 ? `${editorSettings.noteWidth}px` : '100%');
        root.style.setProperty('--placeholder-color', dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)');
        root.style.setProperty('--code-bg', dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)');
        root.style.setProperty('--code-block-bg', dark ? '#1E1E1E' : '#F5F5F5');
        root.style.setProperty('--border-color', dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)');
        root.style.setProperty('--selection-bg', colorWithAlpha(colors.primary, 0.25));
        root.style.setProperty('--block-selection-bg', colorWithAlpha(colors.primary, 0.16));
        root.style.setProperty('--block-selection-border', colorWithAlpha(colors.primary, 0.45));
    }, [colors, dark, editorSettings, rootRef]);
}
