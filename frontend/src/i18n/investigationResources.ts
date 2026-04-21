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

const enInvestigation: MessageTree = {
  investigation: {
    common: {
      actions: {
        newInvestigation: "New Investigation",
        createInvestigation: "Create Investigation",
        parseAndImport: "Parse & Import",
        retry: "Retry",
        cancel: "Cancel",
        close: "Close",
        runAnalysis: "Run Analysis",
        replay: "Replay",
        view: "View",
        compare: "Compare",
        createSnapshot: "Create Snapshot",
        exportPdf: "Export PDF",
        exportJson: "Export JSON",
        pin: "Pin",
        pinToDossier: "Pin to Dossier",
        add: "+ Add",
        newSet: "+ New Set",
        removeCohort: "Remove cohort",
        dismissError: "Dismiss error",
        toggleEvidenceSidebar: "Toggle evidence sidebar",
        switchToClinicalRunHistory: "Switch to clinical domain run history",
      },
      status: {
        draft: "Draft",
        active: "Active",
        complete: "Complete",
        archived: "Archived",
        completed: "Completed",
        running: "Running",
        queued: "Queued",
        pending: "Pending",
        failed: "Failed",
        saving: "Saving...",
        saved: "Saved",
        error: "Error",
      },
      domains: {
        phenotype: "Phenotype",
        clinical: "Clinical",
        genomic: "Genomic",
        synthesis: "Synthesis",
        codeExplorer: "Code Explorer",
      },
      tabs: {
        explore: "Explore",
        build: "Build",
        validate: "Validate",
        dossier: "Dossier",
        export: "Export",
        versions: "Versions",
        gallery: "OHDSI Analyses",
        tracking: "Active Run",
        history: "History",
        finngen: "FinnGen Analyses",
        finngenHistory: "Run History",
        openTargets: "Open Targets",
        gwasCatalog: "GWAS Catalog",
        upload: "Upload GWAS",
      },
      sections: {
        evidence: "Evidence",
        researchQuestion: "Research Question",
        phenotypeDefinition: "Phenotype Definition",
        populationCharacteristics: "Population Characteristics",
        clinicalEvidence: "Clinical Evidence",
        genomicEvidence: "Genomic Evidence",
        evidenceSynthesis: "Evidence Synthesis",
        limitationsCaveats: "Limitations & Caveats",
        methods: "Methods",
        versionHistory: "Version History",
        exportDossier: "Export Dossier",
        evidenceDossier: "Evidence Dossier",
        qcChecklist: "QC Checklist",
        importMode: "Import Mode",
        selectCohorts: "Select Cohorts",
        atlasJson: "Atlas JSON",
        fileUpload: "File Upload",
        selectedCohorts: "Selected Cohorts",
        conceptHierarchy: "Concept Hierarchy",
        conceptSet: "Concept Set",
        significantLoci: "Significant Loci",
        columnMapping: "Column Mapping",
        analysisParameters: "Analysis Parameters",
        dataSource: "Data Source",
        loadingSources: "Loading sources...",
      },
      labels: {
        title: "Title",
        optional: "optional",
        updated: "Updated {{date}}",
        coverage: "Coverage",
        domains: "Domains",
        howItWorks: "How It Works",
        sampleInvestigations: "Sample Investigations",
        sampleInvestigationsSubtitle:
          "Explore these examples to see the Evidence Investigation workflow in action",
        recentInvestigations: "Recent Investigations",
        yourInvestigations: "Your Investigations",
        yourInvestigationsSubtitle:
          "Recent investigations you have created",
        conceptSets: "Concept Sets",
        cohorts: "Cohorts",
        analyses: "Analyses",
        pins: "Pins",
        runs: "Runs",
        startExploring:
          "Start exploring - add concepts, cohorts, and analyses to build evidence",
        noDate: "--",
        results: "Results",
        estTime: "Est. {{value}}",
        fromInvestigation: "From investigation",
        cohortFromThisInvestigation: "* = cohort from this investigation",
        openTargetsPlatform: "Open Targets Platform",
        phase1b: "Phase 1b",
        pValueInline: "p = {{value}}",
      },
      empty: {
        noInvestigationsYet: "No investigations yet",
        noInvestigationsSubtitle:
          "Create your first structured evidence dossier to get started.",
        noResearchQuestionDefined: "No research question defined",
        noFindingsPinned: "No findings pinned to this section yet",
        noPinsYet: "No pins yet",
        noSnapshotsYet: "No snapshots yet.",
        noConcepts: "No concepts",
        noAnalyses: "No analyses",
        noEvidence: "No evidence",
        none: "--",
        noResultsFound: "No results found.",
        noSequenceData: "No sequence data available",
        noAnalysesRunYet:
          "No analyses have been run yet. Select an analysis from the gallery to get started.",
        noCohortsAvailable: "No cohorts available.",
      },
      messages: {
        loadingInvestigation: "Loading investigation...",
        investigationLoadFailed:
          "Investigation not found or could not be loaded.",
        createInvestigationFailed:
          "Failed to create investigation. Please try again.",
        aiWillAnalyze:
          "AI will analyze your research question to suggest phenotype concepts.",
        exportSucceeded: "Exported successfully",
        exportFailed: "Export failed. Please try again.",
        searchFailed: "Search failed. Please try again.",
        enterAtLeast2Characters: "Enter at least 2 characters to search.",
        searchOmopMinimum:
          "Type at least 2 characters to search OMOP concepts",
        loadingVersions: "Loading versions...",
        waitingInQueue: "Waiting in queue...",
        running: "Running...",
        analysisCancelled: "Analysis cancelled",
        analysisFailed: "Analysis failed",
        analysisDispatchFailed: "Analysis dispatch failed",
        initializing: "Initializing...",
        compareComingPhase4: "Coming in Phase 4",
        snapshotsAutoComplete:
          "Snapshots are created automatically when an investigation is marked Complete.",
        finngenLoading: "Loading...",
        loadingPins: "Loading pins",
        unexpectedDispatchError:
          "An unexpected error occurred while dispatching the analysis.",
      },
      placeholders: {
        investigationTitle: "e.g., Cardiovascular risk in T2DM patients",
        researchQuestion: "What is the comparative effectiveness of...",
        conceptSearch: "Search concepts... (min 2 chars)",
        atlasJson:
          'Paste Atlas cohort definition JSON here...\n\n{"ConceptSets": [], "PrimaryCriteria": {...}}',
        addSectionNarrative: "Add section narrative...",
        addNoteBefore: "Add note before...",
        addNoteAfter: "Add note after...",
        clickToAddNarrative: "Click to add narrative...",
        searchTrait:
          "Search trait or phenotype (e.g. type 2 diabetes)",
        searchGene: "Search gene (e.g. TCF7L2)",
        searchGeneOpenTargets:
          "Search gene symbol or name (e.g. BRCA1)",
        searchDiseaseOpenTargets:
          "Search disease or phenotype (e.g. breast cancer)",
        selectSource: "Select a source...",
        selectTargetCohort: "Select target cohort...",
        selectOutcomeCohort: "Select outcome cohort...",
        selectComparatorCohort: "Select comparator cohort...",
        untitledConceptSet: "Untitled concept set",
        searchCohorts: "Search cohorts...",
        selectColumn: "-- select --",
      },
      counts: {
        conceptSet_one: "{{count}} concept set",
        conceptSet_other: "{{count}} concept sets",
        cohort_one: "{{count}} cohort",
        cohort_other: "{{count}} cohorts",
        query_one: "{{count}} query",
        query_other: "{{count}} queries",
        upload_one: "{{count}} upload",
        upload_other: "{{count}} uploads",
        pin_one: "{{count}} pin",
        pin_other: "{{count}} pins",
        section_one: "{{count}} section",
        section_other: "{{count}} sections",
        result_one: "{{count}} result",
        result_other: "{{count}} results",
        locus_one: "{{count}} locus",
        locus_other: "{{count}} loci",
        patient_one: "{{count}} patient",
        patient_other: "{{count}} patients",
        row_one: "{{count}} row",
        row_other: "{{count}} rows",
        analysis_one: "{{count}} analysis",
        analysis_other: "{{count}} analyses",
        completed_one: "{{count}} complete",
        completed_other: "{{count}} complete",
        running_one: "{{count}} running",
        running_other: "{{count}} running",
        failed_one: "{{count}} failed",
        failed_other: "{{count}} failed",
        subject_one: "{{count}} subject",
        subject_other: "{{count}} subjects",
        link_one: "{{count}} link",
        link_other: "{{count}} links",
      },
      time: {
        secondsAgo: "{{count}}s ago",
        minutesAgo: "{{count}}m ago",
        hoursAgo: "{{count}}h ago",
      },
    },
    landing: {
      title: "Evidence Investigation",
      subtitle:
        "Bridge clinical phenotyping with genomic evidence - from research question to Evidence Dossier",
      recentInvestigations: "Recent Investigations",
      noInvestigations:
        "Create your first structured evidence dossier to get started.",
      workflow: {
        askQuestion: {
          label: "Ask a Question",
          description: "Define your research question and title.",
        },
        buildPhenotype: {
          label: "Build Phenotype",
          description: "Curate concept sets and cohort definitions.",
        },
        gatherEvidence: {
          label: "Gather Evidence",
          description: "Run HADES analyses and pull genomic signals.",
        },
        synthesizeDossier: {
          label: "Synthesize Dossier",
          description:
            "Export a structured Evidence Dossier for publication.",
        },
      },
      sampleInvestigations: {
        ckd: {
          title: "SGLT2 Inhibitors and CKD Progression in T2DM",
          question:
            "Does SGLT2 inhibition reduce chronic kidney disease progression in patients with Type 2 Diabetes Mellitus?",
          badges: {
            conceptSets: "3 concept sets",
            cohorts: "2 cohorts",
            estimation: "1 estimation",
            loci: "5 GWAS loci",
          },
        },
        statin: {
          title:
            "Statin Paradox - Simvastatin vs Atorvastatin Cardiovascular Outcomes",
          question:
            "Is there a clinically meaningful difference in cardiovascular outcomes between simvastatin and atorvastatin in statin-naive patients?",
          badges: {
            conceptSets: "2 concept sets",
            cohorts: "2 cohorts",
            characterization: "1 characterization",
            estimation: "1 estimation",
          },
        },
        tcf7l2: {
          title: "TCF7L2 and Pancreatic Beta Cell Dysfunction",
          question:
            "Does the TCF7L2 risk variant contribute to T2DM through pancreatic beta cell dysfunction, and what clinical evidence supports this mechanism?",
          badges: {
            conceptSet: "1 concept set",
            cohort: "1 cohort",
            associations: "12 Open Targets associations",
            loci: "3 GWAS loci",
          },
        },
      },
    },
    newPage: {
      title: "New Evidence Investigation",
      subtitle: "Start a structured dossier for your research question.",
      back: "Evidence Investigation",
    },
    phenotype: {
      importModes: {
        parthenon: {
          label: "Parthenon Cohorts",
          description: "Select from existing cohort definitions",
        },
        json: {
          label: "Atlas JSON",
          description: "Paste a cohort definition JSON from Atlas",
        },
        file: {
          label: "File Upload",
          description: "Upload a CSV or JSON cohort file",
        },
        phenotypeLibrary: {
          label: "Phenotype Library",
          description:
            "Browse OHDSI Phenotype Library (1,100+ validated phenotypes)",
        },
      },
      atlas: {
        exportHint: "Export from Atlas: Cohort Definition -> Export -> JSON",
        parseErrorEmpty:
          "Please paste an Atlas JSON definition before parsing.",
        parseErrorInvalid:
          "Invalid JSON - please check for syntax errors.",
        parseErrorShape:
          "Unrecognized format - expected ConceptSets, PrimaryCriteria, or expression keys.",
        importSucceeded: "{{summary}} - imported successfully.",
        summary: "Found {{conceptSets}} concept sets, {{criteria}} criteria",
      },
      file: {
        dropPrompt: "Drop a CSV or JSON file here, or click to browse",
        invalidJson: "Invalid JSON file",
        unsupportedType: "Unsupported file type",
        loadedRows: "Loaded {{count}} rows from {{name}}",
        parsedJson: "JSON parsed - {{count}} concept sets",
      },
      conceptExplorer: {
        allDomains: "All Domains",
        condition: "Condition",
        drug: "Drug",
        measurement: "Measurement",
        procedure: "Procedure",
        observation: "Observation",
        standard: "Standard",
        standardOnly: "Standard only",
        addToConceptSet: "Add to concept set",
        patients: "{{count}} pts",
        noConceptsFound:
          "No concepts found matching \"{{query}}\"",
        nonStandardHidden:
          "({{count}} non-standard hidden - uncheck \"Standard only\" to show)",
      },
      conceptSet: {
        excluded: "Excluded",
        includeDescendants: "Include descendants",
        exclude: "Exclude",
        removeFromSet: "Remove from concept set",
        searchPrompt:
          "Search for concepts and add them to build your concept set",
        metadata: "ID: {{conceptId}} · {{vocabularyId}} · {{domainId}}",
      },
      codewas: {
        case: "Case",
        control: "Control",
        versus: "vs.",
        topSignals: "Top Signals ({{count}})",
        label: "Label",
        count: "Count",
        effectEstimates: "Effect Estimates",
        volcanoComingSoon:
          "Interactive volcano plot coming in a future update.",
      },
      phenotypeLibrary: {
        title: "Phenotype Library",
        searchPlaceholder:
          "Search the OHDSI Phenotype Library (1,100+ validated phenotypes)",
        searchFailed:
          "Failed to search phenotype library. Please try again.",
        noResults: 'No phenotypes found for "{{query}}"',
        emptyPrompt: "Search the OHDSI Phenotype Library",
        validatedPhenotypes: "1,100+ validated phenotypes",
        noDescriptionAvailable: "No description available.",
        selected: "Selected",
        select: "Select",
      },
      cohortPicker: {
        loading: "Loading cohorts...",
        loadFailed: "Failed to load cohort definitions.",
        noSearchMatches: "No cohorts match your search.",
        noDefinitions: "No cohort definitions found.",
        primary: "Primary",
        primarySelected: "Primary ✓",
        setAsPrimary: "Set as Primary",
      },
      cohortOverlap: {
        title: "Cohort Overlap Matrix",
        selectTwoCohorts: "Select 2+ cohorts to see overlap",
        patientCountTooltip: "{{name}}: {{count}} patients",
        runOperationsToComputeOverlap: "Run operations to compute overlap",
        footnote:
          "Diagonal: cohort sizes. Off-diagonal: run set operations to compute overlap.",
      },
      conceptTree: {
        selected: "(selected)",
        loadingHierarchy: "Loading hierarchy...",
        noHierarchyData: "No hierarchy data available for this concept.",
        conceptLabel: "Concept {{id}}",
      },
      cohortSizeComparison: {
        title: "Cohort Size Comparison",
        primaryLegend: "Gold = primary cohort",
      },
      attrition: {
        totalPopulation: "Total Population",
        countLabel: "n = {{count}}",
        excluded: "{{count}} excluded",
        noData: "No attrition data available",
      },
      schemaDensity: {
        addConcepts: "Add concepts to see domain coverage",
        domainCoverage: "Domain Coverage",
        total: "{{count}} total",
        tooltip: "{{count}} concepts",
      },
      validation: {
        atLeastOneConceptSetDefined: "At least one concept set defined",
        atLeastOneCohortSelected: "At least one cohort selected",
        primaryCohortDesignated: "Primary cohort designated",
        noEmptyConceptSets: "No empty concept sets",
        codewasValidationRun: "CodeWAS validation run",
        addConceptsExploreTab: "Add concepts in the Explore tab",
        selectCohortsBuildTab: "Select cohorts in the Build tab",
        setPrimaryCohort: "Set a primary cohort for analyses",
        allSetsPopulated: "All sets populated",
        runCodewas: "Run CodeWAS to validate phenotype",
        passed: "{{passed}}/{{total}} passed",
        includeExploreBuild:
          "{{count}} concept sets built in the Explore tab will be included in cohort generation.",
      },
    },
    clinical: {
      groupMeta: {
        characterize: {
          label: "Characterize",
          description:
            "Describe your populations - demographics, comorbidities, and treatment patterns.",
        },
        compare: {
          label: "Compare",
          description:
            "Estimate causal effects and compare outcomes across exposures or time windows.",
        },
        predict: {
          label: "Predict",
          description:
            "Train patient-level machine learning models to forecast future outcomes.",
        },
      },
      estimatedTimes: {
        underOneMinute: "< 1 min",
        oneToThreeMinutes: "1-3 min",
        twoToFiveMinutes: "2-5 min",
        fiveToFifteenMinutes: "5-15 min",
        tenToFortyFiveMinutes: "10-45 min",
        fifteenToSixtyMinutes: "15-60 min",
      },
      prerequisites: {
        atLeastOneCohortDefined: "At least one cohort defined",
        targetCohort: "Target cohort",
        comparatorCohort: "Comparator cohort",
        outcomeCohort: "Outcome cohort",
        exposureCohort: "Exposure cohort",
        completedEstimations2Plus: "2+ completed estimations",
      },
      analysisMeta: {
        characterization: {
          label: "Cohort Characterization",
          description:
            "Baseline demographics, comorbidities, drug utilization, and temporal patterns for target and comparator cohorts.",
        },
        incidence_rate: {
          label: "Incidence Rate Analysis",
          description:
            "Calculate incidence rates with exact Poisson confidence intervals, stratified by age, sex, or calendar year.",
        },
        pathway: {
          label: "Treatment Pathway",
          description:
            "Visualize sequential treatment patterns and drug utilization trajectories within a cohort.",
        },
        estimation: {
          label: "Comparative Effectiveness",
          description:
            "Population-level effect estimation using CohortMethod - propensity score matching/stratification with Cox models.",
        },
        sccs: {
          label: "Self-Controlled Case Series",
          description:
            "Within-person comparison of event rates during exposed vs. unexposed time windows.",
        },
        evidence_synthesis: {
          label: "Evidence Synthesis",
          description:
            "Fixed-effect or Bayesian random-effects meta-analysis pooling estimates from multiple analyses.",
        },
        prediction: {
          label: "Patient-Level Prediction",
          description:
            "Train ML models (LASSO, gradient boosting, random forest, deep learning) to predict outcomes.",
        },
      },
      requires: "Requires: {{requirements}}",
      drawer: {
        analysisConfiguration: "Analysis configuration",
        configureAnalysis: "Configure Analysis",
        closeDrawer: "Close drawer",
        targetCohort: "Target Cohort",
        exposureCohortTarget: "Exposure Cohort (Target)",
        comparatorCohort: "Comparator Cohort",
        outcomeCohort: "Outcome Cohort",
        outcomeCohorts: "Outcome Cohorts",
        minCellCount: "Min Cell Count",
        minCellCountLabel: "Minimum cell count",
        minCellCountHelp:
          "Cells with fewer patients are suppressed in output.",
        tarStart: "TAR Start (days)",
        tarEnd: "TAR End (days)",
        tarStartLabel: "Time-at-risk start days",
        tarEndLabel: "Time-at-risk end days",
        propensityScoreMethod: "Propensity Score Method",
        psMatching: "PS Matching",
        psStratification: "PS Stratification",
        psWeighting: "PS Weighting (IPTW)",
        modelType: "Model Type",
        lassoLogisticRegression: "LASSO Logistic Regression",
        gradientBoosting: "Gradient Boosting",
        randomForest: "Random Forest",
        adaBoost: "AdaBoost",
        decisionTree: "Decision Tree",
        exposureUsesTarget:
          "Exposure cohort is the selected target cohort above.",
        naivePeriod: "Naive Period (days)",
        naivePeriodLabel: "Naive period days",
        naivePeriodHelp:
          "Days at the start of observation to exclude from analysis.",
        synthesisPrompt: "Select 2+ completed estimation results",
        synthesisHelp:
          "Evidence synthesis pooling is not yet configurable here. Run from the estimation results view.",
      },
      payloadNames: {
        characterization: "Investigation Characterization",
        incidence_rate: "Investigation Incidence Rate",
        estimation: "Investigation Comparative Estimation",
        prediction: "Investigation Patient-Level Prediction",
        sccs: "Investigation SCCS",
        pathway: "Investigation Pathway Analysis",
        evidence_synthesis: "Investigation Evidence Synthesis",
      },
      charts: {
        kaplanMeierTitle: "Kaplan-Meier Survival Curve",
        timeDays: "Time (days)",
        survivalProbability: "Survival Probability",
        tooltipTime: "t = {{value}}",
        curveValue: "{{label}}: {{value}}%",
        propensityScoreDistribution: "Propensity Score Distribution",
        propensityScore: "Propensity Score",
      },
      tracker: {
        results: "Results",
        analysisFailedDefault: "Analysis failed. Check logs for details.",
      },
      runHistory: {
        compareTitle: "Coming in Phase 4",
        replayTitle: "View or replay this execution",
        viewTitle: "View execution details",
      },
      results: {
        cohortCounts: "Cohort Counts",
        targetSubjects: "Target subjects",
        comparatorSubjects: "Comparator subjects",
        topFeaturesBySmd: "Top Features by SMD",
        covariate: "Covariate",
        incidenceRate: "Incidence Rate",
        perPersonYear: "per person-year",
        personYears: "Person-years",
        cases: "Cases",
        comparativeEffectiveness: "Comparative Effectiveness",
        hazardRatio: "Hazard Ratio",
        target: "Target",
        comparator: "Comparator",
        outcomeEvents: "Outcome events",
        estimates: "Estimates",
        predictionPerformance: "Prediction Performance",
        aucAuroc: "AUC / AUROC",
        sensitivity: "Sensitivity",
        specificity: "Specificity",
        ppv: "PPV",
        npv: "NPV",
        selfControlledCaseSeries: "Self-Controlled Case Series",
        incidenceRateRatio: "Incidence Rate Ratio (IRR)",
        pooledHazardRatio: "Pooled Hazard Ratio",
        tauHeterogeneity: "Tau (heterogeneity)",
        topTreatmentSequences: "Top Treatment Sequences",
        estimateFallback: "Estimate",
      },
    },
    genomic: {
      title: "Genomic Evidence",
      subtitle: "Open Targets · GWAS Catalog · Summary Statistics",
      uploadTitle: "Upload GWAS Summary Statistics",
      releaseToUpload: "Release to upload",
      dropSummaryStats: "Drop GWAS summary stats",
      fileTypes: ".tsv, .csv, or .gz · max 500 MB",
      uploadFailed: "Upload failed. Please try again.",
      allColumnsRequired:
        "All required columns must be mapped before confirming.",
      parseFailed: "Failed to parse file. Please check the format.",
      confirmMapping: "Confirm Mapping",
      threshold: "{{count}} loci · threshold p < {{threshold}}",
      noLoci: "No loci below significance threshold ({{threshold}})",
      pinThisLocus: "Pin this locus",
      chr: "Chr",
      position: "Position",
      pValue: "p-value",
      betaOr: "Beta/OR",
      refAlt: "Ref/Alt",
      manhattanPlot: "Manhattan Plot",
      qqPlot: "QQ Plot",
      showingOfResults:
        "Showing {{shown}} of {{total}} results - GWAS Catalog",
      sample: "Sample:",
      snps: "SNPs:",
      unknownTrait: "Unknown trait",
      platform: "Platform",
      gene: "Gene",
      disease: "Disease",
      crossDomainLinks: "Cross-domain links",
      qqPlotNoData: "No p-value data available",
      qqPlotExpectedNegLogP: "Expected -log10(p)",
      qqPlotObservedNegLogP: "Observed -log10(p)",
      lambdaLabel: "λ = {{value}}",
      noGwasDataAvailable: "No GWAS data available",
      noGwasDataAvailableAria: "Manhattan plot: no GWAS data available",
      manhattanAriaNoVariants: "Manhattan plot: no variants",
      manhattanAriaTopPeak:
        "top peak at chr{{chr}}:{{pos}}, p={{pValue}}",
      manhattanAriaNoPeaks: "no peaks",
      manhattanAriaSummary:
        "Manhattan plot: {{variantCount}} variants, {{significantCount}} genome-wide significant, {{topPeak}}",
      negLogP: "-log10(p)",
    },
    synthesis: {
      completeTitle: "Complete",
      removePin: "Remove pin",
      markKeyFinding: "Mark as key finding",
      unmarkKeyFinding: "Unmark key finding",
      customFinding: "Custom finding",
      exportDescription:
        "Export the full evidence dossier including all pinned findings, narratives, and section notes.",
    },
  },
};

export const investigationResources: Record<string, MessageTree> = {
  "en-US": enInvestigation,
  "es-ES": mergeMessageTrees(enInvestigation, {}),
  "fr-FR": mergeMessageTrees(enInvestigation, {}),
  "de-DE": mergeMessageTrees(enInvestigation, {}),
  "pt-BR": mergeMessageTrees(enInvestigation, {}),
  "fi-FI": mergeMessageTrees(enInvestigation, {}),
  "ja-JP": mergeMessageTrees(enInvestigation, {}),
  "zh-Hans": mergeMessageTrees(enInvestigation, {}),
  "ko-KR": mergeMessageTrees(enInvestigation, {}),
  "hi-IN": mergeMessageTrees(enInvestigation, {}),
  ar: mergeMessageTrees(enInvestigation, {}),
  "en-XA": mergeMessageTrees(enInvestigation, {}),
};
