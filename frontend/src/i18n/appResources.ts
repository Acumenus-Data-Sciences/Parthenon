type MessageTree = {
  [key: string]: string | MessageTree;
};

const enApp: MessageTree = {
  analysis: {
    titles: {
      characterization: "Characterization",
      incidenceRate: "Incidence Rate Analysis",
      pathway: "Pathway Analysis",
      estimation: "Estimation Analysis",
      prediction: "Prediction Analysis",
      sccs: "SCCS Analysis",
      evidenceSynthesis: "Evidence Synthesis Analysis",
    },
  },
  errors: {
    boundary: {
      title: "Something went wrong",
      message: "An unexpected error occurred. Try reloading the page.",
      reloadPage: "Reload page",
    },
    route: {
      routeError: "Route error",
      pageFailed: "The page failed to render.",
      analysisDescription:
        "This analysis page hit a render or route-loading error.",
      label: "Error",
      backToAnalyses: "Back To Analyses",
      reloadPage: "Reload Page",
    },
  },
  covariates: {
    title: "Covariate Settings",
    description:
      "Select which domains to include as covariates for FeatureExtraction.",
    groups: {
      core: "Core Domains",
      extended: "Extended Domains",
      indices: "Comorbidity Indices",
    },
    labels: {
      demographics: "Demographics",
      conditionOccurrence: "Condition Occurrence",
      drugExposure: "Drug Exposure",
      procedureOccurrence: "Procedure Occurrence",
      measurement: "Measurement",
      observation: "Observation",
      deviceExposure: "Device Exposure",
      visitCount: "Visit Count",
      charlsonComorbidity: "Charlson Comorbidity",
      dcsi: "DCSI (Diabetes)",
      chads2: "CHADS2",
      chads2Vasc: "CHA2DS2-VASc",
    },
    timeWindows: "Time Windows",
    to: "to",
    days: "days",
    addTimeWindow: "Add time window",
  },
  studies: {
    list: {
      title: "Studies",
      subtitle: "Orchestrate and manage federated research studies",
      tableView: "Table view",
      cardView: "Card view",
      searchPlaceholder: "Search studies...",
      noSearchMatches: "No studies match \"{{query}}\"",
      typeToFilter: "Type to filter {{count}} studies",
      newStudy: "New Study",
      solr: "Solr",
      drilldownTitle: "{{phase}} Studies",
      filterLabels: {
        status: "Status",
        type: "Type",
        priority: "Priority",
      },
      loadFailed: "Failed to load studies",
      clear: "Clear",
      empty: {
        noMatchingTitle: "No matching studies",
        noStudiesTitle: "No studies yet",
        noResultsFor: "No studies found for \"{{query}}\"",
        tryAdjusting: "Try adjusting your search terms.",
        createFirst:
          "Create your first study to orchestrate federated research.",
      },
      table: {
        title: "Title",
        type: "Type",
        status: "Status",
        priority: "Priority",
        pi: "PI",
        created: "Created",
      },
      pagination: {
        showing: "Showing {{start}} - {{end}} of {{total}}",
        page: "{{page}} / {{totalPages}}",
      },
    },
    metrics: {
      total: "Total",
      active: "Active",
      preStudy: "Pre-Study",
      inProgress: "In Progress",
      postStudy: "Post-Study",
    },
    studyTypes: {
      characterization: "Characterization",
      populationLevelEstimation: "PLE",
      patientLevelPrediction: "PLP",
      comparativeEffectiveness: "Comparative",
      safetySurveillance: "Safety",
      drugUtilization: "Drug Util",
      qualityImprovement: "QI",
      custom: "Custom",
    },
    statuses: {
      draft: "Draft",
      protocol_development: "Protocol Dev",
      feasibility: "Feasibility",
      irb_review: "IRB Review",
      execution: "Execution",
      analysis: "Analysis",
      published: "Published",
      archived: "Archived",
    },
    priorities: {
      critical: "Critical",
      high: "High",
      medium: "Medium",
      low: "Low",
    },
    phases: {
      activeMetric: "Active",
      pre_study: "Pre-Study",
      active: "In Progress",
      post_study: "Post-Study",
    },
    create: {
      backToStudies: "Studies",
      title: "Create Study",
      subtitle: "Configure your research study step by step",
      previous: "Previous",
      next: "Next",
      createAsDraft: "Create as Draft",
      steps: {
        basics: "Basics",
        science: "Scientific Design",
        team: "Team & Timeline",
        review: "Review & Create",
      },
      studyTypes: {
        characterization: {
          label: "Characterization",
          description: "Describe patient populations and treatment patterns",
        },
        populationLevelEstimation: {
          label: "Population-Level Estimation",
          description: "Estimate causal effects using observational data",
        },
        patientLevelPrediction: {
          label: "Patient-Level Prediction",
          description: "Predict individual patient outcomes",
        },
        comparativeEffectiveness: {
          label: "Comparative Effectiveness",
          description: "Compare treatments in real-world settings",
        },
        safetySurveillance: {
          label: "Safety Surveillance",
          description: "Monitor drug safety signals post-market",
        },
        drugUtilization: {
          label: "Drug Utilization",
          description: "Analyze medication use patterns and trends",
        },
        qualityImprovement: {
          label: "Quality Improvement",
          description: "Assess care quality and guideline adherence",
        },
        custom: {
          label: "Custom",
          description: "Define a custom study type",
        },
      },
      designs: {
        select: "Select design...",
        retrospectiveCohort: "Retrospective Cohort",
        prospectiveCohort: "Prospective Cohort",
        caseControl: "Case-Control",
        crossSectional: "Cross-Sectional",
        selfControlled: "Self-Controlled Case Series",
        nestedCaseControl: "Nested Case-Control",
        metaAnalysis: "Meta-Analysis",
        networkStudy: "Network Study",
        methodological: "Methodological",
      },
      phases: {
        select: "Select phase...",
        phaseI: "Phase I",
        phaseII: "Phase II",
        phaseIII: "Phase III",
        phaseIV: "Phase IV",
        notApplicable: "Not Applicable",
      },
      basics: {
        studyType: "Study Type *",
        title: "Title *",
        titlePlaceholder:
          "e.g., Effect of Statins on Cardiovascular Outcomes in T2DM",
        shortTitle: "Short Title",
        shortTitlePlaceholder: "e.g., LEGEND-T2DM",
        priority: "Priority",
        studyDesign: "Study Design",
        description: "Description",
        descriptionPlaceholder: "Brief description of the study...",
        tags: "Tags",
        tagsPlaceholder: "Add tag and press Enter...",
        addTag: "Add tag",
      },
      science: {
        aiPrompt:
          "Let AI suggest scientific design fields based on your study title",
        generating: "Generating...",
        generateWithAi: "Generate with AI",
        aiUnavailable:
          "AI service unavailable. Please fill in fields manually.",
        rationale: "Scientific Rationale",
        rationalePlaceholder:
          "Why is this study needed? What gap in knowledge does it address?",
        hypothesis: "Hypothesis",
        hypothesisPlaceholder: "State the primary hypothesis being tested...",
        primaryObjective: "Primary Objective",
        primaryObjectivePlaceholder:
          "What is the main objective of this study?",
        secondaryObjectives: "Secondary Objectives",
        secondaryObjectivePlaceholder: "Add objective and press Enter...",
        addSecondaryObjective: "Add secondary objective",
        fundingSource: "Funding Source",
        fundingSourcePlaceholder:
          "e.g., NIH R01, PCORI, Industry-sponsored",
      },
      team: {
        startDate: "Study Start Date",
        endDate: "Study End Date",
        endDateAfterStart: "End date must be after start date",
        targetSites: "Target Enrollment Sites",
        targetSitesPlaceholder: "e.g., 10",
        studyPhase: "Study Phase",
        nctId: "ClinicalTrials.gov ID",
        nctIdPlaceholder: "e.g., NCT12345678",
        note:
          "Team members, sites, and cohorts can be configured after the study is created from the study dashboard.",
      },
      review: {
        basics: "Basics",
        scientificDesign: "Scientific Design",
        timelineRegistration: "Timeline & Registration",
        labels: {
          title: "Title:",
          shortTitle: "Short Title:",
          type: "Type:",
          priority: "Priority:",
          design: "Design:",
          rationale: "Rationale:",
          hypothesis: "Hypothesis:",
          primaryObjective: "Primary Objective:",
          secondaryObjectives: "Secondary Objectives:",
          start: "Start:",
          end: "End:",
          targetSites: "Target Sites:",
          phase: "Phase:",
          nctId: "NCT ID:",
          funding: "Funding:",
        },
      },
    },
    detail: {
      loadFailed: "Failed to load study",
      backToStudies: "Back to studies",
      studies: "Studies",
      confirmDelete:
        "Are you sure you want to delete this study? This action cannot be undone.",
      confirmArchive: "Archive this study? It can be restored later.",
      copyTitle: "Copy of {{title}}",
      tabs: {
        overview: "Overview",
        design: "Design",
        analyses: "Analyses",
        results: "Results",
        progress: "Progress",
        sites: "Sites",
        team: "Team",
        cohorts: "Cohorts",
        milestones: "Milestones",
        artifacts: "Artifacts",
        activity: "Activity",
        federated: "Federated",
      },
      statuses: {
        draft: "Draft",
        protocol_development: "Protocol Development",
        feasibility: "Feasibility",
        irb_review: "IRB Review",
        recruitment: "Recruitment",
        execution: "Execution",
        analysis: "Analysis",
        synthesis: "Synthesis",
        manuscript: "Manuscript",
        published: "Published",
        archived: "Archived",
        withdrawn: "Withdrawn",
      },
      studyTypes: {
        characterization: "Characterization",
        population_level_estimation: "Population-Level Estimation",
        patient_level_prediction: "Patient-Level Prediction",
        comparative_effectiveness: "Comparative Effectiveness",
        safety_surveillance: "Safety Surveillance",
        drug_utilization: "Drug Utilization",
        quality_improvement: "Quality Improvement",
        custom: "Custom",
      },
      actions: {
        transitionTo: "Transition to",
        generateManuscriptTitle: "Generate manuscript from completed analyses",
        manuscript: "Manuscript",
        duplicateStudy: "Duplicate study",
        exportJson: "Export as JSON",
        archiveStudy: "Archive study",
        deleteStudy: "Delete study",
      },
      sections: {
        about: "About",
        analysisPipeline: "Analysis Pipeline ({{count}})",
        executionProgress: "Execution Progress",
        details: "Details",
        timeline: "Timeline",
        tags: "Tags",
        createdBy: "Created By",
      },
      labels: {
        primaryObjective: "Primary Objective",
        hypothesis: "Hypothesis",
        secondaryObjectives: "Secondary Objectives",
        principalInvestigator: "Principal Investigator",
        leadDataScientist: "Lead Data Scientist",
        studyDesign: "Study Design",
        phase: "Phase",
        protocolVersion: "Protocol Version",
        funding: "Funding",
        clinicalTrialsGov: "ClinicalTrials.gov",
        start: "Start:",
        end: "End:",
        targetSites: "Target Sites:",
        created: "Created:",
      },
      messages: {
        noDescription: "No description provided",
        moreAnalyses: "+{{count}} more analyses",
      },
      progress: {
        completed: "{{count}} completed",
        running: "{{count}} running",
        failed: "{{count}} failed",
        pending: "{{count}} pending",
      },
    },
    dashboard: {
      progressSummary: "{{completed}} of {{total}} analyses completed",
      stats: {
        total: "Total",
        pending: "Pending",
        running: "Running",
        completed: "Completed",
        failed: "Failed",
      },
      sections: {
        studyAnalyses: "Study Analyses",
      },
      table: {
        type: "Type",
        name: "Name",
        status: "Status",
      },
      messages: {
        notExecuted: "Not executed",
      },
      empty: {
        title: "No analyses in this study",
        message: "Add analyses in the Design tab to get started.",
      },
    },
    analyses: {
      selectSource: "Select source...",
      executeAll: "Execute All",
      addAnalysisToStudy: "Add Analysis to Study",
      emptyMessage:
        "Add characterizations, estimations, predictions, and more to build your analysis pipeline",
      groupHeader: "{{label}} ({{count}})",
      openAnalysisDetail: "Open analysis detail",
      confirmRemove: "Remove this analysis from the study?",
      removeFromStudy: "Remove from study",
      analysisId: "Analysis ID",
      lastRun: "Last Run",
      error: "Error",
      viewFullDetail: "View Full Detail",
    },
    results: {
      sections: {
        results: "Results ({{count}})",
        syntheses: "Syntheses ({{count}})",
      },
      actions: {
        synthesize: "Synthesize",
        markPrimary: "Mark as primary",
        unmarkPrimary: "Unmark primary",
        markPublishable: "Mark as publishable",
        unmarkPublishable: "Unmark publishable",
        cancel: "Cancel",
      },
      filters: {
        allTypes: "All types",
        publishableOnly: "Publishable only",
      },
      empty: {
        noResultsTitle: "No results yet",
        noResultsMessage: "Results will appear here after analyses are executed",
        noSummaryData: "No summary data available",
        noSynthesesTitle: "No syntheses",
        noSynthesesMessage:
          "Combine results from multiple sites using meta-analysis",
      },
      resultTypes: {
        cohort_count: "Cohort Count",
        characterization: "Characterization",
        incidence_rate: "Incidence Rate",
        effect_estimate: "Effect Estimate",
        prediction_performance: "Prediction Performance",
        pathway: "Pathway",
        sccs: "SCCS",
        custom: "Custom",
      },
      synthesisTypes: {
        fixed_effects_meta: "Fixed-Effects Meta-Analysis",
        random_effects_meta: "Random-Effects Meta-Analysis",
        bayesian_meta: "Bayesian Meta-Analysis",
        forest_plot: "Forest Plot",
        heterogeneity_analysis: "Heterogeneity Analysis",
        funnel_plot: "Funnel Plot",
        evidence_synthesis: "Evidence Synthesis",
        custom: "Custom",
      },
      badges: {
        primary: "Primary",
        publishable: "Publishable",
      },
      messages: {
        resultCreated: "Result #{{id}} · {{date}}",
        reviewedBy: "Reviewed by {{name}}",
      },
      labels: {
        summary: "Summary",
        diagnostics: "Diagnostics",
      },
      pagination: {
        previous: "Previous",
        next: "Next",
        page: "Page {{page}} of {{totalPages}}",
      },
      synthesis: {
        createTitle: "Create Synthesis",
        instructions:
          "Select 2 or more results above, then choose a synthesis method.",
        createSelected: "Create ({{count}} selected)",
        confirmDelete: "Delete this synthesis?",
        resultsCount: "{{count}} results",
        system: "System",
        methodSettings: "Method Settings",
        output: "Output",
        noOutput: "No output generated yet",
      },
    },
    federated: {
      loadingResults: "Loading results...",
      loadResultsFailed: "Failed to load results: {{error}}",
      unknownError: "Unknown error",
      confirmDistribute: "Distribute study to {{count}} data node(s)?",
      arachneNotReachable: "Arachne Central is not reachable",
      loadNodesFailed: "Failed to load Arachne nodes",
      arachneConnectionHelp:
        "Set ARACHNE_URL in your environment to enable federated execution. Ensure Arachne Central is running and accessible.",
      availableDataNodes: "Available Data Nodes",
      poweredByArachne: "Powered by Arachne",
      distributeCount: "Distribute ({{count}})",
      noNodes:
        "No Arachne nodes configured. Set ARACHNE_URL in environment to enable federated execution.",
      distributionFailed: "Distribution failed: {{error}}",
      distributionSucceeded:
        "Study distributed successfully. Monitoring status below.",
      federatedExecutions: "Federated Executions",
      noExecutions:
        "No federated executions yet. Select data nodes above and distribute to begin.",
      arachneAnalysis: "Arachne Analysis #{{id}}",
      statuses: {
        PENDING: "Pending",
        EXECUTING: "Executing",
        COMPLETED: "Completed",
        FAILED: "Failed",
      },
      table: {
        name: "Name",
        status: "Status",
        cdmVersion: "CDM Version",
        patients: "Patients",
        lastSeen: "Last Seen",
        node: "Node",
        submitted: "Submitted",
        completed: "Completed",
      },
    },
    artifacts: {
      sections: {
        artifacts: "Artifacts ({{count}})",
      },
      actions: {
        addArtifact: "Add Artifact",
        cancel: "Cancel",
        create: "Create",
        save: "Save",
        edit: "Edit artifact",
        delete: "Delete artifact",
        openLink: "Open link",
      },
      form: {
        addTitle: "Add Study Artifact",
        title: "Title",
        titleRequired: "Title *",
        titlePlaceholder: "e.g., Study Protocol v2.1",
        version: "Version",
        type: "Type",
        urlOptional: "URL (optional)",
        description: "Description",
        descriptionOptional: "Description (optional)",
        descriptionPlaceholder: "Brief description of this artifact...",
      },
      empty: {
        title: "No artifacts",
        message: "Store protocols, analysis packages, and study documents",
      },
      badges: {
        current: "Current",
      },
      labels: {
        versionValue: "v{{version}}",
        sizeKb: "{{size}} KB",
      },
      messages: {
        unknown: "Unknown",
        uploadedBy: "{{name}} · {{date}}",
      },
      confirmDelete: "Delete this artifact?",
      types: {
        protocol: "Protocol",
        sap: "Statistical Analysis Plan",
        irb_submission: "IRB Submission",
        cohort_json: "Cohort JSON",
        analysis_package_r: "R Analysis Package",
        analysis_package_python: "Python Analysis Package",
        results_report: "Results Report",
        manuscript_draft: "Manuscript Draft",
        supplementary: "Supplementary Material",
        presentation: "Presentation",
        data_dictionary: "Data Dictionary",
        study_package_zip: "Study Package ZIP",
        other: "Other",
      },
    },
    sites: {
      sections: {
        sites: "Sites ({{count}})",
      },
      actions: {
        addSite: "Add Site",
        cancel: "Cancel",
        save: "Save",
        edit: "Edit site",
        remove: "Remove site",
      },
      form: {
        addTitle: "Add Data Partner Site",
        sourceSearchPlaceholder: "Search data sources...",
        siteRole: "Site Role",
        irbProtocol: "IRB Protocol #",
        notes: "Notes",
        optional: "Optional",
      },
      empty: {
        title: "No sites enrolled",
        message: "Add data partner sites to this study",
      },
      table: {
        source: "Source",
        role: "Role",
        status: "Status",
        irb: "IRB #",
        patients: "Patients",
        cdm: "CDM",
      },
      messages: {
        allSourcesAssigned: "All sources are already assigned",
        noMatchingSources: "No matching sources",
        sourceFallback: "Source #{{id}}",
      },
      confirmRemove: "Remove this site?",
      roles: {
        data_partner: "Data Partner",
        coordinating_center: "Coordinating Center",
        analytics_node: "Analytics Node",
        observer: "Observer",
      },
      statuses: {
        pending: "Pending",
        invited: "Invited",
        approved: "Approved",
        active: "Active",
        completed: "Completed",
        withdrawn: "Withdrawn",
      },
    },
    cohorts: {
      sections: {
        cohorts: "Cohorts ({{count}})",
      },
      actions: {
        assignCohort: "Assign Cohort",
        assign: "Assign",
        cancel: "Cancel",
        save: "Save",
        edit: "Edit cohort assignment",
        remove: "Remove cohort assignment",
      },
      form: {
        assignTitle: "Assign Cohort Definition",
        cohortDefinition: "Cohort Definition",
        searchPlaceholder: "Search cohort definitions...",
        role: "Role",
        label: "Label",
        labelRequired: "Label *",
        labelPlaceholder: "e.g., T2DM target population",
        description: "Description",
        optional: "Optional",
      },
      empty: {
        title: "No cohorts assigned",
        message: "Assign cohort definitions and specify their roles in this study",
      },
      messages: {
        allAssigned: "All cohort definitions are already assigned",
        noMatchingCohorts: "No matching cohorts",
        cohortFallback: "Cohort #{{id}}",
      },
      confirmRemove: "Remove this cohort assignment?",
      roles: {
        target: "Target",
        comparator: "Comparator",
        outcome: "Outcome",
        exclusion: "Exclusion",
        subgroup: "Subgroup",
        event: "Event",
      },
    },
    team: {
      sections: {
        members: "Team Members ({{count}})",
      },
      actions: {
        addMember: "Add Member",
        cancel: "Cancel",
        save: "Save",
        edit: "Edit team member",
        remove: "Remove team member",
      },
      form: {
        addTitle: "Add Team Member",
        user: "User",
        userSearchPlaceholder: "Search users by name or email...",
        role: "Role",
      },
      empty: {
        title: "No team members",
        message: "Add researchers and collaborators to this study",
      },
      table: {
        name: "Name",
        email: "Email",
        role: "Role",
        status: "Status",
        joined: "Joined",
      },
      messages: {
        allUsersAssigned: "All users are already team members",
        noMatchingUsers: "No matching users",
        userFallback: "User #{{id}}",
      },
      confirmRemove: "Remove this team member?",
      statuses: {
        active: "Active",
        inactive: "Inactive",
      },
      roles: {
        principal_investigator: "Principal Investigator",
        co_investigator: "Co-Investigator",
        data_scientist: "Data Scientist",
        statistician: "Statistician",
        site_lead: "Site Lead",
        data_analyst: "Data Analyst",
        research_coordinator: "Research Coordinator",
        irb_liaison: "IRB Liaison",
        project_manager: "Project Manager",
        observer: "Observer",
      },
      roleDescriptions: {
        principal_investigator: "Lead researcher responsible for the study",
        co_investigator: "Contributing researcher with study oversight",
        data_scientist: "Develops and runs analytical pipelines",
        statistician: "Statistical analysis and methodology",
        site_lead: "Manages data partner site operations",
        data_analyst: "Data processing and quality checks",
        research_coordinator: "Coordinates study logistics and timelines",
        irb_liaison: "Manages IRB submissions and compliance",
        project_manager: "Overall project planning and tracking",
        observer: "Read-only access to study materials",
      },
    },
    milestones: {
      sections: {
        milestones: "Milestones ({{count}})",
      },
      actions: {
        addMilestone: "Add Milestone",
        cancel: "Cancel",
        create: "Create",
        save: "Save",
        edit: "Edit milestone",
        delete: "Delete milestone",
      },
      form: {
        titlePlaceholder: "Milestone title...",
      },
      empty: {
        title: "No milestones",
        message: "Track study progress with milestones and target dates",
      },
      labels: {
        target: "Target: {{date}}",
        targetCompleted: "Target: {{target}} | Completed: {{completed}}",
      },
      confirmDelete: "Delete this milestone?",
      types: {
        protocol: "Protocol",
        irb: "IRB",
        data_access: "Data Access",
        analysis: "Analysis",
        review: "Review",
        publication: "Publication",
        custom: "Custom",
      },
      statuses: {
        pending: "Pending",
        in_progress: "In Progress",
        completed: "Completed",
        overdue: "Overdue",
        cancelled: "Cancelled",
      },
    },
    activity: {
      title: "Activity Log",
      empty: {
        title: "No activity yet",
        message: "Actions taken on this study will appear here",
      },
      pagination: {
        previous: "Previous",
        next: "Next",
        page: "Page {{page}} of {{totalPages}}",
      },
      actions: {
        created: "Created",
        updated: "Updated",
        deleted: "Deleted",
        status_changed: "Status Changed",
        member_added: "Member Added",
        member_removed: "Member Removed",
        site_added: "Site Added",
        analysis_added: "Analysis Added",
        executed: "Executed",
      },
      entities: {
        study: "Study",
        study_analysis: "Study Analysis",
        study_artifact: "Study Artifact",
        study_cohort: "Study Cohort",
        study_milestone: "Study Milestone",
        study_site: "Study Site",
        study_team_member: "Study Team Member",
      },
    },
    designer: {
      defaultSessionTitle: "{{title}} OHDSI design",
      title: "OHDSI Study Design Compiler",
      subtitle:
        "Turn a reviewed research question into traceable concept sets, cohorts, feasibility evidence, HADES-ready analysis plans, and a locked study package.",
      researchQuestionPlaceholder:
        "Among adults with..., does..., compared with..., reduce...",
      badges: {
        session: "Session {{value}}",
        version: "Version {{value}}",
      },
      versionStatuses: {
        generated: "Generated",
        review_ready: "Review Ready",
        accepted: "Accepted",
        locked: "Locked",
      },
      metrics: {
        assets: "Assets",
      },
      actions: {
        downloadLockedPackage: "Download locked package",
        downloadPackage: "Download package",
        add: "Add",
        saveChanges: "Save Changes",
      },
      sections: {
        verificationGates: "Verification Gates",
        packageProvenance: "Package Provenance",
        assetEvidence: "Asset Evidence",
        basicInformation: "Basic Information",
        addAnalysis: "Add Analysis",
        studyAnalyses: "Study Analyses ({{count}})",
      },
      descriptions: {
        verificationGates: "Resolve blockers before locking the OHDSI package.",
        assetEvidence: "Review blocked verifier output before accepting a package.",
      },
      gates: {
        designIntent: "Design intent",
        acceptedAt: "Accepted {{time}}",
        acceptResearchQuestion: "Accept the reviewed research question.",
        verifiedMaterializedCohorts:
          "{{count}} verified materialized cohort",
        feasibilityReady: "Verified feasibility evidence is ready.",
        runFeasibility: "Run feasibility after cohorts verify.",
        analysisPlan: "Analysis plan",
        analysisPlanReady: "Verified HADES analysis plan is ready.",
        verifyAnalysisPlan: "Verify and materialize an analysis plan.",
      },
      labels: {
        version: "Version",
        versionStatus: "v{{version}} {{status}}",
        verifiedAssets: "Verified assets",
        title: "Title",
        description: "Description",
        studyType: "Study Type",
        analysisType: "Analysis Type",
        analysis: "Analysis",
        missingOmopIds: "Missing OMOP IDs",
        deprecatedOmopIds: "Deprecated OMOP IDs",
        invalidDraftIds: "Invalid draft IDs",
      },
      placeholders: {
        studyTitle: "Study title",
        optionalDescription: "Optional description",
        selectAnalysis: "Select analysis...",
      },
      analysisTypes: {
        characterization: "Characterization",
        "incidence-rate": "Incidence Rate",
        pathway: "Pathway",
        estimation: "Estimation",
        prediction: "Prediction",
      },
      messages: {
        new: "new",
        none: "none",
        notStarted: "not started",
        createOrImport: "Create or import a design to begin.",
        needsEvidence: "Needs evidence",
        noVersion: "No version",
        blockedCount: "{{count}} blocked",
        noBlockers: "No blockers",
        startEvidenceReview:
          "Generate intent or import the current study to begin evidence review.",
        noAnalyses: "No analyses added yet.",
        analysisFallback: "Analysis #{{id}}",
        assetId: "Asset #{{id}}",
        materializedId: "materialized #{{id}}",
        verifiedAt: "verified {{time}}",
      },
    },
    workbench: {
      sessionTitle: "Study intent design",
      title: "Study Design Compiler",
      subtitle:
        "Convert a research question into reviewed OHDSI-aligned study intent, then vet reusable phenotype assets before anything moves downstream.",
      newSession: "New Session",
      sessions: "Sessions",
      researchQuestion: "Research Question",
      researchQuestionPlaceholder:
        "Compare recurrent MACE in post-MI patients initiating clopidogrel versus aspirin.",
      emptyQuestionPlaceholder: "Describe the study question...",
      generateIntent: "Generate Intent",
      startSession:
        "Start a design session, then generate a structured PICO intent from the study question.",
      createAndGenerate: "Create Session and Generate Intent",
      loadingSessions: "Loading design sessions...",
      sections: {
        phenotypeRecommendations: "Phenotype and Reuse Recommendations",
        conceptSetDrafts: "Concept Set Drafts",
        cohortDrafts: "Cohort Drafts",
        cohortReadiness: "Study Cohort Readiness",
        feasibility: "Feasibility",
        sources: "Sources",
        attrition: "Attrition",
        analysisPlans: "Analysis Plans",
        packageLock: "Package Lock",
        currentAssets: "Current Study Assets",
        intentReview: "Intent Review",
        source: "Source",
        governance: "Governance",
      },
      descriptions: {
        recommendations:
          "Review reusable Phenotype Library entries, local cohorts, and local concept sets before drafting anything new.",
        conceptSets:
          "Convert accepted evidence into vocabulary-checked drafts before creating native concept sets.",
        cohorts:
          "Turn materialized concept sets into native cohort definition drafts.",
        feasibility:
          "Check linked cohorts against selected CDM sources before analysis planning.",
        analysisPlans:
          "Compile feasible study cohorts into native HADES-compatible analysis designs.",
        packageLock:
          "Freeze accepted intent, concept sets, cohorts, feasibility, and native analyses into an auditable study package.",
        currentAssets:
          "Bring manually built cohorts and analyses into this design path, then review gaps without changing existing records.",
      },
      actions: {
        recommend: "Recommend",
        draftConceptSets: "Draft Concept Sets",
        draftCohorts: "Draft Cohorts",
        runFeasibility: "Run Feasibility",
        draftPlans: "Draft Plans",
        importCurrent: "Import Current",
        critique: "Critique",
        verify: "Verify",
        review: "Review",
        accept: "Accept",
        defer: "Defer",
        reject: "Reject",
        materialize: "Materialize",
        openNativeEditor: "Open Native Editor",
        linkToStudy: "Link to Study",
        search: "Search",
        add: "Add",
        remove: "Remove",
        saveReview: "Save Review",
        acceptIntent: "Accept Intent",
        lockPackage: "Lock Package",
        locked: "Locked",
        downloadPackageSummary: "Download package summary",
      },
      labels: {
        verified: "Verified",
        needsCheck: "Needs check",
        blocked: "Blocked",
        unverified: "Unverified",
        reviewQueue: "Review queue",
        conceptSetDraft: "concept set draft",
        cohortDraft: "cohort draft",
        concepts: "Concepts",
        concept: "Concept",
        domain: "Domain",
        vocabulary: "Vocabulary",
        flags: "Flags",
        actions: "Actions",
        lint: "Lint",
        source: "Source",
        status: "Status",
        cohorts: "Cohorts",
        coverage: "Coverage",
        domains: "Domains",
        freshness: "Freshness",
        dqd: "DQD",
        attrition: "Attrition",
        nativeConceptSet: "Native concept set #{{id}}",
        nativeCohort: "Native cohort #{{id}}",
        linkedStudyCohort: "Linked study cohort #{{id}}",
        conceptsCount: "{{count}} concepts",
        conceptSetsCount: "{{count}} concept sets",
        nativeAnalysis: "Native analysis #{{id}}",
        feasibility: "Feasibility",
        rank: "Rank {{score}}",
        match: "{{score}}% match",
        ohdsiId: "OHDSI #{{id}}",
        computable: "Computable",
        imported: "Imported",
        evidence: "Evidence",
        origin: "Origin",
        matchedTerm: "Matched term",
        canonicalRecord: "Canonical record",
        noCanonicalRecord: "No canonical record",
        eligibility: "Eligibility",
        acceptable: "Acceptable",
        blockedOrNeedsReview: "Blocked or needs review",
        policy: "Policy",
        nextActions: "Next actions",
        rankComponents: "Rank components",
        verifierChecks: "Verifier checks",
        versionStatus: "Version {{version}} · {{status}}",
        primaryObjective: "Primary Objective",
        population: "Population",
        exposure: "Exposure",
        comparator: "Comparator",
        primaryOutcome: "Primary Outcome",
        timeAtRisk: "Time At Risk",
        conceptSetsMetric: "Concept Sets",
        cohortsMetric: "Cohorts",
        analysesMetric: "Analyses",
        packagesMetric: "Packages",
        aiEvents: "AI Events",
        reviewed: "Reviewed",
        manifest: "Manifest",
        critiques: "Critiques",
      },
      messages: {
        saveOrAcceptBeforeRecommendations:
          "Save a review-ready intent or accept the intent before requesting recommendations.",
        loadingRecommendations: "Loading recommendations...",
        noRecommendations: "No recommendations yet.",
        acceptRecommendationFirst:
          "Accept at least one verified phenotype, cohort, or concept set recommendation first.",
        noConceptSetDrafts: "No concept set drafts yet.",
        onlyVerifiedConceptSetDrafts:
          "Only verified concept set drafts can be accepted.",
        searchConceptsPlaceholder: "Search OMOP vocabulary concepts",
        materializeConceptSetFirst:
          "Materialize at least one verified concept set draft first.",
        noCohortDrafts: "No cohort drafts yet.",
        checkingLinkedRoles: "Checking linked roles...",
        noReadinessSignal: "No readiness signal yet.",
        ready: "Ready",
        blocked: "Blocked",
        drafts: "{{count}} drafts",
        materialized: "{{count}} materialized",
        linked: "{{count}} linked",
        linkRequiredCohorts:
          "Link required study cohorts before source feasibility.",
        loadingSources: "Loading sources...",
        noSources: "No CDM sources configured.",
        smallCellThreshold: "Small-cell threshold",
        sourcesReady: "{{ready}}/{{total}} sources ready",
        ranAt: "Ran {{time}}",
        noDates: "No dates",
        none: "none",
        roles: "{{ready}}/{{total}} roles",
        unknown: "Unknown",
        noDqd: "No DQD",
        passRate: "{{rate}}% pass",
        noFeasibilityEvidence:
          "No feasibility evidence has been stored for this design version.",
        runFeasibilityBeforePlans:
          "Run source feasibility before drafting analysis plans.",
        noAnalysisPlans: "No analysis plans yet.",
        feasibilityStatus: "Feasibility: {{status}}",
        checkingPackageReadiness: "Checking package readiness...",
        readyToLock: "Ready to lock.",
        lockedPackageAvailable:
          "Locked package is available in study artifacts.",
        signed: "signed",
        pending: "pending",
        onlyVerifiedRecommendations:
          "Only deterministically verified recommendations can be accepted.",
      },
    },

  },
  administration: {
    dashboard: {
      title: "Administration",
      subtitle: "Manage users, roles, permissions, and system configuration.",
      panels: {
        platform: "Platform",
        usersAccess: "Users & Access",
        dataSources: "Data Sources",
        aiResearch: "AI & Research",
      },
      status: {
        allHealthy: "All healthy",
        degraded: "Degraded",
        warning: "Warning",
      },
      labels: {
        services: "Services",
        queue: "Queue",
        redis: "Redis",
        totalUsers: "Total users",
        roles: "Roles",
        authProviders: "Auth providers",
        tokenExpiry: "Token expiry",
        solr: "Solr",
        aiProvider: "AI provider",
        model: "Model",
        abby: "Abby",
        researchRuntime: "R / HADES",
      },
      values: {
        servicesUp: "{{healthy}}/{{total}} up",
        queueSummary: "{{pending}} pending / {{failed}} failed",
        enabledCount: "{{count}} enabled",
        tokenExpiry: "8h",
        cdmCount: "{{count}} CDM",
        solrSummary: "{{docs}} docs / {{cores}} cores",
        none: "None",
        online: "Online",
      },
      messages: {
        noCdmSources: "No CDM sources configured",
      },
      nav: {
        userManagement: {
          title: "User Management",
          description:
            "Create, edit, and deactivate user accounts. Assign roles to control access.",
        },
        rolesPermissions: {
          title: "Roles & Permissions",
          description:
            "Define custom roles and fine-tune permission assignments across all domains.",
        },
        authProviders: {
          title: "Authentication Providers",
          description:
            "Enable and configure LDAP, OAuth 2.0, SAML 2.0, or OIDC for SSO.",
        },
        aiProviders: {
          title: "AI Provider Configuration",
          description:
            "Switch Abby's backend between local Ollama, Anthropic, OpenAI, Gemini, and more.",
        },
        systemHealth: {
          title: "System Health",
          description:
            "Live status of all Parthenon services: Redis, AI, Darkstar, Solr, Orthanc PACS, job queues.",
        },
        vocabularyManagement: {
          title: "Vocabulary Management",
          description:
            "Update OMOP vocabulary tables by uploading a new Athena vocabulary ZIP file.",
        },
        fhirConnections: {
          title: "FHIR EHR Connections",
          description:
            "Manage FHIR R4 connections to Epic, Cerner, and other EHR systems for bulk data import.",
        },
      },
      setupWizard: {
        title: "Platform Setup Wizard",
        description:
          "Re-run the guided setup: health check, AI provider, authentication, and data sources.",
      },
      atlasMigration: {
        title: "Migrate from Atlas",
        description:
          "Import cohort definitions, concept sets, and analyses from an existing OHDSI Atlas installation.",
      },
      actions: {
        open: "Open",
        openWizard: "Open wizard",
      },
    },
    acropolisServices: {
      descriptions: {
        authentik: "Identity provider and access portal",
        wazuh: "Security monitoring and SIEM dashboard",
        grafana: "Metrics and observability dashboards",
        portainer: "Container and stack operations",
        pgadmin: "PostgreSQL administration console",
        n8n: "Workflow orchestration and automation",
        superset: "BI and ad hoc analytics workspace",
        datahub: "Metadata catalog and lineage explorer",
      },
      openService: "Open Service",
    },
    grafana: {
      openDashboard: "Open Dashboard",
    },
    broadcastEmail: {
      title: "Broadcast Email",
      descriptionPrefix: "This will send an individual email to each of",
      descriptionSuffix: "registered users.",
      subject: "Subject",
      subjectPlaceholder: "Email subject line...",
      message: "Message",
      messagePlaceholder: "Write your message here...",
      close: "Close",
      cancel: "Cancel",
      sending: "Sending...",
      sendToAll: "Send to All Users",
      resultWithRecipients: "{{message}} ({{count}} recipients)",
      unknownError: "Unknown error",
    },
    userModal: {
      titles: {
        editUser: "Edit User",
        newUser: "New User",
      },
      fields: {
        fullName: "Full Name",
        email: "Email",
        password: "Password",
        roles: "Roles",
      },
      hints: {
        keepCurrentPassword: "(leave blank to keep current)",
      },
      placeholders: {
        maskedPassword: "••••••••",
        passwordRequirements: "Min 8 chars, mixed case + number",
      },
      actions: {
        cancel: "Cancel",
        saving: "Saving...",
        saveChanges: "Save Changes",
        createUser: "Create User",
      },
      errors: {
        generic: "An error occurred.",
        passwordRequired: "Password is required.",
      },
    },
    liveKit: {
      loadingConfiguration: "Loading configuration...",
      provider: "Provider",
      providerBadges: {
        cloud: "Cloud",
        "self-hosted": "Self-hosted",
        env: "Env",
      },
      providerOptions: {
        environment: "Environment",
        liveKitCloud: "LiveKit Cloud",
        selfHosted: "Self-hosted",
      },
      providerDescriptions: {
        useEnvFile: "Use .env file",
        hostedByLiveKit: "Hosted by LiveKit",
        yourOwnServer: "Your own server",
      },
      env: {
        usingEnvConfiguration: "Using .env configuration",
        url: "URL:",
        apiKey: "API Key:",
        apiSecret: "API Secret:",
        notSet: "Not set",
        missing: "Missing",
        editPrefix: "Edit",
        editSuffix: "and restart PHP to change.",
      },
      fields: {
        cloudUrl: "LiveKit Cloud URL",
        serverUrl: "Server URL",
        apiKey: "API Key",
        apiSecret: "API Secret",
      },
      placeholders: {
        savedKey: "Saved; enter a new key to replace it",
        savedSecret: "Saved; enter a new secret to replace it",
        enterApiKey: "Enter API key",
        enterApiSecret: "Enter API secret",
      },
      actions: {
        hideConfiguration: "Hide configuration",
        configureLiveKit: "Configure LiveKit",
        testConnection: "Test connection",
        saveConfiguration: "Save configuration",
        useEnvDefaults: "Use .env defaults",
      },
      toasts: {
        noUrlToTest: "No URL to test",
        connectionSuccessful: "Connection successful",
        connectionFailed: "Connection failed",
        configurationSaved: "LiveKit configuration saved",
        saveFailed: "Failed to save configuration",
      },
    },
    authProviders: {
      title: "Authentication Providers",
      subtitle:
        "Enable one or more external identity providers for single sign-on. Sanctum username/password is always available as a fallback.",
      providers: {
        ldap: {
          label: "LDAP / Active Directory",
          description:
            "Authenticate against Microsoft Active Directory or any LDAP v3 directory. Supports TLS, group sync, and attribute mapping.",
        },
        oauth2: {
          label: "OAuth 2.0",
          description:
            "Delegate authentication to GitHub, Google, Microsoft, or any custom OAuth 2.0 provider.",
        },
        saml2: {
          label: "SAML 2.0",
          description:
            "Enterprise SSO via a SAML 2.0 Identity Provider (Okta, Azure AD, ADFS, etc.).",
        },
        oidc: {
          label: "OpenID Connect",
          description:
            "Modern SSO via OIDC discovery. Supports PKCE and any standards-compliant IdP.",
        },
      },
      enabled: "Enabled",
      disabled: "Disabled",
      configure: "Configure",
      testConnection: "Test Connection",
      connectionSuccessful: "Connection successful",
      connectionFailed: "Connection failed",
      usernamePassword: "Username & Password",
      alwaysOn: "Always on",
      builtIn: "Built-in Sanctum authentication - always active.",
      loading: "Loading providers...",
      formActions: {
        saving: "Saving...",
        save: "Save",
        saved: "Saved",
      },
      oauthForm: {
        drivers: {
          github: "GitHub",
          google: "Google",
          microsoft: "Microsoft / Azure AD",
          custom: "Custom OAuth 2.0",
        },
        sections: {
          customEndpoints: "Custom Endpoints",
        },
        labels: {
          provider: "Provider",
          clientId: "Client ID",
          clientSecret: "Client Secret",
          redirectUri: "Redirect URI",
          scopes: "Scopes",
          authorizationUrl: "Authorization URL",
          tokenUrl: "Token URL",
          userInfoUrl: "User Info URL",
        },
        hints: {
          redirectUri: "Must match the URI registered in your OAuth provider",
          scopes: "Space-separated list",
        },
        placeholders: {
          clientId: "Client / Application ID",
          redirectUri: "/api/v1/auth/oauth2/callback",
          scopes: "openid profile email",
        },
      },
      oidcForm: {
        labels: {
          discoveryUrl: "Discovery URL",
          clientId: "Client ID",
          clientSecret: "Client Secret",
          redirectUri: "Redirect URI",
          scopes: "Scopes",
          pkceEnabled: "Enable PKCE (recommended - requires public client)",
        },
        hints: {
          discoveryUrl:
            "The /.well-known/openid-configuration endpoint of your IdP",
          redirectUri: "Must match what is registered in your IdP",
          scopes: "Space-separated",
        },
        placeholders: {
          discoveryUrl:
            "https://accounts.google.com/.well-known/openid-configuration",
          clientId: "your-client-id",
          redirectUri: "/api/v1/auth/oidc/callback",
          scopes: "openid profile email",
        },
      },
      samlForm: {
        sections: {
          identityProvider: "Identity Provider (IdP)",
          serviceProvider: "Service Provider (SP)",
          attributeMapping: "Attribute Mapping",
        },
        labels: {
          idpEntityId: "IdP Entity ID",
          ssoUrl: "SSO URL",
          sloUrl: "SLO URL",
          idpCertificate: "IdP Certificate",
          spEntityId: "SP Entity ID",
          acsUrl: "ACS URL",
          nameIdFormat: "NameID Format",
          signAssertions:
            "Sign assertions (requires SP private key - configure in server env)",
          emailAttribute: "Email attribute",
          displayNameAttribute: "Display name attribute",
        },
        hints: {
          ssoUrl: "Single Sign-On endpoint",
          sloUrl: "Single Logout endpoint (optional)",
          idpCertificate:
            "Paste the X.509 certificate (PEM format, with or without headers)",
          spEntityId:
            "Your Parthenon instance URL - must match what the IdP has registered",
          acsUrl: "Assertion Consumer Service",
        },
        placeholders: {
          certificate:
            "-----BEGIN CERTIFICATE-----\nMIIDxTCC...\n-----END CERTIFICATE-----",
          acsUrl: "/api/v1/auth/saml2/callback",
          sloUrl: "/api/v1/auth/saml2/logout",
          displayName: "displayName",
        },
        attributeMappingDescription:
          "Map SAML assertion attribute names to Parthenon user fields.",
      },
      ldapForm: {
        sections: {
          connection: "Connection",
          bindCredentials: "Bind Credentials",
          userSearch: "User Search",
          attributeMapping: "Attribute Mapping",
          groupSync: "Group Sync",
        },
        labels: {
          host: "Host",
          port: "Port",
          useSsl: "Use SSL (LDAPS)",
          useTls: "Use StartTLS",
          timeout: "Timeout (s)",
          bindDn: "Bind DN",
          bindPassword: "Bind Password",
          baseDn: "Base DN",
          userSearchBase: "User Search Base",
          userFilter: "User Filter",
          usernameField: "Username field",
          emailField: "Email field",
          displayNameField: "Display name field",
          syncGroups: "Sync LDAP groups to Parthenon roles",
          groupSearchBase: "Group Search Base",
          groupFilter: "Group Filter",
        },
        hints: {
          host: "LDAP server hostname or IP",
          bindDn: "Service account DN used for directory queries",
          userFilter: "{username} is replaced at login time",
        },
        placeholders: {
          bindDn: "cn=svc-parthenon,dc=example,dc=com",
          baseDn: "dc=example,dc=com",
          userSearchBase: "ou=users,dc=example,dc=com",
          userFilter: "(uid={username})",
          groupSearchBase: "ou=groups,dc=example,dc=com",
          groupFilter: "(objectClass=groupOfNames)",
        },
        actions: {
          saving: "Saving...",
          save: "Save",
          saved: "Saved",
        },
      },
    },
    roles: {
      title: "Roles & Permissions",
      subtitle:
        "Define custom roles and fine-tune permission assignments. Use the matrix for bulk edits.",
      tabs: {
        roleList: "Role List",
        permissionMatrix: "Permission Matrix",
      },
      permissionMatrix: {
        instructions:
          "Click cells to toggle permissions · row headers to apply across all roles · column headers to grant/revoke all for a role.",
        saveAllChangesOne: "Save All Changes ({{count}} role)",
        saveAllChangesOther: "Save All Changes ({{count}} roles)",
        permission: "Permission",
        columnTitle: "Toggle all permissions for {{role}}",
        permissionCount: "{{count}} perms",
        saving: "saving...",
        saved: "saved ✓",
        save: "save",
        domainTitle:
          "Toggle all {{domain}} permissions across all roles",
        rowTitle: "Toggle {{permission}} for all roles",
        cellTitleGrant: "Grant {{permission}} to {{role}}",
        cellTitleRevoke: "Revoke {{permission}} from {{role}}",
      },
      editor: {
        roleName: "Role Name",
        roleNamePlaceholder: "e.g. site-coordinator",
        permissions: "Permissions",
        selectedCount: "({{count}} selected)",
      },
      actions: {
        newRole: "New Role",
        cancel: "Cancel",
        saving: "Saving...",
        saveRole: "Save Role",
        editRole: "Edit role",
        deleteRole: "Delete role",
        deleting: "Deleting...",
        delete: "Delete",
      },
      values: {
        builtIn: "built-in",
        userCountOne: "{{count}} user",
        userCountOther: "{{count}} users",
        permissionCountOne: "{{count}} permission",
        permissionCountOther: "{{count}} permissions",
        more: "+{{count}} more",
      },
      deleteModal: {
        title: "Delete role?",
        prefix: "The role",
        suffix:
          "will be permanently deleted. Users assigned only this role will lose all permissions.",
      },
    },
    pacs: {
      studyBrowser: {
        browseTitle: "Browse: {{name}}",
        filters: {
          patientName: "Patient Name",
          patientId: "Patient ID",
          allModalities: "All Modalities",
        },
        empty: {
          noStudies: "No studies found",
        },
        table: {
          patientName: "Patient Name",
          patientId: "Patient ID",
          date: "Date",
          modality: "Modality",
          description: "Description",
          series: "Series",
          instances: "Inst.",
        },
        pagination: {
          range: "{{start}}-{{end}}",
          ofStudies: "of {{total}} studies",
          previous: "Previous",
          next: "Next",
        },
      },
      connectionCard: {
        defaultConnection: "Default connection",
        setAsDefault: "Set as default",
        deleteConfirm: "Delete \"{{name}}\"?",
        never: "Never",
        seriesByModality: "Series by Modality",
        statsUpdated: "Stats updated {{date}}",
        stats: {
          patients: "Patients",
          studies: "Studies",
          series: "Series",
          instances: "Instances",
          disk: "Disk",
        },
        actions: {
          edit: "Edit",
          delete: "Delete",
          test: "Test",
          stats: "Stats",
          browse: "Browse",
        },
      },
    },
    solrAdmin: {
      title: "Solr Search Administration",
      subtitle: "Manage Solr search cores, trigger reindexing, and monitor status.",
      loadingCoreStatus: "Loading core status...",
      status: {
        healthy: "Healthy",
        unavailable: "Unavailable",
      },
      labels: {
        documents: "Documents",
        lastIndexed: "Last Indexed",
        duration: "Duration",
      },
      values: {
        never: "Never",
        seconds: "{{seconds}}s",
      },
      actions: {
        reindexAll: "Re-index All Cores",
        reindex: "Re-index",
        fullReindex: "Full Re-index",
        clear: "Clear",
      },
      messages: {
        fetchFailed: "Failed to fetch Solr status",
        reindexCompleted: "Reindex of '{{core}}' completed",
        reindexFailed: "Failed to reindex '{{core}}'",
        reindexAllCompleted: "Reindex-all completed",
        reindexAllFailed: "Failed to reindex all cores",
        clearConfirm:
          "Are you sure you want to clear all documents from '{{core}}'? This cannot be undone.",
        clearCompleted: "Core '{{core}}' cleared",
        clearFailed: "Failed to clear '{{core}}'",
      },
    },
    aiProviders: {
      title: "AI Provider Configuration",
      subtitle:
        "Choose which AI backend powers Abby. Only one provider is active at a time. API keys are stored encrypted.",
      activeProvider: "Active provider:",
      fields: {
        model: "Model",
        apiKey: "API Key",
        ollamaBaseUrl: "Ollama Base URL",
      },
      placeholders: {
        modelName: "Model name",
      },
      values: {
        active: "Active",
        enabled: "Enabled",
        disabled: "Disabled",
        noModelSelected: "No model selected",
      },
      actions: {
        currentlyActive: "Currently Active",
        setAsActive: "Set as Active",
        save: "Save",
        testConnection: "Test Connection",
      },
      messages: {
        requestFailed: "Request failed.",
      },
    },
    gisImport: {
      steps: {
        upload: "Upload",
        analyze: "Analyze",
        mapColumns: "Map Columns",
        configure: "Configure",
        validate: "Validate",
        import: "Import",
      },
      analyze: {
        analysisFailed: "Abby encountered an issue analyzing this file.",
        unknownError: "Unknown error",
        retry: "Retry",
        analyzing: "Abby is analyzing your data...",
        detecting:
          "Detecting column types, geography codes, and value semantics",
      },
      upload: {
        uploading: "Uploading...",
        dropPrompt: "Drop a file here or click to browse",
        acceptedFormats:
          "CSV, TSV, Excel, Shapefile (.zip), GeoJSON, KML, GeoPackage - max {{maxSize}}MB",
        largeFiles: "For large files (> {{maxSize}}MB)",
        fileTooLarge:
          "File exceeds {{maxSize}}MB. Use CLI: php artisan gis:import {{filename}}",
        uploadFailed: "Upload failed",
      },
      configure: {
        fields: {
          layerName: "Layer Name",
          exposureType: "Exposure Type",
          geographyLevel: "Geography Level",
          valueType: "Value Type",
          aggregation: "Aggregation",
        },
        placeholders: {
          layerName: "e.g., Social Vulnerability Index",
          exposureType: "e.g., svi_overall",
        },
        geographyLevels: {
          county: "County",
          tract: "Census Tract",
          state: "State",
          country: "Country",
          custom: "Custom",
        },
        valueTypes: {
          continuous: "Continuous (choropleth)",
          categorical: "Categorical (discrete colors)",
          binary: "Binary (presence/absence)",
        },
        aggregations: {
          mean: "Mean",
          sum: "Sum",
          maximum: "Maximum",
          minimum: "Minimum",
          latest: "Latest",
        },
        saving: "Saving...",
        continue: "Continue",
      },
      mapping: {
        title: "Column Mapping",
        subtitle: "Map each source column to its purpose",
        purposes: {
          geographyCode: "Geography Code",
          geographyName: "Geography Name",
          latitude: "Latitude",
          longitude: "Longitude",
          valueMetric: "Value (metric)",
          metadata: "Metadata",
          skip: "Skip",
        },
        confidence: {
          high: "High",
          medium: "Medium",
          low: "Low",
        },
        askAbby: "Ask Abby",
        abbyOnColumn: "Abby on \"{{column}}\":",
        thinking: "Thinking...",
        saving: "Saving...",
        continue: "Continue",
      },
      validate: {
        validating: "Validating...",
        validationFailed: "Validation failed:",
        unknownError: "Unknown error",
        results: "Validation Results",
        stats: {
          totalRows: "Total Rows",
          uniqueGeographies: "Unique Geographies",
          matched: "Matched",
          unmatched: "Unmatched (stubs)",
          matchRate: "Match Rate",
          geographyType: "Geography Type",
        },
        unmatchedWarning:
          "{{count}} geographies not found in the database. Stub entries will be created (no boundary geometry).",
        backToMapping: "Back to Mapping",
        proceedWithImport: "Proceed with Import",
      },
      import: {
        starting: "Starting...",
        startImport: "Start Import",
        importing: "Importing... {{progress}}%",
        complete: "Import Complete",
        rowsImported: "{{count}} rows imported",
        saveLearningPrompt: "Save mappings so Abby learns for next time",
        saveToAbby: "Save to Abby",
        viewInGisExplorer: "View in GIS Explorer",
        importAnother: "Import Another",
        failed: "Import Failed",
        startOver: "Start Over",
      },
    },
    chromaStudio: {
      title: "Chroma Collection Studio",
      subtitle:
        "Inspect vector collections, run semantic queries, and manage ingestion",
      values: {
        collectionCount: "{{count}} collections",
        loading: "loading",
        loadingEllipsis: "Loading...",
        countSuffix: "({{count}})",
        sampledSuffix: "({{count}} sampled)",
      },
      actions: {
        refreshCollections: "Refresh collections",
        ingestDocs: "Ingest Docs",
        ingestClinical: "Ingest Clinical",
        promoteFaq: "Promote FAQ",
        ingestOhdsiPapers: "Ingest OHDSI Papers",
        ingestOhdsiKnowledge: "Ingest OHDSI Knowledge",
        ingestTextbooks: "Ingest Textbooks",
      },
      stats: {
        vectors: "Vectors",
        sampled: "Sampled",
        dimensions: "Dimensions",
        metaFields: "Meta Fields",
      },
      messages: {
        loadingCollectionData: "Loading collection data...",
      },
      empty: {
        title: "This collection is empty",
        description:
          "Use the Ingest actions above to populate \"{{collection}}\" with documents.",
        noRecords: "No records in this collection.",
        noDocumentReturned: "No document returned.",
        noDocumentText: "No document text available.",
      },
      tabs: {
        overview: "Overview",
        retrieval: "Retrieval",
      },
      search: {
        placeholder: "Semantic query...",
        recentQueries: "Recent queries",
        kLabel: "K:",
        queryAction: "Query",
        empty: "Enter a query above and click Query to inspect retrieval results.",
        queryLabel: "Query:",
        resultsCount: "{{count}} results",
        querying: "Querying...",
        distance: "distance",
      },
      overview: {
        facetDistribution: "Facet Distribution",
        sampleRecords: "Sample Records",
        collectionMetadata: "Collection Metadata",
      },
    },
    vectorExplorer: {
      title: "Vector Explorer",
      semanticMapTitle: "{{dimensions}}D Semantic Map",
      loading: {
        computingProjection: "Computing projection",
        runningProjection: "Running PCA->UMAP on {{sample}} vectors...",
        recomputingProjection: "Recomputing projection...",
      },
      values: {
        all: "all",
        loadingEllipsis: "Loading...",
        countSuffix: "({{count}})",
        sampled: "{{count}} sampled",
        dimensions: "{{dimensions}}D",
        knnEdges: "k={{neighbors}} - {{edges}} edges",
        seconds: "{{seconds}}s",
        points: "{{count}} pts",
        cachedSuffix: " - cached",
        fallbackSuffix: " - fallback",
        timeSuffix: " - {{seconds}}s",
      },
      modes: {
        clusters: "Clusters",
        query: "Query",
        qa: "QA",
      },
      sample: {
        label: "Sample",
        confirmLoadAll:
          "Load all {{count}} vectors? This may take noticeably longer.",
        steps: {
          all: "All",
        },
      },
      empty: {
        selectCollection: "Select a collection to visualize embeddings.",
      },
      tooltips: {
        requiresAiService: "Requires AI service connection",
      },
      controls: {
        colorBy: "Color by",
        modeDefault: "Mode default",
      },
      search: {
        placeholder: "Search within the vector space",
        searching: "Searching...",
        search: "Search",
        visibleResults:
          "{{visible}} of {{total}} results visible in this projection",
      },
      query: {
        anchor: "Query anchor",
      },
      sections: {
        overlays: "Overlays",
        clusterProfile: "Cluster Profile",
        inspector: "Inspector",
      },
      inspector: {
        selectPoint: "Click a point to inspect.",
        loadingDetails: "Loading full details...",
        flags: {
          outlier: "Outlier",
          duplicate: "Duplicate",
          orphan: "Orphan",
        },
      },
      overlays: {
        clusterHulls: {
          label: "Cluster hulls",
          help: "Convex envelopes around clusters",
        },
        topologyLines: {
          label: "Topology lines",
          help: "k-NN links between nearby points",
        },
        queryRays: {
          label: "Query rays",
          help: "Anchor-to-result similarity links",
        },
      },
      stats: {
        totalVectors: "Total vectors",
        sampled: "Sampled",
        projection: "Projection",
        knnGraph: "k-NN graph",
        source: "Source",
        projectionTime: "Projection time",
        indexed: "Indexed",
      },
      sources: {
        solrCached: "Solr (cached)",
        clientFallback: "Client fallback",
        liveUmap: "Live UMAP",
      },
      actions: {
        recomputeProjection: "Re-compute projection",
        expand: "Expand",
      },
      legend: {
        clusters: "Clusters",
        quality: "Quality",
        similarity: "Similarity",
        hide: "Hide",
        show: "Show",
      },
      quality: {
        outliers: "Outliers",
        duplicates: "Duplicates",
        duplicatePairs: "Duplicate pairs",
        orphans: "Orphans",
        normal: "Normal",
        outOfSampled: "out of {{count}} sampled",
        exportCsv: "Export CSV",
      },
      clusterProfile: {
        selectCluster: "Select a cluster to inspect its dominant metadata.",
        clusterSize: "Cluster size",
        dominantMetadata: "Dominant Metadata",
        representativeTitles: "Representative Titles",
      },
    },
    pacsConnectionModal: {
      title: {
        add: "Add PACS Connection",
        edit: "Edit PACS Connection",
      },
      description: "Configure a DICOM imaging server connection.",
      fields: {
        name: "Name",
        type: "Type",
        authType: "Auth Type",
        baseUrl: "Base URL",
        username: "Username",
        password: "Password",
        bearerToken: "Bearer Token",
        linkedSource: "Linked Source (optional)",
        active: "Active",
      },
      placeholders: {
        name: "Main PACS Server",
        keepExisting: "Leave blank to keep existing",
        password: "password",
        token: "token",
      },
      types: {
        orthanc: "Orthanc",
        dicomweb: "DICOMweb",
        googleHealthcare: "Google Healthcare",
        cloud: "Cloud",
      },
      auth: {
        none: "None",
        basic: "Basic Auth",
        bearer: "Bearer Token",
      },
      values: {
        latency: "({{ms}}ms)",
      },
      actions: {
        testConnection: "Test Connection",
        cancel: "Cancel",
        saveChanges: "Save Changes",
        createConnection: "Create Connection",
      },
      errors: {
        testRequestFailed: "Test request failed",
        saveFailed: "Failed to save connection",
      },
    },
    users: {
      title: "Users",
      summary: {
        totalAccounts: "total accounts",
      },
      empty: {
        loading: "Loading...",
        noUsers: "No users found",
        adjustFilters: "Try adjusting your search or filters.",
      },
      deleteModal: {
        title: "Delete user?",
        description:
          "will be permanently deleted and all their API tokens revoked.",
        irreversible: "This cannot be undone.",
      },
      actions: {
        cancel: "Cancel",
        deleting: "Deleting...",
        delete: "Delete",
        adminEmailer: "Admin Emailer",
        newUser: "New User",
        editUser: "Edit user",
        deleteUser: "Delete user",
      },
      filters: {
        searchPlaceholder: "Search name or email...",
        allRoles: "All roles",
      },
      table: {
        name: "Name",
        email: "Email",
        lastActive: "Last Active",
        joined: "Joined",
        roles: "Roles",
      },
      values: {
        never: "Never",
      },
      pagination: {
        page: "Page",
        of: "of",
        users: "users",
      },
    },
    userAudit: {
      title: "User Audit Log",
      subtitle:
        "Track login events, feature access, and security actions across all users.",
      actions: {
        login: "Login",
        logout: "Logout",
        passwordChanged: "Password Changed",
        passwordReset: "Password Reset",
        featureAccess: "Feature Access",
      },
      empty: {
        noMatching: "No matching events",
        noEvents: "No audit events yet",
        adjustFilters: "Try adjusting your filters or date range.",
        description:
          "Audit events are recorded as users log in and access platform features.",
      },
      stats: {
        loginsToday: "Logins Today",
        activeUsers7d: "Active Users (7d)",
        totalEvents: "Total Events",
        topFeature: "Top Feature",
      },
      sections: {
        mostAccessedFeatures: "Most Accessed Features - Last 7 Days",
      },
      filters: {
        searchPlaceholder: "Search user, feature, IP...",
        allActions: "All actions",
        clearAll: "Clear all",
      },
      table: {
        time: "Time",
        user: "User",
        action: "Action",
        feature: "Feature",
        ipAddress: "IP Address",
      },
      pagination: {
        page: "Page",
        of: "of",
        events: "events",
      },
    },
    serviceDetail: {
      actions: {
        backToSystemHealth: "Back to System Health",
        systemHealth: "System Health",
        refresh: "Refresh",
        manageSolrCores: "Manage Solr Cores",
      },
      empty: {
        serviceNotFound: "Service not found.",
        noLogs: "No recent log entries available.",
      },
      values: {
        checkedAt: "Checked at {{time}}",
        entriesCount: "({{count}} entries)",
        yes: "Yes",
        no: "No",
      },
      sections: {
        metrics: "Metrics",
        recentLogs: "Recent Logs",
      },
      pacs: {
        title: "PACS Connections",
        addConnection: "Add Connection",
        empty: "No PACS connections configured.",
      },
      darkstar: {
        ohdsiPackages: "OHDSI HADES Packages",
        positPackages: "Posit / CRAN Packages",
        installedCount: "({{count}} installed)",
      },
    },
    atlasMigration: {
      steps: {
        connect: "Connect",
        discover: "Discover",
        select: "Select",
        import: "Import",
        summary: "Summary",
      },
      entityTypes: {
        conceptSets: "Concept Sets",
        cohortDefinitions: "Cohort Definitions",
        incidenceRates: "Incidence Rates",
        characterizations: "Characterizations",
        pathways: "Pathways",
        estimations: "Estimations",
        predictions: "Predictions",
      },
      connect: {
        title: "Connect to Atlas WebAPI",
        description:
          "Enter the base URL of your existing OHDSI WebAPI instance. Parthenon will connect and inventory all available entities for migration.",
        webapiUrl: "WebAPI Base URL",
        authentication: "Authentication",
        auth: {
          none: "None (public WebAPI)",
          basic: "Basic Authentication",
          bearer: "Bearer Token",
        },
        credentials: "Credentials (username:password)",
        bearerToken: "Bearer Token",
        testConnection: "Test Connection",
        webapiVersion: "WebAPI version: {{version}}",
      },
      discover: {
        discovering: "Discovering entities...",
        querying: "Querying all WebAPI endpoints in parallel",
        title: "Atlas Inventory",
        summary:
          "Found {{count}} migratable entities across {{categories}} categories.",
        sourcesFound: "Also found {{count}} data source(s).",
      },
      select: {
        title: "Select Entities to Migrate",
        description:
          "Choose which entities to import. Dependencies are resolved automatically.",
        analysisWarning:
          "Analysis entities may reference cohort definitions and concept sets by ID. Parthenon will remap these references automatically during import. For best results, include the referenced cohorts and concept sets in your selection.",
        selectedCount: "{{selected}}/{{total}} selected",
        totalSelected: "{{count}} entities selected for migration",
      },
      import: {
        starting: "Starting migration...",
        importing: "Importing Entities...",
        complete: "Migration Complete",
        failed: "Migration Failed",
        processed: "All selected entities have been processed.",
        error: "An error occurred during migration.",
        percentComplete: "{{percent}}% complete",
        polling: "Polling for updates...",
      },
      summary: {
        successful: "Migration Successful",
        completedWithWarnings: "Migration Completed with Warnings",
        failed: "Migration Failed",
        from: "From",
        duration: "Duration: {{duration}}",
      },
      metrics: {
        total: "Total",
        imported: "Imported",
        skipped: "Skipped",
        failed: "Failed",
      },
      table: {
        entityType: "Entity Type",
        category: "Category",
      },
      actions: {
        selectAll: "Select All",
        deselectAll: "Deselect All",
        retryFailed: "Retry Failed ({{count}})",
        done: "Done",
        closeTitle: "Close - return any time via Administration",
        previous: "Previous",
        startMigration: "Start Migration",
        next: "Next",
      },
      errors: {
        connectionFailed: "Connection failed",
        discoveryFailed: "Discovery failed",
      },
    },
    fhirExport: {
      title: "FHIR Bulk Export",
      subtitle:
        "Export OMOP CDM data as FHIR R4 NDJSON files for interoperability.",
      comingSoon: "Coming Soon",
      description:
        "FHIR Bulk Export ($export) is under development. This feature will allow exporting OMOP CDM data as FHIR R4 NDJSON files for interoperability.",
      backendPending:
        "The backend endpoints for this feature have not been implemented yet.",
    },
    fhirConnections: {
      title: "FHIR EHR Connections",
      subtitle:
        "Configure SMART Backend Services connections for FHIR R4 Bulk Data extraction from Epic, Cerner, and other EHR systems.",
      runMetrics: {
        extracted: "Extracted",
        mapped: "Mapped",
        written: "Written",
        failed: "Failed",
        mappingCoverage: "Mapping coverage",
      },
      history: {
        loading: "Loading sync history...",
        empty: "No sync runs yet.",
        status: "Status",
        started: "Started",
        duration: "Duration",
        metrics: "Metrics",
        title: "Sync History",
      },
      dialog: {
        editTitle: "Edit FHIR Connection",
        addTitle: "Add FHIR Connection",
        description:
          "Configure a SMART Backend Services connection to an EHR FHIR R4 endpoint.",
      },
      labels: {
        siteName: "Site Name",
        siteKey: "Site Key (slug)",
        ehrVendor: "EHR Vendor",
        fhirBaseUrl: "FHIR Base URL",
        tokenEndpoint: "Token Endpoint",
        clientId: "Client ID",
        rsaPrivateKey: "RSA Private Key (PEM)",
        scopes: "Scopes",
        groupId: "Group ID (for Bulk Export)",
        exportResourceTypes:
          "Export Resource Types (comma-separated, blank = all)",
        active: "Active",
        incrementalSync: "Incremental sync",
      },
      vendors: {
        epic: "Epic",
        cerner: "Cerner (Oracle Health)",
        other: "Other FHIR R4",
      },
      placeholders: {
        siteName: "Johns Hopkins Epic",
        keepExistingKey: "Leave blank to keep existing key",
        resourceTypes:
          "Patient,Condition,Encounter,MedicationRequest,Observation,Procedure",
      },
      actions: {
        cancel: "Cancel",
        saveChanges: "Save Changes",
        createConnection: "Create Connection",
        testConnection: "Test connection",
        edit: "Edit",
        delete: "Delete",
        details: "Details",
        syncMonitor: "Sync Monitor",
        addConnection: "Add Connection",
      },
      messages: {
        failedToSave: "Failed to save",
        failedToStartSync: "Failed to start sync",
        deleteConfirm: 'Delete "{{name}}"?',
        noConnections: "No FHIR connections configured",
        noConnectionsDescription:
          "Add a connection to begin extracting clinical data from an EHR via FHIR R4 Bulk Data.",
      },
      sync: {
        activateFirst: "Activate connection first",
        uploadKeyFirst: "Upload a private key first",
        inProgress: "Sync in progress",
        incrementalTitle: "Incremental Sync (only new data)",
        fullSync: "Full Sync",
        sync: "Sync",
        incrementalSync: "Incremental Sync",
        incrementalDescription: "Only new/updated data since last sync",
        fullDescription: "Download all data from EHR",
        forceFullSync: "Force Full Sync",
        forceFullDescription: "Re-download all data, deduplicate on write",
      },
      values: {
        percent: "{{value}}%",
        byUser: "by {{name}}",
        keyUploaded: "Key uploaded",
        noKey: "No key",
        lastSync: "Last sync: {{date}}",
        records: "{{count}} records",
        testElapsed: "{{message}} ({{elapsed}}ms)",
        allSupported: "All supported",
        enabled: "Enabled",
        disabled: "Disabled",
        since: "(since {{date}})",
        notSet: "Not set",
        never: "Never",
      },
      details: {
        tokenEndpoint: "Token endpoint:",
        clientId: "Client ID:",
        scopes: "Scopes:",
        groupId: "Group ID:",
        resourceTypes: "Resource types:",
        incremental: "Incremental:",
        targetSource: "Target source:",
        syncRuns: "Sync runs:",
      },
      stats: {
        totalConnections: "Total Connections",
        active: "Active",
        keysConfigured: "Keys Configured",
        lastSync: "Last Sync",
      },
    },
    vocabulary: {
      title: "Vocabulary Management",
      subtitle: "Update OMOP vocabulary tables from an Athena download ZIP.",
      status: {
        pending: "Queued",
        running: "Running",
        completed: "Completed",
        failed: "Failed",
      },
      log: {
        title: "Import Log",
        noOutput: "(no output yet)",
      },
      labels: {
        schema: "Schema:",
        source: "Source:",
        rowsLoaded: "Rows loaded:",
        duration: "Duration:",
        by: "By:",
        progress: "Progress",
        optional: "(optional)",
      },
      values: {
        seconds: "{{value}}s",
      },
      actions: {
        refresh: "Refresh",
        remove: "Remove",
        uploading: "Uploading...",
        startImport: "Start Import",
      },
      upload: {
        title: "Upload Athena Vocabulary ZIP",
        descriptionPrefix: "Download a vocabulary bundle from",
        descriptionMiddle: "and upload it here.",
        descriptionSuffix:
          "The import runs as a background job and can take 15-60 minutes depending on vocabulary size.",
        maxFileSize: "Files up to 5 GB are supported",
        dropHere: "Drop Athena ZIP here",
        browse: "or click to browse",
        targetSource: "Target CDM Source",
        defaultSchema: "Default vocabulary schema",
        sourceHelpPrefix:
          "Selects which source's vocabulary schema the import will populate. If no source is chosen, the default",
        sourceHelpSuffix: "connection schema is used.",
      },
      instructions: {
        title: "How to get a vocabulary ZIP from Athena",
        signInPrefix: "Visit",
        signInSuffix: "and sign in.",
        selectDomains:
          "Select the vocabulary domains and versions you need (e.g. SNOMED, RxNorm, LOINC).",
        clickPrefix: "Click",
        downloadVocabularies: "Download Vocabularies",
        clickSuffix: "- Athena will email you a download link.",
        uploadZip:
          "Download the ZIP (typically 500 MB-3 GB) and upload it below.",
      },
      messages: {
        deleteConfirm: "Delete this import record?",
        uploadFailed: "Upload failed: {{message}}",
        unknownError: "Unknown error",
        uploadSuccess:
          "ZIP uploaded successfully. Import job is queued - check below for progress.",
        importRunning:
          "An import is currently running. New uploads are disabled until it completes.",
      },
      history: {
        title: "Import History",
        loading: "Loading...",
        empty: "No vocabulary imports yet. Upload an Athena ZIP above to get started.",
      },
    },
    systemHealth: {
      title: "System Health",
      subtitle:
        "Live status of all Parthenon services. Auto-refreshes every 30 seconds.",
      serverStatus: "Server Status",
      lastChecked: "Last checked at {{time}}",
      polling: "Polling services...",
      gisDataManagement: "GIS Data Management",
      status: {
        healthy: "Healthy",
        degraded: "Degraded",
        down: "Down",
      },
      overall: {
        healthy: "Healthy",
        needsAttention: "Needs Attention",
      },
      labels: {
        pending: "Pending:",
        failed: "Failed:",
        cores: "Cores:",
        documents: "Documents:",
        dagster: "Dagster:",
        graphql: "GraphQL:",
        studies: "Studies:",
        instances: "Instances:",
        disk: "Disk:",
      },
      actions: {
        refresh: "Refresh",
        openService: "Open Service",
        viewDetails: "View details",
      },
      tiers: {
        corePlatform: "Core Platform",
        dataSearch: "Data & Search",
        aiAnalytics: "AI & Analytics",
        clinicalServices: "Clinical Services",
        monitoringCommunications: "Monitoring & Communications",
        acropolisInfrastructure: "Acropolis Infrastructure",
        unknown: "Other Services",
      },
      hades: {
        title: "OHDSI Package Parity",
        subtitle:
          "Darkstar package coverage for first-class, native, and compatibility work.",
        checking: "Checking Darkstar packages...",
        unavailable: "Darkstar package inventory is unavailable.",
        installed: "Installed:",
        missing: "Missing:",
        total: "Total:",
        requiredMissing: "Required missing:",
        shinyPolicy: "Legacy Shiny Policy",
        notExposed: "not exposed",
        shinyPolicyDescription:
          "Hosted Shiny apps, iframe embedding, and user-supplied app paths are disabled. OHDSI Shiny packages remain runtime compatibility artifacts only.",
        replacement: "Replacement: {{surface}}",
        package: "Package",
        capability: "Capability",
        priority: "Priority",
        surface: "Surface",
        source: "Source",
        runtime: "runtime",
        status: {
          complete: "Complete",
          partial: "Partial",
        },
      },
    },
    fhirSync: {
      title: "FHIR Sync Monitor",
      subtitle: "Real-time ETL pipeline monitoring across all FHIR connections",
      status: {
        completed: "Completed",
        running: "Running",
        pending: "Pending",
        exporting: "Exporting",
        downloading: "Downloading",
        processing: "Processing",
        failed: "Failed",
      },
      timeline: {
        empty: "No sync activity in the last 30 days",
        tooltip: "{{date}}: {{completed}} completed, {{failed}} failed",
        hoverSummary: "{{completed}} ok / {{failed}} fail",
      },
      metrics: {
        extracted: "Extracted",
        mapped: "Mapped",
        written: "Written",
        failed: "Failed",
        averageMappingCoverage: "Average mapping coverage",
      },
      actions: {
        viewError: "View error",
      },
      values: {
        runs: "{{count}} runs",
        never: "Never",
        activeRuns: "{{count}} active",
        refreshInterval: "{{seconds}}s refresh",
        allTimeTotals: "All-time totals",
        lastRuns: "Last 20 across all connections",
      },
      messages: {
        failedToLoad: "Failed to load dashboard data.",
        noConnections: "No connections configured",
        noRuns: "No sync runs yet",
      },
      stats: {
        connections: "Connections",
        totalRuns: "Total Runs",
        completed: "Completed",
        failed: "Failed",
        recordsWritten: "Records Written",
        avgCoverage: "Avg Coverage",
      },
      panels: {
        pipelineThroughput: "Pipeline Throughput",
        syncActivity: "Sync Activity (30 days)",
        connectionHealth: "Connection Health",
        recentRuns: "Recent Sync Runs",
      },
      table: {
        status: "Status",
        connection: "Connection",
        started: "Started",
        duration: "Duration",
        metrics: "Metrics",
      },
    },
    gisData: {
      title: "GIS Boundary Data",
      subtitle: "Manage geographic boundary datasets for the GIS Explorer",
      status: {
        loaded: "loaded",
        empty: "empty",
      },
      tabs: {
        boundaries: "Boundaries",
        dataImport: "Data Import",
      },
      messages: {
        checking: "Checking boundary data...",
        noBoundaryData:
          "No boundary data loaded. Select a source and levels below to begin.",
      },
      labels: {
        boundaries: "Boundaries:",
        countries: "Countries:",
      },
      load: {
        title: "Load Boundaries",
        adminLevels: "Admin levels to load:",
      },
      sources: {
        gadm: {
          name: "GADM v4.1",
          description:
            "Global Administrative Areas - 356K boundaries across 6 admin levels",
        },
        geoboundaries: {
          name: "geoBoundaries CGAZ",
          description:
            "Simplified boundaries for cartographic consistency (ADM0-2)",
        },
      },
      levels: {
        adm0: "Countries (ADM0)",
        adm1: "States / Provinces (ADM1)",
        adm2: "Districts / Counties (ADM2)",
        adm3: "Sub-districts (ADM3)",
      },
      actions: {
        preparing: "Preparing...",
        generateLoadCommand: "Generate Load Command",
        refreshStats: "Refresh Stats",
        copyToClipboard: "Copy to clipboard",
        close: "Close",
      },
      modal: {
        runOnHost: "Run on Host",
        description:
          "GIS data loads directly to local PostgreSQL 17. Run this command from the project root:",
        datasetFlagPrefix: "The",
        datasetFlagSuffix:
          "flag enables progress tracking. Refresh stats after the script completes.",
      },
      job: {
        title: "Loading GIS Boundaries",
        description: "Source: {{source}} | Levels: {{levels}}",
      },
      values: {
        all: "all",
      },
    },
    honestBroker: {
      title: "Honest Broker",
      subtitle:
        "Register blinded survey participants, link them to OMOP person_id records, and monitor submission status without exposing raw respondent identities to researchers.",
      actions: {
        cancel: "Cancel",
        registerParticipant: "Register Participant",
        sendInvitation: "Send Invitation",
        sendInvite: "Send Invite",
        refresh: "Refresh",
        copyLink: "Copy Link",
        openSurvey: "Open Survey",
        resend: "Resend",
        revoke: "Revoke",
      },
      labels: {
        personId: "Person ID",
        notes: "Notes",
        participant: "Participant",
        deliveryEmail: "Delivery Email",
        unknown: "Unknown",
        unknownInstrument: "Unknown instrument",
        notYet: "Not yet",
        notRecorded: "Not recorded",
        system: "System",
        statusToken: "{{status}} · {{token}}",
        tokenReference: "...{{token}}",
      },
      metrics: {
        brokerCampaigns: "Broker Campaigns",
        registeredParticipants: "Registered Participants",
        submitted: "Submitted",
        invitationsSent: "Invitations Sent",
        complete: "Complete",
        pending: "Pending",
        seeded: "Seeded",
        registered: "Registered",
        completion: "Completion",
        completionPercent: "{{value}}%",
      },
      campaignStatuses: {
        draft: "Draft",
        active: "Active",
        closed: "Closed",
      },
      matchStatuses: {
        submitted: "Submitted",
        registered: "Registered",
        pending: "Pending",
        matched: "Matched",
      },
      deliveryStatuses: {
        pending: "Pending",
        queued: "Queued",
        sent: "Sent",
        opened: "Opened",
        submitted: "Submitted",
        revoked: "Revoked",
        failed: "Failed",
      },
      unauthorized: {
        title: "Honest Broker Access Required",
        description:
          "This workspace is restricted to data stewards and administrators because it links blinded survey identities to patient records.",
      },
      registerModal: {
        title: "Register Participant",
        titleWithCampaign: "Register Participant · {{campaign}}",
        registering: "Registering...",
        description:
          "Create a blinded registry entry that maps a respondent identifier to a patient record for this survey campaign.",
        respondentIdentifier: "Respondent Identifier",
        respondentPlaceholder: "MRN, study code, or invite code",
        personIdPlaceholder: "Known OMOP person_id",
        notesPlaceholder: "Optional broker notes",
      },
      inviteModal: {
        title: "Send Invitation",
        titleWithCampaign: "Send Invitation · {{campaign}}",
        sending: "Sending...",
        description:
          "Send a one-time broker-managed survey link. Only the broker retains the delivery address and chain of custody.",
        selectParticipant: "Select participant",
        participantWithPerson: "{{blindedId}} · person {{personId}}",
        emailPlaceholder: "patient@example.org",
        lastInvitation: "Last invitation: {{status}} · token ending {{token}}",
      },
      campaignRegistry: {
        title: "Campaign Registry",
        subtitle: "Honest-broker-enabled campaigns only.",
        loading: "Loading campaigns...",
        emptyPrefix: "No honest-broker campaigns yet. Enable",
        requireHonestBroker: "Require Honest Broker",
        emptySuffix: "on a survey campaign first.",
      },
      messages: {
        selectCampaignManage: "Select a campaign to manage broker registrations.",
        selectCampaignReview: "Select a campaign to review broker registrations.",
      },
      participants: {
        title: "Registered Participants",
        subtitle: "De-identified registry entries for the selected survey campaign.",
        searchPlaceholder: "Search blinded id, person id, notes...",
        loading: "Loading registrations...",
        noMatches: "No broker registrations match the current filter.",
      },
      invitations: {
        title: "Invitation Ledger",
        subtitle:
          "Outbound and inbound chain of custody for broker-managed survey invitations.",
        loading: "Loading invitations...",
        empty: "No invitations sent for this campaign yet.",
      },
      audit: {
        title: "Audit Trail",
        subtitle:
          "Immutable broker-side chain of custody for participant registration, outbound invites, and inbound response events.",
        loading: "Loading audit trail...",
        empty: "No broker audit events recorded yet.",
      },
      latest: {
        title: "Latest Matching Record",
        blindedId: "Blinded ID",
        created: "Created",
      },
      table: {
        blindedParticipant: "Blinded Participant",
        conductId: "Conduct ID",
        status: "Status",
        submitted: "Submitted",
        contact: "Contact",
        latestInvite: "Latest Invite",
        destination: "Destination",
        sent: "Sent",
        opened: "Opened",
        reference: "Reference",
        actions: "Actions",
        time: "Time",
        action: "Action",
        actor: "Actor",
        inviteRef: "Invite Ref",
        metadata: "Metadata",
      },
      auditActions: {
        participant_registered: "Participant Registered",
        invitation_sent: "Invitation Sent",
        invitation_resent: "Invitation Resent",
        invitation_revoked: "Invitation Revoked",
        response_submitted: "Response Submitted",
        status_changed: "Status Changed",
      },
      confirmRevoke: "Revoke invitation ending {{token}}?",
      toasts: {
        publishLinkCopied: "Publish link copied",
        publishLinkCopyFailed: "Failed to copy publish link",
        participantRegistered: "Participant registered",
        participantRegisterFailed: "Failed to register participant",
        invitationSent: "Invitation sent · token ending {{token}}",
        invitationSendFailed: "Failed to send invitation",
        invitationResent: "Invitation resent · token ending {{token}}",
        invitationResendFailed: "Failed to resend invitation",
        invitationRevoked: "Invitation revoked · token ending {{token}}",
        invitationRevokeFailed: "Failed to revoke invitation",
      },
    },
  },
  vocabulary: {
    mappingAssistant: {
      title: "Concept Mapping Assistant",
      poweredBy: "Powered by Ariadne",
      subtitle:
        "Map source terms to OMOP standard concepts using verbatim, vector, and LLM matching",
      filters: {
        selectedCount: "{{count}} selected",
        clearSelection: "Clear selection",
        targetVocabulary: "Target Vocabulary:",
        allVocabularies: "All Vocabularies",
        targetDomain: "Target Domain:",
        allDomains: "All Domains",
      },
      drawer: {
        disambiguate: "Disambiguate",
        candidateCount: "{{count}} candidates - select the correct mapping",
        noCandidates: "No candidates found. Try cleaning the term below.",
        cleanRemap: "Clean & Re-map",
        editPlaceholder: "Edit term and re-map...",
      },
      actions: {
        clean: "Clean",
        remap: "Re-map",
        acceptMapping: "Accept mapping",
        rejectMapping: "Reject mapping",
        disambiguateTitle: "Disambiguate - view all candidates",
        uploadCsv: "Upload CSV",
        loadProject: "Load Project",
        mapping: "Mapping...",
        mapTerms: "Map Terms",
        clearResults: "Clear results",
        acceptAllThreshold: "Accept all >= 90%",
        saveToVocabulary: "Save to Vocabulary",
        saveProject: "Save Project",
        exportCsv: "Export CSV",
      },
      toasts: {
        remapped: "Re-mapped \"{{source}}\" -> {{concept}}",
        noMatchForCleaned: "No match found for cleaned term \"{{term}}\"",
        remapFailed: "Re-mapping failed",
        autoAccepted: "Auto-accepted {{count}} high-confidence mappings",
        savedMappings: "Saved {{count}} mappings to source_to_concept_map",
        saveMappingsFailed: "Failed to save mappings",
        projectSaved: "Project saved: {{name}}",
        saveProjectFailed: "Failed to save project",
        projectLoaded: "Loaded project: {{name}}",
        loadProjectFailed: "Failed to load project",
      },
      errors: {
        cleanupFailed: "Cleanup failed.",
        mappingFailed:
          "Mapping failed. Verify the Ariadne service is running and reachable.",
      },
      results: {
        candidateCount: "{{count}} candidates",
        overridden: "(overridden)",
        noMatchFound: "No match found",
        selectOverride: "Select a candidate to override the mapping",
        noAdditionalCandidates: "No additional candidates.",
      },
      labels: {
        noValue: "-",
        separator: "-",
      },
      input: {
        termsMapped: "{{count}} terms mapped",
        editTerms: "Edit terms",
        sourceTerms: "Source Terms",
        termsPlaceholder:
          "Enter source terms, one per line...\n\ntype 2 diabetes mellitus\nacute myocardial infarction\nHTN\nASA 81mg",
        termsEntered: "{{count}} terms entered",
      },
      projects: {
        loading: "Loading projects...",
        loadFailed: "Failed to load projects",
        empty: "No saved projects",
        projectMeta: "{{count}} terms -- {{date}}",
        namePlaceholder: "Project name...",
      },
      vocabularies: {
        SNOMED: "SNOMED CT",
        ICD10CM: "ICD-10-CM",
        RxNorm: "RxNorm",
        LOINC: "LOINC",
        ICD9CM: "ICD-9-CM",
        CPT4: "CPT-4",
        HCPCS: "HCPCS",
        MedDRA: "MedDRA",
      },
      domains: {
        Condition: "Condition",
        Drug: "Drug",
        Procedure: "Procedure",
        Measurement: "Measurement",
        Observation: "Observation",
        Device: "Device",
      },
      progress: {
        mappingTerms: "Mapping {{count}} terms...",
      },
      metrics: {
        termsMapped: "Terms mapped",
        highConfidence: "High confidence",
        needReview: "Need review",
        noMatch: "No match",
      },
      table: {
        sourceTerm: "Source Term",
        bestMatch: "Best Match",
        confidence: "Confidence",
        matchType: "Match Type",
        vocabulary: "Vocabulary",
        actions: "Actions",
      },
      summary: {
        mapped: "{{count}} mapped",
        high: "{{count}} high",
        review: "{{count}} review",
        noMatch: "{{count}} no match",
        accepted: "{{count}} accepted",
      },
    },
    conceptDetail: {
      tabs: {
        info: "Info",
        relationships: "Relationships",
        mapsFrom: "Maps From",
        hierarchy: "Hierarchy",
      },
      empty: {
        title: "Select a concept to view details",
        subtitle: "Search and click a concept from the left panel",
        noAncestors: "No ancestors found",
        noRelationships: "No relationships found",
        noSourceCodes: "No source codes map to this concept",
      },
      errors: {
        failedLoad: "Failed to load concept",
      },
      toasts: {
        conceptIdCopied: "Concept ID copied",
      },
      actions: {
        copyConceptId: "Copy concept ID",
        addToSet: "Add to Set",
      },
      values: {
        standard: "Standard",
        classification: "Classification",
        nonStandard: "Non-standard",
        valid: "Valid",
      },
      sections: {
        basicInformation: "Basic Information",
        synonyms: "Synonyms",
        ancestors: "Ancestors",
        relationships: "Relationships",
        mapsFrom: "Source Codes Mapping To This Concept",
        mapsFromDescription:
          "Source vocabulary codes (ICD-10, SNOMED, RxNorm, etc.) that map to this standard concept",
        hierarchy: "Concept Hierarchy",
      },
      fields: {
        conceptCode: "Concept Code",
        domain: "Domain",
        vocabulary: "Vocabulary",
        conceptClass: "Concept Class",
        standardConcept: "Standard Concept",
        invalidReason: "Invalid Reason",
        validStartDate: "Valid Start Date",
        validEndDate: "Valid End Date",
      },
      table: {
        id: "ID",
        name: "Name",
        domain: "Domain",
        vocabulary: "Vocabulary",
        relationship: "Relationship",
        relatedId: "Related ID",
        relatedName: "Related Name",
        code: "Code",
        class: "Class",
      },
      pagination: {
        showingRange: "Showing {{start}}-{{end}} of {{total}}",
        showingSourceCodes: "Showing {{shown}} of {{total}} source codes",
      },
    },
    semanticSearch: {
      hecate: "Hecate",
      poweredBy: "Powered by Hecate",
      tagline: "vector-powered concept discovery",
      placeholder: "Enter a clinical term to search semantically...",
      filters: {
        allDomains: "All Domains",
        allVocabularies: "All Vocabularies",
        standard: {
          all: "All",
          standard: "S",
          classification: "C",
        },
      },
      badges: {
        standard: "Standard",
        classification: "Classification",
      },
      values: {
        inSet: "In set",
        standardAbbrev: "S",
      },
      actions: {
        addToSet: "Add to Set",
        clearFilters: "Clear filters",
        retry: "Retry",
        tryClearingFilters: "Try clearing filters",
      },
      errors: {
        unavailable: "Semantic search is unavailable.",
        serviceHelp:
          "Ensure the Hecate AI service is running and ChromaDB is initialized.",
      },
      empty: {
        prompt: "Enter a clinical term to search semantically",
        help:
          "Hecate uses vector embeddings to find conceptually similar OMOP concepts, even when exact keyword matches fail.",
        noResults: "No semantic matches found for \"{{query}}\"",
      },
      results: {
        matchCountOne: "{{count}} semantic match",
        matchCountMany: "{{count}} semantic matches",
        updating: "Updating...",
      },
    },
    searchPanel: {
      placeholder: "Search concepts...",
      filters: {
        toggle: "Filters",
        standardOnly: "Standard",
        allDomains: "All Domains",
        allVocabularies: "All Vocabularies",
        allConceptClasses: "All Concept Classes",
        countSuffix: " ({{count}})",
      },
      actions: {
        clearAllFilters: "Clear all filters",
        tryClearingFilters: "Try clearing filters",
        loading: "Loading...",
        loadMoreResults: "Load more results",
      },
      empty: {
        prompt: "Search the OMOP Vocabulary",
        help: "Type at least 2 characters to search concepts by name, code, or ID",
        noResults: "No concepts found for \"{{query}}\"",
      },
      results: {
        showingCount: "Showing {{shown}} of {{total}} results",
      },
      engine: {
        solr: "Solr",
        pg: "PG",
      },
      values: {
        inSet: "In set",
      },
    },
    conceptComparison: {
      title: "Compare Concepts",
      subtitle:
        "Side-by-side comparison of 2-4 OMOP concepts with attributes, ancestors, and relationships",
      search: {
        placeholder: "Search concept to add...",
      },
      sections: {
        ancestors: "Ancestors (2 levels)",
        relationships: "Relationships",
      },
      fields: {
        conceptCode: "Concept Code",
        domain: "Domain",
        vocabulary: "Vocabulary",
        conceptClass: "Concept Class",
        standard: "Standard",
        validStart: "Valid Start",
        validEnd: "Valid End",
        invalidReason: "Invalid Reason",
      },
      actions: {
        addConcept: "Add concept",
      },
      empty: {
        prompt: "Search for concepts to compare",
        help:
          "Select 2-4 concepts to see a side-by-side comparison of their attributes, ancestors, and relationships",
      },
      values: {
        standard: "Standard",
        classification: "Classification",
        nonStandard: "Non-standard",
        valid: "Valid",
        level: "L{{level}}",
        selected: "Selected:",
        addOneMore: "Add at least one more to compare",
      },
    },
    addToConceptSet: {
      title: "Add to Concept Set",
      create: {
        title: "Create New Concept Set",
        help: "Add concept and open in Builder",
        nameLabel: "New Concept Set Name",
      },
      actions: {
        create: "Create",
        cancel: "Cancel",
        openBuilderWithSearch: "Open Builder with current search",
      },
      divider: "or add to existing",
      filter: {
        placeholder: "Filter concept sets...",
      },
      empty: {
        noMatching: "No matching concept sets",
        noSets: "No concept sets found",
      },
      footer: {
        includeDescendants: "Adds with Include Descendants",
      },
      toasts: {
        addedToSet: "Added to \"{{setName}}\"",
        addFailed: "Failed to add concept to set",
        missingSetId: "Failed to retrieve new concept set ID",
        createdAndAdded: "Created \"{{name}}\" and added concept",
        createdAddFailed: "Set created but failed to add concept",
        createFailed: "Failed to create concept set",
      },
    },
    page: {
      title: "Vocabulary Browser",
      subtitle: "Search, explore, and navigate the OMOP standardized vocabulary",
      tabs: {
        keyword: "Keyword Search",
        semantic: "Semantic Search",
        browse: "Browse Hierarchy",
      },
    },
    hierarchyBrowser: {
      breadcrumb: {
        allDomains: "All Domains",
      },
      filters: {
        allSources: "All Sources",
        itemPlaceholder: "Filter {{count}} items...",
      },
      actions: {
        showAllConcepts: "Show all concepts",
        showGroupings: "Show groupings",
        clearFilter: "Clear filter",
        viewDetailsFor: "View details for {{conceptName}}",
        viewConceptDetails: "View concept details",
      },
      empty: {
        noMatchingConcepts: "No matching concepts",
        noConcepts: "No concepts found",
      },
      counts: {
        clinicalGroupings: "{{count}} clinical groupings",
        concepts: "{{count}} concepts",
        items: "{{count}} items",
        filteredItems: "{{shown}} of {{total}} items",
        namedSubCategories: "{{name}} - {{count}} sub-categories",
        subCategories: "{{count}} sub-categories",
        subcategories: "{{count}} subcategories",
        oneAnchor: "1 anchor",
        persons: "{{count}} persons",
        records: "{{count}} records",
        groupingCoversSubcategories:
          "{{groupingName}} covers {{count}} subcategories",
      },
    },
    hierarchyTree: {
      empty: {
        noData: "No hierarchy data available",
      },
    },
  },
  dataExplorer: {
    page: {
      title: "Data Explorer",
      subtitle: "Explore Achilles characterization results and data quality",
      selectSourceTitle: "Select a data source",
      selectSourceMessage:
        "Choose a CDM source from the dropdown above to explore its data",
    },
    tabs: {
      overview: "Overview",
      domains: "Domains",
      temporal: "Temporal",
      heel: "Achilles",
      dqd: "Data Quality",
      ares: "Ares",
    },
    sourceSelector: {
      loading: "Loading sources...",
      placeholder: "Select a data source",
    },
    domains: {
      condition: "Conditions",
      drug: "Drugs",
      procedure: "Procedures",
      measurement: "Measurements",
      observation: "Observations",
      visit: "Visits",
    },
    overview: {
      metrics: {
        persons: "Persons",
        personsTotal: "{{value}} total",
        medianObsDuration: "Median Obs Duration",
        durationDays: "{{value}} days",
        observationPeriods: "{{value}} observation periods",
        totalEvents: "Total Events",
        acrossAllCdmTables: "Across all CDM tables",
        dataCompleteness: "Data Completeness",
        tablesPopulated: "{{populated}}/{{total}} tables populated",
      },
      sections: {
        demographics: "Population Demographics",
        observationPeriods: "Observation Period Analysis",
        domainRecordProportions: "Domain Record Proportions",
        dataDensityOverTime: "Data Density Over Time",
        recordDistribution: "Record Distribution",
      },
      cards: {
        genderDistribution: "Gender Distribution",
        ethnicity: "Ethnicity",
        race: "Race",
        topTen: "Top 10",
        yearOfBirthDistribution: "Year of Birth Distribution",
        yearOfBirthSubtitle: "Histogram with smoothed density (gold)",
        cumulativeObservationDuration: "Cumulative Observation Duration",
        cumulativeObservationSubtitle:
          "Kaplan-Meier style: % of persons with observation >= X days",
        observationStartEndDates: "Observation Start / End Dates",
        observationStartEndSubtitle:
          "Temporal distribution of observation periods",
        observationPeriodDurationDays: "Observation Period Duration (days)",
        observationPeriodsPerPerson: "Observation Periods per Person",
        observationPeriodsPerPersonSubtitle:
          "Distribution of how many periods each person has",
        clinicalDataDomains: "Clinical Data Domains",
        clinicalDataDomainsSubtitle:
          "Sorted by record count - click a domain to explore its concepts",
        recordsByDomainAndYear: "Records by Domain and Year",
        recordsByDomainAndYearSubtitle:
          "Color intensity indicates record volume per domain per year",
        cdmTableRecordCounts: "CDM Table Record Counts",
        cdmTableRecordCountsSubtitle:
          "Logarithmic scale - all tables visible regardless of magnitude",
      },
      messages: {
        runAchillesForTemporalData:
          "Run Achilles to generate temporal trend data",
      },
    },
    charts: {
      common: {
        records: "{{count}} records",
        persons: "{{count}} persons",
        total: "Total",
        separator: "·",
      },
      boxPlot: {
        noDistributionData: "No distribution data",
        ariaLabel: "Box plot",
        labels: {
          p25: "P25: {{value}}",
          median: "Median: {{value}}",
          p75: "P75: {{value}}",
        },
      },
      cumulativeObservation: {
        tooltipValue: "{{days}} days - {{pct}}% of persons",
        xAxisLabel: "Observation Duration (days)",
        labels: {
          min: "Min",
          p10: "P10",
          p25: "P25",
          median: "Median",
          p75: "P75",
          p90: "P90",
          max: "Max",
        },
      },
      demographics: {
        ageDistribution: "Age Distribution",
        noAgeData: "No age distribution data",
        age: "Age",
        male: "Male",
        female: "Female",
      },
      heatmap: {
        ariaLabel: "Data density heatmap",
      },
      hierarchy: {
        noData: "No hierarchy data available",
        classificationHierarchy: "Classification Hierarchy",
        back: "Back",
      },
      periodCount: {
        observationPeriods: "{{count}} observation period(s)",
      },
      recordCounts: {
        noData: "No record count data available",
        title: "Record Counts by CDM Table",
      },
      temporalTrend: {
        events: "Events",
        secondary: "Secondary",
      },
      topConcepts: {
        noData: "No concept data available",
        title: "Top Concepts",
        id: "ID: {{id}}",
        prevalence: "Prevalence: {{value}}%",
      },
      yearOfBirth: {
        year: "Year: {{year}}",
      },
    },
    domain: {
      metrics: {
        totalRecords: "Total Records",
        distinctConcepts: "Distinct Concepts",
      },
      loadFailed: "Failed to load {{domain}} data",
      temporalTrendTitle: "{{domain}} Temporal Trend",
    },
    temporal: {
      domainsLabel: "Domains:",
      multiDomainOverlay: "Multi-Domain Temporal Overlay",
      emptyTitle: "No temporal data available",
      emptyHelp: "Select domains above and ensure Achilles has been run",
    },
    concept: {
      details: "Concept Details",
      loadFailed: "Failed to load concept details",
      genderDistribution: "Gender Distribution",
      temporalTrend: "Temporal Trend",
      typeDistribution: "Type Distribution",
      ageAtFirstOccurrence: "Age at First Occurrence",
      valueByLabel: "{{label}}: {{value}}",
    },
    achilles: {
      severities: {
        error: "Error",
        warning: "Warning",
        notification: "Notification",
      },
      severityCounts: {
        error: "errors",
        warning: "warnings",
        notification: "notifications",
      },
      actions: {
        running: "Running...",
        runHeelChecks: "Run Heel Checks",
        runAchilles: "Run Achilles",
        selectRun: "Select run",
        viewLiveProgress: "View Live Progress",
        viewDetails: "View Details",
      },
      runShort: "Run {{id}}...",
      statuses: {
        completed: "Completed",
        failed: "Failed",
        running: "Running",
        pending: "Pending",
      },
      labels: {
        status: "Status",
        total: "total",
        passed: "passed",
        failed: "failed",
        durationSeconds: "Duration: {{value}}s",
      },
      heel: {
        title: "Heel Checks",
        dispatchFailed: "Failed to dispatch heel checks",
        running: "Running heel checks...",
        empty: "No heel checks run yet",
        allPassed: "All checks passed",
        issueSummary:
          "{{count}} issues: {{errors}}E / {{warnings}}W / {{notifications}}N",
      },
      characterization: {
        title: "Achilles Characterization",
        dispatchFailed: "Failed to dispatch Achilles run",
        empty: "No Achilles runs yet",
        emptyHelp: 'Click "Run Achilles" to characterize your data',
      },
      runModal: {
        completedIn: "Completed in {{duration}}",
        analysisProgress: "{{done}} of {{total}} analyses",
        elapsed: "Elapsed:",
        passedCount: "{{count}} passed",
        failedCount: "{{count}} failed",
        totalDuration: "{{duration}} total",
        remaining: "~{{duration}} remaining",
        waiting: "Waiting for analyses to start...",
        done: "Done",
        runInBackground: "Run in Background",
      },
    },
    dqd: {
      categories: {
        completeness: "Completeness",
        conformance: "Conformance",
        plausibility: "Plausibility",
        overall: "Overall",
      },
      progress: {
        title: "DQD Analysis Running",
        checksCompleted: "{{completed}} of {{total}} checks completed",
        waiting: "Waiting...",
        running: "Running:",
      },
      labels: {
        passed: "passed",
        failed: "failed",
        remaining: "remaining",
        warnings: "Warnings",
      },
      severity: {
        error: "Error",
        warning: "Warning",
        info: "Info",
      },
      categoryPanel: {
        checkCount: "{{count}} checks",
        passRate: "{{percent}}% pass rate",
        table: {
          check: "Check",
          table: "Table",
          column: "Column",
          severity: "Severity",
          violationPercent: "Violation %",
        },
      },
      scorecard: {
        emptyTitle: "No DQD results available",
        emptyDescription: "Run a Data Quality Dashboard analysis to see results",
        overallScore: "Overall Score",
        passedFraction: "{{passed}}/{{total}} passed",
      },
      tableGrid: {
        noResults: "No DQD results to display",
        title: "Table x Category Heatmap",
        cdmTable: "CDM Table",
      },
      actions: {
        runDqd: "Run DQD",
      },
      dispatchFailed: "Failed to dispatch DQD run",
      empty: "No DQD runs yet",
      emptyHelp: 'Click "Run DQD" to start a data quality analysis',
    },
    ares: {
      name: "Ares",
      breadcrumbSeparator: ">",
      comingSoon: "Coming soon in a future phase",
      sections: {
        hub: "Hub",
        networkOverview: "Network Overview",
        conceptComparison: "Concept Comparison",
        dqHistory: "DQ History",
        coverage: "Coverage",
        coverageMatrix: "Coverage Matrix",
        feasibility: "Feasibility",
        diversity: "Diversity",
        releases: "Releases",
        unmappedCodes: "Unmapped Codes",
        cost: "Cost",
        costAnalysis: "Cost Analysis",
        annotations: "Annotations",
      },
      cards: {
        sourcesBelowDq: "{{value}} sources below 80% DQ",
        networkOverviewDescription:
          "Source health, DQ scores, trend indicators",
        conceptComparisonDescription:
          "Compare concept prevalence across sources",
        dqHistoryDescription: "Avg network DQ score over releases",
        coverageDescription: "Domain x source availability",
        feasibilityDescription: "Can your network support a study?",
        diversityDescription: "Demographic parity across sources",
        releasesDescription: "Version history per source",
        unmappedCodesDescription:
          "Source codes without standard mappings",
        annotationsDescription: "Chart notes across all sources",
        costDescription: "Cost data by domain and over time",
      },
      networkOverview: {
        title: "Network Overview",
        networkTotal: "Network Total",
        percent: "{{value}}%",
        averagePercent: "{{value}}% avg",
        actions: {
          dqRadar: "DQ Radar",
          hideRadar: "Hide Radar",
        },
        metrics: {
          dataSources: "Data Sources",
          avgDqScore: "Avg DQ Score",
          unmappedCodes: "Unmapped Codes",
          needAttention: "Need Attention",
          totalPersons: "Total Persons",
        },
        table: {
          source: "Source",
          dqScore: "DQ Score",
          dqTrend: "DQ Trend",
          freshness: "Freshness",
          domains: "Domains",
          persons: "Persons",
          latestRelease: "Latest Release",
        },
        messages: {
          loading: "Loading network overview...",
          noData: "No network data available.",
          noReleases: "No releases",
        },
        radar: {
          title: "DQ Radar Profile (Kahn Dimensions)",
          description:
            "Pass rates across the five Kahn data quality dimensions. Higher values indicate better quality.",
          noData: "No DQ radar data available.",
          dimensions: {
            completeness: "Completeness",
            conformanceValue: "Conformance (Value)",
            conformanceRelational: "Conformance (Relational)",
            plausibilityAtemporal: "Plausibility (Atemporal)",
            plausibilityTemporal: "Plausibility (Temporal)",
          },
        },
      },
      feasibility: {
        title: "Feasibility Assessments",
        assessmentMeta: "{{date}} | {{sources}} sources assessed",
        passedSummary: "{{passed}}/{{total}} passed",
        resultsTitle: "Results: {{name}}",
        scoreLabel: "{{score}}% score",
        empty:
          "No assessments yet. Create one to evaluate if your network can support a proposed study.",
        actions: {
          newAssessment: "+ New Assessment",
          running: "Running...",
          runAssessment: "Run Assessment",
          hide: "Hide",
          forecast: "Forecast",
        },
        filters: {
          view: "View:",
        },
        detailViews: {
          table: "Score Table",
          impact: "Impact Analysis",
          consort: "CONSORT Flow",
        },
        criteria: {
          domains: "Domains",
          concepts: "Concepts",
          visitTypes: "Visit Types",
          dateRange: "Date Range",
          patientCount: "Patient Count",
        },
        forecast: {
          insufficientData:
            "Insufficient historical data for forecast (minimum 6 months required).",
          title: "Patient Arrival Forecast: {{source}}",
          monthlyRate: "Monthly rate: {{rate}} patients/month",
          targetReachedIn: "Target reached in ~{{months}} months",
          targetAlreadyReached: "Target already reached",
          actual: "Actual",
          projected: "Projected",
          confidenceBand: "95% CI",
          targetLabel: "Target: {{target}}",
          footnote:
            "Projection based on linear regression of last 12 months. Confidence band widens with projection distance.",
        },
        consort: {
          allSources: "All Sources",
          noResults: "No results to display CONSORT diagram.",
          title: "CONSORT-Style Attrition Flow",
          description:
            "Shows how sources are progressively excluded by each criterion gate.",
          sources: "{{count}} sources",
          excluded: "-{{count}} excluded",
        },
        impact: {
          noData: "No criteria impact data available.",
          title: "Criteria Impact Analysis",
          description:
            "Shows how many additional sources would pass if each criterion were removed. Baseline: {{passed}}/{{total}} passing.",
          sourcesRecovered: "+{{count}} sources",
          guidance:
            "The most impactful criterion is the one whose removal would recover the most sources. Consider relaxing high-impact criteria if too few sources qualify.",
        },
        templates: {
          loading: "Loading templates...",
          startFrom: "Start from Template",
        },
        table: {
          source: "Source",
          domains: "Domains",
          concepts: "Concepts",
          visits: "Visits",
          dates: "Dates",
          patients: "Patients",
          score: "Score",
          overall: "Overall",
          forecast: "Forecast",
        },
        status: {
          eligible: "ELIGIBLE",
          ineligible: "INELIGIBLE",
        },
        form: {
          title: "New Feasibility Assessment",
          assessmentName: "Assessment Name",
          assessmentNamePlaceholder: "e.g. Diabetes Outcomes Study",
          requiredDomains: "Required Domains",
          minPatientCount: "Minimum Patient Count (optional)",
          minPatientCountPlaceholder: "e.g. 1000",
          domains: {
            condition: "Conditions",
            drug: "Drugs",
            procedure: "Procedures",
            measurement: "Measurements",
            observation: "Observations",
            visit: "Visits",
          },
        },
      },
      annotations: {
        filters: {
          allSources: "All sources",
        },
        tags: {
          all: "All",
          dataEvent: "Data Event",
          researchNote: "Research Note",
          actionItem: "Action Item",
          system: "System",
        },
        viewModes: {
          list: "List",
          timeline: "Timeline",
        },
        actions: {
          reply: "Reply",
          delete: "Delete",
        },
        replyPlaceholder: "Write a reply...",
        searchPlaceholder: "Search annotations...",
        confirmDelete: "Delete this annotation?",
        coordinateValue: "{{axis}} = {{value}}",
        sourceContext: "on {{source}}",
        empty: {
          selectSource: "Select a source to view its annotations",
          noAnnotations: "No annotations yet for this source",
          noTimeline: "No annotations to display in timeline.",
        },
      },
      coverage: {
        title: "Coverage Matrix (Strand Report)",
        description:
          "Domain availability across all data sources. Green = high density, amber = low density, red = no data.",
        yes: "Yes",
        densityTitle: "Density: {{density}} per person",
        filters: {
          view: "View:",
        },
        viewModes: {
          records: "Records",
          per_person: "Per Person",
          date_range: "Date Range",
        },
        actions: {
          exporting: "Exporting...",
          exportCsv: "Export CSV",
          expectedVsActual: "Expected vs Actual",
        },
        table: {
          source: "Source",
          domains: "Domains",
        },
        expectedStates: {
          expectedPresent: "Expected and present",
          expectedMissing: "Expected but missing",
          unexpectedBonus: "Unexpected bonus data",
          notExpectedAbsent: "Not expected, not present",
        },
        messages: {
          loading: "Loading coverage matrix...",
          noSources: "No sources available for coverage analysis.",
        },
      },
      dqHistory: {
        filters: {
          source: "Source:",
          selectSource: "Select source...",
        },
        tabs: {
          trends: "Trends",
          heatmap: "Heatmap",
          sla: "SLA",
          overlay: "Cross-Source",
        },
        sections: {
          passRate: "DQ Pass Rate Over Releases",
          heatmap: "Category x Release Heatmap",
          sla: "SLA Compliance Dashboard",
          overlay: "Cross-Source DQ Overlay",
        },
        passRate: "Pass Rate",
        deltaReportTitle: "Delta Report: {{release}}",
        status: {
          new: "NEW",
          existing: "EXISTING",
          resolved: "RESOLVED",
          stable: "STABLE",
        },
        result: {
          pass: "PASS",
          fail: "FAIL",
        },
        statusSummary: {
          new: "{{count}} new",
          existing: "{{count}} existing",
          resolved: "{{count}} resolved",
          stable: "{{count}} stable",
        },
        table: {
          category: "Category",
          status: "Status",
          checkId: "Check ID",
          current: "Current",
          previous: "Previous",
        },
        sla: {
          targetsTitle: "SLA Targets (min pass rate %)",
          currentCompliance: "Current Compliance",
          actual: "Actual",
          target: "Target",
          errorBudget: "Error Budget",
          targetComparison: "{{actual}}% / {{target}}% target",
        },
        messages: {
          selectSource: "Select a source to view DQ history.",
          loadingHistory: "Loading DQ history...",
          loadingDeltas: "Loading deltas...",
          loadingHeatmap: "Loading heatmap...",
          loadingOverlay: "Loading overlay data...",
          noOverlayData: "No DQ data available across sources.",
          noHeatmapData:
            "No heatmap data available. Run DQD on multiple releases to see category trends.",
          noDeltaData: "No delta data available for this release.",
          saved: "Saved",
          noSlaTargets:
            "No SLA targets defined. Set targets above to see compliance.",
          noTrendData:
            "No DQ history data available. Run DQD on at least two releases to see trends.",
          trendHelp:
            "Click a release point to view delta details. Green >90%, amber 80-90%, red <80%.",
          overlayHelp:
            "DQ pass rates overlaid across all sources on a unified timeline.",
        },
        actions: {
          exporting: "Exporting...",
          exportCsv: "Export CSV",
          saving: "Saving...",
          saveSlaTargets: "Save SLA Targets",
        },
      },
      unmapped: {
        filters: {
          source: "Source:",
          selectSource: "Select source...",
          release: "Release:",
          table: "Table:",
          allTables: "All tables",
          searchPlaceholder: "Search source codes...",
        },
        viewModes: {
          table: "Table",
          pareto: "Pareto",
          vocabulary: "Vocabulary",
        },
        actions: {
          exporting: "Exporting...",
          exportUsagiCsv: "Export Usagi CSV",
          previous: "Prev",
          next: "Next",
        },
        summaryBadge: "{{table}} ({{codes}} codes, {{records}} records)",
        vocabularyValue: "({{vocabulary}})",
        progress: {
          noCodes: "No unmapped codes to review.",
          title: "Mapping Progress",
          reviewed: "{{percent}}% reviewed",
          segmentTitle: "{{label}}: {{count}} ({{percent}}%)",
          label: "{{label}}:",
          status: {
            mapped: "Mapped",
            deferred: "Deferred",
            excluded: "Excluded",
            pending: "Pending",
          },
        },
        sections: {
          pareto: "Unmapped Codes Pareto Analysis",
          vocabulary: "Unmapped Codes by Vocabulary",
          suggestions: "AI Mapping Suggestions",
        },
        suggestions: {
          generating: "Generating suggestions via pgvector similarity...",
          failed:
            "Failed to load suggestions. The AI service or concept embeddings may not be available.",
          empty: "No suggestions available. Concept embeddings may not be loaded.",
          id: "ID: {{id}}",
          accepted: "Accepted",
          accept: "Accept",
          skip: "Skip",
        },
        pareto: {
          topCodesCoverage:
            "Top 20 codes cover {{percent}}% of all unmapped records",
          percent: "{{value}}%",
          cumulativePercent: "Cumulative %",
        },
        vocabulary: {
          total: "Total",
          codeCount: "{{count}} codes",
        },
        messages: {
          selectSource: "Select a source to view unmapped codes.",
          loading: "Loading unmapped codes...",
          emptyPareto: "No unmapped codes found for Pareto analysis.",
          emptyVocabulary: "No vocabulary data available.",
          noneFound:
            "No unmapped source codes found. All codes are mapped to standard OMOP concepts.",
          sortedByImpact: "Sorted by impact score (record count x domain weight)",
          showing: "Showing {{start}}-{{end}} of {{total}}",
        },
        table: {
          sourceCode: "Source Code",
          vocabulary: "Vocabulary",
          cdmTable: "CDM Table",
          cdmField: "CDM Field",
          records: "Records",
          impactScore: "Impact Score",
        },
      },
      conceptComparison: {
        title: "Concept Comparison Across Sources",
        searchPlaceholder:
          "Search for a concept (e.g. 'Type 2 Diabetes', 'Metformin')...",
        conceptMetadata: "{{domain}} | {{vocabulary}} | ID: {{id}}",
        selectedConceptMetadata:
          "{{domain}} | {{vocabulary}} | Concept ID: {{id}}",
        temporalTrendTitle: "Temporal Trend: {{concept}}",
        addConceptPlaceholder: "Add another concept ({{selected}}/{{max}} selected)...",
        cdcNationalRate: "CDC national rate: {{value}}/1000",
        viewModes: {
          single: "Single",
          temporal: "Temporal",
          multi: "Multi-Concept",
          funnel: "Attrition Funnel",
        },
        rateModes: {
          crude: "Crude Rate",
          standardized: "Age-Sex Adjusted",
        },
        metrics: {
          rate: "Rate/1000",
          count: "Count",
          perThousandShort: "{{value}}/1k",
          perThousandLong: "{{value}} per 1,000",
        },
        messages: {
          noComparisonData: "No comparison data available.",
          noTemporalPrevalenceData: "No temporal prevalence data available.",
          selectTwoConcepts: "Select at least 2 concepts to compare.",
          searching: "Searching...",
          loadingComparison: "Loading comparison data...",
          standardizedNote:
            "Standardized to US Census 2020 population using direct age-sex standardization.",
          searchToCompare:
            "Search for a concept above to compare its prevalence across all data sources.",
          loadingTemporal: "Loading temporal prevalence...",
          noTemporalData: "No temporal data available for this concept.",
          searchForTemporal:
            "Search for a concept above to view its temporal prevalence trend across releases.",
          loadingMulti: "Loading multi-concept comparison...",
          loadingFunnel: "Loading attrition funnel...",
          noAttritionData:
            "No attrition data available for the selected concepts.",
          temporalPrevalenceHelp:
            "Rate per 1,000 persons over time.",
        },
      },
      releases: {
        releaseTypes: {
          etl: "ETL",
          scheduledEtl: "Scheduled ETL",
          snapshot: "Snapshot",
        },
        cdmVersion: "CDM {{version}}",
        vocabularyVersion: "Vocab {{version}}",
        personCount: "{{value}} persons",
        recordCount: "{{value}} records",
        actions: {
          showDiff: "Show diff",
          editRelease: "Edit release",
          createRelease: "Create Release",
          creating: "Creating...",
          create: "Create",
          saving: "Saving...",
          save: "Save",
          cancel: "Cancel",
        },
        etl: {
          provenance: "ETL Provenance",
          ranBy: "Ran by:",
          codeVersion: "Code version:",
          duration: "Duration:",
          started: "Started:",
          parameters: "Parameters:",
        },
        duration: {
          hoursMinutes: "{{hours}}h {{minutes}}m",
          minutesSeconds: "{{minutes}}m {{seconds}}s",
          seconds: "{{seconds}}s",
        },
        confirmDelete: "Delete this release?",
        tabs: {
          list: "Releases",
          swimlane: "Swimlane",
          calendar: "Calendar",
        },
        timelineTitle: "Release Timeline (All Sources)",
        calendarTitle: "Release Calendar",
        selectSource: "Select a source",
        form: {
          releaseName: "Release name",
          cdmVersion: "CDM Version",
          vocabularyVersion: "Vocabulary Version",
          etlVersion: "ETL Version",
          notes: "Notes",
          notesPlaceholder: "Release notes...",
          cdmVersionOptional: "CDM version (optional)",
          vocabularyVersionOptional: "Vocabulary version (optional)",
          cdmVersionPlaceholder: "CDM v5.4",
          vocabularyVersionPlaceholder: "2024-11-01",
          etlVersionPlaceholder: "v1.2.3",
        },
        empty: {
          selectSource: "Select a source to view its releases",
          noReleases: "No releases yet for this source",
          noReleaseData: "No release data available.",
        },
        calendar: {
          noEvents: "No release events.",
          dayEvents: "{{date}}: {{count}} releases",
          less: "Less",
          more: "More",
        },
        diff: {
          computing: "Computing diff...",
          title: "Release Diff",
          initialRelease: "Initial release -- no previous data to compare.",
          persons: "Persons:",
          records: "Records:",
          dqScore: "DQ Score:",
          unmapped: "Unmapped:",
          vocabUpdated: "Vocab updated",
          domainDeltas: "Domain deltas:",
        },
      },
      diversity: {
        title: "Diversity Report",
        description:
          "Demographic proportions across data sources. Sources sorted by population size.",
        ratings: {
          very_high: "very high",
          high: "high",
          moderate: "moderate",
          low: "low",
        },
        percentValue: "{{value}}%",
        labelPercentValue: "{{label}}: {{value}}%",
        personCount: "{{value}} persons",
        labels: {
          gender: "Gender",
          race: "Race",
          ethnicity: "Ethnicity",
          male: "Male",
          female: "Female",
        },
        dimensions: {
          composite: "Composite",
          gender: "Gender",
          race: "Race",
          ethnicity: "Ethnicity",
        },
        tabs: {
          overview: "Overview",
          pyramid: "Age Pyramid",
          dap: "DAP Gap",
          pooled: "Pooled",
          geographic: "Geographic",
          trends: "Trends",
        },
        filters: {
          selectSource: "Select a source",
        },
        benchmarks: {
          usCensus2020: "US Census 2020",
        },
        dap: {
          title: "FDA DAP Enrollment Gap Analysis",
          description:
            "Compares source demographics against US Census 2020 benchmarks to identify enrollment gaps.",
          tooltip: "Actual: {{actual}}% | Target: {{target}}% | Gap: {{gap}}%",
          status: {
            met: "Met (within 2%)",
            gap: "Gap (2-10%)",
            critical: "Critical (>10%)",
          },
        },
        agePyramid: {
          title: "{{source}} -- Age Distribution",
        },
        benchmark: {
          title: "Benchmark: {{label}}",
          actual: "Actual",
          benchmark: "Benchmark",
        },
        trends: {
          title: "Diversity Trends: {{source}}",
          description:
            "Simpson's Diversity Index per release (0 = homogeneous, 1 = maximally diverse)",
        },
        geographic: {
          loading: "Loading geographic diversity data...",
          noLocationData: "No location data available",
          noAdiData:
            "ADI data not available (GIS module may not have ADI loaded)",
          noGeographicData:
            "No geographic data available. Sources may not have location data in the person table.",
          statesCovered: "States / regions covered",
          networkMedianAdi: "Network Median ADI:",
          sourcesWithLocation: "Sources with location data",
          sourcesWithAdi: "Sources with ADI data",
          stateCount: "{{count}} states",
          medianAdiValue: "Median ADI: {{value}}",
          topStates: "Top States by Patient Count",
          adiDistribution: "ADI Decile Distribution",
          leastDeprived: "Least deprived",
          adiDecile: "ADI Decile",
          mostDeprived: "Most deprived",
          decileTitle: "Decile {{decile}}: {{count}} ZIP codes",
          adiRatings: {
            low: "Low deprivation",
            moderate: "Moderate deprivation",
            high: "High deprivation (underserved)",
          },
        },
        pooled: {
          title: "Pooled Demographics",
          description:
            "Select multiple sources to see weighted-merged demographic profiles.",
          summary: "Total: {{persons}} persons across {{sources}} sources",
        },
        messages: {
          loading: "Loading diversity data...",
          noSources: "No sources available for diversity analysis.",
          noData: "No data",
          noTrendData: "No release data available for diversity trends.",
          noTrendReleases:
            "No releases found for this source. Create releases to track diversity trends.",
        },
      },
      cost: {
        empty: {
          title: "No Cost Data Available",
          message:
            "Cost data requires claims-based datasets (e.g., MarketScan, Optum, PharMetrics). EHR-derived datasets like SynPUF, MIMIC-IV, and most academic medical center data typically do not populate the OMOP cost table.",
        },
        filters: {
          source: "Source:",
          selectSource: "Select source...",
        },
        tabs: {
          overview: "Overview",
          distribution: "Distribution",
          "care-setting": "Care Setting",
          trends: "Trends",
          drivers: "Cost Drivers",
          "cross-source": "Cross-Source",
        },
        messages: {
          selectSource: "Select a source to view cost data.",
          loading: "Loading cost data...",
          distributionHelp:
            "Box-and-whisker plots showing cost spread. Box = IQR (P25-P75), whiskers = P10-P90, gold line = median, red dot = mean.",
          noDistributionData: "No distribution data available.",
          noCareSettingData:
            "No care setting cost data available. Requires Visit-domain cost records joined with visit_occurrence.",
          selectSourceForDrivers: "Select a source to view cost drivers.",
          loadingDrivers: "Loading cost drivers...",
          noDriverData: "No cost driver data available for this source.",
          costDriversHelp:
            "Top 10 concepts by total cost. Click a bar for concept detail.",
          loadingCrossSource: "Loading cross-source comparison...",
          noComparisonSources: "No sources available for comparison.",
          noCrossSourceCostData:
            "No sources have cost data for comparison.",
          crossSourceHelp:
            "Box-and-whisker per source. Box = IQR (P25-P75), whiskers = P10-P90, gold line = median.",
        },
        metrics: {
          totalCost: "Total Cost",
          perPatientPerYear: "Per-Patient-Per-Year",
          persons: "Persons",
          observationYears: "{{value}} yr",
          avgObservation: "Avg Observation",
          recordsAverage: "{{records}} records | avg {{average}}",
          recordCount: "{{count}} records",
          patientCount: "{{count}} patients",
          averagePerRecord: "Avg: {{value}}/record",
          medianValue: "Median: {{value}}",
          meanValue: "Mean: {{value}}",
          percent: "{{value}}%",
          range: "Range: {{min}} - {{max}}",
        },
        costTypeFilter: {
          title: "Multiple cost types detected.",
          message:
            "This source has {{count}} different cost type concepts. Mixing charged amounts with paid amounts produces misleading statistics. Filter by cost type for accurate analysis.",
          allTypes: "All Types",
          option: "{{name}} ({{count}})",
        },
        sections: {
          costByDomain: "Cost by Domain",
          distributionByDomain: "Cost Distribution by Domain",
          costByCareSetting: "Cost by Care Setting",
          monthlyTrends: "Monthly Cost Trends",
          topCostDrivers: "Top Cost Drivers",
          crossSourceComparison: "Cross-Source Cost Comparison",
        },
      },
    },
  },
  jobs: {
    page: {
      title: "Jobs",
      subtitle: "Monitor background jobs and queue status",
      empty: {
        title: "No jobs found",
        archived: "No archived jobs older than 24 hours.",
        filtered: "No jobs with status {{status}}. Try a different filter.",
        recent: "No jobs in the last 24 hours. Check Archived for older jobs.",
      },
      table: {
        job: "Job",
        type: "Type",
        source: "Source",
        started: "Started",
        duration: "Duration",
        status: "Status",
        actions: "Actions",
      },
      pagination: "Page {{current}} of {{last}} · {{total}} jobs",
    },
    filters: {
      statuses: {
        all: "All (24h)",
        pending: "Pending",
        queued: "Queued",
        running: "Running",
        completed: "Completed",
        failed: "Failed",
        cancelled: "Cancelled",
        archived: "Archived",
      },
      types: {
        all: "All Types",
        analysis: "Analysis",
        characterization: "Characterization",
        incidenceRate: "Incidence Rate",
        estimation: "Estimation",
        prediction: "Prediction",
        pathway: "Pathway",
        sccs: "SCCS",
        evidenceSynthesis: "Evidence Synthesis",
        cohortGeneration: "Cohort Generation",
        careGaps: "Care Gaps",
        achilles: "Achilles",
        dataQuality: "Data Quality",
        heelChecks: "Heel Checks",
        ingestion: "Ingestion",
        vocabulary: "Vocabulary",
        genomicParse: "Genomic Parse",
        poseidon: "Poseidon ETL",
        fhirExport: "FHIR Export",
        fhirSync: "FHIR Sync",
        gisImport: "GIS Import",
        gisBoundaries: "GIS Boundaries",
      },
    },
    actions: {
      retry: "Retry",
      retryJob: "Retry job",
      cancel: "Cancel",
      cancelJob: "Cancel job",
      previous: "Previous",
      next: "Next",
    },
    drawer: {
      titleFallback: "Job Details",
      loadError: "Failed to load job details.",
      sections: {
        executionLog: "Execution Log",
        analysis: "Analysis",
        cohort: "Cohort",
        ingestionPipeline: "Ingestion Pipeline",
        fhirSync: "FHIR Sync",
        dataQuality: "Data Quality",
        heelChecks: "Heel Checks",
        achillesAnalyses: "Achilles Analyses",
        genomicParse: "Genomic Parse",
        poseidonEtl: "Poseidon ETL",
        careGapEvaluation: "Care Gap Evaluation",
        gisBoundaries: "GIS Boundaries",
        gisImport: "GIS Import",
        vocabularyImport: "Vocabulary Import",
        fhirExport: "FHIR Export",
        overview: "Overview",
        output: "Output",
      },
      labels: {
        analysis: "Analysis",
        createdBy: "Created By",
        parameters: "Parameters",
        cohort: "Cohort",
        personCount: "Person Count",
        source: "Source",
        sourceKey: "Source Key",
        stage: "Stage",
        project: "Project",
        file: "File",
        fileSize: "File Size",
        mappingCoverage: "Mapping Coverage",
        processed: "Processed",
        failed: "Failed",
        filesDownloaded: "Files Downloaded",
        recordsExtracted: "Records Extracted",
        recordsMapped: "Records Mapped",
        recordsWritten: "Records Written",
        recordsFailed: "Records Failed",
        passed: "Passed",
        passRate: "Pass Rate",
        expectedChecks: "Expected Checks",
        executionTime: "Execution Time",
        failingChecks: "Failing Checks",
        totalRules: "Total Rules",
        rulesTriggered: "Rules Triggered",
        totalViolations: "Total Violations",
        topViolations: "Top Violations",
        completed: "Completed",
        byCategory: "By Category",
        failedSteps: "Failed Steps",
        format: "Format",
        totalVariants: "Total Variants",
        mappedVariants: "Mapped Variants",
        samples: "Samples",
        runType: "Run Type",
        dagsterRunId: "Dagster Run ID",
        stats: "Stats",
        bundle: "Bundle",
        complianceSummary: "Compliance Summary",
        dataset: "Dataset",
        dataType: "Data Type",
        version: "Version",
        geometry: "Geometry",
        features: "Features",
        tablesLoaded: "Tables Loaded",
        recordsLoaded: "Records Loaded",
        outputFormat: "Output Format",
        type: "Type",
        triggeredBy: "Triggered By",
        duration: "Duration",
        started: "Started",
        created: "Created",
        error: "Error",
      },
      messages: {
        stalled:
          "This job stalled and was marked as failed after exceeding the 1-hour timeout.",
        failedCount: "{{count}} failed",
        runningCount: "{{count}} running",
        ofTotal: "of {{count}}",
        records: "{{count}} records",
      },
    },
  },
};

const esApp: MessageTree = {
  analysis: {
    titles: {
      characterization: "Caracterización",
      incidenceRate: "Análisis de tasas de incidencia",
      pathway: "Análisis de trayectorias",
      estimation: "Análisis de estimación",
      prediction: "Análisis de predicción",
      sccs: "Análisis SCCS",
      evidenceSynthesis: "Síntesis de evidencia",
    },
  },
  errors: {
    boundary: {
      title: "Algo salió mal",
      message:
        "Se produjo un error inesperado. Intenta recargar la página.",
      reloadPage: "Recargar página",
    },
    route: {
      routeError: "Error de ruta",
      pageFailed: "La página no se pudo renderizar.",
      analysisDescription:
        "Esta página de análisis encontró un error de renderizado o de carga de ruta.",
      label: "Error",
      backToAnalyses: "Volver a análisis",
      reloadPage: "Recargar página",
    },
  },
  covariates: {
    title: "Configuración de covariables",
    description:
      "Selecciona qué dominios incluir como covariables para FeatureExtraction.",
    groups: {
      core: "Dominios principales",
      extended: "Dominios extendidos",
      indices: "Índices de comorbilidad",
    },
    labels: {
      demographics: "Demografía",
      conditionOccurrence: "Ocurrencia de condiciones",
      drugExposure: "Exposición a fármacos",
      procedureOccurrence: "Ocurrencia de procedimientos",
      measurement: "Mediciones",
      observation: "Observaciones",
      deviceExposure: "Exposición a dispositivos",
      visitCount: "Conteo de visitas",
      charlsonComorbidity: "Comorbilidad de Charlson",
      dcsi: "DCSI (diabetes)",
      chads2: "CHADS2",
      chads2Vasc: "CHA2DS2-VASc",
    },
    timeWindows: "Ventanas temporales",
    to: "a",
    days: "días",
    addTimeWindow: "Añadir ventana temporal",
  },
  studies: {
    list: {
      title: "Estudios",
      subtitle: "Orquesta y gestiona estudios de investigación federada",
      tableView: "Vista de tabla",
      cardView: "Vista de tarjetas",
      searchPlaceholder: "Buscar estudios...",
      noSearchMatches: "No hay estudios que coincidan con \"{{query}}\"",
      typeToFilter: "Escribe para filtrar {{count}} estudios",
      newStudy: "Nuevo estudio",
      solr: "Solr",
      drilldownTitle: "Estudios: {{phase}}",
      filterLabels: {
        status: "Estado",
        type: "Tipo",
        priority: "Prioridad",
      },
      loadFailed: "No se pudieron cargar los estudios",
      clear: "Limpiar",
      empty: {
        noMatchingTitle: "No hay estudios coincidentes",
        noStudiesTitle: "Aún no hay estudios",
        noResultsFor: "No se encontraron estudios para \"{{query}}\"",
        tryAdjusting: "Prueba a ajustar los términos de búsqueda.",
        createFirst:
          "Crea tu primer estudio para orquestar investigación federada.",
      },
      table: {
        title: "Título",
        type: "Tipo",
        status: "Estado",
        priority: "Prioridad",
        pi: "IP",
        created: "Creado",
      },
      pagination: {
        showing: "Mostrando {{start}} - {{end}} de {{total}}",
        page: "{{page}} / {{totalPages}}",
      },
    },
    metrics: {
      total: "Total",
      active: "Activos",
      preStudy: "Preestudio",
      inProgress: "En curso",
      postStudy: "Postestudio",
    },
    studyTypes: {
      characterization: "Caracterización",
      populationLevelEstimation: "PLE",
      patientLevelPrediction: "PLP",
      comparativeEffectiveness: "Comparativo",
      safetySurveillance: "Seguridad",
      drugUtilization: "Uso de fármacos",
      qualityImprovement: "QI",
      custom: "Personalizado",
    },
    statuses: {
      draft: "Borrador",
      protocol_development: "Desarrollo de protocolo",
      feasibility: "Factibilidad",
      irb_review: "Revisión IRB",
      execution: "Ejecución",
      analysis: "Análisis",
      published: "Publicado",
      archived: "Archivado",
    },
    priorities: {
      critical: "Crítica",
      high: "Alta",
      medium: "Media",
      low: "Baja",
    },
    phases: {
      activeMetric: "Activos",
      pre_study: "Preestudio",
      active: "En curso",
      post_study: "Postestudio",
    },
    create: {
      backToStudies: "Estudios",
      title: "Crear estudio",
      subtitle: "Configura tu estudio de investigación paso a paso",
      previous: "Anterior",
      next: "Siguiente",
      createAsDraft: "Crear como borrador",
      steps: {
        basics: "Aspectos básicos",
        science: "Diseño científico",
        team: "Equipo y cronograma",
        review: "Revisar y crear",
      },
      studyTypes: {
        characterization: {
          label: "Caracterización",
          description:
            "Describe poblaciones de pacientes y patrones de tratamiento",
        },
        populationLevelEstimation: {
          label: "Estimación a nivel poblacional",
          description:
            "Estima efectos causales usando datos observacionales",
        },
        patientLevelPrediction: {
          label: "Predicción a nivel de paciente",
          description: "Predice resultados de pacientes individuales",
        },
        comparativeEffectiveness: {
          label: "Efectividad comparativa",
          description: "Compara tratamientos en entornos reales",
        },
        safetySurveillance: {
          label: "Vigilancia de seguridad",
          description:
            "Monitorea señales de seguridad de medicamentos poscomercialización",
        },
        drugUtilization: {
          label: "Utilización de medicamentos",
          description: "Analiza patrones y tendencias de uso de medicamentos",
        },
        qualityImprovement: {
          label: "Mejora de calidad",
          description:
            "Evalúa la calidad de la atención y la adherencia a guías",
        },
        custom: {
          label: "Personalizado",
          description: "Define un tipo de estudio personalizado",
        },
      },
      designs: {
        select: "Selecciona un diseño...",
        retrospectiveCohort: "Cohorte retrospectiva",
        prospectiveCohort: "Cohorte prospectiva",
        caseControl: "Casos y controles",
        crossSectional: "Transversal",
        selfControlled: "Serie de casos autocontrolada",
        nestedCaseControl: "Casos y controles anidado",
        metaAnalysis: "Metaanálisis",
        networkStudy: "Estudio en red",
        methodological: "Metodológico",
      },
      phases: {
        select: "Selecciona una fase...",
        phaseI: "Fase I",
        phaseII: "Fase II",
        phaseIII: "Fase III",
        phaseIV: "Fase IV",
        notApplicable: "No aplica",
      },
      basics: {
        studyType: "Tipo de estudio *",
        title: "Título *",
        titlePlaceholder:
          "p. ej., efecto de estatinas en desenlaces cardiovasculares en T2DM",
        shortTitle: "Título corto",
        shortTitlePlaceholder: "p. ej., LEGEND-T2DM",
        priority: "Prioridad",
        studyDesign: "Diseño del estudio",
        description: "Descripción",
        descriptionPlaceholder: "Breve descripción del estudio...",
        tags: "Etiquetas",
        tagsPlaceholder: "Añade una etiqueta y presiona Enter...",
        addTag: "Añadir etiqueta",
      },
      science: {
        aiPrompt:
          "Deja que la IA sugiera campos de diseño científico según el título del estudio",
        generating: "Generando...",
        generateWithAi: "Generar con IA",
        aiUnavailable:
          "El servicio de IA no está disponible. Completa los campos manualmente.",
        rationale: "Justificación científica",
        rationalePlaceholder:
          "¿Por qué se necesita este estudio? ¿Qué brecha de conocimiento aborda?",
        hypothesis: "Hipótesis",
        hypothesisPlaceholder: "Indica la hipótesis principal que se evaluará...",
        primaryObjective: "Objetivo primario",
        primaryObjectivePlaceholder:
          "¿Cuál es el objetivo principal de este estudio?",
        secondaryObjectives: "Objetivos secundarios",
        secondaryObjectivePlaceholder: "Añade un objetivo y presiona Enter...",
        addSecondaryObjective: "Añadir objetivo secundario",
        fundingSource: "Fuente de financiación",
        fundingSourcePlaceholder:
          "p. ej., NIH R01, PCORI, patrocinio de la industria",
      },
      team: {
        startDate: "Fecha de inicio del estudio",
        endDate: "Fecha de fin del estudio",
        endDateAfterStart:
          "La fecha de fin debe ser posterior a la fecha de inicio",
        targetSites: "Sitios de reclutamiento objetivo",
        targetSitesPlaceholder: "p. ej., 10",
        studyPhase: "Fase del estudio",
        nctId: "ID de ClinicalTrials.gov",
        nctIdPlaceholder: "p. ej., NCT12345678",
        note:
          "Los miembros del equipo, sitios y cohortes se pueden configurar desde el panel del estudio después de crearlo.",
      },
      review: {
        basics: "Aspectos básicos",
        scientificDesign: "Diseño científico",
        timelineRegistration: "Cronograma y registro",
        labels: {
          title: "Título:",
          shortTitle: "Título corto:",
          type: "Tipo:",
          priority: "Prioridad:",
          design: "Diseño:",
          rationale: "Justificación:",
          hypothesis: "Hipótesis:",
          primaryObjective: "Objetivo primario:",
          secondaryObjectives: "Objetivos secundarios:",
          start: "Inicio:",
          end: "Fin:",
          targetSites: "Sitios objetivo:",
          phase: "Fase:",
          nctId: "ID NCT:",
          funding: "Financiación:",
        },
      },
    },
    detail: {
      loadFailed: "No se pudo cargar el estudio",
      backToStudies: "Volver a estudios",
      studies: "Estudios",
      confirmDelete:
        "¿Seguro que quieres eliminar este estudio? Esta acción no se puede deshacer.",
      confirmArchive: "¿Archivar este estudio? Se puede restaurar más adelante.",
      copyTitle: "Copia de {{title}}",
      tabs: {
        overview: "Resumen",
        design: "Diseño",
        analyses: "Análisis",
        results: "Resultados",
        progress: "Progreso",
        sites: "Sitios",
        team: "Equipo",
        cohorts: "Cohortes",
        milestones: "Hitos",
        artifacts: "Artefactos",
        activity: "Actividad",
        federated: "Federado",
      },
      statuses: {
        draft: "Borrador",
        protocol_development: "Desarrollo de protocolo",
        feasibility: "Factibilidad",
        irb_review: "Revisión IRB",
        recruitment: "Reclutamiento",
        execution: "Ejecución",
        analysis: "Análisis",
        synthesis: "Síntesis",
        manuscript: "Manuscrito",
        published: "Publicado",
        archived: "Archivado",
        withdrawn: "Retirado",
      },
      studyTypes: {
        characterization: "Caracterización",
        population_level_estimation: "Estimación a nivel poblacional",
        patient_level_prediction: "Predicción a nivel de paciente",
        comparative_effectiveness: "Efectividad comparativa",
        safety_surveillance: "Vigilancia de seguridad",
        drug_utilization: "Utilización de medicamentos",
        quality_improvement: "Mejora de calidad",
        custom: "Personalizado",
      },
      actions: {
        transitionTo: "Cambiar a",
        generateManuscriptTitle:
          "Generar manuscrito a partir de análisis completados",
        manuscript: "Manuscrito",
        duplicateStudy: "Duplicar estudio",
        exportJson: "Exportar como JSON",
        archiveStudy: "Archivar estudio",
        deleteStudy: "Eliminar estudio",
      },
      sections: {
        about: "Acerca de",
        analysisPipeline: "Canal de análisis ({{count}})",
        executionProgress: "Progreso de ejecución",
        details: "Detalles",
        timeline: "Cronograma",
        tags: "Etiquetas",
        createdBy: "Creado por",
      },
      labels: {
        primaryObjective: "Objetivo primario",
        hypothesis: "Hipótesis",
        secondaryObjectives: "Objetivos secundarios",
        principalInvestigator: "Investigador principal",
        leadDataScientist: "Científico de datos líder",
        studyDesign: "Diseño del estudio",
        phase: "Fase",
        protocolVersion: "Versión del protocolo",
        funding: "Financiación",
        clinicalTrialsGov: "ClinicalTrials.gov",
        start: "Inicio:",
        end: "Fin:",
        targetSites: "Sitios objetivo:",
        created: "Creado:",
      },
      messages: {
        noDescription: "No se proporcionó descripción",
        moreAnalyses: "+{{count}} análisis más",
      },
      progress: {
        completed: "{{count}} completados",
        running: "{{count}} en ejecución",
        failed: "{{count}} fallidos",
        pending: "{{count}} pendientes",
      },
    },
    dashboard: {
      progressSummary: "{{completed}} de {{total}} análisis completados",
      stats: {
        total: "Total",
        pending: "Pendientes",
        running: "En ejecución",
        completed: "Completados",
        failed: "Fallidos",
      },
      sections: {
        studyAnalyses: "Análisis del estudio",
      },
      table: {
        type: "Tipo",
        name: "Nombre",
        status: "Estado",
      },
      messages: {
        notExecuted: "No ejecutado",
      },
      empty: {
        title: "No hay análisis en este estudio",
        message: "Añade análisis en la pestaña Diseño para comenzar.",
      },
    },
    analyses: {
      selectSource: "Selecciona una fuente...",
      executeAll: "Ejecutar todo",
      addAnalysisToStudy: "Añadir análisis al estudio",
      emptyMessage:
        "Añade caracterizaciones, estimaciones, predicciones y más para crear tu canal de análisis",
      groupHeader: "{{label}} ({{count}})",
      openAnalysisDetail: "Abrir detalle del análisis",
      confirmRemove: "¿Eliminar este análisis del estudio?",
      removeFromStudy: "Eliminar del estudio",
      analysisId: "ID de análisis",
      lastRun: "Última ejecución",
      error: "Error",
      viewFullDetail: "Ver detalle completo",
    },
    results: {
      sections: {
        results: "Resultados ({{count}})",
        syntheses: "Síntesis ({{count}})",
      },
      actions: {
        synthesize: "Sintetizar",
        markPrimary: "Marcar como primario",
        unmarkPrimary: "Quitar marca de primario",
        markPublishable: "Marcar como publicable",
        unmarkPublishable: "Quitar marca de publicable",
        cancel: "Cancelar",
      },
      filters: {
        allTypes: "Todos los tipos",
        publishableOnly: "Solo publicables",
      },
      empty: {
        noResultsTitle: "Aún no hay resultados",
        noResultsMessage:
          "Los resultados aparecerán aquí después de ejecutar los análisis",
        noSummaryData: "No hay datos resumidos disponibles",
        noSynthesesTitle: "No hay síntesis",
        noSynthesesMessage:
          "Combina resultados de múltiples sitios mediante metaanálisis",
      },
      resultTypes: {
        cohort_count: "Conteo de cohorte",
        characterization: "Caracterización",
        incidence_rate: "Tasa de incidencia",
        effect_estimate: "Estimación de efecto",
        prediction_performance: "Rendimiento de predicción",
        pathway: "Trayectoria",
        sccs: "SCCS",
        custom: "Personalizado",
      },
      synthesisTypes: {
        fixed_effects_meta: "Metaanálisis de efectos fijos",
        random_effects_meta: "Metaanálisis de efectos aleatorios",
        bayesian_meta: "Metaanálisis bayesiano",
        forest_plot: "Gráfico de bosque",
        heterogeneity_analysis: "Análisis de heterogeneidad",
        funnel_plot: "Gráfico de embudo",
        evidence_synthesis: "Síntesis de evidencia",
        custom: "Personalizado",
      },
      badges: {
        primary: "Primario",
        publishable: "Publicable",
      },
      messages: {
        resultCreated: "Resultado #{{id}} · {{date}}",
        reviewedBy: "Revisado por {{name}}",
      },
      labels: {
        summary: "Resumen",
        diagnostics: "Diagnósticos",
      },
      pagination: {
        previous: "Anterior",
        next: "Siguiente",
        page: "Página {{page}} de {{totalPages}}",
      },
      synthesis: {
        createTitle: "Crear síntesis",
        instructions:
          "Selecciona 2 o más resultados arriba y luego elige un método de síntesis.",
        createSelected: "Crear ({{count}} seleccionados)",
        confirmDelete: "¿Eliminar esta síntesis?",
        resultsCount: "{{count}} resultados",
        system: "Sistema",
        methodSettings: "Configuración del método",
        output: "Salida",
        noOutput: "Aún no se generó salida",
      },
    },
    federated: {
      loadingResults: "Cargando resultados...",
      loadResultsFailed: "No se pudieron cargar los resultados: {{error}}",
      unknownError: "Error desconocido",
      confirmDistribute: "¿Distribuir el estudio a {{count}} nodos de datos?",
      arachneNotReachable: "Arachne Central no está disponible",
      loadNodesFailed: "No se pudieron cargar los nodos de Arachne",
      arachneConnectionHelp:
        "Configura ARACHNE_URL en el entorno para habilitar la ejecución federada. Asegúrate de que Arachne Central esté en ejecución y accesible.",
      availableDataNodes: "Nodos de datos disponibles",
      poweredByArachne: "Impulsado por Arachne",
      distributeCount: "Distribuir ({{count}})",
      noNodes:
        "No hay nodos de Arachne configurados. Configura ARACHNE_URL en el entorno para habilitar la ejecución federada.",
      distributionFailed: "La distribución falló: {{error}}",
      distributionSucceeded:
        "El estudio se distribuyó correctamente. El estado se supervisa abajo.",
      federatedExecutions: "Ejecuciones federadas",
      noExecutions:
        "Aún no hay ejecuciones federadas. Selecciona nodos de datos arriba y distribuye para comenzar.",
      arachneAnalysis: "Análisis Arachne #{{id}}",
      statuses: {
        PENDING: "Pendiente",
        EXECUTING: "En ejecución",
        COMPLETED: "Completado",
        FAILED: "Fallido",
      },
      table: {
        name: "Nombre",
        status: "Estado",
        cdmVersion: "Versión CDM",
        patients: "Pacientes",
        lastSeen: "Última vez visto",
        node: "Nodo",
        submitted: "Enviado",
        completed: "Completado",
      },
    },
    artifacts: {
      sections: {
        artifacts: "Artefactos ({{count}})",
      },
      actions: {
        addArtifact: "Añadir artefacto",
        cancel: "Cancelar",
        create: "Crear",
        save: "Guardar",
        edit: "Editar artefacto",
        delete: "Eliminar artefacto",
        openLink: "Abrir enlace",
      },
      form: {
        addTitle: "Añadir artefacto del estudio",
        title: "Título",
        titleRequired: "Título *",
        titlePlaceholder: "p. ej., Protocolo del estudio v2.1",
        version: "Versión",
        type: "Tipo",
        urlOptional: "URL (opcional)",
        description: "Descripción",
        descriptionOptional: "Descripción (opcional)",
        descriptionPlaceholder: "Breve descripción de este artefacto...",
      },
      empty: {
        title: "No hay artefactos",
        message:
          "Guarda protocolos, paquetes de análisis y documentos del estudio",
      },
      badges: {
        current: "Actual",
      },
      labels: {
        versionValue: "v{{version}}",
        sizeKb: "{{size}} KB",
      },
      messages: {
        unknown: "Desconocido",
        uploadedBy: "{{name}} · {{date}}",
      },
      confirmDelete: "¿Eliminar este artefacto?",
      types: {
        protocol: "Protocolo",
        sap: "Plan de análisis estadístico",
        irb_submission: "Envío al IRB",
        cohort_json: "JSON de cohorte",
        analysis_package_r: "Paquete de análisis en R",
        analysis_package_python: "Paquete de análisis en Python",
        results_report: "Informe de resultados",
        manuscript_draft: "Borrador de manuscrito",
        supplementary: "Material suplementario",
        presentation: "Presentación",
        data_dictionary: "Diccionario de datos",
        study_package_zip: "ZIP del paquete del estudio",
        other: "Otro",
      },
    },
    sites: {
      sections: {
        sites: "Sitios ({{count}})",
      },
      actions: {
        addSite: "Añadir sitio",
        cancel: "Cancelar",
        save: "Guardar",
        edit: "Editar sitio",
        remove: "Quitar sitio",
      },
      form: {
        addTitle: "Añadir sitio asociado de datos",
        sourceSearchPlaceholder: "Buscar fuentes de datos...",
        siteRole: "Rol del sitio",
        irbProtocol: "Protocolo IRB #",
        notes: "Notas",
        optional: "Opcional",
      },
      empty: {
        title: "No hay sitios inscritos",
        message: "Añade sitios asociados de datos a este estudio",
      },
      table: {
        source: "Fuente",
        role: "Rol",
        status: "Estado",
        irb: "IRB #",
        patients: "Pacientes",
        cdm: "CDM",
      },
      messages: {
        allSourcesAssigned: "Todas las fuentes ya están asignadas",
        noMatchingSources: "No hay fuentes coincidentes",
        sourceFallback: "Fuente #{{id}}",
      },
      confirmRemove: "¿Quitar este sitio?",
      roles: {
        data_partner: "Socio de datos",
        coordinating_center: "Centro coordinador",
        analytics_node: "Nodo analítico",
        observer: "Observador",
      },
      statuses: {
        pending: "Pendiente",
        invited: "Invitado",
        approved: "Aprobado",
        active: "Activo",
        completed: "Completado",
        withdrawn: "Retirado",
      },
    },
    cohorts: {
      sections: {
        cohorts: "Cohortes ({{count}})",
      },
      actions: {
        assignCohort: "Asignar cohorte",
        assign: "Asignar",
        cancel: "Cancelar",
        save: "Guardar",
        edit: "Editar asignación de cohorte",
        remove: "Quitar asignación de cohorte",
      },
      form: {
        assignTitle: "Asignar definición de cohorte",
        cohortDefinition: "Definición de cohorte",
        searchPlaceholder: "Buscar definiciones de cohorte...",
        role: "Rol",
        label: "Etiqueta",
        labelRequired: "Etiqueta *",
        labelPlaceholder: "p. ej., población objetivo con DM2",
        description: "Descripción",
        optional: "Opcional",
      },
      empty: {
        title: "No hay cohortes asignadas",
        message:
          "Asigna definiciones de cohorte y especifica sus roles en este estudio",
      },
      messages: {
        allAssigned: "Todas las definiciones de cohorte ya están asignadas",
        noMatchingCohorts: "No hay cohortes coincidentes",
        cohortFallback: "Cohorte #{{id}}",
      },
      confirmRemove: "¿Quitar esta asignación de cohorte?",
      roles: {
        target: "Objetivo",
        comparator: "Comparador",
        outcome: "Resultado",
        exclusion: "Exclusión",
        subgroup: "Subgrupo",
        event: "Evento",
      },
    },
    team: {
      sections: {
        members: "Miembros del equipo ({{count}})",
      },
      actions: {
        addMember: "Añadir miembro",
        cancel: "Cancelar",
        save: "Guardar",
        edit: "Editar miembro del equipo",
        remove: "Quitar miembro del equipo",
      },
      form: {
        addTitle: "Añadir miembro del equipo",
        user: "Usuario",
        userSearchPlaceholder: "Buscar usuarios por nombre o correo...",
        role: "Rol",
      },
      empty: {
        title: "No hay miembros del equipo",
        message: "Añade investigadores y colaboradores a este estudio",
      },
      table: {
        name: "Nombre",
        email: "Correo",
        role: "Rol",
        status: "Estado",
        joined: "Se incorporó",
      },
      messages: {
        allUsersAssigned: "Todos los usuarios ya son miembros del equipo",
        noMatchingUsers: "No hay usuarios coincidentes",
        userFallback: "Usuario #{{id}}",
      },
      confirmRemove: "¿Quitar este miembro del equipo?",
      statuses: {
        active: "Activo",
        inactive: "Inactivo",
      },
      roles: {
        principal_investigator: "Investigador principal",
        co_investigator: "Coinvestigador",
        data_scientist: "Científico de datos",
        statistician: "Estadístico",
        site_lead: "Responsable del sitio",
        data_analyst: "Analista de datos",
        research_coordinator: "Coordinador de investigación",
        irb_liaison: "Enlace con IRB",
        project_manager: "Gestor de proyecto",
        observer: "Observador",
      },
      roleDescriptions: {
        principal_investigator: "Investigador líder responsable del estudio",
        co_investigator: "Investigador colaborador con supervisión del estudio",
        data_scientist: "Desarrolla y ejecuta canales analíticos",
        statistician: "Análisis estadístico y metodología",
        site_lead: "Gestiona las operaciones del sitio asociado de datos",
        data_analyst: "Procesamiento de datos y controles de calidad",
        research_coordinator: "Coordina la logística y los cronogramas del estudio",
        irb_liaison: "Gestiona envíos al IRB y cumplimiento",
        project_manager: "Planificación y seguimiento general del proyecto",
        observer: "Acceso de solo lectura a los materiales del estudio",
      },
    },
    milestones: {
      sections: {
        milestones: "Hitos ({{count}})",
      },
      actions: {
        addMilestone: "Añadir hito",
        cancel: "Cancelar",
        create: "Crear",
        save: "Guardar",
        edit: "Editar hito",
        delete: "Eliminar hito",
      },
      form: {
        titlePlaceholder: "Título del hito...",
      },
      empty: {
        title: "No hay hitos",
        message: "Da seguimiento al progreso del estudio con hitos y fechas objetivo",
      },
      labels: {
        target: "Objetivo: {{date}}",
        targetCompleted: "Objetivo: {{target}} | Completado: {{completed}}",
      },
      confirmDelete: "¿Eliminar este hito?",
      types: {
        protocol: "Protocolo",
        irb: "IRB",
        data_access: "Acceso a datos",
        analysis: "Análisis",
        review: "Revisión",
        publication: "Publicación",
        custom: "Personalizado",
      },
      statuses: {
        pending: "Pendiente",
        in_progress: "En progreso",
        completed: "Completado",
        overdue: "Atrasado",
        cancelled: "Cancelado",
      },
    },
    activity: {
      title: "Registro de actividad",
      empty: {
        title: "Aún no hay actividad",
        message: "Las acciones realizadas en este estudio aparecerán aquí",
      },
      pagination: {
        previous: "Anterior",
        next: "Siguiente",
        page: "Página {{page}} de {{totalPages}}",
      },
      actions: {
        created: "Creado",
        updated: "Actualizado",
        deleted: "Eliminado",
        status_changed: "Estado cambiado",
        member_added: "Miembro añadido",
        member_removed: "Miembro quitado",
        site_added: "Sitio añadido",
        analysis_added: "Análisis añadido",
        executed: "Ejecutado",
      },
      entities: {
        study: "Estudio",
        study_analysis: "Análisis del estudio",
        study_artifact: "Artefacto del estudio",
        study_cohort: "Cohorte del estudio",
        study_milestone: "Hito del estudio",
        study_site: "Sitio del estudio",
        study_team_member: "Miembro del equipo del estudio",
      },
    },
    designer: {
      defaultSessionTitle: "Diseño OHDSI de {{title}}",
      title: "Compilador de diseño de estudios OHDSI",
      subtitle:
        "Convierte una pregunta de investigación revisada en conjuntos de conceptos, cohortes, evidencia de factibilidad, planes de análisis listos para HADES y un paquete de estudio bloqueado.",
      researchQuestionPlaceholder:
        "En adultos con..., ¿... frente a ... reduce ...?",
      badges: {
        session: "Sesión {{value}}",
        version: "Versión {{value}}",
      },
      versionStatuses: {
        generated: "Generado",
        review_ready: "Listo para revisión",
        accepted: "Aceptado",
        locked: "Bloqueado",
      },
      metrics: {
        assets: "Activos",
      },
      actions: {
        downloadLockedPackage: "Descargar paquete bloqueado",
        downloadPackage: "Descargar paquete",
        add: "Añadir",
        saveChanges: "Guardar cambios",
      },
      sections: {
        verificationGates: "Puertas de verificación",
        packageProvenance: "Procedencia del paquete",
        assetEvidence: "Evidencia de activos",
        basicInformation: "Información básica",
        addAnalysis: "Añadir análisis",
        studyAnalyses: "Análisis del estudio ({{count}})",
      },
      descriptions: {
        verificationGates:
          "Resuelve los bloqueos antes de cerrar el paquete OHDSI.",
        assetEvidence:
          "Revisa la salida bloqueada del verificador antes de aceptar un paquete.",
      },
      gates: {
        designIntent: "Intención de diseño",
        acceptedAt: "Aceptado {{time}}",
        acceptResearchQuestion: "Acepta la pregunta de investigación revisada.",
        verifiedMaterializedCohorts:
          "{{count}} cohortes materializadas verificadas",
        feasibilityReady: "La evidencia de factibilidad verificada está lista.",
        runFeasibility:
          "Ejecuta la factibilidad después de verificar las cohortes.",
        analysisPlan: "Plan de análisis",
        analysisPlanReady: "El plan de análisis HADES verificado está listo.",
        verifyAnalysisPlan: "Verifica y materializa un plan de análisis.",
      },
      labels: {
        version: "Versión",
        versionStatus: "v{{version}} {{status}}",
        verifiedAssets: "Activos verificados",
        title: "Título",
        description: "Descripción",
        studyType: "Tipo de estudio",
        analysisType: "Tipo de análisis",
        analysis: "Análisis",
        missingOmopIds: "IDs OMOP faltantes",
        deprecatedOmopIds: "IDs OMOP obsoletos",
        invalidDraftIds: "IDs de borrador no válidos",
      },
      placeholders: {
        studyTitle: "Título del estudio",
        optionalDescription: "Descripción opcional",
        selectAnalysis: "Selecciona un análisis...",
      },
      analysisTypes: {
        characterization: "Caracterización",
        "incidence-rate": "Tasa de incidencia",
        pathway: "Trayectoria",
        estimation: "Estimación",
        prediction: "Predicción",
      },
      messages: {
        new: "nueva",
        none: "ninguna",
        notStarted: "no iniciado",
        createOrImport: "Crea o importa un diseño para comenzar.",
        needsEvidence: "Requiere evidencia",
        noVersion: "Sin versión",
        blockedCount: "{{count}} bloqueados",
        noBlockers: "Sin bloqueos",
        startEvidenceReview:
          "Genera intención o importa el estudio actual para comenzar la revisión de evidencia.",
        noAnalyses: "Aún no se añadieron análisis.",
        analysisFallback: "Análisis #{{id}}",
        assetId: "Activo #{{id}}",
        materializedId: "materializado #{{id}}",
        verifiedAt: "verificado {{time}}",
      },
    },
    workbench: {
      sessionTitle: "Diseño de intención del estudio",
      title: "Compilador de diseño del estudio",
      subtitle:
        "Convierte una pregunta de investigación en una intención de estudio revisada y alineada con OHDSI, y evalúa activos de fenotipo reutilizables antes de avanzar.",
      newSession: "Nueva sesión",
      sessions: "Sesiones",
      researchQuestion: "Pregunta de investigación",
      researchQuestionPlaceholder:
        "Compara MACE recurrente en pacientes posinfarto que inician clopidogrel frente a aspirina.",
      emptyQuestionPlaceholder: "Describe la pregunta del estudio...",
      generateIntent: "Generar intención",
      startSession:
        "Inicia una sesión de diseño y luego genera una intención PICO estructurada a partir de la pregunta del estudio.",
      createAndGenerate: "Crear sesión y generar intención",
      loadingSessions: "Cargando sesiones de diseño...",
      sections: {
        phenotypeRecommendations: "Recomendaciones de fenotipos y reutilización",
        conceptSetDrafts: "Borradores de conjuntos de conceptos",
        cohortDrafts: "Borradores de cohortes",
        cohortReadiness: "Preparación de cohortes del estudio",
        feasibility: "Factibilidad",
        sources: "Fuentes",
        attrition: "Atrición",
        analysisPlans: "Planes de análisis",
        packageLock: "Bloqueo del paquete",
        currentAssets: "Activos actuales del estudio",
        intentReview: "Revisión de intención",
        source: "Origen",
        governance: "Gobernanza",
      },
      descriptions: {
        recommendations:
          "Revisa entradas reutilizables de la biblioteca de fenotipos, cohortes locales y conjuntos de conceptos locales antes de crear algo nuevo.",
        conceptSets:
          "Convierte evidencia aceptada en borradores verificados contra vocabulario antes de crear conjuntos de conceptos nativos.",
        cohorts:
          "Convierte conjuntos de conceptos materializados en borradores nativos de definiciones de cohorte.",
        feasibility:
          "Verifica cohortes vinculadas contra fuentes CDM seleccionadas antes de planificar análisis.",
        analysisPlans:
          "Compila cohortes factibles del estudio en diseños de análisis nativos compatibles con HADES.",
        packageLock:
          "Congela intención aceptada, conjuntos de conceptos, cohortes, factibilidad y análisis nativos en un paquete de estudio auditable.",
        currentAssets:
          "Trae cohortes y análisis creados manualmente a esta ruta de diseño y revisa brechas sin cambiar registros existentes.",
      },
      actions: {
        recommend: "Recomendar",
        draftConceptSets: "Crear borradores de conceptos",
        draftCohorts: "Crear borradores de cohortes",
        runFeasibility: "Ejecutar factibilidad",
        draftPlans: "Crear planes",
        importCurrent: "Importar actuales",
        critique: "Criticar",
        verify: "Verificar",
        review: "Revisar",
        accept: "Aceptar",
        defer: "Posponer",
        reject: "Rechazar",
        materialize: "Materializar",
        openNativeEditor: "Abrir editor nativo",
        linkToStudy: "Vincular al estudio",
        search: "Buscar",
        add: "Añadir",
        remove: "Eliminar",
        saveReview: "Guardar revisión",
        acceptIntent: "Aceptar intención",
        lockPackage: "Bloquear paquete",
        locked: "Bloqueado",
        downloadPackageSummary: "Descargar resumen del paquete",
      },
      labels: {
        verified: "Verificado",
        needsCheck: "Requiere revisión",
        blocked: "Bloqueado",
        unverified: "Sin verificar",
        reviewQueue: "Cola de revisión",
        conceptSetDraft: "borrador de conjunto de conceptos",
        cohortDraft: "borrador de cohorte",
        concepts: "Conceptos",
        concept: "Concepto",
        domain: "Dominio",
        vocabulary: "Vocabulario",
        flags: "Marcas",
        actions: "Acciones",
        lint: "Validación",
        source: "Fuente",
        status: "Estado",
        cohorts: "Cohortes",
        coverage: "Cobertura",
        domains: "Dominios",
        freshness: "Actualidad",
        dqd: "DQD",
        attrition: "Atrición",
        nativeConceptSet: "Conjunto de conceptos nativo #{{id}}",
        nativeCohort: "Cohorte nativa #{{id}}",
        linkedStudyCohort: "Cohorte de estudio vinculada #{{id}}",
        conceptsCount: "{{count}} conceptos",
        conceptSetsCount: "{{count}} conjuntos de conceptos",
        nativeAnalysis: "Análisis nativo #{{id}}",
        feasibility: "Factibilidad",
        rank: "Rango {{score}}",
        match: "{{score}}% de coincidencia",
        ohdsiId: "OHDSI #{{id}}",
        computable: "Computable",
        imported: "Importado",
        evidence: "Evidencia",
        origin: "Origen",
        matchedTerm: "Término coincidente",
        canonicalRecord: "Registro canónico",
        noCanonicalRecord: "Sin registro canónico",
        eligibility: "Elegibilidad",
        acceptable: "Aceptable",
        blockedOrNeedsReview: "Bloqueado o requiere revisión",
        policy: "Política",
        nextActions: "Siguientes acciones",
        rankComponents: "Componentes de rango",
        verifierChecks: "Validaciones del verificador",
        versionStatus: "Versión {{version}} · {{status}}",
        primaryObjective: "Objetivo primario",
        population: "Población",
        exposure: "Exposición",
        comparator: "Comparador",
        primaryOutcome: "Resultado primario",
        timeAtRisk: "Tiempo en riesgo",
        conceptSetsMetric: "Conjuntos de conceptos",
        cohortsMetric: "Cohortes",
        analysesMetric: "Análisis",
        packagesMetric: "Paquetes",
        aiEvents: "Eventos de IA",
        reviewed: "Revisados",
        manifest: "Manifiesto",
        critiques: "Críticas",
      },
      messages: {
        saveOrAcceptBeforeRecommendations:
          "Guarda una intención lista para revisión o acepta la intención antes de solicitar recomendaciones.",
        loadingRecommendations: "Cargando recomendaciones...",
        noRecommendations: "Aún no hay recomendaciones.",
        acceptRecommendationFirst:
          "Acepta primero al menos una recomendación verificada de fenotipo, cohorte o conjunto de conceptos.",
        noConceptSetDrafts: "Aún no hay borradores de conjuntos de conceptos.",
        onlyVerifiedConceptSetDrafts:
          "Solo se pueden aceptar borradores de conjuntos de conceptos verificados.",
        searchConceptsPlaceholder: "Buscar conceptos del vocabulario OMOP",
        materializeConceptSetFirst:
          "Materializa primero al menos un borrador verificado de conjunto de conceptos.",
        noCohortDrafts: "Aún no hay borradores de cohortes.",
        checkingLinkedRoles: "Comprobando roles vinculados...",
        noReadinessSignal: "Aún no hay señal de preparación.",
        ready: "Listo",
        blocked: "Bloqueado",
        drafts: "{{count}} borradores",
        materialized: "{{count}} materializados",
        linked: "{{count}} vinculados",
        linkRequiredCohorts:
          "Vincula las cohortes requeridas del estudio antes de evaluar factibilidad por fuente.",
        loadingSources: "Cargando fuentes...",
        noSources: "No hay fuentes CDM configuradas.",
        smallCellThreshold: "Umbral de celda pequeña",
        sourcesReady: "{{ready}}/{{total}} fuentes listas",
        ranAt: "Ejecutado {{time}}",
        noDates: "Sin fechas",
        none: "ninguno",
        roles: "{{ready}}/{{total}} roles",
        unknown: "Desconocido",
        noDqd: "Sin DQD",
        passRate: "{{rate}}% aprobado",
        noFeasibilityEvidence:
          "No hay evidencia de factibilidad almacenada para esta versión de diseño.",
        runFeasibilityBeforePlans:
          "Ejecuta factibilidad por fuente antes de crear planes de análisis.",
        noAnalysisPlans: "Aún no hay planes de análisis.",
        feasibilityStatus: "Factibilidad: {{status}}",
        checkingPackageReadiness: "Comprobando preparación del paquete...",
        readyToLock: "Listo para bloquear.",
        lockedPackageAvailable:
          "El paquete bloqueado está disponible en los artefactos del estudio.",
        signed: "firmado",
        pending: "pendiente",
        onlyVerifiedRecommendations:
          "Solo se pueden aceptar recomendaciones verificadas de forma determinista.",
      },
    },

  },
  administration: {
    dashboard: {
      title: "Administración",
      subtitle: "Gestiona usuarios, roles, permisos y configuración del sistema.",
      panels: {
        platform: "Plataforma",
        usersAccess: "Usuarios y acceso",
        dataSources: "Fuentes de datos",
        aiResearch: "IA e investigación",
      },
      status: {
        allHealthy: "Todo saludable",
        degraded: "Degradado",
        warning: "Advertencia",
      },
      labels: {
        services: "Servicios",
        queue: "Cola",
        redis: "Redis",
        totalUsers: "Usuarios totales",
        roles: "Roles",
        authProviders: "Proveedores de autenticación",
        tokenExpiry: "Caducidad del token",
        solr: "Solr",
        aiProvider: "Proveedor de IA",
        model: "Modelo",
        abby: "Abby",
        researchRuntime: "R / HADES",
      },
      values: {
        servicesUp: "{{healthy}}/{{total}} activos",
        queueSummary: "{{pending}} pendientes / {{failed}} fallidos",
        enabledCount: "{{count}} habilitados",
        tokenExpiry: "8 h",
        cdmCount: "{{count}} CDM",
        solrSummary: "{{docs}} docs / {{cores}} núcleos",
        none: "Ninguno",
        online: "En línea",
      },
      messages: {
        noCdmSources: "No hay fuentes CDM configuradas",
      },
      nav: {
        userManagement: {
          title: "Gestión de usuarios",
          description:
            "Crea, edita y desactiva cuentas de usuario. Asigna roles para controlar el acceso.",
        },
        rolesPermissions: {
          title: "Roles y permisos",
          description:
            "Define roles personalizados y ajusta asignaciones de permisos en todos los dominios.",
        },
        authProviders: {
          title: "Proveedores de autenticación",
          description:
            "Habilita y configura LDAP, OAuth 2.0, SAML 2.0 u OIDC para SSO.",
        },
        aiProviders: {
          title: "Configuración de proveedores de IA",
          description:
            "Cambia el backend de Abby entre Ollama local, Anthropic, OpenAI, Gemini y más.",
        },
        systemHealth: {
          title: "Estado del sistema",
          description:
            "Estado en vivo de los servicios de Parthenon: Redis, IA, Darkstar, Solr, Orthanc PACS y colas de trabajos.",
        },
        vocabularyManagement: {
          title: "Gestión de vocabulario",
          description:
            "Actualiza tablas de vocabulario OMOP cargando un nuevo archivo ZIP de Athena.",
        },
        fhirConnections: {
          title: "Conexiones FHIR EHR",
          description:
            "Gestiona conexiones FHIR R4 a Epic, Cerner y otros sistemas EHR para importación masiva de datos.",
        },
      },
      setupWizard: {
        title: "Asistente de configuración de la plataforma",
        description:
          "Vuelve a ejecutar la configuración guiada: estado, proveedor de IA, autenticación y fuentes de datos.",
      },
      atlasMigration: {
        title: "Migrar desde Atlas",
        description:
          "Importa definiciones de cohortes, conjuntos de conceptos y análisis desde una instalación OHDSI Atlas existente.",
      },
      actions: {
        open: "Abrir",
        openWizard: "Abrir asistente",
      },
    },
    acropolisServices: {
      descriptions: {
        authentik: "Proveedor de identidad y portal de acceso",
        wazuh: "Panel de monitoreo de seguridad y SIEM",
        grafana: "Paneles de métricas y observabilidad",
        portainer: "Operaciones de contenedores y stacks",
        pgadmin: "Consola de administración de PostgreSQL",
        n8n: "Orquestación y automatización de flujos de trabajo",
        superset: "Espacio de BI y analítica ad hoc",
        datahub: "Catálogo de metadatos y explorador de linaje",
      },
      openService: "Abrir servicio",
    },
    grafana: {
      openDashboard: "Abrir panel",
    },
    broadcastEmail: {
      title: "Correo masivo",
      descriptionPrefix: "Esto enviará un correo individual a cada uno de los",
      descriptionSuffix: "usuarios registrados.",
      subject: "Asunto",
      subjectPlaceholder: "Línea de asunto del correo...",
      message: "Mensaje",
      messagePlaceholder: "Escribe tu mensaje aquí...",
      close: "Cerrar",
      cancel: "Cancelar",
      sending: "Enviando...",
      sendToAll: "Enviar a todos los usuarios",
      resultWithRecipients: "{{message}} ({{count}} destinatarios)",
      unknownError: "Error desconocido",
    },
    userModal: {
      titles: {
        editUser: "Editar usuario",
        newUser: "Nuevo usuario",
      },
      fields: {
        fullName: "Nombre completo",
        email: "Correo",
        password: "Contraseña",
        roles: "Roles",
      },
      hints: {
        keepCurrentPassword: "(deja en blanco para conservar la actual)",
      },
      placeholders: {
        maskedPassword: "••••••••",
        passwordRequirements:
          "Mínimo 8 caracteres, mayúsculas/minúsculas y número",
      },
      actions: {
        cancel: "Cancelar",
        saving: "Guardando...",
        saveChanges: "Guardar cambios",
        createUser: "Crear usuario",
      },
      errors: {
        generic: "Ocurrió un error.",
        passwordRequired: "La contraseña es obligatoria.",
      },
    },
    liveKit: {
      loadingConfiguration: "Cargando configuración...",
      provider: "Proveedor",
      providerBadges: {
        cloud: "Nube",
        "self-hosted": "Autoalojado",
        env: "Entorno",
      },
      providerOptions: {
        environment: "Entorno",
        liveKitCloud: "LiveKit Cloud",
        selfHosted: "Autoalojado",
      },
      providerDescriptions: {
        useEnvFile: "Usar archivo .env",
        hostedByLiveKit: "Alojado por LiveKit",
        yourOwnServer: "Tu propio servidor",
      },
      env: {
        usingEnvConfiguration: "Usando configuración .env",
        url: "URL:",
        apiKey: "Clave API:",
        apiSecret: "Secreto API:",
        notSet: "No configurado",
        missing: "Falta",
        editPrefix: "Edita",
        editSuffix: "y reinicia PHP para cambiar.",
      },
      fields: {
        cloudUrl: "URL de LiveKit Cloud",
        serverUrl: "URL del servidor",
        apiKey: "Clave API",
        apiSecret: "Secreto API",
      },
      placeholders: {
        savedKey: "Guardada; introduce una clave nueva para reemplazarla",
        savedSecret: "Guardado; introduce un secreto nuevo para reemplazarlo",
        enterApiKey: "Introduce la clave API",
        enterApiSecret: "Introduce el secreto API",
      },
      actions: {
        hideConfiguration: "Ocultar configuración",
        configureLiveKit: "Configurar LiveKit",
        testConnection: "Probar conexión",
        saveConfiguration: "Guardar configuración",
        useEnvDefaults: "Usar valores .env",
      },
      toasts: {
        noUrlToTest: "No hay URL para probar",
        connectionSuccessful: "Conexión correcta",
        connectionFailed: "Conexión fallida",
        configurationSaved: "Configuración de LiveKit guardada",
        saveFailed: "No se pudo guardar la configuración",
      },
    },
    authProviders: {
      title: "Proveedores de autenticación",
      subtitle:
        "Habilita uno o más proveedores de identidad externos para inicio de sesión único. El usuario y contraseña de Sanctum siempre están disponibles como alternativa.",
      providers: {
        ldap: {
          label: "LDAP / Active Directory",
          description:
            "Autentica contra Microsoft Active Directory o cualquier directorio LDAP v3. Admite TLS, sincronización de grupos y mapeo de atributos.",
        },
        oauth2: {
          label: "OAuth 2.0",
          description:
            "Delega la autenticación en GitHub, Google, Microsoft o cualquier proveedor OAuth 2.0 personalizado.",
        },
        saml2: {
          label: "SAML 2.0",
          description:
            "SSO empresarial mediante un proveedor de identidad SAML 2.0 (Okta, Azure AD, ADFS, etc.).",
        },
        oidc: {
          label: "OpenID Connect",
          description:
            "SSO moderno mediante descubrimiento OIDC. Admite PKCE y cualquier IdP compatible con estándares.",
        },
      },
      enabled: "Habilitado",
      disabled: "Deshabilitado",
      configure: "Configurar",
      testConnection: "Probar conexión",
      connectionSuccessful: "Conexión correcta",
      connectionFailed: "Conexión fallida",
      usernamePassword: "Usuario y contraseña",
      alwaysOn: "Siempre activo",
      builtIn: "Autenticación Sanctum integrada - siempre activa.",
      loading: "Cargando proveedores...",
      formActions: {
        saving: "Guardando...",
        save: "Guardar",
        saved: "Guardado",
      },
      oauthForm: {
        drivers: {
          github: "GitHub",
          google: "Google",
          microsoft: "Microsoft / Azure AD",
          custom: "OAuth 2.0 personalizado",
        },
        sections: {
          customEndpoints: "Endpoints personalizados",
        },
        labels: {
          provider: "Proveedor",
          clientId: "ID de cliente",
          clientSecret: "Secreto de cliente",
          redirectUri: "URI de redirección",
          scopes: "Alcances",
          authorizationUrl: "URL de autorización",
          tokenUrl: "URL de token",
          userInfoUrl: "URL de información de usuario",
        },
        hints: {
          redirectUri: "Debe coincidir con el URI registrado en tu proveedor OAuth",
          scopes: "Lista separada por espacios",
        },
        placeholders: {
          clientId: "ID de cliente / aplicación",
          redirectUri: "/api/v1/auth/oauth2/callback",
          scopes: "openid profile email",
        },
      },
      oidcForm: {
        labels: {
          discoveryUrl: "URL de descubrimiento",
          clientId: "ID de cliente",
          clientSecret: "Secreto de cliente",
          redirectUri: "URI de redirección",
          scopes: "Alcances",
          pkceEnabled:
            "Habilitar PKCE (recomendado - requiere cliente público)",
        },
        hints: {
          discoveryUrl:
            "El endpoint /.well-known/openid-configuration de tu IdP",
          redirectUri: "Debe coincidir con lo registrado en tu IdP",
          scopes: "Separados por espacios",
        },
        placeholders: {
          discoveryUrl:
            "https://accounts.google.com/.well-known/openid-configuration",
          clientId: "tu-id-de-cliente",
          redirectUri: "/api/v1/auth/oidc/callback",
          scopes: "openid profile email",
        },
      },
      samlForm: {
        sections: {
          identityProvider: "Proveedor de identidad (IdP)",
          serviceProvider: "Proveedor de servicio (SP)",
          attributeMapping: "Mapeo de atributos",
        },
        labels: {
          idpEntityId: "ID de entidad IdP",
          ssoUrl: "URL SSO",
          sloUrl: "URL SLO",
          idpCertificate: "Certificado IdP",
          spEntityId: "ID de entidad SP",
          acsUrl: "URL ACS",
          nameIdFormat: "Formato NameID",
          signAssertions:
            "Firmar aserciones (requiere clave privada SP - configurar en el entorno del servidor)",
          emailAttribute: "Atributo de correo",
          displayNameAttribute: "Atributo de nombre visible",
        },
        hints: {
          ssoUrl: "Endpoint de inicio de sesión único",
          sloUrl: "Endpoint de cierre de sesión único (opcional)",
          idpCertificate:
            "Pega el certificado X.509 (formato PEM, con o sin encabezados)",
          spEntityId:
            "URL de tu instancia de Parthenon - debe coincidir con lo registrado en el IdP",
          acsUrl: "Servicio consumidor de aserciones",
        },
        placeholders: {
          certificate:
            "-----BEGIN CERTIFICATE-----\nMIIDxTCC...\n-----END CERTIFICATE-----",
          acsUrl: "/api/v1/auth/saml2/callback",
          sloUrl: "/api/v1/auth/saml2/logout",
          displayName: "displayName",
        },
        attributeMappingDescription:
          "Mapea nombres de atributos de aserción SAML a campos de usuario de Parthenon.",
      },
      ldapForm: {
        sections: {
          connection: "Conexión",
          bindCredentials: "Credenciales de enlace",
          userSearch: "Búsqueda de usuarios",
          attributeMapping: "Mapeo de atributos",
          groupSync: "Sincronización de grupos",
        },
        labels: {
          host: "Host",
          port: "Puerto",
          useSsl: "Usar SSL (LDAPS)",
          useTls: "Usar StartTLS",
          timeout: "Tiempo de espera (s)",
          bindDn: "DN de enlace",
          bindPassword: "Contraseña de enlace",
          baseDn: "DN base",
          userSearchBase: "Base de búsqueda de usuarios",
          userFilter: "Filtro de usuario",
          usernameField: "Campo de usuario",
          emailField: "Campo de correo",
          displayNameField: "Campo de nombre visible",
          syncGroups: "Sincronizar grupos LDAP con roles de Parthenon",
          groupSearchBase: "Base de búsqueda de grupos",
          groupFilter: "Filtro de grupo",
        },
        hints: {
          host: "Nombre de host o IP del servidor LDAP",
          bindDn: "DN de cuenta de servicio usado para consultas de directorio",
          userFilter: "{username} se reemplaza al iniciar sesión",
        },
        placeholders: {
          bindDn: "cn=svc-parthenon,dc=example,dc=com",
          baseDn: "dc=example,dc=com",
          userSearchBase: "ou=users,dc=example,dc=com",
          userFilter: "(uid={username})",
          groupSearchBase: "ou=groups,dc=example,dc=com",
          groupFilter: "(objectClass=groupOfNames)",
        },
        actions: {
          saving: "Guardando...",
          save: "Guardar",
          saved: "Guardado",
        },
      },
    },
    roles: {
      title: "Roles y permisos",
      subtitle:
        "Define roles personalizados y ajusta asignaciones de permisos. Usa la matriz para ediciones masivas.",
      tabs: {
        roleList: "Lista de roles",
        permissionMatrix: "Matriz de permisos",
      },
      permissionMatrix: {
        instructions:
          "Haz clic en celdas para alternar permisos · encabezados de fila para aplicar a todos los roles · encabezados de columna para conceder/revocar todo en un rol.",
        saveAllChangesOne: "Guardar todos los cambios ({{count}} rol)",
        saveAllChangesOther: "Guardar todos los cambios ({{count}} roles)",
        permission: "Permiso",
        columnTitle: "Alternar todos los permisos para {{role}}",
        permissionCount: "{{count}} permisos",
        saving: "guardando...",
        saved: "guardado ✓",
        save: "guardar",
        domainTitle:
          "Alternar todos los permisos de {{domain}} en todos los roles",
        rowTitle: "Alternar {{permission}} para todos los roles",
        cellTitleGrant: "Conceder {{permission}} a {{role}}",
        cellTitleRevoke: "Revocar {{permission}} de {{role}}",
      },
      editor: {
        roleName: "Nombre del rol",
        roleNamePlaceholder: "p. ej., coordinador-sitio",
        permissions: "Permisos",
        selectedCount: "({{count}} seleccionados)",
      },
      actions: {
        newRole: "Nuevo rol",
        cancel: "Cancelar",
        saving: "Guardando...",
        saveRole: "Guardar rol",
        editRole: "Editar rol",
        deleteRole: "Eliminar rol",
        deleting: "Eliminando...",
        delete: "Eliminar",
      },
      values: {
        builtIn: "integrado",
        userCountOne: "{{count}} usuario",
        userCountOther: "{{count}} usuarios",
        permissionCountOne: "{{count}} permiso",
        permissionCountOther: "{{count}} permisos",
        more: "+{{count}} más",
      },
      deleteModal: {
        title: "¿Eliminar rol?",
        prefix: "El rol",
        suffix:
          "se eliminará permanentemente. Los usuarios asignados solo a este rol perderán todos los permisos.",
      },
    },
    pacs: {
      studyBrowser: {
        browseTitle: "Explorar: {{name}}",
        filters: {
          patientName: "Nombre del paciente",
          patientId: "ID del paciente",
          allModalities: "Todas las modalidades",
        },
        empty: {
          noStudies: "No se encontraron estudios",
        },
        table: {
          patientName: "Nombre del paciente",
          patientId: "ID del paciente",
          date: "Fecha",
          modality: "Modalidad",
          description: "Descripción",
          series: "Series",
          instances: "Inst.",
        },
        pagination: {
          range: "{{start}}-{{end}}",
          ofStudies: "de {{total}} estudios",
          previous: "Anterior",
          next: "Siguiente",
        },
      },
      connectionCard: {
        defaultConnection: "Conexión predeterminada",
        setAsDefault: "Establecer como predeterminada",
        deleteConfirm: "¿Eliminar \"{{name}}\"?",
        never: "Nunca",
        seriesByModality: "Series por modalidad",
        statsUpdated: "Estadísticas actualizadas {{date}}",
        stats: {
          patients: "Pacientes",
          studies: "Estudios",
          series: "Series",
          instances: "Instancias",
          disk: "Disco",
        },
        actions: {
          edit: "Editar",
          delete: "Eliminar",
          test: "Probar",
          stats: "Estadísticas",
          browse: "Explorar",
        },
      },
    },
    solrAdmin: {
      title: "Administración de búsqueda Solr",
      subtitle:
        "Gestiona núcleos de búsqueda Solr, lanza reindexaciones y monitorea el estado.",
      loadingCoreStatus: "Cargando estado de núcleos...",
      status: {
        healthy: "Saludable",
        unavailable: "No disponible",
      },
      labels: {
        documents: "Documentos",
        lastIndexed: "Última indexación",
        duration: "Duración",
      },
      values: {
        never: "Nunca",
        seconds: "{{seconds}} s",
      },
      actions: {
        reindexAll: "Reindexar todos los núcleos",
        reindex: "Reindexar",
        fullReindex: "Reindexación completa",
        clear: "Vaciar",
      },
      messages: {
        fetchFailed: "No se pudo obtener el estado de Solr",
        reindexCompleted: "Reindexación de '{{core}}' completada",
        reindexFailed: "No se pudo reindexar '{{core}}'",
        reindexAllCompleted: "Reindexación completa de todos los núcleos",
        reindexAllFailed: "No se pudieron reindexar todos los núcleos",
        clearConfirm:
          "¿Seguro que quieres eliminar todos los documentos de '{{core}}'? Esta acción no se puede deshacer.",
        clearCompleted: "Núcleo '{{core}}' vaciado",
        clearFailed: "No se pudo vaciar '{{core}}'",
      },
    },
    aiProviders: {
      title: "Configuración de proveedores de IA",
      subtitle:
        "Elige qué backend de IA impulsa a Abby. Solo un proveedor puede estar activo a la vez. Las claves API se almacenan cifradas.",
      activeProvider: "Proveedor activo:",
      fields: {
        model: "Modelo",
        apiKey: "Clave API",
        ollamaBaseUrl: "URL base de Ollama",
      },
      placeholders: {
        modelName: "Nombre del modelo",
      },
      values: {
        active: "Activo",
        enabled: "Habilitado",
        disabled: "Deshabilitado",
        noModelSelected: "Ningún modelo seleccionado",
      },
      actions: {
        currentlyActive: "Activo actualmente",
        setAsActive: "Establecer como activo",
        save: "Guardar",
        testConnection: "Probar conexión",
      },
      messages: {
        requestFailed: "La solicitud falló.",
      },
    },
    gisImport: {
      steps: {
        upload: "Cargar",
        analyze: "Analizar",
        mapColumns: "Mapear columnas",
        configure: "Configurar",
        validate: "Validar",
        import: "Importar",
      },
      analyze: {
        analysisFailed: "Abby encontró un problema al analizar este archivo.",
        unknownError: "Error desconocido",
        retry: "Reintentar",
        analyzing: "Abby está analizando tus datos...",
        detecting:
          "Detectando tipos de columna, códigos geográficos y semántica de valores",
      },
      upload: {
        uploading: "Cargando...",
        dropPrompt: "Suelta un archivo aquí o haz clic para explorar",
        acceptedFormats:
          "CSV, TSV, Excel, Shapefile (.zip), GeoJSON, KML, GeoPackage - máximo {{maxSize}} MB",
        largeFiles: "Para archivos grandes (> {{maxSize}} MB)",
        fileTooLarge:
          "El archivo supera {{maxSize}} MB. Usa CLI: php artisan gis:import {{filename}}",
        uploadFailed: "La carga falló",
      },
      configure: {
        fields: {
          layerName: "Nombre de capa",
          exposureType: "Tipo de exposición",
          geographyLevel: "Nivel geográfico",
          valueType: "Tipo de valor",
          aggregation: "Agregación",
        },
        placeholders: {
          layerName: "p. ej., Índice de vulnerabilidad social",
          exposureType: "p. ej., svi_overall",
        },
        geographyLevels: {
          county: "Condado",
          tract: "Tracto censal",
          state: "Estado",
          country: "País",
          custom: "Personalizado",
        },
        valueTypes: {
          continuous: "Continuo (coropleta)",
          categorical: "Categórico (colores discretos)",
          binary: "Binario (presencia/ausencia)",
        },
        aggregations: {
          mean: "Media",
          sum: "Suma",
          maximum: "Máximo",
          minimum: "Mínimo",
          latest: "Más reciente",
        },
        saving: "Guardando...",
        continue: "Continuar",
      },
      mapping: {
        title: "Mapeo de columnas",
        subtitle: "Mapea cada columna de origen con su propósito",
        purposes: {
          geographyCode: "Código geográfico",
          geographyName: "Nombre geográfico",
          latitude: "Latitud",
          longitude: "Longitud",
          valueMetric: "Valor (métrica)",
          metadata: "Metadatos",
          skip: "Omitir",
        },
        confidence: {
          high: "Alta",
          medium: "Media",
          low: "Baja",
        },
        askAbby: "Preguntar a Abby",
        abbyOnColumn: "Abby sobre \"{{column}}\":",
        thinking: "Pensando...",
        saving: "Guardando...",
        continue: "Continuar",
      },
      validate: {
        validating: "Validando...",
        validationFailed: "La validación falló:",
        unknownError: "Error desconocido",
        results: "Resultados de validación",
        stats: {
          totalRows: "Filas totales",
          uniqueGeographies: "Geografías únicas",
          matched: "Coincidentes",
          unmatched: "Sin coincidencia (stubs)",
          matchRate: "Tasa de coincidencia",
          geographyType: "Tipo de geografía",
        },
        unmatchedWarning:
          "{{count}} geografías no se encontraron en la base de datos. Se crearán entradas stub (sin geometría de límites).",
        backToMapping: "Volver al mapeo",
        proceedWithImport: "Continuar con importación",
      },
      import: {
        starting: "Iniciando...",
        startImport: "Iniciar importación",
        importing: "Importando... {{progress}}%",
        complete: "Importación completa",
        rowsImported: "{{count}} filas importadas",
        saveLearningPrompt: "Guardar mapeos para que Abby aprenda para la próxima vez",
        saveToAbby: "Guardar en Abby",
        viewInGisExplorer: "Ver en el explorador GIS",
        importAnother: "Importar otro",
        failed: "Importación fallida",
        startOver: "Empezar de nuevo",
      },
    },
    chromaStudio: {
      title: "Estudio de colecciones Chroma",
      subtitle:
        "Inspecciona colecciones vectoriales, ejecuta consultas semánticas y gestiona la ingesta",
      values: {
        collectionCount: "{{count}} colecciones",
        loading: "cargando",
        loadingEllipsis: "Cargando...",
        countSuffix: "({{count}})",
        sampledSuffix: "({{count}} muestreados)",
      },
      actions: {
        refreshCollections: "Actualizar colecciones",
        ingestDocs: "Ingerir docs",
        ingestClinical: "Ingerir datos clínicos",
        promoteFaq: "Promover FAQ",
        ingestOhdsiPapers: "Ingerir artículos OHDSI",
        ingestOhdsiKnowledge: "Ingerir conocimiento OHDSI",
        ingestTextbooks: "Ingerir libros de texto",
      },
      stats: {
        vectors: "Vectores",
        sampled: "Muestreados",
        dimensions: "Dimensiones",
        metaFields: "Campos meta",
      },
      messages: {
        loadingCollectionData: "Cargando datos de la colección...",
      },
      empty: {
        title: "Esta colección está vacía",
        description:
          "Usa las acciones de ingesta de arriba para poblar \"{{collection}}\" con documentos.",
        noRecords: "No hay registros en esta colección.",
        noDocumentReturned: "No se devolvió ningún documento.",
        noDocumentText: "No hay texto de documento disponible.",
      },
      tabs: {
        overview: "Resumen",
        retrieval: "Recuperación",
      },
      search: {
        placeholder: "Consulta semántica...",
        recentQueries: "Consultas recientes",
        kLabel: "K:",
        queryAction: "Consultar",
        empty:
          "Ingresa una consulta arriba y haz clic en Consultar para inspeccionar resultados de recuperación.",
        queryLabel: "Consulta:",
        resultsCount: "{{count}} resultados",
        querying: "Consultando...",
        distance: "distancia",
      },
      overview: {
        facetDistribution: "Distribución de facetas",
        sampleRecords: "Registros de muestra",
        collectionMetadata: "Metadatos de la colección",
      },
    },
    vectorExplorer: {
      title: "Explorador vectorial",
      semanticMapTitle: "Mapa semántico {{dimensions}}D",
      loading: {
        computingProjection: "Calculando proyección",
        runningProjection: "Ejecutando PCA->UMAP en {{sample}} vectores...",
        recomputingProjection: "Recalculando proyección...",
      },
      values: {
        all: "todos",
        loadingEllipsis: "Cargando...",
        countSuffix: "({{count}})",
        sampled: "{{count}} muestreados",
        dimensions: "{{dimensions}}D",
        knnEdges: "k={{neighbors}} - {{edges}} aristas",
        seconds: "{{seconds}} s",
        points: "{{count}} pts",
        cachedSuffix: " - en caché",
        fallbackSuffix: " - alternativo",
        timeSuffix: " - {{seconds}} s",
      },
      modes: {
        clusters: "Clústeres",
        query: "Consulta",
        qa: "QA",
      },
      sample: {
        label: "Muestra",
        confirmLoadAll:
          "¿Cargar los {{count}} vectores? Puede tardar bastante más.",
        steps: {
          all: "Todos",
        },
      },
      empty: {
        selectCollection: "Selecciona una colección para visualizar embeddings.",
      },
      tooltips: {
        requiresAiService: "Requiere conexión al servicio de IA",
      },
      controls: {
        colorBy: "Colorear por",
        modeDefault: "Predeterminado del modo",
      },
      search: {
        placeholder: "Buscar dentro del espacio vectorial",
        searching: "Buscando...",
        search: "Buscar",
        visibleResults:
          "{{visible}} de {{total}} resultados visibles en esta proyección",
      },
      query: {
        anchor: "Ancla de consulta",
      },
      sections: {
        overlays: "Capas",
        clusterProfile: "Perfil de clúster",
        inspector: "Inspector",
      },
      inspector: {
        selectPoint: "Haz clic en un punto para inspeccionarlo.",
        loadingDetails: "Cargando detalles completos...",
        flags: {
          outlier: "Atípico",
          duplicate: "Duplicado",
          orphan: "Huérfano",
        },
      },
      overlays: {
        clusterHulls: {
          label: "Envolventes de clúster",
          help: "Envolventes convexas alrededor de los clústeres",
        },
        topologyLines: {
          label: "Líneas de topología",
          help: "Enlaces k-NN entre puntos cercanos",
        },
        queryRays: {
          label: "Rayos de consulta",
          help: "Enlaces de similitud entre ancla y resultado",
        },
      },
      stats: {
        totalVectors: "Vectores totales",
        sampled: "Muestreados",
        projection: "Proyección",
        knnGraph: "Grafo k-NN",
        source: "Fuente",
        projectionTime: "Tiempo de proyección",
        indexed: "Indexado",
      },
      sources: {
        solrCached: "Solr (en caché)",
        clientFallback: "Alternativa del cliente",
        liveUmap: "UMAP en vivo",
      },
      actions: {
        recomputeProjection: "Recalcular proyección",
        expand: "Expandir",
      },
      legend: {
        clusters: "Clústeres",
        quality: "Calidad",
        similarity: "Similitud",
        hide: "Ocultar",
        show: "Mostrar",
      },
      quality: {
        outliers: "Atípicos",
        duplicates: "Duplicados",
        duplicatePairs: "Pares duplicados",
        orphans: "Huérfanos",
        normal: "Normal",
        outOfSampled: "de {{count}} muestreados",
        exportCsv: "Exportar CSV",
      },
      clusterProfile: {
        selectCluster: "Selecciona un clúster para inspeccionar sus metadatos dominantes.",
        clusterSize: "Tamaño del clúster",
        dominantMetadata: "Metadatos dominantes",
        representativeTitles: "Títulos representativos",
      },
    },
    pacsConnectionModal: {
      title: {
        add: "Agregar conexión PACS",
        edit: "Editar conexión PACS",
      },
      description: "Configura una conexión a servidor de imágenes DICOM.",
      fields: {
        name: "Nombre",
        type: "Tipo",
        authType: "Tipo de autenticación",
        baseUrl: "URL base",
        username: "Usuario",
        password: "Contraseña",
        bearerToken: "Token Bearer",
        linkedSource: "Fuente vinculada (opcional)",
        active: "Activa",
      },
      placeholders: {
        name: "Servidor PACS principal",
        keepExisting: "Deja en blanco para mantener el existente",
        password: "contraseña",
        token: "token",
      },
      types: {
        orthanc: "Orthanc",
        dicomweb: "DICOMweb",
        googleHealthcare: "Google Healthcare",
        cloud: "Nube",
      },
      auth: {
        none: "Ninguna",
        basic: "Autenticación básica",
        bearer: "Token Bearer",
      },
      values: {
        latency: "({{ms}} ms)",
      },
      actions: {
        testConnection: "Probar conexión",
        cancel: "Cancelar",
        saveChanges: "Guardar cambios",
        createConnection: "Crear conexión",
      },
      errors: {
        testRequestFailed: "La solicitud de prueba falló",
        saveFailed: "No se pudo guardar la conexión",
      },
    },
    users: {
      title: "Usuarios",
      summary: {
        totalAccounts: "cuentas totales",
      },
      empty: {
        loading: "Cargando...",
        noUsers: "No se encontraron usuarios",
        adjustFilters: "Prueba ajustar tu búsqueda o filtros.",
      },
      deleteModal: {
        title: "¿Eliminar usuario?",
        description:
          "se eliminará permanentemente y todos sus tokens de API serán revocados.",
        irreversible: "Esto no se puede deshacer.",
      },
      actions: {
        cancel: "Cancelar",
        deleting: "Eliminando...",
        delete: "Eliminar",
        adminEmailer: "Correo administrativo",
        newUser: "Nuevo usuario",
        editUser: "Editar usuario",
        deleteUser: "Eliminar usuario",
      },
      filters: {
        searchPlaceholder: "Buscar nombre o correo...",
        allRoles: "Todos los roles",
      },
      table: {
        name: "Nombre",
        email: "Correo",
        lastActive: "Última actividad",
        joined: "Ingreso",
        roles: "Roles",
      },
      values: {
        never: "Nunca",
      },
      pagination: {
        page: "Página",
        of: "de",
        users: "usuarios",
      },
    },
    userAudit: {
      title: "Registro de auditoría de usuarios",
      subtitle:
        "Rastrea inicios de sesión, acceso a funciones y acciones de seguridad de todos los usuarios.",
      actions: {
        login: "Inicio de sesión",
        logout: "Cierre de sesión",
        passwordChanged: "Contraseña cambiada",
        passwordReset: "Restablecimiento de contraseña",
        featureAccess: "Acceso a función",
      },
      empty: {
        noMatching: "No hay eventos coincidentes",
        noEvents: "Aún no hay eventos de auditoría",
        adjustFilters: "Prueba ajustar tus filtros o rango de fechas.",
        description:
          "Los eventos de auditoría se registran cuando los usuarios inician sesión y acceden a funciones de la plataforma.",
      },
      stats: {
        loginsToday: "Inicios de sesión hoy",
        activeUsers7d: "Usuarios activos (7 d)",
        totalEvents: "Eventos totales",
        topFeature: "Función principal",
      },
      sections: {
        mostAccessedFeatures: "Funciones más accedidas - últimos 7 días",
      },
      filters: {
        searchPlaceholder: "Buscar usuario, función, IP...",
        allActions: "Todas las acciones",
        clearAll: "Limpiar todo",
      },
      table: {
        time: "Hora",
        user: "Usuario",
        action: "Acción",
        feature: "Función",
        ipAddress: "Dirección IP",
      },
      pagination: {
        page: "Página",
        of: "de",
        events: "eventos",
      },
    },
    serviceDetail: {
      actions: {
        backToSystemHealth: "Volver al estado del sistema",
        systemHealth: "Estado del sistema",
        refresh: "Actualizar",
        manageSolrCores: "Gestionar núcleos Solr",
      },
      empty: {
        serviceNotFound: "Servicio no encontrado.",
        noLogs: "No hay entradas recientes de log disponibles.",
      },
      values: {
        checkedAt: "Comprobado a las {{time}}",
        entriesCount: "({{count}} entradas)",
        yes: "Sí",
        no: "No",
      },
      sections: {
        metrics: "Métricas",
        recentLogs: "Logs recientes",
      },
      pacs: {
        title: "Conexiones PACS",
        addConnection: "Agregar conexión",
        empty: "No hay conexiones PACS configuradas.",
      },
      darkstar: {
        ohdsiPackages: "Paquetes OHDSI HADES",
        positPackages: "Paquetes Posit / CRAN",
        installedCount: "({{count}} instalados)",
      },
    },
    atlasMigration: {
      steps: {
        connect: "Conectar",
        discover: "Descubrir",
        select: "Seleccionar",
        import: "Importar",
        summary: "Resumen",
      },
      entityTypes: {
        conceptSets: "Conjuntos de conceptos",
        cohortDefinitions: "Definiciones de cohortes",
        incidenceRates: "Tasas de incidencia",
        characterizations: "Caracterizaciones",
        pathways: "Rutas",
        estimations: "Estimaciones",
        predictions: "Predicciones",
      },
      connect: {
        title: "Conectar a Atlas WebAPI",
        description:
          "Ingresa la URL base de tu instancia OHDSI WebAPI existente. Parthenon se conectará e inventariará todas las entidades disponibles para migración.",
        webapiUrl: "URL base de WebAPI",
        authentication: "Autenticación",
        auth: {
          none: "Ninguna (WebAPI pública)",
          basic: "Autenticación básica",
          bearer: "Token Bearer",
        },
        credentials: "Credenciales (usuario:contraseña)",
        bearerToken: "Token Bearer",
        testConnection: "Probar conexión",
        webapiVersion: "Versión de WebAPI: {{version}}",
      },
      discover: {
        discovering: "Descubriendo entidades...",
        querying: "Consultando todos los endpoints de WebAPI en paralelo",
        title: "Inventario de Atlas",
        summary:
          "Se encontraron {{count}} entidades migrables en {{categories}} categorías.",
        sourcesFound: "También se encontraron {{count}} fuente(s) de datos.",
      },
      select: {
        title: "Seleccionar entidades para migrar",
        description:
          "Elige qué entidades importar. Las dependencias se resuelven automáticamente.",
        analysisWarning:
          "Las entidades de análisis pueden referenciar definiciones de cohortes y conjuntos de conceptos por ID. Parthenon reasignará estas referencias automáticamente durante la importación. Para obtener mejores resultados, incluye las cohortes y conjuntos de conceptos referenciados en tu selección.",
        selectedCount: "{{selected}}/{{total}} seleccionadas",
        totalSelected: "{{count}} entidades seleccionadas para migración",
      },
      import: {
        starting: "Iniciando migración...",
        importing: "Importando entidades...",
        complete: "Migración completa",
        failed: "Migración fallida",
        processed: "Todas las entidades seleccionadas se han procesado.",
        error: "Ocurrió un error durante la migración.",
        percentComplete: "{{percent}}% completo",
        polling: "Consultando actualizaciones...",
      },
      summary: {
        successful: "Migración correcta",
        completedWithWarnings: "Migración completada con advertencias",
        failed: "Migración fallida",
        from: "Desde",
        duration: "Duración: {{duration}}",
      },
      metrics: {
        total: "Total",
        imported: "Importadas",
        skipped: "Omitidas",
        failed: "Fallidas",
      },
      table: {
        entityType: "Tipo de entidad",
        category: "Categoría",
      },
      actions: {
        selectAll: "Seleccionar todo",
        deselectAll: "Deseleccionar todo",
        retryFailed: "Reintentar fallidas ({{count}})",
        done: "Listo",
        closeTitle: "Cerrar - vuelve cuando quieras desde Administración",
        previous: "Anterior",
        startMigration: "Iniciar migración",
        next: "Siguiente",
      },
      errors: {
        connectionFailed: "La conexión falló",
        discoveryFailed: "El descubrimiento falló",
      },
    },
    fhirExport: {
      title: "Exportación FHIR Bulk",
      subtitle:
        "Exporta datos OMOP CDM como archivos NDJSON FHIR R4 para interoperabilidad.",
      comingSoon: "Próximamente",
      description:
        "FHIR Bulk Export ($export) está en desarrollo. Esta función permitirá exportar datos OMOP CDM como archivos NDJSON FHIR R4 para interoperabilidad.",
      backendPending:
        "Los endpoints backend para esta función aún no se han implementado.",
    },
    fhirConnections: {
      title: "Conexiones FHIR EHR",
      subtitle:
        "Configura conexiones SMART Backend Services para extracción FHIR R4 Bulk Data desde Epic, Cerner y otros sistemas EHR.",
      runMetrics: {
        extracted: "Extraídos",
        mapped: "Mapeados",
        written: "Escritos",
        failed: "Fallidos",
        mappingCoverage: "Cobertura de mapeo",
      },
      history: {
        loading: "Cargando historial de sincronización...",
        empty: "Aún no hay ejecuciones de sincronización.",
        status: "Estado",
        started: "Inicio",
        duration: "Duración",
        metrics: "Métricas",
        title: "Historial de sincronización",
      },
      dialog: {
        editTitle: "Editar conexión FHIR",
        addTitle: "Agregar conexión FHIR",
        description:
          "Configura una conexión SMART Backend Services a un endpoint EHR FHIR R4.",
      },
      labels: {
        siteName: "Nombre del sitio",
        siteKey: "Clave del sitio (slug)",
        ehrVendor: "Proveedor EHR",
        fhirBaseUrl: "URL base FHIR",
        tokenEndpoint: "Endpoint de token",
        clientId: "ID de cliente",
        rsaPrivateKey: "Clave privada RSA (PEM)",
        scopes: "Alcances",
        groupId: "ID de grupo (para exportación masiva)",
        exportResourceTypes:
          "Tipos de recursos de exportación (separados por comas, en blanco = todos)",
        active: "Activa",
        incrementalSync: "Sincronización incremental",
      },
      vendors: {
        epic: "Epic",
        cerner: "Cerner (Oracle Health)",
        other: "Otro FHIR R4",
      },
      placeholders: {
        siteName: "Johns Hopkins Epic",
        keepExistingKey: "Dejar en blanco para conservar la clave existente",
        resourceTypes:
          "Patient,Condition,Encounter,MedicationRequest,Observation,Procedure",
      },
      actions: {
        cancel: "Cancelar",
        saveChanges: "Guardar cambios",
        createConnection: "Crear conexión",
        testConnection: "Probar conexión",
        edit: "Editar",
        delete: "Eliminar",
        details: "Detalles",
        syncMonitor: "Monitor de sincronización",
        addConnection: "Agregar conexión",
      },
      messages: {
        failedToSave: "No se pudo guardar",
        failedToStartSync: "No se pudo iniciar la sincronización",
        deleteConfirm: '¿Eliminar "{{name}}"?',
        noConnections: "No hay conexiones FHIR configuradas",
        noConnectionsDescription:
          "Agrega una conexión para comenzar a extraer datos clínicos desde un EHR mediante FHIR R4 Bulk Data.",
      },
      sync: {
        activateFirst: "Activar primero la conexión",
        uploadKeyFirst: "Carga primero una clave privada",
        inProgress: "Sincronización en curso",
        incrementalTitle: "Sincronización incremental (solo datos nuevos)",
        fullSync: "Sincronización completa",
        sync: "Sincronizar",
        incrementalSync: "Sincronización incremental",
        incrementalDescription:
          "Solo datos nuevos o actualizados desde la última sincronización",
        fullDescription: "Descargar todos los datos del EHR",
        forceFullSync: "Forzar sincronización completa",
        forceFullDescription:
          "Volver a descargar todos los datos y deduplicar al escribir",
      },
      values: {
        percent: "{{value}}%",
        byUser: "por {{name}}",
        keyUploaded: "Clave cargada",
        noKey: "Sin clave",
        lastSync: "Última sincronización: {{date}}",
        records: "{{count}} registros",
        testElapsed: "{{message}} ({{elapsed}} ms)",
        allSupported: "Todos compatibles",
        enabled: "Habilitada",
        disabled: "Deshabilitada",
        since: "(desde {{date}})",
        notSet: "No configurado",
        never: "Nunca",
      },
      details: {
        tokenEndpoint: "Endpoint de token:",
        clientId: "ID de cliente:",
        scopes: "Alcances:",
        groupId: "ID de grupo:",
        resourceTypes: "Tipos de recursos:",
        incremental: "Incremental:",
        targetSource: "Fuente destino:",
        syncRuns: "Ejecuciones de sincronización:",
      },
      stats: {
        totalConnections: "Conexiones totales",
        active: "Activas",
        keysConfigured: "Claves configuradas",
        lastSync: "Última sincronización",
      },
    },
    vocabulary: {
      title: "Gestión de vocabulario",
      subtitle:
        "Actualiza tablas de vocabulario OMOP desde un ZIP descargado de Athena.",
      status: {
        pending: "En cola",
        running: "En ejecución",
        completed: "Completado",
        failed: "Fallido",
      },
      log: {
        title: "Registro de importación",
        noOutput: "(aún sin salida)",
      },
      labels: {
        schema: "Esquema:",
        source: "Fuente:",
        rowsLoaded: "Filas cargadas:",
        duration: "Duración:",
        by: "Por:",
        progress: "Progreso",
        optional: "(opcional)",
      },
      values: {
        seconds: "{{value}} s",
      },
      actions: {
        refresh: "Actualizar",
        remove: "Quitar",
        uploading: "Cargando...",
        startImport: "Iniciar importación",
      },
      upload: {
        title: "Cargar ZIP de vocabulario Athena",
        descriptionPrefix: "Descarga un paquete de vocabulario desde",
        descriptionMiddle: "y cárgalo aquí.",
        descriptionSuffix:
          "La importación se ejecuta como trabajo en segundo plano y puede tardar entre 15 y 60 minutos según el tamaño del vocabulario.",
        maxFileSize: "Se admiten archivos de hasta 5 GB",
        dropHere: "Suelta aquí el ZIP de Athena",
        browse: "o haz clic para explorar",
        targetSource: "Fuente CDM destino",
        defaultSchema: "Esquema de vocabulario predeterminado",
        sourceHelpPrefix:
          "Selecciona qué esquema de vocabulario de la fuente se poblará. Si no eliges una fuente, se usa",
        sourceHelpSuffix: "como esquema de conexión predeterminado.",
      },
      instructions: {
        title: "Cómo obtener un ZIP de vocabulario desde Athena",
        signInPrefix: "Visita",
        signInSuffix: "e inicia sesión.",
        selectDomains:
          "Selecciona los dominios y versiones de vocabulario que necesitas (p. ej., SNOMED, RxNorm, LOINC).",
        clickPrefix: "Haz clic en",
        downloadVocabularies: "Download Vocabularies",
        clickSuffix: "- Athena te enviará por correo un enlace de descarga.",
        uploadZip:
          "Descarga el ZIP (normalmente 500 MB-3 GB) y cárgalo abajo.",
      },
      messages: {
        deleteConfirm: "¿Eliminar este registro de importación?",
        uploadFailed: "La carga falló: {{message}}",
        unknownError: "Error desconocido",
        uploadSuccess:
          "ZIP cargado correctamente. El trabajo de importación está en cola; revisa abajo el progreso.",
        importRunning:
          "Hay una importación en ejecución. Las nuevas cargas están deshabilitadas hasta que termine.",
      },
      history: {
        title: "Historial de importaciones",
        loading: "Cargando...",
        empty:
          "Aún no hay importaciones de vocabulario. Carga un ZIP de Athena arriba para empezar.",
      },
    },
    systemHealth: {
      title: "Estado del sistema",
      subtitle:
        "Estado en vivo de todos los servicios de Parthenon. Se actualiza automáticamente cada 30 segundos.",
      serverStatus: "Estado del servidor",
      lastChecked: "Última comprobación a las {{time}}",
      polling: "Consultando servicios...",
      gisDataManagement: "Gestión de datos GIS",
      status: {
        healthy: "Saludable",
        degraded: "Degradado",
        down: "Caído",
      },
      overall: {
        healthy: "Saludable",
        needsAttention: "Requiere atención",
      },
      labels: {
        pending: "Pendientes:",
        failed: "Fallidos:",
        cores: "Núcleos:",
        documents: "Documentos:",
        dagster: "Dagster:",
        graphql: "GraphQL:",
        studies: "Estudios:",
        instances: "Instancias:",
        disk: "Disco:",
      },
      actions: {
        refresh: "Actualizar",
        openService: "Abrir servicio",
        viewDetails: "Ver detalles",
      },
      tiers: {
        corePlatform: "Plataforma central",
        dataSearch: "Datos y búsqueda",
        aiAnalytics: "IA y analítica",
        clinicalServices: "Servicios clínicos",
        monitoringCommunications: "Monitoreo y comunicaciones",
        acropolisInfrastructure: "Infraestructura Acropolis",
        unknown: "Otros servicios",
      },
      hades: {
        title: "Paridad de paquetes OHDSI",
        subtitle:
          "Cobertura de paquetes Darkstar para trabajo nativo de primera clase y compatibilidad.",
        checking: "Comprobando paquetes Darkstar...",
        unavailable: "El inventario de paquetes Darkstar no está disponible.",
        installed: "Instalados:",
        missing: "Faltantes:",
        total: "Total:",
        requiredMissing: "Requeridos faltantes:",
        shinyPolicy: "Política de Shiny legado",
        notExposed: "no expuesto",
        shinyPolicyDescription:
          "Las apps Shiny alojadas, la incrustación por iframe y las rutas de apps aportadas por usuarios están deshabilitadas. Los paquetes OHDSI Shiny permanecen solo como artefactos de compatibilidad en tiempo de ejecución.",
        replacement: "Reemplazo: {{surface}}",
        package: "Paquete",
        capability: "Capacidad",
        priority: "Prioridad",
        surface: "Superficie",
        source: "Fuente",
        runtime: "tiempo de ejecución",
        status: {
          complete: "Completo",
          partial: "Parcial",
        },
      },
    },
    fhirSync: {
      title: "Monitor de sincronización FHIR",
      subtitle:
        "Monitoreo en tiempo real del pipeline ETL en todas las conexiones FHIR",
      status: {
        completed: "Completado",
        running: "En ejecución",
        pending: "Pendiente",
        exporting: "Exportando",
        downloading: "Descargando",
        processing: "Procesando",
        failed: "Fallido",
      },
      timeline: {
        empty: "No hay actividad de sincronización en los últimos 30 días",
        tooltip: "{{date}}: {{completed}} completadas, {{failed}} fallidas",
        hoverSummary: "{{completed}} correctas / {{failed}} fallidas",
      },
      metrics: {
        extracted: "Extraídos",
        mapped: "Mapeados",
        written: "Escritos",
        failed: "Fallidos",
        averageMappingCoverage: "Cobertura promedio de mapeo",
      },
      actions: {
        viewError: "Ver error",
      },
      values: {
        runs: "{{count}} ejecuciones",
        never: "Nunca",
        activeRuns: "{{count}} activas",
        refreshInterval: "Actualiza cada {{seconds}} s",
        allTimeTotals: "Totales históricos",
        lastRuns: "Últimas 20 en todas las conexiones",
      },
      messages: {
        failedToLoad: "No se pudieron cargar los datos del panel.",
        noConnections: "No hay conexiones configuradas",
        noRuns: "Aún no hay ejecuciones de sincronización",
      },
      stats: {
        connections: "Conexiones",
        totalRuns: "Ejecuciones totales",
        completed: "Completadas",
        failed: "Fallidas",
        recordsWritten: "Registros escritos",
        avgCoverage: "Cobertura prom.",
      },
      panels: {
        pipelineThroughput: "Rendimiento del pipeline",
        syncActivity: "Actividad de sincronización (30 días)",
        connectionHealth: "Estado de conexiones",
        recentRuns: "Ejecuciones recientes",
      },
      table: {
        status: "Estado",
        connection: "Conexión",
        started: "Inicio",
        duration: "Duración",
        metrics: "Métricas",
      },
    },
    gisData: {
      title: "Datos de límites GIS",
      subtitle:
        "Gestiona conjuntos de datos de límites geográficos para GIS Explorer",
      status: {
        loaded: "cargado",
        empty: "vacío",
      },
      tabs: {
        boundaries: "Límites",
        dataImport: "Importación de datos",
      },
      messages: {
        checking: "Comprobando datos de límites...",
        noBoundaryData:
          "No hay datos de límites cargados. Selecciona una fuente y niveles abajo para empezar.",
      },
      labels: {
        boundaries: "Límites:",
        countries: "Países:",
      },
      load: {
        title: "Cargar límites",
        adminLevels: "Niveles administrativos a cargar:",
      },
      sources: {
        gadm: {
          name: "GADM v4.1",
          description:
            "Áreas administrativas globales: 356K límites en 6 niveles administrativos",
        },
        geoboundaries: {
          name: "geoBoundaries CGAZ",
          description:
            "Límites simplificados para consistencia cartográfica (ADM0-2)",
        },
      },
      levels: {
        adm0: "Países (ADM0)",
        adm1: "Estados / provincias (ADM1)",
        adm2: "Distritos / condados (ADM2)",
        adm3: "Subdistritos (ADM3)",
      },
      actions: {
        preparing: "Preparando...",
        generateLoadCommand: "Generar comando de carga",
        refreshStats: "Actualizar estadísticas",
        copyToClipboard: "Copiar al portapapeles",
        close: "Cerrar",
      },
      modal: {
        runOnHost: "Ejecutar en el host",
        description:
          "Los datos GIS se cargan directamente en PostgreSQL 17 local. Ejecuta este comando desde la raíz del proyecto:",
        datasetFlagPrefix: "La bandera",
        datasetFlagSuffix:
          "habilita el seguimiento del progreso. Actualiza las estadísticas cuando termine el script.",
      },
      job: {
        title: "Cargando límites GIS",
        description: "Fuente: {{source}} | Niveles: {{levels}}",
      },
      values: {
        all: "todos",
      },
    },
    honestBroker: {
      title: "Intermediario honesto",
      subtitle:
        "Registra participantes de encuesta cegados, vincúlalos con registros OMOP person_id y supervisa el estado de envío sin exponer identidades crudas de encuestados a investigadores.",
      actions: {
        cancel: "Cancelar",
        registerParticipant: "Registrar participante",
        sendInvitation: "Enviar invitación",
        sendInvite: "Enviar invitación",
        refresh: "Actualizar",
        copyLink: "Copiar enlace",
        openSurvey: "Abrir encuesta",
        resend: "Reenviar",
        revoke: "Revocar",
      },
      labels: {
        personId: "ID de persona",
        notes: "Notas",
        participant: "Participante",
        deliveryEmail: "Correo de entrega",
        unknown: "Desconocido",
        unknownInstrument: "Instrumento desconocido",
        notYet: "Aún no",
        notRecorded: "No registrado",
        system: "Sistema",
        statusToken: "{{status}} · {{token}}",
        tokenReference: "...{{token}}",
      },
      metrics: {
        brokerCampaigns: "Campañas con intermediario",
        registeredParticipants: "Participantes registrados",
        submitted: "Enviadas",
        invitationsSent: "Invitaciones enviadas",
        complete: "Completas",
        pending: "Pendientes",
        seeded: "Precargadas",
        registered: "Registrados",
        completion: "Finalización",
        completionPercent: "{{value}}%",
      },
      campaignStatuses: {
        draft: "Borrador",
        active: "Activa",
        closed: "Cerrada",
      },
      matchStatuses: {
        submitted: "Enviado",
        registered: "Registrado",
        pending: "Pendiente",
        matched: "Vinculado",
      },
      deliveryStatuses: {
        pending: "Pendiente",
        queued: "En cola",
        sent: "Enviada",
        opened: "Abierta",
        submitted: "Enviada",
        revoked: "Revocada",
        failed: "Fallida",
      },
      unauthorized: {
        title: "Se requiere acceso de intermediario honesto",
        description:
          "Este espacio está restringido a responsables de datos y administradores porque vincula identidades de encuesta cegadas con registros de pacientes.",
      },
      registerModal: {
        title: "Registrar participante",
        titleWithCampaign: "Registrar participante · {{campaign}}",
        registering: "Registrando...",
        description:
          "Crea una entrada de registro cegada que mapea un identificador de encuestado con un registro de paciente para esta campaña de encuesta.",
        respondentIdentifier: "Identificador del encuestado",
        respondentPlaceholder: "MRN, código del estudio o código de invitación",
        personIdPlaceholder: "person_id OMOP conocido",
        notesPlaceholder: "Notas opcionales del intermediario",
      },
      inviteModal: {
        title: "Enviar invitación",
        titleWithCampaign: "Enviar invitación · {{campaign}}",
        sending: "Enviando...",
        description:
          "Envía un enlace de encuesta de un solo uso gestionado por el intermediario. Solo el intermediario conserva la dirección de entrega y la cadena de custodia.",
        selectParticipant: "Seleccionar participante",
        participantWithPerson: "{{blindedId}} · persona {{personId}}",
        emailPlaceholder: "paciente@example.org",
        lastInvitation: "Última invitación: {{status}} · token terminado en {{token}}",
      },
      campaignRegistry: {
        title: "Registro de campañas",
        subtitle: "Solo campañas habilitadas para intermediario honesto.",
        loading: "Cargando campañas...",
        emptyPrefix: "Aún no hay campañas con intermediario honesto. Activa",
        requireHonestBroker: "Requerir intermediario honesto",
        emptySuffix: "en una campaña de encuesta primero.",
      },
      messages: {
        selectCampaignManage: "Selecciona una campaña para gestionar registros del intermediario.",
        selectCampaignReview: "Selecciona una campaña para revisar registros del intermediario.",
      },
      participants: {
        title: "Participantes registrados",
        subtitle: "Entradas de registro desidentificadas para la campaña de encuesta seleccionada.",
        searchPlaceholder: "Buscar ID cegado, ID de persona, notas...",
        loading: "Cargando registros...",
        noMatches: "Ningún registro del intermediario coincide con el filtro actual.",
      },
      invitations: {
        title: "Libro de invitaciones",
        subtitle:
          "Cadena de custodia saliente y entrante para invitaciones de encuesta gestionadas por el intermediario.",
        loading: "Cargando invitaciones...",
        empty: "Aún no se enviaron invitaciones para esta campaña.",
      },
      audit: {
        title: "Rastro de auditoría",
        subtitle:
          "Cadena de custodia inmutable del lado del intermediario para registro de participantes, invitaciones salientes y eventos de respuesta entrantes.",
        loading: "Cargando rastro de auditoría...",
        empty: "Aún no hay eventos de auditoría del intermediario.",
      },
      latest: {
        title: "Último registro coincidente",
        blindedId: "ID cegado",
        created: "Creado",
      },
      table: {
        blindedParticipant: "Participante cegado",
        conductId: "ID de ejecución",
        status: "Estado",
        submitted: "Enviado",
        contact: "Contacto",
        latestInvite: "Última invitación",
        destination: "Destino",
        sent: "Enviado",
        opened: "Abierto",
        reference: "Referencia",
        actions: "Acciones",
        time: "Hora",
        action: "Acción",
        actor: "Actor",
        inviteRef: "Ref. invitación",
        metadata: "Metadatos",
      },
      auditActions: {
        participant_registered: "Participante registrado",
        invitation_sent: "Invitación enviada",
        invitation_resent: "Invitación reenviada",
        invitation_revoked: "Invitación revocada",
        response_submitted: "Respuesta enviada",
        status_changed: "Estado cambiado",
      },
      confirmRevoke: "¿Revocar la invitación terminada en {{token}}?",
      toasts: {
        publishLinkCopied: "Enlace de publicación copiado",
        publishLinkCopyFailed: "No se pudo copiar el enlace de publicación",
        participantRegistered: "Participante registrado",
        participantRegisterFailed: "No se pudo registrar el participante",
        invitationSent: "Invitación enviada · token terminado en {{token}}",
        invitationSendFailed: "No se pudo enviar la invitación",
        invitationResent: "Invitación reenviada · token terminado en {{token}}",
        invitationResendFailed: "No se pudo reenviar la invitación",
        invitationRevoked: "Invitación revocada · token terminado en {{token}}",
        invitationRevokeFailed: "No se pudo revocar la invitación",
      },
    },
  },
  vocabulary: {
    mappingAssistant: {
      title: "Asistente de mapeo de conceptos",
      poweredBy: "Impulsado por Ariadne",
      subtitle:
        "Mapea términos fuente a conceptos estándar OMOP con coincidencia literal, vectorial y LLM",
      filters: {
        selectedCount: "{{count}} seleccionados",
        clearSelection: "Limpiar selección",
        targetVocabulary: "Vocabulario objetivo:",
        allVocabularies: "Todos los vocabularios",
        targetDomain: "Dominio objetivo:",
        allDomains: "Todos los dominios",
      },
      drawer: {
        disambiguate: "Desambiguar",
        candidateCount: "{{count}} candidatos - selecciona el mapeo correcto",
        noCandidates:
          "No se encontraron candidatos. Prueba limpiar el término abajo.",
        cleanRemap: "Limpiar y remapear",
        editPlaceholder: "Edita el término y remapea...",
      },
      actions: {
        clean: "Limpiar",
        remap: "Remapear",
        acceptMapping: "Aceptar mapeo",
        rejectMapping: "Rechazar mapeo",
        disambiguateTitle: "Desambiguar - ver todos los candidatos",
        uploadCsv: "Subir CSV",
        loadProject: "Cargar proyecto",
        mapping: "Mapeando...",
        mapTerms: "Mapear términos",
        clearResults: "Limpiar resultados",
        acceptAllThreshold: "Aceptar todo >= 90%",
        saveToVocabulary: "Guardar en vocabulario",
        saveProject: "Guardar proyecto",
        exportCsv: "Exportar CSV",
      },
      toasts: {
        remapped: "Se remapeó \"{{source}}\" -> {{concept}}",
        noMatchForCleaned:
          "No se encontró coincidencia para el término limpio \"{{term}}\"",
        remapFailed: "Falló el remapeo",
        autoAccepted:
          "Se aceptaron automáticamente {{count}} mapeos de alta confianza",
        savedMappings:
          "Se guardaron {{count}} mapeos en source_to_concept_map",
        saveMappingsFailed: "No se pudieron guardar los mapeos",
        projectSaved: "Proyecto guardado: {{name}}",
        saveProjectFailed: "No se pudo guardar el proyecto",
        projectLoaded: "Proyecto cargado: {{name}}",
        loadProjectFailed: "No se pudo cargar el proyecto",
      },
      errors: {
        cleanupFailed: "Falló la limpieza.",
        mappingFailed:
          "Falló el mapeo. Verifica que el servicio Ariadne esté en ejecución y accesible.",
      },
      results: {
        candidateCount: "{{count}} candidatos",
        overridden: "(reemplazado)",
        noMatchFound: "No se encontró coincidencia",
        selectOverride: "Selecciona un candidato para reemplazar el mapeo",
        noAdditionalCandidates: "No hay candidatos adicionales.",
      },
      labels: {
        noValue: "-",
        separator: "-",
      },
      input: {
        termsMapped: "{{count}} términos mapeados",
        editTerms: "Editar términos",
        sourceTerms: "Términos fuente",
        termsPlaceholder:
          "Ingresa términos fuente, uno por línea...\n\ndiabetes mellitus tipo 2\ninfarto agudo de miocardio\nHTA\nASA 81mg",
        termsEntered: "{{count}} términos ingresados",
      },
      projects: {
        loading: "Cargando proyectos...",
        loadFailed: "No se pudieron cargar los proyectos",
        empty: "No hay proyectos guardados",
        projectMeta: "{{count}} términos -- {{date}}",
        namePlaceholder: "Nombre del proyecto...",
      },
      vocabularies: {
        SNOMED: "SNOMED CT",
        ICD10CM: "ICD-10-CM",
        RxNorm: "RxNorm",
        LOINC: "LOINC",
        ICD9CM: "ICD-9-CM",
        CPT4: "CPT-4",
        HCPCS: "HCPCS",
        MedDRA: "MedDRA",
      },
      domains: {
        Condition: "Condición",
        Drug: "Fármaco",
        Procedure: "Procedimiento",
        Measurement: "Medición",
        Observation: "Observación",
        Device: "Dispositivo",
      },
      progress: {
        mappingTerms: "Mapeando {{count}} términos...",
      },
      metrics: {
        termsMapped: "Términos mapeados",
        highConfidence: "Alta confianza",
        needReview: "Requieren revisión",
        noMatch: "Sin coincidencia",
      },
      table: {
        sourceTerm: "Término fuente",
        bestMatch: "Mejor coincidencia",
        confidence: "Confianza",
        matchType: "Tipo de coincidencia",
        vocabulary: "Vocabulario",
        actions: "Acciones",
      },
      summary: {
        mapped: "{{count}} mapeados",
        high: "{{count}} altos",
        review: "{{count}} por revisar",
        noMatch: "{{count}} sin coincidencia",
        accepted: "{{count}} aceptados",
      },
    },
    conceptDetail: {
      tabs: {
        info: "Información",
        relationships: "Relaciones",
        mapsFrom: "Mapeos desde",
        hierarchy: "Jerarquía",
      },
      empty: {
        title: "Selecciona un concepto para ver detalles",
        subtitle: "Busca y haz clic en un concepto del panel izquierdo",
        noAncestors: "No se encontraron ancestros",
        noRelationships: "No se encontraron relaciones",
        noSourceCodes: "Ningún código fuente mapea a este concepto",
      },
      errors: {
        failedLoad: "No se pudo cargar el concepto",
      },
      toasts: {
        conceptIdCopied: "ID de concepto copiado",
      },
      actions: {
        copyConceptId: "Copiar ID de concepto",
        addToSet: "Agregar al conjunto",
      },
      values: {
        standard: "Estándar",
        classification: "Clasificación",
        nonStandard: "No estándar",
        valid: "Válido",
      },
      sections: {
        basicInformation: "Información básica",
        synonyms: "Sinónimos",
        ancestors: "Ancestros",
        relationships: "Relaciones",
        mapsFrom: "Códigos fuente que mapean a este concepto",
        mapsFromDescription:
          "Códigos de vocabularios fuente (ICD-10, SNOMED, RxNorm, etc.) que mapean a este concepto estándar",
        hierarchy: "Jerarquía del concepto",
      },
      fields: {
        conceptCode: "Código de concepto",
        domain: "Dominio",
        vocabulary: "Vocabulario",
        conceptClass: "Clase de concepto",
        standardConcept: "Concepto estándar",
        invalidReason: "Motivo de invalidez",
        validStartDate: "Fecha inicial de validez",
        validEndDate: "Fecha final de validez",
      },
      table: {
        id: "ID",
        name: "Nombre",
        domain: "Dominio",
        vocabulary: "Vocabulario",
        relationship: "Relación",
        relatedId: "ID relacionado",
        relatedName: "Nombre relacionado",
        code: "Código",
        class: "Clase",
      },
      pagination: {
        showingRange: "Mostrando {{start}}-{{end}} de {{total}}",
        showingSourceCodes:
          "Mostrando {{shown}} de {{total}} códigos fuente",
      },
    },
    semanticSearch: {
      hecate: "Hecate",
      poweredBy: "Impulsado por Hecate",
      tagline: "descubrimiento de conceptos con vectores",
      placeholder: "Ingresa un término clínico para búsqueda semántica...",
      filters: {
        allDomains: "Todos los dominios",
        allVocabularies: "Todos los vocabularios",
        standard: {
          all: "Todos",
          standard: "S",
          classification: "C",
        },
      },
      badges: {
        standard: "Estándar",
        classification: "Clasificación",
      },
      values: {
        inSet: "En el conjunto",
        standardAbbrev: "S",
      },
      actions: {
        addToSet: "Agregar al conjunto",
        clearFilters: "Limpiar filtros",
        retry: "Reintentar",
        tryClearingFilters: "Prueba limpiar los filtros",
      },
      errors: {
        unavailable: "La búsqueda semántica no está disponible.",
        serviceHelp:
          "Verifica que el servicio de IA Hecate esté en ejecución y que ChromaDB esté inicializado.",
      },
      empty: {
        prompt: "Ingresa un término clínico para búsqueda semántica",
        help:
          "Hecate usa embeddings vectoriales para encontrar conceptos OMOP conceptualmente similares, incluso cuando fallan las coincidencias exactas por palabra clave.",
        noResults: "No se encontraron coincidencias semánticas para \"{{query}}\"",
      },
      results: {
        matchCountOne: "{{count}} coincidencia semántica",
        matchCountMany: "{{count}} coincidencias semánticas",
        updating: "Actualizando...",
      },
    },
    searchPanel: {
      placeholder: "Buscar conceptos...",
      filters: {
        toggle: "Filtros",
        standardOnly: "Estándar",
        allDomains: "Todos los dominios",
        allVocabularies: "Todos los vocabularios",
        allConceptClasses: "Todas las clases de concepto",
        countSuffix: " ({{count}})",
      },
      actions: {
        clearAllFilters: "Limpiar todos los filtros",
        tryClearingFilters: "Prueba limpiar los filtros",
        loading: "Cargando...",
        loadMoreResults: "Cargar más resultados",
      },
      empty: {
        prompt: "Buscar en el vocabulario OMOP",
        help:
          "Escribe al menos 2 caracteres para buscar conceptos por nombre, código o ID",
        noResults: "No se encontraron conceptos para \"{{query}}\"",
      },
      results: {
        showingCount: "Mostrando {{shown}} de {{total}} resultados",
      },
      engine: {
        solr: "Solr",
        pg: "PG",
      },
      values: {
        inSet: "En el conjunto",
      },
    },
    conceptComparison: {
      title: "Comparar conceptos",
      subtitle:
        "Comparación lado a lado de 2-4 conceptos OMOP con atributos, ancestros y relaciones",
      search: {
        placeholder: "Buscar concepto para agregar...",
      },
      sections: {
        ancestors: "Ancestros (2 niveles)",
        relationships: "Relaciones",
      },
      fields: {
        conceptCode: "Código de concepto",
        domain: "Dominio",
        vocabulary: "Vocabulario",
        conceptClass: "Clase de concepto",
        standard: "Estándar",
        validStart: "Inicio de validez",
        validEnd: "Fin de validez",
        invalidReason: "Motivo de invalidez",
      },
      actions: {
        addConcept: "Agregar concepto",
      },
      empty: {
        prompt: "Busca conceptos para comparar",
        help:
          "Selecciona 2-4 conceptos para ver una comparación lado a lado de sus atributos, ancestros y relaciones",
      },
      values: {
        standard: "Estándar",
        classification: "Clasificación",
        nonStandard: "No estándar",
        valid: "Válido",
        level: "N{{level}}",
        selected: "Seleccionado:",
        addOneMore: "Agrega al menos uno más para comparar",
      },
    },
    addToConceptSet: {
      title: "Agregar al conjunto de conceptos",
      create: {
        title: "Crear nuevo conjunto de conceptos",
        help: "Agregar concepto y abrir en Builder",
        nameLabel: "Nombre del nuevo conjunto de conceptos",
      },
      actions: {
        create: "Crear",
        cancel: "Cancelar",
        openBuilderWithSearch: "Abrir Builder con la búsqueda actual",
      },
      divider: "o agregar a uno existente",
      filter: {
        placeholder: "Filtrar conjuntos de conceptos...",
      },
      empty: {
        noMatching: "No hay conjuntos de conceptos coincidentes",
        noSets: "No se encontraron conjuntos de conceptos",
      },
      footer: {
        includeDescendants: "Agrega con Include Descendants",
      },
      toasts: {
        addedToSet: "Agregado a \"{{setName}}\"",
        addFailed: "No se pudo agregar el concepto al conjunto",
        missingSetId: "No se pudo recuperar el ID del nuevo conjunto",
        createdAndAdded: "Se creó \"{{name}}\" y se agregó el concepto",
        createdAddFailed:
          "El conjunto se creó, pero no se pudo agregar el concepto",
        createFailed: "No se pudo crear el conjunto de conceptos",
      },
    },
    page: {
      title: "Navegador de vocabulario",
      subtitle:
        "Busca, explora y navega el vocabulario estandarizado de OMOP",
      tabs: {
        keyword: "Búsqueda por palabra clave",
        semantic: "Búsqueda semántica",
        browse: "Explorar jerarquía",
      },
    },
    hierarchyBrowser: {
      breadcrumb: {
        allDomains: "Todos los dominios",
      },
      filters: {
        allSources: "Todas las fuentes",
        itemPlaceholder: "Filtrar {{count}} elementos...",
      },
      actions: {
        showAllConcepts: "Mostrar todos los conceptos",
        showGroupings: "Mostrar agrupaciones",
        clearFilter: "Limpiar filtro",
        viewDetailsFor: "Ver detalles de {{conceptName}}",
        viewConceptDetails: "Ver detalles del concepto",
      },
      empty: {
        noMatchingConcepts: "No hay conceptos coincidentes",
        noConcepts: "No se encontraron conceptos",
      },
      counts: {
        clinicalGroupings: "{{count}} agrupaciones clínicas",
        concepts: "{{count}} conceptos",
        items: "{{count}} elementos",
        filteredItems: "{{shown}} de {{total}} elementos",
        namedSubCategories: "{{name}} - {{count}} subcategorías",
        subCategories: "{{count}} subcategorías",
        subcategories: "{{count}} subcategorías",
        oneAnchor: "1 ancla",
        persons: "{{count}} personas",
        records: "{{count}} registros",
        groupingCoversSubcategories:
          "{{groupingName}} cubre {{count}} subcategorías",
      },
    },
    hierarchyTree: {
      empty: {
        noData: "No hay datos de jerarquía disponibles",
      },
    },
  },
  dataExplorer: {
    page: {
      title: "Explorador de datos",
      subtitle:
        "Explora los resultados de caracterización Achilles y la calidad de datos",
      selectSourceTitle: "Selecciona una fuente de datos",
      selectSourceMessage:
        "Elige una fuente CDM en el menú superior para explorar sus datos",
    },
    tabs: {
      overview: "Resumen",
      domains: "Dominios",
      temporal: "Temporal",
      heel: "Achilles",
      dqd: "Calidad de datos",
      ares: "Ares",
    },
    sourceSelector: {
      loading: "Cargando fuentes...",
      placeholder: "Selecciona una fuente de datos",
    },
    domains: {
      condition: "Afecciones",
      drug: "Fármacos",
      procedure: "Procedimientos",
      measurement: "Mediciones",
      observation: "Observaciones",
      visit: "Visitas",
    },
    overview: {
      metrics: {
        persons: "Personas",
        personsTotal: "{{value}} en total",
        medianObsDuration: "Duración mediana de observación",
        durationDays: "{{value}} días",
        observationPeriods: "{{value}} períodos de observación",
        totalEvents: "Eventos totales",
        acrossAllCdmTables: "En todas las tablas CDM",
        dataCompleteness: "Completitud de datos",
        tablesPopulated: "{{populated}}/{{total}} tablas pobladas",
      },
      sections: {
        demographics: "Demografía de la población",
        observationPeriods: "Análisis de períodos de observación",
        domainRecordProportions: "Proporciones de registros por dominio",
        dataDensityOverTime: "Densidad de datos en el tiempo",
        recordDistribution: "Distribución de registros",
      },
      cards: {
        genderDistribution: "Distribución por género",
        ethnicity: "Etnicidad",
        race: "Raza",
        topTen: "10 principales",
        yearOfBirthDistribution: "Distribución del año de nacimiento",
        yearOfBirthSubtitle: "Histograma con densidad suavizada (dorado)",
        cumulativeObservationDuration:
          "Duración acumulada de observación",
        cumulativeObservationSubtitle:
          "Estilo Kaplan-Meier: % de personas con observación >= X días",
        observationStartEndDates: "Fechas de inicio / fin de observación",
        observationStartEndSubtitle:
          "Distribución temporal de los períodos de observación",
        observationPeriodDurationDays:
          "Duración del período de observación (días)",
        observationPeriodsPerPerson: "Períodos de observación por persona",
        observationPeriodsPerPersonSubtitle:
          "Distribución de cuántos períodos tiene cada persona",
        clinicalDataDomains: "Dominios de datos clínicos",
        clinicalDataDomainsSubtitle:
          "Ordenados por conteo de registros - haz clic en un dominio para explorar sus conceptos",
        recordsByDomainAndYear: "Registros por dominio y año",
        recordsByDomainAndYearSubtitle:
          "La intensidad del color indica el volumen de registros por dominio y año",
        cdmTableRecordCounts: "Conteos de registros de tablas CDM",
        cdmTableRecordCountsSubtitle:
          "Escala logarítmica - todas las tablas son visibles sin importar su magnitud",
      },
      messages: {
        runAchillesForTemporalData:
          "Ejecuta Achilles para generar datos de tendencia temporal",
      },
    },
    charts: {
      common: {
        records: "{{count}} registros",
        persons: "{{count}} personas",
        total: "Total",
        separator: "·",
      },
      boxPlot: {
        noDistributionData: "No hay datos de distribución",
        ariaLabel: "Diagrama de caja",
        labels: {
          p25: "P25: {{value}}",
          median: "Mediana: {{value}}",
          p75: "P75: {{value}}",
        },
      },
      cumulativeObservation: {
        tooltipValue: "{{days}} días - {{pct}}% de personas",
        xAxisLabel: "Duración de observación (días)",
        labels: {
          min: "Mín",
          p10: "P10",
          p25: "P25",
          median: "Mediana",
          p75: "P75",
          p90: "P90",
          max: "Máx",
        },
      },
      demographics: {
        ageDistribution: "Distribución de edad",
        noAgeData: "No hay datos de distribución de edad",
        age: "Edad",
        male: "Masculino",
        female: "Femenino",
      },
      heatmap: {
        ariaLabel: "Mapa de calor de densidad de datos",
      },
      hierarchy: {
        noData: "No hay datos de jerarquía disponibles",
        classificationHierarchy: "Jerarquía de clasificación",
        back: "Atrás",
      },
      periodCount: {
        observationPeriods: "{{count}} período(s) de observación",
      },
      recordCounts: {
        noData: "No hay datos de conteo de registros disponibles",
        title: "Conteos de registros por tabla CDM",
      },
      temporalTrend: {
        events: "Eventos",
        secondary: "Secundaria",
      },
      topConcepts: {
        noData: "No hay datos de conceptos disponibles",
        title: "Conceptos principales",
        id: "ID: {{id}}",
        prevalence: "Prevalencia: {{value}}%",
      },
      yearOfBirth: {
        year: "Año: {{year}}",
      },
    },
    domain: {
      metrics: {
        totalRecords: "Registros totales",
        distinctConcepts: "Conceptos distintos",
      },
      loadFailed: "No se pudieron cargar datos de {{domain}}",
      temporalTrendTitle: "Tendencia temporal de {{domain}}",
    },
    temporal: {
      domainsLabel: "Dominios:",
      multiDomainOverlay: "Superposición temporal multidominio",
      emptyTitle: "No hay datos temporales disponibles",
      emptyHelp:
        "Selecciona dominios arriba y asegúrate de que Achilles se haya ejecutado",
    },
    concept: {
      details: "Detalles del concepto",
      loadFailed: "No se pudieron cargar los detalles del concepto",
      genderDistribution: "Distribución por género",
      temporalTrend: "Tendencia temporal",
      typeDistribution: "Distribución por tipo",
      ageAtFirstOccurrence: "Edad en la primera ocurrencia",
      valueByLabel: "{{label}}: {{value}}",
    },
    achilles: {
      severities: {
        error: "Error",
        warning: "Advertencia",
        notification: "Notificación",
      },
      severityCounts: {
        error: "errores",
        warning: "advertencias",
        notification: "notificaciones",
      },
      actions: {
        running: "En ejecución...",
        runHeelChecks: "Ejecutar validaciones Heel",
        runAchilles: "Ejecutar Achilles",
        selectRun: "Seleccionar ejecución",
        viewLiveProgress: "Ver progreso en vivo",
        viewDetails: "Ver detalles",
      },
      runShort: "Ejecución {{id}}...",
      statuses: {
        completed: "Completada",
        failed: "Fallida",
        running: "En ejecución",
        pending: "Pendiente",
      },
      labels: {
        status: "Estado",
        total: "total",
        passed: "aprobadas",
        failed: "fallidas",
        durationSeconds: "Duración: {{value}}s",
      },
      heel: {
        title: "Validaciones Heel",
        dispatchFailed: "No se pudieron iniciar las validaciones Heel",
        running: "Ejecutando validaciones Heel...",
        empty: "Aún no se ejecutaron validaciones Heel",
        allPassed: "Todas las validaciones pasaron",
        issueSummary:
          "{{count}} incidencias: {{errors}}E / {{warnings}}A / {{notifications}}N",
      },
      characterization: {
        title: "Caracterización Achilles",
        dispatchFailed: "No se pudo iniciar la ejecución de Achilles",
        empty: "Aún no hay ejecuciones de Achilles",
        emptyHelp: 'Haz clic en "Ejecutar Achilles" para caracterizar tus datos',
      },
      runModal: {
        completedIn: "Completada en {{duration}}",
        analysisProgress: "{{done}} de {{total}} análisis",
        elapsed: "Transcurrido:",
        passedCount: "{{count}} aprobadas",
        failedCount: "{{count}} fallidas",
        totalDuration: "{{duration}} total",
        remaining: "Quedan ~{{duration}}",
        waiting: "Esperando a que comiencen los análisis...",
        done: "Listo",
        runInBackground: "Ejecutar en segundo plano",
      },
    },
    dqd: {
      categories: {
        completeness: "Completitud",
        conformance: "Conformidad",
        plausibility: "Plausibilidad",
        overall: "General",
      },
      progress: {
        title: "Análisis DQD en ejecución",
        checksCompleted: "{{completed}} de {{total}} validaciones completadas",
        waiting: "Esperando...",
        running: "Ejecutando:",
      },
      labels: {
        passed: "aprobadas",
        failed: "fallidas",
        remaining: "restantes",
        warnings: "Advertencias",
      },
      severity: {
        error: "Error",
        warning: "Advertencia",
        info: "Info",
      },
      categoryPanel: {
        checkCount: "{{count}} validaciones",
        passRate: "{{percent}}% de aprobación",
        table: {
          check: "Validación",
          table: "Tabla",
          column: "Columna",
          severity: "Severidad",
          violationPercent: "% de violación",
        },
      },
      scorecard: {
        emptyTitle: "No hay resultados DQD disponibles",
        emptyDescription:
          "Ejecuta un análisis Data Quality Dashboard para ver resultados",
        overallScore: "Puntuación general",
        passedFraction: "{{passed}}/{{total}} aprobadas",
      },
      tableGrid: {
        noResults: "No hay resultados DQD para mostrar",
        title: "Mapa de calor tabla x categoría",
        cdmTable: "Tabla CDM",
      },
      actions: {
        runDqd: "Ejecutar DQD",
      },
      dispatchFailed: "No se pudo iniciar la ejecución DQD",
      empty: "Aún no hay ejecuciones DQD",
      emptyHelp:
        'Haz clic en "Ejecutar DQD" para iniciar un análisis de calidad de datos',
    },
    ares: {
      name: "Ares",
      breadcrumbSeparator: ">",
      comingSoon: "Próximamente en una fase futura",
      sections: {
        hub: "Centro",
        networkOverview: "Resumen de red",
        conceptComparison: "Comparación de conceptos",
        dqHistory: "Historial de calidad",
        coverage: "Cobertura",
        coverageMatrix: "Matriz de cobertura",
        feasibility: "Factibilidad",
        diversity: "Diversidad",
        releases: "Versiones",
        unmappedCodes: "Códigos sin mapear",
        cost: "Costo",
        costAnalysis: "Análisis de costos",
        annotations: "Anotaciones",
      },
      cards: {
        sourcesBelowDq: "{{value}} fuentes por debajo de 80% DQ",
        networkOverviewDescription:
          "Salud de fuentes, puntajes DQ e indicadores de tendencia",
        conceptComparisonDescription:
          "Compara la prevalencia de conceptos entre fuentes",
        dqHistoryDescription: "Puntaje DQ promedio de la red por versión",
        coverageDescription: "Disponibilidad de dominio por fuente",
        feasibilityDescription: "¿Tu red puede respaldar un estudio?",
        diversityDescription: "Paridad demográfica entre fuentes",
        releasesDescription: "Historial de versiones por fuente",
        unmappedCodesDescription:
          "Códigos fuente sin mapeos estándar",
        annotationsDescription: "Notas de gráficos en todas las fuentes",
        costDescription: "Datos de costos por dominio y a lo largo del tiempo",
      },
      networkOverview: {
        title: "Resumen de red",
        networkTotal: "Total de la red",
        percent: "{{value}}%",
        averagePercent: "{{value}}% promedio",
        actions: {
          dqRadar: "Radar DQ",
          hideRadar: "Ocultar radar",
        },
        metrics: {
          dataSources: "Fuentes de datos",
          avgDqScore: "Puntaje DQ promedio",
          unmappedCodes: "Códigos sin mapear",
          needAttention: "Requieren atención",
          totalPersons: "Personas totales",
        },
        table: {
          source: "Fuente",
          dqScore: "Puntaje DQ",
          dqTrend: "Tendencia DQ",
          freshness: "Actualidad",
          domains: "Dominios",
          persons: "Personas",
          latestRelease: "Última versión",
        },
        messages: {
          loading: "Cargando resumen de red...",
          noData: "No hay datos de red disponibles.",
          noReleases: "Sin versiones",
        },
        radar: {
          title: "Perfil de radar DQ (dimensiones de Kahn)",
          description:
            "Tasas de aprobación en las cinco dimensiones de calidad de datos de Kahn. Los valores más altos indican mejor calidad.",
          noData: "No hay datos de radar DQ disponibles.",
          dimensions: {
            completeness: "Completitud",
            conformanceValue: "Conformidad (valor)",
            conformanceRelational: "Conformidad (relacional)",
            plausibilityAtemporal: "Plausibilidad (atemporal)",
            plausibilityTemporal: "Plausibilidad (temporal)",
          },
        },
      },
      feasibility: {
        title: "Evaluaciones de factibilidad",
        assessmentMeta: "{{date}} | {{sources}} fuentes evaluadas",
        passedSummary: "{{passed}}/{{total}} aprobadas",
        resultsTitle: "Resultados: {{name}}",
        scoreLabel: "{{score}}% de puntaje",
        empty:
          "Aún no hay evaluaciones. Crea una para evaluar si tu red puede respaldar un estudio propuesto.",
        actions: {
          newAssessment: "+ Nueva evaluación",
          running: "En ejecución...",
          runAssessment: "Ejecutar evaluación",
          hide: "Ocultar",
          forecast: "Pronóstico",
        },
        filters: {
          view: "Vista:",
        },
        detailViews: {
          table: "Tabla de puntajes",
          impact: "Análisis de impacto",
          consort: "Flujo CONSORT",
        },
        criteria: {
          domains: "Dominios",
          concepts: "Conceptos",
          visitTypes: "Tipos de visita",
          dateRange: "Rango de fechas",
          patientCount: "Conteo de pacientes",
        },
        forecast: {
          insufficientData:
            "Datos históricos insuficientes para el pronóstico (se requieren al menos 6 meses).",
          title: "Pronóstico de llegada de pacientes: {{source}}",
          monthlyRate: "Tasa mensual: {{rate}} pacientes/mes",
          targetReachedIn: "Objetivo alcanzado en ~{{months}} meses",
          targetAlreadyReached: "Objetivo ya alcanzado",
          actual: "Real",
          projected: "Proyectado",
          confidenceBand: "IC 95%",
          targetLabel: "Objetivo: {{target}}",
          footnote:
            "Proyección basada en regresión lineal de los últimos 12 meses. La banda de confianza se amplía con la distancia de proyección.",
        },
        consort: {
          allSources: "Todas las fuentes",
          noResults: "No hay resultados para mostrar el diagrama CONSORT.",
          title: "Flujo de atrición estilo CONSORT",
          description:
            "Muestra cómo las fuentes se excluyen progresivamente en cada criterio.",
          sources: "{{count}} fuentes",
          excluded: "-{{count}} excluidas",
        },
        impact: {
          noData: "No hay datos de impacto de criterios disponibles.",
          title: "Análisis de impacto de criterios",
          description:
            "Muestra cuántas fuentes adicionales pasarían si se eliminara cada criterio. Base: {{passed}}/{{total}} aprobadas.",
          sourcesRecovered: "+{{count}} fuentes",
          guidance:
            "El criterio más impactante es aquel cuya eliminación recuperaría más fuentes. Considera relajar criterios de alto impacto si califican muy pocas fuentes.",
        },
        templates: {
          loading: "Cargando plantillas...",
          startFrom: "Comenzar desde plantilla",
        },
        table: {
          source: "Fuente",
          domains: "Dominios",
          concepts: "Conceptos",
          visits: "Visitas",
          dates: "Fechas",
          patients: "Pacientes",
          score: "Puntaje",
          overall: "Global",
          forecast: "Pronóstico",
        },
        status: {
          eligible: "APTA",
          ineligible: "NO APTA",
        },
        form: {
          title: "Nueva evaluación de factibilidad",
          assessmentName: "Nombre de la evaluación",
          assessmentNamePlaceholder:
            "p. ej., Estudio de desenlaces en diabetes",
          requiredDomains: "Dominios requeridos",
          minPatientCount: "Conteo mínimo de pacientes (opcional)",
          minPatientCountPlaceholder: "p. ej., 1000",
          domains: {
            condition: "Afecciones",
            drug: "Medicamentos",
            procedure: "Procedimientos",
            measurement: "Mediciones",
            observation: "Observaciones",
            visit: "Visitas",
          },
        },
      },
      annotations: {
        filters: {
          allSources: "Todas las fuentes",
        },
        tags: {
          all: "Todas",
          dataEvent: "Evento de datos",
          researchNote: "Nota de investigación",
          actionItem: "Acción pendiente",
          system: "Sistema",
        },
        viewModes: {
          list: "Lista",
          timeline: "Cronología",
        },
        actions: {
          reply: "Responder",
          delete: "Eliminar",
        },
        replyPlaceholder: "Escribe una respuesta...",
        searchPlaceholder: "Buscar anotaciones...",
        confirmDelete: "¿Eliminar esta anotación?",
        coordinateValue: "{{axis}} = {{value}}",
        sourceContext: "en {{source}}",
        empty: {
          selectSource: "Selecciona una fuente para ver sus anotaciones",
          noAnnotations: "Aún no hay anotaciones para esta fuente",
          noTimeline: "No hay anotaciones para mostrar en la cronología.",
        },
      },
      coverage: {
        title: "Matriz de cobertura (informe Strand)",
        description:
          "Disponibilidad de dominios en todas las fuentes de datos. Verde = alta densidad, ámbar = baja densidad, rojo = sin datos.",
        yes: "Sí",
        densityTitle: "Densidad: {{density}} por persona",
        filters: {
          view: "Vista:",
        },
        viewModes: {
          records: "Registros",
          per_person: "Por persona",
          date_range: "Rango de fechas",
        },
        actions: {
          exporting: "Exportando...",
          exportCsv: "Exportar CSV",
          expectedVsActual: "Esperado vs. real",
        },
        table: {
          source: "Fuente",
          domains: "Dominios",
        },
        expectedStates: {
          expectedPresent: "Esperado y presente",
          expectedMissing: "Esperado pero ausente",
          unexpectedBonus: "Datos adicionales inesperados",
          notExpectedAbsent: "No esperado, no presente",
        },
        messages: {
          loading: "Cargando matriz de cobertura...",
          noSources:
            "No hay fuentes disponibles para el análisis de cobertura.",
        },
      },
      dqHistory: {
        filters: {
          source: "Fuente:",
          selectSource: "Seleccionar fuente...",
        },
        tabs: {
          trends: "Tendencias",
          heatmap: "Mapa de calor",
          sla: "SLA",
          overlay: "Entre fuentes",
        },
        sections: {
          passRate: "Tasa de aprobación DQ por versión",
          heatmap: "Mapa de calor de categoría x versión",
          sla: "Panel de cumplimiento SLA",
          overlay: "Superposición DQ entre fuentes",
        },
        passRate: "Tasa de aprobación",
        deltaReportTitle: "Informe delta: {{release}}",
        status: {
          new: "NUEVO",
          existing: "EXISTENTE",
          resolved: "RESUELTO",
          stable: "ESTABLE",
        },
        result: {
          pass: "APRUEBA",
          fail: "FALLA",
        },
        statusSummary: {
          new: "{{count}} nuevas",
          existing: "{{count}} existentes",
          resolved: "{{count}} resueltas",
          stable: "{{count}} estables",
        },
        table: {
          category: "Categoría",
          status: "Estado",
          checkId: "ID de validación",
          current: "Actual",
          previous: "Anterior",
        },
        sla: {
          targetsTitle: "Objetivos SLA (tasa mínima de aprobación %)",
          currentCompliance: "Cumplimiento actual",
          actual: "Real",
          target: "Objetivo",
          errorBudget: "Presupuesto de error",
          targetComparison: "{{actual}}% / {{target}}% objetivo",
        },
        messages: {
          selectSource: "Selecciona una fuente para ver el historial DQ.",
          loadingHistory: "Cargando historial DQ...",
          loadingDeltas: "Cargando deltas...",
          loadingHeatmap: "Cargando mapa de calor...",
          loadingOverlay: "Cargando datos de superposición...",
          noOverlayData: "No hay datos DQ disponibles entre fuentes.",
          noHeatmapData:
            "No hay datos de mapa de calor disponibles. Ejecuta DQD en varias versiones para ver tendencias por categoría.",
          noDeltaData: "No hay datos delta disponibles para esta versión.",
          saved: "Guardado",
          noSlaTargets:
            "No hay objetivos SLA definidos. Configura objetivos arriba para ver el cumplimiento.",
          noTrendData:
            "No hay datos de historial DQ disponibles. Ejecuta DQD en al menos dos versiones para ver tendencias.",
          trendHelp:
            "Haz clic en un punto de versión para ver detalles delta. Verde >90%, ámbar 80-90%, rojo <80%.",
          overlayHelp:
            "Tasas de aprobación DQ superpuestas en todas las fuentes en una línea temporal unificada.",
        },
        actions: {
          exporting: "Exportando...",
          exportCsv: "Exportar CSV",
          saving: "Guardando...",
          saveSlaTargets: "Guardar objetivos SLA",
        },
      },
      unmapped: {
        filters: {
          source: "Fuente:",
          selectSource: "Seleccionar fuente...",
          release: "Versión:",
          table: "Tabla:",
          allTables: "Todas las tablas",
          searchPlaceholder: "Buscar códigos fuente...",
        },
        viewModes: {
          table: "Tabla",
          pareto: "Pareto",
          vocabulary: "Vocabulario",
        },
        actions: {
          exporting: "Exportando...",
          exportUsagiCsv: "Exportar CSV Usagi",
          previous: "Anterior",
          next: "Siguiente",
        },
        summaryBadge: "{{table}} ({{codes}} códigos, {{records}} registros)",
        vocabularyValue: "({{vocabulary}})",
        progress: {
          noCodes: "No hay códigos sin mapear para revisar.",
          title: "Progreso de mapeo",
          reviewed: "{{percent}}% revisado",
          segmentTitle: "{{label}}: {{count}} ({{percent}}%)",
          label: "{{label}}:",
          status: {
            mapped: "Mapeado",
            deferred: "Diferido",
            excluded: "Excluido",
            pending: "Pendiente",
          },
        },
        sections: {
          pareto: "Análisis Pareto de códigos sin mapear",
          vocabulary: "Códigos sin mapear por vocabulario",
          suggestions: "Sugerencias de mapeo con IA",
        },
        suggestions: {
          generating: "Generando sugerencias mediante similitud pgvector...",
          failed:
            "No se pudieron cargar las sugerencias. Es posible que el servicio de IA o los embeddings de conceptos no estén disponibles.",
          empty:
            "No hay sugerencias disponibles. Es posible que los embeddings de conceptos no estén cargados.",
          id: "ID: {{id}}",
          accepted: "Aceptado",
          accept: "Aceptar",
          skip: "Omitir",
        },
        pareto: {
          topCodesCoverage:
            "Los 20 códigos principales cubren el {{percent}}% de todos los registros sin mapear",
          percent: "{{value}}%",
          cumulativePercent: "% acumulado",
        },
        vocabulary: {
          total: "Total",
          codeCount: "{{count}} códigos",
        },
        messages: {
          selectSource: "Selecciona una fuente para ver códigos sin mapear.",
          loading: "Cargando códigos sin mapear...",
          emptyPareto:
            "No se encontraron códigos sin mapear para el análisis Pareto.",
          emptyVocabulary: "No hay datos de vocabulario disponibles.",
          noneFound:
            "No se encontraron códigos fuente sin mapear. Todos los códigos están mapeados a conceptos OMOP estándar.",
          sortedByImpact:
            "Ordenado por puntaje de impacto (conteo de registros x peso del dominio)",
          showing: "Mostrando {{start}}-{{end}} de {{total}}",
        },
        table: {
          sourceCode: "Código fuente",
          vocabulary: "Vocabulario",
          cdmTable: "Tabla CDM",
          cdmField: "Campo CDM",
          records: "Registros",
          impactScore: "Puntaje de impacto",
        },
      },
      conceptComparison: {
        title: "Comparación de conceptos entre fuentes",
        searchPlaceholder:
          "Busca un concepto (p. ej., 'Diabetes tipo 2', 'Metformina')...",
        conceptMetadata: "{{domain}} | {{vocabulary}} | ID: {{id}}",
        selectedConceptMetadata:
          "{{domain}} | {{vocabulary}} | ID de concepto: {{id}}",
        temporalTrendTitle: "Tendencia temporal: {{concept}}",
        addConceptPlaceholder: "Agrega otro concepto ({{selected}}/{{max}} seleccionados)...",
        cdcNationalRate: "Tasa nacional CDC: {{value}}/1000",
        viewModes: {
          single: "Único",
          temporal: "Temporal",
          multi: "Multiconcepto",
          funnel: "Embudo de atrición",
        },
        rateModes: {
          crude: "Tasa bruta",
          standardized: "Ajustada por edad y sexo",
        },
        metrics: {
          rate: "Tasa/1000",
          count: "Conteo",
          perThousandShort: "{{value}}/1.000",
          perThousandLong: "{{value}} por 1.000",
        },
        messages: {
          noComparisonData: "No hay datos de comparación disponibles.",
          noTemporalPrevalenceData:
            "No hay datos de prevalencia temporal disponibles.",
          selectTwoConcepts: "Selecciona al menos 2 conceptos para comparar.",
          searching: "Buscando...",
          loadingComparison: "Cargando datos de comparación...",
          standardizedNote:
            "Estandarizado a la población del Censo de EE. UU. 2020 mediante estandarización directa por edad y sexo.",
          searchToCompare:
            "Busca un concepto arriba para comparar su prevalencia en todas las fuentes de datos.",
          loadingTemporal: "Cargando prevalencia temporal...",
          noTemporalData:
            "No hay datos temporales disponibles para este concepto.",
          searchForTemporal:
            "Busca un concepto arriba para ver su tendencia de prevalencia temporal entre versiones.",
          loadingMulti: "Cargando comparación multiconcepto...",
          loadingFunnel: "Cargando embudo de atrición...",
          noAttritionData:
            "No hay datos de atrición disponibles para los conceptos seleccionados.",
          temporalPrevalenceHelp:
            "Tasa por 1.000 personas a lo largo del tiempo.",
        },
      },
      releases: {
        releaseTypes: {
          etl: "ETL",
          scheduledEtl: "ETL programado",
          snapshot: "Instantánea",
        },
        cdmVersion: "CDM {{version}}",
        vocabularyVersion: "Vocabulario {{version}}",
        personCount: "{{value}} personas",
        recordCount: "{{value}} registros",
        actions: {
          showDiff: "Mostrar diferencia",
          editRelease: "Editar versión",
          createRelease: "Crear versión",
          creating: "Creando...",
          create: "Crear",
          saving: "Guardando...",
          save: "Guardar",
          cancel: "Cancelar",
        },
        etl: {
          provenance: "Procedencia ETL",
          ranBy: "Ejecutado por:",
          codeVersion: "Versión de código:",
          duration: "Duración:",
          started: "Inicio:",
          parameters: "Parámetros:",
        },
        duration: {
          hoursMinutes: "{{hours}}h {{minutes}}m",
          minutesSeconds: "{{minutes}}m {{seconds}}s",
          seconds: "{{seconds}}s",
        },
        confirmDelete: "¿Eliminar esta versión?",
        tabs: {
          list: "Versiones",
          swimlane: "Carriles",
          calendar: "Calendario",
        },
        timelineTitle: "Cronología de versiones (todas las fuentes)",
        calendarTitle: "Calendario de versiones",
        selectSource: "Selecciona una fuente",
        form: {
          releaseName: "Nombre de la versión",
          cdmVersion: "Versión CDM",
          vocabularyVersion: "Versión de vocabulario",
          etlVersion: "Versión ETL",
          notes: "Notas",
          notesPlaceholder: "Notas de la versión...",
          cdmVersionOptional: "Versión CDM (opcional)",
          vocabularyVersionOptional: "Versión de vocabulario (opcional)",
          cdmVersionPlaceholder: "CDM v5.4",
          vocabularyVersionPlaceholder: "2024-11-01",
          etlVersionPlaceholder: "v1.2.3",
        },
        empty: {
          selectSource: "Selecciona una fuente para ver sus versiones",
          noReleases: "Aún no hay versiones para esta fuente",
          noReleaseData: "No hay datos de versiones disponibles.",
        },
        calendar: {
          noEvents: "No hay eventos de versión.",
          dayEvents: "{{date}}: {{count}} versiones",
          less: "Menos",
          more: "Más",
        },
        diff: {
          computing: "Calculando diferencia...",
          title: "Diferencia de versión",
          initialRelease:
            "Versión inicial -- no hay datos previos para comparar.",
          persons: "Personas:",
          records: "Registros:",
          dqScore: "Puntaje DQ:",
          unmapped: "Sin mapear:",
          vocabUpdated: "Vocabulario actualizado",
          domainDeltas: "Deltas por dominio:",
        },
      },
      diversity: {
        title: "Informe de diversidad",
        description:
          "Proporciones demográficas entre fuentes de datos. Fuentes ordenadas por tamaño de población.",
        ratings: {
          very_high: "muy alta",
          high: "alta",
          moderate: "moderada",
          low: "baja",
        },
        percentValue: "{{value}}%",
        labelPercentValue: "{{label}}: {{value}}%",
        personCount: "{{value}} personas",
        labels: {
          gender: "Género",
          race: "Raza",
          ethnicity: "Etnicidad",
          male: "Masculino",
          female: "Femenino",
        },
        dimensions: {
          composite: "Compuesto",
          gender: "Género",
          race: "Raza",
          ethnicity: "Etnicidad",
        },
        tabs: {
          overview: "Resumen",
          pyramid: "Pirámide de edad",
          dap: "Brecha DAP",
          pooled: "Combinado",
          geographic: "Geográfico",
          trends: "Tendencias",
        },
        filters: {
          selectSource: "Seleccionar una fuente",
        },
        benchmarks: {
          usCensus2020: "Censo de EE. UU. 2020",
        },
        dap: {
          title: "Análisis de brechas de inscripción FDA DAP",
          description:
            "Compara la demografía de la fuente con los puntos de referencia del Censo de EE. UU. 2020 para identificar brechas de inscripción.",
          tooltip:
            "Real: {{actual}}% | Objetivo: {{target}}% | Brecha: {{gap}}%",
          status: {
            met: "Cumplido (dentro de 2%)",
            gap: "Brecha (2-10%)",
            critical: "Crítica (>10%)",
          },
        },
        agePyramid: {
          title: "{{source}} -- Distribución por edad",
        },
        benchmark: {
          title: "Referencia: {{label}}",
          actual: "Real",
          benchmark: "Referencia",
        },
        trends: {
          title: "Tendencias de diversidad: {{source}}",
          description:
            "Índice de diversidad de Simpson por versión (0 = homogéneo, 1 = máxima diversidad)",
        },
        geographic: {
          loading: "Cargando datos de diversidad geográfica...",
          noLocationData: "No hay datos de ubicación disponibles",
          noAdiData:
            "Los datos ADI no están disponibles (es posible que el módulo GIS no tenga ADI cargado)",
          noGeographicData:
            "No hay datos geográficos disponibles. Es posible que las fuentes no tengan datos de ubicación en la tabla person.",
          statesCovered: "Estados / regiones cubiertos",
          networkMedianAdi: "ADI mediano de la red:",
          sourcesWithLocation: "Fuentes con datos de ubicación",
          sourcesWithAdi: "Fuentes con datos ADI",
          stateCount: "{{count}} estados",
          medianAdiValue: "ADI mediano: {{value}}",
          topStates: "Principales estados por conteo de pacientes",
          adiDistribution: "Distribución de deciles ADI",
          leastDeprived: "Menor privación",
          adiDecile: "Decil ADI",
          mostDeprived: "Mayor privación",
          decileTitle: "Decil {{decile}}: {{count}} códigos ZIP",
          adiRatings: {
            low: "Baja privación",
            moderate: "Privación moderada",
            high: "Alta privación (subatendido)",
          },
        },
        pooled: {
          title: "Demografía combinada",
          description:
            "Selecciona varias fuentes para ver perfiles demográficos fusionados con ponderación.",
          summary: "Total: {{persons}} personas en {{sources}} fuentes",
        },
        messages: {
          loading: "Cargando datos de diversidad...",
          noSources:
            "No hay fuentes disponibles para el análisis de diversidad.",
          noData: "Sin datos",
          noTrendData:
            "No hay datos de versiones disponibles para tendencias de diversidad.",
          noTrendReleases:
            "No se encontraron versiones para esta fuente. Crea versiones para seguir tendencias de diversidad.",
        },
      },
      cost: {
        empty: {
          title: "No hay datos de costos disponibles",
          message:
            "Los datos de costos requieren conjuntos basados en reclamaciones (p. ej., MarketScan, Optum, PharMetrics). Los conjuntos derivados de EHR como SynPUF, MIMIC-IV y la mayoría de datos de centros médicos académicos normalmente no llenan la tabla de costos OMOP.",
        },
        filters: {
          source: "Fuente:",
          selectSource: "Seleccionar fuente...",
        },
        tabs: {
          overview: "Resumen",
          distribution: "Distribución",
          "care-setting": "Entorno de atención",
          trends: "Tendencias",
          drivers: "Impulsores de costo",
          "cross-source": "Entre fuentes",
        },
        messages: {
          selectSource: "Selecciona una fuente para ver datos de costos.",
          loading: "Cargando datos de costos...",
          distributionHelp:
            "Diagramas de caja y bigotes que muestran la dispersión del costo. Caja = IQR (P25-P75), bigotes = P10-P90, línea dorada = mediana, punto rojo = media.",
          noDistributionData: "No hay datos de distribución disponibles.",
          noCareSettingData:
            "No hay datos de costos por entorno de atención disponibles. Requiere registros de costos del dominio Visit unidos con visit_occurrence.",
          selectSourceForDrivers:
            "Selecciona una fuente para ver impulsores de costo.",
          loadingDrivers: "Cargando impulsores de costo...",
          noDriverData:
            "No hay datos de impulsores de costo disponibles para esta fuente.",
          costDriversHelp:
            "10 conceptos principales por costo total. Haz clic en una barra para ver detalles del concepto.",
          loadingCrossSource: "Cargando comparación entre fuentes...",
          noComparisonSources:
            "No hay fuentes disponibles para la comparación.",
          noCrossSourceCostData:
            "Ninguna fuente tiene datos de costos para comparar.",
          crossSourceHelp:
            "Caja y bigotes por fuente. Caja = IQR (P25-P75), bigotes = P10-P90, línea dorada = mediana.",
        },
        metrics: {
          totalCost: "Costo total",
          perPatientPerYear: "Por paciente por año",
          persons: "Personas",
          observationYears: "{{value}} años",
          avgObservation: "Observación promedio",
          recordsAverage: "{{records}} registros | promedio {{average}}",
          recordCount: "{{count}} registros",
          patientCount: "{{count}} pacientes",
          averagePerRecord: "Promedio: {{value}}/registro",
          medianValue: "Mediana: {{value}}",
          meanValue: "Media: {{value}}",
          percent: "{{value}}%",
          range: "Rango: {{min}} - {{max}}",
        },
        costTypeFilter: {
          title: "Se detectaron varios tipos de costo.",
          message:
            "Esta fuente tiene {{count}} conceptos de tipo de costo diferentes. Mezclar importes cobrados con importes pagados produce estadísticas engañosas. Filtra por tipo de costo para un análisis preciso.",
          allTypes: "Todos los tipos",
          option: "{{name}} ({{count}})",
        },
        sections: {
          costByDomain: "Costo por dominio",
          distributionByDomain: "Distribución de costos por dominio",
          costByCareSetting: "Costo por entorno de atención",
          monthlyTrends: "Tendencias mensuales de costos",
          topCostDrivers: "Principales impulsores de costo",
          crossSourceComparison: "Comparación de costos entre fuentes",
        },
      },
    },
  },
  jobs: {
    page: {
      title: "Tareas",
      subtitle: "Supervisa tareas en segundo plano y el estado de la cola",
      empty: {
        title: "No se encontraron tareas",
        archived: "No hay tareas archivadas de más de 24 horas.",
        filtered:
          "No hay tareas con estado {{status}}. Prueba otro filtro.",
        recent:
          "No hay tareas en las últimas 24 horas. Revisa Archivadas para tareas anteriores.",
      },
      table: {
        job: "Tarea",
        type: "Tipo",
        source: "Origen",
        started: "Inicio",
        duration: "Duración",
        status: "Estado",
        actions: "Acciones",
      },
      pagination: "Página {{current}} de {{last}} · {{total}} tareas",
    },
    filters: {
      statuses: {
        all: "Todas (24 h)",
        pending: "Pendientes",
        queued: "En cola",
        running: "En ejecución",
        completed: "Completadas",
        failed: "Fallidas",
        cancelled: "Canceladas",
        archived: "Archivadas",
      },
      types: {
        all: "Todos los tipos",
        analysis: "Análisis",
        characterization: "Caracterización",
        incidenceRate: "Tasa de incidencia",
        estimation: "Estimación",
        prediction: "Predicción",
        pathway: "Trayectorias",
        sccs: "SCCS",
        evidenceSynthesis: "Síntesis de evidencia",
        cohortGeneration: "Generación de cohortes",
        careGaps: "Brechas de atención",
        achilles: "Achilles",
        dataQuality: "Calidad de datos",
        heelChecks: "Validaciones HEEL",
        ingestion: "Ingesta",
        vocabulary: "Vocabulario",
        genomicParse: "Análisis genómico",
        poseidon: "ETL Poseidon",
        fhirExport: "Exportación FHIR",
        fhirSync: "Sincronización FHIR",
        gisImport: "Importación GIS",
        gisBoundaries: "Límites GIS",
      },
    },
    actions: {
      retry: "Reintentar",
      retryJob: "Reintentar tarea",
      cancel: "Cancelar",
      cancelJob: "Cancelar tarea",
      previous: "Anterior",
      next: "Siguiente",
    },
    drawer: {
      titleFallback: "Detalles de la tarea",
      loadError: "No se pudieron cargar los detalles de la tarea.",
      sections: {
        executionLog: "Registro de ejecución",
        analysis: "Análisis",
        cohort: "Cohorte",
        ingestionPipeline: "Canal de ingesta",
        fhirSync: "Sincronización FHIR",
        dataQuality: "Calidad de datos",
        heelChecks: "Validaciones HEEL",
        achillesAnalyses: "Análisis Achilles",
        genomicParse: "Análisis genómico",
        poseidonEtl: "ETL Poseidon",
        careGapEvaluation: "Evaluación de brechas de atención",
        gisBoundaries: "Límites GIS",
        gisImport: "Importación GIS",
        vocabularyImport: "Importación de vocabulario",
        fhirExport: "Exportación FHIR",
        overview: "Resumen",
        output: "Salida",
      },
      labels: {
        analysis: "Análisis",
        createdBy: "Creado por",
        parameters: "Parámetros",
        cohort: "Cohorte",
        personCount: "Conteo de personas",
        source: "Origen",
        sourceKey: "Clave de origen",
        stage: "Etapa",
        project: "Proyecto",
        file: "Archivo",
        fileSize: "Tamaño del archivo",
        mappingCoverage: "Cobertura de mapeo",
        processed: "Procesados",
        failed: "Fallidos",
        filesDownloaded: "Archivos descargados",
        recordsExtracted: "Registros extraídos",
        recordsMapped: "Registros mapeados",
        recordsWritten: "Registros escritos",
        recordsFailed: "Registros fallidos",
        passed: "Aprobados",
        passRate: "Tasa de aprobación",
        expectedChecks: "Validaciones esperadas",
        executionTime: "Tiempo de ejecución",
        failingChecks: "Validaciones fallidas",
        totalRules: "Reglas totales",
        rulesTriggered: "Reglas activadas",
        totalViolations: "Violaciones totales",
        topViolations: "Principales violaciones",
        completed: "Completados",
        byCategory: "Por categoría",
        failedSteps: "Pasos fallidos",
        format: "Formato",
        totalVariants: "Variantes totales",
        mappedVariants: "Variantes mapeadas",
        samples: "Muestras",
        runType: "Tipo de ejecución",
        dagsterRunId: "ID de ejecución de Dagster",
        stats: "Estadísticas",
        bundle: "Paquete",
        complianceSummary: "Resumen de cumplimiento",
        dataset: "Conjunto de datos",
        dataType: "Tipo de datos",
        version: "Versión",
        geometry: "Geometría",
        features: "Entidades",
        tablesLoaded: "Tablas cargadas",
        recordsLoaded: "Registros cargados",
        outputFormat: "Formato de salida",
        type: "Tipo",
        triggeredBy: "Iniciado por",
        duration: "Duración",
        started: "Inicio",
        created: "Creado",
        error: "Error",
      },
      messages: {
        stalled:
          "Esta tarea se detuvo y se marcó como fallida tras superar el tiempo límite de 1 hora.",
        failedCount: "{{count}} fallidos",
        runningCount: "{{count}} en ejecución",
        ofTotal: "de {{count}}",
        records: "{{count}} registros",
      },
    },
  },
};

const koApp: MessageTree = {
  analysis: {
    titles: {
      characterization: "특성화",
      incidenceRate: "발생률 분석",
      pathway: "경로 분석",
      estimation: "추정 분석",
      prediction: "예측 분석",
      sccs: "SCCS 분석",
      evidenceSynthesis: "근거 합성 분석",
    },
  },
  errors: {
    boundary: {
      title: "문제가 발생했습니다",
      message: "예기치 않은 오류가 발생했습니다. 페이지를 다시 불러오세요.",
      reloadPage: "페이지 새로고침",
    },
    route: {
      routeError: "라우트 오류",
      pageFailed: "페이지를 렌더링하지 못했습니다.",
      analysisDescription:
        "이 분석 페이지에서 렌더링 또는 라우트 로딩 오류가 발생했습니다.",
      label: "오류",
      backToAnalyses: "분석으로 돌아가기",
      reloadPage: "페이지 새로고침",
    },
  },
  covariates: {
    title: "공변량 설정",
    description:
      "FeatureExtraction에 공변량으로 포함할 도메인을 선택합니다.",
    groups: {
      core: "핵심 도메인",
      extended: "확장 도메인",
      indices: "동반질환 지수",
    },
    labels: {
      demographics: "인구통계",
      conditionOccurrence: "질환 발생",
      drugExposure: "약물 노출",
      procedureOccurrence: "시술 발생",
      measurement: "측정",
      observation: "관찰",
      deviceExposure: "기기 노출",
      visitCount: "방문 횟수",
      charlsonComorbidity: "Charlson 동반질환",
      dcsi: "DCSI (당뇨병)",
      chads2: "CHADS2",
      chads2Vasc: "CHA2DS2-VASc",
    },
    timeWindows: "시간 창",
    to: "~",
    days: "일",
    addTimeWindow: "시간 창 추가",
  },
  studies: {
    list: {
      title: "연구",
      subtitle: "연합 연구를 조율하고 관리합니다",
      tableView: "표 보기",
      cardView: "카드 보기",
      searchPlaceholder: "연구 검색...",
      noSearchMatches: "\"{{query}}\"와 일치하는 연구가 없습니다",
      typeToFilter: "{{count}}개 연구를 필터링하려면 입력하세요",
      newStudy: "새 연구",
      solr: "Solr",
      drilldownTitle: "{{phase}} 연구",
      filterLabels: {
        status: "상태",
        type: "유형",
        priority: "우선순위",
      },
      loadFailed: "연구를 불러오지 못했습니다",
      clear: "지우기",
      empty: {
        noMatchingTitle: "일치하는 연구가 없습니다",
        noStudiesTitle: "아직 연구가 없습니다",
        noResultsFor: "\"{{query}}\"에 대한 연구를 찾을 수 없습니다",
        tryAdjusting: "검색어를 조정해 보세요.",
        createFirst: "첫 연구를 만들어 연합 연구를 조율하세요.",
      },
      table: {
        title: "제목",
        type: "유형",
        status: "상태",
        priority: "우선순위",
        pi: "책임 연구자",
        created: "생성일",
      },
      pagination: {
        showing: "총 {{total}}개 중 {{start}} - {{end}}개 표시",
        page: "{{page}} / {{totalPages}}",
      },
    },
    metrics: {
      total: "전체",
      active: "활성",
      preStudy: "연구 전",
      inProgress: "진행 중",
      postStudy: "연구 후",
    },
    studyTypes: {
      characterization: "특성화",
      populationLevelEstimation: "PLE",
      patientLevelPrediction: "PLP",
      comparativeEffectiveness: "비교",
      safetySurveillance: "안전성",
      drugUtilization: "약물 사용",
      qualityImprovement: "QI",
      custom: "사용자 정의",
    },
    statuses: {
      draft: "초안",
      protocol_development: "프로토콜 개발",
      feasibility: "타당성",
      irb_review: "IRB 심의",
      execution: "실행",
      analysis: "분석",
      published: "게시됨",
      archived: "보관됨",
    },
    priorities: {
      critical: "긴급",
      high: "높음",
      medium: "보통",
      low: "낮음",
    },
    phases: {
      activeMetric: "활성",
      pre_study: "연구 전",
      active: "진행 중",
      post_study: "연구 후",
    },
    create: {
      backToStudies: "연구",
      title: "연구 만들기",
      subtitle: "연구를 단계별로 구성합니다",
      previous: "이전",
      next: "다음",
      createAsDraft: "초안으로 만들기",
      steps: {
        basics: "기본 정보",
        science: "과학적 설계",
        team: "팀 및 일정",
        review: "검토 및 생성",
      },
      studyTypes: {
        characterization: {
          label: "특성화",
          description: "환자 집단과 치료 패턴을 설명합니다",
        },
        populationLevelEstimation: {
          label: "인구 수준 추정",
          description: "관찰 데이터를 사용해 인과 효과를 추정합니다",
        },
        patientLevelPrediction: {
          label: "환자 수준 예측",
          description: "개별 환자 결과를 예측합니다",
        },
        comparativeEffectiveness: {
          label: "비교 효과",
          description: "실사용 환경에서 치료를 비교합니다",
        },
        safetySurveillance: {
          label: "안전성 감시",
          description: "시판 후 약물 안전성 신호를 모니터링합니다",
        },
        drugUtilization: {
          label: "약물 사용",
          description: "약물 사용 패턴과 추세를 분석합니다",
        },
        qualityImprovement: {
          label: "품질 개선",
          description: "진료 품질과 지침 준수를 평가합니다",
        },
        custom: {
          label: "사용자 정의",
          description: "사용자 정의 연구 유형을 정의합니다",
        },
      },
      designs: {
        select: "설계를 선택하세요...",
        retrospectiveCohort: "후향적 코호트",
        prospectiveCohort: "전향적 코호트",
        caseControl: "환자-대조군",
        crossSectional: "횡단면",
        selfControlled: "자가대조 사례군",
        nestedCaseControl: "중첩 환자-대조군",
        metaAnalysis: "메타분석",
        networkStudy: "네트워크 연구",
        methodological: "방법론 연구",
      },
      phases: {
        select: "단계를 선택하세요...",
        phaseI: "1상",
        phaseII: "2상",
        phaseIII: "3상",
        phaseIV: "4상",
        notApplicable: "해당 없음",
      },
      basics: {
        studyType: "연구 유형 *",
        title: "제목 *",
        titlePlaceholder: "예: T2DM에서 스타틴이 심혈관 결과에 미치는 영향",
        shortTitle: "짧은 제목",
        shortTitlePlaceholder: "예: LEGEND-T2DM",
        priority: "우선순위",
        studyDesign: "연구 설계",
        description: "설명",
        descriptionPlaceholder: "연구에 대한 간단한 설명...",
        tags: "태그",
        tagsPlaceholder: "태그를 추가하고 Enter를 누르세요...",
        addTag: "태그 추가",
      },
      science: {
        aiPrompt:
          "연구 제목을 바탕으로 AI가 과학적 설계 필드를 제안하게 합니다",
        generating: "생성 중...",
        generateWithAi: "AI로 생성",
        aiUnavailable:
          "AI 서비스를 사용할 수 없습니다. 필드를 수동으로 입력하세요.",
        rationale: "과학적 근거",
        rationalePlaceholder:
          "이 연구가 왜 필요한가요? 어떤 지식 격차를 다루나요?",
        hypothesis: "가설",
        hypothesisPlaceholder: "검정할 주요 가설을 작성하세요...",
        primaryObjective: "주요 목적",
        primaryObjectivePlaceholder: "이 연구의 주요 목적은 무엇인가요?",
        secondaryObjectives: "보조 목적",
        secondaryObjectivePlaceholder: "목적을 추가하고 Enter를 누르세요...",
        addSecondaryObjective: "보조 목적 추가",
        fundingSource: "연구비 출처",
        fundingSourcePlaceholder: "예: NIH R01, PCORI, 산업체 후원",
      },
      team: {
        startDate: "연구 시작일",
        endDate: "연구 종료일",
        endDateAfterStart: "종료일은 시작일 이후여야 합니다",
        targetSites: "목표 등록 사이트",
        targetSitesPlaceholder: "예: 10",
        studyPhase: "연구 단계",
        nctId: "ClinicalTrials.gov ID",
        nctIdPlaceholder: "예: NCT12345678",
        note:
          "팀원, 사이트, 코호트는 연구 생성 후 연구 대시보드에서 구성할 수 있습니다.",
      },
      review: {
        basics: "기본 정보",
        scientificDesign: "과학적 설계",
        timelineRegistration: "일정 및 등록",
        labels: {
          title: "제목:",
          shortTitle: "짧은 제목:",
          type: "유형:",
          priority: "우선순위:",
          design: "설계:",
          rationale: "근거:",
          hypothesis: "가설:",
          primaryObjective: "주요 목적:",
          secondaryObjectives: "보조 목적:",
          start: "시작:",
          end: "종료:",
          targetSites: "목표 사이트:",
          phase: "단계:",
          nctId: "NCT ID:",
          funding: "연구비:",
        },
      },
    },
    detail: {
      loadFailed: "연구를 불러오지 못했습니다",
      backToStudies: "연구로 돌아가기",
      studies: "연구",
      confirmDelete: "이 연구를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      confirmArchive: "이 연구를 보관하시겠습니까? 나중에 복원할 수 있습니다.",
      copyTitle: "{{title}} 사본",
      tabs: {
        overview: "개요",
        design: "설계",
        analyses: "분석",
        results: "결과",
        progress: "진행 상황",
        sites: "사이트",
        team: "팀",
        cohorts: "코호트",
        milestones: "마일스톤",
        artifacts: "아티팩트",
        activity: "활동",
        federated: "연합",
      },
      statuses: {
        draft: "초안",
        protocol_development: "프로토콜 개발",
        feasibility: "타당성",
        irb_review: "IRB 심의",
        recruitment: "모집",
        execution: "실행",
        analysis: "분석",
        synthesis: "합성",
        manuscript: "원고",
        published: "게시됨",
        archived: "보관됨",
        withdrawn: "철회됨",
      },
      studyTypes: {
        characterization: "특성화",
        population_level_estimation: "인구 수준 추정",
        patient_level_prediction: "환자 수준 예측",
        comparative_effectiveness: "비교 효과",
        safety_surveillance: "안전성 감시",
        drug_utilization: "약물 사용",
        quality_improvement: "품질 개선",
        custom: "사용자 정의",
      },
      actions: {
        transitionTo: "다음 상태로 변경",
        generateManuscriptTitle: "완료된 분석에서 원고 생성",
        manuscript: "원고",
        duplicateStudy: "연구 복제",
        exportJson: "JSON으로 내보내기",
        archiveStudy: "연구 보관",
        deleteStudy: "연구 삭제",
      },
      sections: {
        about: "개요",
        analysisPipeline: "분석 파이프라인 ({{count}})",
        executionProgress: "실행 진행 상황",
        details: "세부 정보",
        timeline: "일정",
        tags: "태그",
        createdBy: "생성자",
      },
      labels: {
        primaryObjective: "주요 목적",
        hypothesis: "가설",
        secondaryObjectives: "보조 목적",
        principalInvestigator: "책임 연구자",
        leadDataScientist: "주요 데이터 과학자",
        studyDesign: "연구 설계",
        phase: "단계",
        protocolVersion: "프로토콜 버전",
        funding: "연구비",
        clinicalTrialsGov: "ClinicalTrials.gov",
        start: "시작:",
        end: "종료:",
        targetSites: "목표 사이트:",
        created: "생성:",
      },
      messages: {
        noDescription: "설명이 제공되지 않았습니다",
        moreAnalyses: "+{{count}}개 분석 더 보기",
      },
      progress: {
        completed: "완료 {{count}}개",
        running: "실행 중 {{count}}개",
        failed: "실패 {{count}}개",
        pending: "대기 중 {{count}}개",
      },
    },
    dashboard: {
      progressSummary: "전체 {{total}}개 중 {{completed}}개 분석 완료",
      stats: {
        total: "전체",
        pending: "대기 중",
        running: "실행 중",
        completed: "완료",
        failed: "실패",
      },
      sections: {
        studyAnalyses: "연구 분석",
      },
      table: {
        type: "유형",
        name: "이름",
        status: "상태",
      },
      messages: {
        notExecuted: "실행되지 않음",
      },
      empty: {
        title: "이 연구에 분석이 없습니다",
        message: "시작하려면 설계 탭에서 분석을 추가하세요.",
      },
    },
    analyses: {
      selectSource: "소스 선택...",
      executeAll: "모두 실행",
      addAnalysisToStudy: "연구에 분석 추가",
      emptyMessage:
        "분석 파이프라인을 만들려면 특성화, 추정, 예측 등을 추가하세요",
      groupHeader: "{{label}} ({{count}})",
      openAnalysisDetail: "분석 세부 정보 열기",
      confirmRemove: "이 분석을 연구에서 제거하시겠습니까?",
      removeFromStudy: "연구에서 제거",
      analysisId: "분석 ID",
      lastRun: "마지막 실행",
      error: "오류",
      viewFullDetail: "전체 세부 정보 보기",
    },
    results: {
      sections: {
        results: "결과 ({{count}})",
        syntheses: "합성 ({{count}})",
      },
      actions: {
        synthesize: "합성",
        markPrimary: "주요 결과로 표시",
        unmarkPrimary: "주요 결과 표시 해제",
        markPublishable: "게시 가능으로 표시",
        unmarkPublishable: "게시 가능 표시 해제",
        cancel: "취소",
      },
      filters: {
        allTypes: "모든 유형",
        publishableOnly: "게시 가능 항목만",
      },
      empty: {
        noResultsTitle: "아직 결과가 없습니다",
        noResultsMessage: "분석이 실행된 후 결과가 여기에 표시됩니다",
        noSummaryData: "사용 가능한 요약 데이터가 없습니다",
        noSynthesesTitle: "합성이 없습니다",
        noSynthesesMessage: "메타분석으로 여러 사이트의 결과를 결합하세요",
      },
      resultTypes: {
        cohort_count: "코호트 수",
        characterization: "특성화",
        incidence_rate: "발생률",
        effect_estimate: "효과 추정치",
        prediction_performance: "예측 성능",
        pathway: "경로",
        sccs: "SCCS",
        custom: "사용자 정의",
      },
      synthesisTypes: {
        fixed_effects_meta: "고정효과 메타분석",
        random_effects_meta: "무작위효과 메타분석",
        bayesian_meta: "베이지안 메타분석",
        forest_plot: "포리스트 플롯",
        heterogeneity_analysis: "이질성 분석",
        funnel_plot: "퍼널 플롯",
        evidence_synthesis: "근거 합성",
        custom: "사용자 정의",
      },
      badges: {
        primary: "주요",
        publishable: "게시 가능",
      },
      messages: {
        resultCreated: "결과 #{{id}} · {{date}}",
        reviewedBy: "{{name}} 검토",
      },
      labels: {
        summary: "요약",
        diagnostics: "진단",
      },
      pagination: {
        previous: "이전",
        next: "다음",
        page: "{{totalPages}}페이지 중 {{page}}페이지",
      },
      synthesis: {
        createTitle: "합성 만들기",
        instructions: "위에서 결과 2개 이상을 선택한 다음 합성 방법을 선택하세요.",
        createSelected: "생성 ({{count}}개 선택됨)",
        confirmDelete: "이 합성을 삭제하시겠습니까?",
        resultsCount: "결과 {{count}}개",
        system: "시스템",
        methodSettings: "방법 설정",
        output: "출력",
        noOutput: "아직 출력이 생성되지 않았습니다",
      },
    },
    federated: {
      loadingResults: "결과를 불러오는 중...",
      loadResultsFailed: "결과를 불러오지 못했습니다: {{error}}",
      unknownError: "알 수 없는 오류",
      confirmDistribute: "연구를 데이터 노드 {{count}}개에 배포하시겠습니까?",
      arachneNotReachable: "Arachne Central에 연결할 수 없습니다",
      loadNodesFailed: "Arachne 노드를 불러오지 못했습니다",
      arachneConnectionHelp:
        "연합 실행을 활성화하려면 환경에 ARACHNE_URL을 설정하세요. Arachne Central이 실행 중이고 접근 가능한지 확인하세요.",
      availableDataNodes: "사용 가능한 데이터 노드",
      poweredByArachne: "Arachne 제공",
      distributeCount: "배포 ({{count}})",
      noNodes:
        "구성된 Arachne 노드가 없습니다. 연합 실행을 활성화하려면 환경에 ARACHNE_URL을 설정하세요.",
      distributionFailed: "배포 실패: {{error}}",
      distributionSucceeded: "연구가 성공적으로 배포되었습니다. 아래에서 상태를 모니터링합니다.",
      federatedExecutions: "연합 실행",
      noExecutions: "아직 연합 실행이 없습니다. 위에서 데이터 노드를 선택하고 배포하세요.",
      arachneAnalysis: "Arachne 분석 #{{id}}",
      statuses: {
        PENDING: "대기 중",
        EXECUTING: "실행 중",
        COMPLETED: "완료",
        FAILED: "실패",
      },
      table: {
        name: "이름",
        status: "상태",
        cdmVersion: "CDM 버전",
        patients: "환자",
        lastSeen: "마지막 확인",
        node: "노드",
        submitted: "제출됨",
        completed: "완료됨",
      },
    },
    artifacts: {
      sections: {
        artifacts: "아티팩트 ({{count}})",
      },
      actions: {
        addArtifact: "아티팩트 추가",
        cancel: "취소",
        create: "생성",
        save: "저장",
        edit: "아티팩트 편집",
        delete: "아티팩트 삭제",
        openLink: "링크 열기",
      },
      form: {
        addTitle: "연구 아티팩트 추가",
        title: "제목",
        titleRequired: "제목 *",
        titlePlaceholder: "예: 연구 프로토콜 v2.1",
        version: "버전",
        type: "유형",
        urlOptional: "URL (선택 사항)",
        description: "설명",
        descriptionOptional: "설명 (선택 사항)",
        descriptionPlaceholder: "이 아티팩트에 대한 간단한 설명...",
      },
      empty: {
        title: "아티팩트가 없습니다",
        message: "프로토콜, 분석 패키지, 연구 문서를 저장하세요",
      },
      badges: {
        current: "현재",
      },
      labels: {
        versionValue: "v{{version}}",
        sizeKb: "{{size}} KB",
      },
      messages: {
        unknown: "알 수 없음",
        uploadedBy: "{{name}} · {{date}}",
      },
      confirmDelete: "이 아티팩트를 삭제하시겠습니까?",
      types: {
        protocol: "프로토콜",
        sap: "통계 분석 계획",
        irb_submission: "IRB 제출 문서",
        cohort_json: "코호트 JSON",
        analysis_package_r: "R 분석 패키지",
        analysis_package_python: "Python 분석 패키지",
        results_report: "결과 보고서",
        manuscript_draft: "원고 초안",
        supplementary: "보충 자료",
        presentation: "발표 자료",
        data_dictionary: "데이터 사전",
        study_package_zip: "연구 패키지 ZIP",
        other: "기타",
      },
    },
    sites: {
      sections: {
        sites: "사이트 ({{count}})",
      },
      actions: {
        addSite: "사이트 추가",
        cancel: "취소",
        save: "저장",
        edit: "사이트 편집",
        remove: "사이트 제거",
      },
      form: {
        addTitle: "데이터 파트너 사이트 추가",
        sourceSearchPlaceholder: "데이터 소스 검색...",
        siteRole: "사이트 역할",
        irbProtocol: "IRB 프로토콜 #",
        notes: "메모",
        optional: "선택 사항",
      },
      empty: {
        title: "등록된 사이트가 없습니다",
        message: "이 연구에 데이터 파트너 사이트를 추가하세요",
      },
      table: {
        source: "소스",
        role: "역할",
        status: "상태",
        irb: "IRB #",
        patients: "환자",
        cdm: "CDM",
      },
      messages: {
        allSourcesAssigned: "모든 소스가 이미 할당되었습니다",
        noMatchingSources: "일치하는 소스가 없습니다",
        sourceFallback: "소스 #{{id}}",
      },
      confirmRemove: "이 사이트를 제거하시겠습니까?",
      roles: {
        data_partner: "데이터 파트너",
        coordinating_center: "조정 센터",
        analytics_node: "분석 노드",
        observer: "관찰자",
      },
      statuses: {
        pending: "대기 중",
        invited: "초대됨",
        approved: "승인됨",
        active: "활성",
        completed: "완료됨",
        withdrawn: "철회됨",
      },
    },
    cohorts: {
      sections: {
        cohorts: "코호트 ({{count}})",
      },
      actions: {
        assignCohort: "코호트 할당",
        assign: "할당",
        cancel: "취소",
        save: "저장",
        edit: "코호트 할당 편집",
        remove: "코호트 할당 제거",
      },
      form: {
        assignTitle: "코호트 정의 할당",
        cohortDefinition: "코호트 정의",
        searchPlaceholder: "코호트 정의 검색...",
        role: "역할",
        label: "레이블",
        labelRequired: "레이블 *",
        labelPlaceholder: "예: T2DM 대상 집단",
        description: "설명",
        optional: "선택 사항",
      },
      empty: {
        title: "할당된 코호트가 없습니다",
        message: "코호트 정의를 할당하고 이 연구에서의 역할을 지정하세요",
      },
      messages: {
        allAssigned: "모든 코호트 정의가 이미 할당되었습니다",
        noMatchingCohorts: "일치하는 코호트가 없습니다",
        cohortFallback: "코호트 #{{id}}",
      },
      confirmRemove: "이 코호트 할당을 제거하시겠습니까?",
      roles: {
        target: "대상",
        comparator: "비교군",
        outcome: "결과",
        exclusion: "제외",
        subgroup: "하위군",
        event: "이벤트",
      },
    },
    team: {
      sections: {
        members: "팀 멤버 ({{count}})",
      },
      actions: {
        addMember: "멤버 추가",
        cancel: "취소",
        save: "저장",
        edit: "팀 멤버 편집",
        remove: "팀 멤버 제거",
      },
      form: {
        addTitle: "팀 멤버 추가",
        user: "사용자",
        userSearchPlaceholder: "이름 또는 이메일로 사용자 검색...",
        role: "역할",
      },
      empty: {
        title: "팀 멤버가 없습니다",
        message: "이 연구에 연구자와 협업자를 추가하세요",
      },
      table: {
        name: "이름",
        email: "이메일",
        role: "역할",
        status: "상태",
        joined: "참여일",
      },
      messages: {
        allUsersAssigned: "모든 사용자가 이미 팀 멤버입니다",
        noMatchingUsers: "일치하는 사용자가 없습니다",
        userFallback: "사용자 #{{id}}",
      },
      confirmRemove: "이 팀 멤버를 제거하시겠습니까?",
      statuses: {
        active: "활성",
        inactive: "비활성",
      },
      roles: {
        principal_investigator: "책임 연구자",
        co_investigator: "공동 연구자",
        data_scientist: "데이터 과학자",
        statistician: "통계 담당자",
        site_lead: "사이트 책임자",
        data_analyst: "데이터 분석가",
        research_coordinator: "연구 코디네이터",
        irb_liaison: "IRB 연락 담당자",
        project_manager: "프로젝트 관리자",
        observer: "관찰자",
      },
      roleDescriptions: {
        principal_investigator: "연구를 책임지는 주 연구자",
        co_investigator: "연구 감독에 참여하는 공동 연구자",
        data_scientist: "분석 파이프라인을 개발하고 실행합니다",
        statistician: "통계 분석과 방법론을 담당합니다",
        site_lead: "데이터 파트너 사이트 운영을 관리합니다",
        data_analyst: "데이터 처리와 품질 점검을 담당합니다",
        research_coordinator: "연구 물류와 일정을 조율합니다",
        irb_liaison: "IRB 제출과 준수를 관리합니다",
        project_manager: "전체 프로젝트 계획과 추적을 담당합니다",
        observer: "연구 자료에 읽기 전용으로 접근합니다",
      },
    },
    milestones: {
      sections: {
        milestones: "마일스톤 ({{count}})",
      },
      actions: {
        addMilestone: "마일스톤 추가",
        cancel: "취소",
        create: "생성",
        save: "저장",
        edit: "마일스톤 편집",
        delete: "마일스톤 삭제",
      },
      form: {
        titlePlaceholder: "마일스톤 제목...",
      },
      empty: {
        title: "마일스톤이 없습니다",
        message: "마일스톤과 목표일로 연구 진행 상황을 추적하세요",
      },
      labels: {
        target: "목표: {{date}}",
        targetCompleted: "목표: {{target}} | 완료: {{completed}}",
      },
      confirmDelete: "이 마일스톤을 삭제하시겠습니까?",
      types: {
        protocol: "프로토콜",
        irb: "IRB",
        data_access: "데이터 접근",
        analysis: "분석",
        review: "검토",
        publication: "출판",
        custom: "사용자 정의",
      },
      statuses: {
        pending: "대기 중",
        in_progress: "진행 중",
        completed: "완료됨",
        overdue: "기한 초과",
        cancelled: "취소됨",
      },
    },
    activity: {
      title: "활동 로그",
      empty: {
        title: "아직 활동이 없습니다",
        message: "이 연구에서 수행된 작업이 여기에 표시됩니다",
      },
      pagination: {
        previous: "이전",
        next: "다음",
        page: "{{totalPages}}페이지 중 {{page}}페이지",
      },
      actions: {
        created: "생성됨",
        updated: "업데이트됨",
        deleted: "삭제됨",
        status_changed: "상태 변경됨",
        member_added: "멤버 추가됨",
        member_removed: "멤버 제거됨",
        site_added: "사이트 추가됨",
        analysis_added: "분석 추가됨",
        executed: "실행됨",
      },
      entities: {
        study: "연구",
        study_analysis: "연구 분석",
        study_artifact: "연구 아티팩트",
        study_cohort: "연구 코호트",
        study_milestone: "연구 마일스톤",
        study_site: "연구 사이트",
        study_team_member: "연구 팀 멤버",
      },
    },
    designer: {
      defaultSessionTitle: "{{title}} OHDSI 설계",
      title: "OHDSI 연구 설계 컴파일러",
      subtitle:
        "검토된 연구 질문을 추적 가능한 개념 세트, 코호트, 실행 가능성 근거, HADES용 분석 계획, 잠긴 연구 패키지로 변환합니다.",
      researchQuestionPlaceholder:
        "...이 있는 성인에서 ...이 ...와 비교해 ...를 줄이나요?",
      badges: {
        session: "세션 {{value}}",
        version: "버전 {{value}}",
      },
      versionStatuses: {
        generated: "생성됨",
        review_ready: "검토 준비됨",
        accepted: "승인됨",
        locked: "잠김",
      },
      metrics: {
        assets: "자산",
      },
      actions: {
        downloadLockedPackage: "잠긴 패키지 다운로드",
        downloadPackage: "패키지 다운로드",
        add: "추가",
        saveChanges: "변경 사항 저장",
      },
      sections: {
        verificationGates: "검증 게이트",
        packageProvenance: "패키지 출처",
        assetEvidence: "자산 근거",
        basicInformation: "기본 정보",
        addAnalysis: "분석 추가",
        studyAnalyses: "연구 분석 ({{count}})",
      },
      descriptions: {
        verificationGates: "OHDSI 패키지를 잠그기 전에 차단 항목을 해결하세요.",
        assetEvidence: "패키지를 승인하기 전에 차단된 검증기 출력을 검토하세요.",
      },
      gates: {
        designIntent: "설계 의도",
        acceptedAt: "{{time}}에 승인됨",
        acceptResearchQuestion: "검토된 연구 질문을 승인하세요.",
        verifiedMaterializedCohorts: "검증된 구체화 코호트 {{count}}개",
        feasibilityReady: "검증된 실행 가능성 근거가 준비되었습니다.",
        runFeasibility: "코호트 검증 후 실행 가능성을 실행하세요.",
        analysisPlan: "분석 계획",
        analysisPlanReady: "검증된 HADES 분석 계획이 준비되었습니다.",
        verifyAnalysisPlan: "분석 계획을 검증하고 구체화하세요.",
      },
      labels: {
        version: "버전",
        versionStatus: "v{{version}} {{status}}",
        verifiedAssets: "검증된 자산",
        title: "제목",
        description: "설명",
        studyType: "연구 유형",
        analysisType: "분석 유형",
        analysis: "분석",
        missingOmopIds: "누락된 OMOP ID",
        deprecatedOmopIds: "사용 중단된 OMOP ID",
        invalidDraftIds: "잘못된 초안 ID",
      },
      placeholders: {
        studyTitle: "연구 제목",
        optionalDescription: "선택 설명",
        selectAnalysis: "분석 선택...",
      },
      analysisTypes: {
        characterization: "특성화",
        "incidence-rate": "발생률",
        pathway: "경로",
        estimation: "추정",
        prediction: "예측",
      },
      messages: {
        new: "새 항목",
        none: "없음",
        notStarted: "시작되지 않음",
        createOrImport: "시작하려면 설계를 만들거나 가져오세요.",
        needsEvidence: "근거 필요",
        noVersion: "버전 없음",
        blockedCount: "차단됨 {{count}}개",
        noBlockers: "차단 항목 없음",
        startEvidenceReview:
          "근거 검토를 시작하려면 의도를 생성하거나 현재 연구를 가져오세요.",
        noAnalyses: "아직 추가된 분석이 없습니다.",
        analysisFallback: "분석 #{{id}}",
        assetId: "자산 #{{id}}",
        materializedId: "구체화됨 #{{id}}",
        verifiedAt: "{{time}}에 검증됨",
      },
    },
    workbench: {
      sessionTitle: "연구 의도 설계",
      title: "연구 설계 컴파일러",
      subtitle:
        "연구 질문을 OHDSI에 맞춘 검토 완료 연구 의도로 변환하고, 다음 단계로 이동하기 전에 재사용 가능한 표현형 자산을 검토합니다.",
      newSession: "새 세션",
      sessions: "세션",
      researchQuestion: "연구 질문",
      researchQuestionPlaceholder:
        "심근경색 후 클로피도그렐을 시작한 환자와 아스피린을 시작한 환자의 재발 MACE를 비교합니다.",
      emptyQuestionPlaceholder: "연구 질문을 설명하세요...",
      generateIntent: "의도 생성",
      startSession:
        "설계 세션을 시작한 다음 연구 질문에서 구조화된 PICO 의도를 생성합니다.",
      createAndGenerate: "세션 생성 및 의도 생성",
      loadingSessions: "설계 세션을 불러오는 중...",
      sections: {
        phenotypeRecommendations: "표현형 및 재사용 추천",
        conceptSetDrafts: "개념 세트 초안",
        cohortDrafts: "코호트 초안",
        cohortReadiness: "연구 코호트 준비 상태",
        feasibility: "실행 가능성",
        sources: "소스",
        attrition: "탈락",
        analysisPlans: "분석 계획",
        packageLock: "패키지 잠금",
        currentAssets: "현재 연구 자산",
        intentReview: "의도 검토",
        source: "소스",
        governance: "거버넌스",
      },
      descriptions: {
        recommendations:
          "새로 작성하기 전에 재사용 가능한 표현형 라이브러리 항목, 로컬 코호트, 로컬 개념 세트를 검토합니다.",
        conceptSets:
          "기본 개념 세트를 만들기 전에 승인된 근거를 어휘 검증이 된 초안으로 변환합니다.",
        cohorts:
          "구체화된 개념 세트를 기본 코호트 정의 초안으로 변환합니다.",
        feasibility:
          "분석 계획 전에 연결된 코호트를 선택한 CDM 소스에서 확인합니다.",
        analysisPlans:
          "실행 가능한 연구 코호트를 HADES 호환 기본 분석 설계로 컴파일합니다.",
        packageLock:
          "승인된 의도, 개념 세트, 코호트, 실행 가능성, 기본 분석을 감사 가능한 연구 패키지로 고정합니다.",
        currentAssets:
          "수동으로 만든 코호트와 분석을 이 설계 경로로 가져오고 기존 기록을 변경하지 않고 격차를 검토합니다.",
      },
      actions: {
        recommend: "추천",
        draftConceptSets: "개념 세트 초안 작성",
        draftCohorts: "코호트 초안 작성",
        runFeasibility: "실행 가능성 실행",
        draftPlans: "계획 초안 작성",
        importCurrent: "현재 항목 가져오기",
        critique: "비평",
        verify: "검증",
        review: "검토",
        accept: "승인",
        defer: "보류",
        reject: "거부",
        materialize: "구체화",
        openNativeEditor: "기본 편집기 열기",
        linkToStudy: "연구에 연결",
        search: "검색",
        add: "추가",
        remove: "제거",
        saveReview: "검토 저장",
        acceptIntent: "의도 승인",
        lockPackage: "패키지 잠금",
        locked: "잠김",
        downloadPackageSummary: "패키지 요약 다운로드",
      },
      labels: {
        verified: "검증됨",
        needsCheck: "확인 필요",
        blocked: "차단됨",
        unverified: "미검증",
        reviewQueue: "검토 대기열",
        conceptSetDraft: "개념 세트 초안",
        cohortDraft: "코호트 초안",
        concepts: "개념",
        concept: "개념",
        domain: "도메인",
        vocabulary: "어휘",
        flags: "플래그",
        actions: "작업",
        lint: "검사",
        source: "소스",
        status: "상태",
        cohorts: "코호트",
        coverage: "범위",
        domains: "도메인",
        freshness: "최신성",
        dqd: "DQD",
        attrition: "탈락",
        nativeConceptSet: "기본 개념 세트 #{{id}}",
        nativeCohort: "기본 코호트 #{{id}}",
        linkedStudyCohort: "연결된 연구 코호트 #{{id}}",
        conceptsCount: "개념 {{count}}개",
        conceptSetsCount: "개념 세트 {{count}}개",
        nativeAnalysis: "기본 분석 #{{id}}",
        feasibility: "실행 가능성",
        rank: "순위 {{score}}",
        match: "{{score}}% 일치",
        ohdsiId: "OHDSI #{{id}}",
        computable: "계산 가능",
        imported: "가져옴",
        evidence: "근거",
        origin: "출처",
        matchedTerm: "일치 용어",
        canonicalRecord: "표준 기록",
        noCanonicalRecord: "표준 기록 없음",
        eligibility: "적격성",
        acceptable: "승인 가능",
        blockedOrNeedsReview: "차단됨 또는 검토 필요",
        policy: "정책",
        nextActions: "다음 작업",
        rankComponents: "순위 구성 요소",
        verifierChecks: "검증기 검사",
        versionStatus: "버전 {{version}} · {{status}}",
        primaryObjective: "주요 목적",
        population: "대상 집단",
        exposure: "노출",
        comparator: "비교군",
        primaryOutcome: "주요 결과",
        timeAtRisk: "위험 기간",
        conceptSetsMetric: "개념 세트",
        cohortsMetric: "코호트",
        analysesMetric: "분석",
        packagesMetric: "패키지",
        aiEvents: "AI 이벤트",
        reviewed: "검토됨",
        manifest: "매니페스트",
        critiques: "비평",
      },
      messages: {
        saveOrAcceptBeforeRecommendations:
          "추천을 요청하기 전에 검토 가능한 의도를 저장하거나 의도를 승인하세요.",
        loadingRecommendations: "추천을 불러오는 중...",
        noRecommendations: "아직 추천이 없습니다.",
        acceptRecommendationFirst:
          "먼저 검증된 표현형, 코호트 또는 개념 세트 추천을 하나 이상 승인하세요.",
        noConceptSetDrafts: "아직 개념 세트 초안이 없습니다.",
        onlyVerifiedConceptSetDrafts:
          "검증된 개념 세트 초안만 승인할 수 있습니다.",
        searchConceptsPlaceholder: "OMOP 어휘 개념 검색",
        materializeConceptSetFirst:
          "먼저 검증된 개념 세트 초안을 하나 이상 구체화하세요.",
        noCohortDrafts: "아직 코호트 초안이 없습니다.",
        checkingLinkedRoles: "연결된 역할 확인 중...",
        noReadinessSignal: "아직 준비 상태 신호가 없습니다.",
        ready: "준비됨",
        blocked: "차단됨",
        drafts: "초안 {{count}}개",
        materialized: "구체화됨 {{count}}개",
        linked: "연결됨 {{count}}개",
        linkRequiredCohorts:
          "소스 실행 가능성을 확인하기 전에 필요한 연구 코호트를 연결하세요.",
        loadingSources: "소스를 불러오는 중...",
        noSources: "구성된 CDM 소스가 없습니다.",
        smallCellThreshold: "소규모 셀 임계값",
        sourcesReady: "{{total}}개 소스 중 {{ready}}개 준비됨",
        ranAt: "{{time}}에 실행됨",
        noDates: "날짜 없음",
        none: "없음",
        roles: "{{total}}개 역할 중 {{ready}}개",
        unknown: "알 수 없음",
        noDqd: "DQD 없음",
        passRate: "{{rate}}% 통과",
        noFeasibilityEvidence:
          "이 설계 버전에 저장된 실행 가능성 근거가 없습니다.",
        runFeasibilityBeforePlans:
          "분석 계획 초안 작성 전에 소스 실행 가능성을 실행하세요.",
        noAnalysisPlans: "아직 분석 계획이 없습니다.",
        feasibilityStatus: "실행 가능성: {{status}}",
        checkingPackageReadiness: "패키지 준비 상태 확인 중...",
        readyToLock: "잠금 준비 완료.",
        lockedPackageAvailable:
          "잠긴 패키지는 연구 아티팩트에서 사용할 수 있습니다.",
        signed: "서명됨",
        pending: "대기 중",
        onlyVerifiedRecommendations:
          "결정적으로 검증된 추천만 승인할 수 있습니다.",
      },
    },
  },
  administration: {
    dashboard: {
      title: "관리",
      subtitle: "사용자, 역할, 권한 및 시스템 구성을 관리합니다.",
      panels: {
        platform: "플랫폼",
        usersAccess: "사용자 및 접근",
        dataSources: "데이터 소스",
        aiResearch: "AI 및 연구",
      },
      status: {
        allHealthy: "모두 정상",
        degraded: "성능 저하",
        warning: "경고",
      },
      labels: {
        services: "서비스",
        queue: "대기열",
        redis: "Redis",
        totalUsers: "전체 사용자",
        roles: "역할",
        authProviders: "인증 제공자",
        tokenExpiry: "토큰 만료",
        solr: "Solr",
        aiProvider: "AI 제공자",
        model: "모델",
        abby: "Abby",
        researchRuntime: "R / HADES",
      },
      values: {
        servicesUp: "{{healthy}}/{{total}}개 가동",
        queueSummary: "대기 {{pending}}개 / 실패 {{failed}}개",
        enabledCount: "{{count}}개 활성화",
        tokenExpiry: "8시간",
        cdmCount: "CDM {{count}}개",
        solrSummary: "문서 {{docs}}개 / 코어 {{cores}}개",
        none: "없음",
        online: "온라인",
      },
      messages: {
        noCdmSources: "구성된 CDM 소스가 없습니다",
      },
      nav: {
        userManagement: {
          title: "사용자 관리",
          description:
            "사용자 계정을 생성, 편집, 비활성화하고 역할을 배정해 접근을 제어합니다.",
        },
        rolesPermissions: {
          title: "역할 및 권한",
          description:
            "사용자 지정 역할을 정의하고 모든 도메인의 권한 배정을 세밀하게 조정합니다.",
        },
        authProviders: {
          title: "인증 제공자",
          description:
            "SSO를 위해 LDAP, OAuth 2.0, SAML 2.0 또는 OIDC를 활성화하고 구성합니다.",
        },
        aiProviders: {
          title: "AI 제공자 구성",
          description:
            "Abby의 백엔드를 로컬 Ollama, Anthropic, OpenAI, Gemini 등으로 전환합니다.",
        },
        systemHealth: {
          title: "시스템 상태",
          description:
            "Redis, AI, Darkstar, Solr, Orthanc PACS, 작업 대기열 등 모든 Parthenon 서비스의 실시간 상태입니다.",
        },
        vocabularyManagement: {
          title: "어휘 관리",
          description:
            "새 Athena 어휘 ZIP 파일을 업로드하여 OMOP 어휘 테이블을 업데이트합니다.",
        },
        fhirConnections: {
          title: "FHIR EHR 연결",
          description:
            "대량 데이터 가져오기를 위해 Epic, Cerner 및 기타 EHR 시스템의 FHIR R4 연결을 관리합니다.",
        },
      },
      setupWizard: {
        title: "플랫폼 설정 마법사",
        description:
          "상태 점검, AI 제공자, 인증, 데이터 소스에 대한 안내식 설정을 다시 실행합니다.",
      },
      atlasMigration: {
        title: "Atlas에서 마이그레이션",
        description:
          "기존 OHDSI Atlas 설치에서 코호트 정의, 개념 세트 및 분석을 가져옵니다.",
      },
      actions: {
        open: "열기",
        openWizard: "마법사 열기",
      },
    },
    acropolisServices: {
      descriptions: {
        authentik: "ID 제공자 및 접근 포털",
        wazuh: "보안 모니터링 및 SIEM 대시보드",
        grafana: "메트릭 및 관측성 대시보드",
        portainer: "컨테이너 및 스택 운영",
        pgadmin: "PostgreSQL 관리 콘솔",
        n8n: "워크플로 오케스트레이션 및 자동화",
        superset: "BI 및 임시 분석 작업 공간",
        datahub: "메타데이터 카탈로그 및 계보 탐색기",
      },
      openService: "서비스 열기",
    },
    grafana: {
      openDashboard: "대시보드 열기",
    },
    broadcastEmail: {
      title: "전체 이메일",
      descriptionPrefix: "등록된 사용자",
      descriptionSuffix: "명에게 각각 이메일을 보냅니다.",
      subject: "제목",
      subjectPlaceholder: "이메일 제목...",
      message: "메시지",
      messagePlaceholder: "메시지를 입력하세요...",
      close: "닫기",
      cancel: "취소",
      sending: "보내는 중...",
      sendToAll: "모든 사용자에게 보내기",
      resultWithRecipients: "{{message}} (수신자 {{count}}명)",
      unknownError: "알 수 없는 오류",
    },
    userModal: {
      titles: {
        editUser: "사용자 편집",
        newUser: "새 사용자",
      },
      fields: {
        fullName: "전체 이름",
        email: "이메일",
        password: "비밀번호",
        roles: "역할",
      },
      hints: {
        keepCurrentPassword: "(현재 값을 유지하려면 비워 두세요)",
      },
      placeholders: {
        maskedPassword: "••••••••",
        passwordRequirements: "최소 8자, 대소문자와 숫자 포함",
      },
      actions: {
        cancel: "취소",
        saving: "저장 중...",
        saveChanges: "변경 사항 저장",
        createUser: "사용자 만들기",
      },
      errors: {
        generic: "오류가 발생했습니다.",
        passwordRequired: "비밀번호가 필요합니다.",
      },
    },
    liveKit: {
      loadingConfiguration: "구성을 불러오는 중...",
      provider: "제공자",
      providerBadges: {
        cloud: "클라우드",
        "self-hosted": "자체 호스팅",
        env: "환경",
      },
      providerOptions: {
        environment: "환경",
        liveKitCloud: "LiveKit Cloud",
        selfHosted: "자체 호스팅",
      },
      providerDescriptions: {
        useEnvFile: ".env 파일 사용",
        hostedByLiveKit: "LiveKit에서 호스팅",
        yourOwnServer: "자체 서버",
      },
      env: {
        usingEnvConfiguration: ".env 구성 사용 중",
        url: "URL:",
        apiKey: "API 키:",
        apiSecret: "API 비밀:",
        notSet: "설정되지 않음",
        missing: "누락",
        editPrefix: "수정:",
        editSuffix: "변경하려면 PHP를 다시 시작하세요.",
      },
      fields: {
        cloudUrl: "LiveKit Cloud URL",
        serverUrl: "서버 URL",
        apiKey: "API 키",
        apiSecret: "API 비밀",
      },
      placeholders: {
        savedKey: "저장됨; 새 키를 입력하면 교체됩니다",
        savedSecret: "저장됨; 새 비밀을 입력하면 교체됩니다",
        enterApiKey: "API 키 입력",
        enterApiSecret: "API 비밀 입력",
      },
      actions: {
        hideConfiguration: "구성 숨기기",
        configureLiveKit: "LiveKit 구성",
        testConnection: "연결 테스트",
        saveConfiguration: "구성 저장",
        useEnvDefaults: ".env 기본값 사용",
      },
      toasts: {
        noUrlToTest: "테스트할 URL이 없습니다",
        connectionSuccessful: "연결 성공",
        connectionFailed: "연결 실패",
        configurationSaved: "LiveKit 구성이 저장되었습니다",
        saveFailed: "구성을 저장하지 못했습니다",
      },
    },
    authProviders: {
      title: "인증 제공자",
      subtitle:
        "SSO를 위해 하나 이상의 외부 ID 제공자를 활성화합니다. Sanctum 사용자 이름/비밀번호는 항상 대체 수단으로 사용할 수 있습니다.",
      providers: {
        ldap: {
          label: "LDAP / Active Directory",
          description:
            "Microsoft Active Directory 또는 LDAP v3 디렉터리에 인증합니다. TLS, 그룹 동기화 및 속성 매핑을 지원합니다.",
        },
        oauth2: {
          label: "OAuth 2.0",
          description:
            "GitHub, Google, Microsoft 또는 사용자 지정 OAuth 2.0 제공자에 인증을 위임합니다.",
        },
        saml2: {
          label: "SAML 2.0",
          description:
            "SAML 2.0 ID 제공자(Okta, Azure AD, ADFS 등)를 통한 엔터프라이즈 SSO입니다.",
        },
        oidc: {
          label: "OpenID Connect",
          description:
            "OIDC discovery를 통한 현대적 SSO입니다. PKCE 및 표준 호환 IdP를 지원합니다.",
        },
      },
      enabled: "활성화",
      disabled: "비활성화",
      configure: "구성",
      testConnection: "연결 테스트",
      connectionSuccessful: "연결 성공",
      connectionFailed: "연결 실패",
      usernamePassword: "사용자 이름 및 비밀번호",
      alwaysOn: "항상 켜짐",
      builtIn: "내장 Sanctum 인증 - 항상 활성화됩니다.",
      loading: "제공자를 불러오는 중...",
      formActions: {
        saving: "저장 중...",
        save: "저장",
        saved: "저장됨",
      },
      oauthForm: {
        drivers: {
          github: "GitHub",
          google: "Google",
          microsoft: "Microsoft / Azure AD",
          custom: "사용자 지정 OAuth 2.0",
        },
        sections: {
          customEndpoints: "사용자 지정 엔드포인트",
        },
        labels: {
          provider: "제공자",
          clientId: "클라이언트 ID",
          clientSecret: "클라이언트 비밀",
          redirectUri: "리디렉션 URI",
          scopes: "범위",
          authorizationUrl: "인증 URL",
          tokenUrl: "토큰 URL",
          userInfoUrl: "사용자 정보 URL",
        },
        hints: {
          redirectUri: "OAuth 제공자에 등록된 URI와 일치해야 합니다",
          scopes: "공백으로 구분된 목록",
        },
        placeholders: {
          clientId: "클라이언트 / 애플리케이션 ID",
          redirectUri: "/api/v1/auth/oauth2/callback",
          scopes: "openid profile email",
        },
      },
      oidcForm: {
        labels: {
          discoveryUrl: "Discovery URL",
          clientId: "클라이언트 ID",
          clientSecret: "클라이언트 비밀",
          redirectUri: "리디렉션 URI",
          scopes: "범위",
          pkceEnabled: "PKCE 활성화(권장 - 공개 클라이언트 필요)",
        },
        hints: {
          discoveryUrl:
            "IdP의 /.well-known/openid-configuration 엔드포인트",
          redirectUri: "IdP에 등록된 값과 일치해야 합니다",
          scopes: "공백으로 구분",
        },
        placeholders: {
          discoveryUrl:
            "https://accounts.google.com/.well-known/openid-configuration",
          clientId: "your-client-id",
          redirectUri: "/api/v1/auth/oidc/callback",
          scopes: "openid profile email",
        },
      },
      samlForm: {
        sections: {
          identityProvider: "ID 제공자(IdP)",
          serviceProvider: "서비스 제공자(SP)",
          attributeMapping: "속성 매핑",
        },
        labels: {
          idpEntityId: "IdP 엔터티 ID",
          ssoUrl: "SSO URL",
          sloUrl: "SLO URL",
          idpCertificate: "IdP 인증서",
          spEntityId: "SP 엔터티 ID",
          acsUrl: "ACS URL",
          nameIdFormat: "NameID 형식",
          signAssertions:
            "어서션 서명(SP 개인 키 필요 - 서버 환경에서 구성)",
          emailAttribute: "이메일 속성",
          displayNameAttribute: "표시 이름 속성",
        },
        hints: {
          ssoUrl: "싱글 사인온 엔드포인트",
          sloUrl: "싱글 로그아웃 엔드포인트(선택 사항)",
          idpCertificate:
            "X.509 인증서를 붙여넣으세요(PEM 형식, 헤더 포함 또는 제외)",
          spEntityId:
            "Parthenon 인스턴스 URL - IdP에 등록된 값과 일치해야 합니다",
          acsUrl: "어서션 소비자 서비스",
        },
        placeholders: {
          certificate:
            "-----BEGIN CERTIFICATE-----\nMIIDxTCC...\n-----END CERTIFICATE-----",
          acsUrl: "/api/v1/auth/saml2/callback",
          sloUrl: "/api/v1/auth/saml2/logout",
          displayName: "displayName",
        },
        attributeMappingDescription:
          "SAML 어서션 속성 이름을 Parthenon 사용자 필드에 매핑합니다.",
      },
      ldapForm: {
        sections: {
          connection: "연결",
          bindCredentials: "바인드 자격 증명",
          userSearch: "사용자 검색",
          attributeMapping: "속성 매핑",
          groupSync: "그룹 동기화",
        },
        labels: {
          host: "호스트",
          port: "포트",
          useSsl: "SSL(LDAPS) 사용",
          useTls: "StartTLS 사용",
          timeout: "시간 제한(초)",
          bindDn: "바인드 DN",
          bindPassword: "바인드 비밀번호",
          baseDn: "기본 DN",
          userSearchBase: "사용자 검색 기준",
          userFilter: "사용자 필터",
          usernameField: "사용자 이름 필드",
          emailField: "이메일 필드",
          displayNameField: "표시 이름 필드",
          syncGroups: "LDAP 그룹을 Parthenon 역할에 동기화",
          groupSearchBase: "그룹 검색 기준",
          groupFilter: "그룹 필터",
        },
        hints: {
          host: "LDAP 서버 호스트 이름 또는 IP",
          bindDn: "디렉터리 쿼리에 사용하는 서비스 계정 DN",
          userFilter: "로그인 시 {username}이 대체됩니다",
        },
        placeholders: {
          bindDn: "cn=svc-parthenon,dc=example,dc=com",
          baseDn: "dc=example,dc=com",
          userSearchBase: "ou=users,dc=example,dc=com",
          userFilter: "(uid={username})",
          groupSearchBase: "ou=groups,dc=example,dc=com",
          groupFilter: "(objectClass=groupOfNames)",
        },
        actions: {
          saving: "저장 중...",
          save: "저장",
          saved: "저장됨",
        },
      },
    },
    roles: {
      title: "역할 및 권한",
      subtitle:
        "사용자 지정 역할을 정의하고 권한 배정을 세밀하게 조정합니다. 대량 편집에는 매트릭스를 사용하세요.",
      tabs: {
        roleList: "역할 목록",
        permissionMatrix: "권한 매트릭스",
      },
      permissionMatrix: {
        instructions:
          "셀을 클릭해 권한을 전환하고, 행 머리글로 모든 역할에 적용하며, 열 머리글로 역할의 모든 권한을 부여/회수합니다.",
        saveAllChangesOne: "모든 변경 사항 저장(역할 {{count}}개)",
        saveAllChangesOther: "모든 변경 사항 저장(역할 {{count}}개)",
        permission: "권한",
        columnTitle: "{{role}}의 모든 권한 전환",
        permissionCount: "권한 {{count}}개",
        saving: "저장 중...",
        saved: "저장됨 ✓",
        save: "저장",
        domainTitle: "모든 역할에서 {{domain}} 권한 전환",
        rowTitle: "모든 역할에 대해 {{permission}} 전환",
        cellTitleGrant: "{{role}}에 {{permission}} 부여",
        cellTitleRevoke: "{{role}}에서 {{permission}} 회수",
      },
      editor: {
        roleName: "역할 이름",
        roleNamePlaceholder: "예: site-coordinator",
        permissions: "권한",
        selectedCount: "({{count}}개 선택됨)",
      },
      actions: {
        newRole: "새 역할",
        cancel: "취소",
        saving: "저장 중...",
        saveRole: "역할 저장",
        editRole: "역할 편집",
        deleteRole: "역할 삭제",
        deleting: "삭제 중...",
        delete: "삭제",
      },
      values: {
        builtIn: "내장",
        userCountOne: "사용자 {{count}}명",
        userCountOther: "사용자 {{count}}명",
        permissionCountOne: "권한 {{count}}개",
        permissionCountOther: "권한 {{count}}개",
        more: "+{{count}}개 더",
      },
      deleteModal: {
        title: "역할을 삭제할까요?",
        prefix: "역할",
        suffix:
          "이 영구 삭제됩니다. 이 역할만 배정된 사용자는 모든 권한을 잃게 됩니다.",
      },
    },
    pacs: {
      studyBrowser: {
        browseTitle: "찾아보기: {{name}}",
        filters: {
          patientName: "환자 이름",
          patientId: "환자 ID",
          allModalities: "모든 모달리티",
        },
        empty: {
          noStudies: "스터디를 찾을 수 없습니다",
        },
        table: {
          patientName: "환자 이름",
          patientId: "환자 ID",
          date: "날짜",
          modality: "모달리티",
          description: "설명",
          series: "시리즈",
          instances: "Inst.",
        },
        pagination: {
          range: "{{start}}-{{end}}",
          ofStudies: "전체 {{total}}개 스터디 중",
          previous: "이전",
          next: "다음",
        },
      },
      connectionCard: {
        defaultConnection: "기본 연결",
        setAsDefault: "기본값으로 설정",
        deleteConfirm: "\"{{name}}\"을 삭제할까요?",
        never: "없음",
        seriesByModality: "모달리티별 시리즈",
        statsUpdated: "통계 업데이트 {{date}}",
        stats: {
          patients: "환자",
          studies: "스터디",
          series: "시리즈",
          instances: "인스턴스",
          disk: "디스크",
        },
        actions: {
          edit: "편집",
          delete: "삭제",
          test: "테스트",
          stats: "통계",
          browse: "찾아보기",
        },
      },
    },
    solrAdmin: {
      title: "Solr 검색 관리",
      subtitle: "Solr 검색 코어를 관리하고, 재색인을 실행하며, 상태를 모니터링합니다.",
      loadingCoreStatus: "코어 상태를 불러오는 중...",
      status: {
        healthy: "정상",
        unavailable: "사용 불가",
      },
      labels: {
        documents: "문서",
        lastIndexed: "마지막 색인",
        duration: "소요 시간",
      },
      values: {
        never: "없음",
        seconds: "{{seconds}}초",
      },
      actions: {
        reindexAll: "모든 코어 재색인",
        reindex: "재색인",
        fullReindex: "전체 재색인",
        clear: "비우기",
      },
      messages: {
        fetchFailed: "Solr 상태를 가져오지 못했습니다",
        reindexCompleted: "'{{core}}' 재색인이 완료되었습니다",
        reindexFailed: "'{{core}}'을 재색인하지 못했습니다",
        reindexAllCompleted: "전체 재색인이 완료되었습니다",
        reindexAllFailed: "모든 코어를 재색인하지 못했습니다",
        clearConfirm:
          "'{{core}}'의 모든 문서를 비울까요? 이 작업은 되돌릴 수 없습니다.",
        clearCompleted: "'{{core}}' 코어를 비웠습니다",
        clearFailed: "'{{core}}' 코어를 비우지 못했습니다",
      },
    },
    aiProviders: {
      title: "AI 제공자 구성",
      subtitle:
        "Abby를 구동할 AI 백엔드를 선택합니다. 한 번에 하나의 제공자만 활성화됩니다. API 키는 암호화되어 저장됩니다.",
      activeProvider: "활성 제공자:",
      fields: {
        model: "모델",
        apiKey: "API 키",
        ollamaBaseUrl: "Ollama 기본 URL",
      },
      placeholders: {
        modelName: "모델 이름",
      },
      values: {
        active: "활성",
        enabled: "활성화",
        disabled: "비활성화",
        noModelSelected: "선택된 모델 없음",
      },
      actions: {
        currentlyActive: "현재 활성",
        setAsActive: "활성으로 설정",
        save: "저장",
        testConnection: "연결 테스트",
      },
      messages: {
        requestFailed: "요청이 실패했습니다.",
      },
    },
    gisImport: {
      steps: {
        upload: "업로드",
        analyze: "분석",
        mapColumns: "열 매핑",
        configure: "구성",
        validate: "검증",
        import: "가져오기",
      },
      analyze: {
        analysisFailed: "Abby가 이 파일을 분석하는 중 문제가 발생했습니다.",
        unknownError: "알 수 없는 오류",
        retry: "다시 시도",
        analyzing: "Abby가 데이터를 분석하는 중...",
        detecting: "열 유형, 지리 코드, 값 의미를 감지하는 중",
      },
      upload: {
        uploading: "업로드 중...",
        dropPrompt: "파일을 여기에 놓거나 클릭하여 찾아보세요",
        acceptedFormats:
          "CSV, TSV, Excel, Shapefile(.zip), GeoJSON, KML, GeoPackage - 최대 {{maxSize}}MB",
        largeFiles: "대용량 파일(> {{maxSize}}MB)",
        fileTooLarge:
          "파일이 {{maxSize}}MB를 초과합니다. CLI 사용: php artisan gis:import {{filename}}",
        uploadFailed: "업로드 실패",
      },
      configure: {
        fields: {
          layerName: "레이어 이름",
          exposureType: "노출 유형",
          geographyLevel: "지리 수준",
          valueType: "값 유형",
          aggregation: "집계",
        },
        placeholders: {
          layerName: "예: Social Vulnerability Index",
          exposureType: "예: svi_overall",
        },
        geographyLevels: {
          county: "카운티",
          tract: "인구조사 구역",
          state: "주",
          country: "국가",
          custom: "사용자 지정",
        },
        valueTypes: {
          continuous: "연속형(코로플레스)",
          categorical: "범주형(불연속 색상)",
          binary: "이진형(있음/없음)",
        },
        aggregations: {
          mean: "평균",
          sum: "합계",
          maximum: "최대",
          minimum: "최소",
          latest: "최신",
        },
        saving: "저장 중...",
        continue: "계속",
      },
      mapping: {
        title: "열 매핑",
        subtitle: "각 원본 열을 목적에 매핑합니다",
        purposes: {
          geographyCode: "지리 코드",
          geographyName: "지리 이름",
          latitude: "위도",
          longitude: "경도",
          valueMetric: "값(메트릭)",
          metadata: "메타데이터",
          skip: "건너뛰기",
        },
        confidence: {
          high: "높음",
          medium: "중간",
          low: "낮음",
        },
        askAbby: "Abby에게 묻기",
        abbyOnColumn: "\"{{column}}\"에 대한 Abby:",
        thinking: "생각 중...",
        saving: "저장 중...",
        continue: "계속",
      },
      validate: {
        validating: "검증 중...",
        validationFailed: "검증 실패:",
        unknownError: "알 수 없는 오류",
        results: "검증 결과",
        stats: {
          totalRows: "전체 행",
          uniqueGeographies: "고유 지리",
          matched: "매칭됨",
          unmatched: "미매칭(stub)",
          matchRate: "매칭률",
          geographyType: "지리 유형",
        },
        unmatchedWarning:
          "데이터베이스에서 찾지 못한 지리 {{count}}개가 있습니다. Stub 항목이 생성됩니다(경계 기하 없음).",
        backToMapping: "매핑으로 돌아가기",
        proceedWithImport: "가져오기 진행",
      },
      import: {
        starting: "시작 중...",
        startImport: "가져오기 시작",
        importing: "가져오는 중... {{progress}}%",
        complete: "가져오기 완료",
        rowsImported: "{{count}}행 가져옴",
        saveLearningPrompt: "다음번을 위해 Abby가 배울 수 있도록 매핑 저장",
        saveToAbby: "Abby에 저장",
        viewInGisExplorer: "GIS 탐색기에서 보기",
        importAnother: "다른 항목 가져오기",
        failed: "가져오기 실패",
        startOver: "처음부터 시작",
      },
    },
    chromaStudio: {
      title: "Chroma 컬렉션 스튜디오",
      subtitle: "벡터 컬렉션을 검사하고 시맨틱 쿼리를 실행하며 수집을 관리합니다",
      values: {
        collectionCount: "컬렉션 {{count}}개",
        loading: "로딩 중",
        loadingEllipsis: "로딩 중...",
        countSuffix: "({{count}})",
        sampledSuffix: "(샘플 {{count}}개)",
      },
      actions: {
        refreshCollections: "컬렉션 새로고침",
        ingestDocs: "문서 수집",
        ingestClinical: "임상 데이터 수집",
        promoteFaq: "FAQ 승격",
        ingestOhdsiPapers: "OHDSI 논문 수집",
        ingestOhdsiKnowledge: "OHDSI 지식 수집",
        ingestTextbooks: "교과서 수집",
      },
      stats: {
        vectors: "벡터",
        sampled: "샘플",
        dimensions: "차원",
        metaFields: "메타 필드",
      },
      messages: {
        loadingCollectionData: "컬렉션 데이터를 불러오는 중...",
      },
      empty: {
        title: "이 컬렉션은 비어 있습니다",
        description:
          "위의 수집 작업을 사용해 \"{{collection}}\"에 문서를 채우세요.",
        noRecords: "이 컬렉션에 레코드가 없습니다.",
        noDocumentReturned: "반환된 문서가 없습니다.",
        noDocumentText: "사용 가능한 문서 텍스트가 없습니다.",
      },
      tabs: {
        overview: "개요",
        retrieval: "검색",
      },
      search: {
        placeholder: "시맨틱 쿼리...",
        recentQueries: "최근 쿼리",
        kLabel: "K:",
        queryAction: "쿼리",
        empty: "위에 쿼리를 입력하고 쿼리를 클릭해 검색 결과를 검사하세요.",
        queryLabel: "쿼리:",
        resultsCount: "결과 {{count}}개",
        querying: "쿼리 중...",
        distance: "거리",
      },
      overview: {
        facetDistribution: "패싯 분포",
        sampleRecords: "샘플 레코드",
        collectionMetadata: "컬렉션 메타데이터",
      },
    },
    vectorExplorer: {
      title: "벡터 탐색기",
      semanticMapTitle: "{{dimensions}}D 시맨틱 맵",
      loading: {
        computingProjection: "프로젝션 계산 중",
        runningProjection: "{{sample}}개 벡터에서 PCA->UMAP 실행 중...",
        recomputingProjection: "프로젝션 다시 계산 중...",
      },
      values: {
        all: "전체",
        loadingEllipsis: "로딩 중...",
        countSuffix: "({{count}})",
        sampled: "샘플 {{count}}개",
        dimensions: "{{dimensions}}D",
        knnEdges: "k={{neighbors}} - 엣지 {{edges}}개",
        seconds: "{{seconds}}초",
        points: "{{count}} pts",
        cachedSuffix: " - 캐시됨",
        fallbackSuffix: " - 대체",
        timeSuffix: " - {{seconds}}초",
      },
      modes: {
        clusters: "클러스터",
        query: "쿼리",
        qa: "QA",
      },
      sample: {
        label: "샘플",
        confirmLoadAll:
          "벡터 {{count}}개를 모두 불러올까요? 시간이 더 오래 걸릴 수 있습니다.",
        steps: {
          all: "전체",
        },
      },
      empty: {
        selectCollection: "임베딩을 시각화할 컬렉션을 선택하세요.",
      },
      tooltips: {
        requiresAiService: "AI 서비스 연결이 필요합니다",
      },
      controls: {
        colorBy: "색상 기준",
        modeDefault: "모드 기본값",
      },
      search: {
        placeholder: "벡터 공간 내 검색",
        searching: "검색 중...",
        search: "검색",
        visibleResults:
          "이 프로젝션에서 결과 {{total}}개 중 {{visible}}개 표시",
      },
      query: {
        anchor: "쿼리 앵커",
      },
      sections: {
        overlays: "오버레이",
        clusterProfile: "클러스터 프로필",
        inspector: "검사기",
      },
      inspector: {
        selectPoint: "점 하나를 클릭해 검사하세요.",
        loadingDetails: "전체 세부 정보를 불러오는 중...",
        flags: {
          outlier: "이상치",
          duplicate: "중복",
          orphan: "고아 항목",
        },
      },
      overlays: {
        clusterHulls: {
          label: "클러스터 외곽",
          help: "클러스터 주변의 볼록 외피",
        },
        topologyLines: {
          label: "토폴로지 선",
          help: "가까운 점 사이의 k-NN 링크",
        },
        queryRays: {
          label: "쿼리 광선",
          help: "앵커와 결과 사이의 유사도 링크",
        },
      },
      stats: {
        totalVectors: "전체 벡터",
        sampled: "샘플",
        projection: "프로젝션",
        knnGraph: "k-NN 그래프",
        source: "소스",
        projectionTime: "프로젝션 시간",
        indexed: "인덱싱됨",
      },
      sources: {
        solrCached: "Solr(캐시됨)",
        clientFallback: "클라이언트 대체",
        liveUmap: "라이브 UMAP",
      },
      actions: {
        recomputeProjection: "프로젝션 다시 계산",
        expand: "확대",
      },
      legend: {
        clusters: "클러스터",
        quality: "품질",
        similarity: "유사도",
        hide: "숨기기",
        show: "표시",
      },
      quality: {
        outliers: "이상치",
        duplicates: "중복",
        duplicatePairs: "중복 쌍",
        orphans: "고아 항목",
        normal: "정상",
        outOfSampled: "샘플 {{count}}개 중",
        exportCsv: "CSV 내보내기",
      },
      clusterProfile: {
        selectCluster: "클러스터를 선택해 주요 메타데이터를 확인하세요.",
        clusterSize: "클러스터 크기",
        dominantMetadata: "주요 메타데이터",
        representativeTitles: "대표 제목",
      },
    },
    pacsConnectionModal: {
      title: {
        add: "PACS 연결 추가",
        edit: "PACS 연결 편집",
      },
      description: "DICOM 영상 서버 연결을 구성합니다.",
      fields: {
        name: "이름",
        type: "유형",
        authType: "인증 유형",
        baseUrl: "기본 URL",
        username: "사용자 이름",
        password: "비밀번호",
        bearerToken: "Bearer 토큰",
        linkedSource: "연결된 소스(선택 사항)",
        active: "활성",
      },
      placeholders: {
        name: "기본 PACS 서버",
        keepExisting: "기존 값을 유지하려면 비워 두세요",
        password: "비밀번호",
        token: "토큰",
      },
      types: {
        orthanc: "Orthanc",
        dicomweb: "DICOMweb",
        googleHealthcare: "Google Healthcare",
        cloud: "클라우드",
      },
      auth: {
        none: "없음",
        basic: "기본 인증",
        bearer: "Bearer 토큰",
      },
      values: {
        latency: "({{ms}}ms)",
      },
      actions: {
        testConnection: "연결 테스트",
        cancel: "취소",
        saveChanges: "변경 사항 저장",
        createConnection: "연결 만들기",
      },
      errors: {
        testRequestFailed: "테스트 요청에 실패했습니다",
        saveFailed: "연결을 저장하지 못했습니다",
      },
    },
    users: {
      title: "사용자",
      summary: {
        totalAccounts: "전체 계정",
      },
      empty: {
        loading: "로딩 중...",
        noUsers: "사용자를 찾을 수 없습니다",
        adjustFilters: "검색어나 필터를 조정해 보세요.",
      },
      deleteModal: {
        title: "사용자를 삭제하시겠습니까?",
        description: "영구적으로 삭제되고 모든 API 토큰이 취소됩니다.",
        irreversible: "이 작업은 되돌릴 수 없습니다.",
      },
      actions: {
        cancel: "취소",
        deleting: "삭제 중...",
        delete: "삭제",
        adminEmailer: "관리자 이메일",
        newUser: "새 사용자",
        editUser: "사용자 편집",
        deleteUser: "사용자 삭제",
      },
      filters: {
        searchPlaceholder: "이름 또는 이메일 검색...",
        allRoles: "모든 역할",
      },
      table: {
        name: "이름",
        email: "이메일",
        lastActive: "최근 활동",
        joined: "가입일",
        roles: "역할",
      },
      values: {
        never: "없음",
      },
      pagination: {
        page: "페이지",
        of: "/",
        users: "사용자",
      },
    },
    userAudit: {
      title: "사용자 감사 로그",
      subtitle:
        "모든 사용자의 로그인 이벤트, 기능 접근, 보안 작업을 추적합니다.",
      actions: {
        login: "로그인",
        logout: "로그아웃",
        passwordChanged: "비밀번호 변경",
        passwordReset: "비밀번호 재설정",
        featureAccess: "기능 접근",
      },
      empty: {
        noMatching: "일치하는 이벤트가 없습니다",
        noEvents: "아직 감사 이벤트가 없습니다",
        adjustFilters: "필터 또는 날짜 범위를 조정해 보세요.",
        description:
          "사용자가 로그인하고 플랫폼 기능에 접근하면 감사 이벤트가 기록됩니다.",
      },
      stats: {
        loginsToday: "오늘 로그인",
        activeUsers7d: "활성 사용자(7일)",
        totalEvents: "전체 이벤트",
        topFeature: "상위 기능",
      },
      sections: {
        mostAccessedFeatures: "가장 많이 접근한 기능 - 최근 7일",
      },
      filters: {
        searchPlaceholder: "사용자, 기능, IP 검색...",
        allActions: "모든 작업",
        clearAll: "모두 지우기",
      },
      table: {
        time: "시간",
        user: "사용자",
        action: "작업",
        feature: "기능",
        ipAddress: "IP 주소",
      },
      pagination: {
        page: "페이지",
        of: "/",
        events: "이벤트",
      },
    },
    serviceDetail: {
      actions: {
        backToSystemHealth: "시스템 상태로 돌아가기",
        systemHealth: "시스템 상태",
        refresh: "새로고침",
        manageSolrCores: "Solr 코어 관리",
      },
      empty: {
        serviceNotFound: "서비스를 찾을 수 없습니다.",
        noLogs: "사용 가능한 최근 로그 항목이 없습니다.",
      },
      values: {
        checkedAt: "{{time}}에 확인됨",
        entriesCount: "(항목 {{count}}개)",
        yes: "예",
        no: "아니요",
      },
      sections: {
        metrics: "지표",
        recentLogs: "최근 로그",
      },
      pacs: {
        title: "PACS 연결",
        addConnection: "연결 추가",
        empty: "구성된 PACS 연결이 없습니다.",
      },
      darkstar: {
        ohdsiPackages: "OHDSI HADES 패키지",
        positPackages: "Posit / CRAN 패키지",
        installedCount: "(설치됨 {{count}}개)",
      },
    },
    atlasMigration: {
      steps: {
        connect: "연결",
        discover: "검색",
        select: "선택",
        import: "가져오기",
        summary: "요약",
      },
      entityTypes: {
        conceptSets: "개념 세트",
        cohortDefinitions: "코호트 정의",
        incidenceRates: "발생률",
        characterizations: "특성화",
        pathways: "경로",
        estimations: "추정",
        predictions: "예측",
      },
      connect: {
        title: "Atlas WebAPI에 연결",
        description:
          "기존 OHDSI WebAPI 인스턴스의 기본 URL을 입력하세요. Parthenon이 연결하여 마이그레이션 가능한 모든 엔티티를 인벤토리화합니다.",
        webapiUrl: "WebAPI 기본 URL",
        authentication: "인증",
        auth: {
          none: "없음(공개 WebAPI)",
          basic: "기본 인증",
          bearer: "Bearer 토큰",
        },
        credentials: "자격 증명(사용자 이름:비밀번호)",
        bearerToken: "Bearer 토큰",
        testConnection: "연결 테스트",
        webapiVersion: "WebAPI 버전: {{version}}",
      },
      discover: {
        discovering: "엔티티를 검색하는 중...",
        querying: "모든 WebAPI 엔드포인트를 병렬로 조회하는 중",
        title: "Atlas 인벤토리",
        summary:
          "{{categories}}개 범주에서 마이그레이션 가능한 엔티티 {{count}}개를 찾았습니다.",
        sourcesFound: "데이터 소스 {{count}}개도 찾았습니다.",
      },
      select: {
        title: "마이그레이션할 엔티티 선택",
        description:
          "가져올 엔티티를 선택하세요. 종속성은 자동으로 해결됩니다.",
        analysisWarning:
          "분석 엔티티는 ID로 코호트 정의와 개념 세트를 참조할 수 있습니다. Parthenon은 가져오기 중 이러한 참조를 자동으로 다시 매핑합니다. 최상의 결과를 위해 참조된 코호트와 개념 세트를 선택에 포함하세요.",
        selectedCount: "{{selected}}/{{total}}개 선택됨",
        totalSelected: "마이그레이션할 엔티티 {{count}}개 선택됨",
      },
      import: {
        starting: "마이그레이션을 시작하는 중...",
        importing: "엔티티를 가져오는 중...",
        complete: "마이그레이션 완료",
        failed: "마이그레이션 실패",
        processed: "선택한 모든 엔티티가 처리되었습니다.",
        error: "마이그레이션 중 오류가 발생했습니다.",
        percentComplete: "{{percent}}% 완료",
        polling: "업데이트를 확인하는 중...",
      },
      summary: {
        successful: "마이그레이션 성공",
        completedWithWarnings: "경고와 함께 마이그레이션 완료",
        failed: "마이그레이션 실패",
        from: "원본",
        duration: "소요 시간: {{duration}}",
      },
      metrics: {
        total: "합계",
        imported: "가져옴",
        skipped: "건너뜀",
        failed: "실패",
      },
      table: {
        entityType: "엔티티 유형",
        category: "범주",
      },
      actions: {
        selectAll: "모두 선택",
        deselectAll: "모두 선택 해제",
        retryFailed: "실패 항목 재시도({{count}})",
        done: "완료",
        closeTitle: "닫기 - 언제든지 관리에서 다시 열 수 있습니다",
        previous: "이전",
        startMigration: "마이그레이션 시작",
        next: "다음",
      },
      errors: {
        connectionFailed: "연결 실패",
        discoveryFailed: "검색 실패",
      },
    },
    fhirExport: {
      title: "FHIR Bulk 내보내기",
      subtitle:
        "상호운용성을 위해 OMOP CDM 데이터를 FHIR R4 NDJSON 파일로 내보냅니다.",
      comingSoon: "곧 제공 예정",
      description:
        "FHIR Bulk Export($export)는 개발 중입니다. 이 기능은 상호운용성을 위해 OMOP CDM 데이터를 FHIR R4 NDJSON 파일로 내보낼 수 있게 합니다.",
      backendPending:
        "이 기능의 백엔드 엔드포인트는 아직 구현되지 않았습니다.",
    },
    fhirConnections: {
      title: "FHIR EHR 연결",
      subtitle:
        "Epic, Cerner 및 기타 EHR 시스템에서 FHIR R4 Bulk Data를 추출하기 위한 SMART Backend Services 연결을 구성합니다.",
      runMetrics: {
        extracted: "추출됨",
        mapped: "매핑됨",
        written: "기록됨",
        failed: "실패",
        mappingCoverage: "매핑 커버리지",
      },
      history: {
        loading: "동기화 이력을 불러오는 중...",
        empty: "아직 동기화 실행이 없습니다.",
        status: "상태",
        started: "시작",
        duration: "소요 시간",
        metrics: "지표",
        title: "동기화 이력",
      },
      dialog: {
        editTitle: "FHIR 연결 편집",
        addTitle: "FHIR 연결 추가",
        description:
          "EHR FHIR R4 엔드포인트에 대한 SMART Backend Services 연결을 구성합니다.",
      },
      labels: {
        siteName: "사이트 이름",
        siteKey: "사이트 키(slug)",
        ehrVendor: "EHR 벤더",
        fhirBaseUrl: "FHIR 기본 URL",
        tokenEndpoint: "토큰 엔드포인트",
        clientId: "클라이언트 ID",
        rsaPrivateKey: "RSA 개인 키(PEM)",
        scopes: "범위",
        groupId: "그룹 ID(Bulk Export용)",
        exportResourceTypes:
          "내보낼 리소스 유형(쉼표로 구분, 비워 두면 전체)",
        active: "활성",
        incrementalSync: "증분 동기화",
      },
      vendors: {
        epic: "Epic",
        cerner: "Cerner (Oracle Health)",
        other: "기타 FHIR R4",
      },
      placeholders: {
        siteName: "Johns Hopkins Epic",
        keepExistingKey: "기존 키를 유지하려면 비워 두세요",
        resourceTypes:
          "Patient,Condition,Encounter,MedicationRequest,Observation,Procedure",
      },
      actions: {
        cancel: "취소",
        saveChanges: "변경 사항 저장",
        createConnection: "연결 생성",
        testConnection: "연결 테스트",
        edit: "편집",
        delete: "삭제",
        details: "세부 정보",
        syncMonitor: "동기화 모니터",
        addConnection: "연결 추가",
      },
      messages: {
        failedToSave: "저장하지 못했습니다",
        failedToStartSync: "동기화를 시작하지 못했습니다",
        deleteConfirm: '"{{name}}"을(를) 삭제하시겠습니까?',
        noConnections: "구성된 FHIR 연결이 없습니다",
        noConnectionsDescription:
          "FHIR R4 Bulk Data를 통해 EHR에서 임상 데이터를 추출하려면 연결을 추가하세요.",
      },
      sync: {
        activateFirst: "먼저 연결을 활성화하세요",
        uploadKeyFirst: "먼저 개인 키를 업로드하세요",
        inProgress: "동기화 진행 중",
        incrementalTitle: "증분 동기화(새 데이터만)",
        fullSync: "전체 동기화",
        sync: "동기화",
        incrementalSync: "증분 동기화",
        incrementalDescription:
          "마지막 동기화 이후 새 데이터 또는 업데이트된 데이터만",
        fullDescription: "EHR에서 모든 데이터 다운로드",
        forceFullSync: "전체 동기화 강제 실행",
        forceFullDescription:
          "모든 데이터를 다시 다운로드하고 쓰기 시 중복 제거",
      },
      values: {
        percent: "{{value}}%",
        byUser: "{{name}} 사용자가 실행",
        keyUploaded: "키 업로드됨",
        noKey: "키 없음",
        lastSync: "마지막 동기화: {{date}}",
        records: "레코드 {{count}}개",
        testElapsed: "{{message}} ({{elapsed}}ms)",
        allSupported: "지원되는 모든 항목",
        enabled: "활성화됨",
        disabled: "비활성화됨",
        since: "({{date}} 이후)",
        notSet: "설정되지 않음",
        never: "없음",
      },
      details: {
        tokenEndpoint: "토큰 엔드포인트:",
        clientId: "클라이언트 ID:",
        scopes: "범위:",
        groupId: "그룹 ID:",
        resourceTypes: "리소스 유형:",
        incremental: "증분:",
        targetSource: "대상 소스:",
        syncRuns: "동기화 실행:",
      },
      stats: {
        totalConnections: "전체 연결",
        active: "활성",
        keysConfigured: "구성된 키",
        lastSync: "마지막 동기화",
      },
    },
    vocabulary: {
      title: "어휘 관리",
      subtitle: "Athena 다운로드 ZIP에서 OMOP 어휘 테이블을 업데이트합니다.",
      status: {
        pending: "대기열",
        running: "실행 중",
        completed: "완료됨",
        failed: "실패",
      },
      log: {
        title: "가져오기 로그",
        noOutput: "(아직 출력 없음)",
      },
      labels: {
        schema: "스키마:",
        source: "소스:",
        rowsLoaded: "로드된 행:",
        duration: "소요 시간:",
        by: "실행자:",
        progress: "진행률",
        optional: "(선택 사항)",
      },
      values: {
        seconds: "{{value}}초",
      },
      actions: {
        refresh: "새로고침",
        remove: "제거",
        uploading: "업로드 중...",
        startImport: "가져오기 시작",
      },
      upload: {
        title: "Athena 어휘 ZIP 업로드",
        descriptionPrefix: "어휘 번들을",
        descriptionMiddle: "에서 다운로드한 뒤 여기에 업로드하세요.",
        descriptionSuffix:
          "가져오기는 백그라운드 작업으로 실행되며 어휘 크기에 따라 15-60분이 걸릴 수 있습니다.",
        maxFileSize: "최대 5 GB 파일을 지원합니다",
        dropHere: "Athena ZIP을 여기에 놓으세요",
        browse: "또는 클릭하여 찾아보기",
        targetSource: "대상 CDM 소스",
        defaultSchema: "기본 어휘 스키마",
        sourceHelpPrefix:
          "가져오기가 채울 소스의 어휘 스키마를 선택합니다. 소스를 선택하지 않으면 기본",
        sourceHelpSuffix: "연결 스키마가 사용됩니다.",
      },
      instructions: {
        title: "Athena에서 어휘 ZIP을 받는 방법",
        signInPrefix: "",
        signInSuffix: "에 방문해 로그인하세요.",
        selectDomains:
          "필요한 어휘 도메인과 버전을 선택하세요(예: SNOMED, RxNorm, LOINC).",
        clickPrefix: "",
        downloadVocabularies: "Download Vocabularies",
        clickSuffix: "를 클릭하면 Athena가 다운로드 링크를 이메일로 보냅니다.",
        uploadZip:
          "ZIP 파일(일반적으로 500 MB-3 GB)을 다운로드하여 아래에 업로드하세요.",
      },
      messages: {
        deleteConfirm: "이 가져오기 기록을 삭제하시겠습니까?",
        uploadFailed: "업로드 실패: {{message}}",
        unknownError: "알 수 없는 오류",
        uploadSuccess:
          "ZIP이 성공적으로 업로드되었습니다. 가져오기 작업이 대기열에 추가되었습니다. 아래에서 진행 상황을 확인하세요.",
        importRunning:
          "가져오기가 현재 실행 중입니다. 완료될 때까지 새 업로드가 비활성화됩니다.",
      },
      history: {
        title: "가져오기 이력",
        loading: "불러오는 중...",
        empty:
          "아직 어휘 가져오기가 없습니다. 시작하려면 위에서 Athena ZIP을 업로드하세요.",
      },
    },
    systemHealth: {
      title: "시스템 상태",
      subtitle:
        "모든 Parthenon 서비스의 실시간 상태입니다. 30초마다 자동 새로고침됩니다.",
      serverStatus: "서버 상태",
      lastChecked: "{{time}}에 마지막 확인",
      polling: "서비스를 확인하는 중...",
      gisDataManagement: "GIS 데이터 관리",
      status: {
        healthy: "정상",
        degraded: "성능 저하",
        down: "중단",
      },
      overall: {
        healthy: "정상",
        needsAttention: "주의 필요",
      },
      labels: {
        pending: "대기:",
        failed: "실패:",
        cores: "코어:",
        documents: "문서:",
        dagster: "Dagster:",
        graphql: "GraphQL:",
        studies: "검사:",
        instances: "인스턴스:",
        disk: "디스크:",
      },
      actions: {
        refresh: "새로고침",
        openService: "서비스 열기",
        viewDetails: "세부 정보 보기",
      },
      tiers: {
        corePlatform: "핵심 플랫폼",
        dataSearch: "데이터 및 검색",
        aiAnalytics: "AI 및 분석",
        clinicalServices: "임상 서비스",
        monitoringCommunications: "모니터링 및 커뮤니케이션",
        acropolisInfrastructure: "Acropolis 인프라",
        unknown: "기타 서비스",
      },
      hades: {
        title: "OHDSI 패키지 동등성",
        subtitle:
          "일급 네이티브 및 호환성 작업을 위한 Darkstar 패키지 커버리지입니다.",
        checking: "Darkstar 패키지를 확인하는 중...",
        unavailable: "Darkstar 패키지 인벤토리를 사용할 수 없습니다.",
        installed: "설치됨:",
        missing: "누락:",
        total: "전체:",
        requiredMissing: "필수 누락:",
        shinyPolicy: "레거시 Shiny 정책",
        notExposed: "노출되지 않음",
        shinyPolicyDescription:
          "호스팅된 Shiny 앱, iframe 임베딩, 사용자 제공 앱 경로는 비활성화되어 있습니다. OHDSI Shiny 패키지는 런타임 호환성 아티팩트로만 유지됩니다.",
        replacement: "대체 항목: {{surface}}",
        package: "패키지",
        capability: "역량",
        priority: "우선순위",
        surface: "표면",
        source: "소스",
        runtime: "런타임",
        status: {
          complete: "완료",
          partial: "부분",
        },
      },
    },
    fhirSync: {
      title: "FHIR 동기화 모니터",
      subtitle: "모든 FHIR 연결의 ETL 파이프라인을 실시간으로 모니터링합니다",
      status: {
        completed: "완료됨",
        running: "실행 중",
        pending: "대기 중",
        exporting: "내보내는 중",
        downloading: "다운로드 중",
        processing: "처리 중",
        failed: "실패",
      },
      timeline: {
        empty: "최근 30일 동안 동기화 활동이 없습니다",
        tooltip: "{{date}}: 완료 {{completed}}개, 실패 {{failed}}개",
        hoverSummary: "정상 {{completed}}개 / 실패 {{failed}}개",
      },
      metrics: {
        extracted: "추출됨",
        mapped: "매핑됨",
        written: "기록됨",
        failed: "실패",
        averageMappingCoverage: "평균 매핑 커버리지",
      },
      actions: {
        viewError: "오류 보기",
      },
      values: {
        runs: "실행 {{count}}회",
        never: "없음",
        activeRuns: "활성 {{count}}개",
        refreshInterval: "{{seconds}}초마다 새로고침",
        allTimeTotals: "전체 기간 합계",
        lastRuns: "모든 연결의 최근 20개",
      },
      messages: {
        failedToLoad: "대시보드 데이터를 불러오지 못했습니다.",
        noConnections: "구성된 연결이 없습니다",
        noRuns: "아직 동기화 실행이 없습니다",
      },
      stats: {
        connections: "연결",
        totalRuns: "전체 실행",
        completed: "완료됨",
        failed: "실패",
        recordsWritten: "기록된 레코드",
        avgCoverage: "평균 커버리지",
      },
      panels: {
        pipelineThroughput: "파이프라인 처리량",
        syncActivity: "동기화 활동(30일)",
        connectionHealth: "연결 상태",
        recentRuns: "최근 동기화 실행",
      },
      table: {
        status: "상태",
        connection: "연결",
        started: "시작",
        duration: "소요 시간",
        metrics: "지표",
      },
    },
    gisData: {
      title: "GIS 경계 데이터",
      subtitle: "GIS Explorer용 지리 경계 데이터셋을 관리합니다",
      status: {
        loaded: "로드됨",
        empty: "비어 있음",
      },
      tabs: {
        boundaries: "경계",
        dataImport: "데이터 가져오기",
      },
      messages: {
        checking: "경계 데이터를 확인하는 중...",
        noBoundaryData:
          "로드된 경계 데이터가 없습니다. 시작하려면 아래에서 소스와 수준을 선택하세요.",
      },
      labels: {
        boundaries: "경계:",
        countries: "국가:",
      },
      load: {
        title: "경계 로드",
        adminLevels: "로드할 행정 수준:",
      },
      sources: {
        gadm: {
          name: "GADM v4.1",
          description: "전 세계 행정 구역: 6개 행정 수준에 걸친 356K 경계",
        },
        geoboundaries: {
          name: "geoBoundaries CGAZ",
          description: "지도 일관성을 위한 단순화된 경계(ADM0-2)",
        },
      },
      levels: {
        adm0: "국가(ADM0)",
        adm1: "주 / 도(ADM1)",
        adm2: "구 / 군(ADM2)",
        adm3: "하위 구역(ADM3)",
      },
      actions: {
        preparing: "준비 중...",
        generateLoadCommand: "로드 명령 생성",
        refreshStats: "통계 새로고침",
        copyToClipboard: "클립보드에 복사",
        close: "닫기",
      },
      modal: {
        runOnHost: "호스트에서 실행",
        description:
          "GIS 데이터는 로컬 PostgreSQL 17에 직접 로드됩니다. 프로젝트 루트에서 이 명령을 실행하세요.",
        datasetFlagPrefix: "",
        datasetFlagSuffix:
          "플래그는 진행률 추적을 활성화합니다. 스크립트가 완료된 뒤 통계를 새로고침하세요.",
      },
      job: {
        title: "GIS 경계 로드 중",
        description: "소스: {{source}} | 수준: {{levels}}",
      },
      values: {
        all: "전체",
      },
    },
    honestBroker: {
      title: "정직한 중개인",
      subtitle:
        "눈가림된 설문 참여자를 등록하고 OMOP person_id 기록에 연결하며, 원시 응답자 신원을 연구자에게 노출하지 않고 제출 상태를 모니터링합니다.",
      actions: {
        cancel: "취소",
        registerParticipant: "참여자 등록",
        sendInvitation: "초대 보내기",
        sendInvite: "초대 보내기",
        refresh: "새로고침",
        copyLink: "링크 복사",
        openSurvey: "설문 열기",
        resend: "재전송",
        revoke: "취소",
      },
      labels: {
        personId: "Person ID",
        notes: "메모",
        participant: "참여자",
        deliveryEmail: "전달 이메일",
        unknown: "알 수 없음",
        unknownInstrument: "알 수 없는 도구",
        notYet: "아직 아님",
        notRecorded: "기록되지 않음",
        system: "시스템",
        statusToken: "{{status}} · {{token}}",
        tokenReference: "...{{token}}",
      },
      metrics: {
        brokerCampaigns: "중개인 캠페인",
        registeredParticipants: "등록된 참여자",
        submitted: "제출됨",
        invitationsSent: "보낸 초대",
        complete: "완료",
        pending: "대기 중",
        seeded: "시드됨",
        registered: "등록됨",
        completion: "완료율",
        completionPercent: "{{value}}%",
      },
      campaignStatuses: {
        draft: "초안",
        active: "활성",
        closed: "종료됨",
      },
      matchStatuses: {
        submitted: "제출됨",
        registered: "등록됨",
        pending: "대기 중",
        matched: "연결됨",
      },
      deliveryStatuses: {
        pending: "대기 중",
        queued: "대기열",
        sent: "전송됨",
        opened: "열림",
        submitted: "제출됨",
        revoked: "취소됨",
        failed: "실패",
      },
      unauthorized: {
        title: "정직한 중개인 접근 권한 필요",
        description:
          "이 작업 공간은 눈가림된 설문 신원을 환자 기록에 연결하므로 데이터 관리자와 관리자에게만 제한됩니다.",
      },
      registerModal: {
        title: "참여자 등록",
        titleWithCampaign: "참여자 등록 · {{campaign}}",
        registering: "등록 중...",
        description:
          "이 설문 캠페인에서 응답자 식별자를 환자 기록에 매핑하는 눈가림 등록 항목을 생성합니다.",
        respondentIdentifier: "응답자 식별자",
        respondentPlaceholder: "MRN, 연구 코드 또는 초대 코드",
        personIdPlaceholder: "알려진 OMOP person_id",
        notesPlaceholder: "중개인 메모(선택 사항)",
      },
      inviteModal: {
        title: "초대 보내기",
        titleWithCampaign: "초대 보내기 · {{campaign}}",
        sending: "보내는 중...",
        description:
          "중개인이 관리하는 일회용 설문 링크를 보냅니다. 전달 주소와 관리 연속성은 중개인만 보관합니다.",
        selectParticipant: "참여자 선택",
        participantWithPerson: "{{blindedId}} · person {{personId}}",
        emailPlaceholder: "patient@example.org",
        lastInvitation: "최근 초대: {{status}} · 토큰 끝자리 {{token}}",
      },
      campaignRegistry: {
        title: "캠페인 등록부",
        subtitle: "정직한 중개인이 활성화된 캠페인만 표시합니다.",
        loading: "캠페인을 불러오는 중...",
        emptyPrefix: "아직 정직한 중개인 캠페인이 없습니다. 먼저 설문 캠페인에서",
        requireHonestBroker: "정직한 중개인 필요",
        emptySuffix: "옵션을 활성화하세요.",
      },
      messages: {
        selectCampaignManage: "중개인 등록을 관리할 캠페인을 선택하세요.",
        selectCampaignReview: "중개인 등록을 검토할 캠페인을 선택하세요.",
      },
      participants: {
        title: "등록된 참여자",
        subtitle: "선택한 설문 캠페인의 비식별 등록 항목입니다.",
        searchPlaceholder: "눈가림 ID, person ID, 메모 검색...",
        loading: "등록을 불러오는 중...",
        noMatches: "현재 필터와 일치하는 중개인 등록이 없습니다.",
      },
      invitations: {
        title: "초대 원장",
        subtitle:
          "중개인이 관리하는 설문 초대의 발신 및 수신 관리 연속성입니다.",
        loading: "초대를 불러오는 중...",
        empty: "이 캠페인에 아직 전송된 초대가 없습니다.",
      },
      audit: {
        title: "감사 추적",
        subtitle:
          "참여자 등록, 발신 초대, 수신 응답 이벤트에 대한 중개인 측 불변 관리 연속성입니다.",
        loading: "감사 추적을 불러오는 중...",
        empty: "아직 기록된 중개인 감사 이벤트가 없습니다.",
      },
      latest: {
        title: "최근 일치 기록",
        blindedId: "눈가림 ID",
        created: "생성됨",
      },
      table: {
        blindedParticipant: "눈가림 참여자",
        conductId: "실행 ID",
        status: "상태",
        submitted: "제출됨",
        contact: "연락처",
        latestInvite: "최근 초대",
        destination: "대상",
        sent: "전송됨",
        opened: "열림",
        reference: "참조",
        actions: "작업",
        time: "시간",
        action: "작업",
        actor: "행위자",
        inviteRef: "초대 참조",
        metadata: "메타데이터",
      },
      auditActions: {
        participant_registered: "참여자 등록됨",
        invitation_sent: "초대 전송됨",
        invitation_resent: "초대 재전송됨",
        invitation_revoked: "초대 취소됨",
        response_submitted: "응답 제출됨",
        status_changed: "상태 변경됨",
      },
      confirmRevoke: "끝자리 {{token}} 초대를 취소하시겠습니까?",
      toasts: {
        publishLinkCopied: "게시 링크가 복사되었습니다",
        publishLinkCopyFailed: "게시 링크를 복사하지 못했습니다",
        participantRegistered: "참여자가 등록되었습니다",
        participantRegisterFailed: "참여자를 등록하지 못했습니다",
        invitationSent: "초대가 전송되었습니다 · 토큰 끝자리 {{token}}",
        invitationSendFailed: "초대를 보내지 못했습니다",
        invitationResent: "초대가 재전송되었습니다 · 토큰 끝자리 {{token}}",
        invitationResendFailed: "초대를 재전송하지 못했습니다",
        invitationRevoked: "초대가 취소되었습니다 · 토큰 끝자리 {{token}}",
        invitationRevokeFailed: "초대를 취소하지 못했습니다",
      },
    },
  },
  vocabulary: {
    mappingAssistant: {
      title: "개념 매핑 어시스턴트",
      poweredBy: "Ariadne 제공",
      subtitle:
        "문자 그대로, 벡터, LLM 매칭을 사용해 소스 용어를 OMOP 표준 개념에 매핑합니다",
      filters: {
        selectedCount: "{{count}}개 선택됨",
        clearSelection: "선택 지우기",
        targetVocabulary: "대상 어휘:",
        allVocabularies: "모든 어휘",
        targetDomain: "대상 도메인:",
        allDomains: "모든 도메인",
      },
      drawer: {
        disambiguate: "명확화",
        candidateCount: "후보 {{count}}개 - 올바른 매핑을 선택하세요",
        noCandidates: "후보를 찾을 수 없습니다. 아래에서 용어를 정리해 보세요.",
        cleanRemap: "정리 및 재매핑",
        editPlaceholder: "용어를 편집하고 재매핑...",
      },
      actions: {
        clean: "정리",
        remap: "재매핑",
        acceptMapping: "매핑 승인",
        rejectMapping: "매핑 거부",
        disambiguateTitle: "명확화 - 모든 후보 보기",
        uploadCsv: "CSV 업로드",
        loadProject: "프로젝트 불러오기",
        mapping: "매핑 중...",
        mapTerms: "용어 매핑",
        clearResults: "결과 지우기",
        acceptAllThreshold: "90% 이상 모두 승인",
        saveToVocabulary: "어휘에 저장",
        saveProject: "프로젝트 저장",
        exportCsv: "CSV 내보내기",
      },
      toasts: {
        remapped: "\"{{source}}\"를 {{concept}}(으)로 재매핑했습니다",
        noMatchForCleaned:
          "정리된 용어 \"{{term}}\"에 대한 일치 항목을 찾을 수 없습니다",
        remapFailed: "재매핑에 실패했습니다",
        autoAccepted: "높은 신뢰도 매핑 {{count}}개를 자동 승인했습니다",
        savedMappings: "source_to_concept_map에 매핑 {{count}}개를 저장했습니다",
        saveMappingsFailed: "매핑을 저장하지 못했습니다",
        projectSaved: "프로젝트 저장됨: {{name}}",
        saveProjectFailed: "프로젝트를 저장하지 못했습니다",
        projectLoaded: "프로젝트 불러옴: {{name}}",
        loadProjectFailed: "프로젝트를 불러오지 못했습니다",
      },
      errors: {
        cleanupFailed: "정리에 실패했습니다.",
        mappingFailed:
          "매핑에 실패했습니다. Ariadne 서비스가 실행 중이고 접근 가능한지 확인하세요.",
      },
      results: {
        candidateCount: "후보 {{count}}개",
        overridden: "(재정의됨)",
        noMatchFound: "일치 항목 없음",
        selectOverride: "매핑을 재정의할 후보를 선택하세요",
        noAdditionalCandidates: "추가 후보가 없습니다.",
      },
      labels: {
        noValue: "-",
        separator: "-",
      },
      input: {
        termsMapped: "용어 {{count}}개 매핑됨",
        editTerms: "용어 편집",
        sourceTerms: "소스 용어",
        termsPlaceholder:
          "소스 용어를 한 줄에 하나씩 입력...\n\n제2형 당뇨병\n급성 심근경색\n고혈압\nASA 81mg",
        termsEntered: "용어 {{count}}개 입력됨",
      },
      projects: {
        loading: "프로젝트를 불러오는 중...",
        loadFailed: "프로젝트를 불러오지 못했습니다",
        empty: "저장된 프로젝트가 없습니다",
        projectMeta: "용어 {{count}}개 -- {{date}}",
        namePlaceholder: "프로젝트 이름...",
      },
      vocabularies: {
        SNOMED: "SNOMED CT",
        ICD10CM: "ICD-10-CM",
        RxNorm: "RxNorm",
        LOINC: "LOINC",
        ICD9CM: "ICD-9-CM",
        CPT4: "CPT-4",
        HCPCS: "HCPCS",
        MedDRA: "MedDRA",
      },
      domains: {
        Condition: "질환",
        Drug: "약물",
        Procedure: "시술",
        Measurement: "측정",
        Observation: "관찰",
        Device: "기기",
      },
      progress: {
        mappingTerms: "용어 {{count}}개 매핑 중...",
      },
      metrics: {
        termsMapped: "매핑된 용어",
        highConfidence: "높은 신뢰도",
        needReview: "검토 필요",
        noMatch: "일치 없음",
      },
      table: {
        sourceTerm: "소스 용어",
        bestMatch: "최적 일치",
        confidence: "신뢰도",
        matchType: "일치 유형",
        vocabulary: "어휘",
        actions: "작업",
      },
      summary: {
        mapped: "{{count}}개 매핑됨",
        high: "높음 {{count}}개",
        review: "검토 {{count}}개",
        noMatch: "일치 없음 {{count}}개",
        accepted: "승인됨 {{count}}개",
      },
    },
    conceptDetail: {
      tabs: {
        info: "정보",
        relationships: "관계",
        mapsFrom: "매핑 원본",
        hierarchy: "계층",
      },
      empty: {
        title: "세부 정보를 볼 개념을 선택하세요",
        subtitle: "왼쪽 패널에서 개념을 검색하고 클릭하세요",
        noAncestors: "상위 개념을 찾을 수 없습니다",
        noRelationships: "관계를 찾을 수 없습니다",
        noSourceCodes: "이 개념으로 매핑되는 소스 코드가 없습니다",
      },
      errors: {
        failedLoad: "개념을 불러오지 못했습니다",
      },
      toasts: {
        conceptIdCopied: "개념 ID가 복사되었습니다",
      },
      actions: {
        copyConceptId: "개념 ID 복사",
        addToSet: "세트에 추가",
      },
      values: {
        standard: "표준",
        classification: "분류",
        nonStandard: "비표준",
        valid: "유효",
      },
      sections: {
        basicInformation: "기본 정보",
        synonyms: "동의어",
        ancestors: "상위 개념",
        relationships: "관계",
        mapsFrom: "이 개념으로 매핑되는 소스 코드",
        mapsFromDescription:
          "이 표준 개념으로 매핑되는 소스 어휘 코드(ICD-10, SNOMED, RxNorm 등)",
        hierarchy: "개념 계층",
      },
      fields: {
        conceptCode: "개념 코드",
        domain: "도메인",
        vocabulary: "어휘",
        conceptClass: "개념 클래스",
        standardConcept: "표준 개념",
        invalidReason: "무효 사유",
        validStartDate: "유효 시작일",
        validEndDate: "유효 종료일",
      },
      table: {
        id: "ID",
        name: "이름",
        domain: "도메인",
        vocabulary: "어휘",
        relationship: "관계",
        relatedId: "관련 ID",
        relatedName: "관련 이름",
        code: "코드",
        class: "클래스",
      },
      pagination: {
        showingRange: "{{total}}개 중 {{start}}-{{end}} 표시",
        showingSourceCodes:
          "소스 코드 {{total}}개 중 {{shown}}개 표시",
      },
    },
    semanticSearch: {
      hecate: "Hecate",
      poweredBy: "Hecate 제공",
      tagline: "벡터 기반 개념 검색",
      placeholder: "시맨틱 검색할 임상 용어를 입력하세요...",
      filters: {
        allDomains: "모든 도메인",
        allVocabularies: "모든 어휘",
        standard: {
          all: "전체",
          standard: "S",
          classification: "C",
        },
      },
      badges: {
        standard: "표준",
        classification: "분류",
      },
      values: {
        inSet: "세트에 있음",
        standardAbbrev: "S",
      },
      actions: {
        addToSet: "세트에 추가",
        clearFilters: "필터 지우기",
        retry: "재시도",
        tryClearingFilters: "필터를 지워 보세요",
      },
      errors: {
        unavailable: "시맨틱 검색을 사용할 수 없습니다.",
        serviceHelp:
          "Hecate AI 서비스가 실행 중이고 ChromaDB가 초기화되었는지 확인하세요.",
      },
      empty: {
        prompt: "시맨틱 검색할 임상 용어를 입력하세요",
        help:
          "Hecate는 벡터 임베딩을 사용해 정확한 키워드 일치가 실패해도 개념적으로 유사한 OMOP 개념을 찾습니다.",
        noResults: "\"{{query}}\"에 대한 시맨틱 일치 항목이 없습니다",
      },
      results: {
        matchCountOne: "시맨틱 일치 {{count}}개",
        matchCountMany: "시맨틱 일치 {{count}}개",
        updating: "업데이트 중...",
      },
    },
    searchPanel: {
      placeholder: "개념 검색...",
      filters: {
        toggle: "필터",
        standardOnly: "표준",
        allDomains: "모든 도메인",
        allVocabularies: "모든 어휘",
        allConceptClasses: "모든 개념 클래스",
        countSuffix: " ({{count}})",
      },
      actions: {
        clearAllFilters: "모든 필터 지우기",
        tryClearingFilters: "필터를 지워 보세요",
        loading: "로딩 중...",
        loadMoreResults: "결과 더 불러오기",
      },
      empty: {
        prompt: "OMOP 어휘 검색",
        help: "이름, 코드 또는 ID로 검색하려면 2자 이상 입력하세요",
        noResults: "\"{{query}}\"에 대한 개념을 찾을 수 없습니다",
      },
      results: {
        showingCount: "{{total}}개 중 {{shown}}개 표시",
      },
      engine: {
        solr: "Solr",
        pg: "PG",
      },
      values: {
        inSet: "세트에 있음",
      },
    },
    conceptComparison: {
      title: "개념 비교",
      subtitle:
        "속성, 상위 개념, 관계를 포함해 OMOP 개념 2-4개를 나란히 비교합니다",
      search: {
        placeholder: "추가할 개념 검색...",
      },
      sections: {
        ancestors: "상위 개념(2단계)",
        relationships: "관계",
      },
      fields: {
        conceptCode: "개념 코드",
        domain: "도메인",
        vocabulary: "어휘",
        conceptClass: "개념 클래스",
        standard: "표준",
        validStart: "유효 시작",
        validEnd: "유효 종료",
        invalidReason: "무효 사유",
      },
      actions: {
        addConcept: "개념 추가",
      },
      empty: {
        prompt: "비교할 개념을 검색하세요",
        help:
          "개념 2-4개를 선택해 속성, 상위 개념, 관계를 나란히 비교하세요",
      },
      values: {
        standard: "표준",
        classification: "분류",
        nonStandard: "비표준",
        valid: "유효",
        level: "L{{level}}",
        selected: "선택됨:",
        addOneMore: "비교하려면 하나 이상 더 추가하세요",
      },
    },
    addToConceptSet: {
      title: "개념 세트에 추가",
      create: {
        title: "새 개념 세트 만들기",
        help: "개념을 추가하고 Builder에서 열기",
        nameLabel: "새 개념 세트 이름",
      },
      actions: {
        create: "생성",
        cancel: "취소",
        openBuilderWithSearch: "현재 검색으로 Builder 열기",
      },
      divider: "또는 기존 세트에 추가",
      filter: {
        placeholder: "개념 세트 필터...",
      },
      empty: {
        noMatching: "일치하는 개념 세트가 없습니다",
        noSets: "개념 세트를 찾을 수 없습니다",
      },
      footer: {
        includeDescendants: "Include Descendants로 추가합니다",
      },
      toasts: {
        addedToSet: "\"{{setName}}\"에 추가했습니다",
        addFailed: "개념을 세트에 추가하지 못했습니다",
        missingSetId: "새 개념 세트 ID를 가져오지 못했습니다",
        createdAndAdded: "\"{{name}}\"을 만들고 개념을 추가했습니다",
        createdAddFailed: "세트는 생성되었지만 개념을 추가하지 못했습니다",
        createFailed: "개념 세트를 만들지 못했습니다",
      },
    },
    page: {
      title: "어휘 브라우저",
      subtitle: "OMOP 표준 어휘를 검색, 탐색, 이동합니다",
      tabs: {
        keyword: "키워드 검색",
        semantic: "시맨틱 검색",
        browse: "계층 찾아보기",
      },
    },
    hierarchyBrowser: {
      breadcrumb: {
        allDomains: "모든 도메인",
      },
      filters: {
        allSources: "모든 소스",
        itemPlaceholder: "{{count}}개 항목 필터...",
      },
      actions: {
        showAllConcepts: "모든 개념 표시",
        showGroupings: "그룹 표시",
        clearFilter: "필터 지우기",
        viewDetailsFor: "{{conceptName}} 세부 정보 보기",
        viewConceptDetails: "개념 세부 정보 보기",
      },
      empty: {
        noMatchingConcepts: "일치하는 개념이 없습니다",
        noConcepts: "개념을 찾을 수 없습니다",
      },
      counts: {
        clinicalGroupings: "임상 그룹 {{count}}개",
        concepts: "개념 {{count}}개",
        items: "항목 {{count}}개",
        filteredItems: "{{total}}개 중 {{shown}}개 항목",
        namedSubCategories: "{{name}} - 하위 범주 {{count}}개",
        subCategories: "하위 범주 {{count}}개",
        subcategories: "하위 범주 {{count}}개",
        oneAnchor: "앵커 1개",
        persons: "사람 {{count}}명",
        records: "레코드 {{count}}개",
        groupingCoversSubcategories:
          "{{groupingName}}은(는) 하위 범주 {{count}}개를 포함합니다",
      },
    },
    hierarchyTree: {
      empty: {
        noData: "사용 가능한 계층 데이터가 없습니다",
      },
    },
  },
  dataExplorer: {
    page: {
      title: "데이터 탐색기",
      subtitle: "Achilles 특성화 결과와 데이터 품질을 탐색합니다",
      selectSourceTitle: "데이터 소스를 선택하세요",
      selectSourceMessage:
        "위 드롭다운에서 CDM 소스를 선택해 데이터를 탐색하세요",
    },
    tabs: {
      overview: "개요",
      domains: "도메인",
      temporal: "시간",
      heel: "Achilles",
      dqd: "데이터 품질",
      ares: "Ares",
    },
    sourceSelector: {
      loading: "소스를 불러오는 중...",
      placeholder: "데이터 소스 선택",
    },
    domains: {
      condition: "질환",
      drug: "약물",
      procedure: "시술",
      measurement: "측정",
      observation: "관찰",
      visit: "방문",
    },
    overview: {
      metrics: {
        persons: "사람",
        personsTotal: "총 {{value}}명",
        medianObsDuration: "관찰 기간 중앙값",
        durationDays: "{{value}}일",
        observationPeriods: "관찰 기간 {{value}}개",
        totalEvents: "전체 이벤트",
        acrossAllCdmTables: "모든 CDM 테이블 기준",
        dataCompleteness: "데이터 완전성",
        tablesPopulated: "{{total}}개 테이블 중 {{populated}}개 채워짐",
      },
      sections: {
        demographics: "모집단 인구통계",
        observationPeriods: "관찰 기간 분석",
        domainRecordProportions: "도메인 기록 비율",
        dataDensityOverTime: "시간별 데이터 밀도",
        recordDistribution: "기록 분포",
      },
      cards: {
        genderDistribution: "성별 분포",
        ethnicity: "민족성",
        race: "인종",
        topTen: "상위 10개",
        yearOfBirthDistribution: "출생연도 분포",
        yearOfBirthSubtitle: "평활 밀도(금색)가 포함된 히스토그램",
        cumulativeObservationDuration: "누적 관찰 기간",
        cumulativeObservationSubtitle:
          "Kaplan-Meier 방식: X일 이상 관찰된 사람의 비율",
        observationStartEndDates: "관찰 시작 / 종료 날짜",
        observationStartEndSubtitle: "관찰 기간의 시간적 분포",
        observationPeriodDurationDays: "관찰 기간 길이(일)",
        observationPeriodsPerPerson: "사람당 관찰 기간",
        observationPeriodsPerPersonSubtitle:
          "각 사람이 가진 관찰 기간 수의 분포",
        clinicalDataDomains: "임상 데이터 도메인",
        clinicalDataDomainsSubtitle:
          "기록 수 기준 정렬 - 도메인을 클릭해 개념을 탐색하세요",
        recordsByDomainAndYear: "도메인 및 연도별 기록",
        recordsByDomainAndYearSubtitle:
          "색상 강도는 도메인과 연도별 기록량을 나타냅니다",
        cdmTableRecordCounts: "CDM 테이블 기록 수",
        cdmTableRecordCountsSubtitle:
          "로그 스케일 - 크기와 관계없이 모든 테이블을 볼 수 있습니다",
      },
      messages: {
        runAchillesForTemporalData:
          "시간 추세 데이터를 생성하려면 Achilles를 실행하세요",
      },
    },
    charts: {
      common: {
        records: "기록 {{count}}개",
        persons: "사람 {{count}}명",
        total: "전체",
        separator: "·",
      },
      boxPlot: {
        noDistributionData: "분포 데이터가 없습니다",
        ariaLabel: "상자 그림",
        labels: {
          p25: "P25: {{value}}",
          median: "중앙값: {{value}}",
          p75: "P75: {{value}}",
        },
      },
      cumulativeObservation: {
        tooltipValue: "{{days}}일 - 사람의 {{pct}}%",
        xAxisLabel: "관찰 기간(일)",
        labels: {
          min: "최소",
          p10: "P10",
          p25: "P25",
          median: "중앙값",
          p75: "P75",
          p90: "P90",
          max: "최대",
        },
      },
      demographics: {
        ageDistribution: "나이 분포",
        noAgeData: "나이 분포 데이터가 없습니다",
        age: "나이",
        male: "남성",
        female: "여성",
      },
      heatmap: {
        ariaLabel: "데이터 밀도 히트맵",
      },
      hierarchy: {
        noData: "사용 가능한 계층 데이터가 없습니다",
        classificationHierarchy: "분류 계층",
        back: "뒤로",
      },
      periodCount: {
        observationPeriods: "관찰 기간 {{count}}개",
      },
      recordCounts: {
        noData: "사용 가능한 기록 수 데이터가 없습니다",
        title: "CDM 테이블별 기록 수",
      },
      temporalTrend: {
        events: "이벤트",
        secondary: "보조",
      },
      topConcepts: {
        noData: "사용 가능한 개념 데이터가 없습니다",
        title: "상위 개념",
        id: "ID: {{id}}",
        prevalence: "유병률: {{value}}%",
      },
      yearOfBirth: {
        year: "연도: {{year}}",
      },
    },
    domain: {
      metrics: {
        totalRecords: "전체 기록",
        distinctConcepts: "고유 개념",
      },
      loadFailed: "{{domain}} 데이터를 불러오지 못했습니다",
      temporalTrendTitle: "{{domain}} 시간 추세",
    },
    temporal: {
      domainsLabel: "도메인:",
      multiDomainOverlay: "다중 도메인 시간 오버레이",
      emptyTitle: "사용 가능한 시간 데이터가 없습니다",
      emptyHelp: "위에서 도메인을 선택하고 Achilles가 실행되었는지 확인하세요",
    },
    concept: {
      details: "개념 세부 정보",
      loadFailed: "개념 세부 정보를 불러오지 못했습니다",
      genderDistribution: "성별 분포",
      temporalTrend: "시간 추세",
      typeDistribution: "유형 분포",
      ageAtFirstOccurrence: "첫 발생 시 나이",
      valueByLabel: "{{label}}: {{value}}",
    },
    achilles: {
      severities: {
        error: "오류",
        warning: "경고",
        notification: "알림",
      },
      severityCounts: {
        error: "오류",
        warning: "경고",
        notification: "알림",
      },
      actions: {
        running: "실행 중...",
        runHeelChecks: "Heel 검사 실행",
        runAchilles: "Achilles 실행",
        selectRun: "실행 선택",
        viewLiveProgress: "실시간 진행 보기",
        viewDetails: "세부 정보 보기",
      },
      runShort: "실행 {{id}}...",
      statuses: {
        completed: "완료됨",
        failed: "실패",
        running: "실행 중",
        pending: "대기 중",
      },
      labels: {
        status: "상태",
        total: "전체",
        passed: "통과",
        failed: "실패",
        durationSeconds: "소요 시간: {{value}}초",
      },
      heel: {
        title: "Heel 검사",
        dispatchFailed: "Heel 검사를 시작하지 못했습니다",
        running: "Heel 검사를 실행 중...",
        empty: "아직 실행된 Heel 검사가 없습니다",
        allPassed: "모든 검사를 통과했습니다",
        issueSummary:
          "이슈 {{count}}개: 오류 {{errors}} / 경고 {{warnings}} / 알림 {{notifications}}",
      },
      characterization: {
        title: "Achilles 특성화",
        dispatchFailed: "Achilles 실행을 시작하지 못했습니다",
        empty: "아직 Achilles 실행이 없습니다",
        emptyHelp: '"Achilles 실행"을 클릭해 데이터를 특성화하세요',
      },
      runModal: {
        completedIn: "{{duration}} 만에 완료됨",
        analysisProgress: "분석 {{total}}개 중 {{done}}개",
        elapsed: "경과:",
        passedCount: "{{count}}개 통과",
        failedCount: "{{count}}개 실패",
        totalDuration: "총 {{duration}}",
        remaining: "약 {{duration}} 남음",
        waiting: "분석 시작을 기다리는 중...",
        done: "완료",
        runInBackground: "백그라운드에서 실행",
      },
    },
    dqd: {
      categories: {
        completeness: "완전성",
        conformance: "적합성",
        plausibility: "개연성",
        overall: "전체",
      },
      progress: {
        title: "DQD 분석 실행 중",
        checksCompleted: "{{total}}개 검사 중 {{completed}}개 완료",
        waiting: "대기 중...",
        running: "실행 중:",
      },
      labels: {
        passed: "통과",
        failed: "실패",
        remaining: "남음",
        warnings: "경고",
      },
      severity: {
        error: "오류",
        warning: "경고",
        info: "정보",
      },
      categoryPanel: {
        checkCount: "검사 {{count}}개",
        passRate: "통과율 {{percent}}%",
        table: {
          check: "검사",
          table: "테이블",
          column: "열",
          severity: "심각도",
          violationPercent: "위반 %",
        },
      },
      scorecard: {
        emptyTitle: "사용 가능한 DQD 결과가 없습니다",
        emptyDescription: "결과를 보려면 Data Quality Dashboard 분석을 실행하세요",
        overallScore: "전체 점수",
        passedFraction: "{{total}}개 중 {{passed}}개 통과",
      },
      tableGrid: {
        noResults: "표시할 DQD 결과가 없습니다",
        title: "테이블 x 범주 히트맵",
        cdmTable: "CDM 테이블",
      },
      actions: {
        runDqd: "DQD 실행",
      },
      dispatchFailed: "DQD 실행을 시작하지 못했습니다",
      empty: "아직 DQD 실행이 없습니다",
      emptyHelp: '"DQD 실행"을 클릭해 데이터 품질 분석을 시작하세요',
    },
    ares: {
      name: "Ares",
      breadcrumbSeparator: ">",
      comingSoon: "향후 단계에서 제공됩니다",
      sections: {
        hub: "허브",
        networkOverview: "네트워크 개요",
        conceptComparison: "개념 비교",
        dqHistory: "데이터 품질 이력",
        coverage: "커버리지",
        coverageMatrix: "커버리지 매트릭스",
        feasibility: "타당성",
        diversity: "다양성",
        releases: "릴리스",
        unmappedCodes: "미매핑 코드",
        cost: "비용",
        costAnalysis: "비용 분석",
        annotations: "주석",
      },
      cards: {
        sourcesBelowDq: "DQ 80% 미만 소스 {{value}}개",
        networkOverviewDescription: "소스 상태, DQ 점수, 추세 지표",
        conceptComparisonDescription: "소스 간 개념 유병률 비교",
        dqHistoryDescription: "릴리스별 네트워크 평균 DQ 점수",
        coverageDescription: "도메인 x 소스 가용성",
        feasibilityDescription: "네트워크가 연구를 지원할 수 있나요?",
        diversityDescription: "소스 간 인구통계 균형",
        releasesDescription: "소스별 버전 이력",
        unmappedCodesDescription: "표준 매핑이 없는 소스 코드",
        annotationsDescription: "모든 소스의 차트 노트",
        costDescription: "도메인 및 시간별 비용 데이터",
      },
      networkOverview: {
        title: "네트워크 개요",
        networkTotal: "네트워크 전체",
        percent: "{{value}}%",
        averagePercent: "평균 {{value}}%",
        actions: {
          dqRadar: "DQ 레이더",
          hideRadar: "레이더 숨기기",
        },
        metrics: {
          dataSources: "데이터 소스",
          avgDqScore: "평균 DQ 점수",
          unmappedCodes: "미매핑 코드",
          needAttention: "주의 필요",
          totalPersons: "전체 대상자",
        },
        table: {
          source: "소스",
          dqScore: "DQ 점수",
          dqTrend: "DQ 추세",
          freshness: "최신성",
          domains: "도메인",
          persons: "대상자",
          latestRelease: "최신 릴리스",
        },
        messages: {
          loading: "네트워크 개요를 불러오는 중...",
          noData: "사용 가능한 네트워크 데이터가 없습니다.",
          noReleases: "릴리스 없음",
        },
        radar: {
          title: "DQ 레이더 프로필(Kahn 차원)",
          description:
            "Kahn 데이터 품질 5개 차원의 통과율입니다. 값이 높을수록 품질이 좋습니다.",
          noData: "사용 가능한 DQ 레이더 데이터가 없습니다.",
          dimensions: {
            completeness: "완전성",
            conformanceValue: "적합성(값)",
            conformanceRelational: "적합성(관계)",
            plausibilityAtemporal: "개연성(비시간)",
            plausibilityTemporal: "개연성(시간)",
          },
        },
      },
      feasibility: {
        title: "타당성 평가",
        assessmentMeta: "{{date}} | 소스 {{sources}}개 평가됨",
        passedSummary: "{{total}}개 중 {{passed}}개 통과",
        resultsTitle: "결과: {{name}}",
        scoreLabel: "점수 {{score}}%",
        empty:
          "아직 평가가 없습니다. 제안된 연구를 네트워크가 지원할 수 있는지 평가하려면 새 평가를 만드세요.",
        actions: {
          newAssessment: "+ 새 평가",
          running: "실행 중...",
          runAssessment: "평가 실행",
          hide: "숨기기",
          forecast: "예측",
        },
        filters: {
          view: "보기:",
        },
        detailViews: {
          table: "점수 표",
          impact: "영향 분석",
          consort: "CONSORT 흐름",
        },
        criteria: {
          domains: "도메인",
          concepts: "개념",
          visitTypes: "방문 유형",
          dateRange: "날짜 범위",
          patientCount: "환자 수",
        },
        forecast: {
          insufficientData:
            "예측에 필요한 과거 데이터가 부족합니다(최소 6개월 필요).",
          title: "환자 유입 예측: {{source}}",
          monthlyRate: "월별 비율: 월 {{rate}}명",
          targetReachedIn: "약 {{months}}개월 후 목표 도달",
          targetAlreadyReached: "이미 목표에 도달했습니다",
          actual: "실제",
          projected: "예측",
          confidenceBand: "95% 신뢰구간",
          targetLabel: "목표: {{target}}",
          footnote:
            "최근 12개월의 선형 회귀를 기반으로 한 예측입니다. 예측 거리가 멀어질수록 신뢰구간이 넓어집니다.",
        },
        consort: {
          allSources: "모든 소스",
          noResults: "CONSORT 다이어그램에 표시할 결과가 없습니다.",
          title: "CONSORT 방식 탈락 흐름",
          description:
            "각 기준 관문에서 소스가 점진적으로 제외되는 방식을 보여줍니다.",
          sources: "소스 {{count}}개",
          excluded: "-{{count}}개 제외",
        },
        impact: {
          noData: "사용 가능한 기준 영향 데이터가 없습니다.",
          title: "기준 영향 분석",
          description:
            "각 기준을 제거했을 때 추가로 통과할 소스 수를 보여줍니다. 기준선: {{total}}개 중 {{passed}}개 통과.",
          sourcesRecovered: "+{{count}}개 소스",
          guidance:
            "가장 영향력 있는 기준은 제거 시 가장 많은 소스를 회복하는 기준입니다. 통과하는 소스가 너무 적으면 영향이 큰 기준 완화를 고려하세요.",
        },
        templates: {
          loading: "템플릿을 불러오는 중...",
          startFrom: "템플릿에서 시작",
        },
        table: {
          source: "소스",
          domains: "도메인",
          concepts: "개념",
          visits: "방문",
          dates: "날짜",
          patients: "환자",
          score: "점수",
          overall: "전체",
          forecast: "예측",
        },
        status: {
          eligible: "적합",
          ineligible: "부적합",
        },
        form: {
          title: "새 타당성 평가",
          assessmentName: "평가 이름",
          assessmentNamePlaceholder: "예: 당뇨병 결과 연구",
          requiredDomains: "필수 도메인",
          minPatientCount: "최소 환자 수(선택 사항)",
          minPatientCountPlaceholder: "예: 1000",
          domains: {
            condition: "조건",
            drug: "약물",
            procedure: "시술",
            measurement: "측정",
            observation: "관찰",
            visit: "방문",
          },
        },
      },
      annotations: {
        filters: {
          allSources: "모든 소스",
        },
        tags: {
          all: "전체",
          dataEvent: "데이터 이벤트",
          researchNote: "연구 메모",
          actionItem: "조치 항목",
          system: "시스템",
        },
        viewModes: {
          list: "목록",
          timeline: "타임라인",
        },
        actions: {
          reply: "답글",
          delete: "삭제",
        },
        replyPlaceholder: "답글 작성...",
        searchPlaceholder: "주석 검색...",
        confirmDelete: "이 주석을 삭제하시겠습니까?",
        coordinateValue: "{{axis}} = {{value}}",
        sourceContext: "{{source}}에서",
        empty: {
          selectSource: "주석을 보려면 소스를 선택하세요",
          noAnnotations: "이 소스에는 아직 주석이 없습니다",
          noTimeline: "타임라인에 표시할 주석이 없습니다.",
        },
      },
      coverage: {
        title: "커버리지 매트릭스(Strand 보고서)",
        description:
          "모든 데이터 소스의 도메인 가용성입니다. 초록색 = 고밀도, 황색 = 저밀도, 빨간색 = 데이터 없음.",
        yes: "예",
        densityTitle: "밀도: 사람당 {{density}}",
        filters: {
          view: "보기:",
        },
        viewModes: {
          records: "기록",
          per_person: "사람당",
          date_range: "날짜 범위",
        },
        actions: {
          exporting: "내보내는 중...",
          exportCsv: "CSV 내보내기",
          expectedVsActual: "예상 vs 실제",
        },
        table: {
          source: "소스",
          domains: "도메인",
        },
        expectedStates: {
          expectedPresent: "예상되었고 존재함",
          expectedMissing: "예상되었지만 누락됨",
          unexpectedBonus: "예상 밖 추가 데이터",
          notExpectedAbsent: "예상되지 않았고 없음",
        },
        messages: {
          loading: "커버리지 매트릭스를 불러오는 중...",
          noSources: "커버리지 분석에 사용할 수 있는 소스가 없습니다.",
        },
      },
      dqHistory: {
        filters: {
          source: "소스:",
          selectSource: "소스 선택...",
        },
        tabs: {
          trends: "추세",
          heatmap: "히트맵",
          sla: "SLA",
          overlay: "소스 간",
        },
        sections: {
          passRate: "릴리스별 DQ 통과율",
          heatmap: "카테고리 x 릴리스 히트맵",
          sla: "SLA 준수 대시보드",
          overlay: "소스 간 DQ 오버레이",
        },
        passRate: "통과율",
        deltaReportTitle: "델타 보고서: {{release}}",
        status: {
          new: "신규",
          existing: "기존",
          resolved: "해결됨",
          stable: "안정",
        },
        result: {
          pass: "통과",
          fail: "실패",
        },
        statusSummary: {
          new: "신규 {{count}}개",
          existing: "기존 {{count}}개",
          resolved: "해결 {{count}}개",
          stable: "안정 {{count}}개",
        },
        table: {
          category: "카테고리",
          status: "상태",
          checkId: "검사 ID",
          current: "현재",
          previous: "이전",
        },
        sla: {
          targetsTitle: "SLA 목표(최소 통과율 %)",
          currentCompliance: "현재 준수",
          actual: "실제",
          target: "목표",
          errorBudget: "오류 예산",
          targetComparison: "실제 {{actual}}% / 목표 {{target}}%",
        },
        messages: {
          selectSource: "DQ 이력을 보려면 소스를 선택하세요.",
          loadingHistory: "DQ 이력을 불러오는 중...",
          loadingDeltas: "델타를 불러오는 중...",
          loadingHeatmap: "히트맵을 불러오는 중...",
          loadingOverlay: "오버레이 데이터를 불러오는 중...",
          noOverlayData: "소스 간 사용할 수 있는 DQ 데이터가 없습니다.",
          noHeatmapData:
            "사용 가능한 히트맵 데이터가 없습니다. 카테고리 추세를 보려면 여러 릴리스에서 DQD를 실행하세요.",
          noDeltaData: "이 릴리스에 사용할 수 있는 델타 데이터가 없습니다.",
          saved: "저장됨",
          noSlaTargets:
            "정의된 SLA 목표가 없습니다. 준수 상태를 보려면 위에서 목표를 설정하세요.",
          noTrendData:
            "사용 가능한 DQ 이력 데이터가 없습니다. 추세를 보려면 최소 두 릴리스에서 DQD를 실행하세요.",
          trendHelp:
            "델타 세부 정보를 보려면 릴리스 지점을 클릭하세요. 초록색 >90%, 황색 80-90%, 빨간색 <80%.",
          overlayHelp:
            "모든 소스의 DQ 통과율을 통합 타임라인에 겹쳐 표시합니다.",
        },
        actions: {
          exporting: "내보내는 중...",
          exportCsv: "CSV 내보내기",
          saving: "저장 중...",
          saveSlaTargets: "SLA 목표 저장",
        },
      },
      unmapped: {
        filters: {
          source: "소스:",
          selectSource: "소스 선택...",
          release: "릴리스:",
          table: "테이블:",
          allTables: "모든 테이블",
          searchPlaceholder: "소스 코드 검색...",
        },
        viewModes: {
          table: "테이블",
          pareto: "Pareto",
          vocabulary: "어휘",
        },
        actions: {
          exporting: "내보내는 중...",
          exportUsagiCsv: "Usagi CSV 내보내기",
          previous: "이전",
          next: "다음",
        },
        summaryBadge: "{{table}} (코드 {{codes}}개, 기록 {{records}}개)",
        vocabularyValue: "({{vocabulary}})",
        progress: {
          noCodes: "검토할 미매핑 코드가 없습니다.",
          title: "매핑 진행률",
          reviewed: "{{percent}}% 검토됨",
          segmentTitle: "{{label}}: {{count}}개 ({{percent}}%)",
          label: "{{label}}:",
          status: {
            mapped: "매핑됨",
            deferred: "보류",
            excluded: "제외됨",
            pending: "대기 중",
          },
        },
        sections: {
          pareto: "미매핑 코드 Pareto 분석",
          vocabulary: "어휘별 미매핑 코드",
          suggestions: "AI 매핑 제안",
        },
        suggestions: {
          generating: "pgvector 유사도로 제안을 생성하는 중...",
          failed:
            "제안을 불러오지 못했습니다. AI 서비스 또는 개념 임베딩을 사용할 수 없을 수 있습니다.",
          empty:
            "사용 가능한 제안이 없습니다. 개념 임베딩이 로드되지 않았을 수 있습니다.",
          id: "ID: {{id}}",
          accepted: "승인됨",
          accept: "승인",
          skip: "건너뛰기",
        },
        pareto: {
          topCodesCoverage:
            "상위 20개 코드가 전체 미매핑 기록의 {{percent}}%를 차지합니다",
          percent: "{{value}}%",
          cumulativePercent: "누적 %",
        },
        vocabulary: {
          total: "합계",
          codeCount: "코드 {{count}}개",
        },
        messages: {
          selectSource: "미매핑 코드를 보려면 소스를 선택하세요.",
          loading: "미매핑 코드를 불러오는 중...",
          emptyPareto: "Pareto 분석용 미매핑 코드를 찾을 수 없습니다.",
          emptyVocabulary: "사용 가능한 어휘 데이터가 없습니다.",
          noneFound:
            "미매핑 소스 코드를 찾을 수 없습니다. 모든 코드가 표준 OMOP 개념에 매핑되었습니다.",
          sortedByImpact:
            "영향 점수(기록 수 x 도메인 가중치) 기준으로 정렬됨",
          showing: "{{total}}개 중 {{start}}-{{end}} 표시",
        },
        table: {
          sourceCode: "소스 코드",
          vocabulary: "어휘",
          cdmTable: "CDM 테이블",
          cdmField: "CDM 필드",
          records: "기록",
          impactScore: "영향 점수",
        },
      },
      conceptComparison: {
        title: "소스 간 개념 비교",
        searchPlaceholder:
          "개념 검색(예: '제2형 당뇨병', '메트포르민')...",
        conceptMetadata: "{{domain}} | {{vocabulary}} | ID: {{id}}",
        selectedConceptMetadata:
          "{{domain}} | {{vocabulary}} | 개념 ID: {{id}}",
        temporalTrendTitle: "시간 추세: {{concept}}",
        addConceptPlaceholder: "다른 개념 추가({{selected}}/{{max}}개 선택됨)...",
        cdcNationalRate: "CDC 전국 비율: {{value}}/1000",
        viewModes: {
          single: "단일",
          temporal: "시간",
          multi: "다중 개념",
          funnel: "탈락 퍼널",
        },
        rateModes: {
          crude: "조율",
          standardized: "연령-성별 보정",
        },
        metrics: {
          rate: "비율/1000",
          count: "건수",
          perThousandShort: "{{value}}/1000",
          perThousandLong: "1000명당 {{value}}",
        },
        messages: {
          noComparisonData: "사용 가능한 비교 데이터가 없습니다.",
          noTemporalPrevalenceData:
            "사용 가능한 시간별 유병률 데이터가 없습니다.",
          selectTwoConcepts: "비교하려면 최소 2개 개념을 선택하세요.",
          searching: "검색 중...",
          loadingComparison: "비교 데이터를 불러오는 중...",
          standardizedNote:
            "직접 연령-성별 표준화를 사용해 2020년 미국 인구조사 인구로 표준화했습니다.",
          searchToCompare:
            "모든 데이터 소스에서 유병률을 비교하려면 위에서 개념을 검색하세요.",
          loadingTemporal: "시간별 유병률을 불러오는 중...",
          noTemporalData: "이 개념에 사용할 수 있는 시간 데이터가 없습니다.",
          searchForTemporal:
            "릴리스 전반의 시간별 유병률 추세를 보려면 위에서 개념을 검색하세요.",
          loadingMulti: "다중 개념 비교를 불러오는 중...",
          loadingFunnel: "탈락 퍼널을 불러오는 중...",
          noAttritionData:
            "선택한 개념에 사용할 수 있는 탈락 데이터가 없습니다.",
          temporalPrevalenceHelp:
            "시간에 따른 1,000명당 비율입니다.",
        },
      },
      releases: {
        releaseTypes: {
          etl: "ETL",
          scheduledEtl: "예약 ETL",
          snapshot: "스냅샷",
        },
        cdmVersion: "CDM {{version}}",
        vocabularyVersion: "어휘 {{version}}",
        personCount: "사람 {{value}}명",
        recordCount: "기록 {{value}}개",
        actions: {
          showDiff: "차이 보기",
          editRelease: "릴리스 편집",
          createRelease: "릴리스 생성",
          creating: "생성 중...",
          create: "생성",
          saving: "저장 중...",
          save: "저장",
          cancel: "취소",
        },
        etl: {
          provenance: "ETL 출처",
          ranBy: "실행자:",
          codeVersion: "코드 버전:",
          duration: "소요 시간:",
          started: "시작:",
          parameters: "매개변수:",
        },
        duration: {
          hoursMinutes: "{{hours}}시간 {{minutes}}분",
          minutesSeconds: "{{minutes}}분 {{seconds}}초",
          seconds: "{{seconds}}초",
        },
        confirmDelete: "이 릴리스를 삭제하시겠습니까?",
        tabs: {
          list: "릴리스",
          swimlane: "스윔레인",
          calendar: "캘린더",
        },
        timelineTitle: "릴리스 타임라인(모든 소스)",
        calendarTitle: "릴리스 캘린더",
        selectSource: "소스 선택",
        form: {
          releaseName: "릴리스 이름",
          cdmVersion: "CDM 버전",
          vocabularyVersion: "어휘 버전",
          etlVersion: "ETL 버전",
          notes: "메모",
          notesPlaceholder: "릴리스 메모...",
          cdmVersionOptional: "CDM 버전(선택 사항)",
          vocabularyVersionOptional: "어휘 버전(선택 사항)",
          cdmVersionPlaceholder: "CDM v5.4",
          vocabularyVersionPlaceholder: "2024-11-01",
          etlVersionPlaceholder: "v1.2.3",
        },
        empty: {
          selectSource: "릴리스를 보려면 소스를 선택하세요",
          noReleases: "이 소스에는 아직 릴리스가 없습니다",
          noReleaseData: "사용 가능한 릴리스 데이터가 없습니다.",
        },
        calendar: {
          noEvents: "릴리스 이벤트가 없습니다.",
          dayEvents: "{{date}}: 릴리스 {{count}}개",
          less: "적음",
          more: "많음",
        },
        diff: {
          computing: "차이를 계산하는 중...",
          title: "릴리스 차이",
          initialRelease: "초기 릴리스 -- 비교할 이전 데이터가 없습니다.",
          persons: "사람:",
          records: "기록:",
          dqScore: "DQ 점수:",
          unmapped: "미매핑:",
          vocabUpdated: "어휘 업데이트됨",
          domainDeltas: "도메인 델타:",
        },
      },
      diversity: {
        title: "다양성 보고서",
        description:
          "데이터 소스별 인구통계 비율입니다. 소스는 모집단 크기순으로 정렬됩니다.",
        ratings: {
          very_high: "매우 높음",
          high: "높음",
          moderate: "보통",
          low: "낮음",
        },
        percentValue: "{{value}}%",
        labelPercentValue: "{{label}}: {{value}}%",
        personCount: "사람 {{value}}명",
        labels: {
          gender: "성별",
          race: "인종",
          ethnicity: "민족성",
          male: "남성",
          female: "여성",
        },
        dimensions: {
          composite: "종합",
          gender: "성별",
          race: "인종",
          ethnicity: "민족성",
        },
        tabs: {
          overview: "개요",
          pyramid: "연령 피라미드",
          dap: "DAP 격차",
          pooled: "통합",
          geographic: "지역",
          trends: "추세",
        },
        filters: {
          selectSource: "소스 선택",
        },
        benchmarks: {
          usCensus2020: "2020년 미국 인구조사",
        },
        dap: {
          title: "FDA DAP 등록 격차 분석",
          description:
            "등록 격차를 식별하기 위해 소스 인구통계를 2020년 미국 인구조사 기준값과 비교합니다.",
          tooltip: "실제: {{actual}}% | 목표: {{target}}% | 격차: {{gap}}%",
          status: {
            met: "충족(2% 이내)",
            gap: "격차(2-10%)",
            critical: "심각(>10%)",
          },
        },
        agePyramid: {
          title: "{{source}} -- 연령 분포",
        },
        benchmark: {
          title: "기준값: {{label}}",
          actual: "실제",
          benchmark: "기준값",
        },
        trends: {
          title: "다양성 추세: {{source}}",
          description:
            "릴리스별 Simpson 다양성 지수(0 = 동질적, 1 = 최대 다양성)",
        },
        geographic: {
          loading: "지역 다양성 데이터를 불러오는 중...",
          noLocationData: "사용 가능한 위치 데이터가 없습니다",
          noAdiData:
            "ADI 데이터를 사용할 수 없습니다(GIS 모듈에 ADI가 로드되지 않았을 수 있음)",
          noGeographicData:
            "사용 가능한 지역 데이터가 없습니다. 소스의 person 테이블에 위치 데이터가 없을 수 있습니다.",
          statesCovered: "포함된 주 / 지역",
          networkMedianAdi: "네트워크 ADI 중앙값:",
          sourcesWithLocation: "위치 데이터가 있는 소스",
          sourcesWithAdi: "ADI 데이터가 있는 소스",
          stateCount: "주 {{count}}개",
          medianAdiValue: "ADI 중앙값: {{value}}",
          topStates: "환자 수 상위 주",
          adiDistribution: "ADI 십분위 분포",
          leastDeprived: "박탈 수준 낮음",
          adiDecile: "ADI 십분위",
          mostDeprived: "박탈 수준 높음",
          decileTitle: "{{decile}}십분위: ZIP 코드 {{count}}개",
          adiRatings: {
            low: "낮은 박탈",
            moderate: "중간 박탈",
            high: "높은 박탈(서비스 부족)",
          },
        },
        pooled: {
          title: "통합 인구통계",
          description:
            "여러 소스를 선택해 가중 병합된 인구통계 프로필을 확인하세요.",
          summary: "총 {{persons}}명, {{sources}}개 소스",
        },
        messages: {
          loading: "다양성 데이터를 불러오는 중...",
          noSources: "다양성 분석에 사용할 수 있는 소스가 없습니다.",
          noData: "데이터 없음",
          noTrendData: "다양성 추세에 사용할 수 있는 릴리스 데이터가 없습니다.",
          noTrendReleases:
            "이 소스에서 릴리스를 찾을 수 없습니다. 다양성 추세를 추적하려면 릴리스를 생성하세요.",
        },
      },
      cost: {
        empty: {
          title: "비용 데이터 없음",
          message:
            "비용 데이터에는 청구 기반 데이터셋(예: MarketScan, Optum, PharMetrics)이 필요합니다. SynPUF, MIMIC-IV 및 대부분의 학술 의료센터 데이터처럼 EHR에서 파생된 데이터셋은 일반적으로 OMOP cost 테이블을 채우지 않습니다.",
        },
        filters: {
          source: "소스:",
          selectSource: "소스 선택...",
        },
        tabs: {
          overview: "개요",
          distribution: "분포",
          "care-setting": "진료 환경",
          trends: "추세",
          drivers: "비용 요인",
          "cross-source": "소스 간",
        },
        messages: {
          selectSource: "비용 데이터를 보려면 소스를 선택하세요.",
          loading: "비용 데이터를 불러오는 중...",
          distributionHelp:
            "비용 분포를 보여주는 상자-수염 그림입니다. 상자 = IQR(P25-P75), 수염 = P10-P90, 금색 선 = 중앙값, 빨간 점 = 평균.",
          noDistributionData: "사용 가능한 분포 데이터가 없습니다.",
          noCareSettingData:
            "사용 가능한 진료 환경별 비용 데이터가 없습니다. visit_occurrence와 결합된 Visit 도메인 비용 기록이 필요합니다.",
          selectSourceForDrivers: "비용 요인을 보려면 소스를 선택하세요.",
          loadingDrivers: "비용 요인을 불러오는 중...",
          noDriverData:
            "이 소스에 사용할 수 있는 비용 요인 데이터가 없습니다.",
          costDriversHelp:
            "총 비용 기준 상위 10개 개념입니다. 막대를 클릭하면 개념 세부 정보를 볼 수 있습니다.",
          loadingCrossSource: "소스 간 비교를 불러오는 중...",
          noComparisonSources: "비교에 사용할 수 있는 소스가 없습니다.",
          noCrossSourceCostData:
            "비교할 비용 데이터가 있는 소스가 없습니다.",
          crossSourceHelp:
            "소스별 상자-수염 그림입니다. 상자 = IQR(P25-P75), 수염 = P10-P90, 금색 선 = 중앙값.",
        },
        metrics: {
          totalCost: "총 비용",
          perPatientPerYear: "환자-연도당",
          persons: "사람",
          observationYears: "{{value}}년",
          avgObservation: "평균 관찰",
          recordsAverage: "기록 {{records}}개 | 평균 {{average}}",
          recordCount: "기록 {{count}}개",
          patientCount: "환자 {{count}}명",
          averagePerRecord: "평균: 기록당 {{value}}",
          medianValue: "중앙값: {{value}}",
          meanValue: "평균: {{value}}",
          percent: "{{value}}%",
          range: "범위: {{min}} - {{max}}",
        },
        costTypeFilter: {
          title: "여러 비용 유형이 감지되었습니다.",
          message:
            "이 소스에는 서로 다른 비용 유형 개념이 {{count}}개 있습니다. 청구 금액과 지불 금액을 혼합하면 통계가 왜곡됩니다. 정확한 분석을 위해 비용 유형으로 필터링하세요.",
          allTypes: "모든 유형",
          option: "{{name}} ({{count}})",
        },
        sections: {
          costByDomain: "도메인별 비용",
          distributionByDomain: "도메인별 비용 분포",
          costByCareSetting: "진료 환경별 비용",
          monthlyTrends: "월별 비용 추세",
          topCostDrivers: "주요 비용 요인",
          crossSourceComparison: "소스 간 비용 비교",
        },
      },
    },
  },
  jobs: {
    page: {
      title: "작업",
      subtitle: "백그라운드 작업과 대기열 상태를 모니터링합니다",
      empty: {
        title: "작업을 찾을 수 없습니다",
        archived: "24시간보다 오래된 보관 작업이 없습니다.",
        filtered: "{{status}} 상태의 작업이 없습니다. 다른 필터를 사용해 보세요.",
        recent:
          "최근 24시간 내 작업이 없습니다. 이전 작업은 보관됨을 확인하세요.",
      },
      table: {
        job: "작업",
        type: "유형",
        source: "소스",
        started: "시작",
        duration: "소요 시간",
        status: "상태",
        actions: "작업",
      },
      pagination: "{{last}}페이지 중 {{current}}페이지 · 작업 {{total}}개",
    },
    filters: {
      statuses: {
        all: "전체(24시간)",
        pending: "대기 중",
        queued: "대기열",
        running: "실행 중",
        completed: "완료",
        failed: "실패",
        cancelled: "취소됨",
        archived: "보관됨",
      },
      types: {
        all: "모든 유형",
        analysis: "분석",
        characterization: "특성화",
        incidenceRate: "발생률",
        estimation: "추정",
        prediction: "예측",
        pathway: "경로",
        sccs: "SCCS",
        evidenceSynthesis: "근거 합성",
        cohortGeneration: "코호트 생성",
        careGaps: "진료 격차",
        achilles: "Achilles",
        dataQuality: "데이터 품질",
        heelChecks: "HEEL 검사",
        ingestion: "수집",
        vocabulary: "어휘",
        genomicParse: "유전체 파싱",
        poseidon: "Poseidon ETL",
        fhirExport: "FHIR 내보내기",
        fhirSync: "FHIR 동기화",
        gisImport: "GIS 가져오기",
        gisBoundaries: "GIS 경계",
      },
    },
    actions: {
      retry: "재시도",
      retryJob: "작업 재시도",
      cancel: "취소",
      cancelJob: "작업 취소",
      previous: "이전",
      next: "다음",
    },
    drawer: {
      titleFallback: "작업 상세",
      loadError: "작업 상세 정보를 불러오지 못했습니다.",
      sections: {
        executionLog: "실행 로그",
        analysis: "분석",
        cohort: "코호트",
        ingestionPipeline: "수집 파이프라인",
        fhirSync: "FHIR 동기화",
        dataQuality: "데이터 품질",
        heelChecks: "HEEL 검사",
        achillesAnalyses: "Achilles 분석",
        genomicParse: "유전체 파싱",
        poseidonEtl: "Poseidon ETL",
        careGapEvaluation: "진료 격차 평가",
        gisBoundaries: "GIS 경계",
        gisImport: "GIS 가져오기",
        vocabularyImport: "어휘 가져오기",
        fhirExport: "FHIR 내보내기",
        overview: "개요",
        output: "출력",
      },
      labels: {
        analysis: "분석",
        createdBy: "생성자",
        parameters: "매개변수",
        cohort: "코호트",
        personCount: "대상자 수",
        source: "소스",
        sourceKey: "소스 키",
        stage: "단계",
        project: "프로젝트",
        file: "파일",
        fileSize: "파일 크기",
        mappingCoverage: "매핑 범위",
        processed: "처리됨",
        failed: "실패",
        filesDownloaded: "다운로드된 파일",
        recordsExtracted: "추출된 레코드",
        recordsMapped: "매핑된 레코드",
        recordsWritten: "기록된 레코드",
        recordsFailed: "실패한 레코드",
        passed: "통과",
        passRate: "통과율",
        expectedChecks: "예상 검사",
        executionTime: "실행 시간",
        failingChecks: "실패한 검사",
        totalRules: "전체 규칙",
        rulesTriggered: "트리거된 규칙",
        totalViolations: "전체 위반",
        topViolations: "주요 위반",
        completed: "완료",
        byCategory: "카테고리별",
        failedSteps: "실패한 단계",
        format: "형식",
        totalVariants: "전체 변이",
        mappedVariants: "매핑된 변이",
        samples: "샘플",
        runType: "실행 유형",
        dagsterRunId: "Dagster 실행 ID",
        stats: "통계",
        bundle: "번들",
        complianceSummary: "준수 요약",
        dataset: "데이터셋",
        dataType: "데이터 유형",
        version: "버전",
        geometry: "기하",
        features: "피처",
        tablesLoaded: "로드된 테이블",
        recordsLoaded: "로드된 레코드",
        outputFormat: "출력 형식",
        type: "유형",
        triggeredBy: "시작한 사용자",
        duration: "소요 시간",
        started: "시작",
        created: "생성됨",
        error: "오류",
      },
      messages: {
        stalled:
          "이 작업은 중단되어 1시간 제한을 초과한 후 실패로 표시되었습니다.",
        failedCount: "{{count}}개 실패",
        runningCount: "{{count}}개 실행 중",
        ofTotal: "전체 {{count}}개 중",
        records: "{{count}}개 레코드",
      },
    },
  },
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

const frApp: MessageTree = mergeMessageTrees(enApp, {
  errors: {
    boundary: {
      title: "Une erreur est survenue",
      message: "Une erreur inattendue s'est produite. Essayez de recharger la page.",
      reloadPage: "Recharger la page",
    },
    route: {
      routeError: "Erreur de route",
      pageFailed: "La page n'a pas pu s'afficher.",
      analysisDescription:
        "Cette page d'analyse a rencontré une erreur de rendu ou de chargement de route.",
      label: "Erreur",
      backToAnalyses: "Retour aux analyses",
      reloadPage: "Recharger la page",
    },
  },
  analysis: {
    titles: {
      characterization: "Caractérisation",
      incidenceRate: "Analyse du taux d'incidence",
      pathway: "Analyse des parcours",
      estimation: "Analyse d'estimation",
      prediction: "Analyse de prédiction",
      sccs: "Analyse SCCS",
      evidenceSynthesis: "Analyse de synthèse des preuves",
    },
  },
  studies: {
    list: {
      title: "Études",
      subtitle: "Orchestrer et gérer les études de recherche fédérées",
      tableView: "Vue tableau",
      cardView: "Vue carte",
      searchPlaceholder: "Rechercher des études...",
      noSearchMatches: "Aucune étude ne correspond à \"{{query}}\"",
      typeToFilter: "Tapez pour filtrer les études {{count}}",
      newStudy: "Nouvelle étude",
      solr: "Solr",
      drilldownTitle: "Études {{phase}}",
      filterLabels: {
        status: "Statut",
        type: "Catégorie",
        priority: "Priorité"
      },
      loadFailed: "Échec du chargement des études",
      clear: "Effacer",
      empty: {
        noMatchingTitle: "Aucune étude correspondante",
        noStudiesTitle: "Pas encore d'études",
        noResultsFor: "Aucune étude trouvée pour \"{{query}}\"",
        tryAdjusting: "Essayez d'ajuster vos termes de recherche.",
        createFirst: "Créez votre première étude pour orchestrer la recherche fédérée."
      },
      table: {
        title: "Titre",
        type: "Catégorie",
        status: "Statut",
        priority: "Priorité",
        pi: "IP",
        created: "Créé"
      },
      pagination: {
        showing: "Montrant {{start}} - {{end}} de {{total}}",
        page: "{{page}} / {{totalPages}}"
      }
    },
    metrics: {
      total: "Total général",
      active: "Actif",
      preStudy: "Pré-étude",
      inProgress: "En cours",
      postStudy: "Post-étude"
    },
    studyTypes: {
      characterization: "Caractérisation",
      populationLevelEstimation: "PLE",
      patientLevelPrediction: "PLP",
      comparativeEffectiveness: "Comparatif",
      safetySurveillance: "Sécurité",
      drugUtilization: "Util. médicaments",
      qualityImprovement: "AQ",
      custom: "Personnalisé"
    },
    statuses: {
      draft: "Brouillon",
      protocol_development: "Développement de protocole",
      feasibility: "Faisabilité",
      irb_review: "Examen par le comité d'éthique",
      execution: "Exécution",
      analysis: "Analyse",
      published: "Publié",
      archived: "Archivé"
    },
    priorities: {
      critical: "Critique",
      high: "Élevée",
      medium: "Moyenne",
      low: "Faible"
    },
    phases: {
      activeMetric: "Actif",
      pre_study: "Pré-étude",
      active: "En cours",
      post_study: "Post-étude"
    },
    create: {
      backToStudies: "Études",
      title: "Créer une étude",
      subtitle: "Configurez votre étude de recherche étape par étape",
      previous: "Précédent",
      next: "Suivant",
      createAsDraft: "Créer en brouillon",
      steps: {
        basics: "Informations de base",
        science: "Conception scientifique",
        team: "Équipe et chronologie",
        review: "Vérifier et créer"
      },
      studyTypes: {
        characterization: {
          label: "Caractérisation",
          description: "Décrire les populations de patients et les modèles de traitement"
        },
        populationLevelEstimation: {
          label: "Estimation au niveau de la population",
          description: "Estimer les effets causals à l’aide de données d’observation"
        },
        patientLevelPrediction: {
          label: "Prédiction au niveau du patient",
          description: "Prédire les résultats individuels des patients"
        },
        comparativeEffectiveness: {
          label: "Efficacité comparative",
          description: "Comparez les traitements dans des contextes réels"
        },
        safetySurveillance: {
          label: "Surveillance de la sécurité",
          description: "Surveiller les signaux de sécurité des médicaments après la commercialisation"
        },
        drugUtilization: {
          label: "Utilisation des médicaments",
          description: "Analyser les modèles et les tendances de consommation de médicaments"
        },
        qualityImprovement: {
          label: "Amélioration de la qualité",
          description: "Évaluer la qualité des soins et le respect des directives"
        },
        custom: {
          label: "Personnalisé",
          description: "Définir un type d'étude personnalisé"
        }
      },
      designs: {
        select: "Sélectionner une conception...",
        retrospectiveCohort: "Cohorte rétrospective",
        prospectiveCohort: "Cohorte prospective",
        caseControl: "Cas-témoin",
        crossSectional: "Transversale",
        selfControlled: "Série de cas auto-contrôlés",
        nestedCaseControl: "Cas-témoins imbriqués",
        metaAnalysis: "Méta-analyse",
        networkStudy: "Étude en réseau",
        methodological: "Méthodologique"
      },
      phases: {
        select: "Sélectionnez la phase...",
        phaseI: "Phase I",
        phaseII: "Phase II",
        phaseIII: "Phase III",
        phaseIV: "Phase IV",
        notApplicable: "Sans objet"
      },
      basics: {
        studyType: "Type d'étude *",
        title: "Titre *",
        titlePlaceholder: "par exemple, effet des statines sur les résultats cardiovasculaires dans T2DM",
        shortTitle: "Titre court",
        shortTitlePlaceholder: "par exemple, LEGEND-T2DM",
        priority: "Priorité",
        studyDesign: "Conception de l'étude",
        description: "Descriptif",
        descriptionPlaceholder: "Brève description de l'étude...",
        tags: "Mots-clés",
        tagsPlaceholder: "Ajoutez un mot-clé et appuyez sur Entrée...",
        addTag: "Ajouter un mot-clé"
      },
      science: {
        aiPrompt: "Laissez l'IA suggérer les champs de conception scientifique à partir du titre de votre étude",
        generating: "Génération en cours...",
        generateWithAi: "Générer avec l'IA",
        aiUnavailable: "Le service d'IA est indisponible. Veuillez remplir les champs manuellement.",
        rationale: "Justification scientifique",
        rationalePlaceholder: "Pourquoi cette étude est-elle nécessaire ? À quelle lacune de connaissances répond-elle ?",
        hypothesis: "Hypothèse",
        hypothesisPlaceholder: "Énoncez l’hypothèse principale testée…",
        primaryObjective: "Objectif principal",
        primaryObjectivePlaceholder: "Quel est l’objectif principal de cette étude ?",
        secondaryObjectives: "Objectifs secondaires",
        secondaryObjectivePlaceholder: "Ajoutez un objectif et appuyez sur Entrée...",
        addSecondaryObjective: "Ajouter un objectif secondaire",
        fundingSource: "Source de financement",
        fundingSourcePlaceholder: "par exemple, NIH R01, PCORI, sponsorisé par l'industrie"
      },
      team: {
        startDate: "Date de début de l'étude",
        endDate: "Date de fin de l'étude",
        endDateAfterStart: "La date de fin doit être postérieure à la date de début",
        targetSites: "Sites d'inscription cibles",
        targetSitesPlaceholder: "par exemple, 10",
        studyPhase: "Phase d'étude",
        nctId: "ID ClinicalTrials.gov",
        nctIdPlaceholder: "par exemple, NCT12345678",
        note: "Les membres de l'équipe, les sites et les cohortes peuvent être configurés une fois l'étude créée à partir du tableau de bord de l'étude."
      },
      review: {
        basics: "Informations de base",
        scientificDesign: "Conception scientifique",
        timelineRegistration: "Chronologie et inscription",
        labels: {
          title: "Titre :",
          shortTitle: "Titre court :",
          type: "Catégorie :",
          priority: "Priorité :",
          design: "Conception :",
          rationale: "Justification :",
          hypothesis: "Hypothèse :",
          primaryObjective: "Objectif principal :",
          secondaryObjectives: "Objectifs secondaires :",
          start: "Début :",
          end: "Fin :",
          targetSites: "Sites cibles :",
          phase: "Phase :",
          nctId: "ID NCT :",
          funding: "Financement :"
        }
      }
    },
    detail: {
      loadFailed: "Échec du chargement de l'étude",
      backToStudies: "Retour aux études",
      studies: "Études",
      confirmDelete: "Êtes-vous sûr de vouloir supprimer cette étude ? Cette action ne peut pas être annulée.",
      confirmArchive: "Archiver cette étude ? Il pourra être restauré ultérieurement.",
      copyTitle: "Copie de {{title}}",
      tabs: {
        overview: "Aperçu",
        design: "Conception",
        analyses: "Analyses",
        results: "Résultats",
        progress: "Avancement",
        sites: "Centres",
        team: "Équipe",
        cohorts: "Cohortes",
        milestones: "Jalons",
        artifacts: "Livrables",
        activity: "Activité",
        federated: "Fédéré"
      },
      statuses: {
        draft: "Brouillon",
        protocol_development: "Développement de protocole",
        feasibility: "Faisabilité",
        irb_review: "Examen par le comité d'éthique",
        recruitment: "Recrutement",
        execution: "Exécution",
        analysis: "Analyse",
        synthesis: "Synthèse",
        manuscript: "Manuscrit",
        published: "Publié",
        archived: "Archivé",
        withdrawn: "Retiré"
      },
      studyTypes: {
        characterization: "Caractérisation",
        population_level_estimation: "Estimation au niveau de la population",
        patient_level_prediction: "Prédiction au niveau du patient",
        comparative_effectiveness: "Efficacité comparative",
        safety_surveillance: "Surveillance de la sécurité",
        drug_utilization: "Utilisation des médicaments",
        quality_improvement: "Amélioration de la qualité",
        custom: "Personnalisé"
      },
      actions: {
        transitionTo: "Transition vers",
        generateManuscriptTitle: "Générer un manuscrit à partir d'analyses terminées",
        manuscript: "Manuscrit",
        duplicateStudy: "Étude en double",
        exportJson: "Exporter en tant que JSON",
        archiveStudy: "Etude d'archives",
        deleteStudy: "Supprimer l'étude"
      },
      sections: {
        about: "À propos",
        analysisPipeline: "Pipeline d’analyse ({{count}})",
        executionProgress: "Progression de l'exécution",
        details: "Détails",
        timeline: "Chronologie",
        tags: "Mots-clés",
        createdBy: "Créé par"
      },
      labels: {
        primaryObjective: "Objectif principal",
        hypothesis: "Hypothèse",
        secondaryObjectives: "Objectifs secondaires",
        principalInvestigator: "Chercheur principal",
        leadDataScientist: "Responsable science des données",
        studyDesign: "Conception de l'étude",
        phase: "Phase",
        protocolVersion: "Version du protocole",
        funding: "Financement",
        clinicalTrialsGov: "ClinicalTrials.gov",
        start: "Début :",
        end: "Fin :",
        targetSites: "Sites cibles :",
        created: "Créé :"
      },
      messages: {
        noDescription: "Aucune description fournie",
        moreAnalyses: "+{{count}} plus d'analyses"
      },
      progress: {
        completed: "{{count}} terminé",
        running: "{{count}} en marche",
        failed: "Échec du {{count}}",
        pending: "{{count}} en attente"
      }
    },
    dashboard: {
      progressSummary: "{{completed}} analyses terminées sur {{total}}",
      stats: {
        total: "Total général",
        pending: "En attente",
        running: "En cours",
        completed: "Terminé",
        failed: "Échec"
      },
      sections: {
        studyAnalyses: "Analyses de l'étude"
      },
      table: {
        type: "Catégorie",
        name: "Nom",
        status: "Statut"
      },
      messages: {
        notExecuted: "Non exécuté"
      },
      empty: {
        title: "Aucune analyse dans cette étude",
        message: "Ajoutez des analyses dans l'onglet Conception pour commencer."
      }
    },
    analyses: {
      selectSource: "Sélectionnez la source...",
      executeAll: "Tout exécuter",
      addAnalysisToStudy: "Ajouter une analyse à l'étude",
      emptyMessage: "Ajoutez des caractérisations, des estimations, des prédictions et bien plus encore pour créer votre pipeline d'analyse",
      groupHeader: "{{label}} ({{count}})",
      openAnalysisDetail: "Ouvrir le détail de l'analyse",
      confirmRemove: "Supprimer cette analyse de l’étude ?",
      removeFromStudy: "Supprimer de l'étude",
      analysisId: "ID d'analyse",
      lastRun: "Dernière exécution",
      error: "Erreur",
      viewFullDetail: "Voir tous les détails"
    },
    results: {
      sections: {
        results: "Résultats ({{count}})",
        syntheses: "Synthèses ({{count}})"
      },
      actions: {
        synthesize: "Synthétiser",
        markPrimary: "Marquer comme principal",
        unmarkPrimary: "Retirer le marquage principal",
        markPublishable: "Marquer comme publiable",
        unmarkPublishable: "Retirer le marquage publiable",
        cancel: "Annuler"
      },
      filters: {
        allTypes: "Tous types",
        publishableOnly: "Publiable uniquement"
      },
      empty: {
        noResultsTitle: "Aucun résultat pour l'instant",
        noResultsMessage: "Les résultats apparaîtront ici une fois les analyses exécutées",
        noSummaryData: "Aucune donnée récapitulative disponible",
        noSynthesesTitle: "Pas de synthèses",
        noSynthesesMessage: "Combinez les résultats de plusieurs sites à l’aide d’une méta-analyse"
      },
      resultTypes: {
        cohort_count: "Effectif de cohorte",
        characterization: "Caractérisation",
        incidence_rate: "Taux d'incidence",
        effect_estimate: "Estimation de l'effet",
        prediction_performance: "Performance prédictive",
        pathway: "Chemin",
        sccs: "SCCS",
        custom: "Personnalisé"
      },
      synthesisTypes: {
        fixed_effects_meta: "Méta-analyse à effets fixes",
        random_effects_meta: "Méta-analyse à effets aléatoires",
        bayesian_meta: "Méta-analyse bayésienne",
        forest_plot: "Diagramme en forêt",
        heterogeneity_analysis: "Analyse d'hétérogénéité",
        funnel_plot: "Diagramme en entonnoir",
        evidence_synthesis: "Synthèse des preuves",
        custom: "Personnalisé"
      },
      badges: {
        primary: "Primaire",
        publishable: "Publiable"
      },
      messages: {
        resultCreated: "Résultat n° {{id}} · {{date}}",
        reviewedBy: "Évalué par {{name}}"
      },
      labels: {
        summary: "Résumé",
        diagnostics: "Diagnostic"
      },
      pagination: {
        previous: "Précédent",
        next: "Suivant",
        page: "Page {{page}} de {{totalPages}}"
      },
      synthesis: {
        createTitle: "Créer une synthèse",
        instructions: "Sélectionnez 2 résultats ou plus ci-dessus, puis choisissez une méthode de synthèse.",
        createSelected: "Créer ({{count}} sélectionnés)",
        confirmDelete: "Supprimer cette synthèse ?",
        resultsCount: "{{count}} résultats",
        system: "Système",
        methodSettings: "Paramètres de méthode",
        output: "Sortie",
        noOutput: "Aucune sortie générée pour l'instant"
      }
    },
    federated: {
      loadingResults: "Chargement des résultats...",
      loadResultsFailed: "Échec du chargement des résultats : {{error}}",
      unknownError: "Erreur inconnue",
      confirmDistribute: "Distribuer l'étude aux nœuds de données {{count}} ?",
      arachneNotReachable: "Arachne Central n'est pas accessible",
      loadNodesFailed: "Échec du chargement des nœuds Arachne",
      arachneConnectionHelp: "Définissez ARACHNE_URL dans votre environnement pour activer l'exécution fédérée. Vérifiez qu'Arachne Central est en cours d'exécution et accessible.",
      availableDataNodes: "Nœuds de données disponibles",
      poweredByArachne: "Alimenté par Arachne",
      distributeCount: "Distribuer ({{count}})",
      noNodes: "Aucun nœud Arachne configuré. Définissez ARACHNE_URL dans l'environnement pour activer l'exécution fédérée.",
      distributionFailed: "Échec de la distribution : {{error}}",
      distributionSucceeded: "Étude distribuée avec succès. Statut de surveillance ci-dessous.",
      federatedExecutions: "Exécutions fédérées",
      noExecutions: "Aucune exécution fédérée pour le moment. Sélectionnez les nœuds de données ci-dessus et distribuez pour commencer.",
      arachneAnalysis: "Analyse Arachne #{{id}}",
      statuses: {
        PENDING: "En attente",
        EXECUTING: "Exécution",
        COMPLETED: "Terminé",
        FAILED: "Échec"
      },
      table: {
        name: "Nom",
        status: "Statut",
        cdmVersion: "Version CDM",
        patients: "Patients",
        lastSeen: "Dernière activité",
        node: "Nœud",
        submitted: "Soumis",
        completed: "Terminé"
      }
    },
    artifacts: {
      sections: {
        artifacts: "Artefacts ({{count}})"
      },
      actions: {
        addArtifact: "Ajouter un livrable",
        cancel: "Annuler",
        create: "Créer",
        save: "Sauvegarder",
        edit: "Modifier le livrable",
        delete: "Supprimer le livrable",
        openLink: "Ouvrir le lien"
      },
      form: {
        addTitle: "Ajouter un livrable d'étude",
        title: "Titre",
        titleRequired: "Titre *",
        titlePlaceholder: "par exemple, protocole d'étude v2.1",
        version: "Version",
        type: "Catégorie",
        urlOptional: "URL (facultative)",
        description: "Descriptif",
        descriptionOptional: "Descriptif (facultatif)",
        descriptionPlaceholder: "Brève description de cet artefact..."
      },
      empty: {
        title: "Aucun livrable",
        message: "Stockez les protocoles, les packages d'analyse et les documents de l'étude"
      },
      badges: {
        current: "En vigueur"
      },
      labels: {
        versionValue: "v{{version}}",
        sizeKb: "{{size}} KB"
      },
      messages: {
        unknown: "Inconnu",
        uploadedBy: "{{name}} · {{date}}"
      },
      confirmDelete: "Supprimer ce livrable ?",
      types: {
        protocol: "Protocole",
        sap: "Plan d'analyse statistique",
        irb_submission: "Soumission IRB",
        cohort_json: "Cohorte JSON",
        analysis_package_r: "Package d'analyse R",
        analysis_package_python: "Package d'analyse Python",
        results_report: "Rapport de résultats",
        manuscript_draft: "Brouillon de manuscrit",
        supplementary: "Matériel supplémentaire",
        presentation: "Présentation",
        data_dictionary: "Dictionnaire de données",
        study_package_zip: "Dossier d'étude ZIP",
        other: "Autre"
      }
    },
    sites: {
      sections: {
        sites: "Centres ({{count}})"
      },
      actions: {
        addSite: "Ajouter un centre",
        cancel: "Annuler",
        save: "Sauvegarder",
        edit: "Modifier le centre",
        remove: "Retirer le centre"
      },
      form: {
        addTitle: "Ajouter un centre partenaire de données",
        sourceSearchPlaceholder: "Rechercher des sources de données...",
        siteRole: "Rôle du centre",
        irbProtocol: "Protocole IRB n°",
        notes: "Remarques",
        optional: "Facultatif"
      },
      empty: {
        title: "Aucun centre inscrit",
        message: "Ajoutez des centres partenaires de données à cette étude"
      },
      table: {
        source: "Source de données",
        role: "Rôle",
        status: "Statut",
        irb: "IRB #",
        patients: "Patients",
        cdm: "CDM"
      },
      messages: {
        allSourcesAssigned: "Toutes les sources sont déjà attribuées",
        noMatchingSources: "Aucune source correspondante",
        sourceFallback: "Source n° {{id}}"
      },
      confirmRemove: "Retirer ce centre ?",
      roles: {
        data_partner: "Partenaire de données",
        coordinating_center: "Centre de coordination",
        analytics_node: "Nœud d'analyse",
        observer: "Observateur"
      },
      statuses: {
        pending: "En attente",
        invited: "Invité",
        approved: "Approuvé",
        active: "Actif",
        completed: "Terminé",
        withdrawn: "Retiré"
      }
    },
    cohorts: {
      sections: {
        cohorts: "Cohortes ({{count}})"
      },
      actions: {
        assignCohort: "Attribuer une cohorte",
        assign: "Attribuer",
        cancel: "Annuler",
        save: "Sauvegarder",
        edit: "Modifier l'affectation de la cohorte",
        remove: "Supprimer l'affectation de cohorte"
      },
      form: {
        assignTitle: "Attribuer une définition de cohorte",
        cohortDefinition: "Définition de la cohorte",
        searchPlaceholder: "Rechercher des définitions de cohortes...",
        role: "Rôle",
        label: "Libellé",
        labelRequired: "Libellé *",
        labelPlaceholder: "p. ex., population cible T2DM",
        description: "Descriptif",
        optional: "Facultatif"
      },
      empty: {
        title: "Aucune cohorte attribuée",
        message: "Attribuer des définitions de cohorte et préciser leurs rôles dans cette étude"
      },
      messages: {
        allAssigned: "Toutes les définitions de cohorte sont déjà attribuées",
        noMatchingCohorts: "Aucune cohorte correspondante",
        cohortFallback: "Cohorte #{{id}}"
      },
      confirmRemove: "Supprimer cette affectation de cohorte ?",
      roles: {
        target: "Cible",
        comparator: "Comparateur",
        outcome: "Résultat",
        exclusion: "Exclusion",
        subgroup: "Sous-groupe",
        event: "Événement"
      }
    },
    team: {
      sections: {
        members: "Membres de l'équipe ({{count}})"
      },
      actions: {
        addMember: "Ajouter un membre",
        cancel: "Annuler",
        save: "Sauvegarder",
        edit: "Modifier un membre de l'équipe",
        remove: "Supprimer un membre de l'équipe"
      },
      form: {
        addTitle: "Ajouter un membre de l'équipe",
        user: "Utilisateur",
        userSearchPlaceholder: "Rechercher des utilisateurs par nom ou par e-mail...",
        role: "Rôle"
      },
      empty: {
        title: "Aucun membre de l'équipe",
        message: "Ajouter des chercheurs et des collaborateurs à cette étude"
      },
      table: {
        name: "Nom",
        email: "E-mail",
        role: "Rôle",
        status: "Statut",
        joined: "Inscrit"
      },
      messages: {
        allUsersAssigned: "Tous les utilisateurs sont déjà membres de l'équipe",
        noMatchingUsers: "Aucun utilisateur correspondant",
        userFallback: "Utilisateur #{{id}}"
      },
      confirmRemove: "Supprimer ce membre de l'équipe ?",
      statuses: {
        active: "Actif",
        inactive: "Inactif"
      },
      roles: {
        principal_investigator: "Chercheur principal",
        co_investigator: "Co-investigateur",
        data_scientist: "Spécialiste des données",
        statistician: "Statisticien",
        site_lead: "Responsable de centre",
        data_analyst: "Analyste de données",
        research_coordinator: "Coordinateur de recherche",
        irb_liaison: "Coordinateur IRB",
        project_manager: "Chef de projet",
        observer: "Observateur"
      },
      roleDescriptions: {
        principal_investigator: "Chercheur principal responsable de l’étude",
        co_investigator: "Chercheur collaborateur à la supervision de l’étude",
        data_scientist: "Développe et gère des pipelines analytiques",
        statistician: "Analyse statistique et méthodologie",
        site_lead: "Gère les opérations des centres partenaires de données",
        data_analyst: "Traitement des données et contrôles qualité",
        research_coordinator: "Coordonne la logistique et les délais de l’étude",
        irb_liaison: "Gère les soumissions et la conformité IRB",
        project_manager: "Planification et suivi global du projet",
        observer: "Accès en lecture seule aux documents de l'étude"
      }
    },
    milestones: {
      sections: {
        milestones: "Jalons ({{count}})"
      },
      actions: {
        addMilestone: "Ajouter un jalon",
        cancel: "Annuler",
        create: "Créer",
        save: "Sauvegarder",
        edit: "Modifier le jalon",
        delete: "Supprimer un jalon"
      },
      form: {
        titlePlaceholder: "Titre du jalon..."
      },
      empty: {
        title: "Aucun jalon",
        message: "Suivez la progression de l’étude avec des jalons et des dates cibles"
      },
      labels: {
        target: "Cible : {{date}}",
        targetCompleted: "Cible : {{target}} | Terminé : {{completed}}"
      },
      confirmDelete: "Supprimer ce jalon ?",
      types: {
        protocol: "Protocole",
        irb: "IRB",
        data_access: "Accès aux données",
        analysis: "Analyse",
        review: "Revue",
        publication: "Publication",
        custom: "Personnalisé"
      },
      statuses: {
        pending: "En attente",
        in_progress: "En cours",
        completed: "Terminé",
        overdue: "En retard",
        cancelled: "Annulé"
      }
    },
    activity: {
      title: "Journal d'activité",
      empty: {
        title: "Aucune activité pour le moment",
        message: "Les actions effectuées dans cette étude apparaîtront ici"
      },
      pagination: {
        previous: "Précédent",
        next: "Suivant",
        page: "Page {{page}} de {{totalPages}}"
      },
      actions: {
        created: "Créé",
        updated: "Mis à jour",
        deleted: "Supprimé",
        status_changed: "Statut modifié",
        member_added: "Membre ajouté",
        member_removed: "Membre retiré",
        site_added: "Centre ajouté",
        analysis_added: "Analyse ajoutée",
        executed: "Exécuté"
      },
      entities: {
        study: "Étude",
        study_analysis: "Analyse de l'étude",
        study_artifact: "Livrable d'étude",
        study_cohort: "Cohorte d’étude",
        study_milestone: "Jalon de l’étude",
        study_site: "Centre d'étude",
        study_team_member: "Membre de l'équipe d'étude"
      }
    },
    designer: {
      defaultSessionTitle: "Conception {{title}} OHDSI",
      title: "Compilateur OHDSI de conception d'étude",
      subtitle: "Transformez une question de recherche examinée en ensembles de concepts traçables, en cohortes, en preuves de faisabilité, en plans d'analyse prêts pour HADES et en un ensemble d'études verrouillé.",
      researchQuestionPlaceholder: "Chez les adultes avec..., est-ce que..., par rapport à..., réduit...",
      badges: {
        session: "Session {{value}}",
        version: "Version n° {{value}}"
      },
      versionStatuses: {
        generated: "Généré",
        review_ready: "Prêt à examiner",
        accepted: "Accepté",
        locked: "Verrouillé"
      },
      metrics: {
        assets: "Actifs"
      },
      actions: {
        downloadLockedPackage: "Télécharger le package verrouillé",
        downloadPackage: "Télécharger le package",
        add: "Ajouter",
        saveChanges: "Enregistrer les modifications"
      },
      sections: {
        verificationGates: "Points de vérification",
        packageProvenance: "Provenance du package",
        assetEvidence: "Preuves des actifs",
        basicInformation: "Informations de base",
        addAnalysis: "Ajouter une analyse",
        studyAnalyses: "Analyses d'étude ({{count}})"
      },
      descriptions: {
        verificationGates: "Résolvez les bloqueurs avant de verrouiller le package OHDSI.",
        assetEvidence: "Examinez les résultats bloqués du vérificateur avant d’accepter un package."
      },
      gates: {
        designIntent: "Intention de conception",
        acceptedAt: "Accepté {{time}}",
        acceptResearchQuestion: "Acceptez la question de recherche examinée.",
        verifiedMaterializedCohorts: "{{count}} cohorte matérialisée vérifiée",
        feasibilityReady: "Les preuves de faisabilité vérifiées sont prêtes.",
        runFeasibility: "Exécutez la faisabilité après vérification des cohortes.",
        analysisPlan: "Plan d'analyse",
        analysisPlanReady: "Le plan d’analyse HADES vérifié est prêt.",
        verifyAnalysisPlan: "Vérifier et matérialiser un plan d'analyse."
      },
      labels: {
        version: "Version",
        versionStatus: "v{{version}} - {{status}}",
        verifiedAssets: "Actifs vérifiés",
        title: "Titre",
        description: "Descriptif",
        studyType: "Type d'étude",
        analysisType: "Type d'analyse",
        analysis: "Analyse",
        missingOmopIds: "ID OMOP manquants",
        deprecatedOmopIds: "ID OMOP obsolètes",
        invalidDraftIds: "ID de brouillon non valides"
      },
      placeholders: {
        studyTitle: "Titre de l'étude",
        optionalDescription: "Description facultative",
        selectAnalysis: "Sélectionnez l'analyse..."
      },
      analysisTypes: {
        characterization: "Caractérisation",
        "incidence-rate": "Taux d'incidence",
        pathway: "Chemin",
        estimation: "Estimation statistique",
        prediction: "Prédiction"
      },
      messages: {
        new: "nouveau",
        none: "aucun",
        notStarted: "pas commencé",
        createOrImport: "Créez ou importez une conception pour commencer.",
        needsEvidence: "Preuves requises",
        noVersion: "Aucune version",
        blockedCount: "{{count}} bloqués",
        noBlockers: "Aucun blocage",
        startEvidenceReview: "Générez une intention ou importez l’étude en cours pour commencer l’examen des preuves.",
        noAnalyses: "Aucune analyse ajoutée pour l'instant.",
        analysisFallback: "Analyse n° {{id}}",
        assetId: "Actif n° {{id}}",
        materializedId: "matérialisé n° {{id}}",
        verifiedAt: "vérifié {{time}}"
      }
    },
    workbench: {
      sessionTitle: "Conception de l'intention d'étude",
      title: "Compilateur de conception d'étude",
      subtitle: "Convertissez une question de recherche en une intention d'étude révisée alignée sur OHDSI, puis examinez les actifs phénotypiques réutilisables avant que quoi que ce soit ne se déplace en aval.",
      newSession: "Nouvelle session",
      sessions: "Sessions",
      researchQuestion: "Question de recherche",
      researchQuestionPlaceholder: "Comparez MACE récurrent chez les patients post-MI commençant le clopidogrel par rapport à l'aspirine.",
      emptyQuestionPlaceholder: "Décrivez la question d'étude...",
      generateIntent: "Générer l'intention",
      startSession: "Démarrez une session de conception, puis générez une intention PICO structurée à partir de la question d'étude.",
      createAndGenerate: "Créer une session et générer une intention",
      loadingSessions: "Chargement des sessions de conception...",
      sections: {
        phenotypeRecommendations: "Recommandations sur le phénotype et la réutilisation",
        conceptSetDrafts: "Brouillons d’ensemble de concepts",
        cohortDrafts: "Brouillons de cohortes",
        cohortReadiness: "Préparation de la cohorte d’étude",
        feasibility: "Faisabilité",
        sources: "Sources de données",
        attrition: "Attrition",
        analysisPlans: "Plans d'analyse",
        packageLock: "Verrouillage du package",
        currentAssets: "Actifs actuels de l'étude",
        intentReview: "Revue de l'intention",
        source: "Source de données",
        governance: "Gouvernance"
      },
      descriptions: {
        recommendations: "Examinez les entrées réutilisables de la bibliothèque de phénotypes, les cohortes locales et les ensembles de concepts locaux avant de rédiger quoi que ce soit de nouveau.",
        conceptSets: "Convertissez les preuves acceptées en brouillons vérifiés par le vocabulaire avant de créer des ensembles de concepts natifs.",
        cohorts: "Transformez des ensembles de concepts matérialisés en ébauches de définitions de cohortes natives.",
        feasibility: "Vérifiez les cohortes liées par rapport aux sources CDM sélectionnées avant de planifier l'analyse.",
        analysisPlans: "Compilez des cohortes d’études réalisables dans des conceptions d’analyse natives compatibles avec HADES.",
        packageLock: "Gelez l’intention acceptée, les ensembles de concepts, les cohortes, la faisabilité et les analyses natives dans un package d’étude vérifiable.",
        currentAssets: "Intégrez des cohortes et des analyses créées manuellement dans ce chemin de conception, puis examinez les lacunes sans modifier les enregistrements existants."
      },
      actions: {
        recommend: "Recommander",
        draftConceptSets: "Brouillonner les ensembles de concepts",
        draftCohorts: "Brouillonner les cohortes",
        runFeasibility: "Exécuter la faisabilité",
        draftPlans: "Brouillonner les plans",
        importCurrent: "Importer l'existant",
        critique: "Critiquer",
        verify: "Vérifier",
        review: "Revue",
        accept: "Accepter",
        defer: "Différer",
        reject: "Rejeter",
        materialize: "Matérialiser",
        openNativeEditor: "Ouvrir l'éditeur natif",
        linkToStudy: "Lier à l'étude",
        search: "Recherche",
        add: "Ajouter",
        remove: "Retirer",
        saveReview: "Enregistrer la revue",
        acceptIntent: "Accepter l'intention",
        lockPackage: "Verrouiller le package",
        locked: "Verrouillé",
        downloadPackageSummary: "Télécharger le résumé du package"
      },
      labels: {
        verified: "Vérifié",
        needsCheck: "À vérifier",
        blocked: "Bloqué",
        unverified: "Non vérifié",
        reviewQueue: "File d'attente de révision",
        conceptSetDraft: "brouillon d’ensemble de concepts",
        cohortDraft: "brouillon de cohorte",
        concepts: "Concepts",
        concept: "Concept",
        domain: "Domaine",
        vocabulary: "Vocabulaire",
        flags: "Indicateurs",
        actions: "Actions",
        lint: "Contrôle lint",
        source: "Source de données",
        status: "Statut",
        cohorts: "Cohortes",
        coverage: "Couverture",
        domains: "Domaines",
        freshness: "Fraîcheur",
        dqd: "DQD",
        attrition: "Attrition",
        nativeConceptSet: "Ensemble de concepts natif n° {{id}}",
        nativeCohort: "Cohorte native n° {{id}}",
        linkedStudyCohort: "Cohorte d'étude liée n° {{id}}",
        conceptsCount: "{{count}} concepts",
        conceptSetsCount: "{{count}} ensembles de concepts",
        nativeAnalysis: "Analyse native n° {{id}}",
        feasibility: "Faisabilité",
        rank: "Rang {{score}}",
        match: "{{score}} % de correspondance",
        ohdsiId: "OHDSI #{{id}}",
        computable: "Calculable",
        imported: "Importé",
        evidence: "Preuve",
        origin: "Origine",
        matchedTerm: "Terme correspondant",
        canonicalRecord: "Enregistrement canonique",
        noCanonicalRecord: "Aucun enregistrement canonique",
        eligibility: "Éligibilité",
        acceptable: "Acceptable",
        blockedOrNeedsReview: "Bloqué ou à revoir",
        policy: "Politique",
        nextActions: "Actions suivantes",
        rankComponents: "Composantes du rang",
        verifierChecks: "Contrôles du vérificateur",
        versionStatus: "Version {{version}} · {{status}}",
        primaryObjective: "Objectif principal",
        population: "Population",
        exposure: "Exposition",
        comparator: "Comparateur",
        primaryOutcome: "Résultat principal",
        timeAtRisk: "Temps à risque",
        conceptSetsMetric: "Ensembles de concepts",
        cohortsMetric: "Cohortes",
        analysesMetric: "Analyses",
        packagesMetric: "Packages",
        aiEvents: "Événements d'IA",
        reviewed: "Revu",
        manifest: "Manifeste",
        critiques: "Critiques enregistrées"
      },
      messages: {
        saveOrAcceptBeforeRecommendations: "Enregistrez une intention prête à être révisée ou acceptez-la avant de demander des recommandations.",
        loadingRecommendations: "Chargement des recommandations...",
        noRecommendations: "Aucune recommandation pour l'instant.",
        acceptRecommendationFirst: "Acceptez d’abord au moins une recommandation vérifiée de phénotype, de cohorte ou d’ensemble de concepts.",
        noConceptSetDrafts: "Aucune ébauche de concept pour l’instant.",
        onlyVerifiedConceptSetDrafts: "Seules les ébauches d’ensembles de concepts vérifiés peuvent être acceptées.",
        searchConceptsPlaceholder: "Rechercher des concepts de vocabulaire OMOP",
        materializeConceptSetFirst: "Matérialisez d’abord au moins une ébauche d’ensemble de concepts vérifié.",
        noCohortDrafts: "Aucune ébauche de cohorte pour l’instant.",
        checkingLinkedRoles: "Vérification des rôles liés...",
        noReadinessSignal: "Aucun signal de préparation pour l’instant.",
        ready: "Prêt",
        blocked: "Bloqué",
        drafts: "{{count}} brouillons",
        materialized: "{{count}} matérialisés",
        linked: "{{count}} liés",
        linkRequiredCohorts: "Reliez les cohortes d’étude requises avant la faisabilité de la source.",
        loadingSources: "Chargement des sources...",
        noSources: "Aucune source CDM configurée.",
        smallCellThreshold: "Seuil des petites cellules",
        sourcesReady: "Sources {{ready}}/{{total}} prêtes",
        ranAt: "Exécuté {{time}}",
        noDates: "Aucune date",
        none: "aucun",
        roles: "Rôles {{ready}}/{{total}}",
        unknown: "Inconnu",
        noDqd: "Aucun DQD",
        passRate: "{{rate}}% de réussite",
        noFeasibilityEvidence: "Aucune preuve de faisabilité n'a été stockée pour cette version de conception.",
        runFeasibilityBeforePlans: "Exécutez la faisabilité source avant de rédiger des plans d’analyse.",
        noAnalysisPlans: "Aucun plan d’analyse pour l’instant.",
        feasibilityStatus: "Faisabilité : {{status}}",
        checkingPackageReadiness: "Vérification de la préparation du package...",
        readyToLock: "Prêt à verrouiller.",
        lockedPackageAvailable: "Le package verrouillé est disponible dans les livrables de l'étude.",
        signed: "signé",
        pending: "en attente",
        onlyVerifiedRecommendations: "Seules les recommandations vérifiées de manière déterministe peuvent être acceptées."
      }
    }
  },
  covariates: {
    title: "Paramètres des covariables",
    description:
      "Sélectionnez les domaines à inclure comme covariables pour FeatureExtraction.",
    groups: {
      core: "Domaines de base",
      extended: "Domaines étendus",
      indices: "Indices de comorbidité",
    },
    labels: {
      demographics: "Démographie",
      conditionOccurrence: "Occurrences d'affections",
      drugExposure: "Expositions aux médicaments",
      procedureOccurrence: "Occurrences de procédures",
      measurement: "Mesures",
      observation: "Observations",
      deviceExposure: "Expositions aux dispositifs",
      visitCount: "Nombre de visites",
      charlsonComorbidity: "Comorbidité de Charlson",
      dcsi: "DCSI (diabète)",
      chads2: "CHADS2",
      chads2Vasc: "CHA2DS2-VASc",
    },
    timeWindows: "Fenêtres temporelles",
    to: "à",
    days: "jours",
    addTimeWindow: "Ajouter une fenêtre temporelle",
  },
  jobs: {
    page: {
      title: "Tâches",
      subtitle: "Surveillez les tâches d'arrière-plan et l'état des files",
      empty: {
        title: "Aucune tâche trouvée",
        archived: "Aucune tâche archivée de plus de 24 heures.",
        filtered:
          "Aucune tâche avec le statut {{status}}. Essayez un autre filtre.",
        recent:
          "Aucune tâche dans les dernières 24 heures. Consultez les archives pour les tâches plus anciennes.",
      },
      table: {
        job: "Tâche",
        type: "Catégorie",
        source: "Origine",
        started: "Démarrée",
        duration: "Durée",
        status: "Statut",
        actions: "Opérations",
      },
      pagination: "Page {{current}} sur {{last}} · {{total}} tâches",
    },
    filters: {
      statuses: {
        all: "Toutes (24 h)",
        pending: "En attente",
        queued: "En file",
        running: "En cours",
        completed: "Terminée",
        failed: "En échec",
        cancelled: "Annulée",
        archived: "Archivée",
      },
      types: {
        all: "Tous les types",
        analysis: "Analyse",
        characterization: "Caractérisation",
        incidenceRate: "Taux d'incidence",
        estimation: "Analyse d'estimation",
        prediction: "Prédiction",
        pathway: "Parcours",
        sccs: "SCCS",
        evidenceSynthesis: "Synthèse des preuves",
        cohortGeneration: "Génération de cohorte",
        careGaps: "Lacunes de soins",
        achilles: "Achilles",
        dataQuality: "Qualité des données",
        heelChecks: "Vérifications Heel",
        ingestion: "Import",
        vocabulary: "Vocabulaire",
        genomicParse: "Analyse génomique",
        poseidon: "ETL Poseidon",
        fhirExport: "Export FHIR",
        fhirSync: "Synchronisation FHIR",
        gisImport: "Import GIS",
        gisBoundaries: "Limites GIS",
      },
    },
    actions: {
      retry: "Réessayer",
      retryJob: "Réessayer la tâche",
      cancel: "Annuler",
      cancelJob: "Annuler la tâche",
      previous: "Précédent",
      next: "Suivant",
    },
    drawer: {
      titleFallback: "Détails de la tâche",
      loadError: "Impossible de charger les détails de la tâche.",
      sections: {
        executionLog: "Journal d'exécution",
        analysis: "Analyse",
        cohort: "Cohorte",
        ingestionPipeline: "Pipeline d'ingestion",
        fhirSync: "Synchronisation FHIR",
        dataQuality: "Qualité des données",
        heelChecks: "Vérifications Heel",
        achillesAnalyses: "Analyses Achilles",
        genomicParse: "Analyse génomique",
        poseidonEtl: "ETL Poseidon",
        careGapEvaluation: "Évaluation des lacunes de soins",
        gisBoundaries: "Limites GIS",
        gisImport: "Import GIS",
        vocabularyImport: "Import du vocabulaire",
        fhirExport: "Export FHIR",
        overview: "Vue d'ensemble",
        output: "Sortie",
      },
      labels: {
        analysis: "Analyse",
        createdBy: "Créée par",
        parameters: "Paramètres",
        cohort: "Cohorte",
        personCount: "Nombre de personnes",
        source: "Origine",
        sourceKey: "Clé de source",
        stage: "Étape",
        project: "Projet",
        file: "Fichier",
        fileSize: "Taille du fichier",
        mappingCoverage: "Couverture de mappage",
        processed: "Traités",
        failed: "Échecs",
        filesDownloaded: "Fichiers téléchargés",
        recordsExtracted: "Enregistrements extraits",
        recordsMapped: "Enregistrements mappés",
        recordsWritten: "Enregistrements écrits",
        recordsFailed: "Enregistrements en échec",
        passed: "Réussis",
        passRate: "Taux de réussite",
        expectedChecks: "Contrôles attendus",
        executionTime: "Temps d'exécution",
        failingChecks: "Contrôles en échec",
        totalRules: "Total des règles",
        rulesTriggered: "Règles déclenchées",
        totalViolations: "Total des violations",
        topViolations: "Principales violations",
        completed: "Terminé",
        byCategory: "Par catégorie",
        failedSteps: "Étapes en échec",
        format: "Format de fichier",
        totalVariants: "Total des variants",
        mappedVariants: "Variants mappés",
        samples: "Échantillons",
        runType: "Type d'exécution",
        dagsterRunId: "ID d'exécution Dagster",
        stats: "Statistiques",
        bundle: "Lot",
        complianceSummary: "Résumé de conformité",
        dataset: "Jeu de données",
        dataType: "Type de données",
        version: "Version des données",
        geometry: "Géométrie",
        features: "Entités",
        tablesLoaded: "Tables chargées",
        recordsLoaded: "Enregistrements chargés",
        outputFormat: "Format de sortie",
        type: "Catégorie",
        triggeredBy: "Déclenchée par",
        duration: "Durée",
        started: "Démarrée",
        created: "Créée",
        error: "Erreur",
      },
      messages: {
        stalled:
          "Cette tâche s'est bloquée et a été marquée comme en échec après avoir dépassé le délai d'une heure.",
        failedCount: "{{count}} en échec",
        runningCount: "{{count}} en cours",
        ofTotal: "sur {{count}}",
        records: "{{count}} enregistrements",
      },
    },
  },
  vocabulary: {
    mappingAssistant: {
      title: "Assistant de mappage de concepts",
      poweredBy: "Alimenté par Ariadne",
      subtitle:
        "Mappez les termes sources vers les concepts standard OMOP avec une correspondance verbatim, vectorielle et LLM",
      filters: {
        selectedCount: "{{count}} sélectionnés",
        clearSelection: "Effacer la sélection",
        targetVocabulary: "Vocabulaire cible :",
        allVocabularies: "Tous les vocabulaires",
        targetDomain: "Domaine cible :",
        allDomains: "Tous les domaines",
      },
      drawer: {
        disambiguate: "Désambiguïser",
        candidateCount: "{{count}} candidats - sélectionnez le bon mappage",
        noCandidates: "Aucun candidat trouvé. Essayez de nettoyer le terme ci-dessous.",
        cleanRemap: "Nettoyer et remapper",
        editPlaceholder: "Modifier le terme et remapper...",
      },
      actions: {
        clean: "Nettoyer",
        remap: "Remapper",
        acceptMapping: "Accepter le mappage",
        rejectMapping: "Rejeter le mappage",
        disambiguateTitle: "Désambiguïser - voir tous les candidats",
        uploadCsv: "Téléverser un CSV",
        loadProject: "Charger un projet",
        mapping: "Mappage...",
        mapTerms: "Mapper les termes",
        clearResults: "Effacer les résultats",
        acceptAllThreshold: "Tout accepter >= 90 %",
        saveToVocabulary: "Enregistrer dans le vocabulaire",
        saveProject: "Enregistrer le projet",
        exportCsv: "Exporter en CSV",
      },
      toasts: {
        remapped: "\"{{source}}\" remappé vers {{concept}}",
        noMatchForCleaned: "Aucune correspondance trouvée pour le terme nettoyé \"{{term}}\"",
        remapFailed: "Échec du remappage",
        autoAccepted: "{{count}} mappages à forte confiance acceptés automatiquement",
        savedMappings: "{{count}} mappages enregistrés dans source_to_concept_map",
        saveMappingsFailed: "Échec de l'enregistrement des mappages",
        projectSaved: "Projet enregistré : {{name}}",
        saveProjectFailed: "Échec de l'enregistrement du projet",
        projectLoaded: "Projet chargé : {{name}}",
        loadProjectFailed: "Échec du chargement du projet",
      },
      errors: {
        cleanupFailed: "Échec du nettoyage.",
        mappingFailed:
          "Échec du mappage. Vérifiez que le service Ariadne est en cours d'exécution et joignable.",
      },
      results: {
        candidateCount: "{{count}} candidats",
        overridden: "(remplacé)",
        noMatchFound: "Aucune correspondance trouvée",
        selectOverride: "Sélectionnez un candidat pour remplacer le mappage",
        noAdditionalCandidates: "Aucun candidat supplémentaire.",
      },
      labels: {
        noValue: "-",
        separator: "-",
      },
      input: {
        termsMapped: "{{count}} termes mappés",
        editTerms: "Modifier les termes",
        sourceTerms: "Termes sources",
        termsPlaceholder:
          "Saisissez les termes sources, un par ligne...\n\ndiabète de type 2\ninfarctus aigu du myocarde\nHTA\naspirine 81 mg",
        termsEntered: "{{count}} termes saisis",
      },
      projects: {
        loading: "Chargement des projets...",
        loadFailed: "Échec du chargement des projets",
        empty: "Aucun projet enregistré",
        projectMeta: "{{count}} termes -- {{date}}",
        namePlaceholder: "Nom du projet...",
      },
      vocabularies: {
        SNOMED: "SNOMED CT",
        ICD10CM: "ICD-10-CM",
        RxNorm: "RxNorm",
        LOINC: "LOINC",
        ICD9CM: "ICD-9-CM",
        CPT4: "CPT-4",
        HCPCS: "HCPCS",
        MedDRA: "MedDRA",
      },
      domains: {
        Condition: "Affection",
        Drug: "Médicament",
        Procedure: "Procédure",
        Measurement: "Mesure",
        Observation: "Observation",
        Device: "Dispositif",
      },
      progress: {
        mappingTerms: "Mappage de {{count}} termes...",
      },
      metrics: {
        termsMapped: "Termes mappés",
        highConfidence: "Forte confiance",
        needReview: "À examiner",
        noMatch: "Sans correspondance",
      },
      table: {
        sourceTerm: "Terme source",
        bestMatch: "Meilleure correspondance",
        confidence: "Confiance",
        matchType: "Type de correspondance",
        vocabulary: "Vocabulaire",
        actions: "Opérations",
      },
      summary: {
        mapped: "{{count}} mappés",
        high: "{{count}} forts",
        review: "{{count}} à examiner",
        noMatch: "{{count}} sans correspondance",
        accepted: "{{count}} acceptés",
      },
    },
    conceptDetail: {
      tabs: {
        info: "Infos",
        relationships: "Relations",
        mapsFrom: "Mappages depuis",
        hierarchy: "Hiérarchie",
      },
      empty: {
        title: "Sélectionnez un concept pour voir les détails",
        subtitle: "Recherchez puis cliquez sur un concept dans le panneau de gauche",
        noAncestors: "Aucun ancêtre trouvé",
        noRelationships: "Aucune relation trouvée",
        noSourceCodes: "Aucun code source ne mappe vers ce concept",
      },
      errors: {
        failedLoad: "Échec du chargement du concept",
      },
      toasts: {
        conceptIdCopied: "ID de concept copié",
      },
      actions: {
        copyConceptId: "Copier l'ID de concept",
        addToSet: "Ajouter au jeu",
      },
      values: {
        standard: "Concept standard",
        classification: "Classification",
        nonStandard: "Non standard",
        valid: "Valide",
      },
      sections: {
        basicInformation: "Informations de base",
        synonyms: "Synonymes",
        ancestors: "Ancêtres",
        relationships: "Relations",
        mapsFrom: "Codes sources mappés vers ce concept",
        mapsFromDescription:
          "Codes de vocabulaires sources (ICD-10, SNOMED, RxNorm, etc.) qui mappent vers ce concept standard",
        hierarchy: "Hiérarchie du concept",
      },
      fields: {
        conceptCode: "Code du concept",
        domain: "Domaine",
        vocabulary: "Vocabulaire",
        conceptClass: "Classe de concept",
        standardConcept: "Concept standard",
        invalidReason: "Motif d'invalidité",
        validStartDate: "Date de début de validité",
        validEndDate: "Date de fin de validité",
      },
      table: {
        id: "Identifiant",
        name: "Nom",
        domain: "Domaine",
        vocabulary: "Vocabulaire",
        relationship: "Relation",
        relatedId: "ID lié",
        relatedName: "Nom lié",
        code: "Code",
        class: "Classe",
      },
      pagination: {
        showingRange: "Affichage de {{start}} à {{end}} sur {{total}}",
        showingSourceCodes: "Affichage de {{shown}} sur {{total}} codes sources",
      },
    },
    semanticSearch: {
      hecate: "Hecate",
      poweredBy: "Alimenté par Hecate",
      tagline: "découverte de concepts alimentée par vecteurs",
      placeholder: "Saisissez un terme clinique pour une recherche sémantique...",
      filters: {
        allDomains: "Tous les domaines",
        allVocabularies: "Tous les vocabulaires",
        standard: {
          all: "Tous",
          standard: "S",
          classification: "C",
        },
      },
      badges: {
        standard: "Concept standard",
        classification: "Classification OMOP",
      },
      values: {
        inSet: "Dans le jeu",
        standardAbbrev: "S",
      },
      actions: {
        addToSet: "Ajouter au jeu",
        clearFilters: "Effacer les filtres",
        retry: "Réessayer",
        tryClearingFilters: "Essayez d'effacer les filtres",
      },
      errors: {
        unavailable: "La recherche sémantique n'est pas disponible.",
        serviceHelp:
          "Assurez-vous que le service IA Hecate est en cours d'exécution et que ChromaDB est initialisé.",
      },
      empty: {
        prompt: "Saisissez un terme clinique pour lancer une recherche sémantique",
        help:
          "Hecate utilise des embeddings vectoriels pour trouver des concepts OMOP similaires sur le plan conceptuel, même lorsque les correspondances exactes par mots-clés échouent.",
        noResults: "Aucune correspondance sémantique trouvée pour \"{{query}}\"",
      },
      results: {
        matchCountOne: "{{count}} correspondance sémantique",
        matchCountMany: "{{count}} correspondances sémantiques",
        updating: "Mise à jour...",
      },
    },
    searchPanel: {
      placeholder: "Rechercher des concepts...",
      filters: {
        toggle: "Filtres",
        standardOnly: "Concepts standard",
        allDomains: "Tous les domaines",
        allVocabularies: "Tous les vocabulaires",
        allConceptClasses: "Toutes les classes de concept",
        countSuffix: " ({{count}})",
      },
      actions: {
        clearAllFilters: "Effacer tous les filtres",
        tryClearingFilters: "Essayez d'effacer les filtres",
        loading: "Chargement...",
        loadMoreResults: "Charger plus de résultats",
      },
      empty: {
        prompt: "Rechercher dans le vocabulaire OMOP",
        help: "Saisissez au moins 2 caractères pour rechercher les concepts par nom, code ou ID",
        noResults: "Aucun concept trouvé pour \"{{query}}\"",
      },
      results: {
        showingCount: "Affichage de {{shown}} sur {{total}} résultats",
      },
      engine: {
        solr: "Solr",
        pg: "PG",
      },
      values: {
        inSet: "Dans le jeu",
      },
    },
    conceptComparison: {
      title: "Comparer les concepts",
      subtitle:
        "Comparaison côte à côte de 2 à 4 concepts OMOP avec attributs, ancêtres et relations",
      search: {
        placeholder: "Rechercher un concept à ajouter...",
      },
      sections: {
        ancestors: "Ancêtres (2 niveaux)",
        relationships: "Relations",
      },
      fields: {
        conceptCode: "Code du concept",
        domain: "Domaine",
        vocabulary: "Vocabulaire",
        conceptClass: "Classe de concept",
        standard: "Statut standard",
        validStart: "Début de validité",
        validEnd: "Fin de validité",
        invalidReason: "Motif d'invalidité",
      },
      actions: {
        addConcept: "Ajouter un concept",
      },
      empty: {
        prompt: "Recherchez des concepts à comparer",
        help:
          "Sélectionnez 2 à 4 concepts pour voir une comparaison côte à côte de leurs attributs, ancêtres et relations",
      },
      values: {
        standard: "Concept standard",
        classification: "Classification OMOP",
        nonStandard: "Non standard",
        valid: "Valide",
        level: "N{{level}}",
        selected: "Sélectionnés :",
        addOneMore: "Ajoutez au moins un concept de plus pour comparer",
      },
    },
    addToConceptSet: {
      title: "Ajouter au jeu de concepts",
      create: {
        title: "Créer un nouveau jeu de concepts",
        help: "Ajouter le concept et l'ouvrir dans le Builder",
        nameLabel: "Nom du nouveau jeu de concepts",
      },
      actions: {
        create: "Créer",
        cancel: "Annuler",
        openBuilderWithSearch: "Ouvrir le Builder avec la recherche actuelle",
      },
      divider: "ou ajouter à un jeu existant",
      filter: {
        placeholder: "Filtrer les jeux de concepts...",
      },
      empty: {
        noMatching: "Aucun jeu de concepts correspondant",
        noSets: "Aucun jeu de concepts trouvé",
      },
      footer: {
        includeDescendants: "Ajout avec l'option Inclure les descendants",
      },
      toasts: {
        addedToSet: "Ajouté à \"{{setName}}\"",
        addFailed: "Échec de l'ajout du concept au jeu",
        missingSetId: "Échec de la récupération de l'ID du nouveau jeu de concepts",
        createdAndAdded: "\"{{name}}\" créé et concept ajouté",
        createdAddFailed: "Jeu créé, mais l'ajout du concept a échoué",
        createFailed: "Échec de la création du jeu de concepts",
      },
    },
    page: {
      title: "Navigateur de vocabulaire",
      subtitle: "Recherchez, explorez et parcourez le vocabulaire standardisé OMOP",
      tabs: {
        keyword: "Recherche par mot-clé",
        semantic: "Recherche sémantique",
        browse: "Parcourir la hiérarchie",
      },
    },
    hierarchyBrowser: {
      breadcrumb: {
        allDomains: "Tous les domaines",
      },
      filters: {
        allSources: "Toutes les sources",
        itemPlaceholder: "Filtrer {{count}} éléments...",
      },
      actions: {
        showAllConcepts: "Afficher tous les concepts",
        showGroupings: "Afficher les regroupements",
        clearFilter: "Effacer le filtre",
        viewDetailsFor: "Voir les détails de {{conceptName}}",
        viewConceptDetails: "Voir les détails du concept",
      },
      empty: {
        noMatchingConcepts: "Aucun concept correspondant",
        noConcepts: "Aucun concept trouvé",
      },
      counts: {
        clinicalGroupings: "{{count}} regroupements cliniques",
        concepts: "{{count}} concepts",
        items: "{{count}} éléments",
        filteredItems: "{{shown}} sur {{total}} éléments",
        namedSubCategories: "{{name}} - {{count}} sous-catégories",
        subCategories: "{{count}} sous-catégories",
        subcategories: "{{count}} sous-catégories",
        oneAnchor: "1 ancre",
        persons: "{{count}} personnes",
        records: "{{count}} enregistrements",
        groupingCoversSubcategories:
          "{{groupingName}} couvre {{count}} sous-catégories",
      },
    },
    hierarchyTree: {
      empty: {
        noData: "Aucune donnée de hiérarchie disponible",
      },
    },
  },
  dataExplorer: {
    page: {
      title: "Explorateur de données",
      subtitle: "Explorez les résultats de caractérisation Achilles et la qualité des données",
      selectSourceTitle: "Sélectionner une source de données",
      selectSourceMessage:
        "Choisissez une source CDM dans la liste déroulante ci-dessus pour explorer ses données",
    },
    tabs: {
      overview: "Vue d'ensemble",
      domains: "Domaines",
      temporal: "Temporel",
      heel: "Achilles",
      dqd: "Qualité des données",
      ares: "Ares",
    },
    sourceSelector: {
      loading: "Chargement des sources...",
      placeholder: "Sélectionner une source de données",
    },
    domains: {
      condition: "Affections",
      drug: "Médicaments",
      procedure: "Procédures",
      measurement: "Mesures",
      observation: "Observations",
      visit: "Visites",
    },
    overview: {
      metrics: {
        persons: "Personnes",
        personsTotal: "{{value}} au total",
        medianObsDuration: "Durée médiane d'observation",
        durationDays: "{{value}} jours",
        observationPeriods: "{{value}} périodes d'observation",
        totalEvents: "Événements totaux",
        acrossAllCdmTables: "Dans toutes les tables CDM",
        dataCompleteness: "Complétude des données",
        tablesPopulated: "{{populated}}/{{total}} tables renseignées",
      },
      sections: {
        demographics: "Démographie de la population",
        observationPeriods: "Analyse des périodes d'observation",
        domainRecordProportions: "Proportions d'enregistrements par domaine",
        dataDensityOverTime: "Densité des données dans le temps",
        recordDistribution: "Distribution des enregistrements",
      },
      cards: {
        genderDistribution: "Distribution par genre",
        ethnicity: "Ethnicité",
        race: "Origine raciale",
        topTen: "Top 10",
        yearOfBirthDistribution: "Distribution de l'année de naissance",
        yearOfBirthSubtitle: "Histogramme avec densité lissée (or)",
        cumulativeObservationDuration: "Durée d'observation cumulée",
        cumulativeObservationSubtitle:
          "Style Kaplan-Meier : % de personnes avec observation >= X jours",
        observationStartEndDates: "Dates de début / fin d'observation",
        observationStartEndSubtitle:
          "Distribution temporelle des périodes d'observation",
        observationPeriodDurationDays: "Durée de la période d'observation (jours)",
        observationPeriodsPerPerson: "Périodes d'observation par personne",
        observationPeriodsPerPersonSubtitle:
          "Distribution du nombre de périodes par personne",
        clinicalDataDomains: "Domaines de données cliniques",
        clinicalDataDomainsSubtitle:
          "Triés par nombre d'enregistrements - cliquez sur un domaine pour explorer ses concepts",
        recordsByDomainAndYear: "Enregistrements par domaine et par année",
        recordsByDomainAndYearSubtitle:
          "L'intensité de la couleur indique le volume d'enregistrements par domaine et par année",
        cdmTableRecordCounts: "Nombre d'enregistrements des tables CDM",
        cdmTableRecordCountsSubtitle:
          "Échelle logarithmique - toutes les tables restent visibles quelle que soit leur magnitude",
      },
      messages: {
        runAchillesForTemporalData:
          "Exécutez Achilles pour générer les données de tendance temporelle",
      },
    },
    charts: {
      common: {
        records: "{{count}} enregistrements",
        persons: "{{count}} personnes",
        total: "Total",
        separator: "·",
      },
      boxPlot: {
        noDistributionData: "Aucune donnée de distribution",
        ariaLabel: "Boîte à moustaches",
        labels: {
          p25: "P25 : {{value}}",
          median: "Médiane : {{value}}",
          p75: "P75 : {{value}}",
        },
      },
      cumulativeObservation: {
        tooltipValue: "{{days}} jours - {{pct}} % des personnes",
        xAxisLabel: "Durée d'observation (jours)",
        labels: {
          min: "Min.",
          p10: "P10",
          p25: "P25",
          median: "Médiane",
          p75: "P75",
          p90: "P90",
          max: "Max.",
        },
      },
      demographics: {
        ageDistribution: "Distribution de l'âge",
        noAgeData: "Aucune donnée de distribution de l'âge",
        age: "Âge",
        male: "Masculin",
        female: "Féminin",
      },
      heatmap: {
        ariaLabel: "Carte thermique de densité des données",
      },
      hierarchy: {
        noData: "Aucune donnée de hiérarchie disponible",
        classificationHierarchy: "Hiérarchie de classification",
        back: "Retour",
      },
      periodCount: {
        observationPeriods: "{{count}} période(s) d'observation",
      },
      recordCounts: {
        noData: "Aucune donnée de comptage d'enregistrements disponible",
        title: "Nombre d'enregistrements par table CDM",
      },
      temporalTrend: {
        events: "Événements",
        secondary: "Secondaire",
      },
      topConcepts: {
        noData: "Aucune donnée de concept disponible",
        title: "Principaux concepts",
        id: "ID : {{id}}",
        prevalence: "Prévalence : {{value}} %",
      },
      yearOfBirth: {
        year: "Année : {{year}}",
      },
    },
    domain: {
      metrics: {
        totalRecords: "Enregistrements totaux",
        distinctConcepts: "Concepts distincts",
      },
      loadFailed: "Impossible de charger les données {{domain}}",
      temporalTrendTitle: "Tendance temporelle {{domain}}",
    },
    temporal: {
      domainsLabel: "Domaines :",
      multiDomainOverlay: "Superposition temporelle multidomaine",
      emptyTitle: "Aucune donnée temporelle disponible",
      emptyHelp: "Sélectionnez des domaines ci-dessus et vérifiez qu'Achilles a été exécuté",
    },
    concept: {
      details: "Détails du concept",
      loadFailed: "Impossible de charger les détails du concept",
      genderDistribution: "Distribution par genre",
      temporalTrend: "Tendance temporelle",
      typeDistribution: "Distribution par type",
      ageAtFirstOccurrence: "Âge à la première occurrence",
      valueByLabel: "{{label}} : {{value}}",
    },
    achilles: {
      severities: {
        error: "Erreur",
        warning: "Avertissement",
        notification: "Notification",
      },
      severityCounts: {
        error: "erreurs",
        warning: "avertissements",
        notification: "notifications",
      },
      actions: {
        running: "Exécution...",
        runHeelChecks: "Exécuter les vérifications Heel",
        runAchilles: "Exécuter Achilles",
        selectRun: "Sélectionner l'exécution",
        viewLiveProgress: "Voir la progression en direct",
        viewDetails: "Voir les détails",
      },
      runShort: "Exécution {{id}}...",
      statuses: {
        completed: "Terminée",
        failed: "Échouée",
        running: "En cours",
        pending: "En attente",
      },
      labels: {
        status: "Statut",
        total: "total",
        passed: "réussis",
        failed: "échoués",
        durationSeconds: "Durée : {{value}} s",
      },
      heel: {
        title: "Vérifications Heel",
        dispatchFailed: "Impossible de lancer les vérifications Heel",
        running: "Exécution des vérifications Heel...",
        empty: "Aucune vérification Heel exécutée pour l'instant",
        allPassed: "Toutes les vérifications ont réussi",
        issueSummary:
          "{{count}} problèmes : {{errors}}E / {{warnings}}A / {{notifications}}N",
      },
      characterization: {
        title: "Caractérisation Achilles",
        dispatchFailed: "Impossible de lancer l'exécution Achilles",
        empty: "Aucune exécution Achilles pour l'instant",
        emptyHelp: 'Cliquez sur "Exécuter Achilles" pour caractériser vos données',
      },
      runModal: {
        completedIn: "Terminée en {{duration}}",
        analysisProgress: "{{done}} analyses sur {{total}}",
        elapsed: "Écoulé :",
        passedCount: "{{count}} réussies",
        failedCount: "{{count}} échouées",
        totalDuration: "{{duration}} au total",
        remaining: "~{{duration}} restantes",
        waiting: "En attente du démarrage des analyses...",
        done: "Terminé",
        runInBackground: "Exécuter en arrière-plan",
      },
    },
    dqd: {
      categories: {
        completeness: "Complétude",
        conformance: "Conformité",
        plausibility: "Plausibilité",
        overall: "Global",
      },
      progress: {
        title: "Analyse DQD en cours",
        checksCompleted: "{{completed}} contrôles sur {{total}} terminés",
        waiting: "En attente...",
        running: "En cours :",
      },
      labels: {
        passed: "réussis",
        failed: "échoués",
        remaining: "restants",
        warnings: "Avertissements",
      },
      severity: {
        error: "Erreur",
        warning: "Avertissement",
        info: "Info",
      },
      categoryPanel: {
        checkCount: "{{count}} contrôles",
        passRate: "{{percent}} % de réussite",
        table: {
          check: "Contrôle",
          table: "Tableau",
          column: "Colonne",
          severity: "Sévérité",
          violationPercent: "% de violation",
        },
      },
      scorecard: {
        emptyTitle: "Aucun résultat DQD disponible",
        emptyDescription: "Exécutez une analyse Data Quality Dashboard pour voir les résultats",
        overallScore: "Score global",
        passedFraction: "{{passed}}/{{total}} réussis",
      },
      tableGrid: {
        noResults: "Aucun résultat DQD à afficher",
        title: "Carte thermique table x catégorie",
        cdmTable: "Table CDM",
      },
      actions: {
        runDqd: "Exécuter DQD",
      },
      dispatchFailed: "Impossible de lancer l'exécution DQD",
      empty: "Aucune exécution DQD pour l'instant",
      emptyHelp: 'Cliquez sur "Exécuter DQD" pour lancer une analyse de qualité des données',
    },
    ares: {
      name: "Ares",
      breadcrumbSeparator: ">",
      comingSoon: "Bientôt disponible dans une phase future",
      sections: {
        hub: "Centre",
        networkOverview: "Vue d'ensemble du réseau",
        conceptComparison: "Comparaison de concepts",
        dqHistory: "Historique DQ",
        coverage: "Couverture",
        coverageMatrix: "Matrice de couverture",
        feasibility: "Faisabilité",
        diversity: "Diversité",
        releases: "Versions",
        unmappedCodes: "Codes non mappés",
        cost: "Coût",
        costAnalysis: "Analyse des coûts",
        annotations: "Notes",
      },
      cards: {
        sourcesBelowDq: "{{value}} sources sous 80 % DQ",
        networkOverviewDescription:
          "Santé des sources, scores DQ et indicateurs de tendance",
        conceptComparisonDescription:
          "Comparer la prévalence des concepts entre les sources",
        dqHistoryDescription: "Score DQ moyen du réseau par version",
        coverageDescription: "Disponibilité domaine x source",
        feasibilityDescription: "Votre réseau peut-il soutenir une étude ?",
        diversityDescription: "Parité démographique entre les sources",
        releasesDescription: "Historique des versions par source",
        unmappedCodesDescription:
          "Codes sources sans mappage standard",
        annotationsDescription: "Notes de graphique sur toutes les sources",
        costDescription: "Données de coût par domaine et dans le temps",
      },
      networkOverview: {
        title: "Vue d'ensemble du réseau",
        networkTotal: "Total réseau",
        percent: "{{value}} %",
        averagePercent: "{{value}} % moy.",
        actions: {
          dqRadar: "Radar DQ",
          hideRadar: "Masquer le radar",
        },
        metrics: {
          dataSources: "Sources de données",
          avgDqScore: "Score DQ moyen",
          unmappedCodes: "Codes non mappés",
          needAttention: "À surveiller",
          totalPersons: "Personnes totales",
        },
        table: {
          source: "Source",
          dqScore: "Score DQ",
          dqTrend: "Tendance DQ",
          freshness: "Fraîcheur",
          domains: "Domaines",
          persons: "Personnes",
          latestRelease: "Dernière version",
        },
        messages: {
          loading: "Chargement de la vue d'ensemble du réseau...",
          noData: "Aucune donnée réseau disponible.",
          noReleases: "Aucune version",
        },
        radar: {
          title: "Profil radar DQ (dimensions de Kahn)",
          description:
            "Taux de réussite sur les cinq dimensions de qualité des données de Kahn. Les valeurs plus élevées indiquent une meilleure qualité.",
          noData: "Aucune donnée de radar DQ disponible.",
          dimensions: {
            completeness: "Complétude",
            conformanceValue: "Conformité (valeur)",
            conformanceRelational: "Conformité (relationnelle)",
            plausibilityAtemporal: "Plausibilité (atemporelle)",
            plausibilityTemporal: "Plausibilité (temporelle)",
          },
        },
      },
      feasibility: {
        title: "Évaluations de faisabilité",
        assessmentMeta: "{{date}} | {{sources}} sources évaluées",
        passedSummary: "{{passed}}/{{total}} réussies",
        resultsTitle: "Résultats : {{name}}",
        scoreLabel: "score {{score}} %",
        empty:
          "Aucune évaluation pour l'instant. Créez-en une pour vérifier si votre réseau peut soutenir l'étude proposée.",
        actions: {
          newAssessment: "+ Nouvelle évaluation",
          running: "Exécution...",
          runAssessment: "Exécuter l'évaluation",
          hide: "Masquer",
          forecast: "Prévision",
        },
        filters: {
          view: "Vue :",
        },
        detailViews: {
          table: "Tableau des scores",
          impact: "Analyse d'impact",
          consort: "Flux CONSORT",
        },
        criteria: {
          domains: "Domaines",
          concepts: "Concepts",
          visitTypes: "Types de visite",
          dateRange: "Plage de dates",
          patientCount: "Nombre de patients",
        },
        forecast: {
          insufficientData:
            "Données historiques insuffisantes pour la prévision (minimum 6 mois requis).",
          title: "Prévision d'arrivée de patients : {{source}}",
          monthlyRate: "Taux mensuel : {{rate}} patients/mois",
          targetReachedIn: "Cible atteinte dans ~{{months}} mois",
          targetAlreadyReached: "Cible déjà atteinte",
          actual: "Réel",
          projected: "Projeté",
          confidenceBand: "IC 95 %",
          targetLabel: "Cible : {{target}}",
          footnote:
            "Projection fondée sur une régression linéaire des 12 derniers mois. La bande de confiance s'élargit avec la distance de projection.",
        },
        consort: {
          allSources: "Toutes les sources",
          noResults: "Aucun résultat pour afficher le diagramme CONSORT.",
          title: "Flux d'attrition de style CONSORT",
          description:
            "Montre comment les sources sont progressivement exclues à chaque critère.",
          sources: "{{count}} sources",
          excluded: "-{{count}} exclues",
        },
        impact: {
          noData: "Aucune donnée d'impact des critères disponible.",
          title: "Analyse d'impact des critères",
          description:
            "Montre combien de sources supplémentaires réussiraient si chaque critère était retiré. Référence : {{passed}}/{{total}} réussies.",
          sourcesRecovered: "+{{count}} sources",
          guidance:
            "Le critère le plus influent est celui dont le retrait récupérerait le plus de sources. Envisagez d'assouplir les critères à fort impact si trop peu de sources sont éligibles.",
        },
        templates: {
          loading: "Chargement des modèles...",
          startFrom: "Commencer à partir d'un modèle",
        },
        table: {
          source: "Source",
          domains: "Domaines",
          concepts: "Concepts",
          visits: "Visites",
          dates: "Dates",
          patients: "Patients",
          score: "Score",
          overall: "Global",
          forecast: "Prévision",
        },
        status: {
          eligible: "ÉLIGIBLE",
          ineligible: "NON ÉLIGIBLE",
        },
        form: {
          title: "Nouvelle évaluation de faisabilité",
          assessmentName: "Nom de l'évaluation",
          assessmentNamePlaceholder: "p. ex. Étude des résultats du diabète",
          requiredDomains: "Domaines requis",
          minPatientCount: "Nombre minimal de patients (facultatif)",
          minPatientCountPlaceholder: "p. ex. 1000",
          domains: {
            condition: "Affections",
            drug: "Médicaments",
            procedure: "Procédures",
            measurement: "Mesures",
            observation: "Observations",
            visit: "Visites",
          },
        },
      },
      annotations: {
        filters: {
          allSources: "Toutes les sources",
        },
        tags: {
          all: "Toutes",
          dataEvent: "Événement de données",
          researchNote: "Note de recherche",
          actionItem: "Action à mener",
          system: "Système",
        },
        viewModes: {
          list: "Liste",
          timeline: "Chronologie",
        },
        actions: {
          reply: "Répondre",
          delete: "Supprimer",
        },
        replyPlaceholder: "Rédiger une réponse...",
        searchPlaceholder: "Rechercher des annotations...",
        confirmDelete: "Supprimer cette annotation ?",
        coordinateValue: "{{axis}} = {{value}}",
        sourceContext: "sur {{source}}",
        empty: {
          selectSource: "Sélectionnez une source pour voir ses annotations",
          noAnnotations: "Aucune annotation pour cette source",
          noTimeline: "Aucune annotation à afficher dans la chronologie.",
        },
      },
      coverage: {
        title: "Matrice de couverture (rapport Strand)",
        description:
          "Disponibilité des domaines sur toutes les sources de données. Vert = forte densité, ambre = faible densité, rouge = aucune donnée.",
        yes: "Oui",
        densityTitle: "Densité : {{density}} par personne",
        filters: {
          view: "Vue :",
        },
        viewModes: {
          records: "Enregistrements",
          per_person: "Par personne",
          date_range: "Plage de dates",
        },
        actions: {
          exporting: "Export...",
          exportCsv: "Exporter CSV",
          expectedVsActual: "Attendu vs réel",
        },
        table: {
          source: "Source",
          domains: "Domaines",
        },
        expectedStates: {
          expectedPresent: "Attendu et présent",
          expectedMissing: "Attendu mais manquant",
          unexpectedBonus: "Données bonus inattendues",
          notExpectedAbsent: "Non attendu, absent",
        },
        messages: {
          loading: "Chargement de la matrice de couverture...",
          noSources: "Aucune source disponible pour l'analyse de couverture.",
        },
      },
      dqHistory: {
        filters: {
          source: "Source :",
          selectSource: "Sélectionner une source...",
        },
        tabs: {
          trends: "Tendances",
          heatmap: "Carte thermique",
          sla: "SLA",
          overlay: "Inter-sources",
        },
        sections: {
          passRate: "Taux de réussite DQ par version",
          heatmap: "Carte thermique catégorie x version",
          sla: "Tableau de conformité SLA",
          overlay: "Superposition DQ inter-sources",
        },
        passRate: "Taux de réussite",
        deltaReportTitle: "Rapport delta : {{release}}",
        status: {
          new: "NOUVEAU",
          existing: "EXISTANT",
          resolved: "RÉSOLU",
          stable: "STABLE",
        },
        result: {
          pass: "RÉUSSITE",
          fail: "ÉCHEC",
        },
        statusSummary: {
          new: "{{count}} nouveaux",
          existing: "{{count}} existants",
          resolved: "{{count}} résolus",
          stable: "{{count}} stables",
        },
        table: {
          category: "Catégorie",
          status: "Statut",
          checkId: "ID du contrôle",
          current: "Actuel",
          previous: "Précédent",
        },
        sla: {
          targetsTitle: "Cibles SLA (taux de réussite min. %)",
          currentCompliance: "Conformité actuelle",
          actual: "Réel",
          target: "Cible",
          errorBudget: "Budget d'erreur",
          targetComparison: "{{actual}} % / cible {{target}} %",
        },
        messages: {
          selectSource: "Sélectionnez une source pour voir l'historique DQ.",
          loadingHistory: "Chargement de l'historique DQ...",
          loadingDeltas: "Chargement des deltas...",
          loadingHeatmap: "Chargement de la carte thermique...",
          loadingOverlay: "Chargement des données de superposition...",
          noOverlayData: "Aucune donnée DQ disponible entre les sources.",
          noHeatmapData:
            "Aucune donnée de carte thermique disponible. Exécutez DQD sur plusieurs versions pour voir les tendances par catégorie.",
          noDeltaData: "Aucune donnée delta disponible pour cette version.",
          saved: "Enregistré",
          noSlaTargets:
            "Aucune cible SLA définie. Définissez les cibles ci-dessus pour voir la conformité.",
          noTrendData:
            "Aucune donnée d'historique DQ disponible. Exécutez DQD sur au moins deux versions pour voir les tendances.",
          trendHelp:
            "Cliquez sur un point de version pour voir les détails du delta. Vert >90 %, ambre 80-90 %, rouge <80 %.",
          overlayHelp:
            "Taux de réussite DQ superposés sur toutes les sources dans une chronologie unifiée.",
        },
        actions: {
          exporting: "Export...",
          exportCsv: "Exporter CSV",
          saving: "Enregistrement...",
          saveSlaTargets: "Enregistrer les cibles SLA",
        },
      },
      unmapped: {
        filters: {
          source: "Source :",
          selectSource: "Sélectionner une source...",
          release: "Version :",
          table: "Table :",
          allTables: "Toutes les tables",
          searchPlaceholder: "Rechercher des codes sources...",
        },
        viewModes: {
          table: "Tableau",
          pareto: "Pareto",
          vocabulary: "Vocabulaire",
        },
        actions: {
          exporting: "Export...",
          exportUsagiCsv: "Exporter CSV Usagi",
          previous: "Préc.",
          next: "Suiv.",
        },
        summaryBadge: "{{table}} ({{codes}} codes, {{records}} enregistrements)",
        vocabularyValue: "({{vocabulary}})",
        progress: {
          noCodes: "Aucun code non mappé à examiner.",
          title: "Progression du mappage",
          reviewed: "{{percent}} % examinés",
          segmentTitle: "{{label}} : {{count}} ({{percent}} %)",
          label: "{{label}} :",
          status: {
            mapped: "Mappé",
            deferred: "Différé",
            excluded: "Exclu",
            pending: "En attente",
          },
        },
        sections: {
          pareto: "Analyse Pareto des codes non mappés",
          vocabulary: "Codes non mappés par vocabulaire",
          suggestions: "Suggestions de mappage IA",
        },
        suggestions: {
          generating: "Génération de suggestions via similarité pgvector...",
          failed:
            "Impossible de charger les suggestions. Le service IA ou les embeddings de concepts peuvent être indisponibles.",
          empty: "Aucune suggestion disponible. Les embeddings de concepts ne sont peut-être pas chargés.",
          id: "ID : {{id}}",
          accepted: "Accepté",
          accept: "Accepter",
          skip: "Ignorer",
        },
        pareto: {
          topCodesCoverage:
            "Les 20 principaux codes couvrent {{percent}} % de tous les enregistrements non mappés",
          percent: "{{value}} %",
          cumulativePercent: "% cumulé",
        },
        vocabulary: {
          total: "Total",
          codeCount: "{{count}} codes",
        },
        messages: {
          selectSource: "Sélectionnez une source pour voir les codes non mappés.",
          loading: "Chargement des codes non mappés...",
          emptyPareto: "Aucun code non mappé trouvé pour l'analyse Pareto.",
          emptyVocabulary: "Aucune donnée de vocabulaire disponible.",
          noneFound:
            "Aucun code source non mappé trouvé. Tous les codes sont mappés vers des concepts standard OMOP.",
          sortedByImpact: "Trié par score d'impact (nombre d'enregistrements x poids du domaine)",
          showing: "Affichage de {{start}} à {{end}} sur {{total}}",
        },
        table: {
          sourceCode: "Code source",
          vocabulary: "Vocabulaire",
          cdmTable: "Table CDM",
          cdmField: "Champ CDM",
          records: "Enregistrements",
          impactScore: "Score d'impact",
        },
      },
      conceptComparison: {
        title: "Comparaison de concepts entre sources",
        searchPlaceholder:
          "Rechercher un concept (p. ex. 'Diabète de type 2', 'Metformine')...",
        conceptMetadata: "{{domain}} | {{vocabulary}} | ID : {{id}}",
        selectedConceptMetadata:
          "{{domain}} | {{vocabulary}} | ID du concept : {{id}}",
        temporalTrendTitle: "Tendance temporelle : {{concept}}",
        addConceptPlaceholder: "Ajouter un autre concept ({{selected}}/{{max}} sélectionnés)...",
        cdcNationalRate: "Taux national CDC : {{value}}/1000",
        viewModes: {
          single: "Unique",
          temporal: "Temporel",
          multi: "Multi-concept",
          funnel: "Entonnoir d'attrition",
        },
        rateModes: {
          crude: "Taux brut",
          standardized: "Ajusté âge-sexe",
        },
        metrics: {
          rate: "Taux/1000",
          count: "Nombre",
          perThousandShort: "{{value}}/1k",
          perThousandLong: "{{value}} pour 1 000",
        },
        messages: {
          noComparisonData: "Aucune donnée de comparaison disponible.",
          noTemporalPrevalenceData: "Aucune donnée de prévalence temporelle disponible.",
          selectTwoConcepts: "Sélectionnez au moins 2 concepts à comparer.",
          searching: "Recherche...",
          loadingComparison: "Chargement des données de comparaison...",
          standardizedNote:
            "Standardisé sur la population du recensement américain 2020 avec standardisation directe âge-sexe.",
          searchToCompare:
            "Recherchez un concept ci-dessus pour comparer sa prévalence dans toutes les sources de données.",
          loadingTemporal: "Chargement de la prévalence temporelle...",
          noTemporalData: "Aucune donnée temporelle disponible pour ce concept.",
          searchForTemporal:
            "Recherchez un concept ci-dessus pour voir sa tendance de prévalence temporelle entre les versions.",
          loadingMulti: "Chargement de la comparaison multi-concepts...",
          loadingFunnel: "Chargement de l'entonnoir d'attrition...",
          noAttritionData:
            "Aucune donnée d'attrition disponible pour les concepts sélectionnés.",
          temporalPrevalenceHelp:
            "Taux pour 1 000 personnes dans le temps.",
        },
      },
      releases: {
        releaseTypes: {
          etl: "ETL",
          scheduledEtl: "ETL planifié",
          snapshot: "Instantané",
        },
        cdmVersion: "CDM {{version}}",
        vocabularyVersion: "Vocabulaire {{version}}",
        personCount: "{{value}} personnes",
        recordCount: "{{value}} enregistrements",
        actions: {
          showDiff: "Afficher le diff",
          editRelease: "Modifier la version",
          createRelease: "Créer une version",
          creating: "Création...",
          create: "Créer",
          saving: "Enregistrement...",
          save: "Enregistrer",
          cancel: "Annuler",
        },
        etl: {
          provenance: "Provenance ETL",
          ranBy: "Exécuté par :",
          codeVersion: "Version du code :",
          duration: "Durée :",
          started: "Démarré :",
          parameters: "Paramètres :",
        },
        duration: {
          hoursMinutes: "{{hours}} h {{minutes}} min",
          minutesSeconds: "{{minutes}} min {{seconds}} s",
          seconds: "{{seconds}} s",
        },
        confirmDelete: "Supprimer cette version ?",
        tabs: {
          list: "Versions",
          swimlane: "Couloirs",
          calendar: "Calendrier",
        },
        timelineTitle: "Chronologie des versions (toutes les sources)",
        calendarTitle: "Calendrier des versions",
        selectSource: "Sélectionner une source",
        form: {
          releaseName: "Nom de la version",
          cdmVersion: "Version CDM",
          vocabularyVersion: "Version du vocabulaire",
          etlVersion: "Version ETL",
          notes: "Notes",
          notesPlaceholder: "Notes de version...",
          cdmVersionOptional: "Version CDM (facultative)",
          vocabularyVersionOptional: "Version du vocabulaire (facultative)",
          cdmVersionPlaceholder: "CDM v5.4",
          vocabularyVersionPlaceholder: "2024-11-01",
          etlVersionPlaceholder: "v1.2.3",
        },
        empty: {
          selectSource: "Sélectionnez une source pour voir ses versions",
          noReleases: "Aucune version pour cette source",
          noReleaseData: "Aucune donnée de version disponible.",
        },
        calendar: {
          noEvents: "Aucun événement de version.",
          dayEvents: "{{date}} : {{count}} versions",
          less: "Moins",
          more: "Plus",
        },
        diff: {
          computing: "Calcul du diff...",
          title: "Diff de version",
          initialRelease: "Version initiale -- aucune donnée précédente à comparer.",
          persons: "Personnes :",
          records: "Enregistrements :",
          dqScore: "Score DQ :",
          unmapped: "Non mappés :",
          vocabUpdated: "Vocabulaire mis à jour",
          domainDeltas: "Deltas par domaine :",
        },
      },
      diversity: {
        title: "Rapport de diversité",
        description:
          "Proportions démographiques entre les sources de données. Sources triées par taille de population.",
        ratings: {
          very_high: "très élevée",
          high: "élevée",
          moderate: "modérée",
          low: "faible",
        },
        percentValue: "{{value}} %",
        labelPercentValue: "{{label}} : {{value}} %",
        personCount: "{{value}} personnes",
        labels: {
          gender: "Genre",
          race: "Origine raciale",
          ethnicity: "Ethnicité",
          male: "Masculin",
          female: "Féminin",
        },
        dimensions: {
          composite: "Indice composite",
          gender: "Genre",
          race: "Origine raciale",
          ethnicity: "Ethnicité",
        },
        tabs: {
          overview: "Vue d'ensemble",
          pyramid: "Pyramide des âges",
          dap: "Écart DAP",
          pooled: "Regroupé",
          geographic: "Géographique",
          trends: "Tendances",
        },
        filters: {
          selectSource: "Sélectionner une source",
        },
        benchmarks: {
          usCensus2020: "Recensement des États-Unis 2020",
        },
        dap: {
          title: "Analyse des écarts d'inscription FDA DAP",
          description:
            "Compare la démographie des sources aux références du recensement des États-Unis 2020 afin d'identifier les écarts d'inscription.",
          tooltip: "Réel : {{actual}} % | Cible : {{target}} % | Écart : {{gap}} %",
          status: {
            met: "Atteint (dans 2 %)",
            gap: "Écart (2-10 %)",
            critical: "Critique (>10 %)",
          },
        },
        agePyramid: {
          title: "{{source}} -- Distribution par âge",
        },
        benchmark: {
          title: "Référence : {{label}}",
          actual: "Réel",
          benchmark: "Référence",
        },
        trends: {
          title: "Tendances de diversité : {{source}}",
          description:
            "Indice de diversité de Simpson par version (0 = homogène, 1 = diversité maximale)",
        },
        geographic: {
          loading: "Chargement des données de diversité géographique...",
          noLocationData: "Aucune donnée de localisation disponible",
          noAdiData:
            "Données ADI indisponibles (le module GIS n'a peut-être pas chargé ADI)",
          noGeographicData:
            "Aucune donnée géographique disponible. Les sources n'ont peut-être pas de données de localisation dans la table person.",
          statesCovered: "États / régions couverts",
          networkMedianAdi: "ADI médian du réseau :",
          sourcesWithLocation: "Sources avec données de localisation",
          sourcesWithAdi: "Sources avec données ADI",
          stateCount: "{{count}} États",
          medianAdiValue: "ADI médian : {{value}}",
          topStates: "Principaux États par nombre de patients",
          adiDistribution: "Distribution des déciles ADI",
          leastDeprived: "Moins défavorisé",
          adiDecile: "Décile ADI",
          mostDeprived: "Plus défavorisé",
          decileTitle: "Décile {{decile}} : {{count}} codes ZIP",
          adiRatings: {
            low: "Faible défavorisation",
            moderate: "Défavorisation modérée",
            high: "Forte défavorisation (sous-desservi)",
          },
        },
        pooled: {
          title: "Démographie regroupée",
          description:
            "Sélectionnez plusieurs sources pour voir des profils démographiques fusionnés et pondérés.",
          summary: "Total : {{persons}} personnes sur {{sources}} sources",
        },
        messages: {
          loading: "Chargement des données de diversité...",
          noSources: "Aucune source disponible pour l'analyse de diversité.",
          noData: "Aucune donnée",
          noTrendData: "Aucune donnée de version disponible pour les tendances de diversité.",
          noTrendReleases:
            "Aucune version trouvée pour cette source. Créez des versions pour suivre les tendances de diversité.",
        },
      },
      cost: {
        empty: {
          title: "Aucune donnée de coût disponible",
          message:
            "Les données de coût nécessitent des jeux de données fondés sur des demandes de remboursement (p. ex. MarketScan, Optum, PharMetrics). Les jeux de données dérivés d'EHR comme SynPUF, MIMIC-IV et la plupart des données de centres médicaux universitaires ne renseignent généralement pas la table OMOP cost.",
        },
        filters: {
          source: "Source :",
          selectSource: "Sélectionner une source...",
        },
        tabs: {
          overview: "Vue d'ensemble",
          distribution: "Répartition",
          "care-setting": "Cadre de soins",
          trends: "Tendances",
          drivers: "Facteurs de coût",
          "cross-source": "Inter-sources",
        },
        messages: {
          selectSource: "Sélectionnez une source pour voir les données de coût.",
          loading: "Chargement des données de coût...",
          distributionHelp:
            "Boîtes à moustaches montrant la dispersion des coûts. Boîte = IQR (P25-P75), moustaches = P10-P90, ligne or = médiane, point rouge = moyenne.",
          noDistributionData: "Aucune donnée de distribution disponible.",
          noCareSettingData:
            "Aucune donnée de coût par cadre de soins disponible. Nécessite des enregistrements de coût du domaine Visit joints à visit_occurrence.",
          selectSourceForDrivers: "Sélectionnez une source pour voir les facteurs de coût.",
          loadingDrivers: "Chargement des facteurs de coût...",
          noDriverData: "Aucune donnée de facteur de coût disponible pour cette source.",
          costDriversHelp:
            "Top 10 des concepts par coût total. Cliquez sur une barre pour voir le détail du concept.",
          loadingCrossSource: "Chargement de la comparaison inter-sources...",
          noComparisonSources: "Aucune source disponible pour la comparaison.",
          noCrossSourceCostData:
            "Aucune source ne dispose de données de coût pour la comparaison.",
          crossSourceHelp:
            "Boîte à moustaches par source. Boîte = IQR (P25-P75), moustaches = P10-P90, ligne or = médiane.",
        },
        metrics: {
          totalCost: "Coût total",
          perPatientPerYear: "Par patient et par an",
          persons: "Personnes",
          observationYears: "{{value}} an(s)",
          avgObservation: "Observation moyenne",
          recordsAverage: "{{records}} enregistrements | moy. {{average}}",
          recordCount: "{{count}} enregistrements",
          patientCount: "{{count}} patients",
          averagePerRecord: "Moy. : {{value}}/enregistrement",
          medianValue: "Médiane : {{value}}",
          meanValue: "Moyenne : {{value}}",
          percent: "{{value}} %",
          range: "Plage : {{min}} - {{max}}",
        },
        costTypeFilter: {
          title: "Plusieurs types de coût détectés.",
          message:
            "Cette source comporte {{count}} concepts de type de coût différents. Mélanger montants facturés et montants payés produit des statistiques trompeuses. Filtrez par type de coût pour une analyse exacte.",
          allTypes: "Tous les types",
          option: "{{name}} ({{count}})",
        },
        sections: {
          costByDomain: "Coût par domaine",
          distributionByDomain: "Distribution des coûts par domaine",
          costByCareSetting: "Coût par cadre de soins",
          monthlyTrends: "Tendances mensuelles des coûts",
          topCostDrivers: "Principaux facteurs de coût",
          crossSourceComparison: "Comparaison des coûts entre sources",
        },
      },
    },
  },
  administration: {
    dashboard: {
      title: "Administration",
      subtitle: "Gérez les utilisateurs, les rôles, les autorisations et la configuration du système.",
      panels: {
        platform: "Plateforme",
        usersAccess: "Utilisateurs et accès",
        dataSources: "Sources de données",
        aiResearch: "IA et recherche"
      },
      status: {
        allHealthy: "Tout est sain",
        degraded: "Dégradé",
        warning: "Avertissement"
      },
      labels: {
        services: "Services",
        queue: "File",
        redis: "Redis",
        totalUsers: "Utilisateurs",
        roles: "Rôles",
        authProviders: "Fournisseurs d'authentification",
        tokenExpiry: "Expiration du jeton",
        solr: "Solr",
        aiProvider: "Fournisseur IA",
        model: "Modèle",
        abby: "Abby",
        researchRuntime: "R / HADES"
      },
      values: {
        servicesUp: "{{healthy}}/{{total}} actifs",
        queueSummary: "{{pending}} en attente / {{failed}} en échec",
        enabledCount: "{{count}} activés",
        tokenExpiry: "8h",
        cdmCount: "{{count}} CDM",
        solrSummary: "Documents {{docs}} / cœurs {{cores}}",
        none: "Aucun",
        online: "En ligne"
      },
      messages: {
        noCdmSources: "Aucune source CDM configurée"
      },
      nav: {
        userManagement: {
          title: "Gestion des utilisateurs",
          description: "Créez, modifiez et désactivez les comptes. Attribuez des rôles pour contrôler l'accès."
        },
        rolesPermissions: {
          title: "Rôles et autorisations",
          description: "Définissez des rôles personnalisés et ajustez les autorisations dans tous les domaines."
        },
        authProviders: {
          title: "Fournisseurs d'authentification",
          description: "Activez et configurez LDAP, OAuth 2.0, SAML 2.0 ou OIDC pour le SSO."
        },
        aiProviders: {
          title: "Configuration du fournisseur IA",
          description: "Basculez le backend d'Abby entre Ollama local, Anthropic, OpenAI, Gemini et plus."
        },
        systemHealth: {
          title: "État du système",
          description: "Statut en direct des services Parthenon : Redis, IA, Darkstar, Solr, Orthanc PACS et files de tâches."
        },
        vocabularyManagement: {
          title: "Gestion du vocabulaire",
          description: "Mettez à jour les tables OMOP en téléversant un nouveau ZIP Athena."
        },
        fhirConnections: {
          title: "Connexions FHIR EHR",
          description: "Gérez les connexions FHIR R4 vers Epic, Cerner et d'autres systèmes EHR pour l'import massif."
        }
      },
      setupWizard: {
        title: "Assistant de configuration de la plateforme",
        description: "Relancez la configuration guidée : état, fournisseur IA, authentification et sources de données."
      },
      atlasMigration: {
        title: "Migrer depuis Atlas",
        description: "Importez des définitions de cohortes, des jeux de concepts et des analyses depuis une installation OHDSI Atlas."
      },
      actions: {
        open: "Ouvrir",
        openWizard: "Ouvrir l'assistant"
      }
    },
    acropolisServices: {
      descriptions: {
        authentik: "Fournisseur d'identité et portail d'accès",
        wazuh: "Surveillance de la sécurité et tableau de bord SIEM",
        grafana: "Tableaux de bord de métriques et d’observabilité",
        portainer: "Opérations de conteneurs et de piles",
        pgadmin: "console d'administration PostgreSQL",
        n8n: "Orchestration et automatisation des flux de travail",
        superset: "BI et espace de travail d'analyse ad hoc",
        datahub: "Catalogue de métadonnées et explorateur de lignée"
      },
      openService: "Service ouvert"
    },
    grafana: {
      openDashboard: "Ouvrir le tableau de bord"
    },
    broadcastEmail: {
      title: "E-mail de diffusion",
      descriptionPrefix: "Cela enverra un e-mail individuel à chacun des",
      descriptionSuffix: "utilisateurs enregistrés.",
      subject: "Sujet",
      subjectPlaceholder: "Objet de l'e-mail...",
      message: "Message",
      messagePlaceholder: "Écrivez votre message ici...",
      close: "Fermer",
      cancel: "Annuler",
      sending: "Envoi...",
      sendToAll: "Envoyer à tous les utilisateurs",
      resultWithRecipients: "{{message}} (destinataires {{count}})",
      unknownError: "Erreur inconnue"
    },
    userModal: {
      titles: {
        editUser: "Modifier l'utilisateur",
        newUser: "Nouvel utilisateur"
      },
      fields: {
        fullName: "Nom et prénom",
        email: "E-mail",
        password: "Mot de passe",
        roles: "Rôles"
      },
      hints: {
        keepCurrentPassword: "(laisser vide pour rester à jour)"
      },
      placeholders: {
        maskedPassword: "••••••••",
        passwordRequirements: "Min 8 caractères, casse mixte + numéro"
      },
      actions: {
        cancel: "Annuler",
        saving: "Économie...",
        saveChanges: "Enregistrer les modifications",
        createUser: "Créer un utilisateur"
      },
      errors: {
        generic: "Une erreur s'est produite.",
        passwordRequired: "Un mot de passe est requis."
      }
    },
    liveKit: {
      loadingConfiguration: "Chargement de la configuration...",
      provider: "Fournisseur",
      providerBadges: {
        cloud: "Nuage",
        "self-hosted": "Auto-hébergé",
        env: "Env."
      },
      providerOptions: {
        environment: "Environnement",
        liveKitCloud: "LiveKit Nuage",
        selfHosted: "Auto-hébergé"
      },
      providerDescriptions: {
        useEnvFile: "Utiliser le fichier .env",
        hostedByLiveKit: "Hébergé par LiveKit",
        yourOwnServer: "Votre propre serveur"
      },
      env: {
        usingEnvConfiguration: "Utilisation de la configuration .env",
        url: "URL :",
        apiKey: "Clé API :",
        apiSecret: "Secret API :",
        notSet: "Non défini",
        missing: "Manquant",
        editPrefix: "Modifier",
        editSuffix: "et redémarrez PHP pour changer."
      },
      fields: {
        cloudUrl: "LiveKit Nuage URL",
        serverUrl: "Serveur URL",
        apiKey: "Clé API",
        apiSecret: "API secret"
      },
      placeholders: {
        savedKey: "Enregistré ; entrez une nouvelle clé pour la remplacer",
        savedSecret: "Enregistré ; entrez un nouveau secret pour le remplacer",
        enterApiKey: "Entrez la clé API",
        enterApiSecret: "Entrez le secret API"
      },
      actions: {
        hideConfiguration: "Masquer la configuration",
        configureLiveKit: "Configurer LiveKit",
        testConnection: "Tester la connexion",
        saveConfiguration: "Enregistrer la configuration",
        useEnvDefaults: "Utiliser les valeurs par défaut de .env"
      },
      toasts: {
        noUrlToTest: "Pas de URL à tester",
        connectionSuccessful: "Connexion réussie",
        connectionFailed: "La connexion a échoué",
        configurationSaved: "configuration LiveKit enregistrée",
        saveFailed: "Échec de l'enregistrement de la configuration"
      }
    },
    authProviders: {
      title: "Fournisseurs d'authentification",
      subtitle: "Activez un ou plusieurs fournisseurs d'identité externes pour le SSO. Le nom d'utilisateur/mot de passe Sanctum reste toujours disponible en secours.",
      providers: {
        ldap: {
          label: "LDAP / Active Directory",
          description: "Authentifiez avec Microsoft Active Directory ou tout annuaire LDAP v3. Prend en charge TLS, la synchronisation des groupes et le mappage des attributs."
        },
        oauth2: {
          label: "OAuth 2.0",
          description: "Déléguez l'authentification à GitHub, Google, Microsoft ou tout fournisseur OAuth 2.0 personnalisé."
        },
        saml2: {
          label: "SAML 2.0",
          description: "SSO d'entreprise via un fournisseur d'identité SAML 2.0 (Okta, Azure AD, ADFS, etc.)."
        },
        oidc: {
          label: "Connexion OpenID",
          description: "SSO moderne via la découverte OIDC. Prend en charge PKCE et tout IdP conforme aux standards."
        }
      },
      enabled: "Activé",
      disabled: "Désactivé",
      configure: "Configurer",
      testConnection: "Tester la connexion",
      connectionSuccessful: "Connexion réussie",
      connectionFailed: "Connexion échouée",
      usernamePassword: "Nom d'utilisateur et mot de passe",
      alwaysOn: "Toujours actif",
      builtIn: "Authentification Sanctum intégrée - toujours active.",
      loading: "Chargement des fournisseurs...",
      formActions: {
        saving: "Enregistrement...",
        save: "Enregistrer",
        saved: "Enregistré"
      },
      oauthForm: {
        drivers: {
          github: "GitHub",
          google: "Google",
          microsoft: "Microsoft/Azure AD",
          custom: "OAuth 2.0 personnalisé"
        },
        sections: {
          customEndpoints: "Points de terminaison personnalisés"
        },
        labels: {
          provider: "Fournisseur",
          clientId: "ID client",
          clientSecret: "Secret client",
          redirectUri: "URI de redirection",
          scopes: "Portées",
          authorizationUrl: "URL d'autorisation",
          tokenUrl: "URL de jeton",
          userInfoUrl: "URL d'informations utilisateur"
        },
        hints: {
          redirectUri: "Doit correspondre à l'URI enregistrée chez votre fournisseur OAuth",
          scopes: "Liste séparée par des espaces"
        },
        placeholders: {
          clientId: "ID client / application",
          redirectUri: "/api/v1/auth/oauth2/rappel",
          scopes: "email de profil openid"
        }
      },
      oidcForm: {
        labels: {
          discoveryUrl: "URL de découverte",
          clientId: "ID client",
          clientSecret: "Secret client",
          redirectUri: "URI de redirection",
          scopes: "Portées",
          pkceEnabled: "Activer PKCE (recommandé - nécessite un client public)"
        },
        hints: {
          discoveryUrl: "Le point de terminaison /.well-known/openid-configuration de votre IdP",
          redirectUri: "Doit correspondre à ce qui est enregistré dans votre IdP",
          scopes: "Séparées par des espaces"
        },
        placeholders: {
          discoveryUrl: "https://accounts.google.com/.well-known/openid-configuration",
          clientId: "votre-identifiant-client",
          redirectUri: "/api/v1/auth/oidc/callback",
          scopes: "email de profil openid"
        }
      },
      samlForm: {
        sections: {
          identityProvider: "Fournisseur d'identité (IdP)",
          serviceProvider: "Fournisseur de service (SP)",
          attributeMapping: "Mappage des attributs"
        },
        labels: {
          idpEntityId: "ID d'entité IdP",
          ssoUrl: "URL SSO",
          sloUrl: "URL SLO",
          idpCertificate: "Certificat IdP",
          spEntityId: "ID d'entité SP",
          acsUrl: "URL ACS",
          nameIdFormat: "Format NameID",
          signAssertions: "Signer les assertions (nécessite la clé privée SP - à configurer côté serveur)",
          emailAttribute: "Attribut e-mail",
          displayNameAttribute: "Attribut nom affiché"
        },
        hints: {
          ssoUrl: "Point de terminaison Single Sign-On",
          sloUrl: "Point de terminaison Single Logout (facultatif)",
          idpCertificate: "Collez le certificat X.509 (format PEM, avec ou sans en-têtes)",
          spEntityId: "URL de votre instance Parthenon - doit correspondre à celle enregistrée dans l'IdP",
          acsUrl: "Service consommateur d’assertions"
        },
        placeholders: {
          certificate: "-----BEGIN CERTIFICATE-----\nMIIDxTCC...\n-----END CERTIFICATE-----",
          acsUrl: "/api/v1/auth/saml2/callback",
          sloUrl: "/api/v1/auth/saml2/logout",
          displayName: "displayName"
        },
        attributeMappingDescription: "Mappez les attributs d'assertion SAML vers les champs utilisateur de Parthenon."
      },
      ldapForm: {
        sections: {
          connection: "Connexion",
          bindCredentials: "Identifiants de liaison",
          userSearch: "Recherche d'utilisateurs",
          attributeMapping: "Mappage des attributs",
          groupSync: "Synchronisation des groupes"
        },
        labels: {
          host: "Hôte",
          port: "Port",
          useSsl: "Utiliser SSL (LDAPS)",
          useTls: "Utiliser StartTLS",
          timeout: "Délai (s)",
          bindDn: "DN de liaison",
          bindPassword: "Mot de passe de liaison",
          baseDn: "DN de base",
          userSearchBase: "Base de recherche utilisateur",
          userFilter: "Filtre utilisateur",
          usernameField: "Champ nom d'utilisateur",
          emailField: "Champ e-mail",
          displayNameField: "Champ nom affiché",
          syncGroups: "Synchroniser les groupes LDAP vers les rôles Parthenon",
          groupSearchBase: "Base de recherche des groupes",
          groupFilter: "Filtre de groupe"
        },
        hints: {
          host: "Nom d'hôte ou IP du serveur LDAP",
          bindDn: "DN du compte de service utilisé pour interroger l'annuaire",
          userFilter: "{username} est remplacé au moment de la connexion"
        },
        placeholders: {
          bindDn: "cn=svc-parthénon,dc=exemple,dc=com",
          baseDn: "dc=exemple,dc=com",
          userSearchBase: "ou=utilisateurs,dc=exemple,dc=com",
          userFilter: "(uid={nom d'utilisateur})",
          groupSearchBase: "ou=groupes,dc=exemple,dc=com",
          groupFilter: "(objectClass=groupOfNames)"
        },
        actions: {
          saving: "Enregistrement...",
          save: "Enregistrer",
          saved: "Enregistré"
        }
      }
    },
    roles: {
      title: "Rôles et autorisations",
      subtitle: "Définissez des rôles personnalisés et affinez les attributions d'autorisations. Utilisez la matrice pour les modifications groupées.",
      tabs: {
        roleList: "Liste des rôles",
        permissionMatrix: "Matrice d'autorisation"
      },
      permissionMatrix: {
        instructions: "Cliquez sur les cellules pour basculer les autorisations · En-têtes de ligne à appliquer à tous les rôles · En-têtes de colonne pour accorder/révoquer tout pour un rôle.",
        saveAllChangesOne: "Enregistrer toutes les modifications (rôle {{count}})",
        saveAllChangesOther: "Enregistrer toutes les modifications (rôles {{count}})",
        permission: "Autorisation",
        columnTitle: "Basculer toutes les autorisations pour {{role}}",
        permissionCount: "{{count}} perms",
        saving: "économie...",
        saved: "enregistré ✓",
        save: "sauvegarder",
        domainTitle: "Basculer toutes les autorisations {{domain}} sur tous les rôles",
        rowTitle: "Activer {{permission}} pour tous les rôles",
        cellTitleGrant: "Accorder {{permission}} à {{role}}",
        cellTitleRevoke: "Révoquer {{permission}} de {{role}}"
      },
      editor: {
        roleName: "Nom du rôle",
        roleNamePlaceholder: "par ex. coordinateur de chantier",
        permissions: "Autorisations",
        selectedCount: "({{count}} sélectionné)"
      },
      actions: {
        newRole: "Nouveau rôle",
        cancel: "Annuler",
        saving: "Économie...",
        saveRole: "Enregistrer le rôle",
        editRole: "Modifier le rôle",
        deleteRole: "Supprimer le rôle",
        deleting: "Suppression...",
        delete: "Supprimer"
      },
      values: {
        builtIn: "intégré",
        userCountOne: "utilisateur {{count}}",
        userCountOther: "utilisateurs {{count}}",
        permissionCountOne: "autorisation {{count}}",
        permissionCountOther: "autorisations {{count}}",
        more: "+{{count}} plus"
      },
      deleteModal: {
        title: "Supprimer le rôle ?",
        prefix: "Le rôle",
        suffix: "sera définitivement supprimé. Les utilisateurs affectés uniquement à ce rôle perdront toutes les autorisations."
      }
    },
    pacs: {
      studyBrowser: {
        browseTitle: "Parcourir : {{name}}",
        filters: {
          patientName: "Nom du patient",
          patientId: "Patient ID",
          allModalities: "Toutes les modalités"
        },
        empty: {
          noStudies: "Aucune étude trouvée"
        },
        table: {
          patientName: "Nom du patient",
          patientId: "Patient ID",
          date: "Date",
          modality: "Modalité",
          description: "Description",
          series: "Série",
          instances: "Inst."
        },
        pagination: {
          range: "{{start}}-{{end}}",
          ofStudies: "des études {{total}}",
          previous: "Précédent",
          next: "Suivant"
        }
      },
      connectionCard: {
        defaultConnection: "Connexion par défaut",
        setAsDefault: "Définir par défaut",
        deleteConfirm: "Supprimer \"{{name}}\" ?",
        never: "Jamais",
        seriesByModality: "Série par modalité",
        statsUpdated: "Statistiques mises à jour {{date}}",
        stats: {
          patients: "Patients",
          studies: "Études",
          series: "Série",
          instances: "Instances",
          disk: "Disque"
        },
        actions: {
          edit: "Modifier",
          delete: "Supprimer",
          test: "Test",
          stats: "Statistiques",
          browse: "Parcourir"
        }
      }
    },
    solrAdmin: {
      title: "Administration de la recherche Solr",
      subtitle: "Gérez les cœurs de recherche Solr, déclenchez la réindexation et surveillez l'état.",
      loadingCoreStatus: "Chargement de l'état du noyau...",
      status: {
        healthy: "En bonne santé",
        unavailable: "Indisponible"
      },
      labels: {
        documents: "Documents",
        lastIndexed: "Dernier indexé",
        duration: "Durée"
      },
      values: {
        never: "Jamais",
        seconds: "{{seconds}}s"
      },
      actions: {
        reindexAll: "Réindexer tous les cœurs",
        reindex: "Réindexer",
        fullReindex: "Réindexation complète",
        clear: "Effacer"
      },
      messages: {
        fetchFailed: "Échec de la récupération du statut Solr",
        reindexCompleted: "Réindexation de '{{core}}' terminée",
        reindexFailed: "Échec de la réindexation de '{{core}}'",
        reindexAllCompleted: "Réindexation - tout est terminé",
        reindexAllFailed: "Échec de la réindexation de tous les cœurs",
        clearConfirm: "Êtes-vous sûr de vouloir effacer tous les documents de « {{core}} » ? Cela ne peut pas être annulé.",
        clearCompleted: "Noyau '{{core}}' effacé",
        clearFailed: "Échec de la suppression de « {{core}} »"
      }
    },
    aiProviders: {
      title: "Configuration du fournisseur IA",
      subtitle: "Choisissez le backend IA qui alimente Abby. Un seul fournisseur est actif à la fois. Les clés API sont stockées chiffrées.",
      activeProvider: "Fournisseur actif :",
      fields: {
        model: "Modèle",
        apiKey: "Clé API",
        ollamaBaseUrl: "URL de base Ollama"
      },
      placeholders: {
        modelName: "Nom du modèle"
      },
      values: {
        active: "Actif",
        enabled: "Activé",
        disabled: "Désactivé",
        noModelSelected: "Aucun modèle sélectionné"
      },
      actions: {
        currentlyActive: "Actuellement actif",
        setAsActive: "Définir comme actif",
        save: "Enregistrer",
        testConnection: "Tester la connexion"
      },
      messages: {
        requestFailed: "La requête a échoué."
      }
    },
    gisImport: {
      steps: {
        upload: "Télécharger",
        analyze: "Analyser",
        mapColumns: "Colonnes de la carte",
        configure: "Configurer",
        validate: "Valider",
        import: "Importer"
      },
      analyze: {
        analysisFailed: "Abby a rencontré un problème lors de l'analyse de ce fichier.",
        unknownError: "Erreur inconnue",
        retry: "Réessayer",
        analyzing: "Abby analyse vos données...",
        detecting: "Détection des types de colonnes, des codes géographiques et de la sémantique des valeurs"
      },
      upload: {
        uploading: "Téléchargement...",
        dropPrompt: "Déposez un fichier ici ou cliquez pour parcourir",
        acceptedFormats: "CSV, TSV, Excel, Shapefile (.zip), GeoJSON, KML, GeoPackage - max {{maxSize}}MB",
        largeFiles: "Pour les gros fichiers (> {{maxSize}}MB)",
        fileTooLarge: "Le fichier dépasse {{maxSize}}MB. Utilisez CLI : php artisan gis:import {{filename}}",
        uploadFailed: "Échec du téléchargement"
      },
      configure: {
        fields: {
          layerName: "Nom du calque",
          exposureType: "Type d'exposition",
          geographyLevel: "Niveau Géographie",
          valueType: "Type de valeur",
          aggregation: "Agrégation"
        },
        placeholders: {
          layerName: "par exemple, indice de vulnérabilité sociale",
          exposureType: "par exemple, svi_overall"
        },
        geographyLevels: {
          county: "Comté",
          tract: "Secteur de recensement",
          state: "État",
          country: "Pays",
          custom: "Personnalisé"
        },
        valueTypes: {
          continuous: "Continu (choroplèthe)",
          categorical: "Catégorique (couleurs discrètes)",
          binary: "Binaire (présence/absence)"
        },
        aggregations: {
          mean: "Signifier",
          sum: "Somme",
          maximum: "Maximum",
          minimum: "Minimum",
          latest: "Dernier"
        },
        saving: "Économie...",
        continue: "Continuer"
      },
      mapping: {
        title: "Mappage de colonnes",
        subtitle: "Mappez chaque colonne source à son objectif",
        purposes: {
          geographyCode: "Code de géographie",
          geographyName: "Nom géographique",
          latitude: "Latitude",
          longitude: "Longitude",
          valueMetric: "Valeur (métrique)",
          metadata: "Métadonnées",
          skip: "Sauter"
        },
        confidence: {
          high: "Haut",
          medium: "Moyen",
          low: "Faible"
        },
        askAbby: "Demandez à Abby",
        abbyOnColumn: "Abby sur \"{{column}}\" :",
        thinking: "Pensée...",
        saving: "Économie...",
        continue: "Continuer"
      },
      validate: {
        validating: "Validation...",
        validationFailed: "Échec de la validation :",
        unknownError: "Erreur inconnue",
        results: "Résultats de validation",
        stats: {
          totalRows: "Total des lignes",
          uniqueGeographies: "Géographies uniques",
          matched: "Correspondant",
          unmatched: "Sans correspondance (bouts)",
          matchRate: "Taux de correspondance",
          geographyType: "Type de géographie"
        },
        unmatchedWarning: "Géographies {{count}} introuvables dans la base de données. Des entrées de stub seront créées (pas de géométrie de limite).",
        backToMapping: "Retour à la cartographie",
        proceedWithImport: "Procéder à l'importation"
      },
      import: {
        starting: "Départ...",
        startImport: "Démarrer l'importation",
        importing: "Importation... {{progress}}%",
        complete: "Importation terminée",
        rowsImported: "lignes {{count}} importées",
        saveLearningPrompt: "Enregistrez les mappages pour que Abby apprenne pour la prochaine fois",
        saveToAbby: "Enregistrer sur Abby",
        viewInGisExplorer: "Afficher dans l'explorateur GIS",
        importAnother: "Importer un autre",
        failed: "Échec de l'importation",
        startOver: "Recommencer"
      }
    },
    chromaStudio: {
      title: "Chroma Collection Studio",
      subtitle: "Inspectez les collections de vecteurs, exécutez des requêtes sémantiques et gérez l'ingestion",
      values: {
        collectionCount: "collections {{count}}",
        loading: "chargement",
        loadingEllipsis: "Chargement...",
        countSuffix: "({{count}})",
        sampledSuffix: "({{count}} échantillonné)"
      },
      actions: {
        refreshCollections: "Actualiser les collections",
        ingestDocs: "Ingérer des documents",
        ingestClinical: "Ingérer clinique",
        promoteFaq: "Promouvoir FAQ",
        ingestOhdsiPapers: "Ingérer des papiers OHDSI",
        ingestOhdsiKnowledge: "Ingérer les connaissances OHDSI",
        ingestTextbooks: "Ingérer des manuels"
      },
      stats: {
        vectors: "Vectors",
        sampled: "Échantillonné",
        dimensions: "Dimensions",
        metaFields: "Champs méta"
      },
      messages: {
        loadingCollectionData: "Chargement des données de collecte..."
      },
      empty: {
        title: "Cette collection est vide",
        description: "Utilisez les actions d'ingestion ci-dessus pour remplir \"{{collection}}\" avec des documents.",
        noRecords: "Aucun enregistrement dans cette collection.",
        noDocumentReturned: "Aucun document retourné.",
        noDocumentText: "Aucun texte de document disponible."
      },
      tabs: {
        overview: "Aperçu",
        retrieval: "Récupération"
      },
      search: {
        placeholder: "Requête sémantique...",
        recentQueries: "Requêtes récentes",
        kLabel: "K :",
        queryAction: "Requête",
        empty: "Saisissez une requête ci-dessus et cliquez sur Requête pour inspecter les résultats de récupération.",
        queryLabel: "Requête:",
        resultsCount: "résultats {{count}}",
        querying: "Interrogation...",
        distance: "distance"
      },
      overview: {
        facetDistribution: "Distribution des facettes",
        sampleRecords: "Exemples d'enregistrements",
        collectionMetadata: "Métadonnées de collecte"
      }
    },
    vectorExplorer: {
      title: "Explorateur Vector",
      semanticMapTitle: "Carte sémantique {{dimensions}}D",
      loading: {
        computingProjection: "Projection informatique",
        runningProjection: "Exécution de PCA->UMAP sur des vecteurs {{sample}}...",
        recomputingProjection: "Recalcul de la projection..."
      },
      values: {
        all: "tous",
        loadingEllipsis: "Chargement...",
        countSuffix: "({{count}})",
        sampled: "{{count}} échantillonné",
        dimensions: "{{dimensions}}D",
        knnEdges: "k={{neighbors}} - bords {{edges}}",
        seconds: "{{seconds}}s",
        points: "{{count}} pts",
        cachedSuffix: "- mis en cache",
        fallbackSuffix: "- retomber",
        timeSuffix: "- {{seconds}}s"
      },
      modes: {
        clusters: "Groupes",
        query: "Requête",
        qa: "QA"
      },
      sample: {
        label: "Échantillon",
        confirmLoadAll: "Charger tous les vecteurs {{count}} ? Cela peut prendre sensiblement plus de temps.",
        steps: {
          all: "Tous"
        }
      },
      empty: {
        selectCollection: "Sélectionnez une collection pour visualiser les intégrations."
      },
      tooltips: {
        requiresAiService: "Nécessite une connexion au service IA"
      },
      controls: {
        colorBy: "Couleur par",
        modeDefault: "Mode par défaut"
      },
      search: {
        placeholder: "Rechercher dans l'espace vectoriel",
        searching: "Recherche...",
        search: "Rechercher",
        visibleResults: "Résultats {{visible}} de {{total}} visibles dans cette projection"
      },
      query: {
        anchor: "Ancre de requête"
      },
      sections: {
        overlays: "Superpositions",
        clusterProfile: "Profil de cluster",
        inspector: "Inspecteur"
      },
      inspector: {
        selectPoint: "Cliquez sur un point à inspecter.",
        loadingDetails: "Chargement de tous les détails...",
        flags: {
          outlier: "Valeur aberrante",
          duplicate: "Double",
          orphan: "Orphelin"
        }
      },
      overlays: {
        clusterHulls: {
          label: "Coques de cluster",
          help: "Enveloppes convexes autour des clusters"
        },
        topologyLines: {
          label: "Lignes de topologie",
          help: "liens k-NN entre les points proches"
        },
        queryRays: {
          label: "Rayons de requête",
          help: "Liens de similarité ancre-résultat"
        }
      },
      stats: {
        totalVectors: "Total des vecteurs",
        sampled: "Échantillonné",
        projection: "Projection",
        knnGraph: "graphique k-NN",
        source: "Source",
        projectionTime: "Temps de projection",
        indexed: "Indexé"
      },
      sources: {
        solrCached: "Solr (mis en cache)",
        clientFallback: "Repli client",
        liveUmap: "En direct UMAP"
      },
      actions: {
        recomputeProjection: "Recalculer la projection",
        expand: "Développer"
      },
      legend: {
        clusters: "Groupes",
        quality: "Qualité",
        similarity: "Similarité",
        hide: "Cacher",
        show: "Montrer"
      },
      quality: {
        outliers: "Valeurs aberrantes",
        duplicates: "Doublons",
        duplicatePairs: "Paires en double",
        orphans: "Orphelins",
        normal: "Normale",
        outOfSampled: "sur {{count}} échantillonné",
        exportCsv: "Exporter CSV"
      },
      clusterProfile: {
        selectCluster: "Sélectionnez un cluster pour inspecter ses métadonnées dominantes.",
        clusterSize: "Taille du cluster",
        dominantMetadata: "Métadonnées dominantes",
        representativeTitles: "Titres représentatifs"
      }
    },
    pacsConnectionModal: {
      title: {
        add: "Ajouter une connexion PACS",
        edit: "Modifier la connexion PACS"
      },
      description: "Configurez une connexion au serveur d'imagerie DICOM.",
      fields: {
        name: "Nom",
        type: "Catégorie",
        authType: "Type d'authentification",
        baseUrl: "Base URL",
        username: "Nom d'utilisateur",
        password: "Mot de passe",
        bearerToken: "Jeton du porteur",
        linkedSource: "Source liée (facultatif)",
        active: "Actif"
      },
      placeholders: {
        name: "Serveur principal PACS",
        keepExisting: "Laisser vide pour conserver l'existant",
        password: "mot de passe",
        token: "jeton"
      },
      types: {
        orthanc: "Orthanc",
        dicomweb: "DICOMweb",
        googleHealthcare: "Google Santé",
        cloud: "Nuage"
      },
      auth: {
        none: "Aucun",
        basic: "Authentification de base",
        bearer: "Jeton du porteur"
      },
      values: {
        latency: "({{ms}}ms)"
      },
      actions: {
        testConnection: "Tester la connexion",
        cancel: "Annuler",
        saveChanges: "Enregistrer les modifications",
        createConnection: "Créer une connexion"
      },
      errors: {
        testRequestFailed: "La demande de test a échoué",
        saveFailed: "Échec de l'enregistrement de la connexion"
      }
    },
    users: {
      title: "Utilisateurs",
      summary: {
        totalAccounts: "comptes totaux"
      },
      empty: {
        loading: "Chargement...",
        noUsers: "Aucun utilisateur trouvé",
        adjustFilters: "Essayez d'ajuster votre recherche ou vos filtres."
      },
      deleteModal: {
        title: "Supprimer l'utilisateur ?",
        description: "seront définitivement supprimés et tous leurs jetons API révoqués.",
        irreversible: "Cela ne peut pas être annulé."
      },
      actions: {
        cancel: "Annuler",
        deleting: "Suppression...",
        delete: "Supprimer",
        adminEmailer: "Envoyeur de courrier électronique pour l'administrateur",
        newUser: "Nouvel utilisateur",
        editUser: "Modifier l'utilisateur",
        deleteUser: "Supprimer un utilisateur"
      },
      filters: {
        searchPlaceholder: "Rechercher un nom ou une adresse e-mail...",
        allRoles: "Tous les rôles"
      },
      table: {
        name: "Nom",
        email: "E-mail",
        lastActive: "Dernier actif",
        joined: "Rejoint",
        roles: "Rôles"
      },
      values: {
        never: "Jamais"
      },
      pagination: {
        page: "Page",
        of: "de",
        users: "utilisateurs"
      }
    },
    userAudit: {
      title: "Journal d'audit des utilisateurs",
      subtitle: "Suivez les événements de connexion, l'accès aux fonctionnalités et les actions de sécurité pour tous les utilisateurs.",
      actions: {
        login: "Se connecter",
        logout: "Déconnexion",
        passwordChanged: "Mot de passe modifié",
        passwordReset: "Réinitialisation du mot de passe",
        featureAccess: "Accès aux fonctionnalités"
      },
      empty: {
        noMatching: "Aucun événement correspondant",
        noEvents: "Aucun événement d'audit pour l'instant",
        adjustFilters: "Essayez d'ajuster vos filtres ou votre plage de dates.",
        description: "Les événements d'audit sont enregistrés au fur et à mesure que les utilisateurs se connectent et accèdent aux fonctionnalités de la plateforme."
      },
      stats: {
        loginsToday: "Connexions aujourd'hui",
        activeUsers7d: "Utilisateurs actifs (7j)",
        totalEvents: "Total des événements",
        topFeature: "Fonctionnalité supérieure"
      },
      sections: {
        mostAccessedFeatures: "Fonctionnalités les plus consultées – 7 derniers jours"
      },
      filters: {
        searchPlaceholder: "Rechercher un utilisateur, une fonctionnalité, IP...",
        allActions: "Toutes les actions",
        clearAll: "Tout effacer"
      },
      table: {
        time: "Temps",
        user: "Utilisateur",
        action: "Action",
        feature: "Fonctionnalité",
        ipAddress: "Adresse IP"
      },
      pagination: {
        page: "Page",
        of: "de",
        events: "événements"
      }
    },
    serviceDetail: {
      actions: {
        backToSystemHealth: "Retour à l'état du système",
        systemHealth: "Santé du système",
        refresh: "Rafraîchir",
        manageSolrCores: "Gérer les cœurs Solr"
      },
      empty: {
        serviceNotFound: "Service introuvable.",
        noLogs: "Aucune entrée de journal récente disponible."
      },
      values: {
        checkedAt: "Vérifié à {{time}}",
        entriesCount: "(entrées {{count}})",
        yes: "Oui",
        no: "Non"
      },
      sections: {
        metrics: "Métrique",
        recentLogs: "Journaux récents"
      },
      pacs: {
        title: "Connexions PACS",
        addConnection: "Ajouter une connexion",
        empty: "Aucune connexion PACS configurée."
      },
      darkstar: {
        ohdsiPackages: "OHDSI HADES Forfaits",
        positPackages: "Forfaits Posit/CRAN",
        installedCount: "({{count}} installé)"
      }
    },
    atlasMigration: {
      steps: {
        connect: "Connecter",
        discover: "Découvrir",
        select: "Sélectionner",
        import: "Importer",
        summary: "Résumé"
      },
      entityTypes: {
        conceptSets: "Ensembles de concepts",
        cohortDefinitions: "Définitions des cohortes",
        incidenceRates: "Taux d'incidence",
        characterizations: "Caractérisations",
        pathways: "Voies",
        estimations: "Estimations",
        predictions: "Prédictions"
      },
      connect: {
        title: "Se connecter à Atlas WebAPI",
        description: "Entrez le URL de base de votre instance OHDSI WebAPI existante. Parthenon se connectera et inventoriera toutes les entités disponibles pour la migration.",
        webapiUrl: "WebAPI Base URL",
        authentication: "Authentication",
        auth: {
          none: "Aucun (WebAPI public)",
          basic: "Authentication de base",
          bearer: "Jeton du porteur"
        },
        credentials: "Identifiants (nom d'utilisateur : mot de passe)",
        bearerToken: "Jeton du porteur",
        testConnection: "Tester la connexion",
        webapiVersion: "Version WebAPI : {{version}}"
      },
      discover: {
        discovering: "Découverte d'entités...",
        querying: "Interroger tous les points de terminaison WebAPI en parallèle",
        title: "Inventaire Atlas",
        summary: "Trouvé des entités migratoires {{count}} dans les catégories {{categories}}.",
        sourcesFound: "Source(s) de données {{count}} également trouvée."
      },
      select: {
        title: "Sélectionnez les entités à migrer",
        description: "Choisissez les entités à importer. Les dépendances sont résolues automatiquement.",
        analysisWarning: "Les entités d'analyse peuvent faire référence à des définitions de cohortes et à des ensembles de concepts par ID. Parthenon remappera automatiquement ces références lors de l'importation. Pour de meilleurs résultats, incluez les cohortes et les ensembles de concepts référencés dans votre sélection.",
        selectedCount: "{{selected}}/{{total}} sélectionné",
        totalSelected: "Entités {{count}} sélectionnées pour la migration"
      },
      import: {
        starting: "Début de la migration...",
        importing: "Importation d'entités...",
        complete: "Migration terminée",
        failed: "Échec de la migration",
        processed: "Toutes les entités sélectionnées ont été traitées.",
        error: "Une erreur s'est produite lors de la migration.",
        percentComplete: "{{percent}}% terminé",
        polling: "Sondage pour les mises à jour..."
      },
      summary: {
        successful: "Migration réussie",
        completedWithWarnings: "Migration terminée avec des avertissements",
        failed: "Échec de la migration",
        from: "Depuis",
        duration: "Durée : {{duration}}"
      },
      metrics: {
        total: "Total",
        imported: "Importé",
        skipped: "Sauté",
        failed: "Échec"
      },
      table: {
        entityType: "Type d'entité",
        category: "Catégorie"
      },
      actions: {
        selectAll: "Sélectionner tout",
        deselectAll: "Désélectionner tout",
        retryFailed: "Échec de la nouvelle tentative ({{count}})",
        done: "Fait",
        closeTitle: "Fermer - revenez à tout moment via l'administration",
        previous: "Précédent",
        startMigration: "Démarrer la migration",
        next: "Suivant"
      },
      errors: {
        connectionFailed: "La connexion a échoué",
        discoveryFailed: "Échec de la découverte"
      }
    },
    fhirExport: {
      title: "FHIR Exportation groupée",
      subtitle: "Exportez les données OMOP CDM sous forme de fichiers FHIR R4 NDJSON pour l'interopérabilité.",
      comingSoon: "À venir",
      description: "FHIR Bulk Export ($export) est en cours de développement. Cette fonctionnalité permettra d'exporter les données OMOP CDM sous forme de fichiers FHIR R4 NDJSON pour l'interopérabilité.",
      backendPending: "Les points de terminaison backend pour cette fonctionnalité n'ont pas encore été implémentés."
    },
    fhirConnections: {
      title: "FHIR EHR Connexions",
      subtitle: "Configurez les connexions des services backend SMART pour l'extraction de données en masse FHIR R4 à partir d'Epic, Cerner et d'autres systèmes EHR ms.",
      runMetrics: {
        extracted: "Extrait",
        mapped: "Cartographié",
        written: "Écrit",
        failed: "Échec",
        mappingCoverage: "Couverture cartographique"
      },
      history: {
        loading: "Chargement de l'historique de synchronisation...",
        empty: "Aucune synchronisation n'est encore exécutée.",
        status: "Statut",
        started: "Commencé",
        duration: "Durée",
        metrics: "Métrique",
        title: "Historique de synchronisation"
      },
      dialog: {
        editTitle: "Modifier la connexion FHIR",
        addTitle: "Ajouter une connexion FHIR",
        description: "Configurez une connexion aux services backend SMART à un point de terminaison EHR FHIR R4."
      },
      labels: {
        siteName: "Nom du site",
        siteKey: "Clé du site (slug)",
        ehrVendor: "Fournisseur EHR",
        fhirBaseUrl: "FHIR Base URL",
        tokenEndpoint: "Point de terminaison du jeton",
        clientId: "Client ID",
        rsaPrivateKey: "Clé privée RSA (PEM)",
        scopes: "Portées",
        groupId: "Groupe ID (pour l'exportation en masse)",
        exportResourceTypes: "Exporter les types de ressources (séparés par des virgules, vide = tous)",
        active: "Actif",
        incrementalSync: "Synchronisation incrémentielle"
      },
      vendors: {
        epic: "Épique",
        cerner: "Cerner (Oracle Santé)",
        other: "Autre FHIR R4"
      },
      placeholders: {
        siteName: "L'épopée de Johns Hopkins",
        keepExistingKey: "Laisser vide pour conserver la clé existante",
        resourceTypes: "Patient, état, rencontre, demande de médicament, observation, procédure"
      },
      actions: {
        cancel: "Annuler",
        saveChanges: "Enregistrer les modifications",
        createConnection: "Créer une connexion",
        testConnection: "Tester la connexion",
        edit: "Modifier",
        delete: "Supprimer",
        details: "Détails",
        syncMonitor: "Moniteur de synchronisation",
        addConnection: "Ajouter une connexion"
      },
      messages: {
        failedToSave: "Échec de l'enregistrement",
        failedToStartSync: "Échec du démarrage de la synchronisation",
        deleteConfirm: "Supprimer \"{{name}}\" ?",
        noConnections: "Aucune connexion FHIR configurée",
        noConnectionsDescription: "Ajoutez une connexion pour commencer à extraire les données cliniques d'un EHR via FHIR R4 Bulk Data."
      },
      sync: {
        activateFirst: "Activez d'abord la connexion",
        uploadKeyFirst: "Téléchargez d'abord une clé privée",
        inProgress: "Synchronisation en cours",
        incrementalTitle: "Synchronisation incrémentielle (uniquement les nouvelles données)",
        fullSync: "Synchronisation complète",
        sync: "Synchroniser",
        incrementalSync: "Synchronisation incrémentielle",
        incrementalDescription: "Uniquement les données nouvelles/mises à jour depuis la dernière synchronisation",
        fullDescription: "Téléchargez toutes les données de EHR",
        forceFullSync: "Forcer la synchronisation complète",
        forceFullDescription: "Re-télécharger toutes les données, dédupliquer en écriture"
      },
      values: {
        percent: "{{value}}%",
        byUser: "par {{name}}",
        keyUploaded: "Clé téléchargée",
        noKey: "Pas de clé",
        lastSync: "Dernière synchronisation : {{date}}",
        records: "enregistrements {{count}}",
        testElapsed: "{{message}} ({{elapsed}}ms)",
        allSupported: "Tous pris en charge",
        enabled: "Activé",
        disabled: "Désactivé",
        since: "(depuis {{date}})",
        notSet: "Non défini",
        never: "Jamais"
      },
      details: {
        tokenEndpoint: "Point de terminaison du jeton :",
        clientId: "Client ID :",
        scopes: "Portées :",
        groupId: "Groupe ID :",
        resourceTypes: "Types de ressources :",
        incremental: "Incrémentiel :",
        targetSource: "Source cible :",
        syncRuns: "Exécutions de synchronisation :"
      },
      stats: {
        totalConnections: "Connexions totales",
        active: "Actif",
        keysConfigured: "Clés configurées",
        lastSync: "Dernière synchronisation"
      }
    },
    vocabulary: {
      title: "Gestion du vocabulaire",
      subtitle: "Mettez à jour les tables de vocabulaire OMOP à partir d'un téléchargement Athena ZIP.",
      status: {
        pending: "En file d'attente",
        running: "En cours",
        completed: "Complété",
        failed: "Échec"
      },
      log: {
        title: "Journal d'importation",
        noOutput: "(pas encore de sortie)"
      },
      labels: {
        schema: "Schéma:",
        source: "Source:",
        rowsLoaded: "Lignes chargées :",
        duration: "Durée:",
        by: "Par:",
        progress: "Progrès",
        optional: "(facultatif)"
      },
      values: {
        seconds: "{{value}}s"
      },
      actions: {
        refresh: "Rafraîchir",
        remove: "Retirer",
        uploading: "Téléchargement...",
        startImport: "Démarrer l'importation"
      },
      upload: {
        title: "Télécharger le vocabulaire Athena ZIP",
        descriptionPrefix: "Téléchargez un ensemble de vocabulaire à partir de",
        descriptionMiddle: "et téléchargez-le ici.",
        descriptionSuffix: "L'importation s'exécute en arrière-plan et peut prendre 15 à 60 minutes selon la taille du vocabulaire.",
        maxFileSize: "Les fichiers jusqu'à 5 GB sont pris en charge",
        dropHere: "Déposez Athena ZIP ici",
        browse: "ou cliquez pour parcourir",
        targetSource: "Source CDM cible",
        defaultSchema: "Schéma de vocabulaire par défaut",
        sourceHelpPrefix: "Sélectionne le schéma de vocabulaire de la source que l'importation remplira. Si aucune source n'est choisie, la valeur par défaut",
        sourceHelpSuffix: "le schéma de connexion est utilisé."
      },
      instructions: {
        title: "Comment obtenir un vocabulaire ZIP d'Athena",
        signInPrefix: "Visite",
        signInSuffix: "et connectez-vous.",
        selectDomains: "Sélectionnez les domaines de vocabulaire et les versions dont vous avez besoin (par exemple SNOMED, RxNorm, LOINC).",
        clickPrefix: "Cliquez",
        downloadVocabularies: "Télécharger les vocabulaires",
        clickSuffix: "- Athena vous enverra par e-mail un lien de téléchargement.",
        uploadZip: "Téléchargez le ZIP (généralement 500 MB-3 GB) et téléchargez-le ci-dessous."
      },
      messages: {
        deleteConfirm: "Supprimer cet enregistrement d'importation ?",
        uploadFailed: "Échec du téléchargement : {{message}}",
        unknownError: "Erreur inconnue",
        uploadSuccess: "ZIP téléchargé avec succès. La tâche d'importation est en file d'attente - vérifiez ci-dessous la progression.",
        importRunning: "Une importation est actuellement en cours. Les nouveaux téléchargements sont désactivés jusqu'à ce qu'ils soient terminés."
      },
      history: {
        title: "Historique d'importation",
        loading: "Chargement...",
        empty: "Aucune importation de vocabulaire pour l'instant. Téléchargez un Athena ZIP ci-dessus pour commencer."
      }
    },
    systemHealth: {
      title: "Santé du système",
      subtitle: "Statut en direct de tous les services Parthenon. Actualisation automatique toutes les 30 secondes.",
      serverStatus: "Statut du serveur",
      lastChecked: "Dernière vérification à {{time}}",
      polling: "Services de sondage...",
      gisDataManagement: "Gestion des données GIS",
      status: {
        healthy: "En bonne santé",
        degraded: "Dégradé",
        down: "Vers le bas"
      },
      overall: {
        healthy: "En bonne santé",
        needsAttention: "A besoin d'attention"
      },
      labels: {
        pending: "En attente:",
        failed: "Échoué:",
        cores: "Noyaux :",
        documents: "Documents :",
        dagster: "Dagster :",
        graphql: "GraphQL :",
        studies: "Études:",
        instances: "Exemples :",
        disk: "Disque:"
      },
      actions: {
        refresh: "Rafraîchir",
        openService: "Service ouvert",
        viewDetails: "Afficher les détails"
      },
      tiers: {
        corePlatform: "Plateforme principale",
        dataSearch: "Données et recherche",
        aiAnalytics: "IA et analytique",
        clinicalServices: "Services cliniques",
        monitoringCommunications: "Surveillance et communications",
        acropolisInfrastructure: "Infrastructure Acropolis",
        unknown: "Autres services"
      },
      hades: {
        title: "Parité du paquet OHDSI",
        subtitle: "Couverture du package Darkstar pour un travail de première classe, natif et de compatibilité.",
        checking: "Vérification des packages Darkstar...",
        unavailable: "L'inventaire des packages Darkstar n'est pas disponible.",
        installed: "Installé:",
        missing: "Manquant:",
        total: "Total:",
        requiredMissing: "Manquant obligatoire :",
        shinyPolicy: "Politique brillante héritée",
        notExposed: "non exposé",
        shinyPolicyDescription: "Les applications Shiny hébergées, l'intégration d'iframe et les chemins d'application fournis par l'utilisateur sont désactivés. Les packages OHDSI Shiny restent uniquement des artefacts de compatibilité d’exécution.",
        replacement: "Remplacement : {{surface}}",
        package: "Emballer",
        capability: "Capacité",
        priority: "Priorité",
        surface: "Surface",
        source: "Source",
        runtime: "durée d'exécution",
        status: {
          complete: "Complet",
          partial: "Partiel"
        }
      }
    },
    fhirSync: {
      title: "Moniteur FHIR Sync",
      subtitle: "Surveillance du pipeline ETL en temps réel sur toutes les connexions FHIR",
      status: {
        completed: "Complété",
        running: "En cours",
        pending: "En attente",
        exporting: "Exportation",
        downloading: "Téléchargement",
        processing: "Traitement",
        failed: "Échec"
      },
      timeline: {
        empty: "Aucune activité de synchronisation au cours des 30 derniers jours",
        tooltip: "{{date}} : {{completed}} terminé, {{failed}} échoué",
        hoverSummary: "{{completed}} ok / {{failed}} échoue"
      },
      metrics: {
        extracted: "Extrait",
        mapped: "Cartographié",
        written: "Écrit",
        failed: "Échec",
        averageMappingCoverage: "Couverture cartographique moyenne"
      },
      actions: {
        viewError: "Afficher l'erreur"
      },
      values: {
        runs: "{{count}} s'exécute",
        never: "Jamais",
        activeRuns: "{{count}} actif",
        refreshInterval: "Actualisation {{seconds}}s",
        allTimeTotals: "Totaux de tous les temps",
        lastRuns: "20 derniers sur toutes les connexions"
      },
      messages: {
        failedToLoad: "Échec du chargement des données du tableau de bord.",
        noConnections: "Aucune connexion configurée",
        noRuns: "Aucune synchronisation n'est encore exécutée"
      },
      stats: {
        connections: "Relations",
        totalRuns: "Nombre total de courses",
        completed: "Complété",
        failed: "Échec",
        recordsWritten: "Dossiers écrits",
        avgCoverage: "Couverture moyenne"
      },
      panels: {
        pipelineThroughput: "Débit des pipelines",
        syncActivity: "Activité de synchronisation (30 jours)",
        connectionHealth: "Santé de la connexion",
        recentRuns: "Exécutions de synchronisation récentes"
      },
      table: {
        status: "Statut",
        connection: "Connexion",
        started: "Commencé",
        duration: "Durée",
        metrics: "Métrique"
      }
    },
    gisData: {
      title: "Données de limite GIS",
      subtitle: "Gérer les ensembles de données de limites géographiques pour l'explorateur GIS",
      status: {
        loaded: "chargé",
        empty: "vide"
      },
      tabs: {
        boundaries: "Frontières",
        dataImport: "Importation de données"
      },
      messages: {
        checking: "Vérification des données de limite...",
        noBoundaryData: "Aucune donnée de limite chargée. Sélectionnez une source et des niveaux ci-dessous pour commencer."
      },
      labels: {
        boundaries: "Frontières:",
        countries: "Pays :"
      },
      load: {
        title: "Limites de charge",
        adminLevels: "Niveaux d'administrateur à charger :"
      },
      sources: {
        gadm: {
          name: "GADM v4.1",
          description: "Zones administratives mondiales : 356 000 limites réparties sur 6 niveaux d'administration"
        },
        geoboundaries: {
          name: "Limites géographiques CGAZ",
          description: "Limites simplifiées pour la cohérence cartographique (ADM0-2)"
        }
      },
      levels: {
        adm0: "Pays (ADM0)",
        adm1: "États/Provinces (ADM1)",
        adm2: "Districts/comtés (ADM2)",
        adm3: "Sous-districts (ADM3)"
      },
      actions: {
        preparing: "Préparation...",
        generateLoadCommand: "Générer une commande de chargement",
        refreshStats: "Actualiser les statistiques",
        copyToClipboard: "Copier dans le presse-papier",
        close: "Fermer"
      },
      modal: {
        runOnHost: "Exécuter sur l'hôte",
        description: "Les données GIS se chargent directement sur PostgreSQL 17 local. Exécutez cette commande à partir de la racine du projet :",
        datasetFlagPrefix: "Le",
        datasetFlagSuffix: "le drapeau permet le suivi des progrès. Actualisez les statistiques une fois le script terminé."
      },
      job: {
        title: "Chargement des limites GIS",
        description: "Source : {{source}} | Niveaux : {{levels}}"
      },
      values: {
        all: "tous"
      }
    },
    honestBroker: {
      title: "Courtier honnête",
      subtitle: "Enregistrez les participants à l'enquête en aveugle, associez-les aux enregistrements OMOP person_id et surveillez l'état de soumission sans exposer l'identité brute des répondants aux chercheurs.",
      actions: {
        cancel: "Annuler",
        registerParticipant: "Inscrire un participant",
        sendInvitation: "Envoyer une invitation",
        sendInvite: "Envoyer une invitation",
        refresh: "Rafraîchir",
        copyLink: "Copier le lien",
        openSurvey: "Enquête ouverte",
        resend: "Renvoyer",
        revoke: "Révoquer"
      },
      labels: {
        personId: "Personne ID",
        notes: "Remarques",
        participant: "Participant",
        deliveryEmail: "E-mail de livraison",
        unknown: "Inconnu",
        unknownInstrument: "Instrument inconnu",
        notYet: "Pas encore",
        notRecorded: "Non enregistré",
        system: "Système",
        statusToken: "{{status}} · {{token}}",
        tokenReference: "...{{token}}"
      },
      metrics: {
        brokerCampaigns: "Campagnes de courtier",
        registeredParticipants: "Participants inscrits",
        submitted: "Soumis",
        invitationsSent: "Invitations envoyées",
        complete: "Complet",
        pending: "En attente",
        seeded: "Semé",
        registered: "Inscrit",
        completion: "Achèvement",
        completionPercent: "{{value}}%"
      },
      campaignStatuses: {
        draft: "Brouillon",
        active: "Actif",
        closed: "Fermé"
      },
      matchStatuses: {
        submitted: "Soumis",
        registered: "Inscrit",
        pending: "En attente",
        matched: "Correspondant"
      },
      deliveryStatuses: {
        pending: "En attente",
        queued: "En file d'attente",
        sent: "Envoyé",
        opened: "Ouvert",
        submitted: "Soumis",
        revoked: "Révoqué",
        failed: "Échec"
      },
      unauthorized: {
        title: "Accès honnête au courtier requis",
        description: "Cet espace de travail est réservé aux gestionnaires de données et aux administrateurs, car il relie les identités des enquêtes en aveugle aux dossiers des patients."
      },
      registerModal: {
        title: "Inscrire un participant",
        titleWithCampaign: "Inscrire un participant · {{campaign}}",
        registering: "Enregistrement...",
        description: "Créez une entrée de registre en aveugle qui mappe un identifiant de répondant à un dossier patient pour cette campagne d'enquête.",
        respondentIdentifier: "Identifiant du répondant",
        respondentPlaceholder: "MRN, code d'étude ou code d'invitation",
        personIdPlaceholder: "OMOP personne_id connu",
        notesPlaceholder: "Notes de courtier facultatives"
      },
      inviteModal: {
        title: "Envoyer une invitation",
        titleWithCampaign: "Envoyer une invitation · {{campaign}}",
        sending: "Envoi...",
        description: "Envoyez un lien d’enquête unique géré par le courtier. Seul le courtier conserve l'adresse de livraison et la chaîne de traçabilité.",
        selectParticipant: "Sélectionner un participant",
        participantWithPerson: "{{blindedId}} · personne {{personId}}",
        emailPlaceholder: "patient@exemple.org",
        lastInvitation: "Dernière invitation : {{status}} · jeton se terminant par {{token}}"
      },
      campaignRegistry: {
        title: "Registre de campagne",
        subtitle: "Campagnes activées par un courtier honnête uniquement.",
        loading: "Chargement des campagnes...",
        emptyPrefix: "Aucune campagne de courtier honnête pour l'instant. Activer",
        requireHonestBroker: "Exiger un courtier honnête",
        emptySuffix: "d'abord sur une campagne d'enquête."
      },
      messages: {
        selectCampaignManage: "Sélectionnez une campagne pour gérer les inscriptions des courtiers.",
        selectCampaignReview: "Sélectionnez une campagne pour examiner les inscriptions des courtiers."
      },
      participants: {
        title: "Participants inscrits",
        subtitle: "Entrées de registre anonymisées pour la campagne d'enquête sélectionnée.",
        searchPlaceholder: "Rechercher un identifiant en aveugle, un identifiant de personne, des notes...",
        loading: "Chargement des inscriptions...",
        noMatches: "Aucune inscription de courtier ne correspond au filtre actuel."
      },
      invitations: {
        title: "Registre des invitations",
        subtitle: "Chaîne de contrôle sortante et entrante pour les invitations à des enquêtes gérées par les courtiers.",
        loading: "Chargement des invitations...",
        empty: "Aucune invitation envoyée pour cette campagne pour le moment."
      },
      audit: {
        title: "Piste d'audit",
        subtitle: "Chaîne de contrôle immuable côté courtier pour l’inscription des participants, les invitations sortantes et les événements de réponse entrants.",
        loading: "Chargement de la piste d'audit...",
        empty: "Aucun événement d'audit de courtier n'a encore été enregistré."
      },
      latest: {
        title: "Dernier enregistrement correspondant",
        blindedId: "ID aveuglé",
        created: "Créé"
      },
      table: {
        blindedParticipant: "Participant aveugle",
        conductId: "Conduire ID",
        status: "Statut",
        submitted: "Soumis",
        contact: "Contact",
        latestInvite: "Dernière invitation",
        destination: "Destination",
        sent: "Envoyé",
        opened: "Ouvert",
        reference: "Référence",
        actions: "Actes",
        time: "Temps",
        action: "Action",
        actor: "Acteur",
        inviteRef: "Réf d'invitation",
        metadata: "Métadonnées"
      },
      auditActions: {
        participant_registered: "Participant inscrit",
        invitation_sent: "Invitation envoyée",
        invitation_resent: "Invitation renvoyée",
        invitation_revoked: "Invitation révoquée",
        response_submitted: "Réponse soumise",
        status_changed: "Statut modifié"
      },
      confirmRevoke: "Révoquer l'invitation se terminant par {{token}} ?",
      toasts: {
        publishLinkCopied: "Lien de publication copié",
        publishLinkCopyFailed: "Échec de la copie du lien de publication",
        participantRegistered: "Participant inscrit",
        participantRegisterFailed: "Échec de l'inscription du participant",
        invitationSent: "Invitation envoyée · jeton se terminant par {{token}}",
        invitationSendFailed: "Échec de l'envoi de l'invitation",
        invitationResent: "Invitation renvoyée · jeton se terminant par {{token}}",
        invitationResendFailed: "Échec du renvoi de l'invitation",
        invitationRevoked: "Invitation révoquée · jeton se terminant par {{token}}",
        invitationRevokeFailed: "Échec de la révocation de l'invitation"
      }
    }
  },
});

const deApp: MessageTree = mergeMessageTrees(enApp, {
  errors: {
    boundary: {
      title: "Etwas ist schiefgelaufen",
      message: "Ein unerwarteter Fehler ist aufgetreten. Laden Sie die Seite neu.",
      reloadPage: "Seite neu laden",
    },
    route: {
      routeError: "Routenfehler",
      pageFailed: "Die Seite konnte nicht gerendert werden.",
      analysisDescription:
        "Diese Analyseseite hatte einen Render- oder Routenladefehler.",
      label: "Fehler",
      backToAnalyses: "Zurück zu Analysen",
      reloadPage: "Seite neu laden",
    },
  },
  analysis: {
    titles: {
      characterization: "Charakterisierung",
      incidenceRate: "Inzidenzratenanalyse",
      pathway: "Pfadanalyse",
      estimation: "Schätzungsanalyse",
      prediction: "Prädiktionsanalyse",
      sccs: "SCCS-Analyse",
      evidenceSynthesis: "Evidenzsynthese-Analyse",
    },
  },
  studies: {
    list: {
      title: "Studien",
      subtitle: "Orchestrieren und verwalten Sie Verbundforschungsstudien",
      tableView: "Tabellenansicht",
      cardView: "Kartenansicht",
      searchPlaceholder: "Studien durchsuchen...",
      noSearchMatches: "Keine Studien passen zu „{{query}}“",
      typeToFilter: "Geben Sie ein, um {{count}}-Studien zu filtern",
      newStudy: "Neue Studie",
      solr: "Solr",
      drilldownTitle: "{{phase}}-Studien",
      filterLabels: {
        status: "Stand",
        type: "Art",
        priority: "Priorität"
      },
      loadFailed: "Studien konnten nicht geladen werden",
      clear: "Zurücksetzen",
      empty: {
        noMatchingTitle: "Keine passenden Studien",
        noStudiesTitle: "Noch keine Studien",
        noResultsFor: "Keine Studien für „{{query}}“ gefunden",
        tryAdjusting: "Versuchen Sie, Ihre Suchbegriffe anzupassen.",
        createFirst: "Erstellen Sie Ihre erste Studie, um Verbundforschung zu orchestrieren."
      },
      table: {
        title: "Titel",
        type: "Art",
        status: "Stand",
        priority: "Priorität",
        pi: "Hauptprüfer",
        created: "Erstellt"
      },
      pagination: {
        showing: "Zeigt {{start}} - {{end}} von {{total}}",
        page: "{{page}} / {{totalPages}}"
      }
    },
    metrics: {
      total: "Gesamt",
      active: "Aktiv",
      preStudy: "Vor der Studie",
      inProgress: "Im Gange",
      postStudy: "Nach der Studie"
    },
    studyTypes: {
      characterization: "Charakterisierung",
      populationLevelEstimation: "PLE",
      patientLevelPrediction: "PLP",
      comparativeEffectiveness: "Vergleichend",
      safetySurveillance: "Sicherheit",
      drugUtilization: "Arzneimittelnutzung",
      qualityImprovement: "QI",
      custom: "Benutzerdefiniert"
    },
    statuses: {
      draft: "Entwurf",
      protocol_development: "Protokollentwicklung",
      feasibility: "Durchführbarkeit",
      irb_review: "IRB-Prüfung",
      execution: "Ausführung",
      analysis: "Analyse",
      published: "Veröffentlicht",
      archived: "Archiviert"
    },
    priorities: {
      critical: "Kritisch",
      high: "Hoch",
      medium: "Mittel",
      low: "Niedrig"
    },
    phases: {
      activeMetric: "Aktiv",
      pre_study: "Vor der Studie",
      active: "Im Gange",
      post_study: "Nach der Studie"
    },
    create: {
      backToStudies: "Studien",
      title: "Studie erstellen",
      subtitle: "Konfigurieren Sie Ihre Forschungsstudie Schritt für Schritt",
      previous: "Vorherige",
      next: "Nächste",
      createAsDraft: "Als Entwurf anlegen",
      steps: {
        basics: "Grundlagen",
        science: "Wissenschaftliches Design",
        team: "Team & Zeitleiste",
        review: "Überprüfen und erstellen"
      },
      studyTypes: {
        characterization: {
          label: "Charakterisierung",
          description: "Beschreiben Sie Patientenpopulationen und Behandlungsmuster"
        },
        populationLevelEstimation: {
          label: "Schätzung auf Bevölkerungsebene",
          description: "Schätzen Sie kausale Effekte anhand von Beobachtungsdaten ab"
        },
        patientLevelPrediction: {
          label: "Vorhersage auf Patientenebene",
          description: "Prognostizieren Sie die Ergebnisse einzelner Patienten"
        },
        comparativeEffectiveness: {
          label: "Vergleichende Wirksamkeit",
          description: "Vergleichen Sie Behandlungen in realen Umgebungen"
        },
        safetySurveillance: {
          label: "Sicherheitsüberwachung",
          description: "Überwachen Sie die Signale zur Arzneimittelsicherheit nach der Markteinführung"
        },
        drugUtilization: {
          label: "Arzneimittelnutzung",
          description: "Analysieren Sie Muster und Trends beim Medikamentenkonsum"
        },
        qualityImprovement: {
          label: "Qualitätsverbesserung",
          description: "Bewerten Sie die Qualität der Pflege und die Einhaltung der Leitlinien"
        },
        custom: {
          label: "Benutzerdefiniert",
          description: "Definieren Sie einen benutzerdefinierten Studientyp"
        }
      },
      designs: {
        select: "Design auswählen...",
        retrospectiveCohort: "Retrospektive Kohorte",
        prospectiveCohort: "Prospektive Kohorte",
        caseControl: "Fallkontrolle",
        crossSectional: "Querschnitt",
        selfControlled: "Selbstkontrollierte Fallserie",
        nestedCaseControl: "Verschachtelte Fallkontrolle",
        metaAnalysis: "Meta-Analyse",
        networkStudy: "Netzwerkstudie",
        methodological: "Methodisch"
      },
      phases: {
        select: "Phase auswählen...",
        phaseI: "Phase I",
        phaseII: "Phase II",
        phaseIII: "Phase III",
        phaseIV: "Phase IV",
        notApplicable: "Nicht zutreffend"
      },
      basics: {
        studyType: "Studienart *",
        title: "Titel *",
        titlePlaceholder: "z. B. Wirkung von Statinen auf kardiovaskuläre Ergebnisse bei T2DM",
        shortTitle: "Kurztitel",
        shortTitlePlaceholder: "z. B. LEGEND-T2DM",
        priority: "Priorität",
        studyDesign: "Studiendesign",
        description: "Beschreibung",
        descriptionPlaceholder: "Kurze Beschreibung der Studie...",
        tags: "Schlagworte",
        tagsPlaceholder: "Tag hinzufügen und Enter drücken...",
        addTag: "Tag hinzufügen"
      },
      science: {
        aiPrompt: "Lassen Sie die KI anhand Ihres Studientitels wissenschaftliche Designfelder vorschlagen",
        generating: "Generieren...",
        generateWithAi: "Mit KI generieren",
        aiUnavailable: "Der KI-Dienst ist nicht verfügbar. Bitte füllen Sie die Felder manuell aus.",
        rationale: "Wissenschaftliche Begründung",
        rationalePlaceholder: "Warum wird diese Studie benötigt? Welche Wissenslücke wird damit geschlossen?",
        hypothesis: "Hypothese",
        hypothesisPlaceholder: "Geben Sie die primäre Hypothese an, die getestet wird ...",
        primaryObjective: "Hauptziel",
        primaryObjectivePlaceholder: "Was ist das Hauptziel dieser Studie?",
        secondaryObjectives: "Sekundäre Ziele",
        secondaryObjectivePlaceholder: "Ziel hinzufügen und Enter drücken...",
        addSecondaryObjective: "Sekundäres Ziel hinzufügen",
        fundingSource: "Finanzierungsquelle",
        fundingSourcePlaceholder: "z. B. NIH R01, PCORI, von der Industrie gesponsert"
      },
      team: {
        startDate: "Studienbeginndatum",
        endDate: "Enddatum der Studie",
        endDateAfterStart: "Das Enddatum muss nach dem Startdatum liegen",
        targetSites: "Target-Registrierungsseiten",
        targetSitesPlaceholder: "z.B. 10",
        studyPhase: "Studienphase",
        nctId: "ClinicalTrials.gov-ID",
        nctIdPlaceholder: "z. B. NCT12345678",
        note: "Teammitglieder, Standorte und Kohorten können nach der Erstellung der Studie über das Studien-Dashboard konfiguriert werden."
      },
      review: {
        basics: "Grundlagen",
        scientificDesign: "Wissenschaftliches Design",
        timelineRegistration: "Zeitleiste und Registrierung",
        labels: {
          title: "Titel:",
          shortTitle: "Kurztitel:",
          type: "Typ:",
          priority: "Priorität:",
          design: "Studiendesign:",
          rationale: "Begründung:",
          hypothesis: "Hypothese:",
          primaryObjective: "Hauptziel:",
          secondaryObjectives: "Sekundäre Ziele:",
          start: "Beginn:",
          end: "Ende:",
          targetSites: "Zielseiten:",
          phase: "Phase:",
          nctId: "NCT-ID:",
          funding: "Finanzierung:"
        }
      }
    },
    detail: {
      loadFailed: "Studie konnte nicht geladen werden",
      backToStudies: "Zurück zu Studien",
      studies: "Studien",
      confirmDelete: "Sind Sie sicher, dass Sie diese Studie löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.",
      confirmArchive: "Diese Studie archivieren? Es kann später wiederhergestellt werden.",
      copyTitle: "Kopie von {{title}}",
      tabs: {
        overview: "Überblick",
        design: "Studiendesign",
        analyses: "Analysen",
        results: "Ergebnisse",
        progress: "Fortschritt",
        sites: "Standorte",
        team: "Studienteam",
        cohorts: "Kohorten",
        milestones: "Meilensteine",
        artifacts: "Artefakte",
        activity: "Aktivität",
        federated: "Verbunden"
      },
      statuses: {
        draft: "Entwurf",
        protocol_development: "Protokollentwicklung",
        feasibility: "Durchführbarkeit",
        irb_review: "IRB-Prüfung",
        recruitment: "Werbung",
        execution: "Ausführung",
        analysis: "Analyse",
        synthesis: "Synthese",
        manuscript: "Manuskript",
        published: "Veröffentlicht",
        archived: "Archiviert",
        withdrawn: "Zurückgezogen"
      },
      studyTypes: {
        characterization: "Charakterisierung",
        population_level_estimation: "Schätzung auf Bevölkerungsebene",
        patient_level_prediction: "Vorhersage auf Patientenebene",
        comparative_effectiveness: "Vergleichende Wirksamkeit",
        safety_surveillance: "Sicherheitsüberwachung",
        drug_utilization: "Arzneimittelnutzung",
        quality_improvement: "Qualitätsverbesserung",
        custom: "Benutzerdefiniert"
      },
      actions: {
        transitionTo: "Übergang zu",
        generateManuscriptTitle: "Erstellen Sie Manuskripte aus abgeschlossenen Analysen",
        manuscript: "Manuskript",
        duplicateStudy: "Doppelte Studie",
        exportJson: "Als JSON exportieren",
        archiveStudy: "Archivstudie",
        deleteStudy: "Studie löschen"
      },
      sections: {
        about: "Um",
        analysisPipeline: "Analysepipeline ({{count}})",
        executionProgress: "Ausführungsfortschritt",
        details: "Einzelheiten",
        timeline: "Zeitleiste",
        tags: "Schlagworte",
        createdBy: "Erstellt von"
      },
      labels: {
        primaryObjective: "Hauptziel",
        hypothesis: "Hypothese",
        secondaryObjectives: "Sekundäre Ziele",
        principalInvestigator: "Hauptermittler",
        leadDataScientist: "Leitender Datenwissenschaftler",
        studyDesign: "Studiendesign",
        phase: "Phase",
        protocolVersion: "Protokollversion",
        funding: "Finanzierung",
        clinicalTrialsGov: "ClinicalTrials.gov",
        start: "Beginn:",
        end: "Ende:",
        targetSites: "Zielseiten:",
        created: "Erstellt:"
      },
      messages: {
        noDescription: "Keine Beschreibung angegeben",
        moreAnalyses: "+{{count}} weitere Analysen"
      },
      progress: {
        completed: "{{count}} abgeschlossen",
        running: "{{count}} läuft",
        failed: "{{count}} ist fehlgeschlagen",
        pending: "{{count}} ausstehend"
      }
    },
    dashboard: {
      progressSummary: "{{completed}} von {{total}} Analysen abgeschlossen",
      stats: {
        total: "Gesamt",
        pending: "Ausstehend",
        running: "Läuft",
        completed: "Abgeschlossen",
        failed: "Fehlgeschlagen"
      },
      sections: {
        studyAnalyses: "Studienanalysen"
      },
      table: {
        type: "Art",
        name: "Name",
        status: "Stand"
      },
      messages: {
        notExecuted: "Nicht ausgeführt"
      },
      empty: {
        title: "Keine Analysen in dieser Studie",
        message: "Fügen Sie Analysen auf der Registerkarte „Design“ hinzu, um loszulegen."
      }
    },
    analyses: {
      selectSource: "Quelle auswählen...",
      executeAll: "Alle ausführen",
      addAnalysisToStudy: "Analyse zur Studie hinzufügen",
      emptyMessage: "Fügen Sie Charakterisierungen, Schätzungen, Vorhersagen und mehr hinzu, um Ihre Analysepipeline aufzubauen",
      groupHeader: "{{label}} ({{count}})",
      openAnalysisDetail: "Analysedetail öffnen",
      confirmRemove: "Diese Analyse aus der Studie entfernen?",
      removeFromStudy: "Aus der Studie entfernen",
      analysisId: "Analyse-ID",
      lastRun: "Letzter Lauf",
      error: "Fehler",
      viewFullDetail: "Vollständige Details anzeigen"
    },
    results: {
      sections: {
        results: "Ergebnisse ({{count}})",
        syntheses: "Synthesen ({{count}})"
      },
      actions: {
        synthesize: "Synthetisieren",
        markPrimary: "Als primär markieren",
        unmarkPrimary: "Primärmarkierung entfernen",
        markPublishable: "Als veröffentlichbar markieren",
        unmarkPublishable: "Veröffentlichungsmarkierung entfernen",
        cancel: "Abbrechen"
      },
      filters: {
        allTypes: "Alle Arten",
        publishableOnly: "Nur veröffentlichbar"
      },
      empty: {
        noResultsTitle: "Noch keine Ergebnisse",
        noResultsMessage: "Die Ergebnisse werden hier angezeigt, nachdem die Analysen ausgeführt wurden",
        noSummaryData: "Keine zusammenfassenden Daten verfügbar",
        noSynthesesTitle: "Keine Synthesen",
        noSynthesesMessage: "Kombinieren Sie Ergebnisse aus mehreren Standorten mithilfe einer Metaanalyse"
      },
      resultTypes: {
        cohort_count: "Kohortenanzahl",
        characterization: "Charakterisierung",
        incidence_rate: "Inzidenzrate",
        effect_estimate: "Effektschätzung",
        prediction_performance: "Vorhersageleistung",
        pathway: "Weg",
        sccs: "SCCS",
        custom: "Benutzerdefiniert"
      },
      synthesisTypes: {
        fixed_effects_meta: "Fixed-Effects-Metaanalyse",
        random_effects_meta: "Metaanalyse zufälliger Effekte",
        bayesian_meta: "Bayesianische Metaanalyse",
        forest_plot: "Forest-Plot",
        heterogeneity_analysis: "Heterogenitätsanalyse",
        funnel_plot: "Funnel-Plot",
        evidence_synthesis: "Beweissynthese",
        custom: "Benutzerdefiniert"
      },
      badges: {
        primary: "Primär",
        publishable: "Veröffentlichbar"
      },
      messages: {
        resultCreated: "Ergebnis #{{id}} · {{date}}",
        reviewedBy: "Bewertet von {{name}}"
      },
      labels: {
        summary: "Zusammenfassung",
        diagnostics: "Diagnose"
      },
      pagination: {
        previous: "Vorherige",
        next: "Nächste",
        page: "Seite {{page}} von {{totalPages}}"
      },
      synthesis: {
        createTitle: "Synthese erstellen",
        instructions: "Wählen Sie oben zwei oder mehr Ergebnisse aus und wählen Sie dann eine Synthesemethode aus.",
        createSelected: "Erstellen ({{count}} ausgewählt)",
        confirmDelete: "Diese Synthese löschen?",
        resultsCount: "{{count}} Ergebnisse",
        system: "Systembereich",
        methodSettings: "Methodeneinstellungen",
        output: "Ausgabe",
        noOutput: "Es wurde noch keine Ausgabe generiert"
      }
    },
    federated: {
      loadingResults: "Ergebnisse werden geladen...",
      loadResultsFailed: "Ergebnisse konnten nicht geladen werden: {{error}}",
      unknownError: "Unbekannter Fehler",
      confirmDistribute: "Studie an {{count}}-Datenknoten verteilen?",
      arachneNotReachable: "Arachne Central ist nicht erreichbar",
      loadNodesFailed: "Fehler beim Laden der Arachne-Knoten",
      arachneConnectionHelp: "Legen Sie ARACHNE_URL in Ihrer Umgebung fest, um die Verbundausführung zu ermöglichen. Stellen Sie sicher, dass Arachne Central ausgeführt wird und zugänglich ist.",
      availableDataNodes: "Verfügbare Datenknoten",
      poweredByArachne: "Unterstützt von Arachne",
      distributeCount: "Verteilen ({{count}})",
      noNodes: "Keine Arachne-Knoten konfiguriert. Legen Sie ARACHNE_URL in der Umgebung fest, um die Verbundausführung zu ermöglichen.",
      distributionFailed: "Verteilung fehlgeschlagen: {{error}}",
      distributionSucceeded: "Studie erfolgreich verteilt. Überwachungsstatus unten.",
      federatedExecutions: "Föderierte Ausführungen",
      noExecutions: "Noch keine föderierten Ausführungen. Wählen Sie oben Datenknoten aus und verteilen Sie die Studie, um zu beginnen.",
      arachneAnalysis: "Arachne-Analyse #{{id}}",
      statuses: {
        PENDING: "Ausstehend",
        EXECUTING: "Ausführen",
        COMPLETED: "Abgeschlossen",
        FAILED: "Fehlgeschlagen"
      },
      table: {
        name: "Name",
        status: "Stand",
        cdmVersion: "CDM-Version",
        patients: "Patienten",
        lastSeen: "Zuletzt gesehen",
        node: "Knoten",
        submitted: "Eingereicht",
        completed: "Abgeschlossen"
      }
    },
    artifacts: {
      sections: {
        artifacts: "Artefakte ({{count}})"
      },
      actions: {
        addArtifact: "Artefakt hinzufügen",
        cancel: "Abbrechen",
        create: "Erstellen",
        save: "Speichern",
        edit: "Artefakt bearbeiten",
        delete: "Artefakt löschen",
        openLink: "Link öffnen"
      },
      form: {
        addTitle: "Studienartefakt hinzufügen",
        title: "Titel",
        titleRequired: "Titel *",
        titlePlaceholder: "z. B. Studienprotokoll v2.1",
        version: "Version",
        type: "Art",
        urlOptional: "URL (optional)",
        description: "Beschreibung",
        descriptionOptional: "Beschreibung (optional)",
        descriptionPlaceholder: "Kurze Beschreibung dieses Artefakts..."
      },
      empty: {
        title: "Keine Artefakte",
        message: "Speichern Sie Protokolle, Analysepakete und Studiendokumente"
      },
      badges: {
        current: "Aktuell"
      },
      labels: {
        versionValue: "v{{version}}",
        sizeKb: "{{size}} KB"
      },
      messages: {
        unknown: "Unbekannt",
        uploadedBy: "{{name}} · {{date}}"
      },
      confirmDelete: "Dieses Artefakt löschen?",
      types: {
        protocol: "Protokoll",
        sap: "Statistischer Analyseplan",
        irb_submission: "IRB-Einreichung",
        cohort_json: "Kohorte JSON",
        analysis_package_r: "R-Analysepaket",
        analysis_package_python: "Python-Analysepaket",
        results_report: "Ergebnisbericht",
        manuscript_draft: "Manuskriptentwurf",
        supplementary: "Ergänzendes Material",
        presentation: "Präsentation",
        data_dictionary: "Datenwörterbuch",
        study_package_zip: "Studienpaket ZIP",
        other: "Andere"
      }
    },
    sites: {
      sections: {
        sites: "Standorte ({{count}})"
      },
      actions: {
        addSite: "Standort hinzufügen",
        cancel: "Abbrechen",
        save: "Speichern",
        edit: "Standort bearbeiten",
        remove: "Standort entfernen"
      },
      form: {
        addTitle: "Datenpartner-Standort hinzufügen",
        sourceSearchPlaceholder: "Datenquellen durchsuchen...",
        siteRole: "Standortrolle",
        irbProtocol: "IRB-Protokoll #",
        notes: "Notizen",
        optional: "Optionales Feld"
      },
      empty: {
        title: "Keine Standorte registriert",
        message: "Fügen Sie dieser Studie Datenpartnerstandorte hinzu"
      },
      table: {
        source: "Quelle",
        role: "Rolle",
        status: "Stand",
        irb: "IRB #",
        patients: "Patienten",
        cdm: "CDM"
      },
      messages: {
        allSourcesAssigned: "Alle Quellen sind bereits vergeben",
        noMatchingSources: "Keine passenden Quellen",
        sourceFallback: "Quelle #{{id}}"
      },
      confirmRemove: "Diesen Standort entfernen?",
      roles: {
        data_partner: "Datenpartner",
        coordinating_center: "Koordinierungszentrum",
        analytics_node: "Analytics-Knoten",
        observer: "Beobachter"
      },
      statuses: {
        pending: "Ausstehend",
        invited: "Eingeladen",
        approved: "Genehmigt",
        active: "Aktiv",
        completed: "Abgeschlossen",
        withdrawn: "Zurückgezogen"
      }
    },
    cohorts: {
      sections: {
        cohorts: "Kohorten ({{count}})"
      },
      actions: {
        assignCohort: "Kohorte zuweisen",
        assign: "Zuordnen",
        cancel: "Abbrechen",
        save: "Speichern",
        edit: "Kohortenzuordnung bearbeiten",
        remove: "Kohortenzuordnung entfernen"
      },
      form: {
        assignTitle: "Kohortendefinition zuweisen",
        cohortDefinition: "Kohortendefinition",
        searchPlaceholder: "Kohortendefinitionen durchsuchen...",
        role: "Rolle",
        label: "Etikett",
        labelRequired: "Etikett *",
        labelPlaceholder: "z. B. T2DM-Zielpopulation",
        description: "Beschreibung",
        optional: "Optionales Feld"
      },
      empty: {
        title: "Keine Kohorten zugeordnet",
        message: "Weisen Sie Kohortendefinitionen zu und geben Sie deren Rollen in dieser Studie an"
      },
      messages: {
        allAssigned: "Alle Kohortendefinitionen sind bereits zugewiesen",
        noMatchingCohorts: "Keine passenden Kohorten",
        cohortFallback: "Kohorte #{{id}}"
      },
      confirmRemove: "Diese Kohortenzuordnung entfernen?",
      roles: {
        target: "Ziel",
        comparator: "Komparator",
        outcome: "Ergebnis",
        exclusion: "Ausschluss",
        subgroup: "Untergruppe",
        event: "Ereignis"
      }
    },
    team: {
      sections: {
        members: "Teammitglieder ({{count}})"
      },
      actions: {
        addMember: "Mitglied hinzufügen",
        cancel: "Abbrechen",
        save: "Speichern",
        edit: "Teammitglied bearbeiten",
        remove: "Teammitglied entfernen"
      },
      form: {
        addTitle: "Teammitglied hinzufügen",
        user: "Benutzer",
        userSearchPlaceholder: "Benutzer nach Namen oder E-Mail suchen...",
        role: "Rolle"
      },
      empty: {
        title: "Keine Teammitglieder",
        message: "Fügen Sie dieser Studie Forscher und Mitarbeiter hinzu"
      },
      table: {
        name: "Name",
        email: "E-Mail",
        role: "Rolle",
        status: "Stand",
        joined: "Beigetreten"
      },
      messages: {
        allUsersAssigned: "Alle Benutzer sind bereits Teammitglieder",
        noMatchingUsers: "Keine passenden Benutzer",
        userFallback: "Benutzer #{{id}}"
      },
      confirmRemove: "Dieses Teammitglied entfernen?",
      statuses: {
        active: "Aktiv",
        inactive: "Inaktiv"
      },
      roles: {
        principal_investigator: "Hauptermittler",
        co_investigator: "Co-Ermittler",
        data_scientist: "Datenwissenschaftler",
        statistician: "Statistiker",
        site_lead: "Standortleitung",
        data_analyst: "Datenanalyst",
        research_coordinator: "Forschungskoordinator",
        irb_liaison: "IRB-Verbindung",
        project_manager: "Projektmanager",
        observer: "Beobachter"
      },
      roleDescriptions: {
        principal_investigator: "Leitender Forscher, der für die Studie verantwortlich ist",
        co_investigator: "Mitwirkender Forscher mit Studienaufsicht",
        data_scientist: "Entwickelt und betreibt analytische Pipelines",
        statistician: "Statistische Analyse und Methodik",
        site_lead: "Verwaltet den Betrieb von Datenpartnerstandorten",
        data_analyst: "Datenverarbeitung und Qualitätsprüfungen",
        research_coordinator: "Koordiniert Studienlogistik und Zeitpläne",
        irb_liaison: "Verwaltet IRB-Einreichungen und Compliance",
        project_manager: "Gesamtprojektplanung und -verfolgung",
        observer: "Lesezugriff auf Studienmaterialien"
      }
    },
    milestones: {
      sections: {
        milestones: "Meilensteine ({{count}})"
      },
      actions: {
        addMilestone: "Meilenstein hinzufügen",
        cancel: "Abbrechen",
        create: "Erstellen",
        save: "Speichern",
        edit: "Meilenstein bearbeiten",
        delete: "Meilenstein löschen"
      },
      form: {
        titlePlaceholder: "Meilensteintitel..."
      },
      empty: {
        title: "Keine Meilensteine",
        message: "Verfolgen Sie den Studienfortschritt mit Meilensteinen und Zieldaten"
      },
      labels: {
        target: "Ziel: {{date}}",
        targetCompleted: "Ziel: {{target}} | Abgeschlossen: {{completed}}"
      },
      confirmDelete: "Diesen Meilenstein löschen?",
      types: {
        protocol: "Protokoll",
        irb: "IRB",
        data_access: "Datenzugriff",
        analysis: "Analyse",
        review: "Prüfung",
        publication: "Veröffentlichung",
        custom: "Benutzerdefiniert"
      },
      statuses: {
        pending: "Ausstehend",
        in_progress: "Im Gange",
        completed: "Abgeschlossen",
        overdue: "Überfällig",
        cancelled: "Abgesagt"
      }
    },
    activity: {
      title: "Aktivitätsprotokoll",
      empty: {
        title: "Noch keine Aktivität",
        message: "Die im Rahmen dieser Studie ergriffenen Maßnahmen werden hier angezeigt"
      },
      pagination: {
        previous: "Vorherige",
        next: "Nächste",
        page: "Seite {{page}} von {{totalPages}}"
      },
      actions: {
        created: "Erstellt",
        updated: "Aktualisiert",
        deleted: "Gelöscht",
        status_changed: "Status geändert",
        member_added: "Mitglied hinzugefügt",
        member_removed: "Mitglied entfernt",
        site_added: "Standort hinzugefügt",
        analysis_added: "Analyse hinzugefügt",
        executed: "Ausgeführt"
      },
      entities: {
        study: "Studie",
        study_analysis: "Studienanalyse",
        study_artifact: "Studienartefakt",
        study_cohort: "Studienkohorte",
        study_milestone: "Studienmeilenstein",
        study_site: "Studienstandort",
        study_team_member: "Mitglied des Studienteams"
      }
    },
    designer: {
      defaultSessionTitle: "{{title}} OHDSI-Design",
      title: "OHDSI-Studiendesign-Compiler",
      subtitle: "Verwandeln Sie eine überprüfte Forschungsfrage in nachvollziehbare Konzeptsätze, Kohorten, Machbarkeitsnachweise, HADES-fähige Analysepläne und ein verschlossenes Studienpaket.",
      researchQuestionPlaceholder: "Bei Erwachsenen mit..., senkt..., verglichen mit..., ...",
      badges: {
        session: "Sitzung {{value}}",
        version: "Version Nr. {{value}}"
      },
      versionStatuses: {
        generated: "Generiert",
        review_ready: "Prüfbereit",
        accepted: "Akzeptiert",
        locked: "Gesperrt"
      },
      metrics: {
        assets: "Ressourcen"
      },
      actions: {
        downloadLockedPackage: "Gesperrtes Paket herunterladen",
        downloadPackage: "Paket herunterladen",
        add: "Hinzufügen",
        saveChanges: "Änderungen speichern"
      },
      sections: {
        verificationGates: "Prüfpunkte",
        packageProvenance: "Herkunft des Pakets",
        assetEvidence: "Asset-Evidenz",
        basicInformation: "Grundlegende Informationen",
        addAnalysis: "Analyse hinzufügen",
        studyAnalyses: "Studienanalysen ({{count}})"
      },
      descriptions: {
        verificationGates: "Lösen Sie Blocker auf, bevor Sie das OHDSI-Paket sperren.",
        assetEvidence: "Überprüfen Sie die Ausgabe des blockierten Verifizierers, bevor Sie ein Paket annehmen."
      },
      gates: {
        designIntent: "Designabsicht",
        acceptedAt: "Akzeptiert {{time}}",
        acceptResearchQuestion: "Akzeptieren Sie die überprüfte Forschungsfrage.",
        verifiedMaterializedCohorts: "{{count}} verifizierte materialisierte Kohorte",
        feasibilityReady: "Verifizierte Machbarkeitsnachweise liegen vor.",
        runFeasibility: "Führen Sie die Machbarkeit durch, nachdem die Kohorten überprüft haben.",
        analysisPlan: "Analyseplan",
        analysisPlanReady: "Der verifizierte HADES-Analyseplan ist fertig.",
        verifyAnalysisPlan: "Einen Analyseplan prüfen und materialisieren."
      },
      labels: {
        version: "Version",
        versionStatus: "v{{version}} - {{status}}",
        verifiedAssets: "Verifizierte Assets",
        title: "Titel",
        description: "Beschreibung",
        studyType: "Studientyp",
        analysisType: "Analysetyp",
        analysis: "Analyse",
        missingOmopIds: "Fehlende OMOP-IDs",
        deprecatedOmopIds: "Veraltete OMOP-IDs",
        invalidDraftIds: "Ungültige Entwurfs-IDs"
      },
      placeholders: {
        studyTitle: "Studientitel",
        optionalDescription: "Optionale Beschreibung",
        selectAnalysis: "Analyse auswählen..."
      },
      analysisTypes: {
        characterization: "Charakterisierung",
        "incidence-rate": "Inzidenzrate",
        pathway: "Weg",
        estimation: "Schätzung",
        prediction: "Vorhersage"
      },
      messages: {
        new: "neu",
        none: "keiner",
        notStarted: "nicht gestartet",
        createOrImport: "Erstellen oder importieren Sie zunächst ein Design.",
        needsEvidence: "Evidenz erforderlich",
        noVersion: "Keine Version",
        blockedCount: "{{count}} blockiert",
        noBlockers: "Keine Blocker",
        startEvidenceReview: "Generieren Sie eine Absicht oder importieren Sie die aktuelle Studie, um mit der Beweisüberprüfung zu beginnen.",
        noAnalyses: "Noch keine Analysen hinzugefügt.",
        analysisFallback: "Analyse #{{id}}",
        assetId: "Asset #{{id}}",
        materializedId: "materialisiert #{{id}}",
        verifiedAt: "verifiziert {{time}}"
      }
    },
    workbench: {
      sessionTitle: "Design der Studienabsicht",
      title: "Studiendesign-Compiler",
      subtitle: "Wandeln Sie eine Forschungsfrage in eine geprüfte, OHDSI-konforme Studienabsicht um und prüfen Sie wiederverwendbare Phänotyp-Assets, bevor etwas weitergegeben wird.",
      newSession: "Neue Sitzung",
      sessions: "Sitzungen",
      researchQuestion: "Forschungsfrage",
      researchQuestionPlaceholder: "Vergleichen Sie rezidivierendes MACE bei Patienten nach MI, die mit Clopidogrel beginnen, mit Aspirin.",
      emptyQuestionPlaceholder: "Beschreiben Sie die Studienfrage...",
      generateIntent: "Absicht generieren",
      startSession: "Starten Sie eine Designsitzung und generieren Sie dann aus der Studienfrage eine strukturierte PICO-Absicht.",
      createAndGenerate: "Sitzung erstellen und Absicht generieren",
      loadingSessions: "Designsitzungen werden geladen...",
      sections: {
        phenotypeRecommendations: "Phänotyp- und Wiederverwendungsempfehlungen",
        conceptSetDrafts: "Konzept-Set-Entwürfe",
        cohortDrafts: "Kohortenentwürfe",
        cohortReadiness: "Bereitschaft der Studienkohorte",
        feasibility: "Durchführbarkeit",
        sources: "Quellen",
        attrition: "Ausfall",
        analysisPlans: "Analysepläne",
        packageLock: "Paketsperre",
        currentAssets: "Aktuelle Studienressourcen",
        intentReview: "Absichtsüberprüfung",
        source: "Quelle",
        governance: "Governance"
      },
      descriptions: {
        recommendations: "Überprüfen Sie wiederverwendbare Phänotypbibliothekseinträge, lokale Kohorten und lokale Konzeptsätze, bevor Sie etwas Neues entwerfen.",
        conceptSets: "Konvertieren Sie akzeptierte Beweise in wortschatzgeprüfte Entwürfe, bevor Sie native Konzeptsätze erstellen.",
        cohorts: "Verwandeln Sie materialisierte Konzeptsätze in native Kohortendefinitionsentwürfe.",
        feasibility: "Überprüfen Sie verknüpfte Kohorten vor der Analyseplanung mit ausgewählten CDM-Quellen.",
        analysisPlans: "Stellen Sie machbare Studienkohorten in nativen HADES-kompatiblen Analysedesigns zusammen.",
        packageLock: "Fixieren Sie akzeptierte Absichten, Konzeptsätze, Kohorten, Machbarkeits- und native Analysen in einem überprüfbaren Studienpaket.",
        currentAssets: "Integrieren Sie manuell erstellte Kohorten und Analysen in diesen Entwurfspfad und überprüfen Sie dann Lücken, ohne vorhandene Datensätze zu ändern."
      },
      actions: {
        recommend: "Empfehlen",
        draftConceptSets: "Konzeptsets entwerfen",
        draftCohorts: "Kohorten entwerfen",
        runFeasibility: "Machbarkeit prüfen",
        draftPlans: "Pläne entwerfen",
        importCurrent: "Aktuellen Stand importieren",
        critique: "Kritik",
        verify: "Verifizieren",
        review: "Prüfung",
        accept: "Akzeptieren",
        defer: "Verschieben",
        reject: "Ablehnen",
        materialize: "Materialisieren",
        openNativeEditor: "Nativen Editor öffnen",
        linkToStudy: "Mit Studie verknüpfen",
        search: "Suchen",
        add: "Hinzufügen",
        remove: "Entfernen",
        saveReview: "Bewertung speichern",
        acceptIntent: "Absicht akzeptieren",
        lockPackage: "Paket sperren",
        locked: "Gesperrt",
        downloadPackageSummary: "Paketzusammenfassung herunterladen"
      },
      labels: {
        verified: "Verifiziert",
        needsCheck: "Muss überprüft werden",
        blocked: "Blockiert",
        unverified: "Nicht bestätigt",
        reviewQueue: "Überprüfungswarteschlange",
        conceptSetDraft: "Konzeptentwurf",
        cohortDraft: "Kohortenentwurf",
        concepts: "Konzepte",
        concept: "Konzept",
        domain: "Domäne",
        vocabulary: "Vokabular",
        flags: "Kennzeichen",
        actions: "Aktionen",
        lint: "Lint-Prüfung",
        source: "Quelle",
        status: "Stand",
        cohorts: "Kohorten",
        coverage: "Abdeckung",
        domains: "Domänen",
        freshness: "Aktualität",
        dqd: "DQD",
        attrition: "Ausfall",
        nativeConceptSet: "Natives Konzeptset #{{id}}",
        nativeCohort: "Native Kohorte #{{id}}",
        linkedStudyCohort: "Verknüpfte Studienkohorte #{{id}}",
        conceptsCount: "{{count}}-Konzepte",
        conceptSetsCount: "{{count}}-Konzeptsätze",
        nativeAnalysis: "Native Analyse #{{id}}",
        feasibility: "Durchführbarkeit",
        rank: "Rang {{score}}",
        match: "{{score}}% Übereinstimmung",
        ohdsiId: "OHDSI #{{id}}",
        computable: "Berechenbar",
        imported: "Importiert",
        evidence: "Evidenz",
        origin: "Herkunft",
        matchedTerm: "Passender Begriff",
        canonicalRecord: "Kanonischer Datensatz",
        noCanonicalRecord: "Kein kanonischer Datensatz",
        eligibility: "Teilnahmeberechtigung",
        acceptable: "Akzeptabel",
        blockedOrNeedsReview: "Blockiert oder muss überprüft werden",
        policy: "Richtlinie",
        nextActions: "Nächste Aktionen",
        rankComponents: "Rangkomponenten",
        verifierChecks: "Prüfkontrollen",
        versionStatus: "Version {{version}} · {{status}}",
        primaryObjective: "Hauptziel",
        population: "Population",
        exposure: "Exposition",
        comparator: "Komparator",
        primaryOutcome: "Primärer Endpunkt",
        timeAtRisk: "Risikozeit",
        conceptSetsMetric: "Konzeptsätze",
        cohortsMetric: "Kohorten",
        analysesMetric: "Analysen",
        packagesMetric: "Pakete",
        aiEvents: "KI-Ereignisse",
        reviewed: "Bewertet",
        manifest: "Manifestdatei",
        critiques: "Kritiken"
      },
      messages: {
        saveOrAcceptBeforeRecommendations: "Speichern Sie eine zur Überprüfung bereitstehende Absicht oder akzeptieren Sie die Absicht, bevor Sie Empfehlungen anfordern.",
        loadingRecommendations: "Empfehlungen werden geladen...",
        noRecommendations: "Noch keine Empfehlungen.",
        acceptRecommendationFirst: "Akzeptieren Sie zunächst mindestens eine verifizierte Phänotyp-, Kohorten- oder Konzeptsatzempfehlung.",
        noConceptSetDrafts: "Noch keine Konzept-Set-Entwürfe.",
        onlyVerifiedConceptSetDrafts: "Es können nur verifizierte Konzeptsatzentwürfe akzeptiert werden.",
        searchConceptsPlaceholder: "Durchsuchen Sie OMOP-Vokabularkonzepte",
        materializeConceptSetFirst: "Materialisieren Sie zuerst mindestens einen verifizierten Konzeptsatzentwurf.",
        noCohortDrafts: "Noch keine Kohortenentwürfe.",
        checkingLinkedRoles: "Verknüpfte Rollen werden überprüft...",
        noReadinessSignal: "Noch kein Bereitschaftssignal.",
        ready: "Bereit",
        blocked: "Blockiert",
        drafts: "{{count}}-Entwürfe",
        materialized: "{{count}} materialisiert",
        linked: "{{count}} verknüpft",
        linkRequiredCohorts: "Verknüpfen Sie die erforderlichen Studienkohorten, bevor Sie die Quelle für die Machbarkeit prüfen.",
        loadingSources: "Quellen werden geladen...",
        noSources: "Keine CDM-Quellen konfiguriert.",
        smallCellThreshold: "Schwelle für kleine Zellen",
        sourcesReady: "{{ready}}/{{total}}-Quellen bereit",
        ranAt: "Ausgeführt {{time}}",
        noDates: "Keine Termine",
        none: "keiner",
        roles: "{{ready}}/{{total}}-Rollen",
        unknown: "Unbekannt",
        noDqd: "Kein DQD",
        passRate: "{{rate}}% bestanden",
        noFeasibilityEvidence: "Für diese Entwurfsvariante sind keine Machbarkeitsnachweise hinterlegt.",
        runFeasibilityBeforePlans: "Führen Sie eine Machbarkeitsanalyse durch, bevor Sie Analysepläne entwerfen.",
        noAnalysisPlans: "Noch keine Analysepläne.",
        feasibilityStatus: "Machbarkeit: {{status}}",
        checkingPackageReadiness: "Paketbereitschaft prüfen...",
        readyToLock: "Bereit zum Sperren.",
        lockedPackageAvailable: "Das gesperrte Paket ist in Studienartefakten verfügbar.",
        signed: "unterzeichnet",
        pending: "ausstehend",
        onlyVerifiedRecommendations: "Es können nur deterministisch verifizierte Empfehlungen akzeptiert werden."
      }
    }
  },
  covariates: {
    title: "Kovariaten-Einstellungen",
    description:
      "Wählen Sie aus, welche Domänen als Kovariaten für FeatureExtraction einbezogen werden.",
    groups: {
      core: "Kerndomänen",
      extended: "Erweiterte Domänen",
      indices: "Komorbiditätsindizes",
    },
    labels: {
      demographics: "Demografie",
      conditionOccurrence: "Diagnosevorkommen",
      drugExposure: "Arzneimittelexposition",
      procedureOccurrence: "Prozedurvorkommen",
      measurement: "Messung",
      observation: "Beobachtung",
      deviceExposure: "Medizinprodukte-Exposition",
      visitCount: "Besuchsanzahl",
      charlsonComorbidity: "Charlson-Komorbidität",
      dcsi: "DCSI (Diabetesindex)",
      chads2: "CHADS2",
      chads2Vasc: "CHA2DS2-VASc",
    },
    timeWindows: "Zeitfenster",
    to: "bis",
    days: "Tage",
    addTimeWindow: "Zeitfenster hinzufügen",
  },
  jobs: {
    page: {
      title: "Aufträge",
      subtitle: "Hintergrundjobs und Warteschlangenstatus überwachen",
      empty: {
        title: "Keine Jobs gefunden",
        archived: "Keine archivierten Jobs älter als 24 Stunden.",
        filtered:
          "Keine Jobs mit Status {{status}}. Versuchen Sie einen anderen Filter.",
        recent:
          "Keine Jobs in den letzten 24 Stunden. Prüfen Sie das Archiv auf ältere Jobs.",
      },
      table: {
        job: "Auftrag",
        type: "Typ",
        source: "Quelle",
        started: "Gestartet",
        duration: "Dauer",
        status: "Zustand",
        actions: "Aktionen",
      },
      pagination: "Seite {{current}} von {{last}} · {{total}} Jobs",
    },
    filters: {
      statuses: {
        all: "Alle (24 h)",
        pending: "Ausstehend",
        queued: "In Warteschlange",
        running: "Läuft",
        completed: "Abgeschlossen",
        failed: "Fehlgeschlagen",
        cancelled: "Abgebrochen",
        archived: "Archiviert",
      },
      types: {
        all: "Alle Typen",
        analysis: "Analyse",
        characterization: "Charakterisierung",
        incidenceRate: "Inzidenzrate",
        estimation: "Schätzung",
        prediction: "Prädiktion",
        pathway: "Pfad",
        sccs: "SCCS",
        evidenceSynthesis: "Evidenzsynthese",
        cohortGeneration: "Kohortengenerierung",
        careGaps: "Versorgungslücken",
        achilles: "Achilles",
        dataQuality: "Datenqualität",
        heelChecks: "Heel-Prüfungen",
        ingestion: "Aufnahme",
        vocabulary: "Vokabular",
        genomicParse: "Genomische Analyse",
        poseidon: "Poseidon-ETL",
        fhirExport: "FHIR-Export",
        fhirSync: "FHIR-Synchronisierung",
        gisImport: "GIS-Import",
        gisBoundaries: "GIS-Grenzen",
      },
    },
    actions: {
      retry: "Erneut versuchen",
      retryJob: "Job erneut versuchen",
      cancel: "Abbrechen",
      cancelJob: "Job abbrechen",
      previous: "Zurück",
      next: "Weiter",
    },
    drawer: {
      titleFallback: "Jobdetails",
      loadError: "Jobdetails konnten nicht geladen werden.",
      sections: {
        executionLog: "Ausführungsprotokoll",
        analysis: "Analyse",
        cohort: "Kohorte",
        ingestionPipeline: "Aufnahmepipeline",
        fhirSync: "FHIR-Synchronisierung",
        dataQuality: "Datenqualität",
        heelChecks: "Heel-Prüfungen",
        achillesAnalyses: "Achilles-Analysen",
        genomicParse: "Genomische Analyse",
        poseidonEtl: "Poseidon-ETL",
        careGapEvaluation: "Bewertung von Versorgungslücken",
        gisBoundaries: "GIS-Grenzen",
        gisImport: "GIS-Import",
        vocabularyImport: "Vokabularimport",
        fhirExport: "FHIR-Export",
        overview: "Übersicht",
        output: "Ausgabe",
      },
      labels: {
        analysis: "Analyse",
        createdBy: "Erstellt von",
        parameters: "Parameter",
        cohort: "Kohorte",
        personCount: "Personenzahl",
        source: "Quelle",
        sourceKey: "Quellschlüssel",
        stage: "Phase",
        project: "Projekt",
        file: "Datei",
        fileSize: "Dateigröße",
        mappingCoverage: "Mapping-Abdeckung",
        processed: "Verarbeitet",
        failed: "Fehlgeschlagen",
        filesDownloaded: "Heruntergeladene Dateien",
        recordsExtracted: "Extrahierte Datensätze",
        recordsMapped: "Gemappte Datensätze",
        recordsWritten: "Geschriebene Datensätze",
        recordsFailed: "Fehlgeschlagene Datensätze",
        passed: "Bestanden",
        passRate: "Bestehensrate",
        expectedChecks: "Erwartete Prüfungen",
        executionTime: "Ausführungszeit",
        failingChecks: "Fehlgeschlagene Prüfungen",
        totalRules: "Regeln gesamt",
        rulesTriggered: "Ausgelöste Regeln",
        totalViolations: "Verstöße gesamt",
        topViolations: "Häufigste Verstöße",
        completed: "Abgeschlossen",
        byCategory: "Nach Kategorie",
        failedSteps: "Fehlgeschlagene Schritte",
        format: "Dateiformat",
        totalVariants: "Varianten gesamt",
        mappedVariants: "Gemappte Varianten",
        samples: "Proben",
        runType: "Ausführungstyp",
        dagsterRunId: "Dagster-Ausführungs-ID",
        stats: "Statistiken",
        bundle: "Paket",
        complianceSummary: "Compliance-Zusammenfassung",
        dataset: "Datensatz",
        dataType: "Datentyp",
        version: "Datenversion",
        geometry: "Geometrie",
        features: "Merkmale",
        tablesLoaded: "Geladene Tabellen",
        recordsLoaded: "Geladene Datensätze",
        outputFormat: "Ausgabeformat",
        type: "Typ",
        triggeredBy: "Ausgelöst von",
        duration: "Dauer",
        started: "Gestartet",
        created: "Erstellt",
        error: "Fehler",
      },
      messages: {
        stalled:
          "Dieser Job ist stehen geblieben und wurde nach Überschreiten des 1-Stunden-Zeitlimits als fehlgeschlagen markiert.",
        failedCount: "{{count}} fehlgeschlagen",
        runningCount: "{{count}} laufen",
        ofTotal: "von {{count}}",
        records: "{{count}} Datensätze",
      },
    },
  },
  vocabulary: {
    mappingAssistant: {
      title: "Konzept-Mapping-Assistent",
      poweredBy: "Bereitgestellt von Ariadne",
      subtitle:
        "Quellbegriffe OMOP-Standardkonzepten mit wörtlichem, Vektor- und LLM-Matching zuordnen",
      filters: {
        selectedCount: "{{count}} ausgewählt",
        clearSelection: "Auswahl löschen",
        targetVocabulary: "Zielvokabular:",
        allVocabularies: "Alle Vokabulare",
        targetDomain: "Zieldomäne:",
        allDomains: "Alle Domänen",
      },
      drawer: {
        disambiguate: "Disambiguieren",
        candidateCount: "{{count}} Kandidaten - wählen Sie das richtige Mapping",
        noCandidates: "Keine Kandidaten gefunden. Bereinigen Sie den Begriff unten.",
        cleanRemap: "Bereinigen und erneut mappen",
        editPlaceholder: "Begriff bearbeiten und erneut mappen...",
      },
      actions: {
        clean: "Bereinigen",
        remap: "Erneut mappen",
        acceptMapping: "Mapping akzeptieren",
        rejectMapping: "Mapping ablehnen",
        disambiguateTitle: "Disambiguieren - alle Kandidaten anzeigen",
        uploadCsv: "CSV hochladen",
        loadProject: "Projekt laden",
        mapping: "Wird gemappt...",
        mapTerms: "Begriffe mappen",
        clearResults: "Ergebnisse löschen",
        acceptAllThreshold: "Alle >= 90 % akzeptieren",
        saveToVocabulary: "Im Vokabular speichern",
        saveProject: "Projekt speichern",
        exportCsv: "CSV exportieren",
      },
      toasts: {
        remapped: "\"{{source}}\" erneut auf {{concept}} gemappt",
        noMatchForCleaned: "Keine Übereinstimmung für bereinigten Begriff \"{{term}}\" gefunden",
        remapFailed: "Erneutes Mapping fehlgeschlagen",
        autoAccepted: "{{count}} Mappings mit hoher Konfidenz automatisch akzeptiert",
        savedMappings: "{{count}} Mappings in source_to_concept_map gespeichert",
        saveMappingsFailed: "Mappings konnten nicht gespeichert werden",
        projectSaved: "Projekt gespeichert: {{name}}",
        saveProjectFailed: "Projekt konnte nicht gespeichert werden",
        projectLoaded: "Projekt geladen: {{name}}",
        loadProjectFailed: "Projekt konnte nicht geladen werden",
      },
      errors: {
        cleanupFailed: "Bereinigung fehlgeschlagen.",
        mappingFailed:
          "Mapping fehlgeschlagen. Prüfen Sie, ob der Ariadne-Dienst läuft und erreichbar ist.",
      },
      results: {
        candidateCount: "{{count}} Kandidaten",
        overridden: "(überschrieben)",
        noMatchFound: "Keine Übereinstimmung gefunden",
        selectOverride: "Wählen Sie einen Kandidaten, um das Mapping zu überschreiben",
        noAdditionalCandidates: "Keine weiteren Kandidaten.",
      },
      labels: {
        noValue: "-",
        separator: "-",
      },
      input: {
        termsMapped: "{{count}} Begriffe gemappt",
        editTerms: "Begriffe bearbeiten",
        sourceTerms: "Quellbegriffe",
        termsPlaceholder:
          "Quellbegriffe eingeben, einen pro Zeile...\n\nDiabetes mellitus Typ 2\nakuter Myokardinfarkt\nHypertonie\nASS 81 mg",
        termsEntered: "{{count}} Begriffe eingegeben",
      },
      projects: {
        loading: "Projekte werden geladen...",
        loadFailed: "Projekte konnten nicht geladen werden",
        empty: "Keine gespeicherten Projekte",
        projectMeta: "{{count}} Begriffe -- {{date}}",
        namePlaceholder: "Projektname...",
      },
      vocabularies: {
        SNOMED: "SNOMED CT",
        ICD10CM: "ICD-10-CM",
        RxNorm: "RxNorm",
        LOINC: "LOINC",
        ICD9CM: "ICD-9-CM",
        CPT4: "CPT-4",
        HCPCS: "HCPCS",
        MedDRA: "MedDRA",
      },
      domains: {
        Condition: "Erkrankung",
        Drug: "Arzneimittel",
        Procedure: "Prozedur",
        Measurement: "Messung",
        Observation: "Beobachtung",
        Device: "Medizinprodukt",
      },
      progress: {
        mappingTerms: "{{count}} Begriffe werden gemappt...",
      },
      metrics: {
        termsMapped: "Begriffe gemappt",
        highConfidence: "Hohe Konfidenz",
        needReview: "Prüfung nötig",
        noMatch: "Keine Übereinstimmung",
      },
      table: {
        sourceTerm: "Quellbegriff",
        bestMatch: "Beste Übereinstimmung",
        confidence: "Konfidenz",
        matchType: "Übereinstimmungstyp",
        vocabulary: "Vokabular",
        actions: "Aktionen",
      },
      summary: {
        mapped: "{{count}} gemappt",
        high: "{{count}} hoch",
        review: "{{count}} prüfen",
        noMatch: "{{count}} ohne Treffer",
        accepted: "{{count}} akzeptiert",
      },
    },
    conceptDetail: {
      tabs: {
        info: "Information",
        relationships: "Beziehungen",
        mapsFrom: "Zugeordnet aus",
        hierarchy: "Hierarchie",
      },
      empty: {
        title: "Wählen Sie ein Konzept aus, um Details anzuzeigen",
        subtitle: "Suchen Sie im linken Bereich nach einem Konzept und klicken Sie darauf",
        noAncestors: "Keine Vorfahren gefunden",
        noRelationships: "Keine Beziehungen gefunden",
        noSourceCodes: "Keine Quellcodes sind diesem Konzept zugeordnet",
      },
      errors: {
        failedLoad: "Konzept konnte nicht geladen werden",
      },
      toasts: {
        conceptIdCopied: "Konzept-ID kopiert",
      },
      actions: {
        copyConceptId: "Konzept-ID kopieren",
        addToSet: "Zum Set hinzufügen",
      },
      values: {
        standard: "Standardkonzept",
        classification: "Klassifikation",
        nonStandard: "Nichtstandard",
        valid: "Gültig",
      },
      sections: {
        basicInformation: "Basisinformationen",
        synonyms: "Synonyme",
        ancestors: "Vorfahren",
        relationships: "Beziehungen",
        mapsFrom: "Quellcodes, die diesem Konzept zugeordnet sind",
        mapsFromDescription:
          "Quellvokabularcodes (ICD-10, SNOMED, RxNorm usw.), die diesem Standardkonzept zugeordnet sind",
        hierarchy: "Konzepthierarchie",
      },
      fields: {
        conceptCode: "Konzeptcode",
        domain: "Domäne",
        vocabulary: "Vokabular",
        conceptClass: "Konzeptklasse",
        standardConcept: "Standardkonzept",
        invalidReason: "Ungültigkeitsgrund",
        validStartDate: "Gültig ab",
        validEndDate: "Gültig bis",
      },
      table: {
        id: "Kennung",
        name: "Bezeichnung",
        domain: "Domäne",
        vocabulary: "Vokabular",
        relationship: "Beziehung",
        relatedId: "Verknüpfte ID",
        relatedName: "Verknüpfter Name",
        code: "Code",
        class: "Klasse",
      },
      pagination: {
        showingRange: "{{start}}-{{end}} von {{total}} werden angezeigt",
        showingSourceCodes: "{{shown}} von {{total}} Quellcodes werden angezeigt",
      },
    },
    semanticSearch: {
      hecate: "Hecate",
      poweredBy: "Bereitgestellt von Hecate",
      tagline: "vektorbasierte Konzeptsuche",
      placeholder: "Klinischen Begriff für die semantische Suche eingeben...",
      filters: {
        allDomains: "Alle Domänen",
        allVocabularies: "Alle Vokabulare",
        standard: {
          all: "Alle",
          standard: "S",
          classification: "C",
        },
      },
      badges: {
        standard: "Standardkonzept",
        classification: "Klassifikation",
      },
      values: {
        inSet: "Im Set",
        standardAbbrev: "S",
      },
      actions: {
        addToSet: "Zum Set hinzufügen",
        clearFilters: "Filter löschen",
        retry: "Erneut versuchen",
        tryClearingFilters: "Versuchen Sie, die Filter zu löschen",
      },
      errors: {
        unavailable: "Semantische Suche ist nicht verfügbar.",
        serviceHelp:
          "Stellen Sie sicher, dass der Hecate-KI-Dienst läuft und ChromaDB initialisiert ist.",
      },
      empty: {
        prompt: "Geben Sie einen klinischen Begriff für die semantische Suche ein",
        help:
          "Hecate nutzt Vektor-Embeddings, um konzeptuell ähnliche OMOP-Konzepte zu finden, auch wenn exakte Schlüsselworttreffer fehlen.",
        noResults: "Keine semantischen Treffer für \"{{query}}\" gefunden",
      },
      results: {
        matchCountOne: "{{count}} semantischer Treffer",
        matchCountMany: "{{count}} semantische Treffer",
        updating: "Aktualisierung...",
      },
    },
    searchPanel: {
      placeholder: "Konzepte suchen...",
      filters: {
        toggle: "Filter",
        standardOnly: "Nur Standardkonzepte",
        allDomains: "Alle Domänen",
        allVocabularies: "Alle Vokabulare",
        allConceptClasses: "Alle Konzeptklassen",
        countSuffix: " ({{count}})",
      },
      actions: {
        clearAllFilters: "Alle Filter löschen",
        tryClearingFilters: "Versuchen Sie, die Filter zu löschen",
        loading: "Wird geladen...",
        loadMoreResults: "Weitere Ergebnisse laden",
      },
      empty: {
        prompt: "OMOP-Vokabular durchsuchen",
        help: "Geben Sie mindestens 2 Zeichen ein, um Konzepte nach Name, Code oder ID zu suchen",
        noResults: "Keine Konzepte für \"{{query}}\" gefunden",
      },
      results: {
        showingCount: "{{shown}} von {{total}} Ergebnissen werden angezeigt",
      },
      engine: {
        solr: "Solr",
        pg: "PG",
      },
      values: {
        inSet: "Im Set",
      },
    },
    conceptComparison: {
      title: "Konzepte vergleichen",
      subtitle:
        "Nebeneinander-Vergleich von 2 bis 4 OMOP-Konzepten mit Attributen, Vorfahren und Beziehungen",
      search: {
        placeholder: "Konzept zum Hinzufügen suchen...",
      },
      sections: {
        ancestors: "Vorfahren (2 Ebenen)",
        relationships: "Beziehungen",
      },
      fields: {
        conceptCode: "Konzeptcode",
        domain: "Domäne",
        vocabulary: "Vokabular",
        conceptClass: "Konzeptklasse",
        standard: "Standardstatus",
        validStart: "Gültig ab",
        validEnd: "Gültig bis",
        invalidReason: "Ungültigkeitsgrund",
      },
      actions: {
        addConcept: "Konzept hinzufügen",
      },
      empty: {
        prompt: "Suchen Sie nach Konzepten zum Vergleichen",
        help:
          "Wählen Sie 2 bis 4 Konzepte aus, um Attribute, Vorfahren und Beziehungen nebeneinander zu vergleichen",
      },
      values: {
        standard: "Standardkonzept",
        classification: "Klassifikation",
        nonStandard: "Nichtstandard",
        valid: "Gültig",
        level: "E{{level}}",
        selected: "Ausgewählt:",
        addOneMore: "Fügen Sie mindestens ein weiteres Konzept zum Vergleich hinzu",
      },
    },
    addToConceptSet: {
      title: "Zum Konzeptset hinzufügen",
      create: {
        title: "Neues Konzeptset erstellen",
        help: "Konzept hinzufügen und im Builder öffnen",
        nameLabel: "Name des neuen Konzeptsets",
      },
      actions: {
        create: "Erstellen",
        cancel: "Abbrechen",
        openBuilderWithSearch: "Builder mit aktueller Suche öffnen",
      },
      divider: "oder zu vorhandenem hinzufügen",
      filter: {
        placeholder: "Konzeptsets filtern...",
      },
      empty: {
        noMatching: "Keine passenden Konzeptsets",
        noSets: "Keine Konzeptsets gefunden",
      },
      footer: {
        includeDescendants: "Wird mit Nachfahren einbeziehen hinzugefügt",
      },
      toasts: {
        addedToSet: "Zu \"{{setName}}\" hinzugefügt",
        addFailed: "Konzept konnte nicht zum Set hinzugefügt werden",
        missingSetId: "Neue Konzeptset-ID konnte nicht abgerufen werden",
        createdAndAdded: "\"{{name}}\" erstellt und Konzept hinzugefügt",
        createdAddFailed: "Set erstellt, aber Konzept konnte nicht hinzugefügt werden",
        createFailed: "Konzeptset konnte nicht erstellt werden",
      },
    },
    page: {
      title: "Vokabularbrowser",
      subtitle: "Das standardisierte OMOP-Vokabular suchen, erkunden und navigieren",
      tabs: {
        keyword: "Schlüsselwortsuche",
        semantic: "Semantische Suche",
        browse: "Hierarchie durchsuchen",
      },
    },
    hierarchyBrowser: {
      breadcrumb: {
        allDomains: "Alle Domänen",
      },
      filters: {
        allSources: "Alle Quellen",
        itemPlaceholder: "{{count}} Elemente filtern...",
      },
      actions: {
        showAllConcepts: "Alle Konzepte anzeigen",
        showGroupings: "Gruppierungen anzeigen",
        clearFilter: "Filter löschen",
        viewDetailsFor: "Details zu {{conceptName}} anzeigen",
        viewConceptDetails: "Konzeptdetails anzeigen",
      },
      empty: {
        noMatchingConcepts: "Keine passenden Konzepte",
        noConcepts: "Keine Konzepte gefunden",
      },
      counts: {
        clinicalGroupings: "{{count}} klinische Gruppierungen",
        concepts: "{{count}} Konzepte",
        items: "{{count}} Elemente",
        filteredItems: "{{shown}} von {{total}} Elementen",
        namedSubCategories: "{{name}} - {{count}} Unterkategorien",
        subCategories: "{{count}} Unterkategorien",
        subcategories: "{{count}} Unterkategorien",
        oneAnchor: "1 Anker",
        persons: "{{count}} Personen",
        records: "{{count}} Datensätze",
        groupingCoversSubcategories:
          "{{groupingName}} deckt {{count}} Unterkategorien ab",
      },
    },
    hierarchyTree: {
      empty: {
        noData: "Keine Hierarchiedaten verfügbar",
      },
    },
  },
  dataExplorer: {
    page: {
      title: "Daten-Explorer",
      subtitle: "Achilles-Charakterisierungsergebnisse und Datenqualität erkunden",
      selectSourceTitle: "Datenquelle auswählen",
      selectSourceMessage:
        "Wählen Sie oben in der Dropdownliste eine CDM-Quelle aus, um ihre Daten zu erkunden",
    },
    tabs: {
      overview: "Übersicht",
      domains: "Domänen",
      temporal: "Zeitlich",
      heel: "Achilles",
      dqd: "Datenqualität",
      ares: "Ares",
    },
    sourceSelector: {
      loading: "Quellen werden geladen...",
      placeholder: "Datenquelle auswählen",
    },
    domains: {
      condition: "Erkrankungen",
      drug: "Arzneimittel",
      procedure: "Prozeduren",
      measurement: "Messungen",
      observation: "Beobachtungen",
      visit: "Besuche",
    },
    overview: {
      metrics: {
        persons: "Personen",
        personsTotal: "{{value}} gesamt",
        medianObsDuration: "Median der Beobachtungsdauer",
        durationDays: "{{value}} Tage",
        observationPeriods: "{{value}} Beobachtungsperioden",
        totalEvents: "Ereignisse gesamt",
        acrossAllCdmTables: "Über alle CDM-Tabellen",
        dataCompleteness: "Datenvollständigkeit",
        tablesPopulated: "{{populated}}/{{total}} Tabellen befüllt",
      },
      sections: {
        demographics: "Populationsdemografie",
        observationPeriods: "Analyse der Beobachtungsperioden",
        domainRecordProportions: "Datensatzanteile nach Domäne",
        dataDensityOverTime: "Datendichte über die Zeit",
        recordDistribution: "Datensatzverteilung",
      },
      cards: {
        genderDistribution: "Geschlechterverteilung",
        ethnicity: "Ethnizität",
        race: "Ethnie",
        topTen: "Top 10",
        yearOfBirthDistribution: "Verteilung des Geburtsjahrs",
        yearOfBirthSubtitle: "Histogramm mit geglätteter Dichte (gold)",
        cumulativeObservationDuration: "Kumulative Beobachtungsdauer",
        cumulativeObservationSubtitle:
          "Kaplan-Meier-Stil: % der Personen mit Beobachtung >= X Tage",
        observationStartEndDates: "Beobachtungs-Start-/Enddaten",
        observationStartEndSubtitle:
          "Zeitliche Verteilung der Beobachtungsperioden",
        observationPeriodDurationDays: "Dauer der Beobachtungsperiode (Tage)",
        observationPeriodsPerPerson: "Beobachtungsperioden pro Person",
        observationPeriodsPerPersonSubtitle:
          "Verteilung, wie viele Perioden jede Person hat",
        clinicalDataDomains: "Klinische Datendomänen",
        clinicalDataDomainsSubtitle:
          "Nach Datensatzanzahl sortiert - klicken Sie auf eine Domäne, um ihre Konzepte zu erkunden",
        recordsByDomainAndYear: "Datensätze nach Domäne und Jahr",
        recordsByDomainAndYearSubtitle:
          "Die Farbintensität zeigt das Datensatzvolumen je Domäne und Jahr",
        cdmTableRecordCounts: "Datensatzanzahlen der CDM-Tabellen",
        cdmTableRecordCountsSubtitle:
          "Logarithmische Skala - alle Tabellen bleiben unabhängig von der Größenordnung sichtbar",
      },
      messages: {
        runAchillesForTemporalData:
          "Führen Sie Achilles aus, um zeitliche Trenddaten zu erzeugen",
      },
    },
    charts: {
      common: {
        records: "{{count}} Datensätze",
        persons: "{{count}} Personen",
        total: "Gesamt",
        separator: "·",
      },
      boxPlot: {
        noDistributionData: "Keine Verteilungsdaten",
        ariaLabel: "Boxplot",
        labels: {
          p25: "P25: {{value}}",
          median: "Median: {{value}}",
          p75: "P75: {{value}}",
        },
      },
      cumulativeObservation: {
        tooltipValue: "{{days}} Tage - {{pct}} % der Personen",
        xAxisLabel: "Beobachtungsdauer (Tage)",
        labels: {
          min: "Min.",
          p10: "P10",
          p25: "P25",
          median: "Median",
          p75: "P75",
          p90: "P90",
          max: "Max.",
        },
      },
      demographics: {
        ageDistribution: "Altersverteilung",
        noAgeData: "Keine Altersverteilungsdaten",
        age: "Alter",
        male: "Männlich",
        female: "Weiblich",
      },
      heatmap: {
        ariaLabel: "Heatmap der Datendichte",
      },
      hierarchy: {
        noData: "Keine Hierarchiedaten verfügbar",
        classificationHierarchy: "Klassifikationshierarchie",
        back: "Zurück",
      },
      periodCount: {
        observationPeriods: "{{count}} Beobachtungsperiode(n)",
      },
      recordCounts: {
        noData: "Keine Datensatzanzahldaten verfügbar",
        title: "Datensatzanzahlen nach CDM-Tabelle",
      },
      temporalTrend: {
        events: "Ereignisse",
        secondary: "Sekundär",
      },
      topConcepts: {
        noData: "Keine Konzeptdaten verfügbar",
        title: "Häufigste Konzepte",
        id: "ID: {{id}}",
        prevalence: "Prävalenz: {{value}} %",
      },
      yearOfBirth: {
        year: "Jahr: {{year}}",
      },
    },
    domain: {
      metrics: {
        totalRecords: "Datensätze gesamt",
        distinctConcepts: "Eindeutige Konzepte",
      },
      loadFailed: "{{domain}}-Daten konnten nicht geladen werden",
      temporalTrendTitle: "{{domain}} Zeittrend",
    },
    temporal: {
      domainsLabel: "Domänen:",
      multiDomainOverlay: "Zeitliche Überlagerung mehrerer Domänen",
      emptyTitle: "Keine zeitlichen Daten verfügbar",
      emptyHelp: "Wählen Sie oben Domänen aus und stellen Sie sicher, dass Achilles ausgeführt wurde",
    },
    concept: {
      details: "Konzeptdetails",
      loadFailed: "Konzeptdetails konnten nicht geladen werden",
      genderDistribution: "Geschlechterverteilung",
      temporalTrend: "Zeittrend",
      typeDistribution: "Typverteilung",
      ageAtFirstOccurrence: "Alter beim ersten Auftreten",
      valueByLabel: "{{label}}: {{value}}",
    },
    achilles: {
      severities: {
        error: "Fehler",
        warning: "Warnung",
        notification: "Benachrichtigung",
      },
      severityCounts: {
        error: "Fehler",
        warning: "Warnungen",
        notification: "Benachrichtigungen",
      },
      actions: {
        running: "Läuft...",
        runHeelChecks: "Heel-Prüfungen ausführen",
        runAchilles: "Achilles ausführen",
        selectRun: "Ausführung auswählen",
        viewLiveProgress: "Live-Fortschritt anzeigen",
        viewDetails: "Details anzeigen",
      },
      runShort: "Ausführung {{id}}...",
      statuses: {
        completed: "Abgeschlossen",
        failed: "Fehlgeschlagen",
        running: "Läuft",
        pending: "Ausstehend",
      },
      labels: {
        status: "Zustand",
        total: "gesamt",
        passed: "bestanden",
        failed: "fehlgeschlagen",
        durationSeconds: "Dauer: {{value}} s",
      },
      heel: {
        title: "Heel-Prüfungen",
        dispatchFailed: "Heel-Prüfungen konnten nicht gestartet werden",
        running: "Heel-Prüfungen laufen...",
        empty: "Noch keine Heel-Prüfungen ausgeführt",
        allPassed: "Alle Prüfungen bestanden",
        issueSummary:
          "{{count}} Probleme: {{errors}}F / {{warnings}}W / {{notifications}}B",
      },
      characterization: {
        title: "Achilles-Charakterisierung",
        dispatchFailed: "Achilles-Ausführung konnte nicht gestartet werden",
        empty: "Noch keine Achilles-Ausführungen",
        emptyHelp: 'Klicken Sie auf "Achilles ausführen", um Ihre Daten zu charakterisieren',
      },
      runModal: {
        completedIn: "Abgeschlossen in {{duration}}",
        analysisProgress: "{{done}} von {{total}} Analysen",
        elapsed: "Verstrichen:",
        passedCount: "{{count}} bestanden",
        failedCount: "{{count}} fehlgeschlagen",
        totalDuration: "{{duration}} gesamt",
        remaining: "~{{duration}} verbleibend",
        waiting: "Warten auf den Start der Analysen...",
        done: "Fertig",
        runInBackground: "Im Hintergrund ausführen",
      },
    },
    dqd: {
      categories: {
        completeness: "Vollständigkeit",
        conformance: "Konformität",
        plausibility: "Plausibilität",
        overall: "Gesamt",
      },
      progress: {
        title: "DQD-Analyse läuft",
        checksCompleted: "{{completed}} von {{total}} Prüfungen abgeschlossen",
        waiting: "Warten...",
        running: "Läuft:",
      },
      labels: {
        passed: "bestanden",
        failed: "fehlgeschlagen",
        remaining: "verbleibend",
        warnings: "Warnungen",
      },
      severity: {
        error: "Fehler",
        warning: "Warnung",
        info: "Information",
      },
      categoryPanel: {
        checkCount: "{{count}} Prüfungen",
        passRate: "{{percent}} % Bestehensrate",
        table: {
          check: "Prüfung",
          table: "Tabelle",
          column: "Spalte",
          severity: "Schweregrad",
          violationPercent: "Verstoß %",
        },
      },
      scorecard: {
        emptyTitle: "Keine DQD-Ergebnisse verfügbar",
        emptyDescription: "Führen Sie eine Data Quality Dashboard-Analyse aus, um Ergebnisse zu sehen",
        overallScore: "Gesamtpunktzahl",
        passedFraction: "{{passed}}/{{total}} bestanden",
      },
      tableGrid: {
        noResults: "Keine DQD-Ergebnisse zum Anzeigen",
        title: "Tabelle-x-Kategorie-Heatmap",
        cdmTable: "CDM-Tabelle",
      },
      actions: {
        runDqd: "DQD ausführen",
      },
      dispatchFailed: "DQD-Ausführung konnte nicht gestartet werden",
      empty: "Noch keine DQD-Ausführungen",
      emptyHelp: 'Klicken Sie auf "DQD ausführen", um eine Datenqualitätsanalyse zu starten',
    },
    ares: {
      name: "Ares",
      breadcrumbSeparator: ">",
      comingSoon: "In einer künftigen Phase verfügbar",
      sections: {
        hub: "Zentrale",
        networkOverview: "Netzwerkübersicht",
        conceptComparison: "Konzeptvergleich",
        dqHistory: "DQ-Verlauf",
        coverage: "Abdeckung",
        coverageMatrix: "Abdeckungsmatrix",
        feasibility: "Machbarkeit",
        diversity: "Diversität",
        releases: "Versionen",
        unmappedCodes: "Nicht gemappte Codes",
        cost: "Kosten",
        costAnalysis: "Kostenanalyse",
        annotations: "Annotationen",
      },
      cards: {
        sourcesBelowDq: "{{value}} Quellen unter 80 % DQ",
        networkOverviewDescription:
          "Quellengesundheit, DQ-Scores und Trendindikatoren",
        conceptComparisonDescription:
          "Konzeptprävalenz über Quellen hinweg vergleichen",
        dqHistoryDescription: "Durchschnittlicher Netzwerk-DQ-Score je Release",
        coverageDescription: "Domäne x Quellenverfügbarkeit",
        feasibilityDescription: "Kann Ihr Netzwerk eine Studie unterstützen?",
        diversityDescription: "Demografische Parität zwischen Quellen",
        releasesDescription: "Versionsverlauf je Quelle",
        unmappedCodesDescription:
          "Quellcodes ohne Standard-Mappings",
        annotationsDescription: "Diagrammnotizen über alle Quellen",
        costDescription: "Kostendaten nach Domäne und über die Zeit",
      },
      networkOverview: {
        title: "Netzwerkübersicht",
        networkTotal: "Netzwerk gesamt",
        percent: "{{value}} %",
        averagePercent: "{{value}} % durchschn.",
        actions: {
          dqRadar: "DQ-Radar",
          hideRadar: "Radar ausblenden",
        },
        metrics: {
          dataSources: "Datenquellen",
          avgDqScore: "Durchschn. DQ-Score",
          unmappedCodes: "Nicht gemappte Codes",
          needAttention: "Aufmerksamkeit nötig",
          totalPersons: "Personen gesamt",
        },
        table: {
          source: "Quelle",
          dqScore: "DQ-Score",
          dqTrend: "DQ-Trend",
          freshness: "Aktualität",
          domains: "Domänen",
          persons: "Personen",
          latestRelease: "Aktuellstes Release",
        },
        messages: {
          loading: "Netzwerkübersicht wird geladen...",
          noData: "Keine Netzwerkdaten verfügbar.",
          noReleases: "Keine Releases",
        },
        radar: {
          title: "DQ-Radarprofil (Kahn-Dimensionen)",
          description:
            "Bestehensraten über die fünf Kahn-Datenqualitätsdimensionen. Höhere Werte bedeuten bessere Qualität.",
          noData: "Keine DQ-Radardaten verfügbar.",
          dimensions: {
            completeness: "Vollständigkeit",
            conformanceValue: "Konformität (Wert)",
            conformanceRelational: "Konformität (relational)",
            plausibilityAtemporal: "Plausibilität (atemporal)",
            plausibilityTemporal: "Plausibilität (zeitlich)",
          },
        },
      },
      feasibility: {
        title: "Machbarkeitsbewertungen",
        assessmentMeta: "{{date}} | {{sources}} Quellen bewertet",
        passedSummary: "{{passed}}/{{total}} bestanden",
        resultsTitle: "Ergebnisse: {{name}}",
        scoreLabel: "{{score}} % Score",
        empty:
          "Noch keine Bewertungen. Erstellen Sie eine, um zu bewerten, ob Ihr Netzwerk eine vorgeschlagene Studie unterstützen kann.",
        actions: {
          newAssessment: "+ Neue Bewertung",
          running: "Läuft...",
          runAssessment: "Bewertung ausführen",
          hide: "Ausblenden",
          forecast: "Prognose",
        },
        filters: {
          view: "Ansicht:",
        },
        detailViews: {
          table: "Score-Tabelle",
          impact: "Auswirkungsanalyse",
          consort: "CONSORT-Fluss",
        },
        criteria: {
          domains: "Domänen",
          concepts: "Konzepte",
          visitTypes: "Besuchstypen",
          dateRange: "Datumsbereich",
          patientCount: "Patientenzahl",
        },
        forecast: {
          insufficientData:
            "Unzureichende historische Daten für Prognose (mindestens 6 Monate erforderlich).",
          title: "Patientenzugangsprognose: {{source}}",
          monthlyRate: "Monatliche Rate: {{rate}} Patienten/Monat",
          targetReachedIn: "Ziel in ~{{months}} Monaten erreicht",
          targetAlreadyReached: "Ziel bereits erreicht",
          actual: "Ist",
          projected: "Prognostiziert",
          confidenceBand: "95 %-KI",
          targetLabel: "Ziel: {{target}}",
          footnote:
            "Projektion basiert auf linearer Regression der letzten 12 Monate. Das Konfidenzband wird mit zunehmender Projektionsdistanz breiter.",
        },
        consort: {
          allSources: "Alle Quellen",
          noResults: "Keine Ergebnisse zum Anzeigen des CONSORT-Diagramms.",
          title: "Attritionsfluss im CONSORT-Stil",
          description:
            "Zeigt, wie Quellen durch jedes Kriterientor schrittweise ausgeschlossen werden.",
          sources: "{{count}} Quellen",
          excluded: "-{{count}} ausgeschlossen",
        },
        impact: {
          noData: "Keine Daten zur Kriterienauswirkung verfügbar.",
          title: "Kriterien-Auswirkungsanalyse",
          description:
            "Zeigt, wie viele zusätzliche Quellen bestehen würden, wenn jedes Kriterium entfernt würde. Ausgangswert: {{passed}}/{{total}} bestanden.",
          sourcesRecovered: "+{{count}} Quellen",
          guidance:
            "Das wirkungsvollste Kriterium ist dasjenige, dessen Entfernung die meisten Quellen zurückgewinnen würde. Erwägen Sie, Kriterien mit hoher Wirkung zu lockern, wenn zu wenige Quellen qualifizieren.",
        },
        templates: {
          loading: "Vorlagen werden geladen...",
          startFrom: "Aus Vorlage starten",
        },
        table: {
          source: "Quelle",
          domains: "Domänen",
          concepts: "Konzepte",
          visits: "Besuche",
          dates: "Daten",
          patients: "Patienten",
          score: "Score",
          overall: "Gesamt",
          forecast: "Prognose",
        },
        status: {
          eligible: "GEEIGNET",
          ineligible: "NICHT GEEIGNET",
        },
        form: {
          title: "Neue Machbarkeitsbewertung",
          assessmentName: "Bewertungsname",
          assessmentNamePlaceholder: "z. B. Diabetes-Outcomes-Studie",
          requiredDomains: "Erforderliche Domänen",
          minPatientCount: "Minimale Patientenzahl (optional)",
          minPatientCountPlaceholder: "z. B. 1000",
          domains: {
            condition: "Erkrankungen",
            drug: "Arzneimittel",
            procedure: "Prozeduren",
            measurement: "Messungen",
            observation: "Beobachtungen",
            visit: "Besuche",
          },
        },
      },
      annotations: {
        filters: {
          allSources: "Alle Quellen",
        },
        tags: {
          all: "Alle",
          dataEvent: "Datenereignis",
          researchNote: "Forschungsnotiz",
          actionItem: "Aufgabe",
          system: "System",
        },
        viewModes: {
          list: "Liste",
          timeline: "Zeitachse",
        },
        actions: {
          reply: "Antworten",
          delete: "Löschen",
        },
        replyPlaceholder: "Antwort schreiben...",
        searchPlaceholder: "Annotationen suchen...",
        confirmDelete: "Diese Annotation löschen?",
        coordinateValue: "{{axis}} = {{value}}",
        sourceContext: "auf {{source}}",
        empty: {
          selectSource: "Wählen Sie eine Quelle aus, um ihre Annotationen anzuzeigen",
          noAnnotations: "Noch keine Annotationen für diese Quelle",
          noTimeline: "Keine Annotationen für die Zeitachse.",
        },
      },
      coverage: {
        title: "Abdeckungsmatrix (Strand-Bericht)",
        description:
          "Domänenverfügbarkeit über alle Datenquellen. Grün = hohe Dichte, gelb = niedrige Dichte, rot = keine Daten.",
        yes: "Ja",
        densityTitle: "Dichte: {{density}} pro Person",
        filters: {
          view: "Ansicht:",
        },
        viewModes: {
          records: "Datensätze",
          per_person: "Pro Person",
          date_range: "Datumsbereich",
        },
        actions: {
          exporting: "Exportiert...",
          exportCsv: "CSV exportieren",
          expectedVsActual: "Erwartet vs. tatsächlich",
        },
        table: {
          source: "Quelle",
          domains: "Domänen",
        },
        expectedStates: {
          expectedPresent: "Erwartet und vorhanden",
          expectedMissing: "Erwartet, aber fehlend",
          unexpectedBonus: "Unerwartete Zusatzdaten",
          notExpectedAbsent: "Nicht erwartet, nicht vorhanden",
        },
        messages: {
          loading: "Abdeckungsmatrix wird geladen...",
          noSources: "Keine Quellen für die Abdeckungsanalyse verfügbar.",
        },
      },
      dqHistory: {
        filters: {
          source: "Quelle:",
          selectSource: "Quelle auswählen...",
        },
        tabs: {
          trends: "Verläufe",
          heatmap: "Wärmekarte",
          sla: "SLA",
          overlay: "Quellenübergreifend",
        },
        sections: {
          passRate: "DQ-Bestehensrate über Releases",
          heatmap: "Kategorie-x-Release-Heatmap",
          sla: "SLA-Compliance-Dashboard",
          overlay: "Quellenübergreifende DQ-Überlagerung",
        },
        passRate: "Bestehensrate",
        deltaReportTitle: "Delta-Bericht: {{release}}",
        status: {
          new: "NEU",
          existing: "BESTEHEND",
          resolved: "GELÖST",
          stable: "STABIL",
        },
        result: {
          pass: "BESTANDEN",
          fail: "FEHLGESCHLAGEN",
        },
        statusSummary: {
          new: "{{count}} neu",
          existing: "{{count}} bestehend",
          resolved: "{{count}} gelöst",
          stable: "{{count}} stabil",
        },
        table: {
          category: "Kategorie",
          status: "Status",
          checkId: "Prüfungs-ID",
          current: "Aktuell",
          previous: "Vorherig",
        },
        sla: {
          targetsTitle: "SLA-Ziele (min. Bestehensrate %)",
          currentCompliance: "Aktuelle Compliance",
          actual: "Ist",
          target: "Ziel",
          errorBudget: "Fehlerbudget",
          targetComparison: "{{actual}} % / {{target}} % Ziel",
        },
        messages: {
          selectSource: "Wählen Sie eine Quelle aus, um den DQ-Verlauf anzuzeigen.",
          loadingHistory: "DQ-Verlauf wird geladen...",
          loadingDeltas: "Deltas werden geladen...",
          loadingHeatmap: "Heatmap wird geladen...",
          loadingOverlay: "Überlagerungsdaten werden geladen...",
          noOverlayData: "Keine DQ-Daten über Quellen hinweg verfügbar.",
          noHeatmapData:
            "Keine Heatmap-Daten verfügbar. Führen Sie DQD auf mehreren Releases aus, um Kategorietrends zu sehen.",
          noDeltaData: "Keine Delta-Daten für dieses Release verfügbar.",
          saved: "Gespeichert",
          noSlaTargets:
            "Keine SLA-Ziele definiert. Legen Sie oben Ziele fest, um Compliance zu sehen.",
          noTrendData:
            "Keine DQ-Verlaufsdaten verfügbar. Führen Sie DQD auf mindestens zwei Releases aus, um Trends zu sehen.",
          trendHelp:
            "Klicken Sie auf einen Release-Punkt, um Delta-Details zu sehen. Grün >90 %, gelb 80-90 %, rot <80 %.",
          overlayHelp:
            "DQ-Bestehensraten über alle Quellen auf einer gemeinsamen Zeitachse.",
        },
        actions: {
          exporting: "Exportiert...",
          exportCsv: "CSV exportieren",
          saving: "Speichert...",
          saveSlaTargets: "SLA-Ziele speichern",
        },
      },
      unmapped: {
        filters: {
          source: "Quelle:",
          selectSource: "Quelle auswählen...",
          release: "Version:",
          table: "Tabelle:",
          allTables: "Alle Tabellen",
          searchPlaceholder: "Quellcodes suchen...",
        },
        viewModes: {
          table: "Tabelle",
          pareto: "Pareto",
          vocabulary: "Vokabular",
        },
        actions: {
          exporting: "Exportiert...",
          exportUsagiCsv: "Usagi-CSV exportieren",
          previous: "Zurück",
          next: "Weiter",
        },
        summaryBadge: "{{table}} ({{codes}} Codes, {{records}} Datensätze)",
        vocabularyValue: "({{vocabulary}})",
        progress: {
          noCodes: "Keine nicht gemappten Codes zu prüfen.",
          title: "Mapping-Fortschritt",
          reviewed: "{{percent}} % geprüft",
          segmentTitle: "{{label}}: {{count}} ({{percent}} %)",
          label: "{{label}}:",
          status: {
            mapped: "Gemappt",
            deferred: "Zurückgestellt",
            excluded: "Ausgeschlossen",
            pending: "Ausstehend",
          },
        },
        sections: {
          pareto: "Pareto-Analyse nicht gemappter Codes",
          vocabulary: "Nicht gemappte Codes nach Vokabular",
          suggestions: "KI-Mapping-Vorschläge",
        },
        suggestions: {
          generating: "Vorschläge werden über pgvector-Ähnlichkeit erzeugt...",
          failed:
            "Vorschläge konnten nicht geladen werden. Der KI-Dienst oder Konzept-Embeddings sind möglicherweise nicht verfügbar.",
          empty: "Keine Vorschläge verfügbar. Konzept-Embeddings sind möglicherweise nicht geladen.",
          id: "ID: {{id}}",
          accepted: "Akzeptiert",
          accept: "Akzeptieren",
          skip: "Überspringen",
        },
        pareto: {
          topCodesCoverage:
            "Die Top-20-Codes decken {{percent}} % aller nicht gemappten Datensätze ab",
          percent: "{{value}} %",
          cumulativePercent: "Kumuliert %",
        },
        vocabulary: {
          total: "Gesamt",
          codeCount: "{{count}} Codes",
        },
        messages: {
          selectSource: "Wählen Sie eine Quelle aus, um nicht gemappte Codes anzuzeigen.",
          loading: "Nicht gemappte Codes werden geladen...",
          emptyPareto: "Keine nicht gemappten Codes für die Pareto-Analyse gefunden.",
          emptyVocabulary: "Keine Vokabulardaten verfügbar.",
          noneFound:
            "Keine nicht gemappten Quellcodes gefunden. Alle Codes sind OMOP-Standardkonzepten zugeordnet.",
          sortedByImpact: "Nach Auswirkungsscore sortiert (Datensatzanzahl x Domänengewicht)",
          showing: "{{start}}-{{end}} von {{total}} werden angezeigt",
        },
        table: {
          sourceCode: "Quellcode",
          vocabulary: "Vokabular",
          cdmTable: "CDM-Tabelle",
          cdmField: "CDM-Feld",
          records: "Datensätze",
          impactScore: "Auswirkungsscore",
        },
      },
      conceptComparison: {
        title: "Konzeptvergleich über Quellen hinweg",
        searchPlaceholder:
          "Konzept suchen (z. B. 'Typ-2-Diabetes', 'Metformin')...",
        conceptMetadata: "{{domain}} | {{vocabulary}} | ID: {{id}}",
        selectedConceptMetadata:
          "{{domain}} | {{vocabulary}} | Konzept-ID: {{id}}",
        temporalTrendTitle: "Zeittrend: {{concept}}",
        addConceptPlaceholder: "Weiteres Konzept hinzufügen ({{selected}}/{{max}} ausgewählt)...",
        cdcNationalRate: "Nationale CDC-Rate: {{value}}/1000",
        viewModes: {
          single: "Einzeln",
          temporal: "Zeitlich",
          multi: "Multi-Konzept",
          funnel: "Attritions-Funnel",
        },
        rateModes: {
          crude: "Rohrate",
          standardized: "Alters-/Geschlechtsadjustiert",
        },
        metrics: {
          rate: "Häufigkeit/1000",
          count: "Anzahl",
          perThousandShort: "{{value}}/1k",
          perThousandLong: "{{value}} pro 1.000",
        },
        messages: {
          noComparisonData: "Keine Vergleichsdaten verfügbar.",
          noTemporalPrevalenceData: "Keine zeitlichen Prävalenzdaten verfügbar.",
          selectTwoConcepts: "Wählen Sie mindestens 2 Konzepte zum Vergleich aus.",
          searching: "Suche...",
          loadingComparison: "Vergleichsdaten werden geladen...",
          standardizedNote:
            "Standardisiert auf die US-Census-2020-Population mittels direkter Alters-/Geschlechtsstandardisierung.",
          searchToCompare:
            "Suchen Sie oben nach einem Konzept, um seine Prävalenz über alle Datenquellen zu vergleichen.",
          loadingTemporal: "Zeitliche Prävalenz wird geladen...",
          noTemporalData: "Keine zeitlichen Daten für dieses Konzept verfügbar.",
          searchForTemporal:
            "Suchen Sie oben nach einem Konzept, um seinen zeitlichen Prävalenztrend über Releases hinweg zu sehen.",
          loadingMulti: "Multi-Konzeptvergleich wird geladen...",
          loadingFunnel: "Attritions-Funnel wird geladen...",
          noAttritionData:
            "Keine Attritionsdaten für die ausgewählten Konzepte verfügbar.",
          temporalPrevalenceHelp:
            "Rate pro 1.000 Personen im Zeitverlauf.",
        },
      },
      releases: {
        releaseTypes: {
          etl: "ETL",
          scheduledEtl: "Geplante ETL",
          snapshot: "Momentaufnahme",
        },
        cdmVersion: "CDM {{version}}",
        vocabularyVersion: "Vokabular {{version}}",
        personCount: "{{value}} Personen",
        recordCount: "{{value}} Datensätze",
        actions: {
          showDiff: "Diff anzeigen",
          editRelease: "Release bearbeiten",
          createRelease: "Release erstellen",
          creating: "Erstellt...",
          create: "Erstellen",
          saving: "Speichert...",
          save: "Speichern",
          cancel: "Abbrechen",
        },
        etl: {
          provenance: "ETL-Provenienz",
          ranBy: "Ausgeführt von:",
          codeVersion: "Codeversion:",
          duration: "Dauer:",
          started: "Gestartet:",
          parameters: "Parameter:",
        },
        duration: {
          hoursMinutes: "{{hours}} h {{minutes}} min",
          minutesSeconds: "{{minutes}} min {{seconds}} s",
          seconds: "{{seconds}} s",
        },
        confirmDelete: "Dieses Release löschen?",
        tabs: {
          list: "Versionen",
          swimlane: "Bahnen",
          calendar: "Kalender",
        },
        timelineTitle: "Release-Zeitachse (alle Quellen)",
        calendarTitle: "Release-Kalender",
        selectSource: "Quelle auswählen",
        form: {
          releaseName: "Release-Name",
          cdmVersion: "CDM-Version",
          vocabularyVersion: "Vokabularversion",
          etlVersion: "ETL-Version",
          notes: "Notizen",
          notesPlaceholder: "Release-Notizen...",
          cdmVersionOptional: "CDM-Version (optional)",
          vocabularyVersionOptional: "Vokabularversion (optional)",
          cdmVersionPlaceholder: "CDM v5.4",
          vocabularyVersionPlaceholder: "2024-11-01",
          etlVersionPlaceholder: "v1.2.3",
        },
        empty: {
          selectSource: "Wählen Sie eine Quelle aus, um ihre Releases anzuzeigen",
          noReleases: "Noch keine Releases für diese Quelle",
          noReleaseData: "Keine Release-Daten verfügbar.",
        },
        calendar: {
          noEvents: "Keine Release-Ereignisse.",
          dayEvents: "{{date}}: {{count}} Releases",
          less: "Weniger",
          more: "Mehr",
        },
        diff: {
          computing: "Diff wird berechnet...",
          title: "Release-Diff",
          initialRelease: "Initiales Release -- keine vorherigen Daten zum Vergleichen.",
          persons: "Personen:",
          records: "Datensätze:",
          dqScore: "DQ-Score:",
          unmapped: "Nicht gemappt:",
          vocabUpdated: "Vokabular aktualisiert",
          domainDeltas: "Domänen-Deltas:",
        },
      },
      diversity: {
        title: "Diversitätsbericht",
        description:
          "Demografische Anteile über Datenquellen hinweg. Quellen nach Populationsgröße sortiert.",
        ratings: {
          very_high: "sehr hoch",
          high: "hoch",
          moderate: "moderat",
          low: "niedrig",
        },
        percentValue: "{{value}} %",
        labelPercentValue: "{{label}}: {{value}} %",
        personCount: "{{value}} Personen",
        labels: {
          gender: "Geschlecht",
          race: "Ethnie",
          ethnicity: "Ethnizität",
          male: "Männlich",
          female: "Weiblich",
        },
        dimensions: {
          composite: "Gesamt",
          gender: "Geschlecht",
          race: "Ethnie",
          ethnicity: "Ethnizität",
        },
        tabs: {
          overview: "Übersicht",
          pyramid: "Alterspyramide",
          dap: "DAP-Lücke",
          pooled: "Gepoolt",
          geographic: "Geografisch",
          trends: "Verläufe",
        },
        filters: {
          selectSource: "Quelle auswählen",
        },
        benchmarks: {
          usCensus2020: "US Census 2020",
        },
        dap: {
          title: "FDA-DAP-Analyse von Einschlusslücken",
          description:
            "Vergleicht Quelldemografie mit US-Census-2020-Benchmarks, um Einschlusslücken zu erkennen.",
          tooltip: "Ist: {{actual}} % | Ziel: {{target}} % | Lücke: {{gap}} %",
          status: {
            met: "Erfüllt (innerhalb 2 %)",
            gap: "Lücke (2-10 %)",
            critical: "Kritisch (>10 %)",
          },
        },
        agePyramid: {
          title: "{{source}} -- Altersverteilung",
        },
        benchmark: {
          title: "Vergleichswert: {{label}}",
          actual: "Ist",
          benchmark: "Vergleichswert",
        },
        trends: {
          title: "Diversitätstrends: {{source}}",
          description:
            "Simpson-Diversitätsindex je Release (0 = homogen, 1 = maximal divers)",
        },
        geographic: {
          loading: "Geografische Diversitätsdaten werden geladen...",
          noLocationData: "Keine Standortdaten verfügbar",
          noAdiData:
            "ADI-Daten nicht verfügbar (GIS-Modul hat ADI möglicherweise nicht geladen)",
          noGeographicData:
            "Keine geografischen Daten verfügbar. Quellen haben möglicherweise keine Standortdaten in der person-Tabelle.",
          statesCovered: "Abgedeckte Bundesstaaten / Regionen",
          networkMedianAdi: "Netzwerk-Median-ADI:",
          sourcesWithLocation: "Quellen mit Standortdaten",
          sourcesWithAdi: "Quellen mit ADI-Daten",
          stateCount: "{{count}} Bundesstaaten",
          medianAdiValue: "Median-ADI: {{value}}",
          topStates: "Top-Bundesstaaten nach Patientenzahl",
          adiDistribution: "ADI-Dezil-Verteilung",
          leastDeprived: "Am wenigsten benachteiligt",
          adiDecile: "ADI-Dezil",
          mostDeprived: "Am stärksten benachteiligt",
          decileTitle: "Dezil {{decile}}: {{count}} ZIP-Codes",
          adiRatings: {
            low: "Geringe Benachteiligung",
            moderate: "Moderate Benachteiligung",
            high: "Hohe Benachteiligung (unterversorgt)",
          },
        },
        pooled: {
          title: "Gepoolte Demografie",
          description:
            "Wählen Sie mehrere Quellen aus, um gewichtet zusammengeführte demografische Profile zu sehen.",
          summary: "Gesamt: {{persons}} Personen über {{sources}} Quellen",
        },
        messages: {
          loading: "Diversitätsdaten werden geladen...",
          noSources: "Keine Quellen für Diversitätsanalyse verfügbar.",
          noData: "Keine Daten",
          noTrendData: "Keine Release-Daten für Diversitätstrends verfügbar.",
          noTrendReleases:
            "Für diese Quelle wurden keine Releases gefunden. Erstellen Sie Releases, um Diversitätstrends zu verfolgen.",
        },
      },
      cost: {
        empty: {
          title: "Keine Kostendaten verfügbar",
          message:
            "Kostendaten erfordern claims-basierte Datensätze (z. B. MarketScan, Optum, PharMetrics). Aus EHR abgeleitete Datensätze wie SynPUF, MIMIC-IV und die meisten Daten akademischer medizinischer Zentren befüllen die OMOP-cost-Tabelle in der Regel nicht.",
        },
        filters: {
          source: "Quelle:",
          selectSource: "Quelle auswählen...",
        },
        tabs: {
          overview: "Übersicht",
          distribution: "Verteilung",
          "care-setting": "Versorgungssetting",
          trends: "Verläufe",
          drivers: "Kostentreiber",
          "cross-source": "Quellenübergreifend",
        },
        messages: {
          selectSource: "Wählen Sie eine Quelle aus, um Kostendaten anzuzeigen.",
          loading: "Kostendaten werden geladen...",
          distributionHelp:
            "Box-and-Whisker-Plots zeigen die Kostenstreuung. Box = IQR (P25-P75), Whisker = P10-P90, goldene Linie = Median, roter Punkt = Mittelwert.",
          noDistributionData: "Keine Verteilungsdaten verfügbar.",
          noCareSettingData:
            "Keine Kostendaten nach Versorgungssetting verfügbar. Erfordert Visit-Domänen-Kostendatensätze, die mit visit_occurrence verknüpft sind.",
          selectSourceForDrivers: "Wählen Sie eine Quelle aus, um Kostentreiber anzuzeigen.",
          loadingDrivers: "Kostentreiber werden geladen...",
          noDriverData: "Keine Kostentreiberdaten für diese Quelle verfügbar.",
          costDriversHelp:
            "Top-10-Konzepte nach Gesamtkosten. Klicken Sie auf einen Balken, um Konzeptdetails zu sehen.",
          loadingCrossSource: "Quellenübergreifender Vergleich wird geladen...",
          noComparisonSources: "Keine Quellen für den Vergleich verfügbar.",
          noCrossSourceCostData:
            "Keine Quellen haben Kostendaten für den Vergleich.",
          crossSourceHelp:
            "Box-and-Whisker je Quelle. Box = IQR (P25-P75), Whisker = P10-P90, goldene Linie = Median.",
        },
        metrics: {
          totalCost: "Gesamtkosten",
          perPatientPerYear: "Pro Patient und Jahr",
          persons: "Personen",
          observationYears: "{{value}} J.",
          avgObservation: "Durchschn. Beobachtung",
          recordsAverage: "{{records}} Datensätze | durchschn. {{average}}",
          recordCount: "{{count}} Datensätze",
          patientCount: "{{count}} Patienten",
          averagePerRecord: "Durchschn.: {{value}}/Datensatz",
          medianValue: "Medianwert: {{value}}",
          meanValue: "Mittelwert: {{value}}",
          percent: "{{value}} %",
          range: "Bereich: {{min}} - {{max}}",
        },
        costTypeFilter: {
          title: "Mehrere Kostentypen erkannt.",
          message:
            "Diese Quelle hat {{count}} verschiedene Kostentypkonzepte. Das Vermischen berechneter Beträge mit bezahlten Beträgen erzeugt irreführende Statistiken. Filtern Sie nach Kostentyp für eine genaue Analyse.",
          allTypes: "Alle Typen",
          option: "{{name}} ({{count}})",
        },
        sections: {
          costByDomain: "Kosten nach Domäne",
          distributionByDomain: "Kostenverteilung nach Domäne",
          costByCareSetting: "Kosten nach Versorgungssetting",
          monthlyTrends: "Monatliche Kostentrends",
          topCostDrivers: "Wichtigste Kostentreiber",
          crossSourceComparison: "Quellenübergreifender Kostenvergleich",
        },
      },
    },
  },
  administration: {
    dashboard: {
      title: "Verwaltung",
      subtitle: "Benutzer, Rollen, Berechtigungen und Systemkonfiguration verwalten.",
      panels: {
        platform: "Plattform",
        usersAccess: "Benutzer und Zugriff",
        dataSources: "Datenquellen",
        aiResearch: "KI und Forschung"
      },
      status: {
        allHealthy: "Alles gesund",
        degraded: "Beeinträchtigt",
        warning: "Warnung"
      },
      labels: {
        services: "Dienste",
        queue: "Warteschlange",
        redis: "Redis",
        totalUsers: "Benutzer gesamt",
        roles: "Rollen",
        authProviders: "Authentifizierungsanbieter",
        tokenExpiry: "Token-Ablauf",
        solr: "Solr",
        aiProvider: "KI-Anbieter",
        model: "Modell",
        abby: "Abby",
        researchRuntime: "R / HADES"
      },
      values: {
        servicesUp: "{{healthy}}/{{total}} aktiv",
        queueSummary: "{{pending}} ausstehend / {{failed}} fehlgeschlagen",
        enabledCount: "{{count}} aktiviert",
        tokenExpiry: "8h",
        cdmCount: "{{count}} CDM",
        solrSummary: "{{docs}}-Dokumente / {{cores}}-Kerne",
        none: "Keine",
        online: "Online"
      },
      messages: {
        noCdmSources: "Keine CDM-Quellen konfiguriert"
      },
      nav: {
        userManagement: {
          title: "Benutzerverwaltung",
          description: "Benutzerkonten erstellen, bearbeiten und deaktivieren. Rollen steuern den Zugriff."
        },
        rolesPermissions: {
          title: "Rollen und Berechtigungen",
          description: "Benutzerdefinierte Rollen definieren und Berechtigungen domänenübergreifend anpassen."
        },
        authProviders: {
          title: "Authentifizierungsanbieter",
          description: "LDAP, OAuth 2.0, SAML 2.0 oder OIDC für SSO aktivieren und konfigurieren."
        },
        aiProviders: {
          title: "KI-Anbieter-Konfiguration",
          description: "Abbys Backend zwischen lokalem Ollama, Anthropic, OpenAI, Gemini und weiteren wechseln."
        },
        systemHealth: {
          title: "Systemstatus",
          description: "Live-Status aller Parthenon-Dienste: Redis, KI, Darkstar, Solr, Orthanc PACS und Job-Warteschlangen."
        },
        vocabularyManagement: {
          title: "Vokabularverwaltung",
          description: "OMOP-Vokabulartabellen durch Hochladen einer neuen Athena-ZIP-Datei aktualisieren."
        },
        fhirConnections: {
          title: "FHIR-EHR-Verbindungen",
          description: "FHIR-R4-Verbindungen zu Epic, Cerner und anderen EHR-Systemen für Massenimporte verwalten."
        }
      },
      setupWizard: {
        title: "Plattform-Einrichtungsassistent",
        description: "Die geführte Einrichtung erneut starten: Statusprüfung, KI-Anbieter, Authentifizierung und Datenquellen."
      },
      atlasMigration: {
        title: "Aus Atlas migrieren",
        description: "Kohortendefinitionen, Konzeptsets und Analysen aus einer bestehenden OHDSI-Atlas-Installation importieren."
      },
      actions: {
        open: "Öffnen",
        openWizard: "Assistent öffnen"
      }
    },
    acropolisServices: {
      descriptions: {
        authentik: "Identitätsanbieter und Zugangsportal",
        wazuh: "Sicherheitsüberwachung und SIEM-Dashboard",
        grafana: "Metriken und Beobachtbarkeits-Dashboards",
        portainer: "Container- und Stack-Operationen",
        pgadmin: "PostgreSQL-Verwaltungskonsole",
        n8n: "Workflow-Orchestrierung und Automatisierung",
        superset: "BI und Ad-hoc-Analyse-Arbeitsbereich",
        datahub: "Metadatenkatalog und Herkunfts-Explorer"
      },
      openService: "Offener Dienst"
    },
    grafana: {
      openDashboard: "Öffnen Sie das Dashboard"
    },
    broadcastEmail: {
      title: "E-Mail senden",
      descriptionPrefix: "Dadurch wird an jeden eine individuelle E-Mail gesendet",
      descriptionSuffix: "registrierte Benutzer.",
      subject: "Thema",
      subjectPlaceholder: "E-Mail-Betreffzeile...",
      message: "Nachricht",
      messagePlaceholder: "Schreiben Sie hier Ihre Nachricht...",
      close: "Schließen",
      cancel: "Abbrechen",
      sending: "Senden...",
      sendToAll: "An alle Benutzer senden",
      resultWithRecipients: "{{message}} ({{count}}-Empfänger)",
      unknownError: "Unbekannter Fehler"
    },
    userModal: {
      titles: {
        editUser: "Benutzer bearbeiten",
        newUser: "Neuer Benutzer"
      },
      fields: {
        fullName: "Vollständiger Name",
        email: "E-Mail",
        password: "Passwort",
        roles: "Rollen"
      },
      hints: {
        keepCurrentPassword: "(Leer lassen, um auf dem neuesten Stand zu bleiben)"
      },
      placeholders: {
        maskedPassword: "••••••••",
        passwordRequirements: "Mindestens 8 Zeichen, Groß-/Kleinschreibung + Zahl gemischt"
      },
      actions: {
        cancel: "Abbrechen",
        saving: "Sparen...",
        saveChanges: "Änderungen speichern",
        createUser: "Benutzer erstellen"
      },
      errors: {
        generic: "Es ist ein Fehler aufgetreten.",
        passwordRequired: "Passwort ist erforderlich."
      }
    },
    liveKit: {
      loadingConfiguration: "Konfiguration wird geladen...",
      provider: "Anbieter",
      providerBadges: {
        cloud: "Wolke",
        "self-hosted": "Selbst gehostet",
        env: "Env"
      },
      providerOptions: {
        environment: "Umfeld",
        liveKitCloud: "LiveKit Cloud",
        selfHosted: "Selbst gehostet"
      },
      providerDescriptions: {
        useEnvFile: "Verwenden Sie die .env-Datei",
        hostedByLiveKit: "Gehostet von LiveKit",
        yourOwnServer: "Ihr eigener Server"
      },
      env: {
        usingEnvConfiguration: "Verwendung der .env-Konfiguration",
        url: "URL:",
        apiKey: "API-Schlüssel:",
        apiSecret: "API-Geheimnis:",
        notSet: "Nicht festgelegt",
        missing: "Fehlen",
        editPrefix: "Bearbeiten",
        editSuffix: "und starten Sie PHP neu, um Änderungen vorzunehmen."
      },
      fields: {
        cloudUrl: "LiveKit Wolke URL",
        serverUrl: "Server URL",
        apiKey: "API-Schlüssel",
        apiSecret: "API-Geheimnis"
      },
      placeholders: {
        savedKey: "Gespeichert; Geben Sie einen neuen Schlüssel ein, um ihn zu ersetzen",
        savedSecret: "Gespeichert; Geben Sie ein neues Geheimnis ein, um es zu ersetzen",
        enterApiKey: "Geben Sie den API-Schlüssel ein",
        enterApiSecret: "Geben Sie das API-Geheimnis ein"
      },
      actions: {
        hideConfiguration: "Konfiguration ausblenden",
        configureLiveKit: "Konfigurieren Sie LiveKit",
        testConnection: "Testverbindung",
        saveConfiguration: "Konfiguration speichern",
        useEnvDefaults: "Verwenden Sie die .env-Standardeinstellungen"
      },
      toasts: {
        noUrlToTest: "Kein URL zum Testen",
        connectionSuccessful: "Verbindung erfolgreich",
        connectionFailed: "Verbindung fehlgeschlagen",
        configurationSaved: "LiveKit-Konfiguration gespeichert",
        saveFailed: "Konfiguration konnte nicht gespeichert werden"
      }
    },
    authProviders: {
      title: "Authentifizierungsanbieter",
      subtitle: "Aktivieren Sie externe Identitätsanbieter für Single Sign-On. Sanctum-Benutzername/Passwort bleibt immer als Rückfall verfügbar.",
      providers: {
        ldap: {
          label: "LDAP / Active Directory",
          description: "Authentifizierung gegen Microsoft Active Directory oder ein LDAP-v3-Verzeichnis. Unterstützt TLS, Gruppensynchronisierung und Attributzuordnung."
        },
        oauth2: {
          label: "OAuth 2.0",
          description: "Authentifizierung an GitHub, Google, Microsoft oder einen benutzerdefinierten OAuth-2.0-Anbieter delegieren."
        },
        saml2: {
          label: "SAML 2.0",
          description: "Enterprise-SSO über einen SAML-2.0-Identitätsanbieter (Okta, Azure AD, ADFS usw.)."
        },
        oidc: {
          label: "OpenID Connect",
          description: "Modernes SSO über OIDC-Discovery. Unterstützt PKCE und jeden standardkonformen IdP."
        }
      },
      enabled: "Aktiviert",
      disabled: "Deaktiviert",
      configure: "Konfigurieren",
      testConnection: "Verbindung testen",
      connectionSuccessful: "Verbindung erfolgreich",
      connectionFailed: "Verbindung fehlgeschlagen",
      usernamePassword: "Benutzername und Passwort",
      alwaysOn: "Immer aktiv",
      builtIn: "Integrierte Sanctum-Authentifizierung - immer aktiv.",
      loading: "Anbieter werden geladen...",
      formActions: {
        saving: "Speichern...",
        save: "Speichern",
        saved: "Gespeichert"
      },
      oauthForm: {
        drivers: {
          github: "GitHub",
          google: "Google",
          microsoft: "Microsoft / Azure AD",
          custom: "Benutzerdefiniertes OAuth 2.0"
        },
        sections: {
          customEndpoints: "Benutzerdefinierte Endpunkte"
        },
        labels: {
          provider: "Anbieter",
          clientId: "Client-ID",
          clientSecret: "Client-Secret",
          redirectUri: "Redirect-URI",
          scopes: "Bereiche",
          authorizationUrl: "Autorisierungs-URL",
          tokenUrl: "Token-URL",
          userInfoUrl: "User-Info-URL"
        },
        hints: {
          redirectUri: "Muss der beim OAuth-Anbieter registrierten URI entsprechen",
          scopes: "Leerzeichengetrennte Liste"
        },
        placeholders: {
          clientId: "Client / Anwendung ID",
          redirectUri: "/api/v1/auth/oauth2/callback",
          scopes: "openid-Profil-E-Mail"
        }
      },
      oidcForm: {
        labels: {
          discoveryUrl: "Discovery-URL",
          clientId: "Client-ID",
          clientSecret: "Client-Secret",
          redirectUri: "Redirect-URI",
          scopes: "Bereiche",
          pkceEnabled: "PKCE aktivieren (empfohlen - erfordert öffentlichen Client)"
        },
        hints: {
          discoveryUrl: "Der /.well-known/openid-configuration-Endpunkt Ihres IdP",
          redirectUri: "Muss der Registrierung im IdP entsprechen",
          scopes: "Leerzeichengetrennt"
        },
        placeholders: {
          discoveryUrl: "https://accounts.google.com/.well-known/openid-configuration",
          clientId: "Ihre-Kunden-ID",
          redirectUri: "/api/v1/auth/oidc/callback",
          scopes: "openid-Profil-E-Mail"
        }
      },
      samlForm: {
        sections: {
          identityProvider: "Identitätsanbieter (IdP)",
          serviceProvider: "Dienstanbieter (SP)",
          attributeMapping: "Attributzuordnung"
        },
        labels: {
          idpEntityId: "IdP-Entity-ID",
          ssoUrl: "SSO-URL",
          sloUrl: "SLO-URL",
          idpCertificate: "IdP-Zertifikat",
          spEntityId: "SP-Entity-ID",
          acsUrl: "ACS-URL",
          nameIdFormat: "NameID-Format",
          signAssertions: "Assertions signieren (erfordert privaten SP-Schlüssel - in der Serverumgebung konfigurieren)",
          emailAttribute: "E-Mail-Attribut",
          displayNameAttribute: "Anzeigename-Attribut"
        },
        hints: {
          ssoUrl: "Single-Sign-On-Endpunkt",
          sloUrl: "Single-Logout-Endpunkt (optional)",
          idpCertificate: "X.509-Zertifikat einfügen (PEM-Format, mit oder ohne Header)",
          spEntityId: "URL Ihrer Parthenon-Instanz - muss der IdP-Registrierung entsprechen",
          acsUrl: "Assertion Consumer Service"
        },
        placeholders: {
          certificate: "-----BEGIN CERTIFICATE-----\nMIIDxTCC...\n-----END CERTIFICATE-----",
          acsUrl: "/api/v1/auth/saml2/callback",
          sloUrl: "/api/v1/auth/saml2/logout",
          displayName: "Anzeigename"
        },
        attributeMappingDescription: "Ordnen Sie SAML-Assertion-Attribute Parthenon-Benutzerfeldern zu."
      },
      ldapForm: {
        sections: {
          connection: "Verbindung",
          bindCredentials: "Bind-Anmeldedaten",
          userSearch: "Benutzersuche",
          attributeMapping: "Attributzuordnung",
          groupSync: "Gruppensynchronisierung"
        },
        labels: {
          host: "Gastgeber",
          port: "Hafen",
          useSsl: "SSL verwenden (LDAPS)",
          useTls: "StartTLS verwenden",
          timeout: "Timeout(s)",
          bindDn: "Bind-DN",
          bindPassword: "Bind-Passwort",
          baseDn: "Base-DN",
          userSearchBase: "Basis für Benutzersuche",
          userFilter: "Benutzerfilter",
          usernameField: "Benutzernamenfeld",
          emailField: "E-Mail-Feld",
          displayNameField: "Anzeigename-Feld",
          syncGroups: "LDAP-Gruppen mit Parthenon-Rollen synchronisieren",
          groupSearchBase: "Basis für Gruppensuche",
          groupFilter: "Gruppenfilter"
        },
        hints: {
          host: "Hostname oder IP des LDAP-Servers",
          bindDn: "Servicekonto-DN für Verzeichnisabfragen",
          userFilter: "{username} wird bei der Anmeldung ersetzt"
        },
        placeholders: {
          bindDn: "cn=svc-parthenon,dc=example,dc=com",
          baseDn: "dc=Beispiel,dc=com",
          userSearchBase: "ou=Benutzer,dc=Beispiel,dc=com",
          userFilter: "(uid={Benutzername})",
          groupSearchBase: "ou=groups,dc=example,dc=com",
          groupFilter: "(objectClass=groupOfNames)"
        },
        actions: {
          saving: "Speichern...",
          save: "Speichern",
          saved: "Gespeichert"
        }
      }
    },
    roles: {
      title: "Rollen und Berechtigungen",
      subtitle: "Definieren Sie benutzerdefinierte Rollen und optimieren Sie die Berechtigungszuweisungen. Verwenden Sie die Matrix für Massenbearbeitungen.",
      tabs: {
        roleList: "Rollenliste",
        permissionMatrix: "Berechtigungsmatrix"
      },
      permissionMatrix: {
        instructions: "Klicken Sie auf Zellen, um Berechtigungen umzuschalten, Zeilenüberschriften, um sie auf alle Rollen anzuwenden, und Spaltenüberschriften, um alle Berechtigungen für eine Rolle zu erteilen/entziehen.",
        saveAllChangesOne: "Alle Änderungen speichern ({{count}}-Rolle)",
        saveAllChangesOther: "Alle Änderungen speichern ({{count}}-Rollen)",
        permission: "Erlaubnis",
        columnTitle: "Schalten Sie alle Berechtigungen für {{role}} um",
        permissionCount: "{{count}} perms",
        saving: "sparen...",
        saved: "gespeichert ✓",
        save: "speichern",
        domainTitle: "Schalten Sie alle {{domain}}-Berechtigungen für alle Rollen um",
        rowTitle: "Schalten Sie {{permission}} für alle Rollen um",
        cellTitleGrant: "Gewähren Sie {{permission}} bis {{role}}",
        cellTitleRevoke: "Widerrufen Sie {{permission}} von {{role}}"
      },
      editor: {
        roleName: "Rollenname",
        roleNamePlaceholder: "z.B. Standortkoordinator",
        permissions: "Berechtigungen",
        selectedCount: "({{count}} ausgewählt)"
      },
      actions: {
        newRole: "Neue Rolle",
        cancel: "Abbrechen",
        saving: "Sparen...",
        saveRole: "Rolle speichern",
        editRole: "Rolle bearbeiten",
        deleteRole: "Rolle löschen",
        deleting: "Löschen...",
        delete: "Löschen"
      },
      values: {
        builtIn: "eingebaut",
        userCountOne: "{{count}}-Benutzer",
        userCountOther: "{{count}}-Benutzer",
        permissionCountOne: "{{count}}-Berechtigung",
        permissionCountOther: "{{count}}-Berechtigungen",
        more: "+{{count}} mehr"
      },
      deleteModal: {
        title: "Rolle löschen?",
        prefix: "Die Rolle",
        suffix: "wird dauerhaft gelöscht. Benutzer, denen nur diese Rolle zugewiesen ist, verlieren alle Berechtigungen."
      }
    },
    pacs: {
      studyBrowser: {
        browseTitle: "Durchsuchen: {{name}}",
        filters: {
          patientName: "Patientenname",
          patientId: "Patient ID",
          allModalities: "Alle Modalitäten"
        },
        empty: {
          noStudies: "Keine Studien gefunden"
        },
        table: {
          patientName: "Patientenname",
          patientId: "Patient ID",
          date: "Datum",
          modality: "Modalität",
          description: "Beschreibung",
          series: "Serie",
          instances: "Inst."
        },
        pagination: {
          range: "{{start}}-{{end}}",
          ofStudies: "von {{total}}-Studien",
          previous: "Vorherige",
          next: "Nächste"
        }
      },
      connectionCard: {
        defaultConnection: "Standardverbindung",
        setAsDefault: "Als Standard festlegen",
        deleteConfirm: "„{{name}}“ löschen?",
        never: "Niemals",
        seriesByModality: "Serie von Modality",
        statsUpdated: "Statistiken aktualisiert {{date}}",
        stats: {
          patients: "Patienten",
          studies: "Studien",
          series: "Serie",
          instances: "Instanzen",
          disk: "Scheibe"
        },
        actions: {
          edit: "Bearbeiten",
          delete: "Löschen",
          test: "Prüfen",
          stats: "Statistiken",
          browse: "Durchsuchen"
        }
      }
    },
    solrAdmin: {
      title: "Solr-Suchverwaltung",
      subtitle: "Verwalten Sie Solr-Suchkerne, lösen Sie eine Neuindizierung aus und überwachen Sie den Status.",
      loadingCoreStatus: "Kernstatus wird geladen...",
      status: {
        healthy: "Gesund",
        unavailable: "Nicht verfügbar"
      },
      labels: {
        documents: "Unterlagen",
        lastIndexed: "Zuletzt indiziert",
        duration: "Dauer"
      },
      values: {
        never: "Niemals",
        seconds: "{{seconds}}s"
      },
      actions: {
        reindexAll: "Alle Kerne neu indizieren",
        reindex: "Neu indizieren",
        fullReindex: "Vollständige Neuindizierung",
        clear: "Zurücksetzen"
      },
      messages: {
        fetchFailed: "Der Solr-Status konnte nicht abgerufen werden",
        reindexCompleted: "Neuindizierung von „{{core}}“ abgeschlossen",
        reindexFailed: "„{{core}}“ konnte nicht neu indiziert werden",
        reindexAllCompleted: "Neuindizierung – alles abgeschlossen",
        reindexAllFailed: "Es konnten nicht alle Kerne neu indiziert werden",
        clearConfirm: "Sind Sie sicher, dass Sie alle Dokumente aus „{{core}}“ löschen möchten? Dies kann nicht rückgängig gemacht werden.",
        clearCompleted: "Kern '{{core}}' gelöscht",
        clearFailed: "„{{core}}“ konnte nicht gelöscht werden"
      }
    },
    aiProviders: {
      title: "KI-Anbieter-Konfiguration",
      subtitle: "Wählen Sie das KI-Backend für Abby. Es ist jeweils nur ein Anbieter aktiv. API-Schlüssel werden verschlüsselt gespeichert.",
      activeProvider: "Aktiver Anbieter:",
      fields: {
        model: "Modell",
        apiKey: "API-Schlüssel",
        ollamaBaseUrl: "Ollama-Basis-URL"
      },
      placeholders: {
        modelName: "Modellname"
      },
      values: {
        active: "Aktiv",
        enabled: "Aktiviert",
        disabled: "Deaktiviert",
        noModelSelected: "Kein Modell ausgewählt"
      },
      actions: {
        currentlyActive: "Derzeit aktiv",
        setAsActive: "Als aktiv festlegen",
        save: "Speichern",
        testConnection: "Verbindung testen"
      },
      messages: {
        requestFailed: "Anfrage fehlgeschlagen."
      }
    },
    gisImport: {
      steps: {
        upload: "Hochladen",
        analyze: "Analysieren",
        mapColumns: "Kartenspalten",
        configure: "Konfigurieren",
        validate: "Bestätigen",
        import: "Import"
      },
      analyze: {
        analysisFailed: "Abby hat bei der Analyse dieser Datei ein Problem festgestellt.",
        unknownError: "Unbekannter Fehler",
        retry: "Wiederholen",
        analyzing: "Abby analysiert Ihre Daten...",
        detecting: "Erkennen von Spaltentypen, geografischen Codes und Wertesemantik"
      },
      upload: {
        uploading: "Hochladen...",
        dropPrompt: "Legen Sie hier eine Datei ab oder klicken Sie zum Durchsuchen",
        acceptedFormats: "CSV, TSV, Excel, Shapefile (.zip), GeoJSON, KML, GeoPackage – max. {{maxSize}}MB",
        largeFiles: "Für große Dateien (> {{maxSize}}MB)",
        fileTooLarge: "Datei überschreitet {{maxSize}}MB. Verwenden Sie CLI: php artisan gis:import {{filename}}",
        uploadFailed: "Der Upload ist fehlgeschlagen"
      },
      configure: {
        fields: {
          layerName: "Layername",
          exposureType: "Belichtungstyp",
          geographyLevel: "Geographie-Ebene",
          valueType: "Werttyp",
          aggregation: "Aggregation"
        },
        placeholders: {
          layerName: "z. B. Social Vulnerability Index",
          exposureType: "z. B. svi_overall"
        },
        geographyLevels: {
          county: "County",
          tract: "Volkszählungsgebiet",
          state: "Zustand",
          country: "Land",
          custom: "Benutzerdefiniert"
        },
        valueTypes: {
          continuous: "Kontinuierlich (Choropleth)",
          categorical: "Kategorisch (diskrete Farben)",
          binary: "Binär (Anwesenheit/Abwesenheit)"
        },
        aggregations: {
          mean: "Bedeuten",
          sum: "Summe",
          maximum: "Maximal",
          minimum: "Minimum",
          latest: "Letzte"
        },
        saving: "Sparen...",
        continue: "Weitermachen"
      },
      mapping: {
        title: "Spaltenzuordnung",
        subtitle: "Ordnen Sie jede Quellspalte ihrem Zweck zu",
        purposes: {
          geographyCode: "Geographie-Code",
          geographyName: "Geografischer Name",
          latitude: "Breite",
          longitude: "Länge",
          valueMetric: "Wert (Metrik)",
          metadata: "Metadaten",
          skip: "Überspringen"
        },
        confidence: {
          high: "Hoch",
          medium: "Medium",
          low: "Niedrig"
        },
        askAbby: "Fragen Sie Abby",
        abbyOnColumn: "Abby auf „{{column}}“:",
        thinking: "Denken...",
        saving: "Sparen...",
        continue: "Weitermachen"
      },
      validate: {
        validating: "Validierung...",
        validationFailed: "Validierung fehlgeschlagen:",
        unknownError: "Unbekannter Fehler",
        results: "Validierungsergebnisse",
        stats: {
          totalRows: "Gesamtzahl der Zeilen",
          uniqueGeographies: "Einzigartige Geografien",
          matched: "Passend",
          unmatched: "Nicht übereinstimmend (Stubs)",
          matchRate: "Übereinstimmungsrate",
          geographyType: "Geographietyp"
        },
        unmatchedWarning: "{{count}}-Geografien wurden nicht in der Datenbank gefunden. Es werden Stub-Einträge erstellt (keine Grenzgeometrie).",
        backToMapping: "Zurück zur Zuordnung",
        proceedWithImport: "Fahren Sie mit dem Import fort"
      },
      import: {
        starting: "Beginnt...",
        startImport: "Starten Sie den Import",
        importing: "Importiert... {{progress}}%",
        complete: "Import abgeschlossen",
        rowsImported: "{{count}}-Zeilen importiert",
        saveLearningPrompt: "Speichern Sie Zuordnungen, damit Abby für das nächste Mal lernt",
        saveToAbby: "Speichern Sie auf Abby",
        viewInGisExplorer: "Im GIS-Explorer anzeigen",
        importAnother: "Andere importieren",
        failed: "Import fehlgeschlagen",
        startOver: "Beginnen Sie von vorne"
      }
    },
    chromaStudio: {
      title: "Chroma Collection Studio",
      subtitle: "Untersuchen Sie Vektorsammlungen, führen Sie semantische Abfragen aus und verwalten Sie die Aufnahme",
      values: {
        collectionCount: "{{count}}-Sammlungen",
        loading: "Laden",
        loadingEllipsis: "Laden...",
        countSuffix: "({{count}})",
        sampledSuffix: "({{count}} abgetastet)"
      },
      actions: {
        refreshCollections: "Sammlungen aktualisieren",
        ingestDocs: "Dokumente aufnehmen",
        ingestClinical: "Klinisch einnehmen",
        promoteFaq: "Bewerben Sie FAQ",
        ingestOhdsiPapers: "Nehmen Sie OHDSI-Papiere auf",
        ingestOhdsiKnowledge: "Nehmen Sie OHDSI-Wissen auf",
        ingestTextbooks: "Lehrbücher aufnehmen"
      },
      stats: {
        vectors: "Vectors",
        sampled: "Probiert",
        dimensions: "Abmessungen",
        metaFields: "Metafelder"
      },
      messages: {
        loadingCollectionData: "Sammlungsdaten werden geladen..."
      },
      empty: {
        title: "Diese Sammlung ist leer",
        description: "Verwenden Sie die oben genannten Ingest-Aktionen, um „{{collection}}“ mit Dokumenten zu füllen.",
        noRecords: "Keine Datensätze in dieser Sammlung.",
        noDocumentReturned: "Kein Dokument zurückgegeben.",
        noDocumentText: "Kein Dokumenttext verfügbar."
      },
      tabs: {
        overview: "Überblick",
        retrieval: "Abruf"
      },
      search: {
        placeholder: "Semantische Abfrage...",
        recentQueries: "Aktuelle Anfragen",
        kLabel: "K:",
        queryAction: "Abfrage",
        empty: "Geben Sie oben eine Abfrage ein und klicken Sie auf Abfrage, um die Abrufergebnisse zu überprüfen.",
        queryLabel: "Abfrage:",
        resultsCount: "{{count}}-Ergebnisse",
        querying: "Abfrage...",
        distance: "Distanz"
      },
      overview: {
        facetDistribution: "Facettenverteilung",
        sampleRecords: "Beispielaufzeichnungen",
        collectionMetadata: "Sammlungsmetadaten"
      }
    },
    vectorExplorer: {
      title: "Vector Explorer",
      semanticMapTitle: "{{dimensions}}D Semantische Karte",
      loading: {
        computingProjection: "Computerprojektion",
        runningProjection: "PCA->UMAP auf {{sample}}-Vektoren ausführen ...",
        recomputingProjection: "Projektion wird neu berechnet..."
      },
      values: {
        all: "alle",
        loadingEllipsis: "Laden...",
        countSuffix: "({{count}})",
        sampled: "{{count}} abgetastet",
        dimensions: "{{dimensions}}D",
        knnEdges: "k={{neighbors}} - {{edges}} Kanten",
        seconds: "{{seconds}}s",
        points: "{{count}} Pkt",
        cachedSuffix: "- zwischengespeichert",
        fallbackSuffix: "- zurückgreifen",
        timeSuffix: "- {{seconds}}s"
      },
      modes: {
        clusters: "Cluster",
        query: "Abfrage",
        qa: "QA"
      },
      sample: {
        label: "Probe",
        confirmLoadAll: "Alle {{count}}-Vektoren laden? Dies kann merklich länger dauern.",
        steps: {
          all: "Alle"
        }
      },
      empty: {
        selectCollection: "Wählen Sie eine Sammlung aus, um Einbettungen zu visualisieren."
      },
      tooltips: {
        requiresAiService: "Erfordert Verbindung zum KI-Dienst"
      },
      controls: {
        colorBy: "Malen nach",
        modeDefault: "Modus-Standard"
      },
      search: {
        placeholder: "Suche im Vektorraum",
        searching: "Suche...",
        search: "Suchen",
        visibleResults: "{{visible}} von {{total}} ergibt in dieser Projektion sichtbare Ergebnisse"
      },
      query: {
        anchor: "Abfrageanker"
      },
      sections: {
        overlays: "Überlagerungen",
        clusterProfile: "Clusterprofil",
        inspector: "Inspektor"
      },
      inspector: {
        selectPoint: "Klicken Sie auf einen Punkt, um ihn zu überprüfen.",
        loadingDetails: "Vollständige Details werden geladen...",
        flags: {
          outlier: "Ausreißer",
          duplicate: "Duplikat",
          orphan: "Waise"
        }
      },
      overlays: {
        clusterHulls: {
          label: "Cluster-Rümpfe",
          help: "Konvexe Hüllen um Cluster"
        },
        topologyLines: {
          label: "Topologielinien",
          help: "k-NN-Verbindungen zwischen nahegelegenen Punkten"
        },
        queryRays: {
          label: "Strahlen abfragen",
          help: "Ähnlichkeitslinks zwischen Anker und Ergebnis"
        }
      },
      stats: {
        totalVectors: "Gesamtvektoren",
        sampled: "Probiert",
        projection: "Vorsprung",
        knnGraph: "k-NN-Diagramm",
        source: "Quelle",
        projectionTime: "Projektionszeit",
        indexed: "Indiziert"
      },
      sources: {
        solrCached: "Solr (zwischengespeichert)",
        clientFallback: "Client-Fallback",
        liveUmap: "Live UMAP"
      },
      actions: {
        recomputeProjection: "Berechnen Sie die Projektion neu",
        expand: "Expandieren"
      },
      legend: {
        clusters: "Cluster",
        quality: "Qualität",
        similarity: "Ähnlichkeit",
        hide: "Verstecken",
        show: "Zeigen"
      },
      quality: {
        outliers: "Ausreißer",
        duplicates: "Duplikate",
        duplicatePairs: "Doppelte Paare",
        orphans: "Waisen",
        normal: "Normal",
        outOfSampled: "aus {{count}} abgetastet",
        exportCsv: "CSV exportieren"
      },
      clusterProfile: {
        selectCluster: "Wählen Sie einen Cluster aus, um seine dominanten Metadaten zu überprüfen.",
        clusterSize: "Clustergröße",
        dominantMetadata: "Dominante Metadaten",
        representativeTitles: "Repräsentative Titel"
      }
    },
    pacsConnectionModal: {
      title: {
        add: "PACS-Verbindung hinzufügen",
        edit: "Bearbeiten Sie die PACS-Verbindung"
      },
      description: "Konfigurieren Sie eine DICOM-Imaging-Serververbindung.",
      fields: {
        name: "Name",
        type: "Typ",
        authType: "Authentifizierungstyp",
        baseUrl: "Basis URL",
        username: "Benutzername",
        password: "Passwort",
        bearerToken: "Inhabertoken",
        linkedSource: "Verlinkte Quelle (optional)",
        active: "Aktiv"
      },
      placeholders: {
        name: "Haupt-PACS-Server",
        keepExisting: "Lassen Sie das Feld leer, damit es bestehen bleibt",
        password: "Passwort",
        token: "Token"
      },
      types: {
        orthanc: "Orthanc",
        dicomweb: "DICOMweb",
        googleHealthcare: "Google Healthcare",
        cloud: "Wolke"
      },
      auth: {
        none: "Keiner",
        basic: "Grundlegende Auth",
        bearer: "Inhabertoken"
      },
      values: {
        latency: "({{ms}}ms)"
      },
      actions: {
        testConnection: "Testverbindung",
        cancel: "Abbrechen",
        saveChanges: "Änderungen speichern",
        createConnection: "Verbindung herstellen"
      },
      errors: {
        testRequestFailed: "Die Testanforderung ist fehlgeschlagen",
        saveFailed: "Die Verbindung konnte nicht gespeichert werden"
      }
    },
    users: {
      title: "Benutzer",
      summary: {
        totalAccounts: "Gesamtkonten"
      },
      empty: {
        loading: "Laden...",
        noUsers: "Keine Benutzer gefunden",
        adjustFilters: "Versuchen Sie, Ihre Suche oder Filter anzupassen."
      },
      deleteModal: {
        title: "Benutzer löschen?",
        description: "werden dauerhaft gelöscht und alle ihre API-Tokens widerrufen.",
        irreversible: "Dies kann nicht rückgängig gemacht werden."
      },
      actions: {
        cancel: "Abbrechen",
        deleting: "Löschen...",
        delete: "Löschen",
        adminEmailer: "Admin-E-Mailer",
        newUser: "Neuer Benutzer",
        editUser: "Benutzer bearbeiten",
        deleteUser: "Benutzer löschen"
      },
      filters: {
        searchPlaceholder: "Name oder E-Mail suchen...",
        allRoles: "Alle Rollen"
      },
      table: {
        name: "Name",
        email: "E-Mail",
        lastActive: "Zuletzt aktiv",
        joined: "Beigetreten",
        roles: "Rollen"
      },
      values: {
        never: "Niemals"
      },
      pagination: {
        page: "Seite",
        of: "von",
        users: "Benutzer"
      }
    },
    userAudit: {
      title: "Benutzerüberwachungsprotokoll",
      subtitle: "Verfolgen Sie Anmeldeereignisse, Funktionszugriff und Sicherheitsaktionen für alle Benutzer.",
      actions: {
        login: "Login",
        logout: "Abmelden",
        passwordChanged: "Passwort geändert",
        passwordReset: "Passwort zurücksetzen",
        featureAccess: "Funktionszugriff"
      },
      empty: {
        noMatching: "Keine passenden Ereignisse",
        noEvents: "Noch keine Audit-Ereignisse",
        adjustFilters: "Versuchen Sie, Ihre Filter oder den Datumsbereich anzupassen.",
        description: "Prüfereignisse werden aufgezeichnet, wenn sich Benutzer anmelden und auf Plattformfunktionen zugreifen."
      },
      stats: {
        loginsToday: "Anmeldungen heute",
        activeUsers7d: "Aktive Benutzer (7 Tage)",
        totalEvents: "Gesamtzahl der Ereignisse",
        topFeature: "Top-Feature"
      },
      sections: {
        mostAccessedFeatures: "Am häufigsten aufgerufene Funktionen – Letzte 7 Tage"
      },
      filters: {
        searchPlaceholder: "Benutzer, Funktion, IP suchen...",
        allActions: "Alle Aktionen",
        clearAll: "Alles löschen"
      },
      table: {
        time: "Zeit",
        user: "Benutzer",
        action: "Aktion",
        feature: "Besonderheit",
        ipAddress: "IP-Adresse"
      },
      pagination: {
        page: "Seite",
        of: "von",
        events: "Ereignisse"
      }
    },
    serviceDetail: {
      actions: {
        backToSystemHealth: "Zurück zur Systemgesundheit",
        systemHealth: "Systemgesundheit",
        refresh: "Aktualisieren",
        manageSolrCores: "Verwalten Sie Solr-Kerne"
      },
      empty: {
        serviceNotFound: "Dienst nicht gefunden.",
        noLogs: "Keine aktuellen Protokolleinträge verfügbar."
      },
      values: {
        checkedAt: "Bei {{time}} überprüft",
        entriesCount: "({{count}}-Einträge)",
        yes: "Ja",
        no: "NEIN"
      },
      sections: {
        metrics: "Metriken",
        recentLogs: "Aktuelle Protokolle"
      },
      pacs: {
        title: "PACS-Verbindungen",
        addConnection: "Verbindung hinzufügen",
        empty: "Keine PACS-Verbindungen konfiguriert."
      },
      darkstar: {
        ohdsiPackages: "OHDSI HADES Pakete",
        positPackages: "Posit / CRAN-Pakete",
        installedCount: "({{count}} installiert)"
      }
    },
    atlasMigration: {
      steps: {
        connect: "Verbinden",
        discover: "Entdecken",
        select: "Wählen",
        import: "Import",
        summary: "Zusammenfassung"
      },
      entityTypes: {
        conceptSets: "Konzeptsätze",
        cohortDefinitions: "Kohortendefinitionen",
        incidenceRates: "Inzidenzraten",
        characterizations: "Charakterisierungen",
        pathways: "Wege",
        estimations: "Schätzungen",
        predictions: "Vorhersagen"
      },
      connect: {
        title: "Verbinden Sie sich mit Atlas WebAPI",
        description: "Geben Sie den Basiswert URL Ihrer vorhandenen OHDSI WebAPI-Instanz ein. Parthenon verbindet und inventarisiert alle verfügbaren Entitäten für die Migration.",
        webapiUrl: "WebAPI Basis URL",
        authentication: "Authentication",
        auth: {
          none: "Keine (öffentliches WebAPI)",
          basic: "Grundlegendes Authentication",
          bearer: "Inhabertoken"
        },
        credentials: "Anmeldeinformationen (Benutzername:Passwort)",
        bearerToken: "Inhabertoken",
        testConnection: "Testverbindung",
        webapiVersion: "WebAPI-Version: {{version}}"
      },
      discover: {
        discovering: "Entitäten entdecken...",
        querying: "Alle WebAPI-Endpunkte parallel abfragen",
        title: "Atlas-Inventar",
        summary: "Migrationsfähige {{count}}-Entitäten in allen {{categories}}-Kategorien gefunden.",
        sourcesFound: "Außerdem wurden {{count}}-Datenquellen gefunden."
      },
      select: {
        title: "Wählen Sie die zu migrierenden Entitäten aus",
        description: "Wählen Sie aus, welche Entitäten importiert werden sollen. Abhängigkeiten werden automatisch aufgelöst.",
        analysisWarning: "Analyseentitäten können durch ID auf Kohortendefinitionen und Konzeptsätze verweisen. Parthenon ordnet diese Referenzen beim Import automatisch neu zu. Um optimale Ergebnisse zu erzielen, beziehen Sie die referenzierten Kohorten und Konzeptsätze in Ihre Auswahl ein.",
        selectedCount: "{{selected}}/{{total}} ausgewählt",
        totalSelected: "Für die Migration ausgewählte {{count}}-Entitäten"
      },
      import: {
        starting: "Migration wird gestartet...",
        importing: "Entitäten importieren...",
        complete: "Migration abgeschlossen",
        failed: "Migration fehlgeschlagen",
        processed: "Alle ausgewählten Entitäten wurden verarbeitet.",
        error: "Bei der Migration ist ein Fehler aufgetreten.",
        percentComplete: "{{percent}}% abgeschlossen",
        polling: "Abfrage nach Updates..."
      },
      summary: {
        successful: "Migration erfolgreich",
        completedWithWarnings: "Migration mit Warnungen abgeschlossen",
        failed: "Migration fehlgeschlagen",
        from: "Aus",
        duration: "Dauer: {{duration}}"
      },
      metrics: {
        total: "Gesamt",
        imported: "Importiert",
        skipped: "Übersprungen",
        failed: "Fehlgeschlagen"
      },
      table: {
        entityType: "Entitätstyp",
        category: "Kategorie"
      },
      actions: {
        selectAll: "Wählen Sie „Alle“ aus",
        deselectAll: "Alle abwählen",
        retryFailed: "Wiederholung fehlgeschlagen ({{count}})",
        done: "Erledigt",
        closeTitle: "Schließen – jederzeit über die Verwaltung zurückkehren",
        previous: "Vorherige",
        startMigration: "Starten Sie die Migration",
        next: "Nächste"
      },
      errors: {
        connectionFailed: "Verbindung fehlgeschlagen",
        discoveryFailed: "Die Ermittlung ist fehlgeschlagen"
      }
    },
    fhirExport: {
      title: "FHIR Massenexport",
      subtitle: "Exportieren Sie OMOP CDM-Daten als FHIR R4 NDJSON-Dateien für die Interoperabilität.",
      comingSoon: "Demnächst verfügbar",
      description: "Der FHIR-Massenexport ($export) befindet sich in der Entwicklung. Diese Funktion ermöglicht den Export von OMOP CDM-Daten als FHIR R4 NDJSON-Dateien für die Interoperabilität.",
      backendPending: "Die Backend-Endpunkte für diese Funktion wurden noch nicht implementiert."
    },
    fhirConnections: {
      title: "FHIR EHR Verbindungen",
      subtitle: "Konfigurieren Sie SMART-Backend-Services-Verbindungen für FHIR R4-Massendatenextraktion von Epic, Cerner und anderen EHR-Systemen.",
      runMetrics: {
        extracted: "Extrahiert",
        mapped: "Kartiert",
        written: "Geschrieben",
        failed: "Fehlgeschlagen",
        mappingCoverage: "Kartierungsabdeckung"
      },
      history: {
        loading: "Synchronisierungsverlauf wird geladen...",
        empty: "Es wird noch keine Synchronisierung ausgeführt.",
        status: "Status",
        started: "Begonnen",
        duration: "Dauer",
        metrics: "Metriken",
        title: "Verlauf synchronisieren"
      },
      dialog: {
        editTitle: "Bearbeiten Sie die FHIR-Verbindung",
        addTitle: "FHIR-Verbindung hinzufügen",
        description: "Konfigurieren Sie eine SMART-Backend-Services-Verbindung zu einem EHR FHIR R4-Endpunkt."
      },
      labels: {
        siteName: "Site-Name",
        siteKey: "Site-Schlüssel (Slug)",
        ehrVendor: "EHR-Anbieter",
        fhirBaseUrl: "FHIR Basis URL",
        tokenEndpoint: "Token-Endpunkt",
        clientId: "Client ID",
        rsaPrivateKey: "RSA privater Schlüssel (PEM)",
        scopes: "Bereiche",
        groupId: "Gruppe ID (für Massenexport)",
        exportResourceTypes: "Ressourcentypen exportieren (durch Kommas getrennt, leer = alle)",
        active: "Aktiv",
        incrementalSync: "Inkrementelle Synchronisierung"
      },
      vendors: {
        epic: "Epos",
        cerner: "Cerner (Oracle Health)",
        other: "Andere FHIR R4"
      },
      placeholders: {
        siteName: "Johns Hopkins-Epos",
        keepExistingKey: "Lassen Sie das Feld leer, um den vorhandenen Schlüssel beizubehalten",
        resourceTypes: "Patient, Zustand, Begegnung, Medikamentenanfrage, Beobachtung, Verfahren"
      },
      actions: {
        cancel: "Abbrechen",
        saveChanges: "Änderungen speichern",
        createConnection: "Verbindung herstellen",
        testConnection: "Testverbindung",
        edit: "Bearbeiten",
        delete: "Löschen",
        details: "Einzelheiten",
        syncMonitor: "Synchronisierungsmonitor",
        addConnection: "Verbindung hinzufügen"
      },
      messages: {
        failedToSave: "Speichern fehlgeschlagen",
        failedToStartSync: "Die Synchronisierung konnte nicht gestartet werden",
        deleteConfirm: "„{{name}}“ löschen?",
        noConnections: "Keine FHIR-Verbindungen konfiguriert",
        noConnectionsDescription: "Fügen Sie eine Verbindung hinzu, um mit der Extraktion klinischer Daten von einem EHR über FHIR R4 Bulk Data zu beginnen."
      },
      sync: {
        activateFirst: "Zuerst die Verbindung aktivieren",
        uploadKeyFirst: "Laden Sie zunächst einen privaten Schlüssel hoch",
        inProgress: "Synchronisierung läuft",
        incrementalTitle: "Inkrementelle Synchronisierung (nur neue Daten)",
        fullSync: "Vollständige Synchronisierung",
        sync: "Synchronisieren",
        incrementalSync: "Inkrementelle Synchronisierung",
        incrementalDescription: "Nur neue/aktualisierte Daten seit der letzten Synchronisierung",
        fullDescription: "Laden Sie alle Daten von EHR herunter",
        forceFullSync: "Vollständige Synchronisierung erzwingen",
        forceFullDescription: "Laden Sie alle Daten erneut herunter und deduplizieren Sie sie beim Schreiben"
      },
      values: {
        percent: "{{value}}%",
        byUser: "von {{name}}",
        keyUploaded: "Schlüssel hochgeladen",
        noKey: "Kein Schlüssel",
        lastSync: "Letzte Synchronisierung: {{date}}",
        records: "{{count}}-Datensätze",
        testElapsed: "{{message}} ({{elapsed}}ms)",
        allSupported: "Alle unterstützt",
        enabled: "Aktiviert",
        disabled: "Deaktiviert",
        since: "(seit {{date}})",
        notSet: "Nicht festgelegt",
        never: "Niemals"
      },
      details: {
        tokenEndpoint: "Token-Endpunkt:",
        clientId: "Client ID:",
        scopes: "Geltungsbereiche:",
        groupId: "Gruppe ID:",
        resourceTypes: "Ressourcentypen:",
        incremental: "Inkrementell:",
        targetSource: "Zielquelle:",
        syncRuns: "Synchronisierung läuft:"
      },
      stats: {
        totalConnections: "Gesamtzahl der Verbindungen",
        active: "Aktiv",
        keysConfigured: "Schlüssel konfiguriert",
        lastSync: "Letzte Synchronisierung"
      }
    },
    vocabulary: {
      title: "Vokabelmanagement",
      subtitle: "Aktualisieren Sie OMOP-Vokabulartabellen von einem Athena-Download ZIP.",
      status: {
        pending: "In der Warteschlange",
        running: "Läuft",
        completed: "Vollendet",
        failed: "Fehlgeschlagen"
      },
      log: {
        title: "Protokoll importieren",
        noOutput: "(noch keine Ausgabe)"
      },
      labels: {
        schema: "Schema:",
        source: "Quelle:",
        rowsLoaded: "Geladene Zeilen:",
        duration: "Dauer:",
        by: "Von:",
        progress: "Fortschritt",
        optional: "(optional)"
      },
      values: {
        seconds: "{{value}}s"
      },
      actions: {
        refresh: "Aktualisieren",
        remove: "Entfernen",
        uploading: "Hochladen...",
        startImport: "Starten Sie den Import"
      },
      upload: {
        title: "Laden Sie den Athena-Vokabular ZIP hoch",
        descriptionPrefix: "Laden Sie ein Vokabelpaket herunter von",
        descriptionMiddle: "und lade es hier hoch.",
        descriptionSuffix: "Der Import läuft als Hintergrundjob und kann je nach Vokabulargröße 15–60 Minuten dauern.",
        maxFileSize: "Dateien bis zu 5 GB werden unterstützt",
        dropHere: "Lassen Sie Athena ZIP hier fallen",
        browse: "oder klicken Sie zum Durchsuchen",
        targetSource: "Ziel CDM Quelle",
        defaultSchema: "Standardvokabularschema",
        sourceHelpPrefix: "Wählt das Vokabularschema der Quelle aus, das durch den Import gefüllt wird. Wenn keine Quelle ausgewählt ist, wird die Standardeinstellung verwendet",
        sourceHelpSuffix: "Verbindungsschema verwendet wird."
      },
      instructions: {
        title: "So erhalten Sie ein Vokabular ZIP von Athena",
        signInPrefix: "Besuchen",
        signInSuffix: "und melden Sie sich an.",
        selectDomains: "Wählen Sie die Vokabulardomänen und -versionen aus, die Sie benötigen (z. B. SNOMED, RxNorm, LOINC).",
        clickPrefix: "Klicken",
        downloadVocabularies: "Vokabeln herunterladen",
        clickSuffix: "- Athena sendet Ihnen per E-Mail einen Download-Link.",
        uploadZip: "Laden Sie ZIP herunter (normalerweise 500 MB-3 GB) und laden Sie es unten hoch."
      },
      messages: {
        deleteConfirm: "Diesen Importdatensatz löschen?",
        uploadFailed: "Hochladen fehlgeschlagen: {{message}}",
        unknownError: "Unbekannter Fehler",
        uploadSuccess: "ZIP erfolgreich hochgeladen. Der Importauftrag befindet sich in der Warteschlange. Überprüfen Sie unten den Fortschritt.",
        importRunning: "Derzeit läuft ein Import. Neue Uploads werden bis zum Abschluss deaktiviert."
      },
      history: {
        title: "Importverlauf",
        loading: "Laden...",
        empty: "Noch keine Vokabelimporte. Laden Sie oben ein Athena ZIP hoch, um loszulegen."
      }
    },
    systemHealth: {
      title: "Systemgesundheit",
      subtitle: "Live-Status aller Parthenon-Dienste. Automatische Aktualisierung alle 30 Sekunden.",
      serverStatus: "Serverstatus",
      lastChecked: "Zuletzt überprüft bei {{time}}",
      polling: "Umfragedienste...",
      gisDataManagement: "GIS-Datenverwaltung",
      status: {
        healthy: "Gesund",
        degraded: "Degradiert",
        down: "Runter"
      },
      overall: {
        healthy: "Gesund",
        needsAttention: "Aufmerksamkeit erforderlich"
      },
      labels: {
        pending: "Ausstehend:",
        failed: "Fehlgeschlagen:",
        cores: "Kerne:",
        documents: "Unterlagen:",
        dagster: "Dolch:",
        graphql: "GraphQL:",
        studies: "Studien:",
        instances: "Instanzen:",
        disk: "Scheibe:"
      },
      actions: {
        refresh: "Aktualisieren",
        openService: "Offener Dienst",
        viewDetails: "Details anzeigen"
      },
      tiers: {
        corePlatform: "Kernplattform",
        dataSearch: "Daten & Suche",
        aiAnalytics: "KI und Analytik",
        clinicalServices: "Klinische Dienstleistungen",
        monitoringCommunications: "Überwachung und Kommunikation",
        acropolisInfrastructure: "Acropolis-Infrastruktur",
        unknown: "Andere Dienstleistungen"
      },
      hades: {
        title: "OHDSI-Paketparität",
        subtitle: "Darkstar-Paketabdeckung für erstklassige, native und Kompatibilitätsarbeit.",
        checking: "Darkstar-Pakete werden überprüft...",
        unavailable: "Das Darkstar-Paketinventar ist nicht verfügbar.",
        installed: "Installiert:",
        missing: "Fehlen:",
        total: "Gesamt:",
        requiredMissing: "Erforderlich fehlt:",
        shinyPolicy: "Legacy-Shiny-Richtlinie",
        notExposed: "nicht ausgesetzt",
        shinyPolicyDescription: "Gehostete Shiny-Apps, Iframe-Einbettung und vom Benutzer bereitgestellte App-Pfade sind deaktiviert. OHDSI Shiny-Pakete bleiben nur Laufzeitkompatibilitätsartefakte.",
        replacement: "Ersatz: {{surface}}",
        package: "Paket",
        capability: "Fähigkeit",
        priority: "Priorität",
        surface: "Oberfläche",
        source: "Quelle",
        runtime: "Laufzeit",
        status: {
          complete: "Vollständig",
          partial: "Teilweise"
        }
      }
    },
    fhirSync: {
      title: "FHIR Sync-Monitor",
      subtitle: "Echtzeit-Überwachung der ETL-Pipeline über alle FHIR-Verbindungen hinweg",
      status: {
        completed: "Vollendet",
        running: "Läuft",
        pending: "Ausstehend",
        exporting: "Exportieren",
        downloading: "Herunterladen",
        processing: "Verarbeitung",
        failed: "Fehlgeschlagen"
      },
      timeline: {
        empty: "Keine Synchronisierungsaktivität in den letzten 30 Tagen",
        tooltip: "{{date}}: {{completed}} abgeschlossen, {{failed}} fehlgeschlagen",
        hoverSummary: "{{completed}} ok / {{failed}} fehlgeschlagen"
      },
      metrics: {
        extracted: "Extrahiert",
        mapped: "Kartiert",
        written: "Geschrieben",
        failed: "Fehlgeschlagen",
        averageMappingCoverage: "Durchschnittliche Kartenabdeckung"
      },
      actions: {
        viewError: "Fehler anzeigen"
      },
      values: {
        runs: "{{count}} läuft",
        never: "Niemals",
        activeRuns: "{{count}} aktiv",
        refreshInterval: "{{seconds}}s aktualisieren",
        allTimeTotals: "Gesamtsummen aller Zeiten",
        lastRuns: "Letzte 20 über alle Verbindungen"
      },
      messages: {
        failedToLoad: "Das Laden der Dashboard-Daten ist fehlgeschlagen.",
        noConnections: "Keine Verbindungen konfiguriert",
        noRuns: "Es wird noch keine Synchronisierung ausgeführt"
      },
      stats: {
        connections: "Verbindungen",
        totalRuns: "Gesamtanzahl der Läufe",
        completed: "Vollendet",
        failed: "Fehlgeschlagen",
        recordsWritten: "Aufzeichnungen geschrieben",
        avgCoverage: "Durchschnittliche Abdeckung"
      },
      panels: {
        pipelineThroughput: "Pipeline-Durchsatz",
        syncActivity: "Synchronisierungsaktivität (30 Tage)",
        connectionHealth: "Verbindungszustand",
        recentRuns: "Letzte Synchronisierungsläufe"
      },
      table: {
        status: "Status",
        connection: "Verbindung",
        started: "Begonnen",
        duration: "Dauer",
        metrics: "Metriken"
      }
    },
    gisData: {
      title: "GIS-Grenzdaten",
      subtitle: "Verwalten Sie geografische Grenzdatensätze für den GIS Explorer",
      status: {
        loaded: "geladen",
        empty: "leer"
      },
      tabs: {
        boundaries: "Grenzen",
        dataImport: "Datenimport"
      },
      messages: {
        checking: "Grenzdaten werden überprüft...",
        noBoundaryData: "Keine Grenzdaten geladen. Wählen Sie unten eine Quelle und Ebenen aus, um zu beginnen."
      },
      labels: {
        boundaries: "Grenzen:",
        countries: "Länder:"
      },
      load: {
        title: "Grenzen laden",
        adminLevels: "Zu ladende Admin-Level:"
      },
      sources: {
        gadm: {
          name: "GADM v4.1",
          description: "Globale Verwaltungsbereiche – 356.000 Grenzen auf 6 Verwaltungsebenen"
        },
        geoboundaries: {
          name: "geoBoundaries CGAZ",
          description: "Vereinfachte Grenzen für kartografische Konsistenz (ADM0-2)"
        }
      },
      levels: {
        adm0: "Länder (ADM0)",
        adm1: "Staaten / Provinzen (ADM1)",
        adm2: "Bezirke / Landkreise (ADM2)",
        adm3: "Unterbezirke (ADM3)"
      },
      actions: {
        preparing: "Vorbereiten...",
        generateLoadCommand: "Ladebefehl generieren",
        refreshStats: "Statistiken aktualisieren",
        copyToClipboard: "In die Zwischenablage kopieren",
        close: "Schließen"
      },
      modal: {
        runOnHost: "Auf Host ausführen",
        description: "GIS-Daten werden direkt in das lokale PostgreSQL 17 geladen. Führen Sie diesen Befehl im Projektstammverzeichnis aus:",
        datasetFlagPrefix: "Der",
        datasetFlagSuffix: "Flag ermöglicht die Fortschrittsverfolgung. Aktualisieren Sie die Statistiken, nachdem das Skript abgeschlossen ist."
      },
      job: {
        title: "GIS-Grenzen werden geladen",
        description: "Quelle: {{source}} | Level: {{levels}}"
      },
      values: {
        all: "alle"
      }
    },
    honestBroker: {
      title: "Ehrlicher Makler",
      subtitle: "Registrieren Sie verblindete Umfrageteilnehmer, verknüpfen Sie sie mit OMOP-Personen-ID-Datensätzen und überwachen Sie den Einreichungsstatus, ohne den Forschern die Rohdaten der Befragten preiszugeben.",
      actions: {
        cancel: "Abbrechen",
        registerParticipant: "Teilnehmer registrieren",
        sendInvitation: "Einladung senden",
        sendInvite: "Einladung senden",
        refresh: "Aktualisieren",
        copyLink: "Link kopieren",
        openSurvey: "Umfrage öffnen",
        resend: "Erneut senden",
        revoke: "Widerrufen"
      },
      labels: {
        personId: "Person ID",
        notes: "Notizen",
        participant: "Teilnehmer",
        deliveryEmail: "Liefer-E-Mail",
        unknown: "Unbekannt",
        unknownInstrument: "Unbekanntes Instrument",
        notYet: "Noch nicht",
        notRecorded: "Nicht aufgezeichnet",
        system: "System",
        statusToken: "{{status}} · {{token}}",
        tokenReference: "...{{token}}"
      },
      metrics: {
        brokerCampaigns: "Broker-Kampagnen",
        registeredParticipants: "Registrierte Teilnehmer",
        submitted: "Eingereicht",
        invitationsSent: "Einladungen gesendet",
        complete: "Vollständig",
        pending: "Ausstehend",
        seeded: "Gesät",
        registered: "Eingetragen",
        completion: "Fertigstellung",
        completionPercent: "{{value}}%"
      },
      campaignStatuses: {
        draft: "Entwurf",
        active: "Aktiv",
        closed: "Geschlossen"
      },
      matchStatuses: {
        submitted: "Eingereicht",
        registered: "Eingetragen",
        pending: "Ausstehend",
        matched: "Passend"
      },
      deliveryStatuses: {
        pending: "Ausstehend",
        queued: "In der Warteschlange",
        sent: "Gesendet",
        opened: "Geöffnet",
        submitted: "Eingereicht",
        revoked: "Widerrufen",
        failed: "Fehlgeschlagen"
      },
      unauthorized: {
        title: "Ehrlicher Broker-Zugang erforderlich",
        description: "Dieser Arbeitsbereich ist auf Datenverwalter und Administratoren beschränkt, da er blinde Umfrageidentitäten mit Patientenakten verknüpft."
      },
      registerModal: {
        title: "Teilnehmer registrieren",
        titleWithCampaign: "Teilnehmer registrieren · {{campaign}}",
        registering: "Registrieren...",
        description: "Erstellen Sie für diese Umfragekampagne einen blinden Registrierungseintrag, der eine Befragten-ID einem Patientendatensatz zuordnet.",
        respondentIdentifier: "Befragten-ID",
        respondentPlaceholder: "MRN, Lerncode oder Einladungscode",
        personIdPlaceholder: "Bekannte OMOP person_id",
        notesPlaceholder: "Optionale Maklerhinweise"
      },
      inviteModal: {
        title: "Einladung senden",
        titleWithCampaign: "Einladung senden · {{campaign}}",
        sending: "Senden...",
        description: "Senden Sie einen einmaligen, vom Broker verwalteten Umfragelink. Nur der Makler behält die Lieferadresse und die Lieferkette.",
        selectParticipant: "Teilnehmer auswählen",
        participantWithPerson: "{{blindedId}} · Person {{personId}}",
        emailPlaceholder: "patient@example.org",
        lastInvitation: "Letzte Einladung: {{status}} · Token mit der Endung {{token}}"
      },
      campaignRegistry: {
        title: "Kampagnenregister",
        subtitle: "Nur von ehrlichen Brokern unterstützte Kampagnen.",
        loading: "Kampagnen werden geladen...",
        emptyPrefix: "Noch keine Ehrlich-Makler-Kampagnen. Aktivieren",
        requireHonestBroker: "Erfordern Sie einen ehrlichen Makler",
        emptySuffix: "zunächst auf einer Umfragekampagne."
      },
      messages: {
        selectCampaignManage: "Wählen Sie eine Kampagne aus, um Broker-Registrierungen zu verwalten.",
        selectCampaignReview: "Wählen Sie eine Kampagne aus, um Broker-Registrierungen zu überprüfen."
      },
      participants: {
        title: "Registrierte Teilnehmer",
        subtitle: "Anonymisierte Registrierungseinträge für die ausgewählte Umfragekampagne.",
        searchPlaceholder: "Suche nach Blind-ID, Personen-ID, Notizen ...",
        loading: "Anmeldungen werden geladen...",
        noMatches: "Keine Broker-Registrierungen entsprechen dem aktuellen Filter."
      },
      invitations: {
        title: "Einladungsbuch",
        subtitle: "Outbound- und Inbound-Chain-of-Custody für von Brokern verwaltete Umfrageeinladungen.",
        loading: "Einladungen werden geladen...",
        empty: "Für diese Kampagne wurden noch keine Einladungen verschickt."
      },
      audit: {
        title: "Prüfpfad",
        subtitle: "Unveränderliche, maklerseitige Überwachungskette für Teilnehmerregistrierung, ausgehende Einladungen und eingehende Antwortereignisse.",
        loading: "Audit-Trail wird geladen...",
        empty: "Es wurden noch keine Broker-Audit-Ereignisse aufgezeichnet."
      },
      latest: {
        title: "Neuester übereinstimmender Datensatz",
        blindedId: "Geblendeter ID",
        created: "Erstellt"
      },
      table: {
        blindedParticipant: "Geblendeter Teilnehmer",
        conductId: "Führen Sie ID durch",
        status: "Status",
        submitted: "Eingereicht",
        contact: "Kontakt",
        latestInvite: "Letzte Einladung",
        destination: "Ziel",
        sent: "Gesendet",
        opened: "Geöffnet",
        reference: "Referenz",
        actions: "Aktionen",
        time: "Zeit",
        action: "Aktion",
        actor: "Schauspieler",
        inviteRef: "Ref. einladen",
        metadata: "Metadaten"
      },
      auditActions: {
        participant_registered: "Teilnehmer registriert",
        invitation_sent: "Einladung gesendet",
        invitation_resent: "Einladung erneut gesendet",
        invitation_revoked: "Einladung widerrufen",
        response_submitted: "Antwort gesendet",
        status_changed: "Status geändert"
      },
      confirmRevoke: "Einladung widerrufen bis {{token}}?",
      toasts: {
        publishLinkCopied: "Veröffentlichungslink kopiert",
        publishLinkCopyFailed: "Der Veröffentlichungslink konnte nicht kopiert werden",
        participantRegistered: "Teilnehmer angemeldet",
        participantRegisterFailed: "Teilnehmer konnte nicht registriert werden",
        invitationSent: "Einladung gesendet · Token mit der Endung {{token}}",
        invitationSendFailed: "Einladung konnte nicht gesendet werden",
        invitationResent: "Einladung erneut gesendet · Token endet {{token}}",
        invitationResendFailed: "Die Einladung konnte nicht erneut gesendet werden",
        invitationRevoked: "Einladung widerrufen · Token endet {{token}}",
        invitationRevokeFailed: "Die Einladung konnte nicht widerrufen werden"
      }
    }
  },
});

const ptApp: MessageTree = mergeMessageTrees(enApp, {
  errors: {
    boundary: {
      title: "Algo deu errado",
      message: "Ocorreu um erro inesperado. Tente recarregar a página.",
      reloadPage: "Recarregar página",
    },
    route: {
      routeError: "Erro de rota",
      pageFailed: "A página não pôde ser renderizada.",
      analysisDescription:
        "Esta página de análise encontrou um erro de renderização ou carregamento de rota.",
      label: "Erro",
      backToAnalyses: "Voltar para análises",
      reloadPage: "Recarregar página",
    },
  },
  analysis: {
    titles: {
      characterization: "Caracterização",
      incidenceRate: "Análise de taxa de incidência",
      pathway: "Análise de trajetória",
      estimation: "Análise de estimativa",
      prediction: "Análise de predição",
      sccs: "Análise SCCS",
      evidenceSynthesis: "Análise de síntese de evidências",
    },
  },
  studies: {
    list: {
      title: "Estudos",
      subtitle: "Orquestre e gerencie estudos de pesquisa federados",
      tableView: "Visualização de tabela",
      cardView: "Visualização de cartão",
      searchPlaceholder: "Pesquisar estudos...",
      noSearchMatches: "Nenhum estudo corresponde a \"{{query}}\"",
      typeToFilter: "Digite para filtrar estudos {{count}}",
      newStudy: "Novo estudo",
      solr: "Solr",
      drilldownTitle: "Estudos {{phase}}",
      filterLabels: {
        status: "Situação",
        type: "Tipo",
        priority: "Prioridade"
      },
      loadFailed: "Falha ao carregar estudos",
      clear: "Claro",
      empty: {
        noMatchingTitle: "Nenhum estudo correspondente",
        noStudiesTitle: "Ainda não há estudos",
        noResultsFor: "Nenhum estudo encontrado para \"{{query}}\"",
        tryAdjusting: "Tente ajustar seus termos de pesquisa.",
        createFirst: "Crie seu primeiro estudo para orquestrar pesquisas federadas."
      },
      table: {
        title: "Título",
        type: "Tipo",
        status: "Situação",
        priority: "Prioridade",
        pi: "IP",
        created: "Criado"
      },
      pagination: {
        showing: "Mostrando {{start}} - {{end}} de {{total}}",
        page: "{{page}}/{{totalPages}}"
      }
    },
    metrics: {
      total: "Total geral",
      active: "Ativo",
      preStudy: "Pré-estudo",
      inProgress: "Em andamento",
      postStudy: "Pós-estudo"
    },
    studyTypes: {
      characterization: "Caracterização",
      populationLevelEstimation: "PLE",
      patientLevelPrediction: "PLP",
      comparativeEffectiveness: "Comparativo",
      safetySurveillance: "Segurança",
      drugUtilization: "Uso de medicamentos",
      qualityImprovement: "MQ",
      custom: "Personalizado"
    },
    statuses: {
      draft: "Rascunho",
      protocol_development: "Desenv. do protocolo",
      feasibility: "Viabilidade",
      irb_review: "Revisão pelo CEP/IRB",
      execution: "Execução",
      analysis: "Análise",
      published: "Publicado",
      archived: "Arquivado"
    },
    priorities: {
      critical: "Crítico",
      high: "Alto",
      medium: "Médio",
      low: "Baixo"
    },
    phases: {
      activeMetric: "Ativo",
      pre_study: "Pré-estudo",
      active: "Em andamento",
      post_study: "Pós-estudo"
    },
    create: {
      backToStudies: "Estudos",
      title: "Criar estudo",
      subtitle: "Configure seu estudo de pesquisa passo a passo",
      previous: "Anterior",
      next: "Próximo",
      createAsDraft: "Criar como rascunho",
      steps: {
        basics: "Noções básicas",
        science: "Design Científico",
        team: "Equipe e cronograma",
        review: "Revise e crie"
      },
      studyTypes: {
        characterization: {
          label: "Caracterização",
          description: "Descrever populações de pacientes e padrões de tratamento"
        },
        populationLevelEstimation: {
          label: "Estimativa de nível populacional",
          description: "Estimar efeitos causais usando dados observacionais"
        },
        patientLevelPrediction: {
          label: "Previsão em nível de paciente",
          description: "Preveja resultados individuais de pacientes"
        },
        comparativeEffectiveness: {
          label: "Eficácia Comparativa",
          description: "Compare tratamentos em ambientes reais"
        },
        safetySurveillance: {
          label: "Vigilância de Segurança",
          description: "Monitore os sinais de segurança de medicamentos pós-comercialização"
        },
        drugUtilization: {
          label: "Uso de medicamentos",
          description: "Analise padrões e tendências de uso de medicamentos"
        },
        qualityImprovement: {
          label: "Melhoria da Qualidade",
          description: "Avaliar a qualidade do atendimento e a adesão às diretrizes"
        },
        custom: {
          label: "Personalizado",
          description: "Defina um tipo de estudo personalizado"
        }
      },
      designs: {
        select: "Selecione o desenho...",
        retrospectiveCohort: "Coorte Retrospectiva",
        prospectiveCohort: "Coorte prospectiva",
        caseControl: "Caso-Controle",
        crossSectional: "Seccional",
        selfControlled: "Série de casos autocontrolados",
        nestedCaseControl: "Controle de caso aninhado",
        metaAnalysis: "Metanálise",
        networkStudy: "Estudo de rede",
        methodological: "Metodológico"
      },
      phases: {
        select: "Selecione a fase...",
        phaseI: "Fase I",
        phaseII: "Fase II",
        phaseIII: "Fase III",
        phaseIV: "Fase IV",
        notApplicable: "Não aplicável"
      },
      basics: {
        studyType: "Tipo de estudo *",
        title: "Título *",
        titlePlaceholder: "por exemplo, efeito das estatinas nos resultados cardiovasculares em T2DM",
        shortTitle: "Título curto",
        shortTitlePlaceholder: "por exemplo, LEGEND-T2DM",
        priority: "Prioridade",
        studyDesign: "Desenho do Estudo",
        description: "Descrição",
        descriptionPlaceholder: "Breve descrição do estudo...",
        tags: "Etiquetas",
        tagsPlaceholder: "Adicione a tag e pressione Enter...",
        addTag: "Adicionar etiqueta"
      },
      science: {
        aiPrompt: "Deixe a IA sugerir campos de desenho científico com base no título do estudo",
        generating: "Gerando...",
        generateWithAi: "Gerar com IA",
        aiUnavailable: "O serviço de IA está indisponível. Preencha os campos manualmente.",
        rationale: "Justificativa Científica",
        rationalePlaceholder: "Por que este estudo é necessário? Que lacuna no conhecimento ela aborda?",
        hypothesis: "Hipótese",
        hypothesisPlaceholder: "Indique a hipótese primária que está sendo testada...",
        primaryObjective: "Objetivo Primário",
        primaryObjectivePlaceholder: "Qual é o objetivo principal deste estudo?",
        secondaryObjectives: "Objetivos Secundários",
        secondaryObjectivePlaceholder: "Adicione o objetivo e pressione Enter...",
        addSecondaryObjective: "Adicionar objetivo secundário",
        fundingSource: "Fonte de financiamento",
        fundingSourcePlaceholder: "por exemplo, NIH R01, PCORI, patrocinado pela indústria"
      },
      team: {
        startDate: "Data de início do estudo",
        endDate: "Data de término do estudo",
        endDateAfterStart: "A data de término deve ser posterior à data de início",
        targetSites: "Sites de inscrição alvo",
        targetSitesPlaceholder: "por exemplo, 10",
        studyPhase: "Fase de Estudo",
        nctId: "ID do ClinicalTrials.gov",
        nctIdPlaceholder: "por exemplo, NCT12345678",
        note: "Os membros da equipe, sites e coortes podem ser configurados após a criação do estudo no painel do estudo."
      },
      review: {
        basics: "Noções básicas",
        scientificDesign: "Design Científico",
        timelineRegistration: "Cronograma e registro",
        labels: {
          title: "Título:",
          shortTitle: "Título curto:",
          type: "Tipo:",
          priority: "Prioridade:",
          design: "Projeto:",
          rationale: "Justificativa:",
          hypothesis: "Hipótese:",
          primaryObjective: "Objetivo Primário:",
          secondaryObjectives: "Objetivos Secundários:",
          start: "Começar:",
          end: "Fim:",
          targetSites: "Sites alvo:",
          phase: "Fase:",
          nctId: "ID NCT:",
          funding: "Financiamento:"
        }
      }
    },
    detail: {
      loadFailed: "Falha ao carregar o estudo",
      backToStudies: "De volta aos estudos",
      studies: "Estudos",
      confirmDelete: "Tem certeza de que deseja excluir este estudo? Esta ação não pode ser desfeita.",
      confirmArchive: "Arquivar este estudo? Ele pode ser restaurado mais tarde.",
      copyTitle: "Cópia de {{title}}",
      tabs: {
        overview: "Visão geral",
        design: "Projeto",
        analyses: "Análises",
        results: "Resultados",
        progress: "Progresso",
        sites: "Centros",
        team: "Equipe",
        cohorts: "Coortes",
        milestones: "Conquistas",
        artifacts: "Artefatos",
        activity: "Atividade",
        federated: "Federado"
      },
      statuses: {
        draft: "Rascunho",
        protocol_development: "Desenvolvimento de protocolo",
        feasibility: "Viabilidade",
        irb_review: "Revisão pelo CEP/IRB",
        recruitment: "Recrutamento",
        execution: "Execução",
        analysis: "Análise",
        synthesis: "Síntese",
        manuscript: "Manuscrito",
        published: "Publicado",
        archived: "Arquivado",
        withdrawn: "Retirado"
      },
      studyTypes: {
        characterization: "Caracterização",
        population_level_estimation: "Estimativa de nível populacional",
        patient_level_prediction: "Previsão em nível de paciente",
        comparative_effectiveness: "Eficácia Comparativa",
        safety_surveillance: "Vigilância de Segurança",
        drug_utilization: "Uso de medicamentos",
        quality_improvement: "Melhoria da Qualidade",
        custom: "Personalizado"
      },
      actions: {
        transitionTo: "Transição para",
        generateManuscriptTitle: "Gerar manuscrito a partir de análises concluídas",
        manuscript: "Manuscrito",
        duplicateStudy: "Duplicar estudo",
        exportJson: "Exportar como JSON",
        archiveStudy: "Arquivar estudo",
        deleteStudy: "Excluir estudo"
      },
      sections: {
        about: "Sobre",
        analysisPipeline: "Pipeline de análise ({{count}})",
        executionProgress: "Progresso da execução",
        details: "Detalhes",
        timeline: "Linha do tempo",
        tags: "Etiquetas",
        createdBy: "Criado por"
      },
      labels: {
        primaryObjective: "Objetivo Primário",
        hypothesis: "Hipótese",
        secondaryObjectives: "Objetivos Secundários",
        principalInvestigator: "Investigador Principal",
        leadDataScientist: "Cientista de Dados Líder",
        studyDesign: "Desenho do Estudo",
        phase: "Fase",
        protocolVersion: "Versão do protocolo",
        funding: "Financiamento",
        clinicalTrialsGov: "ClinicalTrials.gov",
        start: "Começar:",
        end: "Fim:",
        targetSites: "Sites alvo:",
        created: "Criado:"
      },
      messages: {
        noDescription: "Nenhuma descrição fornecida",
        moreAnalyses: "+{{count}} mais análises"
      },
      progress: {
        completed: "{{count}} concluído",
        running: "{{count}} em execução",
        failed: "{{count}} falhou",
        pending: "{{count}} pendente"
      }
    },
    dashboard: {
      progressSummary: "{{completed}} de {{total}} análises concluídas",
      stats: {
        total: "Total geral",
        pending: "Pendente",
        running: "Em execução",
        completed: "Concluído",
        failed: "Com falha"
      },
      sections: {
        studyAnalyses: "Análises de estudo"
      },
      table: {
        type: "Tipo",
        name: "Nome",
        status: "Situação"
      },
      messages: {
        notExecuted: "Não executado"
      },
      empty: {
        title: "Nenhuma análise neste estudo",
        message: "Adicione análises na guia Design para começar."
      }
    },
    analyses: {
      selectSource: "Selecione a fonte...",
      executeAll: "Executar tudo",
      addAnalysisToStudy: "Adicionar análise ao estudo",
      emptyMessage: "Adicione caracterizações, estimativas, previsões e muito mais para construir seu pipeline de análise",
      groupHeader: "{{label}} ({{count}})",
      openAnalysisDetail: "Abrir detalhe da análise",
      confirmRemove: "Remover esta análise do estudo?",
      removeFromStudy: "Remover do estudo",
      analysisId: "ID da análise",
      lastRun: "Última execução",
      error: "Erro",
      viewFullDetail: "Ver detalhes completos"
    },
    results: {
      sections: {
        results: "Resultados ({{count}})",
        syntheses: "Sínteses ({{count}})"
      },
      actions: {
        synthesize: "Sintetizar",
        markPrimary: "Marcar como principal",
        unmarkPrimary: "Remover marcação principal",
        markPublishable: "Marcar como publicável",
        unmarkPublishable: "Remover marcação de publicável",
        cancel: "Cancelar"
      },
      filters: {
        allTypes: "Todos os tipos",
        publishableOnly: "Somente publicável"
      },
      empty: {
        noResultsTitle: "Ainda não há resultados",
        noResultsMessage: "Os resultados aparecerão aqui após a execução das análises",
        noSummaryData: "Não há dados resumidos disponíveis",
        noSynthesesTitle: "Sem sínteses",
        noSynthesesMessage: "Combine resultados de vários sites usando meta-análise"
      },
      resultTypes: {
        cohort_count: "Contagem de coorte",
        characterization: "Caracterização",
        incidence_rate: "Taxa de incidência",
        effect_estimate: "Estimativa de efeito",
        prediction_performance: "Desempenho de previsão",
        pathway: "Caminho",
        sccs: "SCCS",
        custom: "Personalizado"
      },
      synthesisTypes: {
        fixed_effects_meta: "Meta-análise de efeitos fixos",
        random_effects_meta: "Meta-análise de efeitos aleatórios",
        bayesian_meta: "Metanálise Bayesiana",
        forest_plot: "Gráfico de floresta",
        heterogeneity_analysis: "Análise de Heterogeneidade",
        funnel_plot: "Gráfico de funil",
        evidence_synthesis: "Síntese de Evidências",
        custom: "Personalizado"
      },
      badges: {
        primary: "Primário",
        publishable: "Publicável"
      },
      messages: {
        resultCreated: "Resultado #{{id}} · {{date}}",
        reviewedBy: "Avaliado por {{name}}"
      },
      labels: {
        summary: "Resumo",
        diagnostics: "Diagnóstico"
      },
      pagination: {
        previous: "Anterior",
        next: "Próximo",
        page: "Página {{page}} de {{totalPages}}"
      },
      synthesis: {
        createTitle: "Criar Síntese",
        instructions: "Selecione 2 ou mais resultados acima e escolha um método de síntese.",
        createSelected: "Criar ({{count}} selecionado)",
        confirmDelete: "Excluir esta síntese?",
        resultsCount: "{{count}} resultados",
        system: "Sistema",
        methodSettings: "Configurações do método",
        output: "Saída",
        noOutput: "Nenhuma saída gerada ainda"
      }
    },
    federated: {
      loadingResults: "Carregando resultados...",
      loadResultsFailed: "Falha ao carregar resultados: {{error}}",
      unknownError: "Erro desconhecido",
      confirmDistribute: "Distribuir estudo para nó(s) de dados {{count}}?",
      arachneNotReachable: "Arachne Central não está acessível",
      loadNodesFailed: "Falha ao carregar nós Arachne",
      arachneConnectionHelp: "Configure ARACHNE_URL em seu ambiente para permitir a execução federada. Certifique-se de que o Arachne Central esteja em execução e acessível.",
      availableDataNodes: "Nós de dados disponíveis",
      poweredByArachne: "Desenvolvido por Arachne",
      distributeCount: "Distribuir ({{count}})",
      noNodes: "Nenhum nó Arachne configurado. Defina ARACHNE_URL no ambiente para permitir a execução federada.",
      distributionFailed: "Falha na distribuição: {{error}}",
      distributionSucceeded: "Estudo distribuído com sucesso. Status de monitoramento abaixo.",
      federatedExecutions: "Execuções Federadas",
      noExecutions: "Ainda não há execuções federadas. Selecione os nós de dados acima e distribua para começar.",
      arachneAnalysis: "Análise Arachne #{{id}}",
      statuses: {
        PENDING: "Pendente",
        EXECUTING: "Executando",
        COMPLETED: "Concluído",
        FAILED: "Com falha"
      },
      table: {
        name: "Nome",
        status: "Situação",
        cdmVersion: "Versão do CDM",
        patients: "Pacientes",
        lastSeen: "Visto pela última vez",
        node: "Nó",
        submitted: "Enviado",
        completed: "Concluído"
      }
    },
    artifacts: {
      sections: {
        artifacts: "Artefatos ({{count}})"
      },
      actions: {
        addArtifact: "Adicionar artefato",
        cancel: "Cancelar",
        create: "Criar",
        save: "Salvar",
        edit: "Editar artefato",
        delete: "Excluir artefato",
        openLink: "Abrir link"
      },
      form: {
        addTitle: "Adicionar artefato de estudo",
        title: "Título",
        titleRequired: "Título *",
        titlePlaceholder: "por exemplo, Protocolo de Estudo v2.1",
        version: "Versão",
        type: "Tipo",
        urlOptional: "URL (opcional)",
        description: "Descrição",
        descriptionOptional: "Descrição (opcional)",
        descriptionPlaceholder: "Breve descrição deste artefato..."
      },
      empty: {
        title: "Sem artefatos",
        message: "Armazene protocolos, pacotes de análise e documentos de estudo"
      },
      badges: {
        current: "Atual"
      },
      labels: {
        versionValue: "v{{version}}",
        sizeKb: "{{size}} KB"
      },
      messages: {
        unknown: "Desconhecido",
        uploadedBy: "{{name}} · {{date}}"
      },
      confirmDelete: "Excluir este artefato?",
      types: {
        protocol: "Protocolo",
        sap: "Plano de Análise Estatística",
        irb_submission: "Envio IRB",
        cohort_json: "Coorte JSON",
        analysis_package_r: "Pacote de análise R",
        analysis_package_python: "Pacote de análise Python",
        results_report: "Relatório de resultados",
        manuscript_draft: "Rascunho do Manuscrito",
        supplementary: "Material Suplementar",
        presentation: "Apresentação",
        data_dictionary: "Dicionário de dados",
        study_package_zip: "Pacote ZIP do estudo",
        other: "Outro"
      }
    },
    sites: {
      sections: {
        sites: "Centros ({{count}})"
      },
      actions: {
        addSite: "Adicionar centro",
        cancel: "Cancelar",
        save: "Salvar",
        edit: "Editar centro",
        remove: "Remover centro"
      },
      form: {
        addTitle: "Adicionar site de parceiro de dados",
        sourceSearchPlaceholder: "Pesquisar fontes de dados...",
        siteRole: "Função do centro",
        irbProtocol: "Protocolo IRB",
        notes: "Notas",
        optional: "Opcional"
      },
      empty: {
        title: "Nenhum centro inscrito",
        message: "Adicione centros parceiros de dados a este estudo"
      },
      table: {
        source: "Fonte",
        role: "Papel",
        status: "Situação",
        irb: "IRB nº",
        patients: "Pacientes",
        cdm: "CDM"
      },
      messages: {
        allSourcesAssigned: "Todas as fontes já estão atribuídas",
        noMatchingSources: "Nenhuma fonte correspondente",
        sourceFallback: "Fonte nº {{id}}"
      },
      confirmRemove: "Remover este centro?",
      roles: {
        data_partner: "Parceiro de dados",
        coordinating_center: "Centro de Coordenação",
        analytics_node: "Nó analítico",
        observer: "Observador"
      },
      statuses: {
        pending: "Pendente",
        invited: "Convidado",
        approved: "Aprovado",
        active: "Ativo",
        completed: "Concluído",
        withdrawn: "Retirado"
      }
    },
    cohorts: {
      sections: {
        cohorts: "Coortes ({{count}})"
      },
      actions: {
        assignCohort: "Atribuir coorte",
        assign: "Atribuir",
        cancel: "Cancelar",
        save: "Salvar",
        edit: "Editar atribuição de coorte",
        remove: "Remover atribuição de coorte"
      },
      form: {
        assignTitle: "Atribuir definição de coorte",
        cohortDefinition: "Definição de coorte",
        searchPlaceholder: "Pesquisar definições de coorte...",
        role: "Papel",
        label: "Rótulo",
        labelRequired: "Rótulo *",
        labelPlaceholder: "por exemplo, população-alvo T2DM",
        description: "Descrição",
        optional: "Opcional"
      },
      empty: {
        title: "Nenhuma coorte atribuída",
        message: "Atribua definições de coorte e especifique suas funções neste estudo"
      },
      messages: {
        allAssigned: "Todas as definições de coorte já estão atribuídas",
        noMatchingCohorts: "Nenhuma coorte correspondente",
        cohortFallback: "Coorte #{{id}}"
      },
      confirmRemove: "Remover esta atribuição de coorte?",
      roles: {
        target: "Alvo",
        comparator: "Comparador",
        outcome: "Resultado",
        exclusion: "Exclusão",
        subgroup: "Subgrupo",
        event: "Evento"
      }
    },
    team: {
      sections: {
        members: "Membros da equipe ({{count}})"
      },
      actions: {
        addMember: "Adicionar membro",
        cancel: "Cancelar",
        save: "Salvar",
        edit: "Editar membro da equipe",
        remove: "Remover membro da equipe"
      },
      form: {
        addTitle: "Adicionar membro da equipe",
        user: "Usuário",
        userSearchPlaceholder: "Pesquisar usuários por nome ou e-mail...",
        role: "Papel"
      },
      empty: {
        title: "Nenhum membro da equipe",
        message: "Adicione pesquisadores e colaboradores a este estudo"
      },
      table: {
        name: "Nome",
        email: "E-mail",
        role: "Papel",
        status: "Situação",
        joined: "Ingressou"
      },
      messages: {
        allUsersAssigned: "Todos os usuários já são membros da equipe",
        noMatchingUsers: "Nenhum usuário correspondente",
        userFallback: "Usuário #{{id}}"
      },
      confirmRemove: "Remover este membro da equipe?",
      statuses: {
        active: "Ativo",
        inactive: "Inativo"
      },
      roles: {
        principal_investigator: "Investigador Principal",
        co_investigator: "Co-Investigador",
        data_scientist: "Cientista de Dados",
        statistician: "Estatístico",
        site_lead: "Responsável pelo centro",
        data_analyst: "Analista de Dados",
        research_coordinator: "Coordenador de Pesquisa",
        irb_liaison: "Contato IRB",
        project_manager: "Gestor de projeto",
        observer: "Observador"
      },
      roleDescriptions: {
        principal_investigator: "Pesquisador principal responsável pelo estudo",
        co_investigator: "Pesquisador colaborador com supervisão do estudo",
        data_scientist: "Desenvolve e executa pipelines analíticos",
        statistician: "Análise estatística e metodologia",
        site_lead: "Gerencia as operações do site do parceiro de dados",
        data_analyst: "Processamento de dados e verificações de qualidade",
        research_coordinator: "Coordena a logística e os cronogramas do estudo",
        irb_liaison: "Gerencia envios e conformidade do IRB",
        project_manager: "Planejamento e acompanhamento geral do projeto",
        observer: "Acesso somente leitura aos materiais de estudo"
      }
    },
    milestones: {
      sections: {
        milestones: "Marcos ({{count}})"
      },
      actions: {
        addMilestone: "Adicionar marco",
        cancel: "Cancelar",
        create: "Criar",
        save: "Salvar",
        edit: "Editar marco",
        delete: "Excluir marco"
      },
      form: {
        titlePlaceholder: "Título do marco..."
      },
      empty: {
        title: "Sem marcos",
        message: "Acompanhe o progresso do estudo com marcos e datas previstas"
      },
      labels: {
        target: "Alvo: {{date}}",
        targetCompleted: "Alvo: {{target}} | Concluído: {{completed}}"
      },
      confirmDelete: "Excluir este marco?",
      types: {
        protocol: "Protocolo",
        irb: "IRB",
        data_access: "Acesso a dados",
        analysis: "Análise",
        review: "Análise",
        publication: "Publicação",
        custom: "Personalizado"
      },
      statuses: {
        pending: "Pendente",
        in_progress: "Em andamento",
        completed: "Concluído",
        overdue: "Atrasado",
        cancelled: "Cancelado"
      }
    },
    activity: {
      title: "Registro de atividades",
      empty: {
        title: "Nenhuma atividade ainda",
        message: "As ações realizadas neste estudo aparecerão aqui"
      },
      pagination: {
        previous: "Anterior",
        next: "Próximo",
        page: "Página {{page}} de {{totalPages}}"
      },
      actions: {
        created: "Criado",
        updated: "Atualizado",
        deleted: "Excluído",
        status_changed: "Situação alterada",
        member_added: "Membro adicionado",
        member_removed: "Membro removido",
        site_added: "Centro adicionado",
        analysis_added: "Análise adicionada",
        executed: "Executado"
      },
      entities: {
        study: "Estudo",
        study_analysis: "Análise do Estudo",
        study_artifact: "Artefato do estudo",
        study_cohort: "Coorte do estudo",
        study_milestone: "Marco do estudo",
        study_site: "Centro do estudo",
        study_team_member: "Membro da equipe do estudo"
      }
    },
    designer: {
      defaultSessionTitle: "Projeto {{title}} OHDSI",
      title: "Compilador de design de estudo OHDSI",
      subtitle: "Transforme uma questão de pesquisa revisada em conjuntos de conceitos rastreáveis, coortes, evidências de viabilidade, planos de análise prontos para HADES e um pacote de estudo bloqueado.",
      researchQuestionPlaceholder: "Entre adultos com..., ..., em comparação com..., reduz...",
      badges: {
        session: "Sessão {{value}}",
        version: "Versão {{value}}"
      },
      versionStatuses: {
        generated: "Gerado",
        review_ready: "Revisão pronta",
        accepted: "Aceito",
        locked: "Bloqueado"
      },
      metrics: {
        assets: "Recursos"
      },
      actions: {
        downloadLockedPackage: "Baixar pacote bloqueado",
        downloadPackage: "Baixar pacote",
        add: "Adicionar",
        saveChanges: "Salvar alterações"
      },
      sections: {
        verificationGates: "Etapas de verificação",
        packageProvenance: "Proveniência do pacote",
        assetEvidence: "Evidência dos recursos",
        basicInformation: "Informações básicas",
        addAnalysis: "Adicionar análise",
        studyAnalyses: "Análises de Estudo ({{count}})"
      },
      descriptions: {
        verificationGates: "Resolva os bloqueadores antes de bloquear o pacote OHDSI.",
        assetEvidence: "Revise a saída do verificador bloqueado antes de aceitar um pacote."
      },
      gates: {
        designIntent: "Intenção do desenho",
        acceptedAt: "Aceito {{time}}",
        acceptResearchQuestion: "Aceite a questão de pesquisa revisada.",
        verifiedMaterializedCohorts: "{{count}} coorte materializada verificada",
        feasibilityReady: "A evidência de viabilidade verificada está pronta.",
        runFeasibility: "Execute a viabilidade após a verificação das coortes.",
        analysisPlan: "Plano de análise",
        analysisPlanReady: "O plano de análise HADES verificado está pronto.",
        verifyAnalysisPlan: "Verifique e materialize um plano de análise."
      },
      labels: {
        version: "Versão",
        versionStatus: "v{{version}} - {{status}}",
        verifiedAssets: "Recursos verificados",
        title: "Título",
        description: "Descrição",
        studyType: "Tipo de estudo",
        analysisType: "Tipo de análise",
        analysis: "Análise",
        missingOmopIds: "IDs OMOP ausentes",
        deprecatedOmopIds: "IDs OMOP obsoletos",
        invalidDraftIds: "IDs de rascunho inválidos"
      },
      placeholders: {
        studyTitle: "Título do estudo",
        optionalDescription: "Descrição opcional",
        selectAnalysis: "Selecione análise..."
      },
      analysisTypes: {
        characterization: "Caracterização",
        "incidence-rate": "Taxa de incidência",
        pathway: "Caminho",
        estimation: "Estimativa",
        prediction: "Previsão"
      },
      messages: {
        new: "novo",
        none: "nenhum",
        notStarted: "não começou",
        createOrImport: "Crie ou importe um design para começar.",
        needsEvidence: "Precisa de evidências",
        noVersion: "Nenhuma versão",
        blockedCount: "{{count}} bloqueado",
        noBlockers: "Sem bloqueios",
        startEvidenceReview: "Gere intenção ou importe o estudo atual para iniciar a revisão das evidências.",
        noAnalyses: "Nenhuma análise adicionada ainda.",
        analysisFallback: "Análise #{{id}}",
        assetId: "Ativo #{{id}}",
        materializedId: "materializado #{{id}}",
        verifiedAt: "verificado {{time}}"
      }
    },
    workbench: {
      sessionTitle: "Desenho de intenção de estudo",
      title: "Compilador de design de estudo",
      subtitle: "Converta uma pergunta de pesquisa em uma intenção de estudo revisada e alinhada ao OHDSI; depois, avalie ativos de fenótipo reutilizáveis antes que qualquer item avance no fluxo.",
      newSession: "Nova sessão",
      sessions: "Sessões",
      researchQuestion: "Pergunta de pesquisa",
      researchQuestionPlaceholder: "Compare MACE recorrente em pacientes pós-MI iniciando clopidogrel versus aspirina.",
      emptyQuestionPlaceholder: "Descreva a questão do estudo...",
      generateIntent: "Gerar intenção",
      startSession: "Inicie uma sessão de design e, em seguida, gere uma intenção PICO estruturada a partir da questão do estudo.",
      createAndGenerate: "Criar sessão e gerar intenção",
      loadingSessions: "Carregando sessões de design...",
      sections: {
        phenotypeRecommendations: "Recomendações de fenótipo e reutilização",
        conceptSetDrafts: "Rascunhos do conjunto de conceitos",
        cohortDrafts: "Rascunhos de coorte",
        cohortReadiness: "Preparação da coorte de estudo",
        feasibility: "Viabilidade",
        sources: "Fontes",
        attrition: "Atrito",
        analysisPlans: "Planos de Análise",
        packageLock: "Bloqueio de pacote",
        currentAssets: "Recursos atuais do estudo",
        intentReview: "Revisão de intenção",
        source: "Fonte",
        governance: "Governança"
      },
      descriptions: {
        recommendations: "Revise as entradas reutilizáveis ​​da Biblioteca de Fenótipos, coortes locais e conjuntos de conceitos locais antes de redigir qualquer coisa nova.",
        conceptSets: "Converta evidências aceitas em rascunhos verificados com vocabulário antes de criar conjuntos de conceitos nativos.",
        cohorts: "Transforme conjuntos de conceitos materializados em rascunhos de definição de coorte nativos.",
        feasibility: "Verifique as coortes vinculadas em relação às fontes CDM selecionadas antes do planejamento da análise.",
        analysisPlans: "Compile coortes de estudo viáveis ​​em projetos de análise nativos compatíveis com HADES.",
        packageLock: "Congele intenções aceitas, conjuntos de conceitos, coortes, viabilidade e análises nativas em um pacote de estudo auditável.",
        currentAssets: "Traga coortes e análises criadas manualmente para esse caminho de design e, em seguida, revise as lacunas sem alterar os registros existentes."
      },
      actions: {
        recommend: "Recomendar",
        draftConceptSets: "Rascunhar conjuntos de conceitos",
        draftCohorts: "Rascunhar coortes",
        runFeasibility: "Executar viabilidade",
        draftPlans: "Rascunhar planos",
        importCurrent: "Importar atual",
        critique: "Crítica",
        verify: "Verificar",
        review: "Análise",
        accept: "Aceitar",
        defer: "Adiar",
        reject: "Rejeitar",
        materialize: "Materializar",
        openNativeEditor: "Abrir editor nativo",
        linkToStudy: "Vincular ao estudo",
        search: "Procurar",
        add: "Adicionar",
        remove: "Remover",
        saveReview: "Salvar revisão",
        acceptIntent: "Aceitar intenção",
        lockPackage: "Bloquear pacote",
        locked: "Bloqueado",
        downloadPackageSummary: "Baixar resumo do pacote"
      },
      labels: {
        verified: "Verificado",
        needsCheck: "Precisa de verificação",
        blocked: "Bloqueado",
        unverified: "Não verificado",
        reviewQueue: "Fila de revisão",
        conceptSetDraft: "rascunho do conjunto de conceitos",
        cohortDraft: "rascunho de coorte",
        concepts: "Conceitos",
        concept: "Conceito",
        domain: "Domínio",
        vocabulary: "Vocabulário",
        flags: "Sinalizadores",
        actions: "Ações",
        lint: "Lint",
        source: "Fonte",
        status: "Situação",
        cohorts: "Coortes",
        coverage: "Cobertura",
        domains: "Domínios",
        freshness: "Atualidade",
        dqd: "DQD",
        attrition: "Atrito",
        nativeConceptSet: "Conjunto de conceito nativo #{{id}}",
        nativeCohort: "Coorte nativa #{{id}}",
        linkedStudyCohort: "Coorte de estudo vinculada #{{id}}",
        conceptsCount: "{{count}} conceitos",
        conceptSetsCount: "{{count}} conjuntos de conceitos",
        nativeAnalysis: "Análise nativa #{{id}}",
        feasibility: "Viabilidade",
        rank: "Classificação {{score}}",
        match: "Correspondência de {{score}}%",
        ohdsiId: "OHDSI #{{id}}",
        computable: "Computável",
        imported: "Importado",
        evidence: "Evidência",
        origin: "Origem",
        matchedTerm: "Termo correspondente",
        canonicalRecord: "Registro canônico",
        noCanonicalRecord: "Nenhum registro canônico",
        eligibility: "Elegibilidade",
        acceptable: "Aceitável",
        blockedOrNeedsReview: "Bloqueado ou precisa de revisão",
        policy: "Política",
        nextActions: "Próximas ações",
        rankComponents: "Componentes de classificação",
        verifierChecks: "Verificações do verificador",
        versionStatus: "Versão {{version}} · {{status}}",
        primaryObjective: "Objetivo Primário",
        population: "População",
        exposure: "Exposição",
        comparator: "Comparador",
        primaryOutcome: "Resultado Primário",
        timeAtRisk: "Tempo em risco",
        conceptSetsMetric: "Conjuntos de conceitos",
        cohortsMetric: "Coortes",
        analysesMetric: "Análises",
        packagesMetric: "Pacotes",
        aiEvents: "Eventos de IA",
        reviewed: "Revisado",
        manifest: "Manifesto",
        critiques: "Críticas"
      },
      messages: {
        saveOrAcceptBeforeRecommendations: "Salve uma intenção pronta para revisão ou aceite-a antes de solicitar recomendações.",
        loadingRecommendations: "Carregando recomendações...",
        noRecommendations: "Nenhuma recomendação ainda.",
        acceptRecommendationFirst: "Aceite primeiro pelo menos uma recomendação verificada de fenótipo, coorte ou conjunto de conceitos.",
        noConceptSetDrafts: "Nenhum rascunho de conceito definido ainda.",
        onlyVerifiedConceptSetDrafts: "Somente rascunhos de conjuntos de conceitos verificados podem ser aceitos.",
        searchConceptsPlaceholder: "Pesquise conceitos de vocabulário OMOP",
        materializeConceptSetFirst: "Materialize primeiro pelo menos um rascunho de conjunto de conceitos verificado.",
        noCohortDrafts: "Ainda não há rascunhos de coorte.",
        checkingLinkedRoles: "Verificando funções vinculadas...",
        noReadinessSignal: "Nenhum sinal de prontidão ainda.",
        ready: "Pronto",
        blocked: "Bloqueado",
        drafts: "{{count}} rascunhos",
        materialized: "{{count}} materializados",
        linked: "{{count}} vinculados",
        linkRequiredCohorts: "Vincular coortes de estudo necessárias antes da viabilidade da fonte.",
        loadingSources: "Carregando fontes...",
        noSources: "Nenhuma fonte CDM configurada.",
        smallCellThreshold: "Limiar de células pequenas",
        sourcesReady: "Fontes {{ready}}/{{total}} prontas",
        ranAt: "Executado {{time}}",
        noDates: "Sem datas",
        none: "nenhum",
        roles: "Funções {{ready}}/{{total}}",
        unknown: "Desconhecido",
        noDqd: "Sem DQD",
        passRate: "{{rate}}% aprovado",
        noFeasibilityEvidence: "Nenhuma evidência de viabilidade foi armazenada para esta versão do projeto.",
        runFeasibilityBeforePlans: "Execute a viabilidade da fonte antes de elaborar planos de análise.",
        noAnalysisPlans: "Ainda não há planos de análise.",
        feasibilityStatus: "Viabilidade: {{status}}",
        checkingPackageReadiness: "Verificando a prontidão do pacote...",
        readyToLock: "Pronto para bloquear.",
        lockedPackageAvailable: "O pacote bloqueado está disponível nos artefatos do estudo.",
        signed: "assinado",
        pending: "pendente",
        onlyVerifiedRecommendations: "Somente recomendações verificadas deterministicamente podem ser aceitas."
      }
    }
  },
  covariates: {
    title: "Configurações de covariáveis",
    description:
      "Selecione quais domínios incluir como covariáveis para o FeatureExtraction.",
    groups: {
      core: "Domínios principais",
      extended: "Domínios estendidos",
      indices: "Índices de comorbidade",
    },
    labels: {
      demographics: "Demografia",
      conditionOccurrence: "Ocorrência de condição",
      drugExposure: "Exposição a medicamento",
      procedureOccurrence: "Ocorrência de procedimento",
      measurement: "Medição",
      observation: "Observação",
      deviceExposure: "Exposição a dispositivo",
      visitCount: "Contagem de visitas",
      charlsonComorbidity: "Comorbidade de Charlson",
      dcsi: "DCSI (diabetes)",
      chads2: "CHADS2",
      chads2Vasc: "CHA2DS2-VASc",
    },
    timeWindows: "Janelas de tempo",
    to: "até",
    days: "dias",
    addTimeWindow: "Adicionar janela de tempo",
  },
  jobs: {
    page: {
      title: "Tarefas",
      subtitle: "Monitore tarefas em segundo plano e o status da fila",
      empty: {
        title: "Nenhuma tarefa encontrada",
        archived: "Nenhuma tarefa arquivada há mais de 24 horas.",
        filtered:
          "Nenhuma tarefa com status {{status}}. Tente outro filtro.",
        recent:
          "Nenhuma tarefa nas últimas 24 horas. Confira Arquivadas para tarefas mais antigas.",
      },
      table: {
        job: "Tarefa",
        type: "Tipo",
        source: "Fonte",
        started: "Iniciada",
        duration: "Duração",
        status: "Situação",
        actions: "Ações",
      },
      pagination: "Página {{current}} de {{last}} · {{total}} tarefas",
    },
    filters: {
      statuses: {
        all: "Todas (24 h)",
        pending: "Pendente",
        queued: "Na fila",
        running: "Em execução",
        completed: "Concluída",
        failed: "Com falha",
        cancelled: "Cancelada",
        archived: "Arquivada",
      },
      types: {
        all: "Todos os tipos",
        analysis: "Análise",
        characterization: "Caracterização",
        incidenceRate: "Taxa de incidência",
        estimation: "Estimativa",
        prediction: "Predição",
        pathway: "Trajetória",
        sccs: "SCCS",
        evidenceSynthesis: "Síntese de evidências",
        cohortGeneration: "Geração de coorte",
        careGaps: "Lacunas de cuidado",
        achilles: "Achilles",
        dataQuality: "Qualidade de dados",
        heelChecks: "Verificações Heel",
        ingestion: "Ingestão",
        vocabulary: "Vocabulário",
        genomicParse: "Análise genômica",
        poseidon: "ETL Poseidon",
        fhirExport: "Exportação FHIR",
        fhirSync: "Sincronização FHIR",
        gisImport: "Importação GIS",
        gisBoundaries: "Limites GIS",
      },
    },
    actions: {
      retry: "Tentar novamente",
      retryJob: "Tentar tarefa novamente",
      cancel: "Cancelar",
      cancelJob: "Cancelar tarefa",
      previous: "Anterior",
      next: "Próxima",
    },
    drawer: {
      titleFallback: "Detalhes da tarefa",
      loadError: "Falha ao carregar detalhes da tarefa.",
      sections: {
        executionLog: "Log de execução",
        analysis: "Análise",
        cohort: "Coorte",
        ingestionPipeline: "Pipeline de ingestão",
        fhirSync: "Sincronização FHIR",
        dataQuality: "Qualidade de dados",
        heelChecks: "Verificações Heel",
        achillesAnalyses: "Análises Achilles",
        genomicParse: "Análise genômica",
        poseidonEtl: "ETL Poseidon",
        careGapEvaluation: "Avaliação de lacunas de cuidado",
        gisBoundaries: "Limites GIS",
        gisImport: "Importação GIS",
        vocabularyImport: "Importação de vocabulário",
        fhirExport: "Exportação FHIR",
        overview: "Visão geral",
        output: "Saída",
      },
      labels: {
        analysis: "Análise",
        createdBy: "Criada por",
        parameters: "Parâmetros",
        cohort: "Coorte",
        personCount: "Contagem de pessoas",
        source: "Fonte",
        sourceKey: "Chave da fonte",
        stage: "Etapa",
        project: "Projeto",
        file: "Arquivo",
        fileSize: "Tamanho do arquivo",
        mappingCoverage: "Cobertura de mapeamento",
        processed: "Processados",
        failed: "Com falha",
        filesDownloaded: "Arquivos baixados",
        recordsExtracted: "Registros extraídos",
        recordsMapped: "Registros mapeados",
        recordsWritten: "Registros gravados",
        recordsFailed: "Registros com falha",
        passed: "Aprovados",
        passRate: "Taxa de aprovação",
        expectedChecks: "Verificações esperadas",
        executionTime: "Tempo de execução",
        failingChecks: "Verificações com falha",
        totalRules: "Total de regras",
        rulesTriggered: "Regras acionadas",
        totalViolations: "Total de violações",
        topViolations: "Principais violações",
        completed: "Concluída",
        byCategory: "Por categoria",
        failedSteps: "Etapas com falha",
        format: "Formato",
        totalVariants: "Total de variantes",
        mappedVariants: "Variantes mapeadas",
        samples: "Amostras",
        runType: "Tipo de execução",
        dagsterRunId: "ID de execução Dagster",
        stats: "Estatísticas",
        bundle: "Pacote",
        complianceSummary: "Resumo de conformidade",
        dataset: "Conjunto de dados",
        dataType: "Tipo de dados",
        version: "Versão",
        geometry: "Geometria",
        features: "Entidades",
        tablesLoaded: "Tabelas carregadas",
        recordsLoaded: "Registros carregados",
        outputFormat: "Formato de saída",
        type: "Tipo",
        triggeredBy: "Acionada por",
        duration: "Duração",
        started: "Iniciada",
        created: "Criada",
        error: "Erro",
      },
      messages: {
        stalled:
          "Esta tarefa travou e foi marcada como com falha após exceder o limite de 1 hora.",
        failedCount: "{{count}} com falha",
        runningCount: "{{count}} em execução",
        ofTotal: "de {{count}}",
        records: "{{count}} registros",
      },
    },
  },
  vocabulary: {
    mappingAssistant: {
      title: "Assistente de mapeamento de conceitos",
      poweredBy: "Fornecido por Ariadne",
      subtitle:
        "Mapeie termos de origem para conceitos-padrão OMOP usando correspondência literal, vetorial e por LLM",
      filters: {
        selectedCount: "{{count}} selecionados",
        clearSelection: "Limpar seleção",
        targetVocabulary: "Vocabulário de destino:",
        allVocabularies: "Todos os vocabulários",
        targetDomain: "Domínio de destino:",
        allDomains: "Todos os domínios",
      },
      drawer: {
        disambiguate: "Desambiguar",
        candidateCount: "{{count}} candidatos - selecione o mapeamento correto",
        noCandidates: "Nenhum candidato encontrado. Tente limpar o termo abaixo.",
        cleanRemap: "Limpar e remapear",
        editPlaceholder: "Edite o termo e remapeie...",
      },
      actions: {
        clean: "Limpar",
        remap: "Remapear",
        acceptMapping: "Aceitar mapeamento",
        rejectMapping: "Rejeitar mapeamento",
        disambiguateTitle: "Desambiguar - ver todos os candidatos",
        uploadCsv: "Enviar CSV",
        loadProject: "Carregar projeto",
        mapping: "Mapeando...",
        mapTerms: "Mapear termos",
        clearResults: "Limpar resultados",
        acceptAllThreshold: "Aceitar todos >= 90%",
        saveToVocabulary: "Salvar no vocabulário",
        saveProject: "Salvar projeto",
        exportCsv: "Exportar CSV",
      },
      toasts: {
        remapped: "\"{{source}}\" remapeado para {{concept}}",
        noMatchForCleaned: "Nenhuma correspondência encontrada para o termo limpo \"{{term}}\"",
        remapFailed: "Falha ao remapear",
        autoAccepted: "{{count}} mapeamentos de alta confiança aceitos automaticamente",
        savedMappings: "{{count}} mapeamentos salvos em source_to_concept_map",
        saveMappingsFailed: "Falha ao salvar mapeamentos",
        projectSaved: "Projeto salvo: {{name}}",
        saveProjectFailed: "Falha ao salvar projeto",
        projectLoaded: "Projeto carregado: {{name}}",
        loadProjectFailed: "Falha ao carregar projeto",
      },
      errors: {
        cleanupFailed: "Falha na limpeza.",
        mappingFailed:
          "Falha no mapeamento. Verifique se o serviço Ariadne está em execução e acessível.",
      },
      results: {
        candidateCount: "{{count}} candidatos",
        overridden: "(substituído)",
        noMatchFound: "Nenhuma correspondência encontrada",
        selectOverride: "Selecione um candidato para substituir o mapeamento",
        noAdditionalCandidates: "Nenhum candidato adicional.",
      },
      labels: {
        noValue: "-",
        separator: "-",
      },
      input: {
        termsMapped: "{{count}} termos mapeados",
        editTerms: "Editar termos",
        sourceTerms: "Termos de origem",
        termsPlaceholder:
          "Digite termos de origem, um por linha...\n\ndiabetes mellitus tipo 2\ninfarto agudo do miocárdio\nHAS\nAAS 81 mg",
        termsEntered: "{{count}} termos inseridos",
      },
      projects: {
        loading: "Carregando projetos...",
        loadFailed: "Falha ao carregar projetos",
        empty: "Nenhum projeto salvo",
        projectMeta: "{{count}} termos -- {{date}}",
        namePlaceholder: "Nome do projeto...",
      },
      vocabularies: {
        SNOMED: "SNOMED CT",
        ICD10CM: "ICD-10-CM",
        RxNorm: "RxNorm",
        LOINC: "LOINC",
        ICD9CM: "ICD-9-CM",
        CPT4: "CPT-4",
        HCPCS: "HCPCS",
        MedDRA: "MedDRA",
      },
      domains: {
        Condition: "Condição",
        Drug: "Medicamento",
        Procedure: "Procedimento",
        Measurement: "Medição",
        Observation: "Observação",
        Device: "Dispositivo",
      },
      progress: {
        mappingTerms: "Mapeando {{count}} termos...",
      },
      metrics: {
        termsMapped: "Termos mapeados",
        highConfidence: "Alta confiança",
        needReview: "Precisa de revisão",
        noMatch: "Sem correspondência",
      },
      table: {
        sourceTerm: "Termo de origem",
        bestMatch: "Melhor correspondência",
        confidence: "Confiança",
        matchType: "Tipo de correspondência",
        vocabulary: "Vocabulário",
        actions: "Ações",
      },
      summary: {
        mapped: "{{count}} mapeados",
        high: "{{count}} altos",
        review: "{{count}} para revisar",
        noMatch: "{{count}} sem correspondência",
        accepted: "{{count}} aceitos",
      },
    },
    conceptDetail: {
      tabs: {
        info: "Informações",
        relationships: "Relacionamentos",
        mapsFrom: "Mapeado a partir de",
        hierarchy: "Hierarquia",
      },
      empty: {
        title: "Selecione um conceito para ver detalhes",
        subtitle: "Pesquise e clique em um conceito no painel à esquerda",
        noAncestors: "Nenhum ancestral encontrado",
        noRelationships: "Nenhum relacionamento encontrado",
        noSourceCodes: "Nenhum código de origem mapeia para este conceito",
      },
      errors: {
        failedLoad: "Falha ao carregar conceito",
      },
      toasts: {
        conceptIdCopied: "ID do conceito copiado",
      },
      actions: {
        copyConceptId: "Copiar ID do conceito",
        addToSet: "Adicionar ao conjunto",
      },
      values: {
        standard: "Padrão",
        classification: "Classificação",
        nonStandard: "Não padrão",
        valid: "Válido",
      },
      sections: {
        basicInformation: "Informações básicas",
        synonyms: "Sinônimos",
        ancestors: "Ancestrais",
        relationships: "Relacionamentos",
        mapsFrom: "Códigos de origem mapeados para este conceito",
        mapsFromDescription:
          "Códigos de vocabulários de origem (ICD-10, SNOMED, RxNorm, etc.) que mapeiam para este conceito padrão",
        hierarchy: "Hierarquia do conceito",
      },
      fields: {
        conceptCode: "Código do conceito",
        domain: "Domínio",
        vocabulary: "Vocabulário",
        conceptClass: "Classe do conceito",
        standardConcept: "Conceito padrão",
        invalidReason: "Motivo de invalidade",
        validStartDate: "Data inicial de validade",
        validEndDate: "Data final de validade",
      },
      table: {
        id: "Identificador",
        name: "Nome",
        domain: "Domínio",
        vocabulary: "Vocabulário",
        relationship: "Relacionamento",
        relatedId: "ID relacionado",
        relatedName: "Nome relacionado",
        code: "Código",
        class: "Classe",
      },
      pagination: {
        showingRange: "Exibindo {{start}}-{{end}} de {{total}}",
        showingSourceCodes: "Exibindo {{shown}} de {{total}} códigos de origem",
      },
    },
    semanticSearch: {
      hecate: "Hecate",
      poweredBy: "Fornecido por Hecate",
      tagline: "descoberta de conceitos com vetores",
      placeholder: "Digite um termo clínico para pesquisar semanticamente...",
      filters: {
        allDomains: "Todos os domínios",
        allVocabularies: "Todos os vocabulários",
        standard: {
          all: "Todos",
          standard: "S",
          classification: "C",
        },
      },
      badges: {
        standard: "Padrão",
        classification: "Classificação",
      },
      values: {
        inSet: "No conjunto",
        standardAbbrev: "S",
      },
      actions: {
        addToSet: "Adicionar ao conjunto",
        clearFilters: "Limpar filtros",
        retry: "Tentar novamente",
        tryClearingFilters: "Tente limpar os filtros",
      },
      errors: {
        unavailable: "A pesquisa semântica está indisponível.",
        serviceHelp:
          "Verifique se o serviço de IA Hecate está em execução e se o ChromaDB foi inicializado.",
      },
      empty: {
        prompt: "Digite um termo clínico para pesquisar semanticamente",
        help:
          "Hecate usa embeddings vetoriais para encontrar conceitos OMOP conceitualmente semelhantes, mesmo quando correspondências exatas por palavra-chave falham.",
        noResults: "Nenhuma correspondência semântica encontrada para \"{{query}}\"",
      },
      results: {
        matchCountOne: "{{count}} correspondência semântica",
        matchCountMany: "{{count}} correspondências semânticas",
        updating: "Atualizando...",
      },
    },
    searchPanel: {
      placeholder: "Pesquisar conceitos...",
      filters: {
        toggle: "Filtros",
        standardOnly: "Padrão",
        allDomains: "Todos os domínios",
        allVocabularies: "Todos os vocabulários",
        allConceptClasses: "Todas as classes de conceito",
        countSuffix: " ({{count}})",
      },
      actions: {
        clearAllFilters: "Limpar todos os filtros",
        tryClearingFilters: "Tente limpar os filtros",
        loading: "Carregando...",
        loadMoreResults: "Carregar mais resultados",
      },
      empty: {
        prompt: "Pesquisar no vocabulário OMOP",
        help: "Digite pelo menos 2 caracteres para pesquisar conceitos por nome, código ou ID",
        noResults: "Nenhum conceito encontrado para \"{{query}}\"",
      },
      results: {
        showingCount: "Exibindo {{shown}} de {{total}} resultados",
      },
      engine: {
        solr: "Solr",
        pg: "PG",
      },
      values: {
        inSet: "No conjunto",
      },
    },
    conceptComparison: {
      title: "Comparar conceitos",
      subtitle:
        "Comparação lado a lado de 2 a 4 conceitos OMOP com atributos, ancestrais e relacionamentos",
      search: {
        placeholder: "Pesquisar conceito para adicionar...",
      },
      sections: {
        ancestors: "Ancestrais (2 níveis)",
        relationships: "Relacionamentos",
      },
      fields: {
        conceptCode: "Código do conceito",
        domain: "Domínio",
        vocabulary: "Vocabulário",
        conceptClass: "Classe do conceito",
        standard: "Padrão",
        validStart: "Início da validade",
        validEnd: "Fim da validade",
        invalidReason: "Motivo de invalidade",
      },
      actions: {
        addConcept: "Adicionar conceito",
      },
      empty: {
        prompt: "Pesquise conceitos para comparar",
        help:
          "Selecione 2 a 4 conceitos para ver uma comparação lado a lado de seus atributos, ancestrais e relacionamentos",
      },
      values: {
        standard: "Padrão",
        classification: "Classificação",
        nonStandard: "Não padrão",
        valid: "Válido",
        level: "N{{level}}",
        selected: "Selecionados:",
        addOneMore: "Adicione pelo menos mais um para comparar",
      },
    },
    addToConceptSet: {
      title: "Adicionar ao conjunto de conceitos",
      create: {
        title: "Criar novo conjunto de conceitos",
        help: "Adicionar conceito e abrir no Builder",
        nameLabel: "Nome do novo conjunto de conceitos",
      },
      actions: {
        create: "Criar",
        cancel: "Cancelar",
        openBuilderWithSearch: "Abrir Builder com a pesquisa atual",
      },
      divider: "ou adicionar a existente",
      filter: {
        placeholder: "Filtrar conjuntos de conceitos...",
      },
      empty: {
        noMatching: "Nenhum conjunto de conceitos correspondente",
        noSets: "Nenhum conjunto de conceitos encontrado",
      },
      footer: {
        includeDescendants: "Adiciona com Incluir descendentes",
      },
      toasts: {
        addedToSet: "Adicionado a \"{{setName}}\"",
        addFailed: "Falha ao adicionar conceito ao conjunto",
        missingSetId: "Falha ao recuperar o ID do novo conjunto de conceitos",
        createdAndAdded: "\"{{name}}\" criado e conceito adicionado",
        createdAddFailed: "Conjunto criado, mas falha ao adicionar conceito",
        createFailed: "Falha ao criar conjunto de conceitos",
      },
    },
    page: {
      title: "Navegador de vocabulário",
      subtitle: "Pesquise, explore e navegue pelo vocabulário padronizado OMOP",
      tabs: {
        keyword: "Pesquisa por palavra-chave",
        semantic: "Pesquisa semântica",
        browse: "Navegar pela hierarquia",
      },
    },
    hierarchyBrowser: {
      breadcrumb: {
        allDomains: "Todos os domínios",
      },
      filters: {
        allSources: "Todas as fontes",
        itemPlaceholder: "Filtrar {{count}} itens...",
      },
      actions: {
        showAllConcepts: "Mostrar todos os conceitos",
        showGroupings: "Mostrar agrupamentos",
        clearFilter: "Limpar filtro",
        viewDetailsFor: "Ver detalhes de {{conceptName}}",
        viewConceptDetails: "Ver detalhes do conceito",
      },
      empty: {
        noMatchingConcepts: "Nenhum conceito correspondente",
        noConcepts: "Nenhum conceito encontrado",
      },
      counts: {
        clinicalGroupings: "{{count}} agrupamentos clínicos",
        concepts: "{{count}} conceitos",
        items: "{{count}} itens",
        filteredItems: "{{shown}} de {{total}} itens",
        namedSubCategories: "{{name}} - {{count}} subcategorias",
        subCategories: "{{count}} subcategorias",
        subcategories: "{{count}} subcategorias",
        oneAnchor: "1 âncora",
        persons: "{{count}} pessoas",
        records: "{{count}} registros",
        groupingCoversSubcategories:
          "{{groupingName}} cobre {{count}} subcategorias",
      },
    },
    hierarchyTree: {
      empty: {
        noData: "Nenhum dado de hierarquia disponível",
      },
    },
  },
  dataExplorer: {
    page: {
      title: "Explorador de dados",
      subtitle: "Explore resultados de caracterização Achilles e qualidade dos dados",
      selectSourceTitle: "Selecione uma fonte de dados",
      selectSourceMessage:
        "Escolha uma fonte CDM no menu acima para explorar seus dados",
    },
    tabs: {
      overview: "Visão geral",
      domains: "Domínios",
      temporal: "Tempo",
      heel: "Achilles",
      dqd: "Qualidade dos dados",
      ares: "Ares",
    },
    sourceSelector: {
      loading: "Carregando fontes...",
      placeholder: "Selecione uma fonte de dados",
    },
    domains: {
      condition: "Condições",
      drug: "Medicamentos",
      procedure: "Procedimentos",
      measurement: "Medições",
      observation: "Observações",
      visit: "Visitas",
    },
    overview: {
      metrics: {
        persons: "Pessoas",
        personsTotal: "{{value}} no total",
        medianObsDuration: "Duração mediana da observação",
        durationDays: "{{value}} dias",
        observationPeriods: "{{value}} períodos de observação",
        totalEvents: "Total de eventos",
        acrossAllCdmTables: "Em todas as tabelas CDM",
        dataCompleteness: "Completude dos dados",
        tablesPopulated: "{{populated}}/{{total}} tabelas preenchidas",
      },
      sections: {
        demographics: "Demografia da população",
        observationPeriods: "Análise de períodos de observação",
        domainRecordProportions: "Proporções de registros por domínio",
        dataDensityOverTime: "Densidade dos dados ao longo do tempo",
        recordDistribution: "Distribuição de registros",
      },
      cards: {
        genderDistribution: "Distribuição por gênero",
        ethnicity: "Etnia",
        race: "Raça",
        topTen: "Top 10",
        yearOfBirthDistribution: "Distribuição do ano de nascimento",
        yearOfBirthSubtitle: "Histograma com densidade suavizada (dourado)",
        cumulativeObservationDuration: "Duração cumulativa da observação",
        cumulativeObservationSubtitle:
          "Estilo Kaplan-Meier: % de pessoas com observação >= X dias",
        observationStartEndDates: "Datas de início / fim da observação",
        observationStartEndSubtitle:
          "Distribuição temporal dos períodos de observação",
        observationPeriodDurationDays: "Duração do período de observação (dias)",
        observationPeriodsPerPerson: "Períodos de observação por pessoa",
        observationPeriodsPerPersonSubtitle:
          "Distribuição de quantos períodos cada pessoa possui",
        clinicalDataDomains: "Domínios de dados clínicos",
        clinicalDataDomainsSubtitle:
          "Ordenados por contagem de registros - clique em um domínio para explorar seus conceitos",
        recordsByDomainAndYear: "Registros por domínio e ano",
        recordsByDomainAndYearSubtitle:
          "A intensidade da cor indica o volume de registros por domínio e ano",
        cdmTableRecordCounts: "Contagens de registros das tabelas CDM",
        cdmTableRecordCountsSubtitle:
          "Escala logarítmica - todas as tabelas visíveis independentemente da magnitude",
      },
      messages: {
        runAchillesForTemporalData:
          "Execute Achilles para gerar dados de tendência temporal",
      },
    },
    charts: {
      common: {
        records: "{{count}} registros",
        persons: "{{count}} pessoas",
        total: "Geral",
        separator: "·",
      },
      boxPlot: {
        noDistributionData: "Nenhum dado de distribuição",
        ariaLabel: "Diagrama de caixa",
        labels: {
          p25: "P25: {{value}}",
          median: "Mediana: {{value}}",
          p75: "P75: {{value}}",
        },
      },
      cumulativeObservation: {
        tooltipValue: "{{days}} dias - {{pct}}% das pessoas",
        xAxisLabel: "Duração da observação (dias)",
        labels: {
          min: "Mín.",
          p10: "P10",
          p25: "P25",
          median: "Mediana",
          p75: "P75",
          p90: "P90",
          max: "Máx.",
        },
      },
      demographics: {
        ageDistribution: "Distribuição etária",
        noAgeData: "Nenhum dado de distribuição etária",
        age: "Idade",
        male: "Masculino",
        female: "Feminino",
      },
      heatmap: {
        ariaLabel: "Mapa de calor de densidade dos dados",
      },
      hierarchy: {
        noData: "Nenhum dado de hierarquia disponível",
        classificationHierarchy: "Hierarquia de classificação",
        back: "Voltar",
      },
      periodCount: {
        observationPeriods: "{{count}} período(s) de observação",
      },
      recordCounts: {
        noData: "Nenhum dado de contagem de registros disponível",
        title: "Contagens de registros por tabela CDM",
      },
      temporalTrend: {
        events: "Eventos",
        secondary: "Secundário",
      },
      topConcepts: {
        noData: "Nenhum dado de conceito disponível",
        title: "Principais conceitos",
        id: "ID: {{id}}",
        prevalence: "Prevalência: {{value}}%",
      },
      yearOfBirth: {
        year: "Ano: {{year}}",
      },
    },
    domain: {
      metrics: {
        totalRecords: "Total de registros",
        distinctConcepts: "Conceitos distintos",
      },
      loadFailed: "Falha ao carregar dados de {{domain}}",
      temporalTrendTitle: "Tendência temporal de {{domain}}",
    },
    temporal: {
      domainsLabel: "Domínios:",
      multiDomainOverlay: "Sobreposição temporal multidomínio",
      emptyTitle: "Nenhum dado temporal disponível",
      emptyHelp: "Selecione domínios acima e verifique se Achilles foi executado",
    },
    concept: {
      details: "Detalhes do conceito",
      loadFailed: "Falha ao carregar detalhes do conceito",
      genderDistribution: "Distribuição por gênero",
      temporalTrend: "Tendência temporal",
      typeDistribution: "Distribuição por tipo",
      ageAtFirstOccurrence: "Idade na primeira ocorrência",
      valueByLabel: "{{label}}: {{value}}",
    },
    achilles: {
      severities: {
        error: "Erro",
        warning: "Aviso",
        notification: "Notificação",
      },
      severityCounts: {
        error: "erros",
        warning: "avisos",
        notification: "notificações",
      },
      actions: {
        running: "Executando...",
        runHeelChecks: "Executar verificações Heel",
        runAchilles: "Executar Achilles",
        selectRun: "Selecionar execução",
        viewLiveProgress: "Ver progresso em tempo real",
        viewDetails: "Ver detalhes",
      },
      runShort: "Execução {{id}}...",
      statuses: {
        completed: "Concluída",
        failed: "Com falha",
        running: "Em execução",
        pending: "Pendente",
      },
      labels: {
        status: "Situação",
        total: "geral",
        passed: "aprovadas",
        failed: "com falha",
        durationSeconds: "Duração: {{value}}s",
      },
      heel: {
        title: "Verificações Heel",
        dispatchFailed: "Falha ao disparar verificações Heel",
        running: "Executando verificações Heel...",
        empty: "Nenhuma verificação Heel executada ainda",
        allPassed: "Todas as verificações foram aprovadas",
        issueSummary:
          "{{count}} problemas: {{errors}}E / {{warnings}}A / {{notifications}}N",
      },
      characterization: {
        title: "Caracterização Achilles",
        dispatchFailed: "Falha ao disparar execução Achilles",
        empty: "Nenhuma execução Achilles ainda",
        emptyHelp: 'Clique em "Executar Achilles" para caracterizar seus dados',
      },
      runModal: {
        completedIn: "Concluída em {{duration}}",
        analysisProgress: "{{done}} de {{total}} análises",
        elapsed: "Decorrido:",
        passedCount: "{{count}} aprovadas",
        failedCount: "{{count}} com falha",
        totalDuration: "{{duration}} no total",
        remaining: "~{{duration}} restantes",
        waiting: "Aguardando o início das análises...",
        done: "Concluído",
        runInBackground: "Executar em segundo plano",
      },
    },
    dqd: {
      categories: {
        completeness: "Completude",
        conformance: "Conformidade",
        plausibility: "Plausibilidade",
        overall: "Geral",
      },
      progress: {
        title: "Análise DQD em execução",
        checksCompleted: "{{completed}} de {{total}} verificações concluídas",
        waiting: "Aguardando...",
        running: "Executando:",
      },
      labels: {
        passed: "aprovadas",
        failed: "com falha",
        remaining: "restantes",
        warnings: "Avisos",
      },
      severity: {
        error: "Erro",
        warning: "Aviso",
        info: "Informação",
      },
      categoryPanel: {
        checkCount: "{{count}} verificações",
        passRate: "{{percent}}% de aprovação",
        table: {
          check: "Verificação",
          table: "Tabela",
          column: "Coluna",
          severity: "Severidade",
          violationPercent: "% de violação",
        },
      },
      scorecard: {
        emptyTitle: "Nenhum resultado DQD disponível",
        emptyDescription: "Execute uma análise Data Quality Dashboard para ver resultados",
        overallScore: "Pontuação geral",
        passedFraction: "{{passed}}/{{total}} aprovadas",
      },
      tableGrid: {
        noResults: "Nenhum resultado DQD para exibir",
        title: "Mapa de calor tabela x categoria",
        cdmTable: "Tabela CDM",
      },
      actions: {
        runDqd: "Executar DQD",
      },
      dispatchFailed: "Falha ao disparar execução DQD",
      empty: "Nenhuma execução DQD ainda",
      emptyHelp: 'Clique em "Executar DQD" para iniciar uma análise de qualidade dos dados',
    },
    ares: {
      name: "Ares",
      breadcrumbSeparator: ">",
      comingSoon: "Em breve em uma fase futura",
      sections: {
        hub: "Central",
        networkOverview: "Visão geral da rede",
        conceptComparison: "Comparação de conceitos",
        dqHistory: "Histórico de QD",
        coverage: "Cobertura",
        coverageMatrix: "Matriz de cobertura",
        feasibility: "Viabilidade",
        diversity: "Diversidade",
        releases: "Versões",
        unmappedCodes: "Códigos não mapeados",
        cost: "Custo",
        costAnalysis: "Análise de custos",
        annotations: "Anotações",
      },
      cards: {
        sourcesBelowDq: "{{value}} fontes abaixo de 80% QD",
        networkOverviewDescription:
          "Saúde das fontes, pontuações QD e indicadores de tendência",
        conceptComparisonDescription:
          "Compare prevalência de conceitos entre fontes",
        dqHistoryDescription: "Pontuação QD média da rede por versão",
        coverageDescription: "Disponibilidade domínio x fonte",
        feasibilityDescription: "Sua rede consegue apoiar um estudo?",
        diversityDescription: "Paridade demográfica entre fontes",
        releasesDescription: "Histórico de versões por fonte",
        unmappedCodesDescription:
          "Códigos de origem sem mapeamentos padrão",
        annotationsDescription: "Notas de gráfico em todas as fontes",
        costDescription: "Dados de custo por domínio e ao longo do tempo",
      },
      networkOverview: {
        title: "Visão geral da rede",
        networkTotal: "Total da rede",
        percent: "{{value}} por cento",
        averagePercent: "{{value}}% em média",
        actions: {
          dqRadar: "Radar QD",
          hideRadar: "Ocultar radar",
        },
        metrics: {
          dataSources: "Fontes de dados",
          avgDqScore: "Pontuação QD média",
          unmappedCodes: "Códigos não mapeados",
          needAttention: "Precisam de atenção",
          totalPersons: "Total de pessoas",
        },
        table: {
          source: "Fonte",
          dqScore: "Pontuação QD",
          dqTrend: "Tendência QD",
          freshness: "Atualidade",
          domains: "Domínios",
          persons: "Pessoas",
          latestRelease: "Versão mais recente",
        },
        messages: {
          loading: "Carregando visão geral da rede...",
          noData: "Nenhum dado de rede disponível.",
          noReleases: "Nenhuma versão",
        },
        radar: {
          title: "Perfil de radar QD (dimensões de Kahn)",
          description:
            "Taxas de aprovação nas cinco dimensões de qualidade dos dados de Kahn. Valores maiores indicam melhor qualidade.",
          noData: "Nenhum dado de radar QD disponível.",
          dimensions: {
            completeness: "Completude",
            conformanceValue: "Conformidade (valor)",
            conformanceRelational: "Conformidade (relacional)",
            plausibilityAtemporal: "Plausibilidade (atemporal)",
            plausibilityTemporal: "Plausibilidade (temporal)",
          },
        },
      },
      feasibility: {
        title: "Avaliações de viabilidade",
        assessmentMeta: "{{date}} | {{sources}} fontes avaliadas",
        passedSummary: "{{passed}}/{{total}} aprovadas",
        resultsTitle: "Resultados: {{name}}",
        scoreLabel: "{{score}}% de pontuação",
        empty:
          "Nenhuma avaliação ainda. Crie uma para avaliar se sua rede consegue apoiar um estudo proposto.",
        actions: {
          newAssessment: "+ Nova avaliação",
          running: "Executando...",
          runAssessment: "Executar avaliação",
          hide: "Ocultar",
          forecast: "Previsão",
        },
        filters: {
          view: "Visualização:",
        },
        detailViews: {
          table: "Tabela de pontuação",
          impact: "Análise de impacto",
          consort: "Fluxo CONSORT",
        },
        criteria: {
          domains: "Domínios",
          concepts: "Conceitos",
          visitTypes: "Tipos de visita",
          dateRange: "Intervalo de datas",
          patientCount: "Contagem de pacientes",
        },
        forecast: {
          insufficientData:
            "Dados históricos insuficientes para previsão (mínimo de 6 meses necessário).",
          title: "Previsão de chegada de pacientes: {{source}}",
          monthlyRate: "Taxa mensal: {{rate}} pacientes/mês",
          targetReachedIn: "Meta alcançada em ~{{months}} meses",
          targetAlreadyReached: "Meta já alcançada",
          actual: "Real",
          projected: "Projetado",
          confidenceBand: "IC 95%",
          targetLabel: "Meta: {{target}}",
          footnote:
            "Projeção baseada em regressão linear dos últimos 12 meses. A banda de confiança aumenta com a distância da projeção.",
        },
        consort: {
          allSources: "Todas as fontes",
          noResults: "Nenhum resultado para exibir o diagrama CONSORT.",
          title: "Fluxo de atrito no estilo CONSORT",
          description:
            "Mostra como fontes são progressivamente excluídas por cada critério.",
          sources: "{{count}} fontes",
          excluded: "-{{count}} excluídas",
        },
        impact: {
          noData: "Nenhum dado de impacto de critérios disponível.",
          title: "Análise de impacto de critérios",
          description:
            "Mostra quantas fontes adicionais seriam aprovadas se cada critério fosse removido. Linha de base: {{passed}}/{{total}} aprovadas.",
          sourcesRecovered: "+{{count}} fontes",
          guidance:
            "O critério de maior impacto é aquele cuja remoção recuperaria mais fontes. Considere flexibilizar critérios de alto impacto se poucas fontes se qualificarem.",
        },
        templates: {
          loading: "Carregando modelos...",
          startFrom: "Começar a partir de modelo",
        },
        table: {
          source: "Fonte",
          domains: "Domínios",
          concepts: "Conceitos",
          visits: "Visitas",
          dates: "Datas",
          patients: "Pacientes",
          score: "Pontuação",
          overall: "Geral",
          forecast: "Previsão",
        },
        status: {
          eligible: "ELEGÍVEL",
          ineligible: "INELEGÍVEL",
        },
        form: {
          title: "Nova avaliação de viabilidade",
          assessmentName: "Nome da avaliação",
          assessmentNamePlaceholder: "ex.: Estudo de desfechos em diabetes",
          requiredDomains: "Domínios obrigatórios",
          minPatientCount: "Contagem mínima de pacientes (opcional)",
          minPatientCountPlaceholder: "ex.: 1000",
          domains: {
            condition: "Condições",
            drug: "Medicamentos",
            procedure: "Procedimentos",
            measurement: "Medições",
            observation: "Observações",
            visit: "Visitas",
          },
        },
      },
      annotations: {
        filters: {
          allSources: "Todas as fontes",
        },
        tags: {
          all: "Todas",
          dataEvent: "Evento de dados",
          researchNote: "Nota de pesquisa",
          actionItem: "Item de ação",
          system: "Sistema",
        },
        viewModes: {
          list: "Lista",
          timeline: "Linha do tempo",
        },
        actions: {
          reply: "Responder",
          delete: "Excluir",
        },
        replyPlaceholder: "Escreva uma resposta...",
        searchPlaceholder: "Pesquisar anotações...",
        confirmDelete: "Excluir esta anotação?",
        coordinateValue: "{{axis}} = {{value}}",
        sourceContext: "em {{source}}",
        empty: {
          selectSource: "Selecione uma fonte para ver suas anotações",
          noAnnotations: "Nenhuma anotação ainda para esta fonte",
          noTimeline: "Nenhuma anotação para exibir na linha do tempo.",
        },
      },
      coverage: {
        title: "Matriz de cobertura (relatório Strand)",
        description:
          "Disponibilidade de domínios em todas as fontes de dados. Verde = alta densidade, âmbar = baixa densidade, vermelho = sem dados.",
        yes: "Sim",
        densityTitle: "Densidade: {{density}} por pessoa",
        filters: {
          view: "Visualização:",
        },
        viewModes: {
          records: "Registros",
          per_person: "Por pessoa",
          date_range: "Intervalo de datas",
        },
        actions: {
          exporting: "Exportando...",
          exportCsv: "Exportar CSV",
          expectedVsActual: "Esperado vs. real",
        },
        table: {
          source: "Fonte",
          domains: "Domínios",
        },
        expectedStates: {
          expectedPresent: "Esperado e presente",
          expectedMissing: "Esperado, mas ausente",
          unexpectedBonus: "Dados extras inesperados",
          notExpectedAbsent: "Não esperado, ausente",
        },
        messages: {
          loading: "Carregando matriz de cobertura...",
          noSources: "Nenhuma fonte disponível para análise de cobertura.",
        },
      },
      dqHistory: {
        filters: {
          source: "Fonte:",
          selectSource: "Selecionar fonte...",
        },
        tabs: {
          trends: "Tendências",
          heatmap: "Mapa de calor",
          sla: "SLA",
          overlay: "Entre fontes",
        },
        sections: {
          passRate: "Taxa de aprovação QD por versão",
          heatmap: "Mapa de calor categoria x versão",
          sla: "Painel de conformidade SLA",
          overlay: "Sobreposição QD entre fontes",
        },
        passRate: "Taxa de aprovação",
        deltaReportTitle: "Relatório delta: {{release}}",
        status: {
          new: "NOVO",
          existing: "EXISTENTE",
          resolved: "RESOLVIDO",
          stable: "ESTÁVEL",
        },
        result: {
          pass: "APROVADO",
          fail: "FALHOU",
        },
        statusSummary: {
          new: "{{count}} novos",
          existing: "{{count}} existentes",
          resolved: "{{count}} resolvidos",
          stable: "{{count}} estáveis",
        },
        table: {
          category: "Categoria",
          status: "Situação",
          checkId: "ID da verificação",
          current: "Atual",
          previous: "Anterior",
        },
        sla: {
          targetsTitle: "Metas SLA (taxa mínima de aprovação %)",
          currentCompliance: "Conformidade atual",
          actual: "Real",
          target: "Meta",
          errorBudget: "Orçamento de erro",
          targetComparison: "{{actual}}% / meta {{target}}%",
        },
        messages: {
          selectSource: "Selecione uma fonte para ver o histórico QD.",
          loadingHistory: "Carregando histórico QD...",
          loadingDeltas: "Carregando deltas...",
          loadingHeatmap: "Carregando mapa de calor...",
          loadingOverlay: "Carregando dados de sobreposição...",
          noOverlayData: "Nenhum dado QD disponível entre fontes.",
          noHeatmapData:
            "Nenhum dado de mapa de calor disponível. Execute DQD em várias versões para ver tendências por categoria.",
          noDeltaData: "Nenhum dado delta disponível para esta versão.",
          saved: "Salvo",
          noSlaTargets:
            "Nenhuma meta SLA definida. Defina metas acima para ver conformidade.",
          noTrendData:
            "Nenhum dado de histórico QD disponível. Execute DQD em pelo menos duas versões para ver tendências.",
          trendHelp:
            "Clique em um ponto de versão para ver detalhes delta. Verde >90%, âmbar 80-90%, vermelho <80%.",
          overlayHelp:
            "Taxas de aprovação QD sobrepostas entre todas as fontes em uma linha do tempo unificada.",
        },
        actions: {
          exporting: "Exportando...",
          exportCsv: "Exportar CSV",
          saving: "Salvando...",
          saveSlaTargets: "Salvar metas SLA",
        },
      },
      unmapped: {
        filters: {
          source: "Fonte:",
          selectSource: "Selecionar fonte...",
          release: "Versão:",
          table: "Tabela:",
          allTables: "Todas as tabelas",
          searchPlaceholder: "Pesquisar códigos de origem...",
        },
        viewModes: {
          table: "Tabela",
          pareto: "Pareto",
          vocabulary: "Vocabulário",
        },
        actions: {
          exporting: "Exportando...",
          exportUsagiCsv: "Exportar CSV Usagi",
          previous: "Anterior",
          next: "Próximo",
        },
        summaryBadge: "{{table}} ({{codes}} códigos, {{records}} registros)",
        vocabularyValue: "({{vocabulary}})",
        progress: {
          noCodes: "Nenhum código não mapeado para revisar.",
          title: "Progresso do mapeamento",
          reviewed: "{{percent}}% revisados",
          segmentTitle: "{{label}}: {{count}} ({{percent}}%)",
          label: "{{label}}:",
          status: {
            mapped: "Mapeado",
            deferred: "Adiado",
            excluded: "Excluído",
            pending: "Pendente",
          },
        },
        sections: {
          pareto: "Análise Pareto de códigos não mapeados",
          vocabulary: "Códigos não mapeados por vocabulário",
          suggestions: "Sugestões de mapeamento por IA",
        },
        suggestions: {
          generating: "Gerando sugestões por similaridade pgvector...",
          failed:
            "Falha ao carregar sugestões. O serviço de IA ou os embeddings de conceitos podem estar indisponíveis.",
          empty: "Nenhuma sugestão disponível. Embeddings de conceitos podem não estar carregados.",
          id: "ID: {{id}}",
          accepted: "Aceito",
          accept: "Aceitar",
          skip: "Pular",
        },
        pareto: {
          topCodesCoverage:
            "Os 20 principais códigos cobrem {{percent}}% de todos os registros não mapeados",
          percent: "{{value}}%",
          cumulativePercent: "% cumulativo",
        },
        vocabulary: {
          total: "Geral",
          codeCount: "{{count}} códigos",
        },
        messages: {
          selectSource: "Selecione uma fonte para ver códigos não mapeados.",
          loading: "Carregando códigos não mapeados...",
          emptyPareto: "Nenhum código não mapeado encontrado para análise Pareto.",
          emptyVocabulary: "Nenhum dado de vocabulário disponível.",
          noneFound:
            "Nenhum código de origem não mapeado encontrado. Todos os códigos estão mapeados para conceitos-padrão OMOP.",
          sortedByImpact: "Ordenado por pontuação de impacto (contagem de registros x peso do domínio)",
          showing: "Exibindo {{start}}-{{end}} de {{total}}",
        },
        table: {
          sourceCode: "Código de origem",
          vocabulary: "Vocabulário",
          cdmTable: "Tabela CDM",
          cdmField: "Campo CDM",
          records: "Registros",
          impactScore: "Pontuação de impacto",
        },
      },
      conceptComparison: {
        title: "Comparação de conceitos entre fontes",
        searchPlaceholder:
          "Pesquisar um conceito (ex.: 'Diabetes tipo 2', 'Metformina')...",
        conceptMetadata: "{{domain}} | {{vocabulary}} | ID: {{id}}",
        selectedConceptMetadata:
          "{{domain}} | {{vocabulary}} | ID do conceito: {{id}}",
        temporalTrendTitle: "Tendência temporal: {{concept}}",
        addConceptPlaceholder: "Adicionar outro conceito ({{selected}}/{{max}} selecionados)...",
        cdcNationalRate: "Taxa nacional CDC: {{value}}/1000",
        viewModes: {
          single: "Único",
          temporal: "Ao longo do tempo",
          multi: "Multiconceito",
          funnel: "Funil de atrito",
        },
        rateModes: {
          crude: "Taxa bruta",
          standardized: "Ajustada por idade e sexo",
        },
        metrics: {
          rate: "Taxa/1000",
          count: "Contagem",
          perThousandShort: "{{value}}/1 mil",
          perThousandLong: "{{value}} por 1.000",
        },
        messages: {
          noComparisonData: "Nenhum dado de comparação disponível.",
          noTemporalPrevalenceData: "Nenhum dado de prevalência temporal disponível.",
          selectTwoConcepts: "Selecione pelo menos 2 conceitos para comparar.",
          searching: "Pesquisando...",
          loadingComparison: "Carregando dados de comparação...",
          standardizedNote:
            "Padronizado para a população do Censo dos EUA de 2020 usando padronização direta por idade e sexo.",
          searchToCompare:
            "Pesquise um conceito acima para comparar sua prevalência em todas as fontes de dados.",
          loadingTemporal: "Carregando prevalência temporal...",
          noTemporalData: "Nenhum dado temporal disponível para este conceito.",
          searchForTemporal:
            "Pesquise um conceito acima para ver sua tendência de prevalência temporal entre versões.",
          loadingMulti: "Carregando comparação multiconceito...",
          loadingFunnel: "Carregando funil de atrito...",
          noAttritionData:
            "Nenhum dado de atrito disponível para os conceitos selecionados.",
          temporalPrevalenceHelp:
            "Taxa por 1.000 pessoas ao longo do tempo.",
        },
      },
      releases: {
        releaseTypes: {
          etl: "ETL",
          scheduledEtl: "ETL agendado",
          snapshot: "Instantâneo",
        },
        cdmVersion: "CDM {{version}}",
        vocabularyVersion: "Vocabulário {{version}}",
        personCount: "{{value}} pessoas",
        recordCount: "{{value}} registros",
        actions: {
          showDiff: "Mostrar diff",
          editRelease: "Editar versão",
          createRelease: "Criar versão",
          creating: "Criando...",
          create: "Criar",
          saving: "Salvando...",
          save: "Salvar",
          cancel: "Cancelar",
        },
        etl: {
          provenance: "Proveniência ETL",
          ranBy: "Executado por:",
          codeVersion: "Versão do código:",
          duration: "Duração:",
          started: "Iniciado:",
          parameters: "Parâmetros:",
        },
        duration: {
          hoursMinutes: "{{hours}}h {{minutes}}min",
          minutesSeconds: "{{minutes}}min {{seconds}}s",
          seconds: "{{seconds}}s",
        },
        confirmDelete: "Excluir esta versão?",
        tabs: {
          list: "Versões",
          swimlane: "Raias",
          calendar: "Calendário",
        },
        timelineTitle: "Linha do tempo de versões (todas as fontes)",
        calendarTitle: "Calendário de versões",
        selectSource: "Selecionar uma fonte",
        form: {
          releaseName: "Nome da versão",
          cdmVersion: "Versão CDM",
          vocabularyVersion: "Versão do vocabulário",
          etlVersion: "Versão ETL",
          notes: "Notas",
          notesPlaceholder: "Notas da versão...",
          cdmVersionOptional: "Versão CDM (opcional)",
          vocabularyVersionOptional: "Versão do vocabulário (opcional)",
          cdmVersionPlaceholder: "CDM v5.4",
          vocabularyVersionPlaceholder: "2024-11-01",
          etlVersionPlaceholder: "v1.2.3",
        },
        empty: {
          selectSource: "Selecione uma fonte para ver suas versões",
          noReleases: "Nenhuma versão ainda para esta fonte",
          noReleaseData: "Nenhum dado de versão disponível.",
        },
        calendar: {
          noEvents: "Nenhum evento de versão.",
          dayEvents: "{{date}}: {{count}} versões",
          less: "Menos",
          more: "Mais",
        },
        diff: {
          computing: "Calculando diff...",
          title: "Diff da versão",
          initialRelease: "Versão inicial -- nenhum dado anterior para comparar.",
          persons: "Pessoas:",
          records: "Registros:",
          dqScore: "Pontuação QD:",
          unmapped: "Não mapeados:",
          vocabUpdated: "Vocabulário atualizado",
          domainDeltas: "Deltas por domínio:",
        },
      },
      diversity: {
        title: "Relatório de diversidade",
        description:
          "Proporções demográficas entre fontes de dados. Fontes ordenadas por tamanho da população.",
        ratings: {
          very_high: "muito alta",
          high: "alta",
          moderate: "moderada",
          low: "baixa",
        },
        percentValue: "{{value}}%",
        labelPercentValue: "{{label}}: {{value}}%",
        personCount: "{{value}} pessoas",
        labels: {
          gender: "Gênero",
          race: "Raça",
          ethnicity: "Etnia",
          male: "Masculino",
          female: "Feminino",
        },
        dimensions: {
          composite: "Composto",
          gender: "Gênero",
          race: "Raça",
          ethnicity: "Etnia",
        },
        tabs: {
          overview: "Visão geral",
          pyramid: "Pirâmide etária",
          dap: "Lacuna DAP",
          pooled: "Agrupado",
          geographic: "Geográfico",
          trends: "Tendências",
        },
        filters: {
          selectSource: "Selecionar uma fonte",
        },
        benchmarks: {
          usCensus2020: "Censo dos EUA 2020",
        },
        dap: {
          title: "Análise de lacunas de inscrição FDA DAP",
          description:
            "Compara a demografia da fonte com referências do Censo dos EUA de 2020 para identificar lacunas de inscrição.",
          tooltip: "Real: {{actual}}% | Meta: {{target}}% | Lacuna: {{gap}}%",
          status: {
            met: "Atendida (dentro de 2%)",
            gap: "Lacuna (2-10%)",
            critical: "Crítica (>10%)",
          },
        },
        agePyramid: {
          title: "{{source}} -- Distribuição etária",
        },
        benchmark: {
          title: "Referência: {{label}}",
          actual: "Real",
          benchmark: "Referência",
        },
        trends: {
          title: "Tendências de diversidade: {{source}}",
          description:
            "Índice de diversidade de Simpson por versão (0 = homogêneo, 1 = diversidade máxima)",
        },
        geographic: {
          loading: "Carregando dados de diversidade geográfica...",
          noLocationData: "Nenhum dado de localização disponível",
          noAdiData:
            "Dados ADI indisponíveis (o módulo GIS pode não ter ADI carregado)",
          noGeographicData:
            "Nenhum dado geográfico disponível. As fontes podem não ter dados de localização na tabela person.",
          statesCovered: "Estados / regiões cobertos",
          networkMedianAdi: "ADI mediano da rede:",
          sourcesWithLocation: "Fontes com dados de localização",
          sourcesWithAdi: "Fontes com dados ADI",
          stateCount: "{{count}} estados",
          medianAdiValue: "ADI mediano: {{value}}",
          topStates: "Principais estados por contagem de pacientes",
          adiDistribution: "Distribuição de decis ADI",
          leastDeprived: "Menor privação",
          adiDecile: "Decil ADI",
          mostDeprived: "Maior privação",
          decileTitle: "Decil {{decile}}: {{count}} códigos ZIP",
          adiRatings: {
            low: "Baixa privação",
            moderate: "Privação moderada",
            high: "Alta privação (subatendida)",
          },
        },
        pooled: {
          title: "Demografia agrupada",
          description:
            "Selecione várias fontes para ver perfis demográficos mesclados e ponderados.",
          summary: "Total: {{persons}} pessoas em {{sources}} fontes",
        },
        messages: {
          loading: "Carregando dados de diversidade...",
          noSources: "Nenhuma fonte disponível para análise de diversidade.",
          noData: "Nenhum dado",
          noTrendData: "Nenhum dado de versão disponível para tendências de diversidade.",
          noTrendReleases:
            "Nenhuma versão encontrada para esta fonte. Crie versões para acompanhar tendências de diversidade.",
        },
      },
      cost: {
        empty: {
          title: "Nenhum dado de custo disponível",
          message:
            "Dados de custo exigem conjuntos baseados em sinistros/claims (ex.: MarketScan, Optum, PharMetrics). Conjuntos derivados de EHR como SynPUF, MIMIC-IV e a maioria dos dados de centros médicos acadêmicos normalmente não preenchem a tabela OMOP cost.",
        },
        filters: {
          source: "Fonte:",
          selectSource: "Selecionar fonte...",
        },
        tabs: {
          overview: "Visão geral",
          distribution: "Distribuição",
          "care-setting": "Cenário de cuidado",
          trends: "Tendências",
          drivers: "Direcionadores de custo",
          "cross-source": "Entre fontes",
        },
        messages: {
          selectSource: "Selecione uma fonte para ver dados de custo.",
          loading: "Carregando dados de custo...",
          distributionHelp:
            "Box plots mostrando dispersão de custo. Caixa = IQR (P25-P75), hastes = P10-P90, linha dourada = mediana, ponto vermelho = média.",
          noDistributionData: "Nenhum dado de distribuição disponível.",
          noCareSettingData:
            "Nenhum dado de custo por cenário de cuidado disponível. Requer registros de custo do domínio Visit unidos a visit_occurrence.",
          selectSourceForDrivers: "Selecione uma fonte para ver direcionadores de custo.",
          loadingDrivers: "Carregando direcionadores de custo...",
          noDriverData: "Nenhum dado de direcionador de custo disponível para esta fonte.",
          costDriversHelp:
            "Top 10 conceitos por custo total. Clique em uma barra para ver detalhes do conceito.",
          loadingCrossSource: "Carregando comparação entre fontes...",
          noComparisonSources: "Nenhuma fonte disponível para comparação.",
          noCrossSourceCostData:
            "Nenhuma fonte tem dados de custo para comparação.",
          crossSourceHelp:
            "Box plot por fonte. Caixa = IQR (P25-P75), hastes = P10-P90, linha dourada = mediana.",
        },
        metrics: {
          totalCost: "Custo total",
          perPatientPerYear: "Por paciente por ano",
          persons: "Pessoas",
          observationYears: "{{value}} ano(s)",
          avgObservation: "Observação média",
          recordsAverage: "{{records}} registros | média {{average}}",
          recordCount: "{{count}} registros",
          patientCount: "{{count}} pacientes",
          averagePerRecord: "Média: {{value}}/registro",
          medianValue: "Mediana: {{value}}",
          meanValue: "Média: {{value}}",
          percent: "{{value}}%",
          range: "Intervalo: {{min}} - {{max}}",
        },
        costTypeFilter: {
          title: "Vários tipos de custo detectados.",
          message:
            "Esta fonte tem {{count}} conceitos de tipo de custo diferentes. Misturar valores cobrados com valores pagos produz estatísticas enganosas. Filtre por tipo de custo para uma análise precisa.",
          allTypes: "Todos os tipos",
          option: "{{name}} ({{count}})",
        },
        sections: {
          costByDomain: "Custo por domínio",
          distributionByDomain: "Distribuição de custos por domínio",
          costByCareSetting: "Custo por cenário de cuidado",
          monthlyTrends: "Tendências mensais de custo",
          topCostDrivers: "Principais direcionadores de custo",
          crossSourceComparison: "Comparação de custos entre fontes",
        },
      },
    },
  },
  administration: {
    dashboard: {
      title: "Administração",
      subtitle: "Gerencie usuários, funções, permissões e configuração do sistema.",
      panels: {
        platform: "Plataforma",
        usersAccess: "Usuários e acesso",
        dataSources: "Fontes de dados",
        aiResearch: "IA e pesquisa"
      },
      status: {
        allHealthy: "Tudo saudável",
        degraded: "Degradado",
        warning: "Aviso"
      },
      labels: {
        services: "Serviços",
        queue: "Fila",
        redis: "Redis",
        totalUsers: "Total de usuários",
        roles: "Funções",
        authProviders: "Provedores de autenticação",
        tokenExpiry: "Expiração do token",
        solr: "Solr",
        aiProvider: "Provedor de IA",
        model: "Modelo",
        abby: "Abby",
        researchRuntime: "R / HADES"
      },
      values: {
        servicesUp: "{{healthy}}/{{total}} ativos",
        queueSummary: "{{pending}} pendentes / {{failed}} com falha",
        enabledCount: "{{count}} ativados",
        tokenExpiry: "8h",
        cdmCount: "{{count}} CDM",
        solrSummary: "documentos {{docs}} / núcleos {{cores}}",
        none: "Nenhum",
        online: "On-line"
      },
      messages: {
        noCdmSources: "Nenhuma fonte CDM configurada"
      },
      nav: {
        userManagement: {
          title: "Gerenciamento de usuários",
          description: "Crie, edite e desative contas. Atribua funções para controlar o acesso."
        },
        rolesPermissions: {
          title: "Funções e permissões",
          description: "Defina funções personalizadas e ajuste permissões em todos os domínios."
        },
        authProviders: {
          title: "Provedores de autenticação",
          description: "Ative e configure LDAP, OAuth 2.0, SAML 2.0 ou OIDC para SSO."
        },
        aiProviders: {
          title: "Configuração do provedor de IA",
          description: "Alterne o backend da Abby entre Ollama local, Anthropic, OpenAI, Gemini e outros."
        },
        systemHealth: {
          title: "Integridade do sistema",
          description: "Status em tempo real dos serviços Parthenon: Redis, IA, Darkstar, Solr, Orthanc PACS e filas de tarefas."
        },
        vocabularyManagement: {
          title: "Gerenciamento de vocabulário",
          description: "Atualize tabelas de vocabulário OMOP enviando um novo ZIP Athena."
        },
        fhirConnections: {
          title: "Conexões FHIR EHR",
          description: "Gerencie conexões FHIR R4 com Epic, Cerner e outros EHRs para importação em massa."
        }
      },
      setupWizard: {
        title: "Assistente de configuração da plataforma",
        description: "Execute novamente a configuração guiada: saúde, provedor de IA, autenticação e fontes de dados."
      },
      atlasMigration: {
        title: "Migrar do Atlas",
        description: "Importe definições de coorte, conjuntos de conceitos e análises de uma instalação OHDSI Atlas existente."
      },
      actions: {
        open: "Abrir",
        openWizard: "Abrir assistente"
      }
    },
    acropolisServices: {
      descriptions: {
        authentik: "Provedor de identidade e portal de acesso",
        wazuh: "Monitoramento de segurança e painel SIEM",
        grafana: "Painéis de métricas e observabilidade",
        portainer: "Operações de contêiner e pilha",
        pgadmin: "console de administração PostgreSQL",
        n8n: "Orquestração e automação de fluxo de trabalho",
        superset: "Espaço de trabalho de análise BI e ad hoc",
        datahub: "Catálogo de metadados e explorador de linhagem"
      },
      openService: "Serviço aberto"
    },
    grafana: {
      openDashboard: "Abrir painel"
    },
    broadcastEmail: {
      title: "E-mail de transmissão",
      descriptionPrefix: "Isso enviará um e-mail individual para cada um dos",
      descriptionSuffix: "usuários cadastrados.",
      subject: "Assunto",
      subjectPlaceholder: "Linha de assunto do e-mail...",
      message: "Mensagem",
      messagePlaceholder: "Escreva aqui sua mensagem...",
      close: "Fechar",
      cancel: "Cancelar",
      sending: "Enviando...",
      sendToAll: "Enviar para todos os usuários",
      resultWithRecipients: "{{message}} (destinatários {{count}})",
      unknownError: "Erro desconhecido"
    },
    userModal: {
      titles: {
        editUser: "Editar usuário",
        newUser: "Novo usuário"
      },
      fields: {
        fullName: "Nome completo",
        email: "E-mail",
        password: "Senha",
        roles: "Funções"
      },
      hints: {
        keepCurrentPassword: "(deixe em branco para se manter atualizado)"
      },
      placeholders: {
        maskedPassword: "••••••••",
        passwordRequirements: "Mínimo de 8 caracteres, letras maiúsculas e minúsculas + número"
      },
      actions: {
        cancel: "Cancelar",
        saving: "Salvando...",
        saveChanges: "Salvar alterações",
        createUser: "Criar usuário"
      },
      errors: {
        generic: "Ocorreu um erro.",
        passwordRequired: "A senha é obrigatória."
      }
    },
    liveKit: {
      loadingConfiguration: "Carregando configuração...",
      provider: "Provedor",
      providerBadges: {
        cloud: "Nuvem",
        "self-hosted": "Auto-hospedado",
        env: "Ambiente"
      },
      providerOptions: {
        environment: "Ambiente",
        liveKitCloud: "Nuvem LiveKit",
        selfHosted: "Auto-hospedado"
      },
      providerDescriptions: {
        useEnvFile: "Usar arquivo .env",
        hostedByLiveKit: "Hospedado por LiveKit",
        yourOwnServer: "Seu próprio servidor"
      },
      env: {
        usingEnvConfiguration: "Usando configuração .env",
        url: "URL:",
        apiKey: "Chave API:",
        apiSecret: "Segredo API:",
        notSet: "Não definido",
        missing: "Ausente",
        editPrefix: "Editar",
        editSuffix: "e reinicie o PHP para mudar."
      },
      fields: {
        cloudUrl: "LiveKit Nuvem URL",
        serverUrl: "Servidor URL",
        apiKey: "Chave API",
        apiSecret: "Segredo API"
      },
      placeholders: {
        savedKey: "Salvo; insira uma nova chave para substituí-la",
        savedSecret: "Salvo; insira um novo segredo para substituí-lo",
        enterApiKey: "Digite a chave API",
        enterApiSecret: "Digite o segredo API"
      },
      actions: {
        hideConfiguration: "Ocultar configuração",
        configureLiveKit: "Configurar LiveKit",
        testConnection: "Conexão de teste",
        saveConfiguration: "Salvar configuração",
        useEnvDefaults: "Use padrões .env"
      },
      toasts: {
        noUrlToTest: "Não há URL para testar",
        connectionSuccessful: "Conexão bem-sucedida",
        connectionFailed: "Falha na conexão",
        configurationSaved: "Configuração LiveKit salva",
        saveFailed: "Falha ao salvar a configuração"
      }
    },
    authProviders: {
      title: "Provedores de autenticação",
      subtitle: "Ative um ou mais provedores de identidade externos para single sign-on. Usuário/senha Sanctum permanece sempre disponível como fallback.",
      providers: {
        ldap: {
          label: "LDAP/Diretório Ativo",
          description: "Autentique com Microsoft Active Directory ou qualquer diretório LDAP v3. Suporta TLS, sincronização de grupos e mapeamento de atributos."
        },
        oauth2: {
          label: "OAuth 2.0",
          description: "Delegue autenticação ao GitHub, Google, Microsoft ou a qualquer provedor OAuth 2.0 personalizado."
        },
        saml2: {
          label: "SAML 2.0",
          description: "SSO corporativo por um provedor de identidade SAML 2.0 (Okta, Azure AD, ADFS, etc.)."
        },
        oidc: {
          label: "Conexão OpenID",
          description: "SSO moderno por descoberta OIDC. Suporta PKCE e qualquer IdP compatível com padrões."
        }
      },
      enabled: "Ativado",
      disabled: "Desativado",
      configure: "Configurar",
      testConnection: "Testar conexão",
      connectionSuccessful: "Conexão bem-sucedida",
      connectionFailed: "Falha na conexão",
      usernamePassword: "Usuário e senha",
      alwaysOn: "Sempre ativo",
      builtIn: "Autenticação Sanctum integrada - sempre ativa.",
      loading: "Carregando provedores...",
      formActions: {
        saving: "Salvando...",
        save: "Salvar",
        saved: "Salvo"
      },
      oauthForm: {
        drivers: {
          github: "GitHub",
          google: "Google",
          microsoft: "Microsoft/Azure AD",
          custom: "OAuth 2.0 personalizado"
        },
        sections: {
          customEndpoints: "Endpoints personalizados"
        },
        labels: {
          provider: "Provedor",
          clientId: "ID do cliente",
          clientSecret: "Segredo do cliente",
          redirectUri: "URI de redirecionamento",
          scopes: "Escopos",
          authorizationUrl: "URL de autorização",
          tokenUrl: "URL do token",
          userInfoUrl: "URL de informações do usuário"
        },
        hints: {
          redirectUri: "Deve corresponder à URI registrada no provedor OAuth",
          scopes: "Lista separada por espaços"
        },
        placeholders: {
          clientId: "Cliente/Aplicativo ID",
          redirectUri: "/api/v1/auth/oauth2/retorno de chamada",
          scopes: "e-mail de perfil openid"
        }
      },
      oidcForm: {
        labels: {
          discoveryUrl: "URL de descoberta",
          clientId: "ID do cliente",
          clientSecret: "Segredo do cliente",
          redirectUri: "URI de redirecionamento",
          scopes: "Escopos",
          pkceEnabled: "Ativar PKCE (recomendado - requer cliente público)"
        },
        hints: {
          discoveryUrl: "O endpoint /.well-known/openid-configuration do seu IdP",
          redirectUri: "Deve corresponder ao que está registrado no IdP",
          scopes: "Separados por espaços"
        },
        placeholders: {
          discoveryUrl: "https://accounts.google.com/.well-known/openid-configuration",
          clientId: "seu-ID-cliente",
          redirectUri: "/api/v1/auth/oidc/callback",
          scopes: "e-mail de perfil openid"
        }
      },
      samlForm: {
        sections: {
          identityProvider: "Provedor de identidade (IdP)",
          serviceProvider: "Provedor de serviço (SP)",
          attributeMapping: "Mapeamento de atributos"
        },
        labels: {
          idpEntityId: "ID de entidade IdP",
          ssoUrl: "URL SSO",
          sloUrl: "URL SLO",
          idpCertificate: "Certificado IdP",
          spEntityId: "ID de entidade SP",
          acsUrl: "URL ACS",
          nameIdFormat: "Formato NameID",
          signAssertions: "Assinar assertions (requer chave privada SP - configure no ambiente do servidor)",
          emailAttribute: "Atributo de e-mail",
          displayNameAttribute: "Atributo de nome exibido"
        },
        hints: {
          ssoUrl: "Endpoint de Single Sign-On",
          sloUrl: "Endpoint de Single Logout (opcional)",
          idpCertificate: "Cole o certificado X.509 (formato PEM, com ou sem cabeçalhos)",
          spEntityId: "URL da sua instância Parthenon - deve corresponder ao registrado no IdP",
          acsUrl: "Afirmação de Atendimento ao Consumidor"
        },
        placeholders: {
          certificate: "-----BEGIN CERTIFICATE-----\nMIIDxTCC...\n-----END CERTIFICATE-----",
          acsUrl: "/api/v1/auth/saml2/retorno de chamada",
          sloUrl: "/api/v1/auth/saml2/logout",
          displayName: "nome de exibição"
        },
        attributeMappingDescription: "Mapeie atributos da assertion SAML para campos de usuário do Parthenon."
      },
      ldapForm: {
        sections: {
          connection: "Conexão",
          bindCredentials: "Credenciais de bind",
          userSearch: "Busca de usuário",
          attributeMapping: "Mapeamento de atributos",
          groupSync: "Sincronização de grupos"
        },
        labels: {
          host: "Hospedar",
          port: "Porta",
          useSsl: "Usar SSL (LDAPS)",
          useTls: "Usar StartTLS",
          timeout: "Tempo limite (s)",
          bindDn: "DN de bind",
          bindPassword: "Senha de bind",
          baseDn: "DN base",
          userSearchBase: "Base de busca de usuário",
          userFilter: "Filtro de usuário",
          usernameField: "Campo de usuário",
          emailField: "Campo de e-mail",
          displayNameField: "Campo de nome exibido",
          syncGroups: "Sincronizar grupos LDAP com funções do Parthenon",
          groupSearchBase: "Base de busca de grupos",
          groupFilter: "Filtro de grupo"
        },
        hints: {
          host: "Nome do host ou IP do servidor LDAP",
          bindDn: "DN da conta de serviço usada para consultas ao diretório",
          userFilter: "{username} é substituído no login"
        },
        placeholders: {
          bindDn: "cn=svc-parthenon,dc=exemplo,dc=com",
          baseDn: "dc=exemplo,dc=com",
          userSearchBase: "ou=usuários,dc=exemplo,dc=com",
          userFilter: "(uid={nome de usuário})",
          groupSearchBase: "ou=grupos,dc=exemplo,dc=com",
          groupFilter: "(objectClass=grupoDeNomes)"
        },
        actions: {
          saving: "Salvando...",
          save: "Salvar",
          saved: "Salvo"
        }
      }
    },
    roles: {
      title: "Funções e permissões",
      subtitle: "Defina funções personalizadas e ajuste as atribuições de permissões. Use a matriz para edições em massa.",
      tabs: {
        roleList: "Lista de funções",
        permissionMatrix: "Matriz de permissão"
      },
      permissionMatrix: {
        instructions: "Clique nas células para alternar permissões · cabeçalhos de linha para aplicar a todas as funções · cabeçalhos de coluna para conceder/revogar tudo para uma função.",
        saveAllChangesOne: "Salvar todas as alterações (função {{count}})",
        saveAllChangesOther: "Salvar todas as alterações (funções {{count}})",
        permission: "Permissão",
        columnTitle: "Alternar todas as permissões para {{role}}",
        permissionCount: "{{count}} perms",
        saving: "salvando...",
        saved: "salvo ✓",
        save: "salvar",
        domainTitle: "Alternar todas as permissões {{domain}} em todas as funções",
        rowTitle: "Alternar {{permission}} para todas as funções",
        cellTitleGrant: "Conceder {{permission}} a {{role}}",
        cellTitleRevoke: "Revogar {{permission}} de {{role}}"
      },
      editor: {
        roleName: "Nome da função",
        roleNamePlaceholder: "por exemplo coordenador de site",
        permissions: "Permissões",
        selectedCount: "({{count}} selecionado)"
      },
      actions: {
        newRole: "Nova função",
        cancel: "Cancelar",
        saving: "Salvando...",
        saveRole: "Salvar função",
        editRole: "Editar função",
        deleteRole: "Excluir função",
        deleting: "Excluindo...",
        delete: "Excluir"
      },
      values: {
        builtIn: "embutido",
        userCountOne: "usuário {{count}}",
        userCountOther: "usuários {{count}}",
        permissionCountOne: "permissão {{count}}",
        permissionCountOther: "permissões {{count}}",
        more: "+{{count}} mais"
      },
      deleteModal: {
        title: "Excluir função?",
        prefix: "O papel",
        suffix: "será excluído permanentemente. Os usuários atribuídos apenas a esta função perderão todas as permissões."
      }
    },
    pacs: {
      studyBrowser: {
        browseTitle: "Navegar: {{name}}",
        filters: {
          patientName: "Nome do paciente",
          patientId: "Paciente ID",
          allModalities: "Todas as Modalidades"
        },
        empty: {
          noStudies: "Nenhum estudo encontrado"
        },
        table: {
          patientName: "Nome do paciente",
          patientId: "Paciente ID",
          date: "Data",
          modality: "Modalidade",
          description: "Descrição",
          series: "Série",
          instances: "Inst."
        },
        pagination: {
          range: "{{start}}-{{end}}",
          ofStudies: "de estudos {{total}}",
          previous: "Anterior",
          next: "Próximo"
        }
      },
      connectionCard: {
        defaultConnection: "Conexão padrão",
        setAsDefault: "Definir como padrão",
        deleteConfirm: "Excluir \"{{name}}\"?",
        never: "Nunca",
        seriesByModality: "Séries por Modalidade",
        statsUpdated: "Estatísticas atualizadas {{date}}",
        stats: {
          patients: "Pacientes",
          studies: "Estudos",
          series: "Série",
          instances: "Instâncias",
          disk: "Disco"
        },
        actions: {
          edit: "Editar",
          delete: "Excluir",
          test: "Teste",
          stats: "Estatísticas",
          browse: "Navegar"
        }
      }
    },
    solrAdmin: {
      title: "Administração de pesquisa Solr",
      subtitle: "Gerencie núcleos de pesquisa Solr, acione a reindexação e monitore o status.",
      loadingCoreStatus: "Carregando status principal...",
      status: {
        healthy: "Saudável",
        unavailable: "Indisponível"
      },
      labels: {
        documents: "Documentos",
        lastIndexed: "Última indexação",
        duration: "Duração"
      },
      values: {
        never: "Nunca",
        seconds: "{{seconds}}s"
      },
      actions: {
        reindexAll: "Reindexar todos os núcleos",
        reindex: "Reindexar",
        fullReindex: "Reindexação completa",
        clear: "Limpar"
      },
      messages: {
        fetchFailed: "Falha ao buscar o status Solr",
        reindexCompleted: "Reindexação de '{{core}}' concluída",
        reindexFailed: "Falha ao reindexar '{{core}}'",
        reindexAllCompleted: "Reindexação concluída",
        reindexAllFailed: "Falha ao reindexar todos os núcleos",
        clearConfirm: "Tem certeza de que deseja limpar todos os documentos de '{{core}}'? Isto não pode ser desfeito.",
        clearCompleted: "Núcleo '{{core}}' limpo",
        clearFailed: "Falha ao limpar '{{core}}'"
      }
    },
    aiProviders: {
      title: "Configuração do provedor de IA",
      subtitle: "Escolha qual backend de IA alimenta a Abby. Apenas um provedor fica ativo por vez. Chaves de API são armazenadas criptografadas.",
      activeProvider: "Provedor ativo:",
      fields: {
        model: "Modelo",
        apiKey: "Chave de API",
        ollamaBaseUrl: "URL base do Ollama"
      },
      placeholders: {
        modelName: "Nome do modelo"
      },
      values: {
        active: "Ativo",
        enabled: "Ativado",
        disabled: "Desativado",
        noModelSelected: "Nenhum modelo selecionado"
      },
      actions: {
        currentlyActive: "Ativo no momento",
        setAsActive: "Definir como ativo",
        save: "Salvar",
        testConnection: "Testar conexão"
      },
      messages: {
        requestFailed: "A requisição falhou."
      }
    },
    gisImport: {
      steps: {
        upload: "Carregar",
        analyze: "Analisar",
        mapColumns: "Colunas do mapa",
        configure: "Configurar",
        validate: "Validar",
        import: "Importar"
      },
      analyze: {
        analysisFailed: "Abby encontrou um problema ao analisar este arquivo.",
        unknownError: "Erro desconhecido",
        retry: "Tentar novamente",
        analyzing: "Abby está analisando seus dados...",
        detecting: "Detectando tipos de colunas, códigos geográficos e semântica de valores"
      },
      upload: {
        uploading: "Fazendo upload...",
        dropPrompt: "Solte um arquivo aqui ou clique para navegar",
        acceptedFormats: "CSV, TSV, Excel, Shapefile (.zip), GeoJSON, KML, GeoPackage - máximo {{maxSize}}MB",
        largeFiles: "Para arquivos grandes (> {{maxSize}}MB)",
        fileTooLarge: "O arquivo excede {{maxSize}}MB. Use CLI: php artesão gis:import {{filename}}",
        uploadFailed: "Falha no upload"
      },
      configure: {
        fields: {
          layerName: "Nome da camada",
          exposureType: "Tipo de exposição",
          geographyLevel: "Nível geográfico",
          valueType: "Tipo de valor",
          aggregation: "Agregação"
        },
        placeholders: {
          layerName: "por exemplo, Índice de Vulnerabilidade Social",
          exposureType: "por exemplo, svi_overall"
        },
        geographyLevels: {
          county: "Condado",
          tract: "Setor Censitário",
          state: "Estado",
          country: "País",
          custom: "Personalizado"
        },
        valueTypes: {
          continuous: "Contínuo (coropleto)",
          categorical: "Categórico (cores discretas)",
          binary: "Binário (presença/ausência)"
        },
        aggregations: {
          mean: "Significar",
          sum: "Soma",
          maximum: "Máximo",
          minimum: "Mínimo",
          latest: "Mais recente"
        },
        saving: "Salvando...",
        continue: "Continuar"
      },
      mapping: {
        title: "Mapeamento de colunas",
        subtitle: "Mapeie cada coluna de origem de acordo com sua finalidade",
        purposes: {
          geographyCode: "Código Geográfico",
          geographyName: "Nome geográfico",
          latitude: "Latitude",
          longitude: "Longitude",
          valueMetric: "Valor (métrica)",
          metadata: "Metadados",
          skip: "Pular"
        },
        confidence: {
          high: "Alto",
          medium: "Médio",
          low: "Baixo"
        },
        askAbby: "Pergunte ao Abby",
        abbyOnColumn: "Abby em \"{{column}}\":",
        thinking: "Pensamento...",
        saving: "Salvando...",
        continue: "Continuar"
      },
      validate: {
        validating: "Validando...",
        validationFailed: "Falha na validação:",
        unknownError: "Erro desconhecido",
        results: "Resultados de validação",
        stats: {
          totalRows: "Total de linhas",
          uniqueGeographies: "Geografias Únicas",
          matched: "Correspondido",
          unmatched: "Incomparável (stubs)",
          matchRate: "Taxa de correspondência",
          geographyType: "Tipo de geografia"
        },
        unmatchedWarning: "Geografias {{count}} não encontradas no banco de dados. Serão criadas entradas de stub (sem geometria de limite).",
        backToMapping: "Voltar ao Mapeamento",
        proceedWithImport: "Prossiga com a importação"
      },
      import: {
        starting: "Começando...",
        startImport: "Iniciar importação",
        importing: "Importando... {{progress}}%",
        complete: "Importação concluída",
        rowsImported: "Linhas {{count}} importadas",
        saveLearningPrompt: "Salve os mapeamentos para que o Abby aprenda para a próxima vez",
        saveToAbby: "Salvar em Abby",
        viewInGisExplorer: "Ver no GIS Explorer",
        importAnother: "Importar outro",
        failed: "Falha na importação",
        startOver: "Recomeçar"
      }
    },
    chromaStudio: {
      title: "Estúdio de Coleção Chroma",
      subtitle: "Inspecione coleções de vetores, execute consultas semânticas e gerencie a ingestão",
      values: {
        collectionCount: "coleções {{count}}",
        loading: "carregando",
        loadingEllipsis: "Carregando...",
        countSuffix: "({{count}})",
        sampledSuffix: "({{count}} amostrado)"
      },
      actions: {
        refreshCollections: "Atualizar coleções",
        ingestDocs: "Ingerir documentos",
        ingestClinical: "Ingerir Clínica",
        promoteFaq: "Promova FAQ",
        ingestOhdsiPapers: "Ingerir documentos OHDSI",
        ingestOhdsiKnowledge: "Ingerir conhecimento OHDSI",
        ingestTextbooks: "Ingerir livros didáticos"
      },
      stats: {
        vectors: "Vectors",
        sampled: "Amostrado",
        dimensions: "Dimensões",
        metaFields: "Metacampos"
      },
      messages: {
        loadingCollectionData: "Carregando dados de coleta..."
      },
      empty: {
        title: "Esta coleção está vazia",
        description: "Use as ações de ingestão acima para preencher \"{{collection}}\" com documentos.",
        noRecords: "Não há registros nesta coleção.",
        noDocumentReturned: "Nenhum documento foi devolvido.",
        noDocumentText: "Nenhum texto do documento disponível."
      },
      tabs: {
        overview: "Visão geral",
        retrieval: "Recuperação"
      },
      search: {
        placeholder: "Consulta semântica...",
        recentQueries: "Consultas recentes",
        kLabel: "K:",
        queryAction: "Consulta",
        empty: "Insira uma consulta acima e clique em Consulta para inspecionar os resultados da recuperação.",
        queryLabel: "Consulta:",
        resultsCount: "resultados {{count}}",
        querying: "Consultando...",
        distance: "distância"
      },
      overview: {
        facetDistribution: "Distribuição de facetas",
        sampleRecords: "Registros de amostra",
        collectionMetadata: "Metadados de coleção"
      }
    },
    vectorExplorer: {
      title: "Explorador Vector",
      semanticMapTitle: "Mapa Semântico {{dimensions}}D",
      loading: {
        computingProjection: "Projeção computacional",
        runningProjection: "Executando PCA->UMAP em vetores {{sample}} ...",
        recomputingProjection: "Recalculando projeção..."
      },
      values: {
        all: "todos",
        loadingEllipsis: "Carregando...",
        countSuffix: "({{count}})",
        sampled: "{{count}} amostrado",
        dimensions: "{{dimensions}}D",
        knnEdges: "k={{neighbors}} - arestas {{edges}}",
        seconds: "{{seconds}}s",
        points: "{{count}} pontos",
        cachedSuffix: "- em cache",
        fallbackSuffix: "- cair pra trás",
        timeSuffix: "- {{seconds}}s"
      },
      modes: {
        clusters: "Aglomerados",
        query: "Consulta",
        qa: "QA"
      },
      sample: {
        label: "Amostra",
        confirmLoadAll: "Carregar todos os vetores {{count}}? Isso pode levar muito mais tempo.",
        steps: {
          all: "Todos"
        }
      },
      empty: {
        selectCollection: "Selecione uma coleção para visualizar os embeddings."
      },
      tooltips: {
        requiresAiService: "Requer conexão com o serviço de IA"
      },
      controls: {
        colorBy: "Colorir por",
        modeDefault: "Modo padrão"
      },
      search: {
        placeholder: "Pesquise dentro do espaço vetorial",
        searching: "Procurando...",
        search: "Pesquisar",
        visibleResults: "resultados {{visible}} de {{total}} visíveis nesta projeção"
      },
      query: {
        anchor: "Âncora de consulta"
      },
      sections: {
        overlays: "Sobreposições",
        clusterProfile: "Perfil de cluster",
        inspector: "Inspetor"
      },
      inspector: {
        selectPoint: "Clique em um ponto para inspecionar.",
        loadingDetails: "Carregando detalhes completos...",
        flags: {
          outlier: "Atípico",
          duplicate: "Duplicado",
          orphan: "Órfão"
        }
      },
      overlays: {
        clusterHulls: {
          label: "Cascos de cluster",
          help: "Envelopes convexos em torno de clusters"
        },
        topologyLines: {
          label: "Linhas de topologia",
          help: "links k-NN entre pontos próximos"
        },
        queryRays: {
          label: "Consultar raios",
          help: "Links de similaridade âncora-resultado"
        }
      },
      stats: {
        totalVectors: "Vetores totais",
        sampled: "Amostrado",
        projection: "Projeção",
        knnGraph: "gráfico k-NN",
        source: "Fonte",
        projectionTime: "Tempo de projeção",
        indexed: "Indexado"
      },
      sources: {
        solrCached: "Solr (em cache)",
        clientFallback: "Reserva de cliente",
        liveUmap: "Ao vivo UMAP"
      },
      actions: {
        recomputeProjection: "Recalcular a projeção",
        expand: "Expandir"
      },
      legend: {
        clusters: "Aglomerados",
        quality: "Qualidade",
        similarity: "Semelhança",
        hide: "Esconder",
        show: "Mostrar"
      },
      quality: {
        outliers: "Valores discrepantes",
        duplicates: "Duplicatas",
        duplicatePairs: "Pares duplicados",
        orphans: "Órfãos",
        normal: "Normal",
        outOfSampled: "fora de {{count}} amostrado",
        exportCsv: "Exportar CSV"
      },
      clusterProfile: {
        selectCluster: "Selecione um cluster para inspecionar seus metadados dominantes.",
        clusterSize: "Tamanho do cluster",
        dominantMetadata: "Metadados dominantes",
        representativeTitles: "Títulos Representativos"
      }
    },
    pacsConnectionModal: {
      title: {
        add: "Adicionar conexão PACS",
        edit: "Editar conexão PACS"
      },
      description: "Configure uma conexão do servidor de imagem DICOM.",
      fields: {
        name: "Nome",
        type: "Tipo",
        authType: "Tipo de autenticação",
        baseUrl: "Base URL",
        username: "Nome de usuário",
        password: "Senha",
        bearerToken: "Token do Portador",
        linkedSource: "Fonte vinculada (opcional)",
        active: "Ativo"
      },
      placeholders: {
        name: "Servidor PACS principal",
        keepExisting: "Deixe em branco para continuar existindo",
        password: "senha",
        token: "ficha"
      },
      types: {
        orthanc: "Orthanc",
        dicomweb: "DICOMweb",
        googleHealthcare: "Google Saúde",
        cloud: "Nuvem"
      },
      auth: {
        none: "Nenhum",
        basic: "Autenticação Básica",
        bearer: "Token do Portador"
      },
      values: {
        latency: "({{ms}}ms)"
      },
      actions: {
        testConnection: "Conexão de teste",
        cancel: "Cancelar",
        saveChanges: "Salvar alterações",
        createConnection: "Criar conexão"
      },
      errors: {
        testRequestFailed: "Falha na solicitação de teste",
        saveFailed: "Falha ao salvar conexão"
      }
    },
    users: {
      title: "Usuários",
      summary: {
        totalAccounts: "total de contas"
      },
      empty: {
        loading: "Carregando...",
        noUsers: "Nenhum usuário encontrado",
        adjustFilters: "Tente ajustar sua pesquisa ou filtros."
      },
      deleteModal: {
        title: "Excluir usuário?",
        description: "serão excluídos permanentemente e todos os seus tokens API revogados.",
        irreversible: "Isto não pode ser desfeito."
      },
      actions: {
        cancel: "Cancelar",
        deleting: "Excluindo...",
        delete: "Excluir",
        adminEmailer: "E-mail do administrador",
        newUser: "Novo usuário",
        editUser: "Editar usuário",
        deleteUser: "Excluir usuário"
      },
      filters: {
        searchPlaceholder: "Pesquisar nome ou e-mail...",
        allRoles: "Todas as funções"
      },
      table: {
        name: "Nome",
        email: "E-mail",
        lastActive: "Último ativo",
        joined: "Ingressou",
        roles: "Funções"
      },
      values: {
        never: "Nunca"
      },
      pagination: {
        page: "Página",
        of: "de",
        users: "Usuários"
      }
    },
    userAudit: {
      title: "Registro de auditoria do usuário",
      subtitle: "Rastreie eventos de login, acesso a recursos e ações de segurança em todos os usuários.",
      actions: {
        login: "Conecte-se",
        logout: "Sair",
        passwordChanged: "Senha alterada",
        passwordReset: "Redefinição de senha",
        featureAccess: "Acesso a recursos"
      },
      empty: {
        noMatching: "Nenhum evento correspondente",
        noEvents: "Nenhum evento de auditoria ainda",
        adjustFilters: "Tente ajustar seus filtros ou intervalo de datas.",
        description: "Os eventos de auditoria são registrados à medida que os usuários fazem login e acessam os recursos da plataforma."
      },
      stats: {
        loginsToday: "Logins hoje",
        activeUsers7d: "Usuários ativos (7d)",
        totalEvents: "Total de eventos",
        topFeature: "Recurso principal"
      },
      sections: {
        mostAccessedFeatures: "Recursos mais acessados ​​– últimos 7 dias"
      },
      filters: {
        searchPlaceholder: "Pesquisar usuário, recurso, IP...",
        allActions: "Todas as ações",
        clearAll: "Limpar tudo"
      },
      table: {
        time: "Tempo",
        user: "Usuário",
        action: "Ação",
        feature: "Recurso",
        ipAddress: "Endereço IP"
      },
      pagination: {
        page: "Página",
        of: "de",
        events: "eventos"
      }
    },
    serviceDetail: {
      actions: {
        backToSystemHealth: "Voltar para a integridade do sistema",
        systemHealth: "Saúde do sistema",
        refresh: "Atualizar",
        manageSolrCores: "Gerenciar núcleos Solr"
      },
      empty: {
        serviceNotFound: "Serviço não encontrado.",
        noLogs: "Nenhuma entrada de registro recente disponível."
      },
      values: {
        checkedAt: "Verificado em {{time}}",
        entriesCount: "(entradas {{count}})",
        yes: "Sim",
        no: "Não"
      },
      sections: {
        metrics: "Métricas",
        recentLogs: "Registros recentes"
      },
      pacs: {
        title: "Conexões PACS",
        addConnection: "Adicionar conexão",
        empty: "Nenhuma conexão PACS configurada."
      },
      darkstar: {
        ohdsiPackages: "Pacotes OHDSI HADES",
        positPackages: "Pacotes Posit/CRAN",
        installedCount: "({{count}} instalado)"
      }
    },
    atlasMigration: {
      steps: {
        connect: "Conectar",
        discover: "Descobrir",
        select: "Selecione",
        import: "Importar",
        summary: "Resumo"
      },
      entityTypes: {
        conceptSets: "Conjuntos de conceitos",
        cohortDefinitions: "Definições de coorte",
        incidenceRates: "Taxas de incidência",
        characterizations: "Caracterizações",
        pathways: "Caminhos",
        estimations: "Estimativas",
        predictions: "Previsões"
      },
      connect: {
        title: "Conecte-se ao Atlas WebAPI",
        description: "Insira o URL base da sua instância OHDSI WebAPI existente. Parthenon conectará e inventariará todas as entidades disponíveis para migração.",
        webapiUrl: "WebAPIBase URL",
        authentication: "Authentication",
        auth: {
          none: "Nenhum (WebAPI público)",
          basic: "XPh0x básico",
          bearer: "Token do Portador"
        },
        credentials: "Credenciais (nome de usuário:senha)",
        bearerToken: "Token do Portador",
        testConnection: "Conexão de teste",
        webapiVersion: "Versão WebAPI: {{version}}"
      },
      discover: {
        discovering: "Descobrindo entidades...",
        querying: "Consultando todos os endpoints WebAPI em paralelo",
        title: "Inventário Atlas",
        summary: "Foram encontradas entidades migráveis ​​{{count}} nas categorias {{categories}}.",
        sourcesFound: "Também foram encontradas fontes de dados {{count}}."
      },
      select: {
        title: "Selecione entidades para migrar",
        description: "Escolha quais entidades importar. As dependências são resolvidas automaticamente.",
        analysisWarning: "As entidades de análise podem fazer referência a definições de coorte e conjuntos de conceitos por ID. Parthenon remapeará essas referências automaticamente durante a importação. Para obter melhores resultados, inclua as coortes e conjuntos de conceitos referenciados em sua seleção.",
        selectedCount: "{{selected}}/{{total}} selecionado",
        totalSelected: "Entidades {{count}} selecionadas para migração"
      },
      import: {
        starting: "Iniciando migração...",
        importing: "Importando Entidades...",
        complete: "Migração concluída",
        failed: "Falha na migração",
        processed: "Todas as entidades selecionadas foram processadas.",
        error: "Ocorreu um erro durante a migração.",
        percentComplete: "{{percent}}% concluído",
        polling: "Pesquisando atualizações..."
      },
      summary: {
        successful: "Migração bem-sucedida",
        completedWithWarnings: "Migração concluída com avisos",
        failed: "Falha na migração",
        from: "De",
        duration: "Duração: {{duration}}"
      },
      metrics: {
        total: "Total",
        imported: "Importado",
        skipped: "Ignorado",
        failed: "Com falha"
      },
      table: {
        entityType: "Tipo de entidade",
        category: "Categoria"
      },
      actions: {
        selectAll: "Selecionar tudo",
        deselectAll: "Desmarcar tudo",
        retryFailed: "Falha na nova tentativa ({{count}})",
        done: "Feito",
        closeTitle: "Fechar - retornar a qualquer momento via Administração",
        previous: "Anterior",
        startMigration: "Iniciar migração",
        next: "Próximo"
      },
      errors: {
        connectionFailed: "Falha na conexão",
        discoveryFailed: "Falha na descoberta"
      }
    },
    fhirExport: {
      title: "Exportação em massa FHIR",
      subtitle: "Exporte dados OMOP CDM como arquivos FHIR R4 NDJSON para interoperabilidade.",
      comingSoon: "Em breve",
      description: "A exportação em massa FHIR ($export) está em desenvolvimento. Este recurso permitirá exportar dados OMOP CDM como arquivos FHIR R4 NDJSON para interoperabilidade.",
      backendPending: "Os endpoints de back-end para este recurso ainda não foram implementados."
    },
    fhirConnections: {
      title: "Conexões FHIR EHR",
      subtitle: "Configure conexões de serviços de back-end SMART para extração de dados em massa FHIR R4 de Epic, Cerner e outros EHR systems.",
      runMetrics: {
        extracted: "Extraído",
        mapped: "Mapeado",
        written: "Escrito",
        failed: "Com falha",
        mappingCoverage: "Cobertura de mapeamento"
      },
      history: {
        loading: "Carregando histórico de sincronização...",
        empty: "Nenhuma sincronização foi executada ainda.",
        status: "Situação",
        started: "Iniciado",
        duration: "Duração",
        metrics: "Métricas",
        title: "Histórico de sincronização"
      },
      dialog: {
        editTitle: "Editar conexão FHIR",
        addTitle: "Adicionar conexão FHIR",
        description: "Configure uma conexão de serviços de backend SMART com um endpoint EHR FHIR R4."
      },
      labels: {
        siteName: "Nome do site",
        siteKey: "Chave do site (slug)",
        ehrVendor: "Fornecedor EHR",
        fhirBaseUrl: "FHIRBase URL",
        tokenEndpoint: "Ponto final do token",
        clientId: "Cliente ID",
        rsaPrivateKey: "Chave privada RSA (PEM)",
        scopes: "Escopos",
        groupId: "Grupo ID (para exportação em massa)",
        exportResourceTypes: "Exportar tipos de recursos (separados por vírgula, em branco = todos)",
        active: "Ativo",
        incrementalSync: "Sincronização incremental"
      },
      vendors: {
        epic: "Épico",
        cerner: "Cerner (Oracle Health)",
        other: "Outros FHIR R4"
      },
      placeholders: {
        siteName: "Épico Johns Hopkins",
        keepExistingKey: "Deixe em branco para manter a chave existente",
        resourceTypes: "Paciente,Condição,Encontro,Solicitação de Medicamentos,Observação,Procedimento"
      },
      actions: {
        cancel: "Cancelar",
        saveChanges: "Salvar alterações",
        createConnection: "Criar conexão",
        testConnection: "Conexão de teste",
        edit: "Editar",
        delete: "Excluir",
        details: "Detalhes",
        syncMonitor: "Monitor de sincronização",
        addConnection: "Adicionar conexão"
      },
      messages: {
        failedToSave: "Falha ao salvar",
        failedToStartSync: "Falha ao iniciar a sincronização",
        deleteConfirm: "Excluir \"{{name}}\"?",
        noConnections: "Nenhuma conexão FHIR configurada",
        noConnectionsDescription: "Adicione uma conexão para começar a extrair dados clínicos de um EHR por meio de FHIR R4 Bulk Data."
      },
      sync: {
        activateFirst: "Ative a conexão primeiro",
        uploadKeyFirst: "Faça upload de uma chave privada primeiro",
        inProgress: "Sincronização em andamento",
        incrementalTitle: "Sincronização Incremental (somente novos dados)",
        fullSync: "Sincronização completa",
        sync: "Sincronizar",
        incrementalSync: "Sincronização Incremental",
        incrementalDescription: "Somente dados novos/atualizados desde a última sincronização",
        fullDescription: "Baixe todos os dados do EHR",
        forceFullSync: "Forçar sincronização completa",
        forceFullDescription: "Baixe novamente todos os dados, desduplicar na gravação"
      },
      values: {
        percent: "{{value}}%",
        byUser: "por {{name}}",
        keyUploaded: "Chave enviada",
        noKey: "Sem chave",
        lastSync: "Última sincronização: {{date}}",
        records: "registros {{count}}",
        testElapsed: "{{message}} ({{elapsed}}ms)",
        allSupported: "Todos suportados",
        enabled: "Habilitado",
        disabled: "Desabilitado",
        since: "(desde {{date}})",
        notSet: "Não definido",
        never: "Nunca"
      },
      details: {
        tokenEndpoint: "Ponto final do token:",
        clientId: "Cliente ID:",
        scopes: "Escopos:",
        groupId: "Grupo ID:",
        resourceTypes: "Tipos de recursos:",
        incremental: "Incremental:",
        targetSource: "Fonte alvo:",
        syncRuns: "Execuções de sincronização:"
      },
      stats: {
        totalConnections: "Total de conexões",
        active: "Ativo",
        keysConfigured: "Chaves configuradas",
        lastSync: "Última sincronização"
      }
    },
    vocabulary: {
      title: "Gerenciamento de vocabulário",
      subtitle: "Atualize as tabelas de vocabulário OMOP de um download do Athena ZIP.",
      status: {
        pending: "Na fila",
        running: "Em execução",
        completed: "Concluído",
        failed: "Com falha"
      },
      log: {
        title: "Registro de importação",
        noOutput: "(sem saída ainda)"
      },
      labels: {
        schema: "Esquema:",
        source: "Fonte:",
        rowsLoaded: "Linhas carregadas:",
        duration: "Duração:",
        by: "Por:",
        progress: "Progresso",
        optional: "(opcional)"
      },
      values: {
        seconds: "{{value}}s"
      },
      actions: {
        refresh: "Atualizar",
        remove: "Remover",
        uploading: "Fazendo upload...",
        startImport: "Iniciar importação"
      },
      upload: {
        title: "Carregar o vocabulário Athena ZIP",
        descriptionPrefix: "Baixe um pacote de vocabulário em",
        descriptionMiddle: "e carregue-o aqui.",
        descriptionSuffix: "A importação é executada como um trabalho em segundo plano e pode levar de 15 a 60 minutos, dependendo do tamanho do vocabulário.",
        maxFileSize: "Arquivos de até 5 GB são suportados",
        dropHere: "Solte Athena ZIP aqui",
        browse: "ou clique para navegar",
        targetSource: "Fonte CDM alvo",
        defaultSchema: "Esquema de vocabulário padrão",
        sourceHelpPrefix: "Seleciona qual esquema de vocabulário de origem a importação preencherá. Se nenhuma fonte for escolhida, o padrão",
        sourceHelpSuffix: "esquema de conexão é usado."
      },
      instructions: {
        title: "Como obter um vocabulário ZIP de Athena",
        signInPrefix: "Visita",
        signInSuffix: "e faça login.",
        selectDomains: "Selecione os domínios de vocabulário e as versões necessárias (por exemplo, SNOMED, RxNorm, LOINC).",
        clickPrefix: "Clique",
        downloadVocabularies: "Baixar vocabulários",
        clickSuffix: "- Athena enviará a você um link para download por e-mail.",
        uploadZip: "Baixe o ZIP (normalmente 500 MB-3 GB) e carregue-o abaixo."
      },
      messages: {
        deleteConfirm: "Excluir este registro de importação?",
        uploadFailed: "Falha no upload: {{message}}",
        unknownError: "Erro desconhecido",
        uploadSuccess: "ZIP carregado com sucesso. O trabalho de importação está na fila - verifique o progresso abaixo.",
        importRunning: "Uma importação está em execução. Novos uploads são desativados até serem concluídos."
      },
      history: {
        title: "Histórico de importação",
        loading: "Carregando...",
        empty: "Nenhuma importação de vocabulário ainda. Carregue um Athena ZIP acima para começar."
      }
    },
    systemHealth: {
      title: "Saúde do sistema",
      subtitle: "Status ativo de todos os serviços Parthenon. Atualização automática a cada 30 segundos.",
      serverStatus: "Status do servidor",
      lastChecked: "Última verificação em {{time}}",
      polling: "Serviços de votação...",
      gisDataManagement: "Gerenciamento de dados GIS",
      status: {
        healthy: "Saudável",
        degraded: "Degradado",
        down: "Abaixo"
      },
      overall: {
        healthy: "Saudável",
        needsAttention: "Precisa de atenção"
      },
      labels: {
        pending: "Pendente:",
        failed: "Com falha:",
        cores: "Núcleos:",
        documents: "Documentos:",
        dagster: "Punhal:",
        graphql: "GráficoQL:",
        studies: "Estudos:",
        instances: "Instâncias:",
        disk: "Disco:"
      },
      actions: {
        refresh: "Atualizar",
        openService: "Serviço aberto",
        viewDetails: "Ver detalhes"
      },
      tiers: {
        corePlatform: "Plataforma Central",
        dataSearch: "Dados e pesquisa",
        aiAnalytics: "IA e análises",
        clinicalServices: "Serviços Clínicos",
        monitoringCommunications: "Monitoramento e Comunicações",
        acropolisInfrastructure: "Infraestrutura Acropolis",
        unknown: "Outros serviços"
      },
      hades: {
        title: "Paridade do pacote OHDSI",
        subtitle: "Cobertura do pacote Darkstar para trabalho de primeira classe, nativo e de compatibilidade.",
        checking: "Verificando pacotes Darkstar...",
        unavailable: "O inventário do pacote Darkstar não está disponível.",
        installed: "Instalado:",
        missing: "Ausente:",
        total: "Total:",
        requiredMissing: "Obrigatório faltando:",
        shinyPolicy: "Política Brilhante Legada",
        notExposed: "não exposto",
        shinyPolicyDescription: "Aplicativos Shiny hospedados, incorporação de iframe e caminhos de aplicativos fornecidos pelo usuário estão desativados. Os pacotes OHDSI Shiny permanecem apenas como artefatos de compatibilidade de tempo de execução.",
        replacement: "Substituição: {{surface}}",
        package: "Pacote",
        capability: "Capacidade",
        priority: "Prioridade",
        surface: "Superfície",
        source: "Fonte",
        runtime: "tempo de execução",
        status: {
          complete: "Completo",
          partial: "Parcial"
        }
      }
    },
    fhirSync: {
      title: "Monitor FHIR Sync",
      subtitle: "Monitoramento de pipeline ETL em tempo real em todas as conexões FHIR",
      status: {
        completed: "Concluído",
        running: "Em execução",
        pending: "Pendente",
        exporting: "Exportador",
        downloading: "Baixando",
        processing: "Processamento",
        failed: "Com falha"
      },
      timeline: {
        empty: "Nenhuma atividade de sincronização nos últimos 30 dias",
        tooltip: "{{date}}: {{completed}} concluído, {{failed}} falhou",
        hoverSummary: "{{completed}} ok / {{failed}} falha"
      },
      metrics: {
        extracted: "Extraído",
        mapped: "Mapeado",
        written: "Escrito",
        failed: "Com falha",
        averageMappingCoverage: "Cobertura média de mapeamento"
      },
      actions: {
        viewError: "Ver erro"
      },
      values: {
        runs: "{{count}} é executado",
        never: "Nunca",
        activeRuns: "{{count}} ativo",
        refreshInterval: "atualização {{seconds}}s",
        allTimeTotals: "Totais de todos os tempos",
        lastRuns: "Últimos 20 em todas as conexões"
      },
      messages: {
        failedToLoad: "Falha ao carregar dados do painel.",
        noConnections: "Nenhuma conexão configurada",
        noRuns: "Nenhuma sincronização foi executada ainda"
      },
      stats: {
        connections: "Conexões",
        totalRuns: "Total de corridas",
        completed: "Concluído",
        failed: "Com falha",
        recordsWritten: "Registros escritos",
        avgCoverage: "Cobertura média"
      },
      panels: {
        pipelineThroughput: "Taxa de transferência do pipeline",
        syncActivity: "Atividade de sincronização (30 dias)",
        connectionHealth: "Integridade da conexão",
        recentRuns: "Execuções de sincronização recentes"
      },
      table: {
        status: "Situação",
        connection: "Conexão",
        started: "Iniciado",
        duration: "Duração",
        metrics: "Métricas"
      }
    },
    gisData: {
      title: "Dados de limite GIS",
      subtitle: "Gerencie conjuntos de dados de limites geográficos para o GIS Explorer",
      status: {
        loaded: "carregado",
        empty: "vazio"
      },
      tabs: {
        boundaries: "Limites",
        dataImport: "Importação de dados"
      },
      messages: {
        checking: "Verificando dados de limite...",
        noBoundaryData: "Nenhum dado de limite carregado. Selecione uma fonte e níveis abaixo para começar."
      },
      labels: {
        boundaries: "Limites:",
        countries: "Países:"
      },
      load: {
        title: "Limites de carga",
        adminLevels: "Níveis de administrador para carregar:"
      },
      sources: {
        gadm: {
          name: "GADM v4.1",
          description: "Áreas Administrativas Globais - 356 mil limites em 6 níveis de administração"
        },
        geoboundaries: {
          name: "limites geográficos CGAZ",
          description: "Limites simplificados para consistência cartográfica (ADM0-2)"
        }
      },
      levels: {
        adm0: "Países (ADM0)",
        adm1: "Estados/Províncias (ADM1)",
        adm2: "Distritos/Condados (ADM2)",
        adm3: "Subdistritos (ADM3)"
      },
      actions: {
        preparing: "Preparando...",
        generateLoadCommand: "Gerar comando de carregamento",
        refreshStats: "Atualizar estatísticas",
        copyToClipboard: "Copiar para a área de transferência",
        close: "Fechar"
      },
      modal: {
        runOnHost: "Executar no host",
        description: "Os dados GIS são carregados diretamente no PostgreSQL local 17. Execute este comando na raiz do projeto:",
        datasetFlagPrefix: "O",
        datasetFlagSuffix: "sinalizador permite o rastreamento do progresso. Atualize as estatísticas após a conclusão do script."
      },
      job: {
        title: "Carregando limites GIS",
        description: "Fonte: {{source}} | Níveis: {{levels}}"
      },
      values: {
        all: "todos"
      }
    },
    honestBroker: {
      title: "Corretor honesto",
      subtitle: "Registre participantes cegos da pesquisa, vincule-os aos registros person_id OMOP e monitore o status do envio sem expor as identidades brutas dos entrevistados aos pesquisadores.",
      actions: {
        cancel: "Cancelar",
        registerParticipant: "Cadastrar participante",
        sendInvitation: "Enviar convite",
        sendInvite: "Enviar convite",
        refresh: "Atualizar",
        copyLink: "Copiar link",
        openSurvey: "Abrir pesquisa",
        resend: "Reenviar",
        revoke: "Revogar"
      },
      labels: {
        personId: "Pessoa ID",
        notes: "Notas",
        participant: "Participante",
        deliveryEmail: "E-mail de entrega",
        unknown: "Desconhecido",
        unknownInstrument: "Instrumento desconhecido",
        notYet: "Ainda não",
        notRecorded: "Não registrado",
        system: "Sistema",
        statusToken: "{{status}} · {{token}}",
        tokenReference: "...{{token}}"
      },
      metrics: {
        brokerCampaigns: "Campanhas de corretor",
        registeredParticipants: "Participantes registrados",
        submitted: "Enviado",
        invitationsSent: "Convites enviados",
        complete: "Completo",
        pending: "Pendente",
        seeded: "Semeado",
        registered: "Registrado",
        completion: "Conclusão",
        completionPercent: "{{value}}%"
      },
      campaignStatuses: {
        draft: "Rascunho",
        active: "Ativo",
        closed: "Fechado"
      },
      matchStatuses: {
        submitted: "Enviado",
        registered: "Registrado",
        pending: "Pendente",
        matched: "Correspondido"
      },
      deliveryStatuses: {
        pending: "Pendente",
        queued: "Na fila",
        sent: "Enviado",
        opened: "Aberto",
        submitted: "Enviado",
        revoked: "Revogado",
        failed: "Com falha"
      },
      unauthorized: {
        title: "É necessário acesso honesto do corretor",
        description: "Este espaço de trabalho é restrito a administradores e administradores de dados porque vincula identidades de pesquisas cegas a registros de pacientes."
      },
      registerModal: {
        title: "Cadastrar participante",
        titleWithCampaign: "Cadastrar participante · {{campaign}}",
        registering: "Registrando...",
        description: "Crie uma entrada de registro oculta que mapeie um identificador de respondente para um registro de paciente para esta campanha de pesquisa.",
        respondentIdentifier: "Identificador do Respondente",
        respondentPlaceholder: "MRN, código de estudo ou código de convite",
        personIdPlaceholder: "OMOP person_id conhecido",
        notesPlaceholder: "Notas opcionais do corretor"
      },
      inviteModal: {
        title: "Enviar convite",
        titleWithCampaign: "Enviar convite · {{campaign}}",
        sending: "Enviando...",
        description: "Envie um link de pesquisa único gerenciado pelo corretor. Somente o corretor retém o endereço de entrega e a cadeia de custódia.",
        selectParticipant: "Selecione o participante",
        participantWithPerson: "{{blindedId}} · pessoa {{personId}}",
        emailPlaceholder: "paciente@exemplo.org",
        lastInvitation: "Último convite: {{status}} · token terminando em {{token}}"
      },
      campaignRegistry: {
        title: "Registro de campanha",
        subtitle: "Somente campanhas habilitadas para corretores honestos.",
        loading: "Carregando campanhas...",
        emptyPrefix: "Ainda não há campanhas de corretores honestos. Habilitar",
        requireHonestBroker: "Exigir corretor honesto",
        emptySuffix: "primeiro em uma campanha de pesquisa."
      },
      messages: {
        selectCampaignManage: "Selecione uma campanha para gerenciar registros de corretores.",
        selectCampaignReview: "Selecione uma campanha para revisar os registros do corretor."
      },
      participants: {
        title: "Participantes registrados",
        subtitle: "Entradas de registro desidentificadas para a campanha de pesquisa selecionada.",
        searchPlaceholder: "Pesquise ID cego, ID de pessoa, notas...",
        loading: "Carregando inscrições...",
        noMatches: "Nenhum registro de corretor corresponde ao filtro atual."
      },
      invitations: {
        title: "Livro de convites",
        subtitle: "Cadeia de custódia de entrada e saída para convites de pesquisa gerenciados por corretores.",
        loading: "Carregando convites...",
        empty: "Nenhum convite enviado para esta campanha ainda."
      },
      audit: {
        title: "Trilha de auditoria",
        subtitle: "Cadeia de custódia imutável do lado do corretor para registro de participantes, convites de saída e eventos de resposta de entrada.",
        loading: "Carregando trilha de auditoria...",
        empty: "Nenhum evento de auditoria de corretor registrado ainda."
      },
      latest: {
        title: "Último registro de correspondência",
        blindedId: "Cego ID",
        created: "Criado"
      },
      table: {
        blindedParticipant: "Participante cego",
        conductId: "Conduzir ID",
        status: "Situação",
        submitted: "Enviado",
        contact: "Contato",
        latestInvite: "Último convite",
        destination: "Destino",
        sent: "Enviado",
        opened: "Aberto",
        reference: "Referência",
        actions: "Ações",
        time: "Tempo",
        action: "Ação",
        actor: "Ator",
        inviteRef: "Convidar referência",
        metadata: "Metadados"
      },
      auditActions: {
        participant_registered: "Participante registrado",
        invitation_sent: "Convite enviado",
        invitation_resent: "Convite reenviado",
        invitation_revoked: "Convite revogado",
        response_submitted: "Resposta enviada",
        status_changed: "Status alterado"
      },
      confirmRevoke: "Revogar convite com final {{token}}?",
      toasts: {
        publishLinkCopied: "Link de publicação copiado",
        publishLinkCopyFailed: "Falha ao copiar o link de publicação",
        participantRegistered: "Participante cadastrado",
        participantRegisterFailed: "Falha ao registrar participante",
        invitationSent: "Convite enviado · token final {{token}}",
        invitationSendFailed: "Falha ao enviar convite",
        invitationResent: "Convite reenviado · token terminando em {{token}}",
        invitationResendFailed: "Falha ao reenviar o convite",
        invitationRevoked: "Convite revogado · token terminando em {{token}}",
        invitationRevokeFailed: "Falha ao revogar o convite"
      }
    }
  },
});

const fiApp: MessageTree = mergeMessageTrees(enApp, {
  covariates: {
    title: "Kovariaattiasetukset",
    description:
      "Valitse, mitkä tietoalueet sisällytetään kovariaateiksi FeatureExtractioniin.",
    groups: {
      core: "Ydinalueet",
      extended: "Laajennetut alueet",
      indices: "Komorbiditeetti-indeksit",
    },
    labels: {
      demographics: "Väestötiedot",
      conditionOccurrence: "Sairaustapahtumat",
      drugExposure: "Lääkealtistus",
      procedureOccurrence: "Toimenpidetapahtumat",
      measurement: "Mittaukset",
      observation: "Havainnot",
      deviceExposure: "Laitealtistus",
      visitCount: "Käyntien määrä",
      charlsonComorbidity: "Charlsonin komorbiditeetti",
      dcsi: "DCSI (diabetes)",
      chads2: "CHADS2",
      chads2Vasc: "CHA2DS2-VASc",
    },
    timeWindows: "Aikaikkunat",
    to: "asti",
    days: "päivää",
    addTimeWindow: "Lisää aikaikkuna",
  },
  vocabulary: {
    mappingAssistant: {
      title: "Käsitteiden kartoitusavustaja",
      poweredBy: "Ariadnen tukema",
      subtitle:
        "Kartoita lähdetermit OMOP-standardikäsitteisiin sanamuoto-, vektori- ja LLM-vastaavuuksilla",
      filters: {
        selectedCount: "{{count}} valittu",
        clearSelection: "Tyhjennä valinta",
        targetVocabulary: "Kohdesanasto:",
        allVocabularies: "Kaikki sanastot",
        targetDomain: "Kohdealue:",
        allDomains: "Kaikki alueet",
      },
      drawer: {
        disambiguate: "Täsmennä",
        candidateCount: "{{count}} ehdokasta - valitse oikea kartoitus",
        noCandidates: "Ehdokkaita ei löytynyt. Puhdista termi alla.",
        cleanRemap: "Puhdista ja kartoita uudelleen",
        editPlaceholder: "Muokkaa termiä ja kartoita uudelleen...",
      },
      actions: {
        clean: "Puhdista",
        remap: "Kartoita uudelleen",
        acceptMapping: "Hyväksy kartoitus",
        rejectMapping: "Hylkää kartoitus",
        disambiguateTitle: "Täsmennä - näytä kaikki ehdokkaat",
        uploadCsv: "Lataa CSV",
        loadProject: "Lataa projekti",
        mapping: "Kartoitetaan...",
        mapTerms: "Kartoita termit",
        clearResults: "Tyhjennä tulokset",
        acceptAllThreshold: "Hyväksy kaikki >= 90 %",
        saveToVocabulary: "Tallenna sanastoon",
        saveProject: "Tallenna projekti",
        exportCsv: "Vie CSV",
      },
      toasts: {
        remapped: 'Kartoitettiin uudelleen "{{source}}" -> {{concept}}',
        noMatchForCleaned: 'Puhdistetulle termille "{{term}}" ei löytynyt osumaa',
        remapFailed: "Uudelleenkartoitus epäonnistui",
        autoAccepted:
          "{{count}} korkean luottamuksen kartoitusta hyväksyttiin automaattisesti",
        savedMappings:
          "{{count}} kartoitusta tallennettiin source_to_concept_map-tauluun",
        saveMappingsFailed: "Kartoitusten tallennus epäonnistui",
        projectSaved: "Projekti tallennettu: {{name}}",
        saveProjectFailed: "Projektin tallennus epäonnistui",
        projectLoaded: "Projekti ladattu: {{name}}",
        loadProjectFailed: "Projektin lataus epäonnistui",
      },
      errors: {
        cleanupFailed: "Puhdistus epäonnistui.",
        mappingFailed:
          "Kartoitus epäonnistui. Varmista, että Ariadne-palvelu on käynnissä ja saavutettavissa.",
      },
      results: {
        candidateCount: "{{count}} ehdokasta",
        overridden: "(ohitettu)",
        noMatchFound: "Osumaa ei löytynyt",
        selectOverride: "Valitse ehdokas korvaamaan kartoitus",
        noAdditionalCandidates: "Ei muita ehdokkaita.",
      },
      labels: {
        noValue: "-",
        separator: "-",
      },
      input: {
        termsMapped: "{{count}} termiä kartoitettu",
        editTerms: "Muokkaa termejä",
        sourceTerms: "Lähdetermit",
        termsPlaceholder:
          "Syötä lähdetermit, yksi per rivi...\n\ntype 2 diabetes mellitus\nacute myocardial infarction\nHTN\nASA 81mg",
        termsEntered: "{{count}} termiä syötetty",
      },
      projects: {
        loading: "Ladataan projekteja...",
        loadFailed: "Projektien lataus epäonnistui",
        empty: "Ei tallennettuja projekteja",
        projectMeta: "{{count}} termiä -- {{date}}",
        namePlaceholder: "Projektin nimi...",
      },
      vocabularies: {
        SNOMED: "SNOMED CT",
        ICD10CM: "ICD-10-CM",
        RxNorm: "RxNorm",
        LOINC: "LOINC",
        ICD9CM: "ICD-9-CM",
        CPT4: "CPT-4",
        HCPCS: "HCPCS",
        MedDRA: "MedDRA",
      },
      domains: {
        Condition: "Sairaus",
        Drug: "Lääke",
        Procedure: "Toimenpide",
        Measurement: "Mittaus",
        Observation: "Havainto",
        Device: "Laite",
      },
      progress: {
        mappingTerms: "Kartoitetaan {{count}} termiä...",
      },
      metrics: {
        termsMapped: "Termit kartoitettu",
        highConfidence: "Korkea luottamus",
        needReview: "Vaatii tarkistusta",
        noMatch: "Ei osumaa",
      },
      table: {
        sourceTerm: "Lähdetermi",
        bestMatch: "Paras osuma",
        confidence: "Luottamus",
        matchType: "Osumatyyppi",
        vocabulary: "Sanasto",
        actions: "Toiminnot",
      },
      summary: {
        mapped: "{{count}} kartoitettu",
        high: "{{count}} korkea",
        review: "{{count}} tarkistettava",
        noMatch: "{{count}} ilman osumaa",
        accepted: "{{count}} hyväksytty",
      },
    },
    conceptDetail: {
      tabs: {
        info: "Tiedot",
        relationships: "Suhteet",
        mapsFrom: "Kartoitukset lähteistä",
        hierarchy: "Hierarkia",
      },
      empty: {
        title: "Valitse käsite nähdäksesi tiedot",
        subtitle: "Hae ja napsauta käsitettä vasemmasta paneelista",
        noAncestors: "Esivanhempia ei löytynyt",
        noRelationships: "Suhteita ei löytynyt",
        noSourceCodes: "Yksikään lähdekoodi ei kartoitu tähän käsitteeseen",
      },
      errors: {
        failedLoad: "Käsitteen lataus epäonnistui",
      },
      toasts: {
        conceptIdCopied: "Käsite-ID kopioitu",
      },
      actions: {
        copyConceptId: "Kopioi käsite-ID",
        addToSet: "Lisää joukkoon",
      },
      values: {
        standard: "Standardi",
        classification: "Luokitus",
        nonStandard: "Ei-standardi",
        valid: "Voimassa",
      },
      sections: {
        basicInformation: "Perustiedot",
        synonyms: "Synonyymit",
        ancestors: "Esivanhemmat",
        relationships: "Suhteet",
        mapsFrom: "Tähän käsitteeseen kartoittuvat lähdekoodit",
        mapsFromDescription:
          "Lähdesanastojen koodit (ICD-10, SNOMED, RxNorm jne.), jotka kartoittuvat tähän standardikäsitteeseen",
        hierarchy: "Käsitehierarkia",
      },
      fields: {
        conceptCode: "Käsitekoodi",
        domain: "Alue",
        vocabulary: "Sanasto",
        conceptClass: "Käsiteluokka",
        standardConcept: "Standardikäsite",
        invalidReason: "Virheellisyyden syy",
        validStartDate: "Voimassaolon alku",
        validEndDate: "Voimassaolon loppu",
      },
      table: {
        id: "ID",
        name: "Nimi",
        domain: "Alue",
        vocabulary: "Sanasto",
        relationship: "Suhde",
        relatedId: "Liittyvä ID",
        relatedName: "Liittyvä nimi",
        code: "Koodi",
        class: "Luokka",
      },
      pagination: {
        showingRange: "Näytetään {{start}}-{{end}} / {{total}}",
        showingSourceCodes:
          "Näytetään {{shown}} / {{total}} lähdekoodia",
      },
    },
    semanticSearch: {
      hecate: "Hecate",
      poweredBy: "Hecaten tukema",
      tagline: "vektoripohjainen käsitteiden löytäminen",
      placeholder: "Syötä kliininen termi semanttista hakua varten...",
      filters: {
        allDomains: "Kaikki alueet",
        allVocabularies: "Kaikki sanastot",
        standard: {
          all: "Kaikki",
          standard: "S",
          classification: "C",
        },
      },
      badges: {
        standard: "Standardi",
        classification: "Luokitus",
      },
      values: {
        inSet: "Joukossa",
        standardAbbrev: "S",
      },
      actions: {
        addToSet: "Lisää joukkoon",
        clearFilters: "Tyhjennä suodattimet",
        retry: "Yritä uudelleen",
        tryClearingFilters: "Kokeile suodattimien tyhjennystä",
      },
      errors: {
        unavailable: "Semanttinen haku ei ole käytettävissä.",
        serviceHelp:
          "Varmista, että Hecate-AI-palvelu on käynnissä ja ChromaDB on alustettu.",
      },
      empty: {
        prompt: "Syötä kliininen termi semanttista hakua varten",
        help:
          "Hecate käyttää vektoriupotuksia löytääkseen käsitteellisesti samankaltaisia OMOP-käsitteitä, vaikka tarkka avainsanahaku epäonnistuisi.",
        noResults: 'Semanttisia osumia ei löytynyt haulle "{{query}}"',
      },
      results: {
        matchCountOne: "{{count}} semanttinen osuma",
        matchCountMany: "{{count}} semanttista osumaa",
        updating: "Päivitetään...",
      },
    },
    searchPanel: {
      placeholder: "Hae käsitteitä...",
      filters: {
        toggle: "Suodattimet",
        standardOnly: "Standardi",
        allDomains: "Kaikki alueet",
        allVocabularies: "Kaikki sanastot",
        allConceptClasses: "Kaikki käsiteluokat",
        countSuffix: " ({{count}})",
      },
      actions: {
        clearAllFilters: "Tyhjennä kaikki suodattimet",
        tryClearingFilters: "Kokeile suodattimien tyhjennystä",
        loading: "Ladataan...",
        loadMoreResults: "Lataa lisää tuloksia",
      },
      empty: {
        prompt: "Hae OMOP-sanastosta",
        help: "Kirjoita vähintään 2 merkkiä hakeaksesi käsitteitä nimellä, koodilla tai ID:llä",
        noResults: 'Käsitteitä ei löytynyt haulle "{{query}}"',
      },
      results: {
        showingCount: "Näytetään {{shown}} / {{total}} tulosta",
      },
      engine: {
        solr: "Solr",
        pg: "PG",
      },
      values: {
        inSet: "Joukossa",
      },
    },
    conceptComparison: {
      title: "Vertaa käsitteitä",
      subtitle:
        "2-4 OMOP-käsitteen rinnakkainen vertailu attribuuteilla, esivanhemmilla ja suhteilla",
      search: {
        placeholder: "Hae lisättävä käsite...",
      },
      sections: {
        ancestors: "Esivanhemmat (2 tasoa)",
        relationships: "Suhteet",
      },
      fields: {
        conceptCode: "Käsitekoodi",
        domain: "Alue",
        vocabulary: "Sanasto",
        conceptClass: "Käsiteluokka",
        standard: "Standardi",
        validStart: "Voimassaolon alku",
        validEnd: "Voimassaolon loppu",
        invalidReason: "Virheellisyyden syy",
      },
      actions: {
        addConcept: "Lisää käsite",
      },
      empty: {
        prompt: "Hae vertailtavia käsitteitä",
        help:
          "Valitse 2-4 käsitettä nähdäksesi rinnakkaisen vertailun niiden attribuuteista, esivanhemmista ja suhteista",
      },
      values: {
        standard: "Standardi",
        classification: "Luokitus",
        nonStandard: "Ei-standardi",
        valid: "Voimassa",
        level: "T{{level}}",
        selected: "Valittu:",
        addOneMore: "Lisää vähintään yksi vertailtava",
      },
    },
    addToConceptSet: {
      title: "Lisää käsitejoukkoon",
      create: {
        title: "Luo uusi käsitejoukko",
        help: "Lisää käsite ja avaa Builderissa",
        nameLabel: "Uuden käsitejoukon nimi",
      },
      actions: {
        create: "Luo",
        cancel: "Peruuta",
        openBuilderWithSearch: "Avaa Builder nykyisellä haulla",
      },
      divider: "tai lisää olemassa olevaan",
      filter: {
        placeholder: "Suodata käsitejoukkoja...",
      },
      empty: {
        noMatching: "Ei vastaavia käsitejoukkoja",
        noSets: "Käsitejoukkoja ei löytynyt",
      },
      footer: {
        includeDescendants: "Lisää Include Descendants -asetuksella",
      },
      toasts: {
        addedToSet: 'Lisätty joukkoon "{{setName}}"',
        addFailed: "Käsitteen lisääminen joukkoon epäonnistui",
        missingSetId: "Uuden käsitejoukon ID:tä ei voitu hakea",
        createdAndAdded: 'Luotiin "{{name}}" ja lisättiin käsite',
        createdAddFailed:
          "Joukko luotiin, mutta käsitteen lisääminen epäonnistui",
        createFailed: "Käsitejoukon luonti epäonnistui",
      },
    },
    page: {
      title: "Sanastoselain",
      subtitle: "Hae, tutki ja selaa OMOP-standardoitua sanastoa",
      tabs: {
        keyword: "Avainsanahaku",
        semantic: "Semanttinen haku",
        browse: "Selaa hierarkiaa",
      },
    },
    hierarchyBrowser: {
      breadcrumb: {
        allDomains: "Kaikki alueet",
      },
      filters: {
        allSources: "Kaikki lähteet",
        itemPlaceholder: "Suodata {{count}} kohdetta...",
      },
      actions: {
        showAllConcepts: "Näytä kaikki käsitteet",
        showGroupings: "Näytä ryhmittelyt",
        clearFilter: "Tyhjennä suodatin",
        viewDetailsFor: "Näytä käsitteen {{conceptName}} tiedot",
        viewConceptDetails: "Näytä käsitteen tiedot",
      },
      empty: {
        noMatchingConcepts: "Ei vastaavia käsitteitä",
        noConcepts: "Käsitteitä ei löytynyt",
      },
      counts: {
        clinicalGroupings: "{{count}} kliinistä ryhmittelyä",
        concepts: "{{count}} käsitettä",
        items: "{{count}} kohdetta",
        filteredItems: "{{shown}} / {{total}} kohdetta",
        namedSubCategories: "{{name}} - {{count}} alakategoriaa",
        subCategories: "{{count}} alakategoriaa",
        subcategories: "{{count}} alakategoriaa",
        oneAnchor: "1 ankkuri",
        persons: "{{count}} henkilöä",
        records: "{{count}} tietuetta",
        groupingCoversSubcategories:
          "{{groupingName}} kattaa {{count}} alakategoriaa",
      },
    },
    hierarchyTree: {
      empty: {
        noData: "Hierarkiatietoja ei ole saatavilla",
      },
    },
  },
  jobs: {
    page: {
      title: "Työt",
      subtitle: "Seuraa taustatöitä ja jonon tilaa",
      empty: {
        title: "Töitä ei löytynyt",
        archived: "Yli 24 tuntia vanhoja arkistoituja töitä ei ole.",
        filtered:
          "Töitä tilalla {{status}} ei löytynyt. Kokeile toista suodatinta.",
        recent:
          "Viimeisen 24 tunnin aikana ei ole töitä. Tarkista Arkisto vanhempien töiden varalta.",
      },
      table: {
        job: "Työ",
        type: "Tyyppi",
        source: "Lähde",
        started: "Aloitettu",
        duration: "Kesto",
        status: "Tila",
        actions: "Toiminnot",
      },
      pagination: "Sivu {{current}} / {{last}} - {{total}} työtä",
    },
    filters: {
      statuses: {
        all: "Kaikki (24 h)",
        pending: "Odottaa",
        queued: "Jonossa",
        running: "Käynnissä",
        completed: "Valmis",
        failed: "Epäonnistunut",
        cancelled: "Peruttu",
        archived: "Arkistoitu",
      },
      types: {
        all: "Kaikki tyypit",
        analysis: "Analyysi",
        characterization: "Karakterisointi",
        incidenceRate: "Ilmaantuvuus",
        estimation: "Estimointi",
        prediction: "Ennuste",
        pathway: "Hoitopolku",
        sccs: "SCCS",
        evidenceSynthesis: "Näytön synteesi",
        cohortGeneration: "Kohortin muodostus",
        careGaps: "Hoitovajeet",
        achilles: "Achilles",
        dataQuality: "Datan laatu",
        heelChecks: "Heel-tarkistukset",
        ingestion: "Tuonti",
        vocabulary: "Sanasto",
        genomicParse: "Genominen jäsennys",
        poseidon: "Poseidon ETL",
        fhirExport: "FHIR-vienti",
        fhirSync: "FHIR-synkronointi",
        gisImport: "GIS-tuonti",
        gisBoundaries: "GIS-rajat",
      },
    },
    actions: {
      retry: "Yritä uudelleen",
      retryJob: "Yritä työtä uudelleen",
      cancel: "Peruuta",
      cancelJob: "Peruuta työ",
      previous: "Edellinen",
      next: "Seuraava",
    },
    drawer: {
      titleFallback: "Työn tiedot",
      loadError: "Työn tietoja ei voitu ladata.",
      sections: {
        executionLog: "Suoritusloki",
        analysis: "Analyysi",
        cohort: "Kohortti",
        ingestionPipeline: "Tuontiputki",
        fhirSync: "FHIR-synkronointi",
        dataQuality: "Datan laatu",
        heelChecks: "Heel-tarkistukset",
        achillesAnalyses: "Achilles-analyysit",
        genomicParse: "Genominen jäsennys",
        poseidonEtl: "Poseidon ETL",
        careGapEvaluation: "Hoitovajeiden arviointi",
        gisBoundaries: "GIS-rajat",
        gisImport: "GIS-tuonti",
        vocabularyImport: "Sanaston tuonti",
        fhirExport: "FHIR-vienti",
        overview: "Yleiskuva",
        output: "Tuloste",
      },
      labels: {
        analysis: "Analyysi",
        createdBy: "Luonut",
        parameters: "Parametrit",
        cohort: "Kohortti",
        personCount: "Henkilömäärä",
        source: "Lähde",
        sourceKey: "Lähdeavain",
        stage: "Vaihe",
        project: "Projekti",
        file: "Tiedosto",
        fileSize: "Tiedostokoko",
        mappingCoverage: "Kartoituksen kattavuus",
        processed: "Käsitelty",
        failed: "Epäonnistunut",
        filesDownloaded: "Ladatut tiedostot",
        recordsExtracted: "Poimitut tietueet",
        recordsMapped: "Kartoitetut tietueet",
        recordsWritten: "Kirjoitetut tietueet",
        recordsFailed: "Epäonnistuneet tietueet",
        passed: "Läpäissyt",
        passRate: "Läpäisyaste",
        expectedChecks: "Odotetut tarkistukset",
        executionTime: "Suoritusaika",
        failingChecks: "Epäonnistuvat tarkistukset",
        totalRules: "Sääntöjä yhteensä",
        rulesTriggered: "Lauenneet säännöt",
        totalViolations: "Rikkomuksia yhteensä",
        topViolations: "Yleisimmät rikkomukset",
        completed: "Valmis",
        byCategory: "Kategorioittain",
        failedSteps: "Epäonnistuneet vaiheet",
        format: "Muoto",
        totalVariants: "Variantteja yhteensä",
        mappedVariants: "Kartoitetut variantit",
        samples: "Näytteet",
        runType: "Ajotyyppi",
        dagsterRunId: "Dagster-ajon ID",
        stats: "Tilastot",
        bundle: "Paketti",
        complianceSummary: "Vaatimustenmukaisuuden yhteenveto",
        dataset: "Tietojoukko",
        dataType: "Datatyyppi",
        version: "Versio",
        geometry: "Geometria",
        features: "Kohteet",
        tablesLoaded: "Ladatut taulut",
        recordsLoaded: "Ladatut tietueet",
        outputFormat: "Tulostemuoto",
        type: "Tyyppi",
        triggeredBy: "Käynnistäjä",
        duration: "Kesto",
        started: "Aloitettu",
        created: "Luotu",
        error: "Virhe",
      },
      messages: {
        stalled:
          "Tämä työ pysähtyi ja merkittiin epäonnistuneeksi, koska 1 tunnin aikaraja ylittyi.",
        failedCount: "{{count}} epäonnistui",
        runningCount: "{{count}} käynnissä",
        ofTotal: "/ {{count}}",
        records: "{{count}} tietuetta",
      },
    },
  },
});

const jaApp: MessageTree = mergeMessageTrees(enApp, {
  covariates: {
    title: "共変量設定",
    description:
      "FeatureExtraction に共変量として含めるドメインを選択します。",
    groups: {
      core: "主要ドメイン",
      extended: "拡張ドメイン",
      indices: "併存疾患指標",
    },
    labels: {
      demographics: "人口統計",
      conditionOccurrence: "疾患発生",
      drugExposure: "薬剤曝露",
      procedureOccurrence: "処置発生",
      measurement: "測定",
      observation: "観察",
      deviceExposure: "デバイス曝露",
      visitCount: "受診回数",
      charlsonComorbidity: "Charlson 併存疾患",
      dcsi: "DCSI (糖尿病)",
      chads2: "CHADS2",
      chads2Vasc: "CHA2DS2-VASc",
    },
    timeWindows: "時間ウィンドウ",
    to: "まで",
    days: "日",
    addTimeWindow: "時間ウィンドウを追加",
  },
  vocabulary: {
    mappingAssistant: {
      title: "コンセプトマッピングアシスタント",
      poweredBy: "Ariadne による支援",
      subtitle:
        "逐語、ベクトル、LLM マッチングを使ってソース用語を OMOP 標準コンセプトへマッピングします",
      filters: {
        selectedCount: "{{count}} 件選択",
        clearSelection: "選択をクリア",
        targetVocabulary: "対象ボキャブラリ:",
        allVocabularies: "すべてのボキャブラリ",
        targetDomain: "対象ドメイン:",
        allDomains: "すべてのドメイン",
      },
      drawer: {
        disambiguate: "曖昧性を解消",
        candidateCount: "{{count}} 件の候補 - 正しいマッピングを選択",
        noCandidates: "候補が見つかりません。下の用語をクリーンアップしてください。",
        cleanRemap: "クリーンアップして再マッピング",
        editPlaceholder: "用語を編集して再マッピング...",
      },
      actions: {
        clean: "クリーンアップ",
        remap: "再マッピング",
        acceptMapping: "マッピングを承認",
        rejectMapping: "マッピングを却下",
        disambiguateTitle: "曖昧性を解消 - すべての候補を表示",
        uploadCsv: "CSV をアップロード",
        loadProject: "プロジェクトを読み込み",
        mapping: "マッピング中...",
        mapTerms: "用語をマッピング",
        clearResults: "結果をクリア",
        acceptAllThreshold: "90% 以上をすべて承認",
        saveToVocabulary: "ボキャブラリに保存",
        saveProject: "プロジェクトを保存",
        exportCsv: "CSV をエクスポート",
      },
      toasts: {
        remapped: '"{{source}}" を再マッピングしました -> {{concept}}',
        noMatchForCleaned:
          'クリーンアップ済み用語 "{{term}}" の一致は見つかりません',
        remapFailed: "再マッピングに失敗しました",
        autoAccepted: "{{count}} 件の高信頼マッピングを自動承認しました",
        savedMappings:
          "{{count}} 件のマッピングを source_to_concept_map に保存しました",
        saveMappingsFailed: "マッピングの保存に失敗しました",
        projectSaved: "プロジェクトを保存しました: {{name}}",
        saveProjectFailed: "プロジェクトの保存に失敗しました",
        projectLoaded: "プロジェクトを読み込みました: {{name}}",
        loadProjectFailed: "プロジェクトの読み込みに失敗しました",
      },
      errors: {
        cleanupFailed: "クリーンアップに失敗しました。",
        mappingFailed:
          "マッピングに失敗しました。Ariadne サービスが起動して到達可能か確認してください。",
      },
      results: {
        candidateCount: "{{count}} 件の候補",
        overridden: "(上書き済み)",
        noMatchFound: "一致が見つかりません",
        selectOverride: "マッピングを上書きする候補を選択してください",
        noAdditionalCandidates: "追加候補はありません。",
      },
      labels: {
        noValue: "-",
        separator: "-",
      },
      input: {
        termsMapped: "{{count}} 件の用語をマッピング済み",
        editTerms: "用語を編集",
        sourceTerms: "ソース用語",
        termsPlaceholder:
          "ソース用語を 1 行に 1 つ入力...\n\ntype 2 diabetes mellitus\nacute myocardial infarction\nHTN\nASA 81mg",
        termsEntered: "{{count}} 件の用語を入力済み",
      },
      projects: {
        loading: "プロジェクトを読み込み中...",
        loadFailed: "プロジェクトを読み込めませんでした",
        empty: "保存済みプロジェクトはありません",
        projectMeta: "{{count}} 件の用語 -- {{date}}",
        namePlaceholder: "プロジェクト名...",
      },
      vocabularies: {
        SNOMED: "SNOMED CT",
        ICD10CM: "ICD-10-CM",
        RxNorm: "RxNorm",
        LOINC: "LOINC",
        ICD9CM: "ICD-9-CM",
        CPT4: "CPT-4",
        HCPCS: "HCPCS",
        MedDRA: "MedDRA",
      },
      domains: {
        Condition: "疾患",
        Drug: "薬剤",
        Procedure: "処置",
        Measurement: "測定",
        Observation: "観察",
        Device: "デバイス",
      },
      progress: {
        mappingTerms: "{{count}} 件の用語をマッピング中...",
      },
      metrics: {
        termsMapped: "マッピング済み用語",
        highConfidence: "高信頼",
        needReview: "レビュー要",
        noMatch: "一致なし",
      },
      table: {
        sourceTerm: "ソース用語",
        bestMatch: "最良一致",
        confidence: "信頼度",
        matchType: "一致タイプ",
        vocabulary: "ボキャブラリ",
        actions: "操作",
      },
      summary: {
        mapped: "{{count}} 件マッピング済み",
        high: "{{count}} 件高信頼",
        review: "{{count}} 件レビュー",
        noMatch: "{{count}} 件一致なし",
        accepted: "{{count}} 件承認済み",
      },
    },
    conceptDetail: {
      tabs: {
        info: "情報",
        relationships: "関係",
        mapsFrom: "マップ元",
        hierarchy: "階層",
      },
      empty: {
        title: "詳細を表示するコンセプトを選択",
        subtitle: "左パネルでコンセプトを検索してクリックしてください",
        noAncestors: "祖先が見つかりません",
        noRelationships: "関係が見つかりません",
        noSourceCodes:
          "このコンセプトにマッピングされるソースコードはありません",
      },
      errors: {
        failedLoad: "コンセプトを読み込めませんでした",
      },
      toasts: {
        conceptIdCopied: "コンセプト ID をコピーしました",
      },
      actions: {
        copyConceptId: "コンセプト ID をコピー",
        addToSet: "セットに追加",
      },
      values: {
        standard: "標準",
        classification: "分類",
        nonStandard: "非標準",
        valid: "有効",
      },
      sections: {
        basicInformation: "基本情報",
        synonyms: "同義語",
        ancestors: "祖先",
        relationships: "関係",
        mapsFrom: "このコンセプトにマッピングされるソースコード",
        mapsFromDescription:
          "この標準コンセプトにマッピングされるソースボキャブラリコード (ICD-10、SNOMED、RxNorm など)",
        hierarchy: "コンセプト階層",
      },
      fields: {
        conceptCode: "コンセプトコード",
        domain: "ドメイン",
        vocabulary: "ボキャブラリ",
        conceptClass: "コンセプトクラス",
        standardConcept: "標準コンセプト",
        invalidReason: "無効理由",
        validStartDate: "有効開始日",
        validEndDate: "有効終了日",
      },
      table: {
        id: "ID",
        name: "名前",
        domain: "ドメイン",
        vocabulary: "ボキャブラリ",
        relationship: "関係",
        relatedId: "関連 ID",
        relatedName: "関連名",
        code: "コード",
        class: "クラス",
      },
      pagination: {
        showingRange: "{{start}}-{{end}} / {{total}} を表示",
        showingSourceCodes:
          "{{total}} 件中 {{shown}} 件のソースコードを表示",
      },
    },
    semanticSearch: {
      hecate: "Hecate",
      poweredBy: "Hecate による支援",
      tagline: "ベクトル駆動のコンセプト探索",
      placeholder: "意味検索する臨床用語を入力...",
      filters: {
        allDomains: "すべてのドメイン",
        allVocabularies: "すべてのボキャブラリ",
        standard: {
          all: "すべて",
          standard: "S",
          classification: "C",
        },
      },
      badges: {
        standard: "標準",
        classification: "分類",
      },
      values: {
        inSet: "セット内",
        standardAbbrev: "S",
      },
      actions: {
        addToSet: "セットに追加",
        clearFilters: "フィルターをクリア",
        retry: "再試行",
        tryClearingFilters: "フィルターのクリアを試す",
      },
      errors: {
        unavailable: "意味検索は利用できません。",
        serviceHelp:
          "Hecate AI サービスが稼働し、ChromaDB が初期化されていることを確認してください。",
      },
      empty: {
        prompt: "意味検索する臨床用語を入力",
        help:
          "Hecate はベクトル埋め込みを使い、完全なキーワード一致が失敗しても概念的に近い OMOP コンセプトを見つけます。",
        noResults: '"{{query}}" の意味一致は見つかりません',
      },
      results: {
        matchCountOne: "{{count}} 件の意味一致",
        matchCountMany: "{{count}} 件の意味一致",
        updating: "更新中...",
      },
    },
    searchPanel: {
      placeholder: "コンセプトを検索...",
      filters: {
        toggle: "フィルター",
        standardOnly: "標準",
        allDomains: "すべてのドメイン",
        allVocabularies: "すべてのボキャブラリ",
        allConceptClasses: "すべてのコンセプトクラス",
        countSuffix: " ({{count}})",
      },
      actions: {
        clearAllFilters: "すべてのフィルターをクリア",
        tryClearingFilters: "フィルターのクリアを試す",
        loading: "読み込み中...",
        loadMoreResults: "さらに結果を読み込み",
      },
      empty: {
        prompt: "OMOP Vocabulary を検索",
        help: "名前、コード、ID でコンセプトを検索するには 2 文字以上入力してください",
        noResults: '"{{query}}" のコンセプトは見つかりません',
      },
      results: {
        showingCount: "{{total}} 件中 {{shown}} 件を表示",
      },
      engine: {
        solr: "Solr",
        pg: "PG",
      },
      values: {
        inSet: "セット内",
      },
    },
    conceptComparison: {
      title: "コンセプトを比較",
      subtitle:
        "2-4 件の OMOP コンセプトを属性、祖先、関係とともに横並びで比較",
      search: {
        placeholder: "追加するコンセプトを検索...",
      },
      sections: {
        ancestors: "祖先 (2 レベル)",
        relationships: "関係",
      },
      fields: {
        conceptCode: "コンセプトコード",
        domain: "ドメイン",
        vocabulary: "ボキャブラリ",
        conceptClass: "コンセプトクラス",
        standard: "標準",
        validStart: "有効開始",
        validEnd: "有効終了",
        invalidReason: "無効理由",
      },
      actions: {
        addConcept: "コンセプトを追加",
      },
      empty: {
        prompt: "比較するコンセプトを検索",
        help:
          "2-4 件のコンセプトを選択し、属性、祖先、関係を横並びで比較します",
      },
      values: {
        standard: "標準",
        classification: "分類",
        nonStandard: "非標準",
        valid: "有効",
        level: "L{{level}}",
        selected: "選択済み:",
        addOneMore: "比較するには少なくとももう 1 件追加してください",
      },
    },
    addToConceptSet: {
      title: "コンセプトセットに追加",
      create: {
        title: "新しいコンセプトセットを作成",
        help: "コンセプトを追加して Builder で開く",
        nameLabel: "新しいコンセプトセット名",
      },
      actions: {
        create: "作成",
        cancel: "キャンセル",
        openBuilderWithSearch: "現在の検索で Builder を開く",
      },
      divider: "または既存に追加",
      filter: {
        placeholder: "コンセプトセットを絞り込み...",
      },
      empty: {
        noMatching: "一致するコンセプトセットはありません",
        noSets: "コンセプトセットが見つかりません",
      },
      footer: {
        includeDescendants: "Include Descendants 付きで追加",
      },
      toasts: {
        addedToSet: '"{{setName}}" に追加しました',
        addFailed: "コンセプトセットへの追加に失敗しました",
        missingSetId: "新しいコンセプトセット ID を取得できませんでした",
        createdAndAdded: '"{{name}}" を作成してコンセプトを追加しました',
        createdAddFailed:
          "セットは作成されましたが、コンセプトの追加に失敗しました",
        createFailed: "コンセプトセットの作成に失敗しました",
      },
    },
    page: {
      title: "Vocabulary Browser",
      subtitle: "OMOP 標準化ボキャブラリを検索、探索、ナビゲート",
      tabs: {
        keyword: "キーワード検索",
        semantic: "意味検索",
        browse: "階層を参照",
      },
    },
    hierarchyBrowser: {
      breadcrumb: {
        allDomains: "すべてのドメイン",
      },
      filters: {
        allSources: "すべてのソース",
        itemPlaceholder: "{{count}} 件の項目を絞り込み...",
      },
      actions: {
        showAllConcepts: "すべてのコンセプトを表示",
        showGroupings: "グループを表示",
        clearFilter: "フィルターをクリア",
        viewDetailsFor: "{{conceptName}} の詳細を表示",
        viewConceptDetails: "コンセプト詳細を表示",
      },
      empty: {
        noMatchingConcepts: "一致するコンセプトはありません",
        noConcepts: "コンセプトが見つかりません",
      },
      counts: {
        clinicalGroupings: "{{count}} 件の臨床グループ",
        concepts: "{{count}} 件のコンセプト",
        items: "{{count}} 件の項目",
        filteredItems: "{{total}} 件中 {{shown}} 件の項目",
        namedSubCategories: "{{name}} - {{count}} 件のサブカテゴリ",
        subCategories: "{{count}} 件のサブカテゴリ",
        subcategories: "{{count}} 件のサブカテゴリ",
        oneAnchor: "1 件のアンカー",
        persons: "{{count}} 人",
        records: "{{count}} 件のレコード",
        groupingCoversSubcategories:
          "{{groupingName}} は {{count}} 件のサブカテゴリを含みます",
      },
    },
    hierarchyTree: {
      empty: {
        noData: "階層データは利用できません",
      },
    },
  },
  jobs: {
    page: {
      title: "ジョブ",
      subtitle: "バックグラウンドジョブとキュー状態を監視",
      empty: {
        title: "ジョブが見つかりません",
        archived: "24 時間より古いアーカイブ済みジョブはありません。",
        filtered:
          "ステータス {{status}} のジョブはありません。別のフィルターを試してください。",
        recent:
          "過去 24 時間のジョブはありません。古いジョブはアーカイブを確認してください。",
      },
      table: {
        job: "ジョブ",
        type: "タイプ",
        source: "ソース",
        started: "開始",
        duration: "期間",
        status: "ステータス",
        actions: "操作",
      },
      pagination: "ページ {{current}} / {{last}} - {{total}} 件のジョブ",
    },
    filters: {
      statuses: {
        all: "すべて (24 h)",
        pending: "保留中",
        queued: "キュー済み",
        running: "実行中",
        completed: "完了",
        failed: "失敗",
        cancelled: "キャンセル済み",
        archived: "アーカイブ済み",
      },
      types: {
        all: "すべてのタイプ",
        analysis: "解析",
        characterization: "特性記述",
        incidenceRate: "発生率",
        estimation: "推定",
        prediction: "予測",
        pathway: "経路",
        sccs: "SCCS",
        evidenceSynthesis: "エビデンス統合",
        cohortGeneration: "コホート生成",
        careGaps: "ケアギャップ",
        achilles: "Achilles",
        dataQuality: "データ品質",
        heelChecks: "Heel チェック",
        ingestion: "取り込み",
        vocabulary: "ボキャブラリ",
        genomicParse: "ゲノム解析",
        poseidon: "Poseidon ETL",
        fhirExport: "FHIR エクスポート",
        fhirSync: "FHIR 同期",
        gisImport: "GIS インポート",
        gisBoundaries: "GIS 境界",
      },
    },
    actions: {
      retry: "再試行",
      retryJob: "ジョブを再試行",
      cancel: "キャンセル",
      cancelJob: "ジョブをキャンセル",
      previous: "前へ",
      next: "次へ",
    },
    drawer: {
      titleFallback: "ジョブ詳細",
      loadError: "ジョブ詳細を読み込めませんでした。",
      sections: {
        executionLog: "実行ログ",
        analysis: "解析",
        cohort: "コホート",
        ingestionPipeline: "取り込みパイプライン",
        fhirSync: "FHIR 同期",
        dataQuality: "データ品質",
        heelChecks: "Heel チェック",
        achillesAnalyses: "Achilles 解析",
        genomicParse: "ゲノム解析",
        poseidonEtl: "Poseidon ETL",
        careGapEvaluation: "ケアギャップ評価",
        gisBoundaries: "GIS 境界",
        gisImport: "GIS インポート",
        vocabularyImport: "ボキャブラリ取り込み",
        fhirExport: "FHIR エクスポート",
        overview: "概要",
        output: "出力",
      },
      labels: {
        analysis: "解析",
        createdBy: "作成者",
        parameters: "パラメーター",
        cohort: "コホート",
        personCount: "人数",
        source: "ソース",
        sourceKey: "ソースキー",
        stage: "ステージ",
        project: "プロジェクト",
        file: "ファイル",
        fileSize: "ファイルサイズ",
        mappingCoverage: "マッピング範囲",
        processed: "処理済み",
        failed: "失敗",
        filesDownloaded: "ダウンロード済みファイル",
        recordsExtracted: "抽出済みレコード",
        recordsMapped: "マッピング済みレコード",
        recordsWritten: "書き込み済みレコード",
        recordsFailed: "失敗レコード",
        passed: "合格",
        passRate: "合格率",
        expectedChecks: "想定チェック",
        executionTime: "実行時間",
        failingChecks: "失敗チェック",
        totalRules: "ルール総数",
        rulesTriggered: "発火したルール",
        totalViolations: "違反総数",
        topViolations: "上位違反",
        completed: "完了",
        byCategory: "カテゴリ別",
        failedSteps: "失敗ステップ",
        format: "形式",
        totalVariants: "バリアント総数",
        mappedVariants: "マッピング済みバリアント",
        samples: "サンプル",
        runType: "実行タイプ",
        dagsterRunId: "Dagster 実行 ID",
        stats: "統計",
        bundle: "バンドル",
        complianceSummary: "コンプライアンス概要",
        dataset: "データセット",
        dataType: "データタイプ",
        version: "バージョン",
        geometry: "ジオメトリ",
        features: "フィーチャー",
        tablesLoaded: "読み込み済みテーブル",
        recordsLoaded: "読み込み済みレコード",
        outputFormat: "出力形式",
        type: "タイプ",
        triggeredBy: "トリガー元",
        duration: "期間",
        started: "開始",
        created: "作成",
        error: "エラー",
      },
      messages: {
        stalled:
          "このジョブは停止し、1 時間のタイムアウトを超えたため失敗としてマークされました。",
        failedCount: "{{count}} 件失敗",
        runningCount: "{{count}} 件実行中",
        ofTotal: "/ {{count}}",
        records: "{{count}} 件のレコード",
      },
    },
  },
});

const zhApp: MessageTree = mergeMessageTrees(enApp, {
  covariates: {
    title: "协变量设置",
    description: "选择要作为 FeatureExtraction 协变量包含的领域。",
    groups: {
      core: "核心领域",
      extended: "扩展领域",
      indices: "合并症指数",
    },
    labels: {
      demographics: "人口统计",
      conditionOccurrence: "疾病发生",
      drugExposure: "药物暴露",
      procedureOccurrence: "操作发生",
      measurement: "测量",
      observation: "观察",
      deviceExposure: "设备暴露",
      visitCount: "就诊次数",
      charlsonComorbidity: "Charlson 合并症",
      dcsi: "DCSI (糖尿病)",
      chads2: "CHADS2",
      chads2Vasc: "CHA2DS2-VASc",
    },
    timeWindows: "时间窗口",
    to: "至",
    days: "天",
    addTimeWindow: "添加时间窗口",
  },
  vocabulary: {
    mappingAssistant: {
      title: "概念映射助手",
      poweredBy: "由 Ariadne 提供支持",
      subtitle: "使用逐字、向量和 LLM 匹配将源术语映射到 OMOP 标准概念",
      filters: {
        selectedCount: "已选择 {{count}} 个",
        clearSelection: "清除选择",
        targetVocabulary: "目标词汇表:",
        allVocabularies: "所有词汇表",
        targetDomain: "目标领域:",
        allDomains: "所有领域",
      },
      drawer: {
        disambiguate: "消歧",
        candidateCount: "{{count}} 个候选 - 选择正确映射",
        noCandidates: "未找到候选。请先清理下面的术语。",
        cleanRemap: "清理并重新映射",
        editPlaceholder: "编辑术语并重新映射...",
      },
      actions: {
        clean: "清理",
        remap: "重新映射",
        acceptMapping: "接受映射",
        rejectMapping: "拒绝映射",
        disambiguateTitle: "消歧 - 查看所有候选",
        uploadCsv: "上传 CSV",
        loadProject: "加载项目",
        mapping: "正在映射...",
        mapTerms: "映射术语",
        clearResults: "清除结果",
        acceptAllThreshold: "接受所有 >= 90%",
        saveToVocabulary: "保存到词汇表",
        saveProject: "保存项目",
        exportCsv: "导出 CSV",
      },
      toasts: {
        remapped: '已重新映射 "{{source}}" -> {{concept}}',
        noMatchForCleaned: '清理后的术语 "{{term}}" 未找到匹配',
        remapFailed: "重新映射失败",
        autoAccepted: "已自动接受 {{count}} 个高置信度映射",
        savedMappings: "已将 {{count}} 个映射保存到 source_to_concept_map",
        saveMappingsFailed: "保存映射失败",
        projectSaved: "项目已保存: {{name}}",
        saveProjectFailed: "保存项目失败",
        projectLoaded: "已加载项目: {{name}}",
        loadProjectFailed: "加载项目失败",
      },
      errors: {
        cleanupFailed: "清理失败。",
        mappingFailed: "映射失败。请确认 Ariadne 服务正在运行且可访问。",
      },
      results: {
        candidateCount: "{{count}} 个候选",
        overridden: "(已覆盖)",
        noMatchFound: "未找到匹配",
        selectOverride: "选择一个候选来覆盖映射",
        noAdditionalCandidates: "没有其他候选。",
      },
      labels: {
        noValue: "-",
        separator: "-",
      },
      input: {
        termsMapped: "已映射 {{count}} 个术语",
        editTerms: "编辑术语",
        sourceTerms: "源术语",
        termsPlaceholder:
          "输入源术语，每行一个...\n\ntype 2 diabetes mellitus\nacute myocardial infarction\nHTN\nASA 81mg",
        termsEntered: "已输入 {{count}} 个术语",
      },
      projects: {
        loading: "正在加载项目...",
        loadFailed: "加载项目失败",
        empty: "没有保存的项目",
        projectMeta: "{{count}} 个术语 -- {{date}}",
        namePlaceholder: "项目名称...",
      },
      vocabularies: {
        SNOMED: "SNOMED CT",
        ICD10CM: "ICD-10-CM",
        RxNorm: "RxNorm",
        LOINC: "LOINC",
        ICD9CM: "ICD-9-CM",
        CPT4: "CPT-4",
        HCPCS: "HCPCS",
        MedDRA: "MedDRA",
      },
      domains: {
        Condition: "疾病",
        Drug: "药物",
        Procedure: "操作",
        Measurement: "测量",
        Observation: "观察",
        Device: "设备",
      },
      progress: {
        mappingTerms: "正在映射 {{count}} 个术语...",
      },
      metrics: {
        termsMapped: "已映射术语",
        highConfidence: "高置信度",
        needReview: "需要审阅",
        noMatch: "无匹配",
      },
      table: {
        sourceTerm: "源术语",
        bestMatch: "最佳匹配",
        confidence: "置信度",
        matchType: "匹配类型",
        vocabulary: "词汇表",
        actions: "操作",
      },
      summary: {
        mapped: "已映射 {{count}} 个",
        high: "{{count}} 个高置信度",
        review: "{{count}} 个待审阅",
        noMatch: "{{count}} 个无匹配",
        accepted: "已接受 {{count}} 个",
      },
    },
    conceptDetail: {
      tabs: {
        info: "信息",
        relationships: "关系",
        mapsFrom: "映射来源",
        hierarchy: "层级",
      },
      empty: {
        title: "选择一个概念以查看详情",
        subtitle: "在左侧面板中搜索并点击概念",
        noAncestors: "未找到祖先",
        noRelationships: "未找到关系",
        noSourceCodes: "没有源代码映射到此概念",
      },
      errors: {
        failedLoad: "加载概念失败",
      },
      toasts: {
        conceptIdCopied: "概念 ID 已复制",
      },
      actions: {
        copyConceptId: "复制概念 ID",
        addToSet: "添加到集合",
      },
      values: {
        standard: "标准",
        classification: "分类",
        nonStandard: "非标准",
        valid: "有效",
      },
      sections: {
        basicInformation: "基本信息",
        synonyms: "同义词",
        ancestors: "祖先",
        relationships: "关系",
        mapsFrom: "映射到此概念的源代码",
        mapsFromDescription:
          "映射到此标准概念的源词汇表代码 (ICD-10、SNOMED、RxNorm 等)",
        hierarchy: "概念层级",
      },
      fields: {
        conceptCode: "概念代码",
        domain: "领域",
        vocabulary: "词汇表",
        conceptClass: "概念类别",
        standardConcept: "标准概念",
        invalidReason: "无效原因",
        validStartDate: "有效开始日期",
        validEndDate: "有效结束日期",
      },
      table: {
        id: "ID",
        name: "名称",
        domain: "领域",
        vocabulary: "词汇表",
        relationship: "关系",
        relatedId: "相关 ID",
        relatedName: "相关名称",
        code: "代码",
        class: "类别",
      },
      pagination: {
        showingRange: "显示 {{start}}-{{end}} / {{total}}",
        showingSourceCodes: "显示 {{shown}} / {{total}} 个源代码",
      },
    },
    semanticSearch: {
      hecate: "Hecate",
      poweredBy: "由 Hecate 提供支持",
      tagline: "向量驱动的概念发现",
      placeholder: "输入临床术语以进行语义搜索...",
      filters: {
        allDomains: "所有领域",
        allVocabularies: "所有词汇表",
        standard: {
          all: "全部",
          standard: "S",
          classification: "C",
        },
      },
      badges: {
        standard: "标准",
        classification: "分类",
      },
      values: {
        inSet: "在集合中",
        standardAbbrev: "S",
      },
      actions: {
        addToSet: "添加到集合",
        clearFilters: "清除筛选器",
        retry: "重试",
        tryClearingFilters: "尝试清除筛选器",
      },
      errors: {
        unavailable: "语义搜索不可用。",
        serviceHelp:
          "请确保 Hecate AI 服务正在运行且 ChromaDB 已初始化。",
      },
      empty: {
        prompt: "输入临床术语以进行语义搜索",
        help:
          "Hecate 使用向量嵌入查找概念上相似的 OMOP 概念，即使精确关键词匹配失败也可以。",
        noResults: '未找到 "{{query}}" 的语义匹配',
      },
      results: {
        matchCountOne: "{{count}} 个语义匹配",
        matchCountMany: "{{count}} 个语义匹配",
        updating: "正在更新...",
      },
    },
    searchPanel: {
      placeholder: "搜索概念...",
      filters: {
        toggle: "筛选器",
        standardOnly: "标准",
        allDomains: "所有领域",
        allVocabularies: "所有词汇表",
        allConceptClasses: "所有概念类别",
        countSuffix: " ({{count}})",
      },
      actions: {
        clearAllFilters: "清除所有筛选器",
        tryClearingFilters: "尝试清除筛选器",
        loading: "正在加载...",
        loadMoreResults: "加载更多结果",
      },
      empty: {
        prompt: "搜索 OMOP 词汇表",
        help: "输入至少 2 个字符，按名称、代码或 ID 搜索概念",
        noResults: '未找到 "{{query}}" 的概念',
      },
      results: {
        showingCount: "显示 {{shown}} / {{total}} 个结果",
      },
      engine: {
        solr: "Solr",
        pg: "PG",
      },
      values: {
        inSet: "在集合中",
      },
    },
    conceptComparison: {
      title: "比较概念",
      subtitle: "并排比较 2-4 个 OMOP 概念及其属性、祖先和关系",
      search: {
        placeholder: "搜索要添加的概念...",
      },
      sections: {
        ancestors: "祖先 (2 级)",
        relationships: "关系",
      },
      fields: {
        conceptCode: "概念代码",
        domain: "领域",
        vocabulary: "词汇表",
        conceptClass: "概念类别",
        standard: "标准",
        validStart: "有效开始",
        validEnd: "有效结束",
        invalidReason: "无效原因",
      },
      actions: {
        addConcept: "添加概念",
      },
      empty: {
        prompt: "搜索要比较的概念",
        help: "选择 2-4 个概念，以并排比较它们的属性、祖先和关系",
      },
      values: {
        standard: "标准",
        classification: "分类",
        nonStandard: "非标准",
        valid: "有效",
        level: "L{{level}}",
        selected: "已选择:",
        addOneMore: "至少再添加一个用于比较",
      },
    },
    addToConceptSet: {
      title: "添加到概念集",
      create: {
        title: "创建新概念集",
        help: "添加概念并在 Builder 中打开",
        nameLabel: "新概念集名称",
      },
      actions: {
        create: "创建",
        cancel: "取消",
        openBuilderWithSearch: "使用当前搜索打开 Builder",
      },
      divider: "或添加到现有集合",
      filter: {
        placeholder: "筛选概念集...",
      },
      empty: {
        noMatching: "没有匹配的概念集",
        noSets: "未找到概念集",
      },
      footer: {
        includeDescendants: "使用 Include Descendants 添加",
      },
      toasts: {
        addedToSet: '已添加到 "{{setName}}"',
        addFailed: "添加概念到集合失败",
        missingSetId: "无法检索新概念集 ID",
        createdAndAdded: '已创建 "{{name}}" 并添加概念',
        createdAddFailed: "集合已创建，但添加概念失败",
        createFailed: "创建概念集失败",
      },
    },
    page: {
      title: "词汇表浏览器",
      subtitle: "搜索、探索并浏览 OMOP 标准化词汇表",
      tabs: {
        keyword: "关键词搜索",
        semantic: "语义搜索",
        browse: "浏览层级",
      },
    },
    hierarchyBrowser: {
      breadcrumb: {
        allDomains: "所有领域",
      },
      filters: {
        allSources: "所有来源",
        itemPlaceholder: "筛选 {{count}} 个项目...",
      },
      actions: {
        showAllConcepts: "显示所有概念",
        showGroupings: "显示分组",
        clearFilter: "清除筛选器",
        viewDetailsFor: "查看 {{conceptName}} 的详情",
        viewConceptDetails: "查看概念详情",
      },
      empty: {
        noMatchingConcepts: "没有匹配的概念",
        noConcepts: "未找到概念",
      },
      counts: {
        clinicalGroupings: "{{count}} 个临床分组",
        concepts: "{{count}} 个概念",
        items: "{{count}} 个项目",
        filteredItems: "{{shown}} / {{total}} 个项目",
        namedSubCategories: "{{name}} - {{count}} 个子类别",
        subCategories: "{{count}} 个子类别",
        subcategories: "{{count}} 个子类别",
        oneAnchor: "1 个锚点",
        persons: "{{count}} 人",
        records: "{{count}} 条记录",
        groupingCoversSubcategories:
          "{{groupingName}} 覆盖 {{count}} 个子类别",
      },
    },
    hierarchyTree: {
      empty: {
        noData: "没有可用的层级数据",
      },
    },
  },
  jobs: {
    page: {
      title: "作业",
      subtitle: "监控后台作业和队列状态",
      empty: {
        title: "未找到作业",
        archived: "没有超过 24 小时的已归档作业。",
        filtered: "没有状态为 {{status}} 的作业。请尝试其他筛选器。",
        recent: "过去 24 小时没有作业。请在已归档中查看更早的作业。",
      },
      table: {
        job: "作业",
        type: "类型",
        source: "来源",
        started: "开始时间",
        duration: "持续时间",
        status: "状态",
        actions: "操作",
      },
      pagination: "第 {{current}} / {{last}} 页 - 共 {{total}} 个作业",
    },
    filters: {
      statuses: {
        all: "全部 (24 h)",
        pending: "待处理",
        queued: "已排队",
        running: "运行中",
        completed: "已完成",
        failed: "失败",
        cancelled: "已取消",
        archived: "已归档",
      },
      types: {
        all: "所有类型",
        analysis: "分析",
        characterization: "特征描述",
        incidenceRate: "发生率",
        estimation: "估计",
        prediction: "预测",
        pathway: "路径",
        sccs: "SCCS",
        evidenceSynthesis: "证据综合",
        cohortGeneration: "队列生成",
        careGaps: "护理缺口",
        achilles: "Achilles",
        dataQuality: "数据质量",
        heelChecks: "Heel 检查",
        ingestion: "摄取",
        vocabulary: "词汇表",
        genomicParse: "基因组解析",
        poseidon: "Poseidon ETL",
        fhirExport: "FHIR 导出",
        fhirSync: "FHIR 同步",
        gisImport: "GIS 导入",
        gisBoundaries: "GIS 边界",
      },
    },
    actions: {
      retry: "重试",
      retryJob: "重试作业",
      cancel: "取消",
      cancelJob: "取消作业",
      previous: "上一页",
      next: "下一页",
    },
    drawer: {
      titleFallback: "作业详情",
      loadError: "无法加载作业详情。",
      sections: {
        executionLog: "执行日志",
        analysis: "分析",
        cohort: "队列",
        ingestionPipeline: "摄取管道",
        fhirSync: "FHIR 同步",
        dataQuality: "数据质量",
        heelChecks: "Heel 检查",
        achillesAnalyses: "Achilles 分析",
        genomicParse: "基因组解析",
        poseidonEtl: "Poseidon ETL",
        careGapEvaluation: "护理缺口评估",
        gisBoundaries: "GIS 边界",
        gisImport: "GIS 导入",
        vocabularyImport: "词汇表导入",
        fhirExport: "FHIR 导出",
        overview: "概览",
        output: "输出",
      },
      labels: {
        analysis: "分析",
        createdBy: "创建者",
        parameters: "参数",
        cohort: "队列",
        personCount: "人数",
        source: "来源",
        sourceKey: "来源键",
        stage: "阶段",
        project: "项目",
        file: "文件",
        fileSize: "文件大小",
        mappingCoverage: "映射覆盖率",
        processed: "已处理",
        failed: "失败",
        filesDownloaded: "已下载文件",
        recordsExtracted: "已提取记录",
        recordsMapped: "已映射记录",
        recordsWritten: "已写入记录",
        recordsFailed: "失败记录",
        passed: "通过",
        passRate: "通过率",
        expectedChecks: "预期检查",
        executionTime: "执行时间",
        failingChecks: "失败检查",
        totalRules: "规则总数",
        rulesTriggered: "触发规则",
        totalViolations: "违规总数",
        topViolations: "主要违规",
        completed: "已完成",
        byCategory: "按类别",
        failedSteps: "失败步骤",
        format: "格式",
        totalVariants: "变异总数",
        mappedVariants: "已映射变异",
        samples: "样本",
        runType: "运行类型",
        dagsterRunId: "Dagster 运行 ID",
        stats: "统计",
        bundle: "包",
        complianceSummary: "合规摘要",
        dataset: "数据集",
        dataType: "数据类型",
        version: "版本",
        geometry: "几何",
        features: "要素",
        tablesLoaded: "已加载表",
        recordsLoaded: "已加载记录",
        outputFormat: "输出格式",
        type: "类型",
        triggeredBy: "触发者",
        duration: "持续时间",
        started: "开始时间",
        created: "创建时间",
        error: "错误",
      },
      messages: {
        stalled:
          "此作业已停止，并因超过 1 小时超时限制而标记为失败。",
        failedCount: "{{count}} 个失败",
        runningCount: "{{count}} 个运行中",
        ofTotal: "/ {{count}}",
        records: "{{count}} 条记录",
      },
    },
  },
});

export const appResources: Record<string, MessageTree> = {
  "en-US": enApp,
  "es-ES": esApp,
  "fr-FR": frApp,
  "de-DE": deApp,
  "pt-BR": ptApp,
  "fi-FI": fiApp,
  "ja-JP": jaApp,
  "zh-Hans": zhApp,
  "ko-KR": koApp,
};
