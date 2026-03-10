import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { EDITOR_FONTS, useSettingsStore } from "@annota/core";
import {
    AlignLeft,
    Check,
    ChevronRight,
    Languages,
    Maximize2,
    TextCursor,
    Type
} from "lucide-react";

import { CODE_LANGUAGES } from "@annota/core/constants/editor-code-languages";
import { SettingItem } from "./setting-item";

interface SliderItemProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    displayValue: string;
    onChange: (val: number) => void;
    icon: React.ReactNode;
    iconBg: string;
}

function SliderItem({ label, value, min, max, step, displayValue, onChange, icon, iconBg }: SliderItemProps) {
    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm",
                        iconBg
                    )}>
                        {icon}
                    </div>
                    <span className="text-sm font-medium text-foreground">{label}</span>
                </div>
                <span className="text-xs font-mono bg-accent/50 px-2 py-0.5 rounded text-muted-foreground">
                    {displayValue}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-1.5 bg-accent rounded-lg appearance-none cursor-pointer accent-primary"
            />
        </div>
    );
}

export function EditorSettings() {
    const { editor, updateEditorSettings } = useSettingsStore();

    const directionLabels: Record<string, string> = {
        'ltr': 'Left to Right',
        'rtl': 'Right to Left',
        'auto': 'Automatic'
    };

    const toggleDirection = () => {
        const next = editor.direction === 'auto' ? 'ltr' : editor.direction === 'ltr' ? 'rtl' : 'auto';
        updateEditorSettings({ direction: next as any });
    };

    const getFontSizeDisplay = () => {
        const level = editor.fontSize - 16;
        return (level > 0 ? '+' : '') + level;
    };

    const getLineSpacingDisplay = () => {
        const level = Math.round((editor.lineSpacing - 1.5) / 0.1);
        return (level > 0 ? '+' : '') + level;
    };

    const getNoteWidthDisplay = () => {
        if (editor.noteWidth === 0) return "Full Width";
        return `${editor.noteWidth}px`;
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Text Appearance Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    Text Appearance
                </h4>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm divide-y">
                    <SliderItem
                        label="Font Size"
                        icon={<Type size={18} />}
                        iconBg="bg-blue-500"
                        min={12}
                        max={24}
                        step={1}
                        value={editor.fontSize}
                        displayValue={getFontSizeDisplay()}
                        onChange={(val) => updateEditorSettings({ fontSize: val })}
                    />
                    <SliderItem
                        label="Line Spacing"
                        icon={<AlignLeft size={18} />}
                        iconBg="bg-indigo-500"
                        min={1.0}
                        max={2.5}
                        step={0.1}
                        value={editor.lineSpacing}
                        displayValue={getLineSpacingDisplay()}
                        onChange={(val) => updateEditorSettings({ lineSpacing: val })}
                    />
                </div>
            </section>

            {/* Typography Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    Typography
                </h4>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm divide-y">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="w-full cursor-pointer">
                                <SettingItem
                                    label="Font Family"
                                    description="Choose the editor font"
                                    icon={<TextCursor size={18} />}
                                    iconBg="bg-violet-500"
                                    value={EDITOR_FONTS.find(f => f.id === editor.fontFamily)?.label || editor.fontFamily}
                                    action={<ChevronRight size={16} className="text-muted-foreground" />}
                                />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {EDITOR_FONTS.map((font) => (
                                <DropdownMenuItem
                                    key={font.id}
                                    onClick={() => updateEditorSettings({ fontFamily: font.id })}
                                    className="flex items-center justify-between"
                                >
                                    <span style={{ fontFamily: font.fontFamily }}>{font.label}</span>
                                    {editor.fontFamily === font.id && <Check size={14} className="text-primary" />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <SettingItem
                        label="Text Direction"
                        description="LTR, RTL or Automatic"
                        icon={<AlignLeft size={18} className={cn(editor.direction === 'rtl' && "rotate-180")} />}
                        iconBg="bg-amber-500"
                        value={directionLabels[editor.direction]}
                        onClick={toggleDirection}
                        action={<ChevronRight size={16} className="text-muted-foreground" />}
                    />
                </div>
            </section>

            {/* Code Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    Code Blocks
                </h4>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm divide-y">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="w-full cursor-pointer">
                                <SettingItem
                                    label="Default Language"
                                    description="Language applied to new code blocks"
                                    icon={<Languages size={18} />}
                                    iconBg="bg-rose-500"
                                    value={CODE_LANGUAGES.find(l => l.value === editor.defaultCodeLanguage)?.label || 'Auto'}
                                    action={<ChevronRight size={16} className="text-muted-foreground" />}
                                />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                            {CODE_LANGUAGES.map((lang) => (
                                <DropdownMenuItem
                                    key={lang.value || 'auto'}
                                    onClick={() => updateEditorSettings({ defaultCodeLanguage: lang.value })}
                                    className="flex items-center justify-between"
                                >
                                    <span>{lang.label}</span>
                                    {editor.defaultCodeLanguage === lang.value && <Check size={14} className="text-primary" />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </section>

            {/* Layout Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    Layout
                </h4>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm divide-y">
                    <SliderItem
                        label="Note Width"
                        icon={<Maximize2 size={18} />}
                        iconBg="bg-emerald-500"
                        min={400}
                        max={1200}
                        step={50}
                        value={editor.noteWidth === 0 ? 1200 : editor.noteWidth}
                        displayValue={getNoteWidthDisplay()}
                        onChange={(val) => updateEditorSettings({ noteWidth: val === 1200 ? 0 : val })}
                    />
                </div>
                <p className="text-[11px] text-muted-foreground px-1">
                    Limiting note width can help focus and improve readability on large screens. "Full Width" fills the entire available area.
                </p>
            </section>
        </div>
    );
}

// Add CSS for the range input to make it look premium
const style = document.createElement('style');
style.textContent = `
    input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none;
        height: 16px;
        width: 16px;
        border-radius: 50%;
        background: white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        cursor: pointer;
        margin-top: -7px;
        border: 2px solid var(--accent-color);
    }
    input[type=range]::-moz-range-thumb {
        height: 16px;
        width: 16px;
        border-radius: 50%;
        background: white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        cursor: pointer;
        border: 2px solid var(--accent-color);
    }
    input[type=range]::-webkit-slider-runnable-track {
        height: 4px;
        background: rgba(128, 128, 128, 0.1);
        border-radius: 2px;
    }
`;
if (typeof document !== 'undefined') {
    document.head.appendChild(style);
}
