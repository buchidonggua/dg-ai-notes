# 场景：最小化启动 (A01)

## 什么时候用
这是 pi-agent SDK 最简启动模式。适合：验证环境是否通、快速原型、跑通第一条"hello world"。
不适合生产环境（生产需**可控的会话目录与续接**、错误恢复、超时控制，见 [场景 F01](F01-session-persistence.md)）。

## 前置条件

跑这段代码之前，确保：

1. **安装 SDK**：`npm install @earendil-works/pi-coding-agent@latest`
2. **配好 API Key**：见 [场景 B01](B01-auth-config.md)。
   - ⚠️ **注意**：缺 key 时 `createAgentSession()` **不会 throw**——它会返回一个带 `modelFallbackMessage` 警告的 session，真正的报错（`No model selected.`）要等到 `session.prompt()` 时才抛出。这是新手最容易误解的一点：**"创建成功"不等于"能跑通"**。
3. **有可用模型**：见 [场景 A02](A02-model-selection.md)。未显式传 `model` 时，SDK 按以下顺序找（`findInitialModel`）：① settings 默认模型（已配 key 才算数）→ ② `defaultModelPerProvider`（已知 provider 的默认模型优先匹配）→ ③ 第一个可用模型。三者都失败时，`session.model` 为 `undefined`，`prompt()` 会 throw 多行错误 `No model selected.\n\nUse /login to log into a provider...`。
4. **需要代理时配好环境变量**：SDK 识别 `http_proxy` / `https_proxy` / `all_proxy`（大小写都认），按目标 URL 协议匹配。目标是 HTTPS API 时优先设 `https_proxy`。详见 [B01](B01-auth-config.md)。

## 目标
用一行 `createAgentSession()` 快速启动 Agent，发送一条消息并流式输出回复。

## 涉及 SDK

| 能力 | 用途 | 详细文档 |
|------|------|---------|
| `createAgentSession` | 创建 session 并返回 `{ session, extensionsResult, modelFallbackMessage? }` | [sdk_doc/01-create-agent-session.md](../sdk_doc/01-create-agent-session.md) |
| `session.subscribe` | 订阅事件流（`message_update` + `text_delta` 实现流式输出） | [sdk_doc/04-events.md](../sdk_doc/04-events.md) |
| `session.prompt` / `session.dispose` | 发送提示词 / 释放资源 | [sdk_doc/02-agent-session.md](../sdk_doc/02-agent-session.md) |

### 返回值速览

```ts
interface CreateAgentSessionResult {
  session: AgentSession;            // 会话实例
  extensionsResult: LoadExtensionsResult;  // 扩展加载结果
  modelFallbackMessage?: string;    // ⚠️ 模型回退警告（见下方）
}
```

`modelFallbackMessage` 在两种场景下出现（不 throw）：

1. **会话保存的模型无法恢复**（如上次用的模型本次未配 key），且还能找到其他可用模型——消息形如 `Could not restore model anthropic/claude-opus-4-5. Using <provider>/<modelId>`（此处 `anthropic/claude-opus-4-5` 仅为示意旧模型名，非当前默认）。
2. **完全无可用模型**——消息由 `formatNoModelsAvailableMessage()` 生成（`No models available. Use /login to log into a provider...`）。此时 `session` 仍会返回，真正的 throw 延迟到 `prompt()` 时。

**生产建议**：在调用 `createAgentSession()` 后检查 `modelFallbackMessage`，提前给用户友好的提示，而不是等到 `prompt()` throw。

## 实现思路

1. 调用 `createAgentSession()` 获取 session——SDK 会自动加载当前目录的 `.pi/` 配置和 `~/.pi/agent/` 全局配置（system prompt / skills / extensions / context files）
2. 解构出 `session`（忽略 `extensionsResult` 和 `modelFallbackMessage`，最简模式不处理）

> ⚠️ **默认就持久化**：不传 `sessionManager` 时，对话默认会写到 `~/.pi/agent/sessions/<encoded-cwd>/` 下的 jsonl 文件（`<encoded-cwd>` 是 cwd 编码后的安全目录名）。也就是说「最小化启动」**已经落盘**，下次同目录启动会尝试续接历史。想纯内存测试用 `SessionManager.inMemory()`（见 [场景 F01](F01-session-persistence.md)）。
3. 用 `session.subscribe()` 订阅事件，监听 `message_update` 事件中 `assistantMessageEvent.type === "text_delta"` 的增量——这是 LLM 文本流的唯一入口
4. `session.prompt("你的问题")` 发送消息
5. 在 `finally` 中调用 `session.dispose()` 释放资源——dispose 会：中止正在进行的 LLM 调用/工具执行/重试/压缩/分支总结/ bash、断开 agent 连接、清空事件监听器、清理 session 资源。**不调会导致资源泄漏**。

## 核心代码

```ts
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession();

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta")
    process.stdout.write(event.assistantMessageEvent.delta);
});

try {
  await session.prompt("hello");
} finally {
  session.dispose();
}
```

> **怎么跑**：保存为 `start.ts`，用 `npx tsx start.ts` 运行（示例用了顶层 await，需要 ESM + Node ≥ 20；`tsx` 会自动处理）。直接 `node start.ts` 会因顶层 await 报错。

> **跑不通？** 常见原因（按发生顺序排查）：
>
> 1. `createAgentSession()` 返回了 `modelFallbackMessage` 但没检查 → 在调用后加 `if (modelFallbackMessage) console.error(modelFallbackMessage);` 提前发现
> 2. `session.prompt()` 抛 `No model selected.` → 没配 API Key 或 `ModelRuntime` 中无已配置的模型 → [B01](B01-auth-config.md) / [A02](A02-model-selection.md)
> 3. 网络不通（需代理）→ SDK 按目标 URL 协议匹配 `http_proxy` / `https_proxy` / `all_proxy`（大小写都认），HTTPS API 用 `https_proxy`
> 4. 看不到输出但没报错 → 务必在 `prompt()` **之前**调用 subscribe，确保不漏首条增量（`prompt()` 是 async，把 subscribe 放在 `await prompt()` 之后可能丢事件）

## 变体与延伸

- 指定模型运行 → 见 [场景 A02](A02-model-selection.md)
- 指定工作目录 → 见 [场景 A05](A05-custom-cwd.md)
- 检查 `modelFallbackMessage` 的完整错误恢复模式 → 见 [sdk_doc/01-create-agent-session.md §会话恢复行为](../sdk_doc/01-create-agent-session.md)
- 完整事件类型一览 → 见 [sdk_doc/04-events.md](../sdk_doc/04-events.md)
- 持久化会话（生产环境） → 见 [场景 F01](F01-session-persistence.md)
