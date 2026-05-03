import { useState } from "react";

export function useNoteEditorCommands() {
    const [slashCommandState, setSlashCommandState] = useState<{ active: boolean; query?: string; range?: { from: number; to: number }; clientRect?: any }>({ active: false });
    const [tagCommandState, setTagCommandState] = useState<{ active: boolean; query?: string; range?: { from: number; to: number }; clientRect?: any }>({ active: false });
    const [noteLinkCommandState, setNoteLinkCommandState] = useState<{ active: boolean; query?: string; range?: { from: number; to: number }; clientRect?: any }>({ active: false });

    return {
        slashCommandState,
        setSlashCommandState,
        tagCommandState,
        setTagCommandState,
        noteLinkCommandState,
        setNoteLinkCommandState,
    };
}
