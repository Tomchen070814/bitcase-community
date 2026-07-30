export type SourceLanguage = "zh" | "en" | "ja" | "mixed";

export type CapabilityId =
  | "skill-ui"
  | "skill-intake"
  | "skill-discovery"
  | "creator-discovery"
  | "content-collection"
  | "performance-ranking"
  | "taxonomy"
  | "persistence"
  | "backend"
  | "auth"
  | "commerce"
  | "automation"
  | "instrument"
  | "security"
  | "testing"
  | "delivery"
  | "data"
  | "document"
  | "visual"
  | "communication"
  | "engineering";

export type ProjectCapability = {
  id: CapabilityId;
  label: string;
  priority: number;
  query: string;
};

export type ProjectPlan = {
  kind:
    | "skill-library"
    | "web-app"
    | "content-site"
    | "data-workflow"
    | "instrument-automation"
    | "communication-workflow"
    | "social-content-research"
    | "general";
  kindLabel: string;
  userLanguage: SourceLanguage;
  capabilities: ProjectCapability[];
  searchTopics: string[];
};

type CapabilityDefinition = Omit<ProjectCapability, "priority"> & {
  patterns: RegExp;
};

const definitions: Record<CapabilityId, CapabilityDefinition> = {
  "skill-ui": {
    id: "skill-ui",
    label: "界面设计与前端实现",
    query: "frontend user interface accessibility",
    patterns: /(frontend|react|next\.?(js)?|website|web app|ui|ux|design system|dashboard|网页|网站|前端|界面|可视化|交互)/i,
  },
  "skill-intake": {
    id: "skill-intake",
    label: "来源导入与 SKILL.md 解析",
    query: "github source parser metadata",
    patterns: /(import|intake|parse|parser|crawl|scrape|extract|metadata|repository reader|github api|导入|解析|爬取|抓取|提取|元数据|来源读取|仓库读取)/i,
  },
  "skill-discovery": {
    id: "skill-discovery",
    label: "Skill 检索、推荐与匹配",
    query: "skill search retrieval recommendation",
    patterns: /(search|discover|discovery|retrieval|index|recommend|recommendation|ranking|match|matching|query|检索|搜索|发现|推荐|匹配|排序|索引)/i,
  },
  "creator-discovery": {
    id: "creator-discovery",
    label: "创作者与账号发现",
    query: "social media creator influencer discovery niche audience",
    patterns: /(social (?:media|network) (?:creator|influencer|account|profile)|creator discovery|influencer discovery|creator search|influencer search|audience niche|creator profile|instagram creator|tiktok creator|youtube creator|xiaohongshu creator|douyin creator|bilibili creator|社交媒体.*(?:创作者|博主|达人|网红|账号)|社媒.*(?:创作者|博主|达人|网红|账号)|创作者发现|创作者搜索|博主发现|博主搜索|达人发现|达人搜索|网红发现|网红搜索|账号发现|账号搜索|抖音.*账号|小红书.*账号|视频号.*账号|B站.*账号)/i,
  },
  "content-collection": {
    id: "content-collection",
    label: "作品搜索与数据采集",
    query: "social media post video search scraping data collection",
    patterns: /(social (?:post|content)|creator content|post search|video search|content collection|content scraper|social scraper|scrap(?:e|ing)|crawl(?:er|ing)?|collect (?:posts?|videos?|content)|monitor (?:posts?|content)|feed ingestion|作品搜索|作品采集|内容采集|帖子采集|视频采集|社媒采集|社交媒体采集|抓取作品|抓取帖子|抓取视频|收集作品|收集帖子|收集视频)/i,
  },
  "performance-ranking": {
    id: "performance-ranking",
    label: "低粉爆款识别与表现排名",
    query: "viral content analytics engagement views follower ratio outlier ranking",
    patterns: /(viral (?:content|post|video)|trending (?:content|post|video)|content trend|outlier (?:content|post|video)|engagement rate|view(?:s)?[- ]to[- ]follower|follower ratio|performance ranking|share rate|低粉爆款|爆款识别|爆款作品|热门作品|作品趋势|内容趋势|互动率|播放粉丝比|播放量.*粉丝|粉丝.*播放量|异常高表现|表现排名)/i,
  },
  taxonomy: {
    id: "taxonomy",
    label: "账号标签与内容分类",
    query: "creator content classification taxonomy tagging niche category",
    patterns: /(content classification|creator classification|account classification|profile classification|taxonomy|tagging|niche detection|content category|creator category|账号标签|账号类型|账号分类|内容标签|内容分类|标签体系|赛道分类|垂类识别|领域分类)/i,
  },
  persistence: {
    id: "persistence",
    label: "数据模型与持久化",
    query: "database storage persistence schema",
    patterns: /(database|storage|persistence|postgres|mysql|sqlite|d1|schema|orm|migration|cache|数据库|存储|持久化|表结构|迁移|缓存)/i,
  },
  backend: {
    id: "backend",
    label: "应用后端与接口",
    query: "backend api server worker",
    patterns: /(backend|api|server|worker|full.?stack|node\.?(js)?|express|fastify|后端|服务端|接口|全栈)/i,
  },
  auth: {
    id: "auth",
    label: "身份、权限与账户",
    query: "authentication authorization account permissions",
    patterns: /(auth|authentication|authorization|account|login|sign.?in|session|oauth|rbac|identity|账户|账号|登录|注册|身份|鉴权|授权|角色权限)/i,
  },
  commerce: {
    id: "commerce",
    label: "商品、订单与支付",
    query: "ecommerce catalog checkout payment orders",
    patterns: /(e-?commerce|commerce|shop|storefront|product catalog|checkout|payment|order|cart|电商|商城|商店|商品|购物车|结账|支付|订单)/i,
  },
  automation: {
    id: "automation",
    label: "自动化流程与任务编排",
    query: "workflow automation orchestration scheduling",
    patterns: /(automation|automate|automatic(?:ally)?|workflow|orchestrat|schedule|cron|pipeline|batch|自动(?:化|搜索|采集|收集|抓取|监控|执行)?|工作流|编排|定时|批处理|流程)/i,
  },
  instrument: {
    id: "instrument",
    label: "仪器通信与设备控制",
    query: "SCPI VISA GPIB laboratory instrument control",
    patterns: /(instrument|scpi|visa|gpib|usbtmc|serial|uart|modbus|keysight|keithley|fluke|ni-?visa|仪器|设备控制|串口|采集卡|万用表|源表|半参)/i,
  },
  security: {
    id: "security",
    label: "安全与输入校验",
    query: "security audit validation",
    patterns: /(security|secure|audit|permission|threat|sanitize|validation|安全|审计|权限|风险|校验|验证)/i,
  },
  testing: {
    id: "testing",
    label: "测试与质量验证",
    query: "testing quality assurance",
    patterns: /(test|testing|tdd|qa|quality|debug|review|coverage|测试|调试|质量|审查|覆盖率)/i,
  },
  delivery: {
    id: "delivery",
    label: "部署与持续交付",
    query: "deployment ci release github",
    patterns: /(deploy|deployment|release|publish|ci\/cd|github actions|gitlab|发布|部署|持续集成|交付)/i,
  },
  data: {
    id: "data",
    label: "数据处理与分析",
    query: "data analysis spreadsheet",
    patterns: /(data|csv|excel|spreadsheet|analysis|chart|plot|dataset|数据|表格|分析|图表)/i,
  },
  document: {
    id: "document",
    label: "文档与报告交付",
    query: "document report pdf writing",
    patterns: /(document|report|pdf|writing|slides|presentation|文档|报告|写作|演示)/i,
  },
  visual: {
    id: "visual",
    label: "图像与视觉内容",
    query: "image visual illustration brand",
    patterns: /(image|visual|illustration|brand|video|图片|图像|视觉|插画|品牌|视频)/i,
  },
  communication: {
    id: "communication",
    label: "沟通与协作",
    query: "email calendar message collaboration",
    patterns: /(email|mail|calendar|slack|message|communication|邮件|日历|消息|沟通|协作)/i,
  },
  engineering: {
    id: "engineering",
    label: "工程实现",
    query: "software engineering implementation",
    patterns: /(code|coding|build|typescript|python|software|implementation|程序|代码|开发|实现|工程)/i,
  },
};

const skillLibraryPattern = /(?:skill|skills|技能).{0,14}(?:库|library|catalog|收藏|存储|储存|管理|可视化)|(?:库|library|catalog|收藏|存储|储存|管理|可视化).{0,14}(?:skill|skills|技能)/i;
const ecommercePattern = /(e-?commerce|online shop|storefront|shopping|电商|商城|网上商店|商品.*(?:订单|支付)|购物车)/i;
const instrumentPattern = /(instrument|scpi|visa|gpib|usbtmc|keysight|keithley|fluke|仪器|多台设备|数据采集|源表|万用表|半参)/i;
const webAppPattern = /(saas|web app|platform|portal|dashboard|management system|管理系统|后台系统|平台|应用|网站|网页)/i;
const contentSitePattern = /(portfolio|landing page|blog|documentation site|marketing site|作品集|落地页|博客|文档站|官网|宣传网站)/i;
const dataWorkflowPattern = /(csv|excel|spreadsheet|dataset|data analysis|report|pdf|chart|plot|数据|表格|分析|报告|图表)/i;
const communicationPattern = /(email|mail|calendar|slack|message|outreach|follow.?up|邮件|日历|消息|推广信|跟进|回复)/i;
const socialSubjectPattern = /(social media|social network|creator|influencer|instagram|tiktok|youtube|xiaohongshu|douyin|bilibili|社交媒体|社媒|创作者|博主|达人|网红|账号|抖音|小红书|视频号|B站)/i;
const socialResearchPattern = /(viral|trending|engagement|followers?|views?|outlier|scrap|crawl|collect|monitor|tagging|taxonomy|classification|爆款|热门|低粉|粉丝|播放量|互动率|采集|抓取|收集|监控|标签|分类|作品|帖子|视频)/i;

export function sourceLanguageOf(value: string): SourceLanguage {
  const kana = (value.match(/[\u3040-\u30ff]/g) || []).length;
  const han = (value.match(/[\u3400-\u9fff]/g) || []).length;
  const latin = (value.match(/[A-Za-z]/g) || []).length;
  if (kana > 0) return "ja";
  if (han >= 2 && latin > han * 4) return "mixed";
  if (han >= 2) return "zh";
  return "en";
}

export function sourceLanguageLabel(language: SourceLanguage) {
  return ({ zh: "中文", en: "英语", ja: "日语", mixed: "多语言" })[language];
}

export function capabilityDefinitions() {
  return definitions;
}

function makeCapability(id: CapabilityId, priority: number, label?: string): ProjectCapability {
  const definition = definitions[id];
  return { id, label: label || definition.label, query: definition.query, priority };
}

function uniqueCapabilities(items: ProjectCapability[]) {
  const unique = new Map<CapabilityId, ProjectCapability>();
  for (const item of items) {
    const current = unique.get(item.id);
    if (!current || item.priority > current.priority) unique.set(item.id, item);
  }
  return Array.from(unique.values());
}

function detectedCapabilities(brief: string, priority = 4) {
  return (Object.values(definitions) as CapabilityDefinition[])
    .filter((definition) => definition.patterns.test(brief))
    .map((definition) => makeCapability(definition.id, priority));
}

function makePlan(
  kind: ProjectPlan["kind"],
  kindLabel: string,
  brief: string,
  capabilities: ProjectCapability[],
  searchTopics: string[],
): ProjectPlan {
  return {
    kind,
    kindLabel,
    userLanguage: sourceLanguageOf(brief),
    capabilities: uniqueCapabilities(capabilities),
    searchTopics: Array.from(new Set(searchTopics)).slice(0, 3),
  };
}

export function planProject(brief: string): ProjectPlan {
  if (socialSubjectPattern.test(brief) && socialResearchPattern.test(brief)) {
    return makePlan("social-content-research", "社交内容发现与爆款研究", brief, [
      makeCapability("creator-discovery", 6),
      makeCapability("content-collection", 6),
      makeCapability("performance-ranking", 6),
      makeCapability("taxonomy", 5),
      makeCapability("automation", 4, "自动扫描、去重与任务编排"),
      makeCapability("data", 3, "结果整理与导出"),
      makeCapability("security", 2, "平台权限、输入与来源检查"),
    ], [
      "social media creator influencer discovery niche follower engagement",
      "viral post video analytics views follower ratio outlier",
      "social media scraper content collection tagging export",
    ]);
  }

  if (skillLibraryPattern.test(brief)) {
    return makePlan("skill-library", "Skill 库与推荐产品", brief, [
      makeCapability("skill-intake", 6),
      makeCapability("skill-discovery", 6),
      makeCapability("persistence", 5, "Skill 元数据与存储"),
      makeCapability("skill-ui", 4, "Skill 库界面与可视化"),
      makeCapability("backend", 4),
      makeCapability("security", 3, "来源检查与安全审阅"),
      makeCapability("testing", 3),
      makeCapability("delivery", 2),
    ], [
      "agent skill library source parser metadata",
      "skill search retrieval recommendation database",
      "web application security testing deployment",
    ]);
  }

  if (instrumentPattern.test(brief)) {
    return makePlan("instrument-automation", "仪器自动化与数据采集", brief, [
      makeCapability("instrument", 6),
      makeCapability("automation", 6),
      makeCapability("data", 5),
      makeCapability("engineering", 4),
      makeCapability("testing", 4),
      makeCapability("delivery", 2),
      ...detectedCapabilities(brief),
    ], [
      "SCPI VISA GPIB laboratory instrument control",
      "data acquisition automation csv visualization",
      "desktop software testing packaging deployment",
    ]);
  }

  if (ecommercePattern.test(brief)) {
    return makePlan("web-app", "电商 Web 应用", brief, [
      makeCapability("commerce", 6),
      makeCapability("persistence", 5),
      makeCapability("backend", 5),
      makeCapability("skill-ui", 4),
      makeCapability("auth", 4),
      makeCapability("security", 4),
      makeCapability("testing", 3),
      makeCapability("delivery", 2),
      ...detectedCapabilities(brief),
    ], [
      "ecommerce catalog checkout payment orders",
      "web frontend backend database authentication",
      "commerce security testing deployment",
    ]);
  }

  if (contentSitePattern.test(brief)) {
    return makePlan("content-site", "内容与展示网站", brief, [
      makeCapability("visual", 5),
      makeCapability("skill-ui", 5),
      makeCapability("testing", 3),
      makeCapability("delivery", 3),
      ...detectedCapabilities(brief),
    ], [
      "website visual design frontend accessibility",
      "content site testing performance",
      "web deployment release",
    ]);
  }

  if (webAppPattern.test(brief)) {
    return makePlan("web-app", "Web 应用", brief, [
      makeCapability("backend", 5),
      makeCapability("persistence", 5),
      makeCapability("skill-ui", 4),
      makeCapability("auth", 4),
      makeCapability("security", 3),
      makeCapability("testing", 3),
      makeCapability("delivery", 2),
      ...detectedCapabilities(brief),
    ], [
      "web application frontend user experience",
      "backend api database authentication",
      "web security testing deployment",
    ]);
  }

  if (dataWorkflowPattern.test(brief)) {
    return makePlan("data-workflow", "数据处理与交付", brief, [
      makeCapability("data", 6),
      ...(definitions.document.patterns.test(brief) ? [makeCapability("document", 5)] : []),
      ...(definitions.visual.patterns.test(brief) ? [makeCapability("visual", 4)] : []),
      ...(definitions.automation.patterns.test(brief) ? [makeCapability("automation", 4)] : []),
      makeCapability("testing", 3),
      ...detectedCapabilities(brief),
    ], [
      "data analysis spreadsheet visualization",
      "document pdf report generation",
      "data workflow validation automation",
    ]);
  }

  if (communicationPattern.test(brief)) {
    return makePlan("communication-workflow", "沟通与跟进流程", brief, [
      makeCapability("communication", 6),
      makeCapability("automation", 4),
      makeCapability("document", 3),
      ...detectedCapabilities(brief),
    ], [
      "email outreach writing communication",
      "follow up workflow automation",
      "document templates contact tracking",
    ]);
  }

  const detected = detectedCapabilities(brief);
  const capabilities = uniqueCapabilities(detected.length
    ? [...detected, makeCapability("testing", 2)]
    : [makeCapability("engineering", 4), makeCapability("testing", 2)]);
  const searchTopics = capabilities
    .toSorted((first, second) => second.priority - first.priority)
    .slice(0, 3)
    .map((capability) => capability.query);
  while (searchTopics.length < 3) {
    searchTopics.push(searchTopics.length ? "agent skill workflow" : "agent skills");
  }
  return makePlan("general", "通用项目", brief, capabilities, searchTopics);
}

export function capabilityCoverage(
  value: string,
  plan: ProjectPlan,
): ProjectCapability[] {
  return plan.capabilities.filter((capability) =>
    definitions[capability.id].patterns.test(value),
  );
}
