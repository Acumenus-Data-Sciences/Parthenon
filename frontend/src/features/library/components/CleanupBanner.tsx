import { Link } from "react-router-dom";
import { useCleanupSuggestions } from "../api/cleanupApi";

interface Props {
  /** If set, only count suggestions whose `item_type` starts with this prefix. */
  itemTypePrefix?: string;
}

/**
 * Renders an amber banner above list pages when the user has more than 5
 * stale library items. Hidden when count ≤ 5 to avoid noise.
 */
export function CleanupBanner({ itemTypePrefix }: Props) {
  const { data } = useCleanupSuggestions();
  const rows = itemTypePrefix
    ? (data ?? []).filter((s) => s.item_type.startsWith(itemTypePrefix))
    : (data ?? []);

  if (rows.length <= 5) return null;

  return (
    <div className="rounded-md border border-amber-700/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
      You have <strong>{rows.length}</strong> items not used in 90+ days.{" "}
      <Link to="/library/cleanup" className="underline">
        Review for cleanup →
      </Link>
    </div>
  );
}
