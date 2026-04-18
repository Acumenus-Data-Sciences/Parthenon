type MessageTree = {
  [key: string]: string | MessageTree;
};

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

export const dashboardResources: Record<string, MessageTree> = {
  "en-US": enDashboard,
  "es-ES": esDashboard,
  "ko-KR": koDashboard,
};
