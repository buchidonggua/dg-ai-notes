# 场景：开发自定义工具 (D01)

> 💡 **先判断该不该写**：默认优先用内置工具（`bash` 能做的大部分事不必自定义）；只有需要**结构化参数 / 确定性输出 / 安全闸门**时才写自定义工具。本场景讲 `defineTool` 的 API 用法。

## 什么时候用 / 不用会怎样

**适合**：当内置工具（`read` / `bash` / `edit` / `write` / `grep` / `find` / `ls`）无法满足以下三类场景之一时：
1. **封装特定 API**（如 `query_jira` / `send_slack` / `lookup_user`）——比让模型现学 curl + 拼参数更可靠
2. **结构化输出**（如返回标准化的 diff、JSON、报告对象，而不是 text）——`details` 字段供 UI 或下游消费者使用
3. **强约束输入**（schema 校验）——TypeBox schema 在执行前自动校验参数，避免脏数据进入执行逻辑

**不适合**：
- 任何能 `bash` 一次搞定的操作 → 自定义工具的固定 token 开销远高于让模型写 bash
- 需要交互式 UI（选择项、确认）→ 工具是模型主动调用的，不能用来跟用户对话；考虑 [E02-extension-basics](E02-extension-basics.md)
- 需要在会话启动时改变 Agent 行为 → 用 [A04-system-prompt](A04-system-prompt.md) 或 [C03-context-files](C03-context-files.md)

**不用会怎样**：模型可能用 bash 反复试错、参数错位、输出格式不稳定；某些操作可能因没有合适工具被模型直接拒绝执行。

---

## 涉及 SDK

| 能力 | 用途 | 详细文档 |
|------|------|---------|
| `defineTool` | 包装工具定义，保留 TypeBox 类型推断 | [sdk_doc/06-tools.md](../sdk_doc/06-tools.md) |
| `Type.Object` / `Type.String` 等（来自 `typebox` 包） | 描述工具参数 schema | [sdk_doc/06-tools.md](../sdk_doc/06-tools.md) |
| `createAgentSession({ customTools, tools, noTools, excludeTools })` | 注册 + 白名单控制 | [sdk_doc/01-create-agent-session.md](../sdk_doc/01-create-agent-session.md) |
| `createReadTool` / `createBashTool` 等 | 内置工具的工厂函数（自定义 cwd 或包装） | [sdk_doc/06-tools.md](../sdk_doc/06-tools.md) |

> ⚠️ **import 来源**：TypeBox 从 `typebox` 包导入（**不是** `@sinclair/typebox`，截至核对版本 v0.84.4 统一使用 `typebox`，版本协议见 SKILL.md）。
> ```ts
> import { Type } from "typebox";                              // ✅ 正确
> import { Type } from "@sinclair/typebox";                    // ❌ 旧包名，已废弃
> ```

---

## 默认行为（不传 `tools` 时）

`createAgentSession` 的工具启用规则（规则建立 in `sdk.ts`，过滤执行 in `agent-session.ts`）：

| 配置 | 启用的工具 |
|------|-----------|
| 不传 `tools` 且不传 `noTools` | `["read", "bash", "edit", "write"]` + **所有 customTools + 所有扩展工具** |
| `tools: [...]` 显式提供 | **只启用列表中的**（customTools 必须显式列入才生效） |
| `noTools: "all"` | 全部禁用（连 customTools 也禁用） |
| `noTools: "builtin"` | 禁用 4 个默认内置（`read/bash/edit/write`），**保留** customTools 和扩展工具 |
| `excludeTools: ["bash"]` | 在 `tools` 之后应用，按名排除单个 |

**关键事实**（`agent-session.ts`）：customTools 的启用也走 `_allowedToolNames` 过滤。所以：
- 不传 `tools` → `_allowedToolNames = undefined` → customTools **自动启用**
- 传 `tools: ["read", "bash"]` 但不含 `"my_tool"` → `my_tool` **被禁用**（不会出现在 active 列表）

这是最常见的踩坑点——明明传了 `customTools`，却因 `tools` 没列入而失效。**两种正确做法**：要么 `tools` 省掉，要么 `tools` 显式包含自定义工具名。

---

## 核心数据模型

### ToolDefinition 接口（`extensions/types.ts`）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | ✅ | 工具名（用于 LLM tool call）。同名冲突处理**分层**：扩展注册的工具（`pi.registerTool`）跨扩展重名会记入 diagnostics（`resource-loader.ts` 的 `detectExtensionConflicts`）；但 **customTools（SDK 层）之间、或 customTool 与扩展工具重名时静默覆盖**——`_refreshToolRegistry` 用 `Map.set` 后注册者赢，无任何告警 |
| `label` | `string` | ✅ | UI 显示用的人类可读标签 |
| `description` | `string` | ✅ | **给 LLM 看的**工具描述，决定模型何时选择调用 |
| `parameters` | `TParams`（TypeBox schema） | ✅ | 输入参数 schema，自动校验 |
| `execute` | function | ✅ | 执行逻辑（详见下方专节） |
| `promptSnippet?` | `string` | ❌ | 出现在系统提示词"Available tools"区块的一行摘要。**省略时该工具不会进索引** |
| `promptGuidelines?` | `string[]` | ❌ | 追加到系统提示词"Guidelines"区块的提示项 |
| `renderShell?` | `"default" \| "self"` | ❌ | TUI 渲染外壳；`"self"` 表示工具自己渲染边框 |
| `prepareArguments?` | `(args: unknown) => Static<TParams>` | ❌ | schema 校验**之前**的兼容层，用于参数清洗/转换 |
| `executionMode?` | `"sequential" \| "parallel"` | ❌ | 同批次工具的执行模式覆盖 |
| `constrainedSampling?` | `false \| ConstrainedSamplingConfig` | ❌ | 控制此工具调用是否走受限采样模式（字段定义 in `extensions/types.ts`，`ConstrainedSamplingConfig` 类型定义 in `pi-ai/src/types.ts`）。默认不启用 |
| `renderCall?` / `renderResult?` | function | ❌ | TUI 自定义渲染（仅 interactive 模式有意义） |

> 💡 **`prepareArguments` 的典型用法**：给 schema 校验**之前**做一次参数清洗/迁移。最常见的场景是**兼容旧会话**——resume 一个旧 session 时，模型历史上发出的 tool call 参数可能用的是旧字段名/旧结构，跟当前 schema 对不上。`prepareArguments` 在校验前把它们改写成新形态。框架内置的 `edit` 工具就用这个机制把旧的顶层 `oldText`/`newText` 折叠进新的 `edits[]` 数组。
>
> ```ts
> // 例：把旧字段 q 迁移到新字段 query（resume 旧会话时生效）
> prepareArguments: (args) => {
>   const a = args as Record<string, unknown>;
>   if (a.q !== undefined && a.query === undefined) {
>     return { ...a, query: a.q } as any;
>   }
>   return args as any;
> },
> ```
>
> **注意**：保持 `parameters` schema 严格（只暴露新字段），把兼容性逻辑收在 `prepareArguments` 里——不要为了迁旧会话往公共 schema 里塞废弃字段。

### defineTool 的作用（`extensions/types.ts`）

```ts
function defineTool<TParams, TDetails, TState>(
  tool: ToolDefinition<TParams, TDetails, TState>,
): ToolDefinition<TParams, TDetails, TState> & AnyToolDefinition;
```

**为什么要包一层**：直接把对象字面量传给 `customTools: [...]` 时，TypeScript 会把数组元素类型收窄为 `ToolDefinition<unknown>`，丢失 `parameters` 的字面量类型推断。`defineTool` 是个 no-op 函数（运行时直接返回原对象），但能保住泛型推断——让 `execute` 内部的 `params.text` 有正确的类型补全。

**何时不需要**：在扩展内用 `pi.registerTool({ ... })` 注册时，`registerTool` 本身就有正确的上下文类型推断，不需要再包一层。

### AgentToolResult（execute 的返回值，`agent/types.ts`）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `content` | `(TextContent \| ImageContent)[]` | ✅ | 返回给 LLM 的内容，会进入后续对话上下文 |
| `details` | `TDetails` | ✅ | 结构化元数据，**不进 LLM 上下文**——仅供 UI 渲染或扩展内部使用 |
| `usage?` | `Usage` | ❌ | 工具自身执行的 token 用量（如调用子 LLM 产生的开销）。**不用于主对话上下文计费**，仅供日志/UI 展示（`agent/types.ts`） |
| `addedToolNames?` | `string[]` | ❌ | 此工具结果产生的、从当前 transcript 点起新增可用的工具名（`agent/types.ts`）。用于工具运行时动态注册子工具 |
| `terminate?` | `boolean` | ❌ | `true` 表示当前批次执行完后**提前终止 agent loop**。仅当同批次所有工具都返回 `terminate: true` 时生效 |

**关键区别**：`content` 是给模型看的（影响后续推理），`details` 是给程序看的（结构化数据传递）。把结构化数据塞 `content` 会污染上下文窗口；把人类可读结果塞 `details` 则模型看不到、无法基于它继续推理。

---

## execute() 函数签名

```ts
async execute(
  toolCallId: string,
  params: Static<TParams>,
  signal: AbortSignal | undefined,
  onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
  ctx: ExtensionContext,
): Promise<AgentToolResult<TDetails>>;
```

| 参数 | 类型 | 含义 |
|------|------|------|
| `toolCallId` | `string` | 本次工具调用的唯一 ID（用于日志、UI 跟踪） |
| `params` | `Static<TParams>` | **经 TypeBox schema 校验后**的参数对象，类型由 `parameters` schema 静态推断 |
| `signal` | `AbortSignal \| undefined` | 取消信号。用户中断（Ctrl+C）或 agent 终止时触发；长任务必须检查 `signal.aborted` 并及时退出 |
| `onUpdate` | callback \| undefined | 流式更新回调，详见下方专节 |
| `ctx` | `ExtensionContext` | 扩展上下文，详见下方专节 |

### 错误处理：先有兜底，再谈转化

**框架已兜底**：`execute` 里 `throw` 任何东西，框架都会接住，翻译成 `{ content: error.message, isError: true }` 当正常工具结果喂给 LLM，**程序不崩**（`agent-loop.ts` 的 `executePreparedToolCall` 有 try/catch + `createErrorToolResult`）。

**⚠️ 纠正旧误解**：工具 `throw` **不会**触发 retry。retry 只在 **LLM 流式调用自身瞬断**（provider 429/500/掉线/超时）时触发，由 `pi-ai/utils/retry.ts` 的 `isRetryableAssistantError` 按 provider 错误模式判定——工具 throw / return 都**不**消耗 retry 预算。

**那何时值得 `catch` + `return`？只有一条：把干巴巴的 `err.message` 改写成模型能照着修的提示。** 只透传原文（甚至只加前缀）的 catch 是无效仪式——不如直接 throw，框架兜底喂给模型的效果一样。

| 做法 | 模型看到什么 | 何时用 |
|------|------------|--------|
| **throw** | `error.message` 原文，框架自动 `isError:true` | 不打算转化错误——最省事 |
| **catch + return 转化提示** | 你写的可操作 hint（如「表不存在，库里只有 A/B/C」）| 想让模型自我修复时 |

> ⚠️ `AgentToolResult` **没有 `isError` 字段**——`return { content, isError: true }` 里的 `isError` 会被**静默忽略**，正常 return 永远 `isError:false`。想标记 error 只能 **throw**（或用扩展层 `tool_result` 钩子）。且 `isError` 对多数 provider 有意义（Anthropic 映射 `is_error`、Google/Bedrock 区分 SUCCESS/ERROR 状态、Mistral 前缀 `[tool error]`），openai-completions（GLM/DeepSeek 等）不读它。

### ExtensionContext 关键字段（`extensions/types.ts`）

| 字段 | 类型 | 含义 |
|------|------|------|
| `cwd` | `string` | 当前工作目录（基目录） |
| `mode` | `ExtensionMode` | 运行模式：`"tui"` / `"rpc"` / `"json"` / `"print"`（无 `"sdk"` 模式；SDK 集成走 `"print"` 或 `"json"`） |
| `hasUI` | `boolean` | 是否有可交互 UI（TUI/RPC 为 true，纯 SDK 为 false） |
| `ui` | `ExtensionUIContext` | UI 方法集（notify / confirm / select / input 等）。`hasUI=false` 时调用**静默返回安全默认值**（`select→undefined`、`confirm→false`、`input→undefined`、`notify→no-op`），不抛错 |
| `model` | `Model<any> \| undefined` | 当前使用的模型 |
| `modelRegistry` | `ModelRegistry` | 模型注册表，可查 API key 等 |
| `scopedModels` | `readonly ScopedModel[]` | 会话可用的 scoped 模型快照（只读）。空数组表示无 scoping，所有可用模型均可用 |
| `thinkingLevel?` | `ThinkingLevel` | 当前 thinking 级别（未设置时为 undefined） |
| `sessionManager` | `ReadonlySessionManager` | **只读**会话管理器（只有 `getCwd` / `getEntries` / `getTree` 等查询方法，**不能写入**） |
| `isIdle()` | `() => boolean` | Agent 是否空闲（未在流式输出） |
| `signal` | `AbortSignal \| undefined` | 当前 agent 的取消信号 |
| `abort()` | `() => void` | 中止当前 agent 操作 |
| `isProjectTrusted()` | `() => boolean` | 项目是否受信任（影响 `.pi/` 资源加载） |
| `hasPendingMessages()` | `() => boolean` | 是否有排队等待的消息 |
| `shutdown()` | `() => void` | 优雅关闭 pi |
| `getContextUsage()` | `() => ContextUsage \| undefined` | 当前模型的上下文用量 |
| `compact(options?)` | `function` | 触发压缩（不等待完成） |
| `getSystemPrompt()` | `() => string` | 获取当前生效的系统提示词 |

> ⚠️ **注意**：`getFlag(key)` 不在 `ExtensionContext` 上，而在 `ExtensionAPI`（即扩展工厂函数收到的 `pi` 对象）上，签名是 `pi.getFlag(key)`（`extensions/types.ts`）。工具的 `execute(toolCallId, params, signal, onUpdate, ctx)` 里 `ctx` 没有 `getFlag`。

> ⚠️ **没有 `ctx.session` 字段**——历史文档可能写错。要访问会话数据用 `ctx.sessionManager.getEntries()` 等只读方法；要操作会话（fork/resume）走扩展事件而非 ctx。

### onUpdate 流式更新回调（`agent/types.ts`）

```ts
type AgentToolUpdateCallback<T> = (partialResult: AgentToolResult<T>) => void;
```

**关键**：参数类型是 `AgentToolResult<T>`，**不是** `{ progress: number, content: string }`。正确用法：

```ts
async execute(toolCallId, params, signal, onUpdate, ctx) {
  // ✅ 正确：传 partialResult 形态
  onUpdate?.({
    content: [{ type: "text", text: "处理中..." }],
    details: { stage: "halfway" },
  });

  const final = await doWork();
  return {
    content: [{ type: "text", text: final }],
    details: { stage: "done" },
  };
}
```

回调有以下约束：
- **scoped**：只在 `execute()` promise 未 settle 时有效；resolve/reject 后再调用会被静默忽略
- **不替代最终 return**：onUpdate 的 partialResult 只用于 UI 流式显示，最终结果必须由 return 给出
- **必须用 `?.` 调用**：onUpdate 可能是 undefined（无 UI 模式下）

---

## 核心代码：最小可用工具

```ts
import { createAgentSession, defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { SessionManager } from "@earendil-works/pi-coding-agent";

// 1. 定义工具：将文本转为大写
const uppercaseTool = defineTool({
  name: "uppercase",
  label: "To Uppercase",
  description: "Convert the input text to uppercase",
  parameters: Type.Object({
    text: Type.String({ description: "The text to convert" }),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // 长任务建议检查 signal（本例为同步操作，可省略）
    const result = params.text.toUpperCase();
    return {
      content: [{ type: "text", text: result }],
      details: { charCount: result.length },
    };
  },
});

// 2. 注册工具 + 用 try/finally 保证 dispose
const { session } = await createAgentSession({
  customTools: [uppercaseTool],
  // tools 省略 → customTools 自动启用 + 默认 [read, bash, edit, write]
  sessionManager: SessionManager.inMemory(),
});

try {
  await session.prompt("Please convert 'hello world' using the uppercase tool.");
} finally {
  session.dispose();
}
```

**代码讲解**：
- `name: "uppercase"` 推荐仅含字母/数字/下划线，且不与内置工具冲突——**此为最佳实践/约定，框架层未做正则强校验**（源码中未找到 tool name 正则；对比 skill name 有 `^[a-z0-9-]+$` 强校验，工具名无）。命名不当最可能的后果是 provider 侧 schema 校验报错或 LLM 调用失败
- `description` 决定模型何时选择这个工具——写清楚「这个工具做什么」「适合什么场景」
- `Type.String({ description: ... })` 的 `description` 会被 LLM 看到作为参数提示
- `details` 字段（`{ charCount }`）只给程序看，模型看不到——不要把模型需要的信息塞这里
- `try/finally + dispose` 是 SDK 集成必备模式（官方示例都这样写），避免会话文件残留

---

## 变体

### 变体 A：显式 `tools` 白名单（只启用部分工具）

```ts
const { session } = await createAgentSession({
  customTools: [uppercaseTool],
  tools: ["read", "bash", "uppercase"],  // ⚠️ 必须包含 "uppercase"，否则该工具被禁用
  sessionManager: SessionManager.inMemory(),
});
```

**何时用**：想限制 Agent 只能用特定工具集（如只读模式、最小权限模式）。注意 customTools 名字也必须列入。

### 变体 B：禁用默认内置但保留 customTools

```ts
const { session } = await createAgentSession({
  customTools: [uppercaseTool],
  noTools: "builtin",   // 禁用 read/bash/edit/write，保留 uppercase
  sessionManager: SessionManager.inMemory(),
});
```

**何时用**：纯 API 调用场景，不希望 Agent 操作文件系统。

### 变体 C：长任务 + signal + onUpdate

```ts
const batchTool = defineTool({
  name: "batch_process",
  label: "Batch Process",
  description: "Process items in batch, streaming progress",
  parameters: Type.Object({
    items: Type.Array(Type.String()),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    const results: string[] = [];
    for (let i = 0; i < params.items.length; i++) {
      // ⚠️ 长循环必须检查 signal
      if (signal?.aborted) {
        throw new Error(`Aborted at item ${i}/${params.items.length}`);
      }

      const processed = await heavyWork(params.items[i]);
      results.push(processed);

      // 流式更新（可选）
      onUpdate?.({
        content: [{ type: "text", text: `Processed ${i + 1}/${params.items.length}` }],
        details: { progress: (i + 1) / params.items.length },
      });
    }

    return {
      content: [{ type: "text", text: results.join("\n") }],
      details: { total: results.length },
    };
  },
});
```

**关键点**：
- 每次循环检查 `signal?.aborted`，否则用户 Ctrl+C 后工具还会跑完整个循环
- `onUpdate` 调用要 `?.`，纯 SDK 模式下可能 undefined
- `throw` 在 signal aborted 时会被框架接住（转成 `isError:true` 工具结果，不崩）；aborted 场景最终失败退出，不会无限重试

### 变体 D：catch 的价值——把错误转成模型能修的提示

```ts
const lookupTool = defineTool({
  name: "lookup_user",
  label: "Lookup User",
  description: "Look up a user by ID",
  parameters: Type.Object({ userId: Type.String() }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    try {
      const user = await api.fetchUser(params.userId);
      if (!user) {
        // ✅ 业务错误：返回 error content，让模型看到原因
        return {
          content: [{ type: "text", text: `User ${params.userId} not found` }],
          details: { found: false },
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(user) }],
        details: { found: true, user },
      };
    } catch (err) {
      // catch 的唯一价值：把原始 err.message 转成模型能照着修的提示
      // （只透传原文 = 无效仪式，不如直接 throw 让框架兜底）
      const msg = (err as Error).message;
      if (/timeout|econnrefused/i.test(msg)) {
        return {
          content: [{ type: "text", text: "用户服务暂时不可达，建议改用本地缓存查询或稍后重试" }],
          details: { error: msg },
        };
      }
      return {
        content: [{ type: "text", text: `查询失败：${msg}` }],
        details: { error: msg },
      };
    }
  },
});
```

### 变体 E：通过扩展注册（`pi.registerTool`）

```ts
const myExtension: ExtensionFactory = (pi) => {
  pi.registerTool(defineTool({
    name: "custom_search",
    label: "Custom Search",
    description: "Search custom index",
    parameters: Type.Object({ query: Type.String() }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // ...
    },
  }));
};
```

**何时用**：工具需要随扩展生命周期管理（按需启用/禁用）、需要访问扩展内部状态、或要在多个会话间复用。详见 [E02-extension-basics](E02-extension-basics.md)。

### 变体 F：包装内置工具（自定义路径白名单等）

详见 [sdk_doc/06-tools.md §内置工具的安全边界](../sdk_doc/06-tools.md)。核心模式：

```ts
import { createReadToolDefinition, defineTool } from "@earendil-works/pi-coding-agent";

const baseRead = createReadToolDefinition(process.cwd());
export const safeReadTool = defineTool({
  ...baseRead,
  name: "read",  // 保持原名以覆盖内置
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // 自定义路径校验...
    return baseRead.execute(toolCallId, params, signal, onUpdate, ctx);
  },
});
```

**何时用**：限制内置工具的能力（如限制 read 只能读 `.pi/skills/`）、改变 cwd、定制日志等。

---

## 陷阱

1. **`tools` 显式提供时漏掉自定义工具名** → 工具静默失效。要么 `tools` 省掉（让 customTools 自动启用），要么 `tools` 必须包含所有自定义工具名。
2. **`onUpdate` 参数形态错误** → 类型错误或运行时无效果。必须传 `AgentToolResult` 形态（`{ content: [...], details: {...} }`），**没有 `progress` 字段**（要传进度可放 `details`）。
3. **`ctx.session` 不存在** → 历史文档误导。ExtensionContext 没有 `session` 字段，只有 `sessionManager`（只读）。要操作会话走扩展事件。
4. **只透传 `err.message` 的 catch** → 无效仪式。throw 本就会被框架接住喂给模型（`isError:true`），只加前缀透传原文毫无增益。catch 的唯一价值是**转化**（分流错误类型给可操作 hint）；不转化就别 catch。详见上方「错误处理」。
5. **长循环不检查 `signal.aborted`** → 用户 Ctrl+C 后工具还在跑，浪费资源。
6. **`import { Type } from "@sinclair/typebox"`** → 已废弃。新包名是 `typebox`（无 scope 前缀）。
7. **把结构化数据塞 `content`** → 污染 LLM 上下文窗口。结构化数据应放 `details`，`content` 只放模型需要看到的文本/图像。
8. **`description` 写得太短** → 模型不知道何时调用。`description` 是给 LLM 看的"工具广告"，要写清楚「做什么」+「适合什么场景」+「不适合什么场景」。
9. **没 `try/finally + dispose`** → 会话文件残留，长期运行时累积垃圾。

---

## 横向联动

- **A04**（系统提示词）：`promptSnippet` / `promptGuidelines` 是改系统提示词的轻量方式；想完全替换 prompt 用 `systemPromptOverride`
- **A06**（默认行为）：customTools 默认自动启用（不传 tools 时）
- **C01-C03**（资源系统）：context files / skills / prompts 都和工具共存于系统提示词组装链
- **D02**（动态工具）：运行时动态注册/卸载工具，不改 `createAgentSession` 调用
- **E02**（扩展基础）：通过 `pi.registerTool` 在扩展内注册工具的完整流程
- **sdk_doc/06**：工具系统完整 API 参考
- **sdk_doc/11**（集成踩坑）：SDK 集成模式 + try/finally 模式
