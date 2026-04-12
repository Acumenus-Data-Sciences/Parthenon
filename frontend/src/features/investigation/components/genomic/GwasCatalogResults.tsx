import type {
  GwasCatalogResult,
  GwasCatalogStudy,
} from "../../types";

type PinFinding = {
  domain: string;
  section: string;
  finding_type: string;
  finding_payload: Record<string, unknown>;
  gene_symbols?: string[];
};

interface GwasCatalogResultsProps {
  result: GwasCatalogResult;
  queryType: "trait" | "gene";
  onPinFinding: (finding: PinFinding) => void;
}

// ── Trait search: study cards ──────────────────────────────────────────

interface StudyCardProps {
  study: GwasCatalogStudy;
  onPinFinding: (finding: PinFinding) => void;
}

function StudyCard({ study, onPinFinding }: StudyCardProps) {
  const trait = study.diseaseTrait?.trait ?? "Unknown trait";
  const pub = study.publicationInfo;
  const year = pub?.publicationDate
    ? new Date(pub.publicationDate).getFullYear()
    : null;

  function handlePin() {
    onPinFinding({
      domain: "genomic",
      section: "genomic_evidence",
      finding_type: "gwas_locus",
      finding_payload: {
        accession_id: study.accessionId,
        trait,
        journal: pub?.publication ?? null,
        year,
        first_author: pub?.author?.fullname ?? null,
        pubmed_id: pub?.pubmedId ?? null,
        initial_sample_size: study.initialSampleSize ?? null,
        snp_count: study.snpCount ?? null,
        source: "gwas_catalog",
      },
    });
  }

  return (
    <div className="flex flex-col gap-2.5 p-4 rounded-xl bg-surface-base/50 border border-border-default hover:border-border-default transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded border font-mono" style={{ borderColor: "#2DD4BF40", color: "var(--success)" }}>
              {study.accessionId}
            </span>
            {year && (
              <span className="text-[10px] text-text-ghost">{year}</span>
            )}
          </div>
          <span className="text-sm font-semibold text-text-primary leading-snug">
            {trait}
          </span>
          {pub && (
            <span className="text-xs text-text-muted leading-snug line-clamp-1">
              {pub.author?.fullname && `${pub.author.fullname} · `}
              {pub.publication}
            </span>
          )}
        </div>
        <button
          onClick={handlePin}
          className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded border border-border-hover text-text-muted hover:border-success/50 hover:text-success transition-colors whitespace-nowrap"
        >
          Pin
        </button>
      </div>

      {(study.initialSampleSize || study.snpCount != null) && (
        <div className="flex flex-wrap gap-3 text-[10px] text-text-ghost">
          {study.initialSampleSize && (
            <span>
              <span className="text-text-muted">Sample:</span>{" "}
              {study.initialSampleSize}
            </span>
          )}
          {study.snpCount != null && study.snpCount > 0 && (
            <span>
              <span className="text-text-muted">SNPs:</span>{" "}
              {study.snpCount.toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Gene search: SNP association cards ───────────────────────────────────

interface SnpAssociation {
  variant?: {
    id?: string;
    rsId?: string;
    chromosome?: string;
    chromosomePosition?: number;
    functionalClass?: string;
    mappedGenes?: Array<{ geneName?: string }>;
  };
  pvalue?: number;
  loci?: Array<{
    authorReportedGenes?: Array<{ geneName: string }>;
    strongestRiskAlleles?: Array<{ riskAlleleName: string }>;
  }>;
  study?: { accessionId?: string; diseaseTrait?: { trait: string } };
}

interface SnpCardProps {
  assoc: SnpAssociation;
  onPinFinding: (finding: PinFinding) => void;
}

function SnpCard({ assoc, onPinFinding }: SnpCardProps) {
  const variant = assoc.variant ?? {};
  const rsId = variant.rsId ?? variant.id ?? "Unknown";
  const chr = variant.chromosome ?? null;
  const pos = variant.chromosomePosition ?? null;
  const funcClass = variant.functionalClass ?? null;

  // Collect gene names from variant.mappedGenes or loci
  const geneNames: string[] = [];
  (variant.mappedGenes ?? []).forEach((g) => {
    if (g.geneName) geneNames.push(g.geneName);
  });
  (assoc.loci ?? []).forEach((l) => {
    (l.authorReportedGenes ?? []).forEach((g) => {
      if (g.geneName && !geneNames.includes(g.geneName)) {
        geneNames.push(g.geneName);
      }
    });
  });

  const trait = assoc.study?.diseaseTrait?.trait ?? null;
  const accession = assoc.study?.accessionId ?? null;

  function handlePin() {
    onPinFinding({
      domain: "genomic",
      section: "genomic_evidence",
      finding_type: "gwas_locus",
      finding_payload: {
        rs_id: rsId,
        chromosome: chr,
        position: pos,
        functional_class: funcClass,
        gene_names: geneNames,
        p_value: assoc.pvalue ?? null,
        trait,
        accession_id: accession,
        source: "gwas_catalog",
      },
      gene_symbols: geneNames.length > 0 ? geneNames : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-2.5 p-4 rounded-xl bg-surface-base/50 border border-border-default hover:border-border-default transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold font-mono" style={{ color: "var(--success)" }}>
              {rsId}
            </span>
            {chr && pos != null && (
              <span className="text-[10px] text-text-ghost font-mono">
                chr{chr}:{pos.toLocaleString()}
              </span>
            )}
          </div>
          {geneNames.length > 0 && (
            <span className="text-xs text-text-secondary">
              {geneNames.join(", ")}
            </span>
          )}
          {trait && (
            <span className="text-xs text-text-ghost line-clamp-1">{trait}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {funcClass && (
            <span className="text-[10px] px-2 py-0.5 rounded border border-border-default text-text-ghost">
              {funcClass.replace(/_/g, " ")}
            </span>
          )}
          <button
            onClick={handlePin}
            className="text-[10px] px-2.5 py-1 rounded border border-border-hover text-text-muted hover:border-success/50 hover:text-success transition-colors whitespace-nowrap"
          >
            Pin
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function GwasCatalogResults({
  result,
  queryType,
  onPinFinding,
}: GwasCatalogResultsProps) {
  const embedded = result._embedded ?? {};
  const page = result.page;

  if (queryType === "trait") {
    // efoTraits or studies embedded key
    const studies =
      (embedded.efoTraits as GwasCatalogStudy[] | undefined) ??
      (embedded.studies as GwasCatalogStudy[] | undefined) ??
      [];

    if (studies.length === 0) {
      return (
        <p className="text-xs text-text-ghost py-4 text-center">No results found.</p>
      );
    }

    return (
      <div className="flex flex-col gap-2.5">
        {page && (
          <p className="text-[10px] text-text-ghost uppercase tracking-wide">
            Showing {studies.length} of {page.totalElements.toLocaleString()} results — GWAS Catalog
          </p>
        )}
        {studies.map((study, i) => (
          <StudyCard
            key={study.accessionId ?? i}
            study={study}
            onPinFinding={onPinFinding}
          />
        ))}
      </div>
    );
  }

  // Gene search — associations or singleNucleotidePolymorphisms
  const assocs =
    (embedded.singleNucleotidePolymorphisms as SnpAssociation[] | undefined) ??
    (embedded.associations as SnpAssociation[] | undefined) ??
    [];

  if (assocs.length === 0) {
    return (
      <p className="text-xs text-text-ghost py-4 text-center">No results found.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {page && (
        <p className="text-[10px] text-text-ghost uppercase tracking-wide">
          Showing {assocs.length} of {page.totalElements.toLocaleString()} results — GWAS Catalog
        </p>
      )}
      {assocs.map((assoc, i) => (
        <SnpCard
          key={(assoc.variant?.rsId ?? assoc.variant?.id) ?? i}
          assoc={assoc}
          onPinFinding={onPinFinding}
        />
      ))}
    </div>
  );
}
