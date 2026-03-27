import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { ArrowLeft } from "lucide-react";
import type { ReportSection, NarrativeState } from "../types/publish";
import SectionEditor from "./SectionEditor";

interface DocumentConfiguratorProps {
  sections: ReportSection[];
  title: string;
  authors: string[];
  onSectionsChange: (sections: ReportSection[]) => void;
  onTitleChange: (title: string) => void;
  onAuthorsChange: (authors: string[]) => void;
  onGenerateNarrative: (section: ReportSection) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function DocumentConfigurator({
  sections,
  title,
  authors,
  onSectionsChange,
  onTitleChange,
  onAuthorsChange,
  onGenerateNarrative,
  onNext,
  onBack,
}: DocumentConfiguratorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      onSectionsChange(arrayMove(sections, oldIndex, newIndex));
    },
    [sections, onSectionsChange]
  );

  const handleToggle = useCallback(
    (id: string) => {
      onSectionsChange(
        sections.map((s) =>
          s.id === id ? { ...s, included: !s.included } : s
        )
      );
    },
    [sections, onSectionsChange]
  );

  const handleMove = useCallback(
    (id: string, direction: "up" | "down") => {
      const idx = sections.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= sections.length) return;
      onSectionsChange(arrayMove(sections, idx, targetIdx));
    },
    [sections, onSectionsChange]
  );

  const handleContentChange = useCallback(
    (id: string, content: string) => {
      onSectionsChange(
        sections.map((s) =>
          s.id === id ? { ...s, content, narrativeState: "draft" as const } : s
        )
      );
    },
    [sections, onSectionsChange]
  );

  const handleNarrativeStateChange = useCallback(
    (id: string, state: NarrativeState) => {
      onSectionsChange(
        sections.map((s) =>
          s.id === id ? { ...s, narrativeState: state } : s
        )
      );
    },
    [sections, onSectionsChange]
  );

  const handleToggleElement = useCallback(
    (id: string, element: "tableIncluded" | "narrativeIncluded" | "diagramIncluded") => {
      onSectionsChange(
        sections.map((s) =>
          s.id === id ? { ...s, [element]: !(s[element] !== false) } : s
        )
      );
    },
    [sections, onSectionsChange]
  );

  const handleAuthorsInput = (value: string) => {
    const parsed = value
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    onAuthorsChange(parsed);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header section */}
      <div className="space-y-4 mb-6">
        {/* Title */}
        <div>
          <label
            htmlFor="doc-title"
            className="block text-sm font-medium text-[#F0EDE8] mb-1"
          >
            Document Title
          </label>
          <input
            id="doc-title"
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Enter document title..."
            className="w-full bg-[#151518] border border-[#232328] rounded-lg px-3 py-2 text-sm text-[#F0EDE8] placeholder-[#5A5650] focus:outline-none focus:border-[#C9A227]"
          />
        </div>

        {/* Authors */}
        <div>
          <label
            htmlFor="doc-authors"
            className="block text-sm font-medium text-[#F0EDE8] mb-1"
          >
            Authors (comma-separated)
          </label>
          <input
            id="doc-authors"
            type="text"
            value={authors.join(", ")}
            onChange={(e) => handleAuthorsInput(e.target.value)}
            placeholder="Author One, Author Two..."
            className="w-full bg-[#151518] border border-[#232328] rounded-lg px-3 py-2 text-sm text-[#F0EDE8] placeholder-[#5A5650] focus:outline-none focus:border-[#C9A227]"
          />
        </div>

        {/* Template */}
        <div>
          <label
            htmlFor="doc-template"
            className="block text-sm font-medium text-[#F0EDE8] mb-1"
          >
            Template
          </label>
          <select
            id="doc-template"
            disabled
            className="w-full bg-[#151518] border border-[#232328] rounded-lg px-3 py-2 text-sm text-[#5A5650] cursor-not-allowed"
          >
            <option>Generic OHDSI Publication</option>
          </select>
        </div>
      </div>

      {/* Sections list */}
      <div className="flex-1 overflow-y-auto space-y-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((section, idx) => (
              <SectionEditor
                key={section.id}
                section={section}
                index={idx}
                totalSections={sections.length}
                onToggle={handleToggle}
                onMove={handleMove}
                onContentChange={handleContentChange}
                onNarrativeStateChange={handleNarrativeStateChange}
                onGenerateNarrative={onGenerateNarrative}
                isGenerating={false}
                onToggleElement={handleToggleElement}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Footer buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-[#232328] mt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-[#F0EDE8] border border-[#232328] rounded-lg hover:bg-[#232328] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-4 py-2 bg-[#C9A227] text-[#0E0E11] font-medium text-sm rounded-lg hover:bg-[#d4ad2f] transition-colors"
        >
          Preview Document &rarr;
        </button>
      </div>
    </div>
  );
}
