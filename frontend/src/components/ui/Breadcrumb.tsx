import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const { t } = useTranslation("common");

  return (
    <nav className={cn("breadcrumb", className)} aria-label={t("ui.aria.breadcrumb")}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && (
              <ChevronRight size={12} className="breadcrumb-separator" />
            )}
            {isLast || !item.href ? (
              <span className={isLast ? "breadcrumb-current" : undefined}>
                {item.label}
              </span>
            ) : (
              <Link to={item.href}>{item.label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
