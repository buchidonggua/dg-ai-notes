# 场景：指定模型与推理等级 (A02)

## 什么时候用

这是 pi-agent SDK 的"精确控制模型"模式。适合：

- **默认模型不符合需求**——SDK 未传 `model` 时会按 ① settings 默认 ② 第一个可用模型 兜底（见下方「未传 model 的兜底逻辑」），结果可能不是你想要的
- **需要精确控制推理深度**——`thinkingLevel` 直接影响 LLM 的"思考预算"，深度推理（`high`/`xhigh`）适合代码分析/数学/复杂决策，浅推理（`minimal`/`low`）适合闲聊/分类
- **多模型动态切换**——一次配置多个候选模型，运行时按任务类型切换（见「运行时切换：`session.setModel()`」）

不适合：

- 验证环境 / 跑通 hello world → 用 [A01 最小化启动](A01-minimal-startup.md)
- 只是想知道当前有哪些模型可用 → 用 [B03 获取可用模型列表](B03-available-models.md)

## 前置条件

1. **安装 SDK**：`npm install @earendil-works/pi-coding-agent@latest`
2. **配好目标模型的 API Key**：见 [场景 B01](B01-auth-config.md)
   - ⚠️ **注意**：缺 key 时 `createAgentSession()` **不会 throw**——它会返回一个带 `modelFallbackMessage` 警告的 session，真正的报错（`No model selected.` / `No API key found for <provider>.`）要等到 `session.prompt()` 时才抛出。详见 [A01「延迟报错机制」](A01-minimal-startup.md)
3. **确认模型 ID 存在**：内置模型清单见 pi-ai 包的 `providers/<provider>.models.ts`，或用 [B03](B03-available-models.md) 的代码列出。

## 涉及 SDK

| 能力 | 用途 | 详细文档 |
|------|------|---------|
| `ModelRuntime` | **主入口**：模型/认证一体化运行时（替代旧 `AuthStorage` + `ModelRegistry`） | [sdk_doc/05-auth-model-registry.md](../sdk_doc/05-auth-model-registry.md) |
| `ModelRegistry` | 兼容包装器（扩展内 `ctx.modelRegistry` 仍可用，内部委托 `ModelRuntime`） | [sdk_doc/05-auth-model-registry.md](../sdk_doc/05-auth-model-registry.md) |
| `getBuiltinModel` | **推荐**：按 provider + modelId 从内置目录取模型引用 | [sdk_doc/05-auth-model-registry.md](../sdk_doc/05-auth-model-registry.md) |
| `getModel` | ⚠️ 已 deprecated，等价于 `getBuiltinModel`（兼容旧代码） | [sdk_doc/05-auth-model-registry.md](../sdk_doc/05-auth-model-registry.md) |
| `createAgentSession` | 创建 session，接收 `model` / `thinkingLevel` / `scopedModels` / `modelRuntime` | [sdk_doc/01-create-agent-session.md](../sdk_doc/01-create-agent-session.md) |
| `session.setModel` | 运行时切换模型（见下方「运行时切换」） | [sdk_doc/02-agent-session.md](../sdk_doc/02-agent-session.md) |

## 实现思路

1. 创建 `ModelRuntime`（认证 + 模型注册表一体化；`createAgentSession` 统一用 `modelRuntime`，不接受 `authStorage` / `modelRegistry` 选项。注：`AuthStorage.create()` / `ModelRegistry` 仍存在为兼容包装器，但不再是创建 session 的入口）
2. 取得目标 `Model` 对象——三种路径任选其一：
   - **内置模型**（推荐）：`getBuiltinModel("anthropic", "claude-opus-4-5")`
   - **从可用列表挑**：`modelRuntime.getAvailableSnapshot()` 同步返回已配 key 的模型数组
   - **自定义模型**（用户在 `models.json` 配的）：`modelRuntime.getModel("my-provider", "my-model")`
3. 调用 `createAgentSession({ model, thinkingLevel, modelRuntime })`
4. **生产建议**：调用后检查 `modelFallbackMessage`——如果有值，说明 SDK 在 model 上做了兜底处理（详见下方「未传 model 的兜底逻辑」）

## 核心代码

### 方式一：从可用列表中挑（动态发现）

适合"不确定当前环境配了哪些 key"的场景——`getAvailableSnapshot()` 会同步过滤出所有已配 key 的模型：

```ts
import { ModelRuntime, createAgentSession } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();

// getAvailableSnapshot() 是同步方法，返回 readonly Model<Api>[]（不是 Promise）
// 它纯粹返回上次异步刷新后的缓存快照（在 ModelRuntime.create() 时初始化，后续 credential 变更时更新），不做任何实时检查
const available = modelRuntime.getAvailableSnapshot();

if (available.length === 0) {
  // 注意：这里 throw 是用户侧主动判断，不是 SDK 行为
  // SDK 即使收到空列表也不会 throw——它会走 findInitialModel 兜底，
  // 兜底失败时 session 仍会返回，真正的 throw 延迟到 prompt() 时
  throw new Error("没有可用的模型，请先配置 API Key（见 B01-auth-config.md）");
}

const { session, modelFallbackMessage } = await createAgentSession({
  model: available[0],         // 取第一个可用模型
  thinkingLevel: "medium",     // 默认值，可省略
  modelRuntime,
});

// 生产建议：检查 modelFallbackMessage 提前发现问题
if (modelFallbackMessage) {
  console.error("⚠️ SDK model fallback:", modelFallbackMessage);
}

try {
  // 用中性 prompt 演示——避免触发工具调用干扰模型验证
  await session.prompt("Hello");
} finally {
  session.dispose();
}
```

### 方式二：精确指定 provider + modelId（推荐用 `getBuiltinModel`）

适合"代码里写死要用某个模型"的场景。**推荐用 `getBuiltinModel`**（非 deprecated、有类型推导）：

```ts
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import { ModelRuntime, createAgentSession } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();

// getBuiltinModel 有类型推导：provider 和 modelId 都会在编译期校验
// 传错 ID（如 "claude-opus-99"）时 TS 会报错
const opus = getBuiltinModel("anthropic", "claude-opus-4-5");

const { session } = await createAgentSession({
  model: opus,
  thinkingLevel: "high",
  modelRuntime,
});

try {
  await session.prompt("Analyze this codebase");
} finally {
  session.dispose();
}
```

> **兼容旧代码**：`@earendil-works/pi-ai/compat` 子路径仍导出 `getModel`，行为与 `getBuiltinModel` 完全一致（`compat.ts` 直接 `export const getModel = getBuiltinModel`），但标记为 `@deprecated`。新代码请用 `getBuiltinModel`。

### 方式三：自定义模型（用户在 `models.json` 配的）

```ts
const myModel = modelRuntime.getModel("my-proxy", "my-custom-model");
if (!myModel) throw new Error("models.json 里没找到这个模型");

const { session } = await createAgentSession({
  model: myModel,
  modelRuntime,
});
```

自定义 provider / `models.json` 完整用法见 [sdk_doc/05-auth-model-registry.md §registerProvider](../sdk_doc/05-auth-model-registry.md)。

## thinkingLevel 详解

### 可选值与语义

`CreateAgentSessionOptions.thinkingLevel` 接受 **7 档**：

| 值 | 语义 | 适用场景 |
|----|------|---------|
| `"off"` | 禁用推理 | 不需要思考的简单任务（分类、提取） |
| `"minimal"` | 最小推理，省 token | 闲聊、短回复 |
| `"low"` | 轻度推理 | 简单代码修改、单文件改动 |
| `"medium"` | **默认**，平衡 | 通用编程任务 |
| `"high"` | 深度推理 | 代码分析、架构决策、复杂 debug |
| `"xhigh"` | 极致推理（**仅部分模型支持**） | 数学证明、长链推理 |
| `"max"` | 最高推理（**仅部分模型支持**，如 Claude Opus 系列） | 极致推理任务 |

**关键限制**：仅当模型的 `reasoning: true` 时其他档位才生效。`reasoning: false` 的模型（部分模型、大多数本地模型）调用 `getSupportedThinkingLevels()` 只返回 `["off"]`。

> **类型差异**：agent-core 的 `ThinkingLevel`（7 值，含 `"off"`）与 pi-ai 的 `ThinkingLevel`（6 值，不含 `"off"`）不同。pi-ai 用 `ModelThinkingLevel = "off" | ThinkingLevel` 统一。`createAgentSession` 选项中的 `thinkingLevel` 接受 7 值含 `"off"`。

### clampThinkingLevel 算法（★ 易误解）

文档其他地方常见的"自动降级"说法**不准确**。实际算法是「先向上找，再向下找」（`clampThinkingLevel()`）：

```
1. 如果请求的 level 在模型支持列表里 → 直接用
2. 否则，从请求 level 开始：
   a. 先向上找（requestedIndex → max 方向）最近的可用档
   b. 向上找不到，再向下找（requestedIndex → 0 方向）
3. 全都找不到（理论不可能，因为 ["off"] 永远在）→ 返回 "off"
```

**举例**（`EXTENDED_THINKING_LEVELS = ["off","minimal","low","medium","high","xhigh","max"]`）：

- 模型支持 `["off", "low", "medium"]`，请求 `"high"` → 向上找不到（high 以上无可用档），再向下找到 `"medium"`
- 模型支持 `["off", "xhigh"]`（理论情况），请求 `"medium"`（index 3）→ 向上依次找 medium/high → 命中 `"xhigh"`
- 模型支持 `["off"]`（`reasoning: false`），请求任何档 → 返回 `"off"`

### 默认值链

未显式传 `thinkingLevel` 时，SDK 按以下顺序回填（`sdk.ts`）：

1. 恢复会话保存的值（有 `thinking_level_change` 记录时）
2. `settingsManager.getDefaultThinkingLevel()`（读 `~/.pi/agent/settings.json`）
3. `DEFAULT_THINKING_LEVEL = "medium"`（`defaults.ts`）
4. 最后还会经过 `clampThinkingLevel()` 按模型能力降级（**特例**：若 `model` 为 `undefined`，直接置 `"off"`，不经过 clamp——见 `sdk.ts:239-243`）

## 未传 model 的兜底逻辑（★ 重要）

`createAgentSession()` 未传 `model` 时，SDK 按以下顺序兜底（`sdk.ts`）：

0. **step 0：从已存在会话恢复**——若 `sessionManager` 有历史会话（如续接 jsonl 重启）且保存了 model，先尝试 `modelRuntime.getModel(provider, modelId)` 恢复；恢复失败设 `modelFallbackMessage = "Could not restore model ..."`，再进 step 1。**这是会话恢复场景（进程重启续接旧会话）的入口**。
1. **settings 默认**：`getDefaultProvider()` + `getDefaultModel()`（读 `~/.pi/agent/settings.json`）
2. **按已知 provider 优先级找默认模型**：遍历 `defaultModelPerProvider`，找第一个在可用模型列表里的匹配
3. **第一个可用模型**：`getAvailableSnapshot()[0]`
4. **全失败**：`session.model` 保持 `undefined`，`modelFallbackMessage = formatNoModelsAvailableMessage()`

**关键**：第 4 步**不会 throw**——`createAgentSession()` 仍正常返回 session。真正的 throw 延迟到 `session.prompt()` 时（`agent-session.ts:1178` 内 `formatNoModelSelectedMessage()`）。**注意 `compact()` 也会做同样的 `No model selected` 校验**（`agent-session.ts:1788`）——即切了 model 后若想 compact 也会触发同一报错。

**生产建议**：调用 `createAgentSession()` 后立即检查 `modelFallbackMessage`，提前给用户友好提示，而不是等到 `prompt()` throw。

## 运行时切换：`session.setModel()`

模型选择的另一半是"运行时切换"——session 已创建后换模型。核心 API：

```ts
async session.setModel(model: Model<any>): Promise<void>
```

**行为**（`AgentSession.setModel()`）：

- 先 `await this._modelRuntime.checkAuth(model.provider)` 校验认证——**失败时立即 throw** `No API key for ${model.provider}/${model.id}`
- 成功时保存到 session（`agent.state.model` + `appendModelChange`）+ 触发 settings 持久化（`setDefaultModelAndProvider`）+ 按新模型能力重新 clamp thinkingLevel

**典型用法**——基于任务类型动态切换：

```ts
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import { ModelRuntime, createAgentSession } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();

const { session } = await createAgentSession({
  model: getBuiltinModel("anthropic", "claude-haiku-4-5"),  // 初始用快的
  thinkingLevel: "low",
  modelRuntime,
});

// 遇到复杂任务，切到 opus + 高推理
await session.setModel(getBuiltinModel("anthropic", "claude-opus-4-5"));
await session.setThinkingLevel("high");

try {
  await session.prompt("...");
} finally {
  session.dispose();
}
```

> `setModel` 抛 `No API key for ...` 不会延迟到下一次 `prompt()`——校验在 `setModel()` 内部完成（`await checkAuth(...)` 之后立即 throw）。注意 `setModel` 是 `async` 方法，对 `await session.setModel(...)` 调用者表现为立即 reject，不是字面意义的同步 throw。

### 模型切换的扩展层事件（⚠️ 视角陷阱）

`setModel()` / `cycleModel()` / 会话恢复都会触发扩展层 `model_select` 事件，payload 形如 `{ model, previousModel, source: "set" | "cycle" | "restore" }`。扩展可在钩子里订阅：

```ts
// 仅扩展（Extension）视角能收到，如 extensions/my-ext/index.ts
ctx.on("model_select", ({ model, previousModel, source }) => {
  console.log(`模型切换：${previousModel?.id} → ${model.id}（来源 ${source}）`);
});
```

> ⚠️ **关键陷阱（实测教训）**：`model_select` **只派发到 `extensionRunner`**，`AgentSessionEvent` union **不含** `model_select`。也就是说 `session.subscribe(...)` 收不到这个事件。同理 `thinking_level_select` 也是扩展独有（`session.subscribe` 收不到）；只有 `thinking_level_changed` 是 session 层事件（`session.subscribe` 可收）。
>
> 证据：`_emitModelSelect` 走 `this._extensionRunner.emit`（`agent-session.ts:1564-1569`），不走 `this._emit`；`AgentSessionEvent` union（`agent-session.ts:141-183`）含 `thinking_level_changed` 但不含 `model_select` / `thinking_level_select`。

## scopedModels：候选模型清单（B 档）

`CreateAgentSessionOptions.scopedModels` 允许一次配置多个候选模型，CLI 模式下可用 Ctrl+P 在其间切换：

```ts
const modelRuntime = await ModelRuntime.create();

const { session } = await createAgentSession({
  scopedModels: [
    { model: getBuiltinModel("anthropic", "claude-opus-4-5"), thinkingLevel: "high" },
    { model: getBuiltinModel("anthropic", "claude-haiku-4-5"), thinkingLevel: "low" },
  ],
  modelRuntime,
});
```

- 类型：`Array<{ model: Model<any>; thinkingLevel?: ThinkingLevel }>`（`sdk.ts`）
- SDK 集成场景下主要用于通过 `session.scopedModels` 读取候选列表，在 UI 上做模型选择器
- 切换通过 `cycleModel()` 内部直接设置 model（`_cycleScopedModel` / `_cycleAvailableModel`），校验方式与 `setModel()` 不同：`cycleModel` 通过 `getAvailableSnapshot()` 过滤已配置 auth 的模型，而 `setModel` 通过 `checkAuth()` 显式校验

## settings 默认模型（B 档）

未传 `model` 时 SDK 会读 `~/.pi/agent/settings.json` 的 `defaultProvider` + `defaultModel` 字段（`settings-manager.ts`）。适合"一次配置永久生效"：

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-opus-4-5",
  "defaultThinkingLevel": "high"
}
```

代码里可用 `SettingsManager` 修改：

```ts
import { SettingsManager } from "@earendil-works/pi-coding-agent";
// create() 的 cwd 是必填参数（项目根目录）：
//   - 项目级 settings 读 <cwd>/.pi/settings.json
//   - 全局 settings 读 ~/.pi/agent/settings.json
// 两者合并后生效，全局为底、项目覆盖
const settings = SettingsManager.create(process.cwd());
settings.setDefaultProvider("anthropic");
settings.setDefaultModel("claude-opus-4-5");
```

> ⚠️ `create()` 不能零参调用——签名 `create(cwd: string, agentDir?: string, options?)` 中 `cwd` 无默认值。省略时 TS 编译报 `Expected 1 arguments, but got 0`。

之后调用 `createAgentSession()` 不传 `model` 即可自动选中。

## 自定义 provider 模型（C 档）

从 `models.json` 加载或 `registerProvider()` 运行时注册的模型，完整用法见：

- [sdk_doc/05-auth-model-registry.md §registerProvider](../sdk_doc/05-auth-model-registry.md)
- [场景 B03](B03-available-models.md)

## 变体与延伸

- 配置 API Key → [场景 B01](B01-auth-config.md)
- 获取所有可用模型 → [场景 B03](B03-available-models.md)
- 完整 `createAgentSession` 参数（含 `scopedModels` / `cwd` / `tools`） → [sdk_doc/01-create-agent-session.md](../sdk_doc/01-create-agent-session.md)
- 会话恢复时模型/thinkingLevel 如何回填 → [sdk_doc/01-create-agent-session.md §会话恢复行为](../sdk_doc/01-create-agent-session.md)
- 运行时 thinkingLevel 切换 → [sdk_doc/02-agent-session.md](../sdk_doc/02-agent-session.md) `setThinkingLevel()`
