import {
    Breadcrumb,
    BreadcrumbEllipsis,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { AnnotaIcon } from "../../custom-ui/annota-icon";
import { Ionicons } from "../../ui/ionicons";

export interface BreadcrumbData {
    name: string;
    id: string | null;
    icon?: string;
    color?: string;
}

interface BreadcrumbsSectionProps {
    breadcrumbs: BreadcrumbData[] | null;
    onNavigate: (id: string | null) => void;
    className?: string;
}

export function BreadcrumbsSection({ breadcrumbs, onNavigate, className }: BreadcrumbsSectionProps) {
    if (!breadcrumbs || breadcrumbs.length === 0) return null;

    return (
        <Breadcrumb className={cn("px-2 py-1.5 bg-transparent shrink-0 select-none", className)}>
            <BreadcrumbList className="flex-nowrap gap-1 sm:gap-1">
                {breadcrumbs.map((crumb, i) => (
                    <div key={i} className="flex items-center gap-1 min-w-0">
                        {i > 0 && (
                            <BreadcrumbSeparator className="[&>svg]:size-2 opacity-50 shrink-0">
                                <Ionicons name="chevron-forward" />
                            </BreadcrumbSeparator>
                        )}
                        <BreadcrumbItem className="min-w-0">
                            {crumb.name === "..." ? (
                                <BreadcrumbEllipsis className="h-4 w-4" />
                            ) : (
                                <BreadcrumbLink
                                    asChild
                                    className="cursor-pointer active:scale-95 transition-all duration-200 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 min-w-0 px-2 py-0.5 rounded-md border bg-(--crumb-bg) hover:bg-(--crumb-bg-hover) text-(--crumb-color) hover:text-(--crumb-color) border-(--crumb-border) hover:border-(--crumb-border-hover)"
                                    style={{
                                        '--crumb-bg': crumb.color ? `${crumb.color}15` : "var(--muted)",
                                        '--crumb-bg-hover': crumb.color ? `${crumb.color}28` : "var(--muted)",
                                        '--crumb-color': crumb.color || "var(--muted-foreground)",
                                        '--crumb-border': crumb.color ? `${crumb.color}25` : "var(--border)",
                                        '--crumb-border-hover': crumb.color ? `${crumb.color}45` : "var(--border)",
                                    } as React.CSSProperties}
                                >
                                    <button onClick={() => onNavigate(crumb.id)}>
                                        {crumb.icon === "annota" ? (
                                            <AnnotaIcon
                                                size={14}
                                                className={cn("shrink-0")}
                                                color={crumb.color}
                                            />
                                        ) : crumb.icon && (
                                            <Ionicons
                                                name={crumb.icon}
                                                size={10}
                                                className={cn("shrink-0", !crumb.color && "text-muted-foreground/40")}
                                                color={crumb.color}
                                            />
                                        )}
                                        <span className="truncate max-w-[160px]">
                                            {crumb.name === "All Notes" ? "Annota" : crumb.name}
                                        </span>
                                    </button>
                                </BreadcrumbLink>
                            )}
                        </BreadcrumbItem>
                    </div>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
