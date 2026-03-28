import { useDraggable, type DraggableAttributes } from "@dnd-kit/core";
import type { ReactNode } from "react";

type DraggableListeners = ReturnType<typeof useDraggable>["listeners"];

interface DraggableFieldWrapperProps {
  id: string;
  data: { colName: string; type: string };
  disabled?: boolean;
  children: (props: {
    isDragging: boolean;
    attributes: DraggableAttributes;
    listeners: DraggableListeners;
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
