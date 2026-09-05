

> Pi源码解读和二次开发实战

> 🌐 **在线阅读**：[dg-ai-notes.pages.dev](https://dg-ai-notes.pages.dev) —— 双轨教程 · 沉浸式阅读 · 深浅色主题
>
> [![在线电子书首页](./assets/web-home.png)](https://dg-ai-notes.pages.dev)

---

## 🤔 Pi-Agent 是什么？为什么值得学？

[**Pi-Agent**](https://github.com/earendil-works/pi) 是 [@earendil-works](https://github.com/earendil-works) 开源的 Agent SDK，定位是**生产级 AI Agent 的运行时底座**——也是 OpenClaw 这类 Agent 产品的底层框架。

它不是玩具框架：Claude Code、Cursor、Cline 等同类产品的内部架构，都能在 Pi 里找到对应实现。Agent Loop、工具系统、消息系统、事件驱动、会话管理、扩展机制——一个 Agent SDK 该有的东西它都有。**看懂 Pi，等于看懂一个完整的 Agent SDK 应该怎么设计。**

---

## 🎯 三大内容，总有一个你用得上

### 🔬 源码解读 · 10 章拆完一个生产级 SDK

不是贴代码加注释，而是每章回答「是什么 / 怎么做 / 为什么」：从三层架构、Agent Loop 一路讲到上下文工程、会话管理，把 Pi 的设计取舍讲透。**TypeScript + Python 双版本**对照，30+ 配图，还配了一个可单步运行、随便改参数的 [Agent Loop 实验场](./pi-agent/notebooks/agent-loop.ipynb)。

**怎么读**：[TS 版目录](./pi-agent/pi_source_dive/typescript/) · [Python 版目录](./pi-agent/pi_source_dive/python/) · [在线版](https://dg-ai-notes.pages.dev) · [PDF 下载](../../releases)

### 🚀 实战案例 · 7 章搭一个能上线的 Agent

拿真实场景（企业数据分析助手 DataAgent）从零开始：环境部署 → 模型接入评估 → 系统提示词 → 定义工具 → 事件监听 → 封装成服务。讲的是「改哪一层、为什么这样接」，7 组配套代码（L01–L07）`npm install` 即跑——跟着敲完，你手里就有一个能部署的垂直 Agent。

**怎么学**：[教程目录](./pi-agent/pi_sdk_learn/docs/) · [配套代码](./pi-agent/pi_sdk_learn/code/) · [在线版](https://dg-ai-notes.pages.dev)

### 🧩 Skill 应用 · 让你的 AI 助手秒懂 pi-agent

**dg-piagent** 是与教程同步维护的 SDK 开发助手 skill（API 核对到 pi-coding-agent `v0.83.0`）。它从两个视角装订成册：**SDK 功能视角**可当官方文档查，**场景应用视角**可当学习手册翻。装进智能体后，写 pi-agent 代码不用再翻文档——**你只管提需求，AI 查 skill 完成开发**。

**快速上手示例**（装好后对 AI 直接说人话）：

| 你说 | AI 做 |
|---|---|
| "使用 dg-piagent skill，开发一个 DataAgent：web 应用、数据自己造、拦截危险 SQL" | 按需求匹配场景、查 SDK 用法，从零搭环境到跑通一步到位 |
| "使用 dg-piagent skill，根据这份模型接口文档生成模型配置" | 判断内网模型能否接入 pi-agent（缺哪些参数、如何绕过），直接输出一份可用的模型配置文件 |
| "使用 dg-piagent skill，帮我实现 XX 功能，没有设计思路" | 搜索社区同类扩展、自行解读源码，结合你的项目给出一套设计方案 |

skill 里还沉淀了作者踩过的坑与最佳实践（比如工具报错时把原因和解决办法封装成结果交还模型自行纠错），AI 会照着这些经验做设计，比让它自己搜网上的零散文档靠谱。

**怎么装**：下载 [skills/dg-piagent/](./skills/dg-piagent/) 文件夹，放进你所用智能体的 skills 目录即可——Claude Code / ZCode / Codex / pi 通用，无需其他配置，详见[安装说明](./skills/README.md)。

> 🗺️ 全部章节目录与推荐阅读路径（先实战上手、再源码精读），见 [Pi-Agent 教程 README](./pi-agent/README.md)。

---

## 📺 配套讲解视频

不想干读文字？B 站有视频版：

- 🎬 [使用 pi-agent 的三种姿势，它凭什么成为 OpenClaw 的底层框架](https://www.bilibili.com/video/BV1CuNG6pERs) 
- 📖 [哦对了，我将 pi 源码写成了一本书……](https://www.bilibili.com/video/BV12WK666EhM) 
- 🧩 [我将 pi-agent 源码蒸馏成 skill，小白也能轻松开发自己的智能体](https://www.bilibili.com/video/BV1Ey8s65EkZ) 

---

## 📚 三种阅读方式

| 方式 | 入口 | 适合场景 |
|------|------|----------|
| 🌐 **Web 在线版**（推荐） | https://dg-ai-notes.pages.dev | PC 端沉浸式阅读，双轨切换 + 深浅色主题 |
| 📥 **Markdown 下载版** | [pi-agent/](./pi-agent/) 目录下两系列 | 下载到本地，配合 AI 边读边问、对照源码 |
| 📕 **PDF 版** | [Releases](../../releases) | 离线阅读、打印、长期存档（源码精读篇） |

---

## 📁 项目结构

```
dg-ai-notes/
├── pi-agent/                          # 核心教程目录
│   ├── pi_source_dive/                # 源码精读系列
│   │   ├── typescript/                #   TypeScript 版（10 章）
│   │   └── python/                    #   Python 版（10 章）
│   ├── pi_sdk_learn/                  # 实战案例系列
│   │   ├── docs/                      #   教程文档（7 章）
│   │   └── code/                      #   配套代码（L01-L07）
│   ├── notebooks/                     # Jupyter 实验场
│   │   └── agent-loop.ipynb           #   Agent Loop 从零搭建
│   ├── web/                           # 在线电子书（Astro + React）
│   └── README.md                      # 教程总目录与阅读路径
├── skills/                            # AI Agent Skills
│   └── dg-piagent/                    #   Pi-Agent SDK 开发助手
│       ├── SKILL.md                   #     核心指南（96 行）
│       └── references/                #     场景文件 + API 文档
│           ├── scenarios/             #       62 个场景文件
│           └── sdk_doc/               #       22 个 API 参考
├── assets/                            # 图片资源
├── CONTRIBUTING.md                    # 贡献指南
├── LICENSE                            # MIT + CC-BY-SA-4.0
└── README.md                          # 你在这里
```

---

## 📁 项目结构

```
dg-ai-notes/
├── pi-agent/                          # 核心教程目录
│   ├── pi_source_dive/                # 源码精读系列
│   │   ├── typescript/                #   TypeScript 版（10 章）
│   │   └── python/                    #   Python 版（10 章）
│   ├── pi_sdk_learn/                  # 实战案例系列
│   │   ├── docs/                      #   教程文档（7 章）
│   │   └── code/                      #   配套代码（L01-L07）
│   ├── notebooks/                     # Jupyter 实验场
│   ├── web/                           # 在线电子书（Astro + React）
│   └── README.md                      # 教程总目录与阅读路径
├── skills/                            # AI Agent Skills
│   └── dg-piagent/                    #   Pi-Agent SDK 开发助手
│       ├── SKILL.md                   #     核心指南
│       └── references/                #     场景文件 + API 文档
├── assets/                            # 图片资源
├── CONTRIBUTING.md                    # 贡献指南
├── LICENSE                            # MIT + CC-BY-SA-4.0
└── README.md                          # 你在这里
```

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

## 👋 关于作者

大家好，我是**冬瓜**，一个热衷于拆解 AI 工程的博主

如果你觉得内容有帮助，欢迎关注，一起交流 AI / Agent / LLM 的工程实践——

<table>
  <tr>
    <td width="50%" align="center">
      <img src="./assets/donghua-douyin-qr.png" alt="冬瓜的抖音二维码" width="220" />
      <br /><sub><b>抖音 · 冬瓜</b></sub>
      <br /><sub>AI 技术科普 · 源码拆解</sub>
    </td>
    <td width="50%" align="center">
      <img src="./assets/donghua-bilibili-qr.jpg" alt="冬瓜的 B 站二维码" width="220" />
      <br /><sub><b>B 站 · 冬瓜</b></sub>
      <br /><sub>长视频教程 · 直播 coding</sub>
    </td>
  </tr>
</table>


---

## 🙏 Acknowledgments

- [Pi-Agent](https://github.com/earendil-works/pi) 官方团队 —— 没有他们的开源，就没有这本笔记
- 所有引用的开源项目作者
