# AgentHarness 编排层

> 第 4 层：细节链路（第三篇）。**全局定位**：在 [03-packages/02-pi-agent-core.md](../03-packages/02-pi-agent-core.md) 的三个运行层次里，AgentHarness 是**最上面的一层编排门面**（AgentLoop 是最底层，Agent 类居中）。它把 Session、Models、工具、技能、压缩、钩子组装成"面向应用"的 API，直接驱动 agent-loop。当前实现文档见 `packages/agent/docs/agent-harness.md`。

## 定位

- 与 `Agent` 类（`src/agent.ts`）**并列**：两者都驱动 `runAgentLoop`，AgentHarness 不再依赖 Agent 类（[agent-harness.ts](file:///e:/MyCoding/LLMAgent/pi/packages/agent/src/harness/agent-harness.ts#L173-L227) 直接注入 `session` 与 `models`）。
- **单会话、单写者**：一次只跑一个结构性操作。
- **相位锁定**：`phase: "idle" | "turn" | "compaction" | "branch_summary" | "retry"`（L181）。

## 构造选项

```ts
new AgentHarness({
  session,          // Session 实例（来自 SessionRepository.create/open）
  models,           // pi-ai 的 Models
  model,            // 默认模型
  tools?,           // 工具数组（构造时校验重名）
  resources?,       // { skills, promptTemplates }
  systemPrompt?,    // string 或回调
  streamOptions?,   // 透传给 LLM 调用
  retry?,           // 重试策略
  thinkingLevel?,   // 默认 "off"
  activeToolNames?, // 缺省 = 全部工具
  steeringMode?, followUpMode?,  // 缺省 "one-at-a-time"
  toolContext?,     // 应用自定义的工具上下文
})
```

> 注意：AgentHarness **不自动接线内置工具**——工具列表完全由宿主提供（例如 pi CLI 提供 read/bash/edit/write）。

## 操作分类

| 类别 | 方法 | 要求 |
|---|---|---|
| 结构性操作 | `prompt()` / `skill()` / `promptFromTemplate()` / `compact()` / `navigateTree()` | `phase === "idle"`，否则抛 `AgentHarnessError("busy")`；在第一个 await 前同步置位 |
| 回合中操作 | `steer()` / `followUp()` / `nextTurn()` | turn 进行中允许；`nextTurn` 任意时刻可用且不受 abort 影响 |
| 生命周期 | `abort()` / `requestShutdown()` / `waitForShutdown()` | 清队列、终止活动操作 |
| 订阅 | `subscribe(listener)` / `on(type, handler)` | 全量事件 / 按类型（可返回结果） |

## 一次 prompt 的执行链

`prompt()`（[agent-harness.ts](file:///e:/MyCoding/LLMAgent/pi/packages/agent/src/harness/agent-harness.ts#L692-L707)）：

```
1. assertNotShutDown / 结构性操作锁（busy 检查）
2. createTurnState()                    # L395：每回合快照
   - session.buildContext() 的消息 + resources 浅拷贝 + 解析 toolContext + system prompt（回调每回合一次）
   - 当前 model / thinkingLevel / tools / activeTools / streamOptions / 派生 sessionId
3. executeTurn(turnState, text, signal)  # L623
   - 拼接用户消息
   - 钩子 before_agent_start
   - runAgentLoop(messages, context,
       this.createLoopConfig(getTurnState, setTurnState),   # L484
       (event) => this.handleAgentEvent(event, signal),      # L580
       signal,
       this.createStreamFn(getTurnState))                    # L442
   - 循环失败 → emitRunFailure() 合成 stopReason:"error"/"aborted" 消息走完整事件链
   - 返回最后一条 assistant 消息
```

### createLoopConfig：把 harness 钩子桥接到 loop 回调（L484）

| loop 回调 | 桥接的 harness 钩子 |
|---|---|
| `transformContext` | 钩子 `context`（可替换消息） |
| `beforeToolCall` | 钩子 `tool_call`（可 block） |
| `afterToolCall` | 钩子 `tool_result`（可打补丁 / terminate） |
| `prepareNextTurn` | 刷新 pending writes + `createTurnState()` 新快照（**保存点语义**） |
| `getSteeringMessages` / `getFollowUpMessages` | 从队列按 mode 排空 |

### createStreamFn（L442）

每个 provider 请求前触发 `before_provider_request`（可 patch streamOptions）与 `before_provider_payload`，响应后触发 `after_provider_response`。

## 事件与持久化时序（handleAgentEvent，L580）

```
message_end → 先 session.appendMessage() 持久化，再通知订阅者   # 保证转录顺序
turn_end    → 先通知（吞掉错误），再刷新 pending writes，发 save_point
agent_end   → 刷新 pending writes、phase 回 idle、发 settled（带 nextTurnCount）
```

**Pending session writes**：忙碌期间由 `appendMessage`/`setModel`/`setThinkingLevel`/`setTools`/`setActiveTools` 等排入队列（`PendingSessionWrite` = 去掉 id/parentId/timestamp 的条目形状），在保存点 / 结算 / 失败清理时按 FIFO 刷新（`flushPendingSessionWrites`，L554-578）。支持 10 种条目：message/model_change/thinking_level_change/active_tools_change/custom/custom_message/label/session_info/leaf。

## 钩子 / 事件全集

`on(type, handler)` 按类型注册，可返回结果（`AgentHarnessEventResultMap` 定义回调签名）：

```
queue_update / save_point / abort / settled
before_agent_start / context
before_provider_request / before_provider_payload / after_provider_response
tool_call / tool_result
session_before_compact / session_compact
session_before_tree / session_tree
retry_scheduled / retry_attempt_start / retry_finished
model_update / thinking_level_update / resources_update / tools_update
```

钩子回调失败统一归一化为 `AgentHarnessError("hook")`（`normalizeHookError`，L151-153）。完整设计见 `packages/agent/docs/hooks.md`。

## 压缩与树导航

- `compact(customInstructions?)`（[L783](file:///e:/MyCoding/LLMAgent/pi/packages/agent/src/harness/agent-harness.ts#L783-L840)）：idle 锁 → `prepareCompaction(branchEntries, DEFAULT_COMPACTION_SETTINGS)` → 钩子 `session_before_compact`（可 cancel 或直接提供结果）→ 否则调用 `compact()` → `session.appendCompaction()` → 发 `session_compact`。
- `navigateTree(targetId, {...})`（[L842](file:///e:/MyCoding/LLMAgent/pi/packages/agent/src/harness/agent-harness.ts#L842-L940)）：收集旧叶到目标的条目 → 钩子 `session_before_tree`（可 cancel/提供摘要）→ 可选 `generateBranchSummary` → `session.moveTo()` → 发 `session_tree`。

## 错误码

`AgentHarnessErrorCode`（`packages/agent/src/harness/types.ts`）：`busy / invalid_state / invalid_argument / session / hook / auth / compaction / branch_summary / unknown`。

## 方法行号索引

| 方法 | 行号 |
|---|---|
| `createTurnState` | L395 |
| `createStreamFn` | L442 |
| `createLoopConfig` | L484 |
| `handleAgentEvent` | L580 |
| `executeTurn` | L623 |
| `prompt` | L692 |
| `skill` | L708 |
| `promptFromTemplate` | L730 |
| `steer` / `followUp` / `nextTurn` | L748 / L755 / L762 |
| `compact` | L783 |
| `navigateTree` | L842 |
| `requestShutdown` / `waitForShutdown` | L1107 / L1122 |
| `abort` | L1129 |
| `subscribe` | L1163 |

> 下一篇：[工具调用链路](04-tool-execution.md)。
