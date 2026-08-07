# @earendil-works/pi-coding-agent 包详解

> 第 3 层：局部深入（第三篇）。按 **局部 → 提升到全局 → 再看局部 → 细节** 的节奏组织。

## 0. 局部：这个包是什么

**pi-coding-agent = 应用层（整车）**。定位原文："Interactive coding agent CLI"。它是三个核心包里**唯一的应用**：把 pi-ai（燃料）、pi-agent-core（引擎）、pi-tui（仪表盘）组装成一个可用的产品。

设计哲学：无 MCP、无子智能体、无权限弹窗、无 plan mode。它解决的问题：**把"引擎能转"变成"人能开"**——提供 CLI、交互界面、会话管理、资源加载、扩展系统，让用户能用中文指挥 Pi 干活，并能深度定制。

## 1. 提升到全局：它在整条链路中的位置

在全局链路中，coding-agent 是**最顶层**：

```
【coding-agent（整车）】→ agent-core（引擎）→ pi-ai（燃料）→ 大模型
      │            │              │
    TUI/print/RPC    AgentSession     agent-loop
   （第 4 层 pi-tui）   │
                   订阅 AgentEvent，持久化 JSONL 会话
```

**上下游关系**（全局视角）：

| 方向 | 谁 | 关系 |
|---|---|---|
| 上游（用户） | 你 / 终端 / 外部进程 | 三种模式：TUI 交互、打印、RPC JSONL |
| 下游（引擎） | pi-agent-core 的 `Agent` | `AgentSession` 直接构造并持有，订阅事件、持久化消息 |
| 平级（地基） | pi-ai 的 `Models` | `ModelRuntime` 实现该接口，向 agent 注入 `streamFn` |
| 平级（UI） | pi-tui | 交互模式的渲染骨架（UI 装配者是 coding-agent） |

**关键边界契约**：coding-agent 不自己发明"循环"，它只是 **Agent 的应用层宿主**——把用户输入转成 `agent.prompt()`，把 AgentEvent 转成渲染/持久化/扩展事件。三种模式共享同一个 `AgentSession`，只是 I/O 方式不同。

带着这个视角，回到包内部。

## 2. 包结构与入口

```
packages/coding-agent/
├── src/
│   ├── cli.ts                 # Node CLI 入口（npm bin：pi → dist/cli.js）
│   ├── bun/cli.ts             # Bun 二进制入口（build:binary 编译目标）
│   ├── rpc-entry.ts           # 独立 RPC 子路径入口（强制 --mode rpc）
│   ├── main.ts                # 主流程：参数解析/模式选择/装配/分发
│   ├── config.ts              # 路径/常量/安装方式检测
│   ├── index.ts               # 公共 SDK 出口（约 420 行）
│   ├── core/                  # 核心实现
│   │   ├── sdk.ts             # createAgentSession()（Agent 构造与全管线装配）
│   │   ├── agent-session.ts   # AgentSession（所有模式共享的核心抽象）
│   │   ├── agent-session-runtime.ts  # 会话运行时（switch/new/fork/import）
│   │   ├── agent-session-services.ts # cwd 绑定服务装配
│   │   ├── model-runtime.ts   # ModelRuntime（Models 实现）
│   │   ├── resource-loader.ts # 6 类资源加载
│   │   ├── session-manager.ts # JSONL 会话文件管理
│   │   ├── settings-manager.ts / trust-manager.ts / project-trust.ts
│   │   ├── system-prompt.ts   # 系统提示词构建
│   │   ├── tools/             # 7 个内置工具定义
│   │   ├── extensions/        # 扩展系统（loader/runner/wrapper/types）
│   │   ├── compaction/        # 压缩（封装 pi-agent-core 的 compaction）
│   │   └── event-bus.ts       # 极简事件总线
│   ├── modes/
│   │   ├── index.ts           # 统一导出三种模式
│   │   ├── interactive/       # TUI 交互模式（大型模块，含 components/theme）
│   │   ├── print-mode.ts      # 单次打印模式
│   │   └── rpc/               # RPC 模式（rpc-mode/rpc-client/rpc-types）
│   └── extensions/            # 内置扩展（llama 等）
└── examples/                  # SDK 示例（sdk/）、扩展示例（extensions/）
```

**入口链**：

```
src/bun/cli.ts（Bun 二进制）        src/cli.ts（Node/npm bin）      src/rpc-entry.ts（子路径）
  ├─ registerBunOAuthFlows()          ├─ process.title / PI_CODING_AGENT  └─ main(["--mode","rpc",...])
  ├─ restoreSandboxEnv()              ├─ configureHttpDispatcher()
  ├─ register-bedrock.ts              └─ main(process.argv.slice(2))
  └─ await import("../cli.ts") ────────────┘
```

`main()`（`src/main.ts`）流程详见 [04-entrypoints/01-cli-entry.md](../04-entrypoints/01-cli-entry.md)。

## 3. 再看局部：AgentSession——所有模式共享的核心

`src/core/agent-session.ts` 是 pi-coding-agent 的心脏，封装 pi-agent-core 的 `Agent`：

### 事件与持久化
- `AgentSessionEvent` = pi-agent-core 的 `AgentEvent`（`agent_end` 改写为带 `messages/willRetry` 版本）+ 自有事件（`agent_settled`、`queue_update`、`compaction_start/end`、`entry_appended`、`bash_execution_update`、`auto_retry_*`、`thinking_level_changed`…）。
- `_handleAgentEvent`：排空 steer/followUp 队列 → 扩展事件 → 监听器 → **会话持久化**（`message_end` 时 `sessionManager.appendMessage` 写入 JSONL）。

### 钩子安装
- `_installAgentToolHooks`：`agent.beforeToolCall → runner.emitToolCall`、`agent.afterToolCall → runner.emitToolResult`。
- `_installAgentNextTurnRefresh`：覆写 `prepareNextTurnWithContext`，每轮注入最新系统提示词与工具表。

### prompt() 主流程
```
扩展命令处理 → input 事件 → 技能/模板展开 → 流式队列 → 认证校验 → 压缩检查
→ 构建消息（用户内容 + 图片 + nextTurn 消息）→ emitBeforeAgentStart
→ _runAgentPrompt（agent.prompt + continue 循环，处理重试/压缩/排队）
```

### 工具注册表
`_buildRuntime()` 用 `createAllToolDefinitions(cwd, options)` 建内置工具 → `ExtensionRunner` → `_refreshToolRegistry()` 合并内置 + 扩展注册 + SDK 自定义工具 → 应用 allow/deny 列表 → `setActiveToolsByName`。

### 其他能力
- 模型与思考级别：`setModel()/cycleModel()`（认证校验 + 持久化 + `model_select` 事件）。
- 压缩：`compact()`、自动阈值检查、分支摘要、指数退避重试。
- 会话操作：`steer()/followUp()/sendCustomMessage()`（四种投递模式：steer/followUp/nextTurn/triggerTurn）、`abort()/waitForIdle()/reload()/exportToHtml()/navigateTree()`。
- 扩展绑定：`bindExtensions(bindings)`。

## 4. SDK：createAgentSession 装配管线

`src/core/sdk.ts`（顶层 `setDefaultStreamFn(streamSimple)` 为旧扩展保留回退）：

```
createAgentSession(options)
  1. 解析 cwd/agentDir → 默认 ModelRuntime.create → SettingsManager.create → SessionManager.create → DefaultResourceLoader + reload()
  2. 从既有会话恢复模型（buildSessionContext）→ findInitialModel 兜底
  3. 默认工具 ["read","bash","edit","write"]
  4. 构造 Agent：
     - convertToLlm: convertToLlmWithBlockImages（blockImages 设置时过滤图片）
     - streamFn: modelRuntime.streamSimple(...) + mergeProviderAttributionHeaders + emitBeforeProviderHeaders
     - onPayload / onResponse（before/after_provider_* 事件）
     - transformContext → runner.emitContext
  5. 恢复消息到 agent.state.messages
  6. 构造 AgentSession，返回 { session, extensionsResult, modelFallbackMessage }
```

`CreateAgentSessionOptions` 关键字段：`cwd / agentDir / model / thinkingLevel / scopedModels / noTools("all"|"builtin") / tools(白名单) / excludeTools(黑名单) / customTools / resourceLoader / sessionManager / settingsManager / sessionStartEvent`。

## 5. ModelRuntime

`src/core/model-runtime.ts` 实现 pi-ai 的 `Models` 接口：

- `create()` 装配：`RuntimeCredentials`（`~/.pi/agent/auth.json`）+ `ModelConfig`（`~/.pi/agent/models.json`）+ `FileModelsStore`（动态目录持久化）+ `builtinProviders()`（每个用 `withRemoteCatalog` 包装）+ `createModels`。
- `providerIds()` = 内置 ∪ 原生扩展 ∪ 配置 ∪ 扩展 四路并集；`recomposeProvider()` 按 ID 组合（原生扩展优先）。
- 扩展的 provider 注册先入 `pendingProviderRegistrations` 队列，加载完成后冲刷进 ModelRuntime。
- 方法族：`getModels / getModel / getAvailable* / stream / complete / login / logout / refresh / registerProvider / registerNativeProvider / setRuntimeApiKey / isUsingOAuth / prepareRequest` 等。

## 6. ResourceLoader：6 类资源

`src/core/resource-loader.ts` 加载：

| 资源 | 来源 | 说明 |
|---|---|---|
| 扩展 | `.pi/extensions/`、`~/.pi/agent/extensions/` | TS/JS 模块（jiti 加载） |
| 技能 | `.pi/skills/` | markdown SKILL.md |
| 提示词模板 | `.pi/prompts/` | 自定义提示词 |
| 主题 | `~/.pi/agent/themes/` + 内置 | TUI 主题 JSON |
| 上下文文件 | 各层目录的 `AGENTS.md`/`CLAUDE.md` | 逐级祖先查找，处理 git worktree 遮蔽 |
| 系统提示词 | `SYSTEM.md` / `APPEND_SYSTEM.md` | 覆盖/追加 |

`reload()` 流程：预信任 bootstrap（只加载用户/全局/CLI 扩展）→ settings 重载 → pi 包解析 → 扩展集加载（缓存 + 冲突诊断）→ 技能/提示词/主题 → 上下文文件 → SYSTEM.md 发现。

## 7. 扩展系统

- **加载**（`core/extensions/loader.ts`）：jiti 加载（Bun 二进制用 `virtualModules` 静态映射，Node 用 `getAliases()` 别名到 workspace dist）。发现规则：目录直接 `*.ts/*.js`、子目录 `index.ts`、或 package.json `pi.extensions` manifest。
- **API**（`createExtensionAPI`）：注册方法 `on / registerTool / registerCommand / registerShortcut / registerFlag / registerMessageRenderer / registerMarkdownTransformer / registerEntryRenderer / getFlag`；动作方法 `sendMessage / setModel / registerProvider / exec / ...`。
- **Runner**（`core/extensions/runner.ts`）：`bindCore(actions, ctx, providers)` 把 AgentSession 动作接入扩展；大量类型化 `emit()`（`emitToolCall/emitToolResult/emitInput/emitMessageEnd/emitBeforeAgentStart/emitBeforeProviderRequest/emitContext`…）。
- **工具包装**：`wrapRegisteredTool → wrapToolDefinition`（ToolDefinition → pi-agent-core `AgentTool`）。

## 8. 内置工具

`core/tools/index.ts`：`ToolName = read | bash | edit | write | grep | find | ls`。每个工具提供 `create*ToolDefinition(cwd, options)`（返回 ToolDefinition）与 `create*Tool`（返回 AgentTool）两种变体。

- `createCodingToolDefinitions = [read, bash, edit, write]`（默认启用）
- `createReadOnlyToolDefinitions = [read, grep, find, ls]`
- bash 最复杂：spawn + 进程树终止 + 临时文件输出累积 + 环境注入（`PI_SESSION_ID/PI_SESSION_FILE/PI_PROVIDER/PI_MODEL/PI_REASONING_LEVEL`）。

## 9. 三种运行模式

| 模式 | 入口 | 交互 | 输出 |
|---|---|---|---|
| 交互 | `modes/interactive/interactive-mode.ts` | TUI（pi-tui 组件） | 实时渲染 |
| 打印 | `modes/print-mode.ts` | 无 | 最后一条文本 / 事件 JSON 行 |
| RPC | `modes/rpc/rpc-mode.ts` | JSONL stdin | 事件 JSON 行到 stdout |

模式选择（`src/main.ts` 的 `resolveAppMode`）：`--mode rpc` → rpc；`--mode json` → json；`-p` 或 stdin/stdout 非 TTY → print；否则 interactive。

RPC 命令集（`rpc-mode.ts` 的 `handleCommand`）：`prompt / steer / follow_up / abort / new_session / get_state / set_model / cycle_model / get_available_models / set_thinking_level / compact / set_auto_compaction / bash / export_html / switch_session / fork / clone / get_entries / get_tree / ...`，配套 `rpc/rpc-client.ts` 客户端与 `rpc/rpc-types.ts` 类型。

## 10. 重要目录与文件速查

| 文件 | 职责 |
|---|---|
| `src/config.ts` | 路径常量（`getAgentDir`→`~/.pi/agent`、`getSessionsDir`、`VERSION`）、安装方式检测 |
| `src/core/session-manager.ts` | JSONL 会话 v3：create/open/fork/continue/list |
| `src/core/settings-manager.ts` | 全局（`~/.pi/agent/settings.json`）+ 项目（`.pi/settings.json`）两级设置 |
| `src/core/system-prompt.ts` | `buildSystemPrompt({cwd, skills, contextFiles, customPrompt, toolSnippets, ...})` |
| `src/core/compaction/` | 封装压缩 + 分支摘要（复用于 agent-harness 之外的应用层路径） |
| `src/modes/interactive/theme/` | 主题系统（内置 JSON + 自定义） |

> 权威细节：`packages/coding-agent/README.md`、`packages/coding-agent/docs/`（sdk.md、extensions.md、settings.md 等）。下一篇：[pi-tui](04-pi-tui.md)。
