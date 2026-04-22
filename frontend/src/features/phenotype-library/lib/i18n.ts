import type { TFunction } from "i18next";

const PHENOTYPE_DOMAIN_KEY_MAP: Record<string, string> = {
  Condition: "condition",
  Drug: "drug",
  Measurement: "measurement",
  Procedure: "procedure",
  Observation: "observation",
  Device: "device",
};

const PHENOTYPE_SEVERITY_KEY_MAP: Record<string, string> = {
  acute: "acute",
  chronic: "chronic",
  subacute: "subacute",
};

export function getPhenotypeDomainLabel(
  t: TFunction<"app">,
  domain: string | null,
): string {
  if (!domain) {
    return domain ?? "";
  }

  const key = PHENOTYPE_DOMAIN_KEY_MAP[domain];
  return key ? t(`phenotypeLibrary.domains.${key}`) : domain;
}

export function getPhenotypeSeverityLabel(
  t: TFunction<"app">,
  severity: string | null,
): string {
  if (!severity) {
    return severity ?? "";
  }

  const key = PHENOTYPE_SEVERITY_KEY_MAP[severity.toLowerCase()];
  return key ? t(`phenotypeLibrary.severities.${key}`) : severity;
}
