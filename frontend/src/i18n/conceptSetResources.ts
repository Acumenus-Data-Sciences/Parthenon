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

const enConceptSet: MessageTree = {
  conceptSets: {
    page: {
      title: "Concept Sets",
      subtitle:
        "Define and manage reusable concept sets for cohort definitions and analyses",
      searchPlaceholder: "Search concept sets...",
      untitledName: "Untitled Concept Set",
      newConceptSet: "New Concept Set",
      fromBundle: "From Bundle",
      import: "Import",
    },
    list: {
      failedToLoad: "Failed to load concept sets",
      emptyTitle: "No concept sets",
      emptyMessage:
        "Create your first concept set to start building definitions.",
      noMatchingTitle: "No matching concept sets",
      noMatchingMessage: "Try adjusting your search or tag filters.",
      myConceptSets: "My Concept Sets",
      allConceptSets: "All Concept Sets",
      showingRange: "Showing {{start}} - {{end}} of {{total}}",
      columns: {
        name: "Name",
        author: "Author",
        visibility: "Visibility",
        items: "Items",
        tags: "Tags",
        updated: "Updated",
      },
      visibility: {
        public: "Public",
        private: "Private",
      },
    },
    builder: {
      tabs: {
        keyword: "Keyword Search",
        semantic: "Semantic Search",
      },
      setContents: "Set Contents",
      concept_one: "{{count}} concept",
      concept_other: "{{count}} concepts",
    },
    editor: {
      itemCount_one: "{{count}} item",
      itemCount_other: "{{count}} items",
      resolve: "Resolve",
      selected_one: "{{count}} selected",
      selected_other: "{{count}} selected",
      descendantsOn: "Descendants On",
      descendantsOff: "Descendants Off",
      mappedOn: "Mapped On",
      mappedOff: "Mapped Off",
      exclude: "Exclude",
      include: "Include",
      resolvedTo_one: "Resolved to {{count}} concept",
      resolvedTo_other: "Resolved to {{count}} concepts",
      columns: {
        conceptId: "Concept ID",
        name: "Name",
        domain: "Domain",
        vocabulary: "Vocabulary",
        standard: "Standard",
        excluded: "Excluded",
        descendants: "Descendants",
        mapped: "Mapped",
        actions: "Actions",
      },
      emptyTitle: "No concepts added yet",
      emptyMessage: "Use the search panel to find and add concepts to this set",
      toggleLabels: {
        excludeConcept: "Exclude concept",
        includeDescendants: "Include descendants",
        includeMapped: "Include mapped",
        removeItem: "Remove item",
      },
    },
    detail: {
      failedToLoad: "Failed to load concept set",
      backToList: "Back to list",
      clickToEdit: "Click to edit",
      addDescription: "Add a description...",
      duplicate: "Duplicate",
      duplicateSuccess: "Duplicated as \"{{name}}\"",
      duplicateFailed: "Failed to duplicate concept set",
      export: "Export",
      exportFallbackName: "concept-set",
      delete: "Delete",
      deleteConfirm: "Are you sure you want to delete this concept set?",
      recommendedConcepts: "Recommended Concepts",
      visibility: {
        public: "Public",
        private: "Private",
      },
    },
    detailTabs: {
      info: "Info",
      hierarchy: "Hierarchy",
      relationships: "Relationships",
      mapsFrom: "Maps From",
      failedToLoadConcept: "Failed to load concept",
      labels: {
        fullName: "Full Name",
        vocabulary: "Vocabulary",
        standard: "Standard",
        conceptClass: "Concept Class",
        domain: "Domain",
        synonyms: "Synonyms",
      },
      noAncestorsFound: "No ancestors found",
      noRelationshipsFound: "No relationships found",
      relationshipsPage: "Page {{page}} of {{totalPages}} - {{total}} total",
      noSourceCodes: "No source codes map to this concept",
      showingSourceCodes: "Showing {{shown}} of {{total}} source codes",
    },
    stats: {
      total: "Total",
      withItems: "With Items",
      public: "Public",
    },
    phoebe: {
      recommendations: "Phoebe Recommendations",
      poweredBy: "Powered by Phoebe",
      addAll_one: "Add All ({{count}})",
      addAll_other: "Add All ({{count}})",
      unavailable: "Recommendations unavailable",
      noneFound: "No recommendations found",
      added: "Added",
      addToConceptSet: "Add to concept set",
      add: "Add",
    },
    bundle: {
      title: "Create from Care Bundle",
      description:
        "Select a disease bundle to auto-generate concept sets grouped by domain (conditions, drugs, measurements).",
      filterPlaceholder: "Filter bundles...",
      noMatching: "No matching bundles",
      noneFound: "No care bundles found",
      namePrefix: "Name Prefix",
      namingHelp:
        "Sets will be named \"{{name}} - Conditions\", \"- Drugs\", etc.",
      create: "Create Concept Sets",
      created_one: "{{count}} concept set created from {{bundle}}",
      created_other: "{{count}} concept sets created from {{bundle}}",
      createFailed: "Failed to create concept sets from bundle",
      measures_one: "{{count}} measure",
      measures_other: "{{count}} measures",
      concepts_one: "{{count}} concept",
      concepts_other: "{{count}} concepts",
    },
    import: {
      title: "Import Concept Set",
      uploadJsonFile: "Upload JSON file",
      chooseFile: "Choose file",
      pasteAtlasJson: "Or paste JSON (Atlas format)",
      placeholder:
        "{\n  \"name\": \"My Concept Set\",\n  \"expression\": { \"items\": [...] }\n}",
      invalidJson: "Invalid JSON - please check your input.",
      importFailed: "Import failed",
      imported: "imported",
      skipped: "skipped",
      failed: "failed",
      close: "Close",
      cancel: "Cancel",
      import: "Import",
    },
  },
  shared: {
    significanceVerdict: {
      protective: "Significant protective effect",
      harmful: "Significant harmful effect",
      notSignificant: "Not statistically significant",
    },
    workbench: {
      statusLabel: "Status:",
      ariaRunStatus: "Run status",
      pollingEvery2s: "polling every 2s",
    },
    conceptSearch: {
      observationsShort: "obs",
    },
  },
};

const frConceptSet: MessageTree = mergeMessageTrees(enConceptSet, {
  conceptSets: {
    page: {
      title: "Jeux de concepts",
      subtitle:
        "Definir et gerer des jeux de concepts reutilisables pour les definitions de cohortes et les analyses",
      searchPlaceholder: "Rechercher des jeux de concepts...",
      untitledName: "Jeu de concepts sans titre",
      newConceptSet: "Nouveau jeu de concepts",
      fromBundle: "A partir d'un bundle",
      import: "Importer",
    },
    list: {
      failedToLoad: "Echec du chargement des jeux de concepts",
      emptyTitle: "Aucun jeu de concepts",
      emptyMessage:
        "Creez votre premier jeu de concepts pour commencer a construire des definitions.",
      noMatchingTitle: "Aucun jeu de concepts correspondant",
      noMatchingMessage:
        "Essayez d'ajuster votre recherche ou vos filtres de tags.",
      myConceptSets: "Mes jeux de concepts",
      allConceptSets: "Tous les jeux de concepts",
      showingRange: "Affichage de {{start}} a {{end}} sur {{total}}",
      columns: {
        name: "Nom",
        author: "Auteur",
        visibility: "Visibilite",
        items: "Elements",
        tags: "Tags",
        updated: "Mis a jour",
      },
      visibility: {
        public: "Public",
        private: "Prive",
      },
    },
    builder: {
      tabs: {
        keyword: "Recherche par mot-cle",
        semantic: "Recherche semantique",
      },
      setContents: "Contenu du jeu",
      concept_one: "{{count}} concept",
      concept_other: "{{count}} concepts",
    },
    editor: {
      itemCount_one: "{{count}} element",
      itemCount_other: "{{count}} elements",
      resolve: "Resoudre",
      selected_one: "{{count}} selectionne",
      selected_other: "{{count}} selectionnes",
      descendantsOn: "Descendants actifs",
      descendantsOff: "Descendants inactifs",
      mappedOn: "Correspondances actives",
      mappedOff: "Correspondances inactives",
      exclude: "Exclure",
      include: "Inclure",
      resolvedTo_one: "Resolus vers {{count}} concept",
      resolvedTo_other: "Resolus vers {{count}} concepts",
      columns: {
        conceptId: "ID du concept",
        name: "Nom",
        domain: "Domaine",
        vocabulary: "Vocabulaire",
        standard: "Standard",
        excluded: "Exclu",
        descendants: "Descendants",
        mapped: "Correspondances",
        actions: "Actions",
      },
      emptyTitle: "Aucun concept ajoute pour le moment",
      emptyMessage:
        "Utilisez le panneau de recherche pour trouver et ajouter des concepts a ce jeu",
      toggleLabels: {
        excludeConcept: "Exclure le concept",
        includeDescendants: "Inclure les descendants",
        includeMapped: "Inclure les correspondances",
        removeItem: "Retirer l'element",
      },
    },
    detail: {
      failedToLoad: "Echec du chargement du jeu de concepts",
      backToList: "Retour a la liste",
      clickToEdit: "Cliquer pour modifier",
      addDescription: "Ajouter une description...",
      duplicate: "Dupliquer",
      duplicateSuccess: "Duplique sous \"{{name}}\"",
      duplicateFailed: "Echec de la duplication du jeu de concepts",
      export: "Exporter",
      exportFallbackName: "jeu-de-concepts",
      delete: "Supprimer",
      deleteConfirm:
        "Voulez-vous vraiment supprimer ce jeu de concepts ?",
      recommendedConcepts: "Concepts recommandes",
      visibility: {
        public: "Public",
        private: "Prive",
      },
    },
    detailTabs: {
      info: "Infos",
      hierarchy: "Hierarchie",
      relationships: "Relations",
      mapsFrom: "Mappe depuis",
      failedToLoadConcept: "Echec du chargement du concept",
      labels: {
        fullName: "Nom complet",
        vocabulary: "Vocabulaire",
        standard: "Standard",
        conceptClass: "Classe de concept",
        domain: "Domaine",
        synonyms: "Synonymes",
      },
      noAncestorsFound: "Aucun ancetre trouve",
      noRelationshipsFound: "Aucune relation trouvee",
      relationshipsPage:
        "Page {{page}} sur {{totalPages}} - {{total}} au total",
      noSourceCodes: "Aucun code source ne mappe vers ce concept",
      showingSourceCodes:
        "Affichage de {{shown}} sur {{total}} codes source",
    },
    stats: {
      total: "Total",
      withItems: "Avec elements",
      public: "Public",
    },
    phoebe: {
      recommendations: "Recommandations Phoebe",
      poweredBy: "Propulse par Phoebe",
      addAll_one: "Tout ajouter ({{count}})",
      addAll_other: "Tout ajouter ({{count}})",
      unavailable: "Recommandations indisponibles",
      noneFound: "Aucune recommandation trouvee",
      added: "Ajoute",
      addToConceptSet: "Ajouter au jeu de concepts",
      add: "Ajouter",
    },
    bundle: {
      title: "Creer a partir d'un bundle de soins",
      description:
        "Selectionnez un bundle de pathologies pour generer automatiquement des jeux de concepts regroupes par domaine (conditions, medicaments, mesures).",
      filterPlaceholder: "Filtrer les bundles...",
      noMatching: "Aucun bundle correspondant",
      noneFound: "Aucun bundle de soins trouve",
      namePrefix: "Prefixe du nom",
      namingHelp:
        "Les jeux seront nommes \"{{name}} - Conditions\", \"- Medicaments\", etc.",
      create: "Creer les jeux de concepts",
      created_one: "{{count}} jeu de concepts cree a partir de {{bundle}}",
      created_other:
        "{{count}} jeux de concepts crees a partir de {{bundle}}",
      createFailed:
        "Echec de la creation des jeux de concepts a partir du bundle",
      measures_one: "{{count}} mesure",
      measures_other: "{{count}} mesures",
      concepts_one: "{{count}} concept",
      concepts_other: "{{count}} concepts",
    },
    import: {
      title: "Importer un jeu de concepts",
      uploadJsonFile: "Televerser un fichier JSON",
      chooseFile: "Choisir un fichier",
      pasteAtlasJson: "Ou coller le JSON (format Atlas)",
      placeholder:
        "{\n  \"name\": \"Mon jeu de concepts\",\n  \"expression\": { \"items\": [...] }\n}",
      invalidJson: "JSON invalide - veuillez verifier votre saisie.",
      importFailed: "Echec de l'import",
      imported: "importes",
      skipped: "ignores",
      failed: "echoues",
      close: "Fermer",
      cancel: "Annuler",
      import: "Importer",
    },
  },
  shared: {
    significanceVerdict: {
      protective: "Effet protecteur significatif",
      harmful: "Effet nocif significatif",
      notSignificant: "Non statistiquement significatif",
    },
    workbench: {
      statusLabel: "Statut :",
      ariaRunStatus: "Statut de l'execution",
      pollingEvery2s: "interrogation toutes les 2 s",
    },
  },
});

const deConceptSet: MessageTree = mergeMessageTrees(enConceptSet, {
  conceptSets: {
    page: {
      title: "Konzeptmengen",
      subtitle:
        "Wiederverwendbare Konzeptmengen fur Kohortendefinitionen und Analysen definieren und verwalten",
      searchPlaceholder: "Konzeptmengen suchen...",
      untitledName: "Unbenannte Konzeptmenge",
      newConceptSet: "Neue Konzeptmenge",
      fromBundle: "Aus Bundle",
      import: "Importieren",
    },
    list: {
      failedToLoad: "Konzeptmengen konnten nicht geladen werden",
      emptyTitle: "Keine Konzeptmengen",
      emptyMessage:
        "Erstellen Sie Ihre erste Konzeptmenge, um mit dem Aufbau von Definitionen zu beginnen.",
      noMatchingTitle: "Keine passenden Konzeptmengen",
      noMatchingMessage:
        "Passen Sie Ihre Suche oder Ihre Tag-Filter an.",
      myConceptSets: "Meine Konzeptmengen",
      allConceptSets: "Alle Konzeptmengen",
      showingRange: "Zeige {{start}} - {{end}} von {{total}}",
      columns: {
        name: "Name",
        author: "Autor",
        visibility: "Sichtbarkeit",
        items: "Elemente",
        tags: "Tags",
        updated: "Aktualisiert",
      },
      visibility: {
        public: "Offentlich",
        private: "Privat",
      },
    },
    builder: {
      tabs: {
        keyword: "Stichwortsuche",
        semantic: "Semantische Suche",
      },
      setContents: "Inhalt der Menge",
      concept_one: "{{count}} Konzept",
      concept_other: "{{count}} Konzepte",
    },
    editor: {
      itemCount_one: "{{count}} Element",
      itemCount_other: "{{count}} Elemente",
      resolve: "Auflosen",
      selected_one: "{{count}} ausgewahlt",
      selected_other: "{{count}} ausgewahlt",
      descendantsOn: "Nachfahren an",
      descendantsOff: "Nachfahren aus",
      mappedOn: "Zuordnungen an",
      mappedOff: "Zuordnungen aus",
      exclude: "Ausschliessen",
      include: "Einschliessen",
      resolvedTo_one: "In {{count}} Konzept aufgelost",
      resolvedTo_other: "In {{count}} Konzepte aufgelost",
      columns: {
        conceptId: "Konzept-ID",
        name: "Name",
        domain: "Domane",
        vocabulary: "Vokabular",
        standard: "Standard",
        excluded: "Ausgeschlossen",
        descendants: "Nachfahren",
        mapped: "Zugeordnet",
        actions: "Aktionen",
      },
      emptyTitle: "Noch keine Konzepte hinzugefugt",
      emptyMessage:
        "Verwenden Sie das Suchfeld, um Konzepte zu finden und dieser Menge hinzuzufugen",
      toggleLabels: {
        excludeConcept: "Konzept ausschliessen",
        includeDescendants: "Nachfahren einschliessen",
        includeMapped: "Zugeordnete einschliessen",
        removeItem: "Element entfernen",
      },
    },
    detail: {
      failedToLoad: "Konzeptmenge konnte nicht geladen werden",
      backToList: "Zuruck zur Liste",
      clickToEdit: "Zum Bearbeiten klicken",
      addDescription: "Beschreibung hinzufugen...",
      duplicate: "Duplizieren",
      duplicateSuccess: "Als \"{{name}}\" dupliziert",
      duplicateFailed: "Konzeptmenge konnte nicht dupliziert werden",
      export: "Exportieren",
      exportFallbackName: "konzeptmenge",
      delete: "Loschen",
      deleteConfirm:
        "Mochten Sie diese Konzeptmenge wirklich loschen?",
      recommendedConcepts: "Empfohlene Konzepte",
      visibility: {
        public: "Offentlich",
        private: "Privat",
      },
    },
    detailTabs: {
      info: "Info",
      hierarchy: "Hierarchie",
      relationships: "Beziehungen",
      mapsFrom: "Mappt von",
      failedToLoadConcept: "Konzept konnte nicht geladen werden",
      labels: {
        fullName: "Vollstandiger Name",
        vocabulary: "Vokabular",
        standard: "Standard",
        conceptClass: "Konzeptklasse",
        domain: "Domane",
        synonyms: "Synonyme",
      },
      noAncestorsFound: "Keine Vorfahren gefunden",
      noRelationshipsFound: "Keine Beziehungen gefunden",
      relationshipsPage:
        "Seite {{page}} von {{totalPages}} - {{total}} gesamt",
      noSourceCodes: "Keine Quellcodes werden auf dieses Konzept abgebildet",
      showingSourceCodes:
        "Zeige {{shown}} von {{total}} Quellcodes",
    },
    stats: {
      total: "Gesamt",
      withItems: "Mit Elementen",
      public: "Offentlich",
    },
    phoebe: {
      recommendations: "Phoebe-Empfehlungen",
      poweredBy: "Bereitgestellt von Phoebe",
      addAll_one: "Alle hinzufugen ({{count}})",
      addAll_other: "Alle hinzufugen ({{count}})",
      unavailable: "Empfehlungen nicht verfugbar",
      noneFound: "Keine Empfehlungen gefunden",
      added: "Hinzugefugt",
      addToConceptSet: "Zur Konzeptmenge hinzufugen",
      add: "Hinzufugen",
    },
    bundle: {
      title: "Aus Versorgungspaket erstellen",
      description:
        "Wahlen Sie ein Krankheits-Bundle aus, um automatisch Konzeptmengen nach Domane zu erzeugen (Erkrankungen, Arzneimittel, Messungen).",
      filterPlaceholder: "Bundles filtern...",
      noMatching: "Keine passenden Bundles",
      noneFound: "Keine Versorgungspakete gefunden",
      namePrefix: "Namensprefix",
      namingHelp:
        "Die Mengen werden als \"{{name}} - Erkrankungen\", \"- Arzneimittel\" usw. benannt.",
      create: "Konzeptmengen erstellen",
      created_one: "{{count}} Konzeptmenge aus {{bundle}} erstellt",
      created_other: "{{count}} Konzeptmengen aus {{bundle}} erstellt",
      createFailed:
        "Konzeptmengen aus dem Bundle konnten nicht erstellt werden",
      measures_one: "{{count}} Messung",
      measures_other: "{{count}} Messungen",
      concepts_one: "{{count}} Konzept",
      concepts_other: "{{count}} Konzepte",
    },
    import: {
      title: "Konzeptmenge importieren",
      uploadJsonFile: "JSON-Datei hochladen",
      chooseFile: "Datei auswahlen",
      pasteAtlasJson: "Oder JSON einfugen (Atlas-Format)",
      placeholder:
        "{\n  \"name\": \"Meine Konzeptmenge\",\n  \"expression\": { \"items\": [...] }\n}",
      invalidJson: "Ungultiges JSON - bitte Eingabe prufen.",
      importFailed: "Import fehlgeschlagen",
      imported: "importiert",
      skipped: "ubersprungen",
      failed: "fehlgeschlagen",
      close: "Schliessen",
      cancel: "Abbrechen",
      import: "Importieren",
    },
  },
  shared: {
    significanceVerdict: {
      protective: "Signifikanter schutzender Effekt",
      harmful: "Signifikanter schadlicher Effekt",
      notSignificant: "Nicht statistisch signifikant",
    },
    workbench: {
      statusLabel: "Status:",
      ariaRunStatus: "Ausfuhrungsstatus",
      pollingEvery2s: "Abfrage alle 2 s",
    },
  },
});

const ptConceptSet: MessageTree = mergeMessageTrees(enConceptSet, {
  conceptSets: {
    page: {
      title: "Conjuntos de conceitos",
      subtitle:
        "Defina e gerencie conjuntos de conceitos reutilizaveis para definicoes de coortes e analises",
      searchPlaceholder: "Pesquisar conjuntos de conceitos...",
      untitledName: "Conjunto de conceitos sem titulo",
      newConceptSet: "Novo conjunto de conceitos",
      fromBundle: "A partir de bundle",
      import: "Importar",
    },
    list: {
      failedToLoad: "Falha ao carregar conjuntos de conceitos",
      emptyTitle: "Nenhum conjunto de conceitos",
      emptyMessage:
        "Crie seu primeiro conjunto de conceitos para comecar a montar definicoes.",
      noMatchingTitle: "Nenhum conjunto de conceitos correspondente",
      noMatchingMessage:
        "Tente ajustar sua busca ou os filtros de tags.",
      myConceptSets: "Meus conjuntos de conceitos",
      allConceptSets: "Todos os conjuntos de conceitos",
      showingRange: "Mostrando {{start}} - {{end}} de {{total}}",
      columns: {
        name: "Nome",
        author: "Autor",
        visibility: "Visibilidade",
        items: "Itens",
        tags: "Tags",
        updated: "Atualizado",
      },
      visibility: {
        public: "Publico",
        private: "Privado",
      },
    },
    builder: {
      tabs: {
        keyword: "Busca por palavra-chave",
        semantic: "Busca semantica",
      },
      setContents: "Conteudo do conjunto",
      concept_one: "{{count}} conceito",
      concept_other: "{{count}} conceitos",
    },
    editor: {
      itemCount_one: "{{count}} item",
      itemCount_other: "{{count}} itens",
      resolve: "Resolver",
      selected_one: "{{count}} selecionado",
      selected_other: "{{count}} selecionados",
      descendantsOn: "Descendentes ativados",
      descendantsOff: "Descendentes desativados",
      mappedOn: "Mapeados ativados",
      mappedOff: "Mapeados desativados",
      exclude: "Excluir",
      include: "Incluir",
      resolvedTo_one: "Resolvido para {{count}} conceito",
      resolvedTo_other: "Resolvido para {{count}} conceitos",
      columns: {
        conceptId: "ID do conceito",
        name: "Nome",
        domain: "Dominio",
        vocabulary: "Vocabulario",
        standard: "Padrao",
        excluded: "Excluido",
        descendants: "Descendentes",
        mapped: "Mapeados",
        actions: "Acoes",
      },
      emptyTitle: "Nenhum conceito adicionado ainda",
      emptyMessage:
        "Use o painel de busca para encontrar e adicionar conceitos a este conjunto",
      toggleLabels: {
        excludeConcept: "Excluir conceito",
        includeDescendants: "Incluir descendentes",
        includeMapped: "Incluir mapeados",
        removeItem: "Remover item",
      },
    },
    detail: {
      failedToLoad: "Falha ao carregar conjunto de conceitos",
      backToList: "Voltar para a lista",
      clickToEdit: "Clique para editar",
      addDescription: "Adicionar uma descricao...",
      duplicate: "Duplicar",
      duplicateSuccess: "Duplicado como \"{{name}}\"",
      duplicateFailed: "Falha ao duplicar conjunto de conceitos",
      export: "Exportar",
      exportFallbackName: "conjunto-de-conceitos",
      delete: "Excluir",
      deleteConfirm:
        "Tem certeza de que deseja excluir este conjunto de conceitos?",
      recommendedConcepts: "Conceitos recomendados",
      visibility: {
        public: "Publico",
        private: "Privado",
      },
    },
    detailTabs: {
      info: "Info",
      hierarchy: "Hierarquia",
      relationships: "Relacionamentos",
      mapsFrom: "Mapeia de",
      failedToLoadConcept: "Falha ao carregar conceito",
      labels: {
        fullName: "Nome completo",
        vocabulary: "Vocabulario",
        standard: "Padrao",
        conceptClass: "Classe do conceito",
        domain: "Dominio",
        synonyms: "Sinonimos",
      },
      noAncestorsFound: "Nenhum ancestral encontrado",
      noRelationshipsFound: "Nenhum relacionamento encontrado",
      relationshipsPage:
        "Pagina {{page}} de {{totalPages}} - {{total}} no total",
      noSourceCodes: "Nenhum codigo-fonte e mapeado para este conceito",
      showingSourceCodes:
        "Mostrando {{shown}} de {{total}} codigos-fonte",
    },
    stats: {
      total: "Total",
      withItems: "Com itens",
      public: "Publico",
    },
    phoebe: {
      recommendations: "Recomendacoes do Phoebe",
      poweredBy: "Com tecnologia Phoebe",
      addAll_one: "Adicionar tudo ({{count}})",
      addAll_other: "Adicionar tudo ({{count}})",
      unavailable: "Recomendacoes indisponiveis",
      noneFound: "Nenhuma recomendacao encontrada",
      added: "Adicionado",
      addToConceptSet: "Adicionar ao conjunto de conceitos",
      add: "Adicionar",
    },
    bundle: {
      title: "Criar a partir de bundle de cuidado",
      description:
        "Selecione um bundle de doenca para gerar automaticamente conjuntos de conceitos agrupados por dominio (condicoes, medicamentos, medidas).",
      filterPlaceholder: "Filtrar bundles...",
      noMatching: "Nenhum bundle correspondente",
      noneFound: "Nenhum bundle de cuidado encontrado",
      namePrefix: "Prefixo do nome",
      namingHelp:
        "Os conjuntos serao nomeados \"{{name}} - Condicoes\", \"- Medicamentos\" etc.",
      create: "Criar conjuntos de conceitos",
      created_one: "{{count}} conjunto de conceitos criado a partir de {{bundle}}",
      created_other:
        "{{count}} conjuntos de conceitos criados a partir de {{bundle}}",
      createFailed:
        "Falha ao criar conjuntos de conceitos a partir do bundle",
      measures_one: "{{count}} medida",
      measures_other: "{{count}} medidas",
      concepts_one: "{{count}} conceito",
      concepts_other: "{{count}} conceitos",
    },
    import: {
      title: "Importar conjunto de conceitos",
      uploadJsonFile: "Enviar arquivo JSON",
      chooseFile: "Escolher arquivo",
      pasteAtlasJson: "Ou colar JSON (formato Atlas)",
      placeholder:
        "{\n  \"name\": \"Meu conjunto de conceitos\",\n  \"expression\": { \"items\": [...] }\n}",
      invalidJson: "JSON invalido - confira sua entrada.",
      importFailed: "Falha na importacao",
      imported: "importados",
      skipped: "ignorados",
      failed: "com falha",
      close: "Fechar",
      cancel: "Cancelar",
      import: "Importar",
    },
  },
  shared: {
    significanceVerdict: {
      protective: "Efeito protetor significativo",
      harmful: "Efeito nocivo significativo",
      notSignificant: "Nao estatisticamente significativo",
    },
    workbench: {
      statusLabel: "Status:",
      ariaRunStatus: "Status da execucao",
      pollingEvery2s: "consultando a cada 2 s",
    },
  },
});

export const conceptSetResources: Record<string, MessageTree> = {
  "en-US": enConceptSet,
  "es-ES": mergeMessageTrees(enConceptSet, {}),
  "fr-FR": frConceptSet,
  "de-DE": deConceptSet,
  "pt-BR": ptConceptSet,
  "fi-FI": mergeMessageTrees(enConceptSet, {}),
  "ja-JP": mergeMessageTrees(enConceptSet, {}),
  "zh-Hans": mergeMessageTrees(enConceptSet, {}),
  "ko-KR": mergeMessageTrees(enConceptSet, {}),
  "hi-IN": mergeMessageTrees(enConceptSet, {}),
  ar: mergeMessageTrees(enConceptSet, {}),
  "en-XA": mergeMessageTrees(enConceptSet, {}),
};
