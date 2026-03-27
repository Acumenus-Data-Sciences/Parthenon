// ---------------------------------------------------------------------------
// DocumentPreview — Step 3: Full document preview in white "paper" container
// ---------------------------------------------------------------------------

import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import type { ReportSection, DiagramType } from "../types/publish";
import {
  DiagramWrapper,
  ForestPlot,
  AttritionDiagram,
  ConsortDiagram,
  KaplanMeierCurve,
} from "./diagrams";
import ResultsTable from "./ResultsTable";

interface DocumentPreviewProps {
  sections: ReportSection[];
  title: string;
  authors: string[];
  onBack: () => void;
  onNext: () => void;
}

function renderDiagram(
  diagramType: DiagramType,
  diagramData: Record<string, unknown> | undefined,
) {
  if (!diagramData) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 italic text-sm">
        Diagram data not available
      </div>
    );
  }

  switch (diagramType) {
    case "forest_plot":
      return (
        <ForestPlot
          data={(diagramData.data as Array<{ label: string; estimate: number; ci_lower: number; ci_upper: number }>) ?? []}
          pooled={diagramData.pooled as { estimate: number; ci_lower: number; ci_upper: number } | undefined}
          xLabel={diagramData.xLabel as string | undefined}
        />
      );
    case "kaplan_meier":
      return (
        <KaplanMeierCurve
          curves={(diagramData.curves as Array<{ label: string; data: Array<{ time: number; survival: number }> }>) ?? []}
          xLabel={diagramData.xLabel as string | undefined}
          yLabel={diagramData.yLabel as string | undefined}
        />
      );
    case "attrition":
      return (
        <AttritionDiagram
          steps={(diagramData.steps as Array<{ label: string; count: number; excluded?: number }>) ?? []}
        />
      );
    case "consort":
      return (
        <ConsortDiagram
          enrollment={(diagramData.enrollment as { assessed: number; excluded?: number; reasons?: string[] }) ?? { assessed: 0 }}
          allocated={(diagramData.allocated as Array<{ group: string; count: number }>) ?? []}
          followUp={diagramData.followUp as Array<{ group: string; completed: number; lost?: number }> | undefined}
          analyzed={diagramData.analyzed as Array<{ group: string; count: number; excluded?: number }> | undefined}
        />
      );
    default:
      return (
        <div className="flex items-center justify-center py-12 text-gray-400 italic text-sm">
          Unknown diagram type
        </div>
      );
  }
}

export default function DocumentPreview({
  sections,
  title,
  authors,
  onBack,
  onNext,
}: DocumentPreviewProps) {
  const includedSections = sections.filter((s) => s.included);
  const hasDraftNarratives = includedSections.some(
    (s) => s.narrativeState === "draft",
  );

  // Track figure and table numbering
  let figureCounter = 0;
  let tableCounter = 0;

  return (
    <div className="flex flex-col gap-6">
      {/* AI draft warning */}
      {hasDraftNarratives && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-200">
            Some AI-generated sections have not been reviewed. Please accept or
            edit all AI content before exporting.
          </p>
        </div>
      )}

      {/* Paper preview */}
      <div
        id="publish-report-preview"
        className="mx-auto w-full max-w-[816px] rounded-lg bg-white shadow-xl"
        style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
      >
        <div className="px-16 py-12">
          {/* Title */}
          <h1
            className="mb-2 text-center font-bold text-gray-900"
            style={{ fontSize: "20pt", lineHeight: 1.3 }}
          >
            {title || "Untitled Document"}
          </h1>

          {/* Authors */}
          {authors.length > 0 && (
            <p className="mb-1 text-center text-sm italic text-gray-600">
              {authors.join(", ")}
            </p>
          )}

          {/* Date line */}
          <p className="mb-8 text-center text-xs text-gray-400">
            Generated {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>

          <hr className="mb-8 border-gray-200" />

          {/* Sections */}
          {includedSections.map((section) => {
            if (section.type === "diagram" && section.diagramType) {
              figureCounter += 1;
              const figNum = figureCounter;

              return (
                <div key={section.id} className="mb-8">
                  <DiagramWrapper
                    title={section.title}
                    caption={section.caption}
                    figureNumber={figNum}
                  >
                    {renderDiagram(section.diagramType, section.diagramData)}
                  </DiagramWrapper>
                </div>
              );
            }

            // Results sections with table + narrative + diagram
            if (section.type === "results") {
              const hasTable = section.tableData && section.tableIncluded !== false;
              const hasNarrative = section.narrativeIncluded !== false && section.content;
              const hasDiagram = section.diagramIncluded !== false && section.diagramType;

              if (hasTable) tableCounter += 1;
              if (hasDiagram) figureCounter += 1;

              const currentTableNum = hasTable ? tableCounter : 0;
              const currentFigNum = hasDiagram ? figureCounter : 0;

              return (
                <div key={section.id} className="mb-8">
                  <h2
                    className="mb-3 font-bold text-gray-900"
                    style={{ fontSize: "14pt" }}
                  >
                    {section.title}
                  </h2>

                  {/* Table */}
                  {hasTable && section.tableData && (
                    <ResultsTable data={section.tableData} tableNumber={currentTableNum} />
                  )}

                  {/* Narrative */}
                  {hasNarrative && (
                    <div
                      className="text-sm leading-relaxed text-gray-800"
                      style={{ fontSize: "11pt", lineHeight: 1.7 }}
                    >
                      {(typeof section.content === "string"
                        ? section.content
                        : JSON.stringify(section.content)
                      )
                        .split("\n")
                        .map((paragraph: string, i: number) => (
                          <p key={i} className={i > 0 ? "mt-3" : ""}>
                            {paragraph}
                          </p>
                        ))}
                    </div>
                  )}

                  {/* Diagram */}
                  {hasDiagram && section.diagramType && (
                    <div className="mt-4">
                      <DiagramWrapper
                        title={section.title}
                        caption={section.caption}
                        figureNumber={currentFigNum}
                      >
                        {renderDiagram(section.diagramType, section.diagramData)}
                      </DiagramWrapper>
                    </div>
                  )}

                  {/* Empty state */}
                  {!hasTable && !hasNarrative && !hasDiagram && (
                    <p className="text-sm italic text-gray-400">
                      No content available for this section.
                    </p>
                  )}
                </div>
              );
            }

            // Text sections: methods, discussion, introduction
            return (
              <div key={section.id} className="mb-8">
                <h2
                  className="mb-3 font-bold text-gray-900"
                  style={{ fontSize: "14pt" }}
                >
                  {section.title}
                </h2>
                {section.content ? (
                  <div
                    className="text-sm leading-relaxed text-gray-800"
                    style={{ fontSize: "11pt", lineHeight: 1.7 }}
                  >
                    {(typeof section.content === "string"
                      ? section.content
                      : JSON.stringify(section.content)
                    )
                      .split("\n")
                      .map((paragraph: string, i: number) => (
                        <p key={i} className={i > 0 ? "mt-3" : ""}>
                          {paragraph}
                        </p>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-gray-400">
                    No content available for this section.
                  </p>
                )}
              </div>
            );
          })}

          {includedSections.length === 0 && (
            <p className="py-12 text-center text-sm italic text-gray-400">
              No sections included. Go back to configure your document.
            </p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-[#232328] px-4 py-2 text-sm text-[#F0EDE8] transition-colors hover:bg-[#232328]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Configure
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 rounded-lg bg-[#C9A227] px-5 py-2.5 text-sm font-semibold text-[#0E0E11] transition-colors hover:bg-[#d4ad2f]"
        >
          Export
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
