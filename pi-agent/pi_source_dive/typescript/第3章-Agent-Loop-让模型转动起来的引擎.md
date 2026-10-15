# 第3章：Agent Loop —— 让模型转动起来的引擎

> 前一章我们看了 Pi 的分层架构。架构只是"骨架"——Agent 真正的生命力来自"循环"。这一章，我们从最基础的问题出发：**为什么需要循环？循环怎么转？什么时候停？** 然后追踪一条用户消息的完整旅程，看清 Agent Loop 的每一次心跳。

> 源码基准：本地 `pi-main` 快照，核心包版本 `v0.84.3`，核对日期 `2026-10-12`。下文路径均相对源码根目录。

---

## 一、引子：大模型的三种用法

在聊 Agent Loop 之前，我们先退一步，看看"使用大模型"这件事本身有几种模式。这对理解"为什么需要循环"至关重要。

### 模式 1：直接调用 —— "模型，回答我"

最原始、最直觉的用法。你构建好提示词，调用一次 API，拿到结果，完事。

```
用户输入 → 构建提示词 → 调模型 → 模型输出 → 展示结果
```

代码大概长这样：

```typescript
const response = await llm.chat({
  messages: [
    { role: "system", content: "你是一个翻译助手" },
    { role: "user", content: "把这段代码翻译成 Python" },
  ],
});
console.log(response.content);
```

**核心工作在于"构建提示词"**。提示词写得好，结果就好。一次调用，一次输出，没有来回。

适用场景：翻译、摘要、问答、代码补全——凡是"一问一答"能搞定的事。

### 模式 2：Workflow —— "模型，你先做第一步，我检查一下，再做第二步"

当任务变复杂，你发现一次性很难得到满意结果。于是你把大任务拆成多步，每步调一次模型，步骤之间由**你的代码**控制流转。

```
用户输入 → [步骤1: 调模型分析] → [你的代码: 提取关键信息]
         → [步骤2: 调模型生成草稿] → [你的代码: 检查质量]
         → [步骤3: 调模型润色] → 最终输出
```

每一步模型只负责自己的那份工作，**决策权在你手上**——你知道什么时候该进入下一步，模型只是流水线上的一环。

适用场景：文档生成流水线、代码审查自动化、RAG（检索增强生成）。

### 模式 3：Agent Loop —— "模型，你自己决定怎么做"

到了 Agent 模式，你把决策权交给了模型。

```
用户输入 → 调模型 → 模型说"我需要读文件" → 执行读文件 → 模型看结果
         → 模型说"还需要搜索代码" → 执行搜索 → 模型看结果
         → 模型说"我知道了，答案是..." → 输出 → 结束
```

关键区别：**步骤之间的流转不再由你写死，而是由模型的输出内容来驱动。** 你的代码只做两件事：
1. 把用户的输入和工具执行结果喂给模型
2. 如果模型输出的内容里包含了工具调用请求，就执行它；如果没有，就认为任务完成了

至于"该调什么工具"、"该调几次"——这些由模型的输出内容决定。"什么时候该停"——这是**人类定义的规则**：当模型的一次输出中不再包含工具调用时，我们就认为循环可以结束了。

用一个对比表格，三种模式的区别一目了然：

| 维度 | 直接调用 | Workflow | Agent Loop |
|------|---------|----------|------------|
| 决策者 | 用户 | 你的代码 | 模型 |
| 模型调用次数 | 1 次 | N 次（由代码控制） | 不确定（由模型控制） |
| 核心工作 | 写提示词 | 设计流程 | 定义工具和循环 |
| 模型角色 | 执行者 | 流水线环节 | 自主决策者 |
| 典型场景 | 翻译、摘要 | 文档流水线、RAG | 编程助手、自动化任务 |

---

## 二、先搞清楚几个概念：Trace、Turn

在深入源码之前，先区分一次完整运行和其中的调用轮次。本章用 Trace 指代 agent_start 到 agent_end 的正常生命周期，不表示源码另外定义了一个通用 Trace 会话类。

### Trace（一次完整运行）

一个 Trace 是从用户按下回车、到 Agent 彻底停下来、发出 `agent_end` 事件的**整个过程**。一个 Trace 包含多个 Turn。

```
一个 Trace（一次 agent_start 到 agent_end）
│
├── Turn 1：调模型 → 模型返回 toolUse（要读文件）→ 执行 read 工具
│
├── Turn 2：带着工具结果再调模型 → 模型返回 toolUse（还要改文件）→ 执行 edit 工具
│
└── Turn 3：带着工具结果再调模型 → 模型返回 stop（改好了，没有工具调用）→ agent_end
```

### Turn（一个轮次）

一个 Turn 的定义非常精确：**一次模型调用 + 这次调用触发的所有工具执行。**

每个 Turn 由一对 `turn_start` 和 `turn_end` 事件包裹。关键点：**一个 Turn 只有一次模型调用。** 模型返回了 toolUse → 执行那批工具 → 发送 turn_end → 这个 Turn 就结束了。把工具结果喂回去再调模型，那是**下一个 Turn**。

看代码就更清楚了。内层循环每一圈的结构（后面会详讲）：

```
while (hasMoreToolCalls || pendingMessages.length > 0) {
    if (!firstTurn) emit(turn_start);    // ← 新 Turn 开始

    处理 pendingMessages
    streamAssistantResponse()             // ← 一次模型调用
    检查 stopReason
    executeToolCalls()                    // ← 执行这个 Turn 触发的一批工具
    emit(turn_end);                       // ← 这个 Turn 结束

    prepareNextTurn / shouldStopAfterTurn / 检查 steering
}
```

**一圈内层循环 = 一个 Turn = 一次 turn_start → 一次模型调用 → 工具执行 → 一次 turn_end。**

如果模型在一个 Turn 中一口气要求了 3 个工具（read + grep + find），那这 3 个工具都在同一个 Turn 里执行——因为它们都是同一次模型调用的产物。但执行完毕后把结果喂回去再调模型的那一刻，就已经进入下一个 Turn 了。

### 所以 Trace 和 Turn 的关系就是

```
Trace（一次完整运行）
│  agent_start
│
├── Turn 1
│   │  turn_start
│   ├── 调模型 → toolUse → 执行工具（read + grep）
│   │  turn_end
│   │
├── Turn 2
│   │  turn_start
│   ├── 调模型 → toolUse → 执行工具（edit）
│   │  turn_end
│   │
├── Turn 3
│   │  turn_start
│   ├── 调模型 → stop → 没有工具
│   │  turn_end
│   │
│   agent_end
```

> 注意：首轮 Turn 的 `turn_start` 是在 `runAgentLoop()` 入口就发出的，然后 `runLoop()` 内用 `firstTurn` 标志跳过首圈的 turn_start，避免重复。

![Trace 与 Turn 的嵌套结构](assets/260702-ch03-trace-turn-nesting.svg)

**配图说明**：一个 Trace 外壳内嵌 3 个 Turn，每个 Turn 都是"模型调用 + 工具执行"的完整闭环。注意 Turn 3 没有 ToolCall（虚线框），它的 stopReason = stop 触发循环退出。

---

## 三、全景：一条消息的旅程，以及循环怎么转

你输入了"帮我读一下 src/main.ts"并按下回车。从这一刻起发生了什么？让我们站在高处看一遍全过程，同时把"循环怎么转起来的"和"循环什么时候停"一并讲清楚。**不必纠结每个细节**——后面会逐段拆解源码。

> 途中你会遇到四个反复出现的"实体"：你的输入变成**消息（Message）**；Loop 调用**模型（Model）**来思考；模型要求的操作用**工具（Tool）**完成；每一步通过**事件（Event）**通知外部。驱动这四者反复运转的机制就是本章主角——**Agent Loop**。

### 流程全景

```
你按下回车："帮我读一下 src/main.ts"
│
│  ① 你的输入变成一条消息
│
UserMessage { role: "user", content: "帮我读一下 src/main.ts" }
│
│  ② 进入循环（agentLoop 入口）—— agent_start（一个 Trace 开始了）
│
└── runLoop()
    │
    │  ③ 消息转换（AgentMessage → LLM 认识的 Message）
    │
    │  ┌── Turn 1 ──────────────────────────────────────────┐
    │  │  turn_start                                         │
    │  │  ④ 调用 Model（每 Turn 仅一次模型调用）               │
    │  │  streamSimple(model, { systemPrompt, messages })    │
    │  │       ↓ 逐 token 流式返回                            │
    │  │  AssistantMessage {                                  │
    │  │      content: [ ..., ToolCall { name: "read", ... } ],│
    │  │      stopReason: "toolUse"  ← 有工具调用，继续转      │
    │  │  }                                                  │
    │  │  ⑤ 执行 Tool（工具的五步管道，详见第5章）              │
    │  │  ToolResultMessage { content: [{ text: "文件内容" }] }│
    │  │  turn_end                                            │
    │  └─────────────────────────────────────────────────────┘
    │
    │  循环判断：stopReason 是 toolUse → hasMoreToolCalls = true → 继续
    │
    │  ┌── Turn 2 ──────────────────────────────────────────┐
    │  │  turn_start                                         │
    │  │  ⑥ 第二次调用 Model（工具结果已追加到消息列表）         │
    │  │  streamSimple(model, { messages: [..., toolResult] })│
    │  │       ↓ 模型看到文件内容，开始解释                      │
    │  │  AssistantMessage {                                  │
    │  │      content: [ TextContent { text: "这个文件..." } ],│
    │  │      stopReason: "stop"  ← 没有工具调用，准备停        │
    │  │  }                                                  │
    │  │  turn_end                                            │
    │  └─────────────────────────────────────────────────────┘
    │
    │  循环判断：hasMoreToolCalls = false，pendingMessages 为空
    │  → 内层循环退出
    │  → 外层循环检查 followUp → 空 → 外层循环退出
    │
    └── agent_end（一个 Trace 结束，共 2 个 Turn）
```

### 循环怎么转：工具调用、stopReason 与队列

`stopReason` 很重要，但它不是唯一的"信号灯"。Agent Loop 还要检查助手消息中的 `toolCall` 内容块、工具批次的 `terminate` 结果，以及 steering / follow-up 队列。模型输出有没有工具调用，才决定是否进入工具执行分支。

`StopReason` 联合类型包含七个值：

| stopReason | 含义与处理 |
|------------|------------|
| `stop` | Provider 归一化后的正常停止；没有工具调用时，内层循环准备结束 |
| `toolUse` | Provider 表示因工具调用停止；循环仍以消息里的 `toolCall` 块作为执行依据 |
| `length` | 输出达到 token 上限。若消息中含工具调用，Pi 把每个调用标记为未执行的错误结果，避免执行可能被截断的参数 |
| `error` | 模型请求或流式处理失败；核心 `runAgentLoop()` 发出 `turn_end` 和 `agent_end` 后直接返回，不在低层 Loop 自动重试 |
| `aborted` | 请求因取消而结束；走与 `error` 相同的硬停止分支，不在低层 Loop 自动重试 |
| `pending` | 流式响应尚未形成最终停止结果的状态 |
| `deferred` | 表示延迟响应相关状态；它本身不构成 Agent Loop 的自动挂起/恢复协议 |

`stop`、`toolUse`、`length` 通常来自 Provider 对响应结束原因的归一化；`error` 和 `aborted` 是流式层用于表达失败或取消的结果。核心 `runAgentLoop()` 对后二者直接结束当前运行，不做自动 retry；coding-agent 的 Session 层可按自身策略处理可重试错误。`pending`、`deferred` 是联合类型里的额外状态，不能单凭它们推断循环会如何继续。

> 源码位置：`packages/ai/src/types.ts` · `StopReason`；`packages/agent/src/agent-loop.ts` · `runLoop()`、`failToolCallsFromTruncatedMessage()`。

### 实际的分支判断

收到助手消息后，Loop 先对 `error` / `aborted` 做硬停止检查，再提取 `toolCall` 内容块。下面是核心分支的摘录；队列和事件细节省略：

```typescript
const toolCalls = message.content.filter((item) => item.type === "toolCall");

const toolResults: ToolResultMessage[] = [];
hasMoreToolCalls = false;

if (toolCalls.length > 0) {
  const executedToolBatch =
    message.stopReason === "length"
      ? await failToolCallsFromTruncatedMessage(toolCalls, emit)
      : await executeToolCalls(currentContext, message, config, signal, emit);

  toolResults.push(...executedToolBatch.messages);
  hasMoreToolCalls = !executedToolBatch.terminate;
}
```

因此，循环决策分成几步：

- `error` / `aborted` → 发出本轮结束事件和 Agent 结束事件，立即返回，不再检查 follow-up
- 其他状态下有 `toolCall` → 进入工具结果分支；但 `length` 会生成失败结果，不会执行这些被截断的调用
- 有工具调用且批次没有终止 → 把结果追加到上下文，再调模型
- 没有工具调用，或批次设置了终止条件 → 检查 steering / follow-up 队列；队列为空才结束

`deferred` 不会让通用 Agent Loop 自动保存现场、等待外部恢复。它仍走上面常规的消息与队列处理；是否由产品层提供延迟响应体验，取决于更上层的专门机制。

### 循环的所有退出路径

![stopReason 驱动的循环决策流程](assets/260702-ch03-stopreason-flowchart.svg)

**配图说明**：图示展示常见的 stop、toolUse、length、error、aborted 五种分支；循环实际还检查工具调用内容块和消息队列。length 携带工具调用时会生成失败结果而不执行，error / aborted 则直接结束当前 Loop。pending 和 deferred 不是图中的自动恢复分支。

| 退出路径 | 触发条件 | 原因 |
|----------|----------|------|
| **正常退出** | 没有待执行工具批次，steering / follow-up 队列也为空 | stop 常见；length 携带工具调用时会先生成错误结果并重新请求模型 |
| **硬停止** | `error` / `aborted` | 模型调用本身出了问题，继续跑没意义，不检查 followUp |
| **外部钩子停** | `shouldStopAfterTurn()` 返回 true | 上下文快满了、达到最大 Turn 数等 |
| **工具终止** | 一批工具的执行结果全部 `terminate: true` | 所有工具都同意停止（是 `every` 不是 `some`） |

---

## 四、源码详解：基础 Loop 与可选的叠加设计

§三 给了你概念全景：消息怎么流动、stopReason 怎么驱动循环、什么时候停。但那都是"**是什么**"。这一节走进代码，回答"**怎么做到的**"。

在看 Pi 的源码之前，先搞清楚一件事：**最简单的 Agent Loop 其实极其简短。**

### 最简 Loop：所有 Agent 的最小公约数

剥掉所有产品特性，一个能用的 Agent Loop 只需要这些：

```typescript
// 教学用简化示意；省略类型定义、校验与错误处理
async function simpleLoop(messages, model, tools) {
    while (true) {
        const response = await callModel(model, messages, tools);
        messages.push(response);

        const toolCalls = response.content.filter((item) => item.type === "toolCall");
        if (toolCalls.length === 0) {
            return messages;
        }

        for (const toolCall of toolCalls) {
            const result = await executeTool(toolCall);
            messages.push(result);
        }
    }
}
```

十几行代码。一个 while 循环，调模型、执行工具、再调模型，直到模型不再要求工具。这就是 §三 讲的那套逻辑的最小实现——**任何 Agent 都需要这个内核**。

### 交互式产品在此基础上还需要什么

Pi 的 coding-agent 是一个**交互式编程助手**——用户在终端里跟它对话，它可能要读好几个文件、改代码、跑测试。这种产品场景比"最简 Loop"多出了真实的需求：

| 真实需求 | 叠加的设计 | 源码位置 |
|----------|-----------|----------|
| 用户在 Agent 工作期间又输入了新指令 | **steering 消息注入**：紧急消息可以在 Turn 之间插队 | 内层循环开头 |
| 系统在 Agent 完成后想追加后续任务（如"顺便跑个测试"） | **外层 followUp 循环**：内层停了但外层可以重启内层 | 外层 while(true) |
| 不同复杂度的任务想用不同档次的模型 | **prepareNextTurn 钩子**：每个 Turn 结束时可切换模型/上下文 | turn_end 之后 |
| 上下文窗口快满了需要触发压缩 | **shouldStopAfterTurn 钩子**：外部判断是否该停 | prepareNextTurn 之后 |

**关键认知**：这里的“内核 + 叠加”是教学拆分，不是包的物理边界。steering、follow-up 与收尾钩子已经实现于 agent-core 的 `runLoop()` / `Agent`，coding-agent 再通过 `AgentSession` 组装和使用；简单宿主可以不提供这些可选回调。如果你做的是一个"一问一答带工具"的简单 Agent，上面这张表全是多余的——你只需要最简 Loop。

但理解 coding-agent 怎么叠加这些设计很有价值——你自己的产品场景很可能也需要类似机制。接下来，我们以 agent-core 中的完整 runLoop 实现为例，逐段走这些设计。跟着那条"帮我读一下 src/main.ts"的消息，走完从入口到结束的整段旅程。

### 4.1 入口：runAgentLoop() 收到了什么

> §三简要展示了流程全景，这里展开看代码细节——同一个过程，更深入的视角。

你按下回车后，调用链是：`Agent.prompt()` → `runPromptMessages()` → `runAgentLoop()`。停在入口：

```typescript
// packages/agent/src/agent-loop.ts
async function runAgentLoop(
    prompts: AgentMessage[],     // 你的消息
    context: AgentContext,       // 当前对话上下文（快照副本）
    config: AgentLoopConfig,     // 循环配置（模型、钩子、队列回调）
    emit: AgentEventSink,        // 事件发射器
    signal: AbortSignal | undefined, // 中止信号
    streamFn: StreamFn,                // 必需的流式函数
): Promise<AgentMessage[]>
```

六个参数中最重要的三个：

**`prompts`** — 你的消息已经被包装成了标准格式：

```typescript
[{
  role: "user",
  content: [{ type: "text", text: "帮我读一下 src/main.ts" }],
  timestamp: 1748000000000
}]
```

**`context`** — 对话上下文快照。注意是**副本**（`packages/agent/src/agent.ts` 的 `createContextSnapshot()` 创建），Loop 运行期间对 context 的修改不会影响 Agent 类的原始状态：

```typescript
// AgentContext 结构示意；Type 来自 typebox，历史消息在此省略。
const context = {
  systemPrompt: "You are a helpful coding assistant...",
  messages: [ /* 之前的对话历史 */ ],
  tools: [
    { name: "read", label: "Read", description: "Read a file", parameters: Type.Object({ path: Type.String() }), execute: async () => ({ content: [], details: {} }) },
    { name: "bash", label: "Bash", description: "Run a command", parameters: Type.Object({ command: Type.String() }), execute: async () => ({ content: [], details: {} }) },
  ]
};
```

**`config`** — Loop 的行为配置。这里有一组关键钩子（都是函数，不是数据）：

```typescript
import type { AgentLoopConfig } from "@earendil-works/pi-agent-core";

// 用 Pick 展示关键字段；完整字段签名仍以 AgentLoopConfig 为准。
type LoopConfigSketch = Pick<AgentLoopConfig,
    | "model"                    // 用哪个 LLM
    | "convertToLlm"             // AgentMessage[] → Message[]
    | "transformContext"         // 可选的消息预处理
    | "getSteeringMessages"      // 紧急插队消息
    | "getFollowUpMessages"      // 追加任务
    | "prepareNextTurn"          // 替换下一轮配置
    | "shouldStopAfterTurn"      // 本轮完成后主动停止
    | "beforeToolCall"           // 工具执行前钩子
    | "afterToolCall"            // 工具执行后钩子
    | "toolExecution"            // parallel / sequential
>;
```

这些钩子都是**函数**而非数据——Loop 在运行时调用它们来"拉取"最新状态。这让 Loop 和外部消息来源彻底解耦。

入口函数只做了三步准备：

```
Step 1: 创建 newMessages 数组
        → 收集本轮 Trace 产生的所有新消息

Step 2: 把 prompts 追加到 context.messages
        → context.messages = [...context.messages, ...prompts]

Step 3: 发初始事件
        → emit("agent_start")    ← Trace 开始
        → emit("turn_start")     ← 首轮 Turn 开始（入口就发，后续 Turn 在内层循环里发）
        → 对每条 prompt：emit("message_start") + emit("message_end")
        → 调用 runLoop()
```

数据变化：

```
入口前：
  context.messages = [user1, asst1, toolResult1]    ← 之前的对话
  newMessages = []

入口后：
  context.messages = [user1, asst1, toolResult1, user2]  ← 你的消息被追加
  newMessages = [user2]                                   ← 收集器开始记录
```

---

### 4.2 runLoop() 的骨架：先看内核，再看叠加

现在进入 `runLoop()`——整个系统最核心的代码。别被它的长度吓到，我们先看**内核**，再看**叠加**。

#### 内核：内层循环

如果只保留最简 Loop 的逻辑，`runLoop` 长这样：

```typescript
// 只保留内核的 runLoop（伪代码）
while (hasMoreToolCalls) {
    // 步骤 B：调 LLM
    // 步骤 C：检查 stopReason → error/aborted 就退出
    // 步骤 D：执行工具
    // 步骤 E：emit turn_end
}
// 结束 → emit agent_end
```

这就是最简 Loop——调模型、执行工具、turn_end，循环往复。内层循环的退出条件 `hasMoreToolCalls` 由 `toolCalls 数组长度 > 0 && !terminate` 驱动（§三讲过）。**这段是所有 Agent 都需要的内核。**

#### 叠加：框架提供的两类消息队列

但 coding-agent 作为交互式编程助手，需要在内核外面加两样东西：

**叠加 1：steering 消息注入**（runLoop 开始时与每圈内层循环结尾读取队列，下一圈开始时处理已读取的消息）。用户在 Agent 工作时输入了新指令——这些消息不能等当前任务跑完，得在下一圈开头紧急注入。所以内层循环条件多了一个 `|| pendingMessages.length > 0`。

**叠加 2：外层 followUp 循环**（包在整个内层循环外面）。Agent 自然停了之后，系统可能还想追加任务（比如"顺便跑个测试"）。外层循环让这些追加任务在**同一个 Trace 内**继续跑，不需要重新启动一个新的 Loop。

把内核和两层叠加拼起来，才是完整的 `runLoop` 骨架：

```typescript
async function runLoop(currentContext, newMessages, config, signal, emit, streamFn) {

    // ① 首次 steering 检查（在进入内层循环之前！）
    let pendingMessages = (await config.getSteeringMessages?.()) || [];

    // ========== 叠加2：外层循环（followUp 续命）==========
    while (true) {
        let hasMoreToolCalls = true;
        let firstTurn = true;  // 首轮跳过 turn_start（入口已发）

        // ========== 内核 + 叠加1：内层循环 ==========
        while (hasMoreToolCalls || pendingMessages.length > 0) {
            //                                    ↑ 叠加1：steering 消息也驱动循环

            if (!firstTurn) {
                emit({ type: "turn_start" });
            }
            firstTurn = false;

            // 步骤 A：注入 pendingMessages（steering 消息）← 叠加1
            // 步骤 B：调 LLM → streamAssistantResponse()  ← 内核
            // 步骤 C：检查 stopReason                      ← 内核
            // 步骤 D：执行工具                              ← 内核
            // 步骤 E：emit turn_end                         ← 内核
            // 步骤 F：prepareNextTurn → shouldStopAfterTurn ← 叠加（钩子）
            //         → 再次检查 steering                    ← 叠加1
        }

        // ========== 内层循环结束 ==========
        // 叠加2：检查 followUp 队列
        const followUpMessages = (await config.getFollowUpMessages?.()) || [];
        if (followUpMessages.length > 0) {
            pendingMessages = followUpMessages;
            continue;  // 回到外层循环顶部，内层循环重开
        }

        break;  // 两个队列都空，真正退出
    }
}
```

现在我们逐步骤展开。每个步骤会标注"内核"还是"叠加"，方便你区分。

---

### 4.3 【叠加1 · 步骤A】steering 消息注入

> **什么是 steering？** 这是 coding-agent 的一个交互功能。想象你让 Agent 帮你修一个 bug，Agent 正在读文件、分析代码。这时候你突然想到一个补充："也检查一下测试文件"——你希望这条指令能**插队**，而不是等 Agent 把当前任务做完再说。

steering 就是这个"插队"机制。用户在 Agent 工作期间输入的新指令，会被放进 steering 队列。Loop 在进入运行时与每圈结尾读取队列，下一圈开头把已读取的 pendingMessages 注入到当前对话中：

```typescript
if (pendingMessages.length > 0) {
    for (const message of pendingMessages) {
        await emit({ type: "message_start", message });
        await emit({ type: "message_end", message });
        currentContext.messages.push(message);
        newMessages.push(message);
    }
    pendingMessages = [];  // 消费完毕，清空
}
```

这段代码就是把紧急消息逐条注入到上下文和消息收集器中。

pendingMessages 的第一个来源是 `runLoop` 一进来就执行的首次 steering 检查（`packages/agent/src/agent-loop.ts`）。为什么要在进入循环**之前**就检查？因为用户在等待 LLM 首次响应时可能又输入了内容——这时候消息已经从外部排队了，但循环还没开始，如果不提前取出来，这批消息就漏掉了。

---

### 4.4 【内核 · 步骤B】streamAssistantResponse() — 调 LLM

这是整个 Loop 最重的一步——把消息发给模型、拿回流式响应。分为四个阶段。

#### 阶段 A：上下文预处理（可选）

```typescript
let messages = context.messages;
if (config.transformContext) {
    messages = await config.transformContext(messages, signal);
}
```

如果配置了 `transformContext`（如压缩算法），在此预处理消息。不配置就跳过。

#### 阶段 B：AgentMessage → Message 转换（两层消息的边界）

```typescript
const llmMessages = await config.convertToLlm(messages);
```

这一行站在 Agent 内核和 LLM 的**边界**上。要理解它为什么存在，得先知道"两层消息"的设计。

Agent 内部维护对话历史时，需要记录的不只是"用户说了什么、AI 回了什么"——它还需要记录**自己的内部状态**。比如 coding-agent 会记录：上下文被压缩过（`CompactionSummaryMessage`）、Bash 命令的执行详情（`BashExecutionMessage`）、分支切换的记录（`BranchSummaryMessage`）。这些是 Agent 自己用的"内部语言"，**LLM 根本不认识这些消息类型**——它只认三种标准消息：`UserMessage`、`AssistantMessage`、`ToolResultMessage`。

`convertToLlm` 就是站在这个边界上的**翻译官**：把 Agent 的内部语言翻译成 LLM 能理解的协议。默认实现就是一个 `.filter()`——只保留三种标准消息：

```typescript
function defaultConvertToLlm(messages: AgentMessage[]): Message[] {
    return messages.filter(
        (message) => message.role === "user"
                  || message.role === "assistant"
                  || message.role === "toolResult",
    );
}
```

数据变换：

```
转换前（AgentMessage[]）：
[
  { role: "user", content: "帮我读一下 src/main.ts", ... },    ← 保留
  { role: "assistant", content: [...], ... },                   ← 保留
  { role: "compactionSummary", summary: "之前的对话摘要..." },   ← 过滤掉
  { role: "toolResult", content: [...], ... },                  ← 保留
]

转换后（Message[]）：
[
  { role: "user", content: "帮我读一下 src/main.ts", ... },
  { role: "assistant", content: [...], ... },
  { role: "toolResult", content: [...], ... },
]
```

> 两层消息的完整设计，详见《第6章：消息系统》。

#### 阶段 C：构建 Context 并调用模型

```typescript
const llmContext: Context = {
    systemPrompt: context.systemPrompt,
    messages: llmMessages,
    tools: context.tools,
};

const streamFunction = streamFn;
const resolvedApiKey =
    (config.getApiKey ? await config.getApiKey(config.model.provider) : undefined)
    || config.apiKey;

const response = await streamFunction(config.model, llmContext, {
    ...config,
    apiKey: resolvedApiKey,
    signal,
});
```

**构建 Context 是这一步的主线。** `llmContext` 是每次请求构造的新对象；其中 `tools` 与 `systemPrompt` 的引用是否复用、内容是否变化，取决于当前配置和扩展，不应概括成跨 Turn 字节稳定。它由三部分组成：

- **`systemPrompt`** —— 直接复用 Agent 上下文里的系统提示词，告诉模型"你是谁、该遵守什么规则"
- **`messages`** —— 就是上一步 `convertToLlm` 过滤后的 `llmMessages`，只含 LLM 认识的三种标准消息
- **`tools`** —— 工具列表（带 schema 定义），让模型知道"这次有哪些工具可以调"

为什么每次都构造请求 Context？这让本轮实际使用的 `systemPrompt`、`messages` 与 `tools` 组成清晰；具体内容是否复用由调用方传入的上下文决定。

**缓存标记由 Provider adapter 按协议构造。** Anthropic Messages adapter 在缓存启用时，会在系统提示块、最后一个工具定义和最后一条用户消息等位置加入 `cache_control`，具体请求布局由 `buildParams()`、`convertTools()` 与 `convertMessages()` 负责。对象引用相同不等于请求字节稳定，缓存命中也取决于 Provider 对前缀和 cache key 的定义。

OpenAI-compatible adapter 在支持缓存的条件下会用 `sessionId` 构造 `prompt_cache_key`；其他兼容 Anthropic `cache_control` 的 provider adapter 则由各自协议转换逻辑处理。

#### 阶段 D：流式处理响应 —— 原地替换的妙用

`streamFunction` 返回的是 `AssistantMessageEventStream`——一个异步迭代器。这步有一个很精巧的设计：

```typescript
for await (const event of response) {
    switch (event.type) {
        case "start":
            // 拿到一个"空壳"消息，直接 push 到 context
            partialMessage = event.partial;
            context.messages.push(partialMessage);
            await emit({ type: "message_start", message: partialMessage });
            break;

        case "text_delta":       // 文本增量
        case "toolcall_delta":   // 工具调用增量
        case "thinking_delta":   // 思考增量
            partialMessage = event.partial;            // 更新后的部分消息
            context.messages[last] = partialMessage;    // ★ 原地替换！
            await emit({ type: "message_update", message: partialMessage, assistantMessageEvent: event });
            break;

        case "done":
        case "error":
            finalMessage = await response.result();
            context.messages[last] = finalMessage;       // ★ 用最终完整消息替换
            await emit({ type: "message_end", message: finalMessage });
            return finalMessage;
    }
}
```

为什么要先 push 空壳再原地替换？注意"原地替换"的意思——不是往 `context.messages` 数组里 push 新条目，而是**用新内容覆盖最后一条**（`context.messages[last] = partialMessage`）。这样 context 的消息数量不变，但最后一条消息的内容在"长大"。

为了**UI 能实时展示**。如果等全部响应完成才 push 到 context，用户在 LLM 思考的几秒里盯着空白屏幕。通过"先放空壳、逐 token 替换"，UI 通过 `message_update` 事件拿到最新部分消息，能做到逐字渲染。

![流式响应原地替换的时间线](assets/260702-ch03-streaming-replace.svg)

**配图说明**：四个时间点的 `context.messages[last]` 演变——start 时空壳、增量事件时内容增长、done/error 时最终消息替换。Loop 对每个 `emit` 使用 `await`，监听链会参与这条事件处理路径。

数据在流式响应期间，`context.messages[last]` 的演变：

```
start    → { role: "assistant", content: [] }                    ← 空壳 push
text_delta → { content: [{ type:"text", text:"好的..." }] }       ← 文字在长
toolcall   → { content: [{ text:"好的..." },                        ← 工具调用出现
                         { type:"toolCall", name:"read", arguments:{file_path:"src/main.ts"} }] }
done     → { content: [...], stopReason:"toolUse", usage:{...} } ← 最终完整消息替换
```

---

### 4.5 【内核 · 步骤C】检查 stopReason

§三详细讲了 `stopReason` 的来源和含义。这里看代码怎么处理它。拿到 `AssistantMessage` 后，立即做一次硬停止判断：

```typescript
// packages/agent/src/agent-loop.ts
if (message.stopReason === "error" || message.stopReason === "aborted") {
    await emit({ type: "turn_end", message, toolResults: [] });
    await emit({ type: "agent_end", messages: newMessages });
    return;   // ← 直接退出整个 runLoop，不检查 followUp
}
```

`error` 和 `aborted` 是"硬停止"——立即发 turn_end + agent_end，直接 return。连工具都不执行，连 followUp 都不检查。这是一种**快速失败**（fail fast）策略：既然模型调用本身就失败了（网络异常或用户中止），继续跑没有任何意义。

其他状态会继续进入工具调用分支检查。length 携带工具调用时会逐个返回错误结果而不执行；没有工具调用时，Loop 再检查队列和收尾钩子。

---

### 4.6 【内核 · 步骤D】executeToolCalls() — 执行工具

模型返回的 `AssistantMessage.content` 里，可能有多个 `type === "toolCall"` 的块（模型一口气要求了多个操作）。先过滤出来：

```typescript
const toolCalls = message.content.filter((c) => c.type === "toolCall");
```

然后决定这批工具**并行还是串行**执行：

```typescript
if (config.toolExecution === "sequential" || hasSequentialToolCall) {
    return executeToolCallsSequential(currentContext, message, toolCalls, config, signal, emit);
}
return executeToolCallsParallel(currentContext, message, toolCalls, config, signal, emit);
```

**"一票否决"策略**：只要这批工具中有**任何一个**声明了 `executionMode: "sequential"`，整批都串行。为什么这么保守？因为判断"哪些工具会冲突"很难——edit 和 edit 操作不同文件就安全吗？万一它们编辑的文件有依赖关系呢？所以 Pi 选择了"宁可多等，不可出错"。而 edit 工具内部还有第二道防线（`withFileMutationQueue`，对同一文件的编辑串行化），确保即使外层判断为并行，也不会互相覆盖。

两种执行模式的内部结构：

```
串行模式：
  ToolCall A: 准备 → 验证 → beforeHook → 执行 → afterHook → emit end
  ToolCall B: 准备 → 验证 → beforeHook → 执行 → afterHook → emit end
  （一个完全结束，才开始下一个）

并行模式（三阶段设计）：
  阶段1 - 准备（顺序）：  A prepare → B prepare → C prepare
      ↑ 每个 prepareToolCall 包含查找、参数校验与 beforeToolCall；某个调用失败后仍继续准备后续调用
  阶段2 - 执行与收尾（并发）：各个已准备调用并发执行
      ↑ execute、afterToolCall 与 finalize 在各自任务中完成；tool_execution_end 按完成时机发出
  阶段3 - 结果入列（调用顺序）：Promise.all 收齐后按原始 ToolCall 顺序生成 ToolResultMessage
      ↑ 事件完成顺序可以不同于模型看到的结果消息顺序
```

每个工具的结果被包装成 `ToolResultMessage`，追加到 `context` 和 `newMessages`：

```
工具执行后：
  context.messages = [..., user2, assistantMessage, {
    role: "toolResult", toolCallId: "toolu_01", toolName: "read",
    content: [{ text: "文件内容..." }], isError: false
  }]
```

**terminate 机制**：工具可以在返回结果中设置 `terminate: true`，表示"我觉得不该继续了"。但 Loop 不会因为某一个工具喊停就停——它用的是 `every` 而非 `some`：**必须这批工具的全部最终结果都设置了 terminate，才停止工具链续跑**。此后 steering / follow-up 队列和收尾钩子仍按各自规则检查，因此 terminate 不等于禁止本次 Trace 再开启任何后续轮次。

> 工具执行的完整五步管道（prepareArguments → Schema 验证 → beforeToolCall → execute → afterToolCall）详见《第5章：工具系统》。

---

### 4.7 【内核+叠加 · 步骤E~F】turn_end + 钩子 + 再次检查 steering

Turn 的核心工作做完了（调模型 + 执行工具），接下来是收尾。收尾分四步：turn_end 提供生命周期边界，其余钩子和队列让宿主参与下一轮配置与续跑决策：

```typescript
// ① emit turn_end —— 通知外部"这一轮结束了"（内核）
await emit({ type: "turn_end", message, toolResults });

// ② prepareNextTurn —— 给外部一个机会"改装"下一轮（叠加）
// 返回值可包含 context / model / thinkingLevel 三者之一的覆盖
const nextTurnSnapshot = await config.prepareNextTurn?.({
    message,
    toolResults,
    context: currentContext,
    newMessages,
});
if (nextTurnSnapshot) {
    currentContext = nextTurnSnapshot.context ?? currentContext;
    config = {
        ...config,
        model: nextTurnSnapshot.model ?? config.model,
        reasoning: nextTurnSnapshot.thinkingLevel === undefined
            ? config.reasoning
            : nextTurnSnapshot.thinkingLevel === "off"
                ? undefined
                : nextTurnSnapshot.thinkingLevel,
    };
}

// ③ shouldStopAfterTurn —— 外部判断是否该停了（叠加）
if (await config.shouldStopAfterTurn?.({ message, toolResults, context: currentContext, newMessages })) {
    await emit({ type: "agent_end", messages: newMessages });
    return;
}

// ④ 再次检查 steering —— 有没有新的紧急消息？（叠加1）
pendingMessages = (await config.getSteeringMessages?.()) || [];
```

**`prepareNextTurn`** —— 这是个容易被忽略但很强大的扩展点。它在每个 turn_end 之后、下一轮开始前被调用，允许外部**动态切换下一轮的配置**。具体例子：

```
场景：按任务复杂度切换模型

Turn 1: 用户问了一个简单问题 → 模型用 Haiku（快、便宜）
        turn_end → prepareNextTurn 检查到问题很简单
        → 返回 { model: haiku } → 下一轮继续用 Haiku

场景：中途发现任务变复杂了

Turn 1: 用户让"重构这个模块" → Haiku 开始读文件
        turn_end → prepareNextTurn 发现要改的文件很多
        → 返回 { model: opus } → 下一轮自动切到 Opus（强、贵）
```

除了换模型，它还能换 `context`（比如注入新的上下文信息）和 `thinkingLevel`（思考强度）。返回 `undefined` 表示"什么都不换，按原配置继续"。

**`shouldStopAfterTurn`** —— 宿主可注入的停止判断，例如在本轮完成后主动停下。该钩子属于低层 Loop 的可选契约；当前 coding-agent 的自动压缩由 `AgentSession` 在运行结束后或下一次 prompt 前检查，不能把压缩流程直接归到这个钩子。返回 true 会在检查 steering / follow-up 前结束当前运行。

**④再次检查 steering** —— 一圈内层循环结束，再看看 steering 队列有没有新积攒的紧急消息。如果有，下一圈继续跑。

---

### 4.8 回到循环顶部

工具执行完且收尾结束，代码回到内层 while 循环的条件判断。§三已经详细讲了 `hasMoreToolCalls` 由 `toolCalls 数组长度 > 0 && !terminate` 驱动——这里只看代码：

```text
while (hasMoreToolCalls || pendingMessages.length > 0)
```

两个条件任一为 true 就继续。`hasMoreToolCalls` 由模型输出里有没有 toolCall 块（且未全部 terminate）决定（内核），`pendingMessages` 由 steering 队列决定（叠加1）。两个都为 false 时，内层循环退出。

---

### 4.9 【叠加2 · 步骤G】外层循环：followUp 的续命机制

内层循环退出了——没有工具要执行，也没有紧急消息。但低层 runLoop 仍会在此时检查 `getFollowUpMessages()`，看看系统有没有追加任务：

```typescript
const followUpMessages = (await config.getFollowUpMessages?.()) || [];
if (followUpMessages.length > 0) {
    pendingMessages = followUpMessages;   // 塞进 pending，触发新 Turn
    continue;                              // 回到外层循环顶部
}
break;  // 两个队列都空了，真正退出
```

如果有 followUp 消息，它们被塞进 `pendingMessages`，`continue` 回到外层循环顶部，内层循环检测到 `pendingMessages` 不为空，**在同一个 Trace 内**继续跑。这比重新启动一个新的 `runAgentLoop()` 好在哪？——连续性：同一个 `newMessages` 数组、同一个事件序列，不需要额外合并。

§四开头已经说过：如果你做的是简单 Agent，外层循环是多余的——内层循环退出后直接 `break` + `emit agent_end` 就行了。

---

### 4.10 steering vs followUp：一张表看清两种干预

本章出现了两种"外部消息注入"机制。虽然 §四开头已经分别介绍过，但放在一起对比更能看清它们的差异：

| 维度 | steering（叠加1） | followUp（叠加2） |
|------|----------|----------|
| **检查时机** | runLoop 开始前 + 内层循环**每圈**结尾 | 内层循环**全部结束**后 |
| **语义** | "紧急插队"——当前工具批次结束后、下一次模型调用前注入 | "排队等叫号"——等当前任务全部完成 |
| **典型场景** | 用户在 Agent 工作时输入了新指令 | 系统在 Agent 完成后追加"顺便跑个测试" |

生活类比：steering 是你正在开会，有人敲门递了张纸条——"紧急，先看这个"。followUp 是开完会翻了翻信箱——"不急，但需要处理"。

![steering vs followUp 对比](assets/260702-ch03-steering-vs-followup.svg)

**配图说明**：左红右绿对照——steering 在进入 runLoop 时与每圈内层循环结尾检查、下一次模型调用前注入；followUp 在内层循环全部结束后检查、续命重启。底部列出各自时机/来源/影响/典型场景。

---

## 五、总结：Loop 的四条核心设计

回顾从按下回车到 Agent 完成的整段旅程：

### 1. ReAct 循环模式

Loop 的本质是 Reason（模型思考）→ Act（执行工具）→ Observe（观察结果）→ Reason（再次思考）的循环。模型的输出内容决定"该调什么工具"——这是 Agent 区别于 Workflow 的核心。但"什么时候停"不是模型的决策，而是我们人类定义的规则：**模型不再输出工具调用时，就认为本轮结束。**

### 2. Loop 的停止与续跑

Loop 根据停止状态、消息中的工具调用和批次结果决定是否继续；steering / follow-up 队列也会让一次 Trace 中再开启后续 Turn。

### 3. 内核 + 叠加的架构思路

Agent Loop 的内核极其简短——十几行代码就能实现一个能用的循环。agent-core 的完整实现还提供 steering（紧急插队）、followUp（任务追加）、prepareNextTurn（动态配置）和 shouldStopAfterTurn（收尾停止）等可选机制，供 coding-agent 等宿主组装使用。**内核是所有 Agent 的通用法则，叠加是产品功能的按需选择。** 做自己的 Agent 时，先搭内核，再按场景加叠加。

![Agent Loop 内核与叠加设计](assets/260702-ch03-kernel-onion.svg)

**配图说明**：从里到外的四层洋葱——最内核是最简 Loop（~10 行通用法则）；外层依次叠加 steering（紧急插队）、followUp（任务追加）、钩子（切模型/安全阀）。剥掉任何一层，里层仍能跑——这是判断"内核是否被污染"的试金石。

---

## 六、下一站

Loop 跑起来了——我们知道它怎么调用模型、怎么执行工具。但 Pi 的多家模型供应商是怎么统一接入的？streamSimple() 内部做了什么？

下一章，我们拆开 Pi 的模型调用层：《第4章：模型调用 —— 一行代码驾驭多个模型》。

---

> **本章关键源码索引**：
> - `packages/agent/src/agent-loop.ts` · `runAgentLoop()` 与 `runLoop()`：Loop 入口、双层循环与停止分支
> - `packages/agent/src/agent-loop.ts` · `streamAssistantResponse()`：上下文转换、流式调用与消息事件
> - `packages/agent/src/agent-loop.ts` · `executeToolCalls()`、`executeToolCallsParallel()`、`executeToolCallsSequential()`：批次调度
> - `packages/agent/src/agent-loop.ts` · `failToolCallsFromTruncatedMessage()`：length 响应中的工具调用失败结果
> - `packages/agent/src/agent.ts` · `PendingMessageQueue`、`runWithLifecycle()`：队列与 Agent 生命周期
