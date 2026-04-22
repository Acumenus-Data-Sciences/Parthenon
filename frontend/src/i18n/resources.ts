import type { Resource } from "i18next";
import { analysisResources } from "./analysisResources";
import { appResources } from "./appResources";
import { cohortDefinitionResources } from "./cohortDefinitionResources";
import { conceptSetResources } from "./conceptSetResources";
import { commonsResources } from "./commonsResources";
import { dashboardResources } from "./dashboardResources";
import { dataSourceIngestionResources } from "./dataSourceIngestionResources";
import { etlAqueductResources } from "./etlAqueductResources";
import { gisToolsResources } from "./gisToolsResources";
import { heorResources } from "./heorResources";
import { imagingGenomicsResources } from "./imagingGenomicsResources";
import { investigationResources } from "./investigationResources";
import { morpheusResources } from "./morpheusResources";
import { profileSimilarityResources } from "./profileSimilarityResources";
import { publishCareGapRiskResources } from "./publishCareGapRiskResources";
import { smallWorkbenchResources } from "./smallWorkbenchResources";
import { standardProsResources } from "./standardProsResources";
import { strategusResources } from "./strategusResources";

type MessageTree = {
  [key: string]: string | MessageTree;
};

type ParthenonNamespaces = {
  common: MessageTree;
  layout: MessageTree;
};

const enUS: ParthenonNamespaces = {
  common: {
    appName: "Parthenon",
    companyFull: "Acumenus Data Sciences",
    companyShort: "ADS",
    actions: {
      login: "Login",
      logout: "Logout",
      settings: "Settings",
    },
  },
  layout: {
    header: {
      searchPlaceholder: "Search or jump to...",
      searchShortcut: "Ctrl K",
      aboutAbby: "About Abby",
      aiAssistant: "AI Assistant",
      notifications: "Notifications",
    },
    language: {
      preferred: "Preferred language",
      saveFailed: "Language preference could not be saved.",
    },
    source: {
      select: "Select source",
    },
    theme: {
      switchToDark: "Switch to dark mode",
      switchToLight: "Switch to light mode",
    },
    sidebar: {
      collapse: "Collapse sidebar",
      expand: "Expand sidebar",
      help: "Help",
      openHelp: "Open contextual help",
    },
    command: {
      dialogLabel: "Command palette",
      placeholder: "Type a command or search...",
      searching: "Searching...",
      noResults: "No results found",
      groups: {
        navigation: "Navigation",
        actions: "Actions",
        searchResults: "Search Results",
      },
      openAiAssistant: "Open AI Assistant",
    },
    nav: {
      dashboard: "Dashboard",
      commons: "Commons",
      data: "Data",
      clinicalDataModels: "Clinical Data Models",
      dataIngestion: "Data Ingestion",
      dataExplorer: "Data Explorer",
      vocabulary: "Vocabulary",
      vocabularySearch: "Vocabulary Search",
      mappingAssistant: "Mapping Assistant",
      research: "Research",
      cohortDefinitions: "Cohort Definitions",
      conceptSets: "Concept Sets",
      analyses: "Analyses",
      studies: "Studies",
      studyDesigner: "Study Designer",
      studyPackages: "Study Packages",
      phenotypeLibrary: "Phenotype Library",
      evidence: "Evidence",
      patientProfiles: "Patient Profiles",
      patientSimilarity: "Patient Similarity",
      riskScores: "Risk Scores",
      standardPros: "Standard PROs+",
      genomics: "Genomics",
      imaging: "Imaging",
      heor: "HEOR",
      gisExplorer: "GIS Explorer",
      tools: "Tools",
      jupyter: "Jupyter",
      workbench: "Workbench",
      queryAssistant: "Query Assistant",
      publish: "Publish",
      jobs: "Jobs",
      administration: "Administration",
      adminDashboard: "Admin Dashboard",
      systemHealth: "System Health",
      honestBroker: "Honest Broker",
      users: "Users",
      auditLog: "Audit Log",
      rolesPermissions: "Roles & Permissions",
      authProviders: "Auth Providers",
      notifications: "Notifications",
    },
  },
};

const esES: ParthenonNamespaces = {
  common: {
    appName: "Parthenon",
    companyFull: "Acumenus Data Sciences",
    companyShort: "ADS",
    actions: {
      login: "Iniciar sesión",
      logout: "Cerrar sesión",
      settings: "Configuración",
    },
  },
  layout: {
    header: {
      searchPlaceholder: "Buscar o ir a...",
      searchShortcut: "Ctrl K",
      aboutAbby: "Acerca de Abby",
      aiAssistant: "Asistente de IA",
      notifications: "Notificaciones",
    },
    language: {
      preferred: "Idioma preferido",
      saveFailed: "No se pudo guardar la preferencia de idioma.",
    },
    source: {
      select: "Seleccionar fuente",
    },
    theme: {
      switchToDark: "Cambiar al modo oscuro",
      switchToLight: "Cambiar al modo claro",
    },
    sidebar: {
      collapse: "Contraer barra lateral",
      expand: "Expandir barra lateral",
      help: "Ayuda",
      openHelp: "Abrir ayuda contextual",
    },
    command: {
      dialogLabel: "Paleta de comandos",
      placeholder: "Escribe un comando o busca...",
      searching: "Buscando...",
      noResults: "No se encontraron resultados",
      groups: {
        navigation: "Navegación",
        actions: "Acciones",
        searchResults: "Resultados de búsqueda",
      },
      openAiAssistant: "Abrir asistente de IA",
    },
    nav: {
      dashboard: "Panel",
      commons: "Commons",
      data: "Datos",
      clinicalDataModels: "Modelos de datos clínicos",
      dataIngestion: "Ingesta de datos",
      dataExplorer: "Explorador de datos",
      vocabulary: "Vocabulario",
      vocabularySearch: "Búsqueda de vocabulario",
      mappingAssistant: "Asistente de mapeo",
      research: "Investigación",
      cohortDefinitions: "Definiciones de cohortes",
      conceptSets: "Conjuntos de conceptos",
      analyses: "Análisis",
      studies: "Estudios",
      studyDesigner: "Diseñador de estudios",
      studyPackages: "Paquetes de estudio",
      phenotypeLibrary: "Biblioteca de fenotipos",
      evidence: "Evidencia",
      patientProfiles: "Perfiles de pacientes",
      patientSimilarity: "Similitud de pacientes",
      riskScores: "Puntuaciones de riesgo",
      standardPros: "PROs estándar+",
      genomics: "Genómica",
      imaging: "Imágenes",
      heor: "HEOR",
      gisExplorer: "Explorador GIS",
      tools: "Herramientas",
      jupyter: "Jupyter",
      workbench: "Banco de trabajo",
      queryAssistant: "Asistente de consultas",
      publish: "Publicar",
      jobs: "Trabajos",
      administration: "Administración",
      adminDashboard: "Panel de administración",
      systemHealth: "Estado del sistema",
      honestBroker: "Intermediario honesto",
      users: "Usuarios",
      auditLog: "Registro de auditoría",
      rolesPermissions: "Roles y permisos",
      authProviders: "Proveedores de autenticación",
      notifications: "Notificaciones",
    },
  },
};

const frFR: ParthenonNamespaces = {
  common: {
    appName: "Parthenon",
    companyFull: "Acumenus Data Sciences",
    companyShort: "ADS",
    actions: {
      login: "Connexion",
      logout: "Déconnexion",
      settings: "Paramètres",
    },
  },
  layout: {
    header: {
      searchPlaceholder: "Rechercher ou aller à...",
      searchShortcut: "Ctrl K",
      aboutAbby: "À propos d'Abby",
      aiAssistant: "Assistant IA",
      notifications: "Notifications",
    },
    language: {
      preferred: "Langue préférée",
      saveFailed: "La préférence de langue n'a pas pu être enregistrée.",
    },
    source: {
      select: "Sélectionner une source",
    },
    theme: {
      switchToDark: "Passer au mode sombre",
      switchToLight: "Passer au mode clair",
    },
    sidebar: {
      collapse: "Réduire la barre latérale",
      expand: "Développer la barre latérale",
      help: "Aide",
      openHelp: "Ouvrir l'aide contextuelle",
    },
    command: {
      dialogLabel: "Palette de commandes",
      placeholder: "Saisir une commande ou rechercher...",
      searching: "Recherche...",
      noResults: "Aucun résultat trouvé",
      groups: {
        navigation: "Navigation",
        actions: "Actions",
        searchResults: "Résultats de recherche",
      },
      openAiAssistant: "Ouvrir l'assistant IA",
    },
    nav: {
      dashboard: "Tableau de bord",
      commons: "Commons",
      data: "Données",
      clinicalDataModels: "Modèles de données cliniques",
      dataIngestion: "Ingestion de données",
      dataExplorer: "Explorateur de données",
      vocabulary: "Vocabulaire",
      vocabularySearch: "Recherche de vocabulaire",
      mappingAssistant: "Assistant de correspondance",
      research: "Recherche",
      cohortDefinitions: "Définitions de cohortes",
      conceptSets: "Ensembles de concepts",
      analyses: "Analyses",
      studies: "Études",
      studyDesigner: "Concepteur d'études",
      studyPackages: "Paquets d'étude",
      phenotypeLibrary: "Bibliothèque de phénotypes",
      evidence: "Preuves",
      patientProfiles: "Profils de patients",
      patientSimilarity: "Similarité des patients",
      riskScores: "Scores de risque",
      standardPros: "PROs standard+",
      genomics: "Génomique",
      imaging: "Imagerie",
      heor: "HEOR",
      gisExplorer: "Explorateur SIG",
      tools: "Outils",
      jupyter: "Jupyter",
      workbench: "Atelier",
      queryAssistant: "Assistant de requêtes",
      publish: "Publier",
      jobs: "Tâches",
      administration: "Administration",
      adminDashboard: "Tableau de bord admin",
      systemHealth: "Santé du système",
      honestBroker: "Courtier honnête",
      users: "Utilisateurs",
      auditLog: "Journal d'audit",
      rolesPermissions: "Rôles et permissions",
      authProviders: "Fournisseurs d'authentification",
      notifications: "Notifications",
    },
  },
};

const deDE: ParthenonNamespaces = {
  common: {
    appName: "Parthenon",
    companyFull: "Acumenus Data Sciences",
    companyShort: "ADS",
    actions: {
      login: "Anmelden",
      logout: "Abmelden",
      settings: "Einstellungen",
    },
  },
  layout: {
    header: {
      searchPlaceholder: "Suchen oder springen zu...",
      searchShortcut: "Strg K",
      aboutAbby: "Über Abby",
      aiAssistant: "KI-Assistent",
      notifications: "Benachrichtigungen",
    },
    language: {
      preferred: "Bevorzugte Sprache",
      saveFailed: "Die Spracheinstellung konnte nicht gespeichert werden.",
    },
    source: {
      select: "Quelle auswählen",
    },
    theme: {
      switchToDark: "Zum dunklen Modus wechseln",
      switchToLight: "Zum hellen Modus wechseln",
    },
    sidebar: {
      collapse: "Seitenleiste einklappen",
      expand: "Seitenleiste ausklappen",
      help: "Hilfe",
      openHelp: "Kontexthilfe öffnen",
    },
    command: {
      dialogLabel: "Befehlspalette",
      placeholder: "Befehl eingeben oder suchen...",
      searching: "Suche...",
      noResults: "Keine Ergebnisse gefunden",
      groups: {
        navigation: "Navigation",
        actions: "Aktionen",
        searchResults: "Suchergebnisse",
      },
      openAiAssistant: "KI-Assistent öffnen",
    },
    nav: {
      dashboard: "Dashboard",
      commons: "Commons",
      data: "Daten",
      clinicalDataModels: "Klinische Datenmodelle",
      dataIngestion: "Datenaufnahme",
      dataExplorer: "Daten-Explorer",
      vocabulary: "Vokabular",
      vocabularySearch: "Vokabularsuche",
      mappingAssistant: "Mapping-Assistent",
      research: "Forschung",
      cohortDefinitions: "Kohortendefinitionen",
      conceptSets: "Konzeptsets",
      analyses: "Analysen",
      studies: "Studien",
      studyDesigner: "Studiendesigner",
      studyPackages: "Studienpakete",
      phenotypeLibrary: "Phänotyp-Bibliothek",
      evidence: "Evidenz",
      patientProfiles: "Patientenprofile",
      patientSimilarity: "Patientenähnlichkeit",
      riskScores: "Risikowerte",
      standardPros: "Standard-PROs+",
      genomics: "Genomik",
      imaging: "Bildgebung",
      heor: "HEOR",
      gisExplorer: "GIS-Explorer",
      tools: "Werkzeuge",
      jupyter: "Jupyter",
      workbench: "Arbeitsbereich",
      queryAssistant: "Abfrageassistent",
      publish: "Veröffentlichen",
      jobs: "Jobs",
      administration: "Administration",
      adminDashboard: "Admin-Dashboard",
      systemHealth: "Systemzustand",
      honestBroker: "Honest Broker",
      users: "Benutzer",
      auditLog: "Auditprotokoll",
      rolesPermissions: "Rollen & Berechtigungen",
      authProviders: "Auth-Anbieter",
      notifications: "Benachrichtigungen",
    },
  },
};

const ptBR: ParthenonNamespaces = {
  common: {
    appName: "Parthenon",
    companyFull: "Acumenus Data Sciences",
    companyShort: "ADS",
    actions: {
      login: "Entrar",
      logout: "Sair",
      settings: "Configurações",
    },
  },
  layout: {
    header: {
      searchPlaceholder: "Pesquisar ou ir para...",
      searchShortcut: "Ctrl K",
      aboutAbby: "Sobre a Abby",
      aiAssistant: "Assistente de IA",
      notifications: "Notificações",
    },
    language: {
      preferred: "Idioma preferido",
      saveFailed: "Não foi possível salvar a preferência de idioma.",
    },
    source: {
      select: "Selecionar fonte",
    },
    theme: {
      switchToDark: "Alternar para modo escuro",
      switchToLight: "Alternar para modo claro",
    },
    sidebar: {
      collapse: "Recolher barra lateral",
      expand: "Expandir barra lateral",
      help: "Ajuda",
      openHelp: "Abrir ajuda contextual",
    },
    command: {
      dialogLabel: "Paleta de comandos",
      placeholder: "Digite um comando ou pesquise...",
      searching: "Pesquisando...",
      noResults: "Nenhum resultado encontrado",
      groups: {
        navigation: "Navegação",
        actions: "Ações",
        searchResults: "Resultados da pesquisa",
      },
      openAiAssistant: "Abrir assistente de IA",
    },
    nav: {
      dashboard: "Painel",
      commons: "Commons",
      data: "Dados",
      clinicalDataModels: "Modelos de dados clínicos",
      dataIngestion: "Ingestão de dados",
      dataExplorer: "Explorador de dados",
      vocabulary: "Vocabulário",
      vocabularySearch: "Busca de vocabulário",
      mappingAssistant: "Assistente de mapeamento",
      research: "Pesquisa",
      cohortDefinitions: "Definições de coortes",
      conceptSets: "Conjuntos de conceitos",
      analyses: "Análises",
      studies: "Estudos",
      studyDesigner: "Designer de estudos",
      studyPackages: "Pacotes de estudo",
      phenotypeLibrary: "Biblioteca de fenótipos",
      evidence: "Evidência",
      patientProfiles: "Perfis de pacientes",
      patientSimilarity: "Similaridade de pacientes",
      riskScores: "Scores de risco",
      standardPros: "PROs padrão+",
      genomics: "Genômica",
      imaging: "Imagem",
      heor: "HEOR",
      gisExplorer: "Explorador GIS",
      tools: "Ferramentas",
      jupyter: "Jupyter",
      workbench: "Workbench",
      queryAssistant: "Assistente de consultas",
      publish: "Publicar",
      jobs: "Tarefas",
      administration: "Administração",
      adminDashboard: "Painel administrativo",
      systemHealth: "Saúde do sistema",
      honestBroker: "Intermediário honesto",
      users: "Usuários",
      auditLog: "Log de auditoria",
      rolesPermissions: "Funções e permissões",
      authProviders: "Provedores de autenticação",
      notifications: "Notificações",
    },
  },
};

const fiFI: ParthenonNamespaces = {
  common: {
    appName: "Parthenon",
    companyFull: "Acumenus Data Sciences",
    companyShort: "ADS",
    actions: {
      login: "Kirjaudu sisään",
      logout: "Kirjaudu ulos",
      settings: "Asetukset",
    },
  },
  layout: {
    header: {
      searchPlaceholder: "Hae tai siirry...",
      searchShortcut: "Ctrl K",
      aboutAbby: "Tietoja Abbysta",
      aiAssistant: "Tekoälyavustaja",
      notifications: "Ilmoitukset",
    },
    language: {
      preferred: "Ensisijainen kieli",
      saveFailed: "Kieliasetusta ei voitu tallentaa.",
    },
    source: {
      select: "Valitse lähde",
    },
    theme: {
      switchToDark: "Vaihda tummaan tilaan",
      switchToLight: "Vaihda vaaleaan tilaan",
    },
    sidebar: {
      collapse: "Pienennä sivupalkki",
      expand: "Laajenna sivupalkki",
      help: "Ohje",
      openHelp: "Avaa kontekstiohje",
    },
    command: {
      dialogLabel: "Komentopaletti",
      placeholder: "Kirjoita komento tai hae...",
      searching: "Haetaan...",
      noResults: "Tuloksia ei löytynyt",
      groups: {
        navigation: "Navigointi",
        actions: "Toiminnot",
        searchResults: "Hakutulokset",
      },
      openAiAssistant: "Avaa tekoälyavustaja",
    },
    nav: {
      dashboard: "Koontinäyttö",
      commons: "Commons",
      data: "Data",
      clinicalDataModels: "Kliiniset tietomallit",
      dataIngestion: "Datan tuonti",
      dataExplorer: "Data Explorer",
      vocabulary: "Sanasto",
      vocabularySearch: "Sanastohaku",
      mappingAssistant: "Kartoitusavustaja",
      research: "Tutkimus",
      cohortDefinitions: "Kohorttimääritykset",
      conceptSets: "Käsitejoukot",
      analyses: "Analyysit",
      studies: "Tutkimukset",
      studyDesigner: "Tutkimussuunnittelija",
      studyPackages: "Tutkimuspaketit",
      phenotypeLibrary: "Fenotyyppikirjasto",
      evidence: "Näyttö",
      patientProfiles: "Potilasprofiilit",
      patientSimilarity: "Potilaiden samankaltaisuus",
      riskScores: "Riskipisteet",
      standardPros: "Vakio-PROt+",
      genomics: "Genomiikka",
      imaging: "Kuvantaminen",
      heor: "HEOR",
      gisExplorer: "GIS Explorer",
      tools: "Työkalut",
      jupyter: "Jupyter",
      workbench: "Workbench",
      queryAssistant: "Kyselyavustaja",
      publish: "Julkaise",
      jobs: "Työt",
      administration: "Hallinta",
      adminDashboard: "Hallintapaneeli",
      systemHealth: "Järjestelmän tila",
      honestBroker: "Honest Broker",
      users: "Käyttäjät",
      auditLog: "Auditointiloki",
      rolesPermissions: "Roolit ja käyttöoikeudet",
      authProviders: "Tunnistautumisen tarjoajat",
      notifications: "Ilmoitukset",
    },
  },
};

const jaJP: ParthenonNamespaces = {
  common: {
    appName: "Parthenon",
    companyFull: "Acumenus Data Sciences",
    companyShort: "ADS",
    actions: {
      login: "ログイン",
      logout: "ログアウト",
      settings: "設定",
    },
  },
  layout: {
    header: {
      searchPlaceholder: "検索または移動...",
      searchShortcut: "Ctrl K",
      aboutAbby: "Abby について",
      aiAssistant: "AI アシスタント",
      notifications: "通知",
    },
    language: {
      preferred: "優先言語",
      saveFailed: "言語設定を保存できませんでした。",
    },
    source: {
      select: "ソースを選択",
    },
    theme: {
      switchToDark: "ダークモードに切り替え",
      switchToLight: "ライトモードに切り替え",
    },
    sidebar: {
      collapse: "サイドバーを折りたたむ",
      expand: "サイドバーを展開",
      help: "ヘルプ",
      openHelp: "コンテキストヘルプを開く",
    },
    command: {
      dialogLabel: "コマンドパレット",
      placeholder: "コマンドを入力または検索...",
      searching: "検索中...",
      noResults: "結果が見つかりません",
      groups: {
        navigation: "ナビゲーション",
        actions: "アクション",
        searchResults: "検索結果",
      },
      openAiAssistant: "AI アシスタントを開く",
    },
    nav: {
      dashboard: "ダッシュボード",
      commons: "Commons",
      data: "データ",
      clinicalDataModels: "臨床データモデル",
      dataIngestion: "データ取り込み",
      dataExplorer: "データエクスプローラー",
      vocabulary: "語彙",
      vocabularySearch: "語彙検索",
      mappingAssistant: "マッピングアシスタント",
      research: "研究",
      cohortDefinitions: "コホート定義",
      conceptSets: "コンセプトセット",
      analyses: "解析",
      studies: "研究",
      studyDesigner: "研究デザイナー",
      studyPackages: "研究パッケージ",
      phenotypeLibrary: "表現型ライブラリ",
      evidence: "エビデンス",
      patientProfiles: "患者プロファイル",
      patientSimilarity: "患者類似性",
      riskScores: "リスクスコア",
      standardPros: "標準 PROs+",
      genomics: "ゲノミクス",
      imaging: "画像",
      heor: "HEOR",
      gisExplorer: "GIS エクスプローラー",
      tools: "ツール",
      jupyter: "Jupyter",
      workbench: "ワークベンチ",
      queryAssistant: "クエリアシスタント",
      publish: "公開",
      jobs: "ジョブ",
      administration: "管理",
      adminDashboard: "管理ダッシュボード",
      systemHealth: "システム状態",
      honestBroker: "Honest Broker",
      users: "ユーザー",
      auditLog: "監査ログ",
      rolesPermissions: "ロールと権限",
      authProviders: "認証プロバイダー",
      notifications: "通知",
    },
  },
};

const zhHans: ParthenonNamespaces = {
  common: {
    appName: "Parthenon",
    companyFull: "Acumenus Data Sciences",
    companyShort: "ADS",
    actions: {
      login: "登录",
      logout: "退出登录",
      settings: "设置",
    },
  },
  layout: {
    header: {
      searchPlaceholder: "搜索或跳转到...",
      searchShortcut: "Ctrl K",
      aboutAbby: "关于 Abby",
      aiAssistant: "AI 助手",
      notifications: "通知",
    },
    language: {
      preferred: "首选语言",
      saveFailed: "无法保存语言偏好。",
    },
    source: {
      select: "选择来源",
    },
    theme: {
      switchToDark: "切换到深色模式",
      switchToLight: "切换到浅色模式",
    },
    sidebar: {
      collapse: "折叠侧边栏",
      expand: "展开侧边栏",
      help: "帮助",
      openHelp: "打开上下文帮助",
    },
    command: {
      dialogLabel: "命令面板",
      placeholder: "输入命令或搜索...",
      searching: "正在搜索...",
      noResults: "未找到结果",
      groups: {
        navigation: "导航",
        actions: "操作",
        searchResults: "搜索结果",
      },
      openAiAssistant: "打开 AI 助手",
    },
    nav: {
      dashboard: "仪表板",
      commons: "Commons",
      data: "数据",
      clinicalDataModels: "临床数据模型",
      dataIngestion: "数据导入",
      dataExplorer: "数据浏览器",
      vocabulary: "词汇",
      vocabularySearch: "词汇搜索",
      mappingAssistant: "映射助手",
      research: "研究",
      cohortDefinitions: "队列定义",
      conceptSets: "概念集",
      analyses: "分析",
      studies: "研究",
      studyDesigner: "研究设计器",
      studyPackages: "研究包",
      phenotypeLibrary: "表型库",
      evidence: "证据",
      patientProfiles: "患者档案",
      patientSimilarity: "患者相似性",
      riskScores: "风险评分",
      standardPros: "标准 PROs+",
      genomics: "基因组学",
      imaging: "影像",
      heor: "HEOR",
      gisExplorer: "GIS 浏览器",
      tools: "工具",
      jupyter: "Jupyter",
      workbench: "工作台",
      queryAssistant: "查询助手",
      publish: "发布",
      jobs: "作业",
      administration: "管理",
      adminDashboard: "管理仪表板",
      systemHealth: "系统健康",
      honestBroker: "Honest Broker",
      users: "用户",
      auditLog: "审计日志",
      rolesPermissions: "角色和权限",
      authProviders: "身份认证提供方",
      notifications: "通知",
    },
  },
};

const koKR: ParthenonNamespaces = {
  common: {
    appName: "Parthenon",
    companyFull: "Acumenus Data Sciences",
    companyShort: "ADS",
    actions: {
      login: "로그인",
      logout: "로그아웃",
      settings: "설정",
    },
  },
  layout: {
    header: {
      searchPlaceholder: "검색하거나 이동...",
      searchShortcut: "Ctrl K",
      aboutAbby: "Abby 소개",
      aiAssistant: "AI 어시스턴트",
      notifications: "알림",
    },
    language: {
      preferred: "기본 언어",
      saveFailed: "언어 환경설정을 저장할 수 없습니다.",
    },
    source: {
      select: "소스 선택",
    },
    theme: {
      switchToDark: "다크 모드로 전환",
      switchToLight: "라이트 모드로 전환",
    },
    sidebar: {
      collapse: "사이드바 접기",
      expand: "사이드바 펼치기",
      help: "도움말",
      openHelp: "상황별 도움말 열기",
    },
    command: {
      dialogLabel: "명령 팔레트",
      placeholder: "명령을 입력하거나 검색...",
      searching: "검색 중...",
      noResults: "결과가 없습니다",
      groups: {
        navigation: "탐색",
        actions: "작업",
        searchResults: "검색 결과",
      },
      openAiAssistant: "AI 어시스턴트 열기",
    },
    nav: {
      dashboard: "대시보드",
      commons: "공유재",
      data: "데이터",
      clinicalDataModels: "임상 데이터 모델",
      dataIngestion: "데이터 수집",
      dataExplorer: "데이터 탐색기",
      vocabulary: "어휘",
      vocabularySearch: "어휘 검색",
      mappingAssistant: "매핑 어시스턴트",
      research: "연구",
      cohortDefinitions: "코호트 정의",
      conceptSets: "개념 세트",
      analyses: "분석",
      studies: "연구",
      studyDesigner: "연구 디자이너",
      studyPackages: "연구 패키지",
      phenotypeLibrary: "표현형 라이브러리",
      evidence: "근거",
      patientProfiles: "환자 프로필",
      patientSimilarity: "환자 유사도",
      riskScores: "위험 점수",
      standardPros: "표준 PROs+",
      genomics: "유전체학",
      imaging: "이미징",
      heor: "HEOR",
      gisExplorer: "GIS 탐색기",
      tools: "도구",
      jupyter: "Jupyter",
      workbench: "워크벤치",
      queryAssistant: "쿼리 어시스턴트",
      publish: "게시",
      jobs: "작업",
      administration: "관리",
      adminDashboard: "관리 대시보드",
      systemHealth: "시스템 상태",
      honestBroker: "정직한 중개인",
      users: "사용자",
      auditLog: "감사 로그",
      rolesPermissions: "역할 및 권한",
      authProviders: "인증 제공자",
      notifications: "알림",
    },
  },
};

const hiIN: ParthenonNamespaces = {
  common: {
    appName: "Parthenon",
    companyFull: "Acumenus Data Sciences",
    companyShort: "ADS",
    actions: {
      login: "लॉग इन",
      logout: "लॉग आउट",
      settings: "सेटिंग्स",
    },
  },
  layout: {
    header: {
      searchPlaceholder: "खोजें या जाएं...",
      searchShortcut: "Ctrl K",
      aboutAbby: "Abby के बारे में",
      aiAssistant: "AI सहायक",
      notifications: "सूचनाएं",
    },
    language: {
      preferred: "पसंदीदा भाषा",
      saveFailed: "भाषा प्राथमिकता सहेजी नहीं जा सकी.",
    },
    source: {
      select: "स्रोत चुनें",
    },
    theme: {
      switchToDark: "डार्क मोड पर जाएं",
      switchToLight: "लाइट मोड पर जाएं",
    },
    sidebar: {
      collapse: "साइडबार संकुचित करें",
      expand: "साइडबार फैलाएं",
      help: "सहायता",
      openHelp: "संदर्भ सहायता खोलें",
    },
    command: {
      dialogLabel: "कमांड पैलेट",
      placeholder: "कमांड लिखें या खोजें...",
      searching: "खोज रहे हैं...",
      noResults: "कोई परिणाम नहीं मिला",
      groups: {
        navigation: "नेविगेशन",
        actions: "क्रियाएं",
        searchResults: "खोज परिणाम",
      },
      openAiAssistant: "AI सहायक खोलें",
    },
    nav: {
      dashboard: "डैशबोर्ड",
      commons: "Commons",
      data: "डेटा",
      clinicalDataModels: "क्लिनिकल डेटा मॉडल",
      dataIngestion: "डेटा इनजेशन",
      dataExplorer: "डेटा एक्सप्लोरर",
      vocabulary: "शब्दावली",
      vocabularySearch: "शब्दावली खोज",
      mappingAssistant: "मैपिंग सहायक",
      research: "अनुसंधान",
      cohortDefinitions: "कोहोर्ट परिभाषाएं",
      conceptSets: "कॉन्सेप्ट सेट",
      analyses: "विश्लेषण",
      studies: "अध्ययन",
      studyDesigner: "अध्ययन डिज़ाइनर",
      studyPackages: "अध्ययन पैकेज",
      phenotypeLibrary: "फीनोटाइप लाइब्रेरी",
      evidence: "साक्ष्य",
      patientProfiles: "रोगी प्रोफाइल",
      patientSimilarity: "रोगी समानता",
      riskScores: "जोखिम स्कोर",
      standardPros: "मानक PROs+",
      genomics: "जीनोमिक्स",
      imaging: "इमेजिंग",
      heor: "HEOR",
      gisExplorer: "GIS एक्सप्लोरर",
      tools: "टूल्स",
      jupyter: "Jupyter",
      workbench: "वर्कबेंच",
      queryAssistant: "क्वेरी सहायक",
      publish: "प्रकाशित करें",
      jobs: "जॉब्स",
      administration: "प्रशासन",
      adminDashboard: "एडमिन डैशबोर्ड",
      systemHealth: "सिस्टम स्वास्थ्य",
      honestBroker: "Honest Broker",
      users: "उपयोगकर्ता",
      auditLog: "ऑडिट लॉग",
      rolesPermissions: "भूमिकाएं और अनुमतियां",
      authProviders: "प्रमाणीकरण प्रदाता",
      notifications: "सूचनाएं",
    },
  },
};

const ar: ParthenonNamespaces = {
  common: {
    appName: "Parthenon",
    companyFull: "Acumenus Data Sciences",
    companyShort: "ADS",
    actions: {
      login: "تسجيل الدخول",
      logout: "تسجيل الخروج",
      settings: "الإعدادات",
    },
  },
  layout: {
    header: {
      searchPlaceholder: "ابحث أو انتقل إلى...",
      searchShortcut: "Ctrl K",
      aboutAbby: "حول Abby",
      aiAssistant: "مساعد الذكاء الاصطناعي",
      notifications: "الإشعارات",
    },
    language: {
      preferred: "اللغة المفضلة",
      saveFailed: "تعذر حفظ تفضيل اللغة.",
    },
    source: {
      select: "اختر المصدر",
    },
    theme: {
      switchToDark: "التبديل إلى الوضع الداكن",
      switchToLight: "التبديل إلى الوضع الفاتح",
    },
    sidebar: {
      collapse: "طي الشريط الجانبي",
      expand: "توسيع الشريط الجانبي",
      help: "المساعدة",
      openHelp: "فتح المساعدة السياقية",
    },
    command: {
      dialogLabel: "لوحة الأوامر",
      placeholder: "اكتب أمرا أو ابحث...",
      searching: "جار البحث...",
      noResults: "لم يتم العثور على نتائج",
      groups: {
        navigation: "التنقل",
        actions: "الإجراءات",
        searchResults: "نتائج البحث",
      },
      openAiAssistant: "فتح مساعد الذكاء الاصطناعي",
    },
    nav: {
      dashboard: "لوحة المعلومات",
      commons: "Commons",
      data: "البيانات",
      clinicalDataModels: "نماذج البيانات السريرية",
      dataIngestion: "استيعاب البيانات",
      dataExplorer: "مستكشف البيانات",
      vocabulary: "المفردات",
      vocabularySearch: "بحث المفردات",
      mappingAssistant: "مساعد المطابقة",
      research: "الأبحاث",
      cohortDefinitions: "تعريفات المجموعات",
      conceptSets: "مجموعات المفاهيم",
      analyses: "التحليلات",
      studies: "الدراسات",
      studyDesigner: "مصمم الدراسات",
      studyPackages: "حزم الدراسات",
      phenotypeLibrary: "مكتبة الأنماط الظاهرية",
      evidence: "الأدلة",
      patientProfiles: "ملفات المرضى",
      patientSimilarity: "تشابه المرضى",
      riskScores: "درجات المخاطر",
      standardPros: "PROs القياسية+",
      genomics: "الجينوميات",
      imaging: "التصوير",
      heor: "HEOR",
      gisExplorer: "مستكشف GIS",
      tools: "الأدوات",
      jupyter: "Jupyter",
      workbench: "منضدة العمل",
      queryAssistant: "مساعد الاستعلام",
      publish: "النشر",
      jobs: "المهام",
      administration: "الإدارة",
      adminDashboard: "لوحة الإدارة",
      systemHealth: "حالة النظام",
      honestBroker: "Honest Broker",
      users: "المستخدمون",
      auditLog: "سجل التدقيق",
      rolesPermissions: "الأدوار والأذونات",
      authProviders: "موفرو المصادقة",
      notifications: "الإشعارات",
    },
  },
};

const accentMap: Record<string, string> = {
  A: "Å",
  B: "Ɓ",
  C: "Ç",
  D: "Ð",
  E: "É",
  F: "Ƒ",
  G: "Ĝ",
  H: "Ħ",
  I: "Î",
  J: "Ĵ",
  K: "Ķ",
  L: "Ļ",
  M: "Ṁ",
  N: "Ñ",
  O: "Ø",
  P: "Þ",
  Q: "Ǫ",
  R: "Ŕ",
  S: "Š",
  T: "Ŧ",
  U: "Û",
  V: "Ṽ",
  W: "Ŵ",
  X: "Ẋ",
  Y: "Ý",
  Z: "Ž",
  a: "å",
  b: "ƀ",
  c: "ç",
  d: "ð",
  e: "é",
  f: "ƒ",
  g: "ĝ",
  h: "ħ",
  i: "î",
  j: "ĵ",
  k: "ķ",
  l: "ļ",
  m: "ṁ",
  n: "ñ",
  o: "ø",
  p: "þ",
  q: "ǫ",
  r: "ŕ",
  s: "š",
  t: "ŧ",
  u: "û",
  v: "ṽ",
  w: "ŵ",
  x: "ẋ",
  y: "ý",
  z: "ž",
};

function pseudoLocalize(value: string): string {
  const parts = value.split(/(\{\{[^}]+}})/g);
  const transformed = parts
    .map((part) => {
      if (part.startsWith("{{") && part.endsWith("}}")) return part;
      return Array.from(part)
        .map((char) => accentMap[char] ?? char)
        .join("");
    })
    .join("");

  return `[!! ${transformed} !!]`;
}

function pseudoTree(tree: MessageTree): MessageTree {
  return Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      typeof value === "string" ? pseudoLocalize(value) : pseudoTree(value),
    ]),
  );
}

function pseudoNamespaces(
  namespaces: ParthenonNamespaces,
): ParthenonNamespaces {
  return {
    common: pseudoTree(namespaces.common),
    layout: pseudoTree(namespaces.layout),
  };
}

const enSettings: MessageTree = {
  title: "Settings",
  subtitle: "Manage your profile, security, and preferences",
  tabs: {
    profile: "Profile",
    account: "Account & Security",
    notifications: "Notifications",
    languageRegion: "Language & Region",
  },
  languageRegion: {
    title: "Language & Region",
    subtitle: "Choose how Parthenon speaks and formats information for you.",
    languageLabel: "Preferred Language",
    languageHelp:
      "Your choice is saved to your user profile and follows you across devices.",
    previewTitle: "Regional Preview",
    datePreview: "Date",
    numberPreview: "Number",
    directionPreview: "Text direction",
    ltr: "Left to right",
    rtl: "Right to left",
    saving: "Saving language preference...",
    saved: "Language preference saved.",
    saveFailed: "Language preference could not be saved.",
  },
};

const esSettings: MessageTree = {
  title: "Configuración",
  subtitle: "Gestiona tu perfil, seguridad y preferencias",
  tabs: {
    profile: "Perfil",
    account: "Cuenta y seguridad",
    notifications: "Notificaciones",
    languageRegion: "Idioma y región",
  },
  languageRegion: {
    title: "Idioma y región",
    subtitle:
      "Elige cómo Parthenon se comunica y formatea la información para ti.",
    languageLabel: "Idioma preferido",
    languageHelp:
      "Tu elección se guarda en tu perfil y te acompaña en todos tus dispositivos.",
    previewTitle: "Vista previa regional",
    datePreview: "Fecha",
    numberPreview: "Número",
    directionPreview: "Dirección del texto",
    ltr: "De izquierda a derecha",
    rtl: "De derecha a izquierda",
    saving: "Guardando preferencia de idioma...",
    saved: "Preferencia de idioma guardada.",
    saveFailed: "No se pudo guardar la preferencia de idioma.",
  },
};

const frSettings: MessageTree = {
  title: "Paramètres",
  subtitle: "Gérez votre profil, votre sécurité et vos préférences",
  tabs: {
    profile: "Profil",
    account: "Compte et sécurité",
    notifications: "Notifications",
    languageRegion: "Langue et région",
  },
  languageRegion: {
    title: "Langue et région",
    subtitle:
      "Choisissez comment Parthenon s'exprime et formate les informations pour vous.",
    languageLabel: "Langue préférée",
    languageHelp:
      "Votre choix est enregistré dans votre profil et vous suit sur vos appareils.",
    previewTitle: "Aperçu régional",
    datePreview: "Date",
    numberPreview: "Nombre",
    directionPreview: "Sens du texte",
    ltr: "De gauche à droite",
    rtl: "De droite à gauche",
    saving: "Enregistrement de la préférence de langue...",
    saved: "Préférence de langue enregistrée.",
    saveFailed: "La préférence de langue n'a pas pu être enregistrée.",
  },
};

const deSettings: MessageTree = {
  title: "Einstellungen",
  subtitle: "Profil, Sicherheit und Präferenzen verwalten",
  tabs: {
    profile: "Profil",
    account: "Konto & Sicherheit",
    notifications: "Benachrichtigungen",
    languageRegion: "Sprache & Region",
  },
  languageRegion: {
    title: "Sprache & Region",
    subtitle:
      "Wählen Sie, wie Parthenon spricht und Informationen für Sie formatiert.",
    languageLabel: "Bevorzugte Sprache",
    languageHelp:
      "Ihre Auswahl wird in Ihrem Benutzerprofil gespeichert und gilt auf allen Geräten.",
    previewTitle: "Regionale Vorschau",
    datePreview: "Datum",
    numberPreview: "Zahl",
    directionPreview: "Textrichtung",
    ltr: "Links nach rechts",
    rtl: "Rechts nach links",
    saving: "Spracheinstellung wird gespeichert...",
    saved: "Spracheinstellung gespeichert.",
    saveFailed: "Die Spracheinstellung konnte nicht gespeichert werden.",
  },
};

const ptSettings: MessageTree = {
  title: "Configurações",
  subtitle: "Gerencie seu perfil, segurança e preferências",
  tabs: {
    profile: "Perfil",
    account: "Conta e segurança",
    notifications: "Notificações",
    languageRegion: "Idioma e região",
  },
  languageRegion: {
    title: "Idioma e região",
    subtitle: "Escolha como o Parthenon fala e formata informações para você.",
    languageLabel: "Idioma preferido",
    languageHelp:
      "Sua escolha é salva no seu perfil de usuário e acompanha você em todos os dispositivos.",
    previewTitle: "Prévia regional",
    datePreview: "Data",
    numberPreview: "Número",
    directionPreview: "Direção do texto",
    ltr: "Da esquerda para a direita",
    rtl: "Da direita para a esquerda",
    saving: "Salvando preferência de idioma...",
    saved: "Preferência de idioma salva.",
    saveFailed: "Não foi possível salvar a preferência de idioma.",
  },
};

const fiSettings: MessageTree = {
  title: "Asetukset",
  subtitle: "Hallitse profiilia, turvallisuutta ja asetuksia",
  tabs: {
    profile: "Profiili",
    account: "Tili ja turvallisuus",
    notifications: "Ilmoitukset",
    languageRegion: "Kieli ja alue",
  },
  languageRegion: {
    title: "Kieli ja alue",
    subtitle: "Valitse, miten Parthenon puhuu ja muotoilee tiedot sinulle.",
    languageLabel: "Ensisijainen kieli",
    languageHelp:
      "Valintasi tallennetaan käyttäjäprofiiliisi ja seuraa sinua eri laitteilla.",
    previewTitle: "Alueellinen esikatselu",
    datePreview: "Päivämäärä",
    numberPreview: "Numero",
    directionPreview: "Tekstin suunta",
    ltr: "Vasemmalta oikealle",
    rtl: "Oikealta vasemmalle",
    saving: "Tallennetaan kieliasetusta...",
    saved: "Kieliasetus tallennettu.",
    saveFailed: "Kieliasetusta ei voitu tallentaa.",
  },
};

const jaSettings: MessageTree = {
  title: "設定",
  subtitle: "プロフィール、セキュリティ、設定を管理します",
  tabs: {
    profile: "プロフィール",
    account: "アカウントとセキュリティ",
    notifications: "通知",
    languageRegion: "言語と地域",
  },
  languageRegion: {
    title: "言語と地域",
    subtitle: "Parthenon の表示言語と情報の形式を選択します。",
    languageLabel: "優先言語",
    languageHelp:
      "選択内容はユーザープロフィールに保存され、すべてのデバイスで使われます。",
    previewTitle: "地域プレビュー",
    datePreview: "日付",
    numberPreview: "数値",
    directionPreview: "文字方向",
    ltr: "左から右",
    rtl: "右から左",
    saving: "言語設定を保存中...",
    saved: "言語設定を保存しました。",
    saveFailed: "言語設定を保存できませんでした。",
  },
};

const zhSettings: MessageTree = {
  title: "设置",
  subtitle: "管理你的个人资料、安全性和偏好",
  tabs: {
    profile: "个人资料",
    account: "账户和安全",
    notifications: "通知",
    languageRegion: "语言和区域",
  },
  languageRegion: {
    title: "语言和区域",
    subtitle: "选择 Parthenon 为你显示语言和格式化信息的方式。",
    languageLabel: "首选语言",
    languageHelp: "你的选择会保存到用户资料，并在所有设备上生效。",
    previewTitle: "区域预览",
    datePreview: "日期",
    numberPreview: "数字",
    directionPreview: "文字方向",
    ltr: "从左到右",
    rtl: "从右到左",
    saving: "正在保存语言偏好...",
    saved: "语言偏好已保存。",
    saveFailed: "无法保存语言偏好。",
  },
};

const koSettings: MessageTree = {
  title: "설정",
  subtitle: "프로필, 보안, 환경설정을 관리합니다",
  tabs: {
    profile: "프로필",
    account: "계정 및 보안",
    notifications: "알림",
    languageRegion: "언어 및 지역",
  },
  languageRegion: {
    title: "언어 및 지역",
    subtitle:
      "Parthenon이 사용자에게 말하고 정보를 형식화하는 방식을 선택합니다.",
    languageLabel: "기본 언어",
    languageHelp:
      "선택한 언어는 사용자 프로필에 저장되며 모든 기기에서 적용됩니다.",
    previewTitle: "지역 미리보기",
    datePreview: "날짜",
    numberPreview: "숫자",
    directionPreview: "텍스트 방향",
    ltr: "왼쪽에서 오른쪽",
    rtl: "오른쪽에서 왼쪽",
    saving: "언어 환경설정을 저장하는 중...",
    saved: "언어 환경설정이 저장되었습니다.",
    saveFailed: "언어 환경설정을 저장할 수 없습니다.",
  },
};

const hiSettings: MessageTree = {
  title: "सेटिंग्स",
  subtitle: "अपनी प्रोफाइल, सुरक्षा और प्राथमिकताएं प्रबंधित करें",
  tabs: {
    profile: "प्रोफाइल",
    account: "खाता और सुरक्षा",
    notifications: "सूचनाएं",
    languageRegion: "भाषा और क्षेत्र",
  },
  languageRegion: {
    title: "भाषा और क्षेत्र",
    subtitle:
      "चुनें कि Parthenon आपके लिए कैसे बोले और जानकारी को कैसे फ़ॉर्मैट करे.",
    languageLabel: "पसंदीदा भाषा",
    languageHelp:
      "आपकी पसंद आपकी उपयोगकर्ता प्रोफाइल में सहेजी जाती है और सभी डिवाइस पर लागू होती है.",
    previewTitle: "क्षेत्रीय पूर्वावलोकन",
    datePreview: "तारीख",
    numberPreview: "संख्या",
    directionPreview: "टेक्स्ट दिशा",
    ltr: "बाएं से दाएं",
    rtl: "दाएं से बाएं",
    saving: "भाषा प्राथमिकता सहेज रहे हैं...",
    saved: "भाषा प्राथमिकता सहेजी गई.",
    saveFailed: "भाषा प्राथमिकता सहेजी नहीं जा सकी.",
  },
};

const arSettings: MessageTree = {
  title: "الإعدادات",
  subtitle: "إدارة ملفك الشخصي والأمان والتفضيلات",
  tabs: {
    profile: "الملف الشخصي",
    account: "الحساب والأمان",
    notifications: "الإشعارات",
    languageRegion: "اللغة والمنطقة",
  },
  languageRegion: {
    title: "اللغة والمنطقة",
    subtitle: "اختر كيف يتحدث Parthenon إليك ويعرض المعلومات لك.",
    languageLabel: "اللغة المفضلة",
    languageHelp: "يتم حفظ اختيارك في ملفك الشخصي ويتبعك عبر الأجهزة.",
    previewTitle: "معاينة إقليمية",
    datePreview: "التاريخ",
    numberPreview: "الرقم",
    directionPreview: "اتجاه النص",
    ltr: "من اليسار إلى اليمين",
    rtl: "من اليمين إلى اليسار",
    saving: "جار حفظ تفضيل اللغة...",
    saved: "تم حفظ تفضيل اللغة.",
    saveFailed: "تعذر حفظ تفضيل اللغة.",
  },
};

const enSettingsDetails: MessageTree = {
  profile: {
    photoTitle: "Profile Photo",
    detailsTitle: "Profile Details",
    name: "Name",
    phone: "Phone",
    jobTitle: "Job Title",
    department: "Department",
    organization: "Organization",
    bio: "Bio",
    fullNamePlaceholder: "Full name",
    jobTitlePlaceholder: "e.g. Research Scientist",
    departmentPlaceholder: "e.g. Clinical Informatics",
    organizationPlaceholder: "e.g. Acumenus Data Sciences",
    bioPlaceholder:
      "A brief description about yourself and your research interests...",
    saveProfile: "Save Profile",
    saved: "Profile saved successfully",
    saveFailed: "Failed to save profile",
  },
  avatar: {
    alt: "Avatar",
    uploadPhoto: "Upload Photo",
    remove: "Remove",
    fileTooLarge: "File must be under 5MB",
    uploadFailed: "Upload failed. Please try again.",
    removeFailed: "Failed to remove avatar.",
    guidance: "JPEG, PNG, or WebP. Max 5MB.",
  },
  account: {
    emailTitle: "Email Address",
    emailSubtitle: "Your login email cannot be changed here",
    emailHelp: "Contact your administrator to change your email address.",
    passwordTitle: "Change Password",
    passwordSubtitle: "Update your password regularly for security",
    currentPassword: "Current Password",
    currentPasswordPlaceholder: "Enter current password",
    newPassword: "New Password",
    newPasswordPlaceholder: "Minimum 8 characters",
    confirmPassword: "Confirm New Password",
    confirmPasswordPlaceholder: "Re-enter new password",
    passwordsDoNotMatch: "Passwords do not match",
    changePassword: "Change Password",
    passwordChanged: "Password changed successfully",
    passwordChangeFailed: "Failed to change password",
  },
  notifications: {
    pageTitle: "Notification Preferences",
    pageSubtitle: "Configure how and when you receive notifications",
    loadFailed: "Failed to load notification preferences",
    emailTitle: "Email Notifications",
    emailSubtitle: "Receive notifications via email",
    smsTitle: "SMS Notifications",
    smsSubtitle: "Receive notifications via text message",
    phoneNumber: "Phone Number",
    savePreferences: "Save Preferences",
    saved: "Notification preferences saved successfully",
    saveFailed: "Failed to save notification preferences",
    digestFrequency: "Digest Frequency",
    everyMorning: "Every morning",
    everyMorningDescription: "Full summary at 9am daily",
    alertsOnly: "Alerts only",
    alertsOnlyDescription: "Only when something needs attention",
    analysisCompleted: "Analysis Completed",
    analysisCompletedDescription:
      "Receive a notification when an analysis finishes successfully",
    analysisFailed: "Analysis Failed",
    analysisFailedDescription:
      "Receive a notification when an analysis encounters an error",
    cohortGenerated: "Cohort Generated",
    cohortGeneratedDescription:
      "Receive a notification when a cohort generation completes",
    studyCompleted: "Study Completed",
    studyCompletedDescription:
      "Receive a notification when a study run finishes",
    dailyDigest: "Daily Ops Digest",
    dailyDigestDescription:
      "Receive a daily morning email with CI status, service health, data quality, and changelog",
  },
};

const esSettingsDetails: MessageTree = {
  profile: {
    photoTitle: "Foto de perfil",
    detailsTitle: "Detalles del perfil",
    name: "Nombre",
    phone: "Teléfono",
    jobTitle: "Cargo",
    department: "Departamento",
    organization: "Organización",
    bio: "Biografía",
    fullNamePlaceholder: "Nombre completo",
    jobTitlePlaceholder: "p. ej. Científico investigador",
    departmentPlaceholder: "p. ej. Informática clínica",
    organizationPlaceholder: "p. ej. Acumenus Data Sciences",
    bioPlaceholder:
      "Una breve descripción sobre ti y tus intereses de investigación...",
    saveProfile: "Guardar perfil",
    saved: "Perfil guardado correctamente",
    saveFailed: "No se pudo guardar el perfil",
  },
  avatar: {
    alt: "Avatar",
    uploadPhoto: "Subir foto",
    remove: "Eliminar",
    fileTooLarge: "El archivo debe tener menos de 5 MB",
    uploadFailed: "No se pudo subir. Inténtalo de nuevo.",
    removeFailed: "No se pudo eliminar el avatar.",
    guidance: "JPEG, PNG o WebP. Máx. 5 MB.",
  },
  account: {
    emailTitle: "Correo electrónico",
    emailSubtitle: "Tu correo de inicio de sesión no se puede cambiar aquí",
    emailHelp:
      "Contacta con tu administrador para cambiar tu correo electrónico.",
    passwordTitle: "Cambiar contraseña",
    passwordSubtitle: "Actualiza tu contraseña regularmente por seguridad",
    currentPassword: "Contraseña actual",
    currentPasswordPlaceholder: "Introduce la contraseña actual",
    newPassword: "Nueva contraseña",
    newPasswordPlaceholder: "Mínimo 8 caracteres",
    confirmPassword: "Confirmar nueva contraseña",
    confirmPasswordPlaceholder: "Vuelve a introducir la nueva contraseña",
    passwordsDoNotMatch: "Las contraseñas no coinciden",
    changePassword: "Cambiar contraseña",
    passwordChanged: "Contraseña cambiada correctamente",
    passwordChangeFailed: "No se pudo cambiar la contraseña",
  },
  notifications: {
    pageTitle: "Preferencias de notificación",
    pageSubtitle: "Configura cómo y cuándo recibes notificaciones",
    loadFailed: "No se pudieron cargar las preferencias de notificación",
    emailTitle: "Notificaciones por correo",
    emailSubtitle: "Recibe notificaciones por correo electrónico",
    smsTitle: "Notificaciones SMS",
    smsSubtitle: "Recibe notificaciones por mensaje de texto",
    phoneNumber: "Número de teléfono",
    savePreferences: "Guardar preferencias",
    saved: "Preferencias de notificación guardadas correctamente",
    saveFailed: "No se pudieron guardar las preferencias de notificación",
    digestFrequency: "Frecuencia del resumen",
    everyMorning: "Cada mañana",
    everyMorningDescription: "Resumen completo diario a las 9 a. m.",
    alertsOnly: "Solo alertas",
    alertsOnlyDescription: "Solo cuando algo requiere atención",
    analysisCompleted: "Análisis completado",
    analysisCompletedDescription:
      "Recibe una notificación cuando un análisis finaliza correctamente",
    analysisFailed: "Análisis fallido",
    analysisFailedDescription:
      "Recibe una notificación cuando un análisis encuentra un error",
    cohortGenerated: "Cohorte generada",
    cohortGeneratedDescription:
      "Recibe una notificación cuando termina la generación de una cohorte",
    studyCompleted: "Estudio completado",
    studyCompletedDescription:
      "Recibe una notificación cuando finaliza una ejecución de estudio",
    dailyDigest: "Resumen diario de operaciones",
    dailyDigestDescription:
      "Recibe un correo matutino diario con CI, salud de servicios, calidad de datos y changelog",
  },
};

const frSettingsDetails: MessageTree = {
  profile: {
    photoTitle: "Photo de profil",
    detailsTitle: "Détails du profil",
    name: "Nom",
    phone: "Téléphone",
    jobTitle: "Poste",
    department: "Département",
    organization: "Organisation",
    bio: "Bio",
    fullNamePlaceholder: "Nom complet",
    jobTitlePlaceholder: "p. ex. chercheur",
    departmentPlaceholder: "p. ex. informatique clinique",
    organizationPlaceholder: "p. ex. Acumenus Data Sciences",
    bioPlaceholder:
      "Une brève description de vous et de vos intérêts de recherche...",
    saveProfile: "Enregistrer le profil",
    saved: "Profil enregistré avec succès",
    saveFailed: "Impossible d'enregistrer le profil",
  },
  avatar: {
    alt: "Avatar",
    uploadPhoto: "Téléverser une photo",
    remove: "Supprimer",
    fileTooLarge: "Le fichier doit faire moins de 5 Mo",
    uploadFailed: "Le téléversement a échoué. Réessayez.",
    removeFailed: "Impossible de supprimer l'avatar.",
    guidance: "JPEG, PNG ou WebP. 5 Mo max.",
  },
  account: {
    emailTitle: "Adresse e-mail",
    emailSubtitle: "Votre e-mail de connexion ne peut pas être modifié ici",
    emailHelp:
      "Contactez votre administrateur pour modifier votre adresse e-mail.",
    passwordTitle: "Changer le mot de passe",
    passwordSubtitle:
      "Mettez régulièrement votre mot de passe à jour pour la sécurité",
    currentPassword: "Mot de passe actuel",
    currentPasswordPlaceholder: "Saisir le mot de passe actuel",
    newPassword: "Nouveau mot de passe",
    newPasswordPlaceholder: "Minimum 8 caractères",
    confirmPassword: "Confirmer le nouveau mot de passe",
    confirmPasswordPlaceholder: "Saisir à nouveau le nouveau mot de passe",
    passwordsDoNotMatch: "Les mots de passe ne correspondent pas",
    changePassword: "Changer le mot de passe",
    passwordChanged: "Mot de passe modifié avec succès",
    passwordChangeFailed: "Impossible de changer le mot de passe",
  },
  notifications: {
    loadFailed: "Impossible de charger les préférences de notification",
    emailTitle: "Notifications par e-mail",
    emailSubtitle: "Recevoir les notifications par e-mail",
    smsTitle: "Notifications SMS",
    smsSubtitle: "Recevoir les notifications par SMS",
    phoneNumber: "Numéro de téléphone",
    savePreferences: "Enregistrer les préférences",
    saved: "Préférences de notification enregistrées avec succès",
    saveFailed: "Impossible d'enregistrer les préférences de notification",
    digestFrequency: "Fréquence du résumé",
    everyMorning: "Chaque matin",
    everyMorningDescription: "Résumé complet quotidien à 9 h",
    alertsOnly: "Alertes uniquement",
    alertsOnlyDescription: "Seulement lorsqu'un élément demande attention",
    analysisCompleted: "Analyse terminée",
    analysisCompletedDescription:
      "Recevoir une notification lorsqu'une analyse se termine avec succès",
    analysisFailed: "Analyse échouée",
    analysisFailedDescription:
      "Recevoir une notification lorsqu'une analyse rencontre une erreur",
    cohortGenerated: "Cohorte générée",
    cohortGeneratedDescription:
      "Recevoir une notification lorsqu'une génération de cohorte se termine",
    studyCompleted: "Étude terminée",
    studyCompletedDescription:
      "Recevoir une notification lorsqu'une exécution d'étude se termine",
    dailyDigest: "Résumé quotidien des opérations",
    dailyDigestDescription:
      "Recevoir un e-mail matinal avec CI, santé des services, qualité des données et changelog",
  },
};

const deSettingsDetails: MessageTree = {
  profile: {
    photoTitle: "Profilfoto",
    detailsTitle: "Profildetails",
    name: "Name",
    phone: "Telefon",
    jobTitle: "Position",
    department: "Abteilung",
    organization: "Organisation",
    bio: "Bio",
    fullNamePlaceholder: "Vollständiger Name",
    jobTitlePlaceholder: "z. B. Forschungswissenschaftler",
    departmentPlaceholder: "z. B. klinische Informatik",
    organizationPlaceholder: "z. B. Acumenus Data Sciences",
    bioPlaceholder:
      "Eine kurze Beschreibung von Ihnen und Ihren Forschungsinteressen...",
    saveProfile: "Profil speichern",
    saved: "Profil erfolgreich gespeichert",
    saveFailed: "Profil konnte nicht gespeichert werden",
  },
  avatar: {
    alt: "Avatar",
    uploadPhoto: "Foto hochladen",
    remove: "Entfernen",
    fileTooLarge: "Datei muss kleiner als 5 MB sein",
    uploadFailed: "Upload fehlgeschlagen. Bitte erneut versuchen.",
    removeFailed: "Avatar konnte nicht entfernt werden.",
    guidance: "JPEG, PNG oder WebP. Max. 5 MB.",
  },
  account: {
    emailTitle: "E-Mail-Adresse",
    emailSubtitle: "Ihre Login-E-Mail kann hier nicht geändert werden",
    emailHelp:
      "Wenden Sie sich an Ihren Administrator, um Ihre E-Mail-Adresse zu ändern.",
    passwordTitle: "Passwort ändern",
    passwordSubtitle:
      "Aktualisieren Sie Ihr Passwort regelmäßig zur Sicherheit",
    currentPassword: "Aktuelles Passwort",
    currentPasswordPlaceholder: "Aktuelles Passwort eingeben",
    newPassword: "Neues Passwort",
    newPasswordPlaceholder: "Mindestens 8 Zeichen",
    confirmPassword: "Neues Passwort bestätigen",
    confirmPasswordPlaceholder: "Neues Passwort erneut eingeben",
    passwordsDoNotMatch: "Passwörter stimmen nicht überein",
    changePassword: "Passwort ändern",
    passwordChanged: "Passwort erfolgreich geändert",
    passwordChangeFailed: "Passwort konnte nicht geändert werden",
  },
  notifications: {
    loadFailed: "Benachrichtigungseinstellungen konnten nicht geladen werden",
    emailTitle: "E-Mail-Benachrichtigungen",
    emailSubtitle: "Benachrichtigungen per E-Mail erhalten",
    smsTitle: "SMS-Benachrichtigungen",
    smsSubtitle: "Benachrichtigungen per SMS erhalten",
    phoneNumber: "Telefonnummer",
    savePreferences: "Einstellungen speichern",
    saved: "Benachrichtigungseinstellungen erfolgreich gespeichert",
    saveFailed:
      "Benachrichtigungseinstellungen konnten nicht gespeichert werden",
    digestFrequency: "Digest-Häufigkeit",
    everyMorning: "Jeden Morgen",
    everyMorningDescription: "Vollständige tägliche Zusammenfassung um 9 Uhr",
    alertsOnly: "Nur Warnungen",
    alertsOnlyDescription: "Nur wenn etwas Aufmerksamkeit erfordert",
    analysisCompleted: "Analyse abgeschlossen",
    analysisCompletedDescription:
      "Benachrichtigung erhalten, wenn eine Analyse erfolgreich abgeschlossen wird",
    analysisFailed: "Analyse fehlgeschlagen",
    analysisFailedDescription:
      "Benachrichtigung erhalten, wenn eine Analyse einen Fehler feststellt",
    cohortGenerated: "Kohorte generiert",
    cohortGeneratedDescription:
      "Benachrichtigung erhalten, wenn eine Kohortengenerierung abgeschlossen ist",
    studyCompleted: "Studie abgeschlossen",
    studyCompletedDescription:
      "Benachrichtigung erhalten, wenn ein Studienlauf abgeschlossen ist",
    dailyDigest: "Täglicher Betriebs-Digest",
    dailyDigestDescription:
      "Tägliche Morgen-E-Mail mit CI-Status, Servicezustand, Datenqualität und Changelog erhalten",
  },
};

const ptSettingsDetails: MessageTree = {
  profile: {
    photoTitle: "Foto do perfil",
    detailsTitle: "Detalhes do perfil",
    name: "Nome",
    phone: "Telefone",
    jobTitle: "Cargo",
    department: "Departamento",
    organization: "Organização",
    bio: "Bio",
    fullNamePlaceholder: "Nome completo",
    jobTitlePlaceholder: "ex. Cientista pesquisador",
    departmentPlaceholder: "ex. Informática clínica",
    organizationPlaceholder: "ex. Acumenus Data Sciences",
    bioPlaceholder:
      "Uma breve descrição sobre você e seus interesses de pesquisa...",
    saveProfile: "Salvar perfil",
    saved: "Perfil salvo com sucesso",
    saveFailed: "Não foi possível salvar o perfil",
  },
  avatar: {
    alt: "Avatar",
    uploadPhoto: "Enviar foto",
    remove: "Remover",
    fileTooLarge: "O arquivo deve ter menos de 5 MB",
    uploadFailed: "Falha no envio. Tente novamente.",
    removeFailed: "Não foi possível remover o avatar.",
    guidance: "JPEG, PNG ou WebP. Máx. 5 MB.",
  },
  account: {
    emailTitle: "Endereço de e-mail",
    emailSubtitle: "Seu e-mail de login não pode ser alterado aqui",
    emailHelp: "Contate seu administrador para alterar seu endereço de e-mail.",
    passwordTitle: "Alterar senha",
    passwordSubtitle: "Atualize sua senha regularmente por segurança",
    currentPassword: "Senha atual",
    currentPasswordPlaceholder: "Digite a senha atual",
    newPassword: "Nova senha",
    newPasswordPlaceholder: "Mínimo de 8 caracteres",
    confirmPassword: "Confirmar nova senha",
    confirmPasswordPlaceholder: "Digite a nova senha novamente",
    passwordsDoNotMatch: "As senhas não coincidem",
    changePassword: "Alterar senha",
    passwordChanged: "Senha alterada com sucesso",
    passwordChangeFailed: "Não foi possível alterar a senha",
  },
  notifications: {
    loadFailed: "Não foi possível carregar as preferências de notificação",
    emailTitle: "Notificações por e-mail",
    emailSubtitle: "Receba notificações por e-mail",
    smsTitle: "Notificações por SMS",
    smsSubtitle: "Receba notificações por mensagem de texto",
    phoneNumber: "Número de telefone",
    savePreferences: "Salvar preferências",
    saved: "Preferências de notificação salvas com sucesso",
    saveFailed: "Não foi possível salvar as preferências de notificação",
    digestFrequency: "Frequência do resumo",
    everyMorning: "Todas as manhãs",
    everyMorningDescription: "Resumo completo diário às 9h",
    alertsOnly: "Somente alertas",
    alertsOnlyDescription: "Somente quando algo precisar de atenção",
    analysisCompleted: "Análise concluída",
    analysisCompletedDescription:
      "Receba uma notificação quando uma análise terminar com sucesso",
    analysisFailed: "Análise falhou",
    analysisFailedDescription:
      "Receba uma notificação quando uma análise encontrar um erro",
    cohortGenerated: "Coorte gerada",
    cohortGeneratedDescription:
      "Receba uma notificação quando a geração de uma coorte terminar",
    studyCompleted: "Estudo concluído",
    studyCompletedDescription:
      "Receba uma notificação quando uma execução de estudo terminar",
    dailyDigest: "Resumo diário de operações",
    dailyDigestDescription:
      "Receba um e-mail matinal diário com CI, saúde dos serviços, qualidade dos dados e changelog",
  },
};

const fiSettingsDetails: MessageTree = {
  profile: {
    photoTitle: "Profiilikuva",
    detailsTitle: "Profiilin tiedot",
    name: "Nimi",
    phone: "Puhelin",
    jobTitle: "Tehtävänimike",
    department: "Osasto",
    organization: "Organisaatio",
    bio: "Bio",
    fullNamePlaceholder: "Koko nimi",
    jobTitlePlaceholder: "esim. tutkija",
    departmentPlaceholder: "esim. kliininen informatiikka",
    organizationPlaceholder: "esim. Acumenus Data Sciences",
    bioPlaceholder: "Lyhyt kuvaus sinusta ja tutkimuskiinnostuksistasi...",
    saveProfile: "Tallenna profiili",
    saved: "Profiili tallennettu onnistuneesti",
    saveFailed: "Profiilia ei voitu tallentaa",
  },
  avatar: {
    alt: "Avatar",
    uploadPhoto: "Lataa kuva",
    remove: "Poista",
    fileTooLarge: "Tiedoston on oltava alle 5 Mt",
    uploadFailed: "Lataus epäonnistui. Yritä uudelleen.",
    removeFailed: "Avataria ei voitu poistaa.",
    guidance: "JPEG, PNG tai WebP. Enintään 5 Mt.",
  },
  account: {
    emailTitle: "Sähköpostiosoite",
    emailSubtitle: "Kirjautumissähköpostia ei voi muuttaa täällä",
    emailHelp: "Ota yhteyttä ylläpitäjään sähköpostiosoitteen muuttamiseksi.",
    passwordTitle: "Vaihda salasana",
    passwordSubtitle: "Päivitä salasana säännöllisesti turvallisuuden vuoksi",
    currentPassword: "Nykyinen salasana",
    currentPasswordPlaceholder: "Anna nykyinen salasana",
    newPassword: "Uusi salasana",
    newPasswordPlaceholder: "Vähintään 8 merkkiä",
    confirmPassword: "Vahvista uusi salasana",
    confirmPasswordPlaceholder: "Anna uusi salasana uudelleen",
    passwordsDoNotMatch: "Salasanat eivät täsmää",
    changePassword: "Vaihda salasana",
    passwordChanged: "Salasana vaihdettu onnistuneesti",
    passwordChangeFailed: "Salasanaa ei voitu vaihtaa",
  },
  notifications: {
    loadFailed: "Ilmoitusasetuksia ei voitu ladata",
    emailTitle: "Sähköposti-ilmoitukset",
    emailSubtitle: "Vastaanota ilmoituksia sähköpostitse",
    smsTitle: "SMS-ilmoitukset",
    smsSubtitle: "Vastaanota ilmoituksia tekstiviestillä",
    phoneNumber: "Puhelinnumero",
    savePreferences: "Tallenna asetukset",
    saved: "Ilmoitusasetukset tallennettu onnistuneesti",
    saveFailed: "Ilmoitusasetuksia ei voitu tallentaa",
    digestFrequency: "Koosteen tiheys",
    everyMorning: "Joka aamu",
    everyMorningDescription: "Täysi yhteenveto päivittäin klo 9",
    alertsOnly: "Vain hälytykset",
    alertsOnlyDescription: "Vain kun jokin vaatii huomiota",
    analysisCompleted: "Analyysi valmis",
    analysisCompletedDescription:
      "Saat ilmoituksen, kun analyysi valmistuu onnistuneesti",
    analysisFailed: "Analyysi epäonnistui",
    analysisFailedDescription: "Saat ilmoituksen, kun analyysi kohtaa virheen",
    cohortGenerated: "Kohortti luotu",
    cohortGeneratedDescription:
      "Saat ilmoituksen, kun kohortin generointi valmistuu",
    studyCompleted: "Tutkimus valmis",
    studyCompletedDescription: "Saat ilmoituksen, kun tutkimusajo valmistuu",
    dailyDigest: "Päivittäinen toimintakooste",
    dailyDigestDescription:
      "Saat aamuisin sähköpostin CI-tilasta, palvelujen terveydestä, datan laadusta ja changelogista",
  },
};

const jaSettingsDetails: MessageTree = {
  profile: {
    photoTitle: "プロフィール写真",
    detailsTitle: "プロフィール詳細",
    name: "名前",
    phone: "電話",
    jobTitle: "役職",
    department: "部門",
    organization: "組織",
    bio: "自己紹介",
    fullNamePlaceholder: "氏名",
    jobTitlePlaceholder: "例: 研究科学者",
    departmentPlaceholder: "例: 臨床情報学",
    organizationPlaceholder: "例: Acumenus Data Sciences",
    bioPlaceholder: "ご自身と研究関心について簡単に記入してください...",
    saveProfile: "プロフィールを保存",
    saved: "プロフィールを保存しました",
    saveFailed: "プロフィールを保存できませんでした",
  },
  avatar: {
    alt: "アバター",
    uploadPhoto: "写真をアップロード",
    remove: "削除",
    fileTooLarge: "ファイルは 5 MB 未満にしてください",
    uploadFailed: "アップロードに失敗しました。もう一度お試しください。",
    removeFailed: "アバターを削除できませんでした。",
    guidance: "JPEG、PNG、WebP。最大 5 MB。",
  },
  account: {
    emailTitle: "メールアドレス",
    emailSubtitle: "ログイン用メールはここでは変更できません",
    emailHelp: "メールアドレスを変更するには管理者に連絡してください。",
    passwordTitle: "パスワードを変更",
    passwordSubtitle: "セキュリティのためパスワードを定期的に更新してください",
    currentPassword: "現在のパスワード",
    currentPasswordPlaceholder: "現在のパスワードを入力",
    newPassword: "新しいパスワード",
    newPasswordPlaceholder: "8 文字以上",
    confirmPassword: "新しいパスワードを確認",
    confirmPasswordPlaceholder: "新しいパスワードを再入力",
    passwordsDoNotMatch: "パスワードが一致しません",
    changePassword: "パスワードを変更",
    passwordChanged: "パスワードを変更しました",
    passwordChangeFailed: "パスワードを変更できませんでした",
  },
  notifications: {
    loadFailed: "通知設定を読み込めませんでした",
    emailTitle: "メール通知",
    emailSubtitle: "メールで通知を受け取る",
    smsTitle: "SMS 通知",
    smsSubtitle: "テキストメッセージで通知を受け取る",
    phoneNumber: "電話番号",
    savePreferences: "設定を保存",
    saved: "通知設定を保存しました",
    saveFailed: "通知設定を保存できませんでした",
    digestFrequency: "ダイジェスト頻度",
    everyMorning: "毎朝",
    everyMorningDescription: "毎日午前 9 時に完全な概要",
    alertsOnly: "アラートのみ",
    alertsOnlyDescription: "注意が必要な場合のみ",
    analysisCompleted: "解析完了",
    analysisCompletedDescription: "解析が正常に完了したときに通知を受け取る",
    analysisFailed: "解析失敗",
    analysisFailedDescription: "解析でエラーが発生したときに通知を受け取る",
    cohortGenerated: "コホート生成完了",
    cohortGeneratedDescription: "コホート生成が完了したときに通知を受け取る",
    studyCompleted: "研究完了",
    studyCompletedDescription: "研究実行が完了したときに通知を受け取る",
    dailyDigest: "毎日の運用ダイジェスト",
    dailyDigestDescription:
      "CI 状態、サービス状態、データ品質、変更履歴を毎朝メールで受け取る",
  },
};

const zhSettingsDetails: MessageTree = {
  profile: {
    photoTitle: "个人资料照片",
    detailsTitle: "个人资料详情",
    name: "姓名",
    phone: "电话",
    jobTitle: "职位",
    department: "部门",
    organization: "组织",
    bio: "简介",
    fullNamePlaceholder: "全名",
    jobTitlePlaceholder: "例如：研究科学家",
    departmentPlaceholder: "例如：临床信息学",
    organizationPlaceholder: "例如：Acumenus Data Sciences",
    bioPlaceholder: "简要介绍你自己和你的研究兴趣...",
    saveProfile: "保存个人资料",
    saved: "个人资料已成功保存",
    saveFailed: "无法保存个人资料",
  },
  avatar: {
    alt: "头像",
    uploadPhoto: "上传照片",
    remove: "移除",
    fileTooLarge: "文件必须小于 5 MB",
    uploadFailed: "上传失败。请重试。",
    removeFailed: "无法移除头像。",
    guidance: "JPEG、PNG 或 WebP。最大 5 MB。",
  },
  account: {
    emailTitle: "电子邮件地址",
    emailSubtitle: "登录邮箱不能在此处更改",
    emailHelp: "请联系管理员更改你的电子邮件地址。",
    passwordTitle: "更改密码",
    passwordSubtitle: "请定期更新密码以确保安全",
    currentPassword: "当前密码",
    currentPasswordPlaceholder: "输入当前密码",
    newPassword: "新密码",
    newPasswordPlaceholder: "至少 8 个字符",
    confirmPassword: "确认新密码",
    confirmPasswordPlaceholder: "重新输入新密码",
    passwordsDoNotMatch: "密码不匹配",
    changePassword: "更改密码",
    passwordChanged: "密码已成功更改",
    passwordChangeFailed: "无法更改密码",
  },
  notifications: {
    loadFailed: "无法加载通知偏好",
    emailTitle: "电子邮件通知",
    emailSubtitle: "通过电子邮件接收通知",
    smsTitle: "短信通知",
    smsSubtitle: "通过短信接收通知",
    phoneNumber: "电话号码",
    savePreferences: "保存偏好",
    saved: "通知偏好已成功保存",
    saveFailed: "无法保存通知偏好",
    digestFrequency: "摘要频率",
    everyMorning: "每天早上",
    everyMorningDescription: "每天上午 9 点发送完整摘要",
    alertsOnly: "仅提醒",
    alertsOnlyDescription: "仅在需要关注时发送",
    analysisCompleted: "分析已完成",
    analysisCompletedDescription: "分析成功完成时接收通知",
    analysisFailed: "分析失败",
    analysisFailedDescription: "分析遇到错误时接收通知",
    cohortGenerated: "队列已生成",
    cohortGeneratedDescription: "队列生成完成时接收通知",
    studyCompleted: "研究已完成",
    studyCompletedDescription: "研究运行完成时接收通知",
    dailyDigest: "每日运营摘要",
    dailyDigestDescription:
      "每天早上通过邮件接收 CI 状态、服务健康、数据质量和变更日志",
  },
};

const koSettingsDetails: MessageTree = {
  profile: {
    photoTitle: "프로필 사진",
    detailsTitle: "프로필 세부정보",
    name: "이름",
    phone: "전화",
    jobTitle: "직함",
    department: "부서",
    organization: "조직",
    bio: "소개",
    fullNamePlaceholder: "전체 이름",
    jobTitlePlaceholder: "예: 연구 과학자",
    departmentPlaceholder: "예: 임상 정보학",
    organizationPlaceholder: "예: Acumenus Data Sciences",
    bioPlaceholder: "본인과 연구 관심사에 대한 짧은 설명...",
    saveProfile: "프로필 저장",
    saved: "프로필이 성공적으로 저장되었습니다",
    saveFailed: "프로필을 저장할 수 없습니다",
  },
  avatar: {
    alt: "아바타",
    uploadPhoto: "사진 업로드",
    remove: "제거",
    fileTooLarge: "파일은 5MB 미만이어야 합니다",
    uploadFailed: "업로드에 실패했습니다. 다시 시도하세요.",
    removeFailed: "아바타를 제거할 수 없습니다.",
    guidance: "JPEG, PNG 또는 WebP. 최대 5MB.",
  },
  account: {
    emailTitle: "이메일 주소",
    emailSubtitle: "로그인 이메일은 여기에서 변경할 수 없습니다",
    emailHelp: "이메일 주소를 변경하려면 관리자에게 문의하세요.",
    passwordTitle: "비밀번호 변경",
    passwordSubtitle: "보안을 위해 비밀번호를 정기적으로 업데이트하세요",
    currentPassword: "현재 비밀번호",
    currentPasswordPlaceholder: "현재 비밀번호 입력",
    newPassword: "새 비밀번호",
    newPasswordPlaceholder: "최소 8자",
    confirmPassword: "새 비밀번호 확인",
    confirmPasswordPlaceholder: "새 비밀번호 다시 입력",
    passwordsDoNotMatch: "비밀번호가 일치하지 않습니다",
    changePassword: "비밀번호 변경",
    passwordChanged: "비밀번호가 성공적으로 변경되었습니다",
    passwordChangeFailed: "비밀번호를 변경할 수 없습니다",
  },
  notifications: {
    pageTitle: "알림 환경설정",
    pageSubtitle: "알림을 받는 방식과 시기를 설정하세요",
    loadFailed: "알림 환경설정을 불러올 수 없습니다",
    emailTitle: "이메일 알림",
    emailSubtitle: "이메일로 알림 받기",
    smsTitle: "SMS 알림",
    smsSubtitle: "문자 메시지로 알림 받기",
    phoneNumber: "전화번호",
    savePreferences: "환경설정 저장",
    saved: "알림 환경설정이 성공적으로 저장되었습니다",
    saveFailed: "알림 환경설정을 저장할 수 없습니다",
    digestFrequency: "요약 빈도",
    everyMorning: "매일 아침",
    everyMorningDescription: "매일 오전 9시에 전체 요약",
    alertsOnly: "알림만",
    alertsOnlyDescription: "주의가 필요한 경우에만",
    analysisCompleted: "분석 완료",
    analysisCompletedDescription: "분석이 성공적으로 완료되면 알림 받기",
    analysisFailed: "분석 실패",
    analysisFailedDescription: "분석에서 오류가 발생하면 알림 받기",
    cohortGenerated: "코호트 생성 완료",
    cohortGeneratedDescription: "코호트 생성이 완료되면 알림 받기",
    studyCompleted: "연구 완료",
    studyCompletedDescription: "연구 실행이 완료되면 알림 받기",
    dailyDigest: "일일 운영 요약",
    dailyDigestDescription:
      "CI 상태, 서비스 상태, 데이터 품질, 변경 로그를 매일 아침 이메일로 받기",
  },
};

const hiSettingsDetails: MessageTree = {
  profile: {
    photoTitle: "प्रोफाइल फोटो",
    detailsTitle: "प्रोफाइल विवरण",
    name: "नाम",
    phone: "फोन",
    jobTitle: "पद",
    department: "विभाग",
    organization: "संगठन",
    bio: "परिचय",
    fullNamePlaceholder: "पूरा नाम",
    jobTitlePlaceholder: "जैसे शोध वैज्ञानिक",
    departmentPlaceholder: "जैसे क्लिनिकल इन्फॉर्मेटिक्स",
    organizationPlaceholder: "जैसे Acumenus Data Sciences",
    bioPlaceholder: "अपने और अपनी शोध रुचियों के बारे में संक्षिप्त विवरण...",
    saveProfile: "प्रोफाइल सहेजें",
    saved: "प्रोफाइल सफलतापूर्वक सहेजी गई",
    saveFailed: "प्रोफाइल सहेजी नहीं जा सकी",
  },
  avatar: {
    alt: "अवतार",
    uploadPhoto: "फोटो अपलोड करें",
    remove: "हटाएं",
    fileTooLarge: "फ़ाइल 5MB से कम होनी चाहिए",
    uploadFailed: "अपलोड विफल रहा. कृपया फिर प्रयास करें.",
    removeFailed: "अवतार हटाया नहीं जा सका.",
    guidance: "JPEG, PNG या WebP. अधिकतम 5MB.",
  },
  account: {
    emailTitle: "ईमेल पता",
    emailSubtitle: "आपका लॉगिन ईमेल यहां बदला नहीं जा सकता",
    emailHelp: "अपना ईमेल पता बदलने के लिए अपने व्यवस्थापक से संपर्क करें.",
    passwordTitle: "पासवर्ड बदलें",
    passwordSubtitle: "सुरक्षा के लिए अपना पासवर्ड नियमित रूप से अपडेट करें",
    currentPassword: "वर्तमान पासवर्ड",
    currentPasswordPlaceholder: "वर्तमान पासवर्ड दर्ज करें",
    newPassword: "नया पासवर्ड",
    newPasswordPlaceholder: "न्यूनतम 8 अक्षर",
    confirmPassword: "नए पासवर्ड की पुष्टि करें",
    confirmPasswordPlaceholder: "नया पासवर्ड फिर से दर्ज करें",
    passwordsDoNotMatch: "पासवर्ड मेल नहीं खाते",
    changePassword: "पासवर्ड बदलें",
    passwordChanged: "पासवर्ड सफलतापूर्वक बदला गया",
    passwordChangeFailed: "पासवर्ड बदला नहीं जा सका",
  },
  notifications: {
    loadFailed: "सूचना प्राथमिकताएं लोड नहीं हो सकीं",
    emailTitle: "ईमेल सूचनाएं",
    emailSubtitle: "ईमेल के माध्यम से सूचनाएं प्राप्त करें",
    smsTitle: "SMS सूचनाएं",
    smsSubtitle: "टेक्स्ट संदेश के माध्यम से सूचनाएं प्राप्त करें",
    phoneNumber: "फोन नंबर",
    savePreferences: "प्राथमिकताएं सहेजें",
    saved: "सूचना प्राथमिकताएं सफलतापूर्वक सहेजी गईं",
    saveFailed: "सूचना प्राथमिकताएं सहेजी नहीं जा सकीं",
    digestFrequency: "डाइजेस्ट आवृत्ति",
    everyMorning: "हर सुबह",
    everyMorningDescription: "रोज सुबह 9 बजे पूरा सारांश",
    alertsOnly: "केवल अलर्ट",
    alertsOnlyDescription: "केवल जब किसी चीज़ पर ध्यान देने की आवश्यकता हो",
    analysisCompleted: "विश्लेषण पूरा हुआ",
    analysisCompletedDescription:
      "विश्लेषण सफलतापूर्वक पूरा होने पर सूचना प्राप्त करें",
    analysisFailed: "विश्लेषण विफल",
    analysisFailedDescription: "विश्लेषण में त्रुटि आने पर सूचना प्राप्त करें",
    cohortGenerated: "कोहोर्ट जनरेट हुआ",
    cohortGeneratedDescription:
      "कोहोर्ट जनरेशन पूरा होने पर सूचना प्राप्त करें",
    studyCompleted: "अध्ययन पूरा हुआ",
    studyCompletedDescription: "अध्ययन रन समाप्त होने पर सूचना प्राप्त करें",
    dailyDigest: "दैनिक ऑप्स डाइजेस्ट",
    dailyDigestDescription:
      "CI स्थिति, सेवा स्वास्थ्य, डेटा गुणवत्ता और changelog के साथ रोज सुबह ईमेल प्राप्त करें",
  },
};

const arSettingsDetails: MessageTree = {
  profile: {
    photoTitle: "صورة الملف الشخصي",
    detailsTitle: "تفاصيل الملف الشخصي",
    name: "الاسم",
    phone: "الهاتف",
    jobTitle: "المسمى الوظيفي",
    department: "القسم",
    organization: "المؤسسة",
    bio: "نبذة",
    fullNamePlaceholder: "الاسم الكامل",
    jobTitlePlaceholder: "مثال: عالم أبحاث",
    departmentPlaceholder: "مثال: المعلوماتية السريرية",
    organizationPlaceholder: "مثال: Acumenus Data Sciences",
    bioPlaceholder: "وصف موجز عنك وعن اهتماماتك البحثية...",
    saveProfile: "حفظ الملف الشخصي",
    saved: "تم حفظ الملف الشخصي بنجاح",
    saveFailed: "تعذر حفظ الملف الشخصي",
  },
  avatar: {
    alt: "الصورة الرمزية",
    uploadPhoto: "تحميل صورة",
    remove: "إزالة",
    fileTooLarge: "يجب أن يكون الملف أقل من 5 ميغابايت",
    uploadFailed: "فشل التحميل. حاول مرة أخرى.",
    removeFailed: "تعذرت إزالة الصورة الرمزية.",
    guidance: "JPEG أو PNG أو WebP. الحد الأقصى 5 ميغابايت.",
  },
  account: {
    emailTitle: "عنوان البريد الإلكتروني",
    emailSubtitle: "لا يمكن تغيير بريد تسجيل الدخول هنا",
    emailHelp: "اتصل بالمسؤول لتغيير عنوان بريدك الإلكتروني.",
    passwordTitle: "تغيير كلمة المرور",
    passwordSubtitle: "حدّث كلمة مرورك بانتظام لأمان أفضل",
    currentPassword: "كلمة المرور الحالية",
    currentPasswordPlaceholder: "أدخل كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة",
    newPasswordPlaceholder: "8 أحرف على الأقل",
    confirmPassword: "تأكيد كلمة المرور الجديدة",
    confirmPasswordPlaceholder: "أعد إدخال كلمة المرور الجديدة",
    passwordsDoNotMatch: "كلمتا المرور غير متطابقتين",
    changePassword: "تغيير كلمة المرور",
    passwordChanged: "تم تغيير كلمة المرور بنجاح",
    passwordChangeFailed: "تعذر تغيير كلمة المرور",
  },
  notifications: {
    loadFailed: "تعذر تحميل تفضيلات الإشعارات",
    emailTitle: "إشعارات البريد الإلكتروني",
    emailSubtitle: "استلام الإشعارات عبر البريد الإلكتروني",
    smsTitle: "إشعارات SMS",
    smsSubtitle: "استلام الإشعارات عبر الرسائل النصية",
    phoneNumber: "رقم الهاتف",
    savePreferences: "حفظ التفضيلات",
    saved: "تم حفظ تفضيلات الإشعارات بنجاح",
    saveFailed: "تعذر حفظ تفضيلات الإشعارات",
    digestFrequency: "تكرار الملخص",
    everyMorning: "كل صباح",
    everyMorningDescription: "ملخص كامل يوميا في الساعة 9 صباحا",
    alertsOnly: "التنبيهات فقط",
    alertsOnlyDescription: "فقط عندما يحتاج شيء إلى الانتباه",
    analysisCompleted: "اكتمل التحليل",
    analysisCompletedDescription: "استلام إشعار عند اكتمال التحليل بنجاح",
    analysisFailed: "فشل التحليل",
    analysisFailedDescription: "استلام إشعار عند حدوث خطأ في التحليل",
    cohortGenerated: "تم إنشاء المجموعة",
    cohortGeneratedDescription: "استلام إشعار عند اكتمال إنشاء المجموعة",
    studyCompleted: "اكتملت الدراسة",
    studyCompletedDescription: "استلام إشعار عند انتهاء تشغيل الدراسة",
    dailyDigest: "ملخص العمليات اليومي",
    dailyDigestDescription:
      "استلام بريد صباحي يومي بحالة CI وصحة الخدمات وجودة البيانات وسجل التغييرات",
  },
};

const enHelp: MessageTree = {
  title: "Help",
  open: "Open help",
  tips: "Tips",
  loadError: "Help content could not be loaded.",
  fallbackNotice:
    "Localized help is not available for this topic yet, so English content is shown.",
  readDocumentation: "Read documentation",
  watchVideo: "Watch video",
  whatsNewTitle: "What's New in Parthenon",
  whatsNewIntro: "Here's what changed since your last visit.",
  gotIt: "Got it",
  sections: {
    Added: "Added",
    Fixed: "Fixed",
    Changed: "Changed",
    Removed: "Removed",
    Deprecated: "Deprecated",
    Security: "Security",
  },
};

const esHelp: MessageTree = {
  title: "Ayuda",
  open: "Abrir ayuda",
  tips: "Consejos",
  loadError: "No se pudo cargar el contenido de ayuda.",
  fallbackNotice:
    "La ayuda localizada aún no está disponible para este tema, por lo que se muestra contenido en inglés.",
  readDocumentation: "Leer documentación",
  watchVideo: "Ver video",
  whatsNewTitle: "Novedades de Parthenon",
  whatsNewIntro: "Esto cambió desde tu última visita.",
  gotIt: "Entendido",
  sections: {
    Added: "Añadido",
    Fixed: "Corregido",
    Changed: "Cambiado",
    Removed: "Eliminado",
    Deprecated: "Obsoleto",
    Security: "Seguridad",
  },
};

const frHelp: MessageTree = {
  title: "Aide",
  open: "Ouvrir l'aide",
  tips: "Conseils",
  loadError: "Le contenu d'aide n'a pas pu être chargé.",
  fallbackNotice:
    "L'aide localisée n'est pas encore disponible pour ce sujet, le contenu anglais est donc affiché.",
  readDocumentation: "Lire la documentation",
  watchVideo: "Regarder la vidéo",
  whatsNewTitle: "Nouveautés de Parthenon",
  whatsNewIntro: "Voici ce qui a changé depuis votre dernière visite.",
  gotIt: "Compris",
  sections: {
    Added: "Ajouté",
    Fixed: "Corrigé",
    Changed: "Modifié",
    Removed: "Supprimé",
    Deprecated: "Obsolète",
    Security: "Sécurité",
  },
};

const deHelp: MessageTree = {
  title: "Hilfe",
  open: "Hilfe öffnen",
  tips: "Tipps",
  loadError: "Der Hilfeinhalt konnte nicht geladen werden.",
  fallbackNotice:
    "Für dieses Thema ist noch keine lokalisierte Hilfe verfügbar, daher wird englischer Inhalt angezeigt.",
  readDocumentation: "Dokumentation lesen",
  watchVideo: "Video ansehen",
  whatsNewTitle: "Neu in Parthenon",
  whatsNewIntro: "Das hat sich seit Ihrem letzten Besuch geändert.",
  gotIt: "Verstanden",
  sections: {
    Added: "Hinzugefügt",
    Fixed: "Behoben",
    Changed: "Geändert",
    Removed: "Entfernt",
    Deprecated: "Veraltet",
    Security: "Sicherheit",
  },
};

const ptHelp: MessageTree = {
  title: "Ajuda",
  open: "Abrir ajuda",
  tips: "Dicas",
  loadError: "Não foi possível carregar o conteúdo de ajuda.",
  fallbackNotice:
    "A ajuda localizada ainda não está disponível para este tópico, então o conteúdo em inglês é exibido.",
  readDocumentation: "Ler documentação",
  watchVideo: "Assistir vídeo",
  whatsNewTitle: "Novidades no Parthenon",
  whatsNewIntro: "Veja o que mudou desde sua última visita.",
  gotIt: "Entendi",
  sections: {
    Added: "Adicionado",
    Fixed: "Corrigido",
    Changed: "Alterado",
    Removed: "Removido",
    Deprecated: "Obsoleto",
    Security: "Segurança",
  },
};

const fiHelp: MessageTree = {
  title: "Ohje",
  open: "Avaa ohje",
  tips: "Vinkit",
  loadError: "Ohjesisältöä ei voitu ladata.",
  fallbackNotice:
    "Lokalisoitua ohjetta ei ole vielä saatavilla tälle aiheelle, joten englanninkielinen sisältö näytetään.",
  readDocumentation: "Lue dokumentaatio",
  watchVideo: "Katso video",
  whatsNewTitle: "Uutta Parthenonissa",
  whatsNewIntro: "Tämä on muuttunut viime käyntisi jälkeen.",
  gotIt: "Selvä",
  sections: {
    Added: "Lisätty",
    Fixed: "Korjattu",
    Changed: "Muutettu",
    Removed: "Poistettu",
    Deprecated: "Vanhentunut",
    Security: "Tietoturva",
  },
};

const jaHelp: MessageTree = {
  title: "ヘルプ",
  open: "ヘルプを開く",
  tips: "ヒント",
  loadError: "ヘルプ内容を読み込めませんでした。",
  fallbackNotice:
    "このトピックのローカライズ済みヘルプはまだ利用できないため、英語の内容を表示しています。",
  readDocumentation: "ドキュメントを読む",
  watchVideo: "動画を見る",
  whatsNewTitle: "Parthenon の新機能",
  whatsNewIntro: "前回の訪問以降の変更です。",
  gotIt: "了解",
  sections: {
    Added: "追加",
    Fixed: "修正",
    Changed: "変更",
    Removed: "削除",
    Deprecated: "非推奨",
    Security: "セキュリティ",
  },
};

const zhHelp: MessageTree = {
  title: "帮助",
  open: "打开帮助",
  tips: "提示",
  loadError: "无法加载帮助内容。",
  fallbackNotice: "此主题尚无本地化帮助，因此显示英文内容。",
  readDocumentation: "阅读文档",
  watchVideo: "观看视频",
  whatsNewTitle: "Parthenon 新变化",
  whatsNewIntro: "这是你上次访问后的变化。",
  gotIt: "知道了",
  sections: {
    Added: "新增",
    Fixed: "修复",
    Changed: "更改",
    Removed: "移除",
    Deprecated: "已弃用",
    Security: "安全",
  },
};

const koHelp: MessageTree = {
  title: "도움말",
  open: "도움말 열기",
  tips: "팁",
  loadError: "도움말 콘텐츠를 불러올 수 없습니다.",
  fallbackNotice:
    "이 주제의 현지화된 도움말이 아직 없어 영어 콘텐츠가 표시됩니다.",
  readDocumentation: "문서 읽기",
  watchVideo: "동영상 보기",
  whatsNewTitle: "Parthenon의 새로운 기능",
  whatsNewIntro: "마지막 방문 이후 변경된 내용입니다.",
  gotIt: "확인",
  sections: {
    Added: "추가됨",
    Fixed: "수정됨",
    Changed: "변경됨",
    Removed: "제거됨",
    Deprecated: "지원 중단",
    Security: "보안",
  },
};

const hiHelp: MessageTree = {
  title: "सहायता",
  open: "सहायता खोलें",
  tips: "सुझाव",
  loadError: "सहायता सामग्री लोड नहीं हो सकी.",
  fallbackNotice:
    "इस विषय के लिए स्थानीयकृत सहायता अभी उपलब्ध नहीं है, इसलिए अंग्रेज़ी सामग्री दिखाई जा रही है.",
  readDocumentation: "दस्तावेज़ पढ़ें",
  watchVideo: "वीडियो देखें",
  whatsNewTitle: "Parthenon में नया क्या है",
  whatsNewIntro: "आपकी पिछली विज़िट के बाद ये बदलाव हुए हैं.",
  gotIt: "समझ गया",
  sections: {
    Added: "जोड़ा गया",
    Fixed: "ठीक किया गया",
    Changed: "बदला गया",
    Removed: "हटाया गया",
    Deprecated: "अप्रचलित",
    Security: "सुरक्षा",
  },
};

const arHelp: MessageTree = {
  title: "المساعدة",
  open: "فتح المساعدة",
  tips: "نصائح",
  loadError: "تعذر تحميل محتوى المساعدة.",
  fallbackNotice:
    "المساعدة المترجمة غير متاحة لهذا الموضوع بعد، لذلك يتم عرض المحتوى باللغة الإنجليزية.",
  readDocumentation: "قراءة الوثائق",
  watchVideo: "مشاهدة الفيديو",
  whatsNewTitle: "الجديد في Parthenon",
  whatsNewIntro: "هذه هي التغييرات منذ زيارتك الأخيرة.",
  gotIt: "فهمت",
  sections: {
    Added: "مضاف",
    Fixed: "تم الإصلاح",
    Changed: "تم التغيير",
    Removed: "تمت الإزالة",
    Deprecated: "مهمل",
    Security: "الأمان",
  },
};

const enAuth: MessageTree = {
  common: {
    email: "Email",
    password: "Password",
    fullName: "Full name",
    signIn: "Sign in",
    requestAccess: "Request access",
    checkEmail: "Check your email",
    temporaryPassword: "Temporary password",
    newPassword: "New password",
    confirmNewPassword: "Confirm new password",
  },
  hero: {
    tagline: "Unified Outcomes Research Platform",
    descriptionPrefix:
      "A next-generation outcomes research platform built on the",
    descriptionSuffix:
      "ecosystem and the OMOP Common Data Model. Cohort building, characterization, population-level estimation, patient-level prediction, and pathway analysis, unified in a single platform.",
    openSourcePrefix: "Open source on",
    links: {
      blog: "Read our Development Blog",
      discord: "Join our Discord Community",
      install: "Install on a New Machine",
    },
    capabilities: {
      cohortDefinitions: "Cohort Definitions",
      characterization: "Characterization",
      incidenceRates: "Incidence Rates",
      estimation: "Estimation",
      prediction: "Prediction",
      pathways: "Pathways",
      genomics: "Genomics",
      imaging: "Imaging",
      heor: "HEOR",
      gis: "GIS",
    },
    cdmVersion: "OMOP CDM v5.4",
  },
  login: {
    subtitle: "Enter your credentials to continue",
    invalidCredentials: "Invalid credentials. Please try again.",
    passwordPlaceholder: "Enter your password",
    forgotPassword: "Forgot password?",
    fillDemo: "Fill demo credentials",
    signingIn: "Signing in...",
    or: "or",
    oidcFallback: "Sign in with Authentik",
    noAccount: "Don't have an account?",
  },
  register: {
    heroDescription:
      "Request access to the platform. A temporary password will be sent to your email address.",
    subtitle: "Enter your details and we'll email a temporary password",
    failed: "Registration failed. Please try again.",
    successBody:
      "If this email is new to Parthenon, a temporary password has been sent. Use it to sign in. You'll be asked to set a permanent password on first login.",
    goToSignIn: "Go to sign in",
    namePlaceholder: "Jane Smith",
    alreadyHaveAccount: "Already have an account?",
    sending: "Sending...",
  },
  forgot: {
    title: "Reset your password",
    intro: "Enter your email and we'll send you a new temporary password.",
    successTitle: "Check your email",
    successBody:
      "If an account exists with that email, a new temporary password has been sent.",
    tooManyRequests: "Too many requests. Please wait and try again.",
    genericError: "Something went wrong. Please try again.",
    close: "Close password reset dialog",
    sendTemporaryPassword: "Send temporary password",
    sending: "Sending...",
  },
  changePassword: {
    title: "Change your password",
    intro: "You must set a new password before continuing.",
    currentPlaceholder: "Enter your temporary password",
    newPlaceholder: "Min 8 characters",
    confirmPlaceholder: "Repeat new password",
    changing: "Changing password...",
    submit: "Set new password",
    errors: {
      mismatch: "New passwords do not match.",
      tooShort: "New password must be at least 8 characters.",
      same: "New password must differ from the current password.",
      failed: "Password change failed. Please try again.",
    },
  },
  oidc: {
    failedTitle: "Sign-in failed",
    failureDescription:
      "We could not complete the single sign-on request{{reason}}. Try again or use email/password login.",
    backToLogin: "Back to login",
    completing: "Completing sign-in...",
  },
};

const esAuth: MessageTree = {
  common: {
    email: "Correo electrónico",
    password: "Contraseña",
    fullName: "Nombre completo",
    signIn: "Iniciar sesión",
    requestAccess: "Solicitar acceso",
    checkEmail: "Revisa tu correo",
    temporaryPassword: "Contraseña temporal",
    newPassword: "Nueva contraseña",
    confirmNewPassword: "Confirmar nueva contraseña",
  },
  hero: {
    tagline: "Plataforma unificada de investigación de resultados",
    descriptionPrefix:
      "Una plataforma de investigación de resultados de nueva generación creada sobre el",
    descriptionSuffix:
      "ecosistema y el Modelo de Datos Común OMOP. Creación de cohortes, caracterización, estimación poblacional, predicción a nivel de paciente y análisis de trayectorias, todo unificado en una sola plataforma.",
    openSourcePrefix: "Código abierto en",
    links: {
      blog: "Leer nuestro blog de desarrollo",
      discord: "Unirse a nuestra comunidad de Discord",
      install: "Instalar en una máquina nueva",
    },
    capabilities: {
      cohortDefinitions: "Definiciones de cohortes",
      characterization: "Caracterización",
      incidenceRates: "Tasas de incidencia",
      estimation: "Estimación",
      prediction: "Predicción",
      pathways: "Trayectorias",
      genomics: "Genómica",
      imaging: "Imágenes",
      heor: "HEOR",
      gis: "GIS",
    },
    cdmVersion: "OMOP CDM v5.4",
  },
  login: {
    subtitle: "Introduce tus credenciales para continuar",
    invalidCredentials: "Credenciales no válidas. Inténtalo de nuevo.",
    passwordPlaceholder: "Introduce tu contraseña",
    forgotPassword: "¿Olvidaste la contraseña?",
    fillDemo: "Rellenar credenciales de demo",
    signingIn: "Iniciando sesión...",
    or: "o",
    oidcFallback: "Iniciar sesión con Authentik",
    noAccount: "¿No tienes cuenta?",
  },
  register: {
    heroDescription:
      "Solicita acceso a la plataforma. Se enviará una contraseña temporal a tu correo electrónico.",
    subtitle:
      "Introduce tus datos y te enviaremos una contraseña temporal por correo",
    failed: "No se pudo registrar. Inténtalo de nuevo.",
    successBody:
      "Si este correo es nuevo en Parthenon, se ha enviado una contraseña temporal. Úsala para iniciar sesión. Se te pedirá crear una contraseña permanente en el primer inicio.",
    goToSignIn: "Ir a iniciar sesión",
    namePlaceholder: "Jane Smith",
    alreadyHaveAccount: "¿Ya tienes cuenta?",
    sending: "Enviando...",
  },
  forgot: {
    title: "Restablecer contraseña",
    intro: "Introduce tu correo y te enviaremos una nueva contraseña temporal.",
    successTitle: "Revisa tu correo",
    successBody:
      "Si existe una cuenta con ese correo, se ha enviado una nueva contraseña temporal.",
    tooManyRequests: "Demasiadas solicitudes. Espera e inténtalo de nuevo.",
    genericError: "Algo salió mal. Inténtalo de nuevo.",
    close: "Cerrar diálogo de restablecimiento de contraseña",
    sendTemporaryPassword: "Enviar contraseña temporal",
    sending: "Enviando...",
  },
  changePassword: {
    title: "Cambiar contraseña",
    intro: "Debes crear una nueva contraseña antes de continuar.",
    currentPlaceholder: "Introduce tu contraseña temporal",
    newPlaceholder: "Mínimo 8 caracteres",
    confirmPlaceholder: "Repite la nueva contraseña",
    changing: "Cambiando contraseña...",
    submit: "Crear nueva contraseña",
    errors: {
      mismatch: "Las nuevas contraseñas no coinciden.",
      tooShort: "La nueva contraseña debe tener al menos 8 caracteres.",
      same: "La nueva contraseña debe ser distinta de la actual.",
      failed: "No se pudo cambiar la contraseña. Inténtalo de nuevo.",
    },
  },
  oidc: {
    failedTitle: "Error al iniciar sesión",
    failureDescription:
      "No pudimos completar la solicitud de inicio de sesión único{{reason}}. Inténtalo de nuevo o usa el inicio con correo y contraseña.",
    backToLogin: "Volver al inicio de sesión",
    completing: "Completando inicio de sesión...",
  },
};

const frAuth: MessageTree = {
  common: {
    email: "E-mail",
    password: "Mot de passe",
    fullName: "Nom complet",
    signIn: "Connexion",
    requestAccess: "Demander l'accès",
    checkEmail: "Consultez votre e-mail",
    temporaryPassword: "Mot de passe temporaire",
    newPassword: "Nouveau mot de passe",
    confirmNewPassword: "Confirmer le nouveau mot de passe",
  },
  hero: {
    tagline: "Plateforme unifiée de recherche sur les résultats",
    descriptionPrefix:
      "Une plateforme de recherche sur les résultats nouvelle génération bâtie sur l'",
    descriptionSuffix:
      "écosystème et le modèle de données commun OMOP. Cohortes, caractérisation, estimation populationnelle, prédiction au niveau patient et analyse de parcours, réunies dans une seule plateforme.",
    openSourcePrefix: "Open source sur",
    links: {
      blog: "Lire notre blog de développement",
      discord: "Rejoindre notre communauté Discord",
      install: "Installer sur une nouvelle machine",
    },
    capabilities: {
      cohortDefinitions: "Définitions de cohortes",
      characterization: "Caractérisation",
      incidenceRates: "Taux d'incidence",
      estimation: "Estimation populationnelle",
      prediction: "Prédiction",
      pathways: "Parcours",
      genomics: "Génomique",
      imaging: "Imagerie",
      heor: "HEOR",
      gis: "SIG",
    },
    cdmVersion: "OMOP CDM v5.4",
  },
  login: {
    subtitle: "Saisissez vos identifiants pour continuer",
    invalidCredentials: "Identifiants non valides. Réessayez.",
    passwordPlaceholder: "Saisir votre mot de passe",
    forgotPassword: "Mot de passe oublié ?",
    fillDemo: "Remplir les identifiants de démonstration",
    signingIn: "Connexion...",
    or: "ou",
    oidcFallback: "Se connecter avec Authentik",
    noAccount: "Vous n'avez pas de compte ?",
  },
  register: {
    heroDescription:
      "Demandez l'accès à la plateforme. Un mot de passe temporaire sera envoyé à votre adresse e-mail.",
    subtitle:
      "Saisissez vos informations et nous vous enverrons un mot de passe temporaire",
    failed: "L'inscription a échoué. Réessayez.",
    successBody:
      "Si cet e-mail est nouveau dans Parthenon, un mot de passe temporaire a été envoyé. Utilisez-le pour vous connecter. Vous devrez définir un mot de passe permanent lors de la première connexion.",
    goToSignIn: "Aller à la connexion",
    namePlaceholder: "Jeanne Martin",
    alreadyHaveAccount: "Vous avez déjà un compte ?",
    sending: "Envoi...",
  },
  forgot: {
    title: "Réinitialiser votre mot de passe",
    intro:
      "Saisissez votre e-mail et nous vous enverrons un nouveau mot de passe temporaire.",
    successTitle: "Consultez votre e-mail",
    successBody:
      "Si un compte existe avec cet e-mail, un nouveau mot de passe temporaire a été envoyé.",
    tooManyRequests: "Trop de demandes. Patientez puis réessayez.",
    genericError: "Une erreur est survenue. Réessayez.",
    close: "Fermer la réinitialisation du mot de passe",
    sendTemporaryPassword: "Envoyer le mot de passe temporaire",
    sending: "Envoi...",
  },
  changePassword: {
    title: "Changer votre mot de passe",
    intro: "Vous devez définir un nouveau mot de passe avant de continuer.",
    currentPlaceholder: "Saisir votre mot de passe temporaire",
    newPlaceholder: "Minimum 8 caractères",
    confirmPlaceholder: "Répéter le nouveau mot de passe",
    changing: "Changement du mot de passe...",
    submit: "Définir le nouveau mot de passe",
    errors: {
      mismatch: "Les nouveaux mots de passe ne correspondent pas.",
      tooShort: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
      same: "Le nouveau mot de passe doit être différent du mot de passe actuel.",
      failed: "Impossible de changer le mot de passe. Réessayez.",
    },
  },
  oidc: {
    failedTitle: "Échec de la connexion",
    failureDescription:
      "Nous n'avons pas pu terminer la connexion unique{{reason}}. Réessayez ou utilisez la connexion par e-mail et mot de passe.",
    backToLogin: "Retour à la connexion",
    completing: "Connexion en cours...",
  },
};

const deAuth: MessageTree = {
  common: {
    email: "E-Mail",
    password: "Passwort",
    fullName: "Vollständiger Name",
    signIn: "Anmelden",
    requestAccess: "Zugang anfordern",
    checkEmail: "E-Mail prüfen",
    temporaryPassword: "Temporäres Passwort",
    newPassword: "Neues Passwort",
    confirmNewPassword: "Neues Passwort bestätigen",
  },
  hero: {
    tagline: "Einheitliche Plattform für Outcomes Research",
    descriptionPrefix:
      "Eine Outcomes-Research-Plattform der nächsten Generation auf Basis des",
    descriptionSuffix:
      "Ökosystems und des OMOP Common Data Model. Kohortenaufbau, Charakterisierung, populationsbezogene Schätzung, patientenbezogene Vorhersage und Pfadanalyse, vereint in einer Plattform.",
    openSourcePrefix: "Open Source auf",
    links: {
      blog: "Unseren Entwicklungsblog lesen",
      discord: "Unserer Discord-Community beitreten",
      install: "Auf einem neuen Rechner installieren",
    },
    capabilities: {
      cohortDefinitions: "Kohortendefinitionen",
      characterization: "Charakterisierung",
      incidenceRates: "Inzidenzraten",
      estimation: "Schätzung",
      prediction: "Vorhersage",
      pathways: "Pfade",
      genomics: "Genomik",
      imaging: "Bildgebung",
      heor: "HEOR",
      gis: "Geoinformatik",
    },
    cdmVersion: "OMOP CDM v5.4",
  },
  login: {
    subtitle: "Geben Sie Ihre Zugangsdaten ein, um fortzufahren",
    invalidCredentials: "Ungültige Zugangsdaten. Bitte erneut versuchen.",
    passwordPlaceholder: "Passwort eingeben",
    forgotPassword: "Passwort vergessen?",
    fillDemo: "Demo-Zugangsdaten einfügen",
    signingIn: "Anmeldung läuft...",
    or: "oder",
    oidcFallback: "Mit Authentik anmelden",
    noAccount: "Noch kein Konto?",
  },
  register: {
    heroDescription:
      "Fordern Sie Zugang zur Plattform an. Ein temporäres Passwort wird an Ihre E-Mail-Adresse gesendet.",
    subtitle:
      "Geben Sie Ihre Daten ein, und wir senden Ihnen ein temporäres Passwort",
    failed: "Registrierung fehlgeschlagen. Bitte erneut versuchen.",
    successBody:
      "Wenn diese E-Mail neu in Parthenon ist, wurde ein temporäres Passwort gesendet. Verwenden Sie es zur Anmeldung. Beim ersten Login müssen Sie ein dauerhaftes Passwort festlegen.",
    goToSignIn: "Zur Anmeldung",
    namePlaceholder: "Max Mustermann",
    alreadyHaveAccount: "Sie haben bereits ein Konto?",
    sending: "Senden...",
  },
  forgot: {
    title: "Passwort zurücksetzen",
    intro:
      "Geben Sie Ihre E-Mail-Adresse ein, und wir senden Ihnen ein neues temporäres Passwort.",
    successTitle: "E-Mail prüfen",
    successBody:
      "Wenn ein Konto mit dieser E-Mail existiert, wurde ein neues temporäres Passwort gesendet.",
    tooManyRequests: "Zu viele Anfragen. Bitte warten und erneut versuchen.",
    genericError: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
    close: "Dialog zum Zurücksetzen des Passworts schließen",
    sendTemporaryPassword: "Temporäres Passwort senden",
    sending: "Senden...",
  },
  changePassword: {
    title: "Passwort ändern",
    intro: "Sie müssen ein neues Passwort festlegen, bevor Sie fortfahren.",
    currentPlaceholder: "Temporäres Passwort eingeben",
    newPlaceholder: "Mindestens 8 Zeichen",
    confirmPlaceholder: "Neues Passwort wiederholen",
    changing: "Passwort wird geändert...",
    submit: "Neues Passwort festlegen",
    errors: {
      mismatch: "Die neuen Passwörter stimmen nicht überein.",
      tooShort: "Das neue Passwort muss mindestens 8 Zeichen lang sein.",
      same: "Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.",
      failed: "Passwort konnte nicht geändert werden. Bitte erneut versuchen.",
    },
  },
  oidc: {
    failedTitle: "Anmeldung fehlgeschlagen",
    failureDescription:
      "Die Single-Sign-On-Anfrage konnte nicht abgeschlossen werden{{reason}}. Versuchen Sie es erneut oder nutzen Sie die Anmeldung mit E-Mail und Passwort.",
    backToLogin: "Zurück zur Anmeldung",
    completing: "Anmeldung wird abgeschlossen...",
  },
};

const ptAuth: MessageTree = {
  common: {
    email: "E-mail",
    password: "Senha",
    fullName: "Nome completo",
    signIn: "Entrar",
    requestAccess: "Solicitar acesso",
    checkEmail: "Verifique seu e-mail",
    temporaryPassword: "Senha temporária",
    newPassword: "Nova senha",
    confirmNewPassword: "Confirmar nova senha",
  },
  hero: {
    tagline: "Plataforma unificada de pesquisa de desfechos",
    descriptionPrefix:
      "Uma plataforma de pesquisa de desfechos de próxima geração baseada no",
    descriptionSuffix:
      "ecossistema e no Modelo de Dados Comum OMOP. Construção de coortes, caracterização, estimativa populacional, predição em nível de paciente e análise de trajetórias, tudo em uma única plataforma.",
    openSourcePrefix: "Código aberto no",
    links: {
      blog: "Ler nosso blog de desenvolvimento",
      discord: "Entrar na nossa comunidade Discord",
      install: "Instalar em uma nova máquina",
    },
    capabilities: {
      cohortDefinitions: "Definições de coortes",
      characterization: "Caracterização",
      incidenceRates: "Taxas de incidência",
      estimation: "Estimativa",
      prediction: "Predição",
      pathways: "Trajetórias",
      genomics: "Genômica",
      imaging: "Imagem",
      heor: "HEOR",
      gis: "SIG",
    },
    cdmVersion: "OMOP CDM v5.4",
  },
  login: {
    subtitle: "Digite suas credenciais para continuar",
    invalidCredentials: "Credenciais inválidas. Tente novamente.",
    passwordPlaceholder: "Digite sua senha",
    forgotPassword: "Esqueceu a senha?",
    fillDemo: "Preencher credenciais de demonstração",
    signingIn: "Entrando...",
    or: "ou",
    oidcFallback: "Entrar com Authentik",
    noAccount: "Não tem uma conta?",
  },
  register: {
    heroDescription:
      "Solicite acesso à plataforma. Uma senha temporária será enviada para seu e-mail.",
    subtitle: "Digite seus dados e enviaremos uma senha temporária por e-mail",
    failed: "Falha no registro. Tente novamente.",
    successBody:
      "Se este e-mail for novo no Parthenon, uma senha temporária foi enviada. Use-a para entrar. Você deverá criar uma senha permanente no primeiro login.",
    goToSignIn: "Ir para entrar",
    namePlaceholder: "Ana Silva",
    alreadyHaveAccount: "Já tem uma conta?",
    sending: "Enviando...",
  },
  forgot: {
    title: "Redefinir sua senha",
    intro: "Digite seu e-mail e enviaremos uma nova senha temporária.",
    successTitle: "Verifique seu e-mail",
    successBody:
      "Se existir uma conta com esse e-mail, uma nova senha temporária foi enviada.",
    tooManyRequests: "Muitas solicitações. Aguarde e tente novamente.",
    genericError: "Algo deu errado. Tente novamente.",
    close: "Fechar diálogo de redefinição de senha",
    sendTemporaryPassword: "Enviar senha temporária",
    sending: "Enviando...",
  },
  changePassword: {
    title: "Alterar sua senha",
    intro: "Você deve definir uma nova senha antes de continuar.",
    currentPlaceholder: "Digite sua senha temporária",
    newPlaceholder: "Mínimo de 8 caracteres",
    confirmPlaceholder: "Repita a nova senha",
    changing: "Alterando senha...",
    submit: "Definir nova senha",
    errors: {
      mismatch: "As novas senhas não coincidem.",
      tooShort: "A nova senha deve ter pelo menos 8 caracteres.",
      same: "A nova senha deve ser diferente da senha atual.",
      failed: "Falha ao alterar a senha. Tente novamente.",
    },
  },
  oidc: {
    failedTitle: "Falha ao entrar",
    failureDescription:
      "Não foi possível concluir a solicitação de login único{{reason}}. Tente novamente ou use login com e-mail e senha.",
    backToLogin: "Voltar para o login",
    completing: "Concluindo login...",
  },
};

const fiAuth: MessageTree = {
  common: {
    email: "Sähköposti",
    password: "Salasana",
    fullName: "Koko nimi",
    signIn: "Kirjaudu sisään",
    requestAccess: "Pyydä käyttöoikeutta",
    checkEmail: "Tarkista sähköpostisi",
    temporaryPassword: "Väliaikainen salasana",
    newPassword: "Uusi salasana",
    confirmNewPassword: "Vahvista uusi salasana",
  },
  hero: {
    tagline: "Yhtenäinen vaikuttavuustutkimuksen alusta",
    descriptionPrefix:
      "Seuraavan sukupolven vaikuttavuustutkimuksen alusta, joka rakentuu",
    descriptionSuffix:
      "ekosysteemin ja OMOP Common Data Modelin päälle. Kohorttien rakentaminen, karakterisointi, väestötason estimointi, potilastason ennustaminen ja hoitopolkuanalyysi yhdessä alustassa.",
    openSourcePrefix: "Avoin lähdekoodi",
    links: {
      blog: "Lue kehitysblogimme",
      discord: "Liity Discord-yhteisöömme",
      install: "Asenna uuteen koneeseen",
    },
    capabilities: {
      cohortDefinitions: "Kohorttimääritykset",
      characterization: "Karakterisointi",
      incidenceRates: "Ilmaantuvuusluvut",
      estimation: "Estimointi",
      prediction: "Ennustaminen",
      pathways: "Polut",
      genomics: "Genomiikka",
      imaging: "Kuvantaminen",
      heor: "HEOR",
      gis: "GIS",
    },
    cdmVersion: "OMOP CDM v5.4",
  },
  login: {
    subtitle: "Anna tunnuksesi jatkaaksesi",
    invalidCredentials: "Virheelliset tunnukset. Yritä uudelleen.",
    passwordPlaceholder: "Anna salasanasi",
    forgotPassword: "Unohditko salasanan?",
    fillDemo: "Täytä demotunnukset",
    signingIn: "Kirjaudutaan...",
    or: "tai",
    oidcFallback: "Kirjaudu Authentikilla",
    noAccount: "Eikö sinulla ole tiliä?",
  },
  register: {
    heroDescription:
      "Pyydä käyttöoikeutta alustaan. Väliaikainen salasana lähetetään sähköpostiisi.",
    subtitle:
      "Anna tietosi, niin lähetämme väliaikaisen salasanan sähköpostitse",
    failed: "Rekisteröinti epäonnistui. Yritä uudelleen.",
    successBody:
      "Jos tämä sähköposti on uusi Parthenonissa, väliaikainen salasana on lähetetty. Käytä sitä kirjautumiseen. Sinua pyydetään asettamaan pysyvä salasana ensimmäisellä kirjautumisella.",
    goToSignIn: "Siirry kirjautumiseen",
    namePlaceholder: "Jane Smith",
    alreadyHaveAccount: "Onko sinulla jo tili?",
    sending: "Lähetetään...",
  },
  forgot: {
    title: "Palauta salasana",
    intro:
      "Anna sähköpostiosoitteesi, niin lähetämme uuden väliaikaisen salasanan.",
    successTitle: "Tarkista sähköpostisi",
    successBody:
      "Jos tällä sähköpostilla on tili, uusi väliaikainen salasana on lähetetty.",
    tooManyRequests: "Liian monta pyyntöä. Odota ja yritä uudelleen.",
    genericError: "Jokin meni vikaan. Yritä uudelleen.",
    close: "Sulje salasanan palautus",
    sendTemporaryPassword: "Lähetä väliaikainen salasana",
    sending: "Lähetetään...",
  },
  changePassword: {
    title: "Vaihda salasana",
    intro: "Sinun on asetettava uusi salasana ennen jatkamista.",
    currentPlaceholder: "Anna väliaikainen salasanasi",
    newPlaceholder: "Vähintään 8 merkkiä",
    confirmPlaceholder: "Toista uusi salasana",
    changing: "Vaihdetaan salasanaa...",
    submit: "Aseta uusi salasana",
    errors: {
      mismatch: "Uudet salasanat eivät täsmää.",
      tooShort: "Uuden salasanan on oltava vähintään 8 merkkiä.",
      same: "Uuden salasanan on oltava eri kuin nykyinen salasana.",
      failed: "Salasanan vaihto epäonnistui. Yritä uudelleen.",
    },
  },
  oidc: {
    failedTitle: "Kirjautuminen epäonnistui",
    failureDescription:
      "Kertakirjautumispyyntöä ei voitu suorittaa{{reason}}. Yritä uudelleen tai käytä sähköposti- ja salasanakirjautumista.",
    backToLogin: "Takaisin kirjautumiseen",
    completing: "Viimeistellään kirjautumista...",
  },
};

const jaAuth: MessageTree = {
  common: {
    email: "メール",
    password: "パスワード",
    fullName: "氏名",
    signIn: "ログイン",
    requestAccess: "アクセスをリクエスト",
    checkEmail: "メールを確認してください",
    temporaryPassword: "一時パスワード",
    newPassword: "新しいパスワード",
    confirmNewPassword: "新しいパスワードを確認",
  },
  hero: {
    tagline: "統合アウトカム研究プラットフォーム",
    descriptionPrefix: "次世代のアウトカム研究プラットフォームです。",
    descriptionSuffix:
      "エコシステムと OMOP Common Data Model を基盤に、コホート作成、特性評価、集団レベル推定、患者レベル予測、経路解析を 1 つのプラットフォームに統合します。",
    openSourcePrefix: "オープンソース:",
    links: {
      blog: "開発ブログを読む",
      discord: "Discord コミュニティに参加",
      install: "新しいマシンにインストール",
    },
    capabilities: {
      cohortDefinitions: "コホート定義",
      characterization: "特性評価",
      incidenceRates: "発生率",
      estimation: "推定",
      prediction: "予測",
      pathways: "経路",
      genomics: "ゲノミクス",
      imaging: "画像",
      heor: "HEOR",
      gis: "GIS",
    },
    cdmVersion: "OMOP CDM v5.4",
  },
  login: {
    subtitle: "続行するには認証情報を入力してください",
    invalidCredentials: "認証情報が無効です。もう一度お試しください。",
    passwordPlaceholder: "パスワードを入力",
    forgotPassword: "パスワードをお忘れですか？",
    fillDemo: "デモ認証情報を入力",
    signingIn: "ログイン中...",
    or: "または",
    oidcFallback: "Authentik でログイン",
    noAccount: "アカウントをお持ちでないですか？",
  },
  register: {
    heroDescription:
      "プラットフォームへのアクセスをリクエストします。一時パスワードがメールアドレスに送信されます。",
    subtitle: "情報を入力すると、一時パスワードをメールで送信します",
    failed: "登録に失敗しました。もう一度お試しください。",
    successBody:
      "このメールが Parthenon で新しい場合、一時パスワードが送信されました。それを使ってログインしてください。初回ログイン時に恒久パスワードの設定が必要です。",
    goToSignIn: "ログインへ",
    namePlaceholder: "Jane Smith",
    alreadyHaveAccount: "すでにアカウントをお持ちですか？",
    sending: "送信中...",
  },
  forgot: {
    title: "パスワードをリセット",
    intro: "メールアドレスを入力すると、新しい一時パスワードを送信します。",
    successTitle: "メールを確認してください",
    successBody:
      "そのメールのアカウントが存在する場合、新しい一時パスワードが送信されました。",
    tooManyRequests:
      "リクエストが多すぎます。しばらく待ってからもう一度お試しください。",
    genericError: "問題が発生しました。もう一度お試しください。",
    close: "パスワードリセットダイアログを閉じる",
    sendTemporaryPassword: "一時パスワードを送信",
    sending: "送信中...",
  },
  changePassword: {
    title: "パスワードを変更",
    intro: "続行する前に新しいパスワードを設定してください。",
    currentPlaceholder: "一時パスワードを入力",
    newPlaceholder: "8 文字以上",
    confirmPlaceholder: "新しいパスワードを再入力",
    changing: "パスワードを変更中...",
    submit: "新しいパスワードを設定",
    errors: {
      mismatch: "新しいパスワードが一致しません。",
      tooShort: "新しいパスワードは 8 文字以上にしてください。",
      same: "新しいパスワードは現在のパスワードと異なる必要があります。",
      failed: "パスワードを変更できませんでした。もう一度お試しください。",
    },
  },
  oidc: {
    failedTitle: "ログインに失敗しました",
    failureDescription:
      "シングルサインオンリクエストを完了できませんでした{{reason}}。もう一度試すか、メールとパスワードでログインしてください。",
    backToLogin: "ログインに戻る",
    completing: "ログインを完了しています...",
  },
};

const zhAuth: MessageTree = {
  common: {
    email: "电子邮件",
    password: "密码",
    fullName: "全名",
    signIn: "登录",
    requestAccess: "请求访问",
    checkEmail: "请检查你的邮箱",
    temporaryPassword: "临时密码",
    newPassword: "新密码",
    confirmNewPassword: "确认新密码",
  },
  hero: {
    tagline: "统一的结局研究平台",
    descriptionPrefix: "基于",
    descriptionSuffix:
      "生态系统和 OMOP 通用数据模型构建的新一代结局研究平台。队列构建、特征描述、群体水平估计、患者水平预测和路径分析，统一在一个平台中。",
    openSourcePrefix: "开源地址",
    links: {
      blog: "阅读我们的开发博客",
      discord: "加入我们的 Discord 社区",
      install: "在新机器上安装",
    },
    capabilities: {
      cohortDefinitions: "队列定义",
      characterization: "特征描述",
      incidenceRates: "发生率",
      estimation: "估计",
      prediction: "预测",
      pathways: "路径",
      genomics: "基因组学",
      imaging: "影像",
      heor: "HEOR",
      gis: "GIS",
    },
    cdmVersion: "OMOP CDM v5.4",
  },
  login: {
    subtitle: "输入你的凭据以继续",
    invalidCredentials: "凭据无效。请重试。",
    passwordPlaceholder: "输入你的密码",
    forgotPassword: "忘记密码？",
    fillDemo: "填入演示凭据",
    signingIn: "正在登录...",
    or: "或",
    oidcFallback: "使用 Authentik 登录",
    noAccount: "还没有账户？",
  },
  register: {
    heroDescription: "请求访问平台。临时密码将发送到你的电子邮件地址。",
    subtitle: "输入你的信息，我们会通过电子邮件发送临时密码",
    failed: "注册失败。请重试。",
    successBody:
      "如果此电子邮件是 Parthenon 中的新地址，临时密码已发送。请使用它登录。首次登录时需要设置永久密码。",
    goToSignIn: "前往登录",
    namePlaceholder: "Jane Smith",
    alreadyHaveAccount: "已有账户？",
    sending: "正在发送...",
  },
  forgot: {
    title: "重置密码",
    intro: "输入你的电子邮件，我们会发送新的临时密码。",
    successTitle: "请检查你的邮箱",
    successBody: "如果存在使用该电子邮件的账户，新的临时密码已发送。",
    tooManyRequests: "请求过多。请稍后再试。",
    genericError: "出现问题。请重试。",
    close: "关闭密码重置对话框",
    sendTemporaryPassword: "发送临时密码",
    sending: "正在发送...",
  },
  changePassword: {
    title: "更改密码",
    intro: "继续之前必须设置新密码。",
    currentPlaceholder: "输入你的临时密码",
    newPlaceholder: "至少 8 个字符",
    confirmPlaceholder: "再次输入新密码",
    changing: "正在更改密码...",
    submit: "设置新密码",
    errors: {
      mismatch: "新密码不匹配。",
      tooShort: "新密码必须至少 8 个字符。",
      same: "新密码必须与当前密码不同。",
      failed: "无法更改密码。请重试。",
    },
  },
  oidc: {
    failedTitle: "登录失败",
    failureDescription:
      "无法完成单点登录请求{{reason}}。请重试，或使用电子邮件和密码登录。",
    backToLogin: "返回登录",
    completing: "正在完成登录...",
  },
};

const koAuth: MessageTree = {
  common: {
    email: "이메일",
    password: "비밀번호",
    fullName: "전체 이름",
    signIn: "로그인",
    requestAccess: "액세스 요청",
    checkEmail: "이메일을 확인하세요",
    temporaryPassword: "임시 비밀번호",
    newPassword: "새 비밀번호",
    confirmNewPassword: "새 비밀번호 확인",
  },
  hero: {
    tagline: "통합 성과 연구 플랫폼",
    descriptionPrefix: "다음을 기반으로 구축된 차세대 성과 연구 플랫폼입니다:",
    descriptionSuffix:
      "생태계와 OMOP Common Data Model. 코호트 구축, 특성화, 인구 수준 추정, 환자 수준 예측, 경로 분석을 하나의 플랫폼에 통합합니다.",
    openSourcePrefix: "오픈 소스:",
    links: {
      blog: "개발 블로그 읽기",
      discord: "Discord 커뮤니티 참여",
      install: "새 머신에 설치",
    },
    capabilities: {
      cohortDefinitions: "코호트 정의",
      characterization: "특성화",
      incidenceRates: "발생률",
      estimation: "추정",
      prediction: "예측",
      pathways: "경로",
      genomics: "유전체학",
      imaging: "이미징",
      heor: "HEOR",
      gis: "GIS",
    },
    cdmVersion: "OMOP CDM v5.4",
  },
  login: {
    subtitle: "계속하려면 자격 증명을 입력하세요",
    invalidCredentials: "자격 증명이 올바르지 않습니다. 다시 시도하세요.",
    passwordPlaceholder: "비밀번호 입력",
    forgotPassword: "비밀번호를 잊으셨나요?",
    fillDemo: "데모 자격 증명 채우기",
    signingIn: "로그인 중...",
    or: "또는",
    oidcFallback: "Authentik으로 로그인",
    noAccount: "계정이 없으신가요?",
  },
  register: {
    heroDescription:
      "플랫폼 액세스를 요청하세요. 임시 비밀번호가 이메일 주소로 전송됩니다.",
    subtitle: "정보를 입력하면 임시 비밀번호를 이메일로 보내드립니다",
    failed: "등록에 실패했습니다. 다시 시도하세요.",
    successBody:
      "이 이메일이 Parthenon에 새로 등록된 이메일이면 임시 비밀번호가 전송되었습니다. 이 비밀번호로 로그인하세요. 첫 로그인 시 영구 비밀번호를 설정해야 합니다.",
    goToSignIn: "로그인으로 이동",
    namePlaceholder: "Jane Smith",
    alreadyHaveAccount: "이미 계정이 있으신가요?",
    sending: "전송 중...",
  },
  forgot: {
    title: "비밀번호 재설정",
    intro: "이메일을 입력하면 새 임시 비밀번호를 보내드립니다.",
    successTitle: "이메일을 확인하세요",
    successBody:
      "해당 이메일의 계정이 존재하면 새 임시 비밀번호가 전송되었습니다.",
    tooManyRequests: "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
    genericError: "문제가 발생했습니다. 다시 시도하세요.",
    close: "비밀번호 재설정 대화상자 닫기",
    sendTemporaryPassword: "임시 비밀번호 보내기",
    sending: "전송 중...",
  },
  changePassword: {
    title: "비밀번호 변경",
    intro: "계속하기 전에 새 비밀번호를 설정해야 합니다.",
    currentPlaceholder: "임시 비밀번호 입력",
    newPlaceholder: "최소 8자",
    confirmPlaceholder: "새 비밀번호 다시 입력",
    changing: "비밀번호 변경 중...",
    submit: "새 비밀번호 설정",
    errors: {
      mismatch: "새 비밀번호가 일치하지 않습니다.",
      tooShort: "새 비밀번호는 최소 8자여야 합니다.",
      same: "새 비밀번호는 현재 비밀번호와 달라야 합니다.",
      failed: "비밀번호를 변경할 수 없습니다. 다시 시도하세요.",
    },
  },
  oidc: {
    failedTitle: "로그인 실패",
    failureDescription:
      "싱글 사인온 요청을 완료할 수 없습니다{{reason}}. 다시 시도하거나 이메일/비밀번호 로그인을 사용하세요.",
    backToLogin: "로그인으로 돌아가기",
    completing: "로그인을 완료하는 중...",
  },
};

const hiAuth: MessageTree = {
  common: {
    email: "ईमेल",
    password: "पासवर्ड",
    fullName: "पूरा नाम",
    signIn: "साइन इन",
    requestAccess: "एक्सेस का अनुरोध करें",
    checkEmail: "अपना ईमेल देखें",
    temporaryPassword: "अस्थायी पासवर्ड",
    newPassword: "नया पासवर्ड",
    confirmNewPassword: "नए पासवर्ड की पुष्टि करें",
  },
  hero: {
    tagline: "एकीकृत आउटकम्स रिसर्च प्लेटफॉर्म",
    descriptionPrefix: "यह अगली पीढ़ी का आउटकम्स रिसर्च प्लेटफॉर्म",
    descriptionSuffix:
      "इकोसिस्टम और OMOP Common Data Model पर बना है. कोहोर्ट निर्माण, कैरेक्टराइजेशन, जनसंख्या-स्तर अनुमान, रोगी-स्तर पूर्वानुमान और पाथवे विश्लेषण एक ही प्लेटफॉर्म में एकीकृत हैं.",
    openSourcePrefix: "ओपन सोर्स",
    links: {
      blog: "हमारा डेवलपमेंट ब्लॉग पढ़ें",
      discord: "हमारी Discord कम्युनिटी में शामिल हों",
      install: "नई मशीन पर इंस्टॉल करें",
    },
    capabilities: {
      cohortDefinitions: "कोहोर्ट परिभाषाएं",
      characterization: "कैरेक्टराइजेशन",
      incidenceRates: "घटना दरें",
      estimation: "अनुमान",
      prediction: "पूर्वानुमान",
      pathways: "पाथवे",
      genomics: "जीनोमिक्स",
      imaging: "इमेजिंग",
      heor: "HEOR",
      gis: "GIS",
    },
    cdmVersion: "OMOP CDM v5.4",
  },
  login: {
    subtitle: "जारी रखने के लिए अपने क्रेडेंशियल दर्ज करें",
    invalidCredentials: "क्रेडेंशियल अमान्य हैं. कृपया फिर प्रयास करें.",
    passwordPlaceholder: "अपना पासवर्ड दर्ज करें",
    forgotPassword: "पासवर्ड भूल गए?",
    fillDemo: "डेमो क्रेडेंशियल भरें",
    signingIn: "साइन इन हो रहा है...",
    or: "या",
    oidcFallback: "Authentik से साइन इन करें",
    noAccount: "खाता नहीं है?",
  },
  register: {
    heroDescription:
      "प्लेटफॉर्म का एक्सेस अनुरोध करें. आपके ईमेल पते पर अस्थायी पासवर्ड भेजा जाएगा.",
    subtitle: "अपने विवरण दर्ज करें और हम अस्थायी पासवर्ड ईमेल करेंगे",
    failed: "पंजीकरण विफल रहा. कृपया फिर प्रयास करें.",
    successBody:
      "यदि यह ईमेल Parthenon में नया है, तो अस्थायी पासवर्ड भेजा गया है. साइन इन करने के लिए उसका उपयोग करें. पहले लॉगिन पर आपको स्थायी पासवर्ड सेट करना होगा.",
    goToSignIn: "साइन इन पर जाएं",
    namePlaceholder: "Jane Smith",
    alreadyHaveAccount: "पहले से खाता है?",
    sending: "भेज रहे हैं...",
  },
  forgot: {
    title: "अपना पासवर्ड रीसेट करें",
    intro: "अपना ईमेल दर्ज करें और हम नया अस्थायी पासवर्ड भेजेंगे.",
    successTitle: "अपना ईमेल देखें",
    successBody:
      "यदि उस ईमेल से कोई खाता मौजूद है, तो नया अस्थायी पासवर्ड भेजा गया है.",
    tooManyRequests:
      "बहुत अधिक अनुरोध. कृपया प्रतीक्षा करें और फिर प्रयास करें.",
    genericError: "कुछ गलत हुआ. कृपया फिर प्रयास करें.",
    close: "पासवर्ड रीसेट संवाद बंद करें",
    sendTemporaryPassword: "अस्थायी पासवर्ड भेजें",
    sending: "भेज रहे हैं...",
  },
  changePassword: {
    title: "अपना पासवर्ड बदलें",
    intro: "जारी रखने से पहले आपको नया पासवर्ड सेट करना होगा.",
    currentPlaceholder: "अपना अस्थायी पासवर्ड दर्ज करें",
    newPlaceholder: "न्यूनतम 8 अक्षर",
    confirmPlaceholder: "नया पासवर्ड दोहराएं",
    changing: "पासवर्ड बदल रहे हैं...",
    submit: "नया पासवर्ड सेट करें",
    errors: {
      mismatch: "नए पासवर्ड मेल नहीं खाते.",
      tooShort: "नया पासवर्ड कम से कम 8 अक्षरों का होना चाहिए.",
      same: "नया पासवर्ड वर्तमान पासवर्ड से अलग होना चाहिए.",
      failed: "पासवर्ड बदला नहीं जा सका. कृपया फिर प्रयास करें.",
    },
  },
  oidc: {
    failedTitle: "साइन इन विफल",
    failureDescription:
      "हम सिंगल साइन-ऑन अनुरोध पूरा नहीं कर सके{{reason}}. फिर प्रयास करें या ईमेल/पासवर्ड लॉगिन का उपयोग करें.",
    backToLogin: "लॉगिन पर वापस जाएं",
    completing: "साइन इन पूरा हो रहा है...",
  },
};

const arAuth: MessageTree = {
  common: {
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    fullName: "الاسم الكامل",
    signIn: "تسجيل الدخول",
    requestAccess: "طلب الوصول",
    checkEmail: "تحقق من بريدك الإلكتروني",
    temporaryPassword: "كلمة مرور مؤقتة",
    newPassword: "كلمة مرور جديدة",
    confirmNewPassword: "تأكيد كلمة المرور الجديدة",
  },
  hero: {
    tagline: "منصة موحدة لأبحاث النتائج",
    descriptionPrefix: "منصة حديثة لأبحاث النتائج مبنية على",
    descriptionSuffix:
      "ونموذج البيانات المشترك OMOP. بناء المجموعات، والتوصيف، والتقدير على مستوى السكان، والتنبؤ على مستوى المريض، وتحليل المسارات، كلها موحدة في منصة واحدة.",
    openSourcePrefix: "مفتوحة المصدر على",
    links: {
      blog: "اقرأ مدونة التطوير",
      discord: "انضم إلى مجتمع Discord",
      install: "التثبيت على جهاز جديد",
    },
    capabilities: {
      cohortDefinitions: "تعريفات المجموعات",
      characterization: "التوصيف",
      incidenceRates: "معدلات الحدوث",
      estimation: "التقدير",
      prediction: "التنبؤ",
      pathways: "المسارات",
      genomics: "الجينوميات",
      imaging: "التصوير",
      heor: "HEOR",
      gis: "GIS",
    },
    cdmVersion: "OMOP CDM v5.4",
  },
  login: {
    subtitle: "أدخل بيانات الاعتماد للمتابعة",
    invalidCredentials: "بيانات الاعتماد غير صالحة. حاول مرة أخرى.",
    passwordPlaceholder: "أدخل كلمة المرور",
    forgotPassword: "هل نسيت كلمة المرور؟",
    fillDemo: "ملء بيانات العرض التجريبي",
    signingIn: "جار تسجيل الدخول...",
    or: "أو",
    oidcFallback: "تسجيل الدخول باستخدام Authentik",
    noAccount: "ليس لديك حساب؟",
  },
  register: {
    heroDescription:
      "اطلب الوصول إلى المنصة. سيتم إرسال كلمة مرور مؤقتة إلى بريدك الإلكتروني.",
    subtitle: "أدخل بياناتك وسنرسل كلمة مرور مؤقتة عبر البريد الإلكتروني",
    failed: "فشل التسجيل. حاول مرة أخرى.",
    successBody:
      "إذا كان هذا البريد الإلكتروني جديدا في Parthenon، فقد تم إرسال كلمة مرور مؤقتة. استخدمها لتسجيل الدخول. سيطلب منك تعيين كلمة مرور دائمة عند أول تسجيل دخول.",
    goToSignIn: "الانتقال إلى تسجيل الدخول",
    namePlaceholder: "Jane Smith",
    alreadyHaveAccount: "هل لديك حساب بالفعل؟",
    sending: "جار الإرسال...",
  },
  forgot: {
    title: "إعادة تعيين كلمة المرور",
    intro: "أدخل بريدك الإلكتروني وسنرسل لك كلمة مرور مؤقتة جديدة.",
    successTitle: "تحقق من بريدك الإلكتروني",
    successBody:
      "إذا كان هناك حساب بهذا البريد الإلكتروني، فقد تم إرسال كلمة مرور مؤقتة جديدة.",
    tooManyRequests: "طلبات كثيرة جدا. انتظر ثم حاول مرة أخرى.",
    genericError: "حدث خطأ ما. حاول مرة أخرى.",
    close: "إغلاق نافذة إعادة تعيين كلمة المرور",
    sendTemporaryPassword: "إرسال كلمة مرور مؤقتة",
    sending: "جار الإرسال...",
  },
  changePassword: {
    title: "تغيير كلمة المرور",
    intro: "يجب تعيين كلمة مرور جديدة قبل المتابعة.",
    currentPlaceholder: "أدخل كلمة المرور المؤقتة",
    newPlaceholder: "8 أحرف على الأقل",
    confirmPlaceholder: "أعد إدخال كلمة المرور الجديدة",
    changing: "جار تغيير كلمة المرور...",
    submit: "تعيين كلمة مرور جديدة",
    errors: {
      mismatch: "كلمتا المرور الجديدتان غير متطابقتين.",
      tooShort: "يجب أن تكون كلمة المرور الجديدة 8 أحرف على الأقل.",
      same: "يجب أن تختلف كلمة المرور الجديدة عن كلمة المرور الحالية.",
      failed: "تعذر تغيير كلمة المرور. حاول مرة أخرى.",
    },
  },
  oidc: {
    failedTitle: "فشل تسجيل الدخول",
    failureDescription:
      "تعذر إكمال طلب تسجيل الدخول الموحد{{reason}}. حاول مرة أخرى أو استخدم تسجيل الدخول بالبريد الإلكتروني وكلمة المرور.",
    backToLogin: "العودة إلى تسجيل الدخول",
    completing: "جار إكمال تسجيل الدخول...",
  },
};

function mergeMessageTrees(
  base: MessageTree,
  override: MessageTree,
): MessageTree {
  return Object.fromEntries(
    [...new Set([...Object.keys(base), ...Object.keys(override)])].map(
      (key) => {
        const baseValue = base[key];
        const overrideValue = override[key];

        if (
          typeof baseValue === "object" &&
          baseValue !== null &&
          typeof overrideValue === "object" &&
          overrideValue !== null
        ) {
          return [key, mergeMessageTrees(baseValue, overrideValue)];
        }

        return [key, overrideValue ?? baseValue];
      },
    ),
  );
}

const enAbbyLayout: MessageTree = {
  panel: {
    dialogLabel: "AI Assistant",
    title: "Abby AI",
    conversationHistory: "Conversation history",
    newChat: "New chat",
    closePanel: "Close AI panel",
    backToChat: "Back to chat",
    noPastConversations: "No past conversations",
    deleteConversation: "Delete conversation",
    suggestedPrompts: "Suggested prompts",
    sendMessage: "Send message",
    untitledConversation: "Untitled",
    messagesAbbrev: "msgs",
    inputPlaceholder: "Ask Abby about {{context}}...",
    time: {
      justNow: "just now",
      minutesAgo: "{{count}}m ago",
      hoursAgo: "{{count}}h ago",
      daysAgo: "{{count}}d ago",
    },
  },
  about: {
    title: "About Abby",
    images: {
      abigailAlt: "Abigail A. Geisinger (1827-1921)",
      abbyAlt: "Abby - Parthenon AI Assistant",
      abigailCaption: "Abigail A. Geisinger, 1827-1921",
      abbyCaption: "Abby - AI Research Assistant",
    },
    subtitle: "Parthenon's AI Research Assistant",
    dedication: {
      title: "In Memory of Abigail Geisinger",
      namedPrefix: "Abby is named in honor of",
      namedName: "Abigail A. Geisinger",
      namedSuffix:
        "(1827-1921), the pioneering philanthropist who founded what would become one of America's most innovative healthcare systems.",
      age85:
        "At the age of 85, widowed and childless, Abigail looked at her rural community of Danville, Pennsylvania, and saw a problem that no one else was solving: there was no hospital. People who fell ill had to be transported by carriage - and later by her own personal Hupmobile - to the nearest facility in Sunbury. She decided she was going to fix that.",
      founding:
        "In 1912, she gathered a group of people together and set her vision into motion. She called upon the Mayo brothers themselves to recommend a physician worthy of leading her hospital. They sent her Dr. Harold Foss, who was practicing medicine on the frozen banks of the Kiwalik River in Candle, Alaska. She convinced him to come to Pennsylvania. The cornerstone was laid in 1913. When the George F. Geisinger Memorial Hospital opened on September 12, 1915, a typhoid epidemic had swept through Danville just two weeks earlier - and her hospital was already saving lives.",
      mottoIntro: "Her motto during construction was unwavering:",
      motto: "\"Make my hospital right. Make it the best.\"",
      service:
        "She was not merely a benefactor who wrote checks. She visited patients and brought flowers from her own garden. At Christmas, she distributed baskets of fruit throughout the community. During World War I, she volunteered to care for wounded soldiers and personally contacted national leaders to offer her hospital's services. Photographs from the cornerstone ceremony show her with her head thrown back, laughing - a woman of warmth, humor, and iron determination.",
      legacy:
        "When Abigail Geisinger died on July 8, 1921, at the age of 94, she left over one million dollars to ensure her hospital would endure. She is buried in a cemetery overlooking the institution she built - a quiet sentinel watching over her life's greatest achievement as it grew from 44 beds and 13 acres into a health system spanning ten hospitals, training generations of physicians, and touching millions of lives.",
    },
    why: {
      title: "Why We Named Her Abby",
      problem:
        "Abigail Geisinger saw that healthcare was too fragmented, too inaccessible, and too difficult for the people who needed it most. She did not accept that as the way things had to be. She built something better.",
      parthenon:
        "Parthenon exists for the same reason. The OHDSI ecosystem - Atlas, WebAPI, Achilles, and a dozen other tools - is powerful but fragmented. Researchers spend more time wrestling with tooling than answering clinical questions. Parthenon brings it all under one roof, just as Abigail brought modern medicine to a community that had none.",
      abbyPrefix:
        "Abby, our AI assistant, carries her namesake's spirit: she helps researchers describe cohorts in plain English, maps concepts across vocabularies, and works to make the complex accessible. She is our small tribute to a woman who looked at an impossible problem and said, simply,",
      abbyQuote: "\"I'm going to fix that.\"",
    },
    footer: {
      dedication:
        "Dedicated with admiration to the memory of Abigail A. Geisinger (1827-1921)",
      founder:
        "Founder of Geisinger Medical Center - Danville, Pennsylvania",
    },
  },
};

const esAbbyLayout: MessageTree = mergeMessageTrees(enAbbyLayout, {
  panel: {
    dialogLabel: "Asistente de IA",
    title: "Abby IA",
    conversationHistory: "Historial de conversaciones",
    newChat: "Nueva conversación",
    closePanel: "Cerrar panel de IA",
    backToChat: "Volver al chat",
    noPastConversations: "No hay conversaciones anteriores",
    deleteConversation: "Eliminar conversación",
    suggestedPrompts: "Sugerencias",
    sendMessage: "Enviar mensaje",
    untitledConversation: "Sin título",
    messagesAbbrev: "mensajes",
    inputPlaceholder: "Pregúntale a Abby sobre {{context}}...",
    time: {
      justNow: "ahora mismo",
      minutesAgo: "hace {{count}} min",
      hoursAgo: "hace {{count}} h",
      daysAgo: "hace {{count}} d",
    },
  },
  about: {
    title: "Acerca de Abby",
    images: {
      abigailAlt: "Abigail A. Geisinger (1827-1921)",
      abbyAlt: "Abby - asistente de IA de Parthenon",
      abigailCaption: "Abigail A. Geisinger, 1827-1921",
      abbyCaption: "Abby - asistente de investigación con IA",
    },
    subtitle: "Asistente de investigación con IA de Parthenon",
    dedication: {
      title: "En memoria de Abigail Geisinger",
      namedPrefix: "Abby lleva su nombre en honor a",
      namedName: "Abigail A. Geisinger",
      namedSuffix:
        "(1827-1921), la filántropa pionera que fundó lo que llegaría a ser uno de los sistemas de salud más innovadores de Estados Unidos.",
      age85:
        "A los 85 años, viuda y sin hijos, Abigail miró su comunidad rural de Danville, Pensilvania, y vio un problema que nadie estaba resolviendo: no había hospital. Quienes enfermaban debían ser trasladados en carruaje - y más tarde en su propio Hupmobile - hasta el centro más cercano en Sunbury. Decidió que iba a arreglarlo.",
      founding:
        "En 1912 reunió a un grupo de personas y puso su visión en marcha. Recurrió a los propios hermanos Mayo para recomendar un médico digno de dirigir su hospital. Le enviaron al Dr. Harold Foss, que ejercía la medicina en las riberas heladas del río Kiwalik, en Candle, Alaska. Ella lo convenció de venir a Pensilvania. La piedra angular se colocó en 1913. Cuando el George F. Geisinger Memorial Hospital abrió el 12 de septiembre de 1915, una epidemia de fiebre tifoidea había azotado Danville apenas dos semanas antes, y su hospital ya estaba salvando vidas.",
      mottoIntro: "Su lema durante la construcción fue inquebrantable:",
      motto: "\"Hagan bien mi hospital. Háganlo el mejor.\"",
      service:
        "No fue simplemente una benefactora que escribía cheques. Visitaba a los pacientes y llevaba flores de su propio jardín. En Navidad distribuía cestas de fruta por toda la comunidad. Durante la Primera Guerra Mundial se ofreció como voluntaria para cuidar soldados heridos y contactó personalmente a líderes nacionales para ofrecer los servicios de su hospital. Las fotografías de la ceremonia de la piedra angular la muestran riendo con la cabeza hacia atrás: una mujer de calidez, humor y férrea determinación.",
      legacy:
        "Cuando Abigail Geisinger murió el 8 de julio de 1921, a los 94 años, dejó más de un millón de dólares para asegurar que su hospital perdurara. Está enterrada en un cementerio que domina la institución que construyó: una centinela silenciosa sobre el mayor logro de su vida, que creció de 44 camas y 13 acres a un sistema de salud con diez hospitales, formador de generaciones de médicos y presente en millones de vidas.",
    },
    why: {
      title: "Por qué la llamamos Abby",
      problem:
        "Abigail Geisinger vio que la atención médica estaba demasiado fragmentada, era demasiado inaccesible y resultaba demasiado difícil para quienes más la necesitaban. No aceptó que las cosas tuvieran que ser así. Construyó algo mejor.",
      parthenon:
        "Parthenon existe por la misma razón. El ecosistema OHDSI - Atlas, WebAPI, Achilles y muchas otras herramientas - es potente pero fragmentado. Los investigadores pasan más tiempo peleando con herramientas que respondiendo preguntas clínicas. Parthenon lo reúne todo bajo un mismo techo, igual que Abigail llevó la medicina moderna a una comunidad que no la tenía.",
      abbyPrefix:
        "Abby, nuestra asistente de IA, lleva el espíritu de su homónima: ayuda a los investigadores a describir cohortes en lenguaje claro, mapea conceptos entre vocabularios y trabaja para hacer accesible lo complejo. Es nuestro pequeño homenaje a una mujer que miró un problema imposible y dijo, sencillamente,",
      abbyQuote: "\"Voy a arreglarlo.\"",
    },
    footer: {
      dedication:
        "Dedicado con admiración a la memoria de Abigail A. Geisinger (1827-1921)",
      founder:
        "Fundadora de Geisinger Medical Center - Danville, Pensilvania",
    },
  },
});

const koAbbyLayout: MessageTree = mergeMessageTrees(enAbbyLayout, {
  panel: {
    dialogLabel: "AI 어시스턴트",
    title: "Abby AI",
    conversationHistory: "대화 기록",
    newChat: "새 대화",
    closePanel: "AI 패널 닫기",
    backToChat: "채팅으로 돌아가기",
    noPastConversations: "이전 대화가 없습니다",
    deleteConversation: "대화 삭제",
    suggestedPrompts: "추천 질문",
    sendMessage: "메시지 보내기",
    untitledConversation: "제목 없음",
    messagesAbbrev: "개 메시지",
    inputPlaceholder: "Abby에게 {{context}}에 대해 물어보세요...",
    time: {
      justNow: "방금 전",
      minutesAgo: "{{count}}분 전",
      hoursAgo: "{{count}}시간 전",
      daysAgo: "{{count}}일 전",
    },
  },
  about: {
    title: "Abby 소개",
    images: {
      abigailAlt: "Abigail A. Geisinger (1827-1921)",
      abbyAlt: "Abby - Parthenon AI 어시스턴트",
      abigailCaption: "Abigail A. Geisinger, 1827-1921",
      abbyCaption: "Abby - AI 연구 어시스턴트",
    },
    subtitle: "Parthenon의 AI 연구 어시스턴트",
    dedication: {
      title: "Abigail Geisinger를 기리며",
      namedPrefix: "Abby는",
      namedName: "Abigail A. Geisinger",
      namedSuffix:
        "(1827-1921)를 기리기 위해 이름 붙였습니다. 그는 훗날 미국에서 가장 혁신적인 의료 시스템 중 하나가 될 기관을 세운 선구적인 자선가였습니다.",
      age85:
        "85세에 남편과 자녀 없이 지내던 Abigail은 펜실베이니아주 댄빌의 시골 공동체를 바라보며 아무도 해결하지 못하던 문제를 보았습니다. 병원이 없었던 것입니다. 아픈 사람들은 마차로, 나중에는 그녀의 개인 Hupmobile로, 가장 가까운 선버리의 시설까지 옮겨져야 했습니다. 그녀는 그 문제를 고치기로 결심했습니다.",
      founding:
        "1912년, 그녀는 사람들을 모아 자신의 비전을 실행에 옮겼습니다. 그녀는 Mayo 형제에게 병원을 이끌 만한 의사를 추천해 달라고 요청했습니다. 그들은 알래스카 Candle의 얼어붙은 Kiwalik 강가에서 진료하던 Harold Foss 박사를 보냈고, 그녀는 그를 펜실베이니아로 오도록 설득했습니다. 초석은 1913년에 놓였습니다. George F. Geisinger Memorial Hospital이 1915년 9월 12일 문을 열었을 때, 불과 2주 전 댄빌에는 장티푸스 유행이 휩쓸고 지나갔고, 그녀의 병원은 이미 생명을 구하고 있었습니다.",
      mottoIntro: "건설 중 그녀의 신념은 흔들리지 않았습니다.",
      motto: "\"내 병원을 제대로 만들어 주세요. 최고의 병원으로 만들어 주세요.\"",
      service:
        "그녀는 단순히 수표를 쓰는 후원자가 아니었습니다. 환자들을 찾아가고 자신의 정원에서 꽃을 가져다주었습니다. 크리스마스에는 지역사회 곳곳에 과일 바구니를 나누었습니다. 제1차 세계대전 중에는 부상병을 돌보겠다고 자원했고, 병원의 서비스를 제공하기 위해 국가 지도자들에게 직접 연락했습니다. 초석식 사진 속 그녀는 고개를 젖히고 웃고 있습니다. 따뜻함과 유머, 강철 같은 결의를 가진 사람이었습니다.",
      legacy:
        "Abigail Geisinger는 1921년 7월 8일, 94세의 나이로 세상을 떠나며 병원이 오래 지속되도록 백만 달러가 넘는 유산을 남겼습니다. 그녀는 자신이 세운 기관이 내려다보이는 묘지에 묻혀 있습니다. 44개 병상과 13에이커에서 시작해 10개 병원으로 이루어진 의료 시스템으로 성장하고, 여러 세대의 의사를 길러내며, 수백만 명의 삶에 닿은 업적을 조용히 지켜보는 파수꾼처럼 말입니다.",
    },
    why: {
      title: "왜 Abby라는 이름을 붙였는가",
      problem:
        "Abigail Geisinger는 의료가 너무 파편화되어 있고, 너무 접근하기 어렵고, 가장 필요한 사람들에게 너무 어렵다는 사실을 보았습니다. 그녀는 그것이 당연하다고 받아들이지 않았습니다. 더 나은 것을 만들었습니다.",
      parthenon:
        "Parthenon도 같은 이유로 존재합니다. Atlas, WebAPI, Achilles와 수많은 도구로 이루어진 OHDSI 생태계는 강력하지만 파편화되어 있습니다. 연구자들은 임상 질문에 답하는 시간보다 도구와 씨름하는 데 더 많은 시간을 씁니다. Parthenon은 모든 것을 한 지붕 아래 모읍니다. Abigail이 현대 의학이 없던 공동체에 그것을 가져온 것처럼 말입니다.",
      abbyPrefix:
        "우리의 AI 어시스턴트 Abby는 그 이름의 정신을 이어받았습니다. 연구자가 코호트를 쉬운 언어로 설명하도록 돕고, 어휘 간 개념을 매핑하며, 복잡한 것을 접근 가능하게 만들기 위해 일합니다. 불가능해 보이는 문제를 바라보고 이렇게 말한 한 여성에게 바치는 작은 헌사입니다.",
      abbyQuote: "\"내가 고치겠습니다.\"",
    },
    footer: {
      dedication:
        "Abigail A. Geisinger (1827-1921)의 기억에 존경을 담아 바칩니다",
      founder:
        "Geisinger Medical Center 창립자 - 펜실베이니아주 댄빌",
    },
  },
});

const frAbbyLayout: MessageTree = mergeMessageTrees(enAbbyLayout, {
  panel: {
    dialogLabel: "Assistant IA",
    title: "Abby IA",
    conversationHistory: "Historique des conversations",
    newChat: "Nouvelle conversation",
    closePanel: "Fermer le panneau IA",
    backToChat: "Retour au chat",
    noPastConversations: "Aucune conversation précédente",
    deleteConversation: "Supprimer la conversation",
    suggestedPrompts: "Suggestions",
    sendMessage: "Envoyer le message",
    untitledConversation: "Sans titre",
    messagesAbbrev: "msg",
    inputPlaceholder: "Demandez à Abby au sujet de {{context}}...",
    time: {
      justNow: "à l'instant",
      minutesAgo: "il y a {{count}} min",
      hoursAgo: "il y a {{count}} h",
      daysAgo: "il y a {{count}} j",
    },
  },
});

const deAbbyLayout: MessageTree = mergeMessageTrees(enAbbyLayout, {
  panel: {
    dialogLabel: "KI-Assistent",
    title: "Abby KI",
    conversationHistory: "Konversationsverlauf",
    newChat: "Neuer Chat",
    closePanel: "KI-Bereich schließen",
    backToChat: "Zurück zum Chat",
    noPastConversations: "Keine früheren Konversationen",
    deleteConversation: "Konversation löschen",
    suggestedPrompts: "Vorgeschlagene Fragen",
    sendMessage: "Nachricht senden",
    untitledConversation: "Ohne Titel",
    messagesAbbrev: "Nachr.",
    inputPlaceholder: "Fragen Sie Abby zu {{context}}...",
    time: {
      justNow: "gerade eben",
      minutesAgo: "vor {{count}} Min.",
      hoursAgo: "vor {{count}} Std.",
      daysAgo: "vor {{count}} Tg.",
    },
  },
});

const ptAbbyLayout: MessageTree = mergeMessageTrees(enAbbyLayout, {
  panel: {
    dialogLabel: "Assistente de IA",
    title: "Abby IA",
    conversationHistory: "Histórico de conversas",
    newChat: "Nova conversa",
    closePanel: "Fechar painel de IA",
    backToChat: "Voltar ao chat",
    noPastConversations: "Nenhuma conversa anterior",
    deleteConversation: "Excluir conversa",
    suggestedPrompts: "Sugestões",
    sendMessage: "Enviar mensagem",
    untitledConversation: "Sem título",
    messagesAbbrev: "msgs",
    inputPlaceholder: "Pergunte à Abby sobre {{context}}...",
    time: {
      justNow: "agora mesmo",
      minutesAgo: "há {{count}} min",
      hoursAgo: "há {{count}} h",
      daysAgo: "há {{count}} d",
    },
  },
});

const fiAbbyLayout: MessageTree = mergeMessageTrees(enAbbyLayout, {
  panel: {
    dialogLabel: "Tekoälyavustaja",
    title: "Abby AI",
    conversationHistory: "Keskusteluhistoria",
    newChat: "Uusi keskustelu",
    closePanel: "Sulje tekoälypaneeli",
    backToChat: "Takaisin chattiin",
    noPastConversations: "Ei aiempia keskusteluja",
    deleteConversation: "Poista keskustelu",
    suggestedPrompts: "Ehdotetut kehotteet",
    sendMessage: "Lähetä viesti",
    untitledConversation: "Nimetön",
    messagesAbbrev: "viestiä",
    inputPlaceholder: "Kysy Abbylta aiheesta {{context}}...",
    time: {
      justNow: "juuri nyt",
      minutesAgo: "{{count}} min sitten",
      hoursAgo: "{{count}} h sitten",
      daysAgo: "{{count}} pv sitten",
    },
  },
});

const jaAbbyLayout: MessageTree = mergeMessageTrees(enAbbyLayout, {
  panel: {
    dialogLabel: "AI アシスタント",
    title: "Abby AI",
    conversationHistory: "会話履歴",
    newChat: "新しいチャット",
    closePanel: "AI パネルを閉じる",
    backToChat: "チャットに戻る",
    noPastConversations: "過去の会話はありません",
    deleteConversation: "会話を削除",
    suggestedPrompts: "おすすめプロンプト",
    sendMessage: "メッセージを送信",
    untitledConversation: "無題",
    messagesAbbrev: "件",
    inputPlaceholder: "{{context}} について Abby に質問...",
    time: {
      justNow: "たった今",
      minutesAgo: "{{count}} 分前",
      hoursAgo: "{{count}} 時間前",
      daysAgo: "{{count}} 日前",
    },
  },
});

const zhAbbyLayout: MessageTree = mergeMessageTrees(enAbbyLayout, {
  panel: {
    dialogLabel: "AI 助手",
    title: "Abby AI",
    conversationHistory: "会话历史",
    newChat: "新建聊天",
    closePanel: "关闭 AI 面板",
    backToChat: "返回聊天",
    noPastConversations: "没有历史会话",
    deleteConversation: "删除会话",
    suggestedPrompts: "建议提示",
    sendMessage: "发送消息",
    untitledConversation: "未命名",
    messagesAbbrev: "条消息",
    inputPlaceholder: "向 Abby 询问 {{context}}...",
    time: {
      justNow: "刚刚",
      minutesAgo: "{{count}} 分钟前",
      hoursAgo: "{{count}} 小时前",
      daysAgo: "{{count}} 天前",
    },
  },
});

const hiAbbyLayout: MessageTree = mergeMessageTrees(enAbbyLayout, {
  "panel": {
    "dialogLabel": "AI सहायक",
    "title": "Abby AI",
    "conversationHistory": "बातचीत का इतिहास",
    "newChat": "नई चैट",
    "closePanel": "AI पैनल बंद करें",
    "backToChat": "चैट पर वापस जाएँ",
    "noPastConversations": "कोई पिछली बातचीत नहीं",
    "deleteConversation": "बातचीत मिटाएं",
    "suggestedPrompts": "सुझाए गए संकेत",
    "sendMessage": "मेसेज भेजें",
    "untitledConversation": "शीर्षकहीन",
    "messagesAbbrev": "संदेश",
    "inputPlaceholder": "Abby से {{context}} के बारे में पूछें...",
    "time": {
      "justNow": "बस अब",
      "minutesAgo": "{{count}}m पहले",
      "hoursAgo": "{{count}}h पहले",
      "daysAgo": "{{count}}d पहले"
    }
  },
  "about": {
    "title": "Abby के बारे में",
    "images": {
      "abigailAlt": "Abigail A. Geisinger (1827-1921)",
      "abbyAlt": "Abby - Parthenon AI सहायक",
      "abigailCaption": "Abigail A. Geisinger, 1827-1921",
      "abbyCaption": "Abby - AI अनुसंधान सहायक"
    },
    "subtitle": "Parthenon के AI अनुसंधान सहायक",
    "dedication": {
      "title": "Abigail Geisinger की स्मृति में",
      "namedPrefix": "Abby का नाम किसके सम्मान में रखा गया है?",
      "namedName": "Abigail A. Geisinger",
      "namedSuffix": "(1827-1921), अग्रणी परोपकारी जिन्होंने अमेरिका की सबसे नवीन स्वास्थ्य देखभाल प्रणालियों में से एक की स्थापना की।",
      "age85": "85 साल की उम्र में, विधवा और निःसंतान, अबीगैल ने Danville, Pennsylvania के अपने ग्रामीण समुदाय को देखा, और एक ऐसी समस्या देखी जिसे कोई और हल नहीं कर रहा था: कोई अस्पताल नहीं था। जो लोग बीमार पड़ गए उन्हें गाड़ी से - और बाद में उनकी निजी Hupmobile द्वारा - Sunbury में निकटतम सुविधा तक ले जाना पड़ा। उसने निर्णय लिया कि वह इसे ठीक करेगी।",
      "founding": "1912 में, उन्होंने लोगों के एक समूह को इकट्ठा किया और अपनी दृष्टि को गति प्रदान की। उसने स्वयं Mayo भाइयों से अपने अस्पताल का नेतृत्व करने के योग्य चिकित्सक की सिफारिश करने का आह्वान किया। उन्होंने डॉ. Harold Foss को भेजा, जो Candle, Alaska में Kiwalik River के जमे हुए किनारे पर चिकित्सा का अभ्यास कर रहे थे। उसने उसे Pennsylvania में आने के लिए मना लिया। आधारशिला 1913 में रखी गई थी। जब George F. Geisinger Memorial Hospital 12 सितंबर, 1915 को खोला गया, तो केवल दो सप्ताह पहले ही Danville में टाइफाइड महामारी फैल गई थी - और उसका अस्पताल पहले से ही लोगों की जान बचा रहा था।",
      "mottoIntro": "निर्माण के दौरान उनका आदर्श वाक्य अटल था:",
      "motto": "\"मेरे अस्पताल को सही बनाओ। इसे सर्वश्रेष्ठ बनाओ।\"",
      "service": "वह केवल चेक लिखने वाली दानदाता नहीं थी। वह मरीजों से मिलती थी और अपने बगीचे से फूल लाती थी। क्रिसमस पर, उसने पूरे समुदाय में फलों की टोकरियाँ वितरित कीं। प्रथम विश्व युद्ध के दौरान, उन्होंने स्वेच्छा से घायल सैनिकों की देखभाल की और अपने अस्पताल की सेवाओं की पेशकश करने के लिए व्यक्तिगत रूप से राष्ट्रीय नेताओं से संपर्क किया। आधारशिला समारोह की तस्वीरों में वह अपना सिर पीछे झुकाए हुए, हंसते हुए दिखाई दे रही हैं - गर्मजोशी, हास्य और दृढ़ निश्चय वाली महिला।",
      "legacy": "जब Abigail Geisinger की 94 वर्ष की आयु में 8 जुलाई 1921 को मृत्यु हो गई, तो उन्होंने यह सुनिश्चित करने के लिए एक मिलियन डॉलर से अधिक छोड़ दिया कि उनका अस्पताल चलता रहे। उन्हें एक कब्रिस्तान में दफ़नाया गया है, जहां उनके द्वारा बनाई गई संस्था दिखती है - एक शांत प्रहरी जो उनके जीवन की सबसे बड़ी उपलब्धि को देख रहा है क्योंकि यह 44 बिस्तरों और 13 एकड़ से बढ़कर एक स्वास्थ्य प्रणाली बन गई है जो दस अस्पतालों में फैली हुई है, चिकित्सकों की पीढ़ियों को प्रशिक्षण दे रही है और लाखों लोगों के जीवन को छू रही है।"
    },
    "why": {
      "title": "हमने उसका नाम Abby क्यों रखा?",
      "problem": "Abigail Geisinger ने देखा कि स्वास्थ्य सेवा बहुत खंडित थी, बहुत दुर्गम थी, और उन लोगों के लिए बहुत कठिन थी जिन्हें इसकी सबसे अधिक आवश्यकता थी। उसने इसे वैसे स्वीकार नहीं किया जैसा कि चीजें होनी थीं। उसने कुछ बेहतर बनाया।",
      "parthenon": "Parthenon इसी कारण से मौजूद है। OHDSI पारिस्थितिकी तंत्र - Atlas, WebAPI, Achilles, और एक दर्जन अन्य उपकरण - शक्तिशाली लेकिन खंडित है। शोधकर्ता नैदानिक ​​प्रश्नों का उत्तर देने की तुलना में टूलींग के साथ संघर्ष करने में अधिक समय बिताते हैं। Parthenon यह सब एक ही छत के नीचे लाता है, जैसे अबीगैल एक ऐसे समुदाय में आधुनिक चिकित्सा लेकर आई जिसके पास कोई नहीं था।",
      "abbyPrefix": "Abby, हमारी AI सहायक, अपने नाम की भावना रखती है: वह शोधकर्ताओं को सादे अंग्रेजी में समूहों का वर्णन करने में मदद करती है, शब्दावली में अवधारणाओं को मानचित्रित करती है, और परिसर को सुलभ बनाने के लिए काम करती है। वह उस महिला को हमारी छोटी सी श्रद्धांजलि है जिसने एक असंभव समस्या को देखा और कहा, सरलता से,",
      "abbyQuote": "\"मैं इसे ठीक करने जा रहा हूँ।\""
    },
    "footer": {
      "dedication": "Abigail A. Geisinger (1827-1921) की स्मृति में प्रशंसा सहित समर्पित",
      "founder": "Geisinger Medical Center के संस्थापक - Danville, Pennsylvania"
    }
  }
});


function withAbbyLayout(
  namespaces: ParthenonNamespaces,
  abbyLayout: MessageTree,
): ParthenonNamespaces {
  return {
    ...namespaces,
    layout: mergeMessageTrees(namespaces.layout, { abby: abbyLayout }),
  };
}

const enCommonUi: MessageTree = {
  aria: {
    breadcrumb: "Breadcrumb",
    copyCode: "Copy code",
    close: "Close",
    dismiss: "Dismiss",
  },
  codeFallback: "Code",
  job: {
    status: {
      pending: "Pending",
      running: "Running",
      completed: "Completed",
      failed: "Failed",
    },
    progress: "Progress",
    duration: "Duration",
    elapsed: "Elapsed",
    completedSuccessfully: "Job completed successfully.",
  },
  tags: {
    filterByTag: "Filter by tag:",
    more: "{{count}} more",
    search: "Search",
    clearAll: "Clear all",
    browseTags: "Browse Tags ({{count}})",
    selected: "{{count}} selected",
    noMatches: "No tags match \"{{query}}\"",
    done: "Done",
    searchPlaceholder: "Search tags...",
    sort: {
      selectedFirst: "Selected first",
      byCount: "By count",
    },
  },
};

const esCommonUi: MessageTree = mergeMessageTrees(enCommonUi, {
  aria: {
    breadcrumb: "Ruta de navegación",
    copyCode: "Copiar código",
    close: "Cerrar",
    dismiss: "Descartar",
  },
  codeFallback: "Código",
  job: {
    status: {
      pending: "Pendiente",
      running: "En ejecución",
      completed: "Completado",
      failed: "Fallido",
    },
    progress: "Progreso",
    duration: "Duración",
    elapsed: "Transcurrido",
    completedSuccessfully: "Trabajo completado correctamente.",
  },
  tags: {
    filterByTag: "Filtrar por etiqueta:",
    more: "{{count}} más",
    search: "Buscar",
    clearAll: "Limpiar todo",
    browseTags: "Explorar etiquetas ({{count}})",
    selected: "{{count}} seleccionadas",
    noMatches: "Ninguna etiqueta coincide con \"{{query}}\"",
    done: "Listo",
    searchPlaceholder: "Buscar etiquetas...",
    sort: {
      selectedFirst: "Seleccionadas primero",
      byCount: "Por conteo",
    },
  },
});

const koCommonUi: MessageTree = mergeMessageTrees(enCommonUi, {
  aria: {
    breadcrumb: "이동 경로",
    copyCode: "코드 복사",
    close: "닫기",
    dismiss: "닫기",
  },
  codeFallback: "코드",
  job: {
    status: {
      pending: "대기 중",
      running: "실행 중",
      completed: "완료됨",
      failed: "실패",
    },
    progress: "진행률",
    duration: "소요 시간",
    elapsed: "경과 시간",
    completedSuccessfully: "작업이 성공적으로 완료되었습니다.",
  },
  tags: {
    filterByTag: "태그로 필터:",
    more: "{{count}}개 더",
    search: "검색",
    clearAll: "모두 지우기",
    browseTags: "태그 찾아보기 ({{count}})",
    selected: "{{count}}개 선택됨",
    noMatches: "\"{{query}}\"와 일치하는 태그가 없습니다",
    done: "완료",
    searchPlaceholder: "태그 검색...",
    sort: {
      selectedFirst: "선택 항목 먼저",
      byCount: "개수순",
    },
  },
});

const frCommonUi: MessageTree = mergeMessageTrees(enCommonUi, {
  aria: {
    breadcrumb: "Fil d'Ariane",
    copyCode: "Copier le code",
    close: "Fermer",
    dismiss: "Ignorer",
  },
  codeFallback: "Code",
  job: {
    status: {
      pending: "En attente",
      running: "En cours",
      completed: "Terminée",
      failed: "Échec",
    },
    progress: "Progression",
    duration: "Durée",
    elapsed: "Écoulé",
    completedSuccessfully: "Tâche terminée avec succès.",
  },
  tags: {
    filterByTag: "Filtrer par tag :",
    more: "{{count}} de plus",
    search: "Rechercher",
    clearAll: "Tout effacer",
    browseTags: "Parcourir les tags ({{count}})",
    selected: "{{count}} sélectionnés",
    noMatches: "Aucun tag ne correspond à \"{{query}}\"",
    done: "Terminé",
    searchPlaceholder: "Rechercher des tags...",
    sort: {
      selectedFirst: "Sélectionnés d'abord",
      byCount: "Par nombre",
    },
  },
});

const deCommonUi: MessageTree = mergeMessageTrees(enCommonUi, {
  aria: {
    breadcrumb: "Breadcrumb",
    copyCode: "Code kopieren",
    close: "Schließen",
    dismiss: "Ausblenden",
  },
  codeFallback: "Code",
  job: {
    status: {
      pending: "Ausstehend",
      running: "Läuft",
      completed: "Abgeschlossen",
      failed: "Fehlgeschlagen",
    },
    progress: "Fortschritt",
    duration: "Dauer",
    elapsed: "Vergangen",
    completedSuccessfully: "Job erfolgreich abgeschlossen.",
  },
  tags: {
    filterByTag: "Nach Tag filtern:",
    more: "{{count}} weitere",
    search: "Suchen",
    clearAll: "Alle löschen",
    browseTags: "Tags durchsuchen ({{count}})",
    selected: "{{count}} ausgewählt",
    noMatches: "Keine Tags passen zu \"{{query}}\"",
    done: "Fertig",
    searchPlaceholder: "Tags suchen...",
    sort: {
      selectedFirst: "Ausgewählte zuerst",
      byCount: "Nach Anzahl",
    },
  },
});

const ptCommonUi: MessageTree = mergeMessageTrees(enCommonUi, {
  aria: {
    breadcrumb: "Caminho de navegação",
    copyCode: "Copiar código",
    close: "Fechar",
    dismiss: "Dispensar",
  },
  codeFallback: "Código",
  job: {
    status: {
      pending: "Pendente",
      running: "Em execução",
      completed: "Concluída",
      failed: "Falhou",
    },
    progress: "Progresso",
    duration: "Duração",
    elapsed: "Decorrido",
    completedSuccessfully: "Tarefa concluída com sucesso.",
  },
  tags: {
    filterByTag: "Filtrar por tag:",
    more: "mais {{count}}",
    search: "Pesquisar",
    clearAll: "Limpar tudo",
    browseTags: "Explorar tags ({{count}})",
    selected: "{{count}} selecionados",
    noMatches: "Nenhuma tag corresponde a \"{{query}}\"",
    done: "Concluído",
    searchPlaceholder: "Pesquisar tags...",
    sort: {
      selectedFirst: "Selecionados primeiro",
      byCount: "Por contagem",
    },
  },
});

const fiCommonUi: MessageTree = mergeMessageTrees(enCommonUi, {
  aria: {
    breadcrumb: "Murupolku",
    copyCode: "Kopioi koodi",
    close: "Sulje",
    dismiss: "Hylkää",
  },
  codeFallback: "Koodi",
  job: {
    status: {
      pending: "Odottaa",
      running: "Käynnissä",
      completed: "Valmis",
      failed: "Epäonnistui",
    },
    progress: "Edistyminen",
    duration: "Kesto",
    elapsed: "Kulunut",
    completedSuccessfully: "Työ valmistui onnistuneesti.",
  },
  tags: {
    filterByTag: "Suodata tunnisteella:",
    more: "{{count}} lisää",
    search: "Hae",
    clearAll: "Tyhjennä kaikki",
    browseTags: "Selaa tunnisteita ({{count}})",
    selected: "{{count}} valittu",
    noMatches: "Mikään tunniste ei vastaa hakua \"{{query}}\"",
    done: "Valmis",
    searchPlaceholder: "Hae tunnisteita...",
    sort: {
      selectedFirst: "Valitut ensin",
      byCount: "Määrän mukaan",
    },
  },
});

const jaCommonUi: MessageTree = mergeMessageTrees(enCommonUi, {
  aria: {
    breadcrumb: "パンくず",
    copyCode: "コードをコピー",
    close: "閉じる",
    dismiss: "閉じる",
  },
  codeFallback: "コード",
  job: {
    status: {
      pending: "保留中",
      running: "実行中",
      completed: "完了",
      failed: "失敗",
    },
    progress: "進捗",
    duration: "期間",
    elapsed: "経過時間",
    completedSuccessfully: "ジョブが正常に完了しました。",
  },
  tags: {
    filterByTag: "タグでフィルター:",
    more: "ほか {{count}} 件",
    search: "検索",
    clearAll: "すべてクリア",
    browseTags: "タグを参照 ({{count}})",
    selected: "{{count}} 件選択",
    noMatches: "\"{{query}}\" に一致するタグはありません",
    done: "完了",
    searchPlaceholder: "タグを検索...",
    sort: {
      selectedFirst: "選択済みを先に",
      byCount: "件数順",
    },
  },
});

const zhCommonUi: MessageTree = mergeMessageTrees(enCommonUi, {
  aria: {
    breadcrumb: "面包屑",
    copyCode: "复制代码",
    close: "关闭",
    dismiss: "忽略",
  },
  codeFallback: "代码",
  job: {
    status: {
      pending: "待处理",
      running: "运行中",
      completed: "已完成",
      failed: "失败",
    },
    progress: "进度",
    duration: "持续时间",
    elapsed: "已用时间",
    completedSuccessfully: "作业已成功完成。",
  },
  tags: {
    filterByTag: "按标签筛选:",
    more: "还有 {{count}} 个",
    search: "搜索",
    clearAll: "全部清除",
    browseTags: "浏览标签 ({{count}})",
    selected: "已选择 {{count}} 个",
    noMatches: "没有标签匹配 \"{{query}}\"",
    done: "完成",
    searchPlaceholder: "搜索标签...",
    sort: {
      selectedFirst: "已选优先",
      byCount: "按数量",
    },
  },
});

const hiCommonUi: MessageTree = mergeMessageTrees(enCommonUi, {
  "aria": {
    "breadcrumb": "ब्रेडक्रम्ब",
    "copyCode": "कोड कॉपी करें",
    "close": "बंद करें",
    "dismiss": "नकार देना"
  },
  "codeFallback": "कोड",
  "job": {
    "status": {
      "pending": "लंबित",
      "running": "दौड़ना",
      "completed": "पुरा होना।",
      "failed": "असफल"
    },
    "progress": "प्रगति",
    "duration": "अवधि",
    "elapsed": "बीत गया",
    "completedSuccessfully": "कार्य सफलतापूर्वक पूरा हुआ."
  },
  "tags": {
    "filterByTag": "टैग द्वारा फ़िल्टर करें:",
    "more": "{{count}} और अधिक",
    "search": "खोज",
    "clearAll": "सभी साफ करें",
    "browseTags": "टैग ब्राउज़ करें ({{count}})",
    "selected": "{{count}} चयनित",
    "noMatches": "कोई टैग \"{{query}}\" से मेल नहीं खाता",
    "done": "हो गया",
    "searchPlaceholder": "टैग खोजें...",
    "sort": {
      "selectedFirst": "पहले चुना गया",
      "byCount": "गिनती से"
    }
  }
});


function withCommonUi(
  namespaces: ParthenonNamespaces,
  commonUi: MessageTree,
): ParthenonNamespaces {
  return {
    ...namespaces,
    common: mergeMessageTrees(namespaces.common, { ui: commonUi }),
  };
}

const enAuthSetup: MessageTree = {
  setup: {
    wizard: {
      steps: {
        welcome: "Welcome",
        security: "Security",
        health: "Health",
        ai: "AI",
        auth: "Auth",
        dataSources: "Data Sources",
        complete: "Complete",
      },
      close: "Close",
      skipSetup: "Skip setup - return any time via Administration",
      previous: "Previous",
      next: "Next",
      skip: "Skip",
      skipStep: "Skip this step - configure later in Administration",
    },
    welcome: {
      title: "Welcome to Parthenon",
      intro:
        "Let's configure your research platform. This wizard walks through the essential setup steps - each can be skipped and revisited any time from the Administration panel.",
      configureTitle: "What we'll configure",
      beforeTitle: "Before you start",
      optionalNote: "None of the optional steps are required to proceed.",
      overview: {
        systemHealth: {
          label: "System Health",
          description: "Verify all platform services are running correctly.",
        },
        aiProvider: {
          label: "AI Provider",
          description: "Configure which AI backend powers Abby.",
        },
        authentication: {
          label: "Authentication",
          description: "Set up SSO providers like LDAP, OAuth, or OIDC.",
        },
        dataSources: {
          label: "Data Sources",
          description: "Connect CDM databases or import from legacy WebAPI.",
        },
      },
      before: {
        cdm: "Your OMOP CDM database is accessible from this server",
        docker: "Docker and all containers are running (verified in the next step)",
        ollama: "Ollama is running locally if you want AI features (optional)",
        sso: "You have your organization's SSO details if enabling single sign-on (optional)",
      },
    },
    changePassword: {
      strength: {
        weak: "Weak",
        fair: "Fair",
        good: "Good",
        strong: "Strong",
        excellent: "Excellent",
        tooShort: "Too short",
      },
      errors: {
        mismatch: "Passwords do not match.",
        tooShort: "New password must be at least 8 characters.",
        same: "New password must differ from the current password.",
        failed: "Password change failed. Please try again.",
      },
      successTitle: "Password updated",
      successDescription:
        "Your account is secured. Continue to the next step.",
      title: "Secure Your Account",
      intro:
        "A temporary password was generated during installation. Set a permanent password before continuing.",
      temporaryTitle:
        "Temporary credentials were generated during install",
      temporaryPrefix: "Your temporary password is in",
      credentialsFile: ".install-credentials",
      temporarySuffix:
        "at the repo root. Enter it below, then choose a permanent password.",
      currentLabel: "Current (temporary) password",
      currentPlaceholder: "Enter temporary password",
      newLabel: "New password",
      newPlaceholder: "Min 8 characters",
      toggleNewVisibility: "Show or hide new password",
      confirmLabel: "Confirm new password",
      confirmPlaceholder: "Repeat new password",
      submit: "Set permanent password",
    },
    systemHealth: {
      status: {
        healthy: "Healthy",
        degraded: "Degraded",
        down: "Down",
      },
      queue: {
        pending: "Pending",
        failed: "Failed",
      },
      aiUnhealthy:
        "Abby AI is not responding - configure the provider in the next step.",
      configureAi: "Configure AI",
      title: "System Health Check",
      intro: "Verifying that all platform services are running correctly.",
      refresh: "Refresh",
      checking: "Checking services...",
      overall: "System {{status}}",
      lastChecked: "Last checked at {{time}}",
      autoRefresh: "Auto-refreshes every 30 seconds.",
    },
    aiProvider: {
      regions: {
        local: "Local",
        us: "US",
        china: "China",
        eu: "EU",
      },
      switchToThis: "Switch to this",
      testFailed: "Connection test failed.",
      loading: "Loading AI providers...",
      title: "AI Provider Configuration",
      intro:
        "Configure which AI backend powers Abby, the research assistant. Only one provider is active at a time.",
      activeProvider: "Active provider:",
      model: "Model",
      modelPlaceholder: "Model name",
      apiKey: "API Key",
      baseUrl: "Base URL",
      save: "Save",
      testConnection: "Test Connection",
      hideOtherProviders: "Hide other providers ({{count}})",
      showOtherProviders: "Show other providers ({{count}})",
    },
    authentication: {
      providers: {
        ldap: {
          label: "LDAP / Active Directory",
          description: "Authenticate against AD or any LDAP v3 directory.",
        },
        oauth2: {
          label: "OAuth 2.0",
          description: "Delegate auth to GitHub, Google, Microsoft, or custom.",
        },
        saml2: {
          label: "SAML 2.0",
          description: "Enterprise SSO via Okta, Azure AD, ADFS, etc.",
        },
        oidc: {
          label: "OpenID Connect",
          description: "Modern SSO with PKCE and OIDC discovery.",
        },
      },
      enabled: "Enabled",
      disabled: "Disabled",
      configure: "Configure",
      testConnection: "Test Connection",
      connectionSuccessful: "Connection successful",
      connectionFailed: "Connection failed",
      loading: "Loading auth providers...",
      title: "Authentication Providers",
      intro:
        "Configure external identity providers for single sign-on. This step is optional - local username/password authentication is always available.",
      usernamePassword: "Username & Password",
      builtIn: "Built-in Sanctum authentication - always active.",
      alwaysOn: "Always on",
    },
    onboarding: {
      tour: {
        sidebarTitle: "Navigation Sidebar",
        sidebarContent:
          "All your research tools live here: Data Explorer, Vocabulary, Cohort Definitions, Concept Sets, Analyses, and more.",
        commandTitle: "Command Palette (Cmd K)",
        commandContent:
          "Quickly jump to any page or action without clicking through menus. Try Cmd K (or Ctrl+K) and search 'cohort'.",
        dataSourcesTitle: "Data Sources",
        dataSourcesContent:
          "Connect your CDM sources here. All analyses run against these data sources.",
        cohortDefinitionsTitle: "Cohort Definitions",
        cohortDefinitionsContent:
          "Build OHDSI-compatible cohort definitions using inclusion/exclusion criteria, then generate counts against any connected CDM.",
        vocabularyTitle: "Vocabulary Explorer",
        vocabularyContent:
          "Search 7M+ OMOP concepts, browse hierarchies, and build concept sets to use in your cohort definitions.",
      },
      cards: {
        vocabularyTitle: "Explore Vocabulary",
        vocabularyDescription: "Search 7M+ OMOP concepts and build concept sets.",
        cohortTitle: "Build a Cohort",
        cohortDescription:
          "Define inclusion/exclusion criteria and generate counts.",
        quickStartTitle: "Read the Quick Start",
        quickStartDescription: "From zero to a cohort count in 15 minutes.",
      },
      skipAria: "Skip onboarding",
      title: "Welcome to Parthenon",
      intro:
        "A modern OMOP outcomes research platform. Let's get you started.",
      startTour: "Start Quick Tour",
      skip: "I'm already familiar - skip",
    },
    dataSources: {
      demoTitle: "Eunomia GiBleed Demo Dataset loaded",
      demoPrefix: "A synthetic OMOP CDM dataset with",
      demoPatients: "2,694 patients",
      demoSuffix:
        "and gastrointestinal bleeding episodes. Safe to run cohort definitions and characterization analyses against - ideal for exploring Parthenon before connecting your real CDM.",
      loading: "Loading data sources...",
      title: "Data Sources",
      intro:
        "Connect CDM databases to run cohort definitions and analyses against. You can also import sources from a legacy OHDSI WebAPI instance.",
      configuredSources: "Configured sources ({{count}})",
      daimon: "daimon",
      daimons: "daimons",
      emptyTitle: "No data sources yet",
      emptyDescription:
        "Import from a legacy WebAPI instance or add sources from the Data Sources page later.",
      importToggle: "Import from Legacy WebAPI",
      webApiUrl: "WebAPI URL",
      authType: "Auth Type",
      auth: {
        none: "None",
        basic: "Basic",
        bearer: "Bearer Token",
        basicCredentials: "Username:Password",
        bearerCredentials: "Token",
        basicPlaceholder: "user:password",
        bearerPlaceholder: "Bearer token",
      },
      importSources: "Import Sources",
      importSuccess: "Imported {{count}} {{label}}",
      importSkipped: ", {{count}} skipped (already exist)",
      sourceSingular: "source",
      sourcePlural: "sources",
      importFailed: "Import failed. Please check the URL and try again.",
      managePrefix: "Manage data sources any time from",
      manageLink: "Settings > Data Sources",
    },
    complete: {
      summaryItems: {
        accountSecured: "Account Secured",
        systemHealthVerified: "System Health Verified",
        aiProviderConfigured: "AI Provider Configured",
        authenticationConfigured: "Authentication Configured",
        dataSourcesConnected: "Data Sources Connected",
      },
      nextSteps: {
        exploreDemoData: "Explore Demo Data",
        exploreDemoDataDescription: "Browse the Eunomia GiBleed dataset",
        createFirstCohort: "Create Your First Cohort",
        createFirstCohortDescription: "Build a patient cohort definition",
        inviteTeam: "Invite Team Members",
        inviteTeamDescription: "Add users and assign roles",
      },
      title: "Parthenon is ready!",
      allDone:
        "All setup steps completed. You can return to this wizard any time via Administration.",
      partialDone:
        "{{completed}} of {{total}} steps completed - skipped steps can be configured any time.",
      setupSummary: "Setup summary",
      skipped: "(skipped)",
      goBackTitle: "Go back to {{label}}",
      fix: "Fix",
      nextTitle: "What to do next",
      launch: "Launch Parthenon",
    },
  },
};

const esAuthSetup: MessageTree = mergeMessageTrees(enAuthSetup, {
  setup: {
    wizard: {
      steps: {
        welcome: "Bienvenida",
        security: "Seguridad",
        health: "Estado",
        ai: "IA",
        auth: "Autenticación",
        dataSources: "Fuentes de datos",
        complete: "Completo",
      },
      close: "Cerrar",
      skipSetup: "Omitir configuración - vuelve cuando quieras desde Administración",
      previous: "Anterior",
      next: "Siguiente",
      skip: "Omitir",
      skipStep: "Omitir este paso - configúralo más tarde en Administración",
    },
    welcome: {
      title: "Bienvenido a Parthenon",
      intro:
        "Configuremos tu plataforma de investigación. Este asistente recorre los pasos esenciales de configuración; cada uno puede omitirse y revisarse más tarde desde el panel de Administración.",
      configureTitle: "Qué configuraremos",
      beforeTitle: "Antes de empezar",
      optionalNote: "Ningún paso opcional es obligatorio para continuar.",
      overview: {
        systemHealth: {
          label: "Estado del sistema",
          description: "Verifica que todos los servicios de la plataforma funcionen correctamente.",
        },
        aiProvider: {
          label: "Proveedor de IA",
          description: "Configura qué backend de IA impulsa a Abby.",
        },
        authentication: {
          label: "Autenticación",
          description: "Configura proveedores SSO como LDAP, OAuth u OIDC.",
        },
        dataSources: {
          label: "Fuentes de datos",
          description: "Conecta bases CDM o importa desde WebAPI heredado.",
        },
      },
      before: {
        cdm: "Tu base OMOP CDM es accesible desde este servidor",
        docker: "Docker y todos los contenedores están en ejecución (se verifica en el siguiente paso)",
        ollama: "Ollama se ejecuta localmente si quieres funciones de IA (opcional)",
        sso: "Tienes los datos SSO de tu organización si habilitas inicio de sesión único (opcional)",
      },
    },
    changePassword: {
      strength: {
        weak: "Débil",
        fair: "Aceptable",
        good: "Buena",
        strong: "Fuerte",
        excellent: "Excelente",
        tooShort: "Demasiado corta",
      },
      errors: {
        mismatch: "Las contraseñas no coinciden.",
        tooShort: "La nueva contraseña debe tener al menos 8 caracteres.",
        same: "La nueva contraseña debe ser distinta de la actual.",
        failed: "No se pudo cambiar la contraseña. Inténtalo de nuevo.",
      },
      successTitle: "Contraseña actualizada",
      successDescription:
        "Tu cuenta está protegida. Continúa con el siguiente paso.",
      title: "Protege tu cuenta",
      intro:
        "Durante la instalación se generó una contraseña temporal. Define una contraseña permanente antes de continuar.",
      temporaryTitle:
        "Se generaron credenciales temporales durante la instalación",
      temporaryPrefix: "Tu contraseña temporal está en",
      credentialsFile: ".install-credentials",
      temporarySuffix:
        "en la raíz del repositorio. Introdúcela abajo y luego elige una contraseña permanente.",
      currentLabel: "Contraseña actual (temporal)",
      currentPlaceholder: "Introduce la contraseña temporal",
      newLabel: "Nueva contraseña",
      newPlaceholder: "Mínimo 8 caracteres",
      toggleNewVisibility: "Mostrar u ocultar nueva contraseña",
      confirmLabel: "Confirmar nueva contraseña",
      confirmPlaceholder: "Repite la nueva contraseña",
      submit: "Definir contraseña permanente",
    },
    systemHealth: {
      status: {
        healthy: "Correcto",
        degraded: "Degradado",
        down: "Caído",
      },
      queue: {
        pending: "Pendientes",
        failed: "Fallidos",
      },
      aiUnhealthy:
        "Abby AI no responde; configura el proveedor en el siguiente paso.",
      configureAi: "Configurar IA",
      title: "Comprobación del estado del sistema",
      intro: "Verificando que todos los servicios de la plataforma funcionen correctamente.",
      refresh: "Actualizar",
      checking: "Comprobando servicios...",
      overall: "Sistema {{status}}",
      lastChecked: "Última comprobación a las {{time}}",
      autoRefresh: "Se actualiza automáticamente cada 30 segundos.",
    },
    aiProvider: {
      regions: {
        local: "Local",
        us: "EE. UU.",
        china: "China",
        eu: "UE",
      },
      switchToThis: "Cambiar a este",
      testFailed: "La prueba de conexión falló.",
      loading: "Cargando proveedores de IA...",
      title: "Configuración del proveedor de IA",
      intro:
        "Configura qué backend de IA impulsa a Abby, la asistente de investigación. Solo un proveedor está activo a la vez.",
      activeProvider: "Proveedor activo:",
      model: "Modelo",
      modelPlaceholder: "Nombre del modelo",
      apiKey: "Clave API",
      baseUrl: "URL base",
      save: "Guardar",
      testConnection: "Probar conexión",
      hideOtherProviders: "Ocultar otros proveedores ({{count}})",
      showOtherProviders: "Mostrar otros proveedores ({{count}})",
    },
    authentication: {
      providers: {
        ldap: {
          label: "LDAP / Active Directory",
          description: "Autentica contra AD o cualquier directorio LDAP v3.",
        },
        oauth2: {
          label: "OAuth 2.0",
          description: "Delega auth a GitHub, Google, Microsoft o uno personalizado.",
        },
        saml2: {
          label: "SAML 2.0",
          description: "SSO empresarial mediante Okta, Azure AD, ADFS, etc.",
        },
        oidc: {
          label: "OpenID Connect",
          description: "SSO moderno con PKCE y descubrimiento OIDC.",
        },
      },
      enabled: "Habilitado",
      disabled: "Deshabilitado",
      configure: "Configurar",
      testConnection: "Probar conexión",
      connectionSuccessful: "Conexión correcta",
      connectionFailed: "Conexión fallida",
      loading: "Cargando proveedores de autenticación...",
      title: "Proveedores de autenticación",
      intro:
        "Configura proveedores externos de identidad para inicio de sesión único. Este paso es opcional; la autenticación local con usuario y contraseña siempre está disponible.",
      usernamePassword: "Usuario y contraseña",
      builtIn: "Autenticación Sanctum integrada; siempre activa.",
      alwaysOn: "Siempre activo",
    },
    onboarding: {
      tour: {
        sidebarTitle: "Barra lateral de navegación",
        sidebarContent:
          "Todas tus herramientas de investigación viven aquí: Explorador de datos, Vocabulario, Definiciones de cohortes, Conjuntos de conceptos, Análisis y más.",
        commandTitle: "Paleta de comandos (Cmd K)",
        commandContent:
          "Salta rápidamente a cualquier página o acción sin navegar por menús. Prueba Cmd K (o Ctrl+K) y busca 'cohort'.",
        dataSourcesTitle: "Fuentes de datos",
        dataSourcesContent:
          "Conecta aquí tus fuentes CDM. Todos los análisis se ejecutan contra estas fuentes de datos.",
        cohortDefinitionsTitle: "Definiciones de cohortes",
        cohortDefinitionsContent:
          "Crea definiciones de cohortes compatibles con OHDSI usando criterios de inclusión/exclusión y genera conteos contra cualquier CDM conectado.",
        vocabularyTitle: "Explorador de vocabulario",
        vocabularyContent:
          "Busca más de 7M conceptos OMOP, explora jerarquías y crea conjuntos de conceptos para tus definiciones de cohortes.",
      },
      cards: {
        vocabularyTitle: "Explorar vocabulario",
        vocabularyDescription: "Busca más de 7M conceptos OMOP y crea conjuntos de conceptos.",
        cohortTitle: "Crear una cohorte",
        cohortDescription: "Define criterios de inclusión/exclusión y genera conteos.",
        quickStartTitle: "Leer inicio rápido",
        quickStartDescription: "De cero a un conteo de cohorte en 15 minutos.",
      },
      skipAria: "Omitir incorporación",
      title: "Bienvenido a Parthenon",
      intro:
        "Una plataforma moderna de investigación de resultados basada en OMOP. Empecemos.",
      startTour: "Iniciar recorrido rápido",
      skip: "Ya estoy familiarizado - omitir",
    },
    dataSources: {
      demoTitle: "Dataset demo Eunomia GiBleed cargado",
      demoPrefix: "Un dataset OMOP CDM sintético con",
      demoPatients: "2.694 pacientes",
      demoSuffix:
        "y episodios de sangrado gastrointestinal. Es seguro para ejecutar definiciones de cohortes y análisis de caracterización; ideal para explorar Parthenon antes de conectar tu CDM real.",
      loading: "Cargando fuentes de datos...",
      title: "Fuentes de datos",
      intro:
        "Conecta bases CDM para ejecutar definiciones de cohortes y análisis. También puedes importar fuentes desde una instancia OHDSI WebAPI heredada.",
      configuredSources: "Fuentes configuradas ({{count}})",
      daimon: "daimon",
      daimons: "daimons",
      emptyTitle: "Aún no hay fuentes de datos",
      emptyDescription:
        "Importa desde una instancia WebAPI heredada o agrega fuentes más tarde desde la página Fuentes de datos.",
      importToggle: "Importar desde WebAPI heredado",
      webApiUrl: "URL de WebAPI",
      authType: "Tipo de autenticación",
      auth: {
        none: "Ninguna",
        basic: "Básica",
        bearer: "Token Bearer",
        basicCredentials: "Usuario:Contraseña",
        bearerCredentials: "Token",
        basicPlaceholder: "usuario:contraseña",
        bearerPlaceholder: "Token Bearer",
      },
      importSources: "Importar fuentes",
      importSuccess: "Importadas {{count}} {{label}}",
      importSkipped: ", {{count}} omitidas (ya existen)",
      sourceSingular: "fuente",
      sourcePlural: "fuentes",
      importFailed: "La importación falló. Revisa la URL e inténtalo de nuevo.",
      managePrefix: "Gestiona fuentes de datos en cualquier momento desde",
      manageLink: "Configuración > Fuentes de datos",
    },
    complete: {
      summaryItems: {
        accountSecured: "Cuenta protegida",
        systemHealthVerified: "Estado del sistema verificado",
        aiProviderConfigured: "Proveedor de IA configurado",
        authenticationConfigured: "Autenticación configurada",
        dataSourcesConnected: "Fuentes de datos conectadas",
      },
      nextSteps: {
        exploreDemoData: "Explorar datos demo",
        exploreDemoDataDescription: "Explora el dataset Eunomia GiBleed",
        createFirstCohort: "Crear tu primera cohorte",
        createFirstCohortDescription: "Crea una definición de cohorte de pacientes",
        inviteTeam: "Invitar miembros del equipo",
        inviteTeamDescription: "Agrega usuarios y asigna roles",
      },
      title: "Parthenon está listo",
      allDone:
        "Todos los pasos de configuración están completos. Puedes volver a este asistente en cualquier momento desde Administración.",
      partialDone:
        "{{completed}} de {{total}} pasos completados - los pasos omitidos se pueden configurar en cualquier momento.",
      setupSummary: "Resumen de configuración",
      skipped: "(omitido)",
      goBackTitle: "Volver a {{label}}",
      fix: "Corregir",
      nextTitle: "Qué hacer ahora",
      launch: "Abrir Parthenon",
    },
  },
});

const koAuthSetup: MessageTree = mergeMessageTrees(enAuthSetup, {
  setup: {
    wizard: {
      steps: {
        welcome: "환영",
        security: "보안",
        health: "상태",
        ai: "AI",
        auth: "인증",
        dataSources: "데이터 소스",
        complete: "완료",
      },
      close: "닫기",
      skipSetup: "설정 건너뛰기 - 언제든지 관리에서 다시 설정할 수 있습니다",
      previous: "이전",
      next: "다음",
      skip: "건너뛰기",
      skipStep: "이 단계 건너뛰기 - 나중에 관리에서 설정",
    },
    welcome: {
      title: "Parthenon에 오신 것을 환영합니다",
      intro:
        "연구 플랫폼을 설정해 보겠습니다. 이 마법사는 필수 설정 단계를 안내하며, 각 단계는 건너뛰고 나중에 관리 패널에서 다시 설정할 수 있습니다.",
      configureTitle: "설정할 항목",
      beforeTitle: "시작하기 전에",
      optionalNote: "선택 단계는 진행에 필수는 아닙니다.",
      overview: {
        systemHealth: {
          label: "시스템 상태",
          description: "모든 플랫폼 서비스가 올바르게 실행 중인지 확인합니다.",
        },
        aiProvider: {
          label: "AI 제공자",
          description: "Abby를 구동할 AI 백엔드를 설정합니다.",
        },
        authentication: {
          label: "인증",
          description: "LDAP, OAuth, OIDC 같은 SSO 제공자를 설정합니다.",
        },
        dataSources: {
          label: "데이터 소스",
          description: "CDM 데이터베이스를 연결하거나 기존 WebAPI에서 가져옵니다.",
        },
      },
      before: {
        cdm: "이 서버에서 OMOP CDM 데이터베이스에 접근할 수 있습니다",
        docker: "Docker와 모든 컨테이너가 실행 중입니다(다음 단계에서 확인)",
        ollama: "AI 기능을 사용하려면 Ollama가 로컬에서 실행 중입니다(선택)",
        sso: "싱글 사인온을 활성화하려면 조직의 SSO 정보가 있습니다(선택)",
      },
    },
    changePassword: {
      strength: {
        weak: "약함",
        fair: "보통",
        good: "좋음",
        strong: "강함",
        excellent: "매우 강함",
        tooShort: "너무 짧음",
      },
      errors: {
        mismatch: "비밀번호가 일치하지 않습니다.",
        tooShort: "새 비밀번호는 최소 8자여야 합니다.",
        same: "새 비밀번호는 현재 비밀번호와 달라야 합니다.",
        failed: "비밀번호 변경에 실패했습니다. 다시 시도하세요.",
      },
      successTitle: "비밀번호 업데이트됨",
      successDescription:
        "계정이 보호되었습니다. 다음 단계로 계속 진행하세요.",
      title: "계정 보호",
      intro:
        "설치 중 임시 비밀번호가 생성되었습니다. 계속하기 전에 영구 비밀번호를 설정하세요.",
      temporaryTitle: "설치 중 임시 자격 증명이 생성되었습니다",
      temporaryPrefix: "임시 비밀번호는",
      credentialsFile: ".install-credentials",
      temporarySuffix:
        "파일의 저장소 루트에 있습니다. 아래에 입력한 뒤 영구 비밀번호를 선택하세요.",
      currentLabel: "현재(임시) 비밀번호",
      currentPlaceholder: "임시 비밀번호 입력",
      newLabel: "새 비밀번호",
      newPlaceholder: "최소 8자",
      toggleNewVisibility: "새 비밀번호 표시 또는 숨기기",
      confirmLabel: "새 비밀번호 확인",
      confirmPlaceholder: "새 비밀번호 다시 입력",
      submit: "영구 비밀번호 설정",
    },
    systemHealth: {
      status: {
        healthy: "정상",
        degraded: "저하",
        down: "중단",
      },
      queue: {
        pending: "대기 중",
        failed: "실패",
      },
      aiUnhealthy:
        "Abby AI가 응답하지 않습니다. 다음 단계에서 제공자를 설정하세요.",
      configureAi: "AI 설정",
      title: "시스템 상태 확인",
      intro: "모든 플랫폼 서비스가 올바르게 실행 중인지 확인합니다.",
      refresh: "새로고침",
      checking: "서비스 확인 중...",
      overall: "시스템 {{status}}",
      lastChecked: "{{time}}에 마지막 확인",
      autoRefresh: "30초마다 자동으로 새로고침됩니다.",
    },
    aiProvider: {
      regions: {
        local: "로컬",
        us: "미국",
        china: "중국",
        eu: "EU",
      },
      switchToThis: "이 제공자로 전환",
      testFailed: "연결 테스트에 실패했습니다.",
      loading: "AI 제공자를 불러오는 중...",
      title: "AI 제공자 설정",
      intro:
        "연구 어시스턴트 Abby를 구동할 AI 백엔드를 설정하세요. 한 번에 하나의 제공자만 활성화됩니다.",
      activeProvider: "활성 제공자:",
      model: "모델",
      modelPlaceholder: "모델 이름",
      apiKey: "API 키",
      baseUrl: "Base URL",
      save: "저장",
      testConnection: "연결 테스트",
      hideOtherProviders: "다른 제공자 숨기기 ({{count}})",
      showOtherProviders: "다른 제공자 표시 ({{count}})",
    },
    authentication: {
      providers: {
        ldap: {
          label: "LDAP / Active Directory",
          description: "AD 또는 LDAP v3 디렉터리로 인증합니다.",
        },
        oauth2: {
          label: "OAuth 2.0",
          description: "GitHub, Google, Microsoft 또는 사용자 지정 제공자에 인증을 위임합니다.",
        },
        saml2: {
          label: "SAML 2.0",
          description: "Okta, Azure AD, ADFS 등을 통한 엔터프라이즈 SSO.",
        },
        oidc: {
          label: "OpenID Connect",
          description: "PKCE와 OIDC discovery를 사용하는 현대적인 SSO.",
        },
      },
      enabled: "활성화됨",
      disabled: "비활성화됨",
      configure: "설정",
      testConnection: "연결 테스트",
      connectionSuccessful: "연결 성공",
      connectionFailed: "연결 실패",
      loading: "인증 제공자를 불러오는 중...",
      title: "인증 제공자",
      intro:
        "싱글 사인온을 위한 외부 ID 제공자를 설정하세요. 이 단계는 선택 사항이며, 로컬 사용자명/비밀번호 인증은 항상 사용할 수 있습니다.",
      usernamePassword: "사용자명 및 비밀번호",
      builtIn: "내장 Sanctum 인증 - 항상 활성화되어 있습니다.",
      alwaysOn: "항상 켜짐",
    },
    onboarding: {
      tour: {
        sidebarTitle: "탐색 사이드바",
        sidebarContent:
          "데이터 탐색기, Vocabulary, 코호트 정의, 개념 집합, 분석 등 모든 연구 도구가 여기에 있습니다.",
        commandTitle: "명령 팔레트 (Cmd K)",
        commandContent:
          "메뉴를 클릭하지 않고도 페이지나 작업으로 빠르게 이동하세요. Cmd K(또는 Ctrl+K)를 누르고 'cohort'를 검색해 보세요.",
        dataSourcesTitle: "데이터 소스",
        dataSourcesContent:
          "CDM 소스를 여기에서 연결합니다. 모든 분석은 이 데이터 소스를 대상으로 실행됩니다.",
        cohortDefinitionsTitle: "코호트 정의",
        cohortDefinitionsContent:
          "포함/제외 기준으로 OHDSI 호환 코호트 정의를 만들고 연결된 CDM에서 카운트를 생성합니다.",
        vocabularyTitle: "Vocabulary 탐색기",
        vocabularyContent:
          "700만 개 이상의 OMOP 개념을 검색하고, 계층을 탐색하고, 코호트 정의에 사용할 개념 집합을 만듭니다.",
      },
      cards: {
        vocabularyTitle: "Vocabulary 탐색",
        vocabularyDescription: "700만 개 이상의 OMOP 개념을 검색하고 개념 집합을 만듭니다.",
        cohortTitle: "코호트 만들기",
        cohortDescription: "포함/제외 기준을 정의하고 카운트를 생성합니다.",
        quickStartTitle: "빠른 시작 읽기",
        quickStartDescription: "15분 만에 코호트 카운트까지 진행합니다.",
      },
      skipAria: "온보딩 건너뛰기",
      title: "Parthenon에 오신 것을 환영합니다",
      intro:
        "OMOP 기반의 현대적인 성과 연구 플랫폼입니다. 시작해 보겠습니다.",
      startTour: "빠른 둘러보기 시작",
      skip: "이미 익숙합니다 - 건너뛰기",
    },
    dataSources: {
      demoTitle: "Eunomia GiBleed 데모 데이터셋 로드됨",
      demoPrefix: "합성 OMOP CDM 데이터셋:",
      demoPatients: "환자 2,694명",
      demoSuffix:
        "및 위장관 출혈 에피소드가 포함되어 있습니다. 실제 CDM을 연결하기 전에 Parthenon을 탐색하기에 적합하며, 코호트 정의와 특성화 분석을 안전하게 실행할 수 있습니다.",
      loading: "데이터 소스를 불러오는 중...",
      title: "데이터 소스",
      intro:
        "코호트 정의와 분석을 실행할 CDM 데이터베이스를 연결하세요. 기존 OHDSI WebAPI 인스턴스에서 소스를 가져올 수도 있습니다.",
      configuredSources: "설정된 소스 ({{count}})",
      daimon: "daimon",
      daimons: "daimons",
      emptyTitle: "아직 데이터 소스가 없습니다",
      emptyDescription:
        "기존 WebAPI 인스턴스에서 가져오거나 나중에 데이터 소스 페이지에서 추가하세요.",
      importToggle: "기존 WebAPI에서 가져오기",
      webApiUrl: "WebAPI URL",
      authType: "인증 유형",
      auth: {
        none: "없음",
        basic: "Basic",
        bearer: "Bearer 토큰",
        basicCredentials: "사용자명:비밀번호",
        bearerCredentials: "토큰",
        basicPlaceholder: "user:password",
        bearerPlaceholder: "Bearer token",
      },
      importSources: "소스 가져오기",
      importSuccess: "{{count}}개 {{label}} 가져옴",
      importSkipped: ", {{count}}개 건너뜀(이미 존재)",
      sourceSingular: "소스",
      sourcePlural: "소스",
      importFailed: "가져오기에 실패했습니다. URL을 확인하고 다시 시도하세요.",
      managePrefix: "데이터 소스는 언제든지 여기에서 관리할 수 있습니다:",
      manageLink: "설정 > 데이터 소스",
    },
    complete: {
      summaryItems: {
        accountSecured: "계정 보안 완료",
        systemHealthVerified: "시스템 상태 확인됨",
        aiProviderConfigured: "AI 제공자 설정됨",
        authenticationConfigured: "인증 설정됨",
        dataSourcesConnected: "데이터 소스 연결됨",
      },
      nextSteps: {
        exploreDemoData: "데모 데이터 탐색",
        exploreDemoDataDescription: "Eunomia GiBleed 데이터셋 살펴보기",
        createFirstCohort: "첫 코호트 만들기",
        createFirstCohortDescription: "환자 코호트 정의 만들기",
        inviteTeam: "팀원 초대",
        inviteTeamDescription: "사용자를 추가하고 역할을 할당",
      },
      title: "Parthenon 준비 완료",
      allDone:
        "모든 설정 단계가 완료되었습니다. 언제든지 관리에서 이 마법사로 돌아올 수 있습니다.",
      partialDone:
        "{{total}}단계 중 {{completed}}단계 완료 - 건너뛴 단계는 언제든지 설정할 수 있습니다.",
      setupSummary: "설정 요약",
      skipped: "(건너뜀)",
      goBackTitle: "{{label}} 단계로 돌아가기",
      fix: "수정",
      nextTitle: "다음에 할 일",
      launch: "Parthenon 시작",
    },
  },
});

const frAuthSetup: MessageTree = mergeMessageTrees(enAuthSetup, {
  setup: {
    wizard: {
      steps: {
        welcome: "Accueil",
        security: "Sécurité",
        health: "État",
        ai: "IA",
        auth: "Authentification",
        dataSources: "Sources de données",
        complete: "Terminé",
      },
      close: "Fermer",
      skipSetup:
        "Ignorer la configuration - revenez-y à tout moment depuis Administration",
      previous: "Précédent",
      next: "Suivant",
      skip: "Ignorer",
      skipStep:
        "Ignorer cette étape - configurez-la plus tard dans Administration",
    },
    welcome: {
      title: "Bienvenue dans Parthenon",
      intro:
        "Configurons votre plateforme de recherche. Cet assistant parcourt les étapes essentielles ; chacune peut être ignorée et reprise plus tard depuis le panneau Administration.",
      configureTitle: "Ce que nous allons configurer",
      beforeTitle: "Avant de commencer",
      optionalNote: "Aucune étape facultative n'est requise pour continuer.",
      overview: {
        systemHealth: {
          label: "État du système",
          description:
            "Vérifier que tous les services de la plateforme fonctionnent correctement.",
        },
        aiProvider: {
          label: "Fournisseur IA",
          description: "Configurer le backend IA qui alimente Abby.",
        },
        authentication: {
          label: "Authentification",
          description:
            "Configurer des fournisseurs SSO comme LDAP, OAuth ou OIDC.",
        },
        dataSources: {
          label: "Sources de données",
          description:
            "Connecter des bases CDM ou importer depuis un ancien WebAPI.",
        },
      },
      before: {
        cdm: "Votre base OMOP CDM est accessible depuis ce serveur",
        docker:
          "Docker et tous les conteneurs sont en cours d'exécution (vérifié à l'étape suivante)",
        ollama:
          "Ollama s'exécute localement si vous souhaitez utiliser les fonctions IA (facultatif)",
        sso: "Vous disposez des informations SSO de votre organisation si vous activez l'authentification unique (facultatif)",
      },
    },
    changePassword: {
      strength: {
        weak: "Faible",
        fair: "Correcte",
        good: "Bonne",
        strong: "Forte",
        excellent: "Excellente",
        tooShort: "Trop courte",
      },
      errors: {
        mismatch: "Les mots de passe ne correspondent pas.",
        tooShort: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
        same: "Le nouveau mot de passe doit être différent du mot de passe actuel.",
        failed: "Échec du changement de mot de passe. Veuillez réessayer.",
      },
      successTitle: "Mot de passe mis à jour",
      successDescription:
        "Votre compte est sécurisé. Continuez à l'étape suivante.",
      title: "Sécuriser votre compte",
      intro:
        "Un mot de passe temporaire a été généré pendant l'installation. Définissez un mot de passe permanent avant de continuer.",
      temporaryTitle:
        "Des identifiants temporaires ont été générés pendant l'installation",
      temporaryPrefix: "Votre mot de passe temporaire se trouve dans",
      temporarySuffix:
        "à la racine du dépôt. Saisissez-le ci-dessous, puis choisissez un mot de passe permanent.",
      currentLabel: "Mot de passe actuel (temporaire)",
      currentPlaceholder: "Saisir le mot de passe temporaire",
      newLabel: "Nouveau mot de passe",
      newPlaceholder: "Minimum 8 caractères",
      toggleNewVisibility: "Afficher ou masquer le nouveau mot de passe",
      confirmLabel: "Confirmer le nouveau mot de passe",
      confirmPlaceholder: "Répéter le nouveau mot de passe",
      submit: "Définir le mot de passe permanent",
    },
    systemHealth: {
      status: {
        healthy: "Sain",
        degraded: "Dégradé",
        down: "Indisponible",
      },
      queue: {
        pending: "En attente",
        failed: "Échec",
      },
      aiUnhealthy:
        "Abby IA ne répond pas - configurez le fournisseur à l'étape suivante.",
      configureAi: "Configurer l'IA",
      title: "Vérification de l'état du système",
      intro:
        "Vérification que tous les services de la plateforme fonctionnent correctement.",
      refresh: "Actualiser",
      checking: "Vérification des services...",
      overall: "Système {{status}}",
      lastChecked: "Dernière vérification à {{time}}",
      autoRefresh: "Actualisation automatique toutes les 30 secondes.",
    },
    aiProvider: {
      regions: {
        local: "Local",
        us: "États-Unis",
        china: "Chine",
        eu: "UE",
      },
      switchToThis: "Basculer vers celui-ci",
      testFailed: "Le test de connexion a échoué.",
      loading: "Chargement des fournisseurs IA...",
      title: "Configuration du fournisseur IA",
      intro:
        "Configurez le backend IA qui alimente Abby, l'assistante de recherche. Un seul fournisseur est actif à la fois.",
      activeProvider: "Fournisseur actif :",
      model: "Modèle",
      modelPlaceholder: "Nom du modèle",
      apiKey: "Clé API",
      baseUrl: "URL de base",
      save: "Enregistrer",
      testConnection: "Tester la connexion",
      hideOtherProviders: "Masquer les autres fournisseurs ({{count}})",
      showOtherProviders: "Afficher les autres fournisseurs ({{count}})",
    },
    authentication: {
      providers: {
        ldap: {
          label: "LDAP / Active Directory",
          description:
            "Authentifier avec AD ou tout annuaire LDAP v3.",
        },
        oauth2: {
          label: "OAuth 2.0",
          description:
            "Déléguer l'authentification à GitHub, Google, Microsoft ou un fournisseur personnalisé.",
        },
        saml2: {
          label: "SAML 2.0",
          description:
            "SSO d'entreprise via Okta, Azure AD, ADFS, etc.",
        },
        oidc: {
          label: "OpenID Connect",
          description: "SSO moderne avec PKCE et découverte OIDC.",
        },
      },
      enabled: "Activé",
      disabled: "Désactivé",
      configure: "Configurer",
      testConnection: "Tester la connexion",
      connectionSuccessful: "Connexion réussie",
      connectionFailed: "Connexion échouée",
      loading: "Chargement des fournisseurs d'authentification...",
      title: "Fournisseurs d'authentification",
      intro:
        "Configurez des fournisseurs d'identité externes pour l'authentification unique. Cette étape est facultative ; l'authentification locale par nom d'utilisateur et mot de passe reste toujours disponible.",
      usernamePassword: "Nom d'utilisateur et mot de passe",
      builtIn: "Authentification Sanctum intégrée - toujours active.",
      alwaysOn: "Toujours actif",
    },
    onboarding: {
      tour: {
        sidebarTitle: "Barre latérale de navigation",
        sidebarContent:
          "Tous vos outils de recherche se trouvent ici : Explorateur de données, Vocabulaire, Définitions de cohortes, Jeux de concepts, Analyses et plus encore.",
        commandTitle: "Palette de commandes (Cmd K)",
        commandContent:
          "Accédez rapidement à n'importe quelle page ou action sans parcourir les menus. Essayez Cmd K (ou Ctrl+K) et recherchez « cohort ».",
        dataSourcesTitle: "Sources de données",
        dataSourcesContent:
          "Connectez vos sources CDM ici. Toutes les analyses s'exécutent sur ces sources de données.",
        cohortDefinitionsTitle: "Définitions de cohortes",
        cohortDefinitionsContent:
          "Créez des définitions de cohortes compatibles OHDSI avec des critères d'inclusion/exclusion, puis générez des effectifs sur tout CDM connecté.",
        vocabularyTitle: "Explorateur de vocabulaire",
        vocabularyContent:
          "Recherchez plus de 7 millions de concepts OMOP, parcourez les hiérarchies et créez des jeux de concepts pour vos définitions de cohortes.",
      },
      cards: {
        vocabularyTitle: "Explorer le vocabulaire",
        vocabularyDescription:
          "Rechercher plus de 7 millions de concepts OMOP et créer des jeux de concepts.",
        cohortTitle: "Créer une cohorte",
        cohortDescription:
          "Définir des critères d'inclusion/exclusion et générer des effectifs.",
        quickStartTitle: "Lire le démarrage rapide",
        quickStartDescription:
          "Du départ à un effectif de cohorte en 15 minutes.",
      },
      skipAria: "Ignorer la prise en main",
      title: "Bienvenue dans Parthenon",
      intro:
        "Une plateforme moderne de recherche sur les résultats basée sur OMOP. Commençons.",
      startTour: "Démarrer la visite rapide",
      skip: "Je connais déjà - ignorer",
    },
    dataSources: {
      demoTitle: "Jeu de données de démonstration Eunomia GiBleed chargé",
      demoPrefix: "Un jeu de données OMOP CDM synthétique avec",
      demoPatients: "2 694 patients",
      demoSuffix:
        "et des épisodes d'hémorragie gastro-intestinale. Sûr pour exécuter des définitions de cohortes et des analyses de caractérisation, idéal pour explorer Parthenon avant de connecter votre vrai CDM.",
      loading: "Chargement des sources de données...",
      title: "Sources de données",
      intro:
        "Connectez des bases CDM pour exécuter des définitions de cohortes et des analyses. Vous pouvez aussi importer des sources depuis une ancienne instance OHDSI WebAPI.",
      configuredSources: "Sources configurées ({{count}})",
      emptyTitle: "Aucune source de données pour le moment",
      emptyDescription:
        "Importez depuis une ancienne instance WebAPI ou ajoutez des sources plus tard depuis la page Sources de données.",
      importToggle: "Importer depuis l'ancien WebAPI",
      webApiUrl: "URL WebAPI",
      authType: "Type d'authentification",
      auth: {
        none: "Aucune",
        basic: "Basic",
        bearer: "Jeton Bearer",
        basicCredentials: "Nom d'utilisateur:Mot de passe",
        bearerCredentials: "Jeton",
        basicPlaceholder: "utilisateur:motdepasse",
        bearerPlaceholder: "Jeton Bearer",
      },
      importSources: "Importer les sources",
      importSuccess: "{{count}} {{label}} importées",
      importSkipped: ", {{count}} ignorées (existent déjà)",
      sourceSingular: "source de données",
      sourcePlural: "sources de données",
      importFailed: "Échec de l'import. Vérifiez l'URL et réessayez.",
      managePrefix: "Gérez les sources de données à tout moment depuis",
      manageLink: "Paramètres > Sources de données",
    },
    complete: {
      summaryItems: {
        accountSecured: "Compte sécurisé",
        systemHealthVerified: "État du système vérifié",
        aiProviderConfigured: "Fournisseur IA configuré",
        authenticationConfigured: "Authentification configurée",
        dataSourcesConnected: "Sources de données connectées",
      },
      nextSteps: {
        exploreDemoData: "Explorer les données de démonstration",
        exploreDemoDataDescription: "Parcourir le jeu de données Eunomia GiBleed",
        createFirstCohort: "Créer votre première cohorte",
        createFirstCohortDescription:
          "Créer une définition de cohorte de patients",
        inviteTeam: "Inviter l'équipe",
        inviteTeamDescription: "Ajouter des utilisateurs et attribuer des rôles",
      },
      title: "Parthenon est prêt",
      allDone:
        "Toutes les étapes de configuration sont terminées. Vous pouvez revenir à cet assistant à tout moment depuis Administration.",
      partialDone:
        "{{completed}} étapes sur {{total}} terminées - les étapes ignorées peuvent être configurées à tout moment.",
      setupSummary: "Résumé de configuration",
      skipped: "(ignoré)",
      goBackTitle: "Retour à {{label}}",
      fix: "Corriger",
      nextTitle: "Prochaines étapes",
      launch: "Lancer Parthenon",
    },
  },
});

const deAuthSetup: MessageTree = mergeMessageTrees(enAuthSetup, {
  setup: {
    wizard: {
      steps: {
        welcome: "Willkommen",
        security: "Sicherheit",
        health: "Status",
        ai: "KI",
        auth: "Authentifizierung",
        dataSources: "Datenquellen",
        complete: "Fertig",
      },
      close: "Schließen",
      skipSetup:
        "Einrichtung überspringen - jederzeit über Administration zurückkehren",
      previous: "Zurück",
      next: "Weiter",
      skip: "Überspringen",
      skipStep:
        "Diesen Schritt überspringen - später in Administration konfigurieren",
    },
    welcome: {
      title: "Willkommen bei Parthenon",
      intro:
        "Richten wir Ihre Forschungsplattform ein. Dieser Assistent führt durch die wichtigsten Schritte; jeder kann übersprungen und später im Administrationsbereich erneut geöffnet werden.",
      configureTitle: "Was wir konfigurieren",
      beforeTitle: "Bevor Sie beginnen",
      optionalNote: "Keine der optionalen Schritte ist erforderlich.",
      overview: {
        systemHealth: {
          label: "Systemstatus",
          description: "Prüfen, ob alle Plattformdienste korrekt laufen.",
        },
        aiProvider: {
          label: "KI-Anbieter",
          description: "Konfigurieren, welches KI-Backend Abby antreibt.",
        },
        authentication: {
          label: "Authentifizierung",
          description:
            "SSO-Anbieter wie LDAP, OAuth oder OIDC einrichten.",
        },
        dataSources: {
          label: "Datenquellen",
          description:
            "CDM-Datenbanken verbinden oder aus einer alten WebAPI importieren.",
        },
      },
      before: {
        cdm: "Ihre OMOP-CDM-Datenbank ist von diesem Server aus erreichbar",
        docker:
          "Docker und alle Container laufen (wird im nächsten Schritt geprüft)",
        ollama:
          "Ollama läuft lokal, falls Sie KI-Funktionen nutzen möchten (optional)",
        sso: "Die SSO-Daten Ihrer Organisation liegen vor, falls Single Sign-On aktiviert wird (optional)",
      },
    },
    changePassword: {
      strength: {
        weak: "Schwach",
        fair: "Ausreichend",
        good: "Gut",
        strong: "Stark",
        excellent: "Sehr stark",
        tooShort: "Zu kurz",
      },
      errors: {
        mismatch: "Die Passwörter stimmen nicht überein.",
        tooShort: "Das neue Passwort muss mindestens 8 Zeichen lang sein.",
        same: "Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.",
        failed: "Passwortänderung fehlgeschlagen. Bitte versuchen Sie es erneut.",
      },
      successTitle: "Passwort aktualisiert",
      successDescription:
        "Ihr Konto ist geschützt. Fahren Sie mit dem nächsten Schritt fort.",
      title: "Konto sichern",
      intro:
        "Während der Installation wurde ein temporäres Passwort erzeugt. Legen Sie ein dauerhaftes Passwort fest, bevor Sie fortfahren.",
      temporaryTitle:
        "Während der Installation wurden temporäre Zugangsdaten erzeugt",
      temporaryPrefix: "Ihr temporäres Passwort befindet sich in",
      temporarySuffix:
        "im Repository-Stammverzeichnis. Geben Sie es unten ein und wählen Sie dann ein dauerhaftes Passwort.",
      currentLabel: "Aktuelles (temporäres) Passwort",
      currentPlaceholder: "Temporäres Passwort eingeben",
      newLabel: "Neues Passwort",
      newPlaceholder: "Mindestens 8 Zeichen",
      toggleNewVisibility: "Neues Passwort anzeigen oder ausblenden",
      confirmLabel: "Neues Passwort bestätigen",
      confirmPlaceholder: "Neues Passwort wiederholen",
      submit: "Dauerhaftes Passwort festlegen",
    },
    systemHealth: {
      status: {
        healthy: "Gesund",
        degraded: "Beeinträchtigt",
        down: "Ausgefallen",
      },
      queue: {
        pending: "Ausstehend",
        failed: "Fehlgeschlagen",
      },
      aiUnhealthy:
        "Abby KI antwortet nicht - konfigurieren Sie den Anbieter im nächsten Schritt.",
      configureAi: "KI konfigurieren",
      title: "Systemstatusprüfung",
      intro: "Prüft, ob alle Plattformdienste korrekt laufen.",
      refresh: "Aktualisieren",
      checking: "Dienste werden geprüft...",
      overall: "Systemstatus: {{status}}",
      lastChecked: "Zuletzt geprüft um {{time}}",
      autoRefresh: "Wird alle 30 Sekunden automatisch aktualisiert.",
    },
    aiProvider: {
      regions: {
        local: "Lokal",
        us: "USA",
        china: "China",
        eu: "EU",
      },
      switchToThis: "Zu diesem wechseln",
      testFailed: "Verbindungstest fehlgeschlagen.",
      loading: "KI-Anbieter werden geladen...",
      title: "KI-Anbieter-Konfiguration",
      intro:
        "Konfigurieren Sie das KI-Backend für Abby, den Forschungsassistenten. Es ist jeweils nur ein Anbieter aktiv.",
      activeProvider: "Aktiver Anbieter:",
      model: "Modell",
      modelPlaceholder: "Modellname",
      apiKey: "API-Schlüssel",
      baseUrl: "Basis-URL",
      save: "Speichern",
      testConnection: "Verbindung testen",
      hideOtherProviders: "Andere Anbieter ausblenden ({{count}})",
      showOtherProviders: "Andere Anbieter anzeigen ({{count}})",
    },
    authentication: {
      providers: {
        ldap: {
          label: "LDAP / Active Directory",
          description:
            "Authentifizierung gegen AD oder ein LDAP-v3-Verzeichnis.",
        },
        oauth2: {
          label: "OAuth 2.0",
          description:
            "Authentifizierung an GitHub, Google, Microsoft oder einen benutzerdefinierten Anbieter delegieren.",
        },
        saml2: {
          label: "SAML 2.0",
          description: "Enterprise-SSO über Okta, Azure AD, ADFS usw.",
        },
        oidc: {
          label: "OpenID Connect",
          description: "Modernes SSO mit PKCE und OIDC-Discovery.",
        },
      },
      enabled: "Aktiviert",
      disabled: "Deaktiviert",
      configure: "Konfigurieren",
      testConnection: "Verbindung testen",
      connectionSuccessful: "Verbindung erfolgreich",
      connectionFailed: "Verbindung fehlgeschlagen",
      loading: "Authentifizierungsanbieter werden geladen...",
      title: "Authentifizierungsanbieter",
      intro:
        "Konfigurieren Sie externe Identitätsanbieter für Single Sign-On. Dieser Schritt ist optional; lokale Benutzername/Passwort-Authentifizierung bleibt immer verfügbar.",
      usernamePassword: "Benutzername und Passwort",
      builtIn: "Integrierte Sanctum-Authentifizierung - immer aktiv.",
      alwaysOn: "Immer aktiv",
    },
    onboarding: {
      tour: {
        sidebarTitle: "Navigationsseitenleiste",
        sidebarContent:
          "Alle Ihre Forschungswerkzeuge befinden sich hier: Daten-Explorer, Vokabular, Kohortendefinitionen, Konzeptsets, Analysen und mehr.",
        commandTitle: "Befehlspalette (Cmd K)",
        commandContent:
          "Springen Sie schnell zu jeder Seite oder Aktion, ohne durch Menüs zu klicken. Probieren Sie Cmd K (oder Ctrl+K) und suchen Sie nach 'cohort'.",
        dataSourcesTitle: "Datenquellen",
        dataSourcesContent:
          "Verbinden Sie hier Ihre CDM-Quellen. Alle Analysen laufen gegen diese Datenquellen.",
        cohortDefinitionsTitle: "Kohortendefinitionen",
        cohortDefinitionsContent:
          "Erstellen Sie OHDSI-kompatible Kohortendefinitionen mit Einschluss-/Ausschlusskriterien und generieren Sie Zählungen gegen jedes verbundene CDM.",
        vocabularyTitle: "Vokabular-Explorer",
        vocabularyContent:
          "Durchsuchen Sie über 7 Mio. OMOP-Konzepte, navigieren Sie Hierarchien und erstellen Sie Konzeptsets für Ihre Kohortendefinitionen.",
      },
      cards: {
        vocabularyTitle: "Vokabular erkunden",
        vocabularyDescription:
          "Über 7 Mio. OMOP-Konzepte durchsuchen und Konzeptsets erstellen.",
        cohortTitle: "Kohorte erstellen",
        cohortDescription:
          "Einschluss-/Ausschlusskriterien definieren und Zählungen generieren.",
        quickStartTitle: "Quickstart lesen",
        quickStartDescription: "Von null zur Kohortenzählung in 15 Minuten.",
      },
      skipAria: "Einführung überspringen",
      title: "Willkommen bei Parthenon",
      intro:
        "Eine moderne OMOP-Plattform für Outcomes-Forschung. Legen wir los.",
      startTour: "Kurztour starten",
      skip: "Ich kenne mich schon aus - überspringen",
    },
    dataSources: {
      demoTitle: "Eunomia-GiBleed-Demodatensatz geladen",
      demoPrefix: "Ein synthetischer OMOP-CDM-Datensatz mit",
      demoPatients: "2.694 Patienten",
      demoSuffix:
        "und Episoden gastrointestinaler Blutungen. Sicher für Kohortendefinitionen und Charakterisierungsanalysen, ideal zum Erkunden von Parthenon vor dem Verbinden eines echten CDM.",
      loading: "Datenquellen werden geladen...",
      title: "Datenquellen",
      intro:
        "Verbinden Sie CDM-Datenbanken, um Kohortendefinitionen und Analysen auszuführen. Sie können auch Quellen aus einer alten OHDSI-WebAPI importieren.",
      configuredSources: "Konfigurierte Quellen ({{count}})",
      emptyTitle: "Noch keine Datenquellen",
      emptyDescription:
        "Importieren Sie aus einer alten WebAPI-Instanz oder fügen Sie Quellen später auf der Seite Datenquellen hinzu.",
      importToggle: "Aus alter WebAPI importieren",
      webApiUrl: "WebAPI-URL",
      authType: "Authentifizierungstyp",
      auth: {
        none: "Keine",
        basic: "Basic",
        bearer: "Bearer-Token",
        basicCredentials: "Benutzername:Passwort",
        bearerCredentials: "Bearer-Token",
        basicPlaceholder: "benutzer:passwort",
        bearerPlaceholder: "Bearer-Token",
      },
      importSources: "Quellen importieren",
      importSuccess: "{{count}} {{label}} importiert",
      importSkipped: ", {{count}} übersprungen (existieren bereits)",
      sourceSingular: "Quelle",
      sourcePlural: "Quellen",
      importFailed: "Import fehlgeschlagen. Prüfen Sie die URL und versuchen Sie es erneut.",
      managePrefix: "Datenquellen jederzeit verwalten unter",
      manageLink: "Einstellungen > Datenquellen",
    },
    complete: {
      summaryItems: {
        accountSecured: "Konto gesichert",
        systemHealthVerified: "Systemstatus geprüft",
        aiProviderConfigured: "KI-Anbieter konfiguriert",
        authenticationConfigured: "Authentifizierung konfiguriert",
        dataSourcesConnected: "Datenquellen verbunden",
      },
      nextSteps: {
        exploreDemoData: "Demodaten erkunden",
        exploreDemoDataDescription: "Eunomia-GiBleed-Datensatz durchsuchen",
        createFirstCohort: "Erste Kohorte erstellen",
        createFirstCohortDescription: "Patientenkohortendefinition erstellen",
        inviteTeam: "Teammitglieder einladen",
        inviteTeamDescription: "Benutzer hinzufügen und Rollen zuweisen",
      },
      title: "Parthenon ist bereit",
      allDone:
        "Alle Einrichtungsschritte sind abgeschlossen. Sie können jederzeit über Administration zu diesem Assistenten zurückkehren.",
      partialDone:
        "{{completed}} von {{total}} Schritten abgeschlossen - übersprungene Schritte können jederzeit konfiguriert werden.",
      setupSummary: "Einrichtungsübersicht",
      skipped: "(übersprungen)",
      goBackTitle: "Zurück zu {{label}}",
      fix: "Korrigieren",
      nextTitle: "Nächste Schritte",
      launch: "Parthenon starten",
    },
  },
});

const ptAuthSetup: MessageTree = mergeMessageTrees(enAuthSetup, {
  setup: {
    wizard: {
      steps: {
        welcome: "Boas-vindas",
        security: "Segurança",
        health: "Saúde",
        ai: "IA",
        auth: "Autenticação",
        dataSources: "Fontes de dados",
        complete: "Concluído",
      },
      close: "Fechar",
      skipSetup:
        "Pular configuração - volte a qualquer momento pela Administração",
      previous: "Anterior",
      next: "Próximo",
      skip: "Pular",
      skipStep:
        "Pular esta etapa - configure mais tarde na Administração",
    },
    welcome: {
      title: "Boas-vindas ao Parthenon",
      intro:
        "Vamos configurar sua plataforma de pesquisa. Este assistente percorre as etapas essenciais; cada uma pode ser pulada e retomada depois pelo painel de Administração.",
      configureTitle: "O que vamos configurar",
      beforeTitle: "Antes de começar",
      optionalNote: "Nenhuma etapa opcional é obrigatória para continuar.",
      overview: {
        systemHealth: {
          label: "Saúde do sistema",
          description:
            "Verificar se todos os serviços da plataforma estão funcionando corretamente.",
        },
        aiProvider: {
          label: "Provedor de IA",
          description: "Configurar qual backend de IA alimenta a Abby.",
        },
        authentication: {
          label: "Autenticação",
          description:
            "Configurar provedores SSO como LDAP, OAuth ou OIDC.",
        },
        dataSources: {
          label: "Fontes de dados",
          description:
            "Conectar bancos CDM ou importar de um WebAPI legado.",
        },
      },
      before: {
        cdm: "Seu banco OMOP CDM está acessível a partir deste servidor",
        docker:
          "Docker e todos os contêineres estão em execução (verificado na próxima etapa)",
        ollama:
          "Ollama está rodando localmente se você quiser recursos de IA (opcional)",
        sso: "Você tem os dados de SSO da organização se for habilitar single sign-on (opcional)",
      },
    },
    changePassword: {
      strength: {
        weak: "Fraca",
        fair: "Razoável",
        good: "Boa",
        strong: "Forte",
        excellent: "Excelente",
        tooShort: "Curta demais",
      },
      errors: {
        mismatch: "As senhas não coincidem.",
        tooShort: "A nova senha deve ter pelo menos 8 caracteres.",
        same: "A nova senha deve ser diferente da senha atual.",
        failed: "Falha ao alterar senha. Tente novamente.",
      },
      successTitle: "Senha atualizada",
      successDescription:
        "Sua conta está protegida. Continue para a próxima etapa.",
      title: "Proteja sua conta",
      intro:
        "Uma senha temporária foi gerada durante a instalação. Defina uma senha permanente antes de continuar.",
      temporaryTitle:
        "Credenciais temporárias foram geradas durante a instalação",
      temporaryPrefix: "Sua senha temporária está em",
      temporarySuffix:
        "na raiz do repositório. Digite-a abaixo e escolha uma senha permanente.",
      currentLabel: "Senha atual (temporária)",
      currentPlaceholder: "Digite a senha temporária",
      newLabel: "Nova senha",
      newPlaceholder: "Mínimo de 8 caracteres",
      toggleNewVisibility: "Mostrar ou ocultar nova senha",
      confirmLabel: "Confirmar nova senha",
      confirmPlaceholder: "Repita a nova senha",
      submit: "Definir senha permanente",
    },
    systemHealth: {
      status: {
        healthy: "Saudável",
        degraded: "Degradado",
        down: "Indisponível",
      },
      queue: {
        pending: "Pendente",
        failed: "Falhou",
      },
      aiUnhealthy:
        "Abby IA não está respondendo - configure o provedor na próxima etapa.",
      configureAi: "Configurar IA",
      title: "Verificação de saúde do sistema",
      intro:
        "Verificando se todos os serviços da plataforma estão funcionando corretamente.",
      refresh: "Atualizar",
      checking: "Verificando serviços...",
      overall: "Sistema {{status}}",
      lastChecked: "Última verificação às {{time}}",
      autoRefresh: "Atualiza automaticamente a cada 30 segundos.",
    },
    aiProvider: {
      regions: {
        local: "Local",
        us: "EUA",
        china: "China",
        eu: "UE",
      },
      switchToThis: "Alternar para este",
      testFailed: "Teste de conexão falhou.",
      loading: "Carregando provedores de IA...",
      title: "Configuração do provedor de IA",
      intro:
        "Configure qual backend de IA alimenta a Abby, a assistente de pesquisa. Apenas um provedor fica ativo por vez.",
      activeProvider: "Provedor ativo:",
      model: "Modelo",
      modelPlaceholder: "Nome do modelo",
      apiKey: "Chave de API",
      baseUrl: "URL base",
      save: "Salvar",
      testConnection: "Testar conexão",
      hideOtherProviders: "Ocultar outros provedores ({{count}})",
      showOtherProviders: "Mostrar outros provedores ({{count}})",
    },
    authentication: {
      providers: {
        ldap: {
          label: "LDAP / Active Directory",
          description:
            "Autentique com AD ou qualquer diretório LDAP v3.",
        },
        oauth2: {
          label: "OAuth 2.0",
          description:
            "Delegue autenticação para GitHub, Google, Microsoft ou personalizado.",
        },
        saml2: {
          label: "SAML 2.0",
          description: "SSO corporativo via Okta, Azure AD, ADFS, etc.",
        },
        oidc: {
          label: "OpenID Connect",
          description: "SSO moderno com PKCE e descoberta OIDC.",
        },
      },
      enabled: "Ativado",
      disabled: "Desativado",
      configure: "Configurar",
      testConnection: "Testar conexão",
      connectionSuccessful: "Conexão bem-sucedida",
      connectionFailed: "Falha na conexão",
      loading: "Carregando provedores de autenticação...",
      title: "Provedores de autenticação",
      intro:
        "Configure provedores de identidade externos para single sign-on. Esta etapa é opcional; autenticação local por usuário/senha está sempre disponível.",
      usernamePassword: "Usuário e senha",
      builtIn: "Autenticação Sanctum integrada - sempre ativa.",
      alwaysOn: "Sempre ativo",
    },
    onboarding: {
      tour: {
        sidebarTitle: "Barra lateral de navegação",
        sidebarContent:
          "Todas as suas ferramentas de pesquisa ficam aqui: Explorador de dados, Vocabulário, Definições de coorte, Conjuntos de conceitos, Análises e muito mais.",
        commandTitle: "Paleta de comandos (Cmd K)",
        commandContent:
          "Vá rapidamente para qualquer página ou ação sem clicar pelos menus. Experimente Cmd K (ou Ctrl+K) e pesquise 'cohort'.",
        dataSourcesTitle: "Fontes de dados",
        dataSourcesContent:
          "Conecte suas fontes CDM aqui. Todas as análises são executadas contra essas fontes de dados.",
        cohortDefinitionsTitle: "Definições de coorte",
        cohortDefinitionsContent:
          "Crie definições de coorte compatíveis com OHDSI usando critérios de inclusão/exclusão e gere contagens contra qualquer CDM conectado.",
        vocabularyTitle: "Explorador de vocabulário",
        vocabularyContent:
          "Pesquise mais de 7 milhões de conceitos OMOP, navegue por hierarquias e crie conjuntos de conceitos para suas definições de coorte.",
      },
      cards: {
        vocabularyTitle: "Explorar vocabulário",
        vocabularyDescription:
          "Pesquise mais de 7 milhões de conceitos OMOP e crie conjuntos de conceitos.",
        cohortTitle: "Criar uma coorte",
        cohortDescription:
          "Defina critérios de inclusão/exclusão e gere contagens.",
        quickStartTitle: "Ler início rápido",
        quickStartDescription:
          "Do zero a uma contagem de coorte em 15 minutos.",
      },
      skipAria: "Pular integração",
      title: "Boas-vindas ao Parthenon",
      intro:
        "Uma plataforma moderna de pesquisa de desfechos baseada em OMOP. Vamos começar.",
      startTour: "Iniciar tour rápido",
      skip: "Já conheço - pular",
    },
    dataSources: {
      demoTitle: "Dataset demo Eunomia GiBleed carregado",
      demoPrefix: "Um dataset OMOP CDM sintético com",
      demoPatients: "2.694 pacientes",
      demoSuffix:
        "e episódios de sangramento gastrointestinal. Seguro para executar definições de coorte e análises de caracterização, ideal para explorar o Parthenon antes de conectar seu CDM real.",
      loading: "Carregando fontes de dados...",
      title: "Fontes de dados",
      intro:
        "Conecte bancos CDM para executar definições de coorte e análises. Você também pode importar fontes de uma instância OHDSI WebAPI legada.",
      configuredSources: "Fontes configuradas ({{count}})",
      emptyTitle: "Ainda não há fontes de dados",
      emptyDescription:
        "Importe de uma instância WebAPI legada ou adicione fontes depois pela página Fontes de dados.",
      importToggle: "Importar de WebAPI legado",
      webApiUrl: "URL do WebAPI",
      authType: "Tipo de autenticação",
      auth: {
        none: "Nenhum",
        basic: "Basic",
        bearer: "Token Bearer",
        basicCredentials: "Usuário:Senha",
        bearerCredentials: "Token Bearer",
        basicPlaceholder: "usuario:senha",
        bearerPlaceholder: "Token Bearer",
      },
      importSources: "Importar fontes",
      importSuccess: "{{count}} {{label}} importadas",
      importSkipped: ", {{count}} ignoradas (já existem)",
      sourceSingular: "fonte",
      sourcePlural: "fontes",
      importFailed: "Importação falhou. Verifique a URL e tente novamente.",
      managePrefix: "Gerencie fontes de dados a qualquer momento em",
      manageLink: "Configurações > Fontes de dados",
    },
    complete: {
      summaryItems: {
        accountSecured: "Conta protegida",
        systemHealthVerified: "Saúde do sistema verificada",
        aiProviderConfigured: "Provedor de IA configurado",
        authenticationConfigured: "Autenticação configurada",
        dataSourcesConnected: "Fontes de dados conectadas",
      },
      nextSteps: {
        exploreDemoData: "Explorar dados demo",
        exploreDemoDataDescription: "Navegar pelo dataset Eunomia GiBleed",
        createFirstCohort: "Criar sua primeira coorte",
        createFirstCohortDescription: "Criar uma definição de coorte de pacientes",
        inviteTeam: "Convidar equipe",
        inviteTeamDescription: "Adicionar usuários e atribuir funções",
      },
      title: "Parthenon está pronto",
      allDone:
        "Todas as etapas de configuração foram concluídas. Você pode voltar a este assistente a qualquer momento pela Administração.",
      partialDone:
        "{{completed}} de {{total}} etapas concluídas - etapas puladas podem ser configuradas a qualquer momento.",
      setupSummary: "Resumo da configuração",
      skipped: "(pulado)",
      goBackTitle: "Voltar para {{label}}",
      fix: "Corrigir",
      nextTitle: "O que fazer agora",
      launch: "Iniciar Parthenon",
    },
  },
});

const fiAuthSetup: MessageTree = mergeMessageTrees(enAuthSetup, {
  setup: {
    wizard: {
      steps: {
        welcome: "Tervetuloa",
        security: "Tietoturva",
        health: "Tila",
        ai: "Tekoäly",
        auth: "Tunnistautuminen",
        dataSources: "Tietolähteet",
        complete: "Valmis",
      },
      close: "Sulje",
      skipSetup: "Ohita käyttöönotto - palaa milloin tahansa hallinnasta",
      previous: "Edellinen",
      next: "Seuraava",
      skip: "Ohita",
      skipStep: "Ohita tämä vaihe - määritä myöhemmin hallinnassa",
    },
    welcome: {
      title: "Tervetuloa Parthenoniin",
      intro:
        "Määritetään tutkimusalustasi. Tämä ohjattu käyttöönotto käy läpi tärkeimmät vaiheet; jokaisen voi ohittaa ja avata myöhemmin hallintapaneelista.",
      configureTitle: "Mitä määritämme",
      beforeTitle: "Ennen kuin aloitat",
      optionalNote: "Mikään valinnaisista vaiheista ei ole pakollinen.",
      overview: {
        systemHealth: {
          label: "Järjestelmän tila",
          description: "Varmista, että kaikki alustan palvelut toimivat oikein.",
        },
        aiProvider: {
          label: "Tekoälypalvelu",
          description: "Määritä, mikä tekoälytausta käyttää Abbya.",
        },
        authentication: {
          label: "Tunnistautuminen",
          description:
            "Määritä SSO-palvelut, kuten LDAP, OAuth tai OIDC.",
        },
        dataSources: {
          label: "Tietolähteet",
          description:
            "Yhdistä CDM-tietokantoja tai tuo lähteitä vanhasta WebAPIsta.",
        },
      },
      before: {
        cdm: "OMOP CDM -tietokantasi on saavutettavissa tältä palvelimelta",
        docker:
          "Docker ja kaikki kontit ovat käynnissä (tarkistetaan seuraavassa vaiheessa)",
        ollama:
          "Ollama on käynnissä paikallisesti, jos haluat käyttää tekoälyominaisuuksia (valinnainen)",
        sso: "Sinulla on organisaatiosi SSO-tiedot, jos otat kertakirjautumisen käyttöön (valinnainen)",
      },
    },
    changePassword: {
      strength: {
        weak: "Heikko",
        fair: "Kohtalainen",
        good: "Hyvä",
        strong: "Vahva",
        excellent: "Erinomainen",
        tooShort: "Liian lyhyt",
      },
      errors: {
        mismatch: "Salasanat eivät täsmää.",
        tooShort: "Uuden salasanan on oltava vähintään 8 merkkiä.",
        same: "Uuden salasanan on oltava eri kuin nykyinen salasana.",
        failed: "Salasanan vaihto epäonnistui. Yritä uudelleen.",
      },
      successTitle: "Salasana päivitetty",
      successDescription:
        "Tilisi on suojattu. Jatka seuraavaan vaiheeseen.",
      title: "Suojaa tilisi",
      intro:
        "Asennuksen aikana luotiin väliaikainen salasana. Aseta pysyvä salasana ennen jatkamista.",
      temporaryTitle:
        "Asennuksen aikana luotiin väliaikaiset tunnistetiedot",
      temporaryPrefix: "Väliaikainen salasanasi on tiedostossa",
      temporarySuffix:
        "repositoriojuuressa. Syötä se alle ja valitse pysyvä salasana.",
      currentLabel: "Nykyinen (väliaikainen) salasana",
      currentPlaceholder: "Syötä väliaikainen salasana",
      newLabel: "Uusi salasana",
      newPlaceholder: "Vähintään 8 merkkiä",
      toggleNewVisibility: "Näytä tai piilota uusi salasana",
      confirmLabel: "Vahvista uusi salasana",
      confirmPlaceholder: "Toista uusi salasana",
      submit: "Aseta pysyvä salasana",
    },
    systemHealth: {
      status: {
        healthy: "Terve",
        degraded: "Heikentynyt",
        down: "Alhaalla",
      },
      queue: {
        pending: "Odottaa",
        failed: "Epäonnistui",
      },
      aiUnhealthy:
        "Abby AI ei vastaa - määritä palvelu seuraavassa vaiheessa.",
      configureAi: "Määritä tekoäly",
      title: "Järjestelmän tilatarkistus",
      intro: "Varmistetaan, että kaikki alustan palvelut toimivat oikein.",
      refresh: "Päivitä",
      checking: "Tarkistetaan palveluja...",
      overall: "Järjestelmä {{status}}",
      lastChecked: "Viimeksi tarkistettu {{time}}",
      autoRefresh: "Päivittyy automaattisesti 30 sekunnin välein.",
    },
    aiProvider: {
      regions: {
        local: "Paikallinen",
        us: "Yhdysvallat",
        china: "Kiina",
        eu: "EU",
      },
      switchToThis: "Vaihda tähän",
      testFailed: "Yhteystesti epäonnistui.",
      loading: "Ladataan tekoälypalveluja...",
      title: "Tekoälypalvelun määritys",
      intro:
        "Määritä, mikä tekoälytausta käyttää Abbya, tutkimusavustajaa. Vain yksi palvelu voi olla aktiivinen kerrallaan.",
      activeProvider: "Aktiivinen palvelu:",
      model: "Malli",
      modelPlaceholder: "Mallin nimi",
      apiKey: "API-avain",
      baseUrl: "Perus-URL",
      save: "Tallenna",
      testConnection: "Testaa yhteys",
      hideOtherProviders: "Piilota muut palvelut ({{count}})",
      showOtherProviders: "Näytä muut palvelut ({{count}})",
    },
    authentication: {
      providers: {
        ldap: {
          label: "LDAP / Active Directory",
          description:
            "Tunnistaudu AD:tä tai mitä tahansa LDAP v3 -hakemistoa vasten.",
        },
        oauth2: {
          label: "OAuth 2.0",
          description:
            "Delegoi tunnistautuminen GitHubiin, Googleen, Microsoftiin tai mukautettuun palveluun.",
        },
        saml2: {
          label: "SAML 2.0",
          description:
            "Yritystason SSO Oktan, Azure AD:n, ADFS:n jne. kautta.",
        },
        oidc: {
          label: "OpenID Connect",
          description: "Moderni SSO PKCE:n ja OIDC-discoveryn avulla.",
        },
      },
      enabled: "Käytössä",
      disabled: "Poissa käytöstä",
      configure: "Määritä",
      testConnection: "Testaa yhteys",
      connectionSuccessful: "Yhteys onnistui",
      connectionFailed: "Yhteys epäonnistui",
      loading: "Ladataan tunnistautumispalveluja...",
      title: "Tunnistautumispalvelut",
      intro:
        "Määritä ulkoiset identiteettipalvelut kertakirjautumista varten. Tämä vaihe on valinnainen; paikallinen käyttäjätunnus- ja salasanakirjautuminen on aina käytettävissä.",
      usernamePassword: "Käyttäjätunnus ja salasana",
      builtIn: "Sisäänrakennettu Sanctum-tunnistautuminen - aina käytössä.",
      alwaysOn: "Aina käytössä",
    },
    onboarding: {
      tour: {
        sidebarTitle: "Navigointisivupalkki",
        sidebarContent:
          "Kaikki tutkimustyökalusi ovat täällä: Data Explorer, sanasto, kohorttimääritykset, käsitejoukot, analyysit ja paljon muuta.",
        commandTitle: "Komentopaletti (Cmd K)",
        commandContent:
          "Siirry nopeasti mille tahansa sivulle tai toimintoon ilman valikoiden läpikäyntiä. Kokeile Cmd K (tai Ctrl+K) ja hae 'cohort'.",
        dataSourcesTitle: "Tietolähteet",
        dataSourcesContent:
          "Yhdistä CDM-lähteesi täällä. Kaikki analyysit suoritetaan näitä tietolähteitä vasten.",
        cohortDefinitionsTitle: "Kohorttimääritykset",
        cohortDefinitionsContent:
          "Rakenna OHDSI-yhteensopivia kohorttimäärityksiä sisäänotto- ja poissulkukriteereillä ja luo laskennat mihin tahansa yhdistettyyn CDM:ään.",
        vocabularyTitle: "Sanastoselain",
        vocabularyContent:
          "Hae yli 7 miljoonasta OMOP-käsitteestä, selaa hierarkioita ja rakenna käsitejoukkoja kohorttimäärityksiä varten.",
      },
      cards: {
        vocabularyTitle: "Tutki sanastoa",
        vocabularyDescription:
          "Hae yli 7 miljoonasta OMOP-käsitteestä ja rakenna käsitejoukkoja.",
        cohortTitle: "Rakenna kohortti",
        cohortDescription:
          "Määritä sisäänotto- ja poissulkukriteerit ja luo laskennat.",
        quickStartTitle: "Lue pika-aloitus",
        quickStartDescription: "Nollasta kohorttilaskentaan 15 minuutissa.",
      },
      skipAria: "Ohita perehdytys",
      title: "Tervetuloa Parthenoniin",
      intro:
        "Moderni OMOP-pohjainen vaikuttavuustutkimuksen alusta. Aloitetaan.",
      startTour: "Aloita pikakierros",
      skip: "Tunnen jo tämän - ohita",
    },
    dataSources: {
      demoTitle: "Eunomia GiBleed -demodatajoukko ladattu",
      demoPrefix: "Synteettinen OMOP CDM -datajoukko, jossa on",
      demoPatients: "2 694 potilasta",
      demoSuffix:
        "ja ruoansulatuskanavan verenvuotojaksoja. Turvallinen kohorttimäärityksiin ja karakterisointianalyyseihin; ihanteellinen Parthenonin tutkimiseen ennen oman CDM:n yhdistämistä.",
      loading: "Ladataan tietolähteitä...",
      title: "Tietolähteet",
      intro:
        "Yhdistä CDM-tietokantoja kohorttimääritysten ja analyysien suorittamista varten. Voit myös tuoda lähteitä vanhasta OHDSI WebAPI -instanssista.",
      configuredSources: "Määritetyt lähteet ({{count}})",
      emptyTitle: "Ei vielä tietolähteitä",
      emptyDescription:
        "Tuo vanhasta WebAPI-instanssista tai lisää lähteitä myöhemmin Tietolähteet-sivulta.",
      importToggle: "Tuo vanhasta WebAPIsta",
      webApiUrl: "WebAPI-URL",
      authType: "Tunnistautumistyyppi",
      auth: {
        none: "Ei mitään",
        basic: "Basic",
        bearer: "Bearer-token",
        basicCredentials: "Käyttäjätunnus:Salasana",
        bearerCredentials: "Token",
        basicPlaceholder: "käyttäjä:salasana",
        bearerPlaceholder: "Bearer-token",
      },
      importSources: "Tuo lähteet",
      importSuccess: "Tuotiin {{count}} {{label}}",
      importSkipped: ", {{count}} ohitettiin (ovat jo olemassa)",
      sourceSingular: "lähde",
      sourcePlural: "lähdettä",
      importFailed: "Tuonti epäonnistui. Tarkista URL ja yritä uudelleen.",
      managePrefix: "Hallitse tietolähteitä milloin tahansa kohdasta",
      manageLink: "Asetukset > Tietolähteet",
    },
    complete: {
      summaryItems: {
        accountSecured: "Tili suojattu",
        systemHealthVerified: "Järjestelmän tila tarkistettu",
        aiProviderConfigured: "Tekoälypalvelu määritetty",
        authenticationConfigured: "Tunnistautuminen määritetty",
        dataSourcesConnected: "Tietolähteet yhdistetty",
      },
      nextSteps: {
        exploreDemoData: "Tutki demodataa",
        exploreDemoDataDescription: "Selaa Eunomia GiBleed -datajoukkoa",
        createFirstCohort: "Luo ensimmäinen kohorttisi",
        createFirstCohortDescription: "Rakenna potilaskohortin määritys",
        inviteTeam: "Kutsu tiimin jäseniä",
        inviteTeamDescription: "Lisää käyttäjiä ja määritä rooleja",
      },
      title: "Parthenon on valmis",
      allDone:
        "Kaikki käyttöönoton vaiheet on suoritettu. Voit palata tähän ohjattuun toimintoon milloin tahansa hallinnasta.",
      partialDone:
        "{{completed}}/{{total}} vaihetta suoritettu - ohitetut vaiheet voi määrittää milloin tahansa.",
      setupSummary: "Käyttöönoton yhteenveto",
      skipped: "(ohitettu)",
      goBackTitle: "Palaa kohtaan {{label}}",
      fix: "Korjaa",
      nextTitle: "Mitä seuraavaksi",
      launch: "Käynnistä Parthenon",
    },
  },
});

const jaAuthSetup: MessageTree = mergeMessageTrees(enAuthSetup, {
  setup: {
    wizard: {
      steps: {
        welcome: "ようこそ",
        security: "セキュリティ",
        health: "ヘルス",
        ai: "AI",
        auth: "認証",
        dataSources: "データソース",
        complete: "完了",
      },
      close: "閉じる",
      skipSetup: "セットアップをスキップ - 管理からいつでも戻れます",
      previous: "前へ",
      next: "次へ",
      skip: "スキップ",
      skipStep: "このステップをスキップ - 後で管理から設定",
    },
    welcome: {
      title: "Parthenon へようこそ",
      intro:
        "研究プラットフォームを設定しましょう。このウィザードでは必須の設定ステップを案内します。各ステップはスキップでき、管理パネルからいつでも再開できます。",
      configureTitle: "設定する内容",
      beforeTitle: "始める前に",
      optionalNote: "続行するために必須の任意ステップはありません。",
      overview: {
        systemHealth: {
          label: "システムヘルス",
          description:
            "すべてのプラットフォームサービスが正しく稼働していることを確認します。",
        },
        aiProvider: {
          label: "AI プロバイダー",
          description: "Abby を動かす AI バックエンドを設定します。",
        },
        authentication: {
          label: "認証",
          description:
            "LDAP、OAuth、OIDC などの SSO プロバイダーを設定します。",
        },
        dataSources: {
          label: "データソース",
          description:
            "CDM データベースを接続するか、レガシー WebAPI からインポートします。",
        },
      },
      before: {
        cdm: "このサーバーから OMOP CDM データベースにアクセスできる",
        docker:
          "Docker とすべてのコンテナが実行中である (次のステップで確認)",
        ollama:
          "AI 機能を使う場合、Ollama がローカルで実行されている (任意)",
        sso: "シングルサインオンを有効にする場合、組織の SSO 詳細がある (任意)",
      },
    },
    changePassword: {
      strength: {
        weak: "弱い",
        fair: "普通",
        good: "良い",
        strong: "強い",
        excellent: "非常に強い",
        tooShort: "短すぎます",
      },
      errors: {
        mismatch: "パスワードが一致しません。",
        tooShort: "新しいパスワードは 8 文字以上にしてください。",
        same: "新しいパスワードは現在のパスワードと異なる必要があります。",
        failed: "パスワード変更に失敗しました。もう一度お試しください。",
      },
      successTitle: "パスワードを更新しました",
      successDescription:
        "アカウントは保護されました。次のステップに進んでください。",
      title: "アカウントを保護",
      intro:
        "インストール中に一時パスワードが生成されました。続行する前に恒久パスワードを設定してください。",
      temporaryTitle:
        "インストール中に一時認証情報が生成されました",
      temporaryPrefix: "一時パスワードは",
      temporarySuffix:
        "リポジトリルートにあります。下に入力し、恒久パスワードを選択してください。",
      currentLabel: "現在の (一時) パスワード",
      currentPlaceholder: "一時パスワードを入力",
      newLabel: "新しいパスワード",
      newPlaceholder: "8 文字以上",
      toggleNewVisibility: "新しいパスワードの表示/非表示",
      confirmLabel: "新しいパスワードを確認",
      confirmPlaceholder: "新しいパスワードを再入力",
      submit: "恒久パスワードを設定",
    },
    systemHealth: {
      status: {
        healthy: "正常",
        degraded: "低下",
        down: "停止",
      },
      queue: {
        pending: "保留中",
        failed: "失敗",
      },
      aiUnhealthy:
        "Abby AI が応答していません - 次のステップでプロバイダーを設定してください。",
      configureAi: "AI を設定",
      title: "システムヘルスチェック",
      intro:
        "すべてのプラットフォームサービスが正しく稼働していることを確認しています。",
      refresh: "更新",
      checking: "サービスを確認中...",
      overall: "システム {{status}}",
      lastChecked: "{{time}} に最終確認",
      autoRefresh: "30 秒ごとに自動更新されます。",
    },
    aiProvider: {
      regions: {
        local: "ローカル",
        us: "米国",
        china: "中国",
        eu: "EU",
      },
      switchToThis: "これに切り替え",
      testFailed: "接続テストに失敗しました。",
      loading: "AI プロバイダーを読み込み中...",
      title: "AI プロバイダー設定",
      intro:
        "研究アシスタント Abby を動かす AI バックエンドを設定します。同時にアクティブにできるプロバイダーは 1 つだけです。",
      activeProvider: "アクティブなプロバイダー:",
      model: "モデル",
      modelPlaceholder: "モデル名",
      apiKey: "API キー",
      baseUrl: "ベース URL",
      save: "保存",
      testConnection: "接続をテスト",
      hideOtherProviders: "他のプロバイダーを隠す ({{count}})",
      showOtherProviders: "他のプロバイダーを表示 ({{count}})",
    },
    authentication: {
      providers: {
        ldap: {
          label: "LDAP / Active Directory",
          description:
            "AD または任意の LDAP v3 ディレクトリで認証します。",
        },
        oauth2: {
          label: "OAuth 2.0",
          description:
            "GitHub、Google、Microsoft、またはカスタムプロバイダーに認証を委任します。",
        },
        saml2: {
          label: "SAML 2.0",
          description: "Okta、Azure AD、ADFS などによるエンタープライズ SSO。",
        },
        oidc: {
          label: "OpenID Connect",
          description: "PKCE と OIDC discovery によるモダン SSO。",
        },
      },
      enabled: "有効",
      disabled: "無効",
      configure: "設定",
      testConnection: "接続をテスト",
      connectionSuccessful: "接続に成功しました",
      connectionFailed: "接続に失敗しました",
      loading: "認証プロバイダーを読み込み中...",
      title: "認証プロバイダー",
      intro:
        "シングルサインオン用の外部 ID プロバイダーを設定します。このステップは任意です。ローカルのユーザー名/パスワード認証は常に利用できます。",
      usernamePassword: "ユーザー名とパスワード",
      builtIn: "組み込み Sanctum 認証 - 常に有効。",
      alwaysOn: "常に有効",
    },
    onboarding: {
      tour: {
        sidebarTitle: "ナビゲーションサイドバー",
        sidebarContent:
          "研究ツールはすべてここにあります: データエクスプローラー、語彙、コホート定義、コンセプトセット、解析など。",
        commandTitle: "コマンドパレット (Cmd K)",
        commandContent:
          "メニューをたどらず、任意のページやアクションへすばやく移動できます。Cmd K (または Ctrl+K) を試し、'cohort' を検索してください。",
        dataSourcesTitle: "データソース",
        dataSourcesContent:
          "ここで CDM ソースを接続します。すべての解析はこれらのデータソースに対して実行されます。",
        cohortDefinitionsTitle: "コホート定義",
        cohortDefinitionsContent:
          "組み入れ/除外基準を使って OHDSI 互換のコホート定義を作成し、接続済み CDM に対して件数を生成します。",
        vocabularyTitle: "語彙エクスプローラー",
        vocabularyContent:
          "700 万件以上の OMOP コンセプトを検索し、階層を参照し、コホート定義で使うコンセプトセットを作成します。",
      },
      cards: {
        vocabularyTitle: "語彙を探索",
        vocabularyDescription:
          "700 万件以上の OMOP コンセプトを検索し、コンセプトセットを作成します。",
        cohortTitle: "コホートを作成",
        cohortDescription: "組み入れ/除外基準を定義し、件数を生成します。",
        quickStartTitle: "クイックスタートを読む",
        quickStartDescription: "ゼロから 15 分でコホート件数まで。",
      },
      skipAria: "オンボーディングをスキップ",
      title: "Parthenon へようこそ",
      intro: "モダンな OMOP アウトカム研究プラットフォームです。始めましょう。",
      startTour: "クイックツアーを開始",
      skip: "すでに知っています - スキップ",
    },
    dataSources: {
      demoTitle: "Eunomia GiBleed デモデータセットを読み込みました",
      demoPrefix: "合成 OMOP CDM データセットで、",
      demoPatients: "2,694 人の患者",
      demoSuffix:
        "と消化管出血エピソードを含みます。コホート定義と特性評価解析を安全に実行でき、本物の CDM を接続する前に Parthenon を探索するのに最適です。",
      loading: "データソースを読み込み中...",
      title: "データソース",
      intro:
        "CDM データベースを接続してコホート定義と解析を実行します。レガシー OHDSI WebAPI インスタンスからソースをインポートすることもできます。",
      configuredSources: "設定済みソース ({{count}})",
      emptyTitle: "まだデータソースがありません",
      emptyDescription:
        "レガシー WebAPI インスタンスからインポートするか、後でデータソースページから追加してください。",
      importToggle: "レガシー WebAPI からインポート",
      webApiUrl: "WebAPI URL",
      authType: "認証タイプ",
      auth: {
        none: "なし",
        basic: "Basic",
        bearer: "Bearer トークン",
        basicCredentials: "ユーザー名:パスワード",
        bearerCredentials: "トークン",
        basicPlaceholder: "user:password",
        bearerPlaceholder: "Bearer トークン",
      },
      importSources: "ソースをインポート",
      importSuccess: "{{count}} {{label}} をインポートしました",
      importSkipped: "、{{count}} 件をスキップしました (既に存在)",
      sourceSingular: "ソース",
      sourcePlural: "ソース",
      importFailed: "インポートに失敗しました。URL を確認して再試行してください。",
      managePrefix: "データソースはいつでも次から管理できます:",
      manageLink: "設定 > データソース",
    },
    complete: {
      summaryItems: {
        accountSecured: "アカウント保護済み",
        systemHealthVerified: "システムヘルス確認済み",
        aiProviderConfigured: "AI プロバイダー設定済み",
        authenticationConfigured: "認証設定済み",
        dataSourcesConnected: "データソース接続済み",
      },
      nextSteps: {
        exploreDemoData: "デモデータを探索",
        exploreDemoDataDescription: "Eunomia GiBleed データセットを参照",
        createFirstCohort: "最初のコホートを作成",
        createFirstCohortDescription: "患者コホート定義を作成",
        inviteTeam: "チームメンバーを招待",
        inviteTeamDescription: "ユーザーを追加してロールを割り当て",
      },
      title: "Parthenon の準備ができました",
      allDone:
        "すべてのセットアップステップが完了しました。このウィザードには管理からいつでも戻れます。",
      partialDone:
        "{{total}} ステップ中 {{completed}} ステップ完了 - スキップしたステップはいつでも設定できます。",
      setupSummary: "セットアップ概要",
      skipped: "(スキップ済み)",
      goBackTitle: "{{label}} に戻る",
      fix: "修正",
      nextTitle: "次に行うこと",
      launch: "Parthenon を起動",
    },
  },
});

const zhAuthSetup: MessageTree = mergeMessageTrees(enAuthSetup, {
  setup: {
    wizard: {
      steps: {
        welcome: "欢迎",
        security: "安全",
        health: "健康",
        ai: "AI",
        auth: "认证",
        dataSources: "数据源",
        complete: "完成",
      },
      close: "关闭",
      skipSetup: "跳过设置 - 可随时从管理中返回",
      previous: "上一步",
      next: "下一步",
      skip: "跳过",
      skipStep: "跳过此步骤 - 稍后在管理中配置",
    },
    welcome: {
      title: "欢迎使用 Parthenon",
      intro:
        "让我们配置你的研究平台。此向导会带你完成必要的设置步骤；每一步都可以跳过，并可随时从管理面板重新访问。",
      configureTitle: "我们将配置什么",
      beforeTitle: "开始之前",
      optionalNote: "所有可选步骤都不是继续所必需的。",
      overview: {
        systemHealth: {
          label: "系统健康",
          description: "验证所有平台服务是否正常运行。",
        },
        aiProvider: {
          label: "AI 提供方",
          description: "配置为 Abby 提供能力的 AI 后端。",
        },
        authentication: {
          label: "认证",
          description: "设置 LDAP、OAuth 或 OIDC 等 SSO 提供方。",
        },
        dataSources: {
          label: "数据源",
          description: "连接 CDM 数据库，或从旧版 WebAPI 导入。",
        },
      },
      before: {
        cdm: "此服务器可以访问你的 OMOP CDM 数据库",
        docker: "Docker 和所有容器正在运行 (下一步会验证)",
        ollama: "如果要使用 AI 功能，Ollama 已在本地运行 (可选)",
        sso: "如果启用单点登录，你已准备好组织的 SSO 详细信息 (可选)",
      },
    },
    changePassword: {
      strength: {
        weak: "弱",
        fair: "一般",
        good: "良好",
        strong: "强",
        excellent: "极强",
        tooShort: "太短",
      },
      errors: {
        mismatch: "密码不匹配。",
        tooShort: "新密码必须至少 8 个字符。",
        same: "新密码必须不同于当前密码。",
        failed: "密码更改失败。请重试。",
      },
      successTitle: "密码已更新",
      successDescription: "你的账户已受到保护。继续下一步。",
      title: "保护你的账户",
      intro: "安装期间生成了临时密码。继续之前请设置永久密码。",
      temporaryTitle: "安装期间生成了临时凭据",
      temporaryPrefix: "你的临时密码位于",
      temporarySuffix: "仓库根目录。请在下方输入，然后选择永久密码。",
      currentLabel: "当前 (临时) 密码",
      currentPlaceholder: "输入临时密码",
      newLabel: "新密码",
      newPlaceholder: "至少 8 个字符",
      toggleNewVisibility: "显示或隐藏新密码",
      confirmLabel: "确认新密码",
      confirmPlaceholder: "再次输入新密码",
      submit: "设置永久密码",
    },
    systemHealth: {
      status: {
        healthy: "健康",
        degraded: "降级",
        down: "不可用",
      },
      queue: {
        pending: "待处理",
        failed: "失败",
      },
      aiUnhealthy: "Abby AI 无响应 - 请在下一步配置提供方。",
      configureAi: "配置 AI",
      title: "系统健康检查",
      intro: "正在验证所有平台服务是否正常运行。",
      refresh: "刷新",
      checking: "正在检查服务...",
      overall: "系统 {{status}}",
      lastChecked: "最后检查时间 {{time}}",
      autoRefresh: "每 30 秒自动刷新。",
    },
    aiProvider: {
      regions: {
        local: "本地",
        us: "美国",
        china: "中国",
        eu: "欧盟",
      },
      switchToThis: "切换到此项",
      testFailed: "连接测试失败。",
      loading: "正在加载 AI 提供方...",
      title: "AI 提供方配置",
      intro:
        "配置为研究助手 Abby 提供能力的 AI 后端。一次只能有一个提供方处于活动状态。",
      activeProvider: "活动提供方:",
      model: "模型",
      modelPlaceholder: "模型名称",
      apiKey: "API 密钥",
      baseUrl: "基础 URL",
      save: "保存",
      testConnection: "测试连接",
      hideOtherProviders: "隐藏其他提供方 ({{count}})",
      showOtherProviders: "显示其他提供方 ({{count}})",
    },
    authentication: {
      providers: {
        ldap: {
          label: "LDAP / Active Directory",
          description: "使用 AD 或任何 LDAP v3 目录进行认证。",
        },
        oauth2: {
          label: "OAuth 2.0",
          description:
            "将认证委托给 GitHub、Google、Microsoft 或自定义提供方。",
        },
        saml2: {
          label: "SAML 2.0",
          description: "通过 Okta、Azure AD、ADFS 等实现企业 SSO。",
        },
        oidc: {
          label: "OpenID Connect",
          description: "使用 PKCE 和 OIDC discovery 的现代 SSO。",
        },
      },
      enabled: "已启用",
      disabled: "已禁用",
      configure: "配置",
      testConnection: "测试连接",
      connectionSuccessful: "连接成功",
      connectionFailed: "连接失败",
      loading: "正在加载认证提供方...",
      title: "认证提供方",
      intro:
        "为单点登录配置外部身份提供方。此步骤是可选的；本地用户名/密码认证始终可用。",
      usernamePassword: "用户名和密码",
      builtIn: "内置 Sanctum 认证 - 始终启用。",
      alwaysOn: "始终启用",
    },
    onboarding: {
      tour: {
        sidebarTitle: "导航侧边栏",
        sidebarContent:
          "你的所有研究工具都在这里: 数据浏览器、词汇、队列定义、概念集、分析等。",
        commandTitle: "命令面板 (Cmd K)",
        commandContent:
          "无需逐级点击菜单即可快速跳转到任何页面或操作。试试 Cmd K (或 Ctrl+K)，并搜索 'cohort'。",
        dataSourcesTitle: "数据源",
        dataSourcesContent:
          "在这里连接你的 CDM 数据源。所有分析都会针对这些数据源运行。",
        cohortDefinitionsTitle: "队列定义",
        cohortDefinitionsContent:
          "使用纳入/排除标准构建兼容 OHDSI 的队列定义，然后针对任何已连接的 CDM 生成计数。",
        vocabularyTitle: "词汇浏览器",
        vocabularyContent:
          "搜索 700 多万个 OMOP 概念，浏览层级，并构建用于队列定义的概念集。",
      },
      cards: {
        vocabularyTitle: "探索词汇",
        vocabularyDescription: "搜索 700 多万个 OMOP 概念并构建概念集。",
        cohortTitle: "构建队列",
        cohortDescription: "定义纳入/排除标准并生成计数。",
        quickStartTitle: "阅读快速开始",
        quickStartDescription: "从零开始，15 分钟得到队列计数。",
      },
      skipAria: "跳过引导",
      title: "欢迎使用 Parthenon",
      intro: "现代化的 OMOP 结局研究平台。让我们开始吧。",
      startTour: "开始快速导览",
      skip: "我已经熟悉 - 跳过",
    },
    dataSources: {
      demoTitle: "Eunomia GiBleed 演示数据集已加载",
      demoPrefix: "一个合成 OMOP CDM 数据集，包含",
      demoPatients: "2,694 名患者",
      demoSuffix:
        "和胃肠道出血事件。可安全用于运行队列定义和特征描述分析，是连接真实 CDM 前探索 Parthenon 的理想选择。",
      loading: "正在加载数据源...",
      title: "数据源",
      intro:
        "连接 CDM 数据库以运行队列定义和分析。你也可以从旧版 OHDSI WebAPI 实例导入数据源。",
      configuredSources: "已配置的数据源 ({{count}})",
      emptyTitle: "还没有数据源",
      emptyDescription:
        "从旧版 WebAPI 实例导入，或稍后从数据源页面添加。",
      importToggle: "从旧版 WebAPI 导入",
      webApiUrl: "WebAPI URL",
      authType: "认证类型",
      auth: {
        none: "无",
        basic: "Basic",
        bearer: "Bearer 令牌",
        basicCredentials: "用户名:密码",
        bearerCredentials: "令牌",
        basicPlaceholder: "user:password",
        bearerPlaceholder: "Bearer 令牌",
      },
      importSources: "导入数据源",
      importSuccess: "已导入 {{count}} 个 {{label}}",
      importSkipped: "，跳过 {{count}} 个 (已存在)",
      sourceSingular: "数据源",
      sourcePlural: "数据源",
      importFailed: "导入失败。请检查 URL 并重试。",
      managePrefix: "可随时从这里管理数据源:",
      manageLink: "设置 > 数据源",
    },
    complete: {
      summaryItems: {
        accountSecured: "账户已保护",
        systemHealthVerified: "系统健康已验证",
        aiProviderConfigured: "AI 提供方已配置",
        authenticationConfigured: "认证已配置",
        dataSourcesConnected: "数据源已连接",
      },
      nextSteps: {
        exploreDemoData: "探索演示数据",
        exploreDemoDataDescription: "浏览 Eunomia GiBleed 数据集",
        createFirstCohort: "创建你的第一个队列",
        createFirstCohortDescription: "构建患者队列定义",
        inviteTeam: "邀请团队成员",
        inviteTeamDescription: "添加用户并分配角色",
      },
      title: "Parthenon 已准备就绪",
      allDone:
        "所有设置步骤已完成。你可以随时从管理中返回此向导。",
      partialDone:
        "已完成 {{completed}}/{{total}} 个步骤 - 跳过的步骤可随时配置。",
      setupSummary: "设置摘要",
      skipped: "(已跳过)",
      goBackTitle: "返回 {{label}}",
      fix: "修复",
      nextTitle: "下一步做什么",
      launch: "启动 Parthenon",
    },
  },
});

const hiAuthSetup: MessageTree = mergeMessageTrees(enAuthSetup, {
  "setup": {
  "wizard": {
    "steps": {
      "welcome": "स्वागत",
      "security": "सुरक्षा",
      "health": "स्वास्थ्य",
      "ai": "AI",
      "auth": "प्रमाणीकरण",
      "dataSources": "डेटा स्रोत",
      "complete": "पूरा"
    },
    "close": "बंद करें",
    "skipSetup": "सेटअप छोड़ें - प्रशासन के माध्यम से किसी भी समय वापस लौटें",
    "previous": "पिछला",
    "next": "अगला",
    "skip": "छोड़ें",
    "skipStep": "इस चरण को छोड़ें - प्रशासन में बाद में कॉन्फ़िगर करें"
  },
  "welcome": {
    "title": "Parthenon में आपका स्वागत है",
    "intro": "आइए आपके शोध प्लेटफ़ॉर्म को कॉन्फ़िगर करें। यह विज़ार्ड आवश्यक सेटअप चरणों से गुजरता है - प्रत्येक को प्रशासन पैनल से किसी भी समय छोड़ा और दोबारा देखा जा सकता है।",
    "configureTitle": "हम क्या कॉन्फ़िगर करेंगे",
    "beforeTitle": "आपके शुरू करने से पहले",
    "optionalNote": "आगे बढ़ने के लिए किसी भी वैकल्पिक कदम की आवश्यकता नहीं है।",
    "overview": {
      "systemHealth": {
        "label": "सिस्टम स्वास्थ्य",
        "description": "सत्यापित करें कि सभी प्लेटफ़ॉर्म सेवाएँ सही ढंग से चल रही हैं।"
      },
      "aiProvider": {
        "label": "AI प्रदाता",
        "description": "कॉन्फ़िगर करें कि कौन सी AI बैकएंड शक्तियां Abby हैं।"
      },
      "authentication": {
        "label": "प्रमाणीकरण",
        "description": "SSO प्रदाताओं जैसे LDAP, OAuth, या OIDC को सेट करें।"
      },
      "dataSources": {
        "label": "डेटा स्रोत",
        "description": "CDM डेटाबेस कनेक्ट करें या विरासत WebAPI से आयात करें।"
      }
    },
    "before": {
      "cdm": "आपका OMOP CDM डेटाबेस इस सर्वर से पहुंच योग्य है",
      "docker": "डॉकर और सभी कंटेनर चल रहे हैं (अगले चरण में सत्यापित)",
      "ollama": "यदि आप AI सुविधाएं चाहते हैं तो Ollama स्थानीय रूप से चल रहा है (वैकल्पिक)",
      "sso": "एकल साइन-ऑन सक्षम करने पर आपके पास अपने संगठन का SSO विवरण है (वैकल्पिक)"
    }
  },
  "changePassword": {
    "strength": {
      "weak": "कमज़ोर",
      "fair": "ठीक-ठाक",
      "good": "अच्छा",
      "strong": "मज़बूत",
      "excellent": "उत्कृष्ट",
      "tooShort": "बहुत छोटा"
    },
    "errors": {
      "mismatch": "पासवर्ड मेल नहीं खाते।",
      "tooShort": "नया पासवर्ड कम से कम 8 अक्षर का होना चाहिए.",
      "same": "नया पासवर्ड वर्तमान पासवर्ड से भिन्न होना चाहिए.",
      "failed": "पासवर्ड बदलने में विफल। कृपया फिर प्रयास करें।"
    },
    "successTitle": "पासवर्ड अपडेट किया गया",
    "successDescription": "आपका खाता सुरक्षित है. अगले कदम के लिए आगे बढ़ें।",
    "title": "अपने खाते को सुरक्षित करें",
    "intro": "इंस्टालेशन के दौरान एक अस्थायी पासवर्ड उत्पन्न हुआ था। जारी रखने से पहले एक स्थायी पासवर्ड सेट करें।",
    "temporaryTitle": "इंस्टॉल के दौरान अस्थायी क्रेडेंशियल उत्पन्न किए गए थे",
    "temporaryPrefix": "आपका अस्थायी पासवर्ड अंदर है",
    "credentialsFile": ".install-credentials",
    "temporarySuffix": "रेपो रूट पर. इसे नीचे दर्ज करें, फिर एक स्थायी पासवर्ड चुनें।",
    "currentLabel": "वर्तमान (अस्थायी) पासवर्ड",
    "currentPlaceholder": "अस्थायी पासवर्ड दर्ज करें",
    "newLabel": "नया पासवर्ड",
    "newPlaceholder": "न्यूनतम 8 अक्षर",
    "toggleNewVisibility": "नया पासवर्ड दिखाएँ या छुपाएँ",
    "confirmLabel": "नए पासवर्ड की पुष्टि करें",
    "confirmPlaceholder": "नया पासवर्ड दोहराएँ",
    "submit": "स्थायी पासवर्ड सेट करें"
  },
  "systemHealth": {
    "status": {
      "healthy": "स्वस्थ",
      "degraded": "अपमानित",
      "down": "नीचे"
    },
    "queue": {
      "pending": "लंबित",
      "failed": "असफल"
    },
    "aiUnhealthy": "Abby AI प्रतिसाद नहीं दे रहा है - अगले चरण में प्रदाता को कॉन्फ़िगर करें।",
    "configureAi": "कॉन्फ़िगर करें AI",
    "title": "सिस्टम स्वास्थ्य जांच",
    "intro": "यह सत्यापित करना कि सभी प्लेटफ़ॉर्म सेवाएँ सही ढंग से चल रही हैं।",
    "refresh": "ताज़ा करना",
    "checking": "सेवाओं की जाँच की जा रही है...",
    "overall": "सिस्टम {{status}}",
    "lastChecked": "अंतिम बार {{time}} पर जाँच की गई",
    "autoRefresh": "हर 30 सेकंड में स्वतः ताज़ा हो जाता है।"
  },
  "aiProvider": {
    "regions": {
      "local": "स्थानीय",
      "us": "US",
      "china": "चीन",
      "eu": "EU"
    },
    "switchToThis": "इस पर स्विच करें",
    "testFailed": "कनेक्शन परीक्षण विफल रहा.",
    "loading": "AI प्रदाता लोड हो रहे हैं...",
    "title": "AI प्रदाता कॉन्फ़िगरेशन",
    "intro": "कॉन्फ़िगर करें कि कौन सा AI बैकएंड पावर Abby, अनुसंधान सहायक है। एक समय में केवल एक ही प्रदाता सक्रिय होता है।",
    "activeProvider": "सक्रिय प्रदाता:",
    "model": "नमूना",
    "modelPlaceholder": "मॉडल नाम",
    "apiKey": "API कुंजी",
    "baseUrl": "आधार URL",
    "save": "बचाना",
    "testConnection": "परीक्षण कनेक्शन",
    "hideOtherProviders": "अन्य प्रदाता छुपाएं ({{count}})",
    "showOtherProviders": "अन्य प्रदाता दिखाएँ ({{count}})"
  },
  "authentication": {
    "providers": {
      "ldap": {
        "label": "LDAP / Active Directory",
        "description": "AD या किसी LDAP v3 निर्देशिका के विरुद्ध प्रमाणित करें।"
      },
      "oauth2": {
        "label": "OAuth 2.0",
        "description": "GitHub, Google, Microsoft, या कस्टम को अधिकार सौंपें।"
      },
      "saml2": {
        "label": "SAML 2.0",
        "description": "एंटरप्राइज़ SSO के माध्यम से Okta, Azure AD, ADFS, आदि।"
      },
      "oidc": {
        "label": "OpenID Connect",
        "description": "आधुनिक SSO PKCE और OIDC खोज के साथ।"
      }
    },
    "enabled": "सक्रिय",
    "disabled": "अक्षम",
    "configure": "कॉन्फ़िगर",
    "testConnection": "परीक्षण कनेक्शन",
    "connectionSuccessful": "कनेक्शन सफल",
    "connectionFailed": "कनेक्शन विफल",
    "loading": "प्रमाणीकरण प्रदाता लोड हो रहा है...",
    "title": "प्रमाणीकरण प्रदाता",
    "intro": "एकल साइन-ऑन के लिए बाहरी पहचान प्रदाताओं को कॉन्फ़िगर करें। यह चरण वैकल्पिक है - स्थानीय username/password प्रमाणीकरण हमेशा उपलब्ध है।",
    "usernamePassword": "प्रयोक्ता नाम पासवर्ड",
    "builtIn": "अंतर्निहित Sanctum प्रमाणीकरण - हमेशा सक्रिय।",
    "alwaysOn": "हमेशा बने रहें"
  },
  "onboarding": {
    "tour": {
      "sidebarTitle": "नेविगेशन साइडबार",
      "sidebarContent": "आपके सभी शोध उपकरण यहां रहते हैं: डेटा एक्सप्लोरर, शब्दावली, समूह परिभाषाएँ, अवधारणा सेट, विश्लेषण, और बहुत कुछ।",
      "commandTitle": "कमांड पैलेट (Cmd K)",
      "commandContent": "मेनू पर क्लिक किए बिना तुरंत किसी भी पेज या कार्रवाई पर पहुंचें। Cmd K (या Ctrl+K) आज़माएँ और 'cohort' खोजें।",
      "dataSourcesTitle": "डेटा स्रोत",
      "dataSourcesContent": "अपने CDM स्रोतों को यहां कनेक्ट करें। सभी विश्लेषण इन डेटा स्रोतों के विरुद्ध चलते हैं।",
      "cohortDefinitionsTitle": "समूह परिभाषाएँ",
      "cohortDefinitionsContent": "inclusion/exclusion मानदंड का उपयोग करके OHDSI-संगत समूह परिभाषाएँ बनाएं, फिर किसी भी जुड़े CDM के विरुद्ध गिनती उत्पन्न करें।",
      "vocabularyTitle": "शब्दावली अन्वेषक",
      "vocabularyContent": "7M+ OMOP अवधारणाओं को खोजें, पदानुक्रम ब्राउज़ करें, और अपने समूह परिभाषाओं में उपयोग करने के लिए अवधारणा सेट बनाएं।"
    },
    "cards": {
      "vocabularyTitle": "शब्दावली का अन्वेषण करें",
      "vocabularyDescription": "7M+ OMOP अवधारणाएँ खोजें और अवधारणा सेट बनाएँ।",
      "cohortTitle": "एक समूह बनाएँ",
      "cohortDescription": "inclusion/exclusion मानदंड परिभाषित करें और गिनती उत्पन्न करें।",
      "quickStartTitle": "त्वरित प्रारंभ पढ़ें",
      "quickStartDescription": "15 मिनट में शून्य से एक समूह तक की गिनती।"
    },
    "skipAria": "ऑनबोर्डिंग छोड़ें",
    "title": "Parthenon में आपका स्वागत है",
    "intro": "एक आधुनिक OMOP परिणाम अनुसंधान मंच। आइए हम आपको आरंभ करें.",
    "startTour": "त्वरित यात्रा प्रारंभ करें",
    "skip": "मैं पहले से ही परिचित हूँ - छोड़ें"
  },
  "dataSources": {
    "demoTitle": "Eunomia GiBleed डेमो डेटासेट लोड किया गया",
    "demoPrefix": "एक सिंथेटिक OMOP CDM डेटासेट",
    "demoPatients": "2,694 मरीज",
    "demoSuffix": "और गैस्ट्रोइंटेस्टाइनल रक्तस्राव एपिसोड। समूह परिभाषाओं और लक्षण वर्णन विश्लेषण को चलाने के लिए सुरक्षित - अपने वास्तविक CDM को जोड़ने से पहले Parthenon की खोज के लिए आदर्श।",
    "loading": "डेटा स्रोत लोड हो रहे हैं...",
    "title": "डेटा स्रोत",
    "intro": "समूह परिभाषाओं और विश्लेषणों को चलाने के लिए CDM डेटाबेस कनेक्ट करें। आप पुराने OHDSI WebAPI उदाहरण से भी स्रोत आयात कर सकते हैं।",
    "configuredSources": "कॉन्फ़िगर किए गए स्रोत ({{count}})",
    "daimon": "डेमॉन",
    "daimons": "डेमोंस",
    "emptyTitle": "अभी तक कोई डेटा स्रोत नहीं",
    "emptyDescription": "विरासत WebAPI उदाहरण से आयात करें या बाद में डेटा स्रोत पृष्ठ से स्रोत जोड़ें।",
    "importToggle": "लीगेसी से आयात WebAPI",
    "webApiUrl": "WebAPI URL",
    "authType": "प्रामाणिक प्रकार",
    "auth": {
      "none": "कोई नहीं",
      "basic": "Basic",
      "bearer": "Bearer टोकन",
      "basicCredentials": "प्रयोक्ता नाम पासवर्ड",
      "bearerCredentials": "टोकन",
      "basicPlaceholder": "user:password",
      "bearerPlaceholder": "Bearer टोकन"
    },
    "importSources": "आयात स्रोत",
    "importSuccess": "आयातित {{count}} {{label}}",
    "importSkipped": ", {{count}} छोड़ दिया गया (पहले से मौजूद है)",
    "sourceSingular": "स्रोत",
    "sourcePlural": "स्रोत",
    "importFailed": "आयात विफल. कृपया URL जांचें और पुनः प्रयास करें।",
    "managePrefix": "किसी भी समय से डेटा स्रोत प्रबंधित करें",
    "manageLink": "सेटिंग्स > डेटा स्रोत"
  },
  "complete": {
    "summaryItems": {
      "accountSecured": "खाता सुरक्षित",
      "systemHealthVerified": "सिस्टम स्वास्थ्य सत्यापित",
      "aiProviderConfigured": "AI प्रदाता कॉन्फ़िगर किया गया",
      "authenticationConfigured": "प्रमाणीकरण कॉन्फ़िगर किया गया",
      "dataSourcesConnected": "डेटा स्रोत जुड़े हुए"
    },
    "nextSteps": {
      "exploreDemoData": "डेमो डेटा का अन्वेषण करें",
      "exploreDemoDataDescription": "Eunomia GiBleed डेटासेट ब्राउज़ करें",
      "createFirstCohort": "अपना पहला समूह बनाएं",
      "createFirstCohortDescription": "रोगी समूह की परिभाषा बनाएं",
      "inviteTeam": "टीम के सदस्यों को आमंत्रित करें",
      "inviteTeamDescription": "उपयोगकर्ता जोड़ें और भूमिकाएँ निर्दिष्ट करें"
    },
    "title": "Parthenon तैयार है!",
    "allDone": "सभी सेटअप चरण पूरे हो गए. आप किसी भी समय प्रशासन के माध्यम से इस विज़ार्ड पर वापस लौट सकते हैं।",
    "partialDone": "{{total}} में से {{completed}} चरण पूरे हो गए - छोड़े गए चरणों को किसी भी समय कॉन्फ़िगर किया जा सकता है।",
    "setupSummary": "सेटअप सारांश",
    "skipped": "(छोड़ दिया गया)",
    "goBackTitle": "{{label}} पर वापस जाएँ",
    "fix": "ठीक करें",
    "nextTitle": "आगे क्या करना है",
    "launch": "लॉन्च करें Parthenon"
  }
  }
});


function withAuthSetup(auth: MessageTree, setup: MessageTree): MessageTree {
  return mergeMessageTrees(auth, setup);
}

const enSettingsNotificationPage: MessageTree = {
  notifications: {
    pageTitle: "Notification Preferences",
    pageSubtitle: "Configure how and when you receive notifications",
  },
};

function withProductResources(
  namespaces: ParthenonNamespaces,
  settings: MessageTree,
  details: MessageTree,
  help: MessageTree,
  auth: MessageTree,
  dashboard: MessageTree,
  commons: MessageTree,
  app: MessageTree,
): ParthenonNamespaces & {
  settings: MessageTree;
  help: MessageTree;
  auth: MessageTree;
  dashboard: MessageTree;
  commons: MessageTree;
  app: MessageTree;
} {
  return {
    ...namespaces,
    settings: mergeMessageTrees(
      settings,
      mergeMessageTrees(enSettingsNotificationPage, details),
    ),
    help,
    auth,
    dashboard,
    commons,
    app,
  };
}

function appForLocale(locale: string): MessageTree {
  const baseApp = appResources[locale] ?? appResources["en-US"];
  const appWaves = [
    dataSourceIngestionResources,
    etlAqueductResources,
    cohortDefinitionResources,
    conceptSetResources,
    analysisResources,
    standardProsResources,
    gisToolsResources,
    heorResources,
    imagingGenomicsResources,
    investigationResources,
    morpheusResources,
    profileSimilarityResources,
    publishCareGapRiskResources,
    smallWorkbenchResources,
    strategusResources,
  ];

  return appWaves.reduce(
    (tree, wave) => mergeMessageTrees(tree, wave[locale] ?? wave["en-US"] ?? {}),
    baseApp,
  );
}

export const resources: Resource = {
  "en-US": withProductResources(
    withCommonUi(withAbbyLayout(enUS, enAbbyLayout), enCommonUi),
    enSettings,
    enSettingsDetails,
    enHelp,
    withAuthSetup(enAuth, enAuthSetup),
    dashboardResources["en-US"],
    commonsResources["en-US"],
    appForLocale("en-US"),
  ),
  "es-ES": withProductResources(
    withCommonUi(withAbbyLayout(esES, esAbbyLayout), esCommonUi),
    esSettings,
    esSettingsDetails,
    esHelp,
    withAuthSetup(esAuth, esAuthSetup),
    dashboardResources["es-ES"],
    commonsResources["es-ES"],
    appForLocale("es-ES"),
  ),
  "fr-FR": withProductResources(
    withCommonUi(withAbbyLayout(frFR, frAbbyLayout), frCommonUi),
    frSettings,
    frSettingsDetails,
    frHelp,
    withAuthSetup(frAuth, frAuthSetup),
    dashboardResources["fr-FR"],
    commonsResources["fr-FR"],
    appForLocale("fr-FR"),
  ),
  "de-DE": withProductResources(
    withCommonUi(withAbbyLayout(deDE, deAbbyLayout), deCommonUi),
    deSettings,
    deSettingsDetails,
    deHelp,
    withAuthSetup(deAuth, deAuthSetup),
    dashboardResources["de-DE"],
    commonsResources["de-DE"],
    appForLocale("de-DE"),
  ),
  "pt-BR": withProductResources(
    withCommonUi(withAbbyLayout(ptBR, ptAbbyLayout), ptCommonUi),
    ptSettings,
    ptSettingsDetails,
    ptHelp,
    withAuthSetup(ptAuth, ptAuthSetup),
    dashboardResources["pt-BR"],
    commonsResources["pt-BR"],
    appForLocale("pt-BR"),
  ),
  "fi-FI": withProductResources(
    withCommonUi(withAbbyLayout(fiFI, fiAbbyLayout), fiCommonUi),
    fiSettings,
    fiSettingsDetails,
    fiHelp,
    withAuthSetup(fiAuth, fiAuthSetup),
    dashboardResources["fi-FI"],
    commonsResources["fi-FI"],
    appForLocale("fi-FI"),
  ),
  "ja-JP": withProductResources(
    withCommonUi(withAbbyLayout(jaJP, jaAbbyLayout), jaCommonUi),
    jaSettings,
    jaSettingsDetails,
    jaHelp,
    withAuthSetup(jaAuth, jaAuthSetup),
    dashboardResources["ja-JP"],
    commonsResources["ja-JP"],
    appForLocale("ja-JP"),
  ),
  "zh-Hans": withProductResources(
    withCommonUi(withAbbyLayout(zhHans, zhAbbyLayout), zhCommonUi),
    zhSettings,
    zhSettingsDetails,
    zhHelp,
    withAuthSetup(zhAuth, zhAuthSetup),
    dashboardResources["zh-Hans"],
    commonsResources["zh-Hans"],
    appForLocale("zh-Hans"),
  ),
  "ko-KR": withProductResources(
    withCommonUi(withAbbyLayout(koKR, koAbbyLayout), koCommonUi),
    koSettings,
    koSettingsDetails,
    koHelp,
    withAuthSetup(koAuth, koAuthSetup),
    dashboardResources["ko-KR"],
    commonsResources["ko-KR"],
    appForLocale("ko-KR"),
  ),
  "hi-IN": withProductResources(
    withCommonUi(withAbbyLayout(hiIN, hiAbbyLayout), hiCommonUi),
    hiSettings,
    hiSettingsDetails,
    hiHelp,
    withAuthSetup(hiAuth, hiAuthSetup),
    dashboardResources["hi-IN"],
    commonsResources["hi-IN"],
    appForLocale("hi-IN"),
  ),
  ar: withProductResources(
    withCommonUi(withAbbyLayout(ar, enAbbyLayout), enCommonUi),
    arSettings,
    arSettingsDetails,
    arHelp,
    withAuthSetup(arAuth, enAuthSetup),
    dashboardResources["en-US"],
    commonsResources["en-US"],
    appForLocale("ar"),
  ),
  "en-XA": withProductResources(
    withCommonUi(
      withAbbyLayout(pseudoNamespaces(enUS), pseudoTree(enAbbyLayout)),
      pseudoTree(enCommonUi),
    ),
    pseudoTree(enSettings),
    pseudoTree(enSettingsDetails),
    pseudoTree(enHelp),
    withAuthSetup(pseudoTree(enAuth), pseudoTree(enAuthSetup)),
    pseudoTree(dashboardResources["en-US"]),
    pseudoTree(commonsResources["en-US"]),
    pseudoTree(appForLocale("en-US")),
  ),
};

export const namespaces = [
  "common",
  "layout",
  "settings",
  "help",
  "auth",
  "dashboard",
  "commons",
  "app",
];
