import {
    Breadcrumb,
    BreadcrumbEllipsis,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { Ionicons } from "../../ui/ionicons";

interface BreadcrumbData {
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
        <Breadcrumb className={cn("px-4 py-2 border-b border-sidebar-border/5 bg-sidebar-accent/5", className)}>
            <BreadcrumbList className="flex-nowrap gap-1.5 sm:gap-1.5">
                {breadcrumbs.map((crumb, i) => (
                    <div key={i} className="flex items-center gap-1.5 min-w-0">
                        {i > 0 && (
                            <BreadcrumbSeparator className="[&>svg]:size-2.5">
                                <Ionicons name="chevron-forward" />
                            </BreadcrumbSeparator>
                        )}
                        <BreadcrumbItem className="min-w-0">
                            {crumb.name === "..." ? (
                                <BreadcrumbEllipsis className="h-4 w-4" />
                            ) : (
                                <BreadcrumbLink
                                    asChild
                                    className="cursor-pointer hover:text-primary transition-colors text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5 min-w-0"
                                >
                                    <button onClick={() => onNavigate(crumb.id)}>
                                        {crumb.icon && (
                                            <Ionicons
                                                name={crumb.icon}
                                                size={10}
                                                className="text-muted-foreground/40 shrink-0"
                                            />
                                        )}
                                        <span className="truncate max-w-[80px]">{crumb.name}</span>
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
