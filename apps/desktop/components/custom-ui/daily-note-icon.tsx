import { cn } from "@/lib/utils";

interface DailyNoteIconProps {
    className?: string;
    size?: number;
    color?: string;
}

export function DailyNoteIcon({ className, size = 18, color = "currentColor" }: DailyNoteIconProps) {
    const today = new Date().getDate();

    return (
        <div
            className={cn("relative flex items-center justify-center shrink-0", className)}
            style={{ width: size, height: size }}
        >
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                {/* Calendar Frame */}
                <rect x="3" y="4" width="18" height="18" rx="2.5" ry="2.5" />
                {/* Calendar Rings/Prongs */}
                <line x1="16" y1="2" x2="16" y2="5" />
                <line x1="8" y1="2" x2="8" y2="5" />
                {/* Header Line */}
                <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {/* The Date Number */}
            <span
                className="absolute top-[65%] left-1/2 -translate-x-1/2 -translate-y-1/2 font-black select-none tracking-tighter"
                style={{
                    fontSize: size * 0.45,
                    color: color,
                    lineHeight: 1,
                }}
            >
                {today}
            </span>
        </div>
    );
}
