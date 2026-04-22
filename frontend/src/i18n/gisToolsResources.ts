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

export const gisToolsResources: Record<string, MessageTree> = {
  "en-US": enGisTools,
  "es-ES": mergeMessageTrees(enGisTools, {}),
  "fr-FR": mergeMessageTrees(enGisTools, {}),
  "de-DE": mergeMessageTrees(enGisTools, {}),
  "pt-BR": mergeMessageTrees(enGisTools, {}),
  "fi-FI": mergeMessageTrees(enGisTools, {}),
  "ja-JP": mergeMessageTrees(enGisTools, {}),
  "zh-Hans": mergeMessageTrees(enGisTools, {}),
  "ko-KR": mergeMessageTrees(enGisTools, {}),
  "hi-IN": mergeMessageTrees(enGisTools, {}),
  ar: mergeMessageTrees(enGisTools, {}),
  "en-XA": mergeMessageTrees(enGisTools, {}),
};
