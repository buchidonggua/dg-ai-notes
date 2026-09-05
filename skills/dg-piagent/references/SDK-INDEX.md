# SDK API 索引

> 按包/模块查 API。每个条目指向 `sdk_doc/` 下的详细文档。

## @earendil-works/pi-coding-agent（核心 SDK）

| 模块 | 说明 | 详细 |
|------|------|------|
| `createAgentSession` | 创建会话主入口，接收全部配置 | [01](sdk_doc/01-create-agent-session.md) |
| `AgentSession` | prompt / steer / abort / setModel / dispose / subscribe | [02](sdk_doc/02-agent-session.md) |
| `AgentSessionRuntime` | newSession / switchSession / fork | [03](sdk_doc/03-agent-session-runtime.md) |
| **事件系统** | 全部事件类型、触发时机、数据结构、集成踩坑 | [04](sdk_doc/04-events.md) |
| `ModelRuntime` / `ModelRegistry` | 模型/认证运行时（v0.80.8+）+ 扩展兼容包装器 | [05](sdk_doc/05-auth-model-registry.md) |
| `defineTool` / 工具系统 | 自定义工具定义、内置工具、参数 schema | [06](sdk_doc/06-tools.md) |
| `ExtensionAPI` | pi.on / pi.registerTool / pi.registerCommand / pi.ui | [07](sdk_doc/07-extensions-api.md) |
| `DefaultResourceLoader` | system prompt / skills / prompts / context files / extensions | [08](sdk_doc/08-resource-loader.md) |
| `Skill` 接口 | Skill 数据结构与加载机制（渐进式披露） | [09](sdk_doc/09-skills.md) |
| `PromptTemplate` | `/command` 模板 | [10](sdk_doc/10-prompt-templates.md) |
| Context Files (AGENTS.md) | 项目级指令文件机制 | [11](sdk_doc/11-context-files.md) |
| `SessionManager` | create / continueRecent / open / list / inMemory | [12](sdk_doc/12-session-manager.md) |
| `SettingsManager` | applyOverrides / flush / drainErrors | [13](sdk_doc/13-settings-manager.md) |

## @earendil-works/pi-ai（AI 层）与高级主题

| 模块 | 说明 | 详细 |
|------|------|------|
| `getModel` / Custom Provider | 按 provider/id 查模型 / 自定义 Provider 注册 | [16](sdk_doc/16-custom-provider.md) |
| Compaction | 上下文窗口压缩机制 | [18](sdk_doc/18-compaction.md) |
| Pi Package | 打包、发布、版本管理 | [20](sdk_doc/20-pi-package.md) |
| 多 Agent 架构 | 多 Agent 协作模式 | [21](sdk_doc/21-multi-agent.md) |
| 扩展推荐 SOP | 按用户需求实时查 npm + 给出推荐清单 | [22](sdk_doc/22-extension-recommender.md) |

> TUI/UI API / Faux Provider / RPC 模式等 CLI 专属低频项已剔除，需要时查 SDK 源码。
