# Skill 维护指南

> 本文件定义 dg-piagent skill 的维护原则与升级流程。
> 当发现信息缺失/错误导致走弯路时，按以下 6 条原则完善本 skill。

---

## 六条维护原则

### 原则 1: 源码优先 (Source-of-Truth)

SDK 行为以 `dist/**/*.d.ts` 类型定义和实际源码为准，不以博客、AI 生成内容或过时文档为准。
当 skill 描述与源码矛盾时，**修改 skill**。

### 原则 2: 场景驱动 (Scenario-Driven)

新增内容必须关联具体使用场景。不要添加「可能有用」的抽象描述——每个 API 说明都应指向
对应的 `references/scenarios/` 文件，让用户能直接复制运行。

### 原则 3: 坑要标红 (Gotchas First)

踩坑经验比正面教程更有价值。发现陷阱时：
1. 在 SKILL.md 对应位置添加 ⚠️ 警告
2. 在 `references/scenarios/` 中创建专项场景文件
3. 说明**现象 → 根因 → 防御规则**

### 原则 4: 版本对齐 (Version Alignment)

所有 API 描述必须标注适用版本。新增 API 需注明「vX.Y.Z+」，废弃 API 需注明「vX.Y.Z 起废弃」。
场景文件顶部标注该场景适用的 SDK 版本范围。

### 原则 5: 渐进披露 (Progressive Disclosure)

- **SKILL.md**（~80 行）：心智模型 + 关键陷阱 + 路由表
- **references/scenarios/**：按任务类型组织的详细教程
- **references/sdk_doc/**：API 签名 + 参数说明 + 代码示例

不要把 API 细节塞进 SKILL.md。用户先看到「做什么」，需要时再看「怎么做」。

### 原则 6: 变更留痕 (Change Logging)

每次修改必须同步更新 `CHANGELOG.md`，格式遵循 Keep-a-Changelog：
- **Added**：新功能/新场景
- **Changed**：现有内容修改
- **Fixed**：错误修复
- **Deprecated**：即将废弃

---

## 升级审查流程

当 pi-coding-agent 发布新版本时，按以下步骤审查 skill 差异：

### Step 1: 检查最新版本

```bash
npm view @earendil-works/pi-coding-agent version
```

对比当前基线版本（SKILL.md 顶部标注）。若相同，无需操作。

### Step 2: 获取变更清单

**升级前**（node_modules 仍是旧版）：
- 查 GitHub：`github.com/earendil-works/pi` → `packages/coding-agent/CHANGELOG.md` 或 Releases

**升级后**（已安装新版）：
- 查本地：`<proj>/node_modules/@earendil-works/pi-coding-agent/CHANGELOG.md`

### Step 3: 对比 d.ts 类型定义

```bash
# 对比关键接口变化
diff <旧版>/dist/types/create-agent-session.d.ts <新版>/dist/types/create-agent-session.d.ts
diff <旧版>/dist/types/agent-session.d.ts <新版>/dist/types/agent-session.d.ts
diff <旧版>/dist/types/events.d.ts <新版>/dist/types/events.d.ts
```

重点关注：
- 新增/删除的接口方法
- 参数类型变化
- 事件名称变化
- 返回值类型变化

### Step 4: 产出更新清单

根据对比结果，产出以下清单供用户确认：

```markdown
## 更新清单 vX.Y.Z → vX.Y.Z

### 新增
- [ ] 新接口 `XxxMethod`：说明 + 场景文件编号

### 变更
- [ ] `createAgentSession` 参数变化：旧 → 新

### 废弃
- [ ] `oldMethod` → 用 `newMethod` 替代

### 影响评估
- 现有场景文件 X 个需更新
- 新增场景文件 Y 个
- SKILL.md 需更新 Z 处
```

### Step 5: 更新 skill

用户确认后：
1. 更新 SKILL.md 顶部基线版本号
2. 更新/新增对应的场景文件
3. 更新 SDK 参考文档
4. 更新 CHANGELOG.md
5. 运行验证（场景文件中的代码示例能正常运行）

---

## 目录结构维护

```
dg-piagent/
├── SKILL.md                    # 主文件（渐进披露第一层）
├── CHANGELOG.md                # 变更历史
└── references/
    ├── skill-maintenance.md    # 本文件
    ├── project-structure.md    # 项目结构说明
    ├── source-fallback.md      # 源码 fallback 策略
    ├── scenarios/              # 场景文件（按任务类型）
    │   ├── A01-*.md            # 初始化
    │   ├── B01-*.md            # 模型接入
    │   └── ...
    └── sdk_doc/                # API 参考
        ├── 01-create-agent-session.md
        └── ...
```

新增文件时遵循命名规则：
- 场景文件：`{编号}-{kebab-case-name}.md`
- SDK 文档：`{序号}-{kebab-case-name}.md`
