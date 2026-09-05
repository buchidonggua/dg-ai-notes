# 版本协议详情

> SKILL.md 顶部标注基线版本。本文档定义完整的版本管理流程。

## 基线版本

当前 **v0.83.0**。所有 API 描述、安装命令、场景文件均对齐此版本。

## 三步流程

### 1. 默认对齐
引导安装一律用基线版本：
```bash
npm install @earendil-works/pi-coding-agent@0.83.0
```
**不装 `latest`**——skill 的 API 描述精确核对到基线版本，装 latest 会立即漂移。场景文档里的安装命令同样以基线版本为准。

### 2. 升级前评估
当任务涉及安装/升级（或用户问版本）时：
```bash
npm view @earendil-works/pi-coding-agent version
```
对比基线版本。若不同，联网查该版本 CHANGELOG/release notes，从 SDK 二次开发角度评估（新功能 / 破坏性变更），给用户简短建议，由用户决定是否升级。日常开发（项目已装好）不触发。

### 3. 升级即更新 skill
若用户同意升到 X.Y.Z，安装后按 [skill-maintenance.md](skill-maintenance.md) 流程：
1. 对照新版 `dist/**/*.d.ts` + CHANGELOG 审查 skill 差异
2. 产出更新清单，报用户确认
3. 更新 SKILL.md 顶部基线版本号

## 变更查阅渠道

| 渠道 | 路径/命令 | 适用阶段 |
|------|----------|---------|
| ① node_modules CHANGELOG | `<proj>/node_modules/@earendil-works/pi-coding-agent/CHANGELOG.md` | **升级后**（第3步）|
| ② GitHub | `github.com/earendil-works/pi` → `packages/coding-agent/CHANGELOG.md` 或 Releases | **升级前**（第2步，需联网）|

> **时序关键**：升级前 node_modules 仍是旧版，渠道①看不到新版内容，第 2 步必须用②（GitHub）。
