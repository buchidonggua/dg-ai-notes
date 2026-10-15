# 第6章：消息系统 —— Agent 的记忆如何组织与传递

> 源码基准：本地 `pi-main` 快照，核心包版本 `v0.84.3`，核对日期 `2026-10-12`。下文路径均相对源码根目录。

上一章我们学了工具系统——模型说"读文件"，Agent Loop 通过五步管道执行 read 工具，最终产生一条 `ToolResultMessage`。但你有没有注意到：我们一直在说"消息"这个词，却从来没拆开看过它到底长什么样。

UserMessage、AssistantMessage、ToolResultMessage——这三个名字反复出现在前五章里。第 3 章说"消息在 Loop 中流转"，第 4 章说"消息发给模型"，第 5 章说"工具结果是一条消息"。

但消息到底是什么？它的数据结构长什么样？Agent 内部的消息和发给模型的消息一样吗？

这一章就来回答这些问题。你会看到 Pi 消息系统最核心的设计——**两层消息**：Agent 内部用可扩展的 `AgentMessage` 表达，到了模型边界再翻译成 `pi-ai` 的标准 `Message`。这里的 `Message` 是 provider-neutral 类型；它不是每家模型 API 原生消息结构的总称，后续 Provider 转换层还会处理各自的协议差异。

---

## 一、开场：一条 Bash 命令的消息之旅

先从一个具体场景说起。

你在 Pi 的终端里输入了一条 Bash 命令 `!ls -la`，回车执行。命令跑完了，输出了一堆文件列表。

这条命令的信息，在 Pi 内部会变成一条 **BashExecutionMessage**——它有 `command` 字段记录命令原文、`output` 字段记录输出内容、`exitCode` 字段记录退出码。这些结构化字段让 UI 可以用专用渲染器漂亮地展示终端输出。

但问题来了：当 Agent Loop 准备调用模型时，`pi-ai` 的标准 `Message` 类型并不包含 `BashExecutionMessage`，只有 `user`、`assistant` 和 `toolResult` 三种成员。BashExecutionMessage 不属于这三种中的任何一种；它需要先经 coding-agent 的 `convertToLlm` 转成标准消息，再由 pi-ai 转换成目标 Provider 的请求格式。

那这条消息是怎么被 LLM 看到的？中间经历了什么变化？

这一章我们就跟着这条 BashExecutionMessage，从它的诞生走到 LLM 看到它的那一刻。

---

## 二、第一层：LLM 认识的消息只有三种

在了解消息怎么变换之前，先搞清楚"变换的目标"长什么样。`pi-ai` 给 Agent Loop 使用的 provider-neutral 消息格式叫做 **Message**，定义在 `packages/ai/src/types.ts`。不同 Provider 的请求格式由 pi-ai 的转换层继续处理。

它只有三个成员：

```
Message 联合类型（LLM 标准格式）
│
├── UserMessage        ← 用户说的话 / 发的图片
├── AssistantMessage   ← LLM 的回复（含思考、工具调用）
└── ToolResultMessage  ← 工具执行后的结果
```

### 每种消息的具体数据结构

**UserMessage**——最简单的一种，用户输入：

```python
# ============================================================
# 【Python 改写】对应本节 TypeScript 节选
# 原文 TS:
#   export interface UserMessage {
#       role: "user",
#       content: string | (TextContent | ImageContent)[],  // 纯文本或内容块数组
#       timestamp: number                                    // 必填，Unix 毫秒时间戳
#   }
# ============================================================

# 概念对照：TypedDict 表达字段形状；默认所有字段必填。内容块类型沿用前文。
from __future__ import annotations
from typing import Literal, TypedDict

class UserMessage(TypedDict):
    role: Literal["user"]
    content: str | list[TextContent | ImageContent]
    timestamp: int
```

content 可以是一个纯字符串，也可以是一个内容块数组。这意味着用户消息既能发文字，也能发图片。

**AssistantMessage**——LLM 的回复，字段最多。下面的节选列出所有必填字段，并保留一个可选的错误字段；其它可选字段省略：

```python
# ============================================================
# 【Python 改写】对应本节 TypeScript 节选
# 原文 TS:
#   export interface AssistantMessage {
#       role: "assistant",
#       content: (TextContent | ThinkingContent | ToolCall)[],  // 三种内容块
#       api: Api,                   // 使用的 API 类型（如 "anthropic-messages"）
#       provider: ProviderId,       // 提供商（如 "anthropic"）
#       model: string,              // 模型名（如 "claude-sonnet-4-6"）
#       usage: Usage,               // token 用量统计
#       stopReason: StopReason,     // 停止原因（第3章讲过的7种值）
#       errorMessage?: string,      // 错误信息
#       timestamp: number             // 必填，Unix 毫秒时间戳
#   }
# ============================================================

# 概念对照：必填字段直接声明，TS 的问号字段用 NotRequired；Api、Usage 等沿用前文类型。
from __future__ import annotations
from typing import Literal, NotRequired, TypedDict

class AssistantMessage(TypedDict):
    role: Literal["assistant"]
    content: list[TextContent | ThinkingContent | ToolCall]
    api: Api
    provider: ProviderId
    model: str
    usage: Usage
    stopReason: StopReason
    errorMessage: NotRequired[str]
    timestamp: int
```

这里最值得关注的是 content 字段——它不是字符串，而是一个**内容块数组**，可以包含三种东西：

```
AssistantMessage 的 content 内容块
│
├── TextContent       ← 普通文本
│     { type: "text", text: "..." }
│
├── ThinkingContent   ← 思考过程（第3章讲过，模型"在想"但不直接告诉用户的部分）
│     { type: "thinking", thinking: "..." }
│
└── ToolCall          ← 工具调用（第5章讲过，触发五步管道的入口）
      { type: "toolCall", id: "...", name: "read", arguments: { path: "..." } }
```

**一条助手消息可能同时包含文本和工具调用。** 比如 LLM 一边说"让我帮你看看这个文件"，一边发出一个 Read 工具调用——这两个内容会放在同一个 AssistantMessage 的 content 数组里。第 3 章讲的"模型回复中包含 ToolCall"就是这个结构。

> **进阶细节**：content 块里还有一些 `*Signature` 字段（`textSignature`、`thinkingSignature` 等），是某些 Provider（OpenAI、Google）要求的不透明签名 ID，下一轮请求必须原样回传。被安全过滤器编辑过的内容密文也存在这里。日常理解不需要深究，知道它是"Provider 之间的上下文连续性机制"即可。

**ToolResultMessage**——工具执行的结果（第 5 章的五步管道终点产物）：

```python
# ============================================================
# 【Python 改写】对应本节 TypeScript 节选
# 原文 TS:
#   export interface ToolResultMessage<TDetails = unknown> {
#       role: "toolResult",
#       toolCallId: string,                             // 对应哪个 ToolCall
#       toolName: string,                               // 工具名
#       content: (TextContent | ImageContent)[],        // 结果内容
#       details?: TDetails,                             // 结构化详情（给 UI 看的）
#       isError: boolean,                               // 必填，是否为工具错误结果
#       timestamp: number                               // 必填，Unix 毫秒时间戳
#   }
# ============================================================

# 概念对照：泛型结构化详情仍可选；调用 ID、内容、错误标志和时间戳必填。
from __future__ import annotations
from typing import Generic, Literal, NotRequired, TypeVar, TypedDict

TDetails = TypeVar("TDetails")

class ToolResultMessage(TypedDict, Generic[TDetails]):
    role: Literal["toolResult"]
    toolCallId: str
    toolName: str
    content: list[TextContent | ImageContent]
    details: NotRequired[TDetails]
    isError: bool
    timestamp: int
```

`UserMessage.timestamp`、`AssistantMessage.timestamp` 和 `ToolResultMessage.timestamp` 都是必填的 Unix 毫秒时间戳。`AssistantMessage` 的 `api`、`provider`、`model`、`usage`、`stopReason` 也都是必填字段；`ToolResultMessage` 的 `toolCallId`、`toolName`、`content`、`isError` 同样必填。`details`、工具 `usage` 与 `addedToolNames` 是可选字段。ToolResultMessage 通过 `toolCallId` 和 AssistantMessage 里的 ToolCall 对应起来。第 3 章提到的"工具结果必须精准关联回调用请求"就是靠这个字段。`details` 携带结构化信息给 UI 渲染用，LLM 请求不需要它。

### 一个完整的对话示例

把这三种消息串起来，一个典型的对话片段长这样：

```
messages 数组：
│
├── [0] UserMessage
│       role: "user"
│       content: "帮我看看 auth.ts"
│
├── [1] AssistantMessage
│       role: "assistant"
│       content: [
│           { type: "text", text: "让我帮你看看这个文件" },
│           { type: "toolCall", id: "tc_001", name: "read", arguments: { path: "auth.ts" } }
│       ]
│       stopReason: "toolUse"     ← 第3章讲过：调了工具，循环继续
│
├── [2] ToolResultMessage
│       role: "toolResult"
│       toolCallId: "tc_001"      ← 和上面的 id 对应
│       content: [{ type: "text", text: "import { auth } from '...' ..." }]
│       isError: false            ← 第5章讲过：正常结果
│
└── [3] AssistantMessage
        role: "assistant"
        content: [{ type: "text", text: "auth.ts 是一个认证模块..." }]
        stopReason: "stop"        ← 没调工具，循环结束
```

这就是 LLM 能理解的世界——用户说了什么、AI 回了什么、工具返回了什么，就这么三种。

---

## 三、矛盾：Agent 里的消息不止三种

好，现在回到开头的场景。你执行了 `!ls -la`，Pi 内部需要记录这次执行的信息。

这里其实藏着一个更普遍的问题：**Agent 内部除了"LLM 对话"这件事，还有大量功能性数据要管理**——Bash 命令的执行记录、上下文被压缩后的摘要、会话分支切换的记录、用户上传的附件元信息……

这些功能性数据有**两个独立的读者**，两个读者的需求是冲突的：

- **UI 端**需要结构化字段——Bash 执行要分别拿到 `command`、`output`、`exitCode`、`cancelled`、`truncated`，才能在终端里漂亮地渲染（命令用高亮、输出用等宽字体、退出码用颜色标识）
- **LLM 端**只需要看一段扁平文本——"用户执行了 `ls -la`，输出是 `file1.txt\nfile2.txt\n...`"，这一段文本塞进 `UserMessage.content` 就够用了

冲突点在哪？**如果为了 LLM 把字段提前拍扁存进 `UserMessage`，UI 就再也拿不回结构化数据了**——你已经搅成一锅粥。反过来，如果只存结构化的自定义消息、不在模型边界转换，那模型就会失忆——下一轮它不知道用户刚才执行了什么。

Pi 的设计是**两边都照顾到**：**以结构化的形式放进 `context.messages`**（满足 Agent 内部处理和 UI 展示），**在调用模型的边界上做一次翻译**（满足标准消息协议）。这样宿主可以保留结构化字段，模型也能看到它需要的内容。翻译是在最后一刻发生的、有损的、单向的——损失掉的结构化字段仍留在 Agent 自己的消息状态中。

消息类型本身不负责持久化。低层 `pi-agent-core` 的 `Agent` 维护内存状态，不会自动写会话文件或执行上下文压缩；`coding-agent` 的 `AgentSession`/`SessionManager` 才负责把会话项写入和恢复。下面谈到持久化时，范围指 coding-agent 宿主。

**Pi 的解法是：允许应用自定义消息类型。** `pi-agent-core` 在 AgentMessage 联合类型里预留了一个扩展点（叫 `CustomAgentMessages`，下一节会展开它的实现原理），应用通过 TypeScript 的声明合并往里加自己的消息类型。每个应用只注册自己需要的——核心包零依赖，应用层全栈类型安全。

以 pi 自带的 coding-agent 为例，它在 `packages/coding-agent/src/core/messages.ts` 里声明了 4 种自定义消息，扩展后的 `AgentMessage` 因此在这个应用中有 7 个成员：

```
coding-agent 的自定义消息类型
│
├── BashExecutionMessage       ← Bash 命令执行记录
├── CustomMessage              ← 扩展注入的通用消息
├── BranchSummaryMessage       ← 分支切换时的摘要
└── CompactionSummaryMessage   ← 上下文压缩后的摘要
```

每种都有自己的结构化字段。以 BashExecutionMessage 为例：

```python
# ============================================================
# 【Python 改写】对应本节 TypeScript 节选
# 原文 TS:
#   export interface BashExecutionMessage {
#       role: "bashExecution",
#       command: string,          // 命令原文："ls -la"
#       output: string,           // 输出内容："file1.txt\nfile2.txt\n..."
#       exitCode: number | undefined,  // 退出码：0
#       cancelled: boolean,       // 是否被取消
#       truncated: boolean,       // 输出是否被截断
#       fullOutputPath?: string,  // 截断时的完整输出文件路径
#       timestamp: number,
#       excludeFromContext?: boolean  // 是否排除在 LLM 上下文之外
#   }
# ============================================================

# 概念对照：字段名称保留消息数据协议；exitCode 必须存在但值可为空，两个问号字段可缺省。
from typing import Literal, NotRequired, TypedDict

class BashExecutionMessage(TypedDict):
    role: Literal["bashExecution"]
    command: str
    output: str
    exitCode: int | None
    cancelled: bool
    truncated: bool
    fullOutputPath: NotRequired[str]
    timestamp: int
    excludeFromContext: NotRequired[bool]
```

结构化字段全保留下来了。但这里要停下来强调一下——**自定义消息不只是"翻译给 LLM 用的中间格式"那么简单，它本身带来了三个独立的能力**：

**1. UI 专用渲染**。UI 根据 `role` 字段做分派——`bashExecution` 用终端样式渲染、`compactionSummary` 用摘要卡片渲染，命令、输出、退出码各占一行，互不干扰。如果没有自定义消息，UI 只能拿到一段扁平文本，所有渲染花样都得退回到"全是大段文字"。

**2. 宿主持久化**。coding-agent 的 `SessionManager` 把普通消息、Bash 执行和扩展自定义消息按会话项保存；分支摘要和压缩摘要也由宿主的会话层保存。重新载入时，宿主按这些记录恢复消息状态。这个能力来自 `AgentSession`/`SessionManager`，不是低层 `AgentMessage` 联合类型自动提供的。

**3. 精细化可见性控制**。自定义消息可以有自己的字段，并在 `convertToLlm` 翻译时做特殊处理。coding-agent 的 `BashExecutionMessage` 用 `excludeFromContext` 控制是否进入模型上下文；`CustomMessage.display` 则控制是否显示在 TUI，`details` 保留扩展元数据且不发送给模型。**标准消息没有这些 coding-agent 专用开关**，宿主需要通过扩展消息或其它上下文策略实现相应行为。

所以后面 §五 讲到 `convertToLlm` 翻译、§七 讲到 `excludeFromContext` 过滤时，请记住：**这两件事让宿主可以保留内部结构，同时选择要提供给模型的内容**。翻译是为了让模型看到标准消息；过滤让某些消息留在宿主消息状态中、但不进入模型上下文。

但这里有个根本性的问题：**Message 联合类型是封闭的——只有 UserMessage、AssistantMessage、ToolResultMessage 三种。** 这 4 种自定义消息不属于 Message 类型。那它们怎么被 Agent 系统接受并处理的？

---

## 四、第二层：AgentMessage —— 内富外严的双层设计

这就是 Pi 消息系统的核心设计：**不用一种格式打天下，而是用两层——内层丰富、外层严格。**

![两层消息——内富外严的双层设计](assets/260702-ch06-two-layer-messages.svg)

**配图说明**：以 coding-agent 为例，顶部 AgentMessage 联合类型由 3 种标准消息和 4 种自定义消息组成。中间红色虚线是 convertToLlm() 翻译边界。底部模型只看到 3 种标准消息；BashExecutionMessage 可被过滤，其它 coding-agent 自定义消息在此转换器中变成 UserMessage。

### AgentMessage 联合类型

`packages/agent/src/types.ts` 中的关键定义是：

```python
# ============================================================
# 【Python 改写】对应本节 TypeScript 节选
# 原文 TS:
#   export type AgentMessage = Message | CustomAgentMessages[keyof CustomAgentMessages];
# ============================================================

# 概念对照：Python 没有声明合并；用显式联合表达 coding-agent 注册四种扩展后的类型。
# 下列成员类型沿用本章定义；核心未注册扩展时，AgentMessage 就是 Message。
from typing import Union

Message = Union[UserMessage, AssistantMessage, ToolResultMessage]
AgentMessage = Union[
    Message,
    BashExecutionMessage,
    CustomMessage,
    BranchSummaryMessage,
    CompactionSummaryMessage,
]
```

翻译成人话：**AgentMessage = pi-ai 标准消息 + 应用注册的自定义消息。** 核心包默认只有 Message 的三种成员；在 coding-agent 中，声明合并再加入四种消息，所以这个应用里的联合类型共有七种。

用一张图看最清楚：

```
AgentMessage（Agent 内部使用的消息格式）
│
├── Message（可直接发送给 LLM 的标准消息）
│   │
│   ├── UserMessage          ← role: "user"
│   ├── AssistantMessage     ← role: "assistant"
│   └── ToolResultMessage    ← role: "toolResult"
│
└── CustomAgentMessages（仅 Agent 内部使用的扩展消息）
    │
    ├── BashExecutionMessage      ← role: "bashExecution"
    ├── CustomMessage             ← role: "custom"
    ├── BranchSummaryMessage      ← role: "branchSummary"
    └── CompactionSummaryMessage  ← role: "compactionSummary"
```

Agent 内部的 `context.messages` 数组里放的是 `AgentMessage[]`——它可以混合存放标准和自定义消息。一条消息到底是标准还是自定义的，看 `role` 字段就能判断。

### CustomAgentMessages：默认为空的扩展点

关键在 `CustomAgentMessages` 这个接口：

```python
# ============================================================
# 【Python 改写】对应本节 TypeScript 节选
# 原文 TS:
#   export interface CustomAgentMessages {
#       // Empty by default - apps extend via declaration merging
#       // 默认为空 - 应用通过声明合并扩展
#   }
# ============================================================

# 概念对照：Python 用空类说明扩展插槽；Pi 核心实际使用 TypeScript interface。

class CustomAgentMessages:
    """默认空的扩展插槽；应用可在自己的类型层注册消息。"""
    pass
```

注意：**这个接口在核心包（pi-agent-core）里是空的。** 核心包完全不知道有什么 BashExecutionMessage、CompactionSummaryMessage 这些东西。它只提供了一个"插槽"，让应用层往里插。

### 声明合并：类型安全的扩展魔法

应用层怎么"插"？靠 TypeScript 的**声明合并**（Declaration Merging）。coding-agent 通过 `declare module` 语法把自己的 4 种消息类型"注入"进去：

```python
# ============================================================
# 【Python 改写】对应本节 TypeScript 节选
# 原文 TS:
#   declare module "@earendil-works/pi-agent-core" {
#       interface CustomAgentMessages {
#           bashExecution: BashExecutionMessage;
#           custom: CustomMessage;
#           branchSummary: BranchSummaryMessage;
#           compactionSummary: CompactionSummaryMessage;
#       }
#   }
# ============================================================

# 概念对照：注册表示意宿主注册自定义类型；Python 没有 TypeScript 声明合并语法。

custom_agent_message_types = {
    "bashExecution": "BashExecutionMessage",
    "custom": "CustomMessage",
    "branchSummary": "BranchSummaryMessage",
    "compactionSummary": "CompactionSummaryMessage",
}
```

这段代码的效果是：**编译器自动把这 4 种类型加入 AgentMessage 联合类型。** 以后在 coding-agent 项目里，`AgentMessage` 就变成了 7 种消息的联合（3 种标准 + 4 种自定义），TypeScript 会帮你做完整的类型检查。

**为什么不直接用继承或者泛型？** 因为继承需要修改基类——你改不了 `pi-agent-core` 包。泛型需要到处传参数——每个用到 `AgentMessage` 的函数签名都要加泛型参数。声明合并的好处是：**核心包完全不知道扩展的存在（零依赖），扩展包却能获得完整的类型安全。**

不同的应用可以注册不同的自定义消息。**每个应用只看到自己需要的消息类型；七种是 coding-agent 本章示例的数量，不是所有 Agent 的固定上限。**

---

## 五、转换边界：coding-agent 的 convertToLlm 把自定义消息转换成标准消息

以 coding-agent 为例，`AgentMessage` 在这个应用中包含 7 种消息。每次调用模型时，它会把这些消息转换成 `pi-ai` 的三种标准格式。

**答案是：在调用 LLM 之前的最后一刻，做一次翻译。** 这个翻译器就是 `convertToLlm` 函数。

### 翻译发生在什么时候？

在 `streamAssistantResponse` 函数里（第 3 章讲过的"调用模型"那一步），翻译发生的时机非常精确：

```
每次 LLM 调用前的消息处理管道：

context.messages: AgentMessage[]        ← coding-agent 示例中有 7 种类型
        │
        ▼
[1] transformContext (可选)             ← AgentMessage[] → AgentMessage[]
        │                                  裁剪旧消息、注入外部上下文
        ▼
[2] convertToLlm (必须)                 ← AgentMessage[] → Message[]
        │                                  自定义消息翻译成标准格式
        ▼
llmContext.messages: Message[]          ← LLM 看到的消息（只有 3 种类型）
        │
        ▼
streamFunction(model, llmContext, ...)  ← 调用 LLM（第4章讲过）
```

注意顺序：**先 transformContext（同层变换），再 convertToLlm（跨层翻译）。** 为什么分两步？后面会讲。

### 转换规则：coding-agent 的四种自定义消息如何处理

coding-agent 的 `convertToLlm` 核心逻辑是一个 switch 语句，按 `role` 字段分派处理：

| role | 怎么处理 |
|------|---------|
| `"user"` | 直接透传，不做任何修改 |
| `"assistant"` | 直接透传 |
| `"toolResult"` | 直接透传 |
| `"bashExecution"` | `excludeFromContext=true` → 过滤掉；否则 → 转换成 UserMessage |
| `"custom"` | 转换成 UserMessage |
| `"branchSummary"` | 转换成 UserMessage（加 XML 标签包裹） |
| `"compactionSummary"` | 转换成 UserMessage（加 XML 标签包裹） |

关键洞察：**coding-agent 这四种自定义消息中，未被过滤的消息都被转换成 `user` 角色。** 这是该应用的 `convertToLlm` 规则，不是 Agent 核心对所有扩展消息的统一规定。

为什么这里变成 `user`？这些自定义消息表达的是宿主提供的观察和上下文——Bash 执行结果、扩展注入内容、压缩摘要、分支摘要。`user` 是 `pi-ai` provider-neutral 消息类型里承载这类输入的标准角色；各 Provider 的原生角色和协议约束由下一层转换器处理。

### 具体例子：BashExecutionMessage 的转换

回到开头的场景。一条 `BashExecutionMessage` 从创建到被 LLM 看到，数据结构发生了这样的变化：

**Before —— BashExecutionMessage（Agent 内部格式）：**

```python
# ============================================================
# 【Python 改写】对应本节 TypeScript 节选
# 原文 TS:
#   {
#       role: "bashExecution",
#       command: "ls -la",
#       output: "total 32\ndrwxr-xr-x  5 user  staff  160 May 30 10:00 .\n...",
#       exitCode: 0,
#       cancelled: false,
#       truncated: false,
#       timestamp: 1748568000000
#   }
# ============================================================

# 概念对照：宿主先保留 BashExecutionMessage 的结构化字段，翻译边界再格式化给模型。

bash_message = {
    "role": "bashExecution",
    "command": "ls -la",
    "output": "total 32\ndrwxr-xr-x  5 user  staff  160 May 30 10:00 .\n...",
    "exitCode": 0,
    "cancelled": False,
    "truncated": False,
    "timestamp": 1748568000000,
}
```

**After —— UserMessage（LLM 看到的格式）：**

```python
# ============================================================
# 【Python 改写】对应本节 TypeScript 节选
# 原文 TS:
#   {
#       role: "user",
#       content: [{
#           type: "text",
#           text: "Ran `ls -la`\n```\ntotal 32\ndrwxr-xr-x  5 user  staff  160 May 30 10:00 .\n...\n```"
#       }],
#       timestamp: 1748568000000
#   }
# ============================================================

# 概念对照：coding-agent 的 convertToLlm 将命令与输出格式化为标准 UserMessage 内容。

user_message = {
    "role": "user",
    "content": [{
        "type": "text",
        "text": "Ran `ls -la`\n```\ntotal 32\ndrwxr-xr-x  5 user  staff  160 May 30 10:00 .\n...\n```",
    }],
    "timestamp": 1748568000000,
}
```

变化总结：
- `role`：`"bashExecution"` → `"user"`
- `command`、`output`、`exitCode` 等结构化字段 → 被格式化成一段文本
- 丢失的信息：`cancelled`、`truncated` 等布尔标志被融合进文本描述里，不再是独立字段

其他自定义消息的转换也由 coding-agent 的 `convertToLlm` 明确处理：`CustomMessage` 把字符串包装成文本块（原本就是块数组时则保留内容块）；`CompactionSummaryMessage` 与 `BranchSummaryMessage` 把摘要文本用 `<summary>` 标签包裹，变成 UserMessage 的 content。

---

## 六、两阶段管道：为什么 transformContext 和 convertToLlm 分开？

![消息处理管道](assets/260702-ch06-message-pipeline.svg)

**配图说明**：横向数据流——coding-agent 示例的 AgentMessage（3 种标准 + 4 种自定义）→ transformContext（同层变换，类型不变）→ convertToLlm（跨层翻译）→ Message（3 种标准格式）发给模型。下方标注 excludeFromContext 过滤分支。

回到管道图，有一个设计细节值得追问：**为什么分两步，而不是一步到位？**

答案是**职责分离**：

- **transformContext** 处理的是 **AgentMessage 级别的操作**：裁剪太旧的消息、注入外部上下文、触发压缩算法。它处理前后都是 `AgentMessage[]`，类型不变。
- **convertToLlm** 处理的是 **跨类型翻译**：把 AgentMessage 翻译成 Message。处理前是 `AgentMessage[]`，处理后是 `Message[]`，类型变了。

分开的好处是：**你可以只替换其中一个，互不影响。**

- 换了**上下文管理策略**（比如从"删最旧消息"改成"压缩成摘要"），只需要改 `transformContext`——它处理"如何裁剪"的策略。`convertToLlm` 不需要动。
- 换了**应用类型**（比如把 coding-agent 改造成一个 Web 客服 Agent，自定义消息从 `BashExecution`/`CompactionSummary` 变成 `TicketEvent`/`OrderNote` 这类业务消息），只需要改 `convertToLlm`——它处理"如何把自定义消息翻译成 UserMessage"。`transformContext` 不需要动。

这里有一个容易混淆的点要强调：**换了 LLM 提供商（比如从 Claude 换成 GPT），convertToLlm 不需要动**。为什么？因为 `convertToLlm` 的输出是统一的 `Message[]`（3 种标准消息），它已经把"自定义消息 → 标准消息"这件事做完了。再往下，**把 Message 翻译成各家 Provider 的私有格式**是 pi-ai 层（第 4 章讲过）的工作——那一层有自己的翻译器（anthropic-messages、openai-completions 等），跟 convertToLlm 是完全独立的两层。换句话说：**Pi 把"消息类型翻译"和"Provider 协议翻译"放在了两层不同的抽象里，互不干扰**。

---

## 七、过滤机制：区分 TUI 展示与模型上下文

`CustomMessage` 的显示设置和模型上下文过滤是两个独立开关：前者属于 coding-agent 的 TUI 展示，后者由 `convertToLlm` 决定。

### excludeFromContext：一个布尔字段的过滤力

Pi 的 Bash 工具有个功能：当你用 `!!` 前缀执行命令时（比如 `!!secret_cmd`），这条命令的执行结果对 LLM 不可见。

实现方式非常简单——BashExecutionMessage 有一个 `excludeFromContext` 字段。在 convertToLlm 里，检查这个字段：

```python
# ============================================================
# 【Python 改写】对应本节 TypeScript 节选
# 原文 TS:
#   // 将 convertToLlm 的 bashExecution 分支单独展开，展示过滤与转换。
#   function convertBashMessage(m: BashExecutionMessage): UserMessage | undefined {
#       if (m.excludeFromContext) {
#           return undefined;   // 调用方过滤掉 undefined
#       }
#       return {
#           role: "user",
#           content: [{ type: "text", text: bashExecutionToText(m) }],
#           timestamp: m.timestamp,
#       };
#   }
# ============================================================

# 概念对照：None 对应 undefined；其余消息转换成包含文本块和原时间戳的 UserMessage。
def convert_bash_message(message):
    if message.get("excludeFromContext"):
        return None
    return {
        "role": "user",
        "content": [{"type": "text", "text": bash_execution_to_text(message)}],
        "timestamp": message["timestamp"],
    }
```

注意：`excludeFromContext = true` 的消息**仍然存在于 `context.messages` 中**。UI 仍然可以看到它、渲染它。只是在调用 LLM 的那一刻，这条消息被"隐身"了。

这就是"TUI 能看、模型不能看"的机制——`BashExecutionMessage` 仍留在 Agent 消息状态里，翻译边界根据布尔字段过滤它。

### 三种消息可见性组合

在 coding-agent 中，UI 显示与模型上下文可以组合成三种常见情况：

| 组合 | 模型上下文 | coding-agent TUI | 实现方式 | 典型消息 |
|------|------------|-----------------|---------|---------|
| 两边可见 | 是 | 是 | 正常转换；自定义消息设置 `display: true` | 普通 BashExecutionMessage、CustomMessage |
| 仅模型可见 | 是 | 否 | `CustomMessage.display: false`；它仍会被 `convertToLlm` 转换 | 扩展注入的 context-only CustomMessage |
| 仅 TUI 可见 | 否 | 是 | `BashExecutionMessage.excludeFromContext: true`，转换器过滤 | `!!` 前缀的 Bash 执行 |

---

## 八、完整数据流：从用户操作到 LLM 看到的消息

把全章内容串起来，一条消息从诞生到被 LLM 看到的完整路径：

```
用户在终端输入 !ls -la
        │
        ▼
[1] 创建消息
    BashExecutionMessage { role: "bashExecution", command: "ls -la", output: "...", ... }
        │
        ▼
[2] 存入 context.messages: AgentMessage[]
    [...原有消息, 新的 BashExecutionMessage]
        │
        ▼
[3] Agent Loop 准备调用 LLM（第3章讲过的内层循环）
        │
        ▼
[4] transformContext（可选）
    输入/输出都是 AgentMessage[]
    裁剪、注入、压缩（第8章详讲 transformContext、第9章详讲 Compaction）
        │
        ▼
[5] convertToLlm（必须）
    AgentMessage[] → Message[]
    BashExecutionMessage → UserMessage
    excludeFromContext → 过滤掉
        │
        ▼
[6] LLM 收到
    llmContext.messages = [
        ...之前的消息,
        { role: "user", content: "Ran `ls -la`\n```\n...\n```" }
    ]
        │
        ▼
[7] LLM 回复
    → 产生新的 AssistantMessage
    → 可能触发工具调用 → ToolResultMessage（第5章的五步管道）
    → 回到 [2]，继续循环
```

**核心规律**：coding-agent 内部用 7 种消息类型表达应用状态；到了模型边界，未过滤的自定义消息由宿主转换成 3 种标准格式。这个"内富外严"的设计让应用可以扩展内部消息，同时维持 pi-ai 的标准消息边界。

---

## 九、总结

### 一条主线：数据结构要同时照顾两个读者

回看整章，Pi 的消息系统所有设计都围绕一个朴素的思想——**在设计数据结构时，要同时考虑模型要用的、和功能层面要用的，然后根据需求自定义、用合理的架构把两者组合起来**。

具体到消息系统，这两个"读者"的需求是分裂的：

- **模型调用层**接收三种 pi-ai 标准消息（User/Assistant/ToolResult）；它们统一内部调用格式，各 Provider 的原生协议由下一层适配
- **功能这边**（UI、持久化、可见性控制）需要丰富的结构化字段——每多一种字段就多一种能力

如果只为模型设计，结构化字段全丢，功能层退化；如果只为功能设计，模型看不懂，对话就断了。Pi 的方案是**两层各管各的**：

| 层 | 关心谁 | 数据形式 | 怎么实现 |
|----|--------|---------|---------|
| **AgentMessage（内层）** | 功能层 | coding-agent 示例中有 7 种消息（3 标准 + 4 自定义），字段丰富 | 用联合类型 + 声明合并，让核心包零依赖、应用层获得类型安全 |
| **Message（外层）** | 模型调用层 | 3 种 pi-ai 标准消息，字段精简 | 在模型调用边界做一次 `convertToLlm` 翻译，**有损、单向、最后一刻发生**；Provider 再转换成各自协议 |

这一章的所有具体设计——三层类型递进（Tool → AgentTool → ToolDefinition）、声明合并扩展点、transformContext / convertToLlm 两阶段管道、excludeFromContext 可见性控制——都是这条主线的具体实现。**主线是"两个读者，两层架构"，实现手段可以千变万化。**

### 把这条主线用到自己的项目里

下次你设计一个对接外部协议的系统（不只是 Agent，可以是任何"对外有协议约束、对内有丰富需求"的场景），可以套用这三步：

**第一步：识别"两个读者"分别要什么。** 协议规定什么（不能改的部分）？功能层需要什么（可以自定义的部分）？把它们列出来，明确各自的需求。

**第二步：以内层结构化为"源"，外层翻译为"流"。** Agent 状态和宿主会话层用原始的、结构化的数据（不丢字段、不拍扁）；到模型调用边界再做一次有损翻译。**不要为了协议方便而提前拍扁数据**——一旦拍扁，UI 和宿主会话层就再也拿不回结构。

**第三步：用类型系统的扩展点做"核心 + 应用"分层。** 核心包定义协议接口（封闭）、留一个空的扩展插槽；应用包通过声明合并注入自己的具体类型。这样核心包零依赖，应用包全栈类型安全——不需要继承，不需要泛型参数污染。

> 本章讲到的「Tool → AgentTool → ToolDefinition」三层递进（第 5 章）也是同样的思想：每一层只加自己这个层级需要的能力，不越界。识别"分层点"、给每层划清职责边界，是这种设计法的核心。

---

## 十、下一站

前六章到此结束——你已经建立了对 Pi-Agent 核心机制的完整理解。

> **建议**：在进入进阶章节之前，建议回顾前六章的核心机制（消息系统、工具调用、扩展机制、Agent Loop 等），确认你把各章的知识点串起来了。

从第 7 章开始进入进阶章节。回看前五章，有一个东西反复出现但我们始终没深入：**事件**。第 3 章说"Agent Loop 每做一步都发事件让 UI 实时更新"，第 5 章说"工具执行时发出 `tool_execution_start`、`tool_execution_update`、`tool_execution_end` 事件"。这些事件是怎么从 Agent 内部传到外部的？UI 怎么订阅这些事件？为什么 Agent 发完事件后要"同步等待"监听器处理完？

下一章，我们打开 Agent 的"神经系统"——事件驱动架构。

---

> **本章关键源码索引**：
> - `packages/ai/src/types.ts` — `Message`、`UserMessage`、`AssistantMessage`、`ToolResultMessage`
> - `packages/agent/src/types.ts` — `CustomAgentMessages`、`AgentMessage`
> - `packages/coding-agent/src/core/messages.ts` — `BashExecutionMessage`、`CustomMessage`、`BranchSummaryMessage`、`CompactionSummaryMessage`、声明合并、`convertToLlm`
> - `packages/agent/src/agent-loop.ts` — `streamAssistantResponse` 中的 `transformContext` → `convertToLlm` 调用顺序
> - `packages/coding-agent/src/core/agent-session.ts` — `AgentSession` 消息处理与 `SessionManager` 持久化边界
> - `packages/coding-agent/src/core/session-manager.ts` — `appendMessage`、`appendCustomMessageEntry` 与会话恢复
