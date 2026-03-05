import type { Study } from "../types/study";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStudyType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#8A857D",
  protocol_development: "#60A5FA",
  feasibility: "#A78BFA",
  irb_review: "#F59E0B",
  recruitment: "#FB923C",
  execution: "#2DD4BF",
  analysis: "#34D399",
  synthesis: "#818CF8",
  manuscript: "#C084FC",
  published: "#22D3EE",
  archived: "#6B7280",
  withdrawn: "#E85A6B",
  running: "#F59E0B",
  completed: "#2DD4BF",
  failed: "#E85A6B",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#E85A6B",
  high: "#F59E0B",
  medium: "#60A5FA",
  low: "#8A857D",
};

interface StudyCardProps {
  study: Study;
  onClick: () => void;
}

export function StudyCard({ study, onClick }: StudyCardProps) {
  const statusColor = STATUS_COLORS[study.status] ?? "#8A857D";
  const priorityColor = PRIORITY_COLORS[study.priority] ?? "#8A857D";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col text-left rounded-lg border border-[#232328] bg-[#151518] p-5 hover:border-[#2DD4BF]/30 hover:bg-[#1C1C20] transition-all group"
    >
      {/* Title + Short Title */}
      <div className="flex items-start gap-2 mb-2">
        <h3 className="text-sm font-semibold text-[#F0EDE8] leading-snug line-clamp-2 group-hover:text-[#2DD4BF] transition-colors flex-1">
          {study.title}
        </h3>
        {study.short_title && (
          <span className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold bg-[#C9A227]/15 text-[#C9A227]">
            {study.short_title}
          </span>
        )}
      </div>

      {/* Description */}
      {study.description && (
        <p className="text-xs text-[#8A857D] line-clamp-2 mb-3">
          {study.description}
        </p>
      )}

      {/* Type + Design badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/10 text-[#2DD4BF]">
          {formatStudyType(study.study_type)}
        </span>
        {study.study_design && (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#60A5FA]/10 text-[#60A5FA]">
            {formatStudyType(study.study_design)}
          </span>
        )}
      </div>

      {/* Status + Priority + Phase */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor: `${statusColor}15`,
            color: statusColor,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: statusColor }}
          />
          {study.status.replace(/_/g, " ")}
        </span>
        <span
          className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium uppercase"
          style={{
            backgroundColor: `${priorityColor}15`,
            color: priorityColor,
          }}
        >
          {study.priority}
        </span>
      </div>

      {/* Tags */}
      {study.tags && study.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {study.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium bg-[#323238] text-[#8A857D]"
            >
              {tag}
            </span>
          ))}
          {study.tags.length > 3 && (
            <span className="text-[9px] text-[#5A5650]">
              +{study.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer: PI + Date */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#232328]">
        <div className="flex items-center gap-1.5">
          {study.principal_investigator ? (
            <span className="text-[11px] text-[#8A857D]">
              PI: {study.principal_investigator.name}
            </span>
          ) : study.author ? (
            <span className="text-[11px] text-[#8A857D]">
              {study.author.name}
            </span>
          ) : null}
        </div>
        <span className="text-[11px] text-[#5A5650]">
          {formatDate(study.created_at)}
        </span>
      </div>
    </button>
  );
}
