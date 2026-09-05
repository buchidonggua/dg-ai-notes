# Changelog

本文件记录 dg-piagent skill 的变更历史。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

## [0.1.0] - 2026-08-23

### Added

- **SKILL.md** 主文件：Pi-Agent SDK 开发指南，API 核对到 pi-coding-agent v0.83.0
  - 版本协议（默认对齐 / 升级前评估 / 升级即更新）
  - 核心心智模型（createAgentSession → session.prompt → subscribe/pi.on）
  - 事件系统双管道区分（session.subscribe vs pi.on）
  - 6 个扩展独有事件说明
  - 工具系统 errors-as-messages 原则
  - 上下文工程四层漏斗
  - 会话管理追加写入树
- **references/scenarios/** — 62 个场景文件，覆盖：
  - A01-A06：项目初始化、模型选择、Provider 配置、Auth、Full Control、Resource Loader
  - B01-B04：企业接口评估、内网模型接入、models.json 配置、SSE 流式
  - C01-C03：Prompt 模板、Context Files、Skills 加载
  - D01-D06：自定义工具、工具调度、defineTool、TypeBox 集成
  - E01-E06+E11：扩展工厂、事件监听、拦截模式、pi.on 用法
  - F01-F05：SessionManager、会话恢复、多会话管理、状态持久化
  - G01-G04：密钥存储、认证流程、Token 管理
  - H01-H07：Full Control 模式、ResourceLoader 接口、系统提示词定制
  - I01-I05：上下文压缩、Token 预算、批量调用、性能优化
- **references/sdk_doc/** — 22 个 SDK API 参考文档
- **references/project-structure.md** — Pi-Agent 项目结构说明
- **references/source-fallback.md** — 源码 fallback 策略

[0.1.0]: https://github.com/buchidonggua/dg-ai-notes/releases/tag/v0.1.0
