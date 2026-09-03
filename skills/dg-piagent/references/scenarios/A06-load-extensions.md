# 场景：加载扩展 (A06)

## 什么时候用

让自定义工具、钩子、命令在 Agent 会话中**生效**。典型场景：

- **给 Agent 加自定义工具**：扩展里 `pi.registerTool(...)` 注册 LLM 可调用的工具
- **挂全局钩子**：扩展里 `pi.on("agent_start", ...)` 在每轮对话前注入上下文、记录日志
- **加载团队共享扩展**：从其他目录、npm 包、git 仓库拉入扩展文件
- **内联扩展（不需要文件）**：在代码里直接写扩展函数，省去独立 .ts 文件

**不适合本场景**：
- 想让扩展**持久分发**给团队成员（打包为 Pi Package 用 `pi install` 安装） → 见 [场景 I02](I02-distribute-extension.md)
- 想加载 **skills / prompts / themes**（不是扩展） → 见 [场景 C01](C01-custom-skill.md) / [场景 C02](C02-prompt-templates.md)
- 想自定义**系统提示词** → 见 [场景 A03](A03-system-prompt.md)

## 前置条件

1. **安装 SDK**：`npm install @earendil-works/pi-coding-agent@latest`
2. **扩展文件语法**：独立 `.ts` / `.js` 文件必须 `export default` 一个 `ExtensionFactory`：
   ```ts
   // my-extension.ts
   export default (pi) => {
     pi.on("agent_start", (event, ctx) => {
       ctx.ui.notify("扩展已加载");
     });
   };
   ```
3. **目标目录存在**：如果通过 cwd 加载项目级 `.pi/extensions/`，cwd 必须存在（见 [A05](A05-custom-cwd.md)）
4. **项目受信（仅 `.pi/extensions/` 场景）**：未受信项目的 `.pi/extensions/` **不会被加载**——见下方「方式一」说明

## 三种加载方式（★ 先看这个）

| 方式 | 什么时候用 | 扩展来源 | 是否需要文件 |
|------|-----------|---------|-------------|
| **方式一：自动发现 `.pi/extensions/`** | 扩展属于**当前项目**，放在项目的 `.pi/extensions/` 目录里 | `<cwd>/.pi/extensions/*.ts` | 是 |
| **方式二：`additionalExtensionPaths`** | 扩展在**其他位置**（外部目录 / npm 包 / git 仓库） | 本地路径 / `npm:包名` / git URL | 是 |
| **方式三：`extensionFactories`** | 扩展逻辑**短小内联**，不值得开独立文件 | 代码里的工厂函数 | 否 |

三种方式可以**组合使用**——DefaultResourceLoader 会合并所有来源。

## 涉及 SDK

| 能力 | 用途 | 详细文档 |
|------|------|---------|
| `createAgentSession` 默认行为 | 项目受信时自动发现 `<cwd>/.pi/extensions/` | [sdk_doc/01-create-agent-session.md](../sdk_doc/01-create-agent-session.md) |
| `DefaultResourceLoader` 的 `additionalExtensionPaths` | 加载指定路径/包源的扩展 | [sdk_doc/08-resource-loader.md](../sdk_doc/08-resource-loader.md) |
| `DefaultResourceLoader` 的 `extensionFactories` | 以代码方式注册内联扩展工厂 | [sdk_doc/08-resource-loader.md](../sdk_doc/08-resource-loader.md) |
| `DefaultResourceLoader` 的 `noExtensions` / `extensionsOverride` | 禁用 / 全替换扩展加载结果 | [sdk_doc/08-resource-loader.md](../sdk_doc/08-resource-loader.md) |
| `SessionManager` | 与 ResourceLoader 搭配使用（cwd 必须一致） | [sdk_doc/12-session-manager.md](../sdk_doc/12-session-manager.md) |

## 核心代码

### 方式一：依赖 `.pi/extensions/` 自动发现（推荐）

**这是最简单的扩展加载方式**。只要扩展文件放在 `<cwd>/.pi/extensions/` 目录下，SDK 会自动发现并加载——**不需要任何额外参数**。

```bash
my-project/
├── .pi/
│   └── extensions/
│       └── my-tool.ts       # ← 放这里就自动加载
└── ...
```

```ts
import { createAgentSession } from "@earendil-works/pi-coding-agent";

// ★ 不需要 additionalExtensionPaths，不需要手动构造 ResourceLoader
const { session } = await createAgentSession({
  // cwd 默认 process.cwd()，.pi/extensions/ 会从 <cwd>/.pi/extensions/ 找
});

try {
  await session.prompt("Use my_tool to do something.");
} finally {
  session.dispose();
}
```

> **★ 信任门槛（重要陷阱）**：`.pi/extensions/` 的扩展只在**项目受信**后加载。**交互模式**（CLI/TUI）首次打开项目时会询问"是否信任此目录"；**纯 SDK 调用不会弹询问**——直接取决于 `SettingsManager.isProjectTrusted()` 的当前值（见下方说明）。无论哪种模式，未受信状态下 `.pi/extensions/` 的扩展都**静默跳过**——不会报错，只是不生效。这是出于安全考虑：避免克隆的恶意仓库自动执行扩展代码。源码：package-manager.ts（`if (projectTrusted)` 分支内才 `collectAutoExtensionEntries`）。
>
> 自定义信任策略见 [场景 B04](B04-project-trust.md)。

#### 方式一补充：SDK 直调下的信任状态与 `.pi/extensions/` 加载

`createAgentSession()` 默认路径（不传 `resourceLoader`）内部会 `new DefaultResourceLoader(...) + reload()`（sdk.ts），但**不传 `resolveProjectTrust` 回调**，因此两阶段信任加载（pre-trust bootstrap）不会触发。此时 `.pi/extensions/` 是否加载完全取决于 `SettingsManager` 的信任状态：

- **用 SDK 默认 `SettingsManager`**（不传 `settingsManager`）：`SettingsManager.create(cwd, agentDir)` 默认 `projectTrusted = true`（settings-manager.ts 的 `fromStorage` 默认 `options.projectTrusted ?? true`），因此 SDK 直调下 `.pi/extensions/` **会加载**（注意：这与 CLI 首次启动默认未受信不同）。
- **自行构造 `SettingsManager` 或传入既有实例**：若你用 `SettingsManager.fromStorage(storage, { projectTrusted: false })`、或实例被 `setProjectTrusted(false)` 过，则 `.pi/extensions/` 会被跳过——这是 SDK 场景"扩展不生效"的常见原因。

需要显式控制信任时，两种受控加载方式：

```ts
import { createAgentSession, DefaultResourceLoader, SettingsManager } from "@earendil-works/pi-coding-agent";

const cwd = process.cwd();
const settingsManager = SettingsManager.create(cwd, agentDir);

// 方式 A：直接置信任后再 reload（最简单）
settingsManager.setProjectTrusted(true);
const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager });
await loader.reload();

// 方式 B：用 resolveProjectTrust 回调两阶段加载（推荐用于需要根据 bootstrap 扩展裁决信任的场景）
const loader2 = new DefaultResourceLoader({ cwd, agentDir, settingsManager });
await loader2.reload({
  resolveProjectTrust: async ({ extensionsResult }) => {
    // extensionsResult 是 pre-trust 阶段（强制 untrusted）加载的扩展结果
    // 返回 true 即受信，随后会重新 reload 正式加载项目级 .pi/extensions/
    return true;
  },
});

const { session } = await createAgentSession({ cwd, resourceLoader: loader2, settingsManager });
```

> `reload({ resolveProjectTrust })` 的两阶段机制：第一阶段先 `setProjectTrusted(false)` 加载一份扩展结果交给你裁决（`loadProjectTrustExtensions`），第二阶段按你的裁决重新 `settingsManager.reload()` + 正式加载（resource-loader.ts）。这是"让 `.pi/extensions/` 在 SDK 场景受控加载"的官方机制。

### 方式二：用 `additionalExtensionPaths` 加载外部扩展

适用于扩展在 `.pi/extensions/` **之外**的场景。这个参数接受三种**包源标识**（不只是文件路径）：

| 源类型 | 示例 | 说明 |
|--------|------|------|
| 本地文件路径 | `"/path/to/my-extension.ts"` | 单个 .ts / .js 文件 |
| 本地目录路径 | `"/path/to/my-extensions/"` | 目录下所有扩展文件都会被收集 |
| npm 源 | `"npm:my-pi-extension@^1.0"` | 自动安装并加载（需要网络） |
| git 源 | `"git:github:user/repo"` 或完整 git URL | 自动 clone 并加载 |

源码：package-manager.ts（`parseSource` 按 `npm:` 前缀 / 本地路径检测 / git URL 解析顺序分流）。

> **★ git 源必须以 `git:` 前缀或 `https?/ssh/git://` 协议开头**：`parseGitUrl`（utils/git.ts）对**没有** `git:` 前缀的字符串只接受 `https?://` / `ssh://` / `git://` 开头的完整 URL；裸简写（如 `"github:user/repo"`）既不匹配协议、又会被 `isLocalPath` 判为本地路径，最终回退成 `{ type: "local" }` 按本地文件解析——失败且无 git clone。正确写法二选一：`"git:github:user/repo"`（`git:` 前缀剥离后走简写解析）或 `"https://github.com/user/repo.git"`。

```ts
import {
  getAgentDir,
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const cwd = process.cwd();
const agentDir = getAgentDir();

const loader = new DefaultResourceLoader({
  cwd,                       // ★ 必填，扩展加载上下文以此为基准
  agentDir,
  additionalExtensionPaths: [
    "/absolute/path/to/my-extension.ts",   // 本地文件
    "/absolute/path/to/extensions-dir/",   // 本地目录（整个目录的扩展都会加载）
    // "npm:my-shared-toolkit@^1.0",        // npm 包（需网络）
    // "git:github:my-org/pi-extensions",    // git 仓库（需网络 + git；注意 git: 前缀不可省）
  ],
});
await loader.reload();       // ★ 必须调用 reload 才会真正加载

const { session } = await createAgentSession({
  cwd,                        // ★ 必须与 ResourceLoader 的 cwd 一致
  resourceLoader: loader,
  sessionManager: SessionManager.inMemory(cwd),  // ★ 也必须显式传相同 cwd
});

try {
  await session.prompt("Run my_tool.");
} finally {
  session.dispose();
}
```

> **★ 自定义 ResourceLoader 时 cwd 一致性是用户责任**：sdk.ts 在用户传 `resourceLoader` 时**不会**把 `options.cwd` 注入到 loader（sdk.ts），同理 `SessionManager.inMemory()` 不传 cwd 会默认 `process.cwd()`（session-manager.ts）。必须每个组件都显式传相同 cwd。详细原理见 [A05 §默认值与优先级](A05-custom-cwd.md)。

### 方式三：用 `extensionFactories` 注册内联扩展

适用于扩展逻辑**短小**（几个钩子/一两个工具），不值得开独立文件的场景。

`ExtensionFactory` 的签名（extensions/types.ts）：

```ts
type ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>;
```

```ts
import {
  getAgentDir,
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const cwd = process.cwd();
const agentDir = getAgentDir();

const loader = new DefaultResourceLoader({
  cwd, agentDir,
  extensionFactories: [
    // 每个 factory 接收一个 ExtensionAPI 实例
    (pi) => {
      pi.on("agent_start", (event, ctx) => {
        ctx.ui.notify("内联扩展已加载");
      });
    },
    // 可以有多个，按数组顺序加载
    async (pi) => {
      // 也支持 async factory
      pi.registerTool({
        name: "inline_tool",
        label: "Inline Tool",
        description: "A tool defined inline",
        parameters: Type.Object({}),
        async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
          return { content: [{ type: "text", text: "Hello from inline tool" }] };
        },
      });
    },
  ],
});
await loader.reload();

const { session } = await createAgentSession({
  cwd,
  resourceLoader: loader,
  sessionManager: SessionManager.inMemory(cwd),
});

try {
  await session.prompt("Use inline_tool.");
} finally {
  session.dispose();
}
```

> **内联扩展的路径标识**：`extensionFactories` 加载的扩展在内部用 `<inline:1>` / `<inline:2>` 作为路径标识（resource-loader.ts），错误信息和日志里会看到这个标记。

#### 方式三补充：命名扩展

`extensionFactories` 也支持**命名扩展**——传入 `{ name, factory, hidden? }` 对象而非裸函数（`InlineExtension` 类型）：

```ts
const loader = new DefaultResourceLoader({
  cwd, agentDir,
  extensionFactories: [
    // 命名扩展：name 用于诊断和日志，hidden: true 可从启动扩展列表中隐藏
    {
      name: "my-named-ext",
      factory: (pi) => {
        pi.on("agent_start", () => console.log("[my-named-ext] loaded"));
      },
      // hidden: true,  // 可选：从启动扩展列表中隐藏
    },
  ],
});
```

命名扩展的优势：错误信息更清晰（显示 `"my-named-ext"` 而非 `<inline:1>`），便于调试多扩展场景。

## 加载顺序与合并行为

当三种方式同时使用时，扩展按以下顺序合并（resource-loader.ts 的 `mergePaths`）：

1. **`additionalExtensionPaths`**（`cliEnabledExtensions`，作为 primary）→ 先加载
2. **`.pi/extensions/`（自动发现）** + **全局扩展 `~/.pi/agent/extensions/`**（`enabledExtensions`，作为 additional）→ 后追加合并
   - ⚠️ **两者信任门槛不同**：`.pi/extensions/` 受项目信任约束（未受信跳过），但**全局扩展 `~/.pi/agent/extensions/` 不受信任门槛约束**——无论项目是否受信都会加载（package-manager.ts 中 user 级 `addResources("extensions", ...)` 在 `if (projectTrusted)` 块**之外**）。排查"项目级扩展没生效、全局级生效了"时优先查这里。
3. **`extensionFactories`** → 最后追加到 extensions 数组末尾

**冲突处理**：不同扩展注册同名**工具 / flag** 时，SDK 不会报错阻止加载，而是作为**诊断信息**记录（resource-loader.ts 的 `detectExtensionConflicts`），优先级由加载顺序决定（先注册的胜出）。注意：源码目前只检测 `tools` 和 `flags` 的同名冲突，**不检测 `commands`**——同名 command 不会产生冲突诊断（`detectExtensionConflicts` 仅遍历 `ext.tools` 和 `ext.flags`）。

## reload() 的时序要求

`DefaultResourceLoader.reload()` 是**必须显式调用**的——构造函数只存参数，不加载。典型时序：

```text
new DefaultResourceLoader(...)   ← 只存参数
  ↓
await loader.reload()            ← 真正加载所有资源（扩展/skills/prompts/...）
  ↓
createAgentSession({ resourceLoader: loader })   ← 把已加载的资源接入 session
```

如果用 `createAgentSession()` 不传 `resourceLoader`，SDK 内部会自动 `new DefaultResourceLoader(...) + reload()`（sdk.ts）——这就是方式一不需要手动 reload 的原因。

## 变体与延伸

- **禁用所有扩展**：`new DefaultResourceLoader({ cwd, agentDir, noExtensions: true })` — 跳过自动发现的扩展（`.pi/extensions/` + 全局），只保留 `additionalExtensionPaths` 解析出的临时扩展和 `extensionFactories` 注册的内联扩展。源码：resource-loader.ts（`noExtensions` 为真时取 `cliEnabledExtensions`，跳过 `enabledExtensions`；`extensionFactories` 不受影响）
- **全替换扩展加载结果**：`extensionsOverride: (base) => { ... }` — 接收默认加载结果，返回自定义结果。适合过滤/排序/注入虚拟扩展
- **扩展 API 详解**（创建工具、钩子、命令） → 见 [sdk_doc/07-extensions-api.md](../sdk_doc/07-extensions-api.md)
- **加载 Skill / Prompt 模板** → 见 [场景 C01](C01-custom-skill.md) / [场景 C02](C02-prompt-templates.md)
- **用 Pi Package 持久分发扩展**（`pi install`） → 见 [场景 I02](I02-distribute-extension.md)
- **自定义项目信任策略**（自动信任白名单目录） → 见 [场景 B04](B04-project-trust.md)
- **自定义 cwd 与扩展加载的协作** → 见 [场景 A05](A05-custom-cwd.md)（cwd 决定 `.pi/extensions/` 的发现位置）
