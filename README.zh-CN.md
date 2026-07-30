# Bitcase

Bitcase 帮用户判断一个项目到底该使用哪些 Agent Skills。

它只保留三个核心功能：

1. Skill 可视化：看到用途、来源和已有证据。
2. 项目匹配：根据需求匹配本地与互联网来源的 Skills。
3. 最小 Stack：组合职责不重复、理由清楚的最小 Skill Stack。

## 使用流程

在首页写下项目需求。Bitcase 会：

1. 把需求拆成不同项目职责；
2. 查询当前已激活、可回滚的 Bitcase 索引快照；
3. 将快照证据与浏览器 Skill 库中已保存的 Skills 一起匹配；
4. 返回仓库、固定 Commit 的文件、内容 Hash、检查时间、License 与风险信号；
5. 以项目职责覆盖为准，生成最小 Stack。

skills.sh 和 GitHub 只由后台索引任务访问。用户搜索不会等待实时上游。
索引 API 暂时不可用时，浏览器可以回退到相同查询最近七天内的成功结果，
并明确提示数据可能不是最新。

## 覆盖优先的匹配

Bitcase 不会把五个同类 Skill 塞进结果。它会先识别项目需要覆盖的职责，再只选择能够补齐未覆盖职责的来源。

例如“储存和管理 Skill 的网站”会检查：来源导入与 `SKILL.md` 解析、Skill 检索与推荐、元数据存储、界面可视化、质量验证等，而不是只找前端 Skill。若某项职责没有真实、可追溯的来源，结果会明确标成缺口，绝不会用不相关的 Skill 充数。

用户保存过且已读取的本机 Skill 库会和活动快照一起参与匹配。来源可能是英文或日文，但 Bitcase 会用中文显示职责、匹配理由和能力概览，同时保留原文语言标识与精确 `SKILL.md` 供用户回查。

网站没有强制向导、账号页、订阅、商业模块、分析面板、共享模型额度或用户 API Key 设置。

## 来源状态

| 状态 | 含义 |
| --- | --- |
| 目录条目 | 仅来自目录引用，Bitcase 尚未读取来源内容。 |
| 本地导入 | 用户在当前浏览器中主动选择的文件。 |
| 来源已读取 | Bitcase 已读取真实 `SKILL.md`，并记录哈希与路径。 |

静态检查只提供风险信号，不是安全认证。需要人工判断的来源会被明确标记。

## 本地运行

```bash
npm run install:ci
npm run dev
```

可选环境变量：

```text
BITCASE_INDEX_API_URL
```

它指向独立部署的 Bitcase 索引 Worker。`GITHUB_SKILL_TOKEN` 仅用于用户
主动输入精确来源链接后的可视化读取。不要把用户 API Key 放进 Bitcase。

独立 Worker、D1/R2、Cron 和生产部署步骤见
[docs/INDEX_WORKER.md](docs/INDEX_WORKER.md)。

## 验证修改

```bash
npm run lint
npm test
```

## 许可证

AGPL-3.0-only，详见 [LICENSE](LICENSE)。
