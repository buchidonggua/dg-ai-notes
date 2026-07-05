# 📚 dg-ai-notes

> 冬瓜的 AI 学习笔记 · 当前重点：[Pi-Agent](https://pi.dev) SDK 深度教程

---

## 🤔 Pi-Agent 是什么？为什么要学它？

[**Pi-Agent**](https://github.com/earendil-works/pi) 是 [@earendil-works](https://github.com/earendil-works) 开源的 Agent SDK，定位是**生产级 AI Agent 的运行时底座**。

它不是玩具框架，而是一套**真正能上线**的 Agent 工程参考实现——同类产品（Claude Code、Cursor、Cline 等）的内部架构都能在 Pi 里找到对应。看懂 Pi，等于看懂一个完整的 Agent SDK 应该怎么设计。

**核心能力**：

- 🔄 **Agent Loop** —— 模型循环调用、停止条件、错误防线，构建可靠的 LLM 运行循环
- 🛠️ **工具系统** —— 五步管道（定义/注册/拦截/执行/回收），让 LLM 长出受控的"手脚"
- 💬 **消息系统** —— 内部 7 种自由表达，对外翻译成 3 种标准 Message，兼顾灵活性与兼容性
- 📡 **事件驱动** —— 同步屏障 + 发布订阅，让扩展和宿主像神经系统一样协同
- 🗂️ **会话管理** —— Session Tree 让对话可存储、可恢复、可分叉
- 🧩 **扩展机制** —— 工厂函数 + throwing stubs + 事件总线，让 Pi 能被改造成任何形态

**谁该学**：

- 想用 pi-agent SDK 自己搭 Agent 的开发者
- 想理解生产级 Agent "内部如何运转"的工程师
- 不满足于"会用 Claude Code"，想看懂 Harness 设计的好奇心党

---

## 📖 本教程：10 章拆解一个 Agent SDK

10 章系统拆解 Pi-Agent 的源码设计与实现，每一章都回答三个层次的问题：**是什么**（概念）、**怎么做**（源码分析）、**为什么这样做**（设计取舍）。

```
ch01 开篇总览    →  ch02 三层架构   →  ch03 Agent Loop  →  ch04 模型调用  →  ch05 工具系统
                                                                       ↓
ch06 消息系统    →  ch07 事件驱动   →  ch08 上下文工程  →  ch09 上下文压缩  →  ch10 会话管理
```

每一章都提供 **TypeScript 版**（与 Pi 原作同语言）和 **Python 版**（方便只熟悉 Python 的读者）双版本对照。

---

## 📚 三种阅读方式

| 方式 | 入口 | 适合场景 |
|------|------|----------|
| 🌐 **Web 在线版**（推荐） | https://dg-ai-notes.pages.dev | PC 端沉浸式阅读，三栏布局 + 配图联动 + 主题切换 |
| 📥 **Markdown 下载版** | [pi-agent/docs/](./pi-agent/docs/) | 下载到本地，配合 AI（Claude / Cursor / 等）边读边问、对照源码 |
| 📕 **PDF 版** | [v1.0 Release](../../releases/tag/v1.0) | 离线阅读、打印、长期存档 |

> TS 版路径：[pi-agent/docs/typescript/](./pi-agent/docs/typescript/)
> Python 版路径：[pi-agent/docs/python/](./pi-agent/docs/python/)

---

## 🧪 补充材料：Agent Loop Notebook

[notebooks/agent-loop.ipynb](./pi-agent/notebooks/agent-loop.ipynb) 是第 3 章 Agent Loop 的可执行实验场，可以单步运行、改参数、观察 loop 状态。

> ⚠️ 本教程主体为"阅读型"，配套实验代码（L00-L31 课程实战）暂未公开。Notebook 仅作 Agent Loop 章节的补充实验场。

---

## 🗺️ 内容地图

详见 [Pi-Agent 教程 README](./pi-agent/README.md)。

---

## 🤝 贡献

发现 typo / 内容错误？欢迎：

- 提 [Issue](../../issues)（建议用「内容勘误」模板）
- 直接发 PR 修

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

---

## 📜 License

- **代码**：[MIT](./LICENSE)
- **文档**：[CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)（要求演绎作品同样开源，保护教程不被商业站抓走洗稿）

---

## 🙏 Acknowledgments

- [Pi-Agent](https://github.com/earendil-works/pi) 官方团队 —— 没有他们的开源，就没有这本笔记
- 所有引用的开源项目作者
