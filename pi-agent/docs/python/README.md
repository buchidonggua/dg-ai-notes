# 项目原理-二次整理版-插图版-Python版（260703）

> 基于 [项目原理-二次整理版-插图版-260702](../项目原理-二次整理版-插图版-260702/) 的 TypeScript 代码示例，**改写为 Python 等价代码**，让只懂 Python 的读者也能看懂 Pi-Agent 的设计原理。

## 为什么有这个版本

Pi-Agent 的官方 SDK 是 TypeScript 包（`@earendil-works/pi-ai`、`pi-agent-core`、`pi-coding-agent`），并没有官方 Python 版本。原教程的代码示例全部是 TS——对只懂 Python 的读者不友好。

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

本版本与 260702 TS 源版完全对应——10 章一一对齐：

| 章节 | 主题 | TS 代码块数 |
|------|------|------------|
| 第1章 | 开篇 · Pi-Agent 框架总览 | 3 |
| 第2章 | 三层架构 · Pi-Agent 项目的骨骼 | 10 |
| 第3章 | Agent Loop · 让模型转动起来的引擎 | 21 |
| 第4章 | 模型调用 · 一行代码驾驭多个模型 | 15 |
| 第5章 | 工具系统 · Agent 的手脚是怎么被管住的 | 13 |
| 第6章 | 消息系统 · Agent 的记忆如何组织与传递 | 10 |
| 第7章 | 事件驱动 · Agent 的神经系统 | 9 |
| 第8章 | 上下文工程 · 让有限窗口装下无限对话 | 2 |
| 第9章 | 上下文压缩 · 当对话太长怎么办 | 5 |
| 第10章 | 会话管理 · 对话的存储恢复与分叉 | 7 |

合计 **95 个 TS 代码块**全部改写为 Python 等价代码。

> 注：260702 TS 源版只包含这 10 章。旧 Python 版（260702）里额外的"中场总结 / 扩展系统 / 测试模式 / 设计精华"章节，新 TS 源版没有，本版本也没有。

## 资源文件

- `assets/` — 完整复制自 TS 源版（260702），所有 `.svg` / `.html` 文件与原版一致
- `_chapter-design/` — 章节设计文档，也完整复制

## 与旧版（260702 Python 版）的差异

- **章节范围**：旧版有 13 章（含中场+扩展+测试+设计精华），本版严格对齐 TS 源的 10 章
- **章节 8 新增**：旧版第 8 章是"上下文压缩"，新版第 8 章是"上下文工程"（全新章节），原"上下文压缩"成为新版第 9 章
- **章节 9/10 重写**：新版第 9 章（压缩）和第 10 章（会话管理）内容有大幅修订，所有 Python 代码按最新 TS 源重写
- **风格统一**：所有代码块都加了"原文 TS + 概念对照"的注释头，旧版没有这个规范

## 阅读建议

- 第一次读：**只看 Python 代码**就能理解 Pi 的运行机制
- 想深入 Pi 源码：回到 [TS 源版](../项目原理-二次整理版-插图版-260702/) 或 `repo/packages/` 看实际 TS 实现
- 注意 Python 代码里的 `pi_agent_core`、`pi_ai`、`pi_coding_agent` 等 import 是**示意性的**——这些 Python 包并不存在，Pi 的官方 SDK 只有 TS 版
