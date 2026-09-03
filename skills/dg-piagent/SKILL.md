---
name: dg-piagent
description: |
  Use when working with pi-agent / @earendil-works/pi-coding-agent SDK — 创建 agent、自定义工具、
  编写扩展、修改系统提示词、管理会话、配置模型、处理认证、加载 skills/prompts/context files、
  实现完全控制模式、或任何需要调用 pi-agent SDK API 的任务时使用。
  也用于企业内网接口接入评估：用户给出企业/内网 LLM 接口文档或地址，问「能不能接」「怎么配」时，
  按接口核对清单给出接入建议 + models.json 配置初稿。
  触发关键词：createAgentSession、AgentSession、pi.on、session.subscribe、extensionFactories、
  ModelRegistry、defineTool、pi-coding-agent、pi-ai、@earendil-works、SSE 流式集成、
  企业接口文档、内网模型接入、OpenAI 兼容判断、接口接入评估。
---

# pi-agent SDK 开发指南

> ⚠️ **版本基线（动态）**: 本 skill 的 API 描述最近一次人工核对到 **pi-coding-agent v0.84.4**。基线不写死——安装前先查 latest，以查到的最新版为准（见下方版本协议）。
>
> **遇 pi-ai import 失败时**，先查 `node_modules/@earendil-works/pi-ai/dist/compat.d.ts` 的 `export *` 列表，确认符号归属哪个入口。

## 版本协议 ⭐

**基线动态**：不写死版本号，每次引导安装前先跑 `npm view @earendil-works/pi-coding-agent version` 查最新，以查到的版本为本次基线。顶部标注的核对版本只是「API 描述最近核对到的版本」。两步：

1. **查最新、装最新**：跑 `npm view @earendil-works/pi-coding-agent version` 拿 latest，安装该版本（需要可复现时用精确版本号 `@X.Y.Z`，日常可直接 `@latest`）。场景文档里的安装命令一律指最新版。若查到的版本 ≠ 顶部核对版本，走第 2 步核对差异。

2. **差异核对**：查 GitHub `github.com/earendil-works/pi` 的 `packages/coding-agent/CHANGELOG.md`（或 Releases），对比核对版本→最新版之间的变更（尤其 Breaking Changes），从 SDK 二次开发角度给用户简短提示。若发现 skill 描述与新 API 有实质出入（类型改名、签名变更、新增重要能力），按 [skill-maintenance.md](references/skill-maintenance.md) 流程产出更新清单，报用户确认后再改 skill，并把顶部核对版本同步为新版。日常开发（项目已装好、不涉及安装）不触发。

> 时序关键：核对差异发生在安装前，node_modules 可能还是旧版或不存在，此时只能用 GitHub CHANGELOG；装好新版后可再用 `<proj>/node_modules/@earendil-works/pi-coding-agent/CHANGELOG.md`（标准 Keep-a-Changelog，按 `## [版本号]` 分节，含 Breaking Changes）与 `dist/**/*.d.ts` 做精确核对。

## Overview

pi-agent 是基于**事件驱动**的 Agent 开发框架(`@earendil-works/pi-coding-agent`)。核心心智模型:

```
createAgentSession()  ← 组装入口(Provider + 工具 + 资源)
       │
       ├── session.prompt(text)          ← 驱动 Agent 主循环
       │
       ├── session.subscribe(handler)    ← 外部订阅层
       │     多数事件与扩展层共有(turn_*/message_*/tool_execution_*/agent_start/agent_end/agent_settled)
       │     外部层独有: queue_update / compaction_* / session_info_changed 等 session 状态事件
       │
       └── 扩展(pi.on)                   ← 内部扩展层
             扩展独有(仅这 6 个 subscribe 收不到):
               context / tool_call / tool_result / before_agent_start / input / model_select
```

**关键区分(最大集成坑)**: 有 **6 个扩展独有事件**——`context` / `tool_call` / `tool_result` / `before_agent_start` / `input` / `model_select`。
在 server 层用 `session.subscribe` 监听这 6 个会**静默失败**(handler 被调用但 type 分支永不命中,无报错)。
**对策**: 需要抓这 6 个事件的逻辑(日志/trace/拦截/**抓这 6 个事件的数据落库**)必须写成扩展走 `pi.on`。⚠️ 但注意——**pi.on handler 被派发方 `await`，落库这类慢 I/O 必须 fire-and-forget**（推队列后台写），否则阻塞 agent loop。若只需存 `message_*`/`turn_*`/`tool_execution_*` 等 subscribe 收得到的事件，**落库优先走 `session.subscribe`**（不 await listener，可直接 await 写库，零阻塞）。详见 [04-events.md 关键细节](references/sdk_doc/04-events.md#关键细节)。
详见 [Common Mistakes](#common-mistakes) 与 [sdk_doc/04-events.md](references/sdk_doc/04-events.md)。

> ⭐ **v0.83.0 推荐**：需要"agent 真正结束"信号时，订阅 **`agent_settled`** 替代 `agent_end`——前者保证所有 retry/compaction/queue 处理完才触发，每 prompt 一次，两层都派发。详见 [sdk_doc/04 坑 1](references/sdk_doc/04-events.md#坑-1不要把-agent_end-当成流程结束的唯一信号)。

---

## When to Use

**该用本 skill**:
- 基于 pi-agent SDK 做 Agent 二次开发(Web 服务、CLI、定制化应用)
- 调用 `createAgentSession` / `AgentSession` / `defineTool` / `pi.on` 等 API

---

## 快速开始

```bash
npm install @earendil-works/pi-coding-agent@latest
```

> 安装前先 `npm view @earendil-works/pi-coding-agent version` 查最新版为基线，见[版本协议](#版本协议️)

最简示例:

```ts
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession();

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

try {
  await session.prompt("What files are in the current directory?");
} finally {
  session.dispose();
}
```

> 完整场景: [scenarios/A01-minimal-startup.md](references/scenarios/A01-minimal-startup.md)

---

## ⭐ 二开起步检查清单

不管做什么 Agent，先过这几项（默认值都是 pi 编码助手的产品烙印）：

**必改三项**
- **系统提示词** → 默认硬编码 pi 人设（不覆盖会自称 "expert coding assistant operating inside pi"），必须覆盖 → [A03](references/scenarios/A03-system-prompt.md)
- **可用工具** → 默认 `read/bash/edit/write` 编码四件套；垂直 Agent 要换业务工具，`bash` 在多用户场景是安全口子 → [A04](references/scenarios/A04-tool-whitelist.md)
- **会话存储** → 默认落盘 `~/.pi/agent/sessions/`（CLI 单用户设计）；Web 多用户必须 `SessionManager.inMemory()` + 自己落库 → [F01](references/scenarios/F01-session-persistence.md)

**易踩坑**：`createAgentSession` 传了 `resourceLoader` 就不自动 `reload`——用扩展（尤其扩展注册 provider）时必须自己 `await loader.reload()`，否则扩展 factory 不执行、provider 选不到 → [A06](references/scenarios/A06-load-extensions.md)

---

## 意图总表

按「我要做什么」找文件。场景编号保留在文件名,向后兼容。

### 1. 启动与组装

| 我想... | 详见 |
|--------|------|
| 最简跑起来 | [A01](references/scenarios/A01-minimal-startup.md) |
| 选模型 / 推理深度 | [A02](references/scenarios/A02-model-selection.md) |
| 改系统提示词 / 人设 | [A03](references/scenarios/A03-system-prompt.md) |
| 指定 cwd | [A05](references/scenarios/A05-custom-cwd.md) |
| 加载 `.pi/` 目录扩展文件 | [A06](references/scenarios/A06-load-extensions.md) |
| 完全手动组装所有组件 | [H01](references/scenarios/H01-full-control.md) |

### 2. 工具系统

| 我想... | 详见 |
|--------|------|
| 写自定义工具(查 DB/调 API) | [D01](references/scenarios/D01-custom-tool.md) |
| 工具白名单(禁用部分工具) | [A04](references/scenarios/A04-tool-whitelist.md) |
| 动态注册 / 覆盖内置工具 | [D02](references/scenarios/D02-dynamic-tools.md) |
| 工具调用前确认(安全闸门) | [D04](references/scenarios/D04-confirm-destructive.md) |
| 工具结果自定义渲染 | [D05](references/scenarios/D05-tool-result-render.md) |
| 限制工具只在特定目录执行 | [D06](references/scenarios/D06-protected-paths.md) |

### 3. 扩展与事件 ⭐(最常用)

| 我想... | 详见 |
|--------|------|
| 写一个完整的扩展 | [E02](references/scenarios/E02-extension-basics.md) |
| 拦截 / 修改工具调用 | [E01](references/scenarios/E01-tool-intercept.md) |
| 在生命周期阶段触发逻辑 | [E04](references/scenarios/E04-lifecycle-hooks.md) |
| 拦截 / 变换用户输入 | [E05](references/scenarios/E05-input-transform.md) |
| 流式处理工具输出 | [E06](references/scenarios/E06-streaming-transform.md) |
| ⭐ **Web/SSE 流式进度集成** | [E11](references/scenarios/E11-sse-progress-streaming.md) |
| turn 开始时预加载数据 | [G04](references/scenarios/G04-preload-context.md) |

### 4. 持久化与会话

| 我想... | 详见 |
|--------|------|
| 持久化会话 / 断点续聊 | [F01](references/scenarios/F01-session-persistence.md) |
| 运行时切换 / 恢复 / 分叉 | [F02](references/scenarios/F02-session-runtime.md) |
| 中止正在运行的 prompt | [F04](references/scenarios/F04-abort-session.md) |
| steer() 注入消息到队列 | [F05](references/scenarios/F05-steer-session.md) |
| 注入外部上下文 / 记忆 | [G01](references/scenarios/G01-context-injection.md) |

> F01 同时覆盖: 获取会话 ID/路径、纯内存会话(`SessionManager.inMemory()`)
> F05 同时覆盖: 读取/操作历史消息(`session.state.messages`)

### 5. 上下文与记忆

| 我想... | 详见 |
|--------|------|
| 加载/过滤/创建自定义 Skill | [C01](references/scenarios/C01-custom-skill.md) |
| 定义 Prompt 模板(`/command`) | [C02](references/scenarios/C02-prompt-templates.md) |
| 注入虚拟 AGENTS.md 指令 | [C03](references/scenarios/C03-context-files.md) |
| 自定义压缩策略 | [G02](references/scenarios/G02-custom-compaction.md) |
| 自动总结历史对话 | [G03](references/scenarios/G03-auto-summarize.md) |

### 6. Provider 与认证

| 我想... | 详见 |
|--------|------|
| 配置 API Key / OAuth | [B01](references/scenarios/B01-auth-config.md) |
| 管理 settings 配置项 | [B02](references/scenarios/B02-settings.md) |
| 获取可用模型列表 | [B03](references/scenarios/B03-available-models.md) |
| 自定义 Provider(智谱等) | [H02](references/scenarios/H02-custom-provider.md) |
| 企业接口能否接入 + 出 models.json 初稿 | [H07](references/scenarios/H07-enterprise-interface.md) |
| 用 Faux Provider 做测试 | [H03](references/scenarios/H03-faux-provider.md) |

### 7. 多 Agent 与打包发布

| 我想... | 详见 |
|--------|------|
| 多 Agent 协作 | [H06](references/scenarios/H06-multi-agent.md) |
| 打包发布 Pi Package | [I01](references/scenarios/I01-pi-package.md) |
| 分发扩展(`.piplugin`) | [I02](references/scenarios/I02-distribute-extension.md) |
| 扩展引用第三方依赖 | [I03](references/scenarios/I03-extension-deps.md) |
| 子 Agent 调度 | [I05](references/scenarios/I05-subagent.md) |

> **未列出的场景**(终端 UI / 自定义命令 / RPC / Sandbox 等低频或 CLI 专属)直接翻 `references/scenarios/` 目录。

---

## 项目结构

**约定**: `.pi/` 放资源(人可编辑),`src/` 放逻辑(开发者维护)。
**核心**: `main.ts` 只做组装(Provider → 工具 → createAgentSession)。

完整目录建议、规模演进、常见错误 → [project-structure.md](references/project-structure.md)

注意：项目结构仅是对新项目的建议，并不是必须选择，请按照实际情况（尤其是旧项目）调整项目结构。

---

## SDK API 索引

按包/模块查 API。每个条目指向 `references/sdk_doc/` 下的详细文档。

### @earendil-works/pi-coding-agent(核心 SDK)

| 模块 | 说明 | 详细 |
|------|------|------|
| `createAgentSession` | 创建会话主入口,接收全部配置 | [01](references/sdk_doc/01-create-agent-session.md) |
| `AgentSession` | prompt / steer / abort / setModel / dispose / subscribe | [02](references/sdk_doc/02-agent-session.md) |
| `AgentSessionRuntime` | newSession / switchSession / fork | [03](references/sdk_doc/03-agent-session-runtime.md) |
| **事件系统** | 全部事件类型、触发时机、数据结构、集成踩坑 | [04](references/sdk_doc/04-events.md) |
| `ModelRuntime` / `ModelRegistry` | 模型/认证运行时（v0.80.8+）+ 扩展兼容包装器 | [05](references/sdk_doc/05-auth-model-registry.md) |
| `defineTool` / 工具系统 | 自定义工具定义、内置工具、参数 schema | [06](references/sdk_doc/06-tools.md) |
| `ExtensionAPI` | pi.on / pi.registerTool / pi.registerCommand / pi.ui | [07](references/sdk_doc/07-extensions-api.md) |
| `DefaultResourceLoader` | system prompt / skills / prompts / context files / extensions | [08](references/sdk_doc/08-resource-loader.md) |
| `Skill` 接口 | Skill 数据结构与加载机制(渐进式披露) | [09](references/sdk_doc/09-skills.md) |
| `PromptTemplate` | `/command` 模板 | [10](references/sdk_doc/10-prompt-templates.md) |
| Context Files (AGENTS.md) | 项目级指令文件机制 | [11](references/sdk_doc/11-context-files.md) |
| `SessionManager` | create / continueRecent / open / list / inMemory | [12](references/sdk_doc/12-session-manager.md) |
| `SettingsManager` | applyOverrides / flush / drainErrors | [13](references/sdk_doc/13-settings-manager.md) |

### @earendil-works/pi-ai(AI 层)与高级主题

| 模块 | 说明 | 详细 |
|------|------|------|
| `getModel` / Custom Provider | 按 provider/id 查模型 / 自定义 Provider 注册 | [16](references/sdk_doc/16-custom-provider.md) |
| Compaction | 上下文窗口压缩机制 | [18](references/sdk_doc/18-compaction.md) |
| Pi Package | 打包、发布、版本管理 | [20](references/sdk_doc/20-pi-package.md) |
| 多 Agent 架构 | 多 Agent 协作模式 | [21](references/sdk_doc/21-multi-agent.md) |
| 扩展推荐 SOP | 按用户需求实时查 npm + 给出推荐清单（用户主动询问时触发） | [22](references/sdk_doc/22-extension-recommender.md) |

> 完整 sdk_doc 索引直接翻 `references/sdk_doc/` 目录（TUI/UI API/Faux Provider/RPC 模式等 CLI 专属低频项已从本 skill 剔除，需要时查 SDK 源码）。



---

## 源码兜底协议 ⭐(本 skill 不够用时)

当 `scenarios/` 和 `sdk_doc/` 都无法回答你的问题时,**不要凭空推断**——直接查 `node_modules` 内的包内容。pi-agent 的 npm 包**自带文档、示例和类型**,任何装了 SDK 的项目都自动拥有。

**触发信号**:类型/字段/方法名在 skill 内 grep 不到、签名未列出、实际行为与描述冲突、集成场景超出已覆盖模式。

**4 层优先级**(信息密度从高到低,先用上层):

| 优先级 | 查什么 | 最适合 |
|--------|--------|--------|
| 1 | `pi-coding-agent/examples/sdk/0X-*.ts` | 「怎么做 X」 |
| 2 | `pi-coding-agent/docs/*.md` | 「X 是什么 / 有哪些能力」 |
| 3 | `*/dist/**/*.d.ts` | 「X 有哪些字段/方法」 |
| 4 | `*/dist/**/*.js` | 「X 为什么这样行为」 |

> 完整路径导航表(三个包自带内容不对称)、检索配方、降级策略、回流提示 → [source-fallback.md](references/source-fallback.md)

**兜底解决后**:若该问题任何用 pi-agent 的项目都可能遇到,主动建议用户「值得补进 skill 吗」,由用户决定(遵循 [skill-maintenance.md](references/skill-maintenance.md) 沉淀)。

---

## 资源 & 维护

**官方源码参考**: `packages/coding-agent/src/`(SDK)、`packages/agent/src/`(Agent 核心)、`packages/ai/src/`(AI 抽象)

**Skill 维护**: 发现信息缺失/错误导致走弯路时,按 [skill-maintenance.md](references/skill-maintenance.md) 6 条原则完善本 skill,并同步更新 [CHANGELOG.md](CHANGELOG.md)（历史沿革，永久保留）。
