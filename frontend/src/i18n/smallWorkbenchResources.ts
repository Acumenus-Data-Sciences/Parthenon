type MessageTree = {
  [key: string]: string | MessageTree;
};

function mergeMessageTrees(base: MessageTree, overrides: MessageTree): MessageTree {
  return Object.fromEntries(
    Object.entries(base).map(([key, baseValue]) => {
      const overrideValue = overrides[key];
      if (
        baseValue &&
        typeof baseValue === "object" &&
        !Array.isArray(baseValue)
      ) {
        return [
          key,
          mergeMessageTrees(
            baseValue,
            overrideValue &&
              typeof overrideValue === "object" &&
              !Array.isArray(overrideValue)
              ? overrideValue
              : {},
          ),
        ];
      }

      return [key, overrideValue ?? baseValue];
    }),
  );
}

const enSmallWorkbench: MessageTree = {
  studyAgent: {
    header: {
      title: "Study Designer",
      subtitle: "AI-assisted study design powered by OHDSI StudyAgent",
    },
    tabs: {
      intent: "Study Intent",
      search: "Phenotype Search",
      recommend: "Recommendations",
      lint: "Cohort Lint",
    },
    intent: {
      title: "Describe Your Study",
      description:
        "Enter a natural language description of your study. The AI will split it into target population and outcome, then recommend phenotypes from the OHDSI library.",
      placeholder:
        "e.g., Compare the risk of heart failure in patients newly prescribed SGLT2 inhibitors vs DPP-4 inhibitors among adults with type 2 diabetes...",
      analyze: "Analyze Study Intent",
      targetPopulation: "Target Population",
      outcome: "Outcome",
    },
    recommendations: {
      title: "Recommended Phenotypes",
      score: "Score: {{value}}",
      loading: "Finding phenotype recommendations...",
      promptPrefix: "Enter a study intent on the",
      promptSuffix: "tab to get AI-ranked phenotype recommendations.",
    },
    search: {
      title: "Search Phenotype Library",
      placeholder:
        "Search for phenotypes (e.g., type 2 diabetes, heart failure, COPD)...",
      submit: "Search",
      resultsFound_one: "{{count}} result found",
      resultsFound_other: "{{count}} results found",
      noneFound: "No phenotypes found. Try a different search term.",
    },
    lint: {
      title: "Lint Cohort Definition",
      description:
        "Paste a cohort definition JSON to check for design issues like missing washout periods, empty concept sets, and inverted time windows.",
      run: "Run Lint",
      noIssuesFound: "No issues found",
      issuesFound_one: "{{count}} issue found",
      issuesFound_other: "{{count}} issues found",
      failed: "Failed to lint: Invalid JSON or server error.",
    },
  },
  phenotypeLibrary: {
    page: {
      title: "Phenotype Library",
      subtitle:
        "300+ curated OHDSI phenotype definitions - browse, filter, and import in one click",
      searchPlaceholder: "Search phenotypes by name or description...",
      allDomains: "All Domains",
      loading: "Loading...",
      clearFilters: "Clear filters",
      resultCount_one: "{{displayCount}} phenotype",
      resultCount_other: "{{displayCount}} phenotypes",
      matchingFilters: "matching filters",
    },
    detail: {
      description: "Description",
      logic: "Logic",
      noAdditionalDetails: "No additional details available.",
    },
    stats: {
      totalPhenotypes: "Total Phenotypes",
      withExpression: "With Expression",
      domainsCovered: "Domains Covered",
      imported: "Imported",
    },
    table: {
      headers: {
        name: "Name",
        domain: "Domain",
        severity: "Severity",
        tags: "Tags",
        action: "Action",
      },
      failedToLoad: "Failed to load phenotype library.",
      empty: "No phenotypes found.",
      noTags: "no tags",
    },
    actions: {
      imported: "Imported",
      import: "Import",
      importing: "Importing...",
      noExpressionAvailable: "No expression available",
      importAsCohortDefinition: "Import as cohort definition",
    },
    pagination: {
      pageOf: "Page {{page}} of {{totalPages}}",
      previous: "Previous",
      next: "Next",
    },
    domains: {
      condition: "Condition",
      drug: "Drug",
      measurement: "Measurement",
      procedure: "Procedure",
      observation: "Observation",
      device: "Device",
    },
    severities: {
      acute: "Acute",
      chronic: "Chronic",
      subacute: "Subacute",
    },
  },
  communityWorkbenchSdk: {
    page: {
      badge: "Phase 3 Demo",
      title: "Community Workbench SDK Demo",
      subtitle:
        "This sandbox page shows what an SDK-generated tool looks like inside Parthenon before domain-specific logic is wired in. It is a non-production reference implementation for community developers, partner teams, and AI coding assistants.",
      backToWorkbench: "Back To Workbench",
      openSdkDocs: "Open SDK Docs",
      loading: "Loading demo payload from Parthenon backend...",
      failed:
        "The Community Workbench SDK demo payload could not be loaded from the backend.",
    },
    serviceDescriptor: {
      title: "Sample Service Descriptor",
      description:
        "This is the discovery and availability metadata a generated tool should expose before the frontend renders the workbench surface.",
    },
    checklist: {
      title: "Integration Checklist",
      step: "Step {{index}}",
      items: {
        serviceRegistry:
          "Add a service registry entry in {{path}}.",
        toolModule:
          "Register the MCP tool module in {{path}}.",
        backendController:
          "Wire a backend controller and workbench service for validation, permissions, and persistence.",
        frontendRoute:
          "Add a frontend route and replace placeholder panels with domain-specific rendering.",
        validatePayloads:
          "Validate real payloads against the Community Workbench SDK schemas before release.",
      },
    },
    resultEnvelope: {
      title: "Sample Result Envelope",
      description:
        "SDK-generated tools should normalize their runtime diagnostics, source context, summary, and artifacts into a predictable envelope like this before rendering richer panels.",
    },
    artifacts: {
      title: "Generated Artifact Inventory",
      descriptionPrefix:
        "This demo is backed by a real generated sample scaffold at",
      descriptionSuffix: "in the repository.",
    },
  },
  workbenchLauncher: {
    page: {
      title: "Workbench",
      subtitle: "Novel capabilities and research toolsets",
    },
    sections: {
      toolsetsTitle: "Toolsets",
      toolsetsSubtitle: "Pick the workbench that fits your research question.",
      recentTitle: "Recent investigations",
      recentSubtitle: "Evidence investigations you've worked on recently.",
    },
    states: {
      loadingInvestigations: "Loading investigations...",
      emptyInvestigations: "Start your first Evidence Investigation.",
    },
    actions: {
      createInvestigation: "Create Investigation",
      newInvestigation: "New Investigation",
    },
    footer: {
      prompt: "Want to build a custom toolset?",
      link: "View the Community SDK reference",
    },
    toolsetMeta: {
      morpheus: {
        name: "Morpheus",
        tagline: "Inpatient outcomes & ICU analytics workbench",
        description:
          "ICU-focused analytics leveraging MIMIC-IV data in OMOP CDM 5.4. ABCDEF Liberation Bundle compliance, ventilator weaning prediction, sedation monitoring, and inpatient outcome research.",
      },
      sdk: {
        name: "Build a Toolset",
        tagline: "Community SDK for third-party integrations",
        description:
          "Reference implementation and SDK documentation for building custom toolsets that plug into the Parthenon Workbench. Service descriptors, result envelopes, and artifact patterns.",
      },
    },
    toolsetStatus: {
      available: "Available",
      comingSoon: "Coming Soon",
      sdkRequired: "SDK Required",
    },
    investigationStatus: {
      draft: "Draft",
      active: "Active",
      complete: "Complete",
      archived: "Archived",
    },
  },
  etl: {
    toolsPage: {
      loadingProjects: "Loading ETL projects...",
      createTitle: "Create ETL Mapping Project",
      createDescription:
        "Start mapping your source schema to the OMOP CDM. Select a source that has been profiled via the Source Profiler tab first.",
      cdmVersion: "CDM Version",
      cdm54: "OMOP CDM v5.4",
      cdm53: "OMOP CDM v5.3",
      creating: "Creating...",
      createProject: "Create Project",
      createFailed: "Failed to create project",
      emptyTitle: "Aqueduct ETL Mapping Designer",
      emptyDescription:
        'Navigate to an ingestion project and click "Open in Aqueduct" to start designing ETL mappings from your source schema to the OMOP CDM.',
    },
  },
};

const frSmallWorkbench: MessageTree = mergeMessageTrees(enSmallWorkbench, {
  etl: {
    toolsPage: {
      loadingProjects: "Chargement des projets ETL...",
      createTitle: "Creer un projet de mappage ETL",
      createDescription:
        "Commencez a mapper votre schema source vers l'OMOP CDM. Selectionnez d'abord une source profilee via l'onglet Source Profiler.",
      cdmVersion: "Version du CDM",
      creating: "Creation...",
      createProject: "Creer le projet",
      createFailed: "Echec de la creation du projet",
      emptyTitle: "Concepteur de mappage ETL Aqueduct",
      emptyDescription:
        'Accedez a un projet d\'ingestion et cliquez sur "Open in Aqueduct" pour commencer a concevoir les mappages ETL entre votre schema source et l\'OMOP CDM.',
    },
  },
});

const deSmallWorkbench: MessageTree = mergeMessageTrees(enSmallWorkbench, {
  etl: {
    toolsPage: {
      loadingProjects: "ETL-Projekte werden geladen...",
      createTitle: "ETL-Mapping-Projekt erstellen",
      createDescription:
        "Beginnen Sie damit, Ihr Quellschema dem OMOP CDM zuzuordnen. Wahlen Sie zuerst eine Quelle aus, die uber den Reiter Source Profiler profiliert wurde.",
      cdmVersion: "CDM-Version",
      creating: "Erstellen...",
      createProject: "Projekt erstellen",
      createFailed: "Projekt konnte nicht erstellt werden",
      emptyTitle: "Aqueduct ETL-Mapping-Designer",
      emptyDescription:
        'Navigieren Sie zu einem Ingestion-Projekt und klicken Sie auf "Open in Aqueduct", um mit dem Entwerfen von ETL-Zuordnungen von Ihrem Quellschema zum OMOP CDM zu beginnen.',
    },
  },
});

const ptSmallWorkbench: MessageTree = mergeMessageTrees(enSmallWorkbench, {
  etl: {
    toolsPage: {
      loadingProjects: "Carregando projetos ETL...",
      createTitle: "Criar projeto de mapeamento ETL",
      createDescription:
        "Comece a mapear seu esquema de origem para o OMOP CDM. Primeiro selecione uma origem que tenha sido perfilada pela aba Perfilador de origem.",
      cdmVersion: "Versao do CDM",
      creating: "Criando...",
      createProject: "Criar projeto",
      createFailed: "Falha ao criar o projeto",
      emptyTitle: "Designer de mapeamento ETL Aqueduct",
      emptyDescription:
        'Navegue ate um projeto de ingestao e clique em "Open in Aqueduct" para comecar a desenhar mapeamentos ETL do seu esquema de origem para o OMOP CDM.',
    },
  },
});

export const smallWorkbenchResources: Record<string, MessageTree> = {
  "en-US": enSmallWorkbench,
  "es-ES": mergeMessageTrees(enSmallWorkbench, {}),
  "fr-FR": frSmallWorkbench,
  "de-DE": deSmallWorkbench,
  "pt-BR": ptSmallWorkbench,
  "fi-FI": mergeMessageTrees(enSmallWorkbench, {}),
  "ja-JP": mergeMessageTrees(enSmallWorkbench, {}),
  "zh-Hans": mergeMessageTrees(enSmallWorkbench, {}),
  "ko-KR": mergeMessageTrees(enSmallWorkbench, {}),
  "hi-IN": mergeMessageTrees(enSmallWorkbench, {}),
  ar: mergeMessageTrees(enSmallWorkbench, {}),
  "en-XA": mergeMessageTrees(enSmallWorkbench, {}),
};
