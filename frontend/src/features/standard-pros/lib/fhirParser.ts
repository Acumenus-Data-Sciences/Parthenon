import type { SurveyItemPayload } from "../api/surveyApi";
import type { ParsedInstrumentImport } from "./redcapParser";

type FhirAnswerOption = {
  valueCoding?: { code?: string; display?: string };
  valueString?: string;
  valueInteger?: number;
};

type FhirItem = {
  text?: string;
  type?: string;
  repeats?: boolean;
  answerOption?: FhirAnswerOption[];
  item?: FhirItem[];
};

type Questionnaire = {
  title?: string;
  name?: string;
  description?: string;
  item?: FhirItem[];
};

function flattenItems(items: FhirItem[] | undefined, acc: FhirItem[] = []): FhirItem[] {
  for (const item of items ?? []) {
    if (item.text) {
      acc.push(item);
    }
    if (item.item?.length) {
      flattenItems(item.item, acc);
    }
  }

  return acc;
}

function mapType(item: FhirItem): SurveyItemPayload["response_type"] {
  switch ((item.type ?? "").toLowerCase()) {
    case "boolean":
      return "yes_no";
    case "integer":
    case "decimal":
      return "numeric";
    case "date":
    case "datetime":
      return "date";
    case "choice":
      return item.repeats ? "multi_select" : "likert";
    case "text":
    case "string":
    default:
      return "free_text";
  }
}

function mapAnswerOptions(answerOptions: FhirAnswerOption[] | undefined) {
  return (answerOptions ?? []).map((option, index) => {
    const text =
      option.valueCoding?.display ??
      option.valueString ??
      option.valueCoding?.code ??
      String(option.valueInteger ?? index + 1);

    return {
      option_text: text,
      option_value: option.valueInteger ?? index,
      display_order: index + 1,
    };
  });
}

export function parseFhirQuestionnaire(
  raw: string,
  defaults?: Partial<ParsedInstrumentImport["instrument"]>,
): ParsedInstrumentImport {
  const parsed = JSON.parse(raw) as Questionnaire;
  const flatItems = flattenItems(parsed.item);

  if (flatItems.length === 0) {
    throw new Error("FHIR Questionnaire import requires at least one item.");
  }

  const items: SurveyItemPayload[] = flatItems.map((item, index) => ({
    item_number: index + 1,
    item_text: item.text ?? `Item ${index + 1}`,
    response_type: mapType(item),
    display_order: index + 1,
    answer_options: mapAnswerOptions(item.answerOption),
  }));

  const name = defaults?.name ?? parsed.title ?? parsed.name ?? "Imported Questionnaire";
  const abbreviationSeed = (defaults?.abbreviation ?? parsed.name ?? "FHIR")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .toUpperCase()
    .slice(0, 24);

  return {
    instrument: {
      name,
      abbreviation: abbreviationSeed || `FHIR_${Date.now().toString().slice(-6)}`,
      version: defaults?.version ?? "1.0",
      description: defaults?.description ?? parsed.description ?? "Imported from FHIR Questionnaire",
      domain: defaults?.domain ?? "other",
    },
    items,
  };
}
