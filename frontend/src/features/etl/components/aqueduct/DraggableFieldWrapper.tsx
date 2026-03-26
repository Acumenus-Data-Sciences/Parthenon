import { useDraggable } from "@dnd-kit/core";
import type { ReactNode } from "react";

interface DraggableFieldWrapperProps {
  id: string;
  data: { colName: string; type: string };
  disabled?: boolean;
  children: (props: {
    isDragging: boolean;
    attributes: Record<string, unknown>;
    listeners: Record<string, unknown> | undefined;
    setNodeRef: (node: HTMLElement | null) => void;
  }) => ReactNode;
}

export function DraggableFieldWrapper({
  id,
  data,
  disabled,
  children,
}: DraggableFieldWrapperProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data,
    disabled,
  });

  return <>{children({ isDragging, attributes, listeners, setNodeRef })}</>;
}
