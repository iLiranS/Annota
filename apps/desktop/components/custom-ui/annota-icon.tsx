import { cn } from "@/lib/utils";
import { ANNOTA_ICON_PATHS } from "@annota/core";

interface AnnotaIconProps {
    className?: string;
    size?: number;
    color?: string;
}

export function AnnotaIcon({ className, size = 18, color = "currentColor" }: AnnotaIconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("shrink-0", className)}
            preserveAspectRatio="xMidYMid meet"
        >
            <g transform="translate(0, 1024) scale(0.1, -0.1)" fill={color} stroke="none">
                {ANNOTA_ICON_PATHS.map((path, index) => (
                    <path key={index} d={path} />
                ))}
            </g>
        </svg>
    );
}
