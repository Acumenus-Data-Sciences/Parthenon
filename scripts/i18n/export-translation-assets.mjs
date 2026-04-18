#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const frontendRoot = path.join(repoRoot, "frontend");
const backendRoot = path.join(repoRoot, "backend");
const docsSiteRoot = path.join(repoRoot, "docs/site");
const sourceLocale = "en-US";
const defaultOutput = "output/translation-assets/latest";
const allAssetGroups = ["frontend", "backend", "help", "docusaurus"];
const backendNamespacesPausedForActiveDevelopment = new Set(["finngen"]);

const rootRequire = createRequire(import.meta.url);
const frontendRequire = createRequire(path.join(frontendRoot, "package.json"));
const tsModuleCache = new Map();

function usage() {
    return [
        "Usage: node scripts/i18n/export-translation-assets.mjs [options]",
        "",
        "Options:",
        `  --output <dir>        Output directory, default ${defaultOutput}`,
        "  --locales <list>      Comma-separated locale codes, default public selectable locales",
        "  --only <list>         Comma-separated groups: frontend,backend,help,docusaurus",
        "  --no-clean           Do not remove the output directory first",
        "  --help               Show this help",
    ].join("\n");
}

function parseArgs(argv) {
    const options = {
        output: defaultOutput,
        locales: null,
        only: new Set(allAssetGroups),
        clean: true,
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
        } else if (arg === "--only" && argv[index + 1]) {
            options.only = new Set(argv[index + 1].split(",").filter(Boolean));
            index += 1;
        } else if (arg.startsWith("--only=")) {
            options.only = new Set(
                arg.slice("--only=".length).split(",").filter(Boolean),
            );
        } else if (arg === "--no-clean") {
            options.clean = false;
        } else {
            throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
        }
    }

    const unknownGroups = [...options.only].filter(
        (item) => !allAssetGroups.includes(item),
    );
    if (unknownGroups.length > 0) {
        throw new Error(`Unknown asset group(s): ${unknownGroups.join(", ")}`);
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

function makeWriter(outputDir) {
    function absolute(relativePath) {
        return path.join(outputDir, relativePath);
    }

    return {
        writeJson(relativePath, value) {
            const target = absolute(relativePath);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
            return toPosix(path.relative(outputDir, target));
        },
        writeText(relativePath, value) {
            const target = absolute(relativePath);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, value);
            return toPosix(path.relative(outputDir, target));
        },
        copyFile(sourcePath, relativePath) {
            const target = absolute(relativePath);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(sourcePath, target);
            return toPosix(path.relative(outputDir, target));
        },
    };
}

function loadTypeScript() {
    try {
        return rootRequire("typescript");
    } catch {
        return frontendRequire("typescript");
    }
}

const ts = loadTypeScript();

function loadTsModule(filename) {
    const absolutePath = path.resolve(filename);
    const cached = tsModuleCache.get(absolutePath);
    if (cached) return cached.exports;

    const source = fs
        .readFileSync(absolutePath, "utf8")
        .replaceAll("import.meta.env.DEV", "false")
        .replaceAll("import.meta.env.VITE_I18N_SHOW_QA_LOCALES", "undefined");
    const compiled = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
            importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
        },
        fileName: absolutePath,
    }).outputText;

    const module = { exports: {} };
    tsModuleCache.set(absolutePath, module);
    const nodeRequire = createRequire(absolutePath);
    const localRequire = (specifier) => {
        if (specifier.startsWith(".") || specifier.startsWith("/")) {
            const basePath = specifier.startsWith(".")
                ? path.resolve(path.dirname(absolutePath), specifier)
                : specifier;
            const candidates = path.extname(basePath)
                ? [basePath]
                : [
                      `${basePath}.ts`,
                      `${basePath}.tsx`,
                      `${basePath}.js`,
                      path.join(basePath, "index.ts"),
                      path.join(basePath, "index.tsx"),
                      path.join(basePath, "index.js"),
                  ];
            const tsCandidate = candidates.find(
                (candidate) =>
                    /\.(ts|tsx)$/.test(candidate) && fs.existsSync(candidate),
            );

            if (tsCandidate) return loadTsModule(tsCandidate);
        }

        return nodeRequire(specifier);
    };
    localRequire.resolve = nodeRequire.resolve;

    const fn = new Function(
        "exports",
        "require",
        "module",
        "__filename",
        "__dirname",
        compiled,
    );
    fn(
        module.exports,
        localRequire,
        module,
        absolutePath,
        path.dirname(absolutePath),
    );
    return module.exports;
}

function flatten(value, prefix = "") {
    if (value === null || value === undefined) return [];

    if (Array.isArray(value)) {
        return value.flatMap((item, index) =>
            flatten(item, prefix ? `${prefix}.${index}` : String(index)),
        );
    }

    if (typeof value === "object") {
        return Object.entries(value).flatMap(([key, child]) =>
            flatten(child, prefix ? `${prefix}.${key}` : key),
        );
    }

    return [[prefix, String(value)]];
}

function flatMapFor(value) {
    return new Map(flatten(value));
}

function wordCount(text) {
    const normalized = String(text ?? "")
        .replace(/[`*_#[\]()>-]/g, " ")
        .trim();
    if (!normalized) return 0;
    return normalized.split(/\s+/).filter(Boolean).length;
}

function placeholdersFor(text) {
    const matches = String(text ?? "").match(
        /{{\s*[\w.]+\s*}}|:[A-Za-z_][\w.]*|%[sdif]/g,
    );
    return [...new Set(matches ?? [])].sort();
}

function csvCell(value) {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) {
        return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
}

function toCsv(rows, columns) {
    return (
        [
            columns.join(","),
            ...rows.map((row) =>
                columns.map((column) => csvCell(row[column])).join(","),
            ),
        ].join("\n") + "\n"
    );
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listFiles(rootDir, predicate) {
    if (!fs.existsSync(rootDir)) return [];
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const entryPath = path.join(rootDir, entry.name);
        if (entry.isDirectory()) {
            if (
                entry.name === "node_modules" ||
                entry.name === "build" ||
                entry.name === ".docusaurus" ||
                entry.name === ".git"
            ) {
                return [];
            }
            return listFiles(entryPath, predicate);
        }
        return predicate(entryPath, entry.name) ? [entryPath] : [];
    });
}

function listDirectJsonFiles(rootDir) {
    if (!fs.existsSync(rootDir)) return [];
    return fs
        .readdirSync(rootDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => path.join(rootDir, entry.name))
        .sort();
}

function loadLocaleRegistry() {
    const localesModule = loadTsModule(
        path.join(frontendRoot, "src/i18n/locales.ts"),
    );
    return {
        defaultLocale: localesModule.DEFAULT_LOCALE,
        supportedLocales: localesModule.SUPPORTED_LOCALES.map((locale) => ({
            ...locale,
        })),
        publicSelectableLocales: localesModule.PUBLIC_SELECTABLE_LOCALES.map(
            (locale) => ({ ...locale }),
        ),
    };
}

function resolveSelectedLocales(registry, requestedLocales) {
    const byCode = new Map(
        registry.supportedLocales.map((locale) => [locale.code, locale]),
    );
    const selectedCodes =
        requestedLocales ??
        registry.publicSelectableLocales.map((locale) => locale.code);

    if (!selectedCodes.includes(sourceLocale)) {
        selectedCodes.unshift(sourceLocale);
    }

    const selected = [];
    for (const code of selectedCodes) {
        const locale = byCode.get(code);
        if (!locale) throw new Error(`Unsupported locale: ${code}`);
        if (!selected.some((item) => item.code === locale.code)) {
            selected.push(locale);
        }
    }

    return selected;
}

function localeManifest(locales) {
    return locales.map((locale) => ({
        code: locale.code,
        label: locale.label,
        nativeLabel: locale.nativeLabel,
        direction: locale.direction,
        laravelLocale: locale.laravelLocale,
        docusaurusLocale: locale.docusaurusLocale,
        releaseTier: locale.releaseTier,
        selectable: locale.selectable,
        qaOnly: Boolean(locale.qaOnly),
    }));
}

function exportFrontend({ writer, locales }) {
    const resourcesModule = loadTsModule(
        path.join(frontendRoot, "src/i18n/resources.ts"),
    );
    const resources = resourcesModule.resources;
    const namespaces = resourcesModule.namespaces;
    const sourceResources = resources[sourceLocale] ?? {};
    const targetLocales = locales.filter(
        (locale) => locale.code !== sourceLocale,
    );
    const rows = [];
    const namespaceSummaries = [];

    for (const locale of locales) {
        writer.writeJson(
            `frontend/locales/${locale.code}.json`,
            resources[locale.code] ?? {},
        );
    }

    for (const namespace of namespaces) {
        const sourceMap = flatMapFor(sourceResources[namespace] ?? {});
        const targetMaps = new Map(
            targetLocales.map((locale) => [
                locale.code,
                flatMapFor(resources[locale.code]?.[namespace] ?? {}),
            ]),
        );
        const missingByLocale = Object.fromEntries(
            targetLocales.map((locale) => [locale.code, 0]),
        );

        for (const [key, sourceText] of sourceMap.entries()) {
            for (const locale of targetLocales) {
                const targetText = targetMaps.get(locale.code)?.get(key) ?? "";
                const status = targetText ? "ready" : "missing";
                if (status === "missing") missingByLocale[locale.code] += 1;
                rows.push({
                    asset_id: `frontend.${namespace}.${key}`,
                    area: "frontend",
                    source_path: "frontend/src/i18n/resources.ts",
                    namespace,
                    key,
                    source_locale: sourceLocale,
                    target_locale: locale.code,
                    source_text: sourceText,
                    target_text: targetText,
                    status,
                    placeholders: placeholdersFor(sourceText).join(" "),
                    notes: "i18next resource key",
                });
            }
        }

        namespaceSummaries.push({
            namespace,
            sourceKeyCount: sourceMap.size,
            missingByLocale,
        });
    }

    const columns = [
        "asset_id",
        "area",
        "source_path",
        "namespace",
        "key",
        "source_locale",
        "target_locale",
        "source_text",
        "target_text",
        "status",
        "placeholders",
        "notes",
    ];

    writer.writeJson("frontend/messages.json", rows);
    writer.writeText("frontend/messages.csv", toCsv(rows, columns));
    writer.writeJson("frontend/manifest.json", {
        sourceLocale,
        targetLocales: targetLocales.map((locale) => locale.code),
        localeFiles: locales.map(
            (locale) => `frontend/locales/${locale.code}.json`,
        ),
        namespaceCount: namespaces.length,
        namespaces: namespaceSummaries,
    });

    return {
        namespaceCount: namespaces.length,
        sourceKeyCount: namespaceSummaries.reduce(
            (total, item) => total + item.sourceKeyCount,
            0,
        ),
        rowCount: rows.length,
        files: [
            "frontend/manifest.json",
            "frontend/messages.json",
            "frontend/messages.csv",
            ...locales.map((locale) => `frontend/locales/${locale.code}.json`),
        ],
    };
}

function loadPhpLangDirectory(directory) {
    if (!fs.existsSync(directory)) return {};
    const php = `
$directory = $argv[1];
$out = [];
foreach ((glob($directory . DIRECTORY_SEPARATOR . "*.php") ?: []) as $file) {
    $key = pathinfo($file, PATHINFO_FILENAME);
    $value = include $file;
    if (is_array($value)) {
        $out[$key] = $value;
    }
}
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
`;
    const output = execFileSync("php", ["-r", php, directory], {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
    });
    return JSON.parse(output || "{}");
}

function exportBackend({ writer, locales }) {
    const localePayloads = new Map();
    const targetLocales = locales.filter(
        (locale) => locale.code !== sourceLocale,
    );

    for (const locale of locales) {
        const localeDirectory = path.join(
            backendRoot,
            "lang",
            locale.laravelLocale,
        );
        const payload = loadPhpLangDirectory(localeDirectory);
        for (const namespace of backendNamespacesPausedForActiveDevelopment) {
            delete payload[namespace];
        }
        localePayloads.set(locale.code, payload);
        writer.writeJson(`backend/locales/${locale.code}.json`, payload);
    }

    const sourcePayload = localePayloads.get(sourceLocale) ?? {};
    const namespaces = Object.keys(sourcePayload).sort();
    const rows = [];
    const namespaceSummaries = [];
    const sourceLaravelLocale =
        locales.find((item) => item.code === sourceLocale)?.laravelLocale ??
        "en";

    for (const namespace of namespaces) {
        const sourceMap = flatMapFor(sourcePayload[namespace] ?? {});
        const missingByLocale = Object.fromEntries(
            targetLocales.map((locale) => [locale.code, 0]),
        );

        for (const [key, sourceText] of sourceMap.entries()) {
            for (const locale of targetLocales) {
                const targetPayload = localePayloads.get(locale.code) ?? {};
                const targetText =
                    flatMapFor(targetPayload[namespace] ?? {}).get(key) ?? "";
                const status = targetText ? "ready" : "missing";
                if (status === "missing") missingByLocale[locale.code] += 1;
                rows.push({
                    asset_id: `backend.${namespace}.${key}`,
                    area: "backend",
                    source_path: `backend/lang/${sourceLaravelLocale}/${namespace}.php`,
                    namespace,
                    key,
                    source_locale: sourceLocale,
                    target_locale: locale.code,
                    source_text: sourceText,
                    target_text: targetText,
                    status,
                    placeholders: placeholdersFor(sourceText).join(" "),
                    notes: "Laravel lang array",
                });
            }
        }

        namespaceSummaries.push({
            namespace,
            sourceKeyCount: sourceMap.size,
            missingByLocale,
        });
    }

    const columns = [
        "asset_id",
        "area",
        "source_path",
        "namespace",
        "key",
        "source_locale",
        "target_locale",
        "source_text",
        "target_text",
        "status",
        "placeholders",
        "notes",
    ];

    writer.writeJson("backend/messages.json", rows);
    writer.writeText("backend/messages.csv", toCsv(rows, columns));
    writer.writeJson("backend/manifest.json", {
        sourceLocale,
        targetLocales: targetLocales.map((locale) => locale.code),
        localeFiles: locales.map(
            (locale) => `backend/locales/${locale.code}.json`,
        ),
        excludedNamespaces: [...backendNamespacesPausedForActiveDevelopment],
        namespaceCount: namespaces.length,
        namespaces: namespaceSummaries,
    });

    return {
        namespaceCount: namespaces.length,
        sourceKeyCount: namespaceSummaries.reduce(
            (total, item) => total + item.sourceKeyCount,
            0,
        ),
        rowCount: rows.length,
        excludedNamespaces: [...backendNamespacesPausedForActiveDevelopment],
        files: [
            "backend/manifest.json",
            "backend/messages.json",
            "backend/messages.csv",
            ...locales.map((locale) => `backend/locales/${locale.code}.json`),
        ],
    };
}

function loadHelpLocale(localeCode) {
    const root = path.join(backendRoot, "resources/help");
    const directory =
        localeCode === sourceLocale ? root : path.join(root, localeCode);
    const payload = {};

    for (const filePath of listDirectJsonFiles(directory)) {
        const key = path.basename(filePath, ".json");
        payload[key] = readJson(filePath);
    }

    return payload;
}

function isTranslatableHelpKey(key) {
    const lastSegment = key.split(".").at(-1);
    return !new Set(["key", "docs_url", "video_url", "url", "href"]).has(
        lastSegment,
    );
}

function exportHelp({ writer, locales }) {
    const localePayloads = new Map();
    const targetLocales = locales.filter(
        (locale) => locale.code !== sourceLocale,
    );

    for (const locale of locales) {
        const payload = loadHelpLocale(locale.code);
        localePayloads.set(locale.code, payload);
        writer.writeJson(`help/locales/${locale.code}.json`, payload);
    }

    const sourcePayload = localePayloads.get(sourceLocale) ?? {};
    const topics = Object.keys(sourcePayload).sort();
    const rows = [];
    const topicSummaries = [];

    for (const topic of topics) {
        const sourceMap = new Map(
            flatten(sourcePayload[topic] ?? {}).filter(
                ([key, value]) => isTranslatableHelpKey(key) && value.trim(),
            ),
        );
        const missingByLocale = Object.fromEntries(
            targetLocales.map((locale) => [locale.code, 0]),
        );

        for (const [key, sourceText] of sourceMap.entries()) {
            for (const locale of targetLocales) {
                const targetPayload = localePayloads.get(locale.code) ?? {};
                const targetText =
                    flatMapFor(targetPayload[topic] ?? {}).get(key) ?? "";
                const status = targetText ? "ready" : "missing";
                if (status === "missing") missingByLocale[locale.code] += 1;
                rows.push({
                    asset_id: `help.${topic}.${key}`,
                    area: "help",
                    source_path: `backend/resources/help/${topic}.json`,
                    namespace: topic,
                    key,
                    source_locale: sourceLocale,
                    target_locale: locale.code,
                    source_text: sourceText,
                    target_text: targetText,
                    status,
                    placeholders: placeholdersFor(sourceText).join(" "),
                    notes: "Contextual help JSON",
                });
            }
        }

        topicSummaries.push({
            topic,
            sourceKeyCount: sourceMap.size,
            missingByLocale,
        });
    }

    const columns = [
        "asset_id",
        "area",
        "source_path",
        "namespace",
        "key",
        "source_locale",
        "target_locale",
        "source_text",
        "target_text",
        "status",
        "placeholders",
        "notes",
    ];

    writer.writeJson("help/messages.json", rows);
    writer.writeText("help/messages.csv", toCsv(rows, columns));
    writer.writeJson("help/manifest.json", {
        sourceLocale,
        targetLocales: targetLocales.map((locale) => locale.code),
        localeFiles: locales.map(
            (locale) => `help/locales/${locale.code}.json`,
        ),
        topicCount: topics.length,
        topics: topicSummaries,
        nonTranslatableFields: ["key", "docs_url", "video_url", "url", "href"],
    });

    return {
        topicCount: topics.length,
        sourceKeyCount: topicSummaries.reduce(
            (total, item) => total + item.sourceKeyCount,
            0,
        ),
        rowCount: rows.length,
        files: [
            "help/manifest.json",
            "help/messages.json",
            "help/messages.csv",
            ...locales.map((locale) => `help/locales/${locale.code}.json`),
        ],
    };
}

function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!match) return {};

    const values = {};
    for (const line of match[1].split(/\r?\n/)) {
        const item = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (!item) continue;
        values[item[1]] = item[2].replace(/^["']|["']$/g, "");
    }
    return values;
}

function firstHeading(content) {
    const match = content.match(/^#\s+(.+)$/m);
    return match?.[1]?.replaceAll("*", "").trim() ?? "";
}

function mdxStats(content) {
    const withoutFrontmatter = content.replace(
        /^---\r?\n[\s\S]*?\r?\n---\r?\n/,
        "",
    );
    const codeFenceCount = (withoutFrontmatter.match(/```/g) ?? []).length / 2;
    const importCount = (withoutFrontmatter.match(/^import\s.+$/gm) ?? [])
        .length;
    const exportCount = (withoutFrontmatter.match(/^export\s.+$/gm) ?? [])
        .length;
    const jsxTagCount = (
        withoutFrontmatter.match(/<\/?[A-Z][A-Za-z0-9.]*/g) ?? []
    ).length;
    const mermaidFenceCount = (withoutFrontmatter.match(/```\s*mermaid/g) ?? [])
        .length;
    const prose = withoutFrontmatter
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
        .replace(/[`*_#>|-]/g, " ");

    return {
        wordCount: wordCount(prose),
        codeFenceCount,
        importCount,
        exportCount,
        jsxTagCount,
        mermaidFenceCount,
    };
}

function docusaurusDocumentRecord({ kind, filePath, sourceRoot, outputPath }) {
    const content = fs.readFileSync(filePath, "utf8");
    const frontmatter = parseFrontmatter(content);
    const stats = mdxStats(content);
    const relativePath = toPosix(path.relative(sourceRoot, filePath));

    return {
        asset_id: `docusaurus.${kind}.${relativePath}`,
        kind,
        source_path: fromRoot(filePath),
        output_path: outputPath,
        relative_path: relativePath,
        format: path.extname(filePath).slice(1),
        title: frontmatter.title || firstHeading(content),
        slug: frontmatter.slug ?? "",
        id: frontmatter.id ?? "",
        description: frontmatter.description ?? "",
        has_frontmatter: Object.keys(frontmatter).length > 0 ? "yes" : "no",
        word_count: stats.wordCount,
        code_fences: stats.codeFenceCount,
        mermaid_fences: stats.mermaidFenceCount,
        imports: stats.importCount,
        exports: stats.exportCount,
        jsx_tags: stats.jsxTagCount,
    };
}

function exportDocusaurus({ writer, locales }) {
    const docsRoot = path.join(docsSiteRoot, "docs");
    const blogRoot = path.join(repoRoot, "docs/blog");
    const docsFiles = listFiles(docsRoot, (filePath, fileName) =>
        /\.(md|mdx)$/.test(fileName),
    ).sort();
    const blogFiles = listFiles(blogRoot, (filePath, fileName) => {
        if (!/\.mdx?$/.test(fileName)) return false;
        return !["README.md", "community-post.md"].includes(fileName);
    }).sort();
    const records = [];

    for (const filePath of docsFiles) {
        const relativePath = toPosix(path.relative(docsRoot, filePath));
        const outputPath = writer.copyFile(
            filePath,
            `docusaurus/mdx/docs/${relativePath}`,
        );
        records.push(
            docusaurusDocumentRecord({
                kind: "docs",
                filePath,
                sourceRoot: docsRoot,
                outputPath,
            }),
        );
    }

    for (const filePath of blogFiles) {
        const relativePath = toPosix(path.relative(blogRoot, filePath));
        const outputPath = writer.copyFile(
            filePath,
            `docusaurus/mdx/blog/${relativePath}`,
        );
        records.push(
            docusaurusDocumentRecord({
                kind: "blog",
                filePath,
                sourceRoot: blogRoot,
                outputPath,
            }),
        );
    }

    const sidebarsSource = path.join(docsSiteRoot, "sidebars.ts");
    const configSource = path.join(docsSiteRoot, "docusaurus.config.ts");
    const versionsSource = path.join(docsSiteRoot, "versions.json");
    const sourceFiles = [
        writer.copyFile(configSource, "docusaurus/source/docusaurus.config.ts"),
        writer.copyFile(sidebarsSource, "docusaurus/source/sidebars.ts"),
    ];
    if (fs.existsSync(versionsSource)) {
        sourceFiles.push(
            writer.copyFile(versionsSource, "docusaurus/source/versions.json"),
        );
    }

    const docusaurusLocales = locales.map((locale) => ({
        parthenonLocale: locale.code,
        docusaurusLocale: locale.docusaurusLocale,
        direction: locale.direction,
        htmlLang: locale.code,
    }));
    const columns = [
        "asset_id",
        "kind",
        "source_path",
        "output_path",
        "relative_path",
        "format",
        "title",
        "slug",
        "id",
        "description",
        "has_frontmatter",
        "word_count",
        "code_fences",
        "mermaid_fences",
        "imports",
        "exports",
        "jsx_tags",
    ];

    writer.writeJson("docusaurus/documents.json", records);
    writer.writeText("docusaurus/documents.csv", toCsv(records, columns));
    writer.writeJson("docusaurus/locales.json", docusaurusLocales);
    writer.writeJson("docusaurus/protection-notes.json", {
        preserve: [
            "frontmatter keys, id values, and slug values",
            "MDX imports and exports",
            "JSX component names and non-copy props",
            "code fences, Mermaid diagrams, SQL, JSON, PHP, and shell snippets",
            "OpenAPI paths, methods, field names, enum values, and examples",
            "link targets and in-app help anchors unless a redirect map exists",
        ],
        translate: [
            "page titles and descriptions",
            "headings and prose",
            "admonition prose",
            "table prose",
            "alt text and documentation chrome",
        ],
    });
    writer.writeJson("docusaurus/manifest.json", {
        sourceLocale,
        targetLocales: locales
            .filter((locale) => locale.code !== sourceLocale)
            .map((locale) => locale.code),
        docusaurusLocales,
        documentCount: records.length,
        docsCount: docsFiles.length,
        blogCount: blogFiles.length,
        copiedSourceFiles: sourceFiles,
        generatedSurfacesExcluded: [
            "docs/site/build/**",
            "docs/dist/**",
            "docs/site/.docusaurus/**",
        ],
    });

    return {
        documentCount: records.length,
        docsCount: docsFiles.length,
        blogCount: blogFiles.length,
        files: [
            "docusaurus/manifest.json",
            "docusaurus/documents.json",
            "docusaurus/documents.csv",
            "docusaurus/locales.json",
            "docusaurus/protection-notes.json",
            ...sourceFiles,
        ],
    };
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const outputDir = resolveFromRoot(options.output);
    prepareOutputDir(outputDir, options.clean);
    const writer = makeWriter(outputDir);
    const registry = loadLocaleRegistry();
    const locales = resolveSelectedLocales(registry, options.locales);
    const startedAt = new Date();
    const summaries = {};

    writer.writeJson("locales.json", localeManifest(locales));

    if (options.only.has("frontend")) {
        summaries.frontend = exportFrontend({ writer, locales });
    }
    if (options.only.has("backend")) {
        summaries.backend = exportBackend({ writer, locales });
    }
    if (options.only.has("help")) {
        summaries.help = exportHelp({ writer, locales });
    }
    if (options.only.has("docusaurus")) {
        summaries.docusaurus = exportDocusaurus({ writer, locales });
    }

    const manifest = {
        schemaVersion: 1,
        generatedAt: startedAt.toISOString(),
        sourceLocale,
        targetLocales: locales
            .filter((locale) => locale.code !== sourceLocale)
            .map((locale) => locale.code),
        locales: localeManifest(locales),
        assetGroups: [...options.only],
        outputRoot: fromRoot(outputDir),
        tmsGuidance: {
            defaultWorkflow:
                "Phrase-first, provider-neutral import/export contract",
            dataClass:
                "Class 0 product/documentation copy only; do not send PHI or tenant/user-generated content",
            reviewerGate:
                "Human review required before production release for pilot languages",
            placeholderGate:
                "Preserve i18next placeholders, Laravel placeholders, MDX structure, links, and code/API artifacts",
        },
        summaries,
    };
    writer.writeJson("manifest.json", manifest);

    console.log(`translation assets: wrote ${fromRoot(outputDir)}`);
    console.log(
        `  locales: ${locales.map((locale) => locale.code).join(", ")}`,
    );
    for (const [group, summary] of Object.entries(summaries)) {
        const count =
            summary.rowCount ??
            summary.documentCount ??
            summary.sourceKeyCount ??
            summary.namespaceCount ??
            summary.topicCount ??
            0;
        console.log(`  ${group}: ${count} item(s)`);
    }
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
