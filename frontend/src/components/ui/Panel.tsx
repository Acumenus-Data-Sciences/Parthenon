import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "inset";
  header?: ReactNode;
  footer?: ReactNode;
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, variant = "default", header, footer, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "panel",
          variant === "inset" && "panel-inset",
          className,
        )}
        {...props}
      >
        {header && <div className="panel-header">{header}</div>}
        <div className="panel-body">{children}</div>
        {footer && <div className="panel-footer">{footer}</div>}
      </div>
    );
  },
);

Panel.displayName = "Panel";
