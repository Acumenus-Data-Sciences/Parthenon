type Translator = (key: string, options?: Record<string, unknown>) => string;

export function standardProsCatalogDomainLabel(t: Translator, domain: string) {
  const key = catalogDomainKey(domain);
  return key ? t(`standardPros.domains.catalog.${key}`) : domain;
}

export function standardProsBuilderDomainLabel(t: Translator, domain: string) {
  const known = new Set([
    "mental_health",
    "quality_of_life",
    "pain",
    "function",
    "sleep",
    "fatigue",
    "cardiovascular",
    "other",
  ]);

  return known.has(domain)
    ? t(`standardPros.domains.builder.${domain}`)
    : domain;
}

export function standardProsResponseTypeLabel(t: Translator, responseType: string) {
  const known = new Set([
    "likert",
    "yes_no",
    "numeric",
    "free_text",
    "multi_select",
    "date",
    "nrs",
    "vas",
  ]);

  return known.has(responseType)
    ? t(`standardPros.responseTypes.${responseType}`)
    : responseType.replace(/_/g, " ");
}

export function standardProsOmopLabel(
  t: Translator,
  coverage: "yes" | "partial" | "no",
) {
  if (coverage === "yes") return t("standardPros.omop.full");
  if (coverage === "partial") return t("standardPros.omop.partial");
  return t("standardPros.omop.none");
}

export function standardProsLicenseLabel(
  t: Translator,
  license: "public" | "proprietary",
) {
  return license === "public"
    ? t("standardPros.common.public")
    : t("standardPros.common.proprietary");
}

export function standardProsPainPoints(t: Translator) {
  return [
    {
      id: 1,
      title: t("standardPros.about.painPoints.vocabularyMappingGapsTitle"),
      description: t("standardPros.about.painPoints.vocabularyMappingGapsDesc"),
    },
    {
      id: 2,
      title: t("standardPros.about.painPoints.noPrebuiltEtlTitle"),
      description: t("standardPros.about.painPoints.noPrebuiltEtlDesc"),
    },
    {
      id: 3,
      title: t("standardPros.about.painPoints.domainClassificationAmbiguityTitle"),
      description: t("standardPros.about.painPoints.domainClassificationAmbiguityDesc"),
    },
    {
      id: 4,
      title: t("standardPros.about.painPoints.missingSurveyMetadataTitle"),
      description: t("standardPros.about.painPoints.missingSurveyMetadataDesc"),
    },
    {
      id: 5,
      title: t("standardPros.about.painPoints.compositeScoreRepresentationTitle"),
      description: t("standardPros.about.painPoints.compositeScoreRepresentationDesc"),
    },
    {
      id: 6,
      title: t("standardPros.about.painPoints.noDedicatedAnalyticsTitle"),
      description: t("standardPros.about.painPoints.noDedicatedAnalyticsDesc"),
    },
  ];
}

export function standardProsPillars(t: Translator) {
  return [
    {
      id: 1,
      title: t("standardPros.about.pillars.libraryTitle"),
      subtitle: t("standardPros.about.pillars.librarySubtitle"),
      description: t("standardPros.about.pillars.libraryDesc"),
      color: "var(--success)",
    },
    {
      id: 2,
      title: t("standardPros.about.pillars.builderTitle"),
      subtitle: t("standardPros.about.pillars.builderSubtitle"),
      description: t("standardPros.about.pillars.builderDesc"),
      color: "var(--accent)",
    },
    {
      id: 3,
      title: t("standardPros.about.pillars.conductTitle"),
      subtitle: t("standardPros.about.pillars.conductSubtitle"),
      description: t("standardPros.about.pillars.conductDesc"),
      color: "var(--info)",
    },
    {
      id: 4,
      title: t("standardPros.about.pillars.analyticsTitle"),
      subtitle: t("standardPros.about.pillars.analyticsSubtitle"),
      description: t("standardPros.about.pillars.analyticsDesc"),
      color: "var(--domain-observation)",
    },
  ];
}

function catalogDomainKey(domain: string) {
  const map: Record<string, string> = {
    "Mental Health": "mentalHealth",
    "Substance Use": "substanceUse",
    "Quality of Life": "qualityOfLife",
    Pain: "pain",
    "Functional Status": "functionalStatus",
    Oncology: "oncology",
    Cognitive: "cognitive",
    Geriatric: "geriatric",
    Cardiovascular: "cardiovascular",
    Respiratory: "respiratory",
    Diabetes: "diabetes",
    Pediatric: "pediatric",
    Neurological: "neurological",
    Sleep: "sleep",
    "Sexual Health": "sexualHealth",
    Musculoskeletal: "musculoskeletal",
    SDOH: "sdoh",
    Perioperative: "perioperative",
    PROMIS: "promis",
    Ophthalmology: "ophthalmology",
    "Movement Disorders": "movementDisorders",
    "Medication Adherence": "medicationAdherence",
  };

  return map[domain];
}
