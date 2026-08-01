# RPC Mode RPC 模式

RPC mode enables headless operation of the coding agent via a JSON protocol over stdin/stdout. This is useful for embedding the agent in other applications, IDEs, or custom UIs.
RPC 模式通过 stdin/stdout 上的 JSON 协议实现 coding agent 的无界面（headless）运行。这适用于将 agent 嵌入到其他应用程序、IDE 或自定义 UI 中。

**Note for Node.js/TypeScript users**: If you're building a Node.js application, consider using `AgentSession` directly from `@earendil-works/pi-coding-agent` instead of spawning a subprocess. See [`src/core/agent-session.ts`](../src/core/agent-session.ts) for the API. For a subprocess-based TypeScript client, see [`src/modes/rpc/rpc-client.ts`](../src/modes/rpc/rpc-client.ts).
**给 Node.js/TypeScript 用户的提示**：如果你在构建 Node.js 应用，建议直接使用 `@earendil-works/pi-coding-agent` 中的 `AgentSession`，而不是派生子进程。API 参见 [`src/core/agent-session.ts`](../src/core/agent-session.ts)。若需要基于子进程的 TypeScript 客户端，参见 [`src/modes/rpc/rpc-client.ts`](../src/modes/rpc/rpc-client.ts)。

## Starting RPC Mode 启动 RPC 模式

```bash
pi --mode rpc [options]
```

Common options:
常用选项：
- `--provider <name>`: Set the LLM provider (anthropic, openai, google, etc.)
  设置 LLM 提供方（anthropic、openai、google 等）
- `--model <pattern>`: Model pattern or ID (supports `provider/id` and optional `:<thinking>`)
  模型匹配模式或 ID（支持 `provider/id` 以及可选的 `:<thinking>`）
- `--name <name>` / `-n <name>`: Set the session display name at startup
  在启动时设置会话（session）显示名称
- `--no-session`: Disable session persistence
  禁用会话持久化
- `--session-dir <path>`: Custom session storage directory
  自定义会话存储目录

## Protocol Overview 协议概览

- **Commands**: JSON objects sent to stdin, one per line
  **命令（Commands）**：发送到 stdin 的 JSON 对象，每行一个
- **Responses**: JSON objects with `type: "response"` indicating command success/failure
  **响应（Responses）**：带有 `type: "response"` 的 JSON 对象，表示命令成功或失败
- **Events**: Agent events streamed to stdout as JSON lines
  **事件（Events）**：以 JSON 行形式流式输出到 stdout 的 agent 事件

All commands support an optional `id` field for request/response correlation. If provided, the corresponding response will include the same `id`. `bash_execution_update` events also include the `id` of their originating `bash` command.
所有命令都支持可选的 `id` 字段，用于请求/响应关联。如果提供了该字段，对应的响应将包含相同的 `id`。`bash_execution_update` 事件也会包含其来源 `bash` 命令的 `id`。

### Framing 分帧

RPC mode uses strict JSONL semantics with LF (`\n`) as the only record delimiter.
RPC 模式采用严格的 JSONL 语义，仅以 LF（`\n`）作为记录分隔符。

This matters for clients:
这对客户端很重要：
- Split records on `\n` only
  仅按 `\n` 切分记录
- Accept optional `\r\n` input by stripping a trailing `\r`
  通过去除结尾的 `\r` 来兼容可选的 `\r\n` 输入
- Do not use generic line readers that treat Unicode separators as newlines
  不要使用把 Unicode 分隔符当作换行的通用行读取器

In particular, Node `readline` is not protocol-compliant for RPC mode because it also splits on `U+2028` and `U+2029`, which are valid inside JSON strings.
特别地，Node 的 `readline` 不符合 RPC 模式的协议要求，因为它还会按 `U+2028` 和 `U+2029` 切分，而这两个字符在 JSON 字符串中是合法的。

## Commands 命令

### Prompting 提示交互

#### prompt

Send a user prompt to the agent. The command response is emitted after the prompt is accepted, queued, or handled. Events continue streaming asynchronously after acceptance.
向 agent 发送用户提示（prompt）。命令响应在提示被接受、入队或处理后发出。接受之后，事件会继续异步流式输出。

```json
{"id": "req-1", "type": "prompt", "message": "Hello, world!"}
```

With images:
包含图片时：
```json
{"type": "prompt", "message": "What's in this image?", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

**During streaming**: If the agent is already streaming, you must specify `streamingBehavior` to queue the message:
**流式输出期间**：如果 agent 已在流式输出中，你必须指定 `streamingBehavior` 才能将消息入队：

```json
{"type": "prompt", "message": "New instruction", "streamingBehavior": "steer"}
```

- `"steer"`: Queue the message while the agent is running. It is delivered after the current assistant turn finishes executing its tool calls, before the next LLM call.
  `"steer"`：在 agent 运行期间将消息入队。消息会在当前 assistant 轮次（turn）执行完其工具调用之后、下一次 LLM 调用之前投递。
- `"followUp"`: Wait until the agent finishes. Message is delivered only when agent stops.
  `"followUp"`：等待 agent 结束。消息仅在 agent 停止时才投递。

If the agent is streaming and no `streamingBehavior` is specified, the command returns an error.
如果 agent 正在流式输出而未指定 `streamingBehavior`，该命令会返回错误。

**Extension commands**: If the message is an extension command (e.g., `/mycommand`), it executes immediately even during streaming. Extension commands manage their own LLM interaction via `pi.sendMessage()`.
**扩展命令（Extension commands）**：如果消息是扩展命令（例如 `/mycommand`），即使在流式输出期间也会立即执行。扩展命令通过 `pi.sendMessage()` 自行管理其 LLM 交互。

**Input expansion**: Skill commands (`/skill:name`) and prompt templates (`/template`) are expanded before sending/queueing.
**输入展开（Input expansion）**：技能命令（`/skill:name`）和提示模板（`/template`）会在发送/入队之前先被展开。

Response:
响应：
```json
{"id": "req-1", "type": "response", "command": "prompt", "success": true}
```

`success: true` means the prompt was accepted, queued, or handled immediately. `success: false` means the prompt was rejected before acceptance. Failures after acceptance are reported through the normal event and message stream, not as a second `response` for the same request id.
`success: true` 表示提示已被接受、入队或立即处理。`success: false` 表示提示在被接受前即遭拒绝。接受之后发生的失败会通过常规的事件与消息流上报，而不会针对同一请求 id 再发出第二个 `response`。

The `images` field is optional. Each image uses `ImageContent` format: `{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}`.
`images` 字段是可选的。每张图片采用 `ImageContent` 格式：`{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}`。

#### steer

Queue a steering message while the agent is running. It is delivered after the current assistant turn finishes executing its tool calls, before the next LLM call. Skill commands and prompt templates are expanded. Extension commands are not allowed (use `prompt` instead).
在 agent 运行期间将一条引导（steering）消息入队。该消息会在当前 assistant 轮次执行完其工具调用之后、下一次 LLM 调用之前投递。技能命令和提示模板会被展开。不允许使用扩展命令（请改用 `prompt`）。

```json
{"type": "steer", "message": "Stop and do this instead"}
```

With images:
包含图片时：
```json
{"type": "steer", "message": "Look at this instead", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

The `images` field is optional. Each image uses `ImageContent` format (same as `prompt`).
`images` 字段是可选的。每张图片采用 `ImageContent` 格式（与 `prompt` 相同）。

Response:
响应：
```json
{"type": "response", "command": "steer", "success": true}
```

See [set_steering_mode](#set_steering_mode) for controlling how steering messages are processed.
关于如何控制引导消息的处理方式，参见 [set_steering_mode](#set_steering_mode)。

#### follow_up

Queue a follow-up message to be processed after the agent finishes. Delivered only when agent has no more tool calls or steering messages. Skill commands and prompt templates are expanded. Extension commands are not allowed (use `prompt` instead).
将一条后续（follow-up）消息入队，待 agent 结束后再处理。仅当 agent 没有更多工具调用或引导消息时才会投递。技能命令和提示模板会被展开。不允许使用扩展命令（请改用 `prompt`）。

```json
{"type": "follow_up", "message": "After you're done, also do this"}
```

With images:
包含图片时：
```json
{"type": "follow_up", "message": "Also check this image", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

The `images` field is optional. Each image uses `ImageContent` format (same as `prompt`).
`images` 字段是可选的。每张图片采用 `ImageContent` 格式（与 `prompt` 相同）。

Response:
响应：
```json
{"type": "response", "command": "follow_up", "success": true}
```

See [set_follow_up_mode](#set_follow_up_mode) for controlling how follow-up messages are processed.
关于如何控制后续消息的处理方式，参见 [set_follow_up_mode](#set_follow_up_mode)。

#### abort

Abort the current agent operation.
中止当前的 agent 操作。

```json
{"type": "abort"}
```

Response:
响应：
```json
{"type": "response", "command": "abort", "success": true}
```

#### new_session

Start a fresh session. Can be cancelled by a `session_before_switch` extension event handler.
开启一个全新的会话。可被 `session_before_switch` 扩展事件处理器取消。

```json
{"type": "new_session"}
```

With optional parent session tracking:
可选地追踪父会话：
```json
{"type": "new_session", "parentSession": "/path/to/parent-session.jsonl"}
```

Response:
响应：
```json
{"type": "response", "command": "new_session", "success": true, "data": {"cancelled": false}}
```

If an extension cancelled:
如果被扩展取消：
```json
{"type": "response", "command": "new_session", "success": true, "data": {"cancelled": true}}
```

### State 状态

#### get_state

Get current session state.
获取当前会话状态。

```json
{"type": "get_state"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "get_state",
  "success": true,
  "data": {
    "model": {...},
    "thinkingLevel": "medium",
    "isStreaming": false,
    "isCompacting": false,
    "steeringMode": "all",
    "followUpMode": "one-at-a-time",
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "abc123",
    "sessionName": "my-feature-work",
    "autoCompactionEnabled": true,
    "messageCount": 5,
    "pendingMessageCount": 0
  }
}
```

The `model` field is a full [Model](#model) object or `null`. The `sessionName` field is the display name set via `set_session_name`, or omitted if not set.
`model` 字段是完整的 [Model](#model) 对象或 `null`。`sessionName` 字段是通过 `set_session_name` 设置的显示名称；若未设置则会被省略。

#### get_messages

Get all messages in the conversation.
获取对话中的所有消息。

```json
{"type": "get_messages"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "get_messages",
  "success": true,
  "data": {"messages": [...]}
}
```

Messages are `AgentMessage` objects (see [Message Types](#message-types)).
这些消息是 `AgentMessage` 对象（参见 [Message Types](#message-types)）。

### Model 模型

#### set_model

Switch to a specific model.
切换到指定模型。

```json
{"type": "set_model", "provider": "anthropic", "modelId": "claude-sonnet-4-20250514"}
```

Response contains the full [Model](#model) object:
响应中包含完整的 [Model](#model) 对象：
```json
{
  "type": "response",
  "command": "set_model",
  "success": true,
  "data": {...}
}
```

#### cycle_model

Cycle to the next available model. Returns `null` data if only one model available.
循环切换到下一个可用模型。如果只有一个可用模型，则返回 `null` 数据。

```json
{"type": "cycle_model"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "cycle_model",
  "success": true,
  "data": {
    "model": {...},
    "thinkingLevel": "medium",
    "isScoped": false
  }
}
```

The `model` field is a full [Model](#model) object.
`model` 字段是完整的 [Model](#model) 对象。

#### get_available_models

List all configured models.
列出所有已配置的模型。

```json
{"type": "get_available_models"}
```

Response contains an array of full [Model](#model) objects:
响应中包含由完整 [Model](#model) 对象组成的数组：
```json
{
  "type": "response",
  "command": "get_available_models",
  "success": true,
  "data": {
    "models": [...]
  }
}
```

### Thinking 思考

#### set_thinking_level

Set the reasoning/thinking level for models that support it.
为支持该能力的模型设置推理/思考等级。

```json
{"type": "set_thinking_level", "level": "high"}
```

Levels: `"off"`, `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`
可选等级：`"off"`、`"minimal"`、`"low"`、`"medium"`、`"high"`、`"xhigh"`、`"max"`

`"xhigh"` and `"max"` are exposed only when supported by the selected model. Some models, including GPT-5.6, expose both.
只有当所选模型支持时，才会暴露 `"xhigh"` 和 `"max"`。部分模型（包括 GPT-5.6）两者都支持。

Response:
响应：
```json
{"type": "response", "command": "set_thinking_level", "success": true}
```

#### cycle_thinking_level

Cycle through available thinking levels. Returns `null` data if model doesn't support thinking.
在可用的思考等级之间循环切换。如果模型不支持思考，则返回 `null` 数据。

```json
{"type": "cycle_thinking_level"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "cycle_thinking_level",
  "success": true,
  "data": {"level": "high"}
}
```

#### get_available_thinking_levels

List the thinking levels supported by the current model. Returns `["off"]` for a model without reasoning support.
列出当前模型支持的思考等级。对于不支持推理的模型返回 `["off"]`。

```json
{"type": "get_available_thinking_levels"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "get_available_thinking_levels",
  "success": true,
  "data": {
    "levels": ["off", "minimal", "low", "medium", "high"]
  }
}
```

### Queue Modes 队列模式

#### set_steering_mode

Control how steering messages (from `steer`) are delivered.
控制引导消息（来自 `steer`）的投递方式。

```json
{"type": "set_steering_mode", "mode": "one-at-a-time"}
```

Modes:
模式：
- `"all"`: Deliver all steering messages after the current assistant turn finishes executing its tool calls
  `"all"`：在当前 assistant 轮次执行完其工具调用后，投递全部引导消息
- `"one-at-a-time"`: Deliver one steering message per completed assistant turn (default)
  `"one-at-a-time"`：每完成一个 assistant 轮次投递一条引导消息（默认）

Response:
响应：
```json
{"type": "response", "command": "set_steering_mode", "success": true}
```

#### set_follow_up_mode

Control how follow-up messages (from `follow_up`) are delivered.
控制后续消息（来自 `follow_up`）的投递方式。

```json
{"type": "set_follow_up_mode", "mode": "one-at-a-time"}
```

Modes:
模式：
- `"all"`: Deliver all follow-up messages when agent finishes
  `"all"`：在 agent 结束时投递全部后续消息
- `"one-at-a-time"`: Deliver one follow-up message per agent completion (default)
  `"one-at-a-time"`：agent 每完成一次投递一条后续消息（默认）

Response:
响应：
```json
{"type": "response", "command": "set_follow_up_mode", "success": true}
```

### Compaction 上下文压缩

#### compact

Manually compact conversation context to reduce token usage.
手动压缩对话上下文以减少 token 用量。

```json
{"type": "compact"}
```

With custom instructions:
使用自定义指令时：
```json
{"type": "compact", "customInstructions": "Focus on code changes"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "compact",
  "success": true,
  "data": {
    "summary": "Summary of conversation...",
    "firstKeptEntryId": "abc123",
    "tokensBefore": 150000,
    "estimatedTokensAfter": 32000,
    "usage": {
      "input": 32000,
      "output": 1200,
      "cacheRead": 0,
      "cacheWrite": 0,
      "totalTokens": 33200,
      "cost": {"input": 0.01, "output": 0.02, "cacheRead": 0, "cacheWrite": 0, "total": 0.03}
    },
    "details": {}
  }
}
```

`estimatedTokensAfter` is a heuristic estimate over the rebuilt message context immediately after compaction, not a provider-exact token count. `usage` reports the LLM call or calls that generated the summary and may be omitted by custom compaction handlers.
`estimatedTokensAfter` 是对压缩后立即重建的消息上下文所做的启发式估算，并非提供方（provider）精确的 token 计数。`usage` 报告的是生成摘要的那一次或多次 LLM 调用，自定义压缩处理器可能会省略该字段。

#### set_auto_compaction

Enable or disable automatic compaction when context is nearly full.
启用或禁用上下文接近占满时的自动压缩。

```json
{"type": "set_auto_compaction", "enabled": true}
```

Response:
响应：
```json
{"type": "response", "command": "set_auto_compaction", "success": true}
```

### Retry 重试

#### set_auto_retry

Enable or disable automatic retry on transient errors (overloaded, rate limit, 5xx).
启用或禁用瞬时错误（过载、限流、5xx）时的自动重试。

```json
{"type": "set_auto_retry", "enabled": true}
```

Response:
响应：
```json
{"type": "response", "command": "set_auto_retry", "success": true}
```

#### abort_retry

Abort an in-progress retry (cancel the delay and stop retrying).
中止进行中的重试（取消等待延迟并停止重试）。

```json
{"type": "abort_retry"}
```

Response:
响应：
```json
{"type": "response", "command": "abort_retry", "success": true}
```

### Bash

#### bash

Execute a shell command and add output to conversation context. Output streams as `bash_execution_update` events while the command runs; the response contains the final result.
执行一条 shell 命令并将其输出加入对话上下文。命令运行期间输出会以 `bash_execution_update` 事件流式发出；响应中包含最终结果。

```json
{"id": "req-1", "type": "bash", "command": "ls -la"}
```

Include an `id` to associate streamed `bash_execution_update` events with this command.
提供 `id` 以便将流式的 `bash_execution_update` 事件与本命令关联起来。

Response:
响应：
```json
{
  "id": "req-1",
  "type": "response",
  "command": "bash",
  "success": true,
  "data": {
    "output": "total 48\ndrwxr-xr-x ...",
    "exitCode": 0,
    "cancelled": false,
    "truncated": false
  }
}
```

If output was truncated, includes `fullOutputPath`:
如果输出被截断，则包含 `fullOutputPath`：
```json
{
  "type": "response",
  "command": "bash",
  "success": true,
  "data": {
    "output": "truncated output...",
    "exitCode": 0,
    "cancelled": false,
    "truncated": true,
    "fullOutputPath": "/tmp/pi-bash-abc123.log"
  }
}
```

**How bash results reach the LLM:**
**bash 结果如何进入 LLM：**

The `bash` command executes immediately and returns a `BashResult`. Internally, a `BashExecutionMessage` is created and stored in the agent's message state.
`bash` 命令会立即执行并返回一个 `BashResult`。在内部，系统会创建一个 `BashExecutionMessage` 并存入 agent 的消息状态中。

When the next `prompt` command is sent, all messages (including `BashExecutionMessage`) are transformed before being sent to the LLM. The `BashExecutionMessage` is converted to a `UserMessage` with this format:
当下一个 `prompt` 命令发送时，所有消息（包括 `BashExecutionMessage`）会先经过转换再发送给 LLM。`BashExecutionMessage` 会被转换成如下格式的 `UserMessage`：

````
Ran `ls -la`
```
total 48
drwxr-xr-x ...
```
````

This means:
这意味着：
1. Bash output is included in the LLM context on the **next prompt**, not immediately
   bash 输出会在**下一次 prompt** 时才被纳入 LLM 上下文，而不是立即纳入
2. Multiple bash commands can be executed before a prompt; all outputs will be included
   可以在一次 prompt 之前执行多条 bash 命令；所有输出都会被纳入

#### abort_bash

Abort a running bash command.
中止正在运行的 bash 命令。

```json
{"type": "abort_bash"}
```

Response:
响应：
```json
{"type": "response", "command": "abort_bash", "success": true}
```

### Session 会话

#### get_session_stats

Get token usage, cost statistics, and current context window usage.
获取 token 用量、费用统计以及当前上下文窗口（context window）使用情况。

```json
{"type": "get_session_stats"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "get_session_stats",
  "success": true,
  "data": {
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "abc123",
    "userMessages": 5,
    "assistantMessages": 5,
    "toolCalls": 12,
    "toolResults": 12,
    "totalMessages": 22,
    "tokens": {
      "input": 50000,
      "output": 10000,
      "cacheRead": 40000,
      "cacheWrite": 5000,
      "total": 105000
    },
    "cost": 0.45,
    "contextUsage": {
      "tokens": 60000,
      "contextWindow": 200000,
      "percent": 30
    }
  }
}
```

`tokens` and `cost` include assistant messages, usage reported by tools, and compaction/branch-summary generation across the full session. `contextUsage` contains the actual current context-window estimate used for compaction and footer display.
`tokens` 和 `cost` 涵盖整个会话中的 assistant 消息、工具上报的用量，以及压缩/分支摘要（branch-summary）生成的开销。`contextUsage` 包含用于压缩判断和底栏展示的当前实际上下文窗口估算值。

`contextUsage` is omitted when no model or context window is available. `contextUsage.tokens` and `contextUsage.percent` are `null` immediately after compaction until a fresh post-compaction assistant response provides valid usage data.
当没有可用模型或上下文窗口信息时，`contextUsage` 会被省略。压缩刚完成后，`contextUsage.tokens` 和 `contextUsage.percent` 为 `null`，直到压缩后新的 assistant 响应提供了有效的用量数据。

#### export_html

Export session to an HTML file.
将会话导出为 HTML 文件。

```json
{"type": "export_html"}
```

With custom path:
指定自定义路径时：
```json
{"type": "export_html", "outputPath": "/tmp/session.html"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "export_html",
  "success": true,
  "data": {"path": "/tmp/session.html"}
}
```

#### switch_session

Load a different session file. Can be cancelled by a `session_before_switch` extension event handler.
加载另一个会话文件。可被 `session_before_switch` 扩展事件处理器取消。

```json
{"type": "switch_session", "sessionPath": "/path/to/session.jsonl"}
```

Response:
响应：
```json
{"type": "response", "command": "switch_session", "success": true, "data": {"cancelled": false}}
```

If an extension cancelled the switch:
如果扩展取消了本次切换：
```json
{"type": "response", "command": "switch_session", "success": true, "data": {"cancelled": true}}
```

#### fork

Create a new fork from a previous user message on the active branch. Can be cancelled by a `session_before_fork` extension event handler. Returns the text of the message being forked from.
从当前活动分支上的某条历史用户消息创建新的分叉（fork）。可被 `session_before_fork` 扩展事件处理器取消。返回被分叉那条消息的文本。

```json
{"type": "fork", "entryId": "abc123"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "fork",
  "success": true,
  "data": {"text": "The original prompt text...", "cancelled": false}
}
```

If an extension cancelled the fork:
如果扩展取消了本次分叉：
```json
{
  "type": "response",
  "command": "fork",
  "success": true,
  "data": {"text": "The original prompt text...", "cancelled": true}
}
```

#### clone

Duplicate the current active branch into a new session at the current position. Can be cancelled by a `session_before_fork` extension event handler.
在当前位置将活动分支复制为一个新会话。可被 `session_before_fork` 扩展事件处理器取消。

```json
{"type": "clone"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "clone",
  "success": true,
  "data": {"cancelled": false}
}
```

If an extension cancelled the clone:
如果扩展取消了本次克隆：
```json
{
  "type": "response",
  "command": "clone",
  "success": true,
  "data": {"cancelled": true}
}
```

#### get_fork_messages

Get user messages available for forking.
获取可用于分叉的用户消息列表。

```json
{"type": "get_fork_messages"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "get_fork_messages",
  "success": true,
  "data": {
    "messages": [
      {"entryId": "abc123", "text": "First prompt..."},
      {"entryId": "def456", "text": "Second prompt..."}
    ]
  }
}
```

#### get_entries

Get all session entries in append order (excluding the session header). The session is an append-only tree of entries with stable ids, so an entry id works as a durable cursor: pass the last entry id you have seen as `since` to get only entries strictly after it, even across client restarts. Unlike `get_messages`, this includes pre-compaction history and abandoned branches.
按追加顺序获取所有会话条目（entry），不含会话头部。会话是一棵仅追加（append-only）的条目树，条目具有稳定的 id，因此条目 id 可作为持久游标：把你已见过的最后一个条目 id 作为 `since` 传入，即可只获取严格排在其后的条目，即使客户端重启也依然有效。与 `get_messages` 不同，这里会包含压缩前的历史记录以及已废弃的分支。

```json
{"type": "get_entries"}
```

With a cursor:
使用游标时：
```json
{"type": "get_entries", "since": "abc123"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "get_entries",
  "success": true,
  "data": {
    "entries": [
      {"type": "message", "id": "def456", "parentId": "abc123", "timestamp": "...", "message": {"role": "user", "...": "..."}}
    ],
    "leafId": "def456"
  }
}
```

`leafId` is the id of the current leaf entry (`null` for an empty session), so a client can tell in one round trip whether the active branch moved. If `since` does not match any entry id, the response is `success: false`.
`leafId` 是当前叶子条目的 id（空会话时为 `null`），因此客户端可以在一次往返中判断活动分支是否发生了移动。如果 `since` 未匹配到任何条目 id，响应将返回 `success: false`。

#### get_tree

Get the session as a tree of entries. Each node is `{entry, children, label?, labelTimestamp?}`. A well-formed session has a single root; orphaned entries (broken parent chain) also appear as roots.
以条目树的形式获取会话。每个节点形如 `{entry, children, label?, labelTimestamp?}`。结构良好的会话只有一个根节点；孤立条目（父链断裂）也会作为根节点出现。

```json
{"type": "get_tree"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "get_tree",
  "success": true,
  "data": {
    "tree": [
      {
        "entry": {"type": "message", "id": "abc123", "parentId": null, "...": "..."},
        "children": [
          {"entry": {"type": "message", "id": "def456", "parentId": "abc123", "...": "..."}, "children": []}
        ]
      }
    ],
    "leafId": "def456"
  }
}
```

#### get_last_assistant_text

Get the text content of the last assistant message.
获取最后一条 assistant 消息的文本内容。

```json
{"type": "get_last_assistant_text"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "get_last_assistant_text",
  "success": true,
  "data": {"text": "The assistant's response..."}
}
```

Returns `{"text": null}` if no assistant messages exist.
如果不存在任何 assistant 消息，则返回 `{"text": null}`。

#### set_session_name

Set a display name for the current session. The name appears in session listings and helps identify sessions.
为当前会话设置显示名称。该名称会出现在会话列表中，有助于识别会话。

```json
{"type": "set_session_name", "name": "my-feature-work"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "set_session_name",
  "success": true
}
```

The current session name is available via `get_state` in the `sessionName` field. To set the initial name when starting RPC mode, pass `--name <name>` or `-n <name>` to the `pi --mode rpc` process.
当前会话名称可通过 `get_state` 的 `sessionName` 字段获取。若要在启动 RPC 模式时设置初始名称，请在 `pi --mode rpc` 进程中传入 `--name <name>` 或 `-n <name>`。

### Commands 命令列表

#### get_commands

Get available commands (extension commands, prompt templates, and skills). These can be invoked via the `prompt` command by prefixing with `/`.
获取可用命令（扩展命令、提示模板和技能）。这些命令可以通过 `prompt` 命令并加上 `/` 前缀来调用。

```json
{"type": "get_commands"}
```

Response:
响应：
```json
{
  "type": "response",
  "command": "get_commands",
  "success": true,
  "data": {
    "commands": [
      {"name": "session-name", "description": "Set or clear session name", "source": "extension", "path": "/home/user/.pi/agent/extensions/session.ts"},
      {"name": "fix-tests", "description": "Fix failing tests", "source": "prompt", "location": "project", "path": "/home/user/myproject/.pi/agent/prompts/fix-tests.md"},
      {"name": "skill:brave-search", "description": "Web search via Brave API", "source": "skill", "location": "user", "path": "/home/user/.pi/agent/skills/brave-search/SKILL.md"}
    ]
  }
}
```

Each command has:
每条命令包含：
- `name`: Command name (invoke with `/name`)
  `name`：命令名称（使用 `/name` 调用）
- `description`: Human-readable description (optional for extension commands)
  `description`：便于阅读的描述（对扩展命令为可选）
- `source`: What kind of command:
  `source`：命令的种类：
  - `"extension"`: Registered via `pi.registerCommand()` in an extension
    `"extension"`：在扩展中通过 `pi.registerCommand()` 注册
  - `"prompt"`: Loaded from a prompt template `.md` file
    `"prompt"`：从提示模板 `.md` 文件加载
  - `"skill"`: Loaded from a skill directory (name is prefixed with `skill:`)
    `"skill"`：从技能目录加载（名称带 `skill:` 前缀）
- `location`: Where it was loaded from (optional, not present for extensions):
  `location`：加载来源位置（可选，扩展命令不包含此字段）：
  - `"user"`: User-level (`~/.pi/agent/`)
    `"user"`：用户级（`~/.pi/agent/`）
  - `"project"`: Project-level (`./.pi/agent/`)
    `"project"`：项目级（`./.pi/agent/`）
  - `"path"`: Explicit path via CLI or settings
    `"path"`：通过命令行或设置显式指定的路径
- `path`: Absolute file path to the command source (optional)
  `path`：命令源文件的绝对路径（可选）

**Note**: Built-in TUI commands (`/settings`, `/hotkeys`, etc.) are not included. They are handled only in interactive mode and would not execute if sent via `prompt`.
**注意**：内置的 TUI 命令（`/settings`、`/hotkeys` 等）不包含在内。它们只在交互模式下处理，通过 `prompt` 发送不会执行。

## Events 事件

Events are streamed to stdout as JSON lines during agent operation. Events do not generally include an `id` field; `bash_execution_update` includes the `id` of its originating `bash` command when one was provided.
在 agent 运行期间，事件会以 JSON 行的形式流式输出到 stdout。事件通常不包含 `id` 字段；当来源 `bash` 命令提供了 `id` 时，`bash_execution_update` 会带上该 `id`。

### Event Types 事件类型

| Event 事件 | Description 说明 |
|-------|-------------|
| `agent_start` | Agent begins processing<br>agent 开始处理 |
| `agent_end` | One low-level agent run completes (may still be followed by retry, compaction, or queued continuations)<br>一次底层 agent 运行完成（其后仍可能有重试、压缩或队列中的续跑） |
| `agent_settled` | Agent run is fully settled; no automatic retry, compaction retry, or queued continuation remains<br>agent 运行已完全稳定；不再有自动重试、压缩重试或队列中的续跑 |
| `turn_start` | New turn begins<br>新一轮次开始 |
| `turn_end` | Turn completes (includes assistant message and tool results)<br>轮次完成（包含 assistant 消息和工具结果） |
| `message_start` | Message begins<br>消息开始 |
| `message_update` | Streaming update (text/thinking/toolcall deltas)<br>流式更新（text/thinking/toolcall 增量） |
| `message_end` | Message completes<br>消息完成 |
| `bash_execution_update` | Direct RPC bash command output chunk<br>直接 RPC bash 命令的输出分片 |
| `tool_execution_start` | Tool begins execution<br>工具开始执行 |
| `tool_execution_update` | Tool execution progress (streaming output)<br>工具执行进度（流式输出） |
| `tool_execution_end` | Tool completes<br>工具执行完成 |
| `queue_update` | Pending steering/follow-up queue changed<br>待处理的引导/后续消息队列发生变化 |
| `compaction_start` | Compaction begins<br>压缩开始 |
| `compaction_end` | Compaction completes<br>压缩完成 |
| `auto_retry_start` | Auto-retry begins (after transient error)<br>自动重试开始（发生瞬时错误之后） |
| `auto_retry_end` | Auto-retry completes (success or final failure)<br>自动重试结束（成功或最终失败） |
| `summarization_retry_scheduled` | Retry scheduled for a transient compaction or branch-summary summarization error<br>针对压缩或分支摘要中的瞬时摘要错误安排了重试 |
| `summarization_retry_attempt_start` | Retried summarization request starts<br>重试的摘要请求开始 |
| `summarization_retry_finished` | Summarization retry loop completes<br>摘要重试循环结束 |
| `extension_error` | Extension threw an error<br>扩展抛出了错误 |

### agent_start

Emitted when the agent begins processing a prompt.
当 agent 开始处理一个提示时发出。

```json
{"type": "agent_start"}
```

### agent_end

Emitted when one low-level agent run completes. Contains all messages generated during this run. If `willRetry` is true, an automatic retry will follow.
当一次底层 agent 运行完成时发出。包含本次运行期间产生的所有消息。如果 `willRetry` 为 true，随后会进行一次自动重试。

```json
{
  "type": "agent_end",
  "messages": [...],
  "willRetry": false
}
```

### agent_settled

Emitted after the full session-level run settles. At this point Pi will not continue automatically through retry, compaction retry, or queued follow-up messages.
在整个会话级运行稳定之后发出。此时 Pi 不会再因重试、压缩重试或队列中的后续消息而自动继续执行。

```json
{"type": "agent_settled"}
```

### turn_start / turn_end

A turn consists of one assistant response plus any resulting tool calls and results.
一个轮次（turn）由一次 assistant 响应以及由此产生的所有工具调用和结果组成。

```json
{"type": "turn_start"}
```

```json
{
  "type": "turn_end",
  "message": {...},
  "toolResults": [...]
}
```

### message_start / message_end

Emitted when a message begins and completes. The `message` field contains an `AgentMessage`.
在消息开始和完成时发出。`message` 字段包含一个 `AgentMessage`。

```json
{"type": "message_start", "message": {...}}
{"type": "message_end", "message": {...}}
```

### message_update (Streaming) message_update（流式）

Emitted during streaming of assistant messages. Contains both the partial message and a streaming delta event.
在 assistant 消息流式输出期间发出。同时包含部分消息（partial message）和一个流式增量（delta）事件。

```json
{
  "type": "message_update",
  "message": {...},
  "assistantMessageEvent": {
    "type": "text_delta",
    "contentIndex": 0,
    "delta": "Hello ",
    "partial": {...}
  }
}
```

The `assistantMessageEvent` field contains one of these delta types:
`assistantMessageEvent` 字段包含以下增量类型之一：

| Type 类型 | Description 说明 |
|------|-------------|
| `start` | Message generation started<br>消息生成开始 |
| `text_start` | Text content block started<br>文本内容块开始 |
| `text_delta` | Text content chunk<br>文本内容分片 |
| `text_end` | Text content block ended<br>文本内容块结束 |
| `thinking_start` | Thinking block started<br>思考块开始 |
| `thinking_delta` | Thinking content chunk<br>思考内容分片 |
| `thinking_end` | Thinking block ended<br>思考块结束 |
| `toolcall_start` | Tool call started<br>工具调用开始 |
| `toolcall_delta` | Tool call arguments chunk<br>工具调用参数分片 |
| `toolcall_end` | Tool call ended (includes full `toolCall` object)<br>工具调用结束（包含完整的 `toolCall` 对象） |
| `done` | Message complete (reason: `"stop"`, `"length"`, `"toolUse"`)<br>消息完成（原因：`"stop"`、`"length"`、`"toolUse"`） |
| `error` | Error occurred (reason: `"aborted"`, `"error"`)<br>发生错误（原因：`"aborted"`、`"error"`） |

Example streaming a text response:
流式输出文本响应的示例：
```json
{"type":"message_update","message":{...},"assistantMessageEvent":{"type":"text_start","contentIndex":0,"partial":{...}}}
{"type":"message_update","message":{...},"assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Hello","partial":{...}}}
{"type":"message_update","message":{...},"assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":" world","partial":{...}}}
{"type":"message_update","message":{...},"assistantMessageEvent":{"type":"text_end","contentIndex":0,"content":"Hello world","partial":{...}}}
```

### bash_execution_update

Emitted once for each output chunk from a direct `bash` command. `id` matches the command's `id`, allowing clients to associate output with the correct command.
对于直接 `bash` 命令的每个输出分片各发出一次。`id` 与该命令的 `id` 相同，便于客户端将输出关联到正确的命令。

Events stream all output while the command runs, even if the final `bash` response's `output` is truncated.
命令运行期间，事件会流式输出全部内容，即使最终 `bash` 响应中的 `output` 被截断也是如此。

```json
{
  "type": "bash_execution_update",
  "id": "req-1",
  "delta": "total 48\n"
}
```

### tool_execution_start / tool_execution_update / tool_execution_end

Emitted when a tool begins, streams progress, and completes execution.
在工具开始执行、流式推送进度以及执行完成时发出。

```json
{
  "type": "tool_execution_start",
  "toolCallId": "call_abc123",
  "toolName": "bash",
  "args": {"command": "ls -la"}
}
```

During execution, `tool_execution_update` events stream partial results (e.g., bash output as it arrives):
执行期间，`tool_execution_update` 事件会流式推送部分结果（例如逐步到达的 bash 输出）：

```json
{
  "type": "tool_execution_update",
  "toolCallId": "call_abc123",
  "toolName": "bash",
  "args": {"command": "ls -la"},
  "partialResult": {
    "content": [{"type": "text", "text": "partial output so far..."}],
    "details": {"truncation": null, "fullOutputPath": null}
  }
}
```

When complete:
执行完成时：

```json
{
  "type": "tool_execution_end",
  "toolCallId": "call_abc123",
  "toolName": "bash",
  "result": {
    "content": [{"type": "text", "text": "total 48\n..."}],
    "details": {...}
  },
  "isError": false
}
```

Use `toolCallId` to correlate events. The `partialResult` in `tool_execution_update` contains the accumulated output so far (not just the delta), allowing clients to simply replace their display on each update.
使用 `toolCallId` 来关联事件。`tool_execution_update` 中的 `partialResult` 包含的是截至目前累积的完整输出（而不仅是增量），因此客户端只需在每次更新时整体替换显示内容即可。

### queue_update

Emitted whenever the pending steering or follow-up queue changes.
当待处理的引导队列或后续消息队列发生变化时发出。

```json
{
  "type": "queue_update",
  "steering": ["Focus on error handling"],
  "followUp": ["After that, summarize the result"]
}
```

### compaction_start / compaction_end

Emitted when compaction runs, whether manual or automatic.
当压缩执行时发出，无论是手动还是自动触发。

```json
{"type": "compaction_start", "reason": "threshold"}
```

The `reason` field is `"manual"`, `"threshold"`, or `"overflow"`.
`reason` 字段取值为 `"manual"`、`"threshold"` 或 `"overflow"`。

```json
{
  "type": "compaction_end",
  "reason": "threshold",
  "result": {
    "summary": "Summary of conversation...",
    "firstKeptEntryId": "abc123",
    "tokensBefore": 150000,
    "estimatedTokensAfter": 32000,
    "usage": {
      "input": 32000,
      "output": 1200,
      "cacheRead": 0,
      "cacheWrite": 0,
      "totalTokens": 33200,
      "cost": {"input": 0.01, "output": 0.02, "cacheRead": 0, "cacheWrite": 0, "total": 0.03}
    },
    "details": {}
  },
  "aborted": false,
  "willRetry": false
}
```

If `reason` was `"overflow"` and compaction succeeds, `willRetry` is `true` and the agent will automatically retry the prompt.
如果 `reason` 为 `"overflow"` 且压缩成功，则 `willRetry` 为 `true`，agent 会自动重试该提示。

If compaction was aborted, `result` is `null` and `aborted` is `true`.
如果压缩被中止，`result` 为 `null` 且 `aborted` 为 `true`。

If compaction failed (e.g., API quota exceeded), `result` is `null`, `aborted` is `false`, and `errorMessage` contains the error description.
如果压缩失败（例如 API 配额超限），`result` 为 `null`，`aborted` 为 `false`，且 `errorMessage` 包含错误描述。

### auto_retry_start / auto_retry_end

Emitted when automatic retry is triggered after a transient error (overloaded, rate limit, 5xx).
在发生瞬时错误（过载、限流、5xx）后触发自动重试时发出。

```json
{
  "type": "auto_retry_start",
  "attempt": 1,
  "maxAttempts": 3,
  "delayMs": 2000,
  "errorMessage": "529 {\"type\":\"error\",\"error\":{\"type\":\"overloaded_error\",\"message\":\"Overloaded\"}}"
}
```

```json
{
  "type": "auto_retry_end",
  "success": true,
  "attempt": 2
}
```

On final failure (max retries exceeded):
最终失败时（超过最大重试次数）：
```json
{
  "type": "auto_retry_end",
  "success": false,
  "attempt": 3,
  "finalError": "529 overloaded_error: Overloaded"
}
```

### summarization_retry_scheduled / summarization_retry_attempt_start / summarization_retry_finished

Emitted when compaction or branch-summary summarization retries after a transient provider error. These events use the same retry settings as automatic assistant-turn retries.
当压缩或分支摘要的摘要生成在遇到提供方瞬时错误后进行重试时发出。这些事件使用与 assistant 轮次自动重试相同的重试配置。

```json
{
  "type": "summarization_retry_scheduled",
  "attempt": 1,
  "maxAttempts": 3,
  "delayMs": 2000,
  "errorMessage": "terminated"
}
```

```json
{
  "type": "summarization_retry_attempt_start",
  "source": "compaction",
  "reason": "threshold"
}
```

For branch summaries, `source` is `"branchSummary"` and no `reason` is present.
对于分支摘要，`source` 为 `"branchSummary"`，且不包含 `reason` 字段。

```json
{
  "type": "summarization_retry_finished"
}
```

### extension_error

Emitted when an extension throws an error.
当扩展抛出错误时发出。

```json
{
  "type": "extension_error",
  "extensionPath": "/path/to/extension.ts",
  "event": "tool_call",
  "error": "Error message..."
}
```

## Extension UI Protocol 扩展 UI 协议

Extensions can request user interaction via `ctx.ui.select()`, `ctx.ui.confirm()`, etc. In RPC mode, these are translated into a request/response sub-protocol on top of the base command/event flow.
扩展可以通过 `ctx.ui.select()`、`ctx.ui.confirm()` 等发起用户交互请求。在 RPC 模式下，这些调用会被转换为构建在基础命令/事件流之上的请求/响应子协议。

There are two categories of extension UI methods:
扩展 UI 方法分为两类：

- **Dialog methods** (`select`, `confirm`, `input`, `editor`): emit an `extension_ui_request` on stdout and block until the client sends back an `extension_ui_response` on stdin with the matching `id`.
  **对话框方法（Dialog methods）**（`select`、`confirm`、`input`、`editor`）：在 stdout 上发出 `extension_ui_request`，并阻塞等待客户端通过 stdin 回送带有匹配 `id` 的 `extension_ui_response`。
- **Fire-and-forget methods** (`notify`, `setStatus`, `setWidget`, `setTitle`, `set_editor_text`): emit an `extension_ui_request` on stdout but do not expect a response. The client can display the information or ignore it.
  **单向通知方法（Fire-and-forget methods）**（`notify`、`setStatus`、`setWidget`、`setTitle`、`set_editor_text`）：在 stdout 上发出 `extension_ui_request`，但不期待响应。客户端可以展示这些信息，也可以忽略。

If a dialog method includes a `timeout` field, the agent-side will auto-resolve with a default value when the timeout expires. The client does not need to track timeouts.
如果某个对话框方法包含 `timeout` 字段，超时到期时 agent 侧会自动以默认值完成该请求。客户端无需自行跟踪超时。

Some `ExtensionUIContext` methods are not supported or degraded in RPC mode because they require direct TUI access:
部分 `ExtensionUIContext` 方法在 RPC 模式下不受支持或功能降级，因为它们需要直接访问 TUI：
- `custom()` returns `undefined`
  `custom()` 返回 `undefined`
- `setWorkingMessage()`, `setWorkingIndicator()`, `setFooter()`, `setHeader()`, `setEditorComponent()`, `setToolsExpanded()` are no-ops
  `setWorkingMessage()`、`setWorkingIndicator()`、`setFooter()`、`setHeader()`、`setEditorComponent()`、`setToolsExpanded()` 为空操作（no-op）
- `getEditorText()` returns `""`
  `getEditorText()` 返回 `""`
- `getToolsExpanded()` returns `false`
  `getToolsExpanded()` 返回 `false`
- `pasteToEditor()` delegates to `setEditorText()` (no paste/collapse handling)
  `pasteToEditor()` 委托给 `setEditorText()`（不做粘贴/折叠处理）
- `getAllThemes()` returns `[]`
  `getAllThemes()` 返回 `[]`
- `getTheme()` returns `undefined`
  `getTheme()` 返回 `undefined`
- `setTheme()` returns `{ success: false, error: "..." }`
  `setTheme()` 返回 `{ success: false, error: "..." }`

Note: `ctx.mode` is `"rpc"` and `ctx.hasUI` is `true` in RPC mode because the dialog and fire-and-forget methods are functional via the extension UI sub-protocol. Use `ctx.mode === "tui"` to guard TUI-specific features like `custom()` that require a real terminal.
注意：在 RPC 模式下 `ctx.mode` 为 `"rpc"`，且 `ctx.hasUI` 为 `true`，因为对话框方法和单向通知方法通过扩展 UI 子协议是可用的。请使用 `ctx.mode === "tui"` 来保护像 `custom()` 这类需要真实终端的 TUI 专属功能。

### Extension UI Requests (stdout) 扩展 UI 请求（stdout）

All requests have `type: "extension_ui_request"`, a unique `id`, and a `method` field.
所有请求都包含 `type: "extension_ui_request"`、唯一的 `id` 以及 `method` 字段。

#### select

Prompt the user to choose from a list. Dialog methods with a `timeout` field include the timeout in milliseconds; the agent auto-resolves with `undefined` if the client doesn't respond in time.
提示用户从列表中选择一项。带 `timeout` 字段的对话框方法以毫秒为单位给出超时时间；如果客户端未及时响应，agent 会自动以 `undefined` 完成该请求。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-1",
  "method": "select",
  "title": "Allow dangerous command?",
  "options": ["Allow", "Block"],
  "timeout": 10000
}
```

Expected response: `extension_ui_response` with `value` (the selected option string) or `cancelled: true`.
期望的响应：带 `value`（所选选项字符串）或 `cancelled: true` 的 `extension_ui_response`。

#### confirm

Prompt the user for yes/no confirmation.
提示用户进行是/否确认。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-2",
  "method": "confirm",
  "title": "Clear session?",
  "message": "All messages will be lost.",
  "timeout": 5000
}
```

Expected response: `extension_ui_response` with `confirmed: true/false` or `cancelled: true`.
期望的响应：带 `confirmed: true/false` 或 `cancelled: true` 的 `extension_ui_response`。

#### input

Prompt the user for free-form text.
提示用户输入自由格式文本。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-3",
  "method": "input",
  "title": "Enter a value",
  "placeholder": "type something..."
}
```

Expected response: `extension_ui_response` with `value` (the entered text) or `cancelled: true`.
期望的响应：带 `value`（用户输入的文本）或 `cancelled: true` 的 `extension_ui_response`。

#### editor

Open a multi-line text editor with optional prefilled content.
打开一个多行文本编辑器，可选带有预填内容。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-4",
  "method": "editor",
  "title": "Edit some text",
  "prefill": "Line 1\nLine 2\nLine 3"
}
```

Expected response: `extension_ui_response` with `value` (the edited text) or `cancelled: true`.
期望的响应：带 `value`（编辑后的文本）或 `cancelled: true` 的 `extension_ui_response`。

#### notify

Display a notification. Fire-and-forget, no response expected.
显示一条通知。属于单向通知，不期待响应。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-5",
  "method": "notify",
  "message": "Command blocked by user",
  "notifyType": "warning"
}
```

The `notifyType` field is `"info"`, `"warning"`, or `"error"`. Defaults to `"info"` if omitted.
`notifyType` 字段取值为 `"info"`、`"warning"` 或 `"error"`。省略时默认为 `"info"`。

#### setStatus

Set or clear a status entry in the footer/status bar. Fire-and-forget.
在底栏/状态栏中设置或清除一条状态项。属于单向通知。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-6",
  "method": "setStatus",
  "statusKey": "my-ext",
  "statusText": "Turn 3 running..."
}
```

Send `statusText: undefined` (or omit it) to clear the status entry for that key.
发送 `statusText: undefined`（或省略该字段）可清除对应 key 的状态项。

#### setWidget

Set or clear a widget (block of text lines) displayed above or below the editor. Fire-and-forget.
设置或清除显示在编辑器上方或下方的组件（widget，即一段文本行）。属于单向通知。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-7",
  "method": "setWidget",
  "widgetKey": "my-ext",
  "widgetLines": ["--- My Widget ---", "Line 1", "Line 2"],
  "widgetPlacement": "aboveEditor"
}
```

Send `widgetLines: undefined` (or omit it) to clear the widget. The `widgetPlacement` field is `"aboveEditor"` (default) or `"belowEditor"`. Only string arrays are supported in RPC mode; component factories are ignored.
发送 `widgetLines: undefined`（或省略该字段）可清除该组件。`widgetPlacement` 字段取值为 `"aboveEditor"`（默认）或 `"belowEditor"`。RPC 模式下仅支持字符串数组；组件工厂函数会被忽略。

#### setTitle

Set the terminal window/tab title. Fire-and-forget.
设置终端窗口/标签页标题。属于单向通知。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-8",
  "method": "setTitle",
  "title": "pi - my project"
}
```

#### set_editor_text

Set the text in the input editor. Fire-and-forget.
设置输入编辑器中的文本。属于单向通知。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-9",
  "method": "set_editor_text",
  "text": "prefilled text for the user"
}
```

### Extension UI Responses (stdin) 扩展 UI 响应（stdin）

Responses are sent for dialog methods only (`select`, `confirm`, `input`, `editor`). The `id` must match the request.
只有对话框方法（`select`、`confirm`、`input`、`editor`）需要发送响应。`id` 必须与请求一致。

#### Value response (select, input, editor) 值响应（select、input、editor）

```json
{"type": "extension_ui_response", "id": "uuid-1", "value": "Allow"}
```

#### Confirmation response (confirm) 确认响应（confirm）

```json
{"type": "extension_ui_response", "id": "uuid-2", "confirmed": true}
```

#### Cancellation response (any dialog) 取消响应（任意对话框）

Dismiss any dialog method. The extension receives `undefined` (for select/input/editor) or `false` (for confirm).
关闭任意对话框方法。扩展将收到 `undefined`（对应 select/input/editor）或 `false`（对应 confirm）。

```json
{"type": "extension_ui_response", "id": "uuid-3", "cancelled": true}
```

## Error Handling 错误处理

Failed commands return a response with `success: false`:
失败的命令会返回 `success: false` 的响应：

```json
{
  "type": "response",
  "command": "set_model",
  "success": false,
  "error": "Model not found: invalid/model"
}
```

Parse errors:
解析错误：

```json
{
  "type": "response",
  "command": "parse",
  "success": false,
  "error": "Failed to parse command: Unexpected token..."
}
```

## Types 类型

Source files:
源文件：
- [`packages/ai/src/types.ts`](../../ai/src/types.ts) - `Model`, `UserMessage`, `AssistantMessage`, `ToolResultMessage`
  定义 `Model`、`UserMessage`、`AssistantMessage`、`ToolResultMessage`
- [`packages/agent/src/types.ts`](../../agent/src/types.ts) - `AgentMessage`, `AgentEvent`
  定义 `AgentMessage`、`AgentEvent`
- [`src/core/messages.ts`](../src/core/messages.ts) - `BashExecutionMessage`
  定义 `BashExecutionMessage`
- [`src/modes/rpc/rpc-types.ts`](../src/modes/rpc/rpc-types.ts) - RPC command/response types, extension UI request/response types
  定义 RPC 命令/响应类型，以及扩展 UI 请求/响应类型

### Model

```json
{
  "id": "claude-sonnet-4-20250514",
  "name": "Claude Sonnet 4",
  "api": "anthropic-messages",
  "provider": "anthropic",
  "baseUrl": "https://api.anthropic.com",
  "reasoning": true,
  "input": ["text", "image"],
  "contextWindow": 200000,
  "maxTokens": 16384,
  "cost": {
    "input": 3.0,
    "output": 15.0,
    "cacheRead": 0.3,
    "cacheWrite": 3.75
  }
}
```

### UserMessage

```json
{
  "role": "user",
  "content": "Hello!",
  "timestamp": 1733234567890,
  "attachments": []
}
```

The `content` field can be a string or an array of `TextContent`/`ImageContent` blocks.
`content` 字段可以是字符串，也可以是由 `TextContent`/`ImageContent` 块组成的数组。

### AssistantMessage

```json
{
  "role": "assistant",
  "content": [
    {"type": "text", "text": "Hello! How can I help?"},
    {"type": "thinking", "thinking": "User is greeting me..."},
    {"type": "toolCall", "id": "call_123", "name": "bash", "arguments": {"command": "ls"}}
  ],
  "api": "anthropic-messages",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "usage": {
    "input": 100,
    "output": 50,
    "cacheRead": 0,
    "cacheWrite": 0,
    "cost": {"input": 0.0003, "output": 0.00075, "cacheRead": 0, "cacheWrite": 0, "total": 0.00105}
  },
  "stopReason": "stop",
  "timestamp": 1733234567890
}
```

Stop reasons: `"stop"`, `"length"`, `"toolUse"`, `"error"`, `"aborted"`
停止原因（stop reasons）：`"stop"`、`"length"`、`"toolUse"`、`"error"`、`"aborted"`

### ToolResultMessage

```json
{
  "role": "toolResult",
  "toolCallId": "call_123",
  "toolName": "bash",
  "content": [{"type": "text", "text": "total 48\ndrwxr-xr-x ..."}],
  "usage": {
    "input": 100,
    "output": 50,
    "cacheRead": 0,
    "cacheWrite": 0,
    "totalTokens": 150,
    "cost": {"input": 0.0003, "output": 0.00075, "cacheRead": 0, "cacheWrite": 0, "total": 0.00105}
  },
  "isError": false,
  "timestamp": 1733234567890
}
```

`usage` is optional and reports nested LLM work performed by the tool. When present, it contributes to session token and cost totals.
`usage` 是可选字段，用于上报工具内部嵌套执行的 LLM 工作量。若存在，它会计入会话的 token 与费用总计。

### BashExecutionMessage

Created by the `bash` RPC command (not by LLM tool calls):
由 `bash` RPC 命令创建（而非由 LLM 的工具调用创建）：

```json
{
  "role": "bashExecution",
  "command": "ls -la",
  "output": "total 48\ndrwxr-xr-x ...",
  "exitCode": 0,
  "cancelled": false,
  "truncated": false,
  "fullOutputPath": null,
  "timestamp": 1733234567890
}
```

### Attachment

```json
{
  "id": "img1",
  "type": "image",
  "fileName": "photo.jpg",
  "mimeType": "image/jpeg",
  "size": 102400,
  "content": "base64-encoded-data...",
  "extractedText": null,
  "preview": null
}
```

## Example: Basic Client (Python) 示例：基础客户端（Python）

```python
import subprocess
import json

proc = subprocess.Popen(
    ["pi", "--mode", "rpc", "--no-session"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    text=True
)

def send(cmd):
    proc.stdin.write(json.dumps(cmd) + "\n")
    proc.stdin.flush()

def read_events():
    for line in proc.stdout:
        yield json.loads(line)

# Send prompt
send({"type": "prompt", "message": "Hello!"})

# Process events
for event in read_events():
    if event.get("type") == "message_update":
        delta = event.get("assistantMessageEvent", {})
        if delta.get("type") == "text_delta":
            print(delta["delta"], end="", flush=True)
    
    if event.get("type") == "agent_end":
        print()
        break
```

## Example: Interactive Client (Node.js) 示例：交互式客户端（Node.js）

See [`test/rpc-example.ts`](../test/rpc-example.ts) for a complete interactive example, or [`src/modes/rpc/rpc-client.ts`](../src/modes/rpc/rpc-client.ts) for a typed client implementation.
完整的交互式示例参见 [`test/rpc-example.ts`](../test/rpc-example.ts)；带类型的客户端实现参见 [`src/modes/rpc/rpc-client.ts`](../src/modes/rpc/rpc-client.ts)。

For a complete example of handling the extension UI protocol, see [`examples/rpc-extension-ui.ts`](../examples/rpc-extension-ui.ts) which pairs with the [`examples/extensions/rpc-demo.ts`](../examples/extensions/rpc-demo.ts) extension.
关于处理扩展 UI 协议的完整示例，参见 [`examples/rpc-extension-ui.ts`](../examples/rpc-extension-ui.ts)，它与 [`examples/extensions/rpc-demo.ts`](../examples/extensions/rpc-demo.ts) 扩展配套使用。

```javascript
const { spawn } = require("child_process");
const { StringDecoder } = require("string_decoder");

const agent = spawn("pi", ["--mode", "rpc", "--no-session"]);

function attachJsonlReader(stream, onLine) {
    const decoder = new StringDecoder("utf8");
    let buffer = "";

    stream.on("data", (chunk) => {
        buffer += typeof chunk === "string" ? chunk : decoder.write(chunk);

        while (true) {
            const newlineIndex = buffer.indexOf("\n");
            if (newlineIndex === -1) break;

            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            onLine(line);
        }
    });

    stream.on("end", () => {
        buffer += decoder.end();
        if (buffer.length > 0) {
            onLine(buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer);
        }
    });
}

attachJsonlReader(agent.stdout, (line) => {
    const event = JSON.parse(line);

    if (event.type === "message_update") {
        const { assistantMessageEvent } = event;
        if (assistantMessageEvent.type === "text_delta") {
            process.stdout.write(assistantMessageEvent.delta);
        }
    }
});

// Send prompt
agent.stdin.write(JSON.stringify({ type: "prompt", message: "Hello" }) + "\n");

// Abort on Ctrl+C
process.on("SIGINT", () => {
    agent.stdin.write(JSON.stringify({ type: "abort" }) + "\n");
});
```
