import { cn } from "@/lib/utils";

export interface SkeletonProps {
  variant?: "text" | "heading" | "card" | "avatar" | "custom";
  width?: string;
  height?: string;
  className?: string;
  count?: number;
}

export function Skeleton({
  variant = "text",
  width,
  height,
  className,
  count = 1,
}: SkeletonProps) {
  const items = Array.from({ length: count });

  return (
    <>
      {items.map((_, i) => (
        <div
          key={i}
          className={cn(
            "skeleton",
            variant === "text" && "skeleton-text",
            variant === "heading" && "skeleton-heading",
            variant === "card" && "skeleton-card",
            variant === "avatar" && "skeleton-avatar",
            className,
          )}
          style={{ width, height }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
