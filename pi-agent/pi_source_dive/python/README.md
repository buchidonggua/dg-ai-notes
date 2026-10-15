# 项目原理-二次整理版-插图版-Python版

> 基于同系列 TypeScript 插图版的代码示例，**改写为 Python 等价代码**，让只懂 Python 的读者也能看懂 Pi-Agent 的设计原理。

## 为什么有这个版本

Pi-Agent 的官方 SDK 是 TypeScript 包（`@earendil-works/pi-ai`、`@earendil-works/pi-agent-core`、`@earendil-works/pi-coding-agent`），并没有官方 Python 版本。原教程的代码示例全部是 TS——对只懂 Python 的读者不友好。

这个版本是**改写版**——保留所有非代码文本（讲解、表格、图片引用、ASCII 框图、JSON 数据示例）一字不变，只把 `typescript` 代码块改写成等价的 `python` 代码块。

**重要澄清**：这些 Python 代码不是"用 Python 调 Pi 的指南"，而是用 Python 语法帮你**看懂每一处 TS 代码在做什么**。Pi 的官方 SDK 仍然是 TS——但当你回到 TS 源码时，会发现概念是一一对应的。

## 改写规则

1. **代码块语言标记**：`` ```typescript `` → `` ```python ``
2. **保留所有非代码文本**：标题、讲解、表格、列表、引用块、图片引用、ASCII 框图、bash 命令、json 数据格式——全部原样
3. **每个改写代码块顶部加注释头**：
   ```python
   # ============================================================
   # 【Python 改写】<说明>
   # 原文 TS:
   #   <对应的 TS 代码原文>
   # ============================================================
   ```
4. **概念对照**：注释里点明 TS → Python 的语法/概念映射（如 `Promise<T>` → `Coroutine`，`interface` → `Protocol/dataclass`，`switch/case` → `match/case` 或 `if/elif`）
5. **命名转换**：camelCase → snake_case（`streamSimple` → `stream_simple`、`AgentMessage[]` → `list[AgentMessage]`）
6. **不修复任何"看似 bug"的原代码**：保持原 TS 的控制流和结构

## 改写风格对照

| TS 概念 | Python 等价 | 备注 |
|---------|------------|------|
| `Promise<T>` | `Awaitable[T]` / `Coroutine` | 异步等价 |
| `async/await` | `async/await` | Python 同样支持 |
| `interface` | `@dataclass` 或 `Protocol` | 看"运行时实例"还是"鸭子协议" |
| 联合类型 `A \| B` | `Union[A, B]` 或 `Literal` | |
| 泛型 `T<X>` | `Generic[X]` | |
| `for await...of` | `async for...in` | 流式迭代 |
| `Promise.all([p1,p2])` | `asyncio.gather(c1,c2)` | 并发 |
| `array.filter(p)` | `[x for x in arr if p(x)]` | |
| `array.some(p)` | `any(p(x) for x in arr)` | |
| `array.find(p)` | `next((x for x in arr if p(x)), None)` | |
| `array.unshift(x)` | `list.insert(0, x)` | |
| `array.push(x)` | `list.append(x)` | |
| `array.length` | `len(list)` | |
| `Map.has(k)` | `k in dict` | |
| `Map.get(k)` | `dict.get(k)` | |
| `try/catch` | `try/except` | |
| `instanceof Error` | `isinstance(e, Exception)` | |
| `throw new Error(...)` | `raise Exception(...)` | |
| TS 声明合并 | **无 Python 等价** | 用专门注释块解释 TS 的编译期魔法 |

## 章节清单

本版本与 TypeScript 版 12 章一一对齐；源码基准为 2026-10-12 本地 `pi-main` 快照（核心包 `v0.84.3`）：

| 章节 | 主题 | TS 代码块数 |
|------|------|------------|
| 第1章 | 开篇 —— 为什么 Pi-Agent 值得你花时间 | 3 |
| 第2章 | 三层架构 —— Pi-Agent 项目的骨骼 | 10 |
| 第3章 | Agent Loop —— 让模型转动起来的引擎 | 20 |
| 第4章 | 模型调用 —— 一行代码驾驭多个模型 | 16 |
| 第5章 | 工具系统 —— Agent 的手脚是怎么被管住的 | 17 |
| 第6章 | 消息系统 —— Agent 的记忆如何组织与传递 | 10 |
| 第7章 | 事件驱动 —— Agent 的神经系统 | 14 |
| 第8章 | 上下文工程 —— 让有限窗口装下无限对话 | 2 |
| 第9章 | 上下文压缩 —— 当对话太长怎么办 | 5 |
| 第10章 | 会话管理 —— 对话的存储、恢复与分叉 | 1 |
| 第11章 | 扩展系统 —— 不改源码给 Agent 加能力 | 3 |
| 第12章 | 测试模式 —— 不用真实模型验证 Agent 行为 | 8 |

合计 **109 个 TS 代码块**全部改写为 Python 等价代码。

> 本次更新同时新增第11章扩展系统和第12章测试模式；两章均按本地源码重写，并保持双语言正文、文本示意和配图一致。

## 资源文件

- `assets/` — 完整同步自 TS 版，所有 `.svg` / `.html` 文件与原版一致
- `_chapter-design/` — 章节设计文档，也完整复制

## 与旧版（260702 Python 版）的差异

- **章节范围**：旧版有 13 章（含中场+扩展+测试+设计精华），本版对齐当前 TS 源的 12 章
- **章节 8 新增**：旧版第 8 章是"上下文压缩"，新版第 8 章是"上下文工程"（全新章节），原"上下文压缩"成为新版第 9 章
- **章节 9/10 重写**：新版第 9 章（压缩）和第 10 章（会话管理）内容有大幅修订，所有 Python 代码按本次核对后的 TS 文档重写
- **风格统一**：所有代码块都加了"原文 TS + 概念对照"的注释头，旧版没有这个规范

## 阅读建议

- 第一次读：**只看 Python 代码**就能理解 Pi 的运行机制
- 想深入 Pi 源码：回到 `repo/packages/`（官方仓库）看实际 TS 实现
- 注意 Python 代码里的 `pi_agent_core`、`pi_ai`、`pi_coding_agent` 等 import 是**示意性的**——这些 Python 包并不存在，Pi 的官方 SDK 只有 TS 版
