# Pi Agent Book

基于 Astro 5 + React 19 + MDX 的源码精读电子书，系统性拆解 [Pi Agent](https://pi.dev) SDK 的架构与实现。

10 个章节（ch01~ch10）覆盖：开篇总览、三层架构、Agent Loop、模型调用、工具系统、消息系统、事件驱动、上下文工程、上下文压缩、会话管理。**TypeScript + Python 双版本齐全**（20 个 mdx 文件），顶栏一键切换。**为什么有 Python 版**：Pi Agent 原作是 TypeScript，转写版方便只熟悉 Python 的读者聚焦设计本身。

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

## 项目结构

```
pi-agent-book/
├── astro.config.mjs          # Astro 配置（MDX + React + remark 插件）
├── package.json              # npm scripts: dev / build / preview / prebuild
├── scripts/
│   ├── check-counterpart.mjs   # 双版本 frontmatter 一致性校验（prebuild 钩子）
│   ├── sync-from-source.mjs    # 从源 .md 同步 body 到 mdx（图片语法转换 + diagrams 注入）
│   └── check-sync.mjs          # mdx body 与源 .md 漂移检测（npm run check:sync）
├── public/
│   ├── assets/               # 28 张全章节配图 SVG（260702-chXX-name 命名）
│   └── js/
│       └── diagram-linker.js # S2 图↔代码块联动（Vanilla JS 全局脚本）
└── src/
    ├── components/
    │   ├── CodeBlock.astro        # 代码块增强（复制/折叠/行号）
    │   ├── Diagram.astro          # SVG 图表 + 图说（纯服务端渲染）
    │   ├── DiagramLightbox.astro  # 全局 lightbox + 内联 SVG 注入（DOMParser 安全解析）
    │   ├── LanguageSwitcher.astro # TS/Python 切换器（WAI-ARIA tabs 键盘模式）
    │   ├── LeftTOC.astro          # 左侧模块导航
    │   ├── RightOutline.astro     # 右侧 On-This-Page 大纲（IntersectionObserver 高亮）
    │   ├── TopBar.astro           # 顶栏（含汉堡菜单）
    │   ├── PrevNextNav.astro      # 上下章导航
    │   ├── ProgressRail.astro     # 阅读进度条
    │   ├── ThemeToggle.astro      # 主题切换按钮
    │   ├── ModuleCard.astro      # 首页"全部章节"卡片（标题 + summary + 字数/时长）
    │   ├── ModuleLink.astro       # 跨模块引用（HEAD 探测 Python 版可用性）
    │   ├── chapter/
    │   │   ├── ChapterFooter.astro   # 本章要点 + 扩展阅读 + 模拟器挂载
    │   │   └── SimulatorSlot.astro   # 按 preset 加载对应 Island
    │   └── islands/                 # React 交互组件（client:visible 懒加载）
    │       ├── PartialMessageTimeline.tsx   # S3 - partial message 原地替换
    │       ├── ErrorDefenseDemo.tsx         # S4 - 三层错误防线
    │       ├── KnowledgeGraph.tsx           # S5 - 首页依赖图谱
    │       └── shared/                      # Island 共享组件
    │           ├── EventTimeline.tsx
    │           ├── MessageCard.tsx
    │           └── PlayControls.tsx
    ├── content/
    │   ├── config.ts          # Zod schema（variant/counterpart/diagrams/simulator）
    │   └── modules/           # 20 个 MDX 文件（10 TS + 10 Python，ch01~ch10）
    ├── data/
    │   └── module-graph.ts    # 10 节点（ch01-ch10）的依赖图谱数据，2×5 网格布局
    ├── layouts/
    │   ├── BaseLayout.astro   # anti-FOUC + 字体加载 + 全局 lightbox 挂载
    │   └── ModuleLayout.astro # 三栏 grid 布局
    ├── pages/
    │   ├── index.astro        # 首页（hero + 知识图谱 + 最近更新）
    │   └── modules/
    │       └── [...slug].astro # 动态路由（getStaticPaths 生成双 URL）
    ├── styles/
    │   ├── tokens.css         # 设计令牌单一真理源（颜色/字号/间距/圆角/阴影/动效）
    │   ├── base.css           # 重置 + 全局基础 + reduced-motion
    │   └── prose.css          # .prose 长文排版 + 深色 SVG 反相
    └── utils/
        └── collection.ts      # getModuleBySlug / getAdjacentModules / getVariantUrl / getModuleStats / getPublishedModules
```

---

## 内容创作指南

### 新增一个章节（以 ch13 为例）

1. **创建 TS 版**：`src/content/modules/ch13-xxx.mdx`

```mdx
---
title: 模块标题
module: M13
displayOrder: 13
status: published            # published | draft | planned
variant: ts                  # 默认 ts
summary: 一句话摘要（显示在 TOC 和首页）
prev: ch10-session          # 上一个章节的 slug
# next: ch12-yyy            # 下一个章节（如果有）
diagrams:                   # 可选：本章节配图
  - id: my-diagram
    file: /assets/ch13-my-diagram.svg
    caption: 图 1｜说明文字
keyPoints:                  # 可选：本章要点
  - 要点 1
  - 要点 2
furtherReading:             # 可选：扩展阅读
  - label: 外部链接标题
    url: https://example.com
  - label: 内部章节引用
    module: ch03-agent-loop
---

正文用标准 Markdown / MDX 语法。
```

2. **创建 Python 版**：`src/content/modules/ch13-xxx.python.mdx`（双版本机制现已启用，新章节必须同时提供两版）

```mdx
---
title: 模块标题                  # 必须与 TS 版完全相同
module: M13
displayOrder: 13
status: published
variant: python                # ← 改这里
counterpart: ch13-xxx          # ← 指向 TS 版 slug（不带 .python）
slug: ch13-xxx.python          # ← 必须！Astro 会把 ch13.python.mdx 的点剥掉
summary: 一句话摘要              # 必须与 TS 版完全相同
prev: ch10-session
# 其他字段全部与 TS 版一致
---

正文（Python 改写版）。
```

> **关键**：Python 版**必须**有 `slug: <base>.python` 这一行，否则 Astro 会把文件名 `ch13.xxx.python.mdx` 的点剥成 `ch13xxxpython`，路由就断了。`check-counterpart.mjs` 会在 build 前自动检查这一点。

3. **frontmatter 一致性**

TS 版和 Python 版的 `title` / `module` / `displayOrder` / `status` / `summary` / `prev` / `next` / `diagrams` / `keyPoints` / `furtherReading` 字段值必须**完全相同**（只有 `variant` 和 `counterpart` 不同）。`check-counterpart.mjs` 会做深比较，不一致直接 build 失败。

### 在正文中使用组件

```mdx
import { Diagram } from '../components/Diagram.astro';
import ModuleLink from '../components/ModuleLink.astro';

<Diagram id="msg-journey" file="/assets/260702-ch06-message-pipeline.svg" caption="图 1｜一条消息的旅程" />

<ModuleLink slug="ch05-tools">第 5 章 · 工具系统</ModuleLink>
```

### SVG 配图加 S2 联动锚点（Phase 4-B 起）

在 SVG 内部给关键节点加 `data-anchor="锚点id"` 属性：

```svg
<rect data-anchor="s2-ch05-step1" x="..." y="..." />
```

对应的 mdx 正文里在目标代码块**前一行**放一个不可见的锚点 span：

```mdx
<span id="s2-ch05-step1" class="s2-anchor" />

```typescript
// 目标代码
```
```

用户点击该 SVG 节点时，`public/js/diagram-linker.js` 会自动滚动到对应代码块并高亮 1.5s。反向：代码块进入视口时对应 SVG 节点也会发光。**目前仅 Ch5 五步管道图实现（参考 `docs/superpowers/specs/2026-07-02-s2-linkage-design.md`）。**

### 新增交互组件（React Island）

如果某个交互效果 Markdown 表达不了（动画、状态机、用户输入反馈），需要新增 Island：

1. 在 `src/components/islands/` 下新建 `MyDemo.tsx`，用 React 写交互
2. 共享原语（时间轴、消息卡片、播放控制）抽到 `src/components/islands/shared/`，多个 Island 复用
3. 共享样式写在 `src/components/chapter/SimulatorSlot.astro` 的 `<style is:global>` 里，用 `.loop-simulator` 等项目专属前缀避免污染
4. **两种挂载方式**：
   - **frontmatter 触发**：在 `content/config.ts` 的 `simulator.preset` enum 里加新值，在 `SimulatorSlot.astro` 里加分支 → MDX frontmatter 写 `simulator.preset: my-demo`
   - **MDX inline**：直接在 mdx 顶部 `import MyDemo from '../../components/islands/MyDemo.tsx'`，正文 `<MyDemo client:visible />`（推荐，更灵活）
5. `client:visible` 比 `client:load` 省 JS，首屏更快；只有需要立即交互的才用 `client:load`

---

## 开发流程总览

新增一篇文档（从零到上线）的标准流程：

```
1. 起草内容   →  在 分析文档/ 目录写好 Markdown 源稿
2. 拆分双版本 →  准备 TS 版（基于 JS 源码）+ Python 版（改写）
3. 落地 mdx   →  src/content/modules/mN-slug.mdx + mN-slug.python.mdx
4. 配图       →  SVG 放 public/assets/，frontmatter diagrams 列出，关键节点加 data-anchor
5. 交互       →  需要时按"新增交互组件"流程加 Island
6. 校验       →  npm run dev 本地预览 + npm run build 跑 check-counterpart + 构建
7. 提交       →  git commit，commit message 带 feat:/fix:/docs: 前缀
```

### 提交前必跑检查清单

```bash
npm run dev              # 浏览器实地验收页面布局、SVG 显示、交互
npm run build            # 必须无 error；有 warning 也要审视
node scripts/check-counterpart.mjs   # 单独跑校验，定位 frontmatter 不一致
```

### 踩坑清单（按踩坑频率排序）

1. **Python 版忘了 `slug:` 字段** ⚠️ 最高频
   - 症状：路由 404，或 slug 被 Astro 剥点成 `m3python`
   - 修复：`*.python.mdx` frontmatter **必须**写 `slug: <base>.python`
   - 防御：`check-counterpart.mjs` 已自动检查，build 会失败

2. **TS/Python frontmatter 不一致**
   - 症状：build 报 "TS and Python frontmatter mismatch"
   - 修复：两版的 `title / module / displayOrder / status / summary / prev / next / diagrams / keyPoints / furtherReading` 必须**逐字相同**

3. **Astro scoped style + JS 动态 DOM 不生效** ⚠️ 已知坑
   - 症状：scoped `<style>` 写的规则对 JS 创建的元素全部失效（参考 RightOutline bug）
   - 原因：JS `createElement` 生成的元素不带 `data-astro-cid-xxx`，scoped 选择器 miss
   - 修复：改用 `<style is:global>`，所有选择器加项目专属前缀（如 `.outline-*`）
   - 通用教训：**只要组件有 JS 动态创建子元素的逻辑，样式就必须 `is:global`**

4. **在 tokens.css 之外写死字面值**
   - 症状：颜色对不上、暗色模式失效、设计 review 被打回
   - 修复：所有颜色/字号/间距用 `var(--xxx)`，**只有** `tokens.css` 的 `:root` / `[data-theme="dark"]` 允许字面值

5. **CodeBlock 改动了 React Island 内部的 `<pre>`**
   - 症状：MessageCard 等 Island 内 hydration mismatch
   - 已防御：`CodeBlock.astro` 已加 `if (pre.closest('.message-card')) return;` 守卫
   - 新增 Island 时，若内部有代码块，类名带 `message-card` 或类似隔离标记

6. **SVG 暗色模式显示成黑块**
   - 症状：暗色主题下 SVG 不可读
   - 已防御：`prose.css` 给 `:root[data-theme="dark"] .prose figure svg` 加了 `filter: invert(1) hue-rotate(180deg)`
   - 新增 SVG 时如果颜色特殊，验证下暗色主题下的可读性

7. **MDX 里 React 组件没用 `client:` 指令**
   - 症状：组件渲染了但不交互（点击无反应）
   - 修复：必须加 `client:visible` / `client:load` 等 hydration 指令

---

## 设计系统

所有视觉数值都通过 `src/styles/tokens.css` 的 CSS 变量管理。**只有 `tokens.css` 的 `:root` 和 `:root[data-theme="dark"]` 块内允许出现字面值**，其他文件必须用 `var(--...)`。

### 调色板

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `--paper` | `#f5f5f5` | `#1a1d28` | 页面底色 |
| `--paper-raised` | `#ffffff` | `#252836` | 卡片/浮层 |
| `--ink` | `#2d3142` | `#e8e8e8` | 正文 |
| `--ink-strong` | `#1a1d28` | `#ffffff` | 标题 |
| `--soft` | `#6b7280` | `#9aa5ce` | 次要文字 |
| `--muted` | `#9ca3af` | `#6b7280` | 辅助文字 |
| `--accent` | `#eb6c36` | `#eb6c36` | 主色（珊瑚橙，深浅共用） |
| `--rule` | `#e5e7eb` | `#3a3d4a` | 分割线 |

### 字号阶梯

| Token | 值 | 用途 |
|-------|----|----|
| `--fs-h1` | `64px` | 首页大标题 |
| `--fs-h2` | `32px` | 章节标题 |
| `--fs-h3` | `22px` | 小节标题 |
| `--fs-body` | `18px` | 正文 |
| `--fs-small` | `14px` | 辅助文字 |
| `--fs-code` | `14px` | 代码 |
| `--fs-xs` | `12px` | 元信息 |

### 间距（4 倍数）

`--space-1` (4px) · `--space-2` (8px) · `--space-3` (12px) · `--space-4` (16px) · `--space-5` (20px) · `--space-6` (24px) · `--space-8` (32px) · ... · `--space-24` (96px)

---

## localStorage 键

| 键 | 值 | 作用 |
|----|----|----|
| `pi-agent-book:theme` | `light` / `dark` | 主题偏好（不设则跟随系统） |
| `pi-agent-book:lang` | `ts` / `python` | 语言偏好 |
| `pi-agent-book:read` | `<slug>,<slug>,...` | 已读模块（首页"最近更新"用） |

---

## 校验脚本

### frontmatter 一致性（prebuild 自动跑）

```bash
npm run check:counterpart   # 或：node scripts/check-counterpart.mjs
```

`prebuild` 钩子会自动运行，但也可以单独跑。检查项：

1. 每个 `*.python.mdx` 文件都有 `slug:` frontmatter 且以 `.python` 结尾
2. TS 版和 Python 版的 `counterpart` 字段互相指向对方
3. 双方 frontmatter 的 `title` / `module` / `displayOrder` / `status` / `summary` / `prev` / `next` / `diagrams` / `keyPoints` / `furtherReading` / `simulator` 字段深比较一致

输出：`✓ counterpart 校验通过（扫描 N 个 mdx 文件）` 或失败时列出所有不一致项。

### 内容同步漂移检测（手动跑）

```bash
npm run check:sync   # 或：node scripts/check-sync.mjs
```

对每个 mdx 比对其 body 与 `分析文档/项目原理-二次整理版-插图版-*/` 下源 `.md` 的差异。输出表格：

```
Drift report:
  ✓ ch01-overview.mdx                    in sync
  ⚠ ch08-context-engineering.mdx         38 lines differ
  ✗ ch10-session.python.mdx              mdx missing

✓ All in sync   或   ⚠ N file(s) drifted（退出码 1）
```

只要源 `.md` 改了，`check:sync` 就会提示漂移。修复方式：

```bash
node scripts/sync-from-source.mjs --all --update-diagrams
```

详见下文「内容同步管道」一节。

---

## 内容同步管道

当 `分析文档/项目原理-二次整理版-插图版-*/` 下的源 `.md` 发生修改，book 需要跟进同步时，使用 `scripts/sync-from-source.mjs`：

### 单章同步

```bash
# 同步 ch08 TS 版
node scripts/sync-from-source.mjs --chapter=08 --variant=ts

# 同步 ch08 Python 版（含 diagrams 自动注入）
node scripts/sync-from-source.mjs --chapter=08 --variant=py --update-diagrams
```

### 全量同步

```bash
# 对 10 章 × 2 变体 = 20 个 mdx 全部重写 body，并刷新 frontmatter.diagrams
node scripts/sync-from-source.mjs --all --update-diagrams
```

### 脚本做了什么

| 操作 | 实现 |
|---|---|
| 读取源 `.md` | `分析文档/项目原理-二次整理版-插图版-{260702,Python版-260703}/第N章-*.md` |
| 剥离首行 H1 | `stripH1()` —— 标题已在 frontmatter.title |
| 跨章节链接转换 | `[第9章](第9章-...md)` → `[/modules/ch09-compaction]` |
| 图片语法转换 | `![caption](assets/x.svg)` → `<Diagram file="/assets/x.svg" caption="caption" id="x" />` |
| mdx 三段切割 | 保留 frontmatter 段 + import 段不变，只重写 body 段 |
| diagrams 注入 | 可选（`--update-diagrams`），从图片引用收集 id/file/caption 写入 frontmatter |
| 新建文件模板 | 目标 mdx 不存在时（如 ch10-session.mdx）使用 bootstrap 模板 |

### 脚本不做的事（需人工）

- frontmatter 的 `title` / `summary` / `prev` / `next` / `counterpart` 涉及语义判断，脚本不修改
- 若源 `.md` 新增/删除了图，脚本只能更新 diagrams 数组，但 frontmatter 的 `caption` 润色仍需人工
- SVG 文件本身需要手工复制到 `public/assets/`（脚本不复制资产）

### 漂移检测的标准工作流

```bash
# 1. 改了源 .md 后，先检测漂移
npm run check:sync

# 2. 若有漂移，跑全量同步
node scripts/sync-from-source.mjs --all --update-diagrams

# 3. 复核 frontmatter 字段（title/summary/prev/next 是否需要调整）
#    特别注意：若源 .md 改了首段导语，summary 可能需要人工提炼

# 4. 跑校验
npm run check:counterpart   # TS/Python frontmatter 一致性
npm run build               # 完整构建

# 5. 浏览器抽检
npm run dev
```

---

## 章节字数 / 阅读时长统计

详情页 header 与首页"全部章节"卡片都显示 `xxxx字 · 含 N 行代码 · 约 M 分钟`，**全自动从 mdx 源文件实时计算**，改了内容自动跟随，无需维护任何字段。

### 算法（`collection.ts:getModuleStats()`）

```
1. readFileSync 读 mdx 源文件
2. 切掉 frontmatter（--- 围起来的 YAML 头）
3. 数代码行：所有 ``` 围栏块内的非空行
4. 算正文字数：全文 - frontmatter - 代码块 - JSX标签 - mdx表达式
5. CJK 按字 + 英文按词混合统计
6. 阅读时长 = ceil(字数 / 300)，最少 1 分钟
```

### 字数计算的边界

| 内容 | 算不算字数 | 备注 |
|---|---|---|
| 中文字符 | ✅ 1 字 | `[\u4e00-\u9fa5]` |
| 英文连续字母数字 | ✅ 1 词 | `Agent` / `displayOrder` 都算 1 |
| frontmatter | ❌ | 切掉了 |
| 围栏代码块 | ❌（单独算 `codeLines`） | ``` ... ``` 内的非空行 |
| `<Diagram />` 等 JSX | ❌ | 标签被剥离 |
| `{ variable }` mdx 表达式 | ❌ | 表达式被剥离 |
| 行内代码 `` `foo` `` | ✅ 算英文词 | 没被代码块正则吃掉 |
| markdown 标点（`#`、`-`、`*`） | ❌ | 既非 CJK 也非英文 |

### 触发时机

| 命令 | 行为 |
|---|---|
| `npm run dev` | 每次热重载页面时调 `getModuleStats()`，保存 mdx 即时更新 |
| `npm run build` | 构建时算好写死到 `dist/` 静态 HTML，部署后固定 |
| `sync-from-source.mjs` | 不直接调，但写完 mdx 后下次 dev/build 自动重算 |

### 改算法

如果想换统计口径（比如改成"按字符数"或"加入图片权重"），编辑 [collection.ts:getModuleStats()](src/utils/collection.ts)。注意 `check-counterpart.mjs` 不校验 stats（它是构建时计算的，不在 frontmatter 里）。

---

## 技术栈版本

- **Astro** `^5.0.0`（实际 5.18.2）
- **React** `^19.2.7`（仅 Islands，不接管整页）
- **@astrojs/mdx** `^4.3.14`（Astro 5 兼容版）
- **@astrojs/react** `^4.2.7`（支持 React 17/18/19）
- **TypeScript** strict 模式
- **无 UI 框架**（纯 Astro 组件 + 原生 CSS + Vanilla JS for S2 联动）

---

## 部署

构建产物是纯静态 HTML（`dist/`），可直接部署到任意静态托管：

- **Cloudflare Pages**：`npm run build` → 输出目录 `dist`
- **GitHub Pages**：`npm run build` → 推送 `dist/` 到 `gh-pages` 分支
- **Vercel / Netlify**：框架选 Astro，自动识别

所有 21 个页面（1 首页 + 10 章节 × 2 版本）都是预渲染的 HTML，无需服务端运行时。

---

## 相关文档

- **源计划**：`openspec/changes/scaffold-pi-agent-book/plans/260701-pi-agent-book-implementation.md`（14 任务实施计划）
- **规格文档**：`openspec/changes/scaffold-pi-agent-book/specs/<capability>/spec.md`（10 个能力规格）
- **执行进度台账**：`.superpowers/sdd/progress.md`（每任务的提交范围、延迟项、架构决策记录）
- **Pi Agent 源码原理**：本仓库 `../docs/` 目录下的 Markdown 文档
- **Pi Agent SDK**：[pi.dev](https://pi.dev) · [GitHub](https://github.com/earendil-works/pi)

---

## 项目进度

| 阶段 | 状态 | 范围 |
|------|------|------|
| **Phase 1** 站点骨架 | ✅ 完成 | 14 任务 SDD（Astro 项目搭建 + 三栏布局 + CodeBlock/Diagram/Lightbox + 主题切换 + LanguageSwitcher） |
| **Phase 2** 内容迁移（TS） | ✅ 完成 | 260702 插图版 13 章 → `ch01-` ~ `ch12-` + `ch-midterm-recap`，旧 m1-m12 全删 |
| **Phase 2** 精修 | ✅ 完成 | Ch3 Agent Loop 挂载 S3/S4 模拟器；首页知识图谱重画为 13 节点新结构 |
| **Phase 3** Python 版 | ✅ 完成 | 13 章全部 Python 改写版上线，TS/Python 双版本切换启用 |
| **Phase 4-B** S2 双向联动 MVP | ✅ 完成 | 写了 `public/js/diagram-linker.js`（约 90 行）+ Ch5 五步管道图加 3 个 `data-anchor`（step1/4/5）+ Ch5 mdx 加锚点 span + 全局接线 + 暗色样式。Playwright 5 项验收全绿（点击滚动、反向高亮、跨页持久、暗色可读、构建通过） |
| **Phase 4-C** S2 扩展到其他高 ROI SVG | 📋 规划中 | 候选：`ch04-translator-5-steps`（模型调用 5 步）、`ch09-compaction-flow`（压缩流程） |
| **Phase 4-D** ~~extract-source-loc 修复~~ | ❌ 取消 | remark plugin 已删除（被 Shiki 覆盖不生效）；Python `# 原文:` 注释保留为普通文档，不再需要"修复" |
| **同步插图版 260702/260703** | ✅ 完成 | 章节 13 → 10（删除扩展/测试/设计/中场）+ 新增 ch08 上下文工程 + ch08/09/10 重命名 + 双版本对齐 + 同步 20 mdx body + 新增 sync-from-source.mjs / check-sync.mjs 内容同步管道 |

---

## 许可

代码采用 [MIT License](../LICENSE)，文档采用 [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)。
