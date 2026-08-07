# Agent 循环（agent-loop）

> 第 4 层：细节链路（第二篇）。**全局定位**：这是整个系统的"引擎气缸"——无论 coding-agent 的 TUI/print/RPC 哪种模式，最终都汇入这个循环（[agent-loop.ts](file:///e:/MyCoding/LLMAgent/pi/packages/agent/src/agent-loop.ts)）。在上层它是被 [Agent 类](../03-packages/02-pi-agent-core.md) 或 AgentHarness 调用的"裸循环"；在下层它只通过一根 `streamFn` 管子触碰 pi-ai。本篇深入它的两个入口、双层主循环与工具执行细节。

它**无状态、无持久化**，只做一件事：消息进来 → 调 LLM → 执行工具 → 循环，直到该停。

## 两个公开入口

| 函数 | 用途 | 位置 |
|---|---|---|
| `agentLoop()` | 以新提示词启动 | [agent-loop.ts](file:///e:/MyCoding/LLMAgent/pi/packages/agent/src/agent-loop.ts#L35-L58) |
| `agentLoopContinue()` | 从当前上下文继续（重试场景，最后一条必须是非 assistant 消息） | [agent-loop.ts](file:///e:/MyCoding/LLMAgent/pi/packages/agent/src/agent-loop.ts#L73-L102) |

两者都返回 `EventStream<AgentEvent, AgentMessage[]>`（`agent_end` 事件携带最终消息列表），内部 `runAgentLoop()` 同步启动异步任务、通过 `emit` 回调投递事件、完成后 `stream.end(messages)`。

底层实现 `runAgentLoop()`（[agent-loop.ts](file:///e:/MyCoding/LLMAgent/pi/packages/agent/src/agent-loop.ts#L104-L127)）和 `runAgentLoopContinue()`（L129-152）都会先发 `agent_start`、`turn_start`、每条 prompt 的 `message_start/message_end`，然后进入共享的 `runLoop()`。

## 主循环结构：双层循环（runLoop）

`runLoop()`（[agent-loop.ts](file:///e:/MyCoding/LLMAgent/pi/packages/agent/src/agent-loop.ts#L165-L297)）：

```
while (true) {                       // 外层：处理 follow-up 消息
  while (hasMoreToolCalls || pendingMessages.length > 0) {   // 内层：工具调用 + steering
    1. 处理 pending 消息（steering 注入）
    2. streamAssistantResponse() → 得到 assistant 消息
    3. 若 stopReason 为 error/aborted → 发 turn_end + agent_end，返回
    4. 提取 toolCall 内容块
    5. 若有工具调用：执行（并行/顺序），生成 toolResult 消息
    6. prepareNextTurn 快照（模型/thinkingLevel 可被替换）
    7. shouldStopAfterTurn 判断 → 停则 agent_end 返回
    8. 重新取 steering 消息
  }
  followUpMessages = getFollowUpMessages()   // agent 本应停止时检查
  有 → 置为 pending，continue；无 → break
}
发 agent_end
```

设计要点：

- **steering 消息**：用户在等待期间输入，注入到"下一次助手响应之前"；
- **follow-up 消息**：agent 本应停止后才到达，唤醒外层循环再跑一轮；
- **stopReason === "length"** 时所有工具调用判为失败（`failToolCallsFromTruncatedMessage`，L413-438），不执行残缺参数。

## 单轮（turn）内部：streamAssistantResponse

`streamAssistantResponse()`（[agent-loop.ts](file:///e:/MyCoding/LLMAgent/pi/packages/agent/src/agent-loop.ts#L305-L400)）是"LLM 边界"：

```
1. transformContext?.(messages)        // 可选：AgentMessage[] → AgentMessage[]
2. convertToLlm(messages)              // AgentMessage[] → Message[]（关键转换！）
3. 构造 Context { systemPrompt, messages, tools }
4. getApiKey 解析 → streamFn(model, llmContext, {...config, apiKey, signal})
5. for await (event of response)：
   - start          → 推入 partial 消息到 context，emit message_start
   - *_delta        → 更新 context 末尾消息为最新 partial，emit message_update
   - done / error   → 取最终消息，写回 context，emit message_end，返回
```

事件类型与 partial 消息的语义详见 [02-architecture/03-message-and-stream.md](../02-architecture/03-message-and-stream.md)。

## 工具执行

`executeToolCalls()`（[agent-loop.ts](file:///e:/MyCoding/LLMAgent/pi/packages/agent/src/agent-loop.ts#L444-L459)）决定并行还是顺序：

```ts
if (config.toolExecution === "sequential" || 存在 sequential 工具) {
  return executeToolCallsSequential(...);
}
return executeToolCallsParallel(...);
```

单次调用的完整处理链（`prepareToolCall`，L633-697）：

```
1. 在 context.tools 中按 name 查找工具；找不到 → 直接生成错误 toolResult
2. prepareArguments（可选，改写参数）
3. validateToolArguments（TypeBox schema 校验）
4. beforeToolCall 钩子 → 返回 { block, reason } 则拦截
5. 返回 PreparedToolCall
```

执行后经 `finalizeExecutedToolCall()`（L742-787）跑 `afterToolCall` 钩子（可打补丁 / 设置 `terminate`）。`shouldTerminateToolBatch`（L615-617）：整批都 `terminate === true` 才终止循环。

## 关键函数索引

| 函数 | 行号 | 职责 |
|---|---|---|
| `agentLoop` | L35 | 公开入口：新 prompt |
| `agentLoopContinue` | L73 | 公开入口：继续 |
| `runAgentLoop` | L104 | 底层实现 |
| `runAgentLoopContinue` | L129 | 底层实现 |
| `runLoop` | L165 | 双层主循环 |
| `streamAssistantResponse` | L305 | 单轮：LLM 边界 |
| `failToolCallsFromTruncatedMessage` | L413 | length 截断时全部判失败 |
| `executeToolCalls` | L444 | 选择并行/顺序 |
| `executeToolCallsSequential` | L466 | 顺序执行 |
| `executeToolCallsParallel` | L522 | 并行执行 |
| `prepareToolCall` | L633 | 单次工具调用准备（查找/校验/钩子） |
| `executePreparedToolCall` | L699 | 执行 + 流式 update |
| `finalizeExecutedToolCall` | L742 | afterToolCall 钩子 |

## 谁在调用 agent-loop

- **`Agent` 类**（`packages/agent/src/agent.ts`）：`runPromptMessages()` / `runContinuation()` 调用 `runAgentLoop` / `runAgentLoopContinue`，并处理事件归约、生命周期（L430-456）。
- **`AgentHarness`**（`packages/agent/src/harness/agent-harness.ts`）：`executeTurn()` 直接调用 `runAgentLoop`，把 harness 钩子桥接为 loop 回调（`createLoopConfig`）。**已完全不依赖 `Agent` 类**——两者并列，应用层二选一。

> 下一篇：[AgentHarness 编排层](03-agent-harness.md)。
