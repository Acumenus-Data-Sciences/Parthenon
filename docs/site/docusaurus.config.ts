import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// Algolia DocSearch — configure via environment variables when an Algolia
// index is available (free for open-source/academic projects at docsearch.algolia.com).
// Falls back to the local Lunr.js search when these are not set.
const algoliaConfig =
  process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_API_KEY
    ? {
        algolia: {
          appId: process.env.ALGOLIA_APP_ID,
          apiKey: process.env.ALGOLIA_API_KEY,
          indexName: process.env.ALGOLIA_INDEX_NAME ?? "parthenon",
          contextualSearch: true,
          searchParameters: {},
        },
      }
    : {};

const config: Config = {
  title: "Parthenon",
  tagline: "Next-generation unified outcomes research platform",
  favicon: "img/favicon.ico",

  url: "http://localhost:8082",
  baseUrl: "/docs/",

  onBrokenLinks: "warn",
  onBrokenMarkdownLinks: "warn",

  markdown: {
    // Enable Mermaid diagram rendering in fenced code blocks
    mermaid: true,
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  plugins: [
    [
      "docusaurus-plugin-openapi-docs",
      {
        id: "api",
        docsPluginId: "classic",
        config: {
          parthenon: {
            specPath: process.env.DOCKER_BUILD
              ? "./openapi.yaml"
              : "../../backend/public/docs/openapi.yaml",
            outputDir: "docs/api",
            sidebarOptions: {
              groupPathsBy: "tag",
            },
          },
        },
      },
    ],
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "/",
          docItemComponent: "@theme/ApiItem",
          editUrl:
            "https://github.com/sudoshi/Parthenon/edit/main/docs/site/",
          // Versioning: uncomment the next line when cutting the first release
          // lastVersion: "current",
        },
        blog: {
          path: "../blog",
          routeBasePath: "blog",
          blogTitle: "Development Log",
          blogDescription:
            "Daily development journal for the Parthenon platform",
          showReadingTime: true,
          blogSidebarTitle: "Recent Posts",
          blogSidebarCount: 10,
          authorsMapPath: "../blog/authors.yml",
          exclude: ["README.md", "community-post.md"],
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  // themes: Mermaid + OpenAPI theme; Lunr search added when no Algolia config
  themes: [
    "@docusaurus/theme-mermaid",
    "docusaurus-theme-openapi-docs",
    ...(process.env.ALGOLIA_APP_ID
      ? []
      : [
          [
            "@easyops-cn/docusaurus-search-local",
            {
              hashed: true,
              language: ["en"],
              highlightSearchTermsOnTargetPage: true,
              explicitSearchResultPath: true,
              docsRouteBasePath: "/",
            },
          ] as [string, object],
        ]),
  ],

  themeConfig: {
    image: "img/parthenon_icon.png",
    colorMode: {
      defaultMode: "dark",
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    // Algolia search panel (only present when env vars are configured)
    ...algoliaConfig,
    navbar: {
      title: "Parthenon",
      logo: {
        alt: "Parthenon Logo",
        src: "img/parthenon_icon.png",
        srcDark: "img/parthenon_icon.png",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "userManual",
          position: "left",
          label: "User Manual",
        },
        {
          to: "/api/",
          label: "API Reference",
          position: "left",
        },
        {
          to: "/database-architecture",
          label: "DB Architecture",
          position: "left",
        },
        {
          to: "blog",
          label: "Dev Blog",
          position: "left",
        },
        {
          href: "https://github.com/sudoshi/Parthenon",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Documentation",
          items: [
            {
              label: "User Manual",
              to: "/",
            },
            {
              label: "API Reference",
              to: "/api/",
            },
            {
              label: "Migration Guide",
              to: "/migration",
            },
            {
              label: "Development Blog",
              to: "/blog",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "OHDSI Forums",
              href: "https://forums.ohdsi.org",
            },
            {
              label: "OMOP CDM",
              href: "https://ohdsi.github.io/CommonDataModel/",
            },
          ],
        },
      ],
      copyright: `Copyright \u00A9 ${new Date().getFullYear()} Acumenus Data Sciences. Built on OMOP CDM v5.4.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.oneDark,
      additionalLanguages: ["sql", "bash", "json", "php"],
    },
    mermaid: {
      theme: { light: "neutral", dark: "dark" },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
