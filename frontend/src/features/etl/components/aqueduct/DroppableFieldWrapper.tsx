import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

interface DroppableFieldWrapperProps {
  id: string;
  data: { colName: string };
  disabled?: boolean;
  children: (props: {
    isOver: boolean;
    setNodeRef: (node: HTMLElement | null) => void;
  }) => ReactNode;
}

export function DroppableFieldWrapper({
  id,
  data,
  disabled,
  children,
}: DroppableFieldWrapperProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data,
    disabled,
  });

  return <>{children({ isOver, setNodeRef })}</>;
}
