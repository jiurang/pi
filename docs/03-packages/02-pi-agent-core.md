# @earendil-works/pi-agent-core 包详解

> 第 3 层：局部深入（第二篇）。按 **局部 → 提升到全局 → 再看局部 → 细节** 的节奏：先看这个包是干什么的，再放到全局主链路里看它的位置，最后才深入内部。

## 0. 局部：这个包是什么

**pi-agent-core = Agent 运行时（引擎）**。定位原文："Agent runtime with tool calling and state management"。它解决的核心问题：**大模型只是一次次回答"下一步做什么"，真正让智能体"干完一件事"的，是围绕回答转起来的循环**——而这个循环及其配套设施（工具、会话、压缩、技能）都在这个包里。

它不关心"用户界面长什么样、LLM 怎么连"——前者是 coding-agent 的事，后者是 pi-ai 的事。

## 1. 提升到全局：它在整条链路中的位置

在全局链路中，pi-agent-core 是**引擎**，夹在应用层与 LLM 抽象层中间：

```
coding-agent（整车）→ 【agent-core（引擎）】 → pi-ai（燃料） → 大模型
       │                  │
   调用 Agent/AgentHarness   agent-loop 用 streamFn（来自 pi-ai 的 Models）
```

**上下游关系**（全局视角）：

| 方向 | 谁 | 关系 |
|---|---|---|
| 上游（应用层） | coding-agent 的 `AgentSession` | 直接构造/持有 `Agent`（或 `AgentHarness`），订阅其事件，持久化其消息 |
| 下游（地基） | pi-ai | 通过注入的 `Models` / `streamFn` 调用 LLM，循环本身不感知服务商差异 |

**关键边界契约**：
- 对下：只通过 `streamFn(model, context, options) => EventStream` 这一根管子调用 LLM（见 [消息模型与事件流](../02-architecture/03-message-and-stream.md)）。
- 对上：通过 `AgentEvent`（agent_start/message_*/tool_*/agent_end）把所有"发生了什么"广播给应用层，应用层据此渲染与持久化。
- 内部：**全程使用 AgentMessage**，只在 LLM 边界转 Message[]——所以 bash 输出、压缩摘要等"非模型消息"也能留在会话里。

带着这个视角，回到包内部。

## 2. 包结构

```
packages/agent/
├── src/
│   ├── index.ts            # 主入口（导出全部核心 API）
│   ├── node.ts             # Node 专用入口（NodeExecutionEnv + index 全部导出）
│   ├── types.ts            # 底层类型（AgentMessage/AgentEvent/AgentLoopConfig/StreamFn…）
│   ├── agent-loop.ts       # 核心循环：runAgentLoop / runAgentLoopContinue
│   ├── agent.ts            # Agent 类（有状态封装）
│   ├── stream-fn.ts        # 默认 streamFn（setDefaultStreamFn/getDefaultStreamFn）
│   ├── proxy.ts            # stream 代理（经 HTTP SSE 转发 LLM 调用）
│   └── harness/            # AgentHarness + 会话/压缩/技能/工具/环境
│       ├── agent-harness.ts
│       ├── types.ts        # harness 类型（Session/条目/事件/错误）
│       ├── messages.ts     # 扩展消息角色（bashExecution/custom/…）
│       ├── system-prompt.ts / skills.ts / prompt-templates.ts
│       ├── session/        # session.ts / jsonl-* / memory-* / repo-utils / search-*
│       ├── compaction/     # compaction.ts / branch-summarization.ts / utils.ts
│       ├── tools/          # read / write / edit / bash + 辅助
│       └── env/nodejs.ts   # NodeExecutionEnv
└── docs/                   # 各模块设计文档（agent-harness.md 为当前行为权威）
```

**exports**（`package.json`）：`.`（dist/index）、`./node`（dist/node）、`./package.json`。

## 3. 再看局部：三个运行层次

pi-agent-core 提供"裸循环 → 有状态 Agent → 编排 Harness"三个递进层次，应用层按需选用：

### 3.1 AgentLoop（`src/agent-loop.ts`）

**无状态、无持久化**的核心循环，是 Agent 类与 AgentHarness 的共同底座：

- `runAgentLoop(prompts, context, config, emit, signal, streamFn)`：以新提示词启动。
- `runAgentLoopContinue(context, config, emit, signal, streamFn)`：从当前上下文继续（重试场景）。
- 双层循环：内层处理工具调用与 steering 消息，外层处理 agent 本应停止后的 follow-up 消息。
- 全程使用 `AgentMessage`，仅在 `streamAssistantResponse()` 内通过 `config.convertToLlm` 转成 `Message[]`。
- 工具执行（详见 [04-entrypoints/04-tool-execution.md](../04-entrypoints/04-tool-execution.md)）：`prepareToolCall → beforeToolCall 钩子 → execute → afterToolCall 钩子 → toolResult 消息`。
- 生命周期事件：`agent_start → turn_start → message_start/message_update/message_end → tool_execution_start/update/end → turn_end → agent_end`。

### 3.2 Agent 类（`src/agent.ts`）

对 agent-loop 的有状态封装：

- 持有当前 transcript（`state.messages`）、工具表（`state.tools`）、模型、thinkingLevel。
- `prompt(message | text)` / `continue()` / `steer()` / `followUp()` / `abort()` / `waitForIdle()`。
- 两个消息队列：steeringQueue（当前轮次结束后注入）与 followUpQueue（agent 本应停止后才执行），各支持 `one-at-a-time` / `all` 两种排空模式。
- `subscribe(listener)`：订阅全部 `AgentEvent`，按订阅顺序 await。
- `runWithLifecycle`：单飞（同一时刻只允许一个 run），失败时合成一条 `stopReason:"error"/"aborted"` 的失败消息走完事件链。
- 默认 `streamFn` 通过 `getDefaultStreamFn()` 获取（由宿主用 `setDefaultStreamFn` 注入，如 coding-agent 注入 `streamSimple`）。

### 3.3 AgentHarness（`src/harness/agent-harness.ts`）

面向应用的高层编排门面（详细链路见 [04-entrypoints/03-agent-harness.md](../04-entrypoints/03-agent-harness.md)）：

- 构造选项：`{ session, models, model, tools, resources, systemPrompt, streamOptions, retry, thinkingLevel, activeToolNames, steeringMode, followUpMode, toolContext }`。
- 结构性操作（需 `phase === "idle"`）：`prompt()`、`skill()`、`promptFromTemplate()`、`compact()`、`navigateTree()`。
- 回合中允许：`steer()`、`followUp()`、`nextTurn()`、`abort()`、配置 setter。
- 相位：`idle | turn | compaction | branch_summary | retry`；忙时结构性操作抛 `AgentHarnessError("busy")`。
- 持久化时机：`message_end` → **先** `session.appendMessage()` **再**通知订阅者；turn 中其它写入进 pending writes，在保存点（`save_point` 事件）与结算时刷新。
- 类型化钩子：`before_agent_start / context / before_provider_request / before_provider_payload / after_provider_response / tool_call / tool_result / session_before_compact / session_before_tree / retry_* / model_update / thinking_level_update / resources_update / tools_update`。
- 生命周期：`requestShutdown()/waitForShutdown()`；`subscribe()` 全量事件 / `on(type, handler)` 按类型订阅（可返回结果）。

> 注意（v0.83 现状）：AgentHarness 已重写为上述队列化实现；旧文档 `packages/agent/docs/harness.md`（refs 术语）、`harness-v2.md`（lanes 愿景）是历史设计，`agent-harness.md` 才是当前实现的权威文档。

## 4. 会话存储（Session）

### 会话模型：append-only 条目树

- 会话由**条目**组成，每条目有 `id / parentId / type / timestamp / payload`，形成树（可分支）。
- 条目类型：`message / thinking_level_change / model_change / active_tools_change / compaction / branch_summary / custom / custom_message / label / session_info / leaf`。
- 分支通过 `leaf` 条目记录当前活动叶（`targetId: null` 表示 root）。

### 存储抽象（`src/harness/types.ts` + `session/`）

```
SessionStorage<T>   单会话能力（getMetadata/appendEntry/getEntries/moveTo…）
SessionStore        多会话仓库（create/load/list/delete/fork）
SessionRepository   包装 SessionStore + 可选搜索（repo-utils.ts）
Session             面向 harness 的高层门面（session.ts）
```

**JSONL v3 格式**（`session/jsonl-storage.ts`）：首行是头部 `{type:"session", version:3, id, cwd, ...}`，之后每行一个 JSON 条目；torn tail 容错（仅最后一行损坏时可截断）。追加写走 `env.appendFile`。

**目录布局**（`jsonl-repo.ts`）：`<sessionsRoot>/<encodeCwd(cwd)>/<timestamp>_<sessionId>.jsonl`。

**内存实现**：`memory-storage.ts` / `memory-repo.ts`（测试常用）。

**搜索**：`search-backend.ts`（扫描式）+ `search-index.ts`（派生索引）。

### Session 类关键方法

- 追加：`appendMessage / appendCompaction / appendCustomEntry / appendLabel / moveTo` 等。
- 读取：`getBranch`（从叶到根或上次压缩）、`getMessages`、`getSessionStats`。
- 上下文构建：`buildContext()` 投影为 `AgentMessage[]`，压缩条目替换为摘要消息。

## 5. 压缩（Compaction）

`src/harness/compaction/compaction.ts`。当上下文接近模型 contextWindow 时，把旧对话摘要掉：

- **默认设置** `DEFAULT_COMPACTION_SETTINGS = { enabled: true, reserveTokens: 16384, keepRecentTokens: 20000 }`。
- **触发条件**：`shouldCompact() = contextTokens > contextWindow - reserveTokens`。
- **token 估算**：优先用最近一条有效 assistant usage + 其后消息的启发式估算；无 usage 则全量估算（`chars/4`，图片按 4800 chars）。
- **切点**：`findCutPoint()` 从尾部累积至 `keepRecentTokens`，取最近合法切点；落在非 user 消息则回溯 `findTurnStartIndex`（支持 split-turn）。
- **摘要生成**：`generateSummaryWithUsage()` 调用 LLM，固定格式（Goal / Progress / Key Decisions / Next Steps / Critical Context），强制 `cacheRetention:"none"` + 新 `uuidv7` sessionId 隔离路由；最后追加文件操作清单（read/modified 文件）。
- **分支摘要**：`compaction/branch-summarization.ts`（`collectEntriesForBranchSummary` / `generateBranchSummary`），供 `navigateTree` 折叠旧分支。

## 6. 技能与系统提示词

- `src/harness/skills.ts`：`loadSkills(env, dirs)` 递归加载 `SKILL.md`（frontmatter 含 `name/description/disable-model-invocation`），根目录下直接 `.md` 文件也算技能；遵循 `.gitignore/.ignore/.fdignore`；名称/描述严格校验（`^[a-z0-9-]+$`、≤64 等）。
- `formatSkillInvocation()`：生成 `<skill name="..." location="...">...</skill>` 调用块。
- `src/harness/system-prompt.ts`：`formatSkillsForSystemPrompt()` 生成 `<available_skills>` XML 块；默认 system prompt 是 `"You are a helpful assistant."`（可覆盖）。

## 7. 内置工具（Harness 工具）

`src/harness/tools/` 提供 4 个**工具工厂**（装配责任在宿主应用，AgentHarness 不自动接线）：

| 工具 | 文件 | 输入 | 说明 |
|---|---|---|---|
| `createReadTool` | `read.ts` | `{path, offset?, limit?}` | 文本/图片读取，截断输出；可选 `imageProcessor` |
| `createWriteTool` | `write.ts` | `{path, content}` | 覆盖写，自动建父目录，串行化 |
| `createEditTool` | `edit.ts` + `edit-diff.ts` | `{path, edits:[{oldText,newText}]}` | 多目标替换，返回 diff/patch |
| `createBashTool` | `bash.ts` | `{command, timeout?}` | 捕获输出，尾部截断，100ms 节流 |

执行环境 `NodeExecutionEnv`（`env/nodejs.ts`）：文件系统 + Shell 统一接口，返回 `Result<T, Error>` **绝不 throw**；Shell 探测（Windows Git bash / WSL bash / `sh -c`）；进程树终止（Windows `taskkill /F /T`，Unix `kill(-pid)`）。

## 8. proxy.ts（stream 代理）

`streamProxy(model, context, options)`：通过 `fetch("${proxyUrl}/api/stream")` 读 SSE，把远程服务端的 LLM 流转发为本地 `AssistantMessageEventStream`（服务端剥离 partial 字段降带宽，客户端用 `processProxyEvent` 重建）。用法：作为 `streamFn` 传给 `Agent`，实现"LLM 调用经服务端代理"。

## 9. 设计文档索引（`packages/agent/docs/`）

| 文档 | 状态 | 说明 |
|---|---|---|
| `agent-harness.md` | **当前** | 已实现行为的权威文档 |
| `hooks.md` | 当前 | 钩子最终设计（phantom 结果类型 + 归约器表） |
| `models.md` / `observability.md` | 配套 | 模型/可观测性设计 |
| `harness-v2.md` | 愿景 | 持久化 harness（lanes）设计，未全部落地 |
| `harness.md` | 历史 | 被 v2 取代 |
| `durable-harness.md` | 历史 | 最早的设计笔记 |

> 权威细节：`packages/agent/README.md`、`packages/agent/CHANGELOG.md`。下一篇：[pi-coding-agent](03-pi-coding-agent.md)。
