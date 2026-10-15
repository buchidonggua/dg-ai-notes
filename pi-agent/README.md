# Pi-Agent 双轨教程

> 两条互补的路线教你 [pi-agent](https://github.com/earendil-works/pi) SDK：**实战上手**（搭一个能上线的 Agent）+ **源码精读**（看懂 SDK 怎么造）。

## 🚀 实战上手篇 · 7 章

用一个真实场景（企业数据分析助手 DataAgent），从零搭一个能上线的垂直 Agent。讲的是「改哪一层、为什么这样接」，配套 [7 组可运行代码](./pi_sdk_learn/code/)。

> 路径：[pi_sdk_learn/docs/](./pi_sdk_learn/docs/) · 在线版见 https://dg-ai-notes.pages.dev

| 章节 | 主题 | Markdown |
|------|------|----------|
| P01 | 环境部署 —— 10 分钟跑通第一个 Agent | [📖](./pi_sdk_learn/docs/第1章-环境部署-10分钟跑通第一个Agent.md) |
| P02 | 读懂第一个 Agent —— 核心 API 与三层架构 | [📖](./pi_sdk_learn/docs/第2章-先看全貌-搞懂pi-agent工作机制.md) |
| P03 | 模型配置关键点 —— 判断企业内网模型能否接入 | [📖](./pi_sdk_learn/docs/第3章-模型配置的关键-判断企业内网能否接入.md) |
| P04 | 系统提示词 —— 必须覆盖默认 Agent 人设 | [📖](./pi_sdk_learn/docs/第4章-系统提示词-必须覆盖默认Agent人设.md) |
| P05 | 定义工具 —— 从功能实现到交互体验 | [📖](./pi_sdk_learn/docs/第5章-定义工具-从功能到交互pi都想到了.md) |
| P06 | 事件监听 —— 实现你的所有个性化需求 | [📖](./pi_sdk_learn/docs/第6章-事件监听-实现你的个性化需求.md) |
| P07 | 准备上线 —— 把 Agent 封装成一个服务 | [📖](./pi_sdk_learn/docs/第7章-准备上线-把Agent封装成服务.md) |

> 配套代码：[pi_sdk_learn/code/](./pi_sdk_learn/code/)（L01–L07，`npm install` 后按章运行）

## 🔬 源码精读篇 · 12 章

12 章系统拆解 pi-agent 的源码设计与实现，每章回答「是什么 / 怎么做 / 为什么」。提供 **TypeScript + Python 双版本**对照。

> 源码基准：2026-10-12 本地 `pi-main` 快照（核心包 `v0.84.3`），源码精读篇按这份快照核对。

> 路径：[pi_source_dive/typescript/](./pi_source_dive/typescript/) · [pi_source_dive/python/](./pi_source_dive/python/) · 在线版见 https://dg-ai-notes.pages.dev

```
ch01 开篇总览    →  ch02 三层架构   →  ch03 Agent Loop  →  ch04 模型调用  →  ch05 工具系统
                                                                       ↓
ch06 消息系统    →  ch07 事件驱动   →  ch08 上下文工程  →  ch09 上下文压缩  →  ch10 会话管理
                                                                       ↓
ch11 扩展系统    →  ch12 测试模式
```

| 章节 | 主题 | TS 版 | Python 版 |
|------|------|-------|-----------|
| M01 | 开篇 - Pi-Agent 框架总览 | [📖](./pi_source_dive/typescript/第1章-开篇-Pi-Agent框架总览.md) | [🐍](./pi_source_dive/python/第1章-开篇-Pi-Agent框架总览.md) |
| M02 | 三层架构 - 项目骨骼 | [📖](./pi_source_dive/typescript/第2章-三层架构-Pi-Agent项目的骨骼.md) | [🐍](./pi_source_dive/python/第2章-三层架构-Pi-Agent项目的骨骼.md) |
| M03 | Agent Loop - 模型转动起来的引擎 | [📖](./pi_source_dive/typescript/第3章-Agent-Loop-让模型转动起来的引擎.md) | [🐍](./pi_source_dive/python/第3章-Agent-Loop-让模型转动起来的引擎.md) |
| M04 | 模型调用 - 一行代码驾驭多模型 | [📖](./pi_source_dive/typescript/第4章-模型调用-一行代码驾驭多个模型.md) | [🐍](./pi_source_dive/python/第4章-模型调用-一行代码驾驭多个模型.md) |
| M05 | 工具系统 - Agent 的手脚如何被管住 | [📖](./pi_source_dive/typescript/第5章-工具系统-Agent的手脚是怎么被管住的.md) | [🐍](./pi_source_dive/python/第5章-工具系统-Agent的手脚是怎么被管住的.md) |
| M06 | 消息系统 - Agent 的记忆组织与传递 | [📖](./pi_source_dive/typescript/第6章-消息系统-Agent的记忆如何组织与传递.md) | [🐍](./pi_source_dive/python/第6章-消息系统-Agent的记忆如何组织与传递.md) |
| M07 | 事件驱动 - Agent 的神经系统 | [📖](./pi_source_dive/typescript/第7章-事件驱动-Agent的神经系统.md) | [🐍](./pi_source_dive/python/第7章-事件驱动-Agent的神经系统.md) |
| M08 | 上下文工程 - 让有限窗口装下无限对话 | [📖](./pi_source_dive/typescript/第8章-上下文工程-让有限窗口装下无限对话.md) | [🐍](./pi_source_dive/python/第8章-上下文工程-让有限窗口装下无限对话.md) |
| M09 | 上下文压缩 - 当对话太长怎么办 | [📖](./pi_source_dive/typescript/第9章-上下文压缩-当对话太长怎么办.md) | [🐍](./pi_source_dive/python/第9章-上下文压缩-当对话太长怎么办.md) |
| M10 | 会话管理 - 对话的存储恢复与分叉 | [📖](./pi_source_dive/typescript/第10章-会话管理-对话的存储恢复与分叉.md) | [🐍](./pi_source_dive/python/第10章-会话管理-对话的存储恢复与分叉.md) |
| M11 | 扩展系统 - 不改源码给 Agent 加能力 | [📖](./pi_source_dive/typescript/第11章-扩展系统-不改源码给Agent加能力.md) | [🐍](./pi_source_dive/python/第11章-扩展系统-不改源码给Agent加能力.md) |
| M12 | 测试模式 - 不用真实模型验证 Agent 行为 | [📖](./pi_source_dive/typescript/第12章-测试模式-不用真实模型验证Agent行为.md) | [🐍](./pi_source_dive/python/第12章-测试模式-不用真实模型验证Agent行为.md) |

> 🧪 **补充材料**：[notebooks/agent-loop.ipynb](./notebooks/agent-loop.ipynb) 是第 3 章 Agent Loop 的可执行实验场。

## 📚 三种阅读方式

| 方式 | 入口 | 适合场景 |
|------|------|----------|
| 🌐 **Web 在线版**（推荐） | https://dg-ai-notes.pages.dev | 双系列切换、配图联动、主题切换 |
| 📥 **Markdown 下载版** | 上表链接 | 配合 AI 边读边问、对照源码 |
| 📕 **PDF 版** | [GitHub Releases](https://github.com/buchidonggua/dg-ai-notes/releases) | 离线阅读、打印、长期存档（源码精读篇） |

## 🚀 本地运行 web 电子书

```bash
cd web
npm install
npm run dev      # http://localhost:4321
```

详细说明见 [web/README.md](./web/README.md)。

## 📥 PDF 下载

PDF 版本不进 git 仓库（避免仓库膨胀），通过 GitHub Releases 分发。已有下载文件属于对应历史发布；本次源码快照更新覆盖 Markdown、Web 内容及 PDF 导出章节清单，尚未生成新的 PDF：

1. 进入 [Releases 页面](https://github.com/buchidonggua/dg-ai-notes/releases)
2. 下载对应版本：
   - `pi-agent-book-ts.pdf` — TypeScript 版（约 14MB）
   - `pi-agent-book-python.pdf` — Python 版（约 16MB）

## 📜 License

- 代码：[MIT](../LICENSE)
- 文档：[CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)
