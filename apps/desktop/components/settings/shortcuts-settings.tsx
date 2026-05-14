import { Command } from "lucide-react";

interface ShortcutItemProps {
    label: string;
    keys: string[];
    description?: string;
}

function ShortcutItem({ label, keys, description }: ShortcutItemProps) {
    return (
        <div className="flex items-center justify-between p-3.5 group hover:bg-accent/5 transition-colors">
            <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{label}</span>
                {description && <span className="text-xs text-muted-foreground">{description}</span>}
            </div>
            <div className="flex gap-1">
                {keys.map((key, i) => (
                    <kbd
                        key={i}
                        className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100"
                    >
                        {key === "Mod" ? (
                            <Command className="h-3 w-3" />
                        ) : (
                            key
                        )}
                    </kbd>
                ))}
            </div>
        </div>
    );
}

export function ShortcutsSettings() {
    const isMac = typeof window !== 'undefined' && window.navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? "⌘" : "Ctrl";

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
            {/* App Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    Application Shortcuts
                </h4>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm divide-y">
                    <ShortcutItem label="New Note" keys={[modKey, "N"]} />
                    <ShortcutItem label="Quick Search" keys={[modKey, "P"]} />
                    <ShortcutItem label="Toggle Secondary Sidebar" keys={[modKey, "E"]} />
                    <ShortcutItem label="Settings" keys={[modKey, ","]} />
                    <ShortcutItem label="Always on Top" keys={[modKey, "Shift", "T"]} />
                    <ShortcutItem label="Zoom In" keys={[modKey, "+"]} />
                    <ShortcutItem label="Zoom Out" keys={[modKey, "-"]} />
                    <ShortcutItem label="Reset Zoom" keys={[modKey, "0"]} />
                </div>
            </section>

            {/* Editor Section */}
            <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-1">
                    Editor Shortcuts
                </h4>
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm divide-y">
                    <ShortcutItem label="Bold" keys={[modKey, "B"]} />
                    <ShortcutItem label="Italic" keys={[modKey, "I"]} />
                    <ShortcutItem label="Underline" keys={[modKey, "U"]} />
                    <ShortcutItem label="Strikethrough" keys={[modKey, "Shift", "X"]} />
                    <ShortcutItem label="Inline Code" keys={[modKey, "Shift", "E"]} />
                    <ShortcutItem label="Code Block" keys={[modKey, "Alt", "C"]} />
                    <ShortcutItem label="Headings" keys={[modKey, "1-6"]} description="Apply heading levels 1 to 6" />
                    <ShortcutItem label="Bullet List" keys={[modKey, "7"]} />
                    <ShortcutItem label="Ordered List" keys={[modKey, "8"]} />
                    <ShortcutItem label="Task List" keys={[modKey, "9"]} />
                    <ShortcutItem label="Blockquote" keys={[modKey, "Shift", "B"]} />
                    <ShortcutItem label="Toggle Details" keys={[modKey, "."]} description="Wrap selection in a collapsible block" />
                    <ShortcutItem label="Insert Link" keys={[modKey, "K"]} />
                    <ShortcutItem label="Insert Math" keys={[modKey, "Shift", "M"]} />
                    <ShortcutItem label="Clear Formatting" keys={[modKey, "Shift", "N"]} />
                    <ShortcutItem label="Text Color" keys={[modKey, "Alt", "0-9"]} description="Apply preset colors" />
                    <ShortcutItem label="Highlight" keys={[modKey, "Alt", "Shift", "0-9"]} description="Apply highlight colors" />
                </div>
            </section>
        </div>
    );
}
