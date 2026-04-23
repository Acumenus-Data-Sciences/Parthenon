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

const enGisTools: MessageTree = {
  poseidon: {
    page: {
      unavailableTitle: "Poseidon unavailable",
      unavailableMessage:
        "Could not connect to the Poseidon orchestration service. Verify the Poseidon containers are running.",
      retry: "Retry",
      title: "Poseidon",
      subtitle:
        "CDM refresh orchestration - incremental loads, dependency-aware execution, and per-source scheduling via dbt + Dagster",
      refresh: "Refresh",
    },
    overview: {
      activeSchedules: "Active Schedules",
      runsInProgress: "Runs In Progress",
      successfulRuns: "Successful Runs",
      failedRuns: "Failed Runs",
      ofTotal: "of {{count}} total",
    },
    runStatus: {
      pending: "Pending",
      running: "Running",
      success: "Succeeded",
      failed: "Failed",
      cancelled: "Cancelled",
    },
    runType: {
      fullRefresh: "Full Refresh",
      vocabulary: "Vocabulary",
      incremental: "Incremental",
    },
    scheduleType: {
      manual: "Manual",
      cron: "Scheduled",
      sensor: "Event-driven",
    },
    schedules: {
      title: "Source Schedules",
      emptyTitle: "No schedules configured",
      emptyMessage:
        "Create a Poseidon schedule to automate CDM refreshes for a data source.",
      active: "Active",
      paused: "Paused",
      lastRun: "Last run: {{value}}",
      nextRun: "Next: {{value}}",
      runCount_one: "{{count}} run",
      runCount_other: "{{count}} runs",
      pauseSchedule: "Pause schedule",
      activateSchedule: "Activate schedule",
      pause: "Pause",
      activate: "Activate",
      runIncrementalRefresh: "Run Incremental Refresh",
    },
    recentRuns: {
      title: "Recent Runs",
      emptyTitle: "No runs yet",
      emptyMessage: "Trigger a manual run or wait for a scheduled execution.",
      headers: {
        source: "Source",
        type: "Type",
        status: "Status",
        trigger: "Trigger",
        duration: "Duration",
        started: "Started",
        actions: "Actions",
      },
      cancel: "Cancel",
    },
    runDetail: {
      title: "Run #{{id}}",
      type: "Type",
      triggeredBy: "Triggered By",
      duration: "Duration",
      modelsRun: "Models Run",
      rowsInserted: "Rows Inserted",
      rowsUpdated: "Rows Updated",
      testsPassed: "Tests Passed",
      testsFailed: "Tests Failed",
      error: "Error",
    },
    freshness: {
      title: "CDM Freshness",
      assetCount_one: "{{count}} asset",
      assetCount_other: "{{count}} assets",
      loading: "Loading freshness data from Dagster...",
      emptyTitle: "No freshness data",
      emptyMessage:
        "Freshness data appears after at least one successful Poseidon run.",
      never: "Never",
    },
    lineage: {
      title: "Asset Lineage",
      assetCount_one: "{{count}} asset",
      assetCount_other: "{{count}} assets",
      loading: "Loading lineage from Dagster...",
      emptyTitle: "No lineage data",
      emptyMessage:
        "Asset lineage appears after Dagster discovers dbt models.",
      dependsOn: "depends on: {{dependencies}}",
      tiers: {
        staging: "Staging",
        intermediate: "Intermediate",
        cdm: "CDM",
        quality: "Quality",
        fallback: "Tier {{index}}",
      },
    },
  },
  jupyter: {
    status: {
      hubOnline: "Hub Online",
      unavailable: "Unavailable",
      authenticating: "Authenticating...",
      startingServer: "Starting Server...",
      running: "Running",
      failed: "Failed",
    },
    page: {
      title: "Jupyter Workbench",
      subtitle:
        "Your personal notebook environment for interactive research, custom analyses, and data exploration",
      refresh: "Refresh",
      openInNewTab: "Open In New Tab",
      workspaceDetails: "Workspace details",
      checkingHub: "Checking JupyterHub...",
      iframeTitle: "Parthenon Jupyter",
      startOverlay: "Starting your notebook server...",
      firstLaunchNote: "This may take up to 30 seconds on first launch",
      failedToStart: "Failed to start notebook server",
      retry: "Retry",
      failedToCreateSession: "Failed to create session",
    },
    unavailable: {
      title: "JupyterHub is not reachable",
      message:
        "The notebook service is currently unavailable. Refresh after the container is healthy.",
    },
    drawer: {
      title: "Jupyter Workspace Details",
      environment: "Environment",
      runtime: "Runtime",
      runtimeDescription:
        "Python 3.12 with pandas, polars, sqlalchemy, and role-based database access.",
      privateWorkspace: "Private Workspace",
      privateWorkspaceDescription:
        "Your personal notebook directory. Persists across sessions - your work is always saved.",
      sharedFolder: "Shared Folder",
      sharedFolderDescription:
        "Copy notebooks here to share with colleagues. All Jupyter users can read this folder.",
      mountedPaths: "Mounted Paths",
      starterNotebooks: "Starter Notebooks",
      noStarterNotebooks: "No starter notebooks available.",
      tips: "Tips",
      quickLinks: "Quick Links",
      openHubNewTab: "Open JupyterHub in new tab",
      defaults: {
        runtime: "JupyterLab 4.4",
        privateWorkspace: "/home/jovyan/notebooks",
        sharedFolder: "/home/jovyan/shared",
      },
    },
  },
  codeExplorer: {
    page: {
      title: "Code Explorer",
      concept: "Concept",
      searchPlaceholder: "Search concepts with data in this source",
      pickSource: "Pick a source to begin.",
      pickSourceAndConcept: "Pick a source and concept to view data.",
    },
    tabs: {
      counts: "Counts",
      relationships: "Relationships",
      hierarchy: "Hierarchy",
      report: "Report",
      myReports: "My Reports",
    },
    sourcePicker: {
      loading: "Loading sources...",
      empty: "No sources configured",
      label: "Data source",
      choose: "Choose a source...",
    },
    counts: {
      emptyTitle: "No data for this concept in {{sourceKey}}",
      emptyMessage:
        "Concept {{conceptId}} is in the OMOP vocabulary but has no observations in this source's stratified code counts. Try a different concept (the search box now scopes to concepts that have data in {{sourceKey}}) or switch to a source that includes this code.",
      loading: "Loading counts...",
      failed: "Failed to load counts.",
      conceptId: "concept_id",
      count: "Count",
      group: "Group",
      gender: "Gender",
      ageDecile: "Age decile",
      node: "Node ({{count}})",
      descendant: "Descendant ({{count}})",
    },
    chart: {
      noData: "No data to display",
      male: "Male",
      female: "Female",
      unknown: "Unknown",
    },
    hierarchy: {
      loading: "Loading hierarchy...",
      failed: "Failed to load.",
      direction: "Direction",
      both: "Both",
      ancestorsOnly: "Ancestors only",
      descendantsOnly: "Descendants only",
      maxDepth: "Max depth",
      empty: "No hierarchy data for this concept at depth {{depth}}.",
    },
    relationships: {
      loading: "Loading relationships...",
      failed: "Failed to load.",
      empty: "No relationships found for this concept.",
      headers: {
        relationship: "Relationship",
        targetConcept: "Target Concept",
        vocabulary: "Vocabulary",
        standard: "Standard",
      },
    },
    reports: {
      loading: "Loading reports...",
      failed: "Failed to load.",
      empty:
        "You have no reports yet. Go to the Report tab and generate one.",
      headers: {
        created: "Created",
        source: "Source",
        concept: "Concept",
        status: "Status",
        pin: "Pin",
      },
      pin: "Pin",
      unpin: "Unpin",
      generateReport: "Generate report",
      generating: "Generating...",
      failedToDispatch: "Failed to dispatch report.",
      progress: "{{percent}}% - {{message}}",
      failedTitle: "Report generation failed",
      ready: "Report ready",
      downloadHtml: "Download HTML",
      iframeTitle: "ROMOPAPI report",
      inlinePreviewNote:
        "Inline preview is sandboxed (scripts + cross-origin disabled). Download the file for the full interactive view in your browser.",
    },
    sourceReadiness: {
      settingUp: "Setting up {{sourceKey}}...",
      sourceNeedsInitialization: "Source {{sourceKey}} needs initialization",
      missing:
        "Missing: {{missing}}. This is an admin-only one-time setup that materializes the stratified code counts table.",
      dispatching: "Dispatching...",
      initializeSource: "Initialize source",
      failedToDispatch:
        "Failed to dispatch. You may lack the `finngen.code-explorer.setup` permission.",
    },
  },
  gis: {
    common: {
      analysisLayerCount_one: "{{count}} analysis layer active",
      analysisLayerCount_other: "{{count}} analysis layers active",
      avgValue: "avg: {{value}}",
      records_one: "{{count}} record",
      records_other: "{{count}} records",
      present: "present",
      unknownRegion: "Region",
    },
    page: {
      title: "GIS Explorer",
      reset: "Reset",
      collapse: "Collapse",
      expand: "Expand",
      enableLayers: "Enable analysis layers in the left panel",
      selectDisease: "Select a disease to begin spatial analysis",
    },
    layerPanel: {
      title: "Analysis Layers",
      privacy: "Privacy",
      suppressionOff: "Suppression: off (synthetic data)",
    },
    context: {
      researchActions: "Research Actions",
      createStudy: "Create Study",
      browseCohorts: "Browse Cohorts",
      clickRegion: "Click a region on the map to see layer details",
    },
    diseaseSelector: {
      title: "Disease",
      searchPlaceholder: "Search conditions...",
      top: "Top",
      categories: "Categories",
      noMatches: "No matching conditions",
      patientCountTitle: "{{count}} patients",
    },
    regionDetail: {
      loading: "Loading...",
      close: "Close",
      loadingDetails: "Loading region details...",
      area: "Area: {{value}} km²",
      drillDown_one: "Drill down ({{count}} sub-region)",
      drillDown_other: "Drill down ({{count}} sub-regions)",
      exposures: "Exposures",
      concept: "Concept {{conceptId}}",
    },
    countyDetail: {
      county: "County",
      cases: "Cases",
      deaths: "Deaths",
      cfr: "CFR",
      hospitalized: "Hospitalized",
      population: "Population",
      ageDistributionCovid: "Age Distribution (COVID)",
      monthlyCases: "Monthly Cases",
      casesTitle: "{{period}}: {{count}} cases",
    },
    diseaseSummary: {
      cases: "Cases",
      deaths: "Deaths",
      cfr: "CFR",
      counties: "Counties",
      prevalence: "Prevalence",
    },
    analysisDrawer: {
      title_one: "Analysis ({{count}} layer)",
      title_other: "Analysis ({{count}} layers)",
    },
    layers: {
      airQuality: {
        name: "Air Quality",
        description: "EPA PM2.5 and ozone levels",
        legend: {
          good: "Good (low PM2.5)",
          poor: "Poor (high PM2.5)",
        },
        tooltip: {
          pm25: "PM2.5",
        },
        analysis: {
          loading: "Loading...",
          noData: "No data",
        },
        detail: {
          loading: "Loading...",
          empty: "No air quality data",
          ozone: "Ozone",
        },
      },
      comorbidity: {
        name: "Comorbidity Burden",
        description: "DM, HTN, obesity clustering",
        legend: {
          low: "Low burden (0)",
          high: "High burden (3)",
        },
        tooltip: {
          burden: "Burden",
        },
        analysis: {
          loading: "Loading...",
          noData: "No data",
        },
        detail: {
          title: "Comorbidity data for {{fips}}",
          subtitle: "DM + HTN + Obesity burden score",
        },
      },
      hospitalAccess: {
        name: "Hospital Access",
        description: "CMS hospital proximity",
        legend: {
          withEd: "Hospital (ED)",
          withoutEd: "Hospital (no ED)",
        },
        analysis: {
          loading: "Loading...",
          noData: "No data",
        },
        detail: {
          title: "Nearest hospitals to {{fips}}",
          subtitle: "Distance rings: 15/30/60 km",
        },
      },
      rucc: {
        name: "Urban-Rural",
        description: "USDA Rural-Urban Continuum Codes",
        legend: {
          metro: "Metro",
          micropolitan: "Micropolitan",
          rural: "Rural",
        },
        tooltip: {
          classification: "Classification",
        },
        analysis: {
          loading: "Loading...",
          noData: "No data",
        },
        detail: {
          loading: "Loading...",
          empty: "No RUCC data",
          code: "RUCC Code",
          classification: "Classification",
          category: "Category",
          patients: "Patients",
        },
        categories: {
          metro: "Metro",
          micro: "Micropolitan",
          rural: "Rural",
        },
      },
      svi: {
        name: "Social Vulnerability",
        description: "CDC/ATSDR SVI by census tract",
        legend: {
          low: "Low vulnerability",
          high: "High vulnerability",
        },
        tooltip: {
          score: "SVI",
        },
        analysis: {
          loading: "Loading...",
          noData: "No data available",
        },
        detail: {
          loading: "Loading...",
          empty: "No SVI data",
          overall: "Overall SVI",
          themes: {
            socioeconomicStatus: "Socioeconomic Status",
            householdComposition: "Household Composition",
            minorityStatus: "Minority Status",
            housingTransportation: "Housing & Transportation",
          },
        },
      },
    },
  },
  queryAssistant: {
    page: {
      title: "Query Assistant",
      subtitle:
        "Browse the OHDSI query library or use AI to generate SQL from natural language",
      dialect: "Dialect",
      default: "Default",
      defaultTooltip: "Changes saved as system default (super-admin)",
      tabs: {
        library: "Query Library",
        naturalLanguage: "Natural Language",
      },
    },
    naturalLanguage: {
      askQuestion: "Ask a Question",
      placeholder:
        "e.g. How many patients were diagnosed with type 2 diabetes in 2023?",
      ctrlEnter: "Ctrl+Enter to generate",
      tryExample: "Try an example",
      examples: {
        diabetes: "How many patients have diabetes?",
        topConditions: "What are the top 10 conditions by prevalence?",
        heartFailureAge: "Average age of patients with heart failure",
        statins2024: "Drug exposure counts for statins in 2024",
      },
      generateWithAi: "Generate With AI",
      generating: "Generating...",
      failedToGenerate: "Failed to generate SQL. Please try again.",
      queryHistory: "Query History",
      clear: "Clear",
      emptyTitle: "Ask a question to get started",
      emptyDescription:
        "Type a natural language question about your OMOP CDM data and the AI will generate the corresponding SQL query.",
    },
    library: {
      searchPlaceholder: "Search queries by keyword...",
      indexedQueries: "{{count}} indexed queries",
      matches: "{{count}} matches",
      featuredTemplates: "{{count}} featured templates",
      refreshing: "Refreshing",
      allDomains: "All domains",
      failedToLoad: "Failed to load query library.",
      noMatches: "No queries found matching your search.",
      tryDifferentKeyword: "Try a different keyword or clear your filters.",
      importHint:
        "If the library is empty, ask your admin to run: php artisan query-library:import-ohdsi",
      showMoreMatches: "Show more matches",
    },
    results: {
      safeReadOnly: "SAFE - Read Only",
      needsReview: "NEEDS REVIEW",
      unsafe: "UNSAFE",
      queryLibraryMatch: "Query Library Match",
      templateParameters: "Template Parameters",
      rendering: "Rendering...",
      sqlUpdated: "SQL Updated",
      renderTemplate: "Render Template",
      renderFailed: "Failed to render query template.",
      generatedSql: "Generated SQL",
      aggregate: "Aggregate",
      tablesReferenced: "Tables Referenced",
      explanation: "Explanation",
      validateSql: "Validate SQL",
      validating: "Validating...",
      validSql: "Valid SQL",
      validationFailed: "Validation Failed",
      readOnly: "Read Only",
      complexity: {
        low: "low complexity",
        medium: "medium complexity",
        high: "high complexity",
      },
      renderError: "Failed to render query template.",
      validateError: "Failed to validate SQL.",
    },
    schemaBrowser: {
      title: "OMOP CDM Schema Browser",
      failedToLoad: "Failed to load schema.",
      clinicalTables: "Clinical Tables ({{count}})",
      vocabularyTables: "Vocabulary Tables ({{count}})",
      commonJoins: "Common Joins",
      cols: "{{count}} cols",
      noDescription: "No description available.",
    },
    sqlBlock: {
      sql: "SQL",
      runSql: "Run SQL",
      copy: "Copy",
      copied: "Copied",
    },
    sqlRunner: {
      errorTitles: {
        explanationInsteadOfSql: "The AI returned an explanation instead of SQL",
        mysqlBackticks: "MySQL-style backticks are not supported",
        syntaxError: "SQL syntax error",
        syntaxErrorNear: "Syntax error near \"{{token}}\"",
        timeout: "Query timed out (120s limit)",
        tableNotFound: "Table not found",
        tableNotFoundNamed: "Table \"{{table}}\" not found",
        columnNotFound: "Column not found",
        columnNotFoundNamed: "Column \"{{column}}\" not found",
        insufficientPermissions: "Insufficient permissions",
      },
      suggestions: {
        explanationInsteadOfSql: {
          first: "Try rephrasing your question to be more specific",
          second: "Use the Query Library tab to find a pre-built template",
          third: "Specify the exact tables and columns you want to query",
        },
        mysqlBackticks: {
          first:
            "PostgreSQL uses double quotes for identifiers: \"column_name\"",
          second: "Most OMOP column names do not need quoting at all",
          third:
            "Try regenerating the query - the AI sometimes uses MySQL syntax",
        },
        syntaxError: {
          first:
            "The generated SQL has a syntax issue - try regenerating with a clearer question",
          second:
            "Check for mismatched parentheses, missing commas, or extra keywords",
          third:
            "Use the Validate SQL button first to catch issues before running",
        },
        timeout: {
          first:
            "Add more specific WHERE conditions to reduce the data scanned",
          second: "Add a LIMIT clause to cap the result set",
          third: "Avoid SELECT * - select only the columns you need",
          fourth: "Consider filtering by date range to narrow the dataset",
        },
        tableNotFound: {
          first:
            "OMOP tables must be schema-qualified: omop.person, omop.condition_occurrence",
          second:
            "Use the Schema Browser at the bottom of the page to verify table names",
          third:
            "Check spelling - common tables: person, condition_occurrence, drug_exposure, measurement",
        },
        columnNotFound: {
          first:
            "Expand the table in the Schema Browser to see available columns",
          second:
            "OMOP column names use underscores: person_id, condition_start_date",
          third:
            "Check if you need a JOIN to another table that has this column",
        },
        insufficientPermissions: {
          first: "This query was not classified as \"safe\" (read-only)",
          second:
            "Only administrators can run queries that are not marked safe",
          third:
            "Use the Validate SQL button to check the safety classification",
        },
      },
      defaults: {
        queryExecutionFailed: "Query execution failed",
        failedToRenderTemplate: "Failed to render template",
        typeToSearchConcepts: "Type to search OMOP concepts...",
        typeToSearchConceptsWithDefault:
          "{{defaultValue}} - type to search OMOP concepts",
      },
      state: {
        active: "Executing query...",
        idle: "Idle",
        idleInTransaction: "Processing results...",
        idleAborted: "Transaction aborted",
        fastpath: "Fast path call",
        disabled: "Tracking disabled",
        completed: "Completed",
        error: "Error",
      },
      modal: {
        title: "SQL Query Runner",
        wait: "Wait: {{value}}",
        preparing: "Preparing...",
        runQuery: "Run Query",
        queryCompleted: "Query completed",
        rowsIn: "{{count}} rows in {{elapsed}}",
        cappedAt10k: "Capped at 10,000 rows",
        queryFailed: "Query failed",
        downloadCsv: "Download CSV",
        close: "Close",
        showingSomeRows:
          "Showing {{shown}} of {{total}} rows",
        showingAllRows: "{{count}} rows",
        nullValue: "null",
      },
    },
  },
};

const frGisTools: MessageTree = mergeMessageTrees(enGisTools, {
  poseidon: {
    page: {
      unavailableTitle: "Poseidon indisponible",
      unavailableMessage:
        "Connexion impossible au service d'orchestration Poseidon. Verifiez que les conteneurs Poseidon sont en cours d'execution.",
      retry: "Reessayer",
      title: "Poseidon",
      subtitle:
        "Orchestration du rafraichissement CDM - chargements incrementaux, execution avec gestion des dependances et planification par source via dbt + Dagster",
      refresh: "Actualiser",
    },
    overview: {
      activeSchedules: "Planifications actives",
      runsInProgress: "Executions en cours",
      successfulRuns: "Executions reussies",
      failedRuns: "Executions en echec",
      ofTotal: "sur {{count}} au total",
    },
    runStatus: {
      pending: "En attente",
      running: "En cours",
      success: "Reussie",
      failed: "Echec",
      cancelled: "Annulee",
    },
    runType: {
      fullRefresh: "Rafraichissement complet",
      vocabulary: "Vocabulaire",
      incremental: "Incremental",
    },
    scheduleType: {
      manual: "Manuel",
      cron: "Planifie",
      sensor: "Declenche par evenement",
    },
    schedules: {
      title: "Planifications par source",
      emptyTitle: "Aucune planification configuree",
      emptyMessage:
        "Creez une planification Poseidon pour automatiser les rafraichissements CDM d'une source de donnees.",
      active: "Active",
      paused: "En pause",
      lastRun: "Derniere execution : {{value}}",
      nextRun: "Prochaine : {{value}}",
      runCount_one: "{{count}} execution",
      runCount_other: "{{count}} executions",
      pauseSchedule: "Mettre la planification en pause",
      activateSchedule: "Activer la planification",
      pause: "Pause",
      activate: "Activer",
      runIncrementalRefresh:
        "Lancer le rafraichissement incremental",
    },
    recentRuns: {
      title: "Executions recentes",
      emptyTitle: "Aucune execution pour le moment",
      emptyMessage:
        "Declenchez une execution manuelle ou attendez une execution planifiee.",
      headers: {
        source: "Source",
        type: "Type",
        status: "Statut",
        trigger: "Declencheur",
        duration: "Duree",
        started: "Debut",
        actions: "Actions",
      },
      cancel: "Annuler",
    },
    runDetail: {
      title: "Execution n°{{id}}",
      type: "Type",
      triggeredBy: "Declenchee par",
      duration: "Duree",
      modelsRun: "Modeles executes",
      rowsInserted: "Lignes inserees",
      rowsUpdated: "Lignes mises a jour",
      testsPassed: "Tests reussis",
      testsFailed: "Tests en echec",
      error: "Erreur",
    },
    freshness: {
      title: "Fraicheur CDM",
      assetCount_one: "{{count}} ressource",
      assetCount_other: "{{count}} ressources",
      loading:
        "Chargement des donnees de fraicheur depuis Dagster...",
      emptyTitle: "Aucune donnee de fraicheur",
      emptyMessage:
        "Les donnees de fraicheur apparaissent apres au moins une execution Poseidon reussie.",
      never: "Jamais",
    },
    lineage: {
      title: "Lignee des ressources",
      assetCount_one: "{{count}} ressource",
      assetCount_other: "{{count}} ressources",
      loading: "Chargement de la lignee depuis Dagster...",
      emptyTitle: "Aucune donnee de lignee",
      emptyMessage:
        "La lignee des ressources apparait apres la decouverte des modeles dbt par Dagster.",
      dependsOn: "depend de : {{dependencies}}",
      tiers: {
        staging: "Staging",
        intermediate: "Intermediaire",
        cdm: "CDM",
        quality: "Qualite",
        fallback: "Niveau {{index}}",
      },
    },
  },
  jupyter: {
    status: {
      hubOnline: "Hub en ligne",
      unavailable: "Indisponible",
      authenticating: "Authentification...",
      startingServer: "Demarrage du serveur...",
      running: "En cours",
      failed: "Echec",
    },
    page: {
      title: "Espace Jupyter",
      subtitle:
        "Votre environnement personnel de notebooks pour la recherche interactive, les analyses personnalisees et l'exploration de donnees",
      refresh: "Actualiser",
      openInNewTab: "Ouvrir dans un nouvel onglet",
      workspaceDetails: "Details de l'espace",
      checkingHub: "Verification de JupyterHub...",
      iframeTitle: "Parthenon Jupyter",
      startOverlay:
        "Demarrage de votre serveur de notebooks...",
      firstLaunchNote:
        "Cela peut prendre jusqu'a 30 secondes au premier lancement",
      failedToStart:
        "Echec du demarrage du serveur de notebooks",
      retry: "Reessayer",
      failedToCreateSession:
        "Echec de la creation de session",
    },
    unavailable: {
      title: "JupyterHub n'est pas joignable",
      message:
        "Le service de notebooks est actuellement indisponible. Actualisez lorsque le conteneur est sain.",
    },
    drawer: {
      title: "Details de l'espace Jupyter",
      environment: "Environnement",
      runtime: "Runtime",
      runtimeDescription:
        "Python 3.12 avec pandas, polars, sqlalchemy et acces base de donnees selon les roles.",
      privateWorkspace: "Espace prive",
      privateWorkspaceDescription:
        "Votre repertoire personnel de notebooks. Il persiste entre les sessions - votre travail est toujours sauvegarde.",
      sharedFolder: "Dossier partage",
      sharedFolderDescription:
        "Copiez vos notebooks ici pour les partager avec vos collegues. Tous les utilisateurs Jupyter peuvent lire ce dossier.",
      mountedPaths: "Chemins montes",
      starterNotebooks: "Notebooks de demarrage",
      noStarterNotebooks:
        "Aucun notebook de demarrage disponible.",
      tips: "Conseils",
      quickLinks: "Liens rapides",
      openHubNewTab:
        "Ouvrir JupyterHub dans un nouvel onglet",
      defaults: {
        privateWorkspace: "/home/jovyan/notebooks",
        sharedFolder: "/home/jovyan/shared",
      },
    },
  },
  codeExplorer: {
    page: {
      title: "Explorateur de codes",
      concept: "Concept",
      searchPlaceholder:
        "Rechercher des concepts avec donnees dans cette source",
      pickSource: "Choisissez une source pour commencer.",
      pickSourceAndConcept:
        "Choisissez une source et un concept pour voir les donnees.",
    },
    tabs: {
      counts: "Comptages",
      relationships: "Relations",
      hierarchy: "Hierarchie",
      report: "Rapport",
      myReports: "Mes rapports",
    },
    sourcePicker: {
      loading: "Chargement des sources...",
      empty: "Aucune source configuree",
      label: "Source de donnees",
      choose: "Choisir une source...",
    },
    counts: {
      emptyTitle:
        "Aucune donnee pour ce concept dans {{sourceKey}}",
      emptyMessage:
        "Le concept {{conceptId}} existe dans le vocabulaire OMOP mais n'a aucune observation dans les comptages de codes stratifes de cette source. Essayez un autre concept (la recherche est maintenant limitee aux concepts disposant de donnees dans {{sourceKey}}) ou passez a une source qui contient ce code.",
      loading: "Chargement des comptages...",
      failed: "Echec du chargement des comptages.",
      conceptId: "concept_id",
      count: "Comptage",
      group: "Groupe",
      gender: "Sexe",
      ageDecile: "Decile d'age",
      node: "Noeud ({{count}})",
      descendant: "Descendant ({{count}})",
    },
    chart: {
      noData: "Aucune donnee a afficher",
      male: "Homme",
      female: "Femme",
      unknown: "Inconnu",
    },
    hierarchy: {
      loading: "Chargement de la hierarchie...",
      failed: "Echec du chargement.",
      direction: "Direction",
      both: "Les deux",
      ancestorsOnly: "Ancetres uniquement",
      descendantsOnly: "Descendants uniquement",
      maxDepth: "Profondeur max",
      empty:
        "Aucune donnee de hierarchie pour ce concept a la profondeur {{depth}}.",
    },
    relationships: {
      loading: "Chargement des relations...",
      failed: "Echec du chargement.",
      empty: "Aucune relation trouvee pour ce concept.",
      headers: {
        relationship: "Relation",
        targetConcept: "Concept cible",
        vocabulary: "Vocabulaire",
        standard: "Standard",
      },
    },
    reports: {
      loading: "Chargement des rapports...",
      failed: "Echec du chargement.",
      empty:
        "Vous n'avez encore aucun rapport. Allez dans l'onglet Rapport et generez-en un.",
      headers: {
        created: "Cree",
        source: "Source",
        concept: "Concept",
        status: "Statut",
        pin: "Epingler",
      },
      pin: "Epingler",
      unpin: "Desepingler",
      generateReport: "Generer un rapport",
      generating: "Generation...",
      failedToDispatch:
        "Echec de l'envoi du rapport.",
      progress: "{{percent}}% - {{message}}",
      failedTitle:
        "La generation du rapport a echoue",
      ready: "Rapport pret",
      downloadHtml: "Telecharger le HTML",
      iframeTitle: "Rapport ROMOPAPI",
      inlinePreviewNote:
        "L'aperçu integre est sandboxe (scripts et cross-origin desactives). Telechargez le fichier pour obtenir la version interactive complete dans votre navigateur.",
    },
    sourceReadiness: {
      settingUp: "Initialisation de {{sourceKey}}...",
      sourceNeedsInitialization:
        "La source {{sourceKey}} doit etre initialisee",
      missing:
        "Elements manquants : {{missing}}. Il s'agit d'une configuration unique reservee aux administrateurs qui materialise la table de comptages de codes stratifes.",
      dispatching: "Envoi...",
      initializeSource: "Initialiser la source",
      failedToDispatch:
        "Echec de l'envoi. Il est possible que vous n'ayez pas la permission `finngen.code-explorer.setup`.",
    },
  },
  gis: {
    common: {
      analysisLayerCount_one:
        "{{count}} couche d'analyse active",
      analysisLayerCount_other:
        "{{count}} couches d'analyse actives",
      avgValue: "moy: {{value}}",
      records_one: "{{count}} enregistrement",
      records_other: "{{count}} enregistrements",
      present: "present",
      unknownRegion: "Region",
    },
    page: {
      title: "Explorateur SIG",
      reset: "Reinitialiser",
      collapse: "Replier",
      expand: "Deplier",
      enableLayers:
        "Activez des couches d'analyse dans le panneau de gauche",
      selectDisease:
        "Selectionnez une maladie pour commencer l'analyse spatiale",
    },
    layerPanel: {
      title: "Couches d'analyse",
      privacy: "Confidentialite",
      suppressionOff:
        "Suppression : desactivee (donnees synthetiques)",
    },
    context: {
      researchActions: "Actions de recherche",
      createStudy: "Creer une etude",
      browseCohorts: "Parcourir les cohortes",
      clickRegion:
        "Cliquez sur une region de la carte pour voir les details de la couche",
    },
    diseaseSelector: {
      title: "Maladie",
      searchPlaceholder:
        "Rechercher des pathologies...",
      top: "Top",
      categories: "Categories",
      noMatches: "Aucune pathologie correspondante",
      patientCountTitle: "{{count}} patients",
    },
    regionDetail: {
      loading: "Chargement...",
      close: "Fermer",
      loadingDetails:
        "Chargement des details de la region...",
      area: "Surface : {{value}} km²",
      drillDown_one:
        "Explorer ({{count}} sous-region)",
      drillDown_other:
        "Explorer ({{count}} sous-regions)",
      exposures: "Expositions",
      concept: "Concept {{conceptId}}",
    },
    countyDetail: {
      county: "Comte",
      cases: "Cas",
      deaths: "Deces",
      cfr: "TFC",
      hospitalized: "Hospitalises",
      population: "Population",
      ageDistributionCovid:
        "Repartition par age (COVID)",
      monthlyCases: "Cas mensuels",
      casesTitle: "{{period}} : {{count}} cas",
    },
    diseaseSummary: {
      cases: "Cas",
      deaths: "Deces",
      cfr: "TFC",
      counties: "Comtes",
      prevalence: "Prevalence",
    },
    analysisDrawer: {
      title_one: "Analyse ({{count}} couche)",
      title_other: "Analyse ({{count}} couches)",
    },
    layers: {
      airQuality: {
        name: "Qualite de l'air",
        description:
          "Niveaux EPA de PM2.5 et d'ozone",
        legend: {
          good: "Bonne (PM2.5 faible)",
          poor: "Mauvaise (PM2.5 eleve)",
        },
        tooltip: {
          pm25: "PM2.5",
        },
        analysis: {
          loading: "Chargement...",
          noData: "Aucune donnee",
        },
        detail: {
          loading: "Chargement...",
          empty:
            "Aucune donnee de qualite de l'air",
          ozone: "Ozone",
        },
      },
      comorbidity: {
        name: "Charge de comorbidites",
        description:
          "Regroupement diabete, HTA, obesite",
        legend: {
          low: "Charge faible (0)",
          high: "Charge elevee (3)",
        },
        tooltip: {
          burden: "Charge",
        },
        analysis: {
          loading: "Chargement...",
          noData: "Aucune donnee",
        },
        detail: {
          title:
            "Donnees de comorbidite pour {{fips}}",
          subtitle:
            "Score de charge diabete + HTA + obesite",
        },
      },
      hospitalAccess: {
        name: "Acces hospitalier",
        description:
          "Proximite hospitaliere CMS",
        legend: {
          withEd: "Hopital (urgences)",
          withoutEd: "Hopital (sans urgences)",
        },
        analysis: {
          loading: "Chargement...",
          noData: "Aucune donnee",
        },
        detail: {
          title:
            "Hopitaux les plus proches de {{fips}}",
          subtitle:
            "Anneaux de distance : 15/30/60 km",
        },
      },
      rucc: {
        name: "Urbain-rural",
        description:
          "Codes USDA Rural-Urban Continuum",
        legend: {
          metro: "Metro",
          micropolitan: "Micropolitain",
          rural: "Rural",
        },
        tooltip: {
          classification: "Classification",
        },
        analysis: {
          loading: "Chargement...",
          noData: "Aucune donnee",
        },
        detail: {
          loading: "Chargement...",
          empty: "Aucune donnee RUCC",
          code: "Code RUCC",
          classification: "Classification",
          category: "Categorie",
          patients: "Patients",
        },
        categories: {
          metro: "Metro",
          micro: "Micropolitain",
          rural: "Rural",
        },
      },
      svi: {
        name: "Vulnerabilite sociale",
        description:
          "SVI CDC/ATSDR par secteur de recensement",
        legend: {
          low: "Vulnerabilite faible",
          high: "Vulnerabilite elevee",
        },
        tooltip: {
          score: "SVI",
        },
        analysis: {
          loading: "Chargement...",
          noData:
            "Aucune donnee disponible",
        },
        detail: {
          loading: "Chargement...",
          empty: "Aucune donnee SVI",
          overall: "SVI global",
          themes: {
            socioeconomicStatus:
              "Statut socioeconomique",
            householdComposition:
              "Composition du foyer",
            minorityStatus: "Statut minoritaire",
            housingTransportation:
              "Logement et transport",
          },
        },
      },
    },
  },
  queryAssistant: {
    page: {
      title: "Assistant de requetes",
      subtitle:
        "Parcourez la bibliotheque de requetes OHDSI ou utilisez l'IA pour generer du SQL a partir du langage naturel",
      dialect: "Dialecte",
      default: "Par defaut",
      defaultTooltip:
        "Les changements sont enregistres comme valeur systeme par defaut (super-admin)",
      tabs: {
        library: "Bibliotheque de requetes",
        naturalLanguage: "Langage naturel",
      },
    },
    naturalLanguage: {
      askQuestion: "Poser une question",
      placeholder:
        "ex. Combien de patients ont recu un diagnostic de diabete de type 2 en 2023 ?",
      ctrlEnter: "Ctrl+Entree pour generer",
      tryExample: "Essayer un exemple",
      examples: {
        diabetes:
          "Combien de patients ont un diabete ?",
        topConditions:
          "Quelles sont les 10 pathologies les plus frequentes ?",
        heartFailureAge:
          "Age moyen des patients atteints d'insuffisance cardiaque",
        statins2024:
          "Comptages d'exposition medicamenteuse pour les statines en 2024",
      },
      generateWithAi: "Generer avec IA",
      generating: "Generation...",
      failedToGenerate:
        "Echec de la generation du SQL. Veuillez reessayer.",
      queryHistory: "Historique des requetes",
      clear: "Effacer",
      emptyTitle:
        "Posez une question pour commencer",
      emptyDescription:
        "Saisissez une question en langage naturel sur vos donnees OMOP CDM et l'IA generera la requete SQL correspondante.",
    },
    library: {
      searchPlaceholder:
        "Rechercher des requetes par mot-cle...",
      indexedQueries:
        "{{count}} requetes indexees",
      matches: "{{count}} correspondances",
      featuredTemplates:
        "{{count}} modeles mis en avant",
      refreshing: "Actualisation",
      allDomains: "Tous les domaines",
      failedToLoad:
        "Echec du chargement de la bibliotheque de requetes.",
      noMatches:
        "Aucune requete ne correspond a votre recherche.",
      tryDifferentKeyword:
        "Essayez un autre mot-cle ou effacez vos filtres.",
      importHint:
        "Si la bibliotheque est vide, demandez a votre administrateur d'executer : php artisan query-library:import-ohdsi",
      showMoreMatches:
        "Afficher plus de correspondances",
    },
    results: {
      safeReadOnly: "SURE - Lecture seule",
      needsReview: "REVISION REQUISE",
      unsafe: "NON SURE",
      queryLibraryMatch:
        "Correspondance bibliotheque de requetes",
      templateParameters:
        "Parametres du modele",
      rendering: "Rendu...",
      sqlUpdated: "SQL mis a jour",
      renderTemplate: "Rendre le modele",
      renderFailed:
        "Echec du rendu du modele de requete.",
      generatedSql: "SQL genere",
      aggregate: "Agrege",
      tablesReferenced:
        "Tables referencees",
      explanation: "Explication",
      validateSql: "Valider le SQL",
      validating: "Validation...",
      validSql: "SQL valide",
      validationFailed:
        "Echec de la validation",
      readOnly: "Lecture seule",
      complexity: {
        low: "faible complexite",
        medium: "complexite moyenne",
        high: "complexite elevee",
      },
      renderError:
        "Echec du rendu du modele de requete.",
      validateError:
        "Echec de la validation du SQL.",
    },
    schemaBrowser: {
      title: "Navigateur de schema OMOP CDM",
      failedToLoad:
        "Echec du chargement du schema.",
      clinicalTables:
        "Tables cliniques ({{count}})",
      vocabularyTables:
        "Tables de vocabulaire ({{count}})",
      commonJoins: "Jointures courantes",
      cols: "{{count}} colonnes",
      noDescription:
        "Aucune description disponible.",
    },
    sqlBlock: {
      sql: "SQL",
      runSql: "Executer le SQL",
      copy: "Copier",
      copied: "Copie",
    },
    sqlRunner: {
      errorTitles: {
        explanationInsteadOfSql:
          "L'IA a renvoye une explication au lieu de SQL",
        mysqlBackticks:
          "Les accents graves de style MySQL ne sont pas pris en charge",
        syntaxError: "Erreur de syntaxe SQL",
        syntaxErrorNear:
          "Erreur de syntaxe pres de \"{{token}}\"",
        timeout:
          "La requete a expire (limite de 120 s)",
        tableNotFound:
          "Table introuvable",
        tableNotFoundNamed:
          "Table \"{{table}}\" introuvable",
        columnNotFound:
          "Colonne introuvable",
        columnNotFoundNamed:
          "Colonne \"{{column}}\" introuvable",
        insufficientPermissions:
          "Permissions insuffisantes",
      },
      suggestions: {
        explanationInsteadOfSql: {
          first:
            "Essayez de reformuler votre question de facon plus precise",
          second:
            "Utilisez l'onglet Bibliotheque de requetes pour trouver un modele preconstruit",
          third:
            "Precisez les tables et colonnes exactes a interroger",
        },
        mysqlBackticks: {
          first:
            "PostgreSQL utilise des guillemets doubles pour les identifiants : \"column_name\"",
          second:
            "La plupart des noms de colonnes OMOP n'ont pas besoin d'etre quotes",
          third:
            "Essayez de regenerer la requete - l'IA utilise parfois une syntaxe MySQL",
        },
        syntaxError: {
          first:
            "Le SQL genere contient un probleme de syntaxe - essayez de regenerer avec une question plus claire",
          second:
            "Verifiez les parentheses mal assorties, les virgules manquantes ou les mots-cles superflus",
          third:
            "Utilisez d'abord le bouton Valider le SQL pour detecter les problemes avant execution",
        },
        timeout: {
          first:
            "Ajoutez des conditions WHERE plus precises pour reduire le volume de donnees analysees",
          second:
            "Ajoutez une clause LIMIT pour plafonner le jeu de resultats",
          third:
            "Evitez SELECT * - selectionnez uniquement les colonnes necessaires",
          fourth:
            "Filtrez par plage de dates pour restreindre le jeu de donnees",
        },
        tableNotFound: {
          first:
            "Les tables OMOP doivent etre qualifiees par schema : omop.person, omop.condition_occurrence",
          second:
            "Utilisez le navigateur de schema en bas de page pour verifier les noms de tables",
          third:
            "Verifiez l'orthographe - tables courantes : person, condition_occurrence, drug_exposure, measurement",
        },
        columnNotFound: {
          first:
            "Developpez la table dans le navigateur de schema pour voir les colonnes disponibles",
          second:
            "Les noms de colonnes OMOP utilisent des underscores : person_id, condition_start_date",
          third:
            "Verifiez si une jointure vers une autre table contenant cette colonne est necessaire",
        },
        insufficientPermissions: {
          first:
            "Cette requete n'a pas ete classee comme \"sure\" (lecture seule)",
          second:
            "Seuls les administrateurs peuvent executer des requetes qui ne sont pas marquees comme sures",
          third:
            "Utilisez le bouton Valider le SQL pour verifier la classification de surete",
        },
      },
      defaults: {
        queryExecutionFailed:
          "Echec de l'execution de la requete",
        failedToRenderTemplate:
          "Echec du rendu du modele",
        typeToSearchConcepts:
          "Tapez pour rechercher des concepts OMOP...",
        typeToSearchConceptsWithDefault:
          "{{defaultValue}} - tapez pour rechercher des concepts OMOP",
      },
      state: {
        active: "Execution de la requete...",
        idle: "Inactif",
        idleInTransaction:
          "Traitement des resultats...",
        idleAborted:
          "Transaction abandonnee",
        fastpath:
          "Appel en chemin rapide",
        disabled:
          "Suivi desactive",
        completed: "Terminee",
        error: "Erreur",
      },
      modal: {
        title: "Executeur de requetes SQL",
        wait: "Attente : {{value}}",
        preparing: "Preparation...",
        runQuery: "Executer la requete",
        queryCompleted:
          "Requete terminee",
        rowsIn:
          "{{count}} lignes en {{elapsed}}",
        cappedAt10k:
          "Limite a 10 000 lignes",
        queryFailed:
          "La requete a echoue",
        downloadCsv:
          "Telecharger CSV",
        close: "Fermer",
        showingSomeRows:
          "Affichage de {{shown}} lignes sur {{total}}",
        showingAllRows: "{{count}} lignes",
        nullValue: "null",
      },
    },
  },
});

const deGisTools: MessageTree = mergeMessageTrees(enGisTools, {
  poseidon: {
    page: {
      unavailableTitle: "Poseidon nicht verfuegbar",
      unavailableMessage:
        "Verbindung zum Poseidon-Orchestrierungsdienst konnte nicht hergestellt werden. Pruefen Sie, ob die Poseidon-Container laufen.",
      retry: "Erneut versuchen",
      title: "Poseidon",
      subtitle:
        "CDM-Refresh-Orchestrierung - inkrementelle Ladevorgaenge, abhaengigkeitsbewusste Ausfuehrung und zeitgesteuerte Ausfuehrung pro Quelle ueber dbt + Dagster",
      refresh: "Aktualisieren",
    },
    overview: {
      activeSchedules: "Aktive Zeitplaene",
      runsInProgress: "Laufende Ausfuehrungen",
      successfulRuns: "Erfolgreiche Ausfuehrungen",
      failedRuns: "Fehlgeschlagene Ausfuehrungen",
      ofTotal: "von {{count}} insgesamt",
    },
    runStatus: {
      pending: "Ausstehend",
      running: "Laeuft",
      success: "Erfolgreich",
      failed: "Fehlgeschlagen",
      cancelled: "Abgebrochen",
    },
    runType: {
      fullRefresh: "Vollstaendige Aktualisierung",
      vocabulary: "Vokabular",
      incremental: "Inkrementell",
    },
    scheduleType: {
      manual: "Manuell",
      cron: "Geplant",
      sensor: "Ereignisgesteuert",
    },
    schedules: {
      title: "Quell-Zeitplaene",
      emptyTitle: "Keine Zeitplaene konfiguriert",
      emptyMessage:
        "Erstellen Sie einen Poseidon-Zeitplan, um CDM-Aktualisierungen fuer eine Datenquelle zu automatisieren.",
      active: "Aktiv",
      paused: "Pausiert",
      lastRun: "Letzte Ausfuehrung: {{value}}",
      nextRun: "Naechste: {{value}}",
      runCount_one: "{{count}} Lauf",
      runCount_other: "{{count}} Laeufe",
      pauseSchedule: "Zeitplan pausieren",
      activateSchedule: "Zeitplan aktivieren",
      pause: "Pausieren",
      activate: "Aktivieren",
      runIncrementalRefresh:
        "Inkrementelle Aktualisierung starten",
    },
    recentRuns: {
      title: "Letzte Ausfuehrungen",
      emptyTitle: "Noch keine Ausfuehrungen",
      emptyMessage:
        "Starten Sie eine manuelle Ausfuehrung oder warten Sie auf einen geplanten Lauf.",
      headers: {
        source: "Quelle",
        type: "Typ",
        status: "Status",
        trigger: "Ausloeser",
        duration: "Dauer",
        started: "Gestartet",
        actions: "Aktionen",
      },
      cancel: "Abbrechen",
    },
    runDetail: {
      title: "Lauf #{{id}}",
      type: "Typ",
      triggeredBy: "Ausgeloest von",
      duration: "Dauer",
      modelsRun: "Ausgefuehrte Modelle",
      rowsInserted: "Eingefuegte Zeilen",
      rowsUpdated: "Aktualisierte Zeilen",
      testsPassed: "Bestandene Tests",
      testsFailed: "Fehlgeschlagene Tests",
      error: "Fehler",
    },
    freshness: {
      title: "CDM-Aktualitaet",
      assetCount_one: "{{count}} Asset",
      assetCount_other: "{{count}} Assets",
      loading:
        "Aktualitaetsdaten werden aus Dagster geladen...",
      emptyTitle: "Keine Aktualitaetsdaten",
      emptyMessage:
        "Aktualitaetsdaten erscheinen nach mindestens einem erfolgreichen Poseidon-Lauf.",
      never: "Nie",
    },
    lineage: {
      title: "Asset-Lineage",
      assetCount_one: "{{count}} Asset",
      assetCount_other: "{{count}} Assets",
      loading:
        "Lineage wird aus Dagster geladen...",
      emptyTitle: "Keine Lineage-Daten",
      emptyMessage:
        "Asset-Lineage erscheint, nachdem Dagster dbt-Modelle entdeckt hat.",
      dependsOn: "haengt ab von: {{dependencies}}",
      tiers: {
        staging: "Staging",
        intermediate: "Zwischenschicht",
        cdm: "CDM",
        quality: "Qualitaet",
        fallback: "Ebene {{index}}",
      },
    },
  },
  jupyter: {
    status: {
      hubOnline: "Hub online",
      unavailable: "Nicht verfuegbar",
      authenticating: "Authentifizierung...",
      startingServer: "Server wird gestartet...",
      running: "Laeuft",
      failed: "Fehlgeschlagen",
    },
    page: {
      title: "Jupyter-Workbench",
      subtitle:
        "Ihre persoenliche Notebook-Umgebung fuer interaktive Forschung, benutzerdefinierte Analysen und Datenexploration",
      refresh: "Aktualisieren",
      openInNewTab: "In neuem Tab oeffnen",
      workspaceDetails: "Arbeitsbereichsdetails",
      checkingHub: "JupyterHub wird geprueft...",
      iframeTitle: "Parthenon Jupyter",
      startOverlay:
        "Ihr Notebook-Server wird gestartet...",
      firstLaunchNote:
        "Beim ersten Start kann dies bis zu 30 Sekunden dauern",
      failedToStart:
        "Notebook-Server konnte nicht gestartet werden",
      retry: "Erneut versuchen",
      failedToCreateSession:
        "Sitzung konnte nicht erstellt werden",
    },
    unavailable: {
      title: "JupyterHub ist nicht erreichbar",
      message:
        "Der Notebook-Dienst ist derzeit nicht verfuegbar. Aktualisieren Sie, sobald der Container wieder gesund ist.",
    },
    drawer: {
      title: "Details des Jupyter-Arbeitsbereichs",
      environment: "Umgebung",
      runtime: "Runtime",
      runtimeDescription:
        "Python 3.12 mit pandas, polars, sqlalchemy und rollenbasiertem Datenbankzugriff.",
      privateWorkspace: "Privater Arbeitsbereich",
      privateWorkspaceDescription:
        "Ihr persoenliches Notebook-Verzeichnis. Es bleibt ueber Sitzungen hinweg erhalten - Ihre Arbeit ist immer gespeichert.",
      sharedFolder: "Freigegebener Ordner",
      sharedFolderDescription:
        "Kopieren Sie Notebooks hierhin, um sie mit Kolleginnen und Kollegen zu teilen. Alle Jupyter-Nutzer koennen diesen Ordner lesen.",
      mountedPaths: "Eingehaengte Pfade",
      starterNotebooks: "Starter-Notebooks",
      noStarterNotebooks:
        "Keine Starter-Notebooks verfuegbar.",
      tips: "Tipps",
      quickLinks: "Schnelllinks",
      openHubNewTab:
        "JupyterHub in neuem Tab oeffnen",
      defaults: {
        privateWorkspace: "/home/jovyan/notebooks",
        sharedFolder: "/home/jovyan/shared",
      },
    },
  },
  codeExplorer: {
    page: {
      title: "Code Explorer",
      concept: "Konzept",
      searchPlaceholder:
        "Konzepte mit Daten in dieser Quelle suchen",
      pickSource:
        "Waehlen Sie eine Quelle, um zu beginnen.",
      pickSourceAndConcept:
        "Waehlen Sie eine Quelle und ein Konzept aus, um Daten anzuzeigen.",
    },
    tabs: {
      counts: "Zaehler",
      relationships: "Beziehungen",
      hierarchy: "Hierarchie",
      report: "Bericht",
      myReports: "Meine Berichte",
    },
    sourcePicker: {
      loading: "Quellen werden geladen...",
      empty: "Keine Quellen konfiguriert",
      label: "Datenquelle",
      choose: "Quelle auswaehlen...",
    },
    counts: {
      emptyTitle:
        "Keine Daten fuer dieses Konzept in {{sourceKey}}",
      emptyMessage:
        "Konzept {{conceptId}} ist im OMOP-Vokabular vorhanden, hat aber in den stratifizierten Codezaehlungen dieser Quelle keine Beobachtungen. Versuchen Sie ein anderes Konzept (das Suchfeld beschraenkt sich jetzt auf Konzepte mit Daten in {{sourceKey}}) oder wechseln Sie zu einer Quelle, die diesen Code enthaelt.",
      loading: "Zaehler werden geladen...",
      failed: "Laden der Zaehler fehlgeschlagen.",
      count: "Anzahl",
      group: "Gruppe",
      gender: "Geschlecht",
      ageDecile: "Altersdezil",
      node: "Knoten ({{count}})",
      descendant: "Nachfolger ({{count}})",
    },
    chart: {
      noData: "Keine Daten zur Anzeige",
      male: "Maennlich",
      female: "Weiblich",
      unknown: "Unbekannt",
    },
    hierarchy: {
      loading: "Hierarchie wird geladen...",
      failed: "Laden fehlgeschlagen.",
      direction: "Richtung",
      both: "Beide",
      ancestorsOnly: "Nur Vorfahren",
      descendantsOnly: "Nur Nachfolger",
      maxDepth: "Max. Tiefe",
      empty:
        "Keine Hierarchiedaten fuer dieses Konzept in Tiefe {{depth}}.",
    },
    relationships: {
      loading: "Beziehungen werden geladen...",
      failed: "Laden fehlgeschlagen.",
      empty:
        "Keine Beziehungen fuer dieses Konzept gefunden.",
      headers: {
        relationship: "Beziehung",
        targetConcept: "Zielkonzept",
        vocabulary: "Vokabular",
        standard: "Standard",
      },
    },
    reports: {
      loading: "Berichte werden geladen...",
      failed: "Laden fehlgeschlagen.",
      empty:
        "Sie haben noch keine Berichte. Gehen Sie zum Tab Bericht und erzeugen Sie einen.",
      headers: {
        created: "Erstellt",
        source: "Quelle",
        concept: "Konzept",
        status: "Status",
        pin: "Anheften",
      },
      pin: "Anheften",
      unpin: "Loesen",
      generateReport: "Bericht erzeugen",
      generating: "Wird erzeugt...",
      failedToDispatch:
        "Bericht konnte nicht uebermittelt werden.",
      progress: "{{percent}}% - {{message}}",
      failedTitle:
        "Berichtserzeugung fehlgeschlagen",
      ready: "Bericht bereit",
      downloadHtml: "HTML herunterladen",
      iframeTitle: "ROMOPAPI-Bericht",
      inlinePreviewNote:
        "Die integrierte Vorschau ist sandboxed (Skripte und Cross-Origin deaktiviert). Laden Sie die Datei fuer die voll interaktive Ansicht in Ihrem Browser herunter.",
    },
    sourceReadiness: {
      settingUp: "{{sourceKey}} wird eingerichtet...",
      sourceNeedsInitialization:
        "Quelle {{sourceKey}} muss initialisiert werden",
      missing:
        "Fehlt: {{missing}}. Dies ist eine einmalige Einrichtung nur fuer Administratoren, die die Tabelle mit stratifizierten Codezaehlungen materialisiert.",
      dispatching: "Wird uebermittelt...",
      initializeSource: "Quelle initialisieren",
      failedToDispatch:
        "Uebermittlung fehlgeschlagen. Möglicherweise fehlt Ihnen die Berechtigung `finngen.code-explorer.setup`.",
    },
  },
  gis: {
    common: {
      analysisLayerCount_one:
        "{{count}} Analyseebene aktiv",
      analysisLayerCount_other:
        "{{count}} Analyseebenen aktiv",
      avgValue: "Durchschn.: {{value}}",
      records_one: "{{count}} Datensatz",
      records_other: "{{count}} Datensaetze",
      present: "vorhanden",
    },
    page: {
      title: "GIS Explorer",
      reset: "Zuruecksetzen",
      collapse: "Einklappen",
      expand: "Ausklappen",
      enableLayers:
        "Aktivieren Sie Analyseebenen im linken Bereich",
      selectDisease:
        "Waehlen Sie eine Erkrankung aus, um die raeumliche Analyse zu beginnen",
    },
    layerPanel: {
      title: "Analyseebenen",
      privacy: "Datenschutz",
      suppressionOff:
        "Unterdrueckung: aus (synthetische Daten)",
    },
    context: {
      researchActions: "Forschungsaktionen",
      createStudy: "Studie erstellen",
      browseCohorts: "Kohorten durchsuchen",
      clickRegion:
        "Klicken Sie auf eine Region in der Karte, um Details der Ebene zu sehen",
    },
    diseaseSelector: {
      title: "Erkrankung",
      searchPlaceholder:
        "Erkrankungen suchen...",
      top: "Top",
      categories: "Kategorien",
      noMatches:
        "Keine passenden Erkrankungen",
      patientCountTitle: "{{count}} Patienten",
    },
    regionDetail: {
      loading: "Wird geladen...",
      close: "Schliessen",
      loadingDetails:
        "Regionsdetails werden geladen...",
      area: "Flaeche: {{value}} km²",
      drillDown_one:
        "Detailansicht ({{count}} Unterregion)",
      drillDown_other:
        "Detailansicht ({{count}} Unterregionen)",
      exposures: "Expositionen",
      concept: "Konzept {{conceptId}}",
    },
    countyDetail: {
      county: "County",
      cases: "Faelle",
      deaths: "Todesfaelle",
      cfr: "CFR",
      hospitalized: "Hospitalisiert",
      population: "Bevoelkerung",
      ageDistributionCovid:
        "Altersverteilung (COVID)",
      monthlyCases: "Monatliche Faelle",
      casesTitle:
        "{{period}}: {{count}} Faelle",
    },
    diseaseSummary: {
      cases: "Faelle",
      deaths: "Todesfaelle",
      cfr: "CFR",
      counties: "Counties",
      prevalence: "Praevalenz",
    },
    analysisDrawer: {
      title_one: "Analyse ({{count}} Ebene)",
      title_other: "Analyse ({{count}} Ebenen)",
    },
    layers: {
      airQuality: {
        name: "Luftqualitaet",
        description:
          "EPA PM2.5- und Ozonwerte",
        legend: {
          good: "Gut (niedriges PM2.5)",
          poor: "Schlecht (hohes PM2.5)",
        },
        analysis: {
          loading: "Wird geladen...",
          noData: "Keine Daten",
        },
        detail: {
          loading: "Wird geladen...",
          empty:
            "Keine Luftqualitaetsdaten",
          ozone: "Ozon",
        },
      },
      comorbidity: {
        name: "Komorbiditaetslast",
        description:
          "Cluster aus Diabetes, Hypertonie und Adipositas",
        legend: {
          low: "Niedrige Last (0)",
          high: "Hohe Last (3)",
        },
        tooltip: {
          burden: "Last",
        },
        analysis: {
          loading: "Wird geladen...",
          noData: "Keine Daten",
        },
        detail: {
          title:
            "Komorbiditaetsdaten fuer {{fips}}",
          subtitle:
            "Lastscore fuer Diabetes + Hypertonie + Adipositas",
        },
      },
      hospitalAccess: {
        name: "Krankenhauszugang",
        description:
          "CMS-Krankenhausnaehe",
        legend: {
          withEd: "Krankenhaus (ED)",
          withoutEd: "Krankenhaus (ohne ED)",
        },
        analysis: {
          loading: "Wird geladen...",
          noData: "Keine Daten",
        },
        detail: {
          title:
            "Naechste Krankenhaeuser zu {{fips}}",
          subtitle:
            "Entfernungsringe: 15/30/60 km",
        },
      },
      rucc: {
        name: "Staedtisch-laendlich",
        description:
          "USDA Rural-Urban Continuum Codes",
        legend: {
          metro: "Metro",
          micropolitan: "Mikropolitan",
          rural: "Laendlich",
        },
        tooltip: {
          classification: "Klassifikation",
        },
        analysis: {
          loading: "Wird geladen...",
          noData: "Keine Daten",
        },
        detail: {
          loading: "Wird geladen...",
          empty: "Keine RUCC-Daten",
          code: "RUCC-Code",
          classification: "Klassifikation",
          category: "Kategorie",
          patients: "Patienten",
        },
        categories: {
          metro: "Metro",
          micro: "Mikropolitan",
          rural: "Laendlich",
        },
      },
      svi: {
        name: "Soziale Verwundbarkeit",
        description:
          "CDC/ATSDR SVI nach Census Tract",
        legend: {
          low: "Geringe Verwundbarkeit",
          high: "Hohe Verwundbarkeit",
        },
        tooltip: {
          score: "SVI",
        },
        analysis: {
          loading: "Wird geladen...",
          noData: "Keine Daten verfuegbar",
        },
        detail: {
          loading: "Wird geladen...",
          empty: "Keine SVI-Daten",
          overall: "Gesamter SVI",
          themes: {
            socioeconomicStatus:
              "Soziooekonomischer Status",
            householdComposition:
              "Haushaltszusammensetzung",
            minorityStatus:
              "Minderheitenstatus",
            housingTransportation:
              "Wohnen und Transport",
          },
        },
      },
    },
  },
  queryAssistant: {
    page: {
      title: "Query Assistant",
      subtitle:
        "Durchsuchen Sie die OHDSI-Query-Bibliothek oder verwenden Sie KI, um SQL aus natuerlicher Sprache zu generieren",
      dialect: "Dialekt",
      default: "Standard",
      defaultTooltip:
        "Aenderungen als Systemstandard gespeichert (Super-Admin)",
      tabs: {
        library: "Query-Bibliothek",
        naturalLanguage: "Natuerliche Sprache",
      },
    },
    naturalLanguage: {
      askQuestion: "Eine Frage stellen",
      placeholder:
        "z. B. Wie viele Patienten wurden 2023 mit Typ-2-Diabetes diagnostiziert?",
      ctrlEnter:
        "Strg+Enter zum Generieren",
      tryExample: "Beispiel ausprobieren",
      examples: {
        diabetes:
          "Wie viele Patienten haben Diabetes?",
        topConditions:
          "Was sind die 10 haeufigsten Erkrankungen nach Praevalenz?",
        heartFailureAge:
          "Durchschnittsalter von Patienten mit Herzinsuffizienz",
        statins2024:
          "Arzneimittelexpositionszaehlungen fuer Statine im Jahr 2024",
      },
      generateWithAi:
        "Mit KI generieren",
      generating: "Wird generiert...",
      failedToGenerate:
        "SQL konnte nicht generiert werden. Bitte erneut versuchen.",
      queryHistory: "Query-Verlauf",
      clear: "Loeschen",
      emptyTitle:
        "Stellen Sie eine Frage, um zu beginnen",
      emptyDescription:
        "Geben Sie eine Frage in natuerlicher Sprache zu Ihren OMOP-CDM-Daten ein und die KI erzeugt die passende SQL-Abfrage.",
    },
    library: {
      searchPlaceholder:
        "Queries nach Stichwort durchsuchen...",
      indexedQueries:
        "{{count}} indexierte Queries",
      matches: "{{count}} Treffer",
      featuredTemplates:
        "{{count}} hervorgehobene Vorlagen",
      refreshing: "Aktualisierung",
      allDomains: "Alle Domaenen",
      failedToLoad:
        "Query-Bibliothek konnte nicht geladen werden.",
      noMatches:
        "Keine Queries passend zur Suche gefunden.",
      tryDifferentKeyword:
        "Versuchen Sie ein anderes Stichwort oder loeschen Sie die Filter.",
      importHint:
        "Wenn die Bibliothek leer ist, bitten Sie Ihren Administrator, Folgendes auszufuehren: php artisan query-library:import-ohdsi",
      showMoreMatches:
        "Mehr Treffer anzeigen",
    },
    results: {
      safeReadOnly: "SICHER - Nur Lesen",
      needsReview: "PRUEFUNG ERFORDERLICH",
      unsafe: "UNSICHER",
      queryLibraryMatch:
        "Treffer in der Query-Bibliothek",
      templateParameters:
        "Vorlagenparameter",
      rendering: "Rendering...",
      sqlUpdated: "SQL aktualisiert",
      renderTemplate:
        "Vorlage rendern",
      renderFailed:
        "Query-Vorlage konnte nicht gerendert werden.",
      generatedSql: "Generiertes SQL",
      aggregate: "Aggregiert",
      tablesReferenced:
        "Referenzierte Tabellen",
      explanation: "Erklaerung",
      validateSql: "SQL validieren",
      validating: "Validierung...",
      validSql: "Gueltiges SQL",
      validationFailed:
        "Validierung fehlgeschlagen",
      readOnly: "Nur Lesen",
      complexity: {
        low: "niedrige Komplexitaet",
        medium: "mittlere Komplexitaet",
        high: "hohe Komplexitaet",
      },
      renderError:
        "Query-Vorlage konnte nicht gerendert werden.",
      validateError:
        "SQL konnte nicht validiert werden.",
    },
    schemaBrowser: {
      title: "OMOP-CDM-Schema-Browser",
      failedToLoad:
        "Schema konnte nicht geladen werden.",
      clinicalTables:
        "Klinische Tabellen ({{count}})",
      vocabularyTables:
        "Vokabellisten-Tabellen ({{count}})",
      commonJoins:
        "Hauefige Joins",
      cols: "{{count}} Spalten",
      noDescription:
        "Keine Beschreibung verfuegbar.",
    },
    sqlBlock: {
      runSql: "SQL ausfuehren",
      copy: "Kopieren",
      copied: "Kopiert",
    },
    sqlRunner: {
      errorTitles: {
        explanationInsteadOfSql:
          "Die KI hat eine Erklaerung statt SQL zurueckgegeben",
        mysqlBackticks:
          "MySQL-Backticks werden nicht unterstuetzt",
        syntaxError:
          "SQL-Syntaxfehler",
        syntaxErrorNear:
          "Syntaxfehler nahe \"{{token}}\"",
        timeout:
          "Query-Zeitlimit erreicht (120 s)",
        tableNotFound:
          "Tabelle nicht gefunden",
        tableNotFoundNamed:
          "Tabelle \"{{table}}\" nicht gefunden",
        columnNotFound:
          "Spalte nicht gefunden",
        columnNotFoundNamed:
          "Spalte \"{{column}}\" nicht gefunden",
        insufficientPermissions:
          "Unzureichende Berechtigungen",
      },
      suggestions: {
        explanationInsteadOfSql: {
          first:
            "Formulieren Sie Ihre Frage genauer",
          second:
            "Verwenden Sie den Tab Query-Bibliothek, um eine vorgefertigte Vorlage zu finden",
          third:
            "Geben Sie die exakten Tabellen und Spalten an, die abgefragt werden sollen",
        },
        mysqlBackticks: {
          first:
            "PostgreSQL verwendet doppelte Anfuehrungszeichen fuer Bezeichner: \"column_name\"",
          second:
            "Die meisten OMOP-Spaltennamen benoetigen gar keine Quotes",
          third:
            "Versuchen Sie, die Query neu zu generieren - die KI verwendet manchmal MySQL-Syntax",
        },
        syntaxError: {
          first:
            "Das generierte SQL enthaelt einen Syntaxfehler - versuchen Sie eine klarere Frage",
          second:
            "Pruefen Sie auf unpassende Klammern, fehlende Kommas oder ueberfluessige Schluesselwoerter",
          third:
            "Verwenden Sie zuerst SQL validieren, um Probleme vor der Ausfuehrung zu erkennen",
        },
        timeout: {
          first:
            "Fuegen Sie genauere WHERE-Bedingungen hinzu, um weniger Daten zu scannen",
          second:
            "Fuegen Sie eine LIMIT-Klausel hinzu, um die Ergebnismenge zu begrenzen",
          third:
            "Vermeiden Sie SELECT * - waehlen Sie nur benoetigte Spalten aus",
          fourth:
            "Filtern Sie nach Datumsbereich, um den Datensatz einzugrenzen",
        },
        tableNotFound: {
          first:
            "OMOP-Tabellen muessen schemaqualifiziert werden: omop.person, omop.condition_occurrence",
          second:
            "Verwenden Sie den Schema-Browser unten auf der Seite, um Tabellennamen zu pruefen",
          third:
            "Pruefen Sie die Schreibweise - haeufige Tabellen: person, condition_occurrence, drug_exposure, measurement",
        },
        columnNotFound: {
          first:
            "Erweitern Sie die Tabelle im Schema-Browser, um verfuegbare Spalten zu sehen",
          second:
            "OMOP-Spaltennamen verwenden Unterstriche: person_id, condition_start_date",
          third:
            "Pruefen Sie, ob ein JOIN zu einer anderen Tabelle mit dieser Spalte notwendig ist",
        },
        insufficientPermissions: {
          first:
            "Diese Query wurde nicht als \"sicher\" (nur Lesen) eingestuft",
          second:
            "Nur Administratoren koennen Queries ausfuehren, die nicht als sicher markiert sind",
          third:
            "Verwenden Sie SQL validieren, um die Sicherheitseinstufung zu pruefen",
        },
      },
      defaults: {
        queryExecutionFailed:
          "Abfrageausfuehrung fehlgeschlagen",
        failedToRenderTemplate:
          "Vorlage konnte nicht gerendert werden",
        typeToSearchConcepts:
          "Tippen Sie, um OMOP-Konzepte zu suchen...",
        typeToSearchConceptsWithDefault:
          "{{defaultValue}} - tippen Sie, um OMOP-Konzepte zu suchen",
      },
      state: {
        active: "Abfrage wird ausgefuehrt...",
        idle: "Leerlauf",
        idleInTransaction:
          "Ergebnisse werden verarbeitet...",
        idleAborted:
          "Transaktion abgebrochen",
        fastpath: "Fast-Path-Aufruf",
        disabled: "Tracking deaktiviert",
        completed: "Abgeschlossen",
        error: "Fehler",
      },
      modal: {
        title: "SQL Query Runner",
        wait: "Wartezeit: {{value}}",
        preparing: "Vorbereitung...",
        runQuery: "Query ausfuehren",
        queryCompleted:
          "Query abgeschlossen",
        rowsIn:
          "{{count}} Zeilen in {{elapsed}}",
        cappedAt10k:
          "Auf 10.000 Zeilen begrenzt",
        queryFailed:
          "Query fehlgeschlagen",
        downloadCsv: "CSV herunterladen",
        close: "Schliessen",
        showingSomeRows:
          "{{shown}} von {{total}} Zeilen werden angezeigt",
        showingAllRows:
          "{{count}} Zeilen",
      },
    },
  },
});

const ptGisTools: MessageTree = mergeMessageTrees(enGisTools, {
  poseidon: {
    page: {
      unavailableTitle: "Poseidon indisponivel",
      unavailableMessage:
        "Nao foi possivel conectar ao servico de orquestracao Poseidon. Verifique se os containers do Poseidon estao em execucao.",
      retry: "Tentar novamente",
      title: "Poseidon",
      subtitle:
        "Orquestracao de atualizacao do CDM - cargas incrementais, execucao com dependencia consciente e agendamento por fonte via dbt + Dagster",
      refresh: "Atualizar",
    },
    overview: {
      activeSchedules: "Agendamentos ativos",
      runsInProgress: "Execucoes em andamento",
      successfulRuns: "Execucoes bem-sucedidas",
      failedRuns: "Execucoes com falha",
      ofTotal: "de {{count}} no total",
    },
    runStatus: {
      pending: "Pendente",
      running: "Em execucao",
      success: "Concluida",
      failed: "Falhou",
      cancelled: "Cancelada",
    },
    runType: {
      fullRefresh: "Atualizacao completa",
      vocabulary: "Vocabulario",
      incremental: "Incremental",
    },
    scheduleType: {
      manual: "Manual",
      cron: "Agendada",
      sensor: "Orientada a eventos",
    },
    schedules: {
      title: "Agendamentos por fonte",
      emptyTitle: "Nenhum agendamento configurado",
      emptyMessage:
        "Crie um agendamento do Poseidon para automatizar atualizacoes do CDM de uma fonte de dados.",
      active: "Ativo",
      paused: "Pausado",
      lastRun: "Ultima execucao: {{value}}",
      nextRun: "Proxima: {{value}}",
      runCount_one: "{{count}} execucao",
      runCount_other: "{{count}} execucoes",
      pauseSchedule: "Pausar agendamento",
      activateSchedule: "Ativar agendamento",
      pause: "Pausar",
      activate: "Ativar",
      runIncrementalRefresh:
        "Executar atualizacao incremental",
    },
    recentRuns: {
      title: "Execucoes recentes",
      emptyTitle: "Nenhuma execucao ainda",
      emptyMessage:
        "Dispare uma execucao manual ou aguarde uma execucao agendada.",
      headers: {
        source: "Fonte",
        type: "Tipo",
        status: "Status",
        trigger: "Disparo",
        duration: "Duracao",
        started: "Iniciada",
        actions: "Acoes",
      },
      cancel: "Cancelar",
    },
    runDetail: {
      title: "Execucao #{{id}}",
      type: "Tipo",
      triggeredBy: "Disparada por",
      duration: "Duracao",
      modelsRun: "Modelos executados",
      rowsInserted: "Linhas inseridas",
      rowsUpdated: "Linhas atualizadas",
      testsPassed: "Testes aprovados",
      testsFailed: "Testes com falha",
      error: "Erro",
    },
    freshness: {
      title: "Atualidade do CDM",
      assetCount_one: "{{count}} ativo",
      assetCount_other: "{{count}} ativos",
      loading:
        "Carregando dados de atualidade do Dagster...",
      emptyTitle: "Nenhum dado de atualidade",
      emptyMessage:
        "Os dados de atualidade aparecem apos pelo menos uma execucao bem-sucedida do Poseidon.",
      never: "Nunca",
    },
    lineage: {
      title: "Linhagem de ativos",
      assetCount_one: "{{count}} ativo",
      assetCount_other: "{{count}} ativos",
      loading:
        "Carregando linhagem do Dagster...",
      emptyTitle: "Nenhum dado de linhagem",
      emptyMessage:
        "A linhagem de ativos aparece depois que o Dagster descobre os modelos dbt.",
      dependsOn: "depende de: {{dependencies}}",
      tiers: {
        staging: "Staging",
        intermediate: "Intermediario",
        cdm: "CDM",
        quality: "Qualidade",
        fallback: "Camada {{index}}",
      },
    },
  },
  jupyter: {
    status: {
      hubOnline: "Hub online",
      unavailable: "Indisponivel",
      authenticating: "Autenticando...",
      startingServer: "Iniciando servidor...",
      running: "Em execucao",
      failed: "Falhou",
    },
    page: {
      title: "Workbench Jupyter",
      subtitle:
        "Seu ambiente pessoal de notebooks para pesquisa interativa, analises personalizadas e exploracao de dados",
      refresh: "Atualizar",
      openInNewTab: "Abrir em nova guia",
      workspaceDetails:
        "Detalhes do workspace",
      checkingHub: "Verificando o JupyterHub...",
      iframeTitle: "Parthenon Jupyter",
      startOverlay:
        "Iniciando seu servidor de notebooks...",
      firstLaunchNote:
        "Isso pode levar ate 30 segundos no primeiro inicio",
      failedToStart:
        "Falha ao iniciar o servidor de notebooks",
      retry: "Tentar novamente",
      failedToCreateSession:
        "Falha ao criar sessao",
    },
    unavailable: {
      title: "JupyterHub nao esta acessivel",
      message:
        "O servico de notebooks esta indisponivel no momento. Atualize quando o container estiver saudavel.",
    },
    drawer: {
      title: "Detalhes do workspace Jupyter",
      environment: "Ambiente",
      runtime: "Runtime",
      runtimeDescription:
        "Python 3.12 com pandas, polars, sqlalchemy e acesso ao banco baseado em papeis.",
      privateWorkspace: "Workspace privado",
      privateWorkspaceDescription:
        "Seu diretorio pessoal de notebooks. Persiste entre sessoes - seu trabalho esta sempre salvo.",
      sharedFolder: "Pasta compartilhada",
      sharedFolderDescription:
        "Copie notebooks aqui para compartilhar com colegas. Todos os usuarios do Jupyter podem ler esta pasta.",
      mountedPaths: "Caminhos montados",
      starterNotebooks:
        "Notebooks iniciais",
      noStarterNotebooks:
        "Nenhum notebook inicial disponivel.",
      tips: "Dicas",
      quickLinks: "Links rapidos",
      openHubNewTab:
        "Abrir JupyterHub em nova guia",
      defaults: {
        privateWorkspace: "/home/jovyan/notebooks",
        sharedFolder: "/home/jovyan/shared",
      },
    },
  },
  codeExplorer: {
    page: {
      title: "Explorador de codigos",
      concept: "Conceito",
      searchPlaceholder:
        "Pesquisar conceitos com dados nesta fonte",
      pickSource:
        "Escolha uma fonte para comecar.",
      pickSourceAndConcept:
        "Escolha uma fonte e um conceito para visualizar os dados.",
    },
    tabs: {
      counts: "Contagens",
      relationships: "Relacionamentos",
      hierarchy: "Hierarquia",
      report: "Relatorio",
      myReports: "Meus relatorios",
    },
    sourcePicker: {
      loading: "Carregando fontes...",
      empty: "Nenhuma fonte configurada",
      label: "Fonte de dados",
      choose: "Escolha uma fonte...",
    },
    counts: {
      emptyTitle:
        "Nenhum dado para este conceito em {{sourceKey}}",
      emptyMessage:
        "O conceito {{conceptId}} esta no vocabulario OMOP, mas nao possui observacoes nesta tabela de contagens estratificadas da fonte. Tente outro conceito (a busca agora se limita a conceitos com dados em {{sourceKey}}) ou mude para uma fonte que contenha esse codigo.",
      loading: "Carregando contagens...",
      failed: "Falha ao carregar contagens.",
      count: "Contagem",
      group: "Grupo",
      gender: "Sexo",
      ageDecile: "Decil de idade",
      node: "No ({{count}})",
      descendant: "Descendente ({{count}})",
    },
    chart: {
      noData:
        "Nenhum dado para exibir",
      male: "Masculino",
      female: "Feminino",
      unknown: "Desconhecido",
    },
    hierarchy: {
      loading: "Carregando hierarquia...",
      failed: "Falha ao carregar.",
      direction: "Direcao",
      both: "Ambos",
      ancestorsOnly: "Somente ancestrais",
      descendantsOnly: "Somente descendentes",
      maxDepth: "Profundidade maxima",
      empty:
        "Nenhum dado de hierarquia para este conceito na profundidade {{depth}}.",
    },
    relationships: {
      loading:
        "Carregando relacionamentos...",
      failed: "Falha ao carregar.",
      empty:
        "Nenhum relacionamento encontrado para este conceito.",
      headers: {
        relationship: "Relacionamento",
        targetConcept:
          "Conceito de destino",
        vocabulary: "Vocabulario",
        standard: "Padrao",
      },
    },
    reports: {
      loading: "Carregando relatorios...",
      failed: "Falha ao carregar.",
      empty:
        "Voce ainda nao tem relatorios. Va para a aba Relatorio e gere um.",
      headers: {
        created: "Criado",
        source: "Fonte",
        concept: "Conceito",
        status: "Status",
        pin: "Fixar",
      },
      pin: "Fixar",
      unpin: "Desafixar",
      generateReport:
        "Gerar relatorio",
      generating: "Gerando...",
      failedToDispatch:
        "Falha ao despachar relatorio.",
      progress: "{{percent}}% - {{message}}",
      failedTitle:
        "Falha na geracao do relatorio",
      ready: "Relatorio pronto",
      downloadHtml: "Baixar HTML",
      iframeTitle: "Relatorio ROMOPAPI",
      inlinePreviewNote:
        "A visualizacao inline esta sandboxed (scripts e cross-origin desativados). Baixe o arquivo para ter a visualizacao interativa completa no navegador.",
    },
    sourceReadiness: {
      settingUp:
        "Configurando {{sourceKey}}...",
      sourceNeedsInitialization:
        "A fonte {{sourceKey}} precisa ser inicializada",
      missing:
        "Faltando: {{missing}}. Esta e uma configuracao unica, restrita a administradores, que materializa a tabela de contagens estratificadas de codigo.",
      dispatching: "Despachando...",
      initializeSource:
        "Inicializar fonte",
      failedToDispatch:
        "Falha ao despachar. Talvez voce nao tenha a permissao `finngen.code-explorer.setup`.",
    },
  },
  gis: {
    common: {
      analysisLayerCount_one:
        "{{count}} camada de analise ativa",
      analysisLayerCount_other:
        "{{count}} camadas de analise ativas",
      avgValue: "med: {{value}}",
      records_one: "{{count}} registro",
      records_other: "{{count}} registros",
      present: "presente",
    },
    page: {
      title: "Explorador GIS",
      reset: "Redefinir",
      collapse: "Recolher",
      expand: "Expandir",
      enableLayers:
        "Ative camadas de analise no painel esquerdo",
      selectDisease:
        "Selecione uma doenca para iniciar a analise espacial",
    },
    layerPanel: {
      title: "Camadas de analise",
      privacy: "Privacidade",
      suppressionOff:
        "Supressao: desligada (dados sinteticos)",
    },
    context: {
      researchActions:
        "Acoes de pesquisa",
      createStudy: "Criar estudo",
      browseCohorts:
        "Explorar coortes",
      clickRegion:
        "Clique em uma regiao no mapa para ver detalhes da camada",
    },
    diseaseSelector: {
      title: "Doenca",
      searchPlaceholder:
        "Pesquisar condicoes...",
      top: "Top",
      categories: "Categorias",
      noMatches:
        "Nenhuma condicao correspondente",
      patientCountTitle: "{{count}} pacientes",
    },
    regionDetail: {
      loading: "Carregando...",
      close: "Fechar",
      loadingDetails:
        "Carregando detalhes da regiao...",
      area: "Area: {{value}} km²",
      drillDown_one:
        "Aprofundar ({{count}} sub-regiao)",
      drillDown_other:
        "Aprofundar ({{count}} sub-regioes)",
      exposures: "Exposicoes",
      concept: "Conceito {{conceptId}}",
    },
    countyDetail: {
      county: "County",
      cases: "Casos",
      deaths: "Obitos",
      cfr: "CFR",
      hospitalized: "Hospitalizados",
      population: "Populacao",
      ageDistributionCovid:
        "Distribuicao etaria (COVID)",
      monthlyCases: "Casos mensais",
      casesTitle:
        "{{period}}: {{count}} casos",
    },
    diseaseSummary: {
      cases: "Casos",
      deaths: "Obitos",
      cfr: "CFR",
      counties: "Counties",
      prevalence: "Prevalencia",
    },
    analysisDrawer: {
      title_one: "Analise ({{count}} camada)",
      title_other: "Analise ({{count}} camadas)",
    },
    layers: {
      airQuality: {
        name: "Qualidade do ar",
        description:
          "Niveis de PM2.5 e ozonio da EPA",
        legend: {
          good: "Boa (PM2.5 baixo)",
          poor: "Ruim (PM2.5 alto)",
        },
        analysis: {
          loading: "Carregando...",
          noData: "Sem dados",
        },
        detail: {
          loading: "Carregando...",
          empty:
            "Nenhum dado de qualidade do ar",
          ozone: "Ozonio",
        },
      },
      comorbidity: {
        name: "Carga de comorbidades",
        description:
          "Agrupamento de DM, HAS e obesidade",
        legend: {
          low: "Carga baixa (0)",
          high: "Carga alta (3)",
        },
        tooltip: {
          burden: "Carga",
        },
        analysis: {
          loading: "Carregando...",
          noData: "Sem dados",
        },
        detail: {
          title:
            "Dados de comorbidade para {{fips}}",
          subtitle:
            "Score de carga DM + HAS + obesidade",
        },
      },
      hospitalAccess: {
        name: "Acesso hospitalar",
        description:
          "Proximidade hospitalar CMS",
        legend: {
          withEd: "Hospital (PS)",
          withoutEd: "Hospital (sem PS)",
        },
        analysis: {
          loading: "Carregando...",
          noData: "Sem dados",
        },
        detail: {
          title:
            "Hospitais mais proximos de {{fips}}",
          subtitle:
            "Aneis de distancia: 15/30/60 km",
        },
      },
      rucc: {
        name: "Urbano-rural",
        description:
          "Codigos Rural-Urban Continuum do USDA",
        legend: {
          metro: "Metro",
          micropolitan: "Micropolitano",
          rural: "Rural",
        },
        tooltip: {
          classification: "Classificacao",
        },
        analysis: {
          loading: "Carregando...",
          noData: "Sem dados",
        },
        detail: {
          loading: "Carregando...",
          empty: "Nenhum dado RUCC",
          code: "Codigo RUCC",
          classification: "Classificacao",
          category: "Categoria",
          patients: "Pacientes",
        },
        categories: {
          metro: "Metro",
          micro: "Micropolitano",
          rural: "Rural",
        },
      },
      svi: {
        name: "Vulnerabilidade social",
        description:
          "SVI CDC/ATSDR por setor censitario",
        legend: {
          low: "Baixa vulnerabilidade",
          high: "Alta vulnerabilidade",
        },
        tooltip: {
          score: "SVI",
        },
        analysis: {
          loading: "Carregando...",
          noData:
            "Nenhum dado disponivel",
        },
        detail: {
          loading: "Carregando...",
          empty: "Nenhum dado SVI",
          overall: "SVI geral",
          themes: {
            socioeconomicStatus:
              "Status socioeconomico",
            householdComposition:
              "Composicao domiciliar",
            minorityStatus:
              "Status de minoria",
            housingTransportation:
              "Moradia e transporte",
          },
        },
      },
    },
  },
  queryAssistant: {
    page: {
      title: "Assistente de consultas",
      subtitle:
        "Navegue pela biblioteca de consultas OHDSI ou use IA para gerar SQL a partir de linguagem natural",
      dialect: "Dialeto",
      default: "Padrao",
      defaultTooltip:
        "Alteracoes salvas como padrao do sistema (super-admin)",
      tabs: {
        library: "Biblioteca de consultas",
        naturalLanguage: "Linguagem natural",
      },
    },
    naturalLanguage: {
      askQuestion: "Fazer uma pergunta",
      placeholder:
        "ex. Quantos pacientes foram diagnosticados com diabetes tipo 2 em 2023?",
      ctrlEnter: "Ctrl+Enter para gerar",
      tryExample: "Experimentar um exemplo",
      examples: {
        diabetes:
          "Quantos pacientes tem diabetes?",
        topConditions:
          "Quais sao as 10 principais condicoes por prevalencia?",
        heartFailureAge:
          "Idade media de pacientes com insuficiencia cardiaca",
        statins2024:
          "Contagens de exposicao a estatinas em 2024",
      },
      generateWithAi:
        "Gerar com IA",
      generating: "Gerando...",
      failedToGenerate:
        "Falha ao gerar SQL. Tente novamente.",
      queryHistory:
        "Historico de consultas",
      clear: "Limpar",
      emptyTitle:
        "Faca uma pergunta para comecar",
      emptyDescription:
        "Digite uma pergunta em linguagem natural sobre seus dados OMOP CDM e a IA gerara a consulta SQL correspondente.",
    },
    library: {
      searchPlaceholder:
        "Pesquisar consultas por palavra-chave...",
      indexedQueries:
        "{{count}} consultas indexadas",
      matches: "{{count}} correspondencias",
      featuredTemplates:
        "{{count}} modelos em destaque",
      refreshing: "Atualizando",
      allDomains: "Todos os dominios",
      failedToLoad:
        "Falha ao carregar a biblioteca de consultas.",
      noMatches:
        "Nenhuma consulta encontrada para sua busca.",
      tryDifferentKeyword:
        "Tente outra palavra-chave ou limpe os filtros.",
      importHint:
        "Se a biblioteca estiver vazia, peca ao administrador para executar: php artisan query-library:import-ohdsi",
      showMoreMatches:
        "Mostrar mais correspondencias",
    },
    results: {
      safeReadOnly:
        "SEGURO - Somente leitura",
      needsReview:
        "PRECISA DE REVISAO",
      unsafe: "NAO SEGURO",
      queryLibraryMatch:
        "Correspondencia na biblioteca de consultas",
      templateParameters:
        "Parametros do modelo",
      rendering: "Renderizando...",
      sqlUpdated: "SQL atualizado",
      renderTemplate:
        "Renderizar modelo",
      renderFailed:
        "Falha ao renderizar o modelo de consulta.",
      generatedSql: "SQL gerado",
      aggregate: "Agregado",
      tablesReferenced:
        "Tabelas referenciadas",
      explanation: "Explicacao",
      validateSql:
        "Validar SQL",
      validating: "Validando...",
      validSql: "SQL valido",
      validationFailed:
        "Falha na validacao",
      readOnly: "Somente leitura",
      complexity: {
        low: "baixa complexidade",
        medium: "complexidade media",
        high: "alta complexidade",
      },
      renderError:
        "Falha ao renderizar o modelo de consulta.",
      validateError:
        "Falha ao validar o SQL.",
    },
    schemaBrowser: {
      title:
        "Navegador de schema OMOP CDM",
      failedToLoad:
        "Falha ao carregar o schema.",
      clinicalTables:
        "Tabelas clinicas ({{count}})",
      vocabularyTables:
        "Tabelas de vocabulario ({{count}})",
      commonJoins:
        "Joins comuns",
      cols: "{{count}} colunas",
      noDescription:
        "Nenhuma descricao disponivel.",
    },
    sqlBlock: {
      runSql: "Executar SQL",
      copy: "Copiar",
      copied: "Copiado",
    },
    sqlRunner: {
      errorTitles: {
        explanationInsteadOfSql:
          "A IA retornou uma explicacao em vez de SQL",
        mysqlBackticks:
          "Backticks no estilo MySQL nao sao suportados",
        syntaxError:
          "Erro de sintaxe SQL",
        syntaxErrorNear:
          "Erro de sintaxe perto de \"{{token}}\"",
        timeout:
          "Tempo limite da consulta excedido (120 s)",
        tableNotFound:
          "Tabela nao encontrada",
        tableNotFoundNamed:
          "Tabela \"{{table}}\" nao encontrada",
        columnNotFound:
          "Coluna nao encontrada",
        columnNotFoundNamed:
          "Coluna \"{{column}}\" nao encontrada",
        insufficientPermissions:
          "Permissoes insuficientes",
      },
      suggestions: {
        explanationInsteadOfSql: {
          first:
            "Tente reformular a pergunta de forma mais especifica",
          second:
            "Use a aba Biblioteca de consultas para encontrar um modelo pre-pronto",
          third:
            "Especifique as tabelas e colunas exatas que deseja consultar",
        },
        mysqlBackticks: {
          first:
            "O PostgreSQL usa aspas duplas para identificadores: \"column_name\"",
          second:
            "A maioria dos nomes de coluna do OMOP nem precisa de aspas",
          third:
            "Tente gerar a consulta novamente - a IA as vezes usa sintaxe MySQL",
        },
        syntaxError: {
          first:
            "O SQL gerado tem um problema de sintaxe - tente gerar novamente com uma pergunta mais clara",
          second:
            "Verifique parenteses desencontrados, virgulas ausentes ou palavras-chave extras",
          third:
            "Use primeiro o botao Validar SQL para detectar problemas antes de executar",
        },
        timeout: {
          first:
            "Adicione condicoes WHERE mais especificas para reduzir os dados analisados",
          second:
            "Adicione uma clausula LIMIT para limitar o conjunto de resultados",
          third:
            "Evite SELECT * - selecione apenas as colunas necessarias",
          fourth:
            "Considere filtrar por intervalo de datas para restringir o conjunto de dados",
        },
        tableNotFound: {
          first:
            "As tabelas OMOP devem ser qualificadas por schema: omop.person, omop.condition_occurrence",
          second:
            "Use o navegador de schema no fim da pagina para verificar os nomes das tabelas",
          third:
            "Confira a grafia - tabelas comuns: person, condition_occurrence, drug_exposure, measurement",
        },
        columnNotFound: {
          first:
            "Expanda a tabela no navegador de schema para ver as colunas disponiveis",
          second:
            "Os nomes de colunas OMOP usam underscore: person_id, condition_start_date",
          third:
            "Verifique se voce precisa de um JOIN com outra tabela que possua essa coluna",
        },
        insufficientPermissions: {
          first:
            "Esta consulta nao foi classificada como \"segura\" (somente leitura)",
          second:
            "Somente administradores podem executar consultas nao marcadas como seguras",
          third:
            "Use Validar SQL para verificar a classificacao de seguranca",
        },
      },
      defaults: {
        queryExecutionFailed:
          "Falha na execucao da consulta",
        failedToRenderTemplate:
          "Falha ao renderizar o modelo",
        typeToSearchConcepts:
          "Digite para pesquisar conceitos OMOP...",
        typeToSearchConceptsWithDefault:
          "{{defaultValue}} - digite para pesquisar conceitos OMOP",
      },
      state: {
        active: "Executando consulta...",
        idle: "Ocioso",
        idleInTransaction:
          "Processando resultados...",
        idleAborted:
          "Transacao abortada",
        fastpath:
          "Chamada fast path",
        disabled:
          "Rastreamento desativado",
        completed: "Concluida",
        error: "Erro",
      },
      modal: {
        title: "Executor de consultas SQL",
        wait: "Espera: {{value}}",
        preparing: "Preparando...",
        runQuery:
          "Executar consulta",
        queryCompleted:
          "Consulta concluida",
        rowsIn:
          "{{count}} linhas em {{elapsed}}",
        cappedAt10k:
          "Limitado a 10.000 linhas",
        queryFailed:
          "A consulta falhou",
        downloadCsv:
          "Baixar CSV",
        close: "Fechar",
        showingSomeRows:
          "Mostrando {{shown}} de {{total}} linhas",
        showingAllRows:
          "{{count}} linhas",
      },
    },
  },
});

export const gisToolsResources: Record<string, MessageTree> = {
  "en-US": enGisTools,
  "es-ES": mergeMessageTrees(enGisTools, {}),
  "fr-FR": frGisTools,
  "de-DE": deGisTools,
  "pt-BR": ptGisTools,
  "fi-FI": mergeMessageTrees(enGisTools, {}),
  "ja-JP": mergeMessageTrees(enGisTools, {}),
  "zh-Hans": mergeMessageTrees(enGisTools, {}),
  "ko-KR": mergeMessageTrees(enGisTools, {}),
  "hi-IN": mergeMessageTrees(enGisTools, {}),
  ar: mergeMessageTrees(enGisTools, {}),
  "en-XA": mergeMessageTrees(enGisTools, {}),
};
