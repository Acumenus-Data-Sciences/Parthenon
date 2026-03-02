import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "critical"
  | "info"
  | "inactive"
  | "accent";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  icon?: ReactNode;
}

export function Badge({
  className,
  variant = "default",
  icon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn("badge", `badge-${variant}`, className)}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
