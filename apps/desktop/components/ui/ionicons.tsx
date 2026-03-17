import { cn } from "@/lib/utils";
import React from "react";
import * as Io5 from "react-icons/io5";

interface IoniconsProps extends React.SVGProps<SVGSVGElement> {
    name: string;
    size?: number | string;
    color?: string;
    className?: string;
}

/**
 * Ionicons component for Desktop to match Mobile's @expo/vector-icons.
 * Uses react-icons/io5 as it provides matching Ionicons v5/v6 names.
 */
export const Ionicons = ({ name, size = 24, color, className, style, ...props }: IoniconsProps) => {
    if (!name) return null;

    // Convert Ionicon v5 name (e.g. 'document-text-outline') to react-icons/io5 name (e.g. 'IoDocumentTextOutline')
    let iconName = name;
    if (name === "hash") iconName = "grid-outline";
    if (name === "folder") iconName = "folder-outline"; // Prefer outline if just "folder" is provided

    const pascalName = iconName
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");

    const iconKey = `Io${pascalName}` as keyof typeof Io5;
    const IconComponent = Io5[iconKey] as any;

    if (!IconComponent) {
        // Fallback for names that might not have capitalized correctly or missing
        // (Ionicons names are usually very consistent in io5)
        console.warn(`Ionicons: Icon "${name}" (mapped to "${iconKey}") not found in react-icons/io5.`);
        return null;
    }

    return (
        <IconComponent
            size={size}
            color={color}
            className={cn("shrink-0", className)}
            style={style}
            {...props}
        />
    );
};

// Satisfy the type system for: as keyof typeof Ionicons.glyphMap
Ionicons.glyphMap = Io5;
