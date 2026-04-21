import type { TFunction } from "i18next";
import type {
  ClinicalAnalysisGroup,
  ClinicalAnalysisType,
  EvidenceDomain,
  InvestigationStatus,
  PinSection,
} from "../types";

type Translator = TFunction<"app">;

type InvestigationCountKey =
  | "conceptSet"
  | "cohort"
  | "query"
  | "upload"
  | "pin"
  | "section"
  | "result"
  | "locus"
  | "patient"
  | "row"
  | "analysis";

const ANALYSIS_PREREQUISITE_KEYS: Record<ClinicalAnalysisType, string[]> = {
  characterization: ["atLeastOneCohortDefined"],
  incidence_rate: ["targetCohort", "outcomeCohort"],
  pathway: ["targetCohort"],
  estimation: ["targetCohort", "comparatorCohort", "outcomeCohort"],
  sccs: ["exposureCohort", "outcomeCohort"],
  evidence_synthesis: ["completedEstimations2Plus"],
  prediction: ["targetCohort", "outcomeCohort"],
};

const ANALYSIS_TIME_KEYS: Record<ClinicalAnalysisType, string> = {
  characterization: "twoToFiveMinutes",
  incidence_rate: "oneToThreeMinutes",
  pathway: "twoToFiveMinutes",
  estimation: "tenToFortyFiveMinutes",
  sccs: "fiveToFifteenMinutes",
  evidence_synthesis: "underOneMinute",
  prediction: "fifteenToSixtyMinutes",
};

const PIN_SECTION_KEYS: Record<PinSection | "research_question", string> = {
  research_question: "researchQuestion",
  phenotype_definition: "phenotypeDefinition",
  population: "populationCharacteristics",
  clinical_evidence: "clinicalEvidence",
  genomic_evidence: "genomicEvidence",
  synthesis: "evidenceSynthesis",
  limitations: "limitationsCaveats",
  methods: "methods",
};

const DOMAIN_KEYS: Record<EvidenceDomain, string> = {
  phenotype: "phenotype",
  clinical: "clinical",
  genomic: "genomic",
  synthesis: "synthesis",
  "code-explorer": "codeExplorer",
};

const STATUS_KEYS: Record<InvestigationStatus, string> = {
  draft: "draft",
  active: "active",
  complete: "complete",
  archived: "archived",
};

function normalizeLocale(locale: string | null | undefined): string {
  return !locale || locale === "en-XA" ? "en-US" : locale;
}

export function formatInvestigationDate(
  locale: string | null | undefined,
  value: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(normalizeLocale(locale), options).format(
    new Date(value),
  );
}

export function formatInvestigationRelativeTime(
  t: Translator,
  locale: string | null | undefined,
  value: string,
): string {
  const now = Date.now();
  const then = new Date(value).getTime();
  const diffSecs = Math.floor((now - then) / 1000);

  if (diffSecs < 60) {
    return t("investigation.common.time.secondsAgo", { count: diffSecs });
  }

  if (diffSecs < 3600) {
    return t("investigation.common.time.minutesAgo", {
      count: Math.floor(diffSecs / 60),
    });
  }

  if (diffSecs < 86400) {
    return t("investigation.common.time.hoursAgo", {
      count: Math.floor(diffSecs / 3600),
    });
  }

  return formatInvestigationDate(locale, value, {
    month: "short",
    day: "numeric",
  });
}

export function formatInvestigationCount(
  t: Translator,
  key: InvestigationCountKey,
  count: number,
): string {
  return t(`investigation.common.counts.${key}`, { count });
}

export function getInvestigationDomainLabel(
  t: Translator,
  domain: EvidenceDomain,
): string {
  return t(`investigation.common.domains.${DOMAIN_KEYS[domain]}`);
}

export function getInvestigationStatusLabel(
  t: Translator,
  status: InvestigationStatus,
): string {
  return t(`investigation.common.status.${STATUS_KEYS[status]}`);
}

export function getInvestigationSectionLabel(
  t: Translator,
  section: PinSection | "research_question",
): string {
  return t(`investigation.common.sections.${PIN_SECTION_KEYS[section]}`);
}

export function getClinicalAnalysisLabel(
  t: Translator,
  type: ClinicalAnalysisType,
): string {
  return t(`investigation.clinical.analysisMeta.${type}.label`);
}

export function getClinicalAnalysisDescription(
  t: Translator,
  type: ClinicalAnalysisType,
): string {
  return t(`investigation.clinical.analysisMeta.${type}.description`);
}

export function getClinicalAnalysisEstimatedTime(
  t: Translator,
  type: ClinicalAnalysisType,
): string {
  return t(
    `investigation.clinical.estimatedTimes.${ANALYSIS_TIME_KEYS[type]}`,
  );
}

export function getClinicalAnalysisPrerequisites(
  t: Translator,
  type: ClinicalAnalysisType,
): string[] {
  return ANALYSIS_PREREQUISITE_KEYS[type].map((key) =>
    t(`investigation.clinical.prerequisites.${key}`),
  );
}

export function getClinicalAnalysisGroupLabel(
  t: Translator,
  group: ClinicalAnalysisGroup,
): string {
  return t(`investigation.clinical.groupMeta.${group}.label`);
}

export function getClinicalAnalysisGroupDescription(
  t: Translator,
  group: ClinicalAnalysisGroup,
): string {
  return t(`investigation.clinical.groupMeta.${group}.description`);
}
