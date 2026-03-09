import { useState } from "react";
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  BrainCircuit,
  Table,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReportSection, NarrativeState } from "../types/publish";
import AiNarrativeBlock from "./narrative/AiNarrativeBlock";
import StructuredDataBlock from "./narrative/StructuredDataBlock";

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
}: SectionEditorProps) {
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
      className={`bg-[#151518] border rounded-lg ${
        section.included ? "border-[#232328]" : "border-[#232328]/50"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#232328]">
        {/* Drag handle */}
        <button
          type="button"
          className="cursor-grab text-[#5A5650] hover:text-[#F0EDE8] touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Title */}
        <span className="flex-1 text-sm font-medium text-[#F0EDE8] truncate">
          {section.title}
        </span>

        {/* AI / Structured toggle (non-diagram only) */}
        {!isDiagram && (
          <div className="flex items-center border border-[#232328] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("ai")}
              className={`p-1.5 transition-colors ${
                viewMode === "ai"
                  ? "bg-[#C9A227] text-[#0E0E11]"
                  : "text-[#5A5650] hover:text-[#F0EDE8]"
              }`}
              title="AI Narrative"
            >
              <BrainCircuit className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("structured")}
              className={`p-1.5 transition-colors ${
                viewMode === "structured"
                  ? "bg-[#C9A227] text-[#0E0E11]"
                  : "text-[#5A5650] hover:text-[#F0EDE8]"
              }`}
              title="Structured Data"
            >
              <Table className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Include/Exclude toggle */}
        <button
          type="button"
          onClick={() => onToggle(section.id)}
          className={`p-1.5 rounded transition-colors ${
            section.included
              ? "text-[#2DD4BF] hover:text-[#2DD4BF]/80"
              : "text-[#5A5650] hover:text-[#F0EDE8]"
          }`}
          title={section.included ? "Exclude section" : "Include section"}
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
          className="p-1 text-[#5A5650] hover:text-[#F0EDE8] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Move up"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(section.id, "down")}
          disabled={index === totalSections - 1}
          className="p-1 text-[#5A5650] hover:text-[#F0EDE8] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Move down"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-3">
        {isDiagram ? (
          section.svgMarkup ? (
            <div
              className="overflow-auto"
              dangerouslySetInnerHTML={{ __html: section.svgMarkup }}
            />
          ) : (
            <p className="text-sm text-[#5A5650] italic">
              No diagram generated yet
            </p>
          )
        ) : viewMode === "ai" ? (
          <AiNarrativeBlock
            content={section.content}
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
