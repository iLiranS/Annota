import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorState, initialEditorState } from '../shared/types';

interface WebViewBridgeOptions {
    sendMessage: (command: string, params: Record<string, any>) => void;
    onMessage?: (type: string, data: any) => void;
}

export function useWebViewBridge({ sendMessage, onMessage }: WebViewBridgeOptions) {
    const [isReady, setIsReady] = useState(false);
    const [editorState, setEditorState] = useState<EditorState>(initialEditorState);
    const isReadyRef = useRef(false);
    const queuedCommandsRef = useRef<Array<{ command: string; params: Record<string, any> }>>([]);

    const dispatchCommand = useCallback((command: string, params: Record<string, any> = {}) => {
        if (!isReadyRef.current && command !== 'setOptions') {
            queuedCommandsRef.current.push({ command, params });
            return;
        }
        sendMessage(command, params);
    }, [sendMessage]);

    const handleBridgeMessage = useCallback((data: any) => {
        if (!data || !data.type) return;

        switch (data.type) {
            case 'ready':
                isReadyRef.current = true;
                setIsReady(true);
                // Flush queued commands
                if (queuedCommandsRef.current.length > 0) {
                    const pending = queuedCommandsRef.current;
                    queuedCommandsRef.current = [];
                    pending.forEach(({ command, params }) => {
                        sendMessage(command, params);
                    });
                }
                break;
            case 'state':
                setEditorState(data.state);
                break;
        }

        onMessage?.(data.type, data);
    }, [onMessage, sendMessage]);

    return {
        isReady,
        editorState,
        setEditorState,
        dispatchCommand,
        handleBridgeMessage
    };
}
