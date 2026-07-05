# Pi-Agent 深度教程

> 10 章拆解 [pi-agent](https://github.com/earendil-works/pi) SDK 的源码设计与实现

## 📚 4 种阅读方式

| 方式 | 路径 / 链接 | 适合场景 |
|------|------------|----------|
| 🌐 在线电子书 | https://dg-ai-notes.pages.dev | PC 端沉浸式阅读（推荐） |
| 📖 Markdown (TS) | [docs/typescript/](./docs/typescript/) | 边读边问 AI、对照源码 |
| 🐍 Markdown (Python) | [docs/python/](./docs/python/) | Python 读者 |
| 📥 PDF | GitHub Releases 页 | 离线阅读 / 打印 |
| 🧪 Notebook | [notebooks/agent-loop.ipynb](./notebooks/agent-loop.ipynb) | Agent Loop 实验场 |

> 本教程基于 Pi **v0.80.2** 编写。源码链接指向 [earendil-works/pi](https://github.com/earendil-works/pi) main 分支，可能与 v0.80.2 有微小差异。

## 🗺️ 章节结构

```
ch01 开篇总览    →  ch02 三层架构   →  ch03 Agent Loop  →  ch04 模型调用  →  ch05 工具系统
                                                                       ↓
ch06 消息系统    →  ch07 事件驱动   →  ch08 上下文工程  →  ch09 上下文压缩  →  ch10 会话管理
```

| 章节 | 主题 | TS 版 | Python 版 |
|------|------|-------|-----------|
| ch01 | 开篇 - Pi-Agent 框架总览 | [📖](./docs/typescript/第1章-开篇-Pi-Agent框架总览.md) | [🐍](./docs/python/第1章-开篇-Pi-Agent框架总览.md) |
| ch02 | 三层架构 - 项目骨骼 | [📖](./docs/typescript/第2章-三层架构-Pi-Agent项目的骨骼.md) | [🐍](./docs/python/第2章-三层架构-Pi-Agent项目的骨骼.md) |
| ch03 | Agent Loop - 模型转动起来的引擎 | [📖](./docs/typescript/第3章-Agent-Loop-让模型转动起来的引擎.md) | [🐍](./docs/python/第3章-Agent-Loop-让模型转动起来的引擎.md) |
| ch04 | 模型调用 - 一行代码驾驭多模型 | [📖](./docs/typescript/第4章-模型调用-一行代码驾驭多个模型.md) | [🐍](./docs/python/第4章-模型调用-一行代码驾驭多个模型.md) |
| ch05 | 工具系统 - Agent 的手脚如何被管住 | [📖](./docs/typescript/第5章-工具系统-Agent的手脚是怎么被管住的.md) | [🐍](./docs/python/第5章-工具系统-Agent的手脚是怎么被管住的.md) |
| ch06 | 消息系统 - Agent 的记忆组织与传递 | [📖](./docs/typescript/第6章-消息系统-Agent的记忆如何组织与传递.md) | [🐍](./docs/python/第6章-消息系统-Agent的记忆如何组织与传递.md) |
| ch07 | 事件驱动 - Agent 的神经系统 | [📖](./docs/typescript/第7章-事件驱动-Agent的神经系统.md) | [🐍](./docs/python/第7章-事件驱动-Agent的神经系统.md) |
| ch08 | 上下文工程 - 让有限窗口装下无限对话 | [📖](./docs/typescript/第8章-上下文工程-让有限窗口装下无限对话.md) | [🐍](./docs/python/第8章-上下文工程-让有限窗口装下无限对话.md) |
| ch09 | 上下文压缩 - 当对话太长怎么办 | [📖](./docs/typescript/第9章-上下文压缩-当对话太长怎么办.md) | [🐍](./docs/python/第9章-上下文压缩-当对话太长怎么办.md) |
| ch10 | 会话管理 - 对话的存储恢复与分叉 | [📖](./docs/typescript/第10章-会话管理-对话的存储恢复与分叉.md) | [🐍](./docs/python/第10章-会话管理-对话的存储恢复与分叉.md) |

## 🚀 本地运行 web 电子书

```bash
cd web
npm install
npm run dev      # http://localhost:4321
```

详细说明见 [web/README.md](./web/README.md)。

## 📥 PDF 下载

PDF 版本不进 git 仓库（避免仓库膨胀），通过 GitHub Releases 分发：

1. 进入 [Releases 页面](https://github.com/buchidonggua/dg-ai-notes/releases)
2. 下载对应版本：
   - `pi-agent-book-ts.pdf` — TypeScript 版（约 14MB）
   - `pi-agent-book-python.pdf` — Python 版（约 16MB）

## 📜 License

- 代码：[MIT](../LICENSE)
- 文档：[CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)
