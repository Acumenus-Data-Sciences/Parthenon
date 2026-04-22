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

const enEtlAqueduct: MessageTree = {
  etl: {
    profiler: {
      page: {
        title: "Source Profiler",
        subtitle:
          "Profile source databases with BlackRabbit to assess data completeness, cardinality, and quality before ETL",
        blackRabbitService: "BlackRabbit service",
        available: "available",
        unavailableScanMayFail: "unavailable - scan may fail",
        scanConfiguration: "Scan Configuration",
        database: "Database",
        selectDatabase: "Select a database...",
        noDatabaseConnections:
          "No database connections found. Use the Ingestion tab to connect a database first.",
        tableFilter: "Table Filter",
        commaSeparated: "(comma-separated)",
        tableFilterPlaceholder:
          "e.g. person, visit_occurrence, condition_occurrence",
        advancedOptions: "Advanced options",
        sampleRowsPerTable: "Sample Rows per Table",
        sampleRowsHelp:
          "Limits row sampling for large tables. Default: 10,000.",
        scanning: "Scanning...",
        scanDatabase: "Scan Database",
        json: "JSON",
        csv: "CSV",
        scanFailed: "Scan failed",
        searchTablesPlaceholder: "Search tables...",
        listView: "List view",
        compactView: "Compact view",
        noTablesMatching: 'No tables matching "{{query}}"',
        noScanResultsYet: "No scan results yet",
        emptyDescription:
          'Select a data source and click "Scan Database" to profile your source data. Results include column completeness, cardinality, value distributions, and data quality grades.',
        historyHint: "Or select a previous scan from the history panel.",
        tableCount_one: "{{count}} table",
        tableCount_other: "{{count}} tables",
        filteredTableCount: "{{visible}} / {{total}} tables",
      },
      metrics: {
        tables: "Tables",
        columns: "Columns",
        totalRows: "Total Rows",
        scanTime: "Scan Time",
        grade: "Grade",
      },
      sort: {
        name: "Name",
        rows: "Rows",
        columns: "Cols",
        grade: "Grade",
      },
      compact: {
        rows: "rows",
        cols: "cols",
        highNull: "high-null",
      },
      progress: {
        complete: "Scan complete",
        tables: "Tables",
        columns: "Columns",
        rows: "Rows",
        elapsed: "Elapsed",
        rowTiming: "{{rows}} rows · {{ms}}ms",
        failedCount_one: "{{count}} table failed",
        failedCount_other: "{{count}} tables failed",
        cancel: "Cancel",
      },
      history: {
        title: "Scan History",
        compareSelected: "Compare Selected",
        selectForComparison: "Select for comparison",
        deleteScan: "Delete scan",
        summary: "{{count}} tables · {{grade}}",
        timestampDuration: "{{timestamp}} — {{seconds}}s",
      },
      heatmap: {
        title: "Completeness Heatmap",
        legend: {
          belowOne: "<1%",
          tenToTwentyFive: "10-25%",
          aboveFifty: ">50%",
          notAvailable: "N/A",
        },
        tooltip: "{{table}} → {{column}} — {{value}}% null",
        table: "Table",
        showing:
          "Showing {{shown}} of {{total}} columns. Export full report for complete view.",
      },
      scorecard: {
        title: "Data Quality Scorecard",
        overall: "Overall Data Completeness",
        basedOnAverage:
          "Based on average null fraction across {{columns}} columns in {{tables}} tables",
        checks: {
          highNullColumns: "High-null columns (>50%)",
          nearlyEmptyColumns: "Nearly-empty columns (>99%)",
          lowCardinality: "Low cardinality (<5 distinct)",
          singleValueColumns: "Single-value columns",
          emptyTables: "Empty tables (0 rows)",
          piiColumns: "PII Columns",
        },
      },
      sizeChart: {
        title: "Table Size Distribution",
        topTwenty: "(top 20)",
      },
      relationships: {
        title: "CDM Relationships",
        summary: "{{count}} relationships across {{tables}} tables",
        rows: "{{count}} rows",
      },
      accordion: {
        highNull: "high-null",
        lowCard: "low-card",
        headers: {
          column: "Column",
          type: "Type",
          nullPercent: "Null %",
          distinct: "Distinct",
          sampleValues: "Sample Values",
        },
      },
      pii: {
        potentialTitle: "Potential PII: {{type}}",
        sampleCountTitle: "Count: {{count}}",
      },
    },
    aqueduct: {
      common: {
        statuses: {
          draft: "Draft",
          inReview: "In Review",
          approved: "Approved",
          archived: "Archived",
        },
        filters: {
          all: "All",
          mapped: "Mapped",
          unmapped: "Unmapped",
        },
        exportFormats: {
          markdown: "Markdown Spec (.md)",
          sql: "SQL Files (.zip)",
          json: "Project JSON (.json)",
        },
        mappingTypes: {
          direct: "direct",
          transform: "transform",
          lookup: "lookup",
          constant: "constant",
          concat: "concat",
          expression: "expression",
        },
      },
      canvas: {
        sourceHeader: "Source Tables ({{count}})",
        cdmHeader: "OMOP CDM v5.4 Tables ({{count}})",
        suggestBanner:
          "Suggested {{tableMappings}} table mappings and {{fieldMappings}} field mappings",
        dismiss: "Dismiss",
      },
      toolbar: {
        goBack: "Go back",
        ai: "AI",
        suggesting: "Suggesting...",
        export: "Export",
        collapse: "Collapse",
        expand: "Expand",
      },
      nodes: {
        sourceCols: "{{count}} cols",
        sourceRows: "{{count}} rows",
        sourceEmpty: "empty",
        requiredCount: "req: {{count}}",
        unmappedCount: "{{count}} unmapped",
        stemTitle: "Stem Table",
        stemSummary: "{{columns}} columns • {{routes}} domain routes",
        edgeFields: "{{mapped}}/{{total}} fields",
      },
      detailModal: {
        summary:
          "{{domain}} · {{columns}} columns · {{mapped}} mapped · {{unmapped}} unmapped",
        unmappedRequired: "Unmapped Required ({{count}})",
        mapped: "Mapped ({{count}})",
        unmappedOptional: "Unmapped Optional ({{count}})",
        required: "REQUIRED",
        requiredShort: "req",
      },
      conceptSearch: {
        label: "Concept Search",
        placeholder: "Search OMOP concepts...",
        standard: "S",
      },
      suggestions: {
        title: "AI Suggestions: {{source}} → {{target}}",
        columnsWithSuggestions_one: "{{count}} column with suggestions",
        columnsWithSuggestions_other: "{{count}} columns with suggestions",
        acceptAllTopSuggestions: "Accept All Top Suggestions",
        unmappedColumnsWithSuggestions_one:
          "{{count}} unmapped column with suggestions",
        unmappedColumnsWithSuggestions_other:
          "{{count}} unmapped columns with suggestions",
        refresh: "Refresh",
        analyzing: "Analyzing column matches...",
        failed: "Failed to generate suggestions",
        retry: "Retry",
        allMapped: "All CDM columns are mapped",
        required: "Required",
        noMatches: "No matching source columns found",
        accept: "Accept",
        acceptTitle: "Map {{source}} → {{target}} as {{mappingType}}",
      },
      fieldMapping: {
        removeMappingTitle: "Remove mapping",
        selectSource: "Select source...",
        searchSourceColumns: "Search source columns...",
        noMatchingColumns: "No matching columns",
        mapped: "mapped",
        nullDistinct: "null: {{nullPct}}% • {{distinctCount}} distinct",
        mappingModifiedElsewhere:
          "Mapping was modified elsewhere, refreshing...",
        failedToSave: "Failed to save field mappings",
        mappedToast: "Mapped {{source}} → {{target}}",
        removedToast: "Removed mapping for {{target}}",
        acceptedAiSuggestions: "Accepted {{count}} AI suggestions",
        aiAssist: "AI Assist",
        prev: "Prev",
        next: "Next",
        deleteConfirm: "Delete this mapping?",
        deleteMapping: "Delete this table mapping",
        deletedToast: "Deleted mapping {{source}} → {{target}}",
        failedToDelete: "Failed to delete mapping",
        yes: "Yes",
        no: "No",
        allMappedBanner:
          "All CDM columns mapped — {{reviewed}} of {{mapped}} reviewed",
        headers: {
          cdmColumn: "CDM Column",
          sourceColumn: "Source Column",
          type: "Type",
          logic: "Logic",
          status: "Status",
        },
        sections: {
          requiredUnmapped: "Required Unmapped",
          optionalUnmapped: "Optional Unmapped",
          needsReview: "Needs Review",
          reviewed: "Reviewed",
        },
        needsReview: "Needs review",
        unmapped: "Unmapped",
        logicExpression: "Logic / Expression",
        logicPlaceholder: "Transformation logic or SQL expression",
        reviewed: "Reviewed",
        removeMapping: "Remove mapping",
        aiConfidence: "AI {{count}}%",
        mappedCount: "{{mapped}}/{{total}} mapped",
        documentation: "CDM Documentation",
        userGuide: "User Guide",
        etlConventions: "ETL Conventions",
        fkTable: "FK Table",
        fkDomain: "FK Domain",
      },
    },
  },
};

export const etlAqueductResources: Record<string, MessageTree> = {
  "en-US": enEtlAqueduct,
  "es-ES": mergeMessageTrees(enEtlAqueduct, {}),
  "fr-FR": mergeMessageTrees(enEtlAqueduct, {}),
  "de-DE": mergeMessageTrees(enEtlAqueduct, {}),
  "pt-BR": mergeMessageTrees(enEtlAqueduct, {}),
  "fi-FI": mergeMessageTrees(enEtlAqueduct, {}),
  "ja-JP": mergeMessageTrees(enEtlAqueduct, {}),
  "zh-Hans": mergeMessageTrees(enEtlAqueduct, {}),
  "ko-KR": mergeMessageTrees(enEtlAqueduct, {}),
  "hi-IN": mergeMessageTrees(enEtlAqueduct, {}),
  ar: mergeMessageTrees(enEtlAqueduct, {}),
  "en-XA": mergeMessageTrees(enEtlAqueduct, {}),
};
