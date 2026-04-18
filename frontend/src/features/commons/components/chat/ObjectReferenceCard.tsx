import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText, Database, FlaskConical, BookOpen } from "lucide-react";
import type { ObjectReference, ReferenceType } from "../../types";

const TYPE_CONFIG: Record<
  ReferenceType,
  {
    icon: React.ComponentType<{ className?: string }>;
    labelKey: string;
    color: string;
    accent: string;
  }
> = {
  cohort_definition: {
    icon: FlaskConical,
    labelKey: "chat.objectReference.cohortDefinition",
    color: "text-teal-400 bg-teal-400/10",
    accent: "border-l-teal-500",
  },
  concept_set: {
    icon: FileText,
    labelKey: "chat.objectReference.conceptSet",
    color: "text-blue-400 bg-blue-400/10",
    accent: "border-l-blue-500",
  },
  study: {
    icon: BookOpen,
    labelKey: "chat.objectReference.study",
    color: "text-purple-400 bg-purple-400/10",
    accent: "border-l-purple-500",
  },
  source: {
    icon: Database,
    labelKey: "chat.objectReference.source",
    color: "text-amber-400 bg-amber-400/10",
    accent: "border-l-amber-500",
  },
};

interface ObjectReferenceCardProps {
  reference: ObjectReference;
}

export function ObjectReferenceCard({ reference }: ObjectReferenceCardProps) {
  const { t } = useTranslation("commons");
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
      className={`inline-flex items-center gap-1.5 rounded-md border-l-2 border border-white/[0.06] ${config.accent} px-2.5 py-1 text-[11px] font-medium transition-all duration-150 hover:bg-white/[0.04] hover:border-white/[0.1] ${config.color}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="opacity-60">{t(config.labelKey)}</span>
      <span className="max-w-[200px] truncate">{reference.display_name}</span>
    </button>
  );
}
