import type { Locale } from "./i18n";

type LocalizableSkill = {
  id: string;
  name: string;
  description: string;
  source: string;
  sourceUrl?: string;
  tags: string[];
  descriptionI18n?: Partial<Record<Locale, string>>;
};

type RepositoryLike = {
  name: string;
  description: string;
  topics: string[];
  lane?: "focus" | "adjacent" | "wildcard";
};

type SourceProfileLike = {
  overview: string;
  capabilities: string[];
  useWhen: string[];
  workflow: string[];
  requirements: string[];
  limitations: string[];
  examples: string[];
};

export type LocalizedRepositoryDetails = {
  summary: string;
  useCase: string;
  capabilities: string[];
  original: string;
};

export type LocalizedDecisionProfile = {
  kind: string;
  verdict: string;
  capabilities: string[];
  useWhen: string[];
  workflow: string[];
  requirements: string[];
  limitations: string[];
};

const curatedDescriptions: Record<string, Record<Locale, string>> = {
  "route-private-skills": {
    "zh-CN": "从私人库中选择最少且足够的 Skills，并安排调用顺序。",
    "zh-TW": "從私人庫中選擇最少且足夠的 Skills，並安排呼叫順序。",
    en: "Select the smallest sufficient set of Skills from a private library and order their execution.",
    ja: "プライベートライブラリから必要最小限の Skills を選び、実行順を決めます。",
    fr: "Sélectionne le plus petit ensemble suffisant de Skills privés et ordonne leur exécution.",
    es: "Selecciona el conjunto mínimo suficiente de Skills privadas y ordena su ejecución.",
  },
  "design-taste-frontend": {
    "zh-CN": "为落地页、作品集和品牌页面提供反模板化的前端审美约束。",
    "zh-TW": "為登陸頁、作品集與品牌頁面提供反模板化的前端美學約束。",
    en: "Applies anti-template visual constraints to landing pages, portfolios, and brand surfaces.",
    ja: "ランディングページ、ポートフォリオ、ブランド面に定型感を避ける視覚ルールを適用します。",
    fr: "Applique des règles visuelles anti-modèle aux pages d’accueil, portfolios et surfaces de marque.",
    es: "Aplica criterios visuales no genéricos a páginas de inicio, portfolios y superficies de marca.",
  },
  "sites-building": {
    "zh-CN": "构建、预览、保存并部署完整的网站和 Web App。",
    "zh-TW": "建置、預覽、儲存並部署完整的網站與 Web App。",
    en: "Build, preview, save, and deploy complete websites and web apps.",
    ja: "完全な Web サイトや Web アプリを構築、プレビュー、保存、デプロイします。",
    fr: "Construit, prévisualise, enregistre et déploie des sites et applications web complets.",
    es: "Construye, previsualiza, guarda y despliega sitios y aplicaciones web completos.",
  },
  github: {
    "zh-CN": "读取仓库、Issues 与 Pull Requests，定位项目上下文。",
    "zh-TW": "讀取儲存庫、Issues 與 Pull Requests，掌握專案脈絡。",
    en: "Read repositories, issues, and pull requests to establish project context.",
    ja: "リポジトリ、Issue、Pull Request を読み、プロジェクトの文脈を把握します。",
    fr: "Lit les dépôts, issues et pull requests pour établir le contexte du projet.",
    es: "Lee repositorios, issues y pull requests para establecer el contexto del proyecto.",
  },
  spreadsheets: {
    "zh-CN": "创建、修改、分析和可视化表格文件。",
    "zh-TW": "建立、修改、分析並視覺化試算表檔案。",
    en: "Create, modify, analyze, and visualize spreadsheet files.",
    ja: "スプレッドシートを作成、編集、分析、可視化します。",
    fr: "Crée, modifie, analyse et visualise des fichiers tableurs.",
    es: "Crea, modifica, analiza y visualiza archivos de hojas de cálculo.",
  },
  pdf: {
    "zh-CN": "读取、生成、渲染并检查视觉布局敏感的 PDF。",
    "zh-TW": "讀取、產生、渲染並檢查版面敏感的 PDF。",
    en: "Read, generate, render, and inspect PDFs where visual layout matters.",
    ja: "視覚レイアウトが重要な PDF を読み取り、生成、描画、検査します。",
    fr: "Lit, génère, rend et vérifie les PDF dont la mise en page visuelle est importante.",
    es: "Lee, genera, renderiza y revisa PDFs en los que importa la composición visual.",
  },
  imagegen: {
    "zh-CN": "生成或编辑照片、插画、纹理、精灵图等位图资产。",
    "zh-TW": "產生或編輯照片、插畫、紋理與精靈圖等點陣資產。",
    en: "Generate or edit bitmap assets such as photos, illustrations, textures, and sprites.",
    ja: "写真、イラスト、テクスチャ、スプライトなどのビットマップ素材を生成・編集します。",
    fr: "Génère ou modifie des images bitmap, dont photos, illustrations, textures et sprites.",
    es: "Genera o edita recursos bitmap como fotos, ilustraciones, texturas y sprites.",
  },
  yeet: {
    "zh-CN": "确认变更范围，提交分支并创建 Draft PR。",
    "zh-TW": "確認變更範圍、提交分支並建立 Draft PR。",
    en: "Confirm change scope, commit the branch, and open a draft pull request.",
    ja: "変更範囲を確認し、ブランチをコミットして Draft PR を作成します。",
    fr: "Confirme le périmètre, valide la branche et ouvre une pull request en brouillon.",
    es: "Confirma el alcance, crea el commit y abre una pull request en borrador.",
  },
};

const githubSummary: Record<Locale, (name: string, topics: string) => string> = {
  "zh-CN": (name, topics) =>
    `${name} 是一个 GitHub Skill 项目，重点覆盖${topics || "智能体工作流"}。`,
  "zh-TW": (name, topics) =>
    `${name} 是一個 GitHub Skill 專案，主要涵蓋${topics || "代理工作流程"}。`,
  en: (name, topics) =>
    `${name} is a GitHub Skill project focused on ${topics || "agent workflows"}.`,
  ja: (name, topics) =>
    `${name} は ${topics || "エージェントワークフロー"} を扱う GitHub Skill プロジェクトです。`,
  fr: (name, topics) =>
    `${name} est un projet GitHub Skill centré sur ${topics || "les workflows d’agents"}.`,
  es: (name, topics) =>
    `${name} es un proyecto GitHub Skill centrado en ${topics || "flujos de agentes"}.`,
};

const customSummary: Record<Locale, (name: string) => string> = {
  "zh-CN": (name) => `${name} 是用户保存的自定义 Skill。原始说明仍保留在来源记录中。`,
  "zh-TW": (name) => `${name} 是使用者儲存的自訂 Skill。原始說明仍保留在來源紀錄中。`,
  en: (name) => `${name} is a custom Skill saved by the user. Its original description remains in the source record.`,
  ja: (name) => `${name} はユーザーが保存したカスタム Skill です。元の説明はソース記録に保持されます。`,
  fr: (name) => `${name} est un Skill personnalisé enregistré par l’utilisateur. La description d’origine reste dans la source.`,
  es: (name) => `${name} es una Skill personalizada guardada por el usuario. La descripción original se conserva en la fuente.`,
};

type CapabilityConcept =
  | "agents"
  | "automation"
  | "frontend"
  | "engineering"
  | "data"
  | "documents"
  | "research"
  | "security"
  | "testing"
  | "deployment"
  | "growth"
  | "general";

const conceptMatchers: Array<[CapabilityConcept, RegExp]> = [
  ["agents", /\b(agent|agents|codex|claude|llm|prompt|mcp)\b/i],
  ["frontend", /\b(frontend|front-end|ui|ux|design|react|web|website|css)\b/i],
  ["data", /\b(data|csv|excel|spreadsheet|analytics|chart|sql|database)\b/i],
  ["documents", /\b(document|docs|pdf|presentation|slides|writing|report)\b/i],
  ["research", /\b(research|search|browser|retrieval|knowledge|rag)\b/i],
  ["security", /\b(security|secure|audit|privacy|risk|scanner|trust)\b/i],
  ["testing", /\b(test|testing|qa|quality|review|debug|lint|ci)\b/i],
  ["deployment", /\b(deploy|deployment|cloud|hosting|release|docker|devops)\b/i],
  ["growth", /\b(marketing|growth|seo|content|social|sales)\b/i],
  ["engineering", /\b(hardware|embedded|electronics|engineering|firmware|fpga|iot)\b/i],
  ["automation", /\b(automation|automate|workflow|pipeline|orchestration)\b/i],
];

const capabilityCopy: Record<
  CapabilityConcept,
  Record<Locale, string>
> = {
  agents: {
    "zh-CN": "提供面向 AI Agent、Codex 或 Claude 的可复用工作流。",
    "zh-TW": "提供面向 AI Agent、Codex 或 Claude 的可重用工作流程。",
    en: "Provides reusable workflows for AI agents, Codex, or Claude.",
    ja: "AI Agent、Codex、Claude 向けの再利用可能なワークフローを提供します。",
    fr: "Fournit des workflows réutilisables pour les agents IA, Codex ou Claude.",
    es: "Ofrece flujos reutilizables para agentes de IA, Codex o Claude.",
  },
  automation: {
    "zh-CN": "把重复步骤组织成可调用、可复用的自动化流程。",
    "zh-TW": "把重複步驟組織成可呼叫、可重用的自動化流程。",
    en: "Turns repeated steps into callable, reusable automation.",
    ja: "反復作業を呼び出し可能で再利用できる自動化にまとめます。",
    fr: "Transforme les étapes répétitives en automatisations réutilisables.",
    es: "Convierte pasos repetitivos en automatizaciones reutilizables.",
  },
  frontend: {
    "zh-CN": "支持界面设计、前端实现或用户体验审查。",
    "zh-TW": "支援介面設計、前端實作或使用者體驗審查。",
    en: "Supports interface design, frontend implementation, or UX review.",
    ja: "UI 設計、フロントエンド実装、UX レビューを支援します。",
    fr: "Aide à concevoir l’interface, développer le frontend ou auditer l’UX.",
    es: "Ayuda con diseño de interfaz, frontend o revisión de UX.",
  },
  engineering: {
    "zh-CN": "面向工程、硬件、嵌入式或技术研发任务。",
    "zh-TW": "面向工程、硬體、嵌入式或技術研發任務。",
    en: "Targets engineering, hardware, embedded, or technical R&D work.",
    ja: "工学、ハードウェア、組み込み、技術研究開発を対象にします。",
    fr: "Cible l’ingénierie, le matériel, l’embarqué ou la R&D technique.",
    es: "Se orienta a ingeniería, hardware, sistemas embebidos o I+D.",
  },
  data: {
    "zh-CN": "帮助处理、分析或呈现结构化数据。",
    "zh-TW": "協助處理、分析或呈現結構化資料。",
    en: "Helps process, analyze, or present structured data.",
    ja: "構造化データの処理、分析、可視化を支援します。",
    fr: "Aide à traiter, analyser ou présenter des données structurées.",
    es: "Ayuda a procesar, analizar o presentar datos estructurados.",
  },
  documents: {
    "zh-CN": "用于创建、检查或转换文档型交付物。",
    "zh-TW": "用於建立、檢查或轉換文件型交付物。",
    en: "Creates, checks, or transforms document-based deliverables.",
    ja: "文書形式の成果物を作成、検査、変換します。",
    fr: "Crée, vérifie ou transforme des livrables documentaires.",
    es: "Crea, revisa o transforma entregables documentales.",
  },
  research: {
    "zh-CN": "支持信息检索、资料研究和知识整理。",
    "zh-TW": "支援資訊檢索、資料研究與知識整理。",
    en: "Supports information retrieval, research, and knowledge synthesis.",
    ja: "情報検索、調査、知識整理を支援します。",
    fr: "Aide à rechercher, étudier et synthétiser les connaissances.",
    es: "Ayuda a buscar, investigar y sintetizar conocimiento.",
  },
  security: {
    "zh-CN": "用于安全审查、风险识别或隐私检查。",
    "zh-TW": "用於安全審查、風險辨識或隱私檢查。",
    en: "Supports security review, risk detection, or privacy checks.",
    ja: "セキュリティレビュー、リスク検出、プライバシー確認を支援します。",
    fr: "Aide à auditer la sécurité, détecter les risques ou vérifier la confidentialité.",
    es: "Ayuda a revisar seguridad, detectar riesgos o comprobar privacidad.",
  },
  testing: {
    "zh-CN": "帮助测试、调试并验证交付质量。",
    "zh-TW": "協助測試、除錯並驗證交付品質。",
    en: "Helps test, debug, and verify delivery quality.",
    ja: "テスト、デバッグ、成果物の品質確認を支援します。",
    fr: "Aide à tester, déboguer et vérifier la qualité du livrable.",
    es: "Ayuda a probar, depurar y verificar la calidad de entrega.",
  },
  deployment: {
    "zh-CN": "覆盖发布、托管、云端或交付流程。",
    "zh-TW": "涵蓋發布、託管、雲端或交付流程。",
    en: "Covers release, hosting, cloud, or delivery workflows.",
    ja: "リリース、ホスティング、クラウド、配布作業を扱います。",
    fr: "Couvre la publication, l’hébergement, le cloud ou la livraison.",
    es: "Cubre publicación, alojamiento, nube o flujos de entrega.",
  },
  growth: {
    "zh-CN": "支持内容、传播、增长或用户获取工作。",
    "zh-TW": "支援內容、傳播、成長或使用者獲取工作。",
    en: "Supports content, distribution, growth, or user acquisition.",
    ja: "コンテンツ、配信、成長、ユーザー獲得を支援します。",
    fr: "Aide au contenu, à la distribution, à la croissance ou à l’acquisition.",
    es: "Ayuda con contenido, distribución, crecimiento o adquisición.",
  },
  general: {
    "zh-CN": "提供可复用的项目执行方法，并应在使用前阅读原始 SKILL.md。",
    "zh-TW": "提供可重用的專案執行方法，使用前仍應閱讀原始 SKILL.md。",
    en: "Provides a reusable project workflow; read the original SKILL.md before use.",
    ja: "再利用可能な実行手順を提供します。使用前に元の SKILL.md を確認してください。",
    fr: "Fournit une méthode réutilisable ; lisez le SKILL.md original avant usage.",
    es: "Ofrece un método reutilizable; revisa el SKILL.md original antes de usarlo.",
  },
};

const useCaseCopy: Record<
  NonNullable<RepositoryLike["lane"]>,
  Record<Locale, string>
> = {
  focus: {
    "zh-CN": "适合直接补强你当前正在积累的能力。",
    "zh-TW": "適合直接補強你目前正在累積的能力。",
    en: "Best for directly strengthening capabilities you already use.",
    ja: "現在使っている能力を直接強化する用途に適しています。",
    fr: "Idéal pour renforcer directement vos capacités actuelles.",
    es: "Ideal para reforzar directamente tus capacidades actuales.",
  },
  adjacent: {
    "zh-CN": "适合连接相邻工作流，补齐当前项目的能力缺口。",
    "zh-TW": "適合連接相鄰工作流程，補齊目前專案的能力缺口。",
    en: "Best for connecting adjacent workflows and filling capability gaps.",
    ja: "隣接する作業をつなぎ、能力の不足を補う用途に適しています。",
    fr: "Idéal pour relier des workflows voisins et combler des lacunes.",
    es: "Ideal para conectar flujos cercanos y cubrir carencias.",
  },
  wildcard: {
    "zh-CN": "适合作为跨领域灵感，使用前应先确认是否真的适配项目。",
    "zh-TW": "適合作為跨領域靈感，使用前應先確認是否真的適配專案。",
    en: "Best as cross-domain inspiration; verify project fit before use.",
    ja: "分野横断の発想に向きます。利用前に適合性を確認してください。",
    fr: "Utile comme inspiration interdisciplinaire ; vérifiez l’adéquation avant usage.",
    es: "Útil como inspiración interdisciplinaria; verifica el encaje antes de usarla.",
  },
};

const repositoryIntro: Record<
  Locale,
  (name: string, topics: string) => string
> = {
  "zh-CN": (name, topics) =>
    `${name} 是一个围绕${topics}组织的 GitHub Skill 项目。`,
  "zh-TW": (name, topics) =>
    `${name} 是一個圍繞${topics}組織的 GitHub Skill 專案。`,
  en: (name, topics) =>
    `${name} is a GitHub Skill project organized around ${topics}.`,
  ja: (name, topics) =>
    `${name} は ${topics} を中心に構成された GitHub Skill プロジェクトです。`,
  fr: (name, topics) =>
    `${name} est un projet GitHub Skill consacré à ${topics}.`,
  es: (name, topics) =>
    `${name} es un proyecto GitHub Skill centrado en ${topics}.`,
};

function topicLabel(tags: string[]) {
  return tags.slice(0, 3).join(", ");
}

export function localizeSkillDescription(
  skill: LocalizableSkill,
  locale: Locale,
) {
  const containsCjk = /[\u3040-\u30ff\u3400-\u9fff]/.test(
    skill.description,
  );
  const originalFitsLocale =
    ((locale === "zh-CN" || locale === "zh-TW") &&
      /[\u3400-\u9fff]/.test(skill.description)) ||
    (locale === "ja" &&
      /[\u3040-\u30ff]/.test(skill.description)) ||
    (locale === "en" && !containsCjk);
  return (
    skill.descriptionI18n?.[locale] ||
    curatedDescriptions[skill.id]?.[locale] ||
    (originalFitsLocale
      ? skill.description
      : skill.sourceUrl?.includes("github.com") ||
          /github/i.test(skill.source)
        ? githubSummary[locale](skill.name, topicLabel(skill.tags))
        : customSummary[locale](skill.name))
  );
}

export function localizeRepositoryDescription(
  repository: RepositoryLike,
  locale: Locale,
) {
  return localizeRepositoryDetails(repository, locale).summary;
}

export function localizeRepositoryDetails(
  repository: RepositoryLike,
  locale: Locale,
): LocalizedRepositoryDetails {
  const haystack = [
    repository.name,
    repository.description,
    ...repository.topics,
  ].join(" ");
  const concepts = conceptMatchers
    .filter(([, matcher]) => matcher.test(haystack))
    .map(([concept]) => concept)
    .filter((concept, index, all) => all.indexOf(concept) === index)
    .slice(0, 3);
  const resolved = concepts.length ? concepts : ["general" as const];
  const topicText =
    repository.topics.slice(0, 3).join(", ") ||
    resolved
      .map((concept) => capabilityCopy[concept][locale].split(/[，。,.]/)[0])
      .join(", ");
  return {
    summary:
      locale === "en" && repository.description
        ? repository.description
        : repositoryIntro[locale](repository.name, topicText),
    useCase: useCaseCopy[repository.lane || "focus"][locale],
    capabilities: resolved.map((concept) => capabilityCopy[concept][locale]),
    original: repository.description,
  };
}

type RepositoryArchetype =
  | "directory"
  | "operating-system"
  | "token-optimizer"
  | "memory-layer"
  | "skill-bundle"
  | "single-skill";

const decisionProfiles: Record<
  RepositoryArchetype,
  Record<Locale, LocalizedDecisionProfile>
> = {
  directory: {
    "zh-CN": {
      kind: "Skill 索引与发现引擎",
      verdict:
        "它主要帮你发现、分类和筛选别人的 Skills，本身通常不是直接完成项目任务的执行 Skill。",
      capabilities: [
        "扫描并建立多平台 Skill、插件、MCP 与 Agent 目录",
        "按质量、风险、维护状态和兼容平台整理候选项",
        "提供目录或 API，帮助继续寻找真正要安装的 Skill",
      ],
      useWhen: [
        "你只有一个模糊需求，想先扩大候选范围",
        "你需要比较多个 Skill，而不是立即执行项目",
      ],
      workflow: [
        "输入领域或工具方向",
        "从索引中筛选候选项",
        "再审查具体候选项的 SKILL.md 后决定是否安装",
      ],
      requirements: ["需要继续读取被索引 Skill 的真实来源文件"],
      limitations: [
        "目录收录不等于安全、可用或适合你的项目",
        "不要把整个目录当作一个执行 Skill 安装",
      ],
    },
    "zh-TW": {
      kind: "Skill 索引與探索引擎",
      verdict:
        "它主要協助探索、分類與篩選其他 Skills，本身通常不是直接完成專案任務的執行 Skill。",
      capabilities: [
        "掃描並建立多平台 Skill、外掛、MCP 與 Agent 目錄",
        "依品質、風險、維護狀態與相容平台整理候選項",
        "提供目錄或 API，繼續尋找真正需要安裝的 Skill",
      ],
      useWhen: ["需求仍模糊，需要擴大候選範圍", "需要比較多個 Skill"],
      workflow: ["輸入方向", "篩選候選項", "審查真實 SKILL.md 後再安裝"],
      requirements: ["仍需讀取候選 Skill 的真實來源檔案"],
      limitations: ["被收錄不代表安全或適用", "不要把整個目錄當作執行 Skill"],
    },
    en: {
      kind: "Skill index and discovery engine",
      verdict:
        "It discovers, classifies, and compares other Skills. It is usually not the Skill that performs your project task.",
      capabilities: [
        "Indexes Skills, plugins, MCP servers, and agents across platforms",
        "Organizes candidates by quality, risk, maintenance, and compatibility",
        "Exposes a directory or API for finding installable candidates",
      ],
      useWhen: ["Your idea is still broad", "You need to compare several Skills"],
      workflow: ["Enter a domain", "Filter candidates", "Inspect the selected SKILL.md before installation"],
      requirements: ["You must still inspect each candidate's real source files"],
      limitations: ["Listing does not prove safety or fit", "Do not install the whole directory as one execution Skill"],
    },
    ja: {
      kind: "Skill 索引・探索エンジン",
      verdict:
        "他の Skills を発見、分類、比較するための仕組みです。通常、プロジェクト作業を直接実行する Skill ではありません。",
      capabilities: ["複数プラットフォームの Skills、MCP、Agent を索引化", "品質、リスク、保守状況で候補を整理", "候補検索用のディレクトリや API を提供"],
      useWhen: ["要件がまだ曖昧なとき", "複数の Skill を比較したいとき"],
      workflow: ["分野を入力", "候補を絞り込む", "実際の SKILL.md を確認してから導入"],
      requirements: ["候補ごとの実ファイル確認が必要"],
      limitations: ["掲載は安全性や適合性の保証ではない", "ディレクトリ全体を一つの実行 Skill として扱わない"],
    },
    fr: {
      kind: "Index et moteur de découverte de Skills",
      verdict:
        "Il découvre, classe et compare d'autres Skills. Ce n'est généralement pas le Skill qui exécute directement le projet.",
      capabilities: ["Indexe Skills, plugins, MCP et agents", "Classe par qualité, risque, maintenance et compatibilité", "Fournit un catalogue ou une API"],
      useWhen: ["Le besoin est encore vague", "Vous devez comparer plusieurs Skills"],
      workflow: ["Saisir un domaine", "Filtrer les candidats", "Vérifier le vrai SKILL.md avant installation"],
      requirements: ["Les fichiers sources de chaque candidat doivent encore être vérifiés"],
      limitations: ["La présence dans l'index ne garantit ni sécurité ni adéquation", "Ne pas installer tout l'index comme un Skill d'exécution"],
    },
    es: {
      kind: "Índice y motor de descubrimiento de Skills",
      verdict:
        "Descubre, clasifica y compara otras Skills. Normalmente no ejecuta por sí mismo la tarea del proyecto.",
      capabilities: ["Indexa Skills, plugins, MCP y agentes", "Ordena por calidad, riesgo, mantenimiento y compatibilidad", "Ofrece un directorio o API"],
      useWhen: ["La necesidad todavía es vaga", "Necesitas comparar varias Skills"],
      workflow: ["Indicar un área", "Filtrar candidatos", "Revisar el SKILL.md real antes de instalar"],
      requirements: ["Todavía hay que revisar los archivos fuente de cada candidato"],
      limitations: ["Estar indexado no garantiza seguridad ni encaje", "No instales todo el directorio como una Skill ejecutora"],
    },
  },
  "operating-system": {
    "zh-CN": {
      kind: "Agent 工程操作框架",
      verdict:
        "它不是一个小 Skill，而是一整套角色、命令、架构规范、任务记录和验证流程，会深度改变 Codex 在仓库里的工作方式。",
      capabilities: [
        "统一团队在多个仓库中的 Agent 行为与编码规范",
        "按任务自动选择角色、Skills、命令和架构模板",
        "管理任务、子 Agent、验证证据、项目记忆和 PR 流程",
      ],
      useWhen: [
        "团队想统一 Codex、Claude 或 Cursor 的工程流程",
        "项目长期维护，且需要角色、任务和验证记录",
      ],
      workflow: [
        "先 Fork，再以子模块或工具目录安装到项目",
        "通过根目录 AGENTS.md 激活",
        "根据提示解析角色、Skills、任务、架构、执行和验证",
      ],
      requirements: ["需要修改仓库结构，并维护自己的 Fork", "更适合团队级或长期项目"],
      limitations: [
        "对只需要一个小功能的项目明显过重",
        "它会写入任务、记忆和架构文件，使用前必须审查边界",
      ],
    },
    "zh-TW": {
      kind: "Agent 工程操作框架",
      verdict:
        "它不是單一小 Skill，而是一整套角色、命令、架構規範、任務紀錄與驗證流程，會深度改變 Agent 在儲存庫中的工作方式。",
      capabilities: ["統一多個儲存庫的 Agent 行為", "自動選擇角色、Skills、命令與架構", "管理任務、子 Agent、驗證、記憶與 PR"],
      useWhen: ["團隊需要統一工程流程", "長期專案需要可追蹤的任務與驗證"],
      workflow: ["先 Fork 並安裝到專案", "透過 AGENTS.md 啟用", "依序解析角色、任務、架構、執行與驗證"],
      requirements: ["需要修改儲存庫結構並維護 Fork"],
      limitations: ["小型任務使用成本過高", "會寫入專案檔案，需先審查邊界"],
    },
    en: {
      kind: "Agent engineering operating framework",
      verdict:
        "This is not a small Skill. It is a repository-wide system for roles, commands, architecture, tasks, memory, and verification.",
      capabilities: ["Standardizes agent behavior across repositories", "Routes roles, Skills, commands, and architecture", "Manages tasks, sub-agents, evidence, memory, and PR flow"],
      useWhen: ["A team needs a shared engineering workflow", "A long-lived project needs traceable execution"],
      workflow: ["Fork and install it into the project", "Activate through AGENTS.md", "Run its role, task, architecture, execution, and verification flow"],
      requirements: ["Repository changes and a maintained fork are expected"],
      limitations: ["Too heavy for a single small task", "Writes project artifacts and must be reviewed before adoption"],
    },
    ja: {
      kind: "Agent エンジニアリング運用フレームワーク",
      verdict: "小さな Skill ではなく、役割、コマンド、設計、タスク、記憶、検証をリポジトリ全体で管理する仕組みです。",
      capabilities: ["複数リポジトリの Agent 動作を統一", "役割、Skills、コマンド、設計を選択", "タスク、サブ Agent、証拠、記憶、PR を管理"],
      useWhen: ["チームで工程を統一したいとき", "長期プロジェクトで実行履歴が必要なとき"],
      workflow: ["Fork して導入", "AGENTS.md から有効化", "役割、タスク、設計、実行、検証を順に処理"],
      requirements: ["リポジトリ変更と Fork の保守が必要"],
      limitations: ["小さな単発作業には重すぎる", "プロジェクトへファイルを書き込むため事前確認が必要"],
    },
    fr: {
      kind: "Cadre d'exploitation pour agents",
      verdict: "Ce n'est pas un petit Skill, mais un système global de rôles, commandes, architecture, tâches, mémoire et validation.",
      capabilities: ["Uniformise le comportement des agents", "Route rôles, Skills, commandes et architecture", "Gère tâches, sous-agents, preuves, mémoire et PR"],
      useWhen: ["Une équipe veut un processus partagé", "Un projet durable exige une exécution traçable"],
      workflow: ["Forker et installer", "Activer via AGENTS.md", "Exécuter le flux rôles, tâches, architecture et validation"],
      requirements: ["Modifie le dépôt et demande de maintenir un fork"],
      limitations: ["Trop lourd pour une petite tâche", "Écrit des artefacts dans le projet"],
    },
    es: {
      kind: "Marco operativo de ingeniería para agentes",
      verdict: "No es una Skill pequeña, sino un sistema de roles, comandos, arquitectura, tareas, memoria y verificación para todo el repositorio.",
      capabilities: ["Unifica el comportamiento del agente", "Enruta roles, Skills, comandos y arquitectura", "Gestiona tareas, subagentes, evidencias, memoria y PR"],
      useWhen: ["Un equipo necesita un proceso común", "Un proyecto largo requiere ejecución trazable"],
      workflow: ["Hacer fork e instalar", "Activar mediante AGENTS.md", "Ejecutar roles, tareas, arquitectura y verificación"],
      requirements: ["Modifica el repositorio y requiere mantener un fork"],
      limitations: ["Demasiado pesado para una tarea pequeña", "Escribe artefactos en el proyecto"],
    },
  },
  "token-optimizer": {
    "zh-CN": {
      kind: "Token 与上下文优化层",
      verdict:
        "它通过拦截大文件读取、压缩上下文、缓存工具调用和收紧读取范围来减少 Token 消耗，不是替你写代码的业务 Skill。",
      capabilities: [
        "对 PDF、Office、CSV、Markdown 和图片做更小范围的读取或压缩",
        "缓存 MCP 调用、清单和可复用 Skill 内容",
        "加入提示注入防护与读取规则，减少无效上下文",
      ],
      useWhen: ["大型仓库或长会话频繁超出上下文", "Codex 经常读取过多文件或重复调用工具"],
      workflow: ["安装拦截与缓存层", "按规则缩小读取内容", "把精简后的上下文交给 Agent"],
      requirements: ["需要允许它介入文件读取和工具调用流程"],
      limitations: ["过度压缩可能漏掉关键上下文", "拦截规则和缓存内容必须接受安全审查"],
    },
    "zh-TW": {
      kind: "Token 與上下文最佳化層",
      verdict: "它透過攔截大型檔案、壓縮上下文與快取工具呼叫來降低 Token，不是直接寫程式的業務 Skill。",
      capabilities: ["縮小 PDF、Office、CSV、Markdown 與圖片讀取", "快取 MCP 呼叫與 Skill 內容", "加入提示注入防護"],
      useWhen: ["大型儲存庫或長對話超出上下文", "Agent 重複讀檔或呼叫工具"],
      workflow: ["安裝攔截層", "依規則精簡內容", "把精簡上下文交給 Agent"],
      requirements: ["需要介入讀檔與工具流程"],
      limitations: ["過度精簡可能遺漏關鍵資訊", "規則與快取需安全審查"],
    },
    en: {
      kind: "Token and context optimization layer",
      verdict: "It reduces token use by intercepting large reads, compacting context, and caching tool calls. It is not a domain execution Skill.",
      capabilities: ["Narrows or compresses document, data, Markdown, and image reads", "Caches MCP calls and reusable manifests", "Adds prompt-injection and read-scope rules"],
      useWhen: ["Large repositories or long sessions exceed context", "Agents repeatedly read too much data"],
      workflow: ["Install the interception layer", "Apply read and cache rules", "Pass compact context to the agent"],
      requirements: ["It must sit in the file-read and tool-call path"],
      limitations: ["Over-compaction can hide critical context", "Interception and cache rules need security review"],
    },
    ja: {
      kind: "Token・コンテキスト最適化レイヤー",
      verdict: "大きな読み取りを制限し、コンテキストを圧縮し、ツール呼び出しをキャッシュして Token を削減します。",
      capabilities: ["文書、データ、画像の読み取りを縮小", "MCP 呼び出しとマニフェストをキャッシュ", "プロンプトインジェクション対策を追加"],
      useWhen: ["大規模リポジトリや長いセッション", "Agent が過剰にファイルを読むとき"],
      workflow: ["介入レイヤーを導入", "読み取りとキャッシュ規則を適用", "圧縮済みコンテキストを渡す"],
      requirements: ["ファイル読み取りとツール呼び出し経路への介入が必要"],
      limitations: ["圧縮しすぎると重要情報を失う", "規則とキャッシュの安全確認が必要"],
    },
    fr: {
      kind: "Couche d'optimisation des tokens et du contexte",
      verdict: "Elle réduit les tokens par interception, compression du contexte et cache des outils. Ce n'est pas un Skill métier.",
      capabilities: ["Réduit la lecture de documents, données et images", "Met en cache les appels MCP", "Ajoute des règles contre l'injection"],
      useWhen: ["Dépôts volumineux ou longues sessions", "L'agent relit trop de contenu"],
      workflow: ["Installer la couche", "Appliquer les règles", "Transmettre le contexte compact"],
      requirements: ["Doit intervenir dans la lecture et les appels d'outils"],
      limitations: ["Une compression excessive peut masquer des informations", "Les règles et caches doivent être audités"],
    },
    es: {
      kind: "Capa de optimización de tokens y contexto",
      verdict: "Reduce tokens interceptando lecturas grandes, compactando contexto y almacenando llamadas. No es una Skill de negocio.",
      capabilities: ["Reduce lecturas de documentos, datos e imágenes", "Almacena llamadas MCP", "Añade reglas contra inyección"],
      useWhen: ["Repositorios grandes o sesiones largas", "El agente relee demasiado contenido"],
      workflow: ["Instalar la capa", "Aplicar reglas", "Entregar contexto compacto"],
      requirements: ["Debe intervenir en lecturas y llamadas de herramientas"],
      limitations: ["Compactar demasiado puede ocultar información", "Las reglas y cachés requieren auditoría"],
    },
  },
  "memory-layer": {} as Record<Locale, LocalizedDecisionProfile>,
  "skill-bundle": {} as Record<Locale, LocalizedDecisionProfile>,
  "single-skill": {} as Record<Locale, LocalizedDecisionProfile>,
};

decisionProfiles["memory-layer"] = mapDecisionProfile(
  decisionProfiles["token-optimizer"],
  {
    "zh-CN": ["Agent 跨会话记忆层", "它在会话之间保存项目记忆、检查点和上下文状态，让用户不必每次重新说明项目。", "长期项目、跨会话协作或需要中断恢复时", "它会持久化项目状态，必须确认保存位置、隐私边界和清理方式", ["保存项目目标、决策、进度与检查点", "在新会话恢复必要上下文"], ["在会话结束时写入状态", "下次会话加载并校验状态"], ["需要可写的项目本地存储"]],
    "zh-TW": ["Agent 跨工作階段記憶層", "它在工作階段之間保存專案記憶、檢查點與上下文。", "長期專案或中斷恢復", "會持久化專案狀態，需確認隱私與清理方式", ["保存目標、決策、進度與檢查點", "在新工作階段恢復上下文"], ["結束時寫入狀態", "下次載入並校驗"], ["需要可寫的專案本地儲存"]],
    en: ["Cross-session agent memory layer", "It preserves project memory, checkpoints, and context between sessions.", "Long-running projects and interruption recovery", "It persists project state, so storage, privacy, and cleanup must be reviewed", ["Stores goals, decisions, progress, and checkpoints", "Restores relevant context in later sessions"], ["Write state at session boundaries", "Load and validate it in the next session"], ["Requires writable project-local storage"]],
    ja: ["Agent のセッション間メモリ層", "セッション間でプロジェクト記憶、チェックポイント、文脈を保持します。", "長期プロジェクトや中断復帰", "状態を永続化するため保存場所と削除方法の確認が必要", ["目標、判断、進捗、チェックポイントを保存", "次のセッションで文脈を復元"], ["終了時に状態を書き込む", "次回読み込み時に検証"], ["書き込み可能なローカル保存先が必要"]],
    fr: ["Mémoire intersession pour agents", "Elle conserve la mémoire, les points de contrôle et le contexte entre les sessions.", "Projets longs et reprise après interruption", "Elle persiste l'état du projet, donc stockage et confidentialité doivent être vérifiés", ["Conserve objectifs, décisions, progrès et points de contrôle", "Restaure le contexte lors des sessions suivantes"], ["Écrire l'état en fin de session", "Le charger et le vérifier ensuite"], ["Nécessite un stockage local accessible en écriture"]],
    es: ["Memoria entre sesiones para agentes", "Conserva memoria, puntos de control y contexto entre sesiones.", "Proyectos largos y recuperación", "Persiste el estado del proyecto, por lo que hay que revisar almacenamiento y privacidad", ["Guarda objetivos, decisiones, progreso y puntos de control", "Recupera contexto en sesiones posteriores"], ["Escribir estado al cerrar", "Cargarlo y validarlo después"], ["Requiere almacenamiento local con escritura"]],
  },
);

decisionProfiles["skill-bundle"] = mapDecisionProfile(
  decisionProfiles["operating-system"],
  {
    "zh-CN": ["多 Skill 工具包", "这个仓库包含多个相互独立的 Skills。应该按任务挑选需要的几个，而不是把整个仓库当成一个 Skill。", "项目同时需要几个明确的相邻能力时", "多个 Skills 可能重复、冲突或扩大上下文，应逐个选择", ["提供多个可独立触发和组合的工作流", "允许按项目只安装需要的部分"], ["先查看仓库内 Skill 清单", "按职责选择最小集合并检查冲突"], ["需要逐个读取对应 SKILL.md"]],
    "zh-TW": ["多 Skill 工具包", "此儲存庫包含多個獨立 Skills，應按任務挑選。", "專案需要數個相鄰能力時", "Skills 可能重複或衝突，需逐個選擇", ["提供多個獨立工作流程", "可只安裝需要的部分"], ["查看 Skill 清單", "選擇最小集合並檢查衝突"], ["需逐個讀取 SKILL.md"]],
    en: ["Multi-Skill toolkit", "This repository contains separate Skills. Select the few needed for the task instead of treating the repository as one Skill.", "Projects that need several adjacent capabilities", "Skills may overlap, conflict, or add unnecessary context", ["Provides multiple independently triggered workflows", "Supports installing only the needed subset"], ["Review the Skill list", "Choose the smallest set and check conflicts"], ["Each selected SKILL.md must be read"]],
    ja: ["複数 Skill のツールキット", "独立した複数の Skills を含みます。必要なものだけを選ぶべきです。", "複数の隣接能力が必要なプロジェクト", "重複、競合、不要なコンテキストに注意", ["複数の独立したワークフローを提供", "必要な部分だけ導入可能"], ["一覧を確認", "最小構成を選び競合を確認"], ["各 SKILL.md の確認が必要"]],
    fr: ["Boîte à outils multi-Skills", "Le dépôt contient plusieurs Skills distincts. Il faut choisir seulement ceux nécessaires.", "Projets nécessitant plusieurs capacités voisines", "Risque de chevauchement, conflit ou contexte inutile", ["Fournit plusieurs workflows indépendants", "Permet d'installer seulement le sous-ensemble utile"], ["Examiner la liste", "Choisir l'ensemble minimal et vérifier les conflits"], ["Chaque SKILL.md choisi doit être lu"]],
    es: ["Kit de varias Skills", "El repositorio contiene Skills separadas. Hay que elegir solo las necesarias.", "Proyectos que necesitan varias capacidades cercanas", "Pueden solaparse, entrar en conflicto o añadir contexto innecesario", ["Ofrece varios flujos independientes", "Permite instalar solo el subconjunto necesario"], ["Revisar la lista", "Elegir el conjunto mínimo y comprobar conflictos"], ["Hay que leer cada SKILL.md seleccionado"]],
  },
);

decisionProfiles["single-skill"] = mapDecisionProfile(
  decisionProfiles["token-optimizer"],
  {
    "zh-CN": ["单一执行 Skill", "这是一个范围明确的 Skill。只有当项目任务与它的触发条件直接匹配时才值得加入。", "当前任务与 Skill 的真实描述和触发条件一致时", "不要因为名称或热门程度相似就加入，先确认输入、输出和限制", ["把一个明确任务固化为可重复执行的流程", "在匹配触发条件时为 Agent 提供专门约束"], ["识别触发条件", "读取完整 SKILL.md 后执行并验证结果"], ["需要兼容的 Agent 与真实 SKILL.md"]],
    "zh-TW": ["單一執行 Skill", "這是一個範圍明確的 Skill，只有任務直接符合觸發條件時才應加入。", "任務與真實描述和觸發條件一致時", "先確認輸入、輸出與限制", ["把明確任務固化為可重複流程", "符合觸發條件時提供專門約束"], ["辨識觸發條件", "讀取完整 SKILL.md 後執行並驗證"], ["需要相容 Agent 與真實 SKILL.md"]],
    en: ["Single execution Skill", "This is a focused Skill. Add it only when the project directly matches its real trigger and scope.", "The task matches its declared trigger and output", "Do not add it based on name or popularity alone", ["Packages one focused task as a repeatable workflow", "Adds specialist constraints when its trigger matches"], ["Match the trigger", "Read the full SKILL.md, execute, and verify"], ["Requires a compatible agent and the real SKILL.md"]],
    ja: ["単一実行 Skill", "範囲が明確な Skill です。実際のトリガーと作業が一致するときだけ追加します。", "タスクが宣言された用途と一致するとき", "名前や人気だけで追加せず入出力と制約を確認", ["特定作業を再現可能な手順にする", "トリガー一致時に専門ルールを追加"], ["トリガーを確認", "SKILL.md を読み実行と検証"], ["対応 Agent と実ファイルが必要"]],
    fr: ["Skill d'exécution unique", "C'est un Skill ciblé. Ajoutez-le seulement si la tâche correspond à son déclencheur et à son périmètre.", "La tâche correspond au cas d'usage déclaré", "Ne pas l'ajouter uniquement selon le nom ou la popularité", ["Transforme une tâche précise en workflow répétable", "Ajoute des contraintes spécialisées lorsque le déclencheur correspond"], ["Vérifier le déclencheur", "Lire le SKILL.md, exécuter et valider"], ["Nécessite un agent compatible et le vrai SKILL.md"]],
    es: ["Skill ejecutora individual", "Es una Skill enfocada. Añádela solo si la tarea coincide con su activador y alcance.", "La tarea coincide con el uso declarado", "No la añadas solo por nombre o popularidad", ["Convierte una tarea concreta en un flujo repetible", "Añade reglas especializadas cuando coincide el activador"], ["Comprobar el activador", "Leer SKILL.md, ejecutar y verificar"], ["Requiere un agente compatible y el SKILL.md real"]],
  },
);

function mapDecisionProfile(
  base: Record<Locale, LocalizedDecisionProfile>,
  replacements: Record<
    Locale,
    [string, string, string, string, string[], string[], string[]]
  >,
) {
  return Object.fromEntries(
    Object.entries(base).map(([locale, profile]) => {
      const replacement = replacements[locale as Locale];
      return [
        locale,
        {
          ...profile,
          kind: replacement[0],
          verdict: replacement[1],
          useWhen: [replacement[2]],
          limitations: [replacement[3]],
          capabilities: replacement[4],
          workflow: replacement[5],
          requirements: replacement[6],
        },
      ];
    }),
  ) as Record<Locale, LocalizedDecisionProfile>;
}

export function localizeDecisionProfile(
  repository: RepositoryLike,
  profile: SourceProfileLike,
  locale: Locale,
  skillCount: number,
): LocalizedDecisionProfile {
  const haystack = [
    repository.name,
    repository.description,
    profile.overview,
    ...profile.capabilities,
    ...profile.workflow,
    ...profile.requirements,
  ]
    .join(" ")
    .toLowerCase();
  const archetype: RepositoryArchetype =
    /(directory|discovery engine|indexes? skills|curated directory|catalog)/.test(
      haystack,
    )
      ? "directory"
      : /(token burn|token reduc|compact context|file interception|cache mcp|context optim)/.test(
            haystack,
          )
        ? "token-optimizer"
        : /(memory across sessions|cross-session|checkpoint|never re-brief|persistent memory)/.test(
              haystack,
            )
          ? "memory-layer"
          : /(standardiz|architecture guidance|role-skill|sub-agent orchestration|enterprise-ready development workflow)/.test(
                haystack,
              )
            ? "operating-system"
            : skillCount > 1
              ? "skill-bundle"
              : "single-skill";
  return decisionProfiles[archetype][locale];
}
