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

const frEtlAqueduct: MessageTree = mergeMessageTrees(enEtlAqueduct, {
  etl: {
    profiler: {
      page: {
        title: "Profileur de source",
        subtitle:
          "Profilez les bases de donnees sources avec BlackRabbit pour evaluer l'exhaustivite, la cardinalite et la qualite des donnees avant l'ETL",
        blackRabbitService: "Service BlackRabbit",
        available: "disponible",
        unavailableScanMayFail: "indisponible - l'analyse peut echouer",
        scanConfiguration: "Configuration du scan",
        database: "Base de donnees",
        selectDatabase: "Selectionnez une base de donnees...",
        noDatabaseConnections:
          "Aucune connexion de base de donnees trouvee. Utilisez d'abord l'onglet Ingestion pour connecter une base de donnees.",
        tableFilter: "Filtre de tables",
        commaSeparated: "(separees par des virgules)",
        tableFilterPlaceholder:
          "p. ex. person, visit_occurrence, condition_occurrence",
        advancedOptions: "Options avancees",
        sampleRowsPerTable: "Lignes echantillonnees par table",
        sampleRowsHelp:
          "Limite l'echantillonnage des lignes pour les grandes tables. Par defaut : 10 000.",
        scanning: "Analyse en cours...",
        scanDatabase: "Analyser la base de donnees",
        scanFailed: "Echec de l'analyse",
        searchTablesPlaceholder: "Rechercher des tables...",
        listView: "Vue liste",
        compactView: "Vue compacte",
        noTablesMatching: 'Aucune table correspondant a "{{query}}"',
        noScanResultsYet: "Aucun resultat d'analyse pour le moment",
        emptyDescription:
          'Selectionnez une source de donnees et cliquez sur "Analyser la base de donnees" pour profiler vos donnees sources. Les resultats incluent l\'exhaustivite des colonnes, la cardinalite, les distributions de valeurs et les notes de qualite des donnees.',
        historyHint:
          "Ou selectionnez une analyse precedente dans le panneau d'historique.",
        tableCount_one: "{{count}} table",
        tableCount_other: "{{count}} tables",
        filteredTableCount: "{{visible}} sur {{total}} tables",
      },
      metrics: {
        columns: "Colonnes",
        totalRows: "Lignes totales",
        scanTime: "Temps d'analyse",
        grade: "Note",
      },
      sort: {
        name: "Nom",
        rows: "Lignes",
        columns: "Col.",
        grade: "Note",
      },
      compact: {
        rows: "lignes",
        cols: "col.",
        highNull: "null eleve",
      },
      progress: {
        complete: "Analyse terminee",
        columns: "Colonnes",
        rows: "Lignes",
        elapsed: "Temps ecoule",
        rowTiming: "{{rows}} lignes · {{ms}} ms",
        failedCount_one: "{{count}} table en echec",
        failedCount_other: "{{count}} tables en echec",
        cancel: "Annuler",
      },
      history: {
        title: "Historique des analyses",
        compareSelected: "Comparer la selection",
        selectForComparison: "Selectionner pour comparer",
        deleteScan: "Supprimer l'analyse",
        summary: "{{count}} tables · {{grade}}",
        timestampDuration: "{{timestamp}} — {{seconds}} s",
      },
      heatmap: {
        title: "Carte thermique d'exhaustivite",
        legend: {
          notAvailable: "N/D",
        },
        tooltip: "{{table}} → {{column}} — {{value}} % null",
        table: "Table",
        showing:
          "Affichage de {{shown}} colonnes sur {{total}}. Exportez le rapport complet pour une vue exhaustive.",
      },
      scorecard: {
        title: "Fiche d'evaluation de la qualite des donnees",
        overall: "Exhaustivite globale des donnees",
        basedOnAverage:
          "Basee sur la fraction moyenne de valeurs nulles sur {{columns}} colonnes dans {{tables}} tables",
        checks: {
          highNullColumns: "Colonnes a fort taux de nulls (>50%)",
          nearlyEmptyColumns: "Colonnes presque vides (>99%)",
          lowCardinality: "Faible cardinalite (<5 distinctes)",
          singleValueColumns: "Colonnes a valeur unique",
          emptyTables: "Tables vides (0 ligne)",
          piiColumns: "Colonnes PII",
        },
      },
      sizeChart: {
        title: "Distribution de la taille des tables",
      },
      relationships: {
        title: "Relations CDM",
        summary: "{{count}} relations sur {{tables}} tables",
        rows: "{{count}} lignes",
      },
      accordion: {
        highNull: "null eleve",
        lowCard: "faible card.",
        headers: {
          column: "Colonne",
          nullPercent: "% null",
          distinct: "Distinctes",
          sampleValues: "Valeurs d'exemple",
        },
      },
      pii: {
        potentialTitle: "PII potentielle : {{type}}",
        sampleCountTitle: "Nombre : {{count}}",
      },
    },
    aqueduct: {
      common: {
        statuses: {
          draft: "Brouillon",
          inReview: "En revision",
          approved: "Approuve",
          archived: "Archive",
        },
        filters: {
          all: "Tous",
          mapped: "Mappees",
          unmapped: "Non mappees",
        },
        exportFormats: {
          markdown: "Specification Markdown (.md)",
          sql: "Fichiers SQL (.zip)",
          json: "JSON du projet (.json)",
        },
        mappingTypes: {
          transform: "transformation",
          lookup: "recherche",
          constant: "constante",
          concat: "concatenation",
          expression: "expression logique",
        },
      },
      canvas: {
        sourceHeader: "Tables sources ({{count}})",
        cdmHeader: "Tables OMOP CDM v5.4 ({{count}})",
        suggestBanner:
          "Suggestions de {{tableMappings}} mappages de tables et {{fieldMappings}} mappages de champs",
        dismiss: "Ignorer",
      },
      toolbar: {
        goBack: "Retour",
        ai: "IA",
        suggesting: "Suggestion en cours...",
        export: "Exporter",
        collapse: "Reduire",
        expand: "Developper",
      },
      nodes: {
        sourceCols: "{{count}} col.",
        sourceRows: "{{count}} lignes",
        sourceEmpty: "vide",
        requiredCount: "obl. : {{count}}",
        unmappedCount: "{{count}} non mappees",
        stemTitle: "Table stem",
        stemSummary: "{{columns}} colonnes • {{routes}} routes de domaine",
        edgeFields: "{{mapped}}/{{total}} champs",
      },
      detailModal: {
        summary:
          "{{domain}} · {{columns}} colonnes · {{mapped}} mappees · {{unmapped}} non mappees",
        unmappedRequired: "Obligatoires non mappees ({{count}})",
        mapped: "Mappees ({{count}})",
        unmappedOptional: "Optionnelles non mappees ({{count}})",
        required: "OBLIGATOIRE",
        requiredShort: "obl.",
      },
      conceptSearch: {
        label: "Recherche de concepts",
        placeholder: "Rechercher des concepts OMOP...",
      },
      suggestions: {
        title: "Suggestions IA : {{source}} → {{target}}",
        columnsWithSuggestions_one: "{{count}} colonne avec suggestions",
        columnsWithSuggestions_other: "{{count}} colonnes avec suggestions",
        acceptAllTopSuggestions: "Accepter toutes les meilleures suggestions",
        unmappedColumnsWithSuggestions_one:
          "{{count}} colonne non mappee avec suggestions",
        unmappedColumnsWithSuggestions_other:
          "{{count}} colonnes non mappees avec suggestions",
        refresh: "Actualiser",
        analyzing: "Analyse des correspondances de colonnes...",
        failed: "Echec de la generation des suggestions",
        retry: "Reessayer",
        allMapped: "Toutes les colonnes CDM sont mappees",
        required: "Obligatoire",
        noMatches: "Aucune colonne source correspondante trouvee",
        accept: "Accepter",
        acceptTitle: "Mapper {{source}} → {{target}} comme {{mappingType}}",
      },
      fieldMapping: {
        removeMappingTitle: "Supprimer le mappage",
        selectSource: "Selectionner une source...",
        searchSourceColumns: "Rechercher des colonnes sources...",
        noMatchingColumns: "Aucune colonne correspondante",
        mapped: "mappee",
        nullDistinct: "null : {{nullPct}} % • {{distinctCount}} distinctes",
        mappingModifiedElsewhere:
          "Le mappage a ete modifie ailleurs, actualisation...",
        failedToSave: "Echec de l'enregistrement des mappages de champs",
        mappedToast: "Mappe {{source}} → {{target}}",
        removedToast: "Mappage supprime pour {{target}}",
        acceptedAiSuggestions: "{{count}} suggestions IA acceptees",
        aiAssist: "Assistance IA",
        prev: "Prec.",
        next: "Suiv.",
        deleteConfirm: "Supprimer ce mappage ?",
        deleteMapping: "Supprimer ce mappage de table",
        deletedToast: "Mappage supprime {{source}} → {{target}}",
        failedToDelete: "Echec de la suppression du mappage",
        yes: "Oui",
        no: "Non",
        allMappedBanner:
          "Toutes les colonnes CDM sont mappees — {{reviewed}} sur {{mapped}} revues",
        headers: {
          cdmColumn: "Colonne CDM",
          sourceColumn: "Colonne source",
          logic: "Logique",
          status: "Statut",
        },
        sections: {
          requiredUnmapped: "Obligatoires non mappees",
          optionalUnmapped: "Optionnelles non mappees",
          needsReview: "A revoir",
          reviewed: "Revues",
        },
        needsReview: "A revoir",
        unmapped: "Non mappee",
        logicExpression: "Logique / Expression",
        logicPlaceholder: "Logique de transformation ou expression SQL",
        reviewed: "Revue",
        removeMapping: "Supprimer le mappage",
        aiConfidence: "IA {{count}} %",
        mappedCount: "{{mapped}}/{{total}} mappees",
        documentation: "Documentation CDM",
        userGuide: "Guide utilisateur",
        etlConventions: "Conventions ETL",
        fkTable: "Table FK",
        fkDomain: "Domaine FK",
      },
    },
  },
});

const deEtlAqueduct: MessageTree = mergeMessageTrees(enEtlAqueduct, {
  etl: {
    profiler: {
      page: {
        title: "Quellprofiler",
        subtitle:
          "Quell-Datenbanken mit BlackRabbit profilieren, um Vollstandigkeit, Kardinalitat und Datenqualitat vor dem ETL zu bewerten",
        blackRabbitService: "BlackRabbit-Dienst",
        available: "verfugbar",
        unavailableScanMayFail: "nicht verfugbar - Scan kann fehlschlagen",
        scanConfiguration: "Scan-Konfiguration",
        database: "Datenbank",
        selectDatabase: "Datenbank auswahlen...",
        noDatabaseConnections:
          "Keine Datenbankverbindungen gefunden. Verbinden Sie zuerst uber den Reiter Ingestion eine Datenbank.",
        tableFilter: "Tabellenfilter",
        commaSeparated: "(kommagetrennt)",
        tableFilterPlaceholder:
          "z. B. person, visit_occurrence, condition_occurrence",
        advancedOptions: "Erweiterte Optionen",
        sampleRowsPerTable: "Stichprobenzeilen pro Tabelle",
        sampleRowsHelp:
          "Begrenzt die Zeilenstichprobe fur grosse Tabellen. Standard: 10.000.",
        scanning: "Scan lauft...",
        scanDatabase: "Datenbank scannen",
        scanFailed: "Scan fehlgeschlagen",
        searchTablesPlaceholder: "Tabellen suchen...",
        listView: "Listenansicht",
        compactView: "Kompaktansicht",
        noTablesMatching: 'Keine Tabellen passend zu "{{query}}"',
        noScanResultsYet: "Noch keine Scanergebnisse",
        emptyDescription:
          'Wahlen Sie eine Datenquelle und klicken Sie auf "Datenbank scannen", um Ihre Quelldaten zu profilieren. Die Ergebnisse umfassen Spaltenvollstandigkeit, Kardinalitat, Wertverteilungen und Datenqualitatsnoten.',
        historyHint:
          "Oder wahlen Sie einen fruheren Scan im Verlaufsbereich aus.",
        tableCount_one: "{{count}} Tabelle",
        tableCount_other: "{{count}} Tabellen",
        filteredTableCount: "{{visible}} / {{total}} Tabellen",
      },
      metrics: {
        tables: "Tabellen",
        columns: "Spalten",
        totalRows: "Gesamtzeilen",
        scanTime: "Scanzeit",
        grade: "Note",
      },
      sort: {
        rows: "Zeilen",
        columns: "Sp.",
        grade: "Note",
      },
      compact: {
        rows: "Zeilen",
        cols: "Sp.",
        highNull: "viel Null",
      },
      progress: {
        complete: "Scan abgeschlossen",
        tables: "Tabellen",
        columns: "Spalten",
        rows: "Zeilen",
        elapsed: "Verstrichen",
        rowTiming: "{{rows}} Zeilen · {{ms}} ms",
        failedCount_one: "{{count}} Tabelle fehlgeschlagen",
        failedCount_other: "{{count}} Tabellen fehlgeschlagen",
        cancel: "Abbrechen",
      },
      history: {
        title: "Scanverlauf",
        compareSelected: "Auswahl vergleichen",
        selectForComparison: "Zum Vergleich auswahlen",
        deleteScan: "Scan loschen",
        summary: "{{count}} Tabellen · {{grade}}",
        timestampDuration: "{{timestamp}} — {{seconds}} s",
      },
      heatmap: {
        title: "Vollstandigkeits-Heatmap",
        legend: {
          notAvailable: "k. A.",
        },
        tooltip: "{{table}} → {{column}} — {{value}} % Nullwerte",
        table: "Tabelle",
        showing:
          "Es werden {{shown}} von {{total}} Spalten angezeigt. Exportieren Sie den vollstandigen Bericht fur die komplette Ansicht.",
      },
      scorecard: {
        title: "Scorecard fur Datenqualitat",
        overall: "Gesamte Datenvollstandigkeit",
        basedOnAverage:
          "Basierend auf dem durchschnittlichen Nullanteil uber {{columns}} Spalten in {{tables}} Tabellen",
        checks: {
          highNullColumns: "Spalten mit hohem Nullanteil (>50%)",
          nearlyEmptyColumns: "Nahezu leere Spalten (>99%)",
          lowCardinality: "Niedrige Kardinalitat (<5 unterschiedliche Werte)",
          singleValueColumns: "Einwertige Spalten",
          emptyTables: "Leere Tabellen (0 Zeilen)",
          piiColumns: "PII-Spalten",
        },
      },
      sizeChart: {
        title: "Verteilung der Tabellengrossen",
      },
      relationships: {
        title: "CDM-Beziehungen",
        summary: "{{count}} Beziehungen uber {{tables}} Tabellen",
        rows: "{{count}} Zeilen",
      },
      accordion: {
        highNull: "viel Null",
        lowCard: "niedr. Kard.",
        headers: {
          column: "Spalte",
          type: "Typ",
          nullPercent: "Nullanteil %",
          distinct: "Unterschiedlich",
          sampleValues: "Beispielwerte",
        },
      },
      pii: {
        potentialTitle: "Mogliche PII: {{type}}",
        sampleCountTitle: "Anzahl: {{count}}",
      },
    },
    aqueduct: {
      common: {
        statuses: {
          draft: "Entwurf",
          inReview: "In Prufung",
          approved: "Genehmigt",
          archived: "Archiviert",
        },
        filters: {
          all: "Alle",
          mapped: "Gemappt",
          unmapped: "Nicht gemappt",
        },
        exportFormats: {
          markdown: "Markdown-Spezifikation (.md)",
          sql: "SQL-Dateien (.zip)",
          json: "Projekt-JSON (.json)",
        },
        mappingTypes: {
          direct: "direkt",
          transform: "Transformation",
          lookup: "Lookup",
          constant: "Konstante",
          concat: "Verkettung",
          expression: "Ausdruck",
        },
      },
      canvas: {
        sourceHeader: "Quelltabellen ({{count}})",
        cdmHeader: "OMOP-CDM-v5.4-Tabellen ({{count}})",
        suggestBanner:
          "{{tableMappings}} vorgeschlagene Tabellenzuordnungen und {{fieldMappings}} Feldzuordnungen",
        dismiss: "Ausblenden",
      },
      toolbar: {
        goBack: "Zuruck",
        ai: "KI",
        suggesting: "Vorschlage werden erstellt...",
        export: "Exportieren",
        collapse: "Einklappen",
        expand: "Ausklappen",
      },
      nodes: {
        sourceCols: "{{count}} Sp.",
        sourceRows: "{{count}} Zeilen",
        sourceEmpty: "leer",
        requiredCount: "erf.: {{count}}",
        unmappedCount: "{{count}} nicht gemappt",
        stemTitle: "Stem-Tabelle",
        stemSummary: "{{columns}} Spalten • {{routes}} Domanenrouten",
        edgeFields: "{{mapped}}/{{total}} Felder",
      },
      detailModal: {
        summary:
          "{{domain}} · {{columns}} Spalten · {{mapped}} gemappt · {{unmapped}} nicht gemappt",
        unmappedRequired: "Nicht gemappte Pflichtfelder ({{count}})",
        mapped: "Gemappt ({{count}})",
        unmappedOptional: "Nicht gemappte optionale Felder ({{count}})",
        required: "ERFORDERLICH",
        requiredShort: "erf.",
      },
      conceptSearch: {
        label: "Konzeptsuche",
        placeholder: "OMOP-Konzepte durchsuchen...",
      },
      suggestions: {
        title: "KI-Vorschlage: {{source}} → {{target}}",
        columnsWithSuggestions_one: "{{count}} Spalte mit Vorschlagen",
        columnsWithSuggestions_other: "{{count}} Spalten mit Vorschlagen",
        acceptAllTopSuggestions: "Alle Top-Vorschlage ubernehmen",
        unmappedColumnsWithSuggestions_one:
          "{{count}} nicht gemappte Spalte mit Vorschlagen",
        unmappedColumnsWithSuggestions_other:
          "{{count}} nicht gemappte Spalten mit Vorschlagen",
        refresh: "Aktualisieren",
        analyzing: "Spaltenzuordnungen werden analysiert...",
        failed: "Vorschlage konnten nicht erstellt werden",
        retry: "Erneut versuchen",
        allMapped: "Alle CDM-Spalten sind gemappt",
        required: "Erforderlich",
        noMatches: "Keine passenden Quellspalten gefunden",
        accept: "Ubernehmen",
        acceptTitle: "{{source}} → {{target}} als {{mappingType}} zuordnen",
      },
      fieldMapping: {
        removeMappingTitle: "Zuordnung entfernen",
        selectSource: "Quelle auswahlen...",
        searchSourceColumns: "Quellspalten suchen...",
        noMatchingColumns: "Keine passenden Spalten",
        mapped: "gemappt",
        nullDistinct: "Null: {{nullPct}} % • {{distinctCount}} unterschiedlich",
        mappingModifiedElsewhere:
          "Die Zuordnung wurde an anderer Stelle geandert, Aktualisierung...",
        failedToSave: "Feldzuordnungen konnten nicht gespeichert werden",
        mappedToast: "{{source}} → {{target}} zugeordnet",
        removedToast: "Zuordnung fur {{target}} entfernt",
        acceptedAiSuggestions: "{{count}} KI-Vorschlage ubernommen",
        aiAssist: "KI-Assistent",
        prev: "Zuruck",
        next: "Weiter",
        deleteConfirm: "Diese Zuordnung loschen?",
        deleteMapping: "Diese Tabellenzuordnung loschen",
        deletedToast: "Zuordnung {{source}} → {{target}} geloscht",
        failedToDelete: "Zuordnung konnte nicht geloscht werden",
        yes: "Ja",
        no: "Nein",
        allMappedBanner:
          "Alle CDM-Spalten gemappt — {{reviewed}} von {{mapped}} gepruft",
        headers: {
          cdmColumn: "CDM-Spalte",
          sourceColumn: "Quellspalte",
          logic: "Logik",
          status: "Status",
        },
        sections: {
          requiredUnmapped: "Erforderlich und nicht gemappt",
          optionalUnmapped: "Optional und nicht gemappt",
          needsReview: "Zur Prufung",
          reviewed: "Gepruft",
        },
        needsReview: "Prufung notig",
        unmapped: "Nicht gemappt",
        logicExpression: "Logik / Ausdruck",
        logicPlaceholder: "Transformationslogik oder SQL-Ausdruck",
        reviewed: "Gepruft",
        removeMapping: "Zuordnung entfernen",
        aiConfidence: "KI {{count}} %",
        mappedCount: "{{mapped}}/{{total}} gemappt",
        documentation: "CDM-Dokumentation",
        userGuide: "Benutzerhandbuch",
        etlConventions: "ETL-Konventionen",
        fkTable: "FK-Tabelle",
        fkDomain: "FK-Domane",
      },
    },
  },
});

const ptEtlAqueduct: MessageTree = mergeMessageTrees(enEtlAqueduct, {
  etl: {
    profiler: {
      page: {
        title: "Perfilador de origem",
        subtitle:
          "Perfilar bancos de dados de origem com BlackRabbit para avaliar completude, cardinalidade e qualidade dos dados antes do ETL",
        blackRabbitService: "Servico BlackRabbit",
        available: "disponivel",
        unavailableScanMayFail: "indisponivel - a varredura pode falhar",
        scanConfiguration: "Configuracao da varredura",
        database: "Banco de dados",
        selectDatabase: "Selecione um banco de dados...",
        noDatabaseConnections:
          "Nenhuma conexao de banco de dados encontrada. Use primeiro a aba de ingestao para conectar um banco de dados.",
        tableFilter: "Filtro de tabelas",
        commaSeparated: "(separadas por virgula)",
        tableFilterPlaceholder:
          "ex.: person, visit_occurrence, condition_occurrence",
        advancedOptions: "Opcoes avancadas",
        sampleRowsPerTable: "Linhas de amostra por tabela",
        sampleRowsHelp:
          "Limita a amostragem de linhas para tabelas grandes. Padrao: 10.000.",
        scanning: "Varredura em andamento...",
        scanDatabase: "Varrer banco de dados",
        scanFailed: "Falha na varredura",
        searchTablesPlaceholder: "Buscar tabelas...",
        listView: "Visualizacao em lista",
        compactView: "Visualizacao compacta",
        noTablesMatching: 'Nenhuma tabela correspondente a "{{query}}"',
        noScanResultsYet: "Ainda nao ha resultados da varredura",
        emptyDescription:
          'Selecione uma fonte de dados e clique em "Varrer banco de dados" para perfilar seus dados de origem. Os resultados incluem completude de colunas, cardinalidade, distribuicoes de valores e notas de qualidade dos dados.',
        historyHint:
          "Ou selecione uma varredura anterior no painel de historico.",
        tableCount_one: "{{count}} tabela",
        tableCount_other: "{{count}} tabelas",
        filteredTableCount: "{{visible}} / {{total}} tabelas",
      },
      metrics: {
        tables: "Tabelas",
        columns: "Colunas",
        totalRows: "Linhas totais",
        scanTime: "Tempo da varredura",
        grade: "Nota",
      },
      sort: {
        name: "Nome",
        rows: "Linhas",
        columns: "Cols.",
        grade: "Nota",
      },
      compact: {
        rows: "linhas",
        cols: "cols.",
        highNull: "muito nulo",
      },
      progress: {
        complete: "Varredura concluida",
        tables: "Tabelas",
        columns: "Colunas",
        rows: "Linhas",
        elapsed: "Tempo decorrido",
        rowTiming: "{{rows}} linhas · {{ms}} ms",
        failedCount_one: "{{count}} tabela falhou",
        failedCount_other: "{{count}} tabelas falharam",
        cancel: "Cancelar",
      },
      history: {
        title: "Historico de varreduras",
        compareSelected: "Comparar selecionadas",
        selectForComparison: "Selecionar para comparacao",
        deleteScan: "Excluir varredura",
        summary: "{{count}} tabelas · {{grade}}",
        timestampDuration: "{{timestamp}} — {{seconds}} s",
      },
      heatmap: {
        title: "Mapa de calor de completude",
        legend: {
          notAvailable: "N/D",
        },
        tooltip: "{{table}} → {{column}} — {{value}}% nulo",
        table: "Tabela",
        showing:
          "Mostrando {{shown}} de {{total}} colunas. Exporte o relatorio completo para ver tudo.",
      },
      scorecard: {
        title: "Scorecard de qualidade dos dados",
        overall: "Completude geral dos dados",
        basedOnAverage:
          "Baseado na fracao media de nulos em {{columns}} colunas de {{tables}} tabelas",
        checks: {
          highNullColumns: "Colunas com muitos nulos (>50%)",
          nearlyEmptyColumns: "Colunas quase vazias (>99%)",
          lowCardinality: "Baixa cardinalidade (<5 distintos)",
          singleValueColumns: "Colunas de valor unico",
          emptyTables: "Tabelas vazias (0 linhas)",
          piiColumns: "Colunas com PII",
        },
      },
      sizeChart: {
        title: "Distribuicao do tamanho das tabelas",
      },
      relationships: {
        title: "Relacionamentos CDM",
        summary: "{{count}} relacionamentos em {{tables}} tabelas",
        rows: "{{count}} linhas",
      },
      accordion: {
        highNull: "muito nulo",
        lowCard: "baixa card.",
        headers: {
          column: "Coluna",
          nullPercent: "% nulo",
          distinct: "Distintos",
          sampleValues: "Valores de exemplo",
        },
      },
      pii: {
        potentialTitle: "PII potencial: {{type}}",
        sampleCountTitle: "Contagem: {{count}}",
      },
    },
    aqueduct: {
      common: {
        statuses: {
          draft: "Rascunho",
          inReview: "Em revisao",
          approved: "Aprovado",
          archived: "Arquivado",
        },
        filters: {
          all: "Todos",
          mapped: "Mapeados",
          unmapped: "Nao mapeados",
        },
        exportFormats: {
          markdown: "Especificacao Markdown (.md)",
          sql: "Arquivos SQL (.zip)",
          json: "JSON do projeto (.json)",
        },
        mappingTypes: {
          direct: "direto",
          transform: "transformacao",
          lookup: "consulta",
          constant: "constante",
          concat: "concatenacao",
          expression: "expressao",
        },
      },
      canvas: {
        sourceHeader: "Tabelas de origem ({{count}})",
        cdmHeader: "Tabelas OMOP CDM v5.4 ({{count}})",
        suggestBanner:
          "{{tableMappings}} mapeamentos de tabela e {{fieldMappings}} mapeamentos de campo sugeridos",
        dismiss: "Dispensar",
      },
      toolbar: {
        goBack: "Voltar",
        ai: "IA",
        suggesting: "Sugerindo...",
        export: "Exportar",
        collapse: "Recolher",
        expand: "Expandir",
      },
      nodes: {
        sourceCols: "{{count}} cols.",
        sourceRows: "{{count}} linhas",
        sourceEmpty: "vazia",
        requiredCount: "obg.: {{count}}",
        unmappedCount: "{{count}} nao mapeadas",
        stemTitle: "Tabela stem",
        stemSummary: "{{columns}} colunas • {{routes}} rotas de dominio",
        edgeFields: "{{mapped}}/{{total}} campos",
      },
      detailModal: {
        summary:
          "{{domain}} · {{columns}} colunas · {{mapped}} mapeadas · {{unmapped}} nao mapeadas",
        unmappedRequired: "Obrigatorias nao mapeadas ({{count}})",
        mapped: "Mapeadas ({{count}})",
        unmappedOptional: "Opcionais nao mapeadas ({{count}})",
        required: "OBRIGATORIO",
        requiredShort: "obg.",
      },
      conceptSearch: {
        label: "Busca de conceitos",
        placeholder: "Buscar conceitos OMOP...",
      },
      suggestions: {
        title: "Sugestoes de IA: {{source}} → {{target}}",
        columnsWithSuggestions_one: "{{count}} coluna com sugestoes",
        columnsWithSuggestions_other: "{{count}} colunas com sugestoes",
        acceptAllTopSuggestions: "Aceitar todas as melhores sugestoes",
        unmappedColumnsWithSuggestions_one:
          "{{count}} coluna nao mapeada com sugestoes",
        unmappedColumnsWithSuggestions_other:
          "{{count}} colunas nao mapeadas com sugestoes",
        refresh: "Atualizar",
        analyzing: "Analisando correspondencias de colunas...",
        failed: "Falha ao gerar sugestoes",
        retry: "Tentar novamente",
        allMapped: "Todas as colunas CDM estao mapeadas",
        required: "Obrigatorio",
        noMatches: "Nenhuma coluna de origem correspondente encontrada",
        accept: "Aceitar",
        acceptTitle: "Mapear {{source}} → {{target}} como {{mappingType}}",
      },
      fieldMapping: {
        removeMappingTitle: "Remover mapeamento",
        selectSource: "Selecionar origem...",
        searchSourceColumns: "Buscar colunas de origem...",
        noMatchingColumns: "Nenhuma coluna correspondente",
        mapped: "mapeada",
        nullDistinct: "nulo: {{nullPct}}% • {{distinctCount}} distintos",
        mappingModifiedElsewhere:
          "O mapeamento foi modificado em outro lugar, atualizando...",
        failedToSave: "Falha ao salvar mapeamentos de campo",
        mappedToast: "{{source}} → {{target}} mapeado",
        removedToast: "Mapeamento removido para {{target}}",
        acceptedAiSuggestions: "{{count}} sugestoes de IA aceitas",
        aiAssist: "Assistencia IA",
        prev: "Anterior",
        next: "Proximo",
        deleteConfirm: "Excluir este mapeamento?",
        deleteMapping: "Excluir este mapeamento de tabela",
        deletedToast: "Mapeamento {{source}} → {{target}} excluido",
        failedToDelete: "Falha ao excluir mapeamento",
        yes: "Sim",
        no: "Nao",
        allMappedBanner:
          "Todas as colunas CDM mapeadas — {{reviewed}} de {{mapped}} revisadas",
        headers: {
          cdmColumn: "Coluna CDM",
          sourceColumn: "Coluna de origem",
          type: "Tipo",
          logic: "Logica",
          status: "Situacao",
        },
        sections: {
          requiredUnmapped: "Obrigatorias nao mapeadas",
          optionalUnmapped: "Opcionais nao mapeadas",
          needsReview: "Precisa de revisao",
          reviewed: "Revisadas",
        },
        needsReview: "Precisa de revisao",
        unmapped: "Nao mapeada",
        logicExpression: "Logica / Expressao",
        logicPlaceholder: "Logica de transformacao ou expressao SQL",
        reviewed: "Revisada",
        removeMapping: "Remover mapeamento",
        aiConfidence: "IA {{count}}%",
        mappedCount: "{{mapped}}/{{total}} mapeadas",
        documentation: "Documentacao CDM",
        userGuide: "Guia do usuario",
        etlConventions: "Convencoes ETL",
        fkTable: "Tabela FK",
        fkDomain: "Dominio FK",
      },
    },
  },
});

export const etlAqueductResources: Record<string, MessageTree> = {
  "en-US": enEtlAqueduct,
  "es-ES": mergeMessageTrees(enEtlAqueduct, {}),
  "fr-FR": frEtlAqueduct,
  "de-DE": deEtlAqueduct,
  "pt-BR": ptEtlAqueduct,
  "fi-FI": mergeMessageTrees(enEtlAqueduct, {}),
  "ja-JP": mergeMessageTrees(enEtlAqueduct, {}),
  "zh-Hans": mergeMessageTrees(enEtlAqueduct, {}),
  "ko-KR": mergeMessageTrees(enEtlAqueduct, {}),
  "hi-IN": mergeMessageTrees(enEtlAqueduct, {}),
  ar: mergeMessageTrees(enEtlAqueduct, {}),
  "en-XA": mergeMessageTrees(enEtlAqueduct, {}),
};
