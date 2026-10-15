# Pi Agent Book

基于 Astro 5 + React 19 + MDX 的双轨电子书，承载 [Pi Agent](https://pi.dev) SDK 的两套教程。

## 两个系列

电子书用一个 Astro content collection（`modules`）承载两个系列，靠 frontmatter 的 `book` 字段区分：

| 系列 | book 值 | 章节前缀 | 规模 | 语言变体 |
|------|---------|----------|------|----------|
| 🚀 实战上手篇 | `practice` | P01–P07 | 7 章 | TypeScript |
| 🔬 源码精读篇 | `internals` | M01–M12 | 12 章 | TypeScript + Python 双版本 |

- **实战上手篇**：用一个真实场景（企业数据分析助手）搭一个能上线的垂直 Agent。无语言切换，每章一张卡、一个「阅读 →」按钮。
- **源码精读篇**：系统拆解 SDK 源码设计。每章 TS + Python 双版本，顶栏一键切换。

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

**环境要求**：Node.js ≥ 20，任意现代浏览器。

---

## 读者使用指南

只想看文档不关心开发？两种方式：

### 方式一：本地起站点（推荐，离线可用）

```bash
npm install && npm run dev
# 浏览器打开 http://localhost:4321
```

### 方式二：直接读源 md 文件

源文档（Markdown 原稿，无需构建）在仓库的 `../pi_source_dive/`（精读篇）与 `../pi_sdk_learn/docs/`（实战篇）目录，按系列组织：
- 实战上手篇：`../pi_sdk_learn/docs/`
- 源码精读 TS 版：`../pi_source_dive/typescript/`
- 源码精读 Python 版：`../pi_source_dive/python/`

### 阅读界面操作

| 操作 | 效果 |
|------|------|
| 首页 **双入口 CTA** | 「实战上手 →」「源码精读 →」分别进入两系列第一章 |
| 首页 **两条路怎么选** | 对比两个系列的目标/切入点/产物，给阅读路径建议 |
| 顶栏 **TS / Python** 切换器 | （仅源码精读篇）同一章在两种语言间跳转，偏好记到 localStorage |
| 顶栏 **☀ / 🌙** 按钮 | 浅色/深色/跟随系统三态循环，`T` 键快捷键 |
| 顶栏 **◧ 沉浸式阅读** 按钮 / **`F`** 键 | 进入沉浸模式：右栏大纲淡出、正文加宽。仅 ≥1280px 可用 |
| 左侧 TOC | **按系列隔离**：读实战篇时显示 P01–P07，读精读篇时显示 M01–M12 |
| 右侧 On-This-Page | 当前页面的标题大纲，滚动时高亮当前节 |
| 点击配图 | 放大查看；带联动锚点的 SVG 节点可跳转到对应代码块并高亮 |
| 底部 **← 上章 / 下章 →** | **系列内连续阅读**：两系列互不串台 |

---

## 内容系统设计

### content collection

`src/content/config.ts` 定义一个 `modules` collection，关键字段：

```yaml
book: internals | practice   # 系列（默认 internals）
module: M01..M12 | P01..P07  # 章节号（正则 ^[MP]\d+(\.\d+)?$）
variant: ts | python          # 语言变体（实战篇只有 ts）
counterpart: <slug>           # 源码精读篇：TS↔Python 配对 slug
displayOrder: <number>        # 系列内排序（两系列各自从 1 起）
```

- **系列隔离**：`collection.ts` 的 `getAllModules(book?)`、`getAdjacentModules(order, book)` 都按 `book` 过滤，保证 TOC、prev/next、首页分组互不串台。
- **无 Python 变体**：实战篇不声明 `counterpart`，`ModuleLayout` 的 LanguageSwitcher 自动隐藏。

### mdx 源与 md 快照

- `src/content/modules/` 是 web 富内容源（mdx，31 个文件）
- `../pi_source_dive/` 与 `../pi_sdk_learn/docs/` 是下载版快照（md），改动须同步到 mdx 与 md，并运行 `npm run check:sync` 验证正文和代码一致

> ⚠️ mdx 比 md 严格：表格/正文里的裸 `{...}` 会被当 JS 表达式执行（须用反引号包裹），`<br>` 须写成自闭合 `<br/>`。

---

## 主要功能

| 能力 | 说明 |
|------|------|
| **三栏阅读布局** | 左 TOC / 正文 / 右大纲，1279px 以下隐藏右栏，767px 以下转汉堡菜单 |
| **沉浸式阅读模式** | `F` 键切换，右栏淡出、正文加宽，CSS transition 平滑过渡。仅 ≥1280px 生效 |
| **双系列首页** | 双入口 Hero + 选路指南 + 两段章节网格（实战篇带强调色背景，排在前） |
| **TS/Python 双版本** | （源码精读篇）每章并排两个 mdx，URL 各自独立，顶栏一键切换 |
| **代码块增强** | Shiki 语法高亮 + 语言标签 + 一键复制 + 30 行以上自动折叠 |
| **SVG 图表联动** | 点击图内节点自动滚动到对应代码块（源码精读篇五步管道图等） |
| **章节字数/阅读时长** | 构建时读 mdx 源文件实时计算（CJK 按字 + 英文按词），改内容自动跟随 |

---

## 构建/校验命令

```bash
npm run build              # 生产构建（当前 34 页）
npm run check:sync         # 校验 Markdown 与 MDX 内容同步
npm run check:counterpart  # 校验源码精读篇 TS/Python frontmatter 一致性
npm run build:pdf          # 导出源码精读篇 PDF（TS + Python）
```

## 许可

代码采用 [MIT License](../LICENSE)，文档采用 [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)。
