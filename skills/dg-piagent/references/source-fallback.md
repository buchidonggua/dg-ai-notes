# 源码兜底协议

> 当 `scenarios/` 和 `sdk_doc/` 都无法回答时，按本文件策略直接查 `node_modules` 内的包内容。**这是 skill 的 20% 长尾覆盖层**：skill 提炼常见模式（快），兜底啃源码（全），两者互补。

---

## 何时触发兜底

满足以下任一信号，**先 grep 全 skill 仓确认无答案**，再启用兜底：

- 某类型/字段/方法名在 skill 内查不到
- 某方法签名（参数/返回值）在 sdk_doc 未列出
- 实际行为与 skill 描述冲突，需要看真实实现
- 集成场景超出 scenarios 已覆盖模式（如 RPC、自定义 compaction 算法）

```bash
# 兜底前必做：先确认 skill 真的无答案
grep -rn "<关键字>" ~/.claude/skills/pi-agent/references/
```

---

## 包到目录导航表

`node_modules/@earendil-works/` 下有三个包，**自带内容不对称**，必须按包选择兜底入口：

| 包 | 自带 docs | 自带 examples | 主要内容 | 兜底入口 |
|----|---------|--------------|---------|---------|
| `pi-coding-agent` | ✅ 26 篇 | ✅ 13 个 | 主入口、会话、工具、扩展、Skill | 全部 4 层可用 |
| `pi-agent-core` | ❌ 无 | ❌ 无 | agent loop、harness、node/proxy（底层） | 仅类型 / 实现 |
| `pi-ai` | ❌ 无 | ❌ 无 | providers、ModelRegistry、API 抽象 | 仅类型 / 实现 |

> **关键**：底层两个包没有"教学版本"。兜底它们时直接进类型/源码，不要浪费时间去找不存在的 docs/examples。

### 路径模板

```
<project>/node_modules/@earendil-works/<包>/
  ├── examples/sdk/0X-*.ts        ← 仅 pi-coding-agent 有
  ├── docs/*.md                   ← 仅 pi-coding-agent 有
  └── dist/
       ├── index.d.ts             ← 公共 API 入口（必看）
       ├── core/                  ← pi-coding-agent 的会话/扩展/Auth 等
       ├── *.d.ts / *.js          ← 类型 / 实现
       └── ...
```

---

## 4 层优先级（信息密度从高到低）

| 优先级 | 查什么 | 路径模式 | 最适合 |
|--------|--------|---------|--------|
| 1 | 官方示例 | `pi-coding-agent/examples/sdk/0X-*.ts` | 「怎么做 X」 |
| 2 | 官方文档 | `pi-coding-agent/docs/*.md` | 「X 是什么 / 有哪些能力」 |
| 3 | 类型签名 | `*/dist/**/*.d.ts` | 「X 有哪些字段/方法」 |
| 4 | 实现细节 | `*/dist/**/*.js` | 「X 为什么这样行为」 |

**为什么这个顺序**：示例和文档是作者挑选过的「教学版本」，比 AI 自己读源码推断省力且少错。**优先用上层**，上层无解再下沉。

### 起步入口

| 想找 | 起步文件 |
|------|---------|
| 公共 API 全貌 | `pi-coding-agent/dist/index.d.ts` |
| 会话相关 | `pi-coding-agent/dist/core/agent-session.d.ts` |
| 事件循环底层 | `pi-agent-core/dist/agent-loop.d.ts` |
| Provider 抽象 | `pi-ai/dist/index.d.ts` |

---

## 检索配方（A 方案：轻量）

只给两个常用模式，剩下交给 AI 自己探索。

```bash
# 1) 在类型定义里找某符号（方法/类型/字段名）
grep -rn "<符号>" node_modules/@earendil-works/*/dist/ --include="*.d.ts"

# 2) 在官方文档里找某主题
grep -rln "<主题>" node_modules/@earendil-works/pi-coding-agent/docs/
```

---

## 包未安装时的降级

如果项目根 `node_modules/@earendil-works/` 不存在：

1. 提示用户 `npm install @earendil-works/pi-coding-agent@latest`
2. 或退到 GitHub 远程：`github.com/earendil-works/pi` 的 `packages/{coding-agent,agent,ai}/src/`（注意版本可能与项目实际不一致）

---

## 回流提示（解决后）

兜底解决完问题后，**主动**向用户提议：

> 「这条信息来自 node_modules 源码，看起来任何用 pi-agent 的项目都可能遇到——值得补进 skill 吗？」

由用户决定。若确认补，遵循 [skill-maintenance.md](skill-maintenance.md) 的 6 条原则就近沉淀。
