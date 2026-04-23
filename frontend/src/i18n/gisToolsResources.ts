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

const esGisTools: MessageTree = mergeMessageTrees(enGisTools, {
  poseidon: {
    page: {
      unavailableTitle: "Poseidon no disponible",
      unavailableMessage:
        "No se pudo conectar con el servicio de orquestacion de Poseidon. Verifique que los contenedores de Poseidon esten en ejecucion.",
      retry: "Reintentar",
      title: "Poseidon",
      subtitle:
        "Orquestacion de actualizacion del CDM: cargas incrementales, ejecucion con dependencias y programacion por fuente mediante dbt + Dagster",
      refresh: "Actualizar",
    },
    overview: {
      activeSchedules: "Programaciones activas",
      runsInProgress: "Ejecuciones en curso",
      successfulRuns: "Ejecuciones exitosas",
      failedRuns: "Ejecuciones fallidas",
      ofTotal: "de {{count}} en total",
    },
    runStatus: {
      pending: "Pendiente",
      running: "En ejecucion",
      success: "Completada",
      failed: "Fallida",
      cancelled: "Cancelada",
    },
    runType: {
      fullRefresh: "Actualizacion completa",
      vocabulary: "Vocabulario",
      incremental: "Incremental",
    },
    scheduleType: {
      manual: "Manual",
      cron: "Programada",
      sensor: "Impulsada por eventos",
    },
    schedules: {
      title: "Programaciones por fuente",
      emptyTitle: "No hay programaciones configuradas",
      emptyMessage:
        "Cree una programacion de Poseidon para automatizar las actualizaciones del CDM de una fuente de datos.",
      active: "Activa",
      paused: "Pausada",
      lastRun: "Ultima ejecucion: {{value}}",
      nextRun: "Proxima: {{value}}",
      runCount_one: "{{count}} ejecucion",
      runCount_other: "{{count}} ejecuciones",
      pauseSchedule: "Pausar programacion",
      activateSchedule: "Activar programacion",
      pause: "Pausar",
      activate: "Activar",
      runIncrementalRefresh: "Ejecutar actualizacion incremental",
    },
    recentRuns: {
      title: "Ejecuciones recientes",
      emptyTitle: "Todavia no hay ejecuciones",
      emptyMessage:
        "Inicie una ejecucion manual o espere una ejecucion programada.",
      headers: {
        source: "Fuente",
        type: "Tipo",
        status: "Estado",
        trigger: "Disparador",
        duration: "Duracion",
        started: "Inicio",
        actions: "Acciones",
      },
      cancel: "Cancelar",
    },
    runDetail: {
      title: "Ejecucion n.° {{id}}",
      type: "Tipo",
      triggeredBy: "Iniciada por",
      duration: "Duracion",
      modelsRun: "Modelos ejecutados",
      rowsInserted: "Filas insertadas",
      rowsUpdated: "Filas actualizadas",
      testsPassed: "Pruebas aprobadas",
      testsFailed: "Pruebas fallidas",
      error: "Error",
    },
    freshness: {
      title: "Actualidad del CDM",
      assetCount_one: "{{count}} activo",
      assetCount_other: "{{count}} activos",
      loading: "Cargando datos de actualidad desde Dagster...",
      emptyTitle: "No hay datos de actualidad",
      emptyMessage:
        "Los datos de actualidad aparecen despues de al menos una ejecucion exitosa de Poseidon.",
      never: "Nunca",
    },
    lineage: {
      title: "Linaje de activos",
      assetCount_one: "{{count}} activo",
      assetCount_other: "{{count}} activos",
      loading: "Cargando linaje desde Dagster...",
      emptyTitle: "No hay datos de linaje",
      emptyMessage:
        "El linaje de activos aparece despues de que Dagster descubre los modelos dbt.",
      dependsOn: "depende de: {{dependencies}}",
      tiers: {
        staging: "Staging",
        intermediate: "Intermedio",
        cdm: "CDM",
        quality: "Calidad",
        fallback: "Nivel {{index}}",
      },
    },
  },
  jupyter: {
    status: {
      hubOnline: "Hub en linea",
      unavailable: "No disponible",
      authenticating: "Autenticando...",
      startingServer: "Iniciando servidor...",
      running: "En ejecucion",
      failed: "Fallido",
    },
    page: {
      title: "Entorno de Jupyter",
      subtitle:
        "Su entorno personal de notebooks para investigacion interactiva, analisis personalizados y exploracion de datos",
      refresh: "Actualizar",
      openInNewTab: "Abrir en una nueva pestaña",
      workspaceDetails: "Detalles del espacio de trabajo",
      checkingHub: "Comprobando JupyterHub...",
      iframeTitle: "Jupyter de Parthenon",
      startOverlay: "Iniciando su servidor de notebooks...",
      firstLaunchNote: "La primera vez puede tardar hasta 30 segundos",
      failedToStart: "No se pudo iniciar el servidor de notebooks",
      retry: "Reintentar",
      failedToCreateSession: "No se pudo crear la sesion",
    },
    unavailable: {
      title: "No se puede acceder a JupyterHub",
      message:
        "El servicio de notebooks no esta disponible en este momento. Actualice cuando el contenedor este en buen estado.",
    },
    drawer: {
      title: "Detalles del espacio de trabajo de Jupyter",
      environment: "Entorno",
      runtime: "Runtime",
      runtimeDescription:
        "Python 3.12 con pandas, polars, sqlalchemy y acceso a base de datos segun el rol.",
      privateWorkspace: "Espacio privado",
      privateWorkspaceDescription:
        "Su directorio personal de notebooks. Se conserva entre sesiones, por lo que su trabajo siempre queda guardado.",
      sharedFolder: "Carpeta compartida",
      sharedFolderDescription:
        "Copie notebooks aqui para compartirlos con colegas. Todos los usuarios de Jupyter pueden leer esta carpeta.",
      mountedPaths: "Rutas montadas",
      starterNotebooks: "Notebooks iniciales",
      noStarterNotebooks: "No hay notebooks iniciales disponibles.",
      tips: "Consejos",
      quickLinks: "Enlaces rapidos",
      openHubNewTab: "Abrir JupyterHub en una nueva pestaña",
    },
  },
  codeExplorer: {
    page: {
      title: "Explorador de codigos",
      concept: "Concepto",
      searchPlaceholder: "Buscar conceptos con datos en esta fuente",
      pickSource: "Elija una fuente para comenzar.",
      pickSourceAndConcept:
        "Elija una fuente y un concepto para ver los datos.",
    },
    tabs: {
      counts: "Conteos",
      relationships: "Relaciones",
      hierarchy: "Jerarquia",
      report: "Informe",
      myReports: "Mis informes",
    },
    sourcePicker: {
      loading: "Cargando fuentes...",
      empty: "No hay fuentes configuradas",
      label: "Fuente de datos",
      choose: "Elija una fuente...",
    },
    counts: {
      emptyTitle: "No hay datos para este concepto en {{sourceKey}}",
      emptyMessage:
        "El concepto {{conceptId}} existe en el vocabulario OMOP, pero no tiene observaciones en los conteos estratificados de codigos de esta fuente. Pruebe con otro concepto (la busqueda ahora se limita a conceptos con datos en {{sourceKey}}) o cambie a una fuente que incluya este codigo.",
      loading: "Cargando conteos...",
      failed: "No se pudieron cargar los conteos.",
      count: "Conteo",
      group: "Grupo",
      gender: "Sexo",
      ageDecile: "Decil de edad",
      node: "Nodo ({{count}})",
      descendant: "Descendiente ({{count}})",
    },
    chart: {
      noData: "No hay datos para mostrar",
      male: "Masculino",
      female: "Femenino",
      unknown: "Desconocido",
    },
    hierarchy: {
      loading: "Cargando jerarquia...",
      failed: "No se pudo cargar.",
      direction: "Direccion",
      both: "Ambas",
      ancestorsOnly: "Solo ancestros",
      descendantsOnly: "Solo descendientes",
      maxDepth: "Profundidad maxima",
      empty: "No hay datos jerarquicos para este concepto a la profundidad {{depth}}.",
    },
    relationships: {
      loading: "Cargando relaciones...",
      failed: "No se pudo cargar.",
      empty: "No se encontraron relaciones para este concepto.",
      headers: {
        relationship: "Relacion",
        targetConcept: "Concepto de destino",
        vocabulary: "Vocabulario",
        standard: "Estandar",
      },
    },
    reports: {
      loading: "Cargando informes...",
      failed: "No se pudo cargar.",
      empty: "Todavia no tiene informes. Vaya a la pestaña Informe y genere uno.",
      headers: {
        created: "Creado",
        source: "Fuente",
        concept: "Concepto",
        status: "Estado",
        pin: "Fijar",
      },
      pin: "Fijar",
      unpin: "Desfijar",
      generateReport: "Generar informe",
      generating: "Generando...",
      failedToDispatch: "No se pudo enviar el informe.",
      progress: "{{percent}}% - {{message}}",
      failedTitle: "La generacion del informe fallo",
      ready: "Informe listo",
      downloadHtml: "Descargar HTML",
      iframeTitle: "Informe de ROMOPAPI",
      inlinePreviewNote:
        "La vista previa integrada esta aislada en sandbox (scripts y cross-origin deshabilitados). Descargue el archivo para ver la experiencia interactiva completa en su navegador.",
    },
    sourceReadiness: {
      settingUp: "Configurando {{sourceKey}}...",
      sourceNeedsInitialization: "La fuente {{sourceKey}} necesita inicializacion",
      missing:
        "Falta: {{missing}}. Esta es una configuracion unica, solo para administradores, que materializa la tabla de conteos estratificados de codigos.",
      dispatching: "Enviando...",
      initializeSource: "Inicializar fuente",
      failedToDispatch:
        "No se pudo enviar. Es posible que no tenga el permiso `finngen.code-explorer.setup`.",
    },
  },
  gis: {
    common: {
      analysisLayerCount_one: "{{count}} capa de analisis activa",
      analysisLayerCount_other: "{{count}} capas de analisis activas",
      avgValue: "prom.: {{value}}",
      records_one: "{{count}} registro",
      records_other: "{{count}} registros",
      present: "presente",
      unknownRegion: "Region",
    },
    page: {
      title: "Explorador GIS",
      reset: "Restablecer",
      collapse: "Contraer",
      expand: "Expandir",
      enableLayers: "Active capas de analisis en el panel izquierdo",
      selectDisease: "Seleccione una enfermedad para iniciar el analisis espacial",
    },
    layerPanel: {
      title: "Capas de analisis",
      privacy: "Privacidad",
      suppressionOff: "Supresion: desactivada (datos sinteticos)",
    },
    context: {
      researchActions: "Acciones de investigacion",
      createStudy: "Crear estudio",
      browseCohorts: "Explorar cohortes",
      clickRegion: "Haga clic en una region del mapa para ver los detalles de la capa",
    },
    diseaseSelector: {
      title: "Enfermedad",
      searchPlaceholder: "Buscar afecciones...",
      top: "Principales",
      categories: "Categorias",
      noMatches: "No hay afecciones coincidentes",
      patientCountTitle: "{{count}} pacientes",
    },
    regionDetail: {
      loading: "Cargando...",
      close: "Cerrar",
      loadingDetails: "Cargando detalles de la region...",
      area: "Area: {{value}} km²",
      drillDown_one: "Profundizar ({{count}} subregion)",
      drillDown_other: "Profundizar ({{count}} subregiones)",
      exposures: "Exposiciones",
      concept: "Concepto {{conceptId}}",
    },
    countyDetail: {
      county: "Condado",
      cases: "Casos",
      deaths: "Muertes",
      cfr: "Letalidad",
      hospitalized: "Hospitalizados",
      population: "Poblacion",
      ageDistributionCovid: "Distribucion por edad (COVID)",
      monthlyCases: "Casos mensuales",
      casesTitle: "{{period}}: {{count}} casos",
    },
    diseaseSummary: {
      cases: "Casos",
      deaths: "Muertes",
      cfr: "Letalidad",
      counties: "Condados",
      prevalence: "Prevalencia",
    },
    analysisDrawer: {
      title_one: "Analisis ({{count}} capa)",
      title_other: "Analisis ({{count}} capas)",
    },
    layers: {
      airQuality: {
        name: "Calidad del aire",
        description: "Niveles de PM2.5 y ozono de la EPA",
        legend: {
          good: "Buena (PM2.5 bajo)",
          poor: "Mala (PM2.5 alto)",
        },
        analysis: {
          loading: "Cargando...",
          noData: "Sin datos",
        },
        detail: {
          loading: "Cargando...",
          empty: "No hay datos de calidad del aire",
          ozone: "Ozono",
        },
      },
      comorbidity: {
        name: "Carga de comorbilidad",
        description: "Agrupacion de DM, HTA y obesidad",
        legend: {
          low: "Carga baja (0)",
          high: "Carga alta (3)",
        },
        tooltip: {
          burden: "Carga",
        },
        analysis: {
          loading: "Cargando...",
          noData: "Sin datos",
        },
        detail: {
          title: "Datos de comorbilidad para {{fips}}",
          subtitle: "Puntaje de carga DM + HTA + obesidad",
        },
      },
      hospitalAccess: {
        name: "Acceso hospitalario",
        description: "Proximidad hospitalaria CMS",
        legend: {
          withEd: "Hospital (urgencias)",
          withoutEd: "Hospital (sin urgencias)",
        },
        analysis: {
          loading: "Cargando...",
          noData: "Sin datos",
        },
        detail: {
          title: "Hospitales mas cercanos a {{fips}}",
          subtitle: "Anillos de distancia: 15/30/60 km",
        },
      },
      rucc: {
        name: "Urbano-rural",
        description: "Codigos Rural-Urban Continuum del USDA",
        legend: {
          metro: "Metropolitano",
          micropolitan: "Micropolitano",
          rural: "Rural",
        },
        tooltip: {
          classification: "Clasificacion",
        },
        analysis: {
          loading: "Cargando...",
          noData: "Sin datos",
        },
        detail: {
          loading: "Cargando...",
          empty: "No hay datos RUCC",
          code: "Codigo RUCC",
          classification: "Clasificacion",
          category: "Categoria",
          patients: "Pacientes",
        },
        categories: {
          metro: "Metropolitano",
          micro: "Micropolitano",
          rural: "Rural",
        },
      },
      svi: {
        name: "Vulnerabilidad social",
        description: "SVI de CDC/ATSDR por tracto censal",
        legend: {
          low: "Baja vulnerabilidad",
          high: "Alta vulnerabilidad",
        },
        tooltip: {
          score: "Indice SVI",
        },
        analysis: {
          loading: "Cargando...",
          noData: "No hay datos disponibles",
        },
        detail: {
          loading: "Cargando...",
          empty: "No hay datos de SVI",
          overall: "SVI general",
          themes: {
            socioeconomicStatus: "Estado socioeconomico",
            householdComposition: "Composicion del hogar",
            minorityStatus: "Condicion de minoria",
            housingTransportation: "Vivienda y transporte",
          },
        },
      },
    },
  },
  queryAssistant: {
    page: {
      title: "Asistente de consultas",
      subtitle:
        "Explore la biblioteca de consultas de OHDSI o use IA para generar SQL a partir de lenguaje natural",
      dialect: "Dialecto",
      default: "Predeterminado",
      defaultTooltip: "Los cambios se guardan como valor predeterminado del sistema (superadministrador)",
      tabs: {
        library: "Biblioteca de consultas",
        naturalLanguage: "Lenguaje natural",
      },
    },
    naturalLanguage: {
      askQuestion: "Hacer una pregunta",
      placeholder: "p. ej. Cuantos pacientes fueron diagnosticados con diabetes tipo 2 en 2023?",
      ctrlEnter: "Ctrl+Enter para generar",
      tryExample: "Probar un ejemplo",
      examples: {
        diabetes: "Cuantos pacientes tienen diabetes?",
        topConditions: "Cuales son las 10 afecciones con mayor prevalencia?",
        heartFailureAge: "Edad promedio de pacientes con insuficiencia cardiaca",
        statins2024: "Conteos de exposicion a estatinas en 2024",
      },
      generateWithAi: "Generar con IA",
      generating: "Generando...",
      failedToGenerate: "No se pudo generar SQL. Intentelo de nuevo.",
      queryHistory: "Historial de consultas",
      clear: "Limpiar",
      emptyTitle: "Haga una pregunta para comenzar",
      emptyDescription:
        "Escriba una pregunta en lenguaje natural sobre sus datos OMOP CDM y la IA generara la consulta SQL correspondiente.",
    },
    library: {
      searchPlaceholder: "Buscar consultas por palabra clave...",
      indexedQueries: "{{count}} consultas indexadas",
      matches: "{{count}} coincidencias",
      featuredTemplates: "{{count}} plantillas destacadas",
      refreshing: "Actualizando",
      allDomains: "Todos los dominios",
      failedToLoad: "No se pudo cargar la biblioteca de consultas.",
      noMatches: "No se encontraron consultas que coincidan con su busqueda.",
      tryDifferentKeyword: "Pruebe otra palabra clave o limpie los filtros.",
      importHint:
        "Si la biblioteca esta vacia, pida a su administrador que ejecute: php artisan query-library:import-ohdsi",
      showMoreMatches: "Mostrar mas coincidencias",
    },
    results: {
      safeReadOnly: "SEGURO - Solo lectura",
      needsReview: "REQUIERE REVISION",
      unsafe: "NO SEGURO",
      queryLibraryMatch: "Coincidencia en la biblioteca de consultas",
      templateParameters: "Parametros de la plantilla",
      rendering: "Procesando...",
      sqlUpdated: "SQL actualizado",
      renderTemplate: "Renderizar plantilla",
      renderFailed: "No se pudo renderizar la plantilla de consulta.",
      generatedSql: "SQL generado",
      aggregate: "Agregado",
      tablesReferenced: "Tablas referenciadas",
      explanation: "Explicacion",
      validateSql: "Validar SQL",
      validating: "Validando...",
      validSql: "SQL valido",
      validationFailed: "La validacion fallo",
      readOnly: "Solo lectura",
      complexity: {
        low: "complejidad baja",
        medium: "complejidad media",
        high: "complejidad alta",
      },
      renderError: "No se pudo renderizar la plantilla de consulta.",
      validateError: "No se pudo validar el SQL.",
    },
    schemaBrowser: {
      title: "Explorador del esquema OMOP CDM",
      failedToLoad: "No se pudo cargar el esquema.",
      clinicalTables: "Tablas clinicas ({{count}})",
      vocabularyTables: "Tablas de vocabulario ({{count}})",
      commonJoins: "Joins comunes",
      cols: "{{count}} columnas",
      noDescription: "No hay descripcion disponible.",
    },
    sqlBlock: {
      runSql: "Ejecutar SQL",
      copy: "Copiar",
      copied: "Copiado",
    },
    sqlRunner: {
      errorTitles: {
        explanationInsteadOfSql: "La IA devolvio una explicacion en lugar de SQL",
        mysqlBackticks: "No se admiten acentos graves al estilo MySQL",
        syntaxError: "Error de sintaxis SQL",
        syntaxErrorNear: "Error de sintaxis cerca de \"{{token}}\"",
        timeout: "La consulta agoto el tiempo limite (120 s)",
        tableNotFound: "Tabla no encontrada",
        tableNotFoundNamed: "No se encontro la tabla \"{{table}}\"",
        columnNotFound: "Columna no encontrada",
        columnNotFoundNamed: "No se encontro la columna \"{{column}}\"",
        insufficientPermissions: "Permisos insuficientes",
      },
      suggestions: {
        explanationInsteadOfSql: {
          first: "Intente reformular su pregunta con mas precision",
          second: "Use la pestaña Biblioteca de consultas para encontrar una plantilla ya preparada",
          third: "Especifique las tablas y columnas exactas que desea consultar",
        },
        mysqlBackticks: {
          first: "PostgreSQL usa comillas dobles para los identificadores: \"column_name\"",
          second: "La mayoria de los nombres de columna de OMOP no necesitan comillas",
          third: "Intente generar la consulta de nuevo; a veces la IA usa sintaxis de MySQL",
        },
        syntaxError: {
          first: "El SQL generado tiene un problema de sintaxis. Intente generarlo otra vez con una pregunta mas clara",
          second: "Revise parentesis desbalanceados, comas faltantes o palabras clave sobrantes",
          third: "Use primero el boton Validar SQL para detectar problemas antes de ejecutar",
        },
        timeout: {
          first: "Agregue condiciones WHERE mas especificas para reducir los datos analizados",
          second: "Agregue una clausula LIMIT para acotar el conjunto de resultados",
          third: "Evite SELECT *; seleccione solo las columnas que necesita",
          fourth: "Considere filtrar por rango de fechas para acotar el conjunto de datos",
        },
        tableNotFound: {
          first: "Las tablas OMOP deben estar calificadas con el esquema: omop.person, omop.condition_occurrence",
          second: "Use el explorador del esquema al final de la pagina para verificar los nombres de las tablas",
          third: "Revise la ortografia; tablas comunes: person, condition_occurrence, drug_exposure, measurement",
        },
        columnNotFound: {
          first: "Expanda la tabla en el explorador del esquema para ver las columnas disponibles",
          second: "Los nombres de columna de OMOP usan guion bajo: person_id, condition_start_date",
          third: "Revise si necesita un JOIN con otra tabla que tenga esa columna",
        },
        insufficientPermissions: {
          first: "Esta consulta no fue clasificada como \"segura\" (solo lectura)",
          second: "Solo los administradores pueden ejecutar consultas que no esten marcadas como seguras",
          third: "Use el boton Validar SQL para comprobar la clasificacion de seguridad",
        },
      },
      defaults: {
        queryExecutionFailed: "La ejecucion de la consulta fallo",
        failedToRenderTemplate: "No se pudo renderizar la plantilla",
        typeToSearchConcepts: "Escriba para buscar conceptos OMOP...",
        typeToSearchConceptsWithDefault: "{{defaultValue}}: escriba para buscar conceptos OMOP",
      },
      state: {
        active: "Ejecutando consulta...",
        idle: "Inactiva",
        idleInTransaction: "Procesando resultados...",
        idleAborted: "Transaccion cancelada",
        fastpath: "Llamada de via rapida",
        disabled: "Seguimiento deshabilitado",
        completed: "Completada",
        error: "Error",
      },
      modal: {
        title: "Ejecutor de consultas SQL",
        wait: "Espera: {{value}}",
        preparing: "Preparando...",
        runQuery: "Ejecutar consulta",
        queryCompleted: "Consulta completada",
        rowsIn: "{{count}} filas en {{elapsed}}",
        cappedAt10k: "Limitado a 10.000 filas",
        queryFailed: "La consulta fallo",
        downloadCsv: "Descargar CSV",
        close: "Cerrar",
        showingSomeRows: "Mostrando {{shown}} de {{total}} filas",
        showingAllRows: "{{count}} filas",
        nullValue: "nulo",
      },
    },
  },
});

const koGisTools: MessageTree = mergeMessageTrees(enGisTools, {
  poseidon: {
    page: {
      unavailableTitle: "Poseidon을 사용할 수 없음",
      unavailableMessage:
        "Poseidon 오케스트레이션 서비스에 연결할 수 없습니다. Poseidon 컨테이너가 실행 중인지 확인하세요.",
      retry: "다시 시도",
      title: "Poseidon",
      subtitle:
        "dbt + Dagster 기반 CDM 새로 고침 오케스트레이션 - 증분 적재, 의존성 인식 실행, 소스별 스케줄링",
      refresh: "새로 고침",
    },
    overview: {
      activeSchedules: "활성 일정",
      runsInProgress: "진행 중 실행",
      successfulRuns: "성공한 실행",
      failedRuns: "실패한 실행",
      ofTotal: "전체 {{count}}개 중",
    },
    runStatus: {
      pending: "대기 중",
      running: "실행 중",
      success: "성공",
      failed: "실패",
      cancelled: "취소됨",
    },
    runType: {
      fullRefresh: "전체 새로 고침",
      vocabulary: "어휘",
      incremental: "증분",
    },
    scheduleType: {
      manual: "수동",
      cron: "예약됨",
      sensor: "이벤트 기반",
    },
    schedules: {
      title: "소스 일정",
      emptyTitle: "구성된 일정이 없습니다",
      emptyMessage:
        "데이터 소스의 CDM 새로 고침을 자동화하려면 Poseidon 일정을 만드세요.",
      active: "활성",
      paused: "일시 중지됨",
      lastRun: "마지막 실행: {{value}}",
      nextRun: "다음: {{value}}",
      runCount_one: "{{count}}회 실행",
      runCount_other: "{{count}}회 실행",
      pauseSchedule: "일정 일시 중지",
      activateSchedule: "일정 활성화",
      pause: "일시 중지",
      activate: "활성화",
      runIncrementalRefresh: "증분 새로 고침 실행",
    },
    recentRuns: {
      title: "최근 실행",
      emptyTitle: "아직 실행이 없습니다",
      emptyMessage:
        "수동 실행을 시작하거나 예약 실행을 기다리세요.",
      headers: {
        source: "소스",
        type: "유형",
        status: "상태",
        trigger: "트리거",
        duration: "기간",
        started: "시작됨",
        actions: "작업",
      },
      cancel: "취소",
    },
    runDetail: {
      title: "실행 #{{id}}",
      type: "유형",
      triggeredBy: "실행한 사용자",
      duration: "기간",
      modelsRun: "실행된 모델",
      rowsInserted: "삽입된 행",
      rowsUpdated: "업데이트된 행",
      testsPassed: "통과한 테스트",
      testsFailed: "실패한 테스트",
      error: "오류",
    },
    freshness: {
      title: "CDM 최신성",
      assetCount_one: "{{count}}개 자산",
      assetCount_other: "{{count}}개 자산",
      loading: "Dagster에서 최신성 데이터를 불러오는 중...",
      emptyTitle: "최신성 데이터가 없습니다",
      emptyMessage:
        "최소 한 번의 Poseidon 성공 실행 후 최신성 데이터가 표시됩니다.",
      never: "없음",
    },
    lineage: {
      title: "자산 계보",
      assetCount_one: "{{count}}개 자산",
      assetCount_other: "{{count}}개 자산",
      loading: "Dagster에서 계보를 불러오는 중...",
      emptyTitle: "계보 데이터가 없습니다",
      emptyMessage:
        "Dagster가 dbt 모델을 발견한 후 자산 계보가 표시됩니다.",
      dependsOn: "{{dependencies}}에 의존",
      tiers: {
        staging: "스테이징",
        intermediate: "중간",
        cdm: "CDM",
        quality: "품질",
        fallback: "계층 {{index}}",
      },
    },
  },
  jupyter: {
    status: {
      hubOnline: "Hub 온라인",
      unavailable: "사용 불가",
      authenticating: "인증 중...",
      startingServer: "서버 시작 중...",
      running: "실행 중",
      failed: "실패",
    },
    page: {
      title: "Jupyter 워크벤치",
      subtitle:
        "대화형 연구, 맞춤형 분석, 데이터 탐색을 위한 개인 노트북 환경",
      refresh: "새로 고침",
      openInNewTab: "새 탭에서 열기",
      workspaceDetails: "작업공간 세부정보",
      checkingHub: "JupyterHub 확인 중...",
      iframeTitle: "Parthenon Jupyter",
      startOverlay: "노트북 서버를 시작하는 중...",
      firstLaunchNote: "첫 실행은 최대 30초까지 걸릴 수 있습니다",
      failedToStart: "노트북 서버를 시작하지 못했습니다",
      retry: "다시 시도",
      failedToCreateSession: "세션을 만들지 못했습니다",
    },
    unavailable: {
      title: "JupyterHub에 연결할 수 없습니다",
      message:
        "현재 노트북 서비스를 사용할 수 없습니다. 컨테이너가 정상 상태가 되면 새로 고치세요.",
    },
    drawer: {
      title: "Jupyter 작업공간 세부정보",
      environment: "환경",
      runtime: "런타임",
      runtimeDescription:
        "pandas, polars, sqlalchemy 및 역할 기반 데이터베이스 접근이 포함된 Python 3.12",
      privateWorkspace: "개인 작업공간",
      privateWorkspaceDescription:
        "개인 노트북 디렉터리입니다. 세션 간에 유지되므로 작업이 항상 저장됩니다.",
      sharedFolder: "공유 폴더",
      sharedFolderDescription:
        "동료와 공유하려면 여기에 노트북을 복사하세요. 모든 Jupyter 사용자가 이 폴더를 읽을 수 있습니다.",
      mountedPaths: "마운트된 경로",
      starterNotebooks: "시작 노트북",
      noStarterNotebooks: "사용 가능한 시작 노트북이 없습니다.",
      tips: "팁",
      quickLinks: "빠른 링크",
      openHubNewTab: "새 탭에서 JupyterHub 열기",
    },
  },
  codeExplorer: {
    page: {
      title: "코드 탐색기",
      concept: "개념",
      searchPlaceholder: "이 소스에 데이터가 있는 개념 검색",
      pickSource: "시작하려면 소스를 선택하세요.",
      pickSourceAndConcept:
        "데이터를 보려면 소스와 개념을 선택하세요.",
    },
    tabs: {
      counts: "건수",
      relationships: "관계",
      hierarchy: "계층",
      report: "보고서",
      myReports: "내 보고서",
    },
    sourcePicker: {
      loading: "소스를 불러오는 중...",
      empty: "구성된 소스가 없습니다",
      label: "데이터 소스",
      choose: "소스 선택...",
    },
    counts: {
      emptyTitle: "{{sourceKey}}에는 이 개념에 대한 데이터가 없습니다",
      emptyMessage:
        "개념 {{conceptId}}은 OMOP vocabulary에 있지만 이 소스의 계층화 코드 집계에는 관측값이 없습니다. 다른 개념을 시도하거나({{sourceKey}}에서 데이터가 있는 개념만 검색됨) 이 코드를 포함한 소스로 전환하세요.",
      loading: "건수를 불러오는 중...",
      failed: "건수를 불러오지 못했습니다.",
      count: "건수",
      group: "그룹",
      gender: "성별",
      ageDecile: "연령 분위",
      node: "노드 ({{count}})",
      descendant: "후손 ({{count}})",
    },
    chart: {
      noData: "표시할 데이터가 없습니다",
      male: "남성",
      female: "여성",
      unknown: "알 수 없음",
    },
    hierarchy: {
      loading: "계층을 불러오는 중...",
      failed: "불러오지 못했습니다.",
      direction: "방향",
      both: "양방향",
      ancestorsOnly: "상위 개념만",
      descendantsOnly: "하위 개념만",
      maxDepth: "최대 깊이",
      empty: "깊이 {{depth}}에서 이 개념의 계층 데이터가 없습니다.",
    },
    relationships: {
      loading: "관계를 불러오는 중...",
      failed: "불러오지 못했습니다.",
      empty: "이 개념에 대한 관계를 찾지 못했습니다.",
      headers: {
        relationship: "관계",
        targetConcept: "대상 개념",
        vocabulary: "어휘",
        standard: "표준",
      },
    },
    reports: {
      loading: "보고서를 불러오는 중...",
      failed: "불러오지 못했습니다.",
      empty:
        "아직 보고서가 없습니다. 보고서 탭으로 이동해 생성하세요.",
      headers: {
        created: "생성됨",
        source: "소스",
        concept: "개념",
        status: "상태",
        pin: "고정",
      },
      pin: "고정",
      unpin: "고정 해제",
      generateReport: "보고서 생성",
      generating: "생성 중...",
      failedToDispatch: "보고서 전송에 실패했습니다.",
      progress: "{{percent}}% - {{message}}",
      failedTitle: "보고서 생성 실패",
      ready: "보고서 준비 완료",
      downloadHtml: "HTML 다운로드",
      iframeTitle: "ROMOPAPI 보고서",
      inlinePreviewNote:
        "인라인 미리보기는 샌드박스 처리되어 있습니다(스크립트 및 교차 출처 비활성화). 전체 대화형 보기를 보려면 파일을 다운로드하세요.",
    },
    sourceReadiness: {
      settingUp: "{{sourceKey}} 설정 중...",
      sourceNeedsInitialization: "소스 {{sourceKey}}는 초기화가 필요합니다",
      missing:
        "누락: {{missing}}. 이는 계층화 코드 집계 테이블을 물리화하는 관리자 전용 1회 설정입니다.",
      dispatching: "전송 중...",
      initializeSource: "소스 초기화",
      failedToDispatch:
        "전송에 실패했습니다. `finngen.code-explorer.setup` 권한이 없을 수 있습니다.",
    },
  },
  gis: {
    common: {
      analysisLayerCount_one: "{{count}}개 분석 레이어 활성",
      analysisLayerCount_other: "{{count}}개 분석 레이어 활성",
      avgValue: "평균: {{value}}",
      records_one: "{{count}}개 레코드",
      records_other: "{{count}}개 레코드",
      present: "있음",
      unknownRegion: "지역",
    },
    page: {
      title: "GIS 탐색기",
      reset: "재설정",
      collapse: "접기",
      expand: "펼치기",
      enableLayers: "왼쪽 패널에서 분석 레이어를 활성화하세요",
      selectDisease: "공간 분석을 시작할 질환을 선택하세요",
    },
    layerPanel: {
      title: "분석 레이어",
      privacy: "개인정보 보호",
      suppressionOff: "억제: 해제됨 (합성 데이터)",
    },
    context: {
      researchActions: "연구 작업",
      createStudy: "연구 생성",
      browseCohorts: "코호트 탐색",
      clickRegion: "레이어 세부정보를 보려면 지도에서 지역을 클릭하세요",
    },
    diseaseSelector: {
      title: "질환",
      searchPlaceholder: "질환 검색...",
      top: "상위",
      categories: "카테고리",
      noMatches: "일치하는 질환이 없습니다",
      patientCountTitle: "{{count}}명 환자",
    },
    regionDetail: {
      loading: "불러오는 중...",
      close: "닫기",
      loadingDetails: "지역 세부정보를 불러오는 중...",
      area: "면적: {{value}} km²",
      drillDown_one: "{{count}}개 하위 지역으로 드릴다운",
      drillDown_other: "{{count}}개 하위 지역으로 드릴다운",
      exposures: "노출",
      concept: "개념 {{conceptId}}",
    },
    countyDetail: {
      county: "카운티",
      cases: "사례",
      deaths: "사망",
      cfr: "치명률",
      hospitalized: "입원",
      population: "인구",
      ageDistributionCovid: "연령 분포 (COVID)",
      monthlyCases: "월별 사례",
      casesTitle: "{{period}}: {{count}}건",
    },
    diseaseSummary: {
      cases: "사례",
      deaths: "사망",
      cfr: "치명률",
      counties: "카운티",
      prevalence: "유병률",
    },
    analysisDrawer: {
      title_one: "분석 ({{count}}개 레이어)",
      title_other: "분석 ({{count}}개 레이어)",
    },
    layers: {
      airQuality: {
        name: "대기질",
        description: "EPA PM2.5 및 오존 수준",
        legend: {
          good: "좋음 (낮은 PM2.5)",
          poor: "나쁨 (높은 PM2.5)",
        },
        analysis: {
          loading: "불러오는 중...",
          noData: "데이터 없음",
        },
        detail: {
          loading: "불러오는 중...",
          empty: "대기질 데이터 없음",
          ozone: "오존",
        },
      },
      comorbidity: {
        name: "동반질환 부담",
        description: "당뇨, 고혈압, 비만 군집",
        legend: {
          low: "낮은 부담 (0)",
          high: "높은 부담 (3)",
        },
        tooltip: {
          burden: "부담",
        },
        analysis: {
          loading: "불러오는 중...",
          noData: "데이터 없음",
        },
        detail: {
          title: "{{fips}}의 동반질환 데이터",
          subtitle: "당뇨 + 고혈압 + 비만 부담 점수",
        },
      },
      hospitalAccess: {
        name: "병원 접근성",
        description: "CMS 병원 접근성",
        legend: {
          withEd: "병원 (응급실)",
          withoutEd: "병원 (응급실 없음)",
        },
        analysis: {
          loading: "불러오는 중...",
          noData: "데이터 없음",
        },
        detail: {
          title: "{{fips}}에서 가장 가까운 병원",
          subtitle: "거리 구간: 15/30/60 km",
        },
      },
      rucc: {
        name: "도시-농촌",
        description: "USDA Rural-Urban Continuum Codes",
        legend: {
          metro: "대도시",
          micropolitan: "중소도시",
          rural: "농촌",
        },
        tooltip: {
          classification: "분류",
        },
        analysis: {
          loading: "불러오는 중...",
          noData: "데이터 없음",
        },
        detail: {
          loading: "불러오는 중...",
          empty: "RUCC 데이터 없음",
          code: "RUCC 코드",
          classification: "분류",
          category: "범주",
          patients: "환자",
        },
        categories: {
          metro: "대도시",
          micro: "중소도시",
          rural: "농촌",
        },
      },
      svi: {
        name: "사회적 취약성",
        description: "센서스 구역별 CDC/ATSDR SVI",
        legend: {
          low: "낮은 취약성",
          high: "높은 취약성",
        },
        tooltip: {
          score: "SVI",
        },
        analysis: {
          loading: "불러오는 중...",
          noData: "사용 가능한 데이터가 없습니다",
        },
        detail: {
          loading: "불러오는 중...",
          empty: "SVI 데이터 없음",
          overall: "전체 SVI",
          themes: {
            socioeconomicStatus: "사회경제적 상태",
            householdComposition: "가구 구성",
            minorityStatus: "소수자 상태",
            housingTransportation: "주거 및 교통",
          },
        },
      },
    },
  },
  queryAssistant: {
    page: {
      title: "쿼리 도우미",
      subtitle:
        "OHDSI 쿼리 라이브러리를 탐색하거나 자연어에서 SQL을 생성하는 AI를 사용할 수 있습니다",
      dialect: "방언",
      default: "기본",
      defaultTooltip:
        "변경 사항이 시스템 기본값으로 저장됩니다(슈퍼 관리자)",
      tabs: {
        library: "쿼리 라이브러리",
        naturalLanguage: "자연어",
      },
    },
    naturalLanguage: {
      askQuestion: "질문하기",
      placeholder:
        "예: 2023년에 제2형 당뇨병 진단을 받은 환자는 몇 명인가요?",
      ctrlEnter: "Ctrl+Enter로 생성",
      tryExample: "예시 사용",
      examples: {
        diabetes: "당뇨병 환자는 몇 명인가요?",
        topConditions: "유병률 기준 상위 10개 질환은 무엇인가요?",
        heartFailureAge: "심부전 환자의 평균 연령",
        statins2024: "2024년 스타틴 약물 노출 건수",
      },
      generateWithAi: "AI로 생성",
      generating: "생성 중...",
      failedToGenerate: "SQL을 생성하지 못했습니다. 다시 시도하세요.",
      queryHistory: "쿼리 기록",
      clear: "지우기",
      emptyTitle: "시작하려면 질문하세요",
      emptyDescription:
        "OMOP CDM 데이터에 대한 자연어 질문을 입력하면 AI가 해당 SQL 쿼리를 생성합니다.",
    },
    library: {
      searchPlaceholder: "키워드로 쿼리 검색...",
      indexedQueries: "{{count}}개 인덱싱된 쿼리",
      matches: "{{count}}개 일치",
      featuredTemplates: "{{count}}개 추천 템플릿",
      refreshing: "새로 고침 중",
      allDomains: "모든 도메인",
      failedToLoad: "쿼리 라이브러리를 불러오지 못했습니다.",
      noMatches: "검색과 일치하는 쿼리를 찾지 못했습니다.",
      tryDifferentKeyword: "다른 키워드를 시도하거나 필터를 지우세요.",
      importHint:
        "라이브러리가 비어 있으면 관리자에게 다음 명령 실행을 요청하세요: php artisan query-library:import-ohdsi",
      showMoreMatches: "더 많은 일치 항목 보기",
    },
    results: {
      safeReadOnly: "안전 - 읽기 전용",
      needsReview: "검토 필요",
      unsafe: "안전하지 않음",
      queryLibraryMatch: "쿼리 라이브러리 일치",
      templateParameters: "템플릿 매개변수",
      rendering: "렌더링 중...",
      sqlUpdated: "SQL 업데이트됨",
      renderTemplate: "템플릿 렌더링",
      renderFailed: "쿼리 템플릿을 렌더링하지 못했습니다.",
      generatedSql: "생성된 SQL",
      aggregate: "집계",
      tablesReferenced: "참조된 테이블",
      explanation: "설명",
      validateSql: "SQL 검증",
      validating: "검증 중...",
      validSql: "유효한 SQL",
      validationFailed: "검증 실패",
      readOnly: "읽기 전용",
      complexity: {
        low: "낮은 복잡도",
        medium: "중간 복잡도",
        high: "높은 복잡도",
      },
      renderError: "쿼리 템플릿을 렌더링하지 못했습니다.",
      validateError: "SQL을 검증하지 못했습니다.",
    },
    schemaBrowser: {
      title: "OMOP CDM 스키마 브라우저",
      failedToLoad: "스키마를 불러오지 못했습니다.",
      clinicalTables: "임상 테이블 ({{count}})",
      vocabularyTables: "어휘 테이블 ({{count}})",
      commonJoins: "자주 쓰는 조인",
      cols: "{{count}}개 컬럼",
      noDescription: "설명이 없습니다.",
    },
    sqlBlock: {
      runSql: "SQL 실행",
      copy: "복사",
      copied: "복사됨",
    },
    sqlRunner: {
      errorTitles: {
        explanationInsteadOfSql: "AI가 SQL 대신 설명을 반환했습니다",
        mysqlBackticks: "MySQL 방식 backtick은 지원되지 않습니다",
        syntaxError: "SQL 구문 오류",
        syntaxErrorNear: "\"{{token}}\" 근처 구문 오류",
        timeout: "쿼리 시간이 초과되었습니다(120초 제한)",
        tableNotFound: "테이블을 찾을 수 없습니다",
        tableNotFoundNamed: "\"{{table}}\" 테이블을 찾을 수 없습니다",
        columnNotFound: "컬럼을 찾을 수 없습니다",
        columnNotFoundNamed: "\"{{column}}\" 컬럼을 찾을 수 없습니다",
        insufficientPermissions: "권한이 부족합니다",
      },
      suggestions: {
        explanationInsteadOfSql: {
          first: "질문을 더 구체적으로 바꿔 보세요",
          second: "쿼리 라이브러리 탭에서 미리 만들어진 템플릿을 찾아보세요",
          third: "조회하려는 정확한 테이블과 컬럼을 지정하세요",
        },
        mysqlBackticks: {
          first:
            "PostgreSQL은 식별자에 큰따옴표를 사용합니다: \"column_name\"",
          second: "대부분의 OMOP 컬럼명은 따옴표가 필요 없습니다",
          third: "쿼리를 다시 생성해 보세요. AI가 가끔 MySQL 구문을 사용합니다",
        },
        syntaxError: {
          first:
            "생성된 SQL에 구문 문제가 있습니다. 더 명확한 질문으로 다시 생성해 보세요",
          second: "괄호 불일치, 누락된 쉼표, 불필요한 키워드를 확인하세요",
          third: "실행 전에 SQL 검증 버튼으로 먼저 문제를 확인하세요",
        },
        timeout: {
          first: "스캔되는 데이터를 줄이도록 더 구체적인 WHERE 조건을 추가하세요",
          second: "결과 집합을 제한하는 LIMIT 절을 추가하세요",
          third: "SELECT *를 피하고 필요한 컬럼만 선택하세요",
          fourth: "데이터 범위를 좁히기 위해 날짜 범위로 필터링하세요",
        },
        tableNotFound: {
          first:
            "OMOP 테이블은 스키마를 포함해야 합니다: omop.person, omop.condition_occurrence",
          second: "페이지 하단의 스키마 브라우저로 테이블 이름을 확인하세요",
          third:
            "철자를 확인하세요. 자주 쓰는 테이블: person, condition_occurrence, drug_exposure, measurement",
        },
        columnNotFound: {
          first: "사용 가능한 컬럼을 보려면 스키마 브라우저에서 테이블을 펼치세요",
          second:
            "OMOP 컬럼명은 밑줄을 사용합니다: person_id, condition_start_date",
          third: "이 컬럼을 가진 다른 테이블과 JOIN이 필요한지 확인하세요",
        },
        insufficientPermissions: {
          first: "이 쿼리는 \"안전함\"(읽기 전용)으로 분류되지 않았습니다",
          second:
            "안전으로 표시되지 않은 쿼리는 관리자만 실행할 수 있습니다",
          third: "SQL 검증 버튼으로 안전 분류를 확인하세요",
        },
      },
      defaults: {
        queryExecutionFailed: "쿼리 실행 실패",
        failedToRenderTemplate: "템플릿 렌더링 실패",
        typeToSearchConcepts: "OMOP 개념을 검색하려면 입력하세요...",
        typeToSearchConceptsWithDefault:
          "{{defaultValue}} - OMOP 개념을 검색하려면 입력하세요",
      },
      state: {
        active: "쿼리 실행 중...",
        idle: "대기",
        idleInTransaction: "결과 처리 중...",
        idleAborted: "트랜잭션 중단됨",
        fastpath: "빠른 경로 호출",
        disabled: "추적 비활성화됨",
        completed: "완료",
        error: "오류",
      },
      modal: {
        title: "SQL 쿼리 실행기",
        wait: "대기: {{value}}",
        preparing: "준비 중...",
        runQuery: "쿼리 실행",
        queryCompleted: "쿼리 완료",
        rowsIn: "{{elapsed}} 동안 {{count}}행",
        cappedAt10k: "10,000행으로 제한됨",
        queryFailed: "쿼리 실패",
        downloadCsv: "CSV 다운로드",
        close: "닫기",
        showingSomeRows: "{{total}}행 중 {{shown}}행 표시",
        showingAllRows: "{{count}}행",
      },
    },
  },
});

const hiGisTools: MessageTree = mergeMessageTrees(enGisTools, {
  poseidon: {
    page: {
      unavailableTitle: "Poseidon उपलब्ध नहीं है",
      unavailableMessage:
        "Poseidon orchestration service से कनेक्ट नहीं हो सका. कृपया जांचें कि Poseidon containers चल रहे हैं.",
      retry: "फिर कोशिश करें",
      title: "Poseidon",
      subtitle:
        "dbt + Dagster के जरिए incremental loads, dependency-aware execution, और प्रति-स्रोत scheduling वाली CDM refresh orchestration",
      refresh: "रिफ्रेश",
    },
    overview: {
      activeSchedules: "सक्रिय अनुसूचियां",
      runsInProgress: "प्रगति पर निष्पादन",
      successfulRuns: "सफल निष्पादन",
      failedRuns: "विफल निष्पादन",
      ofTotal: "कुल {{count}} में से",
    },
    runStatus: {
      pending: "लंबित",
      running: "चल रहा है",
      success: "सफल",
      failed: "विफल",
      cancelled: "रद्द",
    },
    runType: {
      fullRefresh: "पूर्ण refresh",
      vocabulary: "शब्दावली",
      incremental: "क्रमिक",
    },
    scheduleType: {
      manual: "मैनुअल",
      cron: "अनुसूचित",
      sensor: "इवेंट-चालित",
    },
    schedules: {
      title: "स्रोत अनुसूचियां",
      emptyTitle: "कोई अनुसूची कॉन्फ़िगर नहीं है",
      emptyMessage:
        "किसी data source के लिए CDM refresh को automate करने हेतु Poseidon schedule बनाएं.",
      active: "सक्रिय",
      paused: "रोक दिया गया",
      lastRun: "पिछला run: {{value}}",
      nextRun: "अगला: {{value}}",
      runCount_one: "{{count}} निष्पादन",
      runCount_other: "{{count}} निष्पादन",
      pauseSchedule: "अनुसूची रोकें",
      activateSchedule: "अनुसूची सक्रिय करें",
      pause: "रोकें",
      activate: "सक्रिय करें",
      runIncrementalRefresh: "क्रमिक refresh चलाएं",
    },
    recentRuns: {
      title: "हाल के runs",
      emptyTitle: "अभी तक कोई run नहीं",
      emptyMessage:
        "मैनुअल run ट्रिगर करें या अनुसूचित run की प्रतीक्षा करें.",
      headers: {
        source: "स्रोत",
        type: "प्रकार",
        status: "स्थिति",
        trigger: "ट्रिगर",
        duration: "अवधि",
        started: "शुरू हुआ",
        actions: "कार्रवाइयां",
      },
      cancel: "रद्द करें",
    },
    runDetail: {
      title: "निष्पादन #{{id}}",
      type: "प्रकार",
      triggeredBy: "किसके द्वारा शुरू",
      duration: "अवधि",
      modelsRun: "चलाए गए models",
      rowsInserted: "डाली गई पंक्तियां",
      rowsUpdated: "अपडेट की गई पंक्तियां",
      testsPassed: "सफल tests",
      testsFailed: "विफल tests",
      error: "त्रुटि",
    },
    freshness: {
      title: "CDM ताजगी",
      assetCount_one: "{{count}} asset",
      assetCount_other: "{{count}} assets",
      loading: "Dagster से freshness data लोड हो रहा है...",
      emptyTitle: "कोई freshness data नहीं",
      emptyMessage:
        "कम से कम एक सफल Poseidon run के बाद freshness data दिखाई देगा.",
      never: "कभी नहीं",
    },
    lineage: {
      title: "Asset lineage",
      assetCount_one: "{{count}} asset",
      assetCount_other: "{{count}} assets",
      loading: "Dagster से lineage data लोड हो रहा है...",
      emptyTitle: "कोई lineage data नहीं",
      emptyMessage:
        "Dagster द्वारा dbt models खोज लेने के बाद asset lineage दिखाई देगा.",
      dependsOn: "{{dependencies}} पर निर्भर",
      tiers: {
        staging: "Staging",
        intermediate: "Intermediate",
        cdm: "CDM",
        quality: "Quality",
        fallback: "स्तर {{index}}",
      },
    },
  },
  jupyter: {
    status: {
      hubOnline: "Hub ऑनलाइन",
      unavailable: "उपलब्ध नहीं",
      authenticating: "प्रमाणीकरण हो रहा है...",
      startingServer: "सर्वर शुरू हो रहा है...",
      running: "चल रहा है",
      failed: "विफल",
    },
    page: {
      title: "Jupyter कार्यक्षेत्र",
      subtitle:
        "interactive research, custom analyses, और data exploration के लिए आपका व्यक्तिगत notebook environment",
      refresh: "रिफ्रेश",
      openInNewTab: "नए tab में खोलें",
      workspaceDetails: "workspace विवरण",
      checkingHub: "JupyterHub जांचा जा रहा है...",
      iframeTitle: "Parthenon Jupyter",
      startOverlay: "आपका notebook server शुरू हो रहा है...",
      firstLaunchNote: "पहली बार इसमें 30 सेकंड तक लग सकते हैं",
      failedToStart: "notebook server शुरू नहीं हो सका",
      retry: "फिर कोशिश करें",
      failedToCreateSession: "session बनाई नहीं जा सकी",
    },
    unavailable: {
      title: "JupyterHub तक पहुंच नहीं है",
      message:
        "notebook सेवा इस समय उपलब्ध नहीं है. container healthy होने पर refresh करें.",
    },
    drawer: {
      title: "Jupyter workspace विवरण",
      environment: "पर्यावरण",
      runtime: "Runtime",
      runtimeDescription:
        "Python 3.12 with pandas, polars, sqlalchemy, और role-based database access.",
      privateWorkspace: "निजी workspace",
      privateWorkspaceDescription:
        "यह आपकी personal notebook directory है. यह sessions के बीच बनी रहती है, इसलिए आपका काम हमेशा सुरक्षित रहता है.",
      sharedFolder: "साझा folder",
      sharedFolderDescription:
        "सहकर्मियों के साथ साझा करने के लिए notebooks यहां कॉपी करें. सभी Jupyter users इस folder को पढ़ सकते हैं.",
      mountedPaths: "mounted paths",
      starterNotebooks: "starter notebooks",
      noStarterNotebooks: "कोई starter notebook उपलब्ध नहीं है.",
      tips: "सुझाव",
      quickLinks: "त्वरित links",
      openHubNewTab: "JupyterHub को नए tab में खोलें",
    },
  },
  codeExplorer: {
    page: {
      title: "कोड एक्सप्लोरर",
      concept: "अवधारणा",
      searchPlaceholder: "इस source में data वाले concepts खोजें",
      pickSource: "शुरू करने के लिए source चुनें.",
      pickSourceAndConcept: "data देखने के लिए source और concept चुनें.",
    },
    tabs: {
      counts: "गणनाएं",
      relationships: "संबंध",
      hierarchy: "Hierarchy",
      report: "रिपोर्ट",
      myReports: "मेरी reports",
    },
    sourcePicker: {
      loading: "sources लोड हो रहे हैं...",
      empty: "कोई source configured नहीं है",
      label: "data source",
      choose: "source चुनें...",
    },
    counts: {
      emptyTitle: "{{sourceKey}} में इस concept के लिए कोई data नहीं",
      emptyMessage:
        "Concept {{conceptId}} OMOP vocabulary में है, लेकिन इस source की stratified code counts table में इसके लिए कोई observation नहीं है. दूसरा concept आजमाएं (search box अब {{sourceKey}} में data वाले concepts तक सीमित है) या ऐसी source चुनें जिसमें यह code शामिल हो.",
      loading: "counts लोड हो रहे हैं...",
      failed: "counts लोड नहीं हो सके.",
      count: "गणना",
      group: "समूह",
      gender: "लिंग",
      ageDecile: "आयु decile",
      node: "नोड ({{count}})",
      descendant: "descendant ({{count}})",
    },
    chart: {
      noData: "दिखाने के लिए data नहीं",
      male: "पुरुष",
      female: "महिला",
      unknown: "अज्ञात",
    },
    hierarchy: {
      loading: "hierarchy लोड हो रही है...",
      failed: "लोड नहीं हो सका.",
      direction: "दिशा",
      both: "दोनों",
      ancestorsOnly: "केवल ancestors",
      descendantsOnly: "केवल descendants",
      maxDepth: "अधिकतम depth",
      empty: "depth {{depth}} पर इस concept के लिए कोई hierarchy data नहीं है.",
    },
    relationships: {
      loading: "relationships लोड हो रहे हैं...",
      failed: "लोड नहीं हो सका.",
      empty: "इस concept के लिए कोई relationship नहीं मिला.",
      headers: {
        relationship: "Relationship",
        targetConcept: "Target concept",
        vocabulary: "Vocabulary",
        standard: "Standard",
      },
    },
    reports: {
      loading: "reports लोड हो रही हैं...",
      failed: "लोड नहीं हो सका.",
      empty:
        "अभी आपकी कोई reports नहीं हैं. Report tab पर जाएं और एक generate करें.",
      headers: {
        created: "Created",
        source: "Source",
        concept: "Concept",
        status: "Status",
        pin: "Pin",
      },
      pin: "Pin",
      unpin: "Unpin",
      generateReport: "Report generate करें",
      generating: "Generate हो रहा है...",
      failedToDispatch: "Report dispatch नहीं हो सका.",
      progress: "{{percent}}% - {{message}}",
      failedTitle: "Report generation विफल",
      ready: "Report तैयार है",
      downloadHtml: "HTML डाउनलोड करें",
      iframeTitle: "ROMOPAPI report",
      inlinePreviewNote:
        "Inline preview sandboxed है (scripts और cross-origin disabled). पूरी interactive view के लिए file डाउनलोड करें.",
    },
    sourceReadiness: {
      settingUp: "{{sourceKey}} set up किया जा रहा है...",
      sourceNeedsInitialization: "Source {{sourceKey}} को initialization की आवश्यकता है",
      missing:
        "अनुपस्थित: {{missing}}. यह admin-only एकबारगी setup है जो stratified code counts table materialize करता है.",
      dispatching: "Dispatch किया जा रहा है...",
      initializeSource: "Source initialize करें",
      failedToDispatch:
        "Dispatch विफल. हो सकता है आपके पास `finngen.code-explorer.setup` permission न हो.",
    },
  },
  gis: {
    common: {
      analysisLayerCount_one: "{{count}} analysis layer active",
      analysisLayerCount_other: "{{count}} analysis layers active",
      avgValue: "औसत: {{value}}",
      records_one: "{{count}} रिकॉर्ड",
      records_other: "{{count}} रिकॉर्ड",
      present: "मौजूद",
      unknownRegion: "क्षेत्र",
    },
    page: {
      title: "GIS एक्सप्लोरर",
      reset: "रीसेट",
      collapse: "समेटें",
      expand: "फैलाएं",
      enableLayers: "बाएं panel में analysis layers सक्षम करें",
      selectDisease: "spatial analysis शुरू करने के लिए कोई disease चुनें",
    },
    layerPanel: {
      title: "Analysis layers",
      privacy: "Privacy",
      suppressionOff: "Suppression: बंद (synthetic data)",
    },
    context: {
      researchActions: "Research actions",
      createStudy: "Study बनाएं",
      browseCohorts: "Cohorts देखें",
      clickRegion: "layer details देखने के लिए map पर किसी region पर click करें",
    },
    diseaseSelector: {
      title: "Disease",
      searchPlaceholder: "conditions खोजें...",
      top: "Top",
      categories: "Categories",
      noMatches: "कोई matching condition नहीं",
      patientCountTitle: "{{count}} patients",
    },
    regionDetail: {
      loading: "लोड हो रहा है...",
      close: "बंद करें",
      loadingDetails: "region details लोड हो रही हैं...",
      area: "क्षेत्रफल: {{value}} km²",
      drillDown_one: "Drill down ({{count}} sub-region)",
      drillDown_other: "Drill down ({{count}} sub-regions)",
      exposures: "Exposures",
      concept: "Concept {{conceptId}}",
    },
    countyDetail: {
      county: "County",
      cases: "मामले",
      deaths: "मौतें",
      cfr: "मृत्यु अनुपात",
      hospitalized: "अस्पताल में भर्ती",
      population: "जनसंख्या",
      ageDistributionCovid: "आयु वितरण (COVID)",
      monthlyCases: "मासिक मामले",
      casesTitle: "{{period}}: {{count}} मामले",
    },
    diseaseSummary: {
      cases: "मामले",
      deaths: "मौतें",
      cfr: "मृत्यु अनुपात",
      counties: "काउंटी",
      prevalence: "प्रचलन",
    },
    analysisDrawer: {
      title_one: "विश्लेषण ({{count}} लेयर)",
      title_other: "विश्लेषण ({{count}} लेयर्स)",
    },
    layers: {
      airQuality: {
        name: "वायु गुणवत्ता",
        description: "EPA PM2.5 और ozone levels",
        legend: {
          good: "अच्छी (कम PM2.5)",
          poor: "खराब (अधिक PM2.5)",
        },
        analysis: {
          loading: "लोड हो रहा है...",
          noData: "कोई data नहीं",
        },
        detail: {
          loading: "लोड हो रहा है...",
          empty: "कोई air quality data नहीं",
          ozone: "Ozone",
        },
      },
      comorbidity: {
        name: "सह-रोग भार",
        description: "DM, HTN, obesity clustering",
        legend: {
          low: "कम भार (0)",
          high: "अधिक भार (3)",
        },
        tooltip: {
          burden: "भार",
        },
        analysis: {
          loading: "लोड हो रहा है...",
          noData: "कोई data नहीं",
        },
        detail: {
          title: "{{fips}} के लिए comorbidity data",
          subtitle: "DM + HTN + Obesity burden score",
        },
      },
      hospitalAccess: {
        name: "अस्पताल पहुंच",
        description: "CMS hospital proximity",
        legend: {
          withEd: "अस्पताल (ED)",
          withoutEd: "अस्पताल (ED नहीं)",
        },
        analysis: {
          loading: "लोड हो रहा है...",
          noData: "कोई data नहीं",
        },
        detail: {
          title: "{{fips}} के निकटतम अस्पताल",
          subtitle: "दूरी रिंग: 15/30/60 km",
        },
      },
      rucc: {
        name: "शहरी-ग्रामीण",
        description: "USDA Rural-Urban Continuum Codes",
        legend: {
          metro: "मेट्रो",
          micropolitan: "माइक्रोपॉलिटन",
          rural: "ग्रामीण",
        },
        tooltip: {
          classification: "वर्गीकरण",
        },
        analysis: {
          loading: "लोड हो रहा है...",
          noData: "कोई data नहीं",
        },
        detail: {
          loading: "लोड हो रहा है...",
          empty: "कोई RUCC data नहीं",
          code: "RUCC Code",
          classification: "वर्गीकरण",
          category: "श्रेणी",
          patients: "रोगी",
        },
        categories: {
          metro: "मेट्रो",
          micro: "माइक्रोपॉलिटन",
          rural: "ग्रामीण",
        },
      },
      svi: {
        name: "सामाजिक संवेदनशीलता",
        description: "census tract के अनुसार CDC/ATSDR SVI",
        legend: {
          low: "कम संवेदनशीलता",
          high: "अधिक संवेदनशीलता",
        },
        tooltip: {
          score: "SVI",
        },
        analysis: {
          loading: "लोड हो रहा है...",
          noData: "कोई data उपलब्ध नहीं",
        },
        detail: {
          loading: "लोड हो रहा है...",
          empty: "कोई SVI data नहीं",
          overall: "कुल SVI",
          themes: {
            socioeconomicStatus: "सामाजिक-आर्थिक स्थिति",
            householdComposition: "परिवार संरचना",
            minorityStatus: "अल्पसंख्यक स्थिति",
            housingTransportation: "आवास और परिवहन",
          },
        },
      },
    },
  },
  queryAssistant: {
    page: {
      title: "क्वेरी सहायक",
      subtitle:
        "OHDSI query library ब्राउज़ करें या natural language से SQL बनाने के लिए AI का उपयोग करें",
      dialect: "Dialect",
      default: "Default",
      defaultTooltip:
        "परिवर्तन system default के रूप में सहेजे जाते हैं (super-admin)",
      tabs: {
        library: "Query Library",
        naturalLanguage: "प्राकृतिक भाषा",
      },
    },
    naturalLanguage: {
      askQuestion: "प्रश्न पूछें",
      placeholder:
        "उदा. 2023 में type 2 diabetes का निदान पाए कितने patients थे?",
      ctrlEnter: "generate करने के लिए Ctrl+Enter",
      tryExample: "उदाहरण आजमाएं",
      examples: {
        diabetes: "diabetes वाले patients कितने हैं?",
        topConditions: "प्रचलन के आधार पर शीर्ष 10 conditions कौन-सी हैं?",
        heartFailureAge: "heart failure वाले patients की औसत आयु",
        statins2024: "2024 में statins exposure counts",
      },
      generateWithAi: "AI से generate करें",
      generating: "Generate हो रहा है...",
      failedToGenerate: "SQL generate नहीं हो सका. फिर से कोशिश करें.",
      queryHistory: "Query history",
      clear: "साफ करें",
      emptyTitle: "शुरू करने के लिए प्रश्न पूछें",
      emptyDescription:
        "अपने OMOP CDM data के बारे में natural language question लिखें और AI उसके अनुरूप SQL query बनाएगा.",
    },
    library: {
      searchPlaceholder: "कीवर्ड से queries खोजें...",
      indexedQueries: "{{count}} indexed queries",
      matches: "{{count}} matches",
      featuredTemplates: "{{count}} featured templates",
      refreshing: "Refresh हो रहा है",
      allDomains: "सभी domains",
      failedToLoad: "Query library लोड नहीं हो सकी.",
      noMatches: "आपकी खोज से मेल खाने वाली कोई query नहीं मिली.",
      tryDifferentKeyword: "कोई दूसरा keyword आजमाएं या filters साफ करें.",
      importHint:
        "यदि library खाली है, तो admin से यह command चलाने को कहें: php artisan query-library:import-ohdsi",
      showMoreMatches: "और matches दिखाएं",
    },
    results: {
      safeReadOnly: "SAFE - केवल पढ़ें",
      needsReview: "REVIEW आवश्यक",
      unsafe: "UNSAFE",
      queryLibraryMatch: "Query library match",
      templateParameters: "Template parameters",
      rendering: "Render हो रहा है...",
      sqlUpdated: "SQL अपडेट हुआ",
      renderTemplate: "Template render करें",
      renderFailed: "Query template render नहीं हो सका.",
      generatedSql: "Generated SQL",
      aggregate: "Aggregate",
      tablesReferenced: "Referenced tables",
      explanation: "Explanation",
      validateSql: "SQL validate करें",
      validating: "Validate हो रहा है...",
      validSql: "Valid SQL",
      validationFailed: "Validation विफल",
      readOnly: "केवल पढ़ें",
      complexity: {
        low: "कम complexity",
        medium: "मध्यम complexity",
        high: "उच्च complexity",
      },
      renderError: "Query template render नहीं हो सका.",
      validateError: "SQL validate नहीं हो सका.",
    },
    schemaBrowser: {
      title: "OMOP CDM schema browser",
      failedToLoad: "Schema load नहीं हुआ.",
      clinicalTables: "Clinical tables ({{count}})",
      vocabularyTables: "Vocabulary tables ({{count}})",
      commonJoins: "Common joins",
      cols: "{{count}} cols",
      noDescription: "कोई description उपलब्ध नहीं है.",
    },
    sqlBlock: {
      runSql: "SQL चलाएं",
      copy: "Copy",
      copied: "कॉपी हो गया",
    },
    sqlRunner: {
      errorTitles: {
        explanationInsteadOfSql: "AI ने SQL की जगह explanation लौटाया",
        mysqlBackticks: "MySQL-style backticks समर्थित नहीं हैं",
        syntaxError: "SQL syntax error",
        syntaxErrorNear: "\"{{token}}\" के पास syntax error",
        timeout: "Query timeout (120s limit)",
        tableNotFound: "Table नहीं मिली",
        tableNotFoundNamed: "Table \"{{table}}\" नहीं मिली",
        columnNotFound: "Column नहीं मिली",
        columnNotFoundNamed: "Column \"{{column}}\" नहीं मिली",
        insufficientPermissions: "अनुमतियां अपर्याप्त हैं",
      },
      suggestions: {
        explanationInsteadOfSql: {
          first: "अपना question और specific करके देखें",
          second: "pre-built template खोजने के लिए Query Library tab का उपयोग करें",
          third: "जिन tables और columns को query करना है, उन्हें स्पष्ट बताएं",
        },
        mysqlBackticks: {
          first:
            "PostgreSQL identifiers के लिए double quotes का उपयोग करता है: \"column_name\"",
          second:
            "ज्यादातर OMOP column names को quotes की जरूरत नहीं होती",
          third:
            "query फिर से generate करें - AI कभी-कभी MySQL syntax का उपयोग करता है",
        },
        syntaxError: {
          first:
            "Generated SQL में syntax समस्या है - अधिक स्पष्ट question के साथ फिर generate करें",
          second:
            "mismatched parentheses, missing commas, या extra keywords देखें",
          third:
            "चलाने से पहले समस्याएं पकड़ने के लिए Validate SQL button का उपयोग करें",
        },
        timeout: {
          first:
            "स्कैन होने वाले data को कम करने के लिए और specific WHERE conditions जोड़ें",
          second:
            "result set सीमित करने के लिए LIMIT clause जोड़ें",
          third:
            "SELECT * से बचें - केवल जरूरी columns चुनें",
          fourth:
            "dataset संकीर्ण करने के लिए date range से filter करने पर विचार करें",
        },
        tableNotFound: {
          first:
            "OMOP tables को schema-qualified होना चाहिए: omop.person, omop.condition_occurrence",
          second:
            "table names सत्यापित करने के लिए page के नीचे schema browser का उपयोग करें",
          third:
            "spelling जांचें - common tables: person, condition_occurrence, drug_exposure, measurement",
        },
        columnNotFound: {
          first:
            "available columns देखने के लिए schema browser में table expand करें",
          second:
            "OMOP column names underscores का उपयोग करते हैं: person_id, condition_start_date",
          third:
            "देखें कि क्या इस column वाली किसी दूसरी table के साथ JOIN चाहिए",
        },
        insufficientPermissions: {
          first:
            "इस query को \"safe\" (read-only) के रूप में classify नहीं किया गया",
          second:
            "जो queries safe marked नहीं हैं, उन्हें केवल admins चला सकते हैं",
          third:
            "safety classification जांचने के लिए Validate SQL button इस्तेमाल करें",
        },
      },
      defaults: {
        queryExecutionFailed: "Query execution विफल",
        failedToRenderTemplate: "Template render नहीं हुआ",
        typeToSearchConcepts: "OMOP concepts खोजने के लिए टाइप करें...",
        typeToSearchConceptsWithDefault:
          "{{defaultValue}} - OMOP concepts खोजने के लिए टाइप करें",
      },
      state: {
        active: "Query चल रही है...",
        idle: "Idle",
        idleInTransaction: "Results प्रोसेस हो रहे हैं...",
        idleAborted: "Transaction abort हो गई",
        fastpath: "Fast path call",
        disabled: "Tracking disabled",
        completed: "Completed",
        error: "Error",
      },
      modal: {
        title: "SQL Query Runner",
        wait: "प्रतीक्षा: {{value}}",
        preparing: "तैयार किया जा रहा है...",
        runQuery: "Query चलाएं",
        queryCompleted: "Query पूरी हुई",
        rowsIn: "{{elapsed}} में {{count}} rows",
        cappedAt10k: "10,000 rows तक सीमित",
        queryFailed: "Query विफल",
        downloadCsv: "CSV डाउनलोड करें",
        close: "Close",
        showingSomeRows: "{{total}} में से {{shown}} rows दिख रही हैं",
        showingAllRows: "{{count}} rows",
      },
    },
  },
});

const frGisToolsPass100: MessageTree = mergeMessageTrees(frGisTools, {
  gis: {
    common: {
      present: "présent",
    },
  },
});

const deGisToolsPass100: MessageTree = mergeMessageTrees(deGisTools, {
  queryAssistant: {
    page: {
      title: "Abfrageassistent",
    },
    results: {
      rendering: "Wird gerendert...",
    },
  },
});

const ptGisToolsPass100: MessageTree = mergeMessageTrees(ptGisTools, {
  gis: {
    common: {
      unknownRegion: "Região",
    },
    countyDetail: {
      county: "Condado",
    },
    diseaseSummary: {
      counties: "Condados",
    },
  },
});

export const gisToolsResources: Record<string, MessageTree> = {
  "en-US": enGisTools,
  "es-ES": esGisTools,
  "fr-FR": frGisToolsPass100,
  "de-DE": deGisToolsPass100,
  "pt-BR": ptGisToolsPass100,
  "fi-FI": mergeMessageTrees(enGisTools, {}),
  "ja-JP": mergeMessageTrees(enGisTools, {}),
  "zh-Hans": mergeMessageTrees(enGisTools, {}),
  "ko-KR": koGisTools,
  "hi-IN": hiGisTools,
  ar: mergeMessageTrees(enGisTools, {}),
  "en-XA": mergeMessageTrees(enGisTools, {}),
};
