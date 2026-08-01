> pi can help you use the SDK. Ask it to build an integration for your use case.
>
> pi 可以帮助你使用本 SDK。你可以让它为你的使用场景构建集成方案。

# SDK

The SDK provides programmatic access to pi's agent capabilities. Use it to embed pi in other applications, build custom interfaces, or integrate with automated workflows.

本 SDK 提供了对 pi 智能体（agent）能力的编程访问方式。你可以用它把 pi 嵌入到其他应用中、构建自定义界面，或与自动化工作流集成。

**Example use cases:**

**示例使用场景：**
- Build a custom UI (web, desktop, mobile)
  - 构建自定义界面（Web、桌面、移动端）
- Integrate agent capabilities into existing applications
  - 将智能体能力集成到现有应用中
- Create automated pipelines with agent reasoning
  - 创建带有智能体推理能力的自动化流水线
- Build custom tools that spawn sub-agents
  - 构建可派生子智能体（sub-agent）的自定义工具
- Test agent behavior programmatically
  - 以编程方式测试智能体行为

See [examples/sdk/](../examples/sdk/) for working examples from minimal to full control.

参见 [examples/sdk/](../examples/sdk/)，其中包含从最简用法到完全控制的可运行示例。

## Quick Start 快速开始

```typescript
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("What files are in the current directory?");
```

## Installation 安装

```bash
npm install @earendil-works/pi-coding-agent
```

The SDK is included in the main package. No separate installation needed.

本 SDK 已包含在主包中，无需单独安装。

## Core Concepts 核心概念

### createAgentSession()

The main factory function for a single `AgentSession`.

创建单个 `AgentSession` 的主要工厂函数。

`createAgentSession()` uses a `ResourceLoader` to supply extensions, skills, prompt templates, themes, and context files. If you do not provide one, it uses `DefaultResourceLoader` with standard discovery.

`createAgentSession()` 通过 `ResourceLoader` 来提供扩展（extension）、技能（skill）、提示词模板（prompt template）、主题和上下文文件。如果你没有提供，它会使用 `DefaultResourceLoader` 按标准发现规则加载。

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

// Minimal: defaults with DefaultResourceLoader
const { session } = await createAgentSession();

// Custom: override specific options
const { session } = await createAgentSession({
  model: myModel,
  tools: ["read", "bash"],
  sessionManager: SessionManager.inMemory(),
});
```

### AgentSession

The session manages agent lifecycle, message history, model state, compaction, and event streaming.

会话（session）负责管理智能体生命周期、消息历史、模型状态、上下文压缩（compaction）以及事件流。

```typescript
interface AgentSession {
  // Send a prompt and wait for completion
  prompt(text: string, options?: PromptOptions): Promise<void>;

  // Queue messages during streaming
  steer(text: string): Promise<void>;
  followUp(text: string): Promise<void>;

  // Subscribe to events (returns unsubscribe function)
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;

  // Session info
  sessionFile: string | undefined;
  sessionId: string;

  // Model control
  setModel(model: Model): Promise<void>;
  setThinkingLevel(level: ThinkingLevel): void;
  cycleModel(): Promise<ModelCycleResult | undefined>;
  cycleThinkingLevel(): ThinkingLevel | undefined;

  // State access
  agent: Agent;
  model: Model | undefined;
  thinkingLevel: ThinkingLevel;
  messages: AgentMessage[];
  isStreaming: boolean;

  // In-place tree navigation within the current session file
  navigateTree(targetId: string, options?: { summarize?: boolean; customInstructions?: string; replaceInstructions?: boolean; label?: string }): Promise<{ editorText?: string; cancelled: boolean }>;

  // Compaction
  compact(customInstructions?: string): Promise<CompactionResult>;
  abortCompaction(): void;

  // Abort current operation
  abort(): Promise<void>;

  // Cleanup
  dispose(): void;
}
```

Session replacement APIs such as new-session, resume, fork, and import live on `AgentSessionRuntime`, not on `AgentSession`.

诸如新建会话（new-session）、恢复（resume）、分叉（fork）和导入（import）等会话替换 API 位于 `AgentSessionRuntime` 上，而不在 `AgentSession` 上。

### createAgentSessionRuntime() and AgentSessionRuntime createAgentSessionRuntime() 与 AgentSessionRuntime

Use the runtime API when you need to replace the active session and rebuild cwd-bound runtime state.
This is the same layer used by the built-in interactive, print, and RPC modes.

当你需要替换当前活动会话并重建与工作目录（cwd）绑定的运行时状态时，请使用运行时（runtime）API。
内置的交互模式（interactive）、打印模式（print）和 RPC 模式使用的正是这一层。

`createAgentSessionRuntime()` takes a runtime factory plus the initial cwd/session target. The factory closes over process-global fixed inputs, recreates cwd-bound services for the effective cwd, resolves session options against those services, and returns a full runtime result.

`createAgentSessionRuntime()` 接收一个运行时工厂函数以及初始的 cwd/会话目标。该工厂函数会闭包捕获进程级的固定输入，为生效的 cwd 重新创建与之绑定的服务，基于这些服务解析会话选项，并返回完整的运行时结果。

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({
      services,
      sessionManager,
      sessionStartEvent,
    })),
    services,
    diagnostics: services.diagnostics,
  };
};

const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});
```

`AgentSessionRuntime` owns replacement of the active runtime across:

`AgentSessionRuntime` 负责在以下操作中替换活动运行时：

- `newSession()`
- `switchSession()`
- `fork()`
- clone flows via `fork(entryId, { position: "at" })`
  - 通过 `fork(entryId, { position: "at" })` 实现的克隆（clone）流程
- `importFromJsonl()`

Important behavior:

重要行为说明：

- `runtime.session` changes after those operations
  - 执行上述操作后 `runtime.session` 会发生变化
- event subscriptions are attached to a specific `AgentSession`, so re-subscribe after replacement
  - 事件订阅是绑定到特定 `AgentSession` 上的，因此替换之后需要重新订阅
- if you use extensions, call `runtime.session.bindExtensions(...)` again for the new session
  - 如果你使用了扩展，需要为新会话再次调用 `runtime.session.bindExtensions(...)`
- creation returns diagnostics on `runtime.diagnostics`
  - 创建过程产生的诊断信息（diagnostics）可通过 `runtime.diagnostics` 获取
- if runtime creation or replacement fails, the method throws and the caller decides how to handle it
  - 如果运行时创建或替换失败，方法会抛出异常，由调用方决定如何处理

```typescript
let session = runtime.session;
let unsubscribe = session.subscribe(() => {});

await runtime.newSession();

unsubscribe();
session = runtime.session;
unsubscribe = session.subscribe(() => {});
```

### Prompting and Message Queueing 发送提示词与消息排队

`PromptOptions` controls prompt expansion, queueing behavior while streaming, and prompt preflight notifications:

`PromptOptions` 控制提示词展开、流式输出期间的排队行为，以及提示词预检（preflight）通知：

```typescript
interface PromptOptions {
  expandPromptTemplates?: boolean;
  images?: ImageContent[];
  streamingBehavior?: "steer" | "followUp";
  source?: InputSource;
  preflightResult?: (success: boolean) => void;
}
```

`preflightResult` is called once per `prompt()` invocation:

`preflightResult` 在每次调用 `prompt()` 时会被调用一次：

- `true` when the prompt was accepted, queued, or handled immediately
  - `true` 表示提示词已被接受、已排队，或已被立即处理
- `false` when prompt preflight rejected before acceptance
  - `false` 表示提示词在被接受之前就被预检拒绝了

It fires before `prompt()` resolves. `prompt()` still resolves only after the full accepted run finishes, including retries. Failures after acceptance are reported through the normal event and message stream, not through `preflightResult(false)`.

它会在 `prompt()` 兑现（resolve）之前触发。`prompt()` 仍然只在整个被接受的运行流程（包括重试）完全结束后才会兑现。被接受之后发生的失败会通过常规的事件流和消息流上报，而不会通过 `preflightResult(false)` 通知。

The `prompt()` method handles prompt templates, extension commands, and message sending:

`prompt()` 方法负责处理提示词模板、扩展命令（extension command）以及消息发送：

```typescript
// Basic prompt (when not streaming)
await session.prompt("What files are here?");

// With images
await session.prompt("What's in this image?", {
  images: [{ type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } }]
});

// During streaming: must specify how to queue the message
await session.prompt("Stop and do this instead", { streamingBehavior: "steer" });
await session.prompt("After you're done, also check X", { streamingBehavior: "followUp" });
```

**Behavior:**

**行为说明：**
- **Extension commands** (e.g., `/mycommand`): Execute immediately, even during streaming. They manage their own LLM interaction via `pi.sendMessage()`.
  - **扩展命令**（例如 `/mycommand`）：立即执行，即使处于流式输出过程中也是如此。它们通过 `pi.sendMessage()` 自行管理与 LLM 的交互。
- **File-based prompt templates** (from `.md` files): Expanded to their content before sending or queueing.
  - **基于文件的提示词模板**（来自 `.md` 文件）：在发送或排队之前会被展开为其文件内容。
- **During streaming without `streamingBehavior`**: Throws an error. Use `steer()` or `followUp()` directly, or specify the option.
  - **流式输出期间未指定 `streamingBehavior`**：会抛出错误。请直接使用 `steer()` 或 `followUp()`，或显式指定该选项。
- **`preflightResult(true)`**: Means the prompt was accepted, queued, or handled immediately.
  - **`preflightResult(true)`**：表示提示词已被接受、已排队，或已被立即处理。
- **`preflightResult(false)`**: Means preflight rejected before acceptance.
  - **`preflightResult(false)`**：表示预检在接受之前就已拒绝该提示词。

For explicit queueing during streaming:

在流式输出期间进行显式排队：

```typescript
// Queue a steering message for delivery after the current assistant turn finishes its tool calls
await session.steer("New instruction");

// Wait for agent to finish (delivered only when agent stops)
await session.followUp("After you're done, also do this");
```

Both `steer()` and `followUp()` expand file-based prompt templates but error on extension commands (extension commands cannot be queued).

`steer()` 和 `followUp()` 都会展开基于文件的提示词模板，但遇到扩展命令时会报错（扩展命令无法排队）。

### Agent and AgentState Agent 与 AgentState

The `Agent` class (from `@earendil-works/pi-agent-core`) handles the core LLM interaction. Access it via `session.agent`.

`Agent` 类（来自 `@earendil-works/pi-agent-core`）负责处理与 LLM 的核心交互。可通过 `session.agent` 访问它。

```typescript
// Access current state
const state = session.agent.state;

// state.messages: AgentMessage[] - conversation history
// state.model: Model - current model
// state.thinkingLevel: ThinkingLevel - current thinking level
// state.systemPrompt: string - system prompt
// state.tools: AgentTool[] - available tools
// state.streamingMessage?: AgentMessage - current partial assistant message
// state.errorMessage?: string - latest assistant error

// Replace messages (useful for branching or restoration)
session.agent.state.messages = messages; // copies the top-level array

// Replace tools
session.agent.state.tools = tools; // copies the top-level array

// Wait for agent to finish processing
await session.agent.waitForIdle();
```

### Events 事件

Subscribe to events to receive streaming output and lifecycle notifications.

订阅事件即可接收流式输出和生命周期通知。

```typescript
session.subscribe((event) => {
  switch (event.type) {
    // Streaming text from assistant
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      if (event.assistantMessageEvent.type === "thinking_delta") {
        // Thinking output (if thinking enabled)
      }
      break;
    
    // Tool execution
    case "tool_execution_start":
      console.log(`Tool: ${event.toolName}`);
      break;
    case "tool_execution_update":
      // Streaming tool output
      break;
    case "tool_execution_end":
      console.log(`Result: ${event.isError ? "error" : "success"}`);
      break;
    
    // Message lifecycle
    case "message_start":
      // New message starting
      break;
    case "message_end":
      // Message complete
      break;
    
    // Agent lifecycle
    case "agent_start":
      // Agent started processing prompt
      break;
    case "agent_end":
      // Agent finished (event.messages contains new messages)
      break;
    
    // Turn lifecycle (one LLM response + tool calls)
    case "turn_start":
      break;
    case "turn_end":
      // event.message: assistant response
      // event.toolResults: tool results from this turn
      break;
    
    // Session events (queue, compaction, retry)
    case "queue_update":
      console.log(event.steering, event.followUp);
      break;
    case "compaction_start":
    case "compaction_end":
    case "auto_retry_start":
    case "auto_retry_end":
    case "summarization_retry_scheduled":
    case "summarization_retry_attempt_start":
    case "summarization_retry_finished":
      break;
  }
});
```

## Options Reference 选项参考

### Directories 目录

```typescript
const { session } = await createAgentSession({
  // Working directory for DefaultResourceLoader discovery
  cwd: process.cwd(), // default
  
  // Global config directory
  agentDir: "~/.pi/agent", // default (expands ~)
});
```

`cwd` is used by `DefaultResourceLoader` for:

`DefaultResourceLoader` 使用 `cwd` 来定位：
- Project extensions (`.pi/extensions/`)
  - 项目级扩展（`.pi/extensions/`）
- Project skills:
  - 项目级技能：
  - `.pi/skills/`
  - `.agents/skills/` in `cwd` and ancestor directories (up to git repo root, or filesystem root when not in a repo)
    - `cwd` 及其祖先目录中的 `.agents/skills/`（向上查找至 git 仓库根目录；若不在仓库中，则查找至文件系统根目录）
- Project prompts (`.pi/prompts/`)
  - 项目级提示词（`.pi/prompts/`）
- Context files (`AGENTS.md` walking up from cwd)
  - 上下文文件（从 cwd 向上逐层查找 `AGENTS.md`）
- Session directory naming
  - 会话目录命名

`agentDir` is used by `DefaultResourceLoader` for:

`DefaultResourceLoader` 使用 `agentDir` 来定位：
- Global extensions (`extensions/`)
  - 全局扩展（`extensions/`）
- Global skills:
  - 全局技能：
  - `skills/` under `agentDir` (for example `~/.pi/agent/skills/`)
    - `agentDir` 下的 `skills/`（例如 `~/.pi/agent/skills/`）
  - `~/.agents/skills/`
- Global prompts (`prompts/`)
  - 全局提示词（`prompts/`）
- Global context file (`AGENTS.md`)
  - 全局上下文文件（`AGENTS.md`）
- Settings (`settings.json`)
  - 设置（`settings.json`）
- Custom models (`models.json`)
  - 自定义模型（`models.json`）
- Credentials (`auth.json`)
  - 凭据（`auth.json`）
- Sessions (`sessions/`)
  - 会话（`sessions/`）

When you pass a custom `ResourceLoader`, `cwd` and `agentDir` no longer control resource discovery. They still influence session naming and tool path resolution.

当你传入自定义的 `ResourceLoader` 时，`cwd` 和 `agentDir` 将不再控制资源发现，但它们仍会影响会话命名和工具路径解析。

### Model 模型

```typescript
import { getModel } from "@earendil-works/pi-ai";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();

// Find specific built-in model (doesn't check if API key exists)
const opus = getModel("anthropic", "claude-opus-4-5");
if (!opus) throw new Error("Model not found");

// Find any model by provider/id, including custom models from models.json
// (doesn't check if API key exists)
const customModel = modelRuntime.getModel("my-provider", "my-model");

// Get only models that have valid authentication configured
const available = await modelRuntime.getAvailable();

const { session } = await createAgentSession({
  model: opus,
  thinkingLevel: "medium", // off, minimal, low, medium, high, xhigh, max
  
  // Models for cycling (Ctrl+P in interactive mode)
  scopedModels: [
    { model: opus, thinkingLevel: "high" },
    { model: haiku, thinkingLevel: "off" },
  ],
  
  modelRuntime,
});
```

If no model is provided:

如果没有提供模型：
1. Tries to restore from session (if continuing)
   1. 尝试从会话中恢复（如果是继续已有会话）
2. Uses default from settings
   2. 使用设置中的默认模型
3. Falls back to first available model
   3. 回退到第一个可用的模型

To match CLI model parsing, use the exported resolver helpers:

如需与 CLI 的模型解析行为保持一致，请使用导出的解析辅助函数：

```typescript
import {
  resolveCliModel,
  resolveModelScopeWithDiagnostics,
} from "@earendil-works/pi-coding-agent";

const cliModel = resolveCliModel({
  cliModel: "anthropic/claude-opus-4-5:high",
  modelRuntime,
});
if (cliModel.error) throw new Error(cliModel.error);
if (cliModel.warning) console.warn(cliModel.warning);

const { scopedModels, diagnostics } = await resolveModelScopeWithDiagnostics(
  ["anthropic/*:high", "gpt-5"],
  modelRuntime,
);
for (const diagnostic of diagnostics) {
  console.warn(diagnostic.message);
}
```

`resolveCliModel()` uses all registered models so `--api-key` style first-time setup can resolve a model before stored auth exists. `resolveModelScopeWithDiagnostics()` matches `--models` and `enabledModels` semantics while returning warnings instead of printing them.

`resolveCliModel()` 会使用全部已注册的模型，因此在尚未存储任何认证信息时，`--api-key` 这类首次配置流程也能解析出模型。`resolveModelScopeWithDiagnostics()` 与 `--models` 和 `enabledModels` 的语义一致，但它会返回警告信息而不是直接打印。

> See [examples/sdk/02-custom-model.ts](../examples/sdk/02-custom-model.ts)
>
> 参见 [examples/sdk/02-custom-model.ts](../examples/sdk/02-custom-model.ts)

### API Keys and OAuth API 密钥与 OAuth

Authentication resolution priority (handled by `ModelRuntime`):

认证解析优先级（由 `ModelRuntime` 处理）：
1. Runtime overrides (via `setRuntimeApiKey`, not persisted)
   1. 运行时覆盖（通过 `setRuntimeApiKey` 设置，不会持久化）
2. Stored credentials in `auth.json` (API keys or OAuth tokens)
   2. 存储在 `auth.json` 中的凭据（API 密钥或 OAuth 令牌）
3. Environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.)
   3. 环境变量（`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等）
4. Fallback resolver (for custom provider keys from `models.json`)
   4. 回退解析器（用于处理来自 `models.json` 的自定义提供商密钥）

```typescript
import { InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { createAgentSession, ModelRuntime } from "@earendil-works/pi-coding-agent";

// Default: uses ~/.pi/agent/auth.json and ~/.pi/agent/models.json
const modelRuntime = await ModelRuntime.create();

// Provider-owned auth methods and current status
for (const provider of modelRuntime.getProviders()) {
  const status = await modelRuntime.checkAuth(provider.id);
  console.log(provider.name, provider.auth, status);
}

// Runtime API key override (not persisted to disk)
modelRuntime.setRuntimeApiKey("anthropic", "sk-my-temp-key");

// Custom credential and model locations
const customRuntime = await ModelRuntime.create({
  authPath: "/my/app/auth.json",
  modelsPath: "/my/app/models.json",
});

// Or inject any pi-ai CredentialStore
const credentials = new InMemoryCredentialStore();
const inMemoryRuntime = await ModelRuntime.create({ credentials });

const { session } = await createAgentSession({
  modelRuntime: customRuntime,
});
```

> See [examples/sdk/09-api-keys-and-oauth.ts](../examples/sdk/09-api-keys-and-oauth.ts)
>
> 参见 [examples/sdk/09-api-keys-and-oauth.ts](../examples/sdk/09-api-keys-and-oauth.ts)

### System Prompt 系统提示词

Use a `ResourceLoader` to override the system prompt:

使用 `ResourceLoader` 来覆盖系统提示词：

```typescript
import { createAgentSession, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  systemPromptOverride: () => "You are a helpful assistant.",
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> See [examples/sdk/03-custom-prompt.ts](../examples/sdk/03-custom-prompt.ts)
>
> 参见 [examples/sdk/03-custom-prompt.ts](../examples/sdk/03-custom-prompt.ts)

### Tools 工具

Specify which built-in tools to enable:

指定要启用哪些内置工具：

- Built-in tool names: `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`
  - 内置工具名称：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`
- Default built-ins: `read`, `bash`, `edit`, `write`
  - 默认启用的内置工具：`read`、`bash`、`edit`、`write`
- `noTools: "all"` disables all tools
  - `noTools: "all"` 禁用所有工具
- `noTools: "builtin"` disables default built-ins while keeping extension and custom tools enabled
  - `noTools: "builtin"` 禁用默认内置工具，但保留扩展工具和自定义工具处于启用状态
- `excludeTools` disables specific built-in, extension, or custom tool names after any `tools` allowlist is applied
  - `excludeTools` 会在应用 `tools` 白名单之后，再禁用指定名称的内置工具、扩展工具或自定义工具

The `edit` tool returns `details.diff` for Pi's TUI display and `details.patch` as a standard unified patch for SDK consumers.

`edit` 工具会返回 `details.diff` 供 Pi 的 TUI 显示，同时返回 `details.patch`（标准 unified patch 格式）供 SDK 使用方消费。

```typescript
import { createAgentSession } from "@earendil-works/pi-coding-agent";

// Read-only mode
const { session } = await createAgentSession({
  tools: ["read", "grep", "find", "ls"],
});

// Pick specific tools
const { session } = await createAgentSession({
  tools: ["read", "bash", "grep"],
});

// Disable one tool while keeping the rest available
const { session } = await createAgentSession({
  excludeTools: ["ask_question"],
});
```

#### Tools with Custom cwd 自定义 cwd 下的工具

When you pass a custom `cwd`, `createAgentSession()` builds selected built-in tools for that cwd.

当你传入自定义的 `cwd` 时，`createAgentSession()` 会针对该 cwd 构建所选的内置工具。

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const cwd = "/path/to/project";

// Use default tools for custom cwd
const { session } = await createAgentSession({
  cwd,
  sessionManager: SessionManager.inMemory(cwd),
});

// Or pick specific tools for custom cwd
const { session } = await createAgentSession({
  cwd,
  tools: ["read", "bash", "grep"],
  sessionManager: SessionManager.inMemory(cwd),
});
```

> See [examples/sdk/05-tools.ts](../examples/sdk/05-tools.ts)
>
> 参见 [examples/sdk/05-tools.ts](../examples/sdk/05-tools.ts)

### Custom Tools 自定义工具

```typescript
import { Type } from "typebox";
import { createAgentSession, defineTool } from "@earendil-works/pi-coding-agent";

// Inline custom tool
const myTool = defineTool({
  name: "my_tool",
  label: "My Tool",
  description: "Does something useful",
  parameters: Type.Object({
    input: Type.String({ description: "Input value" }),
  }),
  execute: async (_toolCallId, params) => ({
    content: [{ type: "text", text: `Result: ${params.input}` }],
    details: {},
  }),
});

// Pass custom tools directly
const { session } = await createAgentSession({
  customTools: [myTool],
});
```

Use `defineTool()` for standalone definitions and arrays like `customTools: [myTool]`. Inline `pi.registerTool({ ... })` already infers parameter types correctly.

对于独立的工具定义以及像 `customTools: [myTool]` 这样的数组，请使用 `defineTool()`。内联的 `pi.registerTool({ ... })` 本身已能正确推断参数类型。

Custom tools passed via `customTools` are combined with extension-registered tools. Extensions loaded by the ResourceLoader can also register tools via `pi.registerTool()`.

通过 `customTools` 传入的自定义工具会与扩展注册的工具合并。由 ResourceLoader 加载的扩展也可以通过 `pi.registerTool()` 注册工具。

If you pass `tools`, include each custom or extension tool name you want enabled, for example `tools: ["read", "bash", "my_tool"]`.

如果你传入了 `tools`，需要把每个想启用的自定义工具或扩展工具的名称都列进去，例如 `tools: ["read", "bash", "my_tool"]`。

> See [examples/sdk/05-tools.ts](../examples/sdk/05-tools.ts)
>
> 参见 [examples/sdk/05-tools.ts](../examples/sdk/05-tools.ts)

### Extensions 扩展

Extensions are loaded by the `ResourceLoader`. `DefaultResourceLoader` discovers extensions from `~/.pi/agent/extensions/`, `.pi/extensions/`, and settings.json extension sources.

扩展由 `ResourceLoader` 负责加载。`DefaultResourceLoader` 会从 `~/.pi/agent/extensions/`、`.pi/extensions/` 以及 settings.json 中配置的扩展来源中发现扩展。

```typescript
import { createAgentSession, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  additionalExtensionPaths: ["/path/to/my-extension.ts"],
  extensionFactories: [
    (pi) => {
      pi.on("agent_start", () => {
        console.log("[Inline Extension] Agent starting");
      });
    },
  ],
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

Extensions can register tools, subscribe to events, add commands, and more. See [extensions.md](extensions.md) for the full API.

扩展可以注册工具、订阅事件、添加命令等。完整 API 请参见 [extensions.md](extensions.md)。

**Named inline extensions:** By default, inline factories display as `<inline:1>`, `<inline:2>`, etc. in the startup Extensions list. To show a descriptive name instead, wrap the factory:

**具名内联扩展：** 默认情况下，内联工厂函数在启动时的扩展列表中显示为 `<inline:1>`、`<inline:2>` 等。若想显示更具描述性的名称，可以对工厂函数进行包装：

```typescript
import type { InlineExtension } from "@earendil-works/pi-coding-agent";

const myProvider: InlineExtension = {
  name: "my-provider",
  factory: (pi) => {
    pi.on("agent_start", () => {
      console.log("[my-provider] Agent starting");
    });
  },
};

const loader = new DefaultResourceLoader({
  extensionFactories: [myProvider],
});
```

This displays as `<inline:my-provider>` instead of `<inline:1>`. Bare factory functions are still accepted for backward compatibility.

这样它会显示为 `<inline:my-provider>` 而不是 `<inline:1>`。出于向后兼容考虑，仍然接受直接传入裸工厂函数。

**Event Bus:** Extensions can communicate via `pi.events`. Pass a shared `eventBus` to `DefaultResourceLoader` if you need to emit or listen from outside:

**事件总线（Event Bus）：** 扩展之间可以通过 `pi.events` 通信。如果你需要从外部发送或监听事件，可以向 `DefaultResourceLoader` 传入一个共享的 `eventBus`：

```typescript
import { createEventBus, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

const eventBus = createEventBus();
const loader = new DefaultResourceLoader({
  eventBus,
});
await loader.reload();

eventBus.on("my-extension:status", (data) => console.log(data));
```

> See [examples/sdk/06-extensions.ts](../examples/sdk/06-extensions.ts) and [docs/extensions.md](extensions.md)
>
> 参见 [examples/sdk/06-extensions.ts](../examples/sdk/06-extensions.ts) 和 [docs/extensions.md](extensions.md)

### Skills 技能

```typescript
import {
  createAgentSession,
  DefaultResourceLoader,
  type Skill,
} from "@earendil-works/pi-coding-agent";

const customSkill: Skill = {
  name: "my-skill",
  description: "Custom instructions",
  filePath: "/path/to/SKILL.md",
  baseDir: "/path/to",
  source: "custom",
};

const loader = new DefaultResourceLoader({
  skillsOverride: (current) => ({
    skills: [...current.skills, customSkill],
    diagnostics: current.diagnostics,
  }),
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> See [examples/sdk/04-skills.ts](../examples/sdk/04-skills.ts)
>
> 参见 [examples/sdk/04-skills.ts](../examples/sdk/04-skills.ts)

### Context Files 上下文文件

```typescript
import { createAgentSession, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  agentsFilesOverride: (current) => ({
    agentsFiles: [
      ...current.agentsFiles,
      { path: "/virtual/AGENTS.md", content: "# Guidelines\n\n- Be concise" },
    ],
  }),
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> See [examples/sdk/07-context-files.ts](../examples/sdk/07-context-files.ts)
>
> 参见 [examples/sdk/07-context-files.ts](../examples/sdk/07-context-files.ts)

### Slash Commands 斜杠命令

```typescript
import {
  createAgentSession,
  DefaultResourceLoader,
  type PromptTemplate,
} from "@earendil-works/pi-coding-agent";

const customCommand: PromptTemplate = {
  name: "deploy",
  description: "Deploy the application",
  source: "(custom)",
  content: "# Deploy\n\n1. Build\n2. Test\n3. Deploy",
};

const loader = new DefaultResourceLoader({
  promptsOverride: (current) => ({
    prompts: [...current.prompts, customCommand],
    diagnostics: current.diagnostics,
  }),
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> See [examples/sdk/08-prompt-templates.ts](../examples/sdk/08-prompt-templates.ts)
>
> 参见 [examples/sdk/08-prompt-templates.ts](../examples/sdk/08-prompt-templates.ts)

### Session Management 会话管理

Sessions use a tree structure with `id`/`parentId` linking, enabling in-place branching.

会话采用树形结构，通过 `id`/`parentId` 进行关联，从而支持原地分支（in-place branching）。

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSession,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

// In-memory (no persistence)
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
});

// New persistent session
const { session: persisted } = await createAgentSession({
  sessionManager: SessionManager.create(process.cwd()),
});

// Continue most recent
const { session: continued, modelFallbackMessage } = await createAgentSession({
  sessionManager: SessionManager.continueRecent(process.cwd()),
});
if (modelFallbackMessage) {
  console.log("Note:", modelFallbackMessage);
}

// Open specific file
const { session: opened } = await createAgentSession({
  sessionManager: SessionManager.open("/path/to/session.jsonl"),
});

// List sessions
const currentProjectSessions = await SessionManager.list(process.cwd());
const allSessions = await SessionManager.listAll(process.cwd());

// Session replacement API for /new, /resume, /fork, /clone, and import flows.
const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({
      services,
      sessionManager,
      sessionStartEvent,
    })),
    services,
    diagnostics: services.diagnostics,
  };
};

const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

// Replace the active session with a fresh one
await runtime.newSession();

// Replace the active session with another saved session
await runtime.switchSession("/path/to/session.jsonl");

// Replace the active session with a fork from a specific user entry
await runtime.fork("entry-id");

// Clone the active path through a specific entry
await runtime.fork("entry-id", { position: "at" });
```

**SessionManager tree API:**

**SessionManager 树形 API：**

```typescript
const sm = SessionManager.open("/path/to/session.jsonl");

// Session listing
const currentProjectSessions = await SessionManager.list(process.cwd());
const allSessions = await SessionManager.listAll(process.cwd());

// Tree traversal
const entries = sm.getEntries();        // All entries (excludes header)
const tree = sm.getTree();              // Full tree structure
const path = sm.getPath();              // Path from root to current leaf
const leaf = sm.getLeafEntry();         // Current leaf entry
const entry = sm.getEntry(id);          // Get entry by ID
const children = sm.getChildren(id);    // Direct children of entry

// Labels
const label = sm.getLabel(id);          // Get label for entry
sm.appendLabelChange(id, "checkpoint"); // Set label

// Branching
sm.branch(entryId);                     // Move leaf to earlier entry
sm.branchWithSummary(id, "Summary...");  // Branch with context summary
sm.createBranchedSession(leafId);       // Extract path to new file
```

> See [examples/sdk/11-sessions.ts](../examples/sdk/11-sessions.ts) and [Session Format](session-format.md)
>
> 参见 [examples/sdk/11-sessions.ts](../examples/sdk/11-sessions.ts) 和[会话格式说明](session-format.md)

### Settings Management 设置管理

```typescript
import { createAgentSession, SettingsManager, SessionManager } from "@earendil-works/pi-coding-agent";

// Default: loads from files (global + project merged)
const { session } = await createAgentSession({
  settingsManager: SettingsManager.create(),
});

// With overrides
const settingsManager = SettingsManager.create();
settingsManager.applyOverrides({
  compaction: { enabled: false },
  retry: { enabled: true, maxRetries: 5 },
});
const { session } = await createAgentSession({ settingsManager });

// In-memory (no file I/O, for testing)
const { session } = await createAgentSession({
  settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
  sessionManager: SessionManager.inMemory(),
});

// Custom directories
const { session } = await createAgentSession({
  settingsManager: SettingsManager.create("/custom/cwd", "/custom/agent"),
});
```

**Static factories:**

**静态工厂方法：**
- `SettingsManager.create(cwd?, agentDir?)` - Load from files
  - `SettingsManager.create(cwd?, agentDir?)` —— 从文件加载
- `SettingsManager.inMemory(settings?)` - No file I/O
  - `SettingsManager.inMemory(settings?)` —— 不进行文件 I/O

**Project-specific settings:**

**项目级设置：**

Settings load from two locations and merge:

设置会从以下两个位置加载并合并：
1. Global: `~/.pi/agent/settings.json`
   1. 全局：`~/.pi/agent/settings.json`
2. Project: `<cwd>/.pi/settings.json`
   2. 项目：`<cwd>/.pi/settings.json`

Project overrides global. Nested objects merge keys. Setters modify global settings by default.

项目级设置会覆盖全局设置。嵌套对象按键合并。默认情况下，setter 方法修改的是全局设置。

**Persistence and error handling semantics:**

**持久化与错误处理语义：**

- Settings getters/setters are synchronous for in-memory state.
  - 针对内存中的状态，设置的 getter/setter 是同步的。
- Setters enqueue persistence writes asynchronously.
  - setter 会以异步方式将持久化写入操作加入队列。
- Call `await settingsManager.flush()` when you need a durability boundary (for example, before process exit or before asserting file contents in tests).
  - 当你需要一个持久化边界时（例如进程退出前，或在测试中断言文件内容之前），请调用 `await settingsManager.flush()`。
- `SettingsManager` does not print settings I/O errors. Use `settingsManager.drainErrors()` and report them in your app layer.
  - `SettingsManager` 不会打印设置的 I/O 错误。请使用 `settingsManager.drainErrors()` 获取这些错误，并在你的应用层进行上报。

> See [examples/sdk/10-settings.ts](../examples/sdk/10-settings.ts)
>
> 参见 [examples/sdk/10-settings.ts](../examples/sdk/10-settings.ts)

## ResourceLoader

Use `DefaultResourceLoader` to discover extensions, skills, prompts, themes, and context files.

使用 `DefaultResourceLoader` 来发现扩展、技能、提示词、主题和上下文文件。

```typescript
import {
  DefaultResourceLoader,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  cwd,
  agentDir: getAgentDir(),
});
await loader.reload();

const extensions = loader.getExtensions();
const skills = loader.getSkills();
const prompts = loader.getPrompts();
const themes = loader.getThemes();
const contextFiles = loader.getAgentsFiles().agentsFiles;
```

## Return Value 返回值

`createAgentSession()` returns:

`createAgentSession()` 返回：

```typescript
interface CreateAgentSessionResult {
  // The session
  session: AgentSession;
  
  // Extensions result (for runner setup)
  extensionsResult: LoadExtensionsResult;
  
  // Warning if session model couldn't be restored
  modelFallbackMessage?: string;
}

interface LoadExtensionsResult {
  extensions: Extension[];
  errors: Array<{ path: string; error: string }>;
  runtime: ExtensionRuntime;
}
```

## Complete Example 完整示例

```typescript
import { getModel } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import {
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create({
  authPath: "/custom/agent/auth.json",
  modelsPath: "/custom/agent/models.json",
});
if (process.env.MY_KEY) {
  modelRuntime.setRuntimeApiKey("anthropic", process.env.MY_KEY);
}

// Inline tool
const statusTool = defineTool({
  name: "status",
  label: "Status",
  description: "Get system status",
  parameters: Type.Object({}),
  execute: async () => ({
    content: [{ type: "text", text: `Uptime: ${process.uptime()}s` }],
    details: {},
  }),
});

const model = getModel("anthropic", "claude-opus-4-5");
if (!model) throw new Error("Model not found");

// In-memory settings with overrides
const settingsManager = SettingsManager.inMemory({
  compaction: { enabled: false },
  retry: { enabled: true, maxRetries: 2 },
});

const loader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: "/custom/agent",
  settingsManager,
  systemPromptOverride: () => "You are a minimal assistant. Be concise.",
});
await loader.reload();

const { session } = await createAgentSession({
  cwd: process.cwd(),
  agentDir: "/custom/agent",

  model,
  thinkingLevel: "off",
  modelRuntime,

  tools: ["read", "bash", "status"],
  customTools: [statusTool],
  resourceLoader: loader,

  sessionManager: SessionManager.inMemory(),
  settingsManager,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("Get status and list files.");
```

## Run Modes 运行模式

The SDK exports run mode utilities for building custom interfaces on top of `createAgentSession()`:

本 SDK 导出了一些运行模式工具，便于你在 `createAgentSession()` 之上构建自定义界面：

### InteractiveMode 交互模式

Full TUI interactive mode with editor, chat history, and all built-in commands:

完整的 TUI 交互模式，包含编辑器、聊天历史以及全部内置命令：

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  InteractiveMode,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })),
    services,
    diagnostics: services.diagnostics,
  };
};
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

const mode = new InteractiveMode(runtime, {
  migratedProviders: [],
  modelFallbackMessage: undefined,
  initialMessage: "Hello",
  initialImages: [],
  initialMessages: [],
});

await mode.run();
```

### runPrintMode 打印模式

Single-shot mode: send prompts, output result, exit:

单次执行模式：发送提示词、输出结果、退出：

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  runPrintMode,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })),
    services,
    diagnostics: services.diagnostics,
  };
};
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

await runPrintMode(runtime, {
  mode: "text",
  initialMessage: "Hello",
  initialImages: [],
  messages: ["Follow up"],
});
```

### runRpcMode RPC 模式

JSON-RPC mode for subprocess integration:

用于子进程集成的 JSON-RPC 模式：

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  runRpcMode,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })),
    services,
    diagnostics: services.diagnostics,
  };
};
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

await runRpcMode(runtime);
```

See [RPC documentation](rpc.md) for the JSON protocol.

JSON 协议详见 [RPC 文档](rpc.md)。

## RPC Mode Alternative RPC 模式替代方案

For subprocess-based integration without building with the SDK, use the CLI directly:

如果你希望基于子进程进行集成而不使用 SDK 开发，可以直接使用 CLI：

```bash
pi --mode rpc --no-session
```

See [RPC documentation](rpc.md) for the JSON protocol.

JSON 协议详见 [RPC 文档](rpc.md)。

The SDK is preferred when:

在以下情况下更推荐使用 SDK：
- You want type safety
  - 你需要类型安全
- You're in the same Node.js process
  - 你的代码运行在同一个 Node.js 进程中
- You need direct access to agent state
  - 你需要直接访问智能体状态
- You want to customize tools/extensions programmatically
  - 你希望以编程方式自定义工具/扩展

RPC mode is preferred when:

在以下情况下更推荐使用 RPC 模式：
- You're integrating from another language
  - 你要从其他编程语言进行集成
- You want process isolation
  - 你需要进程隔离
- You're building a language-agnostic client
  - 你要构建与语言无关的客户端

## Exports 导出内容

The main entry point exports:

主入口导出以下内容：

```typescript
// Factory
createAgentSession
createAgentSessionRuntime
AgentSessionRuntime

// Auth and Models
ModelRuntime // implements pi-ai Models and owns credential storage
ModelRegistry // synchronous extension compatibility facade
resolveCliModel
resolveModelScopeWithDiagnostics

// Resource loading
DefaultResourceLoader
type ResourceLoader
createEventBus

// Constants and helpers
CONFIG_DIR_NAME
defineTool
getAgentDir
getPackageDir
getReadmePath
getDocsPath
getExamplesPath

// Session management
SessionManager
SettingsManager

// Tool factories
createCodingTools
createReadOnlyTools
createReadTool, createBashTool, createEditTool, createWriteTool
createGrepTool, createFindTool, createLsTool

// Types
type CreateAgentSessionOptions
type CreateAgentSessionResult
type ExtensionFactory
type InlineExtension
type ExtensionAPI
type ToolDefinition
type Skill
type PromptTemplate
type Tool
```

For extension types, see [extensions.md](extensions.md) for the full API.

关于扩展相关的类型，完整 API 请参见 [extensions.md](extensions.md)。
