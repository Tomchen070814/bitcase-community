"use client";

import {
  ArrowSquareOut,
  CheckCircle,
  Copy,
  DownloadSimple,
  FolderSimple,
  MagnifyingGlass,
  ShieldWarning,
  X,
} from "@phosphor-icons/react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  readSearchCache,
  searchCacheKey,
  writeSearchCache,
} from "./lib/search-cache";

type ResultSkill = {
  id: string;
  name: string;
  description: string;
  originalDescription: string;
  responsibility: string;
  matchReason: string;
  capabilities: string[];
  sourceLanguage: "zh" | "en" | "ja" | "mixed";
  source: string;
  sourceUrl: string;
  skillUrl: string;
  skillPath: string;
  contentHash: string;
  checkedAt: string;
  risk: "clear" | "review";
  discovery?: {
    source: "skills.sh" | "github" | "library";
    installs?: number;
  };
};

type ComposeResult = {
  project: string;
  plan: {
    kindLabel: string;
    responsibilities: string[];
  };
  skills: ResultSkill[];
  coverage: { covered: string[]; missing: string[] };
  search?: {
    strategy: string;
    catalogCandidates: number;
    githubFallbackUsed: boolean;
    indexVersion?: string;
    rankerVersion?: string;
    builtAt?: string;
  };
};

const LIBRARY_STORAGE_KEY = "bitcase.skill-library.v2";
const PROJECT_EXAMPLES = [
  "做一个能检索、收藏和组合 Skills 的网站",
  "开发多台实验室仪器自动采集并导出 CSV 的 Windows 程序",
  "分析 CSV 数据并生成带图表的 PDF 报告",
];

function languageLabel(language: ResultSkill["sourceLanguage"]) {
  return ({ zh: "中文", en: "英语", ja: "日语", mixed: "多语言" })[language];
}

function readLibrary() {
  try {
    const stored = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is ResultSkill =>
      item && typeof item.id === "string" && typeof item.name === "string" && typeof item.skillUrl === "string",
    ) : [];
  } catch {
    return [];
  }
}

function libraryForMatching(library: ResultSkill[]) {
  return library.slice(0, 24).map((skill) => ({
    ...skill,
    description: skill.description.slice(0, 700),
    originalDescription: skill.originalDescription.slice(0, 900),
    capabilities: skill.capabilities.slice(0, 6),
  }));
}

function libraryFingerprint(library: ResultSkill[]) {
  return library
    .map((skill) => `${skill.id}:${skill.contentHash}`)
    .sort()
    .join("|");
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toHandoff(result: ComposeResult) {
  return [
    "# Bitcase minimal Skill Stack",
    "",
    `Project: ${result.project}`,
    "",
    "Use these Skills in this order:",
    ...result.skills.map(
      (skill, index) =>
        `${index + 1}. ${skill.name}\n   Responsibility: ${skill.responsibility}\n   Description: ${skill.description}\n   Source: ${skill.skillUrl}`,
    ),
  ].join("\n");
}

export default function BitcaseApp() {
  const [brief, setBrief] = useState("");
  const [result, setResult] = useState<ComposeResult | null>(null);
  const [view, setView] = useState<"match" | "library">("match");
  const [library, setLibrary] = useState<ResultSkill[]>([]);
  const [libraryReady, setLibraryReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [detailSkill, setDetailSkill] = useState<ResultSkill | null>(null);
  const [resultFreshness, setResultFreshness] = useState<"live" | "cached" | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setLibrary(readLibrary());
      setLibraryReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!libraryReady) return;
    window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));
  }, [library, libraryReady]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const project = brief.trim();
    if (project.length < 6) {
      setError("请用一句话写清楚你要完成的项目。");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    setResultFreshness(null);
    const matchingLibrary = libraryForMatching(library);
    const cacheKey = searchCacheKey(project, libraryFingerprint(matchingLibrary));
    try {
      const response = await fetch("/api/compose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief: project, library: matchingLibrary }),
      });
      const payload = (await response.json()) as ComposeResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "compose_unavailable");
      const liveResult: ComposeResult = {
        project: payload.project,
        plan: payload.plan || { kindLabel: "项目", responsibilities: [] },
        skills: payload.skills || [],
        coverage: payload.coverage || { covered: [], missing: [] },
        search: payload.search,
      };
      setResult(liveResult);
      setResultFreshness("live");
      void writeSearchCache(cacheKey, liveResult).catch(() => undefined);
    } catch (caught) {
      const cached = await readSearchCache<ComposeResult>(cacheKey).catch(() => null);
      if (cached) {
        setResult(cached.value);
        setResultFreshness("cached");
      } else {
        const code = caught instanceof Error ? caught.message : "compose_unavailable";
        setError(
          code === "index_not_ready"
            ? "索引正在准备，暂时没有可用快照。"
            : "暂时无法读取活动索引，且这台设备没有最近七天的可用结果。",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setView("match");
    setResult(null);
    setResultFreshness(null);
    setError("");
    setNotice("");
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>("#project-brief")?.focus();
    });
  }

  function openLibrary() {
    setView("library");
    setResult(null);
    setResultFreshness(null);
    setError("");
    setNotice("");
  }

  function saveToLibrary() {
    if (!result?.skills.length) return;
    setLibrary((current) => {
      const merged = new Map(current.map((skill) => [skill.id, skill]));
      result.skills.forEach((skill) => merged.set(skill.id, skill));
      return Array.from(merged.values()).sort((first, second) =>
        second.checkedAt.localeCompare(first.checkedAt),
      );
    });
    setNotice("已保存到这台设备的 Skill 库。来源证据会一并保留。");
  }

  function removeFromLibrary(id: string) {
    setLibrary((current) => current.filter((skill) => skill.id !== id));
    setNotice("已从这台设备的 Skill 库移除。");
  }

  async function importToLibrary(sourceUrl: string) {
    const response = await fetch("/api/skills/visualize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: sourceUrl }),
    });
    const payload = (await response.json()) as { skill?: ResultSkill; error?: string };
    if (!response.ok || !payload.skill) {
      const messages: Record<string, string> = {
        invalid_skills_url: "请输入精确的 skills.sh 页面或 GitHub SKILL.md 文件链接。",
        skill_not_found: "这个来源中没有找到对应的 SKILL.md。",
        skill_not_visualizable: "已经读取来源，但暂时无法识别它的职责。",
        rate_limited: "GitHub 暂时限制了读取频率，请稍后再试。",
        private_or_unavailable: "这个来源不可公开读取，或仓库不存在。",
        skill_too_large: "这个 SKILL.md 过大，Bitcase 没有在未完整读取时保存它。",
        skills_network_unavailable: "来源网络暂时不可用，请稍后重试。",
        source_unavailable: "来源网络暂时不可用，请稍后重试。",
      };
      throw new Error(messages[payload.error || ""] || "暂时无法读取这个 Skill 来源。");
    }
    setLibrary((current) => {
      const merged = new Map(current.map((skill) => [skill.id, skill]));
      merged.set(payload.skill!.id, payload.skill!);
      return Array.from(merged.values()).sort((first, second) =>
        second.checkedAt.localeCompare(first.checkedAt),
      );
    });
    setDetailSkill(payload.skill);
    setNotice("已读取并保存这个 Skill。你可以查看中文用途和原始来源。");
  }

  function copyStack() {
    if (!result) return;
    void navigator.clipboard.writeText(toHandoff(result));
    setNotice("已复制，可以直接交给 Codex 使用。");
  }

  function exportStack() {
    if (!result) return;
    downloadFile(
      "bitcase-skill-stack.json",
      JSON.stringify(
        {
          product: "Bitcase",
          project: result.project,
          skills: result.skills,
          exportedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "application/json",
    );
  }

  return (
    <main className="bitcase-shell">
      <header className="site-header result-header">
        <button className="wordmark" onClick={reset} aria-label="回到 Bitcase 首页">
          <span aria-hidden="true">Ω</span> BITCASE
        </button>
        <div className="header-actions">
          {view === "library" ? (
            <button className="quiet-action" onClick={reset}>返回匹配</button>
          ) : (
            <button className="quiet-action" onClick={openLibrary}>
              <FolderSimple size={17} /> Skill 库{libraryReady ? ` · ${library.length}` : ""}
            </button>
          )}
          {(result || loading) && view === "match" && (
            <button className="quiet-action" onClick={reset}>新建匹配</button>
          )}
        </div>
      </header>

      {view === "library" ? (
        <SkillLibrary
          skills={library}
          onOpen={setDetailSkill}
          onRemove={removeFromLibrary}
          onImport={importToLibrary}
          onStartMatch={reset}
        />
      ) : !result && !loading && (
        <section className="hero" aria-labelledby="hero-title">
          <div className="omega-field" aria-hidden="true">Ω</div>
          <div className="hero-content">
            <h1 id="hero-title">描述项目，配齐 Skills</h1>
            <p>先拆解项目职责，再从真实来源中组成最小 Skill Stack。</p>
            <form className="project-form" onSubmit={submit}>
              <label htmlFor="project-brief">你想完成什么？</label>
              <div className="project-input-wrap">
                <textarea
                  id="project-brief"
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                  placeholder="例如：为多台实验室仪器做一个 Windows 自动化采集与数据分析程序"
                  rows={3}
                  autoFocus
                />
                <button className="primary-action" type="submit">
                  <MagnifyingGlass size={19} /> 生成我的 Skill Stack
                </button>
              </div>
              {error && <p className="field-error hero-error">{error}</p>}
              <div className="project-examples" aria-label="需求示例">
                {PROJECT_EXAMPLES.map((example) => (
                  <button key={example} type="button" onClick={() => setBrief(example)}>
                    {example}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </section>
      )}

      {view === "match" && loading && (
        <section className="result-loading" aria-live="polite" aria-busy="true">
          <div className="omega-loading" aria-hidden="true">Ω</div>
          <h1>正在准备你的结果</h1>
          <p>Bitcase 会直接返回可用的最小 Skill Stack。</p>
          <div className="result-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      )}

      {view === "match" && result && (
        <section className="result-section" aria-labelledby="result-title">
          <header className="result-intro">
            <span className="result-kicker">为你的项目准备</span>
            <h1 id="result-title">你的最小 Skill Stack</h1>
            <p>{result.project}</p>
          </header>

          <section className="coverage-summary" aria-label="本次 Stack 覆盖范围">
            <strong>Bitcase 将它识别为「{result.plan.kindLabel}」</strong>
            <p className="plan-note">计划覆盖：{result.plan.responsibilities.join("、") || "根据项目描述识别的必要职责"}</p>
            <p className="search-path">
              搜索路径：Bitcase 活动快照
              {result.search?.indexVersion ? ` · ${result.search.indexVersion}` : ""}
              {result.search?.builtAt ? ` · 构建于 ${dateLabel(result.search.builtAt)}` : ""}
            </p>
            {resultFreshness === "cached" && (
              <p className="snapshot-warning">
                当前索引服务不可用，正在显示这台设备最近七天内的成功结果；数据可能不是最新。
              </p>
            )}
            <div>
              {result.coverage.covered.map((item) => <span key={item}>{item}</span>)}
            </div>
            {result.coverage.missing.length > 0 && (
              <p>尚未找到可追溯来源来覆盖：{result.coverage.missing.join("、")}。Bitcase 不会用不相关的 Skill 填满结果。</p>
            )}
          </section>

          {result.skills.length ? (
            <>
              <ol className="result-stack">
                {result.skills.map((skill, index) => (
                  <li key={skill.id} className="result-skill">
                    <button
                      className="result-skill-main"
                      onClick={() => setDetailSkill(skill)}
                      aria-label={`查看 ${skill.name} 的详情`}
                    >
                      <span className="result-index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="result-skill-copy">
                        <strong>{skill.responsibility}</strong>
                        <span className="result-original-name">{skill.name}</span>
                        <span>{skill.description}</span>
                        <span className="result-match-reason">{skill.matchReason}</span>
                        {skill.capabilities.length > 0 && (
                          <span className="result-capabilities">
                            {skill.capabilities.slice(0, 3).map((capability) => (
                              <em key={capability}>{capability}</em>
                            ))}
                          </span>
                        )}
                      </span>
                      <span className="result-source">
                        <CheckCircle size={16} />
                        {skill.discovery?.source === "skills.sh"
                          ? "skills.sh 快照 · "
                          : skill.discovery?.source === "library"
                            ? "本机 Skill 库 · "
                            : "GitHub 快照 · "}
                        来源已读取 · 原文{languageLabel(skill.sourceLanguage)}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <div className="result-actions">
                <button className="primary-inline" onClick={copyStack}>
                  <Copy size={18} /> 复制给 Codex
                </button>
                <button className="quiet-action" onClick={saveToLibrary}>
                  <FolderSimple size={18} /> 保存至 Skill 库
                </button>
                <button className="quiet-action" onClick={exportStack}>
                  <DownloadSimple size={18} /> 导出 JSON
                </button>
              </div>
            </>
          ) : (
            <div className="empty-result">
              <h2>这次没有找到可交付的 Skill</h2>
              <p>换一种更具体的项目描述后再试一次。</p>
              <button className="primary-inline" onClick={reset}>重新描述需求</button>
            </div>
          )}
        </section>
      )}

      {error && result && (
        <div className="notice error-notice" role="alert">
          <ShieldWarning size={18} />
          <span>{error}</span>
          <button aria-label="关闭提示" onClick={() => setError("")}><X size={16} /></button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          <CheckCircle size={18} />
          <span>{notice}</span>
          <button aria-label="关闭提示" onClick={() => setNotice("")}><X size={16} /></button>
        </div>
      )}
      {detailSkill && (
        <SkillResultModal skill={detailSkill} onClose={() => setDetailSkill(null)} />
      )}
    </main>
  );
}

function SkillLibrary({
  skills,
  onOpen,
  onRemove,
  onImport,
  onStartMatch,
}: {
  skills: ResultSkill[];
  onOpen: (skill: ResultSkill) => void;
  onRemove: (id: string) => void;
  onImport: (sourceUrl: string) => Promise<void>;
  onStartMatch: () => void;
}) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<"all" | ResultSkill["sourceLanguage"]>("all");
  const [sourceUrl, setSourceUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const visibleSkills = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return skills.filter((skill) => {
      if (language !== "all" && skill.sourceLanguage !== language) return false;
      if (!normalized) return true;
      return [
      skill.name,
      skill.description,
      skill.responsibility,
      skill.capabilities.join(" "),
      skill.source,
      ].join(" ").toLocaleLowerCase().includes(normalized);
    });
  }, [language, query, skills]);

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = sourceUrl.trim();
    if (!value) {
      setImportError("请粘贴一个 Skill 来源链接。");
      return;
    }
    setImporting(true);
    setImportError("");
    try {
      await onImport(value);
      setSourceUrl("");
    } catch (caught) {
      setImportError(caught instanceof Error ? caught.message : "暂时无法读取这个 Skill。");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="library-section" aria-labelledby="library-title">
      <header className="library-intro">
        <span className="result-kicker">这台设备上的已读取来源</span>
        <h1 id="library-title">我的 Skill 库</h1>
        <p>查看已保存的 Skill，或粘贴来源链接，让 Bitcase 读取并用中文解释它。</p>
      </header>

      <form className="library-import" onSubmit={submitImport}>
        <label htmlFor="skill-source-url">查看一个 Skill</label>
        <p>支持精确的 skills.sh 页面或 GitHub <code>SKILL.md</code> 文件链接。</p>
        <div>
          <input
            id="skill-source-url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://skills.sh/owner/repository/skill-name"
            inputMode="url"
          />
          <button className="primary-inline" type="submit" disabled={importing}>
            {importing ? "正在读取" : "读取并可视化"}
          </button>
        </div>
        {importError && <p className="field-error">{importError}</p>}
      </form>

      {skills.length > 0 ? (
        <>
          <div className="library-toolbar">
            <label className="library-search">
              <MagnifyingGlass size={18} />
              <span className="visually-hidden">搜索已保存的 Skill</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索职责、能力、来源或 Skill 名称"
              />
            </label>
            <label className="language-filter">
              <span>原文语言</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}>
                <option value="all">全部</option>
                <option value="zh">中文</option>
                <option value="en">英语</option>
                <option value="ja">日语</option>
                <option value="mixed">多语言</option>
              </select>
            </label>
          </div>
          <div className="library-grid">
            {visibleSkills.map((skill) => (
              <article className="library-card" key={skill.id}>
                <button className="library-card-main" onClick={() => onOpen(skill)}>
                  <span className="library-card-top">
                    <span className="evidence-badge read">来源已读取</span>
                    <span className="language-badge">原文{languageLabel(skill.sourceLanguage)}</span>
                  </span>
                  <strong>{skill.responsibility}</strong>
                  <span className="library-original-name">{skill.name}</span>
                  <span className="library-card-copy">{skill.description}</span>
                  <span className="library-tags">
                    {skill.capabilities.slice(0, 3).map((capability) => <em key={capability}>{capability}</em>)}
                  </span>
                  <span className="library-source">{skill.source}</span>
                </button>
                <footer>
                  <span>{dateLabel(skill.checkedAt)} 读取</span>
                  <button className="text-action library-remove" onClick={() => onRemove(skill.id)}>移除</button>
                </footer>
              </article>
            ))}
          </div>
          {!visibleSkills.length && (
            <div className="empty-result compact-empty">
              <h2>没有匹配的已保存 Skill</h2>
              <p>试试更短的职责或来源名称。</p>
            </div>
          )}
        </>
      ) : (
        <div className="empty-result">
          <FolderSimple size={34} aria-hidden="true" />
          <h2>你的 Skill 库还没有内容</h2>
          <p>完成一次项目匹配后，把已读取的结果保存到这里，方便以后比较和复用。</p>
          <button className="primary-inline" onClick={onStartMatch}>开始项目匹配</button>
        </div>
      )}
    </section>
  );
}

function SkillResultModal({
  skill,
  onClose,
}: {
  skill: ResultSkill;
  onClose: () => void;
}) {
  return (
    <Modal title={skill.name} onClose={onClose}>
      <div className="detail-head">
        <span className="evidence-badge read">来源已读取</span>
        <span className="layer-label">{skill.responsibility}</span>
      </div>
      <p className="detail-description">{skill.description}</p>
      <p className="detail-origin">来源原文语言：{languageLabel(skill.sourceLanguage)}</p>
      {skill.capabilities.length > 0 && (
        <div className="detail-capabilities">
          {skill.capabilities.map((capability) => <span key={capability}>{capability}</span>)}
        </div>
      )}
      <section className="source-original">
        <h3>来源原文说明</h3>
        <p>{skill.originalDescription}</p>
      </section>
      <dl className="evidence-list">
        <div>
          <dt>来源</dt>
          <dd>
            <a href={skill.sourceUrl} target="_blank" rel="noreferrer">
              {skill.source} <ArrowSquareOut size={14} />
            </a>
          </dd>
        </div>
        <div>
          <dt>精确文件</dt>
          <dd>
            <a href={skill.skillUrl} target="_blank" rel="noreferrer">
              打开 SKILL.md <ArrowSquareOut size={14} />
            </a>
          </dd>
        </div>
        <div><dt>路径</dt><dd><code>{skill.skillPath}</code></dd></div>
        <div><dt>内容哈希</dt><dd><code>{skill.contentHash}</code></dd></div>
        <div>
          <dt>发现渠道</dt>
          <dd>
            {skill.discovery?.source === "skills.sh"
              ? `skills.sh 搜索${skill.discovery.installs ? ` · ${skill.discovery.installs.toLocaleString("zh-CN")} 次安装` : ""}`
              : skill.discovery?.source === "library"
                ? "本机 Skill 库"
                : "GitHub 缺口检索"}
          </dd>
        </div>
        <div><dt>最后读取</dt><dd>{dateLabel(skill.checkedAt)}</dd></div>
      </dl>
      {skill.risk === "review" && (
        <p className="inline-warning">
          <ShieldWarning size={17} /> 此 Skill 含需要人工复核的静态信号。
        </p>
      )}
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="icon-action" aria-label="关闭" onClick={onClose} autoFocus>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
