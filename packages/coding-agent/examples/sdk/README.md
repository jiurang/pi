# SDK Examples SDK 示例

Programmatic usage of pi-coding-agent via `createAgentSession()` and `createAgentSessionRuntime()`.
通过 `createAgentSession()` 和 `createAgentSessionRuntime()` 以编程方式使用 pi-coding-agent。

The runtime example shows how to build a recreate function that closes over process-global fixed inputs and recreates cwd-bound services and sessions as the active session cwd changes.
runtime 示例展示了如何构建一个 recreate 函数：它闭包捕获进程级全局的固定输入，并在活动会话的 cwd 发生变化时重建与 cwd 绑定的服务和会话。

## Examples 示例列表

| File 文件 | Description 说明 |
|------|-------------|
| `01-minimal.ts` | Simplest usage with all defaults<br>使用全部默认配置的最简用法 |
| `02-custom-model.ts` | Select model and thinking level<br>选择模型与思考级别（thinking level） |
| `03-custom-prompt.ts` | Replace or modify system prompt<br>替换或修改系统提示词 |
| `04-skills.ts` | Discover, filter, or replace skills<br>发现、过滤或替换 skills |
| `05-tools.ts` | Built-in tool allowlists<br>内置工具的允许列表（allowlist） |
| `06-extensions.ts` | Logging, blocking, result modification<br>日志记录、阻断、结果修改 |
| `07-context-files.ts` | AGENTS.md context files<br>AGENTS.md 上下文文件 |
| `08-slash-commands.ts` | File-based slash commands<br>基于文件的斜杠命令 |
| `09-api-keys-and-oauth.ts` | API key resolution, OAuth config<br>API key 解析与 OAuth 配置 |
| `10-settings.ts` | Override compaction, retry, terminal settings<br>覆盖压缩（compaction）、重试与终端设置 |
| `11-sessions.ts` | In-memory, persistent, continue, list sessions<br>内存会话、持久化会话、继续会话、列出会话 |
| `12-full-control.ts` | Replace everything, no discovery<br>全量替换，不做自动发现 |
| `13-session-runtime.ts` | Manage runtime-backed session replacement<br>管理由 runtime 支撑的会话替换 |

## Running 运行

```bash
cd packages/coding-agent
npx tsx examples/sdk/01-minimal.ts
```

## Quick Reference 快速参考

```typescript
import { getModel } from "@earendil-works/pi-ai";
import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();

// Minimal
const { session } = await createAgentSession({ modelRuntime });

// Custom model
const model = getModel("anthropic", "claude-opus-4-5");
const { session } = await createAgentSession({ model, thinkingLevel: "high", modelRuntime });

// Modify prompt
const loader = new DefaultResourceLoader({
  systemPromptOverride: (base) => `${base}\n\nBe concise.`,
});
await loader.reload();
const { session } = await createAgentSession({ resourceLoader: loader, modelRuntime });

// Read-only
const { session } = await createAgentSession({ tools: ["read", "grep", "find", "ls"], modelRuntime });

// In-memory
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime,
});

// Full control
const customRuntime = await ModelRuntime.create({
  authPath: "/my/app/auth.json",
  modelsPath: "/my/app/models.json",
});
customRuntime.setRuntimeApiKey("anthropic", process.env.MY_KEY!);

const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => "You are helpful.",
  extensionFactories: [myExtension],
  skillsOverride: () => ({ skills: [], diagnostics: [] }),
  agentsFilesOverride: () => ({ agentsFiles: [] }),
  promptsOverride: () => ({ prompts: [], diagnostics: [] }),
});
await resourceLoader.reload();

const { session } = await createAgentSession({
  model,
  modelRuntime: customRuntime,
  resourceLoader,
  tools: ["read", "bash", "my_tool"],
  customTools: [myTool],
  sessionManager: SessionManager.inMemory(),
  settingsManager: SettingsManager.inMemory(),
});

// Run prompts
session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});
await session.prompt("Hello");
```

## Options 选项

| Option 选项 | Default 默认值 | Description 说明 |
|--------|---------|-------------|
| `modelRuntime` | Runtime using `agentDir/auth.json` and `models.json`<br>使用 `agentDir/auth.json` 和 `models.json` 的 runtime | Canonical model and authentication runtime<br>规范的模型与认证 runtime |
| `cwd` | `process.cwd()` | Working directory<br>工作目录 |
| `agentDir` | `~/.pi/agent` | Config directory<br>配置目录 |
| `model` | From settings/first available<br>取自设置，或第一个可用模型 | Model to use<br>要使用的模型 |
| `thinkingLevel` | From settings/"off"<br>取自设置，或 "off" | off, low, medium, high<br>关闭、低、中、高 |
| `tools` | `["read", "bash", "edit", "write"]` built-ins<br>内置的 `["read", "bash", "edit", "write"]` | Allowlist tool names across built-in, extension, and custom tools<br>在内置工具、扩展工具和自定义工具中按名称设置允许列表 |
| `customTools` | `[]` | Additional tool definitions<br>额外的工具定义 |
| `resourceLoader` | DefaultResourceLoader | Resource loader for extensions, skills, prompts, themes, and context files<br>用于扩展、skills、提示词、主题和上下文文件的资源加载器 |
| `sessionManager` | `SessionManager.create(cwd)` | Persistence<br>持久化 |
| `settingsManager` | `SettingsManager.create(cwd, agentDir)` | Settings overrides<br>设置覆盖 |

## Events 事件

```typescript
session.subscribe((event) => {
  switch (event.type) {
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      break;
    case "tool_execution_start":
      console.log(`Tool: ${event.toolName}`);
      break;
    case "tool_execution_end":
      console.log(`Result: ${event.result}`);
      break;
    case "agent_end":
      console.log("Done");
      break;
  }
});
```
