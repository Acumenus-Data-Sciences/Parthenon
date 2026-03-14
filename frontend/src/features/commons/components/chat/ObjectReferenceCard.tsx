import { useNavigate } from "react-router-dom";
import { FileText, Database, FlaskConical, BookOpen } from "lucide-react";
import type { ObjectReference, ReferenceType } from "../../types";

const TYPE_CONFIG: Record<ReferenceType, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  cohort_definition: { icon: FlaskConical, label: "Cohort", color: "text-teal-400 bg-teal-400/10 border-teal-400/20" },
  concept_set: { icon: FileText, label: "Concept Set", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  study: { icon: BookOpen, label: "Study", color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  source: { icon: Database, label: "Data Source", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
};

interface ObjectReferenceCardProps {
  reference: ObjectReference;
}

export function ObjectReferenceCard({ reference }: ObjectReferenceCardProps) {
  const navigate = useNavigate();
  const config = TYPE_CONFIG[reference.referenceable_type];
  const Icon = config.icon;

  const urlMap: Record<ReferenceType, string> = {
    cohort_definition: `/cohort-definitions/${reference.referenceable_id}`,
    concept_set: `/concept-sets/${reference.referenceable_id}`,
    study: `/studies/${reference.referenceable_id}`,
    source: `/data-sources/${reference.referenceable_id}`,
  };

  return (
    <button
      onClick={() => navigate(urlMap[reference.referenceable_type])}
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition-colors hover:brightness-125 ${config.color}`}
    >
      <Icon className="h-3 w-3" />
      <span>{config.label}:</span>
      <span className="max-w-[180px] truncate">{reference.display_name}</span>
    </button>
  );
}
