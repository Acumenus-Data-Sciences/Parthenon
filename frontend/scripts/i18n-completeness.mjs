#!/usr/bin/env node
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = process.cwd();
const require = createRequire(import.meta.url);

function loadTypeScript() {
  try {
    return require("typescript");
  } catch (error) {
    const siblingWorktreeTypeScript = path.resolve(
      root,
      "../../Parthenon/frontend/node_modules/typescript",
    );
    if (fs.existsSync(siblingWorktreeTypeScript)) {
      return require(siblingWorktreeTypeScript);
    }

    throw error;
  }
}

const ts = loadTypeScript();

const args = process.argv.slice(2);
const options = {
  output: "reports/i18n-completeness.json",
  failOnMissingPublic: args.includes("--fail-on-missing-public"),
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--output" && args[index + 1]) {
    options.output = args[index + 1];
    index += 1;
  } else if (arg.startsWith("--output=")) {
    options.output = arg.slice("--output=".length);
  }
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function loadTsModule(relativePath) {
  const filename = path.resolve(root, relativePath);
  const source = fs
    .readFileSync(filename, "utf8")
    .replaceAll("import.meta.env.DEV", "false")
    .replaceAll("import.meta.env.VITE_I18N_SHOW_QA_LOCALES", "undefined");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: filename,
  }).outputText;

  const module = { exports: {} };
  const localRequire = createRequire(filename);
  const fn = new Function(
    "exports",
    "require",
    "module",
    "__filename",
    "__dirname",
    compiled,
  );
  fn(module.exports, localRequire, module, filename, path.dirname(filename));
  return module.exports;
}

function flatten(tree, prefix = "") {
  return Object.entries(tree ?? {}).flatMap(([key, value]) => {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return flatten(value, pathKey);
    }

    return [[pathKey, String(value ?? "")]];
  });
}

function percent(numerator, denominator) {
  if (denominator === 0) return 100;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

const { SUPPORTED_LOCALES } = loadTsModule("src/i18n/locales.ts");
const { resources, namespaces } = loadTsModule("src/i18n/resources.ts");
const sourceLocale = "en-US";
const sourceResources = resources[sourceLocale] ?? {};

const localeReports = SUPPORTED_LOCALES.map((locale) => {
  const localeResources = resources[locale.code] ?? {};
  const namespaceReports = namespaces.map((namespace) => {
    const sourceEntries = flatten(sourceResources[namespace]);
    const sourceMap = new Map(sourceEntries);
    const targetMap = new Map(flatten(localeResources[namespace]));
    const missingKeys = [];
    const identicalToSourceKeys = [];
    const emptyKeys = [];

    for (const [key, sourceValue] of sourceMap.entries()) {
      if (!targetMap.has(key)) {
        missingKeys.push(key);
        continue;
      }

      const targetValue = targetMap.get(key) ?? "";
      if (targetValue.trim() === "") {
        emptyKeys.push(key);
      }
      if (locale.code !== sourceLocale && targetValue === sourceValue) {
        identicalToSourceKeys.push(key);
      }
    }

    const totalKeys = sourceEntries.length;
    const presentKeys = totalKeys - missingKeys.length;
    const distinctValueKeys = presentKeys - identicalToSourceKeys.length;

    return {
      namespace,
      totalKeys,
      presentKeys,
      missingCount: missingKeys.length,
      emptyCount: emptyKeys.length,
      identicalToSourceCount: identicalToSourceKeys.length,
      keyCoveragePercent: percent(presentKeys, totalKeys),
      distinctValuePercent: locale.code === sourceLocale
        ? 100
        : percent(distinctValueKeys, totalKeys),
      missingKeys,
      emptyKeys,
      identicalToSourceKeys,
    };
  });

  const totals = namespaceReports.reduce(
    (acc, item) => ({
      totalKeys: acc.totalKeys + item.totalKeys,
      presentKeys: acc.presentKeys + item.presentKeys,
      missingCount: acc.missingCount + item.missingCount,
      emptyCount: acc.emptyCount + item.emptyCount,
      identicalToSourceCount:
        acc.identicalToSourceCount + item.identicalToSourceCount,
    }),
    {
      totalKeys: 0,
      presentKeys: 0,
      missingCount: 0,
      emptyCount: 0,
      identicalToSourceCount: 0,
    },
  );

  return {
    locale: locale.code,
    label: locale.label,
    nativeLabel: locale.nativeLabel,
    direction: locale.direction,
    releaseTier: locale.releaseTier,
    enabled: locale.enabled,
    selectable: locale.selectable,
    qaOnly: "qaOnly" in locale ? locale.qaOnly : false,
    keyCoveragePercent: percent(totals.presentKeys, totals.totalKeys),
    distinctValuePercent: locale.code === sourceLocale
      ? 100
      : percent(
          totals.presentKeys - totals.identicalToSourceCount,
          totals.totalKeys,
        ),
    ...totals,
    namespaces: namespaceReports,
  };
});

const publicMissingLocales = localeReports.filter(
  (locale) =>
    locale.locale !== sourceLocale &&
    locale.selectable &&
    (locale.missingCount > 0 || locale.emptyCount > 0),
);

const report = {
  generatedAt: new Date().toISOString(),
  sourceLocale,
  namespaces,
  localeCount: localeReports.length,
  publicSelectableLocales: localeReports
    .filter((locale) => locale.selectable)
    .map((locale) => locale.locale),
  publicMissingLocaleCount: publicMissingLocales.length,
  locales: localeReports,
};

const outputPath = path.resolve(root, options.output);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(
  `i18n completeness: ${localeReports.length} locale(s), ` +
    `${namespaces.length} namespace(s).`,
);
console.log(`Report written to ${toPosix(path.relative(root, outputPath))}.`);

for (const locale of localeReports) {
  console.log(
    `  ${locale.locale.padEnd(8)} keys ${String(locale.keyCoveragePercent).padStart(6)}%` +
      ` distinct ${String(locale.distinctValuePercent).padStart(6)}%` +
      ` missing ${locale.missingCount}`,
  );
}

if (options.failOnMissingPublic && publicMissingLocales.length > 0) {
  console.error(
    `Public locales with missing or empty keys: ` +
      publicMissingLocales.map((locale) => locale.locale).join(", "),
  );
  process.exitCode = 1;
}
