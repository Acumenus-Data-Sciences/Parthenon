#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const defaultInput = "output/translation-assets/latest";
const allAssetGroups = ["frontend", "backend", "help", "docusaurus"];
const colonPlaceholderNames = [
    "attribute",
    "date",
    "input",
    "max",
    "min",
    "other",
    "seconds",
    "size",
    "status",
    "value",
    "values",
];

const protectedTerms = [
    "Parthenon",
    "Acumenus",
    "Abby",
    "OMOP",
    "CDM",
    "OHDSI",
    "ATLAS",
    "HADES",
    "CohortGenerator",
    "Circe",
    "FHIR",
    "DICOM",
    "PACS",
    "SQL",
    "JSON",
    "CSV",
    "API",
    "RWE",
    "HEOR",
    "GIS",
    "DQD",
    "ETL",
    "OpenAPI",
    "Laravel",
    "Docusaurus",
    "LiveKit",
    "MedGemma",
];

function usage() {
    return [
        "Usage: node scripts/i18n/validate-translation-assets.mjs [options]",
        "",
        "Options:",
        `  --input <dir>             Translation asset bundle, default ${defaultInput}`,
        "  --only <list>            Comma-separated groups: frontend,backend,help,docusaurus",
        "  --report <path>          Report output path, default <input>/validation-report.json",
        "  --fail-on-missing        Treat missing target strings as errors",
        "  --fail-on-term-warnings  Treat protected-term warnings as errors",
        "  --max-examples <n>       Console examples per severity, default 12",
        "  --help                   Show this help",
    ].join("\n");
}

function parseArgs(argv) {
    const options = {
        input: defaultInput,
        only: null,
        report: null,
        failOnMissing: false,
        failOnTermWarnings: false,
        maxExamples: 12,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--help" || arg === "-h") {
            console.log(usage());
            process.exit(0);
        } else if (arg === "--input" && argv[index + 1]) {
            options.input = argv[index + 1];
            index += 1;
        } else if (arg.startsWith("--input=")) {
            options.input = arg.slice("--input=".length);
        } else if (arg === "--only" && argv[index + 1]) {
            options.only = argv[index + 1].split(",").filter(Boolean);
            index += 1;
        } else if (arg.startsWith("--only=")) {
            options.only = arg
                .slice("--only=".length)
                .split(",")
                .filter(Boolean);
        } else if (arg === "--report" && argv[index + 1]) {
            options.report = argv[index + 1];
            index += 1;
        } else if (arg.startsWith("--report=")) {
            options.report = arg.slice("--report=".length);
        } else if (arg === "--fail-on-missing") {
            options.failOnMissing = true;
        } else if (arg === "--fail-on-term-warnings") {
            options.failOnTermWarnings = true;
        } else if (arg === "--max-examples" && argv[index + 1]) {
            options.maxExamples = Number(argv[index + 1]);
            index += 1;
        } else if (arg.startsWith("--max-examples=")) {
            options.maxExamples = Number(arg.slice("--max-examples=".length));
        } else {
            throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
        }
    }

    if (options.only) {
        const unknownGroups = options.only.filter(
            (item) => !allAssetGroups.includes(item),
        );
        if (unknownGroups.length > 0) {
            throw new Error(
                `Unknown asset group(s): ${unknownGroups.join(", ")}`,
            );
        }
    }

    return options;
}

function resolveFromRoot(filePath) {
    return path.isAbsolute(filePath)
        ? filePath
        : path.resolve(repoRoot, filePath);
}

function toPosix(filePath) {
    return filePath.split(path.sep).join("/");
}

function fromInput(inputDir, filePath) {
    return toPosix(path.relative(inputDir, filePath));
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function maybeReadJson(filePath, fallback = null) {
    if (!fs.existsSync(filePath)) return fallback;
    return readJson(filePath);
}

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function placeholdersFor(text) {
    const colonPattern = colonPlaceholderNames.join("|");
    const matches = String(text ?? "").match(
        new RegExp(`{{\\s*[\\w.]+\\s*}}|:(${colonPattern})|%[sdif]`, "g"),
    );
    return [...new Set(matches ?? [])].sort();
}

function tagTokensFor(text) {
    const matches = String(text ?? "").match(
        /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*)?>/g,
    );
    return [...new Set(matches ?? [])].sort();
}

function missingItems(sourceItems, targetItems) {
    const targetSet = new Set(targetItems);
    return sourceItems.filter((item) => !targetSet.has(item));
}

function protectedTermsIn(text) {
    const value = String(text ?? "");
    return protectedTerms.filter((term) => {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = /^[A-Z0-9]+$/.test(term)
            ? new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`)
            : new RegExp(escaped);
        return pattern.test(value);
    });
}

function makeIssue(severity, group, type, message, extra = {}) {
    return {
        severity,
        group,
        type,
        message,
        ...extra,
    };
}

function validateMessageRows(group, rows, options) {
    const errors = [];
    const warnings = [];
    const summary = {
        rowCount: rows.length,
        readyRows: 0,
        missingRows: 0,
        placeholderMismatchCount: 0,
        tagMismatchCount: 0,
        protectedTermWarningCount: 0,
    };

    for (const row of rows) {
        const targetText = String(row.target_text ?? "");
        if (!targetText) {
            summary.missingRows += 1;
            const issue = makeIssue(
                options.failOnMissing ? "error" : "warning",
                group,
                "missing-target",
                `${row.asset_id} is missing ${row.target_locale}`,
                {
                    asset_id: row.asset_id,
                    target_locale: row.target_locale,
                    source_path: row.source_path,
                },
            );
            if (options.failOnMissing) errors.push(issue);
            else warnings.push(issue);
            continue;
        }

        summary.readyRows += 1;
        const sourcePlaceholders = placeholdersFor(row.source_text);
        const targetPlaceholders = placeholdersFor(targetText);
        const missingPlaceholders = missingItems(
            sourcePlaceholders,
            targetPlaceholders,
        );
        const extraPlaceholders = missingItems(
            targetPlaceholders,
            sourcePlaceholders,
        );
        if (missingPlaceholders.length > 0 || extraPlaceholders.length > 0) {
            summary.placeholderMismatchCount += 1;
            errors.push(
                makeIssue(
                    "error",
                    group,
                    "placeholder-mismatch",
                    `${row.asset_id} has placeholder mismatch for ${row.target_locale}`,
                    {
                        asset_id: row.asset_id,
                        target_locale: row.target_locale,
                        missing_placeholders: missingPlaceholders,
                        extra_placeholders: extraPlaceholders,
                        source_path: row.source_path,
                    },
                ),
            );
        }

        const sourceTags = tagTokensFor(row.source_text);
        const targetTags = tagTokensFor(targetText);
        const missingTags = missingItems(sourceTags, targetTags);
        const extraTags = missingItems(targetTags, sourceTags);
        if (missingTags.length > 0 || extraTags.length > 0) {
            summary.tagMismatchCount += 1;
            errors.push(
                makeIssue(
                    "error",
                    group,
                    "tag-mismatch",
                    `${row.asset_id} has HTML/MDX tag mismatch for ${row.target_locale}`,
                    {
                        asset_id: row.asset_id,
                        target_locale: row.target_locale,
                        missing_tags: missingTags,
                        extra_tags: extraTags,
                        source_path: row.source_path,
                    },
                ),
            );
        }

        const requiredTerms = protectedTermsIn(row.source_text);
        const missingTerms = missingItems(
            requiredTerms,
            protectedTermsIn(targetText),
        );
        if (missingTerms.length > 0) {
            summary.protectedTermWarningCount += 1;
            const issue = makeIssue(
                options.failOnTermWarnings ? "error" : "warning",
                group,
                "protected-term-missing",
                `${row.asset_id} may have translated protected term(s): ${missingTerms.join(", ")}`,
                {
                    asset_id: row.asset_id,
                    target_locale: row.target_locale,
                    missing_terms: missingTerms,
                    source_path: row.source_path,
                },
            );
            if (options.failOnTermWarnings) errors.push(issue);
            else warnings.push(issue);
        }
    }

    return { summary, errors, warnings };
}

function hasBalancedCodeFences(content) {
    return (content.match(/```/g) ?? []).length % 2 === 0;
}

function validateDocusaurus(inputDir, options) {
    const manifestPath = path.join(inputDir, "docusaurus/manifest.json");
    const documentsPath = path.join(inputDir, "docusaurus/documents.json");
    const protectionNotesPath = path.join(
        inputDir,
        "docusaurus/protection-notes.json",
    );
    const manifest = maybeReadJson(manifestPath);
    const documents = maybeReadJson(documentsPath, []);
    const errors = [];
    const warnings = [];
    const summary = {
        documentCount: documents.length,
        missingDocumentFiles: 0,
        unbalancedCodeFenceCount: 0,
        missingFrontmatterCount: 0,
        copiedSourceFileCount: manifest?.copiedSourceFiles?.length ?? 0,
    };

    if (!manifest) {
        errors.push(
            makeIssue(
                "error",
                "docusaurus",
                "missing-manifest",
                "docusaurus/manifest.json is missing",
            ),
        );
    }

    if (!fs.existsSync(protectionNotesPath)) {
        errors.push(
            makeIssue(
                "error",
                "docusaurus",
                "missing-protection-notes",
                "docusaurus/protection-notes.json is missing",
            ),
        );
    }

    for (const record of documents) {
        const filePath = path.join(inputDir, record.output_path);
        if (!fs.existsSync(filePath)) {
            summary.missingDocumentFiles += 1;
            errors.push(
                makeIssue(
                    "error",
                    "docusaurus",
                    "missing-document-copy",
                    `${record.output_path} is missing`,
                    {
                        asset_id: record.asset_id,
                        source_path: record.source_path,
                    },
                ),
            );
            continue;
        }

        const content = fs.readFileSync(filePath, "utf8");
        if (!hasBalancedCodeFences(content)) {
            summary.unbalancedCodeFenceCount += 1;
            errors.push(
                makeIssue(
                    "error",
                    "docusaurus",
                    "unbalanced-code-fence",
                    `${record.output_path} has unbalanced fenced code blocks`,
                    {
                        asset_id: record.asset_id,
                        source_path: record.source_path,
                    },
                ),
            );
        }

        if (record.has_frontmatter === "yes" && !content.startsWith("---")) {
            summary.missingFrontmatterCount += 1;
            errors.push(
                makeIssue(
                    "error",
                    "docusaurus",
                    "missing-frontmatter",
                    `${record.output_path} should preserve frontmatter`,
                    {
                        asset_id: record.asset_id,
                        source_path: record.source_path,
                    },
                ),
            );
        }
    }

    for (const sourceFile of manifest?.copiedSourceFiles ?? []) {
        const filePath = path.join(inputDir, sourceFile);
        if (!fs.existsSync(filePath)) {
            errors.push(
                makeIssue(
                    "error",
                    "docusaurus",
                    "missing-source-copy",
                    `${sourceFile} is missing`,
                ),
            );
        }
    }

    if (manifest?.generatedSurfacesExcluded) {
        const generatedLeaks = documents.filter((record) =>
            /(^|\/)(build|\.docusaurus|dist)\//.test(record.source_path),
        );
        for (const record of generatedLeaks) {
            warnings.push(
                makeIssue(
                    "warning",
                    "docusaurus",
                    "generated-source-included",
                    `${record.source_path} looks like generated output`,
                    { asset_id: record.asset_id },
                ),
            );
        }
    }

    return { summary, errors, warnings };
}

function validateGroup(inputDir, group, options) {
    if (group === "docusaurus") {
        return validateDocusaurus(inputDir, options);
    }

    const messagesPath = path.join(inputDir, group, "messages.json");
    if (!fs.existsSync(messagesPath)) {
        return {
            summary: {
                rowCount: 0,
                readyRows: 0,
                missingRows: 0,
                placeholderMismatchCount: 0,
                tagMismatchCount: 0,
                protectedTermWarningCount: 0,
            },
            errors: [
                makeIssue(
                    "error",
                    group,
                    "missing-messages",
                    `${fromInput(inputDir, messagesPath)} is missing`,
                ),
            ],
            warnings: [],
        };
    }

    return validateMessageRows(group, readJson(messagesPath), options);
}

function printExamples(label, issues, maxExamples) {
    if (issues.length === 0) return;
    console.log(`\n${label}:`);
    for (const issue of issues.slice(0, maxExamples)) {
        const context = issue.asset_id ? ` (${issue.asset_id})` : "";
        console.log(
            `  - [${issue.group}/${issue.type}] ${issue.message}${context}`,
        );
    }
    if (issues.length > maxExamples) {
        console.log(`  ... ${issues.length - maxExamples} more`);
    }
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const inputDir = resolveFromRoot(options.input);
    const manifestPath = path.join(inputDir, "manifest.json");
    const manifest = maybeReadJson(manifestPath);

    if (!manifest) {
        throw new Error(
            `${manifestPath} is missing. Run i18n:export-assets first.`,
        );
    }

    const groups = options.only ?? manifest.assetGroups ?? allAssetGroups;
    const report = {
        generatedAt: new Date().toISOString(),
        inputRoot: toPosix(path.relative(repoRoot, inputDir)),
        sourceLocale: manifest.sourceLocale,
        targetLocales: manifest.targetLocales ?? [],
        groups,
        options: {
            failOnMissing: options.failOnMissing,
            failOnTermWarnings: options.failOnTermWarnings,
        },
        summaries: {},
        totals: {
            errors: 0,
            warnings: 0,
            missingRows: 0,
            checkedRows: 0,
        },
        errors: [],
        warnings: [],
    };

    for (const group of groups) {
        const result = validateGroup(inputDir, group, options);
        report.summaries[group] = result.summary;
        report.errors.push(...result.errors);
        report.warnings.push(...result.warnings);
        report.totals.errors += result.errors.length;
        report.totals.warnings += result.warnings.length;
        report.totals.missingRows += result.summary.missingRows ?? 0;
        report.totals.checkedRows +=
            result.summary.rowCount ?? result.summary.documentCount ?? 0;
    }

    const reportPath = resolveFromRoot(
        options.report ?? path.join(inputDir, "validation-report.json"),
    );
    writeJson(reportPath, report);

    console.log(`translation asset validation: ${report.inputRoot}`);
    console.log(
        `  checked ${report.totals.checkedRows} item(s), ` +
            `${report.totals.errors} error(s), ${report.totals.warnings} warning(s)`,
    );
    for (const [group, summary] of Object.entries(report.summaries)) {
        const count = summary.rowCount ?? summary.documentCount ?? 0;
        const missing = summary.missingRows
            ? `, missing ${summary.missingRows}`
            : "";
        const placeholder = summary.placeholderMismatchCount
            ? `, placeholder mismatches ${summary.placeholderMismatchCount}`
            : "";
        console.log(`  ${group}: ${count}${missing}${placeholder}`);
    }
    console.log(`  report: ${toPosix(path.relative(repoRoot, reportPath))}`);

    printExamples("Errors", report.errors, options.maxExamples);
    printExamples("Warnings", report.warnings, options.maxExamples);

    if (report.errors.length > 0) {
        process.exitCode = 1;
    }
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
