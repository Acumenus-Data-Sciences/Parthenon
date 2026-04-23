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
      subtitle:
        "Conception d'etude assistee par IA avec OHDSI StudyAgent",
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
      noneFound:
        "Aucun phenotype trouve. Essayez un autre terme de recherche.",
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
      loading: "Chargement de la charge utile de demo depuis le backend Parthenon...",
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
        'Accedez a un projet d\'ingestion et cliquez sur "Open in Aqueduct" pour commencer a concevoir les mappages ETL entre votre schema source et l\'OMOP CDM.',
    },
  },
});

const deSmallWorkbench: MessageTree = mergeMessageTrees(enSmallWorkbench, {
  studyAgent: {
    header: {
      title: "Studien-Designer",
      subtitle:
        "KI-gestutztes Studiendesign mit OHDSI StudyAgent",
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
      promptSuffix:
        "ein, um KI-gerankte Phaenotypempfehlungen zu erhalten.",
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
        tagline:
          "Workbench fuer stationaere Ergebnisse und ICU-Analytik",
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
      subtitle:
        "Desenho de estudo assistido por IA com OHDSI StudyAgent",
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
      promptSuffix:
        "para obter recomendacoes de fenotipos ranqueadas por IA.",
    },
    search: {
      title: "Buscar na biblioteca de fenotipos",
      placeholder:
        "Buscar fenotipos (ex.: diabetes tipo 2, insuficiencia cardiaca, DPOC)...",
      submit: "Buscar",
      resultsFound_one: "{{count}} resultado encontrado",
      resultsFound_other: "{{count}} resultados encontrados",
      noneFound:
        "Nenhum fenotipo encontrado. Tente outro termo de busca.",
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
        tagline:
          "Workbench de desfechos hospitalares e analitica de UTI",
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
      loading: "Cargando la carga de demostracion desde el backend de Parthenon...",
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
        toolModule:
          "Registre el modulo de herramienta MCP en {{path}}.",
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
      subtitle: "Nuevas capacidades y conjuntos de herramientas de investigacion",
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
      placeholder:
        "표현형 검색(예: 제2형 당뇨병, 심부전, COPD)...",
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
        serviceRegistry:
          "{{path}}에 서비스 레지스트리 항목을 추가하세요.",
        toolModule:
          "{{path}}에 MCP 도구 모듈을 등록하세요.",
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
      descriptionPrefix:
        "이 데모는 저장소의 실제 생성 샘플 스캐폴드인",
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
      promptSuffix:
        "ताकि AI-रैंक की गई फीनोटाइप सिफारिशें मिल सकें।",
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
        serviceRegistry:
          "{{path}} में service registry entry जोड़ें।",
        toolModule:
          "{{path}} में MCP tool module पंजीकृत करें।",
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
      recentSubtitle: "वे evidence investigations जिन पर आपने हाल ही में काम किया है।",
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
  "fi-FI": mergeMessageTrees(enSmallWorkbench, {}),
  "ja-JP": mergeMessageTrees(enSmallWorkbench, {}),
  "zh-Hans": mergeMessageTrees(enSmallWorkbench, {}),
  "ko-KR": koSmallWorkbench,
  "hi-IN": hiSmallWorkbench,
  ar: mergeMessageTrees(enSmallWorkbench, {}),
  "en-XA": mergeMessageTrees(enSmallWorkbench, {}),
};
