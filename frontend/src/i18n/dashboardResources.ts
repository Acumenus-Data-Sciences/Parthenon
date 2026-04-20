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

const enDashboard: MessageTree = {
  page: {
    title: "Dashboard",
    subtitle: "Unified Outcomes Research Platform",
  },
  metrics: {
    cdmSources: "CDM Sources",
    runningJobs: "Running Jobs",
    conceptSets: "Concept Sets",
    activeCohorts: "Active Cohorts",
    descriptions: {
      cdmSources: "{{postgresqlCount}} PostgreSQL · {{personsText}}",
      persons: "{{count}} persons",
      noCdmLoaded: "No CDM loaded",
      runningJobs:
        "{{completedCount}} completed recently · {{failedCount}} failed",
      conceptSets:
        "{{populatedTables}}/{{totalTables}} CDM tables populated · {{completeness}}% complete",
      activeCohorts:
        "{{generatedCount}} generated · {{conceptSetCount}} concept sets",
    },
  },
  error: {
    title: "Unable to load dashboard data",
    message: "The API may be unavailable. Displaying cached data if available.",
  },
  cdm: {
    title: "CDM Characterization",
    subtitle: "Clinical data profile for the selected source",
    viewFull: "View Full",
    noSource: "Select a data source to view characterization",
    noDomainData: "No domain data available",
    metrics: {
      persons: "Persons",
      medianObservationDuration: "Median Obs Duration",
      medianObservationDurationValue: "{{count}} days",
      totalEvents: "Total Events",
      dataCompleteness: "Data Completeness",
      tableCount: "{{populatedTables}}/{{totalTables}} tables",
    },
    demographics: "Demographics",
    ageDistribution: "Age Distribution",
    noAgeDistributionData: "No age distribution data",
    age: "Age",
    gender: {
      male: "Male",
      female: "Female",
    },
    domainCounts: "CDM Domain Counts",
    domains: {
      conditionOccurrence: "Conditions",
      drugExposure: "Drug Exposures",
      procedureOccurrence: "Procedures",
      measurement: "Measurements",
      observation: "Observations",
      visitOccurrence: "Visits",
      drugEra: "Drug Eras",
      conditionEra: "Condition Eras",
      deviceExposure: "Devices",
      death: "Deaths",
    },
  },
  panels: {
    recentCohortActivity: "Recent Cohort Activity",
    quickActions: "Quick Actions",
    sourceHealth: "Source Health",
    activeJobs: "Active Jobs",
    viewAll: "View All",
  },
  tables: {
    cohort: "Cohort",
    subjects: "Subjects",
    status: "Status",
    source: "Source",
    dialect: "Dialect",
    job: "Job",
    type: "Type",
  },
  empty: {
    noCohortsTitle: "No cohorts yet",
    noCohortsMessage: "Create your first cohort definition to begin research.",
    newCohort: "New Cohort",
    noDataSourcesTitle: "No data sources",
    noDataSourcesMessage: "Connect a CDM database to get started.",
    addSource: "Add Source",
    noActiveJobsTitle: "No active jobs",
    noActiveJobsMessage: "Jobs will appear here when analyses are running.",
  },
  quickActions: {
    connectDataSource: "Connect a Data Source",
    createCohortDefinition: "Create Cohort Definition",
    buildConceptSet: "Build Concept Set",
    exploreDataQuality: "Explore Data Quality",
  },
  statuses: {
    healthy: "Healthy",
    cohort: {
      active: "active",
      error: "error",
      draft: "draft",
      pending: "pending",
    },
    job: {
      running: "running",
      completed: "completed",
      failed: "failed",
      success: "success",
      fail: "failed",
      queued: "queued",
    },
  },
};

const esDashboard: MessageTree = {
  page: {
    title: "Panel",
    subtitle: "Plataforma unificada de investigación de resultados",
  },
  metrics: {
    cdmSources: "Fuentes CDM",
    runningJobs: "Trabajos en ejecución",
    conceptSets: "Conjuntos de conceptos",
    activeCohorts: "Cohortes activas",
    descriptions: {
      cdmSources: "{{postgresqlCount}} PostgreSQL · {{personsText}}",
      persons: "{{count}} personas",
      noCdmLoaded: "Sin CDM cargado",
      runningJobs:
        "{{completedCount}} completados recientemente · {{failedCount}} fallidos",
      conceptSets:
        "{{populatedTables}}/{{totalTables}} tablas CDM pobladas · {{completeness}}% completo",
      activeCohorts:
        "{{generatedCount}} generadas · {{conceptSetCount}} conjuntos de conceptos",
    },
  },
  error: {
    title: "No se pudieron cargar los datos del panel",
    message:
      "La API puede no estar disponible. Se muestran datos en caché si existen.",
  },
  cdm: {
    title: "Caracterización CDM",
    subtitle: "Perfil de datos clínicos de la fuente seleccionada",
    viewFull: "Ver todo",
    noSource: "Selecciona una fuente de datos para ver la caracterización",
    noDomainData: "No hay datos de dominio disponibles",
    metrics: {
      persons: "Personas",
      medianObservationDuration: "Duración mediana obs.",
      medianObservationDurationValue: "{{count}} días",
      totalEvents: "Eventos totales",
      dataCompleteness: "Completitud de datos",
      tableCount: "{{populatedTables}}/{{totalTables}} tablas",
    },
    demographics: "Demografía",
    ageDistribution: "Distribución por edad",
    noAgeDistributionData: "No hay datos de distribución por edad",
    age: "Edad",
    gender: {
      male: "Masculino",
      female: "Femenino",
    },
    domainCounts: "Conteos por dominio CDM",
    domains: {
      conditionOccurrence: "Condiciones",
      drugExposure: "Exposiciones a fármacos",
      procedureOccurrence: "Procedimientos",
      measurement: "Mediciones",
      observation: "Observaciones",
      visitOccurrence: "Visitas",
      drugEra: "Eras de fármacos",
      conditionEra: "Eras de condición",
      deviceExposure: "Dispositivos",
      death: "Defunciones",
    },
  },
  panels: {
    recentCohortActivity: "Actividad reciente de cohortes",
    quickActions: "Acciones rápidas",
    sourceHealth: "Estado de fuentes",
    activeJobs: "Trabajos activos",
    viewAll: "Ver todo",
  },
  tables: {
    cohort: "Cohorte",
    subjects: "Sujetos",
    status: "Estado",
    source: "Fuente",
    dialect: "Dialecto",
    job: "Trabajo",
    type: "Tipo",
  },
  empty: {
    noCohortsTitle: "Aún no hay cohortes",
    noCohortsMessage:
      "Crea tu primera definición de cohorte para comenzar la investigación.",
    newCohort: "Nueva cohorte",
    noDataSourcesTitle: "No hay fuentes de datos",
    noDataSourcesMessage: "Conecta una base de datos CDM para empezar.",
    addSource: "Añadir fuente",
    noActiveJobsTitle: "No hay trabajos activos",
    noActiveJobsMessage:
      "Los trabajos aparecerán aquí cuando haya análisis en ejecución.",
  },
  quickActions: {
    connectDataSource: "Conectar una fuente de datos",
    createCohortDefinition: "Crear definición de cohorte",
    buildConceptSet: "Crear conjunto de conceptos",
    exploreDataQuality: "Explorar calidad de datos",
  },
  statuses: {
    healthy: "Correcta",
    cohort: {
      active: "activa",
      error: "error",
      draft: "borrador",
      pending: "pendiente",
    },
    job: {
      running: "en ejecución",
      completed: "completado",
      failed: "fallido",
      success: "correcto",
      fail: "fallido",
      queued: "en cola",
    },
  },
};

const koDashboard: MessageTree = {
  page: {
    title: "대시보드",
    subtitle: "통합 성과 연구 플랫폼",
  },
  metrics: {
    cdmSources: "CDM 소스",
    runningJobs: "실행 중인 작업",
    conceptSets: "개념 세트",
    activeCohorts: "활성 코호트",
    descriptions: {
      cdmSources: "PostgreSQL {{postgresqlCount}}개 · {{personsText}}",
      persons: "{{count}}명",
      noCdmLoaded: "로드된 CDM 없음",
      runningJobs:
        "최근 완료 {{completedCount}}개 · 실패 {{failedCount}}개",
      conceptSets:
        "CDM 테이블 {{populatedTables}}/{{totalTables}}개 채움 · {{completeness}}% 완료",
      activeCohorts:
        "생성됨 {{generatedCount}}개 · 개념 세트 {{conceptSetCount}}개",
    },
  },
  error: {
    title: "대시보드 데이터를 불러올 수 없습니다",
    message: "API를 사용할 수 없을 수 있습니다. 가능한 경우 캐시된 데이터를 표시합니다.",
  },
  cdm: {
    title: "CDM 특성 요약",
    subtitle: "선택한 소스의 임상 데이터 프로필",
    viewFull: "전체 보기",
    noSource: "특성 요약을 보려면 데이터 소스를 선택하세요",
    noDomainData: "사용 가능한 도메인 데이터가 없습니다",
    metrics: {
      persons: "대상자",
      medianObservationDuration: "관찰 기간 중앙값",
      medianObservationDurationValue: "{{count}}일",
      totalEvents: "전체 이벤트",
      dataCompleteness: "데이터 완성도",
      tableCount: "{{populatedTables}}/{{totalTables}}개 테이블",
    },
    demographics: "인구통계",
    ageDistribution: "연령 분포",
    noAgeDistributionData: "사용 가능한 연령 분포 데이터가 없습니다",
    age: "연령",
    gender: {
      male: "남성",
      female: "여성",
    },
    domainCounts: "CDM 도메인 건수",
    domains: {
      conditionOccurrence: "질환",
      drugExposure: "약물 노출",
      procedureOccurrence: "시술",
      measurement: "측정",
      observation: "관찰",
      visitOccurrence: "방문",
      drugEra: "약물 기간",
      conditionEra: "질환 기간",
      deviceExposure: "기기",
      death: "사망",
    },
  },
  panels: {
    recentCohortActivity: "최근 코호트 활동",
    quickActions: "빠른 작업",
    sourceHealth: "소스 상태",
    activeJobs: "활성 작업",
    viewAll: "전체 보기",
  },
  tables: {
    cohort: "코호트",
    subjects: "대상자",
    status: "상태",
    source: "소스",
    dialect: "방언",
    job: "작업",
    type: "유형",
  },
  empty: {
    noCohortsTitle: "아직 코호트가 없습니다",
    noCohortsMessage: "연구를 시작하려면 첫 코호트 정의를 만드세요.",
    newCohort: "새 코호트",
    noDataSourcesTitle: "데이터 소스 없음",
    noDataSourcesMessage: "시작하려면 CDM 데이터베이스를 연결하세요.",
    addSource: "소스 추가",
    noActiveJobsTitle: "활성 작업 없음",
    noActiveJobsMessage: "분석이 실행되면 작업이 여기에 표시됩니다.",
  },
  quickActions: {
    connectDataSource: "데이터 소스 연결",
    createCohortDefinition: "코호트 정의 만들기",
    buildConceptSet: "개념 세트 만들기",
    exploreDataQuality: "데이터 품질 탐색",
  },
  statuses: {
    healthy: "정상",
    cohort: {
      active: "활성",
      error: "오류",
      draft: "초안",
      pending: "대기 중",
    },
    job: {
      running: "실행 중",
      completed: "완료",
      failed: "실패",
      success: "성공",
      fail: "실패",
      queued: "대기 중",
    },
  },
};

const frDashboard: MessageTree = mergeMessageTrees(enDashboard, {
  page: {
    title: "Tableau de bord",
    subtitle: "Plateforme unifiée de recherche sur les résultats",
  },
  metrics: {
    cdmSources: "Sources CDM",
    runningJobs: "Tâches en cours",
    conceptSets: "Jeux de concepts",
    activeCohorts: "Cohortes actives",
    descriptions: {
      cdmSources: "{{postgresqlCount}} PostgreSQL · {{personsText}}",
      persons: "{{count}} personnes",
      noCdmLoaded: "Aucun CDM chargé",
      runningJobs:
        "{{completedCount}} terminées récemment · {{failedCount}} en échec",
      conceptSets:
        "{{populatedTables}}/{{totalTables}} tables CDM remplies · {{completeness}} % complet",
      activeCohorts:
        "{{generatedCount}} générées · {{conceptSetCount}} jeux de concepts",
    },
  },
  error: {
    title: "Impossible de charger les données du tableau de bord",
    message:
      "L'API peut être indisponible. Les données mises en cache seront affichées si elles existent.",
  },
  cdm: {
    title: "Caractérisation du CDM",
    subtitle: "Profil des données cliniques pour la source sélectionnée",
    viewFull: "Voir tout",
    noSource:
      "Sélectionnez une source de données pour afficher la caractérisation",
    noDomainData: "Aucune donnée de domaine disponible",
    metrics: {
      persons: "Personnes",
      medianObservationDuration: "Durée médiane d'observation",
      medianObservationDurationValue: "{{count}} jours",
      totalEvents: "Événements totaux",
      dataCompleteness: "Complétude des données",
      tableCount: "{{populatedTables}}/{{totalTables}} tables",
    },
    demographics: "Démographie",
    ageDistribution: "Répartition par âge",
    noAgeDistributionData: "Aucune donnée de répartition par âge",
    age: "Âge",
    gender: {
      male: "Hommes",
      female: "Femmes",
    },
    domainCounts: "Volumes par domaine CDM",
    domains: {
      conditionOccurrence: "Affections",
      drugExposure: "Expositions aux médicaments",
      procedureOccurrence: "Procédures",
      measurement: "Mesures",
      observation: "Observations",
      visitOccurrence: "Visites",
      drugEra: "Périodes de traitement",
      conditionEra: "Périodes d'affection",
      deviceExposure: "Dispositifs",
      death: "Décès",
    },
  },
  panels: {
    recentCohortActivity: "Activité récente des cohortes",
    quickActions: "Actions rapides",
    sourceHealth: "État des sources",
    activeJobs: "Tâches actives",
    viewAll: "Tout afficher",
  },
  tables: {
    cohort: "Cohorte",
    subjects: "Sujets",
    status: "Statut",
    source: "Source",
    dialect: "Dialecte",
    job: "Tâche",
    type: "Type",
  },
  empty: {
    noCohortsTitle: "Aucune cohorte pour le moment",
    noCohortsMessage:
      "Créez votre première définition de cohorte pour commencer la recherche.",
    newCohort: "Nouvelle cohorte",
    noDataSourcesTitle: "Aucune source de données",
    noDataSourcesMessage: "Connectez une base CDM pour commencer.",
    addSource: "Ajouter une source",
    noActiveJobsTitle: "Aucune tâche active",
    noActiveJobsMessage:
      "Les tâches apparaîtront ici lorsque des analyses seront en cours.",
  },
  quickActions: {
    connectDataSource: "Connecter une source de données",
    createCohortDefinition: "Créer une définition de cohorte",
    buildConceptSet: "Créer un jeu de concepts",
    exploreDataQuality: "Explorer la qualité des données",
  },
  statuses: {
    healthy: "Sain",
    cohort: {
      active: "active",
      error: "erreur",
      draft: "brouillon",
      pending: "en attente",
    },
    job: {
      running: "en cours",
      completed: "terminée",
      failed: "échec",
      success: "succès",
      fail: "échec",
      queued: "en file d'attente",
    },
  },
});

const deDashboard: MessageTree = mergeMessageTrees(enDashboard, {
  page: {
    title: "Dashboard",
    subtitle: "Vereinheitlichte Plattform für Outcomes-Forschung",
  },
  metrics: {
    cdmSources: "CDM-Quellen",
    runningJobs: "Laufende Jobs",
    conceptSets: "Konzeptsets",
    activeCohorts: "Aktive Kohorten",
    descriptions: {
      cdmSources: "{{postgresqlCount}} PostgreSQL · {{personsText}}",
      persons: "{{count}} Personen",
      noCdmLoaded: "Kein CDM geladen",
      runningJobs:
        "{{completedCount}} kürzlich abgeschlossen · {{failedCount}} fehlgeschlagen",
      conceptSets:
        "{{populatedTables}}/{{totalTables}} CDM-Tabellen befüllt · {{completeness}} % vollständig",
      activeCohorts:
        "{{generatedCount}} generiert · {{conceptSetCount}} Konzeptsets",
    },
  },
  error: {
    title: "Dashboard-Daten konnten nicht geladen werden",
    message:
      "Die API ist möglicherweise nicht verfügbar. Zwischengespeicherte Daten werden angezeigt, falls vorhanden.",
  },
  cdm: {
    title: "CDM-Charakterisierung",
    subtitle: "Klinisches Datenprofil für die ausgewählte Quelle",
    viewFull: "Vollständig anzeigen",
    noSource: "Wählen Sie eine Datenquelle aus, um die Charakterisierung anzuzeigen",
    noDomainData: "Keine Domänendaten verfügbar",
    metrics: {
      persons: "Personen",
      medianObservationDuration: "Mediane Beobachtungsdauer",
      medianObservationDurationValue: "{{count}} Tage",
      totalEvents: "Ereignisse insgesamt",
      dataCompleteness: "Datenvollständigkeit",
      tableCount: "{{populatedTables}}/{{totalTables}} Tabellen",
    },
    demographics: "Demografie",
    ageDistribution: "Altersverteilung",
    noAgeDistributionData: "Keine Daten zur Altersverteilung",
    age: "Alter",
    gender: {
      male: "Männlich",
      female: "Weiblich",
    },
    domainCounts: "CDM-Domänenzählungen",
    domains: {
      conditionOccurrence: "Erkrankungen",
      drugExposure: "Arzneimittelexpositionen",
      procedureOccurrence: "Prozeduren",
      measurement: "Messungen",
      observation: "Beobachtungen",
      visitOccurrence: "Besuche",
      drugEra: "Arzneimittel-Episoden",
      conditionEra: "Erkrankungs-Episoden",
      deviceExposure: "Medizinprodukte",
      death: "Todesfälle",
    },
  },
  panels: {
    recentCohortActivity: "Aktuelle Kohortenaktivität",
    quickActions: "Schnellaktionen",
    sourceHealth: "Quellenstatus",
    activeJobs: "Aktive Jobs",
    viewAll: "Alle anzeigen",
  },
  tables: {
    cohort: "Kohorte",
    subjects: "Subjekte",
    status: "Status",
    source: "Quelle",
    dialect: "Dialekt",
    job: "Job",
    type: "Typ",
  },
  empty: {
    noCohortsTitle: "Noch keine Kohorten",
    noCohortsMessage:
      "Erstellen Sie Ihre erste Kohortendefinition, um mit der Forschung zu beginnen.",
    newCohort: "Neue Kohorte",
    noDataSourcesTitle: "Keine Datenquellen",
    noDataSourcesMessage: "Verbinden Sie eine CDM-Datenbank, um zu beginnen.",
    addSource: "Quelle hinzufügen",
    noActiveJobsTitle: "Keine aktiven Jobs",
    noActiveJobsMessage:
      "Jobs erscheinen hier, wenn Analysen ausgeführt werden.",
  },
  quickActions: {
    connectDataSource: "Datenquelle verbinden",
    createCohortDefinition: "Kohortendefinition erstellen",
    buildConceptSet: "Konzeptset erstellen",
    exploreDataQuality: "Datenqualität untersuchen",
  },
  statuses: {
    healthy: "Gesund",
    cohort: {
      active: "aktiv",
      error: "Fehler",
      draft: "Entwurf",
      pending: "ausstehend",
    },
    job: {
      running: "läuft",
      completed: "abgeschlossen",
      failed: "fehlgeschlagen",
      success: "erfolgreich",
      fail: "fehlgeschlagen",
      queued: "in Warteschlange",
    },
  },
});

const ptDashboard: MessageTree = mergeMessageTrees(enDashboard, {
  page: {
    title: "Painel",
    subtitle: "Plataforma unificada de pesquisa de desfechos",
  },
  metrics: {
    cdmSources: "Fontes CDM",
    runningJobs: "Tarefas em execução",
    conceptSets: "Conjuntos de conceitos",
    activeCohorts: "Coortes ativas",
    descriptions: {
      cdmSources: "{{postgresqlCount}} PostgreSQL · {{personsText}}",
      persons: "{{count}} pessoas",
      noCdmLoaded: "Nenhum CDM carregado",
      runningJobs:
        "{{completedCount}} concluídas recentemente · {{failedCount}} com falha",
      conceptSets:
        "{{populatedTables}}/{{totalTables}} tabelas CDM preenchidas · {{completeness}}% concluído",
      activeCohorts:
        "{{generatedCount}} geradas · {{conceptSetCount}} conjuntos de conceitos",
    },
  },
  error: {
    title: "Não foi possível carregar os dados do painel",
    message:
      "A API pode estar indisponível. Dados em cache serão exibidos se estiverem disponíveis.",
  },
  cdm: {
    title: "Caracterização do CDM",
    subtitle: "Perfil de dados clínicos para a fonte selecionada",
    viewFull: "Ver tudo",
    noSource: "Selecione uma fonte de dados para ver a caracterização",
    noDomainData: "Nenhum dado de domínio disponível",
    metrics: {
      persons: "Pessoas",
      medianObservationDuration: "Duração mediana de observação",
      medianObservationDurationValue: "{{count}} dias",
      totalEvents: "Eventos totais",
      dataCompleteness: "Completude dos dados",
      tableCount: "{{populatedTables}}/{{totalTables}} tabelas",
    },
    demographics: "Demografia",
    ageDistribution: "Distribuição etária",
    noAgeDistributionData: "Nenhum dado de distribuição etária",
    age: "Idade",
    gender: {
      male: "Masculino",
      female: "Feminino",
    },
    domainCounts: "Contagens por domínio CDM",
    domains: {
      conditionOccurrence: "Condições",
      drugExposure: "Exposições a medicamentos",
      procedureOccurrence: "Procedimentos",
      measurement: "Medições",
      observation: "Observações",
      visitOccurrence: "Visitas",
      drugEra: "Eras de medicamento",
      conditionEra: "Eras de condição",
      deviceExposure: "Dispositivos",
      death: "Óbitos",
    },
  },
  panels: {
    recentCohortActivity: "Atividade recente de coortes",
    quickActions: "Ações rápidas",
    sourceHealth: "Integridade da fonte",
    activeJobs: "Tarefas ativas",
    viewAll: "Ver tudo",
  },
  tables: {
    cohort: "Coorte",
    subjects: "Sujeitos",
    status: "Status",
    source: "Fonte",
    dialect: "Dialeto",
    job: "Tarefa",
    type: "Tipo",
  },
  empty: {
    noCohortsTitle: "Ainda não há coortes",
    noCohortsMessage:
      "Crie sua primeira definição de coorte para começar a pesquisa.",
    newCohort: "Nova coorte",
    noDataSourcesTitle: "Nenhuma fonte de dados",
    noDataSourcesMessage: "Conecte um banco CDM para começar.",
    addSource: "Adicionar fonte",
    noActiveJobsTitle: "Nenhuma tarefa ativa",
    noActiveJobsMessage:
      "As tarefas aparecerão aqui quando as análises estiverem em execução.",
  },
  quickActions: {
    connectDataSource: "Conectar uma fonte de dados",
    createCohortDefinition: "Criar definição de coorte",
    buildConceptSet: "Criar conjunto de conceitos",
    exploreDataQuality: "Explorar qualidade dos dados",
  },
  statuses: {
    healthy: "Saudável",
    cohort: {
      active: "ativa",
      error: "erro",
      draft: "rascunho",
      pending: "pendente",
    },
    job: {
      running: "em execução",
      completed: "concluída",
      failed: "falhou",
      success: "sucesso",
      fail: "falhou",
      queued: "na fila",
    },
  },
});

const fiDashboard: MessageTree = mergeMessageTrees(enDashboard, {
  page: {
    title: "Koontinäyttö",
    subtitle: "Yhtenäinen vaikuttavuustutkimuksen alusta",
  },
  metrics: {
    cdmSources: "CDM-lähteet",
    runningJobs: "Käynnissä olevat työt",
    conceptSets: "Käsitejoukot",
    activeCohorts: "Aktiiviset kohortit",
    descriptions: {
      cdmSources: "{{postgresqlCount}} PostgreSQL · {{personsText}}",
      persons: "{{count}} henkilöä",
      noCdmLoaded: "CDM:ää ei ole ladattu",
      runningJobs:
        "{{completedCount}} valmistunut hiljattain · {{failedCount}} epäonnistunut",
      conceptSets:
        "{{populatedTables}}/{{totalTables}} CDM-taulua täytetty · {{completeness}} % valmis",
      activeCohorts:
        "{{generatedCount}} luotu · {{conceptSetCount}} käsitejoukkoa",
    },
  },
  error: {
    title: "Koontinäytön tietoja ei voitu ladata",
    message:
      "API ei ehkä ole käytettävissä. Välimuistissa olevat tiedot näytetään, jos niitä on.",
  },
  cdm: {
    title: "CDM-karakterisointi",
    subtitle: "Valitun lähteen kliininen dataprofiili",
    viewFull: "Näytä kaikki",
    noSource: "Valitse tietolähde nähdäksesi karakterisoinnin",
    noDomainData: "Domeenitietoja ei ole saatavilla",
    metrics: {
      persons: "Henkilöt",
      medianObservationDuration: "Havaintoajan mediaani",
      medianObservationDurationValue: "{{count}} päivää",
      totalEvents: "Tapahtumia yhteensä",
      dataCompleteness: "Datan täydellisyys",
      tableCount: "{{populatedTables}}/{{totalTables}} taulua",
    },
    demographics: "Demografia",
    ageDistribution: "Ikäjakauma",
    noAgeDistributionData: "Ikäjakaumatietoja ei ole saatavilla",
    age: "Ikä",
    gender: {
      male: "Mies",
      female: "Nainen",
    },
    domainCounts: "CDM-domeenien määrät",
    domains: {
      conditionOccurrence: "Sairaudet",
      drugExposure: "Lääkealtistukset",
      procedureOccurrence: "Toimenpiteet",
      measurement: "Mittaukset",
      observation: "Havainnot",
      visitOccurrence: "Käynnit",
      drugEra: "Lääkejakso",
      conditionEra: "Sairausjakso",
      deviceExposure: "Laitteet",
      death: "Kuolemat",
    },
  },
  panels: {
    recentCohortActivity: "Viimeaikainen kohorttitoiminta",
    quickActions: "Pikatoiminnot",
    sourceHealth: "Lähteen tila",
    activeJobs: "Aktiiviset työt",
    viewAll: "Näytä kaikki",
  },
  tables: {
    cohort: "Kohortti",
    subjects: "Henkilöt",
    status: "Tila",
    source: "Lähde",
    dialect: "Murre",
    job: "Työ",
    type: "Tyyppi",
  },
  empty: {
    noCohortsTitle: "Ei vielä kohortteja",
    noCohortsMessage:
      "Luo ensimmäinen kohorttimäärityksesi aloittaaksesi tutkimuksen.",
    newCohort: "Uusi kohortti",
    noDataSourcesTitle: "Ei tietolähteitä",
    noDataSourcesMessage: "Yhdistä CDM-tietokanta aloittaaksesi.",
    addSource: "Lisää lähde",
    noActiveJobsTitle: "Ei aktiivisia töitä",
    noActiveJobsMessage:
      "Työt näkyvät täällä, kun analyyseja suoritetaan.",
  },
  quickActions: {
    connectDataSource: "Yhdistä tietolähde",
    createCohortDefinition: "Luo kohorttimääritys",
    buildConceptSet: "Rakenna käsitejoukko",
    exploreDataQuality: "Tutki datan laatua",
  },
  statuses: {
    healthy: "Terve",
    cohort: {
      active: "aktiivinen",
      error: "virhe",
      draft: "luonnos",
      pending: "odottaa",
    },
    job: {
      running: "käynnissä",
      completed: "valmis",
      failed: "epäonnistui",
      success: "onnistui",
      fail: "epäonnistui",
      queued: "jonossa",
    },
  },
});

const jaDashboard: MessageTree = mergeMessageTrees(enDashboard, {
  page: {
    title: "ダッシュボード",
    subtitle: "統合アウトカム研究プラットフォーム",
  },
  metrics: {
    cdmSources: "CDM ソース",
    runningJobs: "実行中のジョブ",
    conceptSets: "コンセプトセット",
    activeCohorts: "アクティブなコホート",
    descriptions: {
      cdmSources: "{{postgresqlCount}} PostgreSQL · {{personsText}}",
      persons: "{{count}} 人",
      noCdmLoaded: "CDM は読み込まれていません",
      runningJobs:
        "最近完了 {{completedCount}} 件 · 失敗 {{failedCount}} 件",
      conceptSets:
        "CDM テーブル {{populatedTables}}/{{totalTables}} 件入力済み · {{completeness}}% 完了",
      activeCohorts:
        "生成済み {{generatedCount}} 件 · コンセプトセット {{conceptSetCount}} 件",
    },
  },
  error: {
    title: "ダッシュボードデータを読み込めません",
    message:
      "API が利用できない可能性があります。利用可能な場合はキャッシュデータを表示します。",
  },
  cdm: {
    title: "CDM 特性評価",
    subtitle: "選択したソースの臨床データプロファイル",
    viewFull: "すべて表示",
    noSource: "特性評価を表示するにはデータソースを選択してください",
    noDomainData: "利用可能なドメインデータがありません",
    metrics: {
      persons: "対象者",
      medianObservationDuration: "観察期間中央値",
      medianObservationDurationValue: "{{count}} 日",
      totalEvents: "総イベント数",
      dataCompleteness: "データ完全性",
      tableCount: "{{populatedTables}}/{{totalTables}} テーブル",
    },
    demographics: "人口統計",
    ageDistribution: "年齢分布",
    noAgeDistributionData: "年齢分布データがありません",
    age: "年齢",
    gender: {
      male: "男性",
      female: "女性",
    },
    domainCounts: "CDM ドメイン件数",
    domains: {
      conditionOccurrence: "疾患",
      drugExposure: "薬剤曝露",
      procedureOccurrence: "処置",
      measurement: "測定",
      observation: "観察",
      visitOccurrence: "来院",
      drugEra: "薬剤期間",
      conditionEra: "疾患期間",
      deviceExposure: "デバイス",
      death: "死亡",
    },
  },
  panels: {
    recentCohortActivity: "最近のコホート活動",
    quickActions: "クイックアクション",
    sourceHealth: "ソース状態",
    activeJobs: "アクティブなジョブ",
    viewAll: "すべて表示",
  },
  tables: {
    cohort: "コホート",
    subjects: "対象者",
    status: "状態",
    source: "ソース",
    dialect: "方言",
    job: "ジョブ",
    type: "タイプ",
  },
  empty: {
    noCohortsTitle: "まだコホートがありません",
    noCohortsMessage: "研究を始めるには最初のコホート定義を作成してください。",
    newCohort: "新規コホート",
    noDataSourcesTitle: "データソースがありません",
    noDataSourcesMessage: "開始するには CDM データベースを接続してください。",
    addSource: "ソースを追加",
    noActiveJobsTitle: "アクティブなジョブはありません",
    noActiveJobsMessage:
      "解析が実行されると、ジョブがここに表示されます。",
  },
  quickActions: {
    connectDataSource: "データソースを接続",
    createCohortDefinition: "コホート定義を作成",
    buildConceptSet: "コンセプトセットを作成",
    exploreDataQuality: "データ品質を探索",
  },
  statuses: {
    healthy: "正常",
    cohort: {
      active: "アクティブ",
      error: "エラー",
      draft: "下書き",
      pending: "保留中",
    },
    job: {
      running: "実行中",
      completed: "完了",
      failed: "失敗",
      success: "成功",
      fail: "失敗",
      queued: "キュー済み",
    },
  },
});

const zhDashboard: MessageTree = mergeMessageTrees(enDashboard, {
  page: {
    title: "仪表板",
    subtitle: "统一的结局研究平台",
  },
  metrics: {
    cdmSources: "CDM 数据源",
    runningJobs: "运行中的作业",
    conceptSets: "概念集",
    activeCohorts: "活跃队列",
    descriptions: {
      cdmSources: "{{postgresqlCount}} PostgreSQL · {{personsText}}",
      persons: "{{count}} 人",
      noCdmLoaded: "未加载 CDM",
      runningJobs: "最近完成 {{completedCount}} 个 · 失败 {{failedCount}} 个",
      conceptSets:
        "已填充 {{populatedTables}}/{{totalTables}} 个 CDM 表 · 完成 {{completeness}}%",
      activeCohorts: "已生成 {{generatedCount}} 个 · 概念集 {{conceptSetCount}} 个",
    },
  },
  error: {
    title: "无法加载仪表板数据",
    message: "API 可能不可用。如有缓存数据，将显示缓存数据。",
  },
  cdm: {
    title: "CDM 特征描述",
    subtitle: "所选数据源的临床数据概况",
    viewFull: "查看全部",
    noSource: "选择数据源以查看特征描述",
    noDomainData: "没有可用的域数据",
    metrics: {
      persons: "人员",
      medianObservationDuration: "观察期中位数",
      medianObservationDurationValue: "{{count}} 天",
      totalEvents: "事件总数",
      dataCompleteness: "数据完整性",
      tableCount: "{{populatedTables}}/{{totalTables}} 个表",
    },
    demographics: "人口统计",
    ageDistribution: "年龄分布",
    noAgeDistributionData: "没有年龄分布数据",
    age: "年龄",
    gender: {
      male: "男性",
      female: "女性",
    },
    domainCounts: "CDM 域计数",
    domains: {
      conditionOccurrence: "疾病",
      drugExposure: "药物暴露",
      procedureOccurrence: "操作",
      measurement: "测量",
      observation: "观察",
      visitOccurrence: "就诊",
      drugEra: "药物时期",
      conditionEra: "疾病时期",
      deviceExposure: "器械",
      death: "死亡",
    },
  },
  panels: {
    recentCohortActivity: "最近的队列活动",
    quickActions: "快捷操作",
    sourceHealth: "数据源健康",
    activeJobs: "活跃作业",
    viewAll: "查看全部",
  },
  tables: {
    cohort: "队列",
    subjects: "对象",
    status: "状态",
    source: "数据源",
    dialect: "方言",
    job: "作业",
    type: "类型",
  },
  empty: {
    noCohortsTitle: "还没有队列",
    noCohortsMessage: "创建你的第一个队列定义以开始研究。",
    newCohort: "新建队列",
    noDataSourcesTitle: "没有数据源",
    noDataSourcesMessage: "连接 CDM 数据库以开始。",
    addSource: "添加数据源",
    noActiveJobsTitle: "没有活跃作业",
    noActiveJobsMessage: "分析运行时，作业会显示在这里。",
  },
  quickActions: {
    connectDataSource: "连接数据源",
    createCohortDefinition: "创建队列定义",
    buildConceptSet: "构建概念集",
    exploreDataQuality: "探索数据质量",
  },
  statuses: {
    healthy: "健康",
    cohort: {
      active: "活跃",
      error: "错误",
      draft: "草稿",
      pending: "待处理",
    },
    job: {
      running: "运行中",
      completed: "已完成",
      failed: "失败",
      success: "成功",
      fail: "失败",
      queued: "排队中",
    },
  },
});

const hiDashboard: MessageTree = mergeMessageTrees(enDashboard, {
  "page": {
    "title": "डैशबोर्ड",
    "subtitle": "एकीकृत परिणाम अनुसंधान मंच"
  },
  "metrics": {
    "cdmSources": "CDM स्रोत",
    "runningJobs": "चल रही नौकरियाँ",
    "conceptSets": "संकल्पना सेट",
    "activeCohorts": "सक्रिय समूह",
    "descriptions": {
      "cdmSources": "{{postgresqlCount}} PostgreSQL · {{personsText}}",
      "persons": "{{count}} व्यक्ति",
      "noCdmLoaded": "कोई CDM लोड नहीं हुआ",
      "runningJobs": "{{completedCount}} हाल ही में पूरा हुआ · {{failedCount}} विफल रहा",
      "conceptSets": "{{populatedTables}}/{{totalTables}} CDM तालिकाएँ भरी गईं · {{completeness}}% पूर्ण",
      "activeCohorts": "{{generatedCount}} उत्पन्न · {{conceptSetCount}} अवधारणा सेट"
    }
  },
  "error": {
    "title": "डैशबोर्ड डेटा लोड करने में असमर्थ",
    "message": "API अनुपलब्ध हो सकता है। यदि उपलब्ध हो तो कैश्ड डेटा प्रदर्शित करना।"
  },
  "cdm": {
    "title": "CDM लक्षण वर्णन",
    "subtitle": "चयनित स्रोत के लिए नैदानिक ​​डेटा प्रोफ़ाइल",
    "viewFull": "पूरा देखें",
    "noSource": "लक्षण वर्णन देखने के लिए डेटा स्रोत का चयन करें",
    "noDomainData": "कोई डोमेन डेटा उपलब्ध नहीं है",
    "metrics": {
      "persons": "व्यक्तियों",
      "medianObservationDuration": "माध्य अवलोकन अवधि",
      "medianObservationDurationValue": "{{count}} दिन",
      "totalEvents": "कुल घटनाएँ",
      "dataCompleteness": "डेटा पूर्णता",
      "tableCount": "{{populatedTables}}/{{totalTables}} तालिकाएँ"
    },
    "demographics": "जनसांख्यिकी",
    "ageDistribution": "आयु संवितरण",
    "noAgeDistributionData": "कोई आयु वितरण डेटा नहीं",
    "age": "आयु",
    "gender": {
      "male": "पुरुष",
      "female": "महिला"
    },
    "domainCounts": "CDM डोमेन गणना",
    "domains": {
      "conditionOccurrence": "स्थितियाँ",
      "drugExposure": "नशीली दवाओं का एक्सपोजर",
      "procedureOccurrence": "प्रक्रियाओं",
      "measurement": "मापन",
      "observation": "टिप्पणियों",
      "visitOccurrence": "दौरा",
      "drugEra": "औषध युग",
      "conditionEra": "शर्त युग",
      "deviceExposure": "उपकरण",
      "death": "मौतें"
    }
  },
  "panels": {
    "recentCohortActivity": "हाल की समूह गतिविधि",
    "quickActions": "त्वरित कार्रवाई",
    "sourceHealth": "स्रोत स्वास्थ्य",
    "activeJobs": "सक्रिय नौकरियाँ",
    "viewAll": "सभी को देखें"
  },
  "tables": {
    "cohort": "समूह",
    "subjects": "विषयों",
    "status": "स्थिति",
    "source": "स्रोत",
    "dialect": "बोली",
    "job": "काम",
    "type": "प्रकार"
  },
  "empty": {
    "noCohortsTitle": "अभी तक कोई दल नहीं",
    "noCohortsMessage": "अनुसंधान शुरू करने के लिए अपनी पहली समूह परिभाषा बनाएं।",
    "newCohort": "नया समूह",
    "noDataSourcesTitle": "कोई डेटा स्रोत नहीं",
    "noDataSourcesMessage": "आरंभ करने के लिए CDM डेटाबेस कनेक्ट करें।",
    "addSource": "स्रोत जोड़ें",
    "noActiveJobsTitle": "कोई सक्रिय नौकरियाँ नहीं",
    "noActiveJobsMessage": "जब विश्लेषण चल रहा होगा तो नौकरियाँ यहाँ दिखाई देंगी।"
  },
  "quickActions": {
    "connectDataSource": "डेटा स्रोत कनेक्ट करें",
    "createCohortDefinition": "समूह परिभाषा बनाएँ",
    "buildConceptSet": "कॉन्सेप्ट सेट बनाएं",
    "exploreDataQuality": "डेटा गुणवत्ता का अन्वेषण करें"
  },
  "statuses": {
    "healthy": "स्वस्थ",
    "cohort": {
      "active": "सक्रिय",
      "error": "गलती",
      "draft": "मसौदा",
      "pending": "लंबित"
    },
    "job": {
      "running": "दौड़ना",
      "completed": "पुरा होना",
      "failed": "असफल",
      "success": "सफलता",
      "fail": "असफल",
      "queued": "कतारबद्ध"
    }
  }
});


export const dashboardResources: Record<string, MessageTree> = {
  "en-US": enDashboard,
  "es-ES": esDashboard,
  "fr-FR": frDashboard,
  "de-DE": deDashboard,
  "pt-BR": ptDashboard,
  "fi-FI": fiDashboard,
  "ja-JP": jaDashboard,
  "zh-Hans": zhDashboard,
  "ko-KR": koDashboard,
  "hi-IN": hiDashboard,
};
