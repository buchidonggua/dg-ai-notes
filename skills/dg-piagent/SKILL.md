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

> **版本基线**: pi-coding-agent **v0.83.0**。升级流程见 [VERSION-PROTOCOL.md](references/VERSION-PROTOCOL.md)。
> **遇 pi-ai import 失败时**，先查 `node_modules/@earendil-works/pi-ai/dist/compat.d.ts` 的 `export *` 列表。

## 核心心智模型

```
createAgentSession()  ← 组装入口(Provider + 工具 + 资源)
       │
       ├── session.prompt(text)          ← 驱动 Agent 主循环
       ├── session.subscribe(handler)    ← 外部订阅层 (fire-and-forget)
       └── 扩展(pi.on)                   ← 内部扩展层 (await-and-read)
```

**最大集成坑**：6 个扩展独有事件（`context` / `tool_call` / `tool_result` / `before_agent_start` / `input` / `model_select`）用 `session.subscribe` 监听会**静默失败**。必须写成扩展走 `pi.on`，但落库等慢 I/O 必须 fire-and-forget。详见 [04-events.md](references/sdk_doc/04-events.md)。

**结束信号**：用 `agent_settled` 替代 `agent_end`——前者保证所有 retry/compaction/queue 处理完才触发。

## 二开起步检查清单

不管做什么 Agent，先过这三项（默认值都是 pi 编码助手的产品烙印）：

| 必改项 | 默认值陷阱 | 场景 |
|--------|-----------|------|
| **系统提示词** | 硬编码 pi 人设，不覆盖会自称 "expert coding assistant" | [A03](references/scenarios/A03-system-prompt.md) |
| **可用工具** | 默认 `read/bash/edit/write`；垂直 Agent 要换业务工具 | [A04](references/scenarios/A04-tool-whitelist.md) |
| **会话存储** | 默认落盘 `~/.pi/agent/sessions/`；Web 多用户必须 `SessionManager.inMemory()` | [F01](references/scenarios/F01-session-persistence.md) |

**易踩坑**：`createAgentSession` 传了 `resourceLoader` 就不自动 `reload`——用扩展时必须自己 `await loader.reload()` → [A06](references/scenarios/A06-load-extensions.md)

## 意图路由表

按「我要做什么」找场景文件。

**启动与组装**：最简 [A01](references/scenarios/A01-minimal-startup.md) · 选模型 [A02](references/scenarios/A02-model-selection.md) · 改人设 [A03](references/scenarios/A03-system-prompt.md) · 工具白名单 [A04](references/scenarios/A04-tool-whitelist.md) · 完全手动 [H01](references/scenarios/H01-full-control.md)

**工具系统**：自定义工具 [D01](references/scenarios/D01-custom-tool.md) · 动态注册 [D02](references/scenarios/D02-dynamic-tools.md) · 调用前确认 [D04](references/scenarios/D04-confirm-destructive.md) · 结果渲染 [D05](references/scenarios/D05-tool-result-render.md)

**扩展与事件**：写扩展 [E02](references/scenarios/E02-extension-basics.md) · 拦截工具 [E01](references/scenarios/E01-tool-intercept.md) · 生命周期 [E04](references/scenarios/E04-lifecycle-hooks.md) · SSE 流式 [E11](references/scenarios/E11-sse-progress-streaming.md)

**持久化与会话**：断点续聊 [F01](references/scenarios/F01-session-persistence.md) · 切换/恢复 [F02](references/scenarios/F02-session-runtime.md) · 中止 prompt [F04](references/scenarios/F04-abort-session.md)

**上下文与记忆**：自定义 Skill [C01](references/scenarios/C01-custom-skill.md) · Prompt 模板 [C02](references/scenarios/C02-prompt-templates.md) · AGENTS.md [C03](references/scenarios/C03-context-files.md)

**Provider 与认证**：API Key [B01](references/scenarios/B01-auth-config.md) · 自定义 Provider [H02](references/scenarios/H02-custom-provider.md) · 企业接口 [H07](references/scenarios/H07-enterprise-interface.md)

**多 Agent 与发布**：多 Agent [H06](references/scenarios/H06-multi-agent.md) · Pi Package [I01](references/scenarios/I01-pi-package.md) · 子 Agent [I05](references/scenarios/I05-subagent.md)

> 完整场景索引见 [SCENARIO-MATRIX.md](references/SCENARIO-MATRIX.md)。未列出的直接翻 `references/scenarios/` 目录。

## 快速开始

```bash
npm install @earendil-works/pi-coding-agent@0.83.0
```

```ts
import { createAgentSession } from "@earendil-works/pi-coding-agent";
const { session } = await createAgentSession();
session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta")
    process.stdout.write(event.assistantMessageEvent.delta);
});
try { await session.prompt("What files are in the current directory?"); }
finally { session.dispose(); }
```

## SDK API 索引

完整 API 映射 → [SDK-INDEX.md](references/SDK-INDEX.md)。核心包 `@earendil-works/pi-coding-agent`：`createAgentSession` · `AgentSession` · 事件系统 · `defineTool` · `ExtensionAPI` · `SessionManager`。详见 `references/sdk_doc/`。

## 源码兜底

Skill 不够用时，**不凭空推断**——查 `node_modules`：`examples/sdk/` → `docs/*.md` → `dist/**/*.d.ts` → `dist/**/*.js`。完整路径导航 → [source-fallback.md](references/source-fallback.md)。兜底解决后建议用户「值得补进 skill 吗」→ [skill-maintenance.md](references/skill-maintenance.md)。

## 项目结构

`.pi/` 放资源（人可编辑），`src/` 放逻辑（开发者维护），`main.ts` 只做组装。完整建议 → [project-structure.md](references/project-structure.md)。

## 维护

发现信息缺失/错误 → 按 [skill-maintenance.md](references/skill-maintenance.md) 6 条原则完善 → 同步更新 [CHANGELOG.md](CHANGELOG.md)。
