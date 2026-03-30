import type { SurveyItemPayload } from "../api/surveyApi";

export interface ParsedInstrumentImport {
  instrument: {
    name: string;
    abbreviation: string;
    version: string;
    description: string | null;
    domain: string;
  };
  items: SurveyItemPayload[];
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseChoices(input: string) {
  return input
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [rawValue, ...labelParts] = entry.split(",");
      const label = labelParts.join(",").trim() || rawValue.trim();
      const numericValue = Number(rawValue.trim());

      return {
        option_text: label,
        option_value: Number.isFinite(numericValue) ? numericValue : index,
        display_order: index + 1,
      };
    });
}

function toResponseType(fieldType: string): SurveyItemPayload["response_type"] {
  const normalized = fieldType.trim().toLowerCase();

  if (normalized === "yesno") return "yes_no";
  if (normalized === "checkbox") return "multi_select";
  if (normalized === "dropdown" || normalized === "radio") return "likert";
  if (normalized === "calc" || normalized === "slider") return "numeric";
  if (normalized === "notes") return "free_text";

  return "free_text";
}

export function parseRedcapDictionary(
  csv: string,
  defaults?: Partial<ParsedInstrumentImport["instrument"]>,
): ParsedInstrumentImport {
  const lines = csv
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("REDCap import requires a header row and at least one field row.");
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });

  const itemRows = rows.filter((row) => {
    const fieldType = String(row["field type"] ?? row["field_type"] ?? "").toLowerCase();
    const label = String(row["field label"] ?? row["field_label"] ?? "").trim();
    return label !== "" && !["descriptive", "file", "section"].includes(fieldType);
  });

  const items: SurveyItemPayload[] = itemRows.map((row, index) => {
    const fieldType = String(row["field type"] ?? row["field_type"] ?? "");
    const responseType = toResponseType(fieldType);
    const choices = String(row["choices, calculations, or slider labels"] ?? row["select choices or calculations"] ?? "");
    const answerOptions = choices ? parseChoices(choices) : [];

    return {
      item_number: index + 1,
      item_text: String(row["field label"] ?? row["field_label"] ?? `Item ${index + 1}`).trim(),
      response_type: responseType,
      display_order: index + 1,
      min_value: responseType === "numeric" ? 0 : null,
      max_value: responseType === "numeric" ? 100 : null,
      answer_options: answerOptions,
    };
  });

  return {
    instrument: {
      name: defaults?.name ?? "Imported REDCap Instrument",
      abbreviation: defaults?.abbreviation ?? `REDCAP_${Date.now().toString().slice(-6)}`,
      version: defaults?.version ?? "1.0",
      description: defaults?.description ?? "Imported from REDCap data dictionary",
      domain: defaults?.domain ?? "other",
    },
    items,
  };
}
