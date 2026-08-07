# 核心抽象：消息模型与事件流

> 第 2 层：全局结构（第三篇）。这一篇深入理解**贯穿全系统各层**的数据形态：**消息**（Message / AgentMessage）与**事件流**（EventStream）。它们是 [02-relations.md](02-relations.md) 里所有链路的"通用语言"——理解了它们，就理解了"数据如何在各层间流动"。这一篇的抽象会频繁出现在第 3、4 层的每个文档里。

## 1. 消息模型（Message）

消息定义在 `packages/ai/src/types.ts`。三种角色：

| 角色 | 用途 | 关键字段 |
|---|---|---|
| `UserMessage` | 用户输入 | `content: string | (TextContent | ImageContent)[]` |
| `AssistantMessage` | 模型输出 | `content: (TextContent | ThinkingContent | ToolCall)[]`；必含 `api/provider/model/usage/stopReason/timestamp` |
| `ToolResultMessage` | 工具执行结果 | `toolCallId/toolName/content/isError/timestamp`，可选 `details/usage/addedToolNames` |

### 内容块（Content Block）

一条消息由若干内容块组成：

- `TextContent`：文本（可带 `textSignature` 用于缓存）
- `ThinkingContent`：思考过程（Anthropic 等模型的推理内容，`thinkingSignature`、`redacted` 标志）
- `ImageContent`：base64 `data` + `mimeType`
- `ToolCall`：工具调用（`id/name/arguments`）

### Usage 与 StopReason

- `Usage`：`input/output/cacheRead/cacheWrite`（+ Anthropic 的 `cacheWrite1h`）、`reasoning`（输出 token 中的推理子集）、`totalTokens`、`cost`（分输入/输出/缓存四档计费）。
- `StopReason`：`"pending" | "stop" | "length" | "toolUse" | "error" | "aborted"`。
  - `stop`：正常结束；`toolUse`：需要执行工具；`length`：被 token 上限截断；`error`/`aborted`：异常终止（此时 `AssistantMessage.errorMessage` 有值）。

### AgentMessage 与 Message 的区别

- **`Message`**（pi-ai 定义）：**LLM 边界**的消息形态，直接发给 provider。
- **`AgentMessage`**（pi-agent-core 定义，`packages/agent/src/types.ts`）：**Agent 内部**全程使用的消息形态，是 `Message` 的超集，额外支持 `bashExecution`、`custom`、`branchSummary`、`compactionSummary` 等特殊角色（通过 `packages/agent/src/harness/messages.ts` 的类型合并扩展）。

关键设计（见 `packages/agent/src/agent-loop.ts` 头注释）：

> Agent loop 全程基于 `AgentMessage` 运行，**仅在调用 LLM 的边界**转换为 `Message[]`（`config.convertToLlm`）。所以工具的中间结果、bash 执行输出、压缩摘要都可以作为"消息"保留在会话里，而不必被 provider 理解。

## 2. 事件流（EventStream）

### 为什么用事件流

LLM 服务商返回的是流式响应（SSE/WebSocket）。Pi 把所有 provider 的输出统一为一个**可异步迭代的事件流**：

```ts
// packages/ai/src/utils/event-stream.ts
class EventStream<T, R> implements AsyncIterable<T> {
  push(event: T): void;          // 投递事件
  end(result: R): void;          // 正常结束
  result(): Promise<R>;          // 最终结果
  [Symbol.asyncIterator]();      // for await 消费
}
```

`AssistantMessageEventStream extends EventStream<AssistantMessageEvent, AssistantMessage>`：以 `done` / `error` 事件为结束标志，`result()` 解出最终 `AssistantMessage`。

### 事件类型（12 种）

| 事件 | 含义 |
|---|---|
| `start` | 流开始，携带初始 `partial` 消息 |
| `text_start` / `text_delta` / `text_end` | 文本块开始 / 增量 / 结束 |
| `thinking_start` / `thinking_delta` / `thinking_end` | 思考块开始 / 增量 / 结束 |
| `toolcall_start` / `toolcall_delta` / `toolcall_end` | 工具调用开始 / 参数流式（partial JSON 尽力解析）/ 完成 |
| `done` | 正常结束（`reason: stop/length/toolUse`） |
| `error` | 错误终止（`reason: error/aborted`） |

契约要点：

- 事件顺序：先 `start`，再增量事件，最后 `done` 或 `error`。
- 不同内容块的事件**可以交错**（一个上游分片里可能同时有 `text_delta` 和 `toolcall_delta`），消费方必须用 `contentIndex` 关联。
- **错误绝不抛出**，一律编码为 `error` 事件 + 最终消息 `stopReason: "error"/"aborted"`。

### 消费模式

```ts
for await (const event of stream) {
  switch (event.type) {
    case "start": // 骨架消息
    case "text_delta": // 增量文本
    case "toolcall_delta": // 增量工具参数
    case "done": // 结束
    case "error": // 错误
  }
}
const finalMessage = await stream.result(); // 最终 AssistantMessage
```

## 3. 一个回合（turn）在 agent-loop 中的消息流转

以 `packages/agent/src/agent-loop.ts` 的 `streamAssistantResponse()` 为例：

```
1. context.messages（AgentMessage[]）
2. config.transformContext?.()       // 可选：上下文转换（AgentMessage[] → AgentMessage[]）
3. config.convertToLlm(messages)     // AgentMessage[] → Message[]（LLM 边界！）
4. streamFn(model, { systemPrompt, messages, tools }, options)
     → AssistantMessageEventStream
5. 逐个消费事件：
   - start:      推入 partial 消息，emit message_start
   - *_delta:    更新 context 末尾的 partial，emit message_update
   - done/error: 取最终消息，写回 context，emit message_end
6. 返回最终 AssistantMessage
```

## 4. Context 与 Tool

- `Context`：`{ systemPrompt?, messages, tools? }`——一次 LLM 调用的完整输入，可 JSON 序列化，也是**跨 provider 会话移交**的载体（pi-ai 的 cross-provider-handoff 能力）。
- `Tool`：用 TypeBox `TSchema` 定义 `parameters`，可带 `constrainedSampling`（强制 JSON schema 采样）。
- 在 pi-agent-core 侧有对应的 `AgentTool`（`packages/agent/src/types.ts`）：多出 `label/description/prepareArguments/executionMode/execute` 等，是"可执行的工具协议"。

## 5. 常用类型速查

| 类型 | 定义处 | 说明 |
|---|---|---|
| `Model<TApi>` | `packages/ai/src/types.ts` | 纯数据模型描述（api/provider/id/cost/contextWindow…） |
| `Message` | 同上 | user/assistant/toolResult |
| `AssistantMessageEventStream` | 同上 + `utils/event-stream.ts` | LLM 调用统一返回 |
| `AgentMessage` | `packages/agent/src/types.ts` | Agent 内部消息（超集） |
| `AgentEvent` | 同上 | agent_start/turn_start/message_*/tool_*/agent_end |
| `AgentTool` | 同上 | 工具执行协议 |
| `AgentLoopConfig` | 同上 | 循环配置（model/convertToLlm/钩子/队列） |
| `AgentHarnessEvent` | `packages/agent/src/harness/types.ts` | AgentEvent + harness 自有事件（save_point/settled/…） |

> 下一步：深入各个包。建议顺序：[pi-ai](../03-packages/01-pi-ai.md) → [pi-agent-core](../03-packages/02-pi-agent-core.md) → [pi-coding-agent](../03-packages/03-pi-coding-agent.md)。
