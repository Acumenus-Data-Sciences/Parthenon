import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

export function NewDraftButton() {
  return (
    <Link
      to="/publish/library/new"
      className="btn btn-publish btn-sm flex items-center gap-2"
    >
      <Plus size={16} />New Document
    </Link>
  );
}
