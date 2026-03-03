import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Parthenon",
  tagline: "Next-generation unified outcomes research platform",
  favicon: "img/favicon.ico",

  url: "http://localhost:8082",
  baseUrl: "/docs/",

  onBrokenLinks: "warn",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "/",
          editUrl: "https://github.com/your-org/parthenon/edit/main/docs/site/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      "@easyops-cn/docusaurus-search-local",
      {
        hashed: true,
        language: ["en"],
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        docsRouteBasePath: "/",
      },
    ],
  ],

  themeConfig: {
    image: "img/logo.svg",
    colorMode: {
      defaultMode: "dark",
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Parthenon",
      logo: {
        alt: "Parthenon Logo",
        src: "img/logo.svg",
        srcDark: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "userManual",
          position: "left",
          label: "User Manual",
        },
        {
          href: "/docs/api",
          label: "API Reference",
          position: "left",
        },
        {
          href: "https://github.com/your-org/parthenon",
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
              href: "/docs/api",
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
      copyright: `Copyright © ${new Date().getFullYear()} Parthenon. Built on OMOP CDM v5.4.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["sql", "bash", "json", "php"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
