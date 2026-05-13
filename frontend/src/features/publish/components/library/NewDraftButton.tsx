import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

export function NewDraftButton() {
  return (
    <Link
      to="/publish/library/new"
      className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface-base hover:bg-accent/90"
    >
      <Plus size={16} />New Document
    </Link>
  );
}
