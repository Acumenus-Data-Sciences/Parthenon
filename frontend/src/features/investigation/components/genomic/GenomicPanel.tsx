import { useState } from "react";
import { useAutoSave } from "../../hooks/useAutoSave";
import { useCreatePin } from "../../hooks/useEvidencePins";
import type {
  GenomicState,
  GwasSummaryRow,
  GwasUploadResult,
  Investigation,
} from "../../types";
import { GwasCatalogSearch } from "./GwasCatalogSearch";
import { GwasUploader } from "./GwasUploader";
import ManhattanPlot from "./ManhattanPlot";
import { OpenTargetsSearch } from "./OpenTargetsSearch";
import QQPlot from "./QQPlot";
import { TopLociTable } from "./TopLociTable";

type TabId = "opentargets" | "gwas-catalog" | "upload";

interface GenomicPanelProps {
  investigation: Investigation;
}

type PinFinding = {
  domain: string;
  section: string;
  finding_type: string;
  finding_payload: Record<string, unknown>;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "opentargets", label: "Open Targets" },
  { id: "gwas-catalog", label: "GWAS Catalog" },
  { id: "upload", label: "Upload GWAS" },
];

export function GenomicPanel({ investigation }: GenomicPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("opentargets");
  const [gwasData, setGwasData] = useState<GwasSummaryRow[] | null>(null);
  const [gwasUploadResult, setGwasUploadResult] =
    useState<GwasUploadResult | null>(null);

  // Track genomic state for auto-save
  const [genomicState, setGenomicState] = useState<GenomicState>(
    investigation.genomic_state,
  );

  const createPin = useCreatePin(investigation.id);

  useAutoSave(
    investigation.id,
    "genomic",
    genomicState as unknown as Record<string, unknown>,
  );

  function handlePinFinding(finding: PinFinding) {
    createPin.mutate({
      domain: "genomic",
      section: "genomic_evidence",
      finding_type: finding.finding_type,
      finding_payload: finding.finding_payload,
      is_key_finding: false,
    });
  }

  function handleUploadComplete(
    result: GwasUploadResult,
    parsedData: GwasSummaryRow[],
  ) {
    setGwasUploadResult(result);
    setGwasData(parsedData);

    // Update genomic state: append uploaded GWAS record
    setGenomicState((prev) => {
      const topLociCount = parsedData.filter((r) => r.p <= 5e-8).length;
      const alreadyExists = (prev.uploaded_gwas ?? []).some(
        (u) => u.upload_id === result.upload_id,
      );
      if (alreadyExists) return prev;

      return {
        ...prev,
        uploaded_gwas: [
          ...(prev.uploaded_gwas ?? []),
          {
            file_name: result.file_name,
            column_mapping: result.column_mapping,
            upload_id: result.upload_id,
            top_loci_count: topLociCount,
            lambda_gc: null,
          },
        ],
      };
    });
  }

  function handlePinLocus(locus: { chr: string; pos: number; p: number }) {
    createPin.mutate({
      domain: "genomic",
      section: "genomic_evidence",
      finding_type: "gwas_locus",
      finding_payload: {
        chr: locus.chr,
        pos: locus.pos,
        p: locus.p,
        file_name: gwasUploadResult?.file_name ?? null,
        upload_id: gwasUploadResult?.upload_id ?? null,
      },
      is_key_finding: false,
    });
  }

  return (
    <div className="flex flex-col gap-0 min-h-full" style={{ backgroundColor: "#0E0E11" }}>
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b border-border-default"
        style={{ backgroundColor: "#09090b" }}
      >
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-text-primary">
            Genomic Evidence
          </h2>
          <p className="text-xs text-text-ghost">
            Open Targets · GWAS Catalog · Summary Statistics
          </p>
        </div>

        {/* Auto-save indicator rendered by useAutoSave internally */}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-0 border-b border-border-default px-6" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "text-text-primary"
                : "text-text-ghost hover:text-text-secondary"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                style={{ backgroundColor: "#2DD4BF" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {activeTab === "opentargets" && (
          <OpenTargetsSearch
            investigationId={investigation.id}
            onPinFinding={handlePinFinding}
          />
        )}

        {activeTab === "gwas-catalog" && (
          <GwasCatalogSearch
            investigationId={investigation.id}
            onPinFinding={handlePinFinding}
          />
        )}

        {activeTab === "upload" && (
          <div className="flex flex-col gap-6">
            <GwasUploader
              investigationId={investigation.id}
              onUploadComplete={handleUploadComplete}
            />

            {gwasData && gwasData.length > 0 && (
              <div className="flex flex-col gap-6">
                {/* Divider */}
                <div className="border-t border-border-default" />

                {/* Manhattan Plot */}
                <div className="flex flex-col gap-2">
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "#2DD4BF" }}
                  >
                    Manhattan Plot
                  </span>
                  <ManhattanPlot
                    data={gwasData.map((r) => ({
                      chr: r.chr,
                      pos: r.pos,
                      p: r.p,
                    }))}
                  />
                </div>

                {/* QQ Plot */}
                <div className="flex flex-col gap-2">
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "#2DD4BF" }}
                  >
                    QQ Plot
                  </span>
                  <QQPlot observedP={gwasData.map((r) => r.p)} />
                </div>

                {/* Top Loci Table */}
                <TopLociTable
                  data={gwasData}
                  onPinLocus={handlePinLocus}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
