> pi can create extensions. Ask it to build one for your use case.
> pi 可以创建扩展（extension）。告诉它你的使用场景，让它为你构建一个。

# Extensions 扩展

Extensions are TypeScript modules that extend pi's behavior. They can subscribe to lifecycle events, register custom tools callable by the LLM, add commands, and more.
扩展（extension）是用于扩展 pi 行为的 TypeScript 模块。它们可以订阅生命周期事件、注册可供 LLM 调用的自定义工具（tool）、添加命令等等。

> **Placement for /reload:** Put extensions in `~/.pi/agent/extensions/` (global) or `.pi/extensions/` (project-local) for auto-discovery. Use `pi -e ./path.ts` only for quick tests. Extensions in auto-discovered locations can be hot-reloaded with `/reload`.
> **为 /reload 准备的放置位置：** 请将扩展放在 `~/.pi/agent/extensions/`（全局）或 `.pi/extensions/`（项目本地）中以便自动发现。`pi -e ./path.ts` 仅用于快速测试。位于自动发现位置的扩展可以通过 `/reload` 热重载。

**Key capabilities:**
**核心能力：**
- **Custom tools** - Register tools the LLM can call via `pi.registerTool()`
  - **自定义工具** —— 通过 `pi.registerTool()` 注册可供 LLM 调用的工具
- **Event interception** - Block or modify tool calls, inject context, customize compaction
  - **事件拦截** —— 阻止或修改工具调用、注入上下文、自定义压缩（compaction）
- **User interaction** - Prompt users via `ctx.ui` (select, confirm, input, notify)
  - **用户交互** —— 通过 `ctx.ui` 提示用户（select、confirm、input、notify）
- **Custom UI components** - Full TUI components with keyboard input via `ctx.ui.custom()` for complex interactions
  - **自定义 UI 组件** —— 通过 `ctx.ui.custom()` 使用支持键盘输入的完整 TUI 组件，实现复杂交互
- **Custom commands** - Register commands like `/mycommand` via `pi.registerCommand()`
  - **自定义命令** —— 通过 `pi.registerCommand()` 注册诸如 `/mycommand` 的命令
- **Session persistence** - Store state that survives restarts via `pi.appendEntry()`
  - **会话持久化** —— 通过 `pi.appendEntry()` 存储可在重启后保留的状态
- **Custom rendering** - Control how tool calls/results and messages appear in TUI
  - **自定义渲染** —— 控制工具调用/结果以及消息在 TUI 中的显示方式

**Example use cases:**
**示例使用场景：**
- Permission gates (confirm before `rm -rf`, `sudo`, etc.)
  - 权限闸门（在 `rm -rf`、`sudo` 等操作前进行确认）
- Git checkpointing (stash at each turn, restore on branch)
  - Git 检查点（每轮对话时 stash，在分支上恢复）
- Path protection (block writes to `.env`, `node_modules/`)
  - 路径保护（阻止写入 `.env`、`node_modules/`）
- Custom compaction (summarize conversation your way)
  - 自定义压缩（按你自己的方式总结对话）
- Conversation summaries (see `summarize.ts` example)
  - 对话摘要（参见 `summarize.ts` 示例）
- Interactive tools (questions, wizards, custom dialogs)
  - 交互式工具（提问、向导、自定义对话框）
- Stateful tools (todo lists, connection pools)
  - 有状态工具（待办列表、连接池）
- External integrations (file watchers, webhooks, CI triggers)
  - 外部集成（文件监听器、webhook、CI 触发器）
- Games while you wait (see `snake.ts` example)
  - 等待时可玩的小游戏（参见 `snake.ts` 示例）

See [examples/extensions/](../examples/extensions/) for working implementations.
可运行的实现示例请参见 [examples/extensions/](../examples/extensions/)。

## Table of Contents 目录

- [Quick Start](#quick-start) 快速开始
- [Extension Locations](#extension-locations) 扩展位置
- [Available Imports](#available-imports) 可用的导入
- [Writing an Extension](#writing-an-extension) 编写扩展
  - [Extension Styles](#extension-styles) 扩展形式
- [Events](#events) 事件
  - [Lifecycle Overview](#lifecycle-overview) 生命周期概览
  - [Resource Events](#resource-events) 资源事件
  - [Session Events](#session-events) 会话事件
  - [Agent Events](#agent-events) Agent 事件
  - [Model Events](#model-events) 模型事件
  - [Tool Events](#tool-events) 工具事件
- [ExtensionContext](#extensioncontext) 扩展上下文
- [ExtensionCommandContext](#extensioncommandcontext) 扩展命令上下文
- [ExtensionAPI Methods](#extensionapi-methods) ExtensionAPI 方法
- [State Management](#state-management) 状态管理
- [Custom Tools](#custom-tools) 自定义工具
  - [Dynamic Tool Loading](#dynamic-tool-loading) 动态工具加载
- [Custom UI](#custom-ui) 自定义 UI
- [Error Handling](#error-handling) 错误处理
- [Mode Behavior](#mode-behavior) 模式行为
- [Examples Reference](#examples-reference) 示例索引

## Quick Start 快速开始

Create `~/.pi/agent/extensions/my-extension.ts`:
创建 `~/.pi/agent/extensions/my-extension.ts`：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // React to events
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Extension loaded!", "info");
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("Dangerous!", "Allow rm -rf?");
      if (!ok) return { block: true, reason: "Blocked by user" };
    }
  });

  // Register a custom tool
  pi.registerTool({
    name: "greet",
    label: "Greet",
    description: "Greet someone by name",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}!` }],
        details: {},
      };
    },
  });

  // Register a command
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify(`Hello ${args || "world"}!`, "info");
    },
  });
}
```

Test with `--extension` (or `-e`) flag:
使用 `--extension`（或 `-e`）标志进行测试：

```bash
pi -e ./my-extension.ts
```

## Extension Locations 扩展位置

> **Security:** Extensions run with your full system permissions and can execute arbitrary code. Only install from sources you trust.
> **安全提示：** 扩展以你的完整系统权限运行，可以执行任意代码。请只安装来自可信来源的扩展。

Extensions are auto-discovered from trusted locations. Project-local `.pi/extensions` entries load only after the project is trusted.
扩展会从受信任的位置被自动发现。项目本地的 `.pi/extensions` 条目只有在项目被信任后才会加载。

| Location<br>位置 | Scope<br>作用范围 |
|----------|-------|
| `~/.pi/agent/extensions/*.ts` | Global (all projects)<br>全局（所有项目） |
| `~/.pi/agent/extensions/*/index.ts` | Global (subdirectory)<br>全局（子目录） |
| `.pi/extensions/*.ts` | Project-local<br>项目本地 |
| `.pi/extensions/*/index.ts` | Project-local (subdirectory)<br>项目本地（子目录） |

Additional paths via `settings.json`:
通过 `settings.json` 添加额外路径：

```json
{
  "packages": [
    "npm:@foo/bar@1.0.0",
    "git:github.com/user/repo@v1"
  ],
  "extensions": [
    "/path/to/local/extension.ts",
    "/path/to/local/extension/dir"
  ]
}
```

To share extensions via npm or git as pi packages, see [packages.md](packages.md).
若要将扩展作为 pi package 通过 npm 或 git 分享，请参见 [packages.md](packages.md)。

## Available Imports 可用的导入

| Package<br>包 | Purpose<br>用途 |
|---------|---------|
| `@earendil-works/pi-coding-agent` | Extension types (`ExtensionAPI`, `ExtensionContext`, events)<br>扩展类型（`ExtensionAPI`、`ExtensionContext`、事件） |
| `typebox` | Schema definitions for tool parameters<br>工具参数的 schema 定义 |
| `@earendil-works/pi-ai` | AI utilities (`StringEnum` for Google-compatible enums)<br>AI 工具函数（用于 Google 兼容枚举的 `StringEnum`） |
| `@earendil-works/pi-tui` | TUI components for custom rendering<br>用于自定义渲染的 TUI 组件 |

npm dependencies work too. Add a `package.json` next to your extension (or in a parent directory), run `npm install`, and imports from `node_modules/` are resolved automatically.
npm 依赖同样可用。在扩展旁边（或其父目录）添加 `package.json`，运行 `npm install`，来自 `node_modules/` 的导入会被自动解析。

For distributed pi packages installed with `pi install` (npm or git), runtime deps must be in `dependencies`. Package installation uses production installs (`npm install --omit=dev`) by default, so `devDependencies` are not available at runtime; when `npmCommand` is configured, git packages use plain `install` for compatibility with wrappers.
对于通过 `pi install`（npm 或 git）安装的分发型 pi package，运行时依赖必须放在 `dependencies` 中。包安装默认使用生产模式安装（`npm install --omit=dev`），因此 `devDependencies` 在运行时不可用；当配置了 `npmCommand` 时，git package 会使用普通的 `install`，以兼容各类包装器（wrapper）。

Node.js built-ins (`node:fs`, `node:path`, etc.) are also available.
Node.js 内置模块（`node:fs`、`node:path` 等）同样可用。

## Writing an Extension 编写扩展

An extension exports a default factory function that receives `ExtensionAPI`. The factory can be synchronous or asynchronous:
扩展需要默认导出一个接收 `ExtensionAPI` 的工厂函数。该工厂函数可以是同步的，也可以是异步的：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Subscribe to events
  pi.on("event_name", async (event, ctx) => {
    // ctx.ui for user interaction
    const ok = await ctx.ui.confirm("Title", "Are you sure?");
    ctx.ui.notify("Done!", "info");
    ctx.ui.setStatus("my-ext", "Processing...");  // Footer status
    ctx.ui.setWidget("my-ext", ["Line 1", "Line 2"]);  // Widget above editor (default)
  });

  // Register tools, commands, shortcuts, flags
  pi.registerTool({ ... });
  pi.registerCommand("name", { ... });
  pi.registerShortcut("ctrl+x", { ... });
  pi.registerFlag("my-flag", { ... });
}
```

Extensions are loaded via [jiti](https://github.com/unjs/jiti), so TypeScript works without compilation.
扩展通过 [jiti](https://github.com/unjs/jiti) 加载，因此 TypeScript 无需编译即可运行。

If the factory returns a `Promise`, pi awaits it before continuing startup. That means async initialization completes before `session_start`, before `resources_discover`, and before provider registrations queued via `pi.registerProvider()` are flushed.
如果工厂函数返回 `Promise`，pi 会先 await 它再继续启动流程。这意味着异步初始化会在 `session_start` 之前、`resources_discover` 之前，以及通过 `pi.registerProvider()` 排队的 provider 注册被刷新之前完成。

### Async factory functions 异步工厂函数

Use an async factory for one-time startup work such as fetching remote configuration or dynamically discovering available models.
对于一次性的启动工作（例如获取远程配置或动态发现可用模型），可使用异步工厂函数。

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default async function (pi: ExtensionAPI) {
  const response = await fetch("http://localhost:1234/v1/models");
  const payload = (await response.json()) as {
    data: Array<{
      id: string;
      name?: string;
      context_window?: number;
      max_tokens?: number;
    }>;
  };

  pi.registerProvider("local-openai", {
    baseUrl: "http://localhost:1234/v1",
    apiKey: "$LOCAL_OPENAI_API_KEY",
    api: "openai-completions",
    models: payload.data.map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: model.context_window ?? 128000,
      maxTokens: model.max_tokens ?? 4096,
    })),
  });
}
```

This pattern makes the fetched models available during normal startup and to `pi --list-models`.
这种模式让获取到的模型在正常启动过程中以及 `pi --list-models` 中都可用。

### Long-lived resources and shutdown 长生命周期资源与关闭

Extension factories may run in invocations that never start a session. Do not start background resources such as processes, sockets, file watchers, or timers from the factory.
扩展工厂函数可能运行在从不启动会话的调用中。不要在工厂函数中启动后台资源，例如进程、套接字、文件监听器或定时器。

Defer background resource startup until `session_start` or the command/tool/event that needs the resource. Register an idempotent `session_shutdown` handler to close any session-scoped resources you start.
请将后台资源的启动推迟到 `session_start`，或推迟到真正需要该资源的命令/工具/事件中。同时注册一个幂等的 `session_shutdown` 处理器，用于关闭你启动的所有会话级资源。

### Extension Styles 扩展形式

**Single file** - simplest, for small extensions:
**单文件** —— 最简单的形式，适用于小型扩展：

```
~/.pi/agent/extensions/
└── my-extension.ts
```

**Directory with index.ts** - for multi-file extensions:
**带 index.ts 的目录** —— 适用于多文件扩展：

```
~/.pi/agent/extensions/
└── my-extension/
    ├── index.ts        # Entry point (exports default function)
    ├── tools.ts        # Helper module
    └── utils.ts        # Helper module
```

**Package with dependencies** - for extensions that need npm packages:
**带依赖的包** —— 适用于需要 npm 包的扩展：

```
~/.pi/agent/extensions/
└── my-extension/
    ├── package.json    # Declares dependencies and entry points
    ├── package-lock.json
    ├── node_modules/   # After npm install
    └── src/
        └── index.ts
```

```json
// package.json
{
  "name": "my-extension",
  "dependencies": {
    "zod": "^3.0.0",
    "chalk": "^5.0.0"
  },
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

Run `npm install` in the extension directory, then imports from `node_modules/` work automatically.
在扩展目录中运行 `npm install`，之后来自 `node_modules/` 的导入即可自动生效。

## Events 事件

### Lifecycle Overview 生命周期概览

```
pi starts
  │
  ├─► project_trust (user/global and CLI extensions only, before project resources load)
  ├─► session_start { reason: "startup" }
  └─► resources_discover { reason: "startup" }
      │
      ▼
user sends prompt ─────────────────────────────────────────┐
  │                                                        │
  ├─► (extension commands checked first, bypass if found)  │
  ├─► input (can intercept, transform, or handle)          │
  ├─► (skill/template expansion if not handled)            │
  ├─► before_agent_start (can inject message, modify system prompt)
  ├─► agent_start                                          │
  ├─► message_start / message_update / message_end         │
  │                                                        │
  │   ┌─── turn (repeats while LLM calls tools) ───┐       │
  │   │                                            │       │
  │   ├─► turn_start                               │       │
  │   ├─► context (can modify messages)            │       │
  │   ├─► before_provider_headers (can mutate headers)     |
  │   ├─► before_provider_request (can inspect or replace payload)
  │   ├─► after_provider_response (status + headers, before stream consume)
  │   │                                            │       │
  │   │   LLM responds, may call tools:            │       │
  │   │     ├─► tool_execution_start               │       │
  │   │     ├─► tool_call (can block)              │       │
  │   │     ├─► tool_execution_update              │       │
  │   │     ├─► tool_result (can modify)           │       │
  │   │     └─► tool_execution_end                 │       │
  │   │                                            │       │
  │   └─► turn_end                                 │       │
  │                                                        │
  ├─► agent_end                                            │
  └─► agent_settled (no retry/compaction/follow-up left)   │
                                                           │
user sends another prompt ◄────────────────────────────────┘

/new (new session) or /resume (switch session)
  ├─► session_before_switch (can cancel)
  ├─► session_shutdown
  ├─► session_start { reason: "new" | "resume", previousSessionFile? }
  └─► resources_discover { reason: "startup" }

/fork or /clone
  ├─► session_before_fork (can cancel)
  ├─► session_shutdown
  ├─► session_start { reason: "fork", previousSessionFile }
  └─► resources_discover { reason: "startup" }

/name or pi.setSessionName()
  └─► session_info_changed

/compact or auto-compaction
  ├─► session_before_compact (can cancel or customize)
  └─► session_compact

/tree navigation
  ├─► session_before_tree (can cancel or customize)
  └─► session_tree

/model or Ctrl+P (model selection/cycling)
  ├─► thinking_level_select (if model change changes/clamps thinking level)
  └─► model_select

thinking level changes (settings, keybinding, pi.setThinkingLevel())
  └─► thinking_level_select

exit (Ctrl+C, Ctrl+D, SIGHUP, SIGTERM)
  └─► session_shutdown
```

### Startup Events 启动事件

#### project_trust

Fired before pi decides whether to trust a project with dynamic configs (`.pi` or `.agents/skills`). It runs during startup and when session replacement (for example `/resume`) enters a cwd whose trust has not been resolved in the current process. Only user/global extensions and CLI `-e` extensions participate; project-local extensions are not loaded until after trust is resolved.
在 pi 判定是否信任某个带有动态配置（`.pi` 或 `.agents/skills`）的项目之前触发。它会在启动过程中运行，也会在会话替换（例如 `/resume`）进入一个当前进程尚未解析信任状态的 cwd 时运行。只有用户/全局扩展以及 CLI `-e` 扩展会参与；项目本地扩展要等到信任状态解析完成后才会加载。

```typescript
pi.on("project_trust", async (event, ctx) => {
  // event.cwd - current working directory
  // ctx has a limited trust context: cwd, mode, hasUI, and select/confirm/input/notify UI helpers
  if (await ctx.ui.confirm("Trust project?", event.cwd)) {
    return { trusted: "yes", remember: true };
  }
  return { trusted: "undecided" };
});
```

A `project_trust` handler must return `{ trusted: "yes" | "no" | "undecided" }`. A user/global or CLI extension that returns `"yes"` or `"no"` owns the decision; the first yes/no decision wins and suppresses the built-in trust prompt. Use `remember: true` to persist a yes/no decision; otherwise it applies only to the current process. Return `"undecided"` to let later handlers or the built-in trust flow decide. Check `ctx.hasUI` before prompting. If no handler returns yes/no, normal trust resolution continues: saved `trust.json` decisions apply first, then `defaultProjectTrust` controls whether pi asks, trusts, or declines by default.
`project_trust` 处理器必须返回 `{ trusted: "yes" | "no" | "undecided" }`。返回 `"yes"` 或 `"no"` 的用户/全局扩展或 CLI 扩展将掌握该决定；第一个 yes/no 决定生效，并会抑制内置的信任提示。使用 `remember: true` 可持久化保存 yes/no 决定；否则该决定仅对当前进程生效。返回 `"undecided"` 则交由后续处理器或内置信任流程决定。在提示用户之前请先检查 `ctx.hasUI`。如果没有任何处理器返回 yes/no，则继续常规的信任解析流程：先应用 `trust.json` 中已保存的决定，然后由 `defaultProjectTrust` 控制 pi 默认是询问、信任还是拒绝。

### Resource Events 资源事件

#### resources_discover

Fired after `session_start` so extensions can contribute additional skill, prompt, and theme paths.
在 `session_start` 之后触发，使扩展可以贡献额外的 skill、prompt 和 theme 路径。
The startup path uses `reason: "startup"`. Reload uses `reason: "reload"`.
启动路径使用 `reason: "startup"`。重载使用 `reason: "reload"`。

```typescript
pi.on("resources_discover", async (event, _ctx) => {
  // event.cwd - current working directory
  // event.reason - "startup" | "reload"
  return {
    skillPaths: ["/path/to/skills"],
    promptPaths: ["/path/to/prompts"],
    themePaths: ["/path/to/themes"],
  };
});
```

### Session Events 会话事件

See [Session Format](session-format.md) for session storage internals and the SessionManager API.
关于会话存储的内部机制以及 SessionManager API，请参见 [Session Format](session-format.md)。

#### session_start

Fired when a session is started, loaded, or reloaded.
当会话被启动、加载或重新加载时触发。

```typescript
pi.on("session_start", async (event, ctx) => {
  // event.reason - "startup" | "reload" | "new" | "resume" | "fork"
  // event.previousSessionFile - present for "new", "resume", and "fork"
  ctx.ui.notify(`Session: ${ctx.sessionManager.getSessionFile() ?? "ephemeral"}`, "info");
});
```

#### session_info_changed

Fired when the current session display name is set via `/name`, RPC, or `pi.setSessionName()`.
当通过 `/name`、RPC 或 `pi.setSessionName()` 设置当前会话显示名称时触发。

```typescript
pi.on("session_info_changed", async (event, ctx) => {
  // event.name - current normalized name, or undefined if cleared
  ctx.ui.notify(`Session renamed: ${event.name ?? "(none)"}`, "info");
});
```

#### session_before_switch

Fired before starting a new session (`/new`) or switching sessions (`/resume`).
在开启新会话（`/new`）或切换会话（`/resume`）之前触发。

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  // event.reason - "new" or "resume"
  // event.targetSessionFile - session we're switching to (only for "resume")

  if (event.reason === "new") {
    const ok = await ctx.ui.confirm("Clear?", "Delete all messages?");
    if (!ok) return { cancel: true };
  }
});
```

After a successful switch or new-session action, pi emits `session_shutdown` for the old extension instance, reloads and rebinds extensions for the new session, then emits `session_start` with `reason: "new" | "resume"` and `previousSessionFile`.
在切换会话或新建会话操作成功后，pi 会为旧的扩展实例发出 `session_shutdown`，为新会话重新加载并重新绑定扩展，然后发出带有 `reason: "new" | "resume"` 和 `previousSessionFile` 的 `session_start`。
Do cleanup work in `session_shutdown`, then reestablish any in-memory state in `session_start`.
请在 `session_shutdown` 中执行清理工作，然后在 `session_start` 中重建所需的内存状态。

#### session_before_fork

Fired when forking via `/fork` or cloning via `/clone`.
通过 `/fork` 分叉或通过 `/clone` 克隆时触发。

```typescript
pi.on("session_before_fork", async (event, ctx) => {
  // event.entryId - ID of the selected entry
  // event.position - "before" for /fork, "at" for /clone
  return { cancel: true }; // Cancel fork/clone
  // OR
  return { skipConversationRestore: true }; // Reserved for future conversation restore control
});
```

After a successful fork or clone, pi emits `session_shutdown` for the old extension instance, reloads and rebinds extensions for the new session, then emits `session_start` with `reason: "fork"` and `previousSessionFile`.
在分叉或克隆成功后，pi 会为旧的扩展实例发出 `session_shutdown`，为新会话重新加载并重新绑定扩展，然后发出带有 `reason: "fork"` 和 `previousSessionFile` 的 `session_start`。
Do cleanup work in `session_shutdown`, then reestablish any in-memory state in `session_start`.
请在 `session_shutdown` 中执行清理工作，然后在 `session_start` 中重建所需的内存状态。

#### session_before_compact / session_compact

Fired on compaction. See [compaction.md](compaction.md) for details.
在执行压缩（compaction）时触发。详情参见 [compaction.md](compaction.md)。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // reason - "manual" (/compact), "threshold", or "overflow"
  // willRetry - whether the aborted turn is retried after compaction (overflow recovery)

  // Cancel:
  return { cancel: true };

  // Custom summary:
  return {
    compaction: {
      summary: "...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      // usage: summaryResponse.usage, // Optional; included in session totals
    }
  };
});

pi.on("session_compact", async (event, ctx) => {
  // event.compactionEntry - the saved compaction
  // event.fromExtension - whether extension provided it
  // event.reason - "manual" (/compact), "threshold", or "overflow"
  // event.willRetry - whether the aborted turn is retried after compaction (overflow recovery)
});
```

#### session_before_tree / session_tree

Fired on `/tree` navigation. See [Sessions](sessions.md) for tree navigation concepts.
在 `/tree` 导航时触发。关于树形导航的概念请参见 [Sessions](sessions.md)。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;
  return { cancel: true };
  // OR provide custom summary:
  return {
    summary: {
      summary: "...",
      // usage: summaryResponse.usage, // Optional; included in session totals
      details: {},
    },
  };
});

pi.on("session_tree", async (event, ctx) => {
  // event.newLeafId, oldLeafId, summaryEntry, fromExtension
});
```

#### session_shutdown

Fired before a started session runtime is torn down. Use this to clean up resources opened from `session_start` or other session-scoped hooks.
在已启动的会话运行时被销毁之前触发。可用它来清理在 `session_start` 或其他会话级钩子（hook）中打开的资源。

```typescript
pi.on("session_shutdown", async (event, ctx) => {
  // event.reason - "quit" | "reload" | "new" | "resume" | "fork"
  // event.targetSessionFile - destination session for session replacement flows
  // Cleanup, save state, etc.
});
```

### Agent Events Agent 事件

#### before_agent_start

Fired after user submits prompt, before agent loop. Can inject a message and/or modify the system prompt.
在用户提交 prompt 之后、agent 循环开始之前触发。可用于注入消息和/或修改 system prompt。

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  // event.prompt - user's prompt text
  // event.images - attached images (if any)
  // event.systemPrompt - current chained system prompt for this handler
  //   (includes changes from earlier before_agent_start handlers)
  // event.systemPromptOptions - structured options used to build the system prompt
  //   .customPrompt - any custom system prompt (from --system-prompt, SYSTEM.md, or custom templates)
  //   .selectedTools - tools currently active in the prompt
  //   .toolSnippets - one-line descriptions for each tool
  //   .promptGuidelines - custom guideline bullets
  //   .appendSystemPrompt - text from --append-system-prompt flags
  //   .cwd - working directory
  //   .contextFiles - AGENTS.md files and other loaded context files
  //   .skills - loaded skills

  return {
    // Inject a persistent message (stored in session, sent to LLM)
    message: {
      customType: "my-extension",
      content: "Additional context for the LLM",
      display: true,
    },
    // Replace the system prompt for this turn (chained across extensions)
    systemPrompt: event.systemPrompt + "\n\nExtra instructions for this turn...",
  };
});
```

The `systemPromptOptions` field gives extensions access to the same structured data Pi uses to build the system prompt. This lets you inspect what Pi has loaded — custom prompts, guidelines, tool snippets, context files, skills — without re-discovering resources or re-parsing flags. Use it when your extension needs to make deep, informed changes to the system prompt while respecting user-provided configuration.
`systemPromptOptions` 字段让扩展可以访问 Pi 构建 system prompt 时所使用的同一份结构化数据。这样你就能查看 Pi 已加载的内容 —— 自定义 prompt、指导原则（guidelines）、工具简介片段、上下文文件、skill —— 而无需重新发现资源或重新解析命令行标志。当你的扩展需要在尊重用户已有配置的前提下对 system prompt 做深入且有依据的修改时，可以使用它。

Inside `before_agent_start`, `event.systemPrompt` and `ctx.getSystemPrompt()` both reflect the chained system prompt as of the current handler. Later `before_agent_start` handlers can still modify it again.
在 `before_agent_start` 内部，`event.systemPrompt` 和 `ctx.getSystemPrompt()` 都反映截至当前处理器为止链式累积的 system prompt。后续的 `before_agent_start` 处理器仍可再次修改它。

#### agent_start / agent_end / agent_settled

`agent_start` fires when a low-level agent run begins. `agent_end` fires when that run ends, but Pi may still auto-retry, auto-compact and retry, or continue with queued follow-up messages. Use `agent_settled` for status integrations that need to know Pi will not continue running automatically.
`agent_start` 在一次底层 agent 运行开始时触发。`agent_end` 在该次运行结束时触发，但 Pi 之后仍可能自动重试、自动压缩后重试，或继续处理排队中的后续消息。如果你的状态类集成需要知道 Pi 不会再自动继续运行，请使用 `agent_settled`。

```typescript
pi.on("agent_start", async (_event, ctx) => {});

pi.on("agent_end", async (event, ctx) => {
  // event.messages - messages from this low-level run
});

pi.on("agent_settled", async (_event, ctx) => {
  // ctx.isIdle() is true here unless another extension started a new run.
});
```

#### turn_start / turn_end

Fired for each turn (one LLM response + tool calls).
在每一轮（turn，即一次 LLM 响应 + 工具调用）时触发。

```typescript
pi.on("turn_start", async (event, ctx) => {
  // event.turnIndex, event.timestamp
});

pi.on("turn_end", async (event, ctx) => {
  // event.turnIndex, event.message, event.toolResults
});
```

#### message_start / message_update / message_end

Fired for message lifecycle updates.
在消息生命周期发生更新时触发。

- `message_start` and `message_end` fire for user, assistant, and toolResult messages.
  - `message_start` 和 `message_end` 会针对 user、assistant 和 toolResult 消息触发。
- `message_update` fires for assistant streaming updates.
  - `message_update` 在 assistant 流式更新时触发。
- `message_end` handlers can return `{ message }` to replace the finalized message. The replacement must keep the same `role`.
  - `message_end` 处理器可以返回 `{ message }` 来替换最终确定的消息。替换后的消息必须保持相同的 `role`。

```typescript
pi.on("message_start", async (event, ctx) => {
  // event.message
});

pi.on("message_update", async (event, ctx) => {
  // event.message
  // event.assistantMessageEvent (token-by-token stream event)
});

pi.on("message_end", async (event, ctx) => {
  if (event.message.role !== "assistant") return;

  return {
    message: {
      ...event.message,
      usage: {
        ...event.message.usage,
        cost: {
          ...event.message.usage.cost,
          total: 0.123,
        },
      },
    },
  };
});
```

#### tool_execution_start / tool_execution_update / tool_execution_end

Fired for tool execution lifecycle updates.
在工具执行生命周期发生更新时触发。

In parallel tool mode:
在并行工具模式下：
- `tool_execution_start` is emitted in assistant source order during the preflight phase
  - `tool_execution_start` 在预检（preflight）阶段按 assistant 消息中的原始顺序发出
- `tool_execution_update` events may interleave across tools
  - `tool_execution_update` 事件可能在多个工具之间交错出现
- `tool_execution_end` is emitted in tool completion order after each tool is finalized
  - `tool_execution_end` 在每个工具最终完成后，按工具完成顺序发出
- final `toolResult` message events are still emitted later in assistant source order
  - 最终的 `toolResult` 消息事件仍会在稍后按 assistant 消息中的原始顺序发出

```typescript
pi.on("tool_execution_start", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.args
});

pi.on("tool_execution_update", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.args, event.partialResult
});

pi.on("tool_execution_end", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.result, event.isError
});
```

#### context

Fired before each LLM call. Modify messages non-destructively. See [Session Format](session-format.md) for message types.
在每次 LLM 调用之前触发。可非破坏性地修改消息。消息类型请参见 [Session Format](session-format.md)。

```typescript
pi.on("context", async (event, ctx) => {
  // event.messages - deep copy, safe to modify
  const filtered = event.messages.filter(m => !shouldPrune(m));
  return { messages: filtered };
});
```

#### before_provider_headers

Fired after the outgoing HTTP headers are assembled. Use it to add, override, or remove request headers.
在出站 HTTP 请求头组装完成后触发。可用于添加、覆盖或移除请求头。

Handlers mutate `event.headers` in place. Set a key to a string to add or override it, or to `null` to delete it.
处理器直接就地修改 `event.headers`。将某个 key 设为字符串可添加或覆盖它，设为 `null` 则删除它。

```typescript
pi.on("before_provider_headers", (event, ctx) => {
  // Add or override — e.g. a session id for gateway tracing/attribution
  event.headers["x-session-id"] = ctx.sessionManager.getSessionId();

  // Drop a tracking header pi adds for this call
  event.headers["X-OpenRouter-Title"] = null;
});
```

Runs once per provider request; retries reuse the same headers rather than re-firing the hook.
每次 provider 请求只运行一次；重试会复用相同的请求头，而不会重新触发该钩子。

#### before_provider_request

Fired after the provider-specific payload is built, right before the request is sent. Handlers run in extension load order. Returning `undefined` keeps the payload unchanged. Returning any other value replaces the payload for later handlers and for the actual request.
在 provider 专用的请求负载（payload）构建完成之后、请求实际发送之前触发。处理器按扩展加载顺序运行。返回 `undefined` 表示保持负载不变。返回其他任何值都会替换该负载，并对后续处理器及实际请求生效。

This hook can rewrite provider-level system instructions or remove them entirely. Those payload-level changes are not reflected by `ctx.getSystemPrompt()`, which reports Pi's system prompt string rather than the final serialized provider payload.
该钩子可以重写 provider 级别的 system 指令，甚至将其完全移除。这些负载级别的修改不会反映在 `ctx.getSystemPrompt()` 中，因为后者返回的是 Pi 的 system prompt 字符串，而非最终序列化的 provider 负载。

```typescript
pi.on("before_provider_request", (event, ctx) => {
  console.log(JSON.stringify(event.payload, null, 2));

  // Optional: replace payload
  // return { ...event.payload, temperature: 0 };
});
```

This is mainly useful for debugging provider serialization and cache behavior.
这主要用于调试 provider 的序列化与缓存行为。

#### after_provider_response

Fired after an HTTP response is received and before its stream body is consumed. Handlers run in extension load order.
在收到 HTTP 响应之后、其流式响应体被消费之前触发。处理器按扩展加载顺序运行。

```typescript
pi.on("after_provider_response", (event, ctx) => {
  // event.status - HTTP status code
  // event.headers - normalized response headers
  if (event.status === 429) {
    console.log("rate limited", event.headers["retry-after"]);
  }
});
```

Header availability depends on provider and transport. Providers that abstract HTTP responses may not expose headers.
响应头是否可用取决于 provider 与传输层。对 HTTP 响应做了抽象封装的 provider 可能不会暴露响应头。

### Model Events 模型事件

#### model_select

Fired when the model changes via `/model` command, model cycling (`Ctrl+P`), or session restore.
当通过 `/model` 命令、模型循环切换（`Ctrl+P`）或会话恢复导致模型变更时触发。

```typescript
pi.on("model_select", async (event, ctx) => {
  // event.model - newly selected model
  // event.previousModel - previous model (undefined if first selection)
  // event.source - "set" | "cycle" | "restore"

  const prev = event.previousModel
    ? `${event.previousModel.provider}/${event.previousModel.id}`
    : "none";
  const next = `${event.model.provider}/${event.model.id}`;

  ctx.ui.notify(`Model changed (${event.source}): ${prev} -> ${next}`, "info");
});
```

Use this to update UI elements (status bars, footers) or perform model-specific initialization when the active model changes.
当当前激活的模型发生变化时，可用它来更新 UI 元素（状态栏、页脚）或执行模型相关的初始化。

#### thinking_level_select

Fired when the thinking level changes. This is notification-only; handler return values are ignored.
当思考等级（thinking level）变化时触发。该事件仅用于通知；处理器的返回值会被忽略。

```typescript
pi.on("thinking_level_select", async (event, ctx) => {
  // event.level - newly selected thinking level
  // event.previousLevel - previous thinking level

  ctx.ui.setStatus("thinking", `thinking: ${event.level}`);
});
```

Use this to update extension UI when `pi.setThinkingLevel()`, model changes, or built-in thinking-level controls change the active thinking level.
当 `pi.setThinkingLevel()`、模型变更或内置的思考等级控件改变了当前思考等级时，可用它来更新扩展 UI。

### Tool Events 工具事件

#### tool_call

Fired after `tool_execution_start`, before the tool executes. **Can block.** Use `isToolCallEventType` to narrow and get typed inputs.
在 `tool_execution_start` 之后、工具实际执行之前触发。**可阻止执行。** 使用 `isToolCallEventType` 进行类型收窄并获得带类型的输入。

Before `tool_call` runs, pi waits for previously emitted Agent events to finish draining through `AgentSession`. This means `ctx.sessionManager` is up to date through the current assistant tool-calling message.
在 `tool_call` 运行之前，pi 会等待此前发出的 Agent 事件在 `AgentSession` 中排空完毕。这意味着 `ctx.sessionManager` 的内容已更新到当前这条发起工具调用的 assistant 消息为止。

In the default parallel tool execution mode, sibling tool calls from the same assistant message are preflighted sequentially, then executed concurrently. `tool_call` is not guaranteed to see sibling tool results from that same assistant message in `ctx.sessionManager`.
在默认的并行工具执行模式下，来自同一条 assistant 消息的兄弟工具调用会先依次进行预检，然后并发执行。因此不能保证 `tool_call` 能在 `ctx.sessionManager` 中看到同一条 assistant 消息里其他兄弟工具的结果。

`event.input` is mutable. Mutate it in place to patch tool arguments before execution.
`event.input` 是可变的。可在执行前就地修改它以调整工具参数。

Behavior guarantees:
行为保证：
- Mutations to `event.input` affect the actual tool execution
  - 对 `event.input` 的修改会影响实际的工具执行
- Later `tool_call` handlers see mutations made by earlier handlers
  - 后续的 `tool_call` 处理器能看到之前处理器所做的修改
- No re-validation is performed after your mutation
  - 修改之后不会重新执行参数校验
- Return values from `tool_call` only control blocking via `{ block: true, reason?: string }`
  - `tool_call` 的返回值仅通过 `{ block: true, reason?: string }` 控制是否阻止执行

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

pi.on("tool_call", async (event, ctx) => {
  // event.toolName - "bash", "read", "write", "edit", etc.
  // event.toolCallId
  // event.input - tool parameters (mutable)

  // Built-in tools: no type params needed
  if (isToolCallEventType("bash", event)) {
    // event.input is { command: string; timeout?: number }
    event.input.command = `source ~/.profile\n${event.input.command}`;

    if (event.input.command.includes("rm -rf")) {
      return { block: true, reason: "Dangerous command" };
    }
  }

  if (isToolCallEventType("read", event)) {
    // event.input is { path: string; offset?: number; limit?: number }
    console.log(`Reading: ${event.input.path}`);
  }
});
```

#### Typing custom tool input 为自定义工具输入添加类型

Custom tools should export their input type:
自定义工具应当导出其输入类型：

```typescript
// my-extension.ts
export type MyToolInput = Static<typeof myToolSchema>;
```

Use `isToolCallEventType` with explicit type parameters:
配合显式类型参数使用 `isToolCallEventType`：

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { MyToolInput } from "my-extension";

pi.on("tool_call", (event) => {
  if (isToolCallEventType<"my_tool", MyToolInput>("my_tool", event)) {
    event.input.action;  // typed
  }
});
```

#### tool_result

Fired after tool execution finishes and before `tool_execution_end` plus the final tool result message events are emitted. **Can modify result.**
在工具执行完成之后、`tool_execution_end` 及最终工具结果消息事件发出之前触发。**可修改结果。**

In parallel tool mode, `tool_result` and `tool_execution_end` may interleave in tool completion order, while final `toolResult` message events are still emitted later in assistant source order.
在并行工具模式下，`tool_result` 和 `tool_execution_end` 可能按工具完成顺序交错出现，而最终的 `toolResult` 消息事件仍会在稍后按 assistant 消息中的原始顺序发出。

`tool_result` handlers chain like middleware:
`tool_result` 处理器像中间件（middleware）一样串联：
- Handlers run in extension load order
  - 处理器按扩展加载顺序运行
- Each handler sees the latest result after previous handler changes
  - 每个处理器看到的都是经前序处理器修改后的最新结果
- Handlers can return partial patches (`content`, `details`, `isError`, or `usage`); omitted fields keep their current values
  - 处理器可以返回部分补丁（`content`、`details`、`isError` 或 `usage`）；未提供的字段保持当前值

Use `ctx.signal` for nested async work inside the handler. This lets Esc cancel model calls, `fetch()`, and other abort-aware operations started by the extension.
在处理器内部执行嵌套异步工作时请使用 `ctx.signal`。这样按 Esc 就能取消扩展发起的模型调用、`fetch()` 以及其他支持中断的操作。

```typescript
import { isBashToolResult } from "@earendil-works/pi-coding-agent";

pi.on("tool_result", async (event, ctx) => {
  // event.toolName, event.toolCallId, event.input
  // event.content, event.details, event.isError, event.usage

  if (isBashToolResult(event)) {
    // event.details is typed as BashToolDetails
  }

  const response = await fetch("https://example.com/summarize", {
    method: "POST",
    body: JSON.stringify({ content: event.content }),
    signal: ctx.signal,
  });

  // Modify result:
  return { content: [...], details: {...}, isError: false, usage: nestedModelUsage };
});
```

### User Bash Events 用户 Bash 事件

#### user_bash

Fired when user executes `!` or `!!` commands. **Can intercept.**
当用户执行 `!` 或 `!!` 命令时触发。**可拦截。**

```typescript
import { createLocalBashOperations } from "@earendil-works/pi-coding-agent";

pi.on("user_bash", (event, ctx) => {
  // event.command - the bash command
  // event.excludeFromContext - true if !! prefix
  // event.cwd - working directory

  // Option 1: Provide custom operations (e.g., SSH)
  return { operations: remoteBashOps };

  // Option 2: Wrap pi's built-in local bash backend
  const local = createLocalBashOperations();
  return {
    operations: {
      exec(command, cwd, options) {
        return local.exec(`source ~/.profile\n${command}`, cwd, options);
      }
    }
  };

  // Option 3: Full replacement - return result directly
  return { result: { output: "...", exitCode: 0, cancelled: false, truncated: false } };
});
```

### Input Events 输入事件

#### input

Fired when user input is received, after extension commands are checked but before skill and template expansion. The event sees the raw input text, so `/skill:foo` and `/template` are not yet expanded.
在接收到用户输入时触发，时机位于扩展命令检查之后、skill 与模板展开之前。该事件看到的是原始输入文本，因此 `/skill:foo` 和 `/template` 尚未被展开。

**Processing order:**
**处理顺序：**
1. Extension commands (`/cmd`) checked first - if found, handler runs and input event is skipped
   1. 首先检查扩展命令（`/cmd`）—— 如果匹配，则运行其处理器并跳过 input 事件
2. `input` event fires - can intercept, transform, or handle
   2. 触发 `input` 事件 —— 可以拦截、转换或直接处理
3. If not handled: skill commands (`/skill:name`) expanded to skill content
   3. 若未被处理：skill 命令（`/skill:name`）会展开为 skill 内容
4. If not handled: prompt templates (`/template`) expanded to template content
   4. 若未被处理：prompt 模板（`/template`）会展开为模板内容
5. Agent processing begins (`before_agent_start`, etc.)
   5. 开始 agent 处理流程（`before_agent_start` 等）

```typescript
pi.on("input", async (event, ctx) => {
  // event.text - raw input (before skill/template expansion)
  // event.images - attached images, if any
  // event.source - "interactive" (typed), "rpc" (API), or "extension" (via sendUserMessage)
  // event.streamingBehavior - "steer" | "followUp" | undefined
  //   undefined when idle, "steer" for mid-stream interrupts,
  //   "followUp" for messages queued until the agent finishes

  // Transform: rewrite input before expansion
  if (event.text.startsWith("?quick "))
    return { action: "transform", text: `Respond briefly: ${event.text.slice(7)}` };

  // Handle: respond without LLM (extension shows its own feedback)
  if (event.text === "ping") {
    ctx.ui.notify("pong", "info");
    return { action: "handled" };
  }

  // Route by source: skip processing for extension-injected messages
  if (event.source === "extension") return { action: "continue" };

  // Intercept skill commands before expansion
  if (event.text.startsWith("/skill:")) {
    // Could transform, block, or let pass through
  }

  return { action: "continue" };  // Default: pass through to expansion
});
```

**Results:**
**返回结果：**
- `continue` - pass through unchanged (default if handler returns nothing)
  - `continue` —— 原样放行（处理器无返回值时的默认行为）
- `transform` - modify text/images, then continue to expansion
  - `transform` —— 修改文本/图片，然后继续进入展开阶段
- `handled` - skip agent entirely (first handler to return this wins)
  - `handled` —— 完全跳过 agent（第一个返回该值的处理器生效）

Transforms chain across handlers. See [input-transform.ts](../examples/extensions/input-transform.ts) and [input-transform-streaming.ts](../examples/extensions/input-transform-streaming.ts) for `streamingBehavior`-aware routing.
转换会在多个处理器之间串联。关于基于 `streamingBehavior` 的路由处理，参见 [input-transform.ts](../examples/extensions/input-transform.ts) 与 [input-transform-streaming.ts](../examples/extensions/input-transform-streaming.ts)。

## ExtensionContext 扩展上下文

All handlers receive `ctx: ExtensionContext`.
所有处理器都会接收到 `ctx: ExtensionContext`。

### ctx.ui

UI methods for user interaction. See [Custom UI](#custom-ui) for full details.
用于用户交互的 UI 方法。完整细节参见 [Custom UI](#custom-ui)。

### ctx.mode

Current run mode: `"tui"`, `"rpc"`, `"json"`, or `"print"`. Use `ctx.mode === "tui"` to guard terminal-only features such as `custom()`, component factories, terminal input, and direct TUI rendering.
当前运行模式：`"tui"`、`"rpc"`、`"json"` 或 `"print"`。可用 `ctx.mode === "tui"` 来保护仅限终端的功能，例如 `custom()`、组件工厂、终端输入以及直接的 TUI 渲染。

### ctx.hasUI

`true` in TUI and RPC modes. `false` in print mode (`-p`) and JSON mode. Use this to guard dialog methods (`select`, `confirm`, `input`, `editor`) and fire-and-forget methods (`notify`, `setStatus`, `setWidget`, `setTitle`, `setEditorText`) that work in both TUI and RPC modes. In RPC mode, some TUI-specific methods are no-ops or return defaults (see [rpc.md](rpc.md#extension-ui-protocol)).
在 TUI 和 RPC 模式下为 `true`。在 print 模式（`-p`）和 JSON 模式下为 `false`。可用它来保护对话框类方法（`select`、`confirm`、`input`、`editor`）以及"发后不理"类方法（`notify`、`setStatus`、`setWidget`、`setTitle`、`setEditorText`），这些方法在 TUI 与 RPC 模式下均可用。在 RPC 模式下，某些 TUI 专用方法为空操作或返回默认值（参见 [rpc.md](rpc.md#extension-ui-protocol)）。

### ctx.cwd

Current working directory.
当前工作目录。

Use `CONFIG_DIR_NAME` instead of hardcoding `.pi` when constructing project-local config paths. Rebranded distributions can use a different config directory name.
在构造项目本地配置路径时，请使用 `CONFIG_DIR_NAME` 而不要硬编码 `.pi`。经过品牌重塑的发行版可能使用不同的配置目录名。

```typescript
import { CONFIG_DIR_NAME, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    const projectConfigPath = join(ctx.cwd, CONFIG_DIR_NAME, "my-extension.json");
    // ...
  });
}
```

### ctx.isProjectTrusted()

Returns whether project-local trust is active for the current session context. This includes temporary trust decisions and CLI trust overrides, not just saved decisions in the global trust store.
返回当前会话上下文中项目本地信任是否已生效。这包含临时信任决定和 CLI 信任覆盖，而不仅仅是全局信任存储中已保存的决定。

Use this before reading project-local extension configuration that should only be honored for trusted projects.
在读取那些只应对受信任项目生效的项目本地扩展配置之前，请先调用它。

### ctx.sessionManager

Read-only access to session state. See [Session Format](session-format.md) for the full SessionManager API and entry types.
对会话状态的只读访问。完整的 SessionManager API 与条目（entry）类型请参见 [Session Format](session-format.md)。

For `tool_call`, this state is synchronized through the current assistant message before handlers run. In parallel tool execution mode it is still not guaranteed to include sibling tool results from the same assistant message.
对于 `tool_call`，该状态会在处理器运行前同步到当前这条 assistant 消息为止。在并行工具执行模式下，仍不能保证它包含同一条 assistant 消息中其他兄弟工具的结果。

```typescript
ctx.sessionManager.getEntries()             // All entries
ctx.sessionManager.getBranch()              // Current branch
ctx.sessionManager.buildContextEntries()    // Active branch entries with compaction applied
ctx.sessionManager.getLeafId()              // Current leaf entry ID
```

### ctx.modelRegistry / ctx.model / ctx.thinkingLevel / ctx.scopedModels

Access to models, providers, and resolved authentication. `ctx.modelRegistry.getProvider(id)` returns the effective pi-ai provider, while `getProviderAuth(id)` resolves its current API key, headers, base URL, and provider-scoped environment without requiring a loaded model. `ctx.model` is the active model, and `ctx.thinkingLevel` is its current effective thinking level.
用于访问模型、provider 以及已解析的认证信息。`ctx.modelRegistry.getProvider(id)` 返回生效的 pi-ai provider，而 `getProviderAuth(id)` 则可在无需加载模型的情况下解析出其当前的 API key、请求头、base URL 以及 provider 作用域内的环境变量。`ctx.model` 是当前激活的模型，`ctx.thinkingLevel` 是它当前生效的思考等级。

`ctx.scopedModels` is the read-only list of models scoped to the current session — the same set the `/scoped-models` command shows. It is resolved at session start from the `--models` CLI flag and the `enabledModels` setting (matched against the available catalogue with minimatch on `provider/modelId` or a bare `modelId`). It is empty when no scoping is configured, meaning every available model is usable. Each entry is `{ model, thinkingLevel? }`, where `thinkingLevel` is set only when a pattern pinned it (e.g. `anthropic/*:high`). Use it to populate a model picker that mirrors the built-in one instead of enumerating the whole catalogue via `ctx.modelRegistry.getAvailable()`.
`ctx.scopedModels` 是限定于当前会话的只读模型列表 —— 与 `/scoped-models` 命令展示的集合相同。它在会话启动时依据 `--models` CLI 标志和 `enabledModels` 设置解析得出（通过 minimatch 以 `provider/modelId` 或裸 `modelId` 的形式与可用模型目录匹配）。若未配置任何范围限定，该列表为空，表示所有可用模型均可使用。每个条目形如 `{ model, thinkingLevel? }`，其中 `thinkingLevel` 仅在某个模式将其固定时才会设置（例如 `anthropic/*:high`）。可用它来填充一个与内置选择器一致的模型选择器，而不必通过 `ctx.modelRegistry.getAvailable()` 枚举整个模型目录。

### ctx.signal

The current agent abort signal, or `undefined` when no agent turn is active.
当前 agent 的中断信号（abort signal）；当没有活跃的 agent 轮次时为 `undefined`。

Use this for abort-aware nested work started by extension handlers, for example:
在扩展处理器发起的、需要支持中断的嵌套工作中使用它，例如：
- `fetch(..., { signal: ctx.signal })`
- model calls that accept `signal`
  - 接受 `signal` 参数的模型调用
- file or process helpers that accept `AbortSignal`
  - 接受 `AbortSignal` 的文件或进程辅助函数

`ctx.signal` is typically defined during active turn events such as `tool_call`, `tool_result`, `message_update`, and `turn_end`.
`ctx.signal` 通常在活跃轮次的事件中有值，例如 `tool_call`、`tool_result`、`message_update` 和 `turn_end`。
It is usually `undefined` in idle or non-turn contexts such as session events, extension commands, and shortcuts fired while pi is idle.
在空闲或非轮次上下文中它通常为 `undefined`，例如会话事件、扩展命令，以及 pi 空闲时触发的快捷键。

```typescript
pi.on("tool_result", async (event, ctx) => {
  const response = await fetch("https://example.com/api", {
    method: "POST",
    body: JSON.stringify(event),
    signal: ctx.signal,
  });

  const data = await response.json();
  return { details: data };
});
```

### ctx.isIdle() / ctx.abort() / ctx.hasPendingMessages()

Control flow helpers. `ctx.isIdle()` is false while Pi is processing an agent run, automatic retry, auto-compaction retry, or queued continuation.
控制流辅助方法。当 Pi 正在处理一次 agent 运行、自动重试、自动压缩后重试或排队中的续跑时，`ctx.isIdle()` 返回 false。

### ctx.shutdown()

Request a graceful shutdown of pi.
请求优雅地关闭 pi。

- **Interactive mode:** Deferred until the agent becomes idle (after processing all queued steering and follow-up messages).
  - **交互模式：** 会推迟到 agent 进入空闲状态之后（在处理完所有排队的引导消息和后续消息之后）。
- **RPC mode:** Deferred until the next idle state (after completing the current command response, when waiting for the next command).
  - **RPC 模式：** 会推迟到下一次空闲状态（在完成当前命令的响应、等待下一条命令时）。
- **Print mode:** No-op. The process exits automatically when all prompts are processed.
  - **Print 模式：** 空操作。所有 prompt 处理完毕后进程会自动退出。

Emits `session_shutdown` event to all extensions before exiting. Available in all contexts (event handlers, tools, commands, shortcuts).
退出前会向所有扩展发出 `session_shutdown` 事件。在所有上下文中均可使用（事件处理器、工具、命令、快捷键）。

```typescript
pi.on("tool_call", (event, ctx) => {
  if (isFatal(event.input)) {
    ctx.shutdown();
  }
});
```

### ctx.getContextUsage()

Returns current context usage for the active model. Uses last assistant usage when available, then estimates tokens for trailing messages.
返回当前激活模型的上下文使用量。若可用，则采用最近一次 assistant 的用量数据，并对其后的消息估算 token 数。

```typescript
const usage = ctx.getContextUsage();
if (usage && usage.tokens > 100_000) {
  // ...
}
```

### ctx.compact()

Trigger compaction without awaiting completion. Use `onComplete` and `onError` for follow-up actions.
触发压缩（compaction），但不等待其完成。使用 `onComplete` 和 `onError` 处理后续动作。

```typescript
ctx.compact({
  customInstructions: "Focus on recent changes",
  onComplete: (result) => {
    ctx.ui.notify("Compaction completed", "info");
  },
  onError: (error) => {
    ctx.ui.notify(`Compaction failed: ${error.message}`, "error");
  },
});
```

### ctx.getSystemPrompt()

Returns Pi's current system prompt string.
返回 Pi 当前的 system prompt 字符串。

- During `before_agent_start`, this reflects chained system-prompt changes made so far for the current turn.
  - 在 `before_agent_start` 期间，它反映当前轮次中截至目前链式累积的 system prompt 修改。
- It does not include later `context` message mutations.
  - 它不包含之后 `context` 事件对消息所做的修改。
- It does not include `before_provider_request` payload rewrites.
  - 它不包含 `before_provider_request` 对请求负载的重写。
- If later-loaded extensions run after yours, they can still change what is ultimately sent.
  - 如果有加载顺序更靠后的扩展在你之后运行，它们仍可能改变最终发送的内容。

```typescript
pi.on("before_agent_start", (event, ctx) => {
  const prompt = ctx.getSystemPrompt();
  console.log(`System prompt length: ${prompt.length}`);
});
```

## ExtensionCommandContext 扩展命令上下文

Command handlers receive `ExtensionCommandContext`, which extends `ExtensionContext` with session control methods. These are only available in commands because they can deadlock if called from event handlers.
命令处理器接收 `ExtensionCommandContext`，它在 `ExtensionContext` 的基础上扩展了会话控制方法。这些方法仅在命令中可用，因为从事件处理器中调用它们可能导致死锁。

### ctx.getSystemPromptOptions()

Returns the base inputs Pi currently uses to build the system prompt.
返回 Pi 当前用于构建 system prompt 的基础输入。

```typescript
const options = ctx.getSystemPromptOptions();
const contextPaths = options.contextFiles?.map((file) => file.path) ?? [];
```

This has the same shape and mutability as `before_agent_start` `event.systemPromptOptions`: custom prompt, active tools, tool snippets, prompt guidelines, appended system prompt text, cwd, loaded context files, and loaded skills. It may include full context file contents, so treat it as sensitive extension-local data and avoid exposing it through command lists, logs, or autocomplete metadata.
它与 `before_agent_start` 中的 `event.systemPromptOptions` 具有相同的结构和可变性：自定义 prompt、活跃工具、工具简介片段、prompt 指导原则、追加的 system prompt 文本、cwd、已加载的上下文文件以及已加载的 skill。它可能包含完整的上下文文件内容，因此请将其视为扩展本地的敏感数据，避免通过命令列表、日志或自动补全元数据泄露出去。

This reports the current base prompt inputs. It does not include per-turn `before_agent_start` chained system-prompt changes, later `context` event message mutations, or `before_provider_request` payload rewrites.
它报告的是当前的基础 prompt 输入。它不包含每轮 `before_agent_start` 链式累积的 system prompt 修改、之后 `context` 事件对消息的修改，也不包含 `before_provider_request` 对请求负载的重写。

### ctx.waitForIdle()

Wait for the agent to fully settle, including automatic retries, auto-compaction retries, and queued continuations:
等待 agent 完全稳定下来，包括自动重试、自动压缩后重试以及排队中的续跑：

```typescript
pi.registerCommand("my-cmd", {
  handler: async (args, ctx) => {
    await ctx.waitForIdle();
    // Agent is now idle, safe to modify session
  },
});
```

### ctx.newSession(options?)

Create a new session:
创建一个新会话：

```typescript
const parentSession = ctx.sessionManager.getSessionFile();
const kickoff = "Continue in the replacement session";

const result = await ctx.newSession({
  parentSession,
  setup: async (sm) => {
    sm.appendMessage({
      role: "user",
      content: [{ type: "text", text: "Context from previous session..." }],
      timestamp: Date.now(),
    });
  },
  withSession: async (ctx) => {
    // Use only the replacement-session ctx here.
    await ctx.sendUserMessage(kickoff);
  },
});

if (result.cancelled) {
  // An extension cancelled the new session
}
```

Options:
选项：
- `parentSession`: parent session file to record in the new session header
  - `parentSession`：要记录在新会话头部的父会话文件
- `setup`: mutate the new session's `SessionManager` before `withSession` runs
  - `setup`：在 `withSession` 运行之前修改新会话的 `SessionManager`
- `withSession`: run post-switch work against a fresh replacement-session context. Do not use captured old `pi` / command `ctx`; see [Session replacement lifecycle and footguns](#session-replacement-lifecycle-and-footguns).
  - `withSession`：基于全新的替换会话上下文执行切换后的工作。不要使用先前捕获的旧 `pi` / 命令 `ctx`；参见[会话替换生命周期与常见陷阱](#session-replacement-lifecycle-and-footguns)。

### ctx.fork(entryId, options?)

Fork from a specific entry, creating a new session file:
从指定条目分叉，创建一个新的会话文件：

```typescript
const result = await ctx.fork("entry-id-123", {
  withSession: async (ctx) => {
    // Use only the replacement-session ctx here.
    ctx.ui.notify("Now in the forked session", "info");
  },
});
if (result.cancelled) {
  // An extension cancelled the fork
}

const cloneResult = await ctx.fork("entry-id-456", { position: "at" });
if (cloneResult.cancelled) {
  // An extension cancelled the clone
}
```

Options:
选项：
- `position`: `"before"` (default) forks before the selected user message, restoring that prompt into the editor
  - `position`：`"before"`（默认）表示在所选 user 消息之前分叉，并将该 prompt 恢复到编辑器中
- `position`: `"at"` duplicates the active path through the selected entry without restoring editor text
  - `position`：`"at"` 表示复制经过所选条目的活跃路径，但不恢复编辑器文本
- `withSession`: run post-switch work against a fresh replacement-session context. Do not use captured old `pi` / command `ctx`; see [Session replacement lifecycle and footguns](#session-replacement-lifecycle-and-footguns).
  - `withSession`：基于全新的替换会话上下文执行切换后的工作。不要使用先前捕获的旧 `pi` / 命令 `ctx`；参见[会话替换生命周期与常见陷阱](#session-replacement-lifecycle-and-footguns)。

### ctx.navigateTree(targetId, options?)

Navigate to a different point in the session tree:
导航到会话树中的另一个位置：

```typescript
const result = await ctx.navigateTree("entry-id-456", {
  summarize: true,
  customInstructions: "Focus on error handling changes",
  replaceInstructions: false, // true = replace default prompt entirely
  label: "review-checkpoint",
});
```

Options:
选项：
- `summarize`: Whether to generate a summary of the abandoned branch
  - `summarize`：是否为被放弃的分支生成摘要
- `customInstructions`: Custom instructions for the summarizer
  - `customInstructions`：给摘要生成器的自定义指令
- `replaceInstructions`: If true, `customInstructions` replaces the default prompt instead of being appended
  - `replaceInstructions`：若为 true，则 `customInstructions` 会替换默认 prompt，而不是追加在其后
- `label`: Label to attach to the branch summary entry (or target entry if not summarizing)
  - `label`：附加到分支摘要条目上的标签（若不生成摘要，则附加到目标条目上）

### ctx.switchSession(sessionPath, options?)

Switch to a different session file:
切换到另一个会话文件：

```typescript
const result = await ctx.switchSession("/path/to/session.jsonl", {
  withSession: async (ctx) => {
    await ctx.sendUserMessage("Resume work in the replacement session");
  },
});
if (result.cancelled) {
  // An extension cancelled the switch via session_before_switch
}
```

Options:
选项：
- `withSession`: run post-switch work against a fresh replacement-session context. Do not use captured old `pi` / command `ctx`; see [Session replacement lifecycle and footguns](#session-replacement-lifecycle-and-footguns).
  - `withSession`：基于全新的替换会话上下文执行切换后的工作。不要使用先前捕获的旧 `pi` / 命令 `ctx`；参见[会话替换生命周期与常见陷阱](#session-replacement-lifecycle-and-footguns)。

To discover available sessions, use the static `SessionManager.list()` or `SessionManager.listAll()` methods:
若要发现可用的会话，可使用静态方法 `SessionManager.list()` 或 `SessionManager.listAll()`：

```typescript
import { SessionManager } from "@earendil-works/pi-coding-agent";

pi.registerCommand("switch", {
  description: "Switch to another session",
  handler: async (args, ctx) => {
    const sessions = await SessionManager.list(ctx.cwd);
    if (sessions.length === 0) return;
    const choice = await ctx.ui.select(
      "Pick session:",
      sessions.map(s => s.file),
    );
    if (choice) {
      await ctx.switchSession(choice, {
        withSession: async (ctx) => {
          ctx.ui.notify("Switched session", "info");
        },
      });
    }
  },
});
```

### Session replacement lifecycle and footguns 会话替换生命周期与常见陷阱

`withSession` receives a fresh `ReplacedSessionContext`, which extends `ExtensionCommandContext` with async `sendMessage()` and `sendUserMessage()` helpers bound to the replacement session.
`withSession` 接收一个全新的 `ReplacedSessionContext`，它在 `ExtensionCommandContext` 基础上增加了绑定到替换会话的异步辅助方法 `sendMessage()` 和 `sendUserMessage()`。

Lifecycle and footguns:
生命周期与常见陷阱：
- `withSession` runs only after the old session has emitted `session_shutdown`, the old runtime has been torn down, the replacement session has been rebound, and the new extension instance has already received `session_start`.
  - `withSession` 只有在旧会话已发出 `session_shutdown`、旧运行时已被销毁、替换会话已重新绑定，且新扩展实例已收到 `session_start` 之后才会运行。
- The callback still executes in the original closure, not inside the new extension instance. That means your old extension instance may already have run its shutdown cleanup before `withSession` starts.
  - 该回调仍在原有的闭包中执行，而不是在新的扩展实例内部。这意味着在 `withSession` 开始之前，你的旧扩展实例可能已经执行完关闭清理逻辑。
- Captured old `pi` / old command `ctx` session-bound objects are stale after replacement and will throw if used. Use only the `ctx` passed to `withSession` for session-bound work.
  - 先前捕获的旧 `pi` / 旧命令 `ctx` 等会话绑定对象在替换之后即已失效，使用它们会抛出异常。会话相关的工作请只使用传入 `withSession` 的 `ctx`。
- Previously extracted raw objects are still your responsibility. For example, if you capture `const sm = ctx.sessionManager` before replacement, `sm` is still the old `SessionManager` object. Do not reuse it after replacement.
  - 你此前提取出的原始对象仍需自行负责。例如，如果在替换前捕获了 `const sm = ctx.sessionManager`，那么 `sm` 仍然是旧的 `SessionManager` 对象。替换之后不要再复用它。
- Code in `withSession` should assume any state invalidated by your `session_shutdown` handler is already gone. Only capture plain data that survives shutdown cleanly, such as strings, ids, and serialized config.
  - `withSession` 中的代码应当假定所有被你的 `session_shutdown` 处理器置为无效的状态都已不复存在。只应捕获能够安全跨越关闭流程的普通数据，例如字符串、ID 和已序列化的配置。

Safe pattern:
安全写法：

```typescript
pi.registerCommand("handoff", {
  handler: async (_args, ctx) => {
    const kickoff = "Continue from the replacement session";
    await ctx.newSession({
      withSession: async (ctx) => {
        await ctx.sendUserMessage(kickoff);
      },
    });
  },
});
```

Unsafe pattern:
危险写法：

```typescript
pi.registerCommand("handoff", {
  handler: async (_args, ctx) => {
    const oldSessionManager = ctx.sessionManager;
    await ctx.newSession({
      withSession: async (_ctx) => {
        // stale old objects: do not do this
        oldSessionManager.getSessionFile();
        pi.sendUserMessage("wrong");
      },
    });
  },
});
```

### ctx.reload()

Run the same reload flow as `/reload`.
执行与 `/reload` 相同的重载流程。

```typescript
pi.registerCommand("reload-runtime", {
  description: "Reload extensions, skills, prompts, themes, and context files",
  handler: async (_args, ctx) => {
    await ctx.reload();
    return;
  },
});
```

Important behavior:
重要行为说明：
- `await ctx.reload()` emits `session_shutdown` for the current extension runtime
  - `await ctx.reload()` 会为当前扩展运行时发出 `session_shutdown`
- It then reloads resources and emits `session_start` with `reason: "reload"` and `resources_discover` with reason `"reload"`
  - 随后它会重新加载资源，并发出 `reason: "reload"` 的 `session_start` 以及 reason 为 `"reload"` 的 `resources_discover`
- The currently running command handler still continues in the old call frame
  - 当前正在运行的命令处理器仍会在旧的调用栈帧中继续执行
- Code after `await ctx.reload()` still runs from the pre-reload version
  - `await ctx.reload()` 之后的代码仍然运行的是重载前的版本
- Code after `await ctx.reload()` must not assume old in-memory extension state is still valid
  - `await ctx.reload()` 之后的代码不得假定旧的扩展内存状态仍然有效
- After the handler returns, future commands/events/tool calls use the new extension version
  - 处理器返回之后，后续的命令/事件/工具调用将使用新版本的扩展

For predictable behavior, treat reload as terminal for that handler (`await ctx.reload(); return;`).
为了让行为可预测，请把 reload 视为该处理器的终止操作（`await ctx.reload(); return;`）。

Tools run with `ExtensionContext`, so they cannot call `ctx.reload()` directly. Use a command as the reload entrypoint, then expose a tool that queues that command as a follow-up user message.
工具运行时使用的是 `ExtensionContext`，因此无法直接调用 `ctx.reload()`。请用一个命令作为重载入口，再暴露一个工具，将该命令作为后续（follow-up）用户消息排入队列。

Example tool the LLM can call to trigger reload:
LLM 可调用以触发重载的示例工具：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("reload-runtime", {
    description: "Reload extensions, skills, prompts, themes, and context files",
    handler: async (_args, ctx) => {
      await ctx.reload();
      return;
    },
  });

  pi.registerTool({
    name: "reload_runtime",
    label: "Reload Runtime",
    description: "Reload extensions, skills, prompts, themes, and context files",
    parameters: Type.Object({}),
    async execute() {
      pi.sendUserMessage("/reload-runtime", { deliverAs: "followUp" });
      return {
        content: [{ type: "text", text: "Queued /reload-runtime as a follow-up command." }],
      };
    },
  });
}
```

## ExtensionAPI Methods ExtensionAPI 方法

### pi.on(event, handler)

Subscribe to events. See [Events](#events) for event types and return values.
订阅事件。事件类型及其返回值请参见 [Events](#events)。

### pi.registerTool(definition)

Register a custom tool callable by the LLM. See [Custom Tools](#custom-tools) for full details.
注册一个可供 LLM 调用的自定义工具。完整细节参见 [Custom Tools](#custom-tools)。

`pi.registerTool()` works both during extension load and after startup. You can call it inside `session_start`, command handlers, or other event handlers. New tools are refreshed immediately in the same session, so they appear in `pi.getAllTools()` and are callable by the LLM without `/reload`.
`pi.registerTool()` 在扩展加载期间和启动之后都可以使用。你可以在 `session_start`、命令处理器或其他事件处理器中调用它。新工具会在同一会话中立即刷新生效，因此无需 `/reload` 即会出现在 `pi.getAllTools()` 中并可被 LLM 调用。

Use `pi.setActiveTools()` to enable or disable tools (including dynamically added tools) at runtime.
使用 `pi.setActiveTools()` 可在运行时启用或禁用工具（包括动态添加的工具）。

Use `promptSnippet` to opt a custom tool into a one-line entry in `Available tools`, and `promptGuidelines` to append tool-specific bullets to the default `Guidelines` section when the tool is active.
使用 `promptSnippet` 可让自定义工具在 `Available tools` 中获得一行简介条目；使用 `promptGuidelines` 可在该工具处于激活状态时，向默认的 `Guidelines` 小节追加工具专属的要点条目。

**Important:** `promptGuidelines` bullets are appended flat to the `Guidelines` section with no tool name prefix. Each guideline must name the tool it refers to — avoid "Use this tool when..." because the LLM cannot tell which tool "this" means. Write "Use my_tool when..." instead.
**重要：** `promptGuidelines` 的条目会被平铺追加到 `Guidelines` 小节中，且不带工具名前缀。每条指导原则都必须写明它所指的工具 —— 避免使用"Use this tool when..."，因为 LLM 无法判断"this"指的是哪个工具。应写成"Use my_tool when..."。

See [dynamic-tools.ts](../examples/extensions/dynamic-tools.ts) for a full example.
完整示例参见 [dynamic-tools.ts](../examples/extensions/dynamic-tools.ts)。

```typescript
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does",
  promptSnippet: "Summarize or transform text according to action",
  promptGuidelines: ["Use my_tool when the user asks to summarize previously generated text."],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),
    text: Type.Optional(Type.String()),
  }),
  prepareArguments(args) {
    // Optional compatibility shim. Runs before schema validation.
    // Return the current schema shape, for example to fold legacy fields
    // into the modern parameter object.
    return args;
  },

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Stream progress
    onUpdate?.({ content: [{ type: "text", text: "Working..." }] });

    return {
      content: [{ type: "text", text: "Done" }],
      details: { result: "..." },
    };
  },

  // Optional: Custom rendering
  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
});
```

### pi.sendMessage(message, options?)

Inject a custom message into the session. Custom messages participate in LLM context. For durable TUI-only content that should not be sent to the LLM, use [`pi.appendEntry()`](#piappendentrycustomtype-data) with [`pi.registerEntryRenderer()`](#piregisterentryrenderercustomtype-renderer).
向会话中注入一条自定义消息。自定义消息会参与 LLM 上下文。若需要持久化但仅在 TUI 中显示、不发送给 LLM 的内容，请使用 [`pi.appendEntry()`](#piappendentrycustomtype-data) 搭配 [`pi.registerEntryRenderer()`](#piregisterentryrenderercustomtype-renderer)。

```typescript
pi.sendMessage({
  customType: "my-extension",
  content: "Message text",
  display: true,
  details: { ... },
}, {
  triggerTurn: true,
  deliverAs: "steer",
});
```

**Options:**
**选项：**
- `deliverAs` - Delivery mode:
  - `deliverAs` —— 投递模式：
  - `"steer"` (default) - Queues the message while streaming. Delivered after the current assistant turn finishes executing its tool calls, before the next LLM call.
    - `"steer"`（默认）—— 在流式输出期间将消息排队。会在当前 assistant 轮次执行完其工具调用之后、下一次 LLM 调用之前投递。
  - `"followUp"` - Waits for agent to finish. Delivered only when agent has no more tool calls.
    - `"followUp"` —— 等待 agent 完成。仅当 agent 不再有工具调用时才投递。
  - `"nextTurn"` - Queued for next user prompt. Does not interrupt or trigger anything.
    - `"nextTurn"` —— 排队等待下一次用户 prompt。不会打断也不会触发任何操作。
- `triggerTurn: true` - If agent is idle, trigger an LLM response immediately. Only applies to `"steer"` and `"followUp"` modes (ignored for `"nextTurn"`).
  - `triggerTurn: true` —— 如果 agent 处于空闲状态，立即触发一次 LLM 响应。仅适用于 `"steer"` 和 `"followUp"` 模式（对 `"nextTurn"` 会被忽略）。

### pi.sendUserMessage(content, options?)

Send a user message to the agent. Unlike `sendMessage()` which sends custom messages, this sends an actual user message that appears as if typed by the user. Always triggers a turn.
向 agent 发送一条用户消息。与发送自定义消息的 `sendMessage()` 不同，它发送的是真正的 user 消息，显示效果如同用户亲自输入。它总会触发一个轮次。

```typescript
// Simple text message
pi.sendUserMessage("What is 2+2?");

// With content array (text + images)
pi.sendUserMessage([
  { type: "text", text: "Describe this image:" },
  { type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } },
]);

// During streaming - must specify delivery mode
pi.sendUserMessage("Focus on error handling", { deliverAs: "steer" });
pi.sendUserMessage("And then summarize", { deliverAs: "followUp" });
```

**Options:**
**选项：**
- `deliverAs` - Required when agent is streaming:
  - `deliverAs` —— 当 agent 正在流式输出时必填：
  - `"steer"` - Queues the message for delivery after the current assistant turn finishes executing its tool calls
    - `"steer"` —— 将消息排队，在当前 assistant 轮次执行完其工具调用之后投递
  - `"followUp"` - Waits for agent to finish all tools
    - `"followUp"` —— 等待 agent 完成所有工具调用

When not streaming, the message is sent immediately and triggers a new turn. When streaming without `deliverAs`, throws an error.
非流式输出状态下，消息会立即发送并触发新的轮次。若在流式输出期间未提供 `deliverAs`，则会抛出错误。

See [send-user-message.ts](../examples/extensions/send-user-message.ts) for a complete example.
完整示例参见 [send-user-message.ts](../examples/extensions/send-user-message.ts)。

### pi.appendEntry(customType, data?)

Persist extension data. Custom entries do NOT participate in LLM context. In interactive mode, they can also render inside the chat transcript when paired with `pi.registerEntryRenderer()`.
持久化扩展数据。自定义条目（custom entry）**不会**参与 LLM 上下文。在交互模式下，若搭配 `pi.registerEntryRenderer()`，它们也可以渲染在聊天记录中。

```typescript
pi.appendEntry("my-state", { count: 42 });
pi.appendEntry("status-card", { title: "Indexed files", count: 17 });

// Restore on reload
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "my-state") {
      // Reconstruct from entry.data
    }
  }
});
```

### pi.setSessionName(name)

Set the session display name (shown in session selector instead of first message).
设置会话显示名称（在会话选择器中显示，用以替代首条消息）。

```typescript
pi.setSessionName("Refactor auth module");
```

### pi.getSessionName()

Get the current session name, if set.
获取当前会话名称（如果已设置）。

```typescript
const name = pi.getSessionName();
if (name) {
  console.log(`Session: ${name}`);
}
```

### pi.setLabel(entryId, label)

Set or clear a label on an entry. Labels are user-defined markers for bookmarking and navigation (shown in `/tree` selector).
为某个条目设置或清除标签（label）。标签是用户自定义的标记，用于书签与导航（会显示在 `/tree` 选择器中）。

```typescript
// Set a label
pi.setLabel(entryId, "checkpoint-before-refactor");

// Clear a label
pi.setLabel(entryId, undefined);

// Read labels via sessionManager
const label = ctx.sessionManager.getLabel(entryId);
```

Labels persist in the session and survive restarts. Use them to mark important points (turns, checkpoints) in the conversation tree.
标签会持久化保存在会话中，并在重启后依然存在。可用它们标记对话树中的重要节点（轮次、检查点）。

### pi.registerCommand(name, options)

Register a command.
注册一个命令。

If multiple extensions register the same command name, pi keeps them all and assigns numeric invocation suffixes in load order, for example `/review:1` and `/review:2`.
如果多个扩展注册了同名命令，pi 会全部保留，并按加载顺序分配数字调用后缀，例如 `/review:1` 和 `/review:2`。

```typescript
pi.registerCommand("stats", {
  description: "Show session statistics",
  handler: async (args, ctx) => {
    const count = ctx.sessionManager.getEntries().length;
    ctx.ui.notify(`${count} entries`, "info");
  }
});
```

Optional: add argument auto-completion for `/command ...`:
可选：为 `/command ...` 添加参数自动补全：

```typescript
import type { AutocompleteItem } from "@earendil-works/pi-tui";

pi.registerCommand("deploy", {
  description: "Deploy to an environment",
  getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
    const envs = ["dev", "staging", "prod"];
    const items = envs.map((e) => ({ value: e, label: e }));
    const filtered = items.filter((i) => i.value.startsWith(prefix));
    return filtered.length > 0 ? filtered : null;
  },
  handler: async (args, ctx) => {
    ctx.ui.notify(`Deploying: ${args}`, "info");
  },
});
```

### pi.getCommands()

Get the slash commands available for invocation via `prompt` in the current session. Includes extension commands, prompt templates, and skill commands.
获取当前会话中可通过 `prompt` 调用的斜杠命令。包括扩展命令、prompt 模板和 skill 命令。
The list matches the RPC `get_commands` ordering: extensions first, then templates, then skills.
该列表的顺序与 RPC `get_commands` 一致：先扩展，然后模板，最后 skill。

```typescript
const commands = pi.getCommands();
const bySource = commands.filter((command) => command.source === "extension");
const userScoped = commands.filter((command) => command.sourceInfo.scope === "user");
```

Each entry has this shape:
每个条目的结构如下：

```typescript
{
  name: string; // Invokable command name without the leading slash. May be suffixed like "review:1"
  description?: string;
  source: "extension" | "prompt" | "skill";
  sourceInfo: {
    path: string;
    source: string;
    scope: "user" | "project" | "temporary";
    origin: "package" | "top-level";
    baseDir?: string;
  };
}
```

Use `sourceInfo` as the canonical provenance field. Do not infer ownership from command names or from ad hoc path parsing.
请以 `sourceInfo` 作为标准的来源信息字段。不要通过命令名或临时的路径解析来推断归属。

Built-in interactive commands (like `/model` and `/settings`) are not included here. They are handled only in interactive
mode and would not execute if sent via `prompt`.
内置的交互式命令（如 `/model` 和 `/settings`）不包含在其中。它们仅在交互模式下处理，通过 `prompt` 发送时不会执行。

### pi.registerMessageRenderer(customType, renderer)

Register a custom TUI renderer for custom messages with your `customType`. Custom messages are created with `pi.sendMessage()` and participate in LLM context. See [Custom UI](#custom-ui).
为带有你指定 `customType` 的自定义消息注册自定义 TUI 渲染器。自定义消息由 `pi.sendMessage()` 创建，并会参与 LLM 上下文。参见 [Custom UI](#custom-ui)。

### pi.registerMarkdownTransformer(transformer)

Register a transformer for the Markdown in normal user text, assistant text, and thinking blocks. Transformers run in extension load order, and each transformer receives the Markdown returned by the previous transformer. After the chain finishes, Pi renders the transformed content with its built-in renderer.
为普通 user 文本、assistant 文本以及思考（thinking）块中的 Markdown 注册转换器。转换器按扩展加载顺序运行，每个转换器接收上一个转换器返回的 Markdown。整条链执行完毕后，Pi 会用其内置渲染器渲染转换后的内容。

The transformer receives the Markdown string and a context with:
转换器接收 Markdown 字符串以及一个包含下列字段的上下文：

- `messageType` — `"user"`, `"assistant"`, or `"assistant-thinking"`
  - `messageType` —— `"user"`、`"assistant"` 或 `"assistant-thinking"`
- `isStreaming` — `true` for partial assistant updates; `false` for user, finalized assistant, and restored messages
  - `isStreaming` —— 对于 assistant 的增量更新为 `true`；对于 user 消息、已完成的 assistant 消息以及恢复的消息为 `false`
- `availableWidth` — exact terminal columns available for the transformed Markdown content
  - `availableWidth` —— 转换后的 Markdown 内容可用的确切终端列数

Return the transformed Markdown:
返回转换后的 Markdown：

```typescript
pi.registerMarkdownTransformer((markdown, { messageType, isStreaming }) => {
  if (isStreaming || messageType === "assistant-thinking") return markdown;
  return markdown.replaceAll("-->", "→");
});
```

If a transformer throws, Pi keeps the Markdown produced so far and continues with the next transformer. The hook is display-only: the original message remains unchanged in the session and model context. It runs for new user messages, assistant streaming updates, restored session messages, and terminal width changes, so transformers should remain synchronous and inexpensive.
如果某个转换器抛出异常，Pi 会保留截至目前生成的 Markdown 并继续执行下一个转换器。该钩子仅影响显示：原始消息在会话和模型上下文中保持不变。它会在新的 user 消息、assistant 流式更新、恢复的会话消息以及终端宽度变化时运行，因此转换器应保持同步且开销低廉。

### pi.registerEntryRenderer(customType, renderer)

Register a custom TUI renderer for custom entries with your `customType`. Custom entries are created with `pi.appendEntry()` and do not participate in LLM context.
为带有你指定 `customType` 的自定义条目注册自定义 TUI 渲染器。自定义条目由 `pi.appendEntry()` 创建，且不会参与 LLM 上下文。

```typescript
import { Box, Text } from "@earendil-works/pi-tui";

pi.registerEntryRenderer("status-card", (entry, { expanded }, theme) => {
  const data = entry.data as { title: string; count: number };
  const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
  box.addChild(new Text(`${theme.bold(data.title)}: ${data.count}`));
  if (expanded) {
    box.addChild(new Text(theme.fg("dim", JSON.stringify(data, null, 2))));
  }
  return box;
});

pi.appendEntry("status-card", { title: "Indexed files", count: 17 });
```

### pi.registerShortcut(shortcut, options)

Register a keyboard shortcut. See [keybindings.md](keybindings.md) for the shortcut format and built-in keybindings.
注册一个键盘快捷键。快捷键格式和内置键位绑定请参见 [keybindings.md](keybindings.md)。

```typescript
pi.registerShortcut("ctrl+shift+p", {
  description: "Toggle plan mode",
  handler: async (ctx) => {
    ctx.ui.notify("Toggled!");
  },
});
```

### pi.registerFlag(name, options)

Register a CLI flag.
注册一个 CLI 标志（flag）。

```typescript
pi.registerFlag("plan", {
  description: "Start in plan mode",
  type: "boolean",
  default: false,
});

// Check value
if (pi.getFlag("plan")) {
  // Plan mode enabled
}
```

### pi.exec(command, args, options?)

Execute a shell command.
执行一条 shell 命令。

```typescript
const result = await pi.exec("git", ["status"], { signal, timeout: 5000 });
// result.stdout, result.stderr, result.code, result.killed
```

### pi.getActiveTools() / pi.getAllTools() / pi.setActiveTools(names)

Manage active tools. This works for both built-in tools and dynamically registered tools. `pi.getActiveTools()` returns the active tool names as `string[]`; `pi.getAllTools()` returns metadata for all configured tools.
管理处于激活状态的工具。它对内置工具和动态注册的工具都有效。`pi.getActiveTools()` 以 `string[]` 形式返回激活工具的名称；`pi.getAllTools()` 返回所有已配置工具的元数据。

```typescript
const active = pi.getActiveTools(); // ["read", "bash", ...]
const all = pi.getAllTools();
// all = [{
//   name: "read",
//   description: "Read file contents...",
//   parameters: ...,
//   promptGuidelines: ["Use read to examine files instead of cat or sed."],
//   sourceInfo: { path: "<builtin:read>", source: "builtin", scope: "temporary", origin: "top-level" }
// }, ...]
const builtinTools = all.filter((t) => t.sourceInfo.source === "builtin");
const extensionTools = all.filter((t) => t.sourceInfo.source !== "builtin" && t.sourceInfo.source !== "sdk");
pi.setActiveTools([...new Set([...active, "my_custom_tool"])]); // Keep current tools and enable my_custom_tool
pi.setActiveTools(["read", "bash"]); // Switch to read-only
```

`pi.getAllTools()` returns `name`, `description`, `parameters`, `promptGuidelines`, and `sourceInfo`.
`pi.getAllTools()` 返回 `name`、`description`、`parameters`、`promptGuidelines` 和 `sourceInfo`。

Typical `sourceInfo.source` values:
`sourceInfo.source` 的典型取值：
- `builtin` for built-in tools
  - `builtin` 表示内置工具
- `sdk` for tools passed via `createAgentSession({ customTools })`
  - `sdk` 表示通过 `createAgentSession({ customTools })` 传入的工具
- extension source metadata for tools registered by extensions
  - 由扩展注册的工具则为扩展来源元数据

### pi.setModel(model)

Set the current model. Returns `false` if no API key is available for the model. See [models.md](models.md) for configuring custom models.
设置当前模型。如果该模型没有可用的 API key，则返回 `false`。自定义模型的配置方式请参见 [models.md](models.md)。

```typescript
const model = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5");
if (model) {
  const success = await pi.setModel(model);
  if (!success) {
    ctx.ui.notify("No API key for this model", "error");
  }
}
```

### pi.getThinkingLevel() / pi.setThinkingLevel(level)

Get or set the thinking level. Level is clamped to model capabilities (non-reasoning models always use "off"). Changes emit `thinking_level_select`.
获取或设置思考等级。该等级会被限制在模型能力范围内（不支持推理的模型始终为 "off"）。变更时会发出 `thinking_level_select` 事件。

```typescript
const current = pi.getThinkingLevel();  // "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"
pi.setThinkingLevel("high");
```

### pi.events

Shared event bus for communication between extensions:
用于扩展之间通信的共享事件总线：

```typescript
pi.events.on("my:event", (data) => { ... });
pi.events.emit("my:event", { ... });
```

### pi.registerProvider(name, config)

Register or override a model provider dynamically. Useful for proxies, custom endpoints, or team-wide model configurations.
动态注册或覆盖一个模型 provider。适用于代理、自定义端点或团队级的模型配置。

Calls made during the extension factory function are queued and applied once the runner initialises. Calls made after that — for example from a command handler following a user setup flow — take effect immediately without requiring a `/reload`.
在扩展工厂函数执行期间发起的调用会被排队，待运行器初始化后统一应用。之后发起的调用 —— 例如在用户完成配置流程后由命令处理器发起的调用 —— 会立即生效，无需 `/reload`。

Dynamic providers can implement `refreshModels`. Pi calls it during model refresh, publishes the returned list synchronously through the provider, and passes the canonical credential/store/network/signal context. The extension decides whether to persist the catalog through `context.store`; live servers such as llama.cpp can ignore it.
动态 provider 可以实现 `refreshModels`。Pi 会在模型刷新时调用它，将返回的列表同步地通过该 provider 发布出去，并传入标准的凭据/存储/网络/信号上下文。是否通过 `context.store` 持久化模型目录由扩展自行决定；像 llama.cpp 这类实时服务可以忽略它。

Extensions that need native provider auth, filtering, refresh, or stream behavior can register a complete `Provider` from `@earendil-works/pi-ai`. The provider becomes the composition base and `models.json` overrides still apply above it.
如果扩展需要原生的 provider 认证、过滤、刷新或流式行为，可以注册一个来自 `@earendil-works/pi-ai` 的完整 `Provider`。该 provider 会成为组合的基础层，`models.json` 中的覆盖配置仍会叠加在其之上。

```typescript
import { createProvider, openAICompletionsApi } from "@earendil-works/pi-ai";

const provider = createProvider({
  id: "local-server",
  name: "Local Server",
  baseUrl: "http://localhost:8080/v1",
  auth: {
    apiKey: {
      name: "Local server setup",
      async login(interaction) {
        return {
          type: "api_key",
          key: await interaction.prompt({ type: "secret", message: "API key" }),
        };
      },
      async resolve({ credential }) {
        return credential?.key
          ? { auth: { apiKey: credential.key }, source: "stored API key" }
          : undefined;
      },
    },
  },
  models: [],
  api: openAICompletionsApi(),
});

pi.registerProvider(provider);

// Register a new provider with custom models
pi.registerProvider("my-proxy", {
  name: "My Proxy",
  baseUrl: "https://proxy.example.com",
  apiKey: "$PROXY_API_KEY",  // env var reference
  api: "anthropic-messages",
  models: [
    {
      id: "claude-sonnet-4-20250514",
      name: "Claude 4 Sonnet (proxy)",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 16384
    }
  ]
});

// Register a live llama.cpp catalog without persisting discovered models
pi.registerProvider("llama.cpp", {
  baseUrl: "http://localhost:8080/v1",
  apiKey: "local",
  api: "openai-completions",
  async refreshModels({ signal }) {
    const response = await fetch("http://localhost:8080/v1/models", { signal });
    const { data } = await response.json();
    return data.map(({ id }) => ({
      id,
      name: id,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 16384
    }));
  }
});

// Override baseUrl for an existing provider (keeps all models)
pi.registerProvider("anthropic", {
  baseUrl: "https://proxy.example.com"
});

// Register provider with OAuth support for /login
pi.registerProvider("corporate-ai", {
  baseUrl: "https://ai.corp.com",
  api: "openai-responses",
  models: [...],
  oauth: {
    name: "Corporate AI (SSO)",
    async login(callbacks) {
      // Custom OAuth flow
      callbacks.onAuth({ url: "https://sso.corp.com/..." });
      const code = await callbacks.onPrompt({ message: "Enter code:" });
      return { refresh: code, access: code, expires: Date.now() + 3600000 };
    },
    async refreshToken(credentials) {
      // Refresh logic
      return credentials;
    },
    getApiKey(credentials) {
      return credentials.access;
    }
  }
});
```

The object form accepts a complete pi-ai `Provider`, including native `auth`, `getModels`, `refreshModels`, `filterModels`, `stream`, and `streamSimple` behavior.
对象形式可接受一个完整的 pi-ai `Provider`，包括原生的 `auth`、`getModels`、`refreshModels`、`filterModels`、`stream` 和 `streamSimple` 行为。

**Legacy config options:**
**旧版配置选项：**
- `name` - Display name for the provider in UI such as `/login`.
  - `name` —— provider 在 UI（如 `/login`）中显示的名称。
- `baseUrl` - API endpoint URL. Required when defining models.
  - `baseUrl` —— API 端点 URL。定义模型时必填。
- `apiKey` - API key literal, environment interpolation (`$ENV_VAR` or `${ENV_VAR}`), or leading `!command`. Required when defining models (unless `oauth` provided). `$$` escapes `$`, and `$!` escapes a literal `!` without triggering command execution.
  - `apiKey` —— API key 字面量、环境变量插值（`$ENV_VAR` 或 `${ENV_VAR}`），或以 `!command` 开头的命令。定义模型时必填（除非提供了 `oauth`）。`$$` 用于转义 `$`，`$!` 用于转义字面量 `!` 而不触发命令执行。
- `api` - API type: `"anthropic-messages"`, `"openai-completions"`, `"openai-responses"`, etc.
  - `api` —— API 类型：`"anthropic-messages"`、`"openai-completions"`、`"openai-responses"` 等。
- `headers` - Custom headers to include in requests.
  - `headers` —— 要包含在请求中的自定义请求头。
- `authHeader` - If true, adds `Authorization: Bearer` header automatically.
  - `authHeader` —— 若为 true，则自动添加 `Authorization: Bearer` 请求头。
- `models` - Array of model definitions. If provided, replaces all existing models for this provider. Model definitions can set `baseUrl` to override the provider endpoint for that model.
  - `models` —— 模型定义数组。若提供，则替换该 provider 现有的全部模型。模型定义中可设置 `baseUrl` 以覆盖该模型所用的 provider 端点。
- `refreshModels` - Async dynamic discovery callback. Its returned models replace extension-provided models. Use the scoped `context.store` only when results should persist.
  - `refreshModels` —— 异步动态发现回调。其返回的模型会替换扩展提供的模型。只有在结果需要持久化时才使用作用域内的 `context.store`。
- `oauth` - OAuth provider config for `/login` support. When provided, the provider appears in the login menu.
  - `oauth` —— 用于支持 `/login` 的 OAuth provider 配置。若提供，该 provider 会出现在登录菜单中。
- `streamSimple` - Custom streaming implementation for non-standard APIs.
  - `streamSimple` —— 针对非标准 API 的自定义流式实现。

See [custom-provider.md](custom-provider.md) for advanced topics: custom streaming APIs, OAuth details, model definition reference.
进阶主题请参见 [custom-provider.md](custom-provider.md)：自定义流式 API、OAuth 细节、模型定义参考。

### pi.unregisterProvider(name)

Remove a previously registered provider and its models. Built-in models that were overridden by the provider are restored. Has no effect if the provider was not registered.
移除先前注册的 provider 及其模型。被该 provider 覆盖的内置模型会被恢复。若该 provider 未注册过，则此调用无任何效果。

Like `registerProvider`, this takes effect immediately when called after the initial load phase, so a `/reload` is not required.
与 `registerProvider` 一样，在初始加载阶段之后调用时会立即生效，因此无需 `/reload`。

```typescript
pi.registerCommand("my-setup-teardown", {
  description: "Remove the custom proxy provider",
  handler: async (_args, _ctx) => {
    pi.unregisterProvider("my-proxy");
  },
});
```

## State Management 状态管理

Extensions with state should store it in tool result `details` for proper branching support:
有状态的扩展应将状态存储在工具结果的 `details` 中，以便正确支持分支：

```typescript
export default function (pi: ExtensionAPI) {
  let items: string[] = [];

  // Reconstruct state from session
  pi.on("session_start", async (_event, ctx) => {
    items = [];
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "message" && entry.message.role === "toolResult") {
        if (entry.message.toolName === "my_tool") {
          items = entry.message.details?.items ?? [];
        }
      }
    }
  });

  pi.registerTool({
    name: "my_tool",
    // ...
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      items.push("new item");
      return {
        content: [{ type: "text", text: "Added" }],
        details: { items: [...items] },  // Store for reconstruction
      };
    },
  });
}
```

## Custom Tools 自定义工具

Register tools the LLM can call via `pi.registerTool()`. Tools appear in the system prompt and can have custom rendering.
通过 `pi.registerTool()` 注册可供 LLM 调用的工具。工具会出现在 system prompt 中，并且可以拥有自定义渲染。

Use `promptSnippet` for a short one-line entry in the `Available tools` section in the default system prompt. If omitted, custom tools are left out of that section.
使用 `promptSnippet` 可在默认 system prompt 的 `Available tools` 小节中生成一行简短条目。若省略，自定义工具将不会出现在该小节中。

Use `promptGuidelines` to add tool-specific bullets to the default system prompt `Guidelines` section. These bullets are included only while the tool is active (for example, after `pi.setActiveTools([...])`).
使用 `promptGuidelines` 可向默认 system prompt 的 `Guidelines` 小节添加工具专属的要点条目。这些条目仅在该工具处于激活状态时才会被包含（例如在调用 `pi.setActiveTools([...])` 之后）。

**Important:** `promptGuidelines` bullets are appended flat to the `Guidelines` section with no tool name prefix or grouping. Each guideline must name the tool it refers to — avoid "Use this tool when..." because the LLM cannot tell which tool "this" means. Write "Use my_tool when..." instead.
**重要：** `promptGuidelines` 的条目会被平铺追加到 `Guidelines` 小节中，既无工具名前缀也无分组。每条指导原则都必须写明其所指的工具 —— 避免使用"Use this tool when..."，因为 LLM 无法判断"this"指的是哪个工具。应写成"Use my_tool when..."。

Note: Some models are idiots and include the @ prefix in tool path arguments. Built-in tools strip a leading @ before resolving paths. If your custom tool accepts a path, normalize a leading @ as well.
注意：某些模型很蠢，会在工具的路径参数中带上 @ 前缀。内置工具在解析路径前会剥离开头的 @。如果你的自定义工具接受路径参数，也请同样对开头的 @ 做归一化处理。

If your custom tool mutates files, use `withFileMutationQueue()` so it participates in the same per-file queue as built-in `edit` and `write`. This matters because tool calls run in parallel by default. Without the queue, two tools can read the same old file contents, compute different updates, and then whichever write lands last overwrites the other.
如果你的自定义工具会修改文件，请使用 `withFileMutationQueue()`，使其参与到与内置 `edit` 和 `write` 相同的按文件排队机制中。这一点很重要，因为工具调用默认是并行执行的。若不使用该队列，两个工具可能读取到相同的旧文件内容、计算出不同的更新结果，最后写入的那个会覆盖另一个。

Example failure case: your custom tool edits `foo.ts` while built-in `edit` also changes `foo.ts` in the same assistant turn. If your tool does not participate in the queue, both can read the original `foo.ts`, apply separate changes, and one of those changes is lost.
失败案例示例：在同一个 assistant 轮次中，你的自定义工具编辑了 `foo.ts`，而内置的 `edit` 也修改了 `foo.ts`。如果你的工具没有参与队列，两者都可能读取原始的 `foo.ts`、分别应用各自的修改，其中一个修改就会丢失。

Pass the real target file path to `withFileMutationQueue()`, not the raw user argument. Resolve it to an absolute path first, relative to `ctx.cwd` or your tool's working directory. For existing files, the helper canonicalizes through `realpath()`, so symlink aliases for the same file share one queue. For new files, it falls back to the resolved absolute path because there is nothing to `realpath()` yet.
请把真实的目标文件路径传给 `withFileMutationQueue()`，而不是原始的用户参数。先将其解析为绝对路径（相对于 `ctx.cwd` 或你的工具的工作目录）。对于已存在的文件，该辅助函数会通过 `realpath()` 做规范化，因此指向同一文件的符号链接别名会共享同一个队列。对于新文件，它会退回使用解析后的绝对路径，因为此时还没有可供 `realpath()` 解析的目标。

Queue the entire mutation window on that target path. That includes read-modify-write logic, not just the final write.
请把整个修改窗口都放入该目标路径的队列中，包括"读取-修改-写入"的完整逻辑，而不仅仅是最后的写入操作。

```typescript
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
  const absolutePath = resolve(ctx.cwd, params.path);

  return withFileMutationQueue(absolutePath, async () => {
    await mkdir(dirname(absolutePath), { recursive: true });
    const current = await readFile(absolutePath, "utf8");
    const next = current.replace(params.oldText, params.newText);
    await writeFile(absolutePath, next, "utf8");

    return {
      content: [{ type: "text", text: `Updated ${params.path}` }],
      details: {},
    };
  });
}
```

### Tool Definition 工具定义

```typescript
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does (shown to LLM)",
  promptSnippet: "List or add items in the project todo list",
  promptGuidelines: [
    "Use my_tool for todo planning instead of direct file edits when the user asks for a task list."
  ],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),  // Use StringEnum for Google compatibility
    text: Type.Optional(Type.String()),
  }),
  prepareArguments(args) {
    if (!args || typeof args !== "object") return args;
    const input = args as { action?: string; oldAction?: string };
    if (typeof input.oldAction === "string" && input.action === undefined) {
      return { ...input, action: input.oldAction };
    }
    return args;
  },

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Check for cancellation
    if (signal?.aborted) {
      return { content: [{ type: "text", text: "Cancelled" }] };
    }

    // Stream progress updates
    onUpdate?.({
      content: [{ type: "text", text: "Working..." }],
      details: { progress: 50 },
    });

    // Run commands via pi.exec (captured from extension closure)
    const result = await pi.exec("some-command", [], { signal });

    // Return result
    return {
      content: [{ type: "text", text: "Done" }],  // Sent to LLM
      details: { data: result },                   // For rendering & state
      // usage: nestedModelResponse.usage,          // Optional nested LLM usage
      // Optional: stop after this tool batch when every finalized tool result
      // in the batch also returns terminate: true.
      terminate: true,
    };
  },

  // Optional: Custom rendering
  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
});
```

**Usage accounting:** If a tool makes nested LLM calls, return their combined `Usage` as `usage`. Pi persists it on the tool result and includes it in footer, `/session`, and RPC session totals. `tool_result` handlers can inspect or replace this value.
**用量统计：** 如果工具内部发起了嵌套的 LLM 调用，请将其合并后的 `Usage` 作为 `usage` 返回。Pi 会将其持久化到工具结果上，并计入页脚、`/session` 以及 RPC 会话总计中。`tool_result` 处理器可以检查或替换该值。

**Signaling errors:** To mark a tool execution as failed (sets `isError: true` on the result and reports it to the LLM), throw an error from `execute`. Returning a value never sets the error flag regardless of what properties you include in the return object.
**报告错误：** 若要将一次工具执行标记为失败（在结果上设置 `isError: true` 并向 LLM 报告），请在 `execute` 中抛出错误。无论你在返回对象中包含哪些属性，返回值都不会设置错误标志。

**Early termination:** Return `terminate: true` from `execute()` to hint that the automatic follow-up LLM call should be skipped after the current tool batch. This only takes effect when every finalized tool result in that batch is terminating. See [examples/extensions/structured-output.ts](../examples/extensions/structured-output.ts) for a minimal example where the agent ends on a final structured-output tool call.
**提前终止：** 从 `execute()` 返回 `terminate: true`，用以提示在当前这批工具执行完毕后应跳过自动的后续 LLM 调用。只有当该批次中所有最终确定的工具结果都为终止状态时才会生效。参见 [examples/extensions/structured-output.ts](../examples/extensions/structured-output.ts) 中的最小示例，其中 agent 在最后一次结构化输出工具调用后结束。

```typescript
// Correct: throw to signal an error
async execute(toolCallId, params) {
  if (!isValid(params.input)) {
    throw new Error(`Invalid input: ${params.input}`);
  }
  return { content: [{ type: "text", text: "OK" }], details: {} };
}
```

**Important:** Use `StringEnum` from `@earendil-works/pi-ai` for string enums. `Type.Union`/`Type.Literal` doesn't work with Google's API.
**重要：** 字符串枚举请使用 `@earendil-works/pi-ai` 中的 `StringEnum`。`Type.Union`/`Type.Literal` 在 Google 的 API 上无法正常工作。

**Argument preparation:** `prepareArguments(args)` is optional. If defined, it runs before schema validation and before `execute()`. Use it to mimic an older accepted input shape when pi resumes an older session whose stored tool call arguments no longer match the current schema. Return the object you want validated against `parameters`. Keep the public schema strict. Do not add deprecated compatibility fields to `parameters` just to keep old resumed sessions working.
**参数预处理：** `prepareArguments(args)` 是可选的。若定义了它，它会在 schema 校验之前、`execute()` 之前运行。当 pi 恢复一个旧会话、而其中保存的工具调用参数已不再符合当前 schema 时，可用它来兼容旧的输入形态。返回你希望用 `parameters` 进行校验的对象。请保持公开 schema 的严格性，不要仅仅为了让恢复的旧会话继续可用而向 `parameters` 中添加已废弃的兼容字段。

Example: an older session may contain an `edit` tool call with top-level `oldText` and `newText`, while the current schema only accepts `edits: [{ oldText, newText }]`.
示例：旧会话中可能包含一次带有顶层 `oldText` 和 `newText` 的 `edit` 工具调用，而当前 schema 只接受 `edits: [{ oldText, newText }]`。

```typescript
pi.registerTool({
  name: "edit",
  label: "Edit",
  description: "Edit a single file using exact text replacement",
  parameters: Type.Object({
    path: Type.String(),
    edits: Type.Array(
      Type.Object({
        oldText: Type.String(),
        newText: Type.String(),
      }),
    ),
  }),
  prepareArguments(args) {
    if (!args || typeof args !== "object") return args;

    const input = args as {
      path?: string;
      edits?: Array<{ oldText: string; newText: string }>;
      oldText?: unknown;
      newText?: unknown;
    };

    if (typeof input.oldText !== "string" || typeof input.newText !== "string") {
      return args;
    }

    return {
      ...input,
      edits: [...(input.edits ?? []), { oldText: input.oldText, newText: input.newText }],
    };
  },
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // params now matches the current schema
    return {
      content: [{ type: "text", text: `Applying ${params.edits.length} edit block(s)` }],
      details: {},
    };
  },
});
```

### Overriding Built-in Tools 覆盖内置工具

Extensions can override built-in tools (`read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`) by registering a tool with the same name. Interactive mode displays a warning when this happens.
扩展可以通过注册同名工具来覆盖内置工具（`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`）。发生覆盖时，交互模式会显示一条警告。

```bash
# Extension's read tool replaces built-in read
pi -e ./tool-override.ts
```

Alternatively, use `--no-builtin-tools` to start without any built-in tools while keeping extension tools enabled:
或者，使用 `--no-builtin-tools` 在不加载任何内置工具的情况下启动，同时保留扩展工具：
```bash
# No built-in tools, only extension tools
pi --no-builtin-tools -e ./my-extension.ts
```

See [examples/extensions/tool-override.ts](../examples/extensions/tool-override.ts) for a complete example that overrides `read` with logging and access control.
完整示例参见 [examples/extensions/tool-override.ts](../examples/extensions/tool-override.ts)，它用日志记录和访问控制覆盖了 `read`。

**Rendering:** Built-in renderer inheritance is resolved per slot. Execution override and rendering override are independent. If your override omits `renderCall`, the built-in `renderCall` is used. If your override omits `renderResult`, the built-in `renderResult` is used. If your override omits both, the built-in renderer is used automatically (syntax highlighting, diffs, etc.). This lets you wrap built-in tools for logging or access control without reimplementing the UI.
**渲染：** 内置渲染器的继承按插槽（slot）分别解析。执行逻辑的覆盖与渲染逻辑的覆盖彼此独立。如果你的覆盖实现省略了 `renderCall`，则使用内置的 `renderCall`；省略了 `renderResult`，则使用内置的 `renderResult`；两者都省略，则自动使用内置渲染器（语法高亮、diff 等）。这使你可以为日志记录或访问控制而包装内置工具，同时无需重新实现 UI。

**Prompt metadata:** `promptSnippet` and `promptGuidelines` are not inherited from the built-in tool. If your override should keep those prompt instructions, define them on the override explicitly.
**Prompt 元数据：** `promptSnippet` 和 `promptGuidelines` 不会从内置工具继承。如果你的覆盖实现需要保留这些 prompt 指令，请在覆盖实现中显式定义它们。

**Your implementation must match the exact result shape**, including the `details` type. The UI and session logic depend on these shapes for rendering and state tracking.
**你的实现必须精确匹配结果结构**，包括 `details` 的类型。UI 和会话逻辑依赖这些结构进行渲染和状态跟踪。

Built-in tool implementations:
内置工具的实现：
- [read.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/read.ts) - `ReadToolDetails`
- [bash.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/bash.ts) - `BashToolDetails`
- [edit.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/edit.ts)
- [write.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/write.ts)
- [grep.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/grep.ts) - `GrepToolDetails`
- [find.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/find.ts) - `FindToolDetails`
- [ls.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/ls.ts) - `LsToolDetails`

### Remote Execution 远程执行

Built-in tools support pluggable operations for delegating to remote systems (SSH, containers, etc.):
内置工具支持可插拔的 operations，用于将执行委托给远程系统（SSH、容器等）：

```typescript
import { createReadTool, createBashTool, type ReadOperations } from "@earendil-works/pi-coding-agent";

// Create tool with custom operations
const remoteRead = createReadTool(cwd, {
  operations: {
    readFile: (path) => sshExec(remote, `cat ${path}`),
    access: (path) => sshExec(remote, `test -r ${path}`).then(() => {}),
  }
});

// Register, checking flag at execution time
pi.registerTool({
  ...remoteRead,
  async execute(id, params, signal, onUpdate, _ctx) {
    const ssh = getSshConfig();
    if (ssh) {
      const tool = createReadTool(cwd, { operations: createRemoteOps(ssh) });
      return tool.execute(id, params, signal, onUpdate);
    }
    return localRead.execute(id, params, signal, onUpdate);
  },
});
```

**Operations interfaces:** `ReadOperations`, `WriteOperations`, `EditOperations`, `BashOperations`, `LsOperations`, `GrepOperations`, `FindOperations`
**Operations 接口：** `ReadOperations`、`WriteOperations`、`EditOperations`、`BashOperations`、`LsOperations`、`GrepOperations`、`FindOperations`

For `user_bash`, extensions can reuse pi's local shell backend via `createLocalBashOperations()` instead of reimplementing local process spawning, shell resolution, and process-tree termination.
对于 `user_bash`，扩展可以通过 `createLocalBashOperations()` 复用 pi 的本地 shell 后端，而无需重新实现本地进程创建、shell 解析和进程树终止逻辑。

The bash tool also supports a spawn hook to adjust the command, cwd, or env before execution:
bash 工具还支持一个 spawn 钩子，可在执行前调整命令、cwd 或环境变量：

```typescript
import { createBashTool } from "@earendil-works/pi-coding-agent";

const bashTool = createBashTool(cwd, {
  spawnHook: ({ command, cwd, env }) => ({
    command: `source ~/.profile\n${command}`,
    cwd: `/mnt/sandbox${cwd}`,
    env: { ...env, CI: "1" },
  }),
});
```

`createBashTool()` exposes the current session to commands through `PI_SESSION_ID`, `PI_SESSION_FILE`, `PI_PROVIDER`, `PI_MODEL`, and `PI_REASONING_LEVEL`. Injection happens before `spawnHook`, so hooks receive these values in `env` and preserve them when they spread the existing environment as above. Set `exposeSessionEnvironment: false` to disable them:
`createBashTool()` 通过 `PI_SESSION_ID`、`PI_SESSION_FILE`、`PI_PROVIDER`、`PI_MODEL` 和 `PI_REASONING_LEVEL` 将当前会话信息暴露给命令。注入发生在 `spawnHook` 之前，因此钩子会在 `env` 中收到这些值，并在像上面那样展开已有环境变量时保留它们。设置 `exposeSessionEnvironment: false` 可禁用它们：

```typescript
const bashTool = createBashTool(cwd, {
  exposeSessionEnvironment: false,
});
```

See [Bash tool session environment](environment-variables.md#bash-tool-session-environment) for variable semantics. See [examples/extensions/ssh.ts](../examples/extensions/ssh.ts) for a complete SSH example with `--ssh` flag.
变量语义参见 [Bash tool session environment](environment-variables.md#bash-tool-session-environment)。带 `--ssh` 标志的完整 SSH 示例参见 [examples/extensions/ssh.ts](../examples/extensions/ssh.ts)。

### Output Truncation 输出截断

**Tools MUST truncate their output** to avoid overwhelming the LLM context. Large outputs can cause:
**工具必须截断其输出**，以避免撑爆 LLM 上下文。过大的输出可能导致：
- Context overflow errors (prompt too long)
  - 上下文溢出错误（prompt 过长）
- Compaction failures
  - 压缩（compaction）失败
- Degraded model performance
  - 模型表现下降

The built-in limit is **50KB** (~10k tokens) and **2000 lines**, whichever is hit first. Use the exported truncation utilities:
内置限制为 **50KB**（约 1 万 token）和 **2000 行**，以先达到者为准。请使用导出的截断工具函数：

```typescript
import {
  truncateHead,      // Keep first N lines/bytes (good for file reads, search results)
  truncateTail,      // Keep last N lines/bytes (good for logs, command output)
  truncateLine,      // Truncate a single line to maxBytes with ellipsis
  formatSize,        // Human-readable size (e.g., "50KB", "1.5MB")
  DEFAULT_MAX_BYTES, // 50KB
  DEFAULT_MAX_LINES, // 2000
} from "@earendil-works/pi-coding-agent";

async execute(toolCallId, params, signal, onUpdate, ctx) {
  const output = await runCommand();

  // Apply truncation
  const truncation = truncateHead(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  let result = truncation.content;

  if (truncation.truncated) {
    // Write full output to temp file
    const tempFile = writeTempFile(output);

    // Inform the LLM where to find complete output
    result += `\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines`;
    result += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`;
    result += ` Full output saved to: ${tempFile}]`;
  }

  return { content: [{ type: "text", text: result }] };
}
```

**Key points:**
**要点：**
- Use `truncateHead` for content where the beginning matters (search results, file reads)
  - 对于开头更重要的内容（搜索结果、文件读取），使用 `truncateHead`
- Use `truncateTail` for content where the end matters (logs, command output)
  - 对于结尾更重要的内容（日志、命令输出），使用 `truncateTail`
- Always inform the LLM when output is truncated and where to find the full version
  - 当输出被截断时，务必告知 LLM 这一事实以及在哪里可以找到完整版本
- Document the truncation limits in your tool's description
  - 在工具的 description 中说明截断限制

See [examples/extensions/truncated-tool.ts](../examples/extensions/truncated-tool.ts) for a complete example wrapping `rg` (ripgrep) with proper truncation.
完整示例参见 [examples/extensions/truncated-tool.ts](../examples/extensions/truncated-tool.ts)，它对 `rg`（ripgrep）做了包装并实现了恰当的截断。

### Multiple Tools 多个工具

One extension can register multiple tools with shared state:
一个扩展可以注册多个共享状态的工具：

```typescript
export default function (pi: ExtensionAPI) {
  let connection = null;

  pi.registerTool({ name: "db_connect", ... });
  pi.registerTool({ name: "db_query", ... });
  pi.registerTool({ name: "db_close", ... });

  pi.on("session_shutdown", async () => {
    connection?.close();
  });
}
```

### Custom Rendering 自定义渲染

Tools can provide `renderCall` and `renderResult` for custom TUI display. See [tui.md](tui.md) for the full component API and [tool-execution.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/modes/interactive/components/tool-execution.ts) for how tool rows are composed.
工具可以提供 `renderCall` 和 `renderResult` 以自定义 TUI 显示。完整的组件 API 参见 [tui.md](tui.md)；工具行的组合方式参见 [tool-execution.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/modes/interactive/components/tool-execution.ts)。

By default, tool output is wrapped in a `Box` that handles padding and background. A defined `renderCall` or `renderResult` must return a `Component`. If a slot renderer is not defined, `tool-execution.ts` uses fallback rendering for that slot.
默认情况下，工具输出会被包裹在一个负责内边距和背景的 `Box` 中。已定义的 `renderCall` 或 `renderResult` 必须返回一个 `Component`。如果某个插槽（slot）的渲染器未定义，`tool-execution.ts` 会为该插槽使用回退渲染。

Set `renderShell: "self"` when the tool should render its own shell instead of using the default `Box`. This is useful for tools that need complete control over framing or background behavior, for example large previews that must stay visually stable after the tool settles.
当工具需要自行渲染外壳而不使用默认 `Box` 时，请设置 `renderShell: "self"`。这适用于需要完全控制边框或背景行为的工具，例如那些在工具执行完成后仍需保持视觉稳定的大型预览。

```typescript
pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "Custom shell example",
  parameters: Type.Object({}),
  renderShell: "self",
  async execute() {
    return { content: [{ type: "text", text: "ok" }], details: undefined };
  },
  renderCall(args, theme, context) {
    return new Text(theme.fg("accent", "my custom shell"), 0, 0);
  },
});
```

`renderCall` and `renderResult` each receive a `context` object with:
`renderCall` 和 `renderResult` 各自都会接收一个 `context` 对象，包含：
- `args` - the current tool call arguments
  - `args` —— 当前工具调用的参数
- `state` - shared row-local state across `renderCall` and `renderResult`
  - `state` —— 在 `renderCall` 与 `renderResult` 之间共享的行内局部状态
- `lastComponent` - the previously returned component for that slot, if any
  - `lastComponent` —— 该插槽上一次返回的组件（如果有）
- `invalidate()` - request a rerender of this tool row
  - `invalidate()` —— 请求重新渲染该工具行
- `toolCallId`, `cwd`, `executionStarted`, `argsComplete`, `isPartial`, `expanded`, `showImages`, `isError`
  - `toolCallId`、`cwd`、`executionStarted`、`argsComplete`、`isPartial`、`expanded`、`showImages`、`isError`

Use `context.state` for cross-slot shared state. Keep slot-local caches on the returned component instance when you want to reuse and mutate the same component across renders.
跨插槽共享的状态请使用 `context.state`。若希望在多次渲染之间复用并修改同一个组件，请把插槽局部的缓存保存在返回的组件实例上。

#### renderCall

Renders the tool call or header:
渲染工具调用或标题行：

```typescript
import { Text } from "@earendil-works/pi-tui";

renderCall(args, theme, context) {
  const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
  let content = theme.fg("toolTitle", theme.bold("my_tool "));
  content += theme.fg("muted", args.action);
  if (args.text) {
    content += " " + theme.fg("dim", `"${args.text}"`);
  }
  text.setText(content);
  return text;
}
```

#### renderResult

Renders the tool result or output:
渲染工具结果或输出：

```typescript
renderResult(result, { expanded, isPartial }, theme, context) {
  if (isPartial) {
    return new Text(theme.fg("warning", "Processing..."), 0, 0);
  }

  if (result.details?.error) {
    return new Text(theme.fg("error", `Error: ${result.details.error}`), 0, 0);
  }

  let text = theme.fg("success", "✓ Done");
  if (expanded && result.details?.items) {
    for (const item of result.details.items) {
      text += "\n  " + theme.fg("dim", item);
    }
  }
  return new Text(text, 0, 0);
}
```

If a slot intentionally has no visible content, return an empty `Component` such as an empty `Container`.
如果某个插槽有意不显示任何内容，请返回一个空的 `Component`，例如空的 `Container`。

#### Keybinding Hints 键位提示

Use `keyHint()` to display keybinding hints that respect the active keybinding configuration:
使用 `keyHint()` 显示遵循当前生效键位配置的按键提示：

```typescript
import { keyHint } from "@earendil-works/pi-coding-agent";

renderResult(result, { expanded }, theme, context) {
  let text = theme.fg("success", "✓ Done");
  if (!expanded) {
    text += ` (${keyHint("app.tools.expand", "to expand")})`;
  }
  return new Text(text, 0, 0);
}
```

Available functions:
可用函数：
- `keyHint(keybinding, description)` - Formats a configured keybinding id such as `"app.tools.expand"` or `"tui.select.confirm"`
  - `keyHint(keybinding, description)` —— 格式化一个已配置的键位 id，例如 `"app.tools.expand"` 或 `"tui.select.confirm"`
- `keyText(keybinding)` - Returns the raw configured key text for a keybinding id
  - `keyText(keybinding)` —— 返回某个键位 id 所对应的原始配置按键文本
- `rawKeyHint(key, description)` - Format a raw key string
  - `rawKeyHint(key, description)` —— 格式化一个原始按键字符串

Use namespaced keybinding ids:
请使用带命名空间的键位 id：
- Coding-agent ids use the `app.*` namespace, for example `app.tools.expand`, `app.editor.external`, `app.session.rename`
  - coding agent 的 id 使用 `app.*` 命名空间，例如 `app.tools.expand`、`app.editor.external`、`app.session.rename`
- Shared TUI ids use the `tui.*` namespace, for example `tui.select.confirm`, `tui.select.cancel`, `tui.input.tab`
  - 共享的 TUI id 使用 `tui.*` 命名空间，例如 `tui.select.confirm`、`tui.select.cancel`、`tui.input.tab`

For the exhaustive list of keybinding ids and defaults, see [keybindings.md](keybindings.md). `keybindings.json` uses those same namespaced ids.
完整的键位 id 列表与默认值参见 [keybindings.md](keybindings.md)。`keybindings.json` 使用的正是这些带命名空间的 id。

Custom editors and `ctx.ui.custom()` components receive `keybindings: KeybindingsManager` as an injected argument. They should use that injected manager directly instead of calling `getKeybindings()` or `setKeybindings()`.
自定义编辑器和 `ctx.ui.custom()` 组件会收到注入参数 `keybindings: KeybindingsManager`。它们应直接使用该注入的管理器，而不要调用 `getKeybindings()` 或 `setKeybindings()`。

#### Best Practices 最佳实践

- Use `Text` with padding `(0, 0)`. The default Box handles padding.
  - 使用内边距为 `(0, 0)` 的 `Text`。默认的 Box 已负责内边距。
- Use `\n` for multi-line content.
  - 多行内容使用 `\n`。
- Handle `isPartial` for streaming progress.
  - 通过处理 `isPartial` 来展示流式进度。
- Support `expanded` for detail on demand.
  - 支持 `expanded`，实现按需展示细节。
- Keep default view compact.
  - 保持默认视图紧凑。
- Read `context.args` in `renderResult` instead of copying args into `context.state`.
  - 在 `renderResult` 中读取 `context.args`，而不要把参数复制到 `context.state` 中。
- Use `context.state` only for data that must be shared across call and result slots.
  - 仅将 `context.state` 用于必须在调用插槽与结果插槽之间共享的数据。
- Reuse `context.lastComponent` when the same component instance can be updated in place.
  - 当同一个组件实例可以就地更新时，复用 `context.lastComponent`。
- Use `renderShell: "self"` only when the default boxed shell gets in the way. In self-shell mode the tool is responsible for its own framing, padding, and background.
  - 仅在默认的盒式外壳妨碍你时才使用 `renderShell: "self"`。在自渲染外壳模式下，工具需自行负责边框、内边距和背景。

#### Fallback 回退行为

If a slot renderer is not defined or throws:
如果某个插槽的渲染器未定义或抛出异常：
- `renderCall`: Shows the tool name
  - `renderCall`：显示工具名称
- `renderResult`: Shows raw text from `content`
  - `renderResult`：显示来自 `content` 的原始文本

### Dynamic Tool Loading 动态工具加载

Extensions can register many tools while keeping only a small initial set active. A tool can then add more tools with `pi.setActiveTools()` during execution. Pi detects purely additive changes, records the newly available tool names on that tool result, and applies the updated active set before the next model request.
扩展可以注册大量工具，但只保持一小部分初始工具处于激活状态。之后某个工具可以在执行过程中通过 `pi.setActiveTools()` 添加更多工具。Pi 会识别出纯新增型的变更，将新增可用的工具名记录在该工具结果上，并在下一次模型请求之前应用更新后的激活集合。

This works with every model. Models with native deferred-loading support preserve the stable prompt prefix and load the new definitions at the tool-result position. Other models use the fallback described below.
该机制对所有模型都有效。原生支持延迟加载的模型会保留稳定的 prompt 前缀，并在工具结果的位置加载新的工具定义。其他模型则使用下文所述的回退方案。

The lifecycle is:
其生命周期为：

1. Register every tool with `pi.registerTool()` so it appears in `pi.getAllTools()`.
   1. 用 `pi.registerTool()` 注册所有工具，使其出现在 `pi.getAllTools()` 中。
2. Keep loader tools, such as `search_tools`, active and leave searchable tools inactive.
   2. 保持加载器类工具（例如 `search_tools`）处于激活状态，而让可被检索的工具保持未激活。
3. During loader execution, call `pi.setActiveTools([...currentTools, ...matchingTools])`. The change must be additive: do not remove currently active tools in the same call.
   3. 在加载器执行期间调用 `pi.setActiveTools([...currentTools, ...matchingTools])`。该变更必须是新增型的：不要在同一次调用中移除当前已激活的工具。
4. Pi records which tools were added on the loader's tool result.
   4. Pi 会在加载器的工具结果上记录新增了哪些工具。
5. Before the next model response, Pi exposes the added definitions using native deferred loading when supported, or the normal active tool list otherwise.
   5. 在下一次模型响应之前，Pi 会在支持的情况下使用原生延迟加载暴露新增的工具定义，否则使用常规的激活工具列表。

You do not need to return provider-specific tool references or mark the loader as a special search tool. The active-tool change is the signal. Names passed to `pi.setActiveTools()` must already be registered; unknown names are ignored.
你无需返回 provider 专用的工具引用，也无需把加载器标记为特殊的搜索工具。激活工具集合的变化本身就是信号。传给 `pi.setActiveTools()` 的名称必须已经注册过；未知名称会被忽略。

#### Models with native deferred loading 原生支持延迟加载的模型

- **Anthropic**
  - **Models:** Sonnet, Opus, Fable version 4.5 or newer (without Haiku)
    - **模型：** Sonnet、Opus、Fable 4.5 及更新版本（不含 Haiku）
  - **Native representation:** Deferred definitions use `defer_loading`; the load point uses `tool_reference` content.
    - **原生表示：** 延迟的工具定义使用 `defer_loading`；加载点使用 `tool_reference` 内容块。
- **OpenAI**
  - **Models:** `gpt-5.4` and newer family
    - **模型：** `gpt-5.4` 及更新系列
  - **Native representation:** Pi adds completed client `tool_search_call` and `tool_search_output` items at the load point.
    - **原生表示：** Pi 会在加载点添加已完成的客户端 `tool_search_call` 与 `tool_search_output` 条目。

For a verified custom model or proxy, native handling can be enabled with `compat.supportsToolReferences: true` for `anthropic-messages`, or `compat.supportsToolSearch: true` for `openai-responses` and `openai-codex-responses`. Leave these disabled unless the endpoint and model accept the corresponding native protocol.
对于已验证过的自定义模型或代理，可通过为 `anthropic-messages` 设置 `compat.supportsToolReferences: true`，或为 `openai-responses` 和 `openai-codex-responses` 设置 `compat.supportsToolSearch: true` 来启用原生处理。除非该端点和模型确实支持对应的原生协议，否则请保持这些选项关闭。

#### Fallback behavior 回退行为

For all other models and providers, dynamic activation still works: Pi sends the complete current active tool list normally on the next request. The model can call the newly activated tools, but adding their definitions may invalidate the provider's cached prompt prefix.
对于其他所有模型和 provider，动态激活依然有效：Pi 会在下一次请求中照常发送完整的当前激活工具列表。模型可以调用新激活的工具，但新增这些定义可能会使 provider 缓存的 prompt 前缀失效。

Pi also uses this safe fallback when the active set is not purely additive, such as replacing one group of tools with another. Tool removals therefore work, but they do not use deferred loading.
当激活集合的变更并非纯新增（例如用一组工具替换另一组）时，Pi 同样采用这一安全回退方案。因此移除工具是可行的，只是不会使用延迟加载。

For the best cache behavior, keep the loader tool active for the whole session and add tools instead of replacing the active set. Also note that activating a tool with `promptSnippet` or `promptGuidelines` rebuilds the system prompt; that system-prompt change can invalidate the prefix even when the provider supports deferred schemas. Lazily loaded tools should usually rely on their tool `description` and omit active-only prompt metadata.
为获得最佳的缓存表现，请在整个会话期间保持加载器工具处于激活状态，并采用"添加工具"而非"替换激活集合"的做法。另请注意：激活一个带有 `promptSnippet` 或 `promptGuidelines` 的工具会重建 system prompt；即使 provider 支持延迟 schema，这种 system prompt 变更也可能使前缀失效。延迟加载的工具通常应当依赖其 `description`，并省略仅在激活时生效的 prompt 元数据。

#### Search tool example 搜索工具示例

The following extension registers two searchable tools, removes them from the initial active set, and keeps only `search_tools` as their loader. The example uses simple keyword matching, but the search implementation could use BM25, embeddings, a remote catalog, or project-specific routing.
下面的扩展注册了两个可被检索的工具，将它们从初始激活集合中移除，仅保留 `search_tools` 作为它们的加载器。该示例使用简单的关键词匹配，但搜索实现也可以采用 BM25、向量嵌入、远程目录或项目专属的路由逻辑。

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const SEARCHABLE_TOOL_NAMES = new Set(["lookup_weather", "search_issues"]);

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "lookup_weather",
    label: "Lookup Weather",
    description: "Look up the current weather for a city",
    parameters: Type.Object({ city: Type.String() }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: `Weather for ${params.city}: sunny` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "search_issues",
    label: "Search Issues",
    description: "Search project issues by keyword",
    parameters: Type.Object({ query: Type.String() }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: `No open issues matching ${params.query}` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "search_tools",
    label: "Search Tools",
    description: "Search for and enable tools relevant to a task",
    promptSnippet: "Search for additional tools when the active tools cannot perform the task",
    promptGuidelines: [
      "Use search_tools when a task requires a capability that is not currently available.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Capability or task to search for" }),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 })),
    }),
    async execute(_toolCallId, params) {
      const terms = params.query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const matches = pi.getAllTools()
        .filter((tool) => SEARCHABLE_TOOL_NAMES.has(tool.name))
        .map((tool) => ({
          tool,
          score: terms.reduce(
            (score, term) =>
              score + (`${tool.name} ${tool.description}`.toLowerCase().includes(term) ? 1 : 0),
            0,
          ),
        }))
        .filter((match) => match.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, params.limit ?? 3)
        .map((match) => match.tool.name);

      if (matches.length === 0) {
        return {
          content: [{ type: "text", text: `No tools found for: ${params.query}` }],
          details: { matches: [] },
        };
      }

      const active = pi.getActiveTools();
      const added = matches.filter((name) => !active.includes(name));
      pi.setActiveTools([...new Set([...active, ...added])]);

      return {
        content: [{
          type: "text",
          text: added.length > 0
            ? `Loaded tools: ${added.join(", ")}`
            : `Matching tools already active: ${matches.join(", ")}`,
        }],
        details: { matches, added },
      };
    },
  });

  pi.on("session_start", () => {
    // Keep searchable tools registered but initially inactive. Preserve built-ins
    // and tools owned by other extensions, and keep the loader itself active.
    const initialTools = pi.getActiveTools().filter(
      (name) => !SEARCHABLE_TOOL_NAMES.has(name),
    );
    pi.setActiveTools([...new Set([...initialTools, "search_tools"])]);
  });
}
```

When `search_tools` adds a match, the model receives that definition on the immediately following request. On a native-capable model the definition is anchored after the search result without changing the initial tool-schema prefix. On other models it appears in the normal tool list on that same following request.
当 `search_tools` 添加了一个匹配项后，模型会在紧随其后的请求中收到该工具定义。在原生支持该能力的模型上，定义会被锚定在搜索结果之后，而不会改变最初的工具 schema 前缀。在其他模型上，它会出现在同一次后续请求的常规工具列表中。

## Custom UI 自定义 UI

Extensions can interact with users via `ctx.ui` methods and customize how messages/tools render.
扩展可以通过 `ctx.ui` 的各种方法与用户交互，并自定义消息/工具的渲染方式。

**For custom components, see [tui.md](tui.md)** which has copy-paste patterns for:
**关于自定义组件，请参见 [tui.md](tui.md)**，其中提供了可直接复制使用的模式：
- Selection dialogs (SelectList)
  - 选择对话框（SelectList）
- Async operations with cancel (BorderedLoader)
  - 可取消的异步操作（BorderedLoader）
- Settings toggles (SettingsList)
  - 设置开关（SettingsList）
- Status indicators (setStatus)
  - 状态指示器（setStatus）
- Working message, visibility, and indicator during streaming (`setWorkingMessage`, `setWorkingVisible`, `setWorkingIndicator`)
  - 流式输出期间的工作提示文本、可见性与指示器（`setWorkingMessage`、`setWorkingVisible`、`setWorkingIndicator`）
- Widgets above/below editor (setWidget)
  - 编辑器上方/下方的小部件（setWidget）
- Autocomplete providers layered on top of built-in slash/path completion (addAutocompleteProvider)
  - 叠加在内置斜杠命令/路径补全之上的自动补全提供器（addAutocompleteProvider）
- Custom footers (setFooter)
  - 自定义页脚（setFooter）

### Dialogs 对话框

```typescript
// Select from options
const choice = await ctx.ui.select("Pick one:", ["A", "B", "C"]);

// Confirm dialog
const ok = await ctx.ui.confirm("Delete?", "This cannot be undone");

// Text input
const name = await ctx.ui.input("Name:", "placeholder");

// Multi-line editor
const text = await ctx.ui.editor("Edit:", "prefilled text");

// Notification (non-blocking)
ctx.ui.notify("Done!", "info");  // "info" | "warning" | "error"
```

#### Timed Dialogs with Countdown 带倒计时的定时对话框

Dialogs support a `timeout` option that auto-dismisses with a live countdown display:
对话框支持 `timeout` 选项，会显示实时倒计时并在超时后自动关闭：

```typescript
// Dialog shows "Title (5s)" → "Title (4s)" → ... → auto-dismisses at 0
const confirmed = await ctx.ui.confirm(
  "Timed Confirmation",
  "This dialog will auto-cancel in 5 seconds. Confirm?",
  { timeout: 5000 }
);

if (confirmed) {
  // User confirmed
} else {
  // User cancelled or timed out
}
```

**Return values on timeout:**
**超时时的返回值：**
- `select()` returns `undefined`
  - `select()` 返回 `undefined`
- `confirm()` returns `false`
  - `confirm()` 返回 `false`
- `input()` returns `undefined`
  - `input()` 返回 `undefined`

#### Manual Dismissal with AbortSignal 使用 AbortSignal 手动关闭

For more control (e.g., to distinguish timeout from user cancel), use `AbortSignal`:
若需要更精细的控制（例如区分超时与用户取消），请使用 `AbortSignal`：

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

const confirmed = await ctx.ui.confirm(
  "Timed Confirmation",
  "This dialog will auto-cancel in 5 seconds. Confirm?",
  { signal: controller.signal }
);

clearTimeout(timeoutId);

if (confirmed) {
  // User confirmed
} else if (controller.signal.aborted) {
  // Dialog timed out
} else {
  // User cancelled (pressed Escape or selected "No")
}
```

See [examples/extensions/timed-confirm.ts](../examples/extensions/timed-confirm.ts) for complete examples.
完整示例参见 [examples/extensions/timed-confirm.ts](../examples/extensions/timed-confirm.ts)。

### Widgets, Status, and Footer 小部件、状态与页脚

```typescript
// Status in footer (persistent until cleared)
ctx.ui.setStatus("my-ext", "Processing...");
ctx.ui.setStatus("my-ext", undefined);  // Clear

// Working loader (shown during streaming)
ctx.ui.setWorkingMessage("Thinking deeply...");
ctx.ui.setWorkingMessage();  // Restore default
ctx.ui.setWorkingVisible(false);  // Hide the built-in working loader row entirely
ctx.ui.setWorkingVisible(true);   // Show the built-in working loader row

// Working indicator (shown during streaming)
ctx.ui.setWorkingIndicator({ frames: [ctx.ui.theme.fg("accent", "●")] });  // Static dot
ctx.ui.setWorkingIndicator({
  frames: [
    ctx.ui.theme.fg("dim", "·"),
    ctx.ui.theme.fg("muted", "•"),
    ctx.ui.theme.fg("accent", "●"),
    ctx.ui.theme.fg("muted", "•"),
  ],
  intervalMs: 120,
});
ctx.ui.setWorkingIndicator({ frames: [] });  // Hide indicator
ctx.ui.setWorkingIndicator();  // Restore default spinner

// Widget above editor (default)
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"]);
// Widget below editor
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"], { placement: "belowEditor" });
ctx.ui.setWidget("my-widget", (tui, theme) => new Text(theme.fg("accent", "Custom"), 0, 0));
ctx.ui.setWidget("my-widget", undefined);  // Clear

// Custom footer (replaces built-in footer entirely)
ctx.ui.setFooter((tui, theme) => ({
  render(width) { return [theme.fg("dim", "Custom footer")]; },
  invalidate() {},
}));
ctx.ui.setFooter(undefined);  // Restore built-in footer

// Terminal title
ctx.ui.setTitle("pi - my-project");

// Editor text
ctx.ui.setEditorText("Prefill text");
const current = ctx.ui.getEditorText();

// Paste into editor (triggers paste handling, including collapse for large content)
ctx.ui.pasteToEditor("pasted content");

// Stack custom autocomplete behavior on top of the built-in provider
ctx.ui.addAutocompleteProvider((current) => ({
  triggerCharacters: ["#"],
  async getSuggestions(lines, line, col, options) {
    const beforeCursor = (lines[line] ?? "").slice(0, col);
    const match = beforeCursor.match(/(?:^|[ \t])#([^\s#]*)$/);
    if (!match) {
      return current.getSuggestions(lines, line, col, options);
    }

    return {
      prefix: `#${match[1] ?? ""}`,
      items: [{ value: "#2983", label: "#2983", description: "Extension API for autocomplete" }],
    };
  },
  applyCompletion(lines, line, col, item, prefix) {
    return current.applyCompletion(lines, line, col, item, prefix);
  },
  shouldTriggerFileCompletion(lines, line, col) {
    return current.shouldTriggerFileCompletion?.(lines, line, col) ?? true;
  },
}));

// Tool output expansion
const wasExpanded = ctx.ui.getToolsExpanded();
ctx.ui.setToolsExpanded(true);
ctx.ui.setToolsExpanded(wasExpanded);

// Custom editor (vim mode, emacs mode, etc.)
ctx.ui.setEditorComponent((tui, theme, keybindings) => new VimEditor(tui, theme, keybindings));
const currentEditor = ctx.ui.getEditorComponent();
ctx.ui.setEditorComponent((tui, theme, keybindings) =>
  new WrappedEditor(tui, theme, keybindings, currentEditor?.(tui, theme, keybindings))
);
ctx.ui.setEditorComponent(undefined);  // Restore default editor

// Theme management (see themes.md for creating themes)
const themes = ctx.ui.getAllThemes();  // [{ name: "dark", path: "/..." | undefined }, ...]
const lightTheme = ctx.ui.getTheme("light");  // Load without switching
const result = ctx.ui.setTheme("light");  // Switch by name
if (!result.success) {
  ctx.ui.notify(`Failed: ${result.error}`, "error");
}
ctx.ui.setTheme(lightTheme!);  // Or switch by Theme object
ctx.ui.theme.fg("accent", "styled text");  // Access current theme
```

Custom working-indicator frames are rendered verbatim. If you want colors, add them to the frame strings yourself, for example with `ctx.ui.theme.fg(...)`.
自定义的工作指示器帧会按原样渲染。如果需要颜色，请自行在帧字符串中添加，例如使用 `ctx.ui.theme.fg(...)`。

### Autocomplete Providers 自动补全提供器

Use `ctx.ui.addAutocompleteProvider()` to stack custom autocomplete logic on top of the built-in slash-command and path provider. Set `triggerCharacters` for custom natural triggers such as `$`.
使用 `ctx.ui.addAutocompleteProvider()` 可在内置的斜杠命令与路径补全提供器之上叠加自定义补全逻辑。通过 `triggerCharacters` 设置自定义的自然触发字符，例如 `$`。

Typical pattern:
典型模式：

- inspect the text before the cursor
  - 检查光标之前的文本
- return your own suggestions when your extension-specific syntax matches
  - 当匹配到你的扩展专属语法时，返回自己的补全建议
- otherwise delegate to `current.getSuggestions(...)`
  - 否则委托给 `current.getSuggestions(...)`
- delegate `applyCompletion(...)` unless you need custom insertion behavior
  - 除非需要自定义插入行为，否则同样委托 `applyCompletion(...)`

```typescript
pi.on("session_start", (_event, ctx) => {
  ctx.ui.addAutocompleteProvider((current) => ({
    triggerCharacters: ["#"],
    async getSuggestions(lines, cursorLine, cursorCol, options) {
      const line = lines[cursorLine] ?? "";
      const beforeCursor = line.slice(0, cursorCol);
      const match = beforeCursor.match(/(?:^|[ \t])#([^\s#]*)$/);
      if (!match) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      return {
        prefix: `#${match[1] ?? ""}`,
        items: [
          { value: "#2983", label: "#2983", description: "Extension API for registering custom @ autocomplete providers" },
          { value: "#2753", label: "#2753", description: "Reload stale resource settings" },
        ],
      };
    },

    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
    },

    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
    },
  }));
});
```

See [github-issue-autocomplete.ts](../examples/extensions/github-issue-autocomplete.ts) for a complete example that preloads the latest open GitHub issues with `gh issue list` and filters them locally for fast `#...` completion. It requires GitHub CLI (`gh`) and a GitHub repository checkout.
完整示例参见 [github-issue-autocomplete.ts](../examples/extensions/github-issue-autocomplete.ts)，它通过 `gh issue list` 预加载最新的开放 GitHub issue，并在本地过滤以实现快速的 `#...` 补全。它需要 GitHub CLI（`gh`）以及一个已检出的 GitHub 仓库。

### Custom Components 自定义组件

For complex UI, use `ctx.ui.custom()`. This temporarily replaces the editor with your component until `done()` is called:
对于复杂 UI，请使用 `ctx.ui.custom()`。它会临时用你的组件替换编辑器，直到调用 `done()` 为止：

```typescript
import { Text, Component } from "@earendil-works/pi-tui";

const result = await ctx.ui.custom<boolean>((tui, theme, keybindings, done) => {
  const text = new Text("Press Enter to confirm, Escape to cancel", 1, 1);

  text.onKey = (key) => {
    if (key === "return") done(true);
    if (key === "escape") done(false);
    return true;
  };

  return text;
});

if (result) {
  // User pressed Enter
}
```

The callback receives:
该回调会接收：
- `tui` - TUI instance (for screen dimensions, focus management)
  - `tui` —— TUI 实例（用于获取屏幕尺寸、管理焦点）
- `theme` - Current theme for styling
  - `theme` —— 用于样式化的当前主题
- `keybindings` - App keybinding manager (for checking shortcuts)
  - `keybindings` —— 应用的键位管理器（用于检查快捷键）
- `done(value)` - Call to close component and return value
  - `done(value)` —— 调用它以关闭组件并返回值

See [tui.md](tui.md) for the full component API.
完整的组件 API 参见 [tui.md](tui.md)。

#### Overlay Mode (Experimental) 覆盖层模式（实验性）

Pass `{ overlay: true }` to render the component as a floating modal on top of existing content, without clearing the screen:
传入 `{ overlay: true }` 可将组件渲染为浮动在现有内容之上的模态框，且不会清空屏幕：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyOverlayComponent({ onClose: done }),
  { overlay: true }
);
```

For advanced positioning (anchors, margins, percentages, responsive visibility), pass `overlayOptions`. Use `onHandle` to control focus or visibility programmatically:
若需要高级定位（锚点、外边距、百分比、响应式可见性），请传入 `overlayOptions`。使用 `onHandle` 可以编程方式控制焦点或可见性：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyOverlayComponent({ onClose: done }),
  {
    overlay: true,
    overlayOptions: { anchor: "top-right", width: "50%", margin: 2 },
    onHandle: (handle) => {
      handle.focus(); // focus this overlay and bring it to the visual front
      // handle.unfocus({ target: editorComponent }); // release input to a specific component
      // handle.setHidden(true/false); // toggle visibility
      // handle.hide(); // permanently remove
    }
  }
);
```

A focused visible overlay can reclaim input after temporary non-overlay custom UI closes. If you intentionally want another component to keep input while the overlay stays visible, call `handle.unfocus({ target })`. Passing `{ target: null }` releases the overlay without focusing another component.
当临时的非覆盖层自定义 UI 关闭后，处于聚焦且可见的覆盖层可以重新夺回输入焦点。如果你有意让另一个组件在覆盖层保持可见的同时继续接收输入，请调用 `handle.unfocus({ target })`。传入 `{ target: null }` 会释放覆盖层，同时不将焦点交给其他组件。

See [tui.md](tui.md) for the full `OverlayOptions` and `OverlayHandle` API and [overlay-qa-tests.ts](../examples/extensions/overlay-qa-tests.ts) for examples.
完整的 `OverlayOptions` 与 `OverlayHandle` API 参见 [tui.md](tui.md)，示例参见 [overlay-qa-tests.ts](../examples/extensions/overlay-qa-tests.ts)。

### Custom Editor 自定义编辑器

Replace the main input editor with a custom implementation (vim mode, emacs mode, etc.):
用自定义实现替换主输入编辑器（vim 模式、emacs 模式等）：

```typescript
import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";

class VimEditor extends CustomEditor {
  private mode: "normal" | "insert" = "insert";

  handleInput(data: string): void {
    if (matchesKey(data, "escape") && this.mode === "insert") {
      this.mode = "normal";
      return;
    }
    if (this.mode === "normal" && data === "i") {
      this.mode = "insert";
      return;
    }
    super.handleInput(data);  // App keybindings + text editing
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setEditorComponent((tui, theme, keybindings) =>
      new VimEditor(tui, theme, keybindings)
    );
  });
}
```

**Key points:**
**要点：**
- Extend `CustomEditor` (not base `Editor`) to get app keybindings (escape to abort, ctrl+d, model switching)
  - 继承 `CustomEditor`（而非基类 `Editor`），以获得应用级键位（escape 中止、ctrl+d、模型切换）
- Call `super.handleInput(data)` for keys you don't handle
  - 对于你不处理的按键，请调用 `super.handleInput(data)`
- Factory receives `tui`, `theme`, and `keybindings` from the app
  - 工厂函数会从应用接收 `tui`、`theme` 和 `keybindings`
- Use `ctx.ui.getEditorComponent()` before `setEditorComponent()` to wrap the previously configured custom editor
  - 在 `setEditorComponent()` 之前调用 `ctx.ui.getEditorComponent()`，可以包装此前已配置的自定义编辑器
- Pass `undefined` to restore default: `ctx.ui.setEditorComponent(undefined)`
  - 传入 `undefined` 可恢复默认编辑器：`ctx.ui.setEditorComponent(undefined)`

To compose with another extension that already replaced the editor, capture the previous factory before setting yours:
若要与另一个已替换编辑器的扩展组合使用，请在设置你自己的工厂之前先捕获此前的工厂：

```typescript
const previous = ctx.ui.getEditorComponent();
ctx.ui.setEditorComponent((tui, theme, keybindings) =>
  new MyEditor(tui, theme, keybindings, { base: previous?.(tui, theme, keybindings) })
);
```

See [tui.md](tui.md) Pattern 7 for a complete example with mode indicator.
带模式指示器的完整示例参见 [tui.md](tui.md) 中的 Pattern 7。

### Message and Entry Rendering 消息与条目渲染

Register a custom renderer for messages with your `customType`. Use message renderers for content that should participate in LLM context:
为带有你指定 `customType` 的消息注册自定义渲染器。对于需要参与 LLM 上下文的内容，请使用消息渲染器：

```typescript
import { Text } from "@earendil-works/pi-tui";

pi.registerMessageRenderer("my-extension", (message, options, theme) => {
  const { expanded, outputPad } = options;
  let text = theme.fg("accent", `[${message.customType}] `);
  text += message.content;

  if (expanded && message.details) {
    text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
  }

  return new Text(text, outputPad, 0);
});
```

Messages are sent via `pi.sendMessage()`:
消息通过 `pi.sendMessage()` 发送：

```typescript
pi.sendMessage({
  customType: "my-extension",  // Matches registerMessageRenderer
  content: "Status update",
  display: true,               // Show in TUI
  details: { ... },            // Available in renderer
});
```

For TUI-only content that should not be sent to the LLM, render custom entries instead:
对于仅在 TUI 中显示、不应发送给 LLM 的内容，请改为渲染自定义条目：

```typescript
pi.registerEntryRenderer("my-card", (entry, options, theme) => {
  return new Text(theme.fg("accent", JSON.stringify(entry.data)));
});

pi.appendEntry("my-card", { status: "done" });
```

### Theme Colors 主题颜色

All render functions receive a `theme` object. See [themes.md](themes.md) for creating custom themes and the full color palette.
所有渲染函数都会接收一个 `theme` 对象。关于创建自定义主题以及完整调色板，请参见 [themes.md](themes.md)。

```typescript
// Foreground colors
theme.fg("toolTitle", text)   // Tool names
theme.fg("accent", text)      // Highlights
theme.fg("success", text)     // Success (green)
theme.fg("error", text)       // Errors (red)
theme.fg("warning", text)     // Warnings (yellow)
theme.fg("muted", text)       // Secondary text
theme.fg("dim", text)         // Tertiary text

// Text styles
theme.bold(text)
theme.italic(text)
theme.strikethrough(text)
```

For syntax highlighting in custom tool renderers:
在自定义工具渲染器中进行语法高亮：

```typescript
import { highlightCode, getLanguageFromPath } from "@earendil-works/pi-coding-agent";

// Highlight code with explicit language
const highlighted = highlightCode("const x = 1;", "typescript", theme);

// Auto-detect language from file path
const lang = getLanguageFromPath("/path/to/file.rs");  // "rust"
const highlighted = highlightCode(code, lang, theme);
```

## Error Handling 错误处理

- Extension errors are logged, agent continues
  - 扩展错误会被记录到日志，agent 继续运行
- `tool_call` errors block the tool (fail-safe)
  - `tool_call` 中的错误会阻止该工具执行（故障安全设计）
- Tool `execute` errors must be signaled by throwing; the thrown error is caught, reported to the LLM with `isError: true`, and execution continues
  - 工具 `execute` 中的错误必须通过抛出异常来表示；抛出的错误会被捕获、以 `isError: true` 报告给 LLM，随后继续执行

## Mode Behavior 模式行为

| Mode<br>模式 | `ctx.mode` | `ctx.hasUI` | Notes<br>说明 |
|------|------------|-------------|-------|
| Interactive<br>交互式 | `"tui"` | `true` | Full TUI with terminal rendering<br>带终端渲染的完整 TUI |
| RPC (`--mode rpc`) | `"rpc"` | `true` | Dialogs and notifications via JSON protocol; `custom()` returns `undefined`. See [rpc.md](rpc.md)<br>通过 JSON 协议提供对话框和通知；`custom()` 返回 `undefined`。参见 [rpc.md](rpc.md) |
| JSON (`--mode json`) | `"json"` | `false` | Event stream to stdout; UI methods are no-ops<br>向 stdout 输出事件流；UI 方法为空操作 |
| Print (`-p`) | `"print"` | `false` | Extensions run but can't prompt<br>扩展会运行，但无法提示用户 |

Use `ctx.mode === "tui"` before TUI-specific features (`custom()`, component factories, terminal input). Use `ctx.hasUI` before dialog and notification methods that work in both TUI and RPC modes.
在使用 TUI 专属功能（`custom()`、组件工厂、终端输入）之前，请先判断 `ctx.mode === "tui"`。在使用同时支持 TUI 与 RPC 模式的对话框和通知方法之前，请先判断 `ctx.hasUI`。

## Examples Reference 示例索引

All examples in [examples/extensions/](../examples/extensions/).
所有示例位于 [examples/extensions/](../examples/extensions/)。

| Example<br>示例 | Description<br>说明 | Key APIs<br>关键 API |
|---------|-------------|----------|
| **Tools**<br>**工具** |||
| `hello.ts` | Minimal tool registration<br>最简单的工具注册 | `registerTool` |
| `question.ts` | Tool with user interaction<br>带用户交互的工具 | `registerTool`, `ui.select` |
| `questionnaire.ts` | Multi-step wizard tool<br>多步向导式工具 | `registerTool`, `ui.custom` |
| `todo.ts` | Stateful tool with persistence<br>带持久化的有状态工具 | `registerTool`, `appendEntry`, `renderResult`, session events |
| `dynamic-tools.ts` | Register tools after startup and during commands<br>在启动后及命令执行期间注册工具 | `registerTool`, `session_start`, `registerCommand` |
| `structured-output.ts` | Final structured-output tool with `terminate: true`<br>使用 `terminate: true` 的最终结构化输出工具 | `registerTool`, terminating tool results |
| `truncated-tool.ts` | Output truncation example<br>输出截断示例 | `registerTool`, `truncateHead` |
| `tool-override.ts` | Override built-in read tool<br>覆盖内置的 read 工具 | `registerTool` (same name as built-in) |
| **Commands**<br>**命令** |||
| `pirate.ts` | Modify system prompt per-turn<br>按轮次修改 system prompt | `registerCommand`, `before_agent_start` |
| `summarize.ts` | Conversation summary command<br>对话摘要命令 | `registerCommand`, `ui.custom` |
| `handoff.ts` | Cross-provider model handoff<br>跨 provider 的模型交接 | `registerCommand`, `ui.editor`, `ui.custom` |
| `qna.ts` | Q&A with custom UI<br>带自定义 UI 的问答 | `registerCommand`, `ui.custom`, `setEditorText` |
| `send-user-message.ts` | Inject user messages<br>注入用户消息 | `registerCommand`, `sendUserMessage` |
| `reload-runtime.ts` | Reload command and LLM tool handoff<br>重载命令与 LLM 工具交接 | `registerCommand`, `ctx.reload()`, `sendUserMessage` |
| `shutdown-command.ts` | Graceful shutdown command<br>优雅关闭命令 | `registerCommand`, `shutdown()` |
| **Events & Gates**<br>**事件与闸门** |||
| `permission-gate.ts` | Block dangerous commands<br>阻止危险命令 | `on("tool_call")`, `ui.confirm` |
| `project-trust.ts` | Decide or defer project trust from a user/global or CLI extension<br>在用户/全局或 CLI 扩展中决定或推迟项目信任 | `on("project_trust")`, trust UI, required trust result |
| `protected-paths.ts` | Block writes to specific paths<br>阻止写入特定路径 | `on("tool_call")` |
| `confirm-destructive.ts` | Confirm session changes<br>确认会话变更 | `on("session_before_switch")`, `on("session_before_fork")` |
| `dirty-repo-guard.ts` | Warn on dirty git repo<br>在 git 仓库有未提交改动时告警 | `on("session_before_*")`, `exec` |
| `input-transform.ts` | Transform user input<br>转换用户输入 | `on("input")` |
| `input-transform-streaming.ts` | Streaming-aware input transform<br>感知流式状态的输入转换 | `on("input")`, `streamingBehavior` |
| `model-status.ts` | React to model changes<br>响应模型变更 | `on("model_select")`, `setStatus` |
| `provider-payload.ts` | Inspect payloads and provider response headers<br>检查请求负载与 provider 响应头 | `on("before_provider_request")`, `on("after_provider_response")` |
| `system-prompt-header.ts` | Display system prompt info<br>显示 system prompt 信息 | `on("agent_start")`, `getSystemPrompt` |
| `claude-rules.ts` | Load rules from files<br>从文件加载规则 | `on("session_start")`, `on("before_agent_start")` |
| `prompt-customizer.ts` | Add context-aware tool guidance using `systemPromptOptions`<br>利用 `systemPromptOptions` 添加上下文感知的工具指导 | `on("before_agent_start")`, `BuildSystemPromptOptions` |
| `file-trigger.ts` | File watcher triggers messages<br>文件监听器触发消息 | `sendMessage` |
| **Compaction & Sessions**<br>**压缩与会话** |||
| `custom-compaction.ts` | Custom compaction summary<br>自定义压缩摘要 | `on("session_before_compact")` |
| `trigger-compact.ts` | Trigger compaction manually<br>手动触发压缩 | `compact()` |
| `git-checkpoint.ts` | Git stash on turns<br>每轮执行 git stash | `on("turn_start")`, `on("session_before_fork")`, `exec` |
| `git-merge-and-resolve.ts` | Fetch, merge, and resolve conflicts<br>拉取、合并并解决冲突 | `on("agent_end")`, `exec`, `sendUserMessage` |
| `auto-commit-on-exit.ts` | Commit on shutdown<br>关闭时自动提交 | `on("session_shutdown")`, `exec` |
| **UI Components**<br>**UI 组件** |||
| `status-line.ts` | Footer status indicator<br>页脚状态指示器 | `setStatus`, session events |
| `working-indicator.ts` | Customize the streaming working indicator<br>自定义流式输出时的工作指示器 | `setWorkingIndicator`, `registerCommand` |
| `github-issue-autocomplete.ts` | Add `#1234` issue completions on top of built-in autocomplete by preloading recent open issues from `gh issue list`<br>通过 `gh issue list` 预加载近期开放 issue，在内置补全之上添加 `#1234` issue 补全 | `addAutocompleteProvider`, `on("session_start")`, `exec` |
| `custom-footer.ts` | Replace footer entirely<br>完全替换页脚 | `registerCommand`, `setFooter` |
| `custom-header.ts` | Replace startup header<br>替换启动头部 | `on("session_start")`, `setHeader` |
| `modal-editor.ts` | Vim-style modal editor<br>Vim 风格的模式编辑器 | `setEditorComponent`, `CustomEditor` |
| `rainbow-editor.ts` | Custom editor styling<br>自定义编辑器样式 | `setEditorComponent` |
| `widget-placement.ts` | Widget above/below editor<br>编辑器上方/下方的小部件 | `setWidget` |
| `overlay-test.ts` | Overlay components<br>覆盖层组件 | `ui.custom` with overlay options |
| `overlay-qa-tests.ts` | Comprehensive overlay tests<br>覆盖层的完整测试 | `ui.custom`, all overlay options |
| `notify.ts` | Simple notifications<br>简单通知 | `ui.notify` |
| `timed-confirm.ts` | Dialogs with timeout<br>带超时的对话框 | `ui.confirm` with timeout/signal |
| `mac-system-theme.ts` | Auto-switch theme<br>自动切换主题 | `setTheme`, `exec` |
| **Complex Extensions**<br>**复杂扩展** |||
| `plan-mode/` | Full plan mode implementation<br>完整的 plan 模式实现 | All event types, `registerCommand`, `registerShortcut`, `registerFlag`, `setStatus`, `setWidget`, `sendMessage`, `setActiveTools` |
| `preset.ts` | Saveable presets (model, tools, thinking)<br>可保存的预设（模型、工具、思考等级） | `registerCommand`, `registerShortcut`, `registerFlag`, `setModel`, `setActiveTools`, `setThinkingLevel`, `appendEntry` |
| `tools.ts` | Toggle tools on/off UI<br>工具启停切换 UI | `registerCommand`, `setActiveTools`, `SettingsList`, session events |
| **Remote & Sandbox**<br>**远程与沙箱** |||
| `ssh.ts` | SSH remote execution<br>SSH 远程执行 | `registerFlag`, `on("user_bash")`, `on("before_agent_start")`, tool operations |
| `interactive-shell.ts` | Persistent shell session<br>持久化 shell 会话 | `on("user_bash")` |
| `sandbox/` | Sandboxed tool execution<br>沙箱化的工具执行 | Tool operations |
| `gondolin/` | Route built-in tools and `!` commands into a Gondolin micro-VM<br>将内置工具和 `!` 命令路由到 Gondolin 微虚拟机 | Tool operations, built-in tool overrides, `on("user_bash")` |
| `subagent/` | Spawn sub-agents<br>派生子 agent | `registerTool`, `exec` |
| **Games**<br>**游戏** |||
| `snake.ts` | Snake game<br>贪吃蛇游戏 | `registerCommand`, `ui.custom`, keyboard handling |
| `space-invaders.ts` | Space Invaders game<br>太空侵略者游戏 | `registerCommand`, `ui.custom` |
| `doom-overlay/` | Doom in overlay<br>在覆盖层中运行 Doom | `ui.custom` with overlay |
| **Providers**<br>**Provider** |||
| `custom-provider-anthropic/` | Custom Anthropic proxy<br>自定义 Anthropic 代理 | `registerProvider` |
| `custom-provider-gitlab-duo/` | GitLab Duo integration<br>GitLab Duo 集成 | `registerProvider` with OAuth |
| **Messages & Communication**<br>**消息与通信** |||
| `message-renderer.ts` | Custom message rendering<br>自定义消息渲染 | `registerMessageRenderer`, `sendMessage` |
| `entry-renderer.ts` | TUI-only custom entry rendering<br>仅限 TUI 的自定义条目渲染 | `registerEntryRenderer`, `appendEntry` |
| `event-bus.ts` | Inter-extension events<br>扩展间事件 | `pi.events` |
| **Session Metadata**<br>**会话元数据** |||
| `session-name.ts` | Name sessions for selector<br>为会话选择器命名会话 | `setSessionName`, `getSessionName` |
| `bookmark.ts` | Bookmark entries for /tree<br>为 /tree 添加条目书签 | `setLabel` |
| **Misc**<br>**其他** |||
| `inline-bash.ts` | Inline bash in tool calls<br>工具调用中的内联 bash | `on("tool_call")` |
| `bash-spawn-hook.ts` | Adjust bash command, cwd, and env before execution<br>在执行前调整 bash 命令、cwd 和环境变量 | `createBashTool`, `spawnHook` |
| `with-deps/` | Extension with npm dependencies<br>带 npm 依赖的扩展 | Package structure with `package.json` |
