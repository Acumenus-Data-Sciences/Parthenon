#!/usr/bin/env node
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = process.cwd();
const srcRoot = path.join(root, "src");
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

const userFacingAttributes = new Set([
  "aria-label",
  "aria-description",
  "alt",
  "placeholder",
  "title",
]);

const userFacingPropertyNames = new Set([
  "ariaLabel",
  "buttonLabel",
  "caption",
  "description",
  "emptyLabel",
  "emptyText",
  "errorMessage",
  "helperText",
  "label",
  "loadingText",
  "message",
  "name",
  "placeholder",
  "subtitle",
  "successMessage",
  "text",
  "title",
  "tooltip",
]);

const ignoredFiles = [
  /(^|\/)__tests__\//,
  /(^|\/)test\//,
  /\.test\.[cm]?[tj]sx?$/,
  /\.spec\.[cm]?[tj]sx?$/,
  /\.snapshot\.[cm]?[tj]sx?$/,
  /\.d\.ts$/,
  /\/i18n\/resources\.ts$/,
  /\/i18n\/dashboardResources\.ts$/,
  /\/i18n\/locales\.ts$/,
  /\/types\/api\.generated\.ts$/,
];

const ignoredTexts = new Set([
  "API",
  "CSV",
  "FHIR",
  "HADES",
  "HEOR",
  "JSON",
  "OMOP",
  "Parthenon",
  "SQL",
]);

const args = process.argv.slice(2);
const options = {
  failOnFindings: args.includes("--fail-on-findings"),
  output: "reports/i18n-scan.json",
  maxConsoleExamples: 12,
  paths: [],
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--output" && args[index + 1]) {
    options.output = args[index + 1];
    index += 1;
  } else if (arg.startsWith("--output=")) {
    options.output = arg.slice("--output=".length);
  } else if (arg === "--max-console-examples" && args[index + 1]) {
    options.maxConsoleExamples = Number(args[index + 1]);
    index += 1;
  } else if (arg.startsWith("--max-console-examples=")) {
    options.maxConsoleExamples = Number(arg.slice("--max-console-examples=".length));
  } else if (arg === "--paths" && args[index + 1]) {
    options.paths = args[index + 1].split(",").filter(Boolean);
    index += 1;
  } else if (arg.startsWith("--paths=")) {
    options.paths = arg.slice("--paths=".length).split(",").filter(Boolean);
  }
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") return [];
      return walk(entryPath);
    }

    if (!/\.[cm]?[tj]sx?$/.test(entry.name)) return [];
    return [entryPath];
  });
}

function selectedRoots() {
  if (options.paths.length === 0) return [srcRoot];

  return options.paths.map((item) => path.resolve(root, item));
}

function shouldIgnoreFile(filePath) {
  const relative = toPosix(path.relative(root, filePath));
  return ignoredFiles.some((pattern) => pattern.test(relative));
}

function normalizeCandidateText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function looksHumanFacing(text) {
  const normalized = normalizeCandidateText(text);
  if (!normalized) return false;
  if (ignoredTexts.has(normalized)) return false;
  if (!/\p{L}/u.test(normalized)) return false;
  if (/^https?:\/\//i.test(normalized)) return false;
  if (/^[A-Z0-9+/#_.:-]{2,}$/.test(normalized)) return false;
  if (/^[a-z0-9_.:-]+$/.test(normalized)) return false;
  return true;
}

function stringValue(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function jsxAttributeValue(node) {
  if (!node.initializer) return null;

  if (ts.isStringLiteral(node.initializer)) {
    return node.initializer.text;
  }

  if (ts.isJsxExpression(node.initializer)) {
    return stringValue(node.initializer.expression);
  }

  return null;
}

function propertyName(node) {
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) {
    return node.name.text;
  }
  return null;
}

function lineHasExemption(sourceFile, position) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(position);
  const starts = sourceFile.getLineStarts();
  const currentStart = starts[line] ?? 0;
  const nextStart = starts[line + 1] ?? sourceFile.text.length;
  const currentLine = sourceFile.text.slice(currentStart, nextStart);
  const previousStart = starts[line - 1] ?? currentStart;
  const previousLine = line > 0 ? sourceFile.text.slice(previousStart, currentStart) : "";
  return currentLine.includes("i18n-exempt") || previousLine.includes("i18n-exempt");
}

function locationFor(sourceFile, node) {
  const start = node.getStart(sourceFile);
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
  return { line: line + 1, column: character + 1, position: start };
}

function addCandidate(candidates, sourceFile, filePath, node, kind, text, context) {
  const normalized = normalizeCandidateText(text);
  if (!looksHumanFacing(normalized)) return;
  const location = locationFor(sourceFile, node);
  if (lineHasExemption(sourceFile, location.position)) return;

  candidates.push({
    file: toPosix(path.relative(root, filePath)),
    line: location.line,
    column: location.column,
    kind,
    context,
    text: normalized,
  });
}

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const scriptKind = filePath.endsWith(".tsx") || filePath.endsWith(".jsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const candidates = [];

  function visit(node) {
    if (ts.isJsxText(node)) {
      addCandidate(candidates, sourceFile, filePath, node, "jsx-text", node.getText(sourceFile), "jsx");
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (userFacingAttributes.has(name)) {
        const value = jsxAttributeValue(node);
        if (value) {
          addCandidate(candidates, sourceFile, filePath, node, "jsx-attribute", value, name);
        }
      }
    } else if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node);
      if (name && userFacingPropertyNames.has(name)) {
        const value = stringValue(node.initializer);
        if (value) {
          addCandidate(candidates, sourceFile, filePath, node, "object-property", value, name);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return candidates;
}

function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    groups[key] = (groups[key] ?? 0) + 1;
    return groups;
  }, {});
}

const files = selectedRoots()
  .flatMap((rootPath) => walk(rootPath))
  .filter((filePath, index, all) => all.indexOf(filePath) === index)
  .filter((filePath) => !shouldIgnoreFile(filePath))
  .sort();

const candidates = files.flatMap(scanFile);
const byFile = groupBy(candidates, (candidate) => candidate.file);
const byKind = groupBy(candidates, (candidate) => candidate.kind);
const topFiles = Object.entries(byFile)
  .sort(([, left], [, right]) => right - left)
  .slice(0, 25)
  .map(([file, count]) => ({ file, count }));

const report = {
  generatedAt: new Date().toISOString(),
  mode: options.failOnFindings ? "fail-on-findings" : "warn-only",
  scannedFileCount: files.length,
  candidateCount: candidates.length,
  byKind,
  topFiles,
  candidates,
};

const outputPath = path.resolve(root, options.output);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`i18n scan: ${candidates.length} candidate(s) across ${files.length} file(s).`);
console.log(`Report written to ${toPosix(path.relative(root, outputPath))}.`);

if (topFiles.length > 0) {
  console.log("\nTop files:");
  for (const item of topFiles.slice(0, options.maxConsoleExamples)) {
    console.log(`  ${String(item.count).padStart(4)}  ${item.file}`);
  }
}

if (candidates.length > 0) {
  console.log("\nExample candidates:");
  for (const candidate of candidates.slice(0, options.maxConsoleExamples)) {
    console.log(
      `  ${candidate.file}:${candidate.line}:${candidate.column} ` +
        `[${candidate.kind}/${candidate.context}] ${candidate.text}`,
    );
  }
}

if (options.failOnFindings && candidates.length > 0) {
  process.exitCode = 1;
}
