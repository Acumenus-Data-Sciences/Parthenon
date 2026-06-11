// ---------------------------------------------------------------------------
// DocumentPreview — Step 3: Full document preview in white "paper" container
// ---------------------------------------------------------------------------

import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (!diagramData) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted italic text-sm">
        {t("publish.preview.diagramDataNotAvailable")}
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
        <div className="flex items-center justify-center py-12 text-text-muted italic text-sm">
          {t("publish.preview.unknownDiagramType")}
        </div>
      );
  }
}

/**
 * Renders section prose on the white "paper": blank-line-separated blocks, with
 * `### ` lines becoming bold subheadings. This makes composer-seeded drafts
 * (from the Studies "Open in Publisher" bridge, whose content carries `### `
 * subsections) render correctly instead of showing literal `### ` text.
 */
function PaperContent({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <div className="text-gray-800" style={{ fontSize: "11pt", lineHeight: 1.7 }}>
      {blocks.map((block, i) => {
        if (block.startsWith("### ")) {
          const [heading, ...rest] = block.split("\n");
          return (
            <div key={i} className={i > 0 ? "mt-4" : ""}>
              <h3 className="font-semibold text-gray-900" style={{ fontSize: "12pt" }}>
                {heading.replace(/^###\s+/, "")}
              </h3>
              {rest.length > 0 && <p className="mt-1 whitespace-pre-line">{rest.join("\n")}</p>}
            </div>
          );
        }
        return <p key={i} className={`whitespace-pre-line ${i > 0 ? "mt-3" : ""}`}>{block}</p>;
      })}
    </div>
  );
}

export default function DocumentPreview({
  sections,
  title,
  authors,
  onBack,
  onNext,
}: DocumentPreviewProps) {
  const { t } = useTranslation("app");
  const includedSections = sections.filter((s) => s.included);
  const hasDraftNarratives = includedSections.some(
    (s) => s.narrativeState === "draft",
  );
  const numberedSections = includedSections.reduce<
    Array<{
      section: ReportSection;
      figureNumber?: number;
      tableNumber?: number;
    }>
  >((acc, section) => {
    const priorFigures = acc.reduce(
      (count, item) => count + (item.figureNumber ? 1 : 0),
      0,
    );
    const priorTables = acc.reduce(
      (count, item) => count + (item.tableNumber ? 1 : 0),
      0,
    );

    const isStandaloneDiagram = section.type === "diagram" && Boolean(section.diagramType);
    const hasTable =
      section.type === "results" &&
      Boolean(section.tableData) &&
      section.tableIncluded !== false;
    const hasDiagram =
      section.type === "results" &&
      Boolean(section.diagramType) &&
      section.diagramIncluded !== false;

    acc.push({
      section,
      figureNumber: isStandaloneDiagram || hasDiagram ? priorFigures + 1 : undefined,
      tableNumber: hasTable ? priorTables + 1 : undefined,
    });
    return acc;
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* AI draft warning */}
      {hasDraftNarratives && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm text-warning">
            {t("publish.preview.reviewWarning")}
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
            {title || t("publish.page.untitledDocument")}
          </h1>

          {/* Authors */}
          {authors.length > 0 && (
            <p className="mb-1 text-center text-sm italic text-text-ghost">
              {authors.join(", ")}
            </p>
          )}

          {/* Date line */}
          <p className="mb-8 text-center text-xs text-text-muted">
            {t("publish.preview.generatedLabel", {
              date: new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }),
            })}
          </p>

          <hr className="mb-8 border-gray-200" />

          {/* Sections */}
          {numberedSections.map(({ section, figureNumber, tableNumber }) => {
            if (section.type === "diagram" && section.diagramType && figureNumber) {
              return (
                <div
                  key={section.id}
                  id={`diagram-${section.id}`}
                  data-section-id={section.id}
                  className="mb-8"
                >
                  <DiagramWrapper
                    title={section.title}
                    caption={section.caption}
                    figureNumber={figureNumber}
                  >
                    {renderDiagram(section.diagramType, section.diagramData, t)}
                  </DiagramWrapper>
                </div>
              );
            }

            // Results sections with table + narrative + diagram
            if (section.type === "results") {
              const hasTable = section.tableData && section.tableIncluded !== false;
              const hasNarrative = section.narrativeIncluded !== false && section.content;
              const hasDiagram = section.diagramIncluded !== false && section.diagramType;

              return (
                <div
                  key={section.id}
                  data-section-id={section.id}
                  className="mb-8"
                >
                  <h2
                    className="mb-3 font-bold text-gray-900"
                    style={{ fontSize: "14pt" }}
                  >
                    {section.title}
                  </h2>

                  {/* Table */}
                  {hasTable && section.tableData && tableNumber && (
                    <ResultsTable data={section.tableData} tableNumber={tableNumber} />
                  )}

                  {/* Narrative */}
                  {hasNarrative && (
                    <PaperContent
                      content={typeof section.content === "string" ? section.content : JSON.stringify(section.content)}
                    />
                  )}

                  {/* Diagram */}
                  {hasDiagram && section.diagramType && figureNumber && (
                    <div id={`diagram-${section.id}`} className="mt-4">
                      <DiagramWrapper
                        title={section.title}
                        caption={section.caption}
                        figureNumber={figureNumber}
                      >
                        {renderDiagram(section.diagramType, section.diagramData, t)}
                      </DiagramWrapper>
                    </div>
                  )}

                  {/* Empty state */}
                  {!hasTable && !hasNarrative && !hasDiagram && (
                    <p className="text-sm italic text-text-muted">
                      {t("publish.preview.noSectionContent")}
                    </p>
                  )}
                </div>
              );
            }

            // Text sections: methods, discussion, introduction
            return (
              <div
                key={section.id}
                data-section-id={section.id}
                className="mb-8"
              >
                <h2
                  className="mb-3 font-bold text-gray-900"
                  style={{ fontSize: "14pt" }}
                >
                  {section.title}
                </h2>
                {section.content ? (
                  <PaperContent
                    content={typeof section.content === "string" ? section.content : JSON.stringify(section.content)}
                  />
                ) : (
                  <p className="text-sm italic text-text-muted">
                    {t("publish.preview.noSectionContent")}
                  </p>
                )}
              </div>
            );
          })}

          {numberedSections.length === 0 && (
            <p className="py-12 text-center text-sm italic text-text-muted">
              {t("publish.preview.noSectionsIncluded")}
            </p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="btn btn-secondary btn-sm flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("publish.preview.backToConfigure")}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="btn btn-publish flex items-center gap-2"
        >
          {t("publish.preview.export")}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
