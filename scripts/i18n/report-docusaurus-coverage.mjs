#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const docsSiteRoot = path.join(repoRoot, "docs/site");
const docsRoot = path.join(docsSiteRoot, "docs");
const blogRoot = path.join(repoRoot, "docs/blog");
const defaultOutput = "output/i18n/docusaurus-coverage.json";
const ignoredDirs = new Set([".docusaurus", ".git", "build", "node_modules"]);
const sourceLocale = "en";
const defaultExcludedBlogFiles = new Set(["README.md", "community-post.md"]);

const requiredChromeFiles = [
    "code.json",
    "docusaurus-plugin-content-blog/options.json",
    "docusaurus-plugin-content-docs/current.json",
    "docusaurus-theme-classic/footer.json",
    "docusaurus-theme-classic/navbar.json",
];

function usage() {
    return [
        "Usage: node scripts/i18n/report-docusaurus-coverage.mjs [options]",
        "",
        "Options:",
        `  --output <path>           Report path, default ${defaultOutput}`,
        "  --locales <list>         Comma-separated Docusaurus locale IDs, default public docs locales except en",
        "  --fail-under-docs <n>    Fail if any locale has docs coverage below n percent",
        "  --fail-under-total <n>   Fail if any locale has docs+blog coverage below n percent",
        "  --fail-on-missing        Fail if any docs or blog translations are missing",
        "  --max-missing <n>        Console missing-file examples per locale/surface, default 12",
        "  --help                   Show this help",
    ].join("\n");
}

function parseArgs(argv) {
    const options = {
        output: defaultOutput,
        locales: null,
        failUnderDocs: null,
        failUnderTotal: null,
        failOnMissing: false,
        maxMissing: 12,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--help" || arg === "-h") {
            console.log(usage());
            process.exit(0);
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
        } else if (arg === "--fail-under-docs" && argv[index + 1]) {
            options.failUnderDocs = Number(argv[index + 1]);
            index += 1;
        } else if (arg.startsWith("--fail-under-docs=")) {
            options.failUnderDocs = Number(
                arg.slice("--fail-under-docs=".length),
            );
        } else if (arg === "--fail-under-total" && argv[index + 1]) {
            options.failUnderTotal = Number(argv[index + 1]);
            index += 1;
        } else if (arg.startsWith("--fail-under-total=")) {
            options.failUnderTotal = Number(
                arg.slice("--fail-under-total=".length),
            );
        } else if (arg === "--fail-on-missing") {
            options.failOnMissing = true;
        } else if (arg === "--max-missing" && argv[index + 1]) {
            options.maxMissing = Number(argv[index + 1]);
            index += 1;
        } else if (arg.startsWith("--max-missing=")) {
            options.maxMissing = Number(arg.slice("--max-missing=".length));
        } else {
            throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
        }
    }

    for (const [name, value] of [
        ["--fail-under-docs", options.failUnderDocs],
        ["--fail-under-total", options.failUnderTotal],
    ]) {
        if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
            throw new Error(`${name} must be a number from 0 to 100.`);
        }
    }

    if (!Number.isFinite(options.maxMissing) || options.maxMissing < 0) {
        throw new Error("--max-missing must be a non-negative number.");
    }

    return options;
}

function toPosix(filePath) {
    return filePath.split(path.sep).join("/");
}

function fromRoot(filePath) {
    return toPosix(path.relative(repoRoot, filePath));
}

function resolveFromRoot(filePath) {
    return path.isAbsolute(filePath)
        ? filePath
        : path.resolve(repoRoot, filePath);
}

function listFiles(rootDir, predicate) {
    if (!fs.existsSync(rootDir)) return [];
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const entryPath = path.join(rootDir, entry.name);
        if (entry.isDirectory()) {
            if (ignoredDirs.has(entry.name)) return [];
            return listFiles(entryPath, predicate);
        }
        return predicate(entryPath, entry.name) ? [entryPath] : [];
    });
}

function sourceDocuments() {
    const docs = listFiles(docsRoot, (_filePath, fileName) =>
        /\.mdx?$/.test(fileName),
    ).map((filePath) => ({
        kind: "docs",
        relativePath: toPosix(path.relative(docsRoot, filePath)),
        sourcePath: fromRoot(filePath),
    }));

    const blog = listFiles(blogRoot, (_filePath, fileName) => {
        if (!/\.mdx?$/.test(fileName)) return false;
        return !defaultExcludedBlogFiles.has(fileName);
    }).map((filePath) => ({
        kind: "blog",
        relativePath: toPosix(path.relative(blogRoot, filePath)),
        sourcePath: fromRoot(filePath),
    }));

    return { docs: docs.sort(byRelativePath), blog: blog.sort(byRelativePath) };
}

function byRelativePath(a, b) {
    return a.relativePath.localeCompare(b.relativePath);
}

function configuredPublicDocusaurusLocales() {
    const configPath = path.join(docsSiteRoot, "docusaurus.config.ts");
    if (!fs.existsSync(configPath)) return [];

    const config = fs.readFileSync(configPath, "utf8");
    const publicMatch = config.match(
        /publicDocusaurusLocales\s*=\s*\[([^\]]+)\]/m,
    );
    const localeList = publicMatch?.[1] ?? "";
    const locales = [...localeList.matchAll(/["']([^"']+)["']/g)].map(
        (match) => match[1],
    );

    if (locales.length > 0) {
        return locales.filter((locale) => locale !== sourceLocale);
    }

    const i18nMatch = config.match(/locales\s*:\s*\[([^\]]+)\]/m);
    const i18nList = i18nMatch?.[1] ?? "";
    return [...i18nList.matchAll(/["']([^"']+)["']/g)]
        .map((match) => match[1])
        .filter((locale) => locale !== sourceLocale);
}

function existingI18nLocales() {
    const i18nRoot = path.join(docsSiteRoot, "i18n");
    if (!fs.existsSync(i18nRoot)) return [];
    return fs
        .readdirSync(i18nRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== sourceLocale)
        .map((entry) => entry.name)
        .sort();
}

function defaultLocales() {
    const configured = configuredPublicDocusaurusLocales();
    if (configured.length > 0) return configured;
    return existingI18nLocales();
}

function translatedPathFor(locale, kind, relativePath) {
    if (kind === "docs") {
        return path.join(
            docsSiteRoot,
            "i18n",
            locale,
            "docusaurus-plugin-content-docs",
            "current",
            relativePath,
        );
    }

    return path.join(
        docsSiteRoot,
        "i18n",
        locale,
        "docusaurus-plugin-content-blog",
        relativePath,
    );
}

function coverageFor(locale, kind, records) {
    const present = [];
    const missing = [];

    for (const record of records) {
        const targetPath = translatedPathFor(locale, kind, record.relativePath);
        const item = {
            relativePath: record.relativePath,
            sourcePath: record.sourcePath,
            targetPath: fromRoot(targetPath),
        };
        if (fs.existsSync(targetPath)) present.push(item);
        else missing.push(item);
    }

    return {
        sourceCount: records.length,
        translatedCount: present.length,
        missingCount: missing.length,
        percent: percent(present.length, records.length),
        present,
        missing,
    };
}

function chromeCoverageFor(locale) {
    const root = path.join(docsSiteRoot, "i18n", locale);
    const files = requiredChromeFiles.map((relativePath) => {
        const targetPath = path.join(root, relativePath);
        return {
            relativePath,
            targetPath: fromRoot(targetPath),
            present: fs.existsSync(targetPath),
        };
    });

    return {
        requiredCount: files.length,
        presentCount: files.filter((file) => file.present).length,
        missingCount: files.filter((file) => !file.present).length,
        percent: percent(
            files.filter((file) => file.present).length,
            files.length,
        ),
        files,
    };
}

function percent(value, total) {
    if (total === 0) return 100;
    return Number(((value / total) * 100).toFixed(2));
}

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeReport(locales) {
    const sources = sourceDocuments();
    const sourceSummary = {
        docsCount: sources.docs.length,
        blogCount: sources.blog.length,
        totalCount: sources.docs.length + sources.blog.length,
        excludedBlogFiles: [...defaultExcludedBlogFiles].sort(),
    };

    const localeReports = Object.fromEntries(
        locales.map((locale) => {
            const docs = coverageFor(locale, "docs", sources.docs);
            const blog = coverageFor(locale, "blog", sources.blog);
            const totalTranslated = docs.translatedCount + blog.translatedCount;
            const totalSource = docs.sourceCount + blog.sourceCount;

            return [
                locale,
                {
                    locale,
                    docs,
                    blog,
                    total: {
                        sourceCount: totalSource,
                        translatedCount: totalTranslated,
                        missingCount:
                            docs.missingCount + blog.missingCount,
                        percent: percent(totalTranslated, totalSource),
                    },
                    chrome: chromeCoverageFor(locale),
                },
            ];
        }),
    );

    return {
        generatedAt: new Date().toISOString(),
        sourceLocale,
        locales,
        source: sourceSummary,
        localeReports,
    };
}

function printReport(report, maxMissing) {
    console.log("Docusaurus i18n coverage");
    console.log(
        `  source: ${report.source.docsCount} docs, ${report.source.blogCount} blog posts, ${report.source.totalCount} total`,
    );

    for (const locale of report.locales) {
        const item = report.localeReports[locale];
        console.log(
            `  ${locale}: docs ${item.docs.translatedCount}/${item.docs.sourceCount} (${item.docs.percent}%), blog ${item.blog.translatedCount}/${item.blog.sourceCount} (${item.blog.percent}%), total ${item.total.translatedCount}/${item.total.sourceCount} (${item.total.percent}%), chrome ${item.chrome.presentCount}/${item.chrome.requiredCount}`,
        );

        for (const [kind, coverage] of [
            ["docs", item.docs],
            ["blog", item.blog],
        ]) {
            if (coverage.missingCount === 0 || maxMissing === 0) continue;
            const examples = coverage.missing
                .slice(0, maxMissing)
                .map((missing) => missing.relativePath);
            console.log(
                `    missing ${kind}: ${examples.join(", ")}${
                    coverage.missingCount > examples.length
                        ? `, ... ${coverage.missingCount - examples.length} more`
                        : ""
                }`,
            );
        }
    }
}

function assertThresholds(report, options) {
    const failures = [];
    for (const locale of report.locales) {
        const item = report.localeReports[locale];
        if (
            options.failUnderDocs !== null &&
            item.docs.percent < options.failUnderDocs
        ) {
            failures.push(
                `${locale} docs coverage ${item.docs.percent}% is below ${options.failUnderDocs}%`,
            );
        }
        if (
            options.failUnderTotal !== null &&
            item.total.percent < options.failUnderTotal
        ) {
            failures.push(
                `${locale} total coverage ${item.total.percent}% is below ${options.failUnderTotal}%`,
            );
        }
        if (options.failOnMissing && item.total.missingCount > 0) {
            failures.push(
                `${locale} has ${item.total.missingCount} missing Docusaurus translation file(s)`,
            );
        }
    }

    if (failures.length > 0) {
        throw new Error(`Docusaurus i18n coverage failed:\n- ${failures.join("\n- ")}`);
    }
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const locales = options.locales ?? defaultLocales();
    if (locales.length === 0) {
        throw new Error(
            "No target Docusaurus locales found. Pass --locales or configure docs/site/docusaurus.config.ts.",
        );
    }

    const report = makeReport(locales);
    const outputPath = resolveFromRoot(options.output);
    writeJson(outputPath, report);
    printReport(report, options.maxMissing);
    console.log(`  report: ${fromRoot(outputPath)}`);
    assertThresholds(report, options);
}

main();
