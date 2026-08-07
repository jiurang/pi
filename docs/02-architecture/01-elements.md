# 架构元素拆解

> 第 2 层：全局结构（第一篇）。上一篇 [一图看懂全局](../01-overview/02-architecture-at-a-glance.md) 是"大的面"，这一篇把系统**正式拆成元素**——给每个元素定职责、定位、所在包与关键文件。下一篇 [02-relations.md](02-relations.md) 再把它们**关联成整体**。

## 回顾：元素在全局中的位置

在拆之前，先建立"全局坐标"。Pi 的 4 层（LLM 抽象 → Agent 运行时 → 应用 → 基础设施）里，**绝大部分元素都集中在中间两层**：

- **第 1 层（LLM 抽象）**的元素回答"大模型怎么连、怎么调用"；
- **第 2 层（Agent 运行时）**的元素回答"循环怎么转、记忆怎么存"；
- **第 3 层（应用层）**的元素回答"产品怎么用、用户怎么定制"；
- **第 4 层（基础设施）**是外围件，多数是实验性的，可先略过。

下面的拆解按"你最容易接触到的顺序"编排：先应用层（你用到的），再运行时层（核心引擎），再 LLM 抽象层（地基），最后基础设施层。

```
┌─────────────────────────────────────────────────────────────┐
│ 应用层（pi-coding-agent / pi-server / pi-evals）              │
│  元素：CLI 入口 · AgentSession · 三种运行模式 ·               │
│        ModelRuntime · ResourceLoader · 扩展系统 · 会话管理器  │
├─────────────────────────────────────────────────────────────┤
│ 运行时层（pi-agent-core）                                     │
│  元素：AgentLoop · Agent 类 · AgentHarness · Session 存储 ·    │
│        Compaction · Skills · Harness 工具 · 执行环境          │
├─────────────────────────────────────────────────────────────┤
│ LLM 抽象层（pi-ai）                                           │
│  元素：Models 集合 · Provider 工厂 · API 适配器 · 模型目录 ·    │
│        Auth/OAuth · EventStream                              │
├─────────────────────────────────────────────────────────────┤
│ 基础设施层（pi-tui / pi-protocol / pi-client / 存储后端）      │
│  元素：TUI 渲染器 · 协议编解码 · RPC 客户端 · SQLite 存储       │
└─────────────────────────────────────────────────────────────┘
```

## 第 1 层：LLM 抽象层（pi-ai）

| 元素 | 职责 | 关键文件 |
|---|---|---|
| **Models 集合** | 统一入口 `models.stream()/complete()/login()/refresh()`，负责鉴权解析、请求头合并、按 `model.api` 分发到 provider | `packages/ai/src/models.ts` |
| **Provider 工厂** | 每个 provider 一个工厂函数，组装"模型目录 + 鉴权 + API 适配器"；`builtinProviders()` 构造全部 37+ 个 | `packages/ai/src/providers/all.ts`、`packages/ai/src/providers/<id>.ts` |
| **API 适配器** | 每家服务商的线协议实现：把上游 SSE/WebSocket 流翻译成统一事件流；每个模块导出 `stream` + `streamSimple` | `packages/ai/src/api/*.ts`（10 个） |
| **模型目录** | 从 models.dev 等数据源生成的静态模型元数据（`MODELS` 注册表 + 每 provider 一个 `*.models.ts`） | `packages/ai/src/models.generated.ts`、`packages/ai/src/providers/<id>.models.ts`、`packages/ai/scripts/generate-models.ts` |
| **Auth / OAuth** | API key 解析（环境变量/存储凭据）、OAuth 流程（PKCE、device code、本地回调服务器）、凭据存储（auth.json） | `packages/ai/src/auth/*`、`packages/ai/src/auth/oauth/*` |
| **EventStream** | 通用异步可迭代事件流；`AssistantMessageEventStream` 是 LLM 调用的统一返回形态 | `packages/ai/src/utils/event-stream.ts`、`packages/ai/src/types.ts` |
| **惰性加载** | `.lazy.ts` 包装 + `lazyStream/lazyApi`，让核心入口不携带任何服务商 SDK，首次请求才加载 | `packages/ai/src/api/lazy.ts`、`packages/ai/src/api/*.lazy.ts` |
| **faux provider** | 脚本化假 provider，用于测试（模拟流式、usage、缓存） | `packages/ai/src/providers/faux.ts` |

## 第 2 层：Agent 运行时层（pi-agent-core）

| 元素 | 职责 | 关键文件 |
|---|---|---|
| **AgentLoop（核心循环）** | `runAgentLoop`：注入提示词 → 流式调用 LLM → 执行工具调用 → 循环直到停止；全程使用 `AgentMessage`，仅在 LLM 边界转 `Message[]` | `packages/agent/src/agent-loop.ts` |
| **Agent 类** | 对 agent-loop 的有状态封装：持有 transcript、事件订阅、steer/followUp 队列、abort、continue | `packages/agent/src/agent.ts` |
| **AgentHarness（编排层）** | 面向应用的高层门面：`prompt()/skill()/compact()/navigateTree()`；相位锁（idle/turn/compaction/…）；pending writes + 保存点；类型化钩子 | `packages/agent/src/harness/agent-harness.ts` |
| **Session 存储** | 会话模型：append-only 条目树；`Session` 门面 + `SessionStorage`/`SessionStore`/`SessionRepository` 抽象；JSONL v3 / 内存两种实现 | `packages/agent/src/harness/session/*` |
| **Compaction（压缩）** | 上下文超限时，把旧对话摘要成结构化摘要；阈值判定、切点寻找、摘要生成、分支摘要 | `packages/agent/src/harness/compaction/*` |
| **Skills（技能）** | 从目录加载 `SKILL.md`（frontmatter 校验），生成 `<skill>` 调用块与 `<available_skills>` 系统提示 | `packages/agent/src/harness/skills.ts`、`system-prompt.ts` |
| **Harness 工具** | 内置工具工厂：`createReadTool/createWriteTool/createEditTool/createBashTool`（注意：**装配责任在宿主应用**） | `packages/agent/src/harness/tools/*` |
| **执行环境** | `NodeExecutionEnv`：文件系统 + Shell 的统一接口，返回 `Result` 不抛异常 | `packages/agent/src/harness/env/nodejs.ts` |

## 第 3 层：应用层（pi-coding-agent）

| 元素 | 职责 | 关键文件 |
|---|---|---|
| **CLI 入口** | `main()`：参数解析、模式选择（interactive/print/json/rpc）、会话管理、信任检查、运行时装配、模式分发 | `packages/coding-agent/src/main.ts`、`src/cli.ts` |
| **AgentSession** | 所有运行模式共享的核心抽象：包装 `Agent`，负责事件订阅、JSONL 会话持久化、工具注册表、系统提示词构建、压缩与自动重试、扩展绑定 | `packages/coding-agent/src/core/agent-session.ts` |
| **三种运行模式** | 交互模式（TUI 循环）、打印模式（一次回答）、RPC 模式（JSONL stdin/stdout）；共用 AgentSession | `packages/coding-agent/src/modes/*` |
| **ModelRuntime** | 实现 pi-ai 的 `Models` 接口：装配内置/配置/扩展 providers、模型解析与刷新、运行时 API key | `packages/coding-agent/src/core/model-runtime.ts` |
| **ResourceLoader** | 加载 6 类资源：扩展、技能、提示词模板、主题、上下文文件（AGENTS.md/CLAUDE.md）、系统提示词（SYSTEM.md） | `packages/coding-agent/src/core/resource-loader.ts` |
| **扩展系统** | jiti 加载 TS/JS 扩展；注册工具/命令/快捷键/渲染器；`ExtensionRunner.bindCore` 把 AgentSession 动作接入扩展 | `packages/coding-agent/src/core/extensions/*` |
| **内置工具** | 7 个工具定义：read/bash/edit/write/grep/find/ls；`ToolDefinition → AgentTool` 包装链 | `packages/coding-agent/src/core/tools/*` |
| **会话管理器** | JSONL 会话文件管理：create/open/fork/list/continue，version 3，id/parentId 树 | `packages/coding-agent/src/core/session-manager.ts` |
| **Settings / 信任** | 全局/项目设置两级；项目信任决策（项目资源可信才加载扩展等） | `packages/coding-agent/src/core/settings-manager.ts`、`trust-manager.ts` |

## 第 4 层：基础设施层

| 元素 | 职责 | 关键文件 |
|---|---|---|
| **TUI** | 差分渲染终端 UI 库：`TuiAltScreen`（备用屏）/`TuiMainScreen`（主屏）、组件模型、按键系统、编辑器/列表等组件 | `packages/tui/src/*` |
| **协议** | CBOR 协议编解码与分帧（实验性远程会话协议，版本 2） | `packages/protocol/src/*` |
| **RPC 客户端** | 传输无关（ByteTransport）的远程会话客户端：握手、请求/响应关联、快照事件 | `packages/client/src/*` |
| **SQLite 存储** | pi-agent-core 会话的可选 SQLite 后端（迁移 + 物化视图） | `packages/storage/sqlite-node/src/*` |
| **Server 守护进程** | Unix socket IPC，监督 coding-agent 的 RPC 子进程（实验性） | `packages/server/src/*` |

> 注：protocol/client/server 目前与 coding-agent **无运行时耦合**，是独立的实验性组件；SQLite 存储也未进入 coding-agent 的生产路径（其会话走 JSONL）。

## 元素之间的"为什么这样拆"

- **pi-ai 与 pi-agent-core 分离**：LLM 抽象层可独立测试与复用；Agent 循环只依赖"消息 + 事件流"契约，不关心服务商差异。
- **pi-agent-core 与 pi-coding-agent 分离**：核心运行时保持"库"形态（无 UI、无 CLI），coding-agent 作为宿主应用把 UI、CLI、资源、扩展组装起来。
- **AgentLoop 与 AgentHarness 分层**：`agent-loop.ts` 是"裸循环"（无状态、无持久化），`Agent` 类加状态与队列，`AgentHarness` 加会话/压缩/钩子。应用层可按需选择使用哪一层。
- **工具定义与执行分离**：pi-agent-core 提供工具执行协议（`AgentTool`），pi-coding-agent 提供具体的工具定义（bash/read/edit/write），宿主自己接线。

下一步：[02-relations.md](02-relations.md) 把这些元素关联起来看数据流与调用链。
