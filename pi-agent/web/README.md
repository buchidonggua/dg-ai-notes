# Pi Agent Book

基于 Astro 5 + React 19 + MDX 的源码精读电子书，系统性拆解 [Pi Agent](https://pi.dev) SDK 的架构与实现。

10 个章节（ch01~ch10）覆盖：开篇总览、三层架构、Agent Loop、模型调用、工具系统、消息系统、事件驱动、上下文工程、上下文压缩、会话管理。**TypeScript + Python 双版本齐全**（20 个 mdx 文件），顶栏一键切换。**为什么有 Python 版**：Pi Agent 原作是 TypeScript，转写版方便只熟悉 Python 的读者聚焦设计本身。

> 🌐 在线版本：https://dg-ai-notes.pages.dev

---

## 快速开始

```bash
# 安装依赖（首次）
npm install

# 开发模式（热重载，http://localhost:4321）
npm run dev

# 生产构建（输出到 dist/）
npm run build

# 预览构建产物（http://localhost:4321）
npm run preview
```

**环境要求**：Node.js ≥ 18，任意现代浏览器。

---

## 读者使用指南

只想看文档不关心开发？两种方式：

### 方式一：本地起站点（推荐，离线可用）

```bash
npm install && npm run dev
# 浏览器打开 http://localhost:4321
```

### 方式二：直接读源 md 文件

源文档（Markdown 原稿，无需构建）在仓库的 `../docs/` 目录：
- TS 版原稿：`../docs/typescript/`
- Python 版原稿：`../docs/python/`

### 阅读界面操作

| 操作 | 效果 |
|------|------|
| 顶栏 **TS / Python** 切换器 | 同一章在两种语言间跳转，偏好记到 localStorage，下次自动应用 |
| 顶栏 **☀ / 🌙** 按钮 | 浅色/深色/跟随系统三态循环，`T` 键快捷键 |
| 左侧 TOC | 章节层级导航（hover 显示模块号 M01-M10） |
| 右侧 On-This-Page | 当前页面的二级/三级标题大纲，滚动时高亮当前节 |
| 点击 SVG 图内节点 | 自动跳转到对应代码块并高亮（Ch3 Agent Loop 已布好锚点） |
| 点击图片 | 放大查看，`Esc` 或滚轮缩放退出 |
| 底部 **← 上章 / 下章 →** | 按 displayOrder 顺序连续阅读（ch01 → ch10 一条主线） |

### 章节结构

```
ch01 开篇总览    →  ch02 三层架构   →  ch03 Agent Loop  →  ch04 模型调用  →  ch05 工具系统
                                                                       ↓
ch06 消息系统    →  ch07 事件驱动   →  ch08 上下文工程  →  ch09 上下文压缩  →  ch10 会话管理
```

---

## 主要功能

| 能力 | 说明 |
|------|------|
| **三栏阅读布局** | 左 TOC（240px）/ 正文（720px）/ 右大纲（240px），1279px 以下隐藏右栏，767px 以下转汉堡菜单 |
| **TS/Python 双版本** | 每章并排两个 mdx：`chXX-xxx.mdx`（TS 版）+ `chXX-xxx.python.mdx`（Python 改写版）。URL 各自独立（`/modules/ch03-agent-loop` vs `/modules/ch03-agent-loop.python`），顶栏 LanguageSwitcher 一键切换，偏好记到 localStorage |
| **代码块增强** | Shiki 语法高亮 + 语言标签 + 一键复制 + 30 行以上自动折叠 |
| **SVG 图表联动** | 点击图内节点自动滚动到对应代码块（S2 双向联动）；目前已在 **Ch5 工具系统五步管道图** 实现，其他章节待扩展（Phase 4-C）。点击图片放大查看（lightbox 支持 Esc/滚轮缩放） |
| **交互式 Islands** | 3 个 React 组件按需水合：S3 Partial Message 时间线 / S4 错误防线演示（均挂载在 Ch3 Agent Loop）/ S5 首页知识图谱（10 节点新结构） |
| **章节字数/阅读时长** | 详情页 header 与首页"全部章节"卡片都显示 `xxxx字 · 含 N 行代码 · 约 M 分钟`。`collection.ts:getModuleStats()` 在构建时读 mdx 源文件实时计算（CJK 按字 + 英文按词，代码块单独算非空行不计入字数，阅读时长 = 字数/300）。改了 mdx 内容自动跟随，无需维护 |
| **主题切换** | 浅色/深色/跟随系统三态，无 FOUC（anti-FOUC 脚本在 `<head>` 中同步执行），跨标签页同步 + `T` 键快捷键 |
| **无障碍** | WAI-ARIA tabs 键盘模式（ArrowLeft/Right/Home/End）、`:focus-visible` 焦点环、`prefers-reduced-motion` 双层覆盖（CSS @media + JS matchMedia） |
| **设计令牌** | 颜色/字号/间距/圆角/阴影/动效全部走 `tokens.css` 的 CSS 变量，深色主题独立精调 |

---

## 许可

代码采用 [MIT License](../LICENSE)，文档采用 [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)。
