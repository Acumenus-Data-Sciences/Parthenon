#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const defaultInput = "output/translation-assets/latest";
const defaultOutput = "output/translation-assets/import-preview";
const allAssetGroups = ["frontend", "backend", "help", "docusaurus"];
const sourceLocale = "en-US";

function usage() {
    return [
        "Usage: node scripts/i18n/import-translation-assets.mjs [options]",
        "",
        "Options:",
        `  --input <dir>        Reviewed translation asset bundle, default ${defaultInput}`,
        `  --output <dir>       Dry-run/preview output directory, default ${defaultOutput}`,
        "  --locales <list>     Comma-separated target locale codes, default bundle target locales",
        "  --only <list>        Comma-separated groups: frontend,backend,help,docusaurus",
        "  --apply              Write supported imports into source locations",
        "  --skip-validation    Skip translation asset validation before import",
        "  --no-clean           Do not remove the preview output directory first",
        "  --help               Show this help",
    ].join("\n");
}

function parseArgs(argv) {
    const options = {
        input: defaultInput,
        output: defaultOutput,
        locales: null,
        only: null,
        apply: false,
        skipValidation: false,
        clean: true,
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
        } else if (arg === "--output" && argv[index + 1]) {
            options.output = argv[index + 1];
            index += 1;
        } else if (arg.startsWith("--output=")) {
            options.output = arg.slice("--output=".length);
        } else if (arg === "--locales" && argv[index + 1]) {
            options.locales = argv[index + 1].split(",").filter(Boolean);
            index += 1;
        } else if (arg.startsWith("--locales=")) {
            options.locales = arg
                .slice("--locales=".length)
                .split(",")
                .filter(Boolean);
        } else if (arg === "--only" && argv[index + 1]) {
            options.only = argv[index + 1].split(",").filter(Boolean);
            index += 1;
        } else if (arg.startsWith("--only=")) {
            options.only = arg
                .slice("--only=".length)
                .split(",")
                .filter(Boolean);
        } else if (arg === "--apply") {
            options.apply = true;
        } else if (arg === "--skip-validation") {
            options.skipValidation = true;
        } else if (arg === "--no-clean") {
            options.clean = false;
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

function fromRoot(filePath) {
    return toPosix(path.relative(repoRoot, filePath));
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

function copyFile(sourcePath, targetPath) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
}

function isInside(parent, child) {
    const relative = path.relative(parent, child);
    return (
        relative === "" ||
        (!relative.startsWith("..") && !path.isAbsolute(relative))
    );
}

function prepareOutputDir(outputDir, clean) {
    const safeCleanRoot = path.resolve(repoRoot, "output/translation-assets");
    if (clean && fs.existsSync(outputDir)) {
        if (!isInside(safeCleanRoot, outputDir)) {
            throw new Error(
                `Refusing to clean ${outputDir}; pass an output inside output/translation-assets or use --no-clean.`,
            );
        }
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
}

function validateBeforeImport(inputDir, groups) {
    const args = [
        path.join("scripts/i18n/validate-translation-assets.mjs"),
        "--input",
        fromRoot(inputDir),
        "--max-examples",
        "0",
    ];
    if (groups.length !== allAssetGroups.length) {
        args.push("--only", groups.join(","));
    }

    execFileSync("node", args, {
        cwd: repoRoot,
        stdio: "pipe",
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
    });
}

function localeMetadata(manifest, localeCode) {
    return (
        manifest.locales?.find((locale) => locale.code === localeCode) ?? null
    );
}

function targetLocalesFor(manifest, requestedLocales) {
    const targets = requestedLocales ?? manifest.targetLocales ?? [];
    const known = new Set(
        (manifest.locales ?? []).map((locale) => locale.code),
    );
    const unknown = targets.filter((locale) => !known.has(locale));
    if (unknown.length > 0) {
        throw new Error(
            `Unknown locale(s) for this bundle: ${unknown.join(", ")}`,
        );
    }
    return targets.filter((locale) => locale !== sourceLocale);
}

function isArrayIndex(segment) {
    return /^\d+$/.test(segment);
}

function setNested(root, dottedPath, value) {
    const parts = dottedPath.split(".");
    let cursor = root;

    for (let index = 0; index < parts.length; index += 1) {
        const part = parts[index];
        const key = isArrayIndex(part) ? Number(part) : part;
        const isLast = index === parts.length - 1;

        if (isLast) {
            cursor[key] = value;
            return;
        }

        const nextPart = parts[index + 1];
        if (cursor[key] === undefined || cursor[key] === null) {
            cursor[key] = isArrayIndex(nextPart) ? [] : {};
        }
        cursor = cursor[key];
    }
}

function clone(value) {
    return JSON.parse(JSON.stringify(value ?? {}));
}

function rowsForLocale(inputDir, group, locale) {
    const rowsPath = path.join(inputDir, group, "messages.json");
    const rows = maybeReadJson(rowsPath, []);
    return rows.filter((row) => row.target_locale === locale);
}

function mergeMessagesIntoLocalePayload(basePayload, rows) {
    const payload = clone(basePayload);
    let importedRows = 0;
    let missingRows = 0;

    for (const row of rows) {
        if (!row.target_text) {
            missingRows += 1;
            continue;
        }

        if (!payload[row.namespace]) {
            payload[row.namespace] = {};
        }
        setNested(payload[row.namespace], row.key, row.target_text);
        importedRows += 1;
    }

    return { payload, importedRows, missingRows };
}

function importJsonResourceGroup({
    inputDir,
    outputDir,
    group,
    locales,
    apply,
    sourceDestination,
}) {
    const summary = {
        locales: {},
        previewFiles: [],
        appliedFiles: [],
        applySupported: Boolean(sourceDestination),
    };

    for (const locale of locales) {
        const basePath = path.join(
            inputDir,
            group,
            "locales",
            `${locale}.json`,
        );
        const basePayload = maybeReadJson(basePath, {});
        const rows = rowsForLocale(inputDir, group, locale);
        const { payload, importedRows, missingRows } =
            mergeMessagesIntoLocalePayload(basePayload, rows);
        const previewPath = path.join(
            outputDir,
            group,
            "locales",
            `${locale}.json`,
        );
        writeJson(previewPath, payload);

        summary.previewFiles.push(fromRoot(previewPath));
        summary.locales[locale] = {
            importedRows,
            missingRows,
            previewPath: fromRoot(previewPath),
            appliedPaths: [],
        };

        if (apply && sourceDestination) {
            const appliedPaths = sourceDestination(locale, payload).map(
                (item) => {
                    writeJson(item.path, item.payload);
                    return fromRoot(item.path);
                },
            );
            summary.appliedFiles.push(...appliedPaths);
            summary.locales[locale].appliedPaths = appliedPaths;
        }
    }

    return summary;
}

function importHelp({ inputDir, outputDir, locales, apply }) {
    const summary = {
        locales: {},
        previewFiles: [],
        appliedFiles: [],
        applySupported: true,
    };

    for (const locale of locales) {
        const basePath = path.join(
            inputDir,
            "help",
            "locales",
            `${locale}.json`,
        );
        const basePayload = maybeReadJson(basePath, {});
        const rows = rowsForLocale(inputDir, "help", locale);
        const { payload, importedRows, missingRows } =
            mergeMessagesIntoLocalePayload(basePayload, rows);
        const topics = Object.entries(payload).filter(([, topicPayload]) => {
            return topicPayload && Object.keys(topicPayload).length > 0;
        });
        const previewPaths = [];
        const appliedPaths = [];

        for (const [topic, topicPayload] of topics) {
            const previewPath = path.join(
                outputDir,
                "help",
                locale,
                `${topic}.json`,
            );
            writeJson(previewPath, topicPayload);
            previewPaths.push(fromRoot(previewPath));

            if (apply) {
                const sourcePath = path.join(
                    repoRoot,
                    "backend/resources/help",
                    locale,
                    `${topic}.json`,
                );
                writeJson(sourcePath, topicPayload);
                appliedPaths.push(fromRoot(sourcePath));
            }
        }

        summary.previewFiles.push(...previewPaths);
        summary.appliedFiles.push(...appliedPaths);
        summary.locales[locale] = {
            importedRows,
            missingRows,
            topicCount: topics.length,
            previewPaths,
            appliedPaths,
        };
    }

    return summary;
}

function listFiles(rootDir) {
    if (!fs.existsSync(rootDir)) return [];
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const entryPath = path.join(rootDir, entry.name);
        if (entry.isDirectory()) {
            return listFiles(entryPath);
        }
        return [entryPath];
    });
}

function docusaurusDestination(docusaurusLocale, kind, relativePath) {
    if (kind === "docs") {
        return path.join(
            repoRoot,
            "docs/site/i18n",
            docusaurusLocale,
            "docusaurus-plugin-content-docs/current",
            relativePath,
        );
    }

    return path.join(
        repoRoot,
        "docs/site/i18n",
        docusaurusLocale,
        "docusaurus-plugin-content-blog",
        relativePath,
    );
}

function importDocusaurus({ inputDir, outputDir, manifest, locales, apply }) {
    const summary = {
        locales: {},
        previewFiles: [],
        appliedFiles: [],
        applySupported: true,
        dropoffConvention:
            "Place reviewed MD/MDX at docusaurus/translated/{docusaurusLocale}/{docs|blog}/** before import.",
    };

    for (const locale of locales) {
        const metadata = localeMetadata(manifest, locale);
        const docusaurusLocale = metadata?.docusaurusLocale;
        if (!docusaurusLocale) {
            summary.locales[locale] = {
                importedFiles: 0,
                missingLocaleMetadata: true,
                previewPaths: [],
                appliedPaths: [],
            };
            continue;
        }

        const translatedRoot = path.join(
            inputDir,
            "docusaurus/translated",
            docusaurusLocale,
        );
        const translatedFiles = [
            ...listFiles(path.join(translatedRoot, "docs")).map((filePath) => ({
                kind: "docs",
                filePath,
                relativePath: toPosix(
                    path.relative(path.join(translatedRoot, "docs"), filePath),
                ),
            })),
            ...listFiles(path.join(translatedRoot, "blog")).map((filePath) => ({
                kind: "blog",
                filePath,
                relativePath: toPosix(
                    path.relative(path.join(translatedRoot, "blog"), filePath),
                ),
            })),
        ];
        const previewPaths = [];
        const appliedPaths = [];

        for (const item of translatedFiles) {
            const previewPath = path.join(
                outputDir,
                "docusaurus/i18n",
                docusaurusLocale,
                item.kind,
                item.relativePath,
            );
            copyFile(item.filePath, previewPath);
            previewPaths.push(fromRoot(previewPath));

            if (apply) {
                const destinationPath = docusaurusDestination(
                    docusaurusLocale,
                    item.kind,
                    item.relativePath,
                );
                copyFile(item.filePath, destinationPath);
                appliedPaths.push(fromRoot(destinationPath));
            }
        }

        const dropoffPlan = {
            locale,
            docusaurusLocale,
            docsDropoff: toPosix(
                path.relative(repoRoot, path.join(translatedRoot, "docs")),
            ),
            blogDropoff: toPosix(
                path.relative(repoRoot, path.join(translatedRoot, "blog")),
            ),
            docsDestination:
                `docs/site/i18n/${docusaurusLocale}/` +
                "docusaurus-plugin-content-docs/current/**",
            blogDestination:
                `docs/site/i18n/${docusaurusLocale}/` +
                "docusaurus-plugin-content-blog/**",
        };
        const planPath = path.join(
            outputDir,
            "docusaurus",
            `${locale}-dropoff-plan.json`,
        );
        writeJson(planPath, dropoffPlan);
        previewPaths.push(fromRoot(planPath));

        summary.previewFiles.push(...previewPaths);
        summary.appliedFiles.push(...appliedPaths);
        summary.locales[locale] = {
            docusaurusLocale,
            importedFiles: translatedFiles.length,
            previewPaths,
            appliedPaths,
        };
    }

    return summary;
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const inputDir = resolveFromRoot(options.input);
    const outputDir = resolveFromRoot(options.output);
    const manifestPath = path.join(inputDir, "manifest.json");
    const manifest = maybeReadJson(manifestPath);

    if (!manifest) {
        throw new Error(
            `${manifestPath} is missing. Run i18n:export-assets first.`,
        );
    }

    const groups = options.only ?? manifest.assetGroups ?? allAssetGroups;
    const locales = targetLocalesFor(manifest, options.locales);
    prepareOutputDir(outputDir, options.clean);

    if (!options.skipValidation) {
        validateBeforeImport(inputDir, groups);
    }

    const report = {
        generatedAt: new Date().toISOString(),
        mode: options.apply ? "apply" : "dry-run",
        inputRoot: fromRoot(inputDir),
        outputRoot: fromRoot(outputDir),
        sourceLocale: manifest.sourceLocale ?? sourceLocale,
        targetLocales: locales,
        groups,
        validation: options.skipValidation ? "skipped" : "passed",
        summaries: {},
    };

    if (groups.includes("frontend")) {
        report.summaries.frontend = importJsonResourceGroup({
            inputDir,
            outputDir,
            group: "frontend",
            locales,
            apply: false,
            sourceDestination: null,
        });
    }

    if (groups.includes("backend")) {
        report.summaries.backend = importJsonResourceGroup({
            inputDir,
            outputDir,
            group: "backend",
            locales,
            apply: false,
            sourceDestination: null,
        });
    }

    if (groups.includes("help")) {
        report.summaries.help = importHelp({
            inputDir,
            outputDir,
            locales,
            apply: options.apply,
        });
    }

    if (groups.includes("docusaurus")) {
        report.summaries.docusaurus = importDocusaurus({
            inputDir,
            outputDir,
            manifest,
            locales,
            apply: options.apply,
        });
    }

    const reportPath = path.join(outputDir, "import-report.json");
    writeJson(reportPath, report);

    console.log(
        `translation asset import ${report.mode}: ${report.inputRoot} -> ${report.outputRoot}`,
    );
    console.log(`  locales: ${locales.join(", ")}`);
    console.log(`  validation: ${report.validation}`);
    for (const [group, summary] of Object.entries(report.summaries)) {
        const previewCount = summary.previewFiles?.length ?? 0;
        const appliedCount = summary.appliedFiles?.length ?? 0;
        console.log(
            `  ${group}: ${previewCount} preview file(s), ${appliedCount} applied file(s)`,
        );
    }
    console.log(`  report: ${fromRoot(reportPath)}`);
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
