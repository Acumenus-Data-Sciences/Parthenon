import { useCallback, useMemo, useState } from "react";

/**
 * Generic multi-row selection state for list tables.
 * Stores ids in a Set; exposes helpers for toggle, select-all, clear.
 */
export function useRowSelection() {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const isSelected = useCallback(
    (id: number) => selected.has(id),
    [selected],
  );

  const toggle = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const selectAll = useCallback((ids: number[]) => {
    setSelected(new Set(ids));
  }, []);

  const toggleAll = useCallback((ids: number[]) => {
    setSelected((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(ids);
    });
  }, []);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return {
    selectedIds,
    isSelected,
    toggle,
    clear,
    selectAll,
    toggleAll,
    count: selected.size,
  };
}
