export type MissingTranslationKey = {
  languages: string[];
  namespace: string;
  key: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

const missingTranslationKeys = new Map<string, MissingTranslationKey>();

function normalizeLanguages(language: readonly string[] | string): string[] {
  return typeof language === "string" ? [language] : [...language];
}

function normalizeNamespace(namespace: readonly string[] | string): string {
  return typeof namespace === "string" ? namespace : namespace.join(",");
}

function missingKeyId(
  languages: readonly string[],
  namespace: string,
  key: string,
): string {
  return `${languages.join("|")}::${namespace}::${key}`;
}

export function recordMissingTranslationKey(
  language: readonly string[] | string,
  namespace: readonly string[] | string,
  key: string,
  now = new Date(),
): MissingTranslationKey {
  const languages = normalizeLanguages(language);
  const normalizedNamespace = normalizeNamespace(namespace);
  const id = missingKeyId(languages, normalizedNamespace, key);
  const timestamp = now.toISOString();
  const existing = missingTranslationKeys.get(id);

  if (existing) {
    existing.count += 1;
    existing.lastSeenAt = timestamp;
    return existing;
  }

  const entry = {
    languages,
    namespace: normalizedNamespace,
    key,
    count: 1,
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
  };

  missingTranslationKeys.set(id, entry);
  return entry;
}

export function getMissingTranslationKeys(): MissingTranslationKey[] {
  return Array.from(missingTranslationKeys.values()).sort((a, b) =>
    `${a.namespace}.${a.key}`.localeCompare(`${b.namespace}.${b.key}`),
  );
}

export function clearMissingTranslationKeys(): void {
  missingTranslationKeys.clear();
}
