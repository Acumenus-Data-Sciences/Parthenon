type MessageTree = {
  [key: string]: string | MessageTree;
};

function mergeMessageTrees(
  base: MessageTree,
  overrides: MessageTree,
): MessageTree {
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
        serviceRegistry: "Add a service registry entry in {{path}}.",
        toolModule: "Register the MCP tool module in {{path}}.",
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
      title: "Espacio de trabajo",
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
  studyAgent: {
    header: {
      title: "Concepteur d'etude",
      subtitle: "Conception d'etude assistee par IA avec OHDSI StudyAgent",
    },
    tabs: {
      intent: "Intention de l'etude",
      search: "Recherche de phenotypes",
      recommend: "Recommandations",
      lint: "Controle de cohorte",
    },
    intent: {
      title: "Decrivez votre etude",
      description:
        "Saisissez une description en langage naturel de votre etude. L'IA la separera en population cible et resultat, puis recommandera des phenotypes de la bibliotheque OHDSI.",
      placeholder:
        "p. ex., comparer le risque d'insuffisance cardiaque chez les patients nouvellement traites par inhibiteurs SGLT2 versus inhibiteurs DPP-4 parmi les adultes atteints de diabete de type 2...",
      analyze: "Analyser l'intention de l'etude",
      targetPopulation: "Population cible",
      outcome: "Resultat",
    },
    recommendations: {
      title: "Phenotypes recommandes",
      score: "Score : {{value}}",
      loading: "Recherche de recommandations de phenotypes...",
      promptPrefix: "Saisissez une intention d'etude dans l'onglet",
      promptSuffix:
        "pour obtenir des recommandations de phenotypes classees par IA.",
    },
    search: {
      title: "Rechercher dans la bibliotheque de phenotypes",
      placeholder:
        "Rechercher des phenotypes (p. ex., diabete de type 2, insuffisance cardiaque, BPCO)...",
      submit: "Rechercher",
      resultsFound_one: "{{count}} resultat trouve",
      resultsFound_other: "{{count}} resultats trouves",
      noneFound: "Aucun phenotype trouve. Essayez un autre terme de recherche.",
    },
    lint: {
      title: "Verifier une definition de cohorte",
      description:
        "Collez un JSON de definition de cohorte pour detecter des problemes de conception comme des periodes de washout manquantes, des ensembles de concepts vides et des fenetres temporelles inversees.",
      run: "Executer le controle",
      noIssuesFound: "Aucun probleme trouve",
      issuesFound_one: "{{count}} probleme trouve",
      issuesFound_other: "{{count}} problemes trouves",
      failed: "Echec du controle : JSON invalide ou erreur serveur.",
    },
  },
  phenotypeLibrary: {
    page: {
      title: "Bibliotheque de phenotypes",
      subtitle:
        "Plus de 300 definitions de phenotypes OHDSI organisees - parcourir, filtrer et importer en un clic",
      searchPlaceholder: "Rechercher des phenotypes par nom ou description...",
      allDomains: "Tous les domaines",
      loading: "Chargement...",
      clearFilters: "Effacer les filtres",
      resultCount_one: "{{displayCount}} phenotype",
      resultCount_other: "{{displayCount}} phenotypes",
      matchingFilters: "correspondant aux filtres",
    },
    detail: {
      description: "Description",
      logic: "Logique",
      noAdditionalDetails: "Aucun detail supplementaire disponible.",
    },
    stats: {
      totalPhenotypes: "Total des phenotypes",
      withExpression: "Avec expression",
      domainsCovered: "Domaines couverts",
      imported: "Importes",
    },
    table: {
      headers: {
        name: "Nom",
        domain: "Domaine",
        severity: "Gravite",
        tags: "Etiquettes",
        action: "Action",
      },
      failedToLoad: "Echec du chargement de la bibliotheque de phenotypes.",
      empty: "Aucun phenotype trouve.",
      noTags: "aucune etiquette",
    },
    actions: {
      imported: "Importe",
      import: "Importer",
      importing: "Importation...",
      noExpressionAvailable: "Aucune expression disponible",
      importAsCohortDefinition: "Importer comme definition de cohorte",
    },
    pagination: {
      pageOf: "Page {{page}} sur {{totalPages}}",
      previous: "Precedent",
      next: "Suivant",
    },
    domains: {
      condition: "Affection",
      drug: "Medicament",
      measurement: "Mesure",
      procedure: "Procedure",
      observation: "Observation",
      device: "Dispositif",
    },
    severities: {
      acute: "Aigu",
      chronic: "Chronique",
      subacute: "Subaigu",
    },
  },
  communityWorkbenchSdk: {
    page: {
      badge: "Demo phase 3",
      title: "Demo du SDK Community Workbench",
      subtitle:
        "Cette page bac a sable montre a quoi ressemble un outil genere par SDK dans Parthenon avant le raccordement d'une logique propre au domaine. Il s'agit d'une implementation de reference hors production pour les developpeurs de la communaute, les equipes partenaires et les assistants de codage IA.",
      backToWorkbench: "Retour au Workbench",
      openSdkDocs: "Ouvrir la documentation SDK",
      loading:
        "Chargement de la charge utile de demo depuis le backend Parthenon...",
      failed:
        "La charge utile de demo Community Workbench SDK n'a pas pu etre chargee depuis le backend.",
    },
    serviceDescriptor: {
      title: "Descripteur de service exemple",
      description:
        "Voici les metadonnees de decouverte et de disponibilite qu'un outil genere doit exposer avant que le frontend n'affiche la surface Workbench.",
    },
    checklist: {
      title: "Liste de controle d'integration",
      step: "Etape {{index}}",
      items: {
        serviceRegistry:
          "Ajouter une entree de registre de service dans {{path}}.",
        toolModule: "Enregistrer le module d'outil MCP dans {{path}}.",
        backendController:
          "Raccorder un controleur backend et un service Workbench pour la validation, les autorisations et la persistance.",
        frontendRoute:
          "Ajouter une route frontend et remplacer les panneaux temporaires par un rendu propre au domaine.",
        validatePayloads:
          "Valider les charges utiles reelles avec les schemas Community Workbench SDK avant la publication.",
      },
    },
    resultEnvelope: {
      title: "Enveloppe de resultat exemple",
      description:
        "Les outils generes par SDK doivent normaliser leurs diagnostics d'execution, leur contexte source, leur resume et leurs artefacts dans une enveloppe previsible comme celle-ci avant d'afficher des panneaux plus riches.",
    },
    artifacts: {
      title: "Inventaire des artefacts generes",
      descriptionPrefix:
        "Cette demo s'appuie sur un exemple d'echafaudage genere reel situe dans",
      descriptionSuffix: "dans le depot.",
    },
  },
  workbenchLauncher: {
    page: {
      title: "वर्कबेंच",
      subtitle: "Nouvelles capacites et boites a outils de recherche",
    },
    sections: {
      toolsetsTitle: "Boites a outils",
      toolsetsSubtitle:
        "Choisissez le workbench adapte a votre question de recherche.",
      recentTitle: "Investigations recentes",
      recentSubtitle:
        "Investigations de preuves sur lesquelles vous avez travaille recemment.",
    },
    states: {
      loadingInvestigations: "Chargement des investigations...",
      emptyInvestigations: "Commencez votre premiere investigation de preuves.",
    },
    actions: {
      createInvestigation: "Creer une investigation",
      newInvestigation: "Nouvelle investigation",
    },
    footer: {
      prompt: "Vous voulez creer une boite a outils personnalisee ?",
      link: "Voir la reference du SDK Community",
    },
    toolsetMeta: {
      morpheus: {
        name: "Morpheus",
        tagline:
          "Workbench d'analytique des resultats hospitaliers et de soins intensifs",
        description:
          "Analytique axee sur les soins intensifs exploitant les donnees MIMIC-IV dans OMOP CDM 5.4. Conformite au bundle ABCDEF Liberation, prediction du sevrage ventilatoire, surveillance de la sedation et recherche sur les resultats hospitaliers.",
      },
      sdk: {
        name: "Creer une boite a outils",
        tagline: "SDK Community pour integrations tierces",
        description:
          "Implementation de reference et documentation SDK pour creer des boites a outils personnalisees qui se branchent sur Parthenon Workbench. Descripteurs de service, enveloppes de resultat et modeles d'artefacts.",
      },
    },
    toolsetStatus: {
      available: "Disponible",
      comingSoon: "Bientot disponible",
      sdkRequired: "SDK requis",
    },
    investigationStatus: {
      draft: "Brouillon",
      active: "Actif",
      complete: "Termine",
      archived: "Archive",
    },
  },
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
        "Accedez a un projet d'ingestion et cliquez sur \"Open in Aqueduct\" pour commencer a concevoir les mappages ETL entre votre schema source et l'OMOP CDM.",
    },
  },
});

const deSmallWorkbench: MessageTree = mergeMessageTrees(enSmallWorkbench, {
  studyAgent: {
    header: {
      title: "Studien-Designer",
      subtitle: "KI-gestutztes Studiendesign mit OHDSI StudyAgent",
    },
    tabs: {
      intent: "Studienabsicht",
      search: "Phaenotypsuche",
      recommend: "Empfehlungen",
      lint: "Kohortenpruefung",
    },
    intent: {
      title: "Beschreiben Sie Ihre Studie",
      description:
        "Geben Sie eine natuerlichsprachliche Beschreibung Ihrer Studie ein. Die KI teilt sie in Zielpopulation und Ergebnis auf und empfiehlt dann Phaenotypen aus der OHDSI-Bibliothek.",
      placeholder:
        "z. B. Vergleich des Risikos fuer Herzinsuffizienz bei Patienten mit neuer Verordnung von SGLT2-Hemmern gegenueber DPP-4-Hemmern bei Erwachsenen mit Typ-2-Diabetes...",
      analyze: "Studienabsicht analysieren",
      targetPopulation: "Zielpopulation",
      outcome: "Ergebnis",
    },
    recommendations: {
      title: "Empfohlene Phaenotypen",
      score: "Score: {{value}}",
      loading: "Phaenotypempfehlungen werden gesucht...",
      promptPrefix: "Geben Sie eine Studienabsicht im Tab",
      promptSuffix: "ein, um KI-gerankte Phaenotypempfehlungen zu erhalten.",
    },
    search: {
      title: "Phaenotypbibliothek durchsuchen",
      placeholder:
        "Phaenotypen suchen (z. B. Typ-2-Diabetes, Herzinsuffizienz, COPD)...",
      submit: "Suchen",
      resultsFound_one: "{{count}} Ergebnis gefunden",
      resultsFound_other: "{{count}} Ergebnisse gefunden",
      noneFound:
        "Keine Phaenotypen gefunden. Versuchen Sie einen anderen Suchbegriff.",
    },
    lint: {
      title: "Kohortendefinition pruefen",
      description:
        "Fuegen Sie JSON einer Kohortendefinition ein, um Designprobleme wie fehlende Washout-Perioden, leere Konzeptsets und invertierte Zeitfenster zu erkennen.",
      run: "Pruefung ausfuehren",
      noIssuesFound: "Keine Probleme gefunden",
      issuesFound_one: "{{count}} Problem gefunden",
      issuesFound_other: "{{count}} Probleme gefunden",
      failed: "Pruefung fehlgeschlagen: ungueltiges JSON oder Serverfehler.",
    },
  },
  phenotypeLibrary: {
    page: {
      title: "Phaenotypbibliothek",
      subtitle:
        "Mehr als 300 kuratierte OHDSI-Phaenotypdefinitionen - durchsuchen, filtern und mit einem Klick importieren",
      searchPlaceholder: "Phaenotypen nach Name oder Beschreibung suchen...",
      allDomains: "Alle Domaenen",
      loading: "Wird geladen...",
      clearFilters: "Filter zuruecksetzen",
      resultCount_one: "{{displayCount}} Phaenotyp",
      resultCount_other: "{{displayCount}} Phaenotypen",
      matchingFilters: "passend zu den Filtern",
    },
    detail: {
      description: "Beschreibung",
      logic: "Logik",
      noAdditionalDetails: "Keine weiteren Details verfuegbar.",
    },
    stats: {
      totalPhenotypes: "Phaenotypen insgesamt",
      withExpression: "Mit Ausdruck",
      domainsCovered: "Abgedeckte Domaenen",
      imported: "Importiert",
    },
    table: {
      headers: {
        name: "Name",
        domain: "Domaene",
        severity: "Schweregrad",
        tags: "Tags",
        action: "Aktion",
      },
      failedToLoad: "Phaenotypbibliothek konnte nicht geladen werden.",
      empty: "Keine Phaenotypen gefunden.",
      noTags: "keine Tags",
    },
    actions: {
      imported: "Importiert",
      import: "Importieren",
      importing: "Importieren...",
      noExpressionAvailable: "Kein Ausdruck verfuegbar",
      importAsCohortDefinition: "Als Kohortendefinition importieren",
    },
    pagination: {
      pageOf: "Seite {{page}} von {{totalPages}}",
      previous: "Zurueck",
      next: "Weiter",
    },
    domains: {
      condition: "Erkrankung",
      drug: "Arzneimittel",
      measurement: "Messung",
      procedure: "Prozedur",
      observation: "Beobachtung",
      device: "Geraet",
    },
    severities: {
      acute: "Akut",
      chronic: "Chronisch",
      subacute: "Subakut",
    },
  },
  communityWorkbenchSdk: {
    page: {
      badge: "Phase-3-Demo",
      title: "Community Workbench SDK-Demo",
      subtitle:
        "Diese Sandbox-Seite zeigt, wie ein SDK-generiertes Werkzeug in Parthenon aussieht, bevor domainspezifische Logik verdrahtet ist. Es ist eine nicht-produktive Referenzimplementierung fuer Community-Entwickler, Partnerteams und KI-Coding-Assistenten.",
      backToWorkbench: "Zurueck zum Workbench",
      openSdkDocs: "SDK-Dokumentation oeffnen",
      loading: "Demo-Nutzlast wird vom Parthenon-Backend geladen...",
      failed:
        "Die Demo-Nutzlast des Community Workbench SDK konnte nicht aus dem Backend geladen werden.",
    },
    serviceDescriptor: {
      title: "Beispiel-Service-Deskriptor",
      description:
        "Dies sind die Discovery- und Verfuegbarkeitsmetadaten, die ein generiertes Werkzeug bereitstellen sollte, bevor das Frontend die Workbench-Oberflaeche rendert.",
    },
    checklist: {
      title: "Integrations-Checkliste",
      step: "Schritt {{index}}",
      items: {
        serviceRegistry:
          "Einen Service-Registry-Eintrag in {{path}} hinzufuegen.",
        toolModule: "Das MCP-Werkzeugmodul in {{path}} registrieren.",
        backendController:
          "Einen Backend-Controller und Workbench-Service fuer Validierung, Berechtigungen und Persistenz verdrahten.",
        frontendRoute:
          "Eine Frontend-Route hinzufuegen und Platzhalterpanels durch domainspezifisches Rendering ersetzen.",
        validatePayloads:
          "Reale Nutzlasten vor der Freigabe gegen die Community Workbench SDK-Schemas validieren.",
      },
    },
    resultEnvelope: {
      title: "Beispiel-Ergebnisumschlag",
      description:
        "SDK-generierte Werkzeuge sollten Laufzeitdiagnostik, Quellkontext, Zusammenfassung und Artefakte in einem vorhersagbaren Umschlag wie diesem normalisieren, bevor reichere Panels gerendert werden.",
    },
    artifacts: {
      title: "Inventar generierter Artefakte",
      descriptionPrefix:
        "Diese Demo basiert auf einem real generierten Beispielgeruest unter",
      descriptionSuffix: "im Repository.",
    },
  },
  workbenchLauncher: {
    page: {
      title: "Workbench",
      subtitle: "Neue Funktionen und Forschungswerkzeugsets",
    },
    sections: {
      toolsetsTitle: "Werkzeugsets",
      toolsetsSubtitle:
        "Waehlen Sie den Workbench, der zu Ihrer Forschungsfrage passt.",
      recentTitle: "Aktuelle Untersuchungen",
      recentSubtitle:
        "Evidenzuntersuchungen, an denen Sie kuerzlich gearbeitet haben.",
    },
    states: {
      loadingInvestigations: "Untersuchungen werden geladen...",
      emptyInvestigations: "Starten Sie Ihre erste Evidenzuntersuchung.",
    },
    actions: {
      createInvestigation: "Untersuchung erstellen",
      newInvestigation: "Neue Untersuchung",
    },
    footer: {
      prompt: "Moechten Sie ein eigenes Werkzeugset bauen?",
      link: "Community-SDK-Referenz ansehen",
    },
    toolsetMeta: {
      morpheus: {
        name: "Morpheus",
        tagline: "Workbench fuer stationaere Ergebnisse und ICU-Analytik",
        description:
          "ICU-fokussierte Analytik mit MIMIC-IV-Daten in OMOP CDM 5.4. ABCDEF Liberation Bundle-Compliance, Vorhersage der Beatmungsentwoehnung, Sedierungsueberwachung und Forschung zu stationaeren Ergebnissen.",
      },
      sdk: {
        name: "Werkzeugset bauen",
        tagline: "Community-SDK fuer Drittanbieter-Integrationen",
        description:
          "Referenzimplementierung und SDK-Dokumentation fuer den Bau benutzerdefinierter Werkzeugsets, die sich in den Parthenon Workbench einklinken. Service-Deskriptoren, Ergebnisumschlaege und Artefaktmuster.",
      },
    },
    toolsetStatus: {
      available: "Verfuegbar",
      comingSoon: "Bald verfuegbar",
      sdkRequired: "SDK erforderlich",
    },
    investigationStatus: {
      draft: "Entwurf",
      active: "Aktiv",
      complete: "Abgeschlossen",
      archived: "Archiviert",
    },
  },
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
  studyAgent: {
    header: {
      title: "Designer de estudo",
      subtitle: "Desenho de estudo assistido por IA com OHDSI StudyAgent",
    },
    tabs: {
      intent: "Intencao do estudo",
      search: "Busca de fenotipos",
      recommend: "Recomendacoes",
      lint: "Verificacao da coorte",
    },
    intent: {
      title: "Descreva seu estudo",
      description:
        "Insira uma descricao em linguagem natural do seu estudo. A IA separara em populacao-alvo e desfecho e depois recomendara fenotipos da biblioteca OHDSI.",
      placeholder:
        "ex.: comparar o risco de insuficiencia cardiaca em pacientes com nova prescricao de inibidores de SGLT2 versus inibidores de DPP-4 entre adultos com diabetes tipo 2...",
      analyze: "Analisar intencao do estudo",
      targetPopulation: "Populacao-alvo",
      outcome: "Desfecho",
    },
    recommendations: {
      title: "Fenotipos recomendados",
      score: "Score: {{value}}",
      loading: "Buscando recomendacoes de fenotipos...",
      promptPrefix: "Insira uma intencao de estudo na aba",
      promptSuffix: "para obter recomendacoes de fenotipos ranqueadas por IA.",
    },
    search: {
      title: "Buscar na biblioteca de fenotipos",
      placeholder:
        "Buscar fenotipos (ex.: diabetes tipo 2, insuficiencia cardiaca, DPOC)...",
      submit: "Buscar",
      resultsFound_one: "{{count}} resultado encontrado",
      resultsFound_other: "{{count}} resultados encontrados",
      noneFound: "Nenhum fenotipo encontrado. Tente outro termo de busca.",
    },
    lint: {
      title: "Verificar definicao de coorte",
      description:
        "Cole um JSON de definicao de coorte para verificar problemas de desenho, como periodos de washout ausentes, conjuntos de conceitos vazios e janelas temporais invertidas.",
      run: "Executar verificacao",
      noIssuesFound: "Nenhum problema encontrado",
      issuesFound_one: "{{count}} problema encontrado",
      issuesFound_other: "{{count}} problemas encontrados",
      failed: "Falha na verificacao: JSON invalido ou erro do servidor.",
    },
  },
  phenotypeLibrary: {
    page: {
      title: "Biblioteca de fenotipos",
      subtitle:
        "Mais de 300 definicoes de fenotipos OHDSI curadas - navegue, filtre e importe com um clique",
      searchPlaceholder: "Buscar fenotipos por nome ou descricao...",
      allDomains: "Todos os dominios",
      loading: "Carregando...",
      clearFilters: "Limpar filtros",
      resultCount_one: "{{displayCount}} fenotipo",
      resultCount_other: "{{displayCount}} fenotipos",
      matchingFilters: "correspondendo aos filtros",
    },
    detail: {
      description: "Descricao",
      logic: "Logica",
      noAdditionalDetails: "Nenhum detalhe adicional disponivel.",
    },
    stats: {
      totalPhenotypes: "Total de fenotipos",
      withExpression: "Com expressao",
      domainsCovered: "Dominios cobertos",
      imported: "Importados",
    },
    table: {
      headers: {
        name: "Nome",
        domain: "Dominio",
        severity: "Gravidade",
        tags: "Tags",
        action: "Acao",
      },
      failedToLoad: "Falha ao carregar a biblioteca de fenotipos.",
      empty: "Nenhum fenotipo encontrado.",
      noTags: "sem tags",
    },
    actions: {
      imported: "Importado",
      import: "Importar",
      importing: "Importando...",
      noExpressionAvailable: "Nenhuma expressao disponivel",
      importAsCohortDefinition: "Importar como definicao de coorte",
    },
    pagination: {
      pageOf: "Pagina {{page}} de {{totalPages}}",
      previous: "Anterior",
      next: "Proximo",
    },
    domains: {
      condition: "Condicao",
      drug: "Medicamento",
      measurement: "Medida",
      procedure: "Procedimento",
      observation: "Observacao",
      device: "Dispositivo",
    },
    severities: {
      acute: "Agudo",
      chronic: "Cronico",
      subacute: "Subagudo",
    },
  },
  communityWorkbenchSdk: {
    page: {
      badge: "Demo da fase 3",
      title: "Demo do SDK Community Workbench",
      subtitle:
        "Esta pagina sandbox mostra como uma ferramenta gerada pelo SDK aparece dentro do Parthenon antes que a logica especifica de dominio seja conectada. E uma implementacao de referencia nao produtiva para desenvolvedores da comunidade, equipes parceiras e assistentes de codificacao por IA.",
      backToWorkbench: "Voltar ao Workbench",
      openSdkDocs: "Abrir docs do SDK",
      loading: "Carregando carga de demo do backend Parthenon...",
      failed:
        "A carga de demo do Community Workbench SDK nao pode ser carregada do backend.",
    },
    serviceDescriptor: {
      title: "Descritor de servico de exemplo",
      description:
        "Estes sao os metadados de descoberta e disponibilidade que uma ferramenta gerada deve expor antes que o frontend renderize a superficie do workbench.",
    },
    checklist: {
      title: "Lista de verificacao de integracao",
      step: "Etapa {{index}}",
      items: {
        serviceRegistry:
          "Adicione uma entrada de registro de servico em {{path}}.",
        toolModule: "Registre o modulo da ferramenta MCP em {{path}}.",
        backendController:
          "Conecte um controlador backend e um servico workbench para validacao, permissoes e persistencia.",
        frontendRoute:
          "Adicione uma rota frontend e substitua paineis temporarios por renderizacao especifica do dominio.",
        validatePayloads:
          "Valide cargas reais contra os schemas do Community Workbench SDK antes do lancamento.",
      },
    },
    resultEnvelope: {
      title: "Envelope de resultado de exemplo",
      description:
        "Ferramentas geradas pelo SDK devem normalizar diagnosticos de execucao, contexto da fonte, resumo e artefatos em um envelope previsivel como este antes de renderizar paineis mais ricos.",
    },
    artifacts: {
      title: "Inventario de artefatos gerados",
      descriptionPrefix:
        "Esta demo e apoiada por um scaffold de amostra gerado real em",
      descriptionSuffix: "no repositorio.",
    },
  },
  workbenchLauncher: {
    page: {
      title: "Workbench",
      subtitle: "Novas capacidades e conjuntos de ferramentas de pesquisa",
    },
    sections: {
      toolsetsTitle: "Conjuntos de ferramentas",
      toolsetsSubtitle:
        "Escolha o workbench que se ajusta a sua pergunta de pesquisa.",
      recentTitle: "Investigacoes recentes",
      recentSubtitle:
        "Investigacoes de evidencias em que voce trabalhou recentemente.",
    },
    states: {
      loadingInvestigations: "Carregando investigacoes...",
      emptyInvestigations: "Inicie sua primeira Investigacao de Evidencias.",
    },
    actions: {
      createInvestigation: "Criar investigacao",
      newInvestigation: "Nova investigacao",
    },
    footer: {
      prompt: "Quer criar um conjunto de ferramentas personalizado?",
      link: "Ver a referencia do SDK Community",
    },
    toolsetMeta: {
      morpheus: {
        name: "Morpheus",
        tagline: "Workbench de desfechos hospitalares e analitica de UTI",
        description:
          "Analitica focada em UTI usando dados MIMIC-IV em OMOP CDM 5.4. Conformidade com o bundle ABCDEF Liberation, predicao de desmame ventilatorio, monitoramento de sedacao e pesquisa de desfechos hospitalares.",
      },
      sdk: {
        name: "Criar um conjunto de ferramentas",
        tagline: "SDK Community para integracoes de terceiros",
        description:
          "Implementacao de referencia e documentacao do SDK para criar conjuntos de ferramentas personalizados que se conectam ao Parthenon Workbench. Descritores de servico, envelopes de resultado e padroes de artefatos.",
      },
    },
    toolsetStatus: {
      available: "Disponivel",
      comingSoon: "Em breve",
      sdkRequired: "SDK necessario",
    },
    investigationStatus: {
      draft: "Rascunho",
      active: "Ativo",
      complete: "Concluido",
      archived: "Arquivado",
    },
  },
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

const esSmallWorkbench: MessageTree = mergeMessageTrees(enSmallWorkbench, {
  studyAgent: {
    header: {
      title: "Disenador de estudios",
      subtitle:
        "Diseno de estudios asistido por IA impulsado por OHDSI StudyAgent",
    },
    tabs: {
      intent: "Intencion del estudio",
      search: "Busqueda de fenotipos",
      recommend: "Recomendaciones",
      lint: "Revision de cohortes",
    },
    intent: {
      title: "Describa su estudio",
      description:
        "Introduzca una descripcion en lenguaje natural de su estudio. La IA la dividira en poblacion objetivo y desenlace, y luego recomendara fenotipos de la biblioteca de OHDSI.",
      placeholder:
        "p. ej., Compare el riesgo de insuficiencia cardiaca en pacientes a los que se les prescriben por primera vez inhibidores de SGLT2 frente a inhibidores de DPP-4 entre adultos con diabetes tipo 2...",
      analyze: "Analizar la intencion del estudio",
      targetPopulation: "Poblacion objetivo",
      outcome: "Desenlace",
    },
    recommendations: {
      title: "Fenotipos recomendados",
      score: "Puntuacion: {{value}}",
      loading: "Buscando recomendaciones de fenotipos...",
      promptPrefix: "Introduzca una intencion de estudio en la pestana",
      promptSuffix:
        "para obtener recomendaciones de fenotipos clasificadas por IA.",
    },
    search: {
      title: "Buscar en la biblioteca de fenotipos",
      placeholder:
        "Buscar fenotipos (p. ej., diabetes tipo 2, insuficiencia cardiaca, EPOC)...",
      submit: "Buscar",
      resultsFound_one: "{{count}} resultado encontrado",
      resultsFound_other: "{{count}} resultados encontrados",
      noneFound:
        "No se encontraron fenotipos. Pruebe con otro termino de busqueda.",
    },
    lint: {
      title: "Revisar definicion de cohorte",
      description:
        "Pegue un JSON de definicion de cohorte para comprobar problemas de diseno como periodos de lavado ausentes, conjuntos de conceptos vacios y ventanas temporales invertidas.",
      run: "Ejecutar revision",
      noIssuesFound: "No se encontraron problemas",
      issuesFound_one: "{{count}} problema encontrado",
      issuesFound_other: "{{count}} problemas encontrados",
      failed: "No se pudo revisar: JSON no valido o error del servidor.",
    },
  },
  phenotypeLibrary: {
    page: {
      title: "Biblioteca de fenotipos",
      subtitle:
        "Mas de 300 definiciones de fenotipos OHDSI curadas: explore, filtre e importe con un clic",
      searchPlaceholder: "Buscar fenotipos por nombre o descripcion...",
      allDomains: "Todos los dominios",
      loading: "Cargando...",
      clearFilters: "Borrar filtros",
      resultCount_one: "{{displayCount}} fenotipo",
      resultCount_other: "{{displayCount}} fenotipos",
      matchingFilters: "que coinciden con los filtros",
    },
    detail: {
      description: "Descripcion",
      logic: "Logica",
      noAdditionalDetails: "No hay detalles adicionales disponibles.",
    },
    stats: {
      totalPhenotypes: "Fenotipos totales",
      withExpression: "Con expresion",
      domainsCovered: "Dominios cubiertos",
      imported: "Importados",
    },
    table: {
      headers: {
        name: "Nombre",
        domain: "Dominio",
        severity: "Severidad",
        tags: "Etiquetas",
        action: "Accion",
      },
      failedToLoad: "No se pudo cargar la biblioteca de fenotipos.",
      empty: "No se encontraron fenotipos.",
      noTags: "sin etiquetas",
    },
    actions: {
      imported: "Importado",
      import: "Importar",
      importing: "Importando...",
      noExpressionAvailable: "No hay expresion disponible",
      importAsCohortDefinition: "Importar como definicion de cohorte",
    },
    pagination: {
      pageOf: "Pagina {{page}} de {{totalPages}}",
      previous: "Anterior",
      next: "Siguiente",
    },
    domains: {
      condition: "Condicion",
      drug: "Farmaco",
      measurement: "Medicion",
      procedure: "Procedimiento",
      observation: "Observacion",
      device: "Dispositivo",
    },
    severities: {
      acute: "Agudo",
      chronic: "Cronico",
      subacute: "Subagudo",
    },
  },
  communityWorkbenchSdk: {
    page: {
      badge: "Demostracion de fase 3",
      title: "Demostracion del SDK de Community Workbench",
      subtitle:
        "Esta pagina de pruebas muestra el aspecto de una herramienta generada por SDK dentro de Parthenon antes de conectar la logica especifica del dominio. Es una implementacion de referencia no productiva para desarrolladores de la comunidad, equipos asociados y asistentes de codigo con IA.",
      backToWorkbench: "Volver al Workbench",
      openSdkDocs: "Abrir documentacion del SDK",
      loading:
        "Cargando la carga de demostracion desde el backend de Parthenon...",
      failed:
        "No se pudo cargar desde el backend la carga de demostracion del SDK de Community Workbench.",
    },
    serviceDescriptor: {
      title: "Descriptor de servicio de ejemplo",
      description:
        "Estos son los metadatos de descubrimiento y disponibilidad que una herramienta generada debe exponer antes de que el frontend renderice la superficie del workbench.",
    },
    checklist: {
      title: "Lista de comprobacion de integracion",
      step: "Paso {{index}}",
      items: {
        serviceRegistry:
          "Agregue una entrada del registro de servicios en {{path}}.",
        toolModule: "Registre el modulo de herramienta MCP en {{path}}.",
        backendController:
          "Conecte un controlador backend y un servicio de workbench para validacion, permisos y persistencia.",
        frontendRoute:
          "Agregue una ruta frontend y sustituya los paneles temporales por una representacion especifica del dominio.",
        validatePayloads:
          "Valide cargas reales con los esquemas del SDK de Community Workbench antes del lanzamiento.",
      },
    },
    resultEnvelope: {
      title: "Sobre de resultado de ejemplo",
      description:
        "Las herramientas generadas por SDK deben normalizar sus diagnosticos de ejecucion, contexto de origen, resumen y artefactos en un sobre predecible como este antes de renderizar paneles mas ricos.",
    },
    artifacts: {
      title: "Inventario de artefactos generados",
      descriptionPrefix:
        "Esta demostracion esta respaldada por un andamiaje de ejemplo generado real en",
      descriptionSuffix: "del repositorio.",
    },
  },
  workbenchLauncher: {
    page: {
      title: "Workbench",
      subtitle:
        "Nuevas capacidades y conjuntos de herramientas de investigacion",
    },
    sections: {
      toolsetsTitle: "Conjuntos de herramientas",
      toolsetsSubtitle:
        "Elija el workbench que mejor se adapte a su pregunta de investigacion.",
      recentTitle: "Investigaciones recientes",
      recentSubtitle:
        "Investigaciones de evidencia en las que ha trabajado recientemente.",
    },
    states: {
      loadingInvestigations: "Cargando investigaciones...",
      emptyInvestigations: "Inicie su primera investigacion de evidencia.",
    },
    actions: {
      createInvestigation: "Crear investigacion",
      newInvestigation: "Nueva investigacion",
    },
    footer: {
      prompt: "Quiere crear un conjunto de herramientas personalizado?",
      link: "Ver la referencia del SDK de la comunidad",
    },
    toolsetMeta: {
      morpheus: {
        name: "Morpheus",
        tagline: "Workbench de resultados hospitalarios y analitica UCI",
        description:
          "Analitica centrada en UCI que aprovecha datos MIMIC-IV en OMOP CDM 5.4. Cumplimiento del paquete ABCDEF Liberation, prediccion de destete del ventilador, monitorizacion de la sedacion e investigacion de resultados hospitalarios.",
      },
      sdk: {
        name: "Crear un conjunto de herramientas",
        tagline: "SDK comunitario para integraciones de terceros",
        description:
          "Implementacion de referencia y documentacion del SDK para crear conjuntos de herramientas personalizados que se conecten al Parthenon Workbench. Descriptores de servicio, sobres de resultado y patrones de artefactos.",
      },
    },
    toolsetStatus: {
      available: "Disponible",
      comingSoon: "Proximamente",
      sdkRequired: "SDK requerido",
    },
    investigationStatus: {
      draft: "Borrador",
      active: "Activa",
      complete: "Completa",
      archived: "Archivada",
    },
  },
  etl: {
    toolsPage: {
      loadingProjects: "Cargando proyectos ETL...",
      createTitle: "Crear proyecto de mapeo ETL",
      createDescription:
        "Empiece a mapear su esquema de origen al OMOP CDM. Primero seleccione un origen que haya sido perfilado mediante la pestana Source Profiler.",
      cdmVersion: "Version de CDM",
      cdm54: "OMOP CDM v5.4",
      cdm53: "OMOP CDM v5.3",
      creating: "Creando...",
      createProject: "Crear proyecto",
      createFailed: "No se pudo crear el proyecto",
      emptyTitle: "Disenador de mapeo ETL Aqueduct",
      emptyDescription:
        'Vaya a un proyecto de ingesta y haga clic en "Open in Aqueduct" para empezar a disenar mapeos ETL desde su esquema de origen hacia el OMOP CDM.',
    },
  },
});

const koSmallWorkbench: MessageTree = mergeMessageTrees(enSmallWorkbench, {
  studyAgent: {
    header: {
      title: "연구 설계기",
      subtitle: "OHDSI StudyAgent 기반 AI 보조 연구 설계",
    },
    tabs: {
      intent: "연구 의도",
      search: "표현형 검색",
      recommend: "추천",
      lint: "코호트 린트",
    },
    intent: {
      title: "연구 설명",
      description:
        "연구에 대한 자연어 설명을 입력하세요. AI가 이를 대상 집단과 결과로 나눈 뒤 OHDSI 라이브러리에서 표현형을 추천합니다.",
      placeholder:
        "예: 제2형 당뇨병 성인에서 SGLT2 억제제를 처음 처방받은 환자와 DPP-4 억제제를 처음 처방받은 환자의 심부전 위험을 비교...",
      analyze: "연구 의도 분석",
      targetPopulation: "대상 집단",
      outcome: "결과",
    },
    recommendations: {
      title: "추천 표현형",
      score: "점수: {{value}}",
      loading: "표현형 추천을 찾는 중...",
      promptPrefix: "탭에 연구 의도를 입력하면",
      promptSuffix: "AI가 순위를 매긴 표현형 추천을 받을 수 있습니다.",
    },
    search: {
      title: "표현형 라이브러리 검색",
      placeholder: "표현형 검색(예: 제2형 당뇨병, 심부전, COPD)...",
      submit: "검색",
      resultsFound_one: "{{count}}개 결과",
      resultsFound_other: "{{count}}개 결과",
      noneFound: "표현형을 찾을 수 없습니다. 다른 검색어를 시도하세요.",
    },
    lint: {
      title: "코호트 정의 린트",
      description:
        "코호트 정의 JSON을 붙여 넣어 누락된 세척 기간, 빈 개념 집합, 역전된 시간 창과 같은 설계 문제를 확인하세요.",
      run: "린트 실행",
      noIssuesFound: "문제가 없습니다",
      issuesFound_one: "{{count}}개 문제 발견",
      issuesFound_other: "{{count}}개 문제 발견",
      failed: "린트 실패: JSON이 올바르지 않거나 서버 오류입니다.",
    },
  },
  phenotypeLibrary: {
    page: {
      title: "표현형 라이브러리",
      subtitle:
        "300개 이상의 큐레이션된 OHDSI 표현형 정의를 탐색, 필터링, 원클릭 가져오기",
      searchPlaceholder: "이름 또는 설명으로 표현형 검색...",
      allDomains: "모든 도메인",
      loading: "불러오는 중...",
      clearFilters: "필터 지우기",
      resultCount_one: "{{displayCount}}개 표현형",
      resultCount_other: "{{displayCount}}개 표현형",
      matchingFilters: "필터와 일치",
    },
    detail: {
      description: "설명",
      logic: "로직",
      noAdditionalDetails: "추가 세부 정보가 없습니다.",
    },
    stats: {
      totalPhenotypes: "전체 표현형",
      withExpression: "표현식 포함",
      domainsCovered: "포함된 도메인",
      imported: "가져옴",
    },
    table: {
      headers: {
        name: "이름",
        domain: "도메인",
        severity: "중증도",
        tags: "태그",
        action: "작업",
      },
      failedToLoad: "표현형 라이브러리를 불러오지 못했습니다.",
      empty: "표현형이 없습니다.",
      noTags: "태그 없음",
    },
    actions: {
      imported: "가져옴",
      import: "가져오기",
      importing: "가져오는 중...",
      noExpressionAvailable: "사용 가능한 표현식이 없습니다",
      importAsCohortDefinition: "코호트 정의로 가져오기",
    },
    pagination: {
      pageOf: "{{page}} / {{totalPages}} 페이지",
      previous: "이전",
      next: "다음",
    },
    domains: {
      condition: "질환",
      drug: "약물",
      measurement: "측정",
      procedure: "시술",
      observation: "관찰",
      device: "기기",
    },
    severities: {
      acute: "급성",
      chronic: "만성",
      subacute: "아급성",
    },
  },
  communityWorkbenchSdk: {
    page: {
      badge: "3단계 데모",
      title: "Community Workbench SDK 데모",
      subtitle:
        "이 샌드박스 페이지는 도메인별 로직이 연결되기 전 Parthenon 안에서 SDK 생성 도구가 어떻게 보이는지 보여 줍니다. 커뮤니티 개발자, 파트너 팀, AI 코딩 도우미를 위한 비프로덕션 참조 구현입니다.",
      backToWorkbench: "워크벤치로 돌아가기",
      openSdkDocs: "SDK 문서 열기",
      loading: "Parthenon 백엔드에서 데모 페이로드를 불러오는 중...",
      failed:
        "Community Workbench SDK 데모 페이로드를 백엔드에서 불러오지 못했습니다.",
    },
    serviceDescriptor: {
      title: "예시 서비스 설명자",
      description:
        "프런트엔드가 워크벤치 화면을 렌더링하기 전에 생성된 도구가 노출해야 하는 검색 및 가용성 메타데이터입니다.",
    },
    checklist: {
      title: "통합 점검 목록",
      step: "단계 {{index}}",
      items: {
        serviceRegistry: "{{path}}에 서비스 레지스트리 항목을 추가하세요.",
        toolModule: "{{path}}에 MCP 도구 모듈을 등록하세요.",
        backendController:
          "검증, 권한, 영속성을 위해 백엔드 컨트롤러와 워크벤치 서비스를 연결하세요.",
        frontendRoute:
          "프런트엔드 경로를 추가하고 임시 패널을 도메인별 렌더링으로 교체하세요.",
        validatePayloads:
          "릴리스 전에 실제 페이로드를 Community Workbench SDK 스키마로 검증하세요.",
      },
    },
    resultEnvelope: {
      title: "예시 결과 엔벌로프",
      description:
        "SDK 생성 도구는 더 풍부한 패널을 렌더링하기 전에 실행 진단, 소스 컨텍스트, 요약, 아티팩트를 이런 예측 가능한 엔벌로프로 정규화해야 합니다.",
    },
    artifacts: {
      title: "생성된 아티팩트 목록",
      descriptionPrefix: "이 데모는 저장소의 실제 생성 샘플 스캐폴드인",
      descriptionSuffix: "를 기반으로 합니다.",
    },
  },
  workbenchLauncher: {
    page: {
      title: "워크벤치",
      subtitle: "새로운 기능과 연구 도구 모음",
    },
    sections: {
      toolsetsTitle: "도구 모음",
      toolsetsSubtitle: "연구 질문에 맞는 워크벤치를 선택하세요.",
      recentTitle: "최근 조사",
      recentSubtitle: "최근 작업한 증거 조사입니다.",
    },
    states: {
      loadingInvestigations: "조사를 불러오는 중...",
      emptyInvestigations: "첫 번째 증거 조사를 시작하세요.",
    },
    actions: {
      createInvestigation: "조사 생성",
      newInvestigation: "새 조사",
    },
    footer: {
      prompt: "사용자 지정 도구 모음을 만들고 싶으신가요?",
      link: "Community SDK 참조 보기",
    },
    toolsetMeta: {
      morpheus: {
        name: "Morpheus",
        tagline: "입원 결과 및 ICU 분석 워크벤치",
        description:
          "OMOP CDM 5.4의 MIMIC-IV 데이터를 활용한 ICU 중심 분석입니다. ABCDEF Liberation Bundle 준수, 인공호흡기 이탈 예측, 진정 모니터링, 입원 결과 연구를 지원합니다.",
      },
      sdk: {
        name: "도구 모음 만들기",
        tagline: "서드파티 통합을 위한 Community SDK",
        description:
          "Parthenon Workbench에 연결되는 사용자 지정 도구 모음을 만들기 위한 참조 구현과 SDK 문서입니다. 서비스 설명자, 결과 엔벌로프, 아티팩트 패턴을 포함합니다.",
      },
    },
    toolsetStatus: {
      available: "사용 가능",
      comingSoon: "출시 예정",
      sdkRequired: "SDK 필요",
    },
    investigationStatus: {
      draft: "초안",
      active: "활성",
      complete: "완료",
      archived: "보관됨",
    },
  },
  etl: {
    toolsPage: {
      loadingProjects: "ETL 프로젝트를 불러오는 중...",
      createTitle: "ETL 매핑 프로젝트 생성",
      createDescription:
        "소스 스키마를 OMOP CDM에 매핑하기 시작하세요. 먼저 Source Profiler 탭으로 프로파일링된 소스를 선택해야 합니다.",
      cdmVersion: "CDM 버전",
      creating: "생성 중...",
      createProject: "프로젝트 생성",
      createFailed: "프로젝트 생성에 실패했습니다",
      emptyTitle: "Aqueduct ETL 매핑 디자이너",
      emptyDescription:
        '"Open in Aqueduct"를 클릭해 소스 스키마에서 OMOP CDM으로 ETL 매핑 설계를 시작하려면 수집 프로젝트로 이동하세요.',
    },
  },
});

const hiSmallWorkbench: MessageTree = mergeMessageTrees(enSmallWorkbench, {
  studyAgent: {
    header: {
      title: "स्टडी डिजाइनर",
      subtitle: "OHDSI StudyAgent द्वारा संचालित AI-सहायित अध्ययन डिजाइन",
    },
    tabs: {
      intent: "अध्ययन उद्देश्य",
      search: "फीनोटाइप खोज",
      recommend: "सिफारिशें",
      lint: "कोहोर्ट लिंट",
    },
    intent: {
      title: "अपने अध्ययन का वर्णन करें",
      description:
        "अपने अध्ययन का प्राकृतिक भाषा में विवरण दर्ज करें। AI इसे लक्षित आबादी और परिणाम में विभाजित करेगी, फिर OHDSI लाइब्रेरी से फीनोटाइप सुझाएगी।",
      placeholder:
        "उदा., टाइप 2 डायबिटीज वाले वयस्कों में SGLT2 inhibitors बनाम DPP-4 inhibitors पहली बार लेने वाले रोगियों में हृदय विफलता के जोखिम की तुलना करें...",
      analyze: "अध्ययन उद्देश्य का विश्लेषण करें",
      targetPopulation: "लक्षित आबादी",
      outcome: "परिणाम",
    },
    recommendations: {
      title: "अनुशंसित फीनोटाइप",
      score: "स्कोर: {{value}}",
      loading: "फीनोटाइप सिफारिशें खोजी जा रही हैं...",
      promptPrefix: "टैब में अध्ययन उद्देश्य दर्ज करें",
      promptSuffix: "ताकि AI-रैंक की गई फीनोटाइप सिफारिशें मिल सकें।",
    },
    search: {
      title: "फीनोटाइप लाइब्रेरी खोजें",
      placeholder:
        "फीनोटाइप खोजें (उदा., टाइप 2 डायबिटीज, हृदय विफलता, COPD)...",
      submit: "खोजें",
      resultsFound_one: "{{count}} परिणाम मिला",
      resultsFound_other: "{{count}} परिणाम मिले",
      noneFound: "कोई फीनोटाइप नहीं मिला। कोई अन्य खोज शब्द आजमाएं।",
    },
    lint: {
      title: "कोहोर्ट परिभाषा लिंट करें",
      description:
        "गायब washout periods, खाली concept sets, और उलटी time windows जैसी design issues की जांच के लिए cohort definition JSON पेस्ट करें।",
      run: "लिंट चलाएं",
      noIssuesFound: "कोई समस्या नहीं मिली",
      issuesFound_one: "{{count}} समस्या मिली",
      issuesFound_other: "{{count}} समस्याएं मिलीं",
      failed: "लिंट विफल: अमान्य JSON या सर्वर त्रुटि।",
    },
  },
  phenotypeLibrary: {
    page: {
      title: "फीनोटाइप लाइब्रेरी",
      subtitle:
        "300+ curated OHDSI phenotype definitions - ब्राउज़ करें, फिल्टर करें, और एक क्लिक में आयात करें",
      searchPlaceholder: "नाम या विवरण से फीनोटाइप खोजें...",
      allDomains: "सभी डोमेन",
      loading: "लोड हो रहा है...",
      clearFilters: "फिल्टर साफ करें",
      resultCount_one: "{{displayCount}} फीनोटाइप",
      resultCount_other: "{{displayCount}} फीनोटाइप",
      matchingFilters: "मेल खाते फिल्टर",
    },
    detail: {
      description: "विवरण",
      logic: "तर्क",
      noAdditionalDetails: "कोई अतिरिक्त विवरण उपलब्ध नहीं है।",
    },
    stats: {
      totalPhenotypes: "कुल फीनोटाइप",
      withExpression: "अभिव्यक्ति सहित",
      domainsCovered: "कवर्ड डोमेन",
      imported: "आयातित",
    },
    table: {
      headers: {
        name: "नाम",
        domain: "डोमेन",
        severity: "गंभीरता",
        tags: "टैग",
        action: "क्रिया",
      },
      failedToLoad: "फीनोटाइप लाइब्रेरी लोड नहीं हो सकी।",
      empty: "कोई फीनोटाइप नहीं मिला।",
      noTags: "कोई टैग नहीं",
    },
    actions: {
      imported: "आयातित",
      import: "आयात करें",
      importing: "आयात किया जा रहा है...",
      noExpressionAvailable: "कोई expression उपलब्ध नहीं है",
      importAsCohortDefinition: "कोहोर्ट परिभाषा के रूप में आयात करें",
    },
    pagination: {
      pageOf: "पृष्ठ {{page}} / {{totalPages}}",
      previous: "पिछला",
      next: "अगला",
    },
    domains: {
      condition: "कंडीशन",
      drug: "दवा",
      measurement: "मापन",
      procedure: "प्रक्रिया",
      observation: "ऑब्जर्वेशन",
      device: "डिवाइस",
    },
    severities: {
      acute: "तीव्र",
      chronic: "दीर्घकालिक",
      subacute: "उपतीव्र",
    },
  },
  communityWorkbenchSdk: {
    page: {
      badge: "फेज 3 डेमो",
      title: "Community Workbench SDK डेमो",
      subtitle:
        "यह sandbox page दिखाता है कि domain-specific logic जुड़ने से पहले SDK-generated tool Parthenon के अंदर कैसा दिखता है। यह community developers, partner teams, और AI coding assistants के लिए non-production reference implementation है।",
      backToWorkbench: "Workbench पर वापस जाएं",
      openSdkDocs: "SDK दस्तावेज़ खोलें",
      loading: "Parthenon backend से demo payload लोड हो रही है...",
      failed:
        "Community Workbench SDK demo payload backend से लोड नहीं हो सकी।",
    },
    serviceDescriptor: {
      title: "नमूना सेवा विवरणक",
      description:
        "यह discovery और availability metadata है जिसे generated tool को frontend द्वारा workbench surface render करने से पहले expose करना चाहिए।",
    },
    checklist: {
      title: "एकीकरण चेकलिस्ट",
      step: "चरण {{index}}",
      items: {
        serviceRegistry: "{{path}} में service registry entry जोड़ें।",
        toolModule: "{{path}} में MCP tool module पंजीकृत करें।",
        backendController:
          "validation, permissions, और persistence के लिए backend controller और workbench service जोड़ें।",
        frontendRoute:
          "frontend route जोड़ें और placeholder panels को domain-specific rendering से बदलें।",
        validatePayloads:
          "release से पहले वास्तविक payloads को Community Workbench SDK schemas के विरुद्ध validate करें।",
      },
    },
    resultEnvelope: {
      title: "नमूना परिणाम एनवेलप",
      description:
        "SDK-generated tools को richer panels render करने से पहले runtime diagnostics, source context, summary, और artifacts को ऐसे predictable envelope में normalize करना चाहिए।",
    },
    artifacts: {
      title: "जनरेटेड आर्टिफैक्ट सूची",
      descriptionPrefix:
        "यह डेमो repository में मौजूद वास्तविक generated sample scaffold पर आधारित है:",
      descriptionSuffix: "",
    },
  },
  workbenchLauncher: {
    page: {
      title: "Workbench",
      subtitle: "नई क्षमताएं और शोध toolsets",
    },
    sections: {
      toolsetsTitle: "टूलसेट",
      toolsetsSubtitle: "अपने शोध प्रश्न के अनुरूप workbench चुनें।",
      recentTitle: "हाल की जांचें",
      recentSubtitle:
        "वे evidence investigations जिन पर आपने हाल ही में काम किया है।",
    },
    states: {
      loadingInvestigations: "जांचें लोड हो रही हैं...",
      emptyInvestigations: "अपनी पहली Evidence Investigation शुरू करें।",
    },
    actions: {
      createInvestigation: "जांच बनाएं",
      newInvestigation: "नई जांच",
    },
    footer: {
      prompt: "क्या आप एक कस्टम toolset बनाना चाहते हैं?",
      link: "Community SDK reference देखें",
    },
    toolsetMeta: {
      morpheus: {
        name: "Morpheus",
        tagline: "इनपेशेंट परिणाम और ICU analytics workbench",
        description:
          "OMOP CDM 5.4 में MIMIC-IV डेटा का उपयोग करने वाला ICU-केंद्रित analytics workbench. ABCDEF Liberation Bundle compliance, ventilator weaning prediction, sedation monitoring, और inpatient outcome research को समर्थन देता है।",
      },
      sdk: {
        name: "Toolset बनाएं",
        tagline: "थर्ड-पार्टी integrations के लिए Community SDK",
        description:
          "Parthenon Workbench में जुड़ने वाले custom toolsets बनाने के लिए reference implementation और SDK documentation. Service descriptors, result envelopes, और artifact patterns शामिल हैं।",
      },
    },
    toolsetStatus: {
      available: "उपलब्ध",
      comingSoon: "जल्द आ रहा है",
      sdkRequired: "SDK आवश्यक",
    },
    investigationStatus: {
      draft: "मसौदा",
      active: "सक्रिय",
      complete: "पूर्ण",
      archived: "संग्रहित",
    },
  },
  etl: {
    toolsPage: {
      loadingProjects: "ETL projects लोड हो रहे हैं...",
      createTitle: "ETL mapping project बनाएं",
      createDescription:
        "अपने source schema को OMOP CDM से map करना शुरू करें। पहले Source Profiler tab के माध्यम से profiled source चुनें।",
      cdmVersion: "CDM संस्करण",
      creating: "बनाया जा रहा है...",
      createProject: "प्रोजेक्ट बनाएं",
      createFailed: "प्रोजेक्ट नहीं बन सका",
      emptyTitle: "Aqueduct ETL मैपिंग डिज़ाइनर",
      emptyDescription:
        'अपने ingestion project पर जाएं और source schema से OMOP CDM तक ETL mappings डिजाइन करना शुरू करने के लिए "Open in Aqueduct" पर क्लिक करें।',
    },
  },
});

export const smallWorkbenchResources: Record<string, MessageTree> = {
  "en-US": enSmallWorkbench,
  "es-ES": esSmallWorkbench,
  "fr-FR": frSmallWorkbench,
  "de-DE": deSmallWorkbench,
  "pt-BR": ptSmallWorkbench,
  "fi-FI": mergeMessageTrees(enSmallWorkbench, {
    studyAgent: {
      header: {
        title: "Opintosuunnittelija",
        subtitle: "AI-avustettu opintosuunnittelu OHDSI StudyAgentin avulla",
      },
      tabs: {
        intent: "Tutkimuksen tarkoitus",
        search: "Fenotyyppihaku",
        recommend: "Suositukset",
        lint: "Kohortti Lint",
      },
      intent: {
        title: "Kuvaile tutkimustasi",
        description:
          "Kirjoita tutkimuksesi luonnollisen kielen kuvaus. AI jakaa sen kohdepopulaatioon ja tulokseen ja suosittelee sitten fenotyyppejä OHDSI-kirjastosta.",
        placeholder:
          "Vertaa esimerkiksi sydämen vajaatoiminnan riskiä potilailla, joille on määrätty äskettäin SGLT2-estäjiä ja DPP-4-estäjiä tyypin 2 diabetesta sairastavilla aikuisilla...",
        analyze: "Analysoi tutkimuksen tarkoitus",
        targetPopulation: "Kohdeväestö",
        outcome: "Tulokset",
      },
      recommendations: {
        title: "Suositellut fenotyypit",
        loading: "Haetaan fenotyyppisuosituksia...",
        promptPrefix: "Kirjoita opiskeluaihe",
        promptSuffix:
          "-välilehti saadaksesi AI-sijoituksen fenotyyppisuosituksia.",
      },
      search: {
        title: "Hae fenotyyppikirjastosta",
        placeholder:
          "Etsi fenotyyppejä (esim. tyypin 2 diabetes, sydämen vajaatoiminta, COPD)...",
        submit: "Haku",
        noneFound: "Fenotyyppejä ei löytynyt. Kokeile toista hakutermiä.",
      },
      lint: {
        title: "Lint-kohortin määritelmä",
        description:
          "Liitä kohortin määritelmä JSON tarkistaaksesi suunnitteluongelmia, kuten puuttuvia pesujaksoja, tyhjiä konseptijoukkoja ja käänteisiä aikaikkunoita.",
        run: "Suorita Lint",
        noIssuesFound: "Ei ongelmia",
        failed: "Nukkaaminen epäonnistui: Virheellinen JSON tai palvelinvirhe.",
      },
    },
    phenotypeLibrary: {
      page: {
        title: "Fenotyyppikirjasto",
        subtitle:
          "Yli 300 kuratoitua OHDSI fenotyyppimääritelmää - selaa, suodata ja tuo yhdellä napsautuksella",
        allDomains: "Kaikki verkkotunnukset",
        loading: "Ladataan...",
        clearFilters: "Selkeät suodattimet",
        matchingFilters: "vastaavat suodattimet",
      },
      detail: {
        description: "Kuvaus",
        logic: "Logiikka",
        noAdditionalDetails: "Lisätietoja ei ole saatavilla.",
      },
      stats: {
        totalPhenotypes: "Fenotyyppejä yhteensä",
        withExpression: "Expressionin kanssa",
        domainsCovered: "Katetut verkkotunnukset",
        imported: "Tuotu",
      },
      table: {
        headers: {
          name: "Nimi",
          domain: "Verkkotunnus",
          severity: "Vakavuus",
          tags: "Tunnisteet",
          action: "Toiminta",
        },
        failedToLoad: "Fenotyyppikirjaston lataaminen epäonnistui.",
        empty: "Fenotyyppejä ei löytynyt.",
        noTags: "ei tunnisteita",
      },
      actions: {
        imported: "Tuotu",
        import: "Tuoda",
        importing: "Tuodaan...",
        noExpressionAvailable: "Ilmaisua ei ole saatavilla",
        importAsCohortDefinition: "Tuo kohortin määritelmänä",
      },
      pagination: {
        previous: "Edellinen",
        next: "Seuraavaksi",
      },
      domains: {
        condition: "Kunto",
        drug: "huume",
        measurement: "Mittaus",
        procedure: "Menettely",
        observation: "Havainto",
        device: "Laite",
      },
      severities: {
        acute: "Akuutti",
        chronic: "Krooninen",
        subacute: "Subakuutti",
      },
    },
    communityWorkbenchSdk: {
      page: {
        badge: "Vaihe 3 demo",
        title: "Community Workbench SDK -demo",
        subtitle:
          "Tämä hiekkalaatikkosivu näyttää, miltä SDK:n luoma työkalu näyttää Parthenon sisällä, ennen kuin verkkotunnuskohtainen logiikka on kytketty. Se on ei-tuotannon viitetoteutus yhteisön kehittäjille, kumppanitiimeille ja AI koodausavustajille.",
        backToWorkbench: "Takaisin työpöytään",
        openSdkDocs: "Avaa SDK Docs",
        loading:
          "Ladataan demon hyötykuormaa Parthenon taustajärjestelmästä...",
        failed:
          "Community Workbench SDK:n demohyötykuormaa ei voitu ladata taustajärjestelmästä.",
      },
      serviceDescriptor: {
        title: "Esimerkki palvelukuvauksesta",
        description:
          "Nämä ovat löydön ja saatavuuden metatiedot, jotka luodun työkalun tulee paljastaa ennen kuin käyttöliittymä renderöi työpöydän pinnan.",
      },
      checklist: {
        title: "Integraation tarkistuslista",
        items: {
          backendController:
            "Kytke taustaohjain ja työpöytäpalvelu validointia, käyttöoikeuksia ja pysyvyyttä varten.",
          frontendRoute:
            "Lisää käyttöliittymäreitti ja korvaa paikkamerkkipaneelit verkkotunnuskohtaisella renderöinnillä.",
          validatePayloads:
            "Tarkista todelliset hyötykuormat Community Workbench SDK -malleihin ennen julkaisua.",
        },
      },
      resultEnvelope: {
        title: "Näytetulosten kirjekuori",
        description:
          "SDK:n luomien työkalujen tulee normalisoida ajonaikaiset diagnostiikkansa, lähdekontekstinsa, yhteenvetonsa ja artefaktinsa tällaiseen ennustettavaan kirjekuoreen ennen monipuolisempien paneelien hahmontamista.",
      },
      artifacts: {
        title: "Luotu artefaktiluettelo",
        descriptionPrefix:
          "Tätä demoa tukee todellinen luotu näyteteline osoitteessa",
        descriptionSuffix: "arkistossa.",
      },
    },
    workbenchLauncher: {
      page: {
        title: "Työtila",
        subtitle: "Uudet ominaisuudet ja tutkimustyökalut",
      },
      sections: {
        toolsetsTitle: "Työkalusarjat",
        toolsetsSubtitle: "Valitse tutkimuskysymykseesi sopiva työpöytä.",
        recentTitle: "Viimeaikaiset tutkimukset",
        recentSubtitle:
          "Todistustutkimukset, joiden parissa olet työskennellyt äskettäin.",
      },
      states: {
        loadingInvestigations: "Ladataan tutkimuksia...",
        emptyInvestigations: "Aloita ensimmäinen todisteiden tutkinta.",
      },
      actions: {
        createInvestigation: "Luo tutkinta",
        newInvestigation: "Uusi tutkinta",
      },
      footer: {
        prompt: "Haluatko rakentaa mukautetun työkalusarjan?",
        link: "Katso yhteisön SDK-viite",
      },
      toolsetMeta: {
        morpheus: {
          tagline:
            "Potilaspotilaiden tulokset ja teho-osaston analytiikan työpöytä",
          description:
            "ICU-keskeinen analytiikka hyödyntää MIMIC-IV-tietoja OMOP CDM 5.4:ssä. ABCDEF Liberation Bundle -yhteensopivuus, hengityslaitteen vieroittamisen ennustaminen, sedaation seuranta ja potilastulostutkimus.",
        },
        sdk: {
          name: "Rakenna työkalusarja",
          tagline: "Yhteisön SDK kolmansien osapuolien integraatioita varten",
          description:
            "Viitetoteutus ja SDK-dokumentaatio Parthenon Workbenchiin liitettävien räätälöityjen työkalusarjojen rakentamiseen. Palvelukuvaukset, tuloskuoret ja artefaktimallit.",
        },
      },
      toolsetStatus: {
        available: "Saatavilla",
        comingSoon: "Tulossa pian",
        sdkRequired: "SDK vaaditaan",
      },
      investigationStatus: {
        draft: "Luonnos",
        active: "Aktiivinen",
        complete: "Täydellinen",
        archived: "Arkistoitu",
      },
    },
    etl: {
      toolsPage: {
        loadingProjects: "Ladataan ETL-projekteja...",
        createTitle: "Luo ETL-kartoitusprojekti",
        createDescription:
          "Aloita lähdekaavion yhdistäminen OMOP CDM:ään. Valitse ensin lähde, joka on profiloitu Lähdeprofiili-välilehden kautta.",
        cdmVersion: "CDM versio",
        creating: "Luodaan...",
        createProject: "Luo projekti",
        createFailed: "Projektin luominen epäonnistui",
        emptyTitle: "Aqueduct ETL-kartoitussuunnittelija",
        emptyDescription:
          'Siirry sisäänottoprojektiin ja napsauta "Avaa akveduktissa" aloittaaksesi ETL-kartoitusten suunnittelun lähdeskeemasi OMOP CDM:ään.',
      },
    },
  }),
  "ja-JP": mergeMessageTrees(enSmallWorkbench, {
    studyAgent: {
      header: {
        title: "スタディデザイナー",
        subtitle: "OHDSI StudyAgent を活用した AI 支援の研究設計",
      },
      tabs: {
        intent: "研究の意図",
        search: "表現型検索",
        recommend: "推奨事項",
        lint: "コホート糸くず",
      },
      intent: {
        title: "研究について説明してください",
        description:
          "研究についての自然言語による説明を入力します。 AI はターゲット集団と結果に分割し、次に OHDSI ライブラリから表現型を推奨します。",
        placeholder:
          "例: 2 型糖尿病の成人において、新たに SGLT2 阻害剤を処方された患者と DPP-4 阻害剤を処方された患者の心不全のリスクを比較します...",
        analyze: "研究意図を分析する",
        targetPopulation: "対象者",
        outcome: "結果",
      },
      recommendations: {
        title: "推奨表現型",
        loading: "表現型に関する推奨事項を探しています...",
        promptPrefix: "に研究の意図を入力します。",
        promptSuffix:
          "タブをクリックして、AI ランクの表現型の推奨事項を取得します。",
      },
      search: {
        title: "表現型ライブラリを検索",
        placeholder: "表現型の検索 (例: 2 型糖尿病、心不全、COPD)...",
        submit: "検索",
        noneFound: "表現型は見つかりませんでした。別の検索語を試してください。",
      },
      lint: {
        title: "糸くずコホートの定義",
        description:
          "コホート定義 JSON を貼り付けて、ウォッシュアウト期間の欠落、空のコンセプト セット、反転した時間枠などの設計上の問題をチェックします。",
        run: "リントを実行する",
        noIssuesFound: "問題は見つかりませんでした",
        failed: "lint に失敗しました: 無効な JSON またはサーバー エラー。",
      },
    },
    phenotypeLibrary: {
      page: {
        title: "表現型ライブラリ",
        subtitle:
          "300 以上の精選された OHDSI 表現型定義 - ワンクリックで参照、フィルター、インポート",
        allDomains: "すべてのドメイン",
        loading: "読み込み中...",
        clearFilters: "フィルターをクリアする",
        matchingFilters: "マッチングフィルター",
      },
      detail: {
        description: "説明",
        logic: "論理",
        noAdditionalDetails: "追加の詳細はありません。",
      },
      stats: {
        totalPhenotypes: "表現型の総数",
        withExpression: "表情あり",
        domainsCovered: "対象となるドメイン",
        imported: "輸入品",
      },
      table: {
        headers: {
          name: "名前",
          domain: "ドメイン",
          severity: "重大度",
          tags: "タグ",
          action: "アクション",
        },
        failedToLoad: "表現型ライブラリのロードに失敗しました。",
        empty: "表現型は見つかりませんでした。",
        noTags: "タグなし",
      },
      actions: {
        imported: "輸入品",
        import: "輸入",
        importing: "インポート中...",
        noExpressionAvailable: "使用できる式がありません",
        importAsCohortDefinition: "コホート定義としてインポート",
      },
      pagination: {
        previous: "前の",
        next: "次",
      },
      domains: {
        condition: "状態",
        drug: "薬",
        measurement: "測定",
        procedure: "手順",
        observation: "観察",
        device: "デバイス",
      },
      severities: {
        acute: "急性",
        chronic: "慢性",
        subacute: "亜急性",
      },
    },
    communityWorkbenchSdk: {
      page: {
        badge: "フェーズ 3 デモ",
        title: "コミュニティ ワークベンチ SDK デモ",
        subtitle:
          "このサンドボックス ページには、ドメイン固有のロジックが組み込まれる前の Parthenon 内部で SDK で生成されたツールがどのように見えるかを示します。これは、コミュニティ開発者、パートナー チーム、および AI コーディング アシスタント向けの非本番リファレンス実装です。",
        backToWorkbench: "ワークベンチに戻る",
        openSdkDocs: "SDK ドキュメントを開く",
        loading:
          "Parthenon バックエンドからデモ ペイロードをロードしています...",
        failed:
          "Community Workbench SDK デモ ペイロードをバックエンドからロードできませんでした。",
      },
      serviceDescriptor: {
        title: "サンプルサービス記述子",
        description:
          "これは、フロントエンドがワークベンチ サーフェスをレンダリングする前に、生成されたツールが公開する必要がある検出および可用性メタデータです。",
      },
      checklist: {
        title: "統合チェックリスト",
        items: {
          backendController:
            "検証、権限、永続性のためにバックエンド コントローラーとワークベンチ サービスを接続します。",
          frontendRoute:
            "フロントエンド ルートを追加し、プレースホルダー パネルをドメイン固有のレンダリングに置き換えます。",
          validatePayloads:
            "リリース前に、Community Workbench SDK スキーマに対して実際のペイロードを検証します。",
        },
      },
      resultEnvelope: {
        title: "結果エンベロープのサンプル",
        description:
          "SDK で生成されたツールは、より豊富なパネルをレンダリングする前に、ランタイム診断、ソース コンテキスト、概要、アーティファクトをこのような予測可能なエンベロープに正規化する必要があります。",
      },
      artifacts: {
        title: "生成されたアーティファクトインベントリ",
        descriptionPrefix:
          "このデモは、実際に生成されたサンプル スキャフォールドによって裏付けられています。",
        descriptionSuffix: "リポジトリ内。",
      },
    },
    workbenchLauncher: {
      page: {
        title: "エスパシオ デ トラバホ",
        subtitle: "斬新な機能と研究ツールセット",
      },
      sections: {
        toolsetsTitle: "ツールセット",
        toolsetsSubtitle: "研究課題に合ったワークベンチを選択してください。",
        recentTitle: "最近の調査",
        recentSubtitle: "最近取り組んだ証拠調査。",
      },
      states: {
        loadingInvestigations: "調査を読み込んでいます...",
        emptyInvestigations: "最初の証拠調査を開始します。",
      },
      actions: {
        createInvestigation: "調査の作成",
        newInvestigation: "新たな調査",
      },
      footer: {
        prompt: "カスタム ツールセットを構築したいですか?",
        link: "コミュニティ SDK リファレンスを表示する",
      },
      toolsetMeta: {
        morpheus: {
          tagline: "入院患者の転帰と ICU 分析ワークベンチ",
          description:
            "OMOP CDM 5.4 の MIMIC-IV データを活用した ICU に重点を置いた分析。 ABCDEF Liberation Bundle への準拠、人工呼吸器離脱予測、鎮静モニタリング、入院患者の転帰研究。",
        },
        sdk: {
          name: "ツールセットを構築する",
          tagline: "サードパーティ統合用のコミュニティ SDK",
          description:
            "Parthenon ワークベンチにプラグインするカスタム ツールセットを構築するためのリファレンス実装および SDK ドキュメント。サービス記述子、結果エンベロープ、およびアーティファクト パターン。",
        },
      },
      toolsetStatus: {
        available: "利用可能",
        comingSoon: "近日公開",
        sdkRequired: "SDKが必要です",
      },
      investigationStatus: {
        draft: "下書き",
        active: "アクティブ",
        complete: "完了",
        archived: "アーカイブ済み",
      },
    },
    etl: {
      toolsPage: {
        loadingProjects: "ETL プロジェクトをロードしています...",
        createTitle: "ETLマッピングプロジェクトの作成",
        createDescription:
          "ソーススキーマの OMOP CDM へのマッピングを開始します。まず、[ソース プロファイラー] タブでプロファイリングされたソースを選択します。",
        cdmVersion: "CDM バージョン",
        creating: "作成...",
        createProject: "プロジェクトの作成",
        createFailed: "プロジェクトの作成に失敗しました",
        emptyTitle: "Aqueduct ETL マッピング デザイナー",
        emptyDescription:
          "取り込みプロジェクトに移動し、「Aqueduct で開く」をクリックして、ソーススキーマから OMOP CDM への ETL マッピングの設計を開始します。",
      },
    },
  }),
  "zh-Hans": mergeMessageTrees(enSmallWorkbench, {
    studyAgent: {
      header: {
        title: "研究设计师",
        subtitle: "由 OHDSI StudyAgent 提供支持的 AI 辅助研究设计",
      },
      tabs: {
        intent: "学习意向",
        search: "表型搜索",
        recommend: "建议",
        lint: "队列林特",
      },
      intent: {
        title: "描述你的研究",
        description:
          "输入您的研究的自然语言描述。 AI 将其分为目标人群和结果，然后从 OHDSI 库中推荐表型。",
        placeholder:
          "例如，比较成人 2 型糖尿病患者新开 SGLT2 抑制剂与 DPP-4 抑制剂的心力衰竭风险......",
        analyze: "分析学习意图",
        targetPopulation: "目标人群",
        outcome: "结果",
      },
      recommendations: {
        title: "推荐表型",
        loading: "寻找表型推荐...",
        promptPrefix: "输入研究意向",
        promptSuffix: "选项卡以获得 AI 排名的表型推荐。",
      },
      search: {
        title: "搜索表型库",
        placeholder: "搜索表型（例如 2 型糖尿病、心力衰竭、慢性阻塞性肺病）...",
        submit: "搜索",
        noneFound: "未发现表型。尝试不同的搜索词。",
      },
      lint: {
        title: "Lint 队列定义",
        description:
          "粘贴群组定义 JSON 以检查设计问题，例如缺少清洗期、空概念集和倒置时间窗口。",
        run: "运行 Lint",
        noIssuesFound: "没有发现问题",
        failed: "无法检查：无效 JSON 或服务器错误。",
      },
    },
    phenotypeLibrary: {
      page: {
        title: "表型库",
        subtitle: "300 多个精心策划的 OHDSI 表型定义 - 一键浏览、过滤和导入",
        allDomains: "所有域名",
        loading: "加载中...",
        clearFilters: "清除过滤器",
        matchingFilters: "匹配过滤器",
      },
      detail: {
        description: "描述",
        logic: "逻辑",
        noAdditionalDetails: "没有更多详细信息。",
      },
      stats: {
        totalPhenotypes: "表型总数",
        withExpression: "有表情",
        domainsCovered: "涵盖的领域",
        imported: "进口",
      },
      table: {
        headers: {
          name: "姓名",
          domain: "领域",
          severity: "严重性",
          tags: "标签",
          action: "行动",
        },
        failedToLoad: "加载表型库失败。",
        empty: "未发现表型。",
        noTags: "没有标签",
      },
      actions: {
        imported: "进口",
        import: "进口",
        importing: "输入...",
        noExpressionAvailable: "没有可用的表达",
        importAsCohortDefinition: "作为群组定义导入",
      },
      pagination: {
        previous: "以前的",
        next: "下一个",
      },
      domains: {
        condition: "健康）状况",
        drug: "药品",
        measurement: "测量",
        procedure: "程序",
        observation: "观察",
        device: "设备",
      },
      severities: {
        acute: "急性",
        chronic: "慢性的",
        subacute: "亚急性",
      },
    },
    communityWorkbenchSdk: {
      page: {
        badge: "第三阶段演示",
        title: "社区工作台 SDK 演示",
        subtitle:
          "此沙盒页面显示了在连接特定于域的逻辑之前，SDK 生成的工具在 Parthenon 中的样子。它是面向社区开发人员、合作伙伴团队和 AI 编码助理的非生产参考实现。",
        backToWorkbench: "返回工作台",
        openSdkDocs: "打开SDK文档",
        loading: "正在从 Parthenon 后端加载演示有效负载...",
        failed: "无法从后端加载 Community Workbench SDK 演示负载。",
      },
      serviceDescriptor: {
        title: "示例服务描述符",
        description:
          "这是生成的工具在前端呈现工作台表面之前应公开的发现和可用性元数据。",
      },
      checklist: {
        title: "集成清单",
        items: {
          backendController:
            "连接后端控制器和工作台服务以进行验证、权限和持久性。",
          frontendRoute: "添加前端路由并用特定于域的渲染替换占位符面板。",
          validatePayloads: "在发布之前根据社区工作台 SDK 架构验证真实负载。",
        },
      },
      resultEnvelope: {
        title: "结果信封样本",
        description:
          "SDK 生成的工具应在渲染更丰富的面板之前将其运行时诊断、源上下文、摘要和工件标准化为可预测的信封。",
      },
      artifacts: {
        title: "生成的工件清单",
        descriptionPrefix: "该演示由真实生成的示例支架支持，网址为",
        descriptionSuffix: "在存储库中。",
      },
    },
    workbenchLauncher: {
      page: {
        title: "劳动空间",
        subtitle: "新颖的功能和研究工具集",
      },
      sections: {
        toolsetsTitle: "工具集",
        toolsetsSubtitle: "选择适合您的研究问题的工作台。",
        recentTitle: "最近的调查",
        recentSubtitle: "您最近进行的证据调查。",
      },
      states: {
        loadingInvestigations: "正在加载调查...",
        emptyInvestigations: "开始你的第一次证据调查。",
      },
      actions: {
        createInvestigation: "创建调查",
        newInvestigation: "新调查",
      },
      footer: {
        prompt: "想要构建自定义工具集？",
        link: "查看社区 SDK 参考",
      },
      toolsetMeta: {
        morpheus: {
          tagline: "住院结果和 ICU 分析工作台",
          description:
            "利用 OMOP CDM 5.4 中的 MIMIC-IV 数据进行以 ICU 为中心的分析。 ABCDEF Liberation Bundle 依从性、呼吸机脱机预测、镇静监测和住院结果研究。",
        },
        sdk: {
          name: "构建工具集",
          tagline: "用于第三方集成的社区 SDK",
          description:
            "用于构建插入 Parthenon 工作台的自定义工具集的参考实现和 SDK 文档。服务描述符、结果包络和工件模式。",
        },
      },
      toolsetStatus: {
        available: "可用的",
        comingSoon: "即将推出",
        sdkRequired: "需要SDK",
      },
      investigationStatus: {
        draft: "草稿",
        active: "积极的",
        complete: "完全的",
        archived: "已存档",
      },
    },
    etl: {
      toolsPage: {
        loadingProjects: "正在加载 ETL 项目...",
        createTitle: "创建 ETL 映射项目",
        createDescription:
          "开始将源模式映射到 OMOP CDM。首先选择已通过“源分析器”选项卡分析的源。",
        cdmVersion: "清洁发展机制版本",
        creating: "创造...",
        createProject: "创建项目",
        createFailed: "创建项目失败",
        emptyTitle: "Aqueduct ETL 绘图设计器",
        emptyDescription:
          "导航到摄取项目并单击“在 Aqueduct 中打开”开始设计从源模式到 OMOP CDM 的 ETL 映射。",
      },
    },
  }),
  "ko-KR": koSmallWorkbench,
  "hi-IN": hiSmallWorkbench,
  ar: mergeMessageTrees(enSmallWorkbench, {}),
  "en-XA": mergeMessageTrees(enSmallWorkbench, {}),
};
