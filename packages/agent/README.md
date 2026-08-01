# @earendil-works/pi-agent-core

Stateful agent with tool execution and event streaming. Built on `@earendil-works/pi-ai`.
具备工具（tool）执行与事件流能力的有状态智能体（agent）。基于 `@earendil-works/pi-ai` 构建。

## Installation 安装

```bash
npm install @earendil-works/pi-agent-core
```

### SQLite session backends SQLite 会话后端

The SQLite session backend and the `node:sqlite` adapter live in a separate package, `@earendil-works/pi-storage-sqlite-node`, so the core package does not pull in runtime builtins or native SQLite dependencies by default. The backend accepts a runtime-specific SQLite factory, allowing other storage backends to ship as their own packages in the future.
SQLite 会话（session）后端以及 `node:sqlite` 适配器位于独立的包 `@earendil-works/pi-storage-sqlite-node` 中，因此核心包默认不会引入运行时内置模块或原生 SQLite 依赖。该后端接受一个与运行时相关的 SQLite 工厂函数，从而使其他存储后端未来可以作为各自独立的包发布。

## Quick Start 快速开始

```typescript
import { Agent } from "@earendil-works/pi-agent-core";
import { createModels } from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";

const models = createModels();
models.setProvider(anthropicProvider());
const model = models.getModel("anthropic", "claude-sonnet-4-6");
if (!model) throw new Error("Model not found");

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful assistant.",
    model,
  },
  streamFn: models.streamSimple.bind(models),
});

agent.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    // Stream just the new text chunk
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await agent.prompt("Hello!");
```

## Core Concepts 核心概念

### AgentMessage vs LLM Message AgentMessage 与 LLM Message 的区别

The agent works with `AgentMessage`, a flexible type that can include:
agent 使用 `AgentMessage` 这一灵活的类型，它可以包含：
- Standard LLM messages (`user`, `assistant`, `toolResult`)
  标准的 LLM 消息（`user`、`assistant`、`toolResult`）
- Custom app-specific message types via declaration merging
  通过声明合并（declaration merging）定义的应用自定义消息类型

LLMs only understand `user`, `assistant`, and `toolResult`. The `convertToLlm` function bridges this gap by filtering and transforming messages before each LLM call.
LLM 只能理解 `user`、`assistant` 和 `toolResult`。`convertToLlm` 函数通过在每次 LLM 调用前过滤并转换消息来弥合这一差异。

### Message Flow 消息流

```
AgentMessage[] → transformContext() → AgentMessage[] → convertToLlm() → Message[] → LLM
                    (optional)                           (required)
```

1. **transformContext**: Prune old messages, inject external context
   **transformContext**：裁剪旧消息，注入外部上下文
2. **convertToLlm**: Filter out UI-only messages, convert custom types to LLM format
   **convertToLlm**：过滤掉仅用于 UI 的消息，将自定义类型转换为 LLM 格式

## Event Flow 事件流

The agent emits events for UI updates. Understanding the event sequence helps build responsive interfaces.
agent 会发出事件以驱动 UI 更新。理解事件序列有助于构建响应式界面。

### prompt() Event Sequence prompt() 的事件序列

When you call `prompt("Hello")`:
当你调用 `prompt("Hello")` 时：

```
prompt("Hello")
├─ agent_start
├─ turn_start
├─ message_start   { message: userMessage }      // Your prompt
├─ message_end     { message: userMessage }
├─ message_start   { message: assistantMessage } // LLM starts responding
├─ message_update  { message: partial... }       // Streaming chunks
├─ message_update  { message: partial... }
├─ message_end     { message: assistantMessage } // Complete response
├─ turn_end        { message, toolResults: [] }
└─ agent_end       { messages: [...] }
```

### With Tool Calls 包含工具调用的情况

If the assistant calls tools, the loop continues:
如果助手（assistant）调用了工具，循环将继续：

```
prompt("Read config.json")
├─ agent_start
├─ turn_start
├─ message_start/end  { userMessage }
├─ message_start      { assistantMessage with toolCall }
├─ message_update...
├─ message_end        { assistantMessage }
├─ tool_execution_start  { toolCallId, toolName, args }
├─ tool_execution_update { partialResult }           // If tool streams
├─ tool_execution_end    { toolCallId, result }
├─ message_start/end  { toolResultMessage }
├─ turn_end           { message, toolResults: [toolResult] }
│
├─ turn_start                                        // Next turn
├─ message_start      { assistantMessage }           // LLM responds to tool result
├─ message_update...
├─ message_end
├─ turn_end
└─ agent_end
```

Tool execution mode is configurable:
工具执行模式是可配置的：

- `parallel` (default): preflight tool calls sequentially, execute allowed tools concurrently, emit `tool_execution_end` as soon as each tool is finalized, then emit toolResult messages and `turn_end.toolResults` in assistant source order
  `parallel`（默认）：按顺序对工具调用做预检（preflight），并发执行被允许的工具，每个工具一经完成即发出 `tool_execution_end`，随后按助手消息中的原始顺序发出 toolResult 消息和 `turn_end.toolResults`
- `sequential`: execute tool calls one by one, matching the historical behavior
  `sequential`：逐个执行工具调用，与历史行为保持一致

In parallel mode, tool completion events follow tool completion order, but persisted toolResult messages still follow assistant source order.
在并行模式下，工具完成事件按工具实际完成的顺序发出，但持久化的 toolResult 消息仍然遵循助手消息中的原始顺序。

The mode can be set globally via `toolExecution` in the agent config, or per-tool via `executionMode` on `AgentTool`. If any tool call in a batch targets a tool with `executionMode: "sequential"`, the entire batch executes sequentially regardless of the global setting.
该模式可以通过 agent 配置中的 `toolExecution` 全局设置，也可以通过 `AgentTool` 上的 `executionMode` 按工具单独设置。如果一批工具调用中有任意一个指向 `executionMode: "sequential"` 的工具，则无论全局设置如何，整批调用都会串行执行。

The `beforeToolCall` hook runs after `tool_execution_start` and validated argument parsing. It can block execution. The `afterToolCall` hook runs after tool execution finishes and before `tool_execution_end` and final tool result message events are emitted.
`beforeToolCall` 钩子在 `tool_execution_start` 之后、参数校验解析完成之后运行，它可以阻止执行。`afterToolCall` 钩子在工具执行结束之后、在发出 `tool_execution_end` 和最终工具结果消息事件之前运行。

Tools can also return `terminate: true` to hint that the automatic follow-up LLM call should be skipped. The loop only stops early when every finalized tool result in that batch sets `terminate: true`. Mixed batches continue normally.
工具还可以返回 `terminate: true`，以提示应跳过自动的后续 LLM 调用。只有当该批次中所有已完成的工具结果都设置了 `terminate: true` 时，循环才会提前停止。混合情况的批次会正常继续。

Low-level loop callers can set `shouldStopAfterTurn` to stop gracefully after the current turn completes:
底层循环的调用方可以设置 `shouldStopAfterTurn`，以便在当前轮次（turn）完成后优雅地停止：

```typescript
const stream = agentLoop(
  prompts,
  context,
  {
    model,
    convertToLlm,
    shouldStopAfterTurn: async ({ message, toolResults, context, newMessages }) => {
      return shouldCompactBeforeNextTurn(context.messages);
    },
  },
  undefined,
  models.streamSimple.bind(models),
);
```

`shouldStopAfterTurn` runs after `turn_end` is emitted and after the assistant response and any tool executions have completed normally. If it returns `true`, the loop emits `agent_end` and exits before polling steering or follow-up queues, and before starting another LLM call. It does not abort the provider stream, does not cancel running tools, and does not alter the assistant message stop reason.
`shouldStopAfterTurn` 在发出 `turn_end` 之后运行，此时助手响应和所有工具执行都已正常完成。如果它返回 `true`，循环会发出 `agent_end` 并退出，不再轮询引导（steering）队列或后续（follow-up）队列，也不会发起新的 LLM 调用。它不会中止服务提供商（provider）的流，不会取消正在运行的工具，也不会改变助手消息的停止原因（stop reason）。

When you use the `Agent` class, assistant `message_end` processing is treated as a barrier before tool preflight begins. That means `beforeToolCall` sees agent state that already includes the assistant message that requested the tool call.
使用 `Agent` 类时，助手的 `message_end` 处理会被视为工具预检开始前的一道屏障（barrier）。这意味着 `beforeToolCall` 所看到的 agent 状态中已经包含了发起该工具调用的助手消息。

### continue() Event Sequence continue() 的事件序列

`continue()` resumes from existing context without adding a new message. Use it for retries after errors.
`continue()` 会从现有上下文继续执行，而不添加新消息。可用于出错后的重试。

```typescript
// After an error, retry from current state
await agent.continue();
```

The last message in context must be `user` or `toolResult` (not `assistant`).
上下文中的最后一条消息必须是 `user` 或 `toolResult`（不能是 `assistant`）。

### Event Types 事件类型

| Event 事件 | Description 说明 |
|-------|-------------|
| `agent_start` | Agent begins processing<br>agent 开始处理 |
| `agent_end` | Final event for the run. Awaited subscribers for this event still count toward settlement<br>本次运行的最终事件。该事件被 await 的订阅者仍计入运行的完成（settlement） |
| `turn_start` | New turn begins (one LLM call + tool executions)<br>新一轮（turn）开始（一次 LLM 调用 + 工具执行） |
| `turn_end` | Turn completes with assistant message and tool results<br>本轮结束，附带助手消息和工具结果 |
| `message_start` | Any message begins (user, assistant, toolResult)<br>任意消息开始（user、assistant、toolResult） |
| `message_update` | **Assistant only.** Includes `assistantMessageEvent` with delta<br>**仅限助手消息。** 包含带增量（delta）的 `assistantMessageEvent` |
| `message_end` | Message completes<br>消息结束 |
| `tool_execution_start` | Tool begins<br>工具开始执行 |
| `tool_execution_update` | Tool streams progress<br>工具流式输出进度 |
| `tool_execution_end` | Tool completes<br>工具执行完成 |

`Agent.subscribe()` listeners are awaited in registration order. `agent_end` means no more loop events will be emitted, but `await agent.waitForIdle()` and `await agent.prompt(...)` only settle after awaited `agent_end` listeners finish.
`Agent.subscribe()` 注册的监听器会按注册顺序被 await。`agent_end` 表示不会再发出循环事件，但 `await agent.waitForIdle()` 和 `await agent.prompt(...)` 只有在被 await 的 `agent_end` 监听器执行完毕后才会完成。

## Agent Options Agent 配置项

```typescript
const agent = new Agent({
  // Initial state
  initialState: {
    systemPrompt: string,
    model: Model<any>,
    thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max",
    tools: AgentTool<any>[],
    messages: AgentMessage[],
  },

  // Convert AgentMessage[] to LLM Message[] (required for custom message types)
  convertToLlm: (messages) => messages.filter(...),

  // Transform context before convertToLlm (for pruning, compaction)
  transformContext: async (messages, signal) => pruneOldMessages(messages),

  // Steering mode: "one-at-a-time" (default) or "all"
  steeringMode: "one-at-a-time",

  // Follow-up mode: "one-at-a-time" (default) or "all"
  followUpMode: "one-at-a-time",

  // Required stream function
  streamFn: models.streamSimple.bind(models),

  // Session ID for provider caching
  sessionId: "session-123",

  // Dynamic API key resolution (for expiring OAuth tokens)
  getApiKey: async (provider) => refreshToken(),

  // Tool execution mode: "parallel" (default) or "sequential"
  toolExecution: "parallel",

  // Preflight each tool call after args are validated. Can block execution.
  beforeToolCall: async ({ toolCall, args, context }) => {
    if (toolCall.name === "bash") {
      return { block: true, reason: "bash is disabled" };
    }
  },

  // Postprocess each tool result before final tool events are emitted.
  afterToolCall: async ({ toolCall, result, isError, context }) => {
    if (toolCall.name === "notify_done" && !isError) {
      return { terminate: true };
    }
    if (!isError) {
      return { details: { ...result.details, audited: true } };
    }
  },

  // Custom thinking budgets for token-based providers
  thinkingBudgets: {
    minimal: 128,
    low: 512,
    medium: 1024,
    high: 2048,
  },
});
```

## Agent State Agent 状态

```typescript
interface AgentState {
  systemPrompt: string;
  model: Model<any>;
  thinkingLevel: ThinkingLevel;
  tools: AgentTool<any>[];
  messages: AgentMessage[];
  readonly isStreaming: boolean;
  readonly streamingMessage?: AgentMessage;
  readonly pendingToolCalls: ReadonlySet<string>;
  readonly errorMessage?: string;
}
```

Access state via `agent.state`.
通过 `agent.state` 访问状态。

Assigning `agent.state.tools = [...]` or `agent.state.messages = [...]` copies the top-level array before storing it. Mutating the returned array mutates the current agent state.
对 `agent.state.tools = [...]` 或 `agent.state.messages = [...]` 赋值时，会先复制顶层数组再保存。而修改读取到的数组则会直接改变当前的 agent 状态。

During streaming, `agent.state.streamingMessage` contains the current partial assistant message.
在流式输出期间，`agent.state.streamingMessage` 包含当前尚未完成的助手消息片段。

`agent.state.isStreaming` remains `true` until the run fully settles, including awaited `agent_end` subscribers.
`agent.state.isStreaming` 会一直保持为 `true`，直到本次运行完全结束，包括被 await 的 `agent_end` 订阅者执行完毕。

## Methods 方法

### Prompting 发起提示

```typescript
// Text prompt
await agent.prompt("Hello");

// With images
await agent.prompt("What's in this image?", [
  { type: "image", data: base64Data, mimeType: "image/jpeg" }
]);

// AgentMessage directly
await agent.prompt({ role: "user", content: "Hello", timestamp: Date.now() });

// Continue from current context (last message must be user or toolResult)
await agent.continue();
```

### State Management 状态管理

```typescript
agent.state.systemPrompt = "New prompt";
agent.state.model = getModel("openai", "gpt-4o");
agent.state.thinkingLevel = "medium";
agent.state.tools = [myTool];
agent.toolExecution = "sequential";
agent.beforeToolCall = async ({ toolCall }) => undefined;
agent.afterToolCall = async ({ toolCall, result }) => undefined;
agent.state.messages = newMessages; // top-level array is copied
agent.state.messages.push(message);
agent.reset();
```

### Session and Thinking Budgets 会话与思考预算

```typescript
agent.sessionId = "session-123";

agent.thinkingBudgets = {
  minimal: 128,
  low: 512,
  medium: 1024,
  high: 2048,
};
```

### Control 控制

```typescript
agent.abort();           // Cancel current operation
await agent.waitForIdle(); // Wait for completion
```

### Events 事件

```typescript
const unsubscribe = agent.subscribe(async (event, signal) => {
  if (event.type === "agent_end") {
    // Final barrier work for the run
    await flushSessionState(signal);
  }
});
unsubscribe();
```

## Steering and Follow-up 引导与后续消息

Steering messages let you interrupt the agent while tools are running. Follow-up messages let you queue work after the agent would otherwise stop.
引导消息（steering message）让你可以在工具运行期间打断 agent。后续消息（follow-up message）让你可以在 agent 本应停止之后继续排入新的工作。

```typescript
agent.steeringMode = "one-at-a-time";
agent.followUpMode = "one-at-a-time";

// While agent is running tools
agent.steer({
  role: "user",
  content: "Stop! Do this instead.",
  timestamp: Date.now(),
});

// After the agent finishes its current work
agent.followUp({
  role: "user",
  content: "Also summarize the result.",
  timestamp: Date.now(),
});

const steeringMode = agent.steeringMode;
const followUpMode = agent.followUpMode;

agent.clearSteeringQueue();
agent.clearFollowUpQueue();
agent.clearAllQueues();
```

Use clearSteeringQueue, clearFollowUpQueue, or clearAllQueues to drop queued messages.
使用 clearSteeringQueue、clearFollowUpQueue 或 clearAllQueues 可丢弃排队中的消息。

When steering messages are detected after a turn completes:
当某一轮结束后检测到引导消息时：
1. All tool calls from the current assistant message have already finished
   当前助手消息中的所有工具调用都已完成
2. Steering messages are injected
   引导消息被注入
3. The LLM responds on the next turn
   LLM 在下一轮中做出响应

Follow-up messages are checked only when there are no more tool calls and no steering messages. If any are queued, they are injected and another turn runs.
只有在没有待处理的工具调用且没有引导消息时，才会检查后续消息。如果队列中存在后续消息，它们会被注入并触发新的一轮。

## Custom Message Types 自定义消息类型

Extend `AgentMessage` via declaration merging:
通过声明合并（declaration merging）扩展 `AgentMessage`：

```typescript
declare module "@earendil-works/pi-agent-core" {
  interface CustomAgentMessages {
    notification: { role: "notification"; text: string; timestamp: number };
  }
}

// Now valid
const msg: AgentMessage = { role: "notification", text: "Info", timestamp: Date.now() };
```

Handle custom types in `convertToLlm`:
在 `convertToLlm` 中处理自定义类型：

```typescript
const agent = new Agent({
  streamFn: models.streamSimple.bind(models),
  convertToLlm: (messages) => messages.flatMap(m => {
    if (m.role === "notification") return []; // Filter out
    return [m];
  }),
});
```

## Tools 工具

Define tools using `AgentTool`:
使用 `AgentTool` 定义工具：

```typescript
import { Type } from "typebox";

const readFileTool: AgentTool = {
  name: "read_file",
  label: "Read File",  // For UI display
  description: "Read a file's contents",
  parameters: Type.Object({
    path: Type.String({ description: "File path" }),
  }),
  // Override execution mode for this tool (optional).
  // "sequential" forces the entire batch to run one at a time.
  // "parallel" allows concurrent execution with other tool calls.
  // If omitted, the global toolExecution config applies.
  executionMode: "sequential",
  execute: async (toolCallId, params, signal, onUpdate) => {
    const content = await fs.readFile(params.path, "utf-8");

    // Optional: stream progress
    onUpdate?.({ content: [{ type: "text", text: "Reading..." }], details: {} });

    // Optional: add `terminate: true` here to skip the automatic follow-up LLM call
    // when every finalized tool result in the batch does the same.
    return {
      content: [{ type: "text", text: content }],
      details: { path: params.path, size: content.length },
    };
  },
};

agent.state.tools = [readFileTool];
```

### Error Handling 错误处理

**Throw an error** when a tool fails. Do not return error messages as content.
当工具执行失败时应**抛出异常**，不要把错误信息作为内容返回。

```typescript
execute: async (toolCallId, params, signal, onUpdate) => {
  if (!fs.existsSync(params.path)) {
    throw new Error(`File not found: ${params.path}`);
  }
  // Return content only on success
  return { content: [{ type: "text", text: "..." }] };
}
```

Thrown errors are caught by the agent and reported to the LLM as tool errors with `isError: true`.
抛出的异常会被 agent 捕获，并以 `isError: true` 的工具错误形式上报给 LLM。

Return `terminate: true` from `execute()` or `afterToolCall` to hint that the agent should stop after the current tool batch. This only takes effect when every finalized tool result in the batch is terminating. The hint is runtime-only; emitted `toolResult` transcript messages remain standard LLM tool results.
在 `execute()` 或 `afterToolCall` 中返回 `terminate: true`，可提示 agent 在当前这批工具执行完后停止。只有当该批次中所有已完成的工具结果都要求终止时，该提示才会生效。这一提示仅在运行时有效；发出的 `toolResult` 记录消息仍然是标准的 LLM 工具结果。

## Proxy Usage 代理用法

For browser apps that proxy through a backend:
适用于通过后端代理转发的浏览器应用：

```typescript
import { Agent, streamProxy } from "@earendil-works/pi-agent-core";

const agent = new Agent({
  streamFn: (model, context, options) =>
    streamProxy(model, context, {
      ...options,
      authToken: "...",
      proxyUrl: "https://your-server.com",
    }),
});
```

## Low-Level API 底层 API

For direct control without the Agent class:
在不使用 Agent 类的情况下进行直接控制：

```typescript
import { agentLoop, agentLoopContinue } from "@earendil-works/pi-agent-core";

const context: AgentContext = {
  systemPrompt: "You are helpful.",
  messages: [],
  tools: [],
};

const config: AgentLoopConfig = {
  model: getModel("openai", "gpt-4o"),
  convertToLlm: (msgs) => msgs.filter(m => ["user", "assistant", "toolResult"].includes(m.role)),
  toolExecution: "parallel",  // overridden by per-tool executionMode if set
  beforeToolCall: async ({ toolCall, args, context }) => undefined,
  afterToolCall: async ({ toolCall, result, isError, context }) => undefined,
};

const userMessage = { role: "user", content: "Hello", timestamp: Date.now() };

const streamFn = models.streamSimple.bind(models);
for await (const event of agentLoop([userMessage], context, config, undefined, streamFn)) {
  console.log(event.type);
}

// Continue from existing context
for await (const event of agentLoopContinue(context, config, undefined, streamFn)) {
  console.log(event.type);
}
```

These low-level streams are observational. They preserve event order, but they do not wait for your async event handling to settle before later producer phases continue. If you need message processing to act as a barrier before tool preflight, use the `Agent` class instead of raw `agentLoop()` or `agentLoopContinue()`.
这些底层流仅供观察使用。它们会保持事件顺序，但不会在继续后续生产阶段之前等待你的异步事件处理完成。如果你需要让消息处理成为工具预检前的一道屏障（barrier），请使用 `Agent` 类，而不是直接使用 `agentLoop()` 或 `agentLoopContinue()`。

## License 许可证

MIT
