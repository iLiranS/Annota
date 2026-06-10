import { FOLDER_ICONS } from "@annota/core/constants/icons";
import { useMemo } from "react";
import * as Io5 from "react-icons/io5";

// Move the key extraction entirely here out of the main bundle graph
const ALL_IONICON_KEYS = Object.keys(Io5)
    .filter(key => key.startsWith('Io'))
    .map(key => key.slice(2).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase());

interface IconPickerGridProps {
    iconSearch: string;
    onSelect: (name: string) => void;
    color: string;
}

export default function IconPickerGrid({ iconSearch, onSelect, color }: IconPickerGridProps) {
    const filteredIcons = useMemo(() => {
        if (!iconSearch || iconSearch.trim().length < 2) return FOLDER_ICONS;
        const searchLower = iconSearch.toLowerCase().trim();
        return ALL_IONICON_KEYS.filter(i => i.includes(searchLower)).slice(0, 100);
    }, [iconSearch]);

    return (
        <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1">
            {filteredIcons.map((iconName) => {
                const pascalName = iconName.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
                const IconComponent = (Io5 as any)[`Io${pascalName}`];

                if (!IconComponent) return null;

                return (
                    <button
                        key={iconName}
                        type="button"
                        onClick={() => onSelect(iconName)}
                        className="p-2 rounded-md hover:bg-accent flex items-center justify-center transition-colors"
                        style={{ color }}
                    >
                        <IconComponent size={20} />
                    </button>
                );
            })}
        </div>
    );
}