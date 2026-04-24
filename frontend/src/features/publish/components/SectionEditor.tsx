import { useState } from "react";
import DOMPurify from "dompurify";
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  BrainCircuit,
  Table,
  BarChart3,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";
import type { ReportSection, NarrativeState } from "../types/publish";
import AiNarrativeBlock from "./narrative/AiNarrativeBlock";
import StructuredDataBlock from "./narrative/StructuredDataBlock";
import type { TableData } from "../types/publish";

type ViewMode = "ai" | "structured";

interface SectionEditorProps {
  section: ReportSection;
  index: number;
  totalSections: number;
  onToggle: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onContentChange: (id: string, content: string) => void;
  onNarrativeStateChange: (id: string, state: NarrativeState) => void;
  onGenerateNarrative: (section: ReportSection) => void;
  isGenerating: boolean;
  onToggleElement?: (id: string, element: "tableIncluded" | "narrativeIncluded" | "diagramIncluded") => void;
}

function InlineTablePreview({
  data,
  tableLabel,
}: {
  data: TableData;
  tableLabel: string;
}) {
  if (data.rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-border-default overflow-hidden">
      <div className="px-3 py-1.5 bg-surface-overlay border-b border-border-default">
        <span className="text-[10px] font-medium text-text-ghost uppercase tracking-wide">
          {tableLabel}: {data.caption}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-default">
              {data.headers.map((h) => (
                <th
                  key={h}
                  className="px-3 py-1.5 text-left font-medium text-text-muted whitespace-nowrap"
                  style={{ textAlign: h === data.headers[0] ? "left" : "right" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className="border-b border-border-default/50">
                {data.headers.map((h, ci) => (
                  <td
                    key={h}
                    className="px-3 py-1 text-text-primary whitespace-nowrap"
                    style={{ textAlign: ci === 0 ? "left" : "right" }}
                  >
                    {row[h] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SectionEditor({
  section,
  index,
  totalSections,
  onToggle,
  onMove,
  onContentChange,
  onNarrativeStateChange,
  onGenerateNarrative,
  isGenerating,
  onToggleElement,
}: SectionEditorProps) {
  const { t } = useTranslation("app");
  const [viewMode, setViewMode] = useState<ViewMode>("ai");
  const isDiagram = section.type === "diagram";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : section.included ? 1 : 0.4,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-surface-raised border rounded-lg ${
        section.included ? "border-border-default" : "border-border-default/50"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default">
        {/* Drag handle */}
        <button
          type="button"
          className="cursor-grab text-text-ghost hover:text-text-primary touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Title */}
        <span className="flex-1 text-sm font-medium text-text-primary truncate">
          {section.title}
        </span>

        {/* AI / Structured toggle (non-diagram only) */}
        {!isDiagram && (
          <div className="flex items-center border border-border-default rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("ai")}
              className={`p-1.5 transition-colors ${
                viewMode === "ai"
                  ? "bg-accent text-surface-base"
                  : "text-text-ghost hover:text-text-primary"
              }`}
              title={t("publish.sectionEditor.aiNarrative")}
            >
              <BrainCircuit className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("structured")}
              className={`p-1.5 transition-colors ${
                viewMode === "structured"
                  ? "bg-accent text-surface-base"
                  : "text-text-ghost hover:text-text-primary"
              }`}
              title={t("publish.sectionEditor.structuredData")}
            >
              <Table className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Element toggles (table / narrative / diagram) */}
        {onToggleElement && section.type === "results" && (
          <div className="flex items-center gap-0.5 border border-border-default rounded-lg overflow-hidden">
            {section.tableData && (
              <button
                type="button"
                onClick={() => onToggleElement(section.id, "tableIncluded")}
                className={`p-1.5 transition-colors ${
                  section.tableIncluded !== false
                    ? "bg-success/20 text-success"
                    : "text-text-ghost hover:text-text-primary"
                }`}
                title={
                  section.tableIncluded !== false
                    ? t("publish.sectionEditor.hideTable")
                    : t("publish.sectionEditor.showTable")
                }
              >
                <Table className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onToggleElement(section.id, "narrativeIncluded")}
              className={`p-1.5 transition-colors ${
                section.narrativeIncluded !== false
                  ? "bg-success/20 text-success"
                  : "text-text-ghost hover:text-text-primary"
              }`}
              title={
                section.narrativeIncluded !== false
                  ? t("publish.sectionEditor.hideNarrative")
                  : t("publish.sectionEditor.showNarrative")
              }
            >
              <BrainCircuit className="w-3.5 h-3.5" />
            </button>
            {section.diagramType && (
              <button
                type="button"
                onClick={() => onToggleElement(section.id, "diagramIncluded")}
                className={`p-1.5 transition-colors ${
                  section.diagramIncluded !== false
                    ? "bg-success/20 text-success"
                    : "text-text-ghost hover:text-text-primary"
                }`}
                title={
                  section.diagramIncluded !== false
                    ? t("publish.sectionEditor.hideDiagram")
                    : t("publish.sectionEditor.showDiagram")
                }
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Include/Exclude toggle */}
        <button
          type="button"
          onClick={() => onToggle(section.id)}
          className={`p-1.5 rounded transition-colors ${
            section.included
              ? "text-success hover:text-success/80"
              : "text-text-ghost hover:text-text-primary"
          }`}
          title={
            section.included
              ? t("publish.reportSection.excludeSection")
              : t("publish.reportSection.includeSection")
          }
        >
          {section.included ? (
            <Eye className="w-4 h-4" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
        </button>

        {/* Up/Down */}
        <button
          type="button"
          onClick={() => onMove(section.id, "up")}
          disabled={index === 0}
          className="p-1 text-text-ghost hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title={t("publish.reportSection.moveUp")}
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(section.id, "down")}
          disabled={index === totalSections - 1}
          className="p-1 text-text-ghost hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title={t("publish.reportSection.moveDown")}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-3 space-y-3">
        {/* Inline table preview for results sections */}
        {section.tableData && section.tableIncluded !== false && (
          <InlineTablePreview
            data={section.tableData}
            tableLabel={t("publish.sectionEditor.tableLabel")}
          />
        )}

        {isDiagram ? (
          section.svgMarkup ? (
            <div
              className="overflow-auto"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.svgMarkup, { USE_PROFILES: { svg: true } }) }}
            />
          ) : (
            <p className="text-sm text-text-ghost italic">
              {t("publish.sectionEditor.noDiagram")}
            </p>
          )
        ) : viewMode === "ai" ? (
          <AiNarrativeBlock
            content={typeof section.content === "string" ? section.content : (section.content ? JSON.stringify(section.content) : "")}
            narrativeState={section.narrativeState}
            onGenerate={() => onGenerateNarrative(section)}
            onContentChange={(content) => onContentChange(section.id, content)}
            onAccept={() => onNarrativeStateChange(section.id, "accepted")}
            isGenerating={isGenerating}
          />
        ) : (
          <StructuredDataBlock
            data={section.diagramData ?? {}}
          />
        )}
      </div>
    </div>
  );
}
