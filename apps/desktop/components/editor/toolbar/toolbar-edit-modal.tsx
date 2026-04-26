import { Button } from '../../ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../ui/dialog';
import { DesktopIconMap, EditorIcons } from '../EditorIcons';

type ToolbarEditModalProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    visibleItems: { id: string; label: string }[];
    hiddenItems: { id: string; label: string }[];
    onMoveItem: (id: string, direction: 'up' | 'down') => void;
    onToggleVisibility: (id: string) => void;
    onReset: () => void;
};

export function ToolbarEditModal({
    isOpen,
    onOpenChange,
    visibleItems,
    hiddenItems,
    onMoveItem,
    onToggleVisibility,
    onReset,
}: ToolbarEditModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Toolbar</DialogTitle>
                    <DialogDescription>
                        Reorder your toolbar elements.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-6">
                    <section>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
                            Main Toolbar
                        </h3>
                        <div className="space-y-1">
                            {visibleItems.map((item, index) => {
                                const Icon = DesktopIconMap[item.id] || EditorIcons.More;
                                return (
                                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 group transition-colors">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-accent/30">
                                            <Icon className="w-4 h-4 opacity-70" />
                                        </div>
                                        <span className="flex-1 text-sm font-medium">{item.label}</span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground"
                                                title="Move to Plus Menu"
                                                onClick={() => onToggleVisibility(item.id)}
                                            >
                                                <EditorIcons.Plus className="w-4 h-4 rotate-45" />
                                            </Button>
                                            <div className="w-px h-4 bg-border mx-1" />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                disabled={index === 0}
                                                onClick={() => onMoveItem(item.id, 'up')}
                                            >
                                                <EditorIcons.ChevronUp className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                disabled={index === visibleItems.length - 1}
                                                onClick={() => onMoveItem(item.id, 'down')}
                                            >
                                                <EditorIcons.ChevronDown className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {hiddenItems.length > 0 && (
                        <section>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
                                Always in "..." More Menu
                            </h3>
                            <div className="space-y-1 opacity-60">
                                {hiddenItems.map((item) => {
                                    const Icon = DesktopIconMap[item.id] || EditorIcons.More;
                                    return (
                                        <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 group transition-colors">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-accent/30">
                                                <Icon className="w-4 h-4 opacity-70" />
                                            </div>
                                            <span className="flex-1 text-sm font-medium">{item.label}</span>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-primary"
                                                    title="Move to Main Toolbar"
                                                    onClick={() => onToggleVisibility(item.id)}
                                                >
                                                    <EditorIcons.Plus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>

                <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
                    <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground hover:text-destructive">
                        Reset to Defaults
                    </Button>
                    <Button onClick={() => onOpenChange(false)}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
