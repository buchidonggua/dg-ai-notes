# 场景：指定工作目录 (A05)

## 什么时候用

让 Agent 在**指定目录**下工作，而不是 Node 进程的 `process.cwd()`。典型场景：

- **操作另一个项目**：脚本运行在 `/tools/`，但要让 Agent 读改 `/projects/my-app/` 的代码
- **Web 服务多租户**：每个请求一个 Agent，cwd 指向对应用户的项目目录
- **隔离的工作区**：临时让 Agent 在 `/tmp/scratch/` 操作，不污染主项目
- **测试 / 沙盒**：在临时目录复现 Agent 行为，避免改坏真实文件

**不适合本场景**：
- 想让 Agent 操作**全局配置**（`~/.pi/agent/` 下的 SYSTEM.md / auth.json / skills）→ 那是 `agentDir`，见 [sdk_doc/01-create-agent-session.md](../sdk_doc/01-create-agent-session.md)
- 想在运行时**动态切换 cwd**（对话中途换工作目录）→ 目前 SDK 无此能力，cwd 在 session 创建时一次定型，要换 cwd 只能重建 session

## 前置条件

1. **安装 SDK**：`npm install @earendil-works/pi-coding-agent@latest`
2. **确认目标目录存在**：SDK 不会创建目录，`bash` 工具执行时若 cwd 不存在会 throw `Working directory does not exist: <path>`（tools/bash.ts `fsAccess(cwd)` 检查后 throw）
3. **使用绝对路径**（推荐）：传相对路径会相对**当前 `process.cwd()`** 解析（`resolvePath` 默认 baseDir 是 `process.cwd()`，见 paths.ts），容易意外指错位置

## 涉及 SDK

| 能力 | 用途 | 详细文档 |
|------|------|---------|
| `createAgentSession` 的 `cwd` 选项 | 指定 Agent 的工作根目录（影响范围见下表） | [sdk_doc/01-create-agent-session.md](../sdk_doc/01-create-agent-session.md) |
| `SessionManager.inMemory(cwd)` / `SessionManager.create(cwd, ...)` | 会话管理器也持有 cwd，作为兜底来源 + 会话文件存储位置 | [sdk_doc/12-session-manager.md](../sdk_doc/12-session-manager.md) |

## cwd 影响哪些行为（★ 必读）

**这是本场景最容易踩坑的地方**。你以为 `cwd` 只是"工具执行目录"——不止。SDK 内部至少 **7 处**吃 cwd：

| 影响点 | 怎么用 cwd | 源码 |
|--------|-----------|------|
| **内置工具执行目录** | `bash` / `read` / `edit` / `write` 在此目录下读写和执行子进程 | tools/bash.ts（`spawn(…, { cwd })` 子进程在 cwd 执行） |
| **`.pi/` 配置目录发现** | 从 `<cwd>/.pi/` 读 SYSTEM.md / APPEND_SYSTEM.md / settings.json / skills / prompts / themes / extensions | resource-loader.ts（`DefaultResourceLoader` 用 `join(cwd, CONFIG_DIR_NAME, …)` 发现 skills/prompts/themes/extensions + SYSTEM.md / APPEND_SYSTEM.md） |
| **AGENTS.md / CLAUDE.md 向上递归查找** | 从 cwd 开始**逐级向上**找 AGENTS.md / CLAUDE.md，找到的全被注入 system prompt 的 `<project_context>` | resource-loader.ts（`loadProjectContextFiles` 从 cwd 逐级 `dirname` 向上，候选文件名见 `candidates`） |
| **扩展加载上下文** | `loadExtensionsCached(paths, cwd, ...)` 把 cwd 传给扩展运行时 | resource-loader.ts（`DefaultResourceLoader.loadCurrentExtensionSet` 调 `loadExtensionsCached(paths, this.cwd, …)`） |
| **会话文件存储目录** | 不显式传 sessionDir 时默认 `<agentDir>/sessions/<encoded-cwd>/`（编码方式：去掉前导路径分隔符，其余 `/`、`\`、`:` 替换为 `-`，两端加 `--`） | session-manager.ts（`getDefaultSessionDir` → `getDefaultSessionDirPath`） |
| **项目级 settings 路径** | `<cwd>/.pi/settings.json` 优先级高于全局 settings | settings-manager.ts（`FileSettingsStorage` 构造时 `projectSettingsPath = join(cwd, CONFIG_DIR_NAME, "settings.json")`） |
| **system prompt 的 `Current working directory` 字段** | LLM 每次调用都能看到这个目录（无法关闭，见 A03 的 prompt 组装） | system-prompt.ts（`buildSystemPrompt` 追加 `Current working directory: <cwd>`） |

**含义**：cwd 不只是"Agent 在哪执行命令"，而是**整个项目上下文的根**。改 cwd 等于换项目环境。

## 默认值与优先级（★ 易踩坑）

`createAgentSession` 的 cwd 按以下顺序回填（sdk.ts `createAgentSession` 内 `resolvePath(options.cwd ?? options.sessionManager?.getCwd() ?? process.cwd())`）：

```text
options.cwd  →  options.sessionManager?.getCwd()  →  process.cwd()
```

**关键点**：

- **传了 `cwd` 就忽略 `sessionManager.getCwd()`**——不是"两者一致才生效"。如果你给 sessionManager 传了 cwd A，又给 options 传了 cwd B，最终用 B，但 sessionManager 内部仍然记着 A（会话文件存在 A 对应的目录）。**这种不一致会导致会话恢复时找不到历史**。
- **想"让 sessionManager 决定 cwd"**：不要传 `options.cwd`，只传 `sessionManager`。
- **想"让 cwd 决定一切"**：传 `options.cwd`，并显式用相同路径初始化 sessionManager（下方示例）。

## 实现思路

1. 用**绝对路径**确定目标目录（避免相对 `process.cwd()` 的歧义）
2. 确保目录**存在且可读写**（SDK 不创建目录）
3. 调用 `createAgentSession({ cwd })`——SDK 会自动把 cwd 传给默认的 resourceLoader / sessionManager / settingsManager
4. 如果**自定义了任何子组件**（resourceLoader / sessionManager / settingsManager），必须**显式传相同的 cwd**给它们（下方陷阱）
5. 用 `try/finally` 包住 `session.dispose()`，和 A01 一致

## 核心代码

### 方式一：最简——只传 cwd（推荐）

让 SDK 自己创建默认的 resourceLoader / sessionManager / settingsManager（它们会自动吃 cwd）：

```ts
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const targetPath = "/absolute/path/to/project";

const { session } = await createAgentSession({
  cwd: targetPath,
});

try {
  await session.prompt("List files in the current directory.");
} finally {
  session.dispose();  // 必须释放：清理监听器、中止重试/压缩任务
}
```

### 方式二：cwd + 内存会话（不持久化）

如果你不想把会话写进磁盘（测试、Web 服务多租户场景），用 `SessionManager.inMemory(cwd)` **显式传相同 cwd**：

```ts
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const targetPath = "/absolute/path/to/project";

const { session } = await createAgentSession({
  cwd: targetPath,
  sessionManager: SessionManager.inMemory(targetPath),  // ★ 必须显式传相同 cwd
});

try {
  await session.prompt("Hello!");
} finally {
  session.dispose();
}
```

> **陷阱：`SessionManager.inMemory()` 不传 cwd 会默认 `process.cwd()`**（session-manager.ts `static inMemory(cwd: string = process.cwd(), …)`），与 `createAgentSession({ cwd })` **不同步**。虽然此时 options.cwd 优先级最高会覆盖回填，但 sessionManager 内部状态（如 `getCwd()`、会话头里的 cwd 字段）仍是 `process.cwd()`，下游依赖 sessionManager 的逻辑（如扩展读取 `context.sessionManager.getCwd()`）会拿到错的目录。**养成总是显式传 cwd 的习惯**。

### 方式三：完全自定义（cwd 一致性是用户责任）

一旦你**自己 new 了任何组件**（DefaultResourceLoader / SessionManager.create / SettingsManager.create），**SDK 不会替你把 cwd 回填进去**——你必须手动传。下面是 A03「自定义 ResourceLoader」+ A05「换 cwd」的完整组合：

```ts
import {
  getAgentDir,
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const targetPath = "/absolute/path/to/project";
const agentDir = getAgentDir();

// ★ 每一个组件都显式传相同的 cwd
const settingsManager = SettingsManager.create(targetPath, agentDir);
const sessionManager = SessionManager.inMemory(targetPath);
const loader = new DefaultResourceLoader({
  cwd: targetPath,
  agentDir,
  settingsManager,
  // ...其他 override
});
await loader.reload();

const { session } = await createAgentSession({
  cwd: targetPath,                  // ★ options.cwd 也要传（优先级最高）
  resourceLoader: loader,
  sessionManager,
  settingsManager,
});

try {
  await session.prompt("Refactor the entry file.");
} finally {
  session.dispose();
}
```

**源码**：用户传 `resourceLoader` 时 sdk.ts 不会回填 cwd，传 sessionManager / settingsManager 时同理。一致性完全由调用者负责。

## 变体与延伸

- 同时加载目标项目的 `.pi/` 配置（扩展、skills、prompts） → 见 [场景 A06](A06-load-extensions.md)。**注意**：只要 cwd 正确，`.pi/` 自动被发现，无需额外参数
- 多项目切换管理（不同 session 不同 cwd） → 见 [sdk_doc/12-session-manager.md](../sdk_doc/12-session-manager.md)
- 项目级 Settings（`.pi/settings.json`） → 见 [场景 B02](B02-settings.md)
- cwd 也决定 AGENTS.md / CLAUDE.md 的查找（向上递归） → 见 [场景 C03](C03-context-files.md)
- 自定义 ResourceLoader 与 cwd 协作 → 见 [场景 A03](A03-system-prompt.md)
